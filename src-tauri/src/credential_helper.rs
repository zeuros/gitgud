/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

//! The binary as a git credential helper, keeping HTTPS credentials in the system's keyring.
//!
//! At startup the app adds `credential.helper` to the git it runs, after the user's own helpers, and disables git's
//! terminal prompts (see `configure_git`). Git then runs `<binary> --git-credential <action>` with the request on stdin
//! (`protocol=https`, `host=…`, maybe `path=…` and `username=…`):
//! - `get`: answers with the credential the app's sign-in dialog passed in `GITGUD_CREDENTIAL_*`, or else the one
//!   saved for that URL; nothing when there's none, and git fails with an authentication error the app shows the
//!   sign-in dialog for
//! - `store`: saves the credential git just authenticated with
//! - `erase`: deletes the credential the server rejected, so the next attempt asks again
//!
//! Credentials are kept per protocol and host (plus the path when git sends it) in the keyring:
//! - Linux: Secret Service, or in a Flatpak the Secret portal's encrypted file of the app's
//! - macOS: the Keychain; Windows: the Credential Manager

use std::collections::HashMap;
use std::io::{BufRead, Write};

const HELPER_FLAG: &str = "--git-credential";
const SIGN_IN_URL: &str = "GITGUD_CREDENTIAL_URL";
const SIGN_IN_USERNAME: &str = "GITGUD_CREDENTIAL_USERNAME";
const SIGN_IN_PASSWORD: &str = "GITGUD_CREDENTIAL_PASSWORD";

/// Git's request: its `key=value` lines
type Request = HashMap<String, String>;

#[derive(serde::Serialize, serde::Deserialize, PartialEq, Debug)]
struct Credential {
    username: String,
    password: String,
    // Kept for the helpers that set them (e.g. an OAuth sign-in): git passes them back on `get`
    #[serde(default, skip_serializing_if = "Option::is_none")]
    password_expiry_utc: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    oauth_refresh_token: Option<String>,
}

impl Credential {
    fn new(username: String, password: String) -> Self {
        Credential { username, password, password_expiry_utc: None, oauth_refresh_token: None }
    }

    /// The credential git sends with `store` and `erase`
    fn from_request(request: &Request) -> Option<Self> {
        Some(Credential {
            password_expiry_utc: request.get("password_expiry_utc").cloned(),
            oauth_refresh_token: request.get("oauth_refresh_token").cloned(),
            ..Credential::new(request.get("username")?.clone(), request.get("password")?.clone())
        })
    }
}

/// Git's request: its `key=value` lines up to an empty line
fn parse_request(input: impl BufRead) -> Request {
    input
        .lines()
        .map_while(Result::ok)
        .take_while(|line| !line.is_empty())
        .filter_map(|line| line.split_once('=').map(|(key, value)| (key.to_string(), value.to_string())))
        .collect()
}

/// `protocol://host[/path]`: what a credential is saved for
fn credential_url(request: &Request) -> Option<String> {
    let (protocol, host) = (request.get("protocol")?, request.get("host")?);
    Some(match request.get("path").filter(|path| !path.is_empty()) {
        Some(path) => format!("{protocol}://{host}/{path}"),
        None => format!("{protocol}://{host}"),
    })
}

/// The credential the sign-in dialog passed for this request's protocol and host
fn sign_in_credential(request: &Request) -> Option<Credential> {
    let url = std::env::var(SIGN_IN_URL).ok()?;
    let requested = format!("{}://{}", request.get("protocol")?, request.get("host")?);
    if url != requested {
        return None;
    }
    Some(Credential::new(std::env::var(SIGN_IN_USERNAME).ok()?, std::env::var(SIGN_IN_PASSWORD).ok()?))
}

/// A request naming a username only matches a credential for that user
fn matches_username(request: &Request, credential: &Credential) -> bool {
    request.get("username").is_none_or(|username| *username == credential.username)
}

/// An `erase` naming a password only deletes a credential with that password: not one saved since
fn matches_password(request: &Request, credential: &Credential) -> bool {
    request.get("password").is_none_or(|password| *password == credential.password)
}

