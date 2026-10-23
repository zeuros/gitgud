use std::process::Command;

fn git(args: &[&str]) -> Option<String> {
    let out = Command::new("git").args(args).output().ok()?;
    out.status.success().then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Short commit of a build that isn't the tagged release of its version (local and dev builds), "-dirty" when the
/// working tree had uncommitted changes. Unset for release builds, and when there's no git repository (source tarball)
fn dev_build_commit() -> Option<String> {
    let sha = git(&["rev-parse", "--short", "HEAD"])?;
    let release_tag = format!("v{}", std::env::var("CARGO_PKG_VERSION").ok()?);
    let tagged = git(&["tag", "--points-at", "HEAD"])?.lines().any(|tag| tag == release_tag);
    if tagged || std::env::var("GITHUB_REF_TYPE").as_deref() == Ok("tag") {
        return None;
    }
    let dirty = git(&["status", "--porcelain", "--untracked-files=no"]).is_some_and(|s| !s.is_empty());
    Some(if dirty { format!("{sha}-dirty") } else { sha })
}

fn main() {
    // Rebuild when HEAD moves (commit, checkout) or the index changes (staging, so "-dirty" stays accurate)
    for path in ["HEAD", "index", "packed-refs", "refs/tags"] {
        if let Some(p) = git(&["rev-parse", "--path-format=absolute", "--git-path", path]) {
            println!("cargo:rerun-if-changed={p}");
        }
    }
    if let Some(head_ref) = git(&["symbolic-ref", "-q", "HEAD"]) {
        if let Some(p) = git(&["rev-parse", "--path-format=absolute", "--git-path", &head_ref]) {
            println!("cargo:rerun-if-changed={p}");
        }
    }
    if let Some(commit) = dev_build_commit() {
        println!("cargo:rustc-env=GITGUD_BUILD_COMMIT={commit}");
    }

    tauri_build::build()
}