fn answer_get(request: &Request, out: &mut impl Write) -> std::io::Result<()> {
    let sign_in = sign_in_credential(request).filter(|credential| matches_username(request, credential));
    let Some(credential) = sign_in.or_else(|| keyring::load(request)) else { return Ok(()) };
    write!(out, "username={}\npassword={}\n", credential.username, credential.password)?;
    if let Some(expiry) = &credential.password_expiry_utc {
        writeln!(out, "password_expiry_utc={expiry}")?;
    }
    if let Some(token) = &credential.oauth_refresh_token {
        writeln!(out, "oauth_refresh_token={token}")?;
    }
    Ok(())
}

fn run(action: &str) -> std::io::Result<()> {
    let request = parse_request(std::io::stdin().lock());
    if credential_url(&request).is_none() {
        return Ok(());
    }
    match action {
        "get" => answer_get(&request, &mut std::io::stdout().lock()),
        "store" => {
            if let Some(credential) = Credential::from_request(&request) {
                keyring::save(&request, &credential);
            }
            Ok(())
        }
        "erase" => {
            keyring::erase(&request);
            Ok(())
        }
        // Git asks helpers to ignore the actions they don't know
        _ => Ok(()),
    }
}

/// When git started the binary as its credential helper, answers git and returns the exit code; None otherwise
pub fn run_if_requested() -> Option<i32> {
    let mut args = std::env::args().skip(1);
    if args.next()? != HELPER_FLAG {
        return None;
    }
    let action = args.next().unwrap_or_default();
    Some(match run(&action) {
        Ok(()) => 0,
        Err(error) => {
            eprintln!("GitGud's credential helper: {error}");
            1
        }
    })
}

/// Adds GitGud's credential helper to the git the app runs, after the user's helpers, and disables git's terminal
/// prompts: an app started from a terminal would otherwise have git ask there, unseen
pub fn configure_git() {
    std::env::set_var("GIT_TERMINAL_PROMPT", "0");
    // GIT_CONFIG_COUNT adds `-c` entries to every git command, after the user's config. Git finds the binary through
    // PATH, under GITGUD_BINARY_NAME (see sequence_editor::expose_binary_name)
    let count: usize = std::env::var("GIT_CONFIG_COUNT").ok().and_then(|count| count.parse().ok()).unwrap_or(0);
    std::env::set_var(format!("GIT_CONFIG_KEY_{count}"), "credential.helper");
    std::env::set_var(format!("GIT_CONFIG_VALUE_{count}"), format!("!\"$GITGUD_BINARY_NAME\" {HELPER_FLAG}"));
    std::env::set_var("GIT_CONFIG_COUNT", (count + 1).to_string());
}

#[cfg(target_os = "linux")]
mod keyring {
    use super::{credential_url, matches_password, matches_username, Credential, Request};
    use std::collections::HashMap;

    const SERVICE: &str = "GitGud";

    // One item per URL, holding the username with the password
    fn attributes(request: &Request) -> Option<HashMap<&'static str, String>> {
        Some(HashMap::from([("service", SERVICE.to_string()), ("url", credential_url(request)?)]))
    }

    /// Secret Service, or the Secret portal's file in a Flatpak
    fn with_keyring<T>(operation: impl AsyncFnOnce(&oo7::Keyring) -> oo7::Result<T>) -> Option<T> {
        let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().ok()?;
        let result = runtime.block_on(async {
            let keyring = oo7::Keyring::new().await?;
            if keyring.is_locked().await? {
                keyring.unlock().await?;
            }
            operation(&keyring).await
        });
        result.map_err(|error| eprintln!("GitGud's credential helper: keyring: {error}")).ok()
    }

    pub fn load(request: &Request) -> Option<Credential> {
        let attributes = attributes(request)?;
        let secret = with_keyring(async |keyring| match keyring.search_items(&attributes).await?.first() {
            Some(item) => Ok(Some(item.secret().await?)),
            None => Ok(None),
        })??;
        let credential: Credential = serde_json::from_slice(secret.as_bytes()).ok()?;
        matches_username(request, &credential).then_some(credential)
    }

    pub fn save(request: &Request, credential: &Credential) {
        let (Some(attributes), Ok(secret)) = (attributes(request), serde_json::to_string(credential)) else { return };
        let label = format!("GitGud: {}", attributes["url"]);
        with_keyring(async |keyring| keyring.create_item(&label, &attributes, secret, true).await);
    }

    pub fn erase(request: &Request) {
        let Some(attributes) = attributes(request) else { return };
        if load(request).is_some_and(|saved| matches_password(request, &saved)) {
            with_keyring(async |keyring| keyring.delete(&attributes).await);
        }
    }
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
mod keyring {
    use super::{credential_url, matches_password, matches_username, Credential, Request};

    const SERVICE: &str = "GitGud";

    // One entry per URL, holding the username with the password
    fn entry(request: &Request) -> Option<keyring_core::Entry> {
        #[cfg(target_os = "macos")]
        let store = apple_native_keyring_store::keychain::Store::new();
        #[cfg(target_os = "windows")]
        let store = windows_native_keyring_store::Store::new();
        keyring_core::set_default_store(store.map_err(|error| eprintln!("GitGud's credential helper: keyring: {error}")).ok()?);
        keyring_core::Entry::new(SERVICE, &credential_url(request)?).ok()
    }

    pub fn load(request: &Request) -> Option<Credential> {
        let credential: Credential = serde_json::from_str(&entry(request)?.get_password().ok()?).ok()?;
        matches_username(request, &credential).then_some(credential)
    }

    pub fn save(request: &Request, credential: &Credential) {
        if let (Some(entry), Ok(secret)) = (entry(request), serde_json::to_string(credential)) {
            let _ = entry.set_password(&secret);
        }
    }

    pub fn erase(request: &Request) {
        if load(request).is_some_and(|saved| matches_password(request, &saved)) {
            if let Some(entry) = entry(request) {
                let _ = entry.delete_credential();
            }
        }
    }
}

// No keyring: only the credential the sign-in dialog passes
#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
mod keyring {
    use super::{Credential, Request};

    pub fn load(_request: &Request) -> Option<Credential> {
        None
    }

    pub fn save(_request: &Request, _credential: &Credential) {}

    pub fn erase(_request: &Request) {}
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(lines: &str) -> Request {
        parse_request(lines.as_bytes())
    }

    #[test]
    fn parses_git_request_up_to_the_empty_line() {
        let parsed = request("protocol=https\nhost=github.com\nwwwauth[]=Basic realm=\"GitHub\"\n\nignored=1\n");
        assert_eq!(parsed.get("host").map(String::as_str), Some("github.com"));
        assert_eq!(parsed.get("wwwauth[]").map(String::as_str), Some("Basic realm=\"GitHub\""));
        assert!(!parsed.contains_key("ignored"));
    }

    #[test]
    fn credential_url_includes_the_path_only_when_git_sends_it() {
        assert_eq!(credential_url(&request("protocol=https\nhost=github.com\n")).as_deref(), Some("https://github.com"));
        assert_eq!(
            credential_url(&request("protocol=https\nhost=example.com:8443\npath=team/repo.git\n")).as_deref(),
            Some("https://example.com:8443/team/repo.git"),
        );
        assert_eq!(credential_url(&request("protocol=https\n")), None);
    }

    #[test]
    fn a_requested_username_must_match() {
        let credential = Credential::new("ada".into(), "token".into());
        assert!(matches_username(&request("host=github.com\n"), &credential));
        assert!(matches_username(&request("username=ada\n"), &credential));
        assert!(!matches_username(&request("username=bob\n"), &credential));
    }

    #[test]
    fn erase_spares_a_credential_saved_with_another_password() {
        let credential = Credential::new("ada".into(), "token".into());
        assert!(matches_password(&request("username=ada\n"), &credential));
        assert!(matches_password(&request("password=token\n"), &credential));
        assert!(!matches_password(&request("password=rejected\n"), &credential));
    }

    // One test for the environment: tests run in parallel and share it
    #[test]
    fn get_answers_with_the_sign_in_credential_of_the_same_host() {
        std::env::set_var(SIGN_IN_URL, "https://github.com");
        std::env::set_var(SIGN_IN_USERNAME, "ada");
        std::env::set_var(SIGN_IN_PASSWORD, "token");

        let github = request("protocol=https\nhost=github.com\n");
        assert_eq!(sign_in_credential(&github), Some(Credential::new("ada".into(), "token".into())));
        let mut out = Vec::new();
        answer_get(&github, &mut out).unwrap();
        assert_eq!(String::from_utf8(out).unwrap(), "username=ada\npassword=token\n");

        assert_eq!(sign_in_credential(&request("protocol=https\nhost=gitlab.com\n")), None);
        assert_eq!(sign_in_credential(&request("protocol=http\nhost=github.com\n")), None);
    }
}
