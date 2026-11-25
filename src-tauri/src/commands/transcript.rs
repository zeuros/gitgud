use memchr::memmem;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::ipc::Channel;

const SNIPPET_CHARS_BEFORE: usize = 30;
const SNIPPET_CHARS_AFTER: usize = 80;
const MAX_MATCHES: usize = 50;
// Of a tool's output, the agent view shows the start
const MAX_RESULT_CHARS: usize = 2000;

/// Bumped by each search: a running search stops once a newer one starts
static SEARCH_GENERATION: AtomicU64 = AtomicU64::new(0);

/// A Claude Code transcript with the words searched, around their first occurrence
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptMatch {
    path: String,
    modified_ms: u64,
    title: Option<String>,
    before: String,
    matched: String,
    after: String,
}

/// Searches the prompts and answers of the transcripts (`*.jsonl`) in `dirs`, ignoring case, the most recently
/// modified first, sending each match to `on_match` as found. Resolves with the number of matches sent, once done
/// or cancelled by a newer search.
#[tauri::command]
pub async fn search_transcripts(dirs: Vec<String>, query: String, on_match: Channel<TranscriptMatch>) -> Result<usize, String> {
    let generation = SEARCH_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let is_current = move || SEARCH_GENERATION.load(Ordering::SeqCst) == generation;
    tauri::async_runtime::spawn_blocking(move || search(&dirs, &query, &is_current, &|found| on_match.send(found).is_ok()))
    .await
    .map_err(|e| e.to_string())
}

/// Calls `on_match` with each match until it returns false, `keep_going` does, or `MAX_MATCHES` were found.
/// Returns the number of matches sent.
fn search(
    dirs: &[String],
    query: &str,
    keep_going: &(dyn Fn() -> bool + Sync),
    on_match: &(dyn Fn(TranscriptMatch) -> bool + Sync),
) -> usize {
    let query = query.trim().to_lowercase();
    if query.is_empty() {
        return 0;
    }

    let mut files: Vec<(String, u64)> = dirs
        .iter()
        .flat_map(|dir| fs::read_dir(dir).into_iter().flatten().flatten().map(move |entry| (dir, entry)))
        .filter(|(_, entry)| entry.file_name().to_string_lossy().ends_with(".jsonl"))
        .map(|(dir, entry)| {
            let modified_ms = entry
                .metadata()
                .and_then(|metadata| metadata.modified())
                .ok()
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map_or(0, |duration| duration.as_millis() as u64);
            (format!("{dir}/{}", entry.file_name().to_string_lossy()), modified_ms)
        })
        .collect();
    files.sort_by_key(|(_, modified_ms)| std::cmp::Reverse(*modified_ms));

    // Threads take the next file, the newest first
    let next_file = AtomicUsize::new(0);
    let match_count = Mutex::new(0);
    let sent_count = AtomicUsize::new(0);
    let threads = std::thread::available_parallelism().map_or(4, |count| count.get()).min(8);
    std::thread::scope(|scope| {
        for _ in 0..threads {
            scope.spawn(|| loop {
                let Some((path, modified_ms)) = files.get(next_file.fetch_add(1, Ordering::Relaxed)) else { return };
                if !keep_going() || *match_count.lock().unwrap() >= MAX_MATCHES {
                    return;
                }
                let Some((title, (before, matched, after))) = search_file(path, &query) else { continue };
                let mut count = match_count.lock().unwrap();
                if *count >= MAX_MATCHES || !keep_going() {
                    return;
                }
                *count += 1;
                let found = TranscriptMatch { path: path.clone(), modified_ms: *modified_ms, title, before, matched, after };
                if on_match(found) {
                    sent_count.fetch_add(1, Ordering::Relaxed);
                } else {
                    *count = MAX_MATCHES;
                }
            });
        }
    });
    sent_count.into_inner()
}

/// What the agent view shows of a transcript line. A tool's result comes in a later line than the tool.
#[derive(Serialize, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TranscriptEntry {
    Prompt { text: String },
    Text { text: String },
    Tool { id: String, name: String, summary: String },
    #[serde(rename_all = "camelCase")]
    Result { tool_id: String, result: String, is_error: bool },
}

/// The lines of a transcript from a byte on, as the agent view shows them
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptChunk {
    entries: Vec<TranscriptEntry>,
    title: Option<String>,
    /// Where the next chunk starts: after the last complete line
    next_byte: u64,
    /// The file is shorter than `from_byte` (rewritten): read from its start
    restarted: bool,
}

/// Reads Claude Code's transcript at `path` from `from_byte` on, up to its last complete line
/// Claude's title of each transcript at `paths`, null when it has none yet or can't be read
#[tauri::command]
pub async fn transcript_titles(paths: Vec<String>) -> Result<Vec<Option<String>>, String> {
    tauri::async_runtime::spawn_blocking(move || paths.iter().map(|path| fs::read(path).ok().and_then(|bytes| title(&bytes))).collect())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_transcript(path: String, from_byte: u64) -> Result<TranscriptChunk, String> {
    tauri::async_runtime::spawn_blocking(move || read_chunk(&path, from_byte))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

fn read_chunk(path: &str, from_byte: u64) -> std::io::Result<TranscriptChunk> {
    let mut file = fs::File::open(path)?;
    let restarted = file.metadata()?.len() < from_byte;
    let start = if restarted { 0 } else { from_byte };
    file.seek(SeekFrom::Start(start))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)?;
    Ok(parse_chunk(&bytes, start, restarted))
}

fn parse_chunk(bytes: &[u8], start: u64, restarted: bool) -> TranscriptChunk {
    // The line being written is read with the next chunk
    let complete = memchr::memrchr(b'\n', bytes).map_or(0, |index| index + 1);
    let mut chunk = TranscriptChunk { entries: Vec::new(), title: None, next_byte: start + complete as u64, restarted };
    for line in bytes[..complete].split(|byte| *byte == b'\n') {
        if let Ok(entry) = serde_json::from_slice::<Value>(line) {
            add_line(&mut chunk, &entry);
        }
    }
    chunk
}

fn add_line(chunk: &mut TranscriptChunk, line: &Value) {
    if line["isSidechain"].as_bool() == Some(true) {
        return;
    }
    let kind = line["type"].as_str().unwrap_or_default();
    if kind == "ai-title" {
        if let Some(title) = line["aiTitle"].as_str() {
            chunk.title = Some(title.to_string());
        }
        return;
    }
    let is_user = match kind {
        "user" => true,
        "assistant" => false,
        _ => return,
    };
    let content = &line["message"]["content"];
    if let Some(text) = content.as_str() {
        chunk.entries.extend(text_entry(text, is_user));
        return;
    }
    for block in content.as_array().into_iter().flatten() {
        let entry = match block["type"].as_str() {
            Some("text") => block["text"].as_str().and_then(|text| text_entry(text, is_user)),
            Some("tool_use") => block["id"].as_str().map(|id| TranscriptEntry::Tool {
                id: id.to_string(),
                name: block["name"].as_str().unwrap_or("Tool").to_string(),
                summary: tool_summary(&block["input"]),
            }),
            Some("tool_result") => block["tool_use_id"].as_str().map(|tool_id| TranscriptEntry::Result {
                tool_id: tool_id.to_string(),
                result: result_text(&block["content"]).chars().take(MAX_RESULT_CHARS).collect(),
                is_error: block["is_error"].as_bool() == Some(true),
            }),
            _ => None,
        };
        chunk.entries.extend(entry);
    }
}

/// A prompt the user wrote (not a tag Claude Code adds: command output, reminders), or an answer
fn text_entry(text: &str, is_user: bool) -> Option<TranscriptEntry> {
    let text = text.trim();
    if text.is_empty() || (is_user && text.starts_with('<')) {
        return None;
    }
    let text = text.to_string();
    Some(if is_user { TranscriptEntry::Prompt { text } } else { TranscriptEntry::Text { text } })
}

/// The input that says what a tool call does: the command run, the file read…
fn tool_summary(input: &Value) -> String {
    let value = ["command", "file_path", "pattern", "url", "description"]
        .iter()
        .find_map(|key| input[key].as_str())
        .or_else(|| input.as_object()?.values().find_map(Value::as_str));
    value.and_then(|value| value.lines().next()).unwrap_or_default().to_string()
}

fn result_text(content: &Value) -> String {
    match content {
        Value::String(text) => text.clone(),
        Value::Array(blocks) => blocks.iter().map(|block| block["text"].as_str().unwrap_or_default()).collect::<Vec<_>>().join("\n"),
        _ => String::new(),
    }
}

/// The transcript's title and the first prompt or answer holding `query` (lowercase), split around it
fn search_file(path: &str, query: &str) -> Option<(Option<String>, (String, String, String))> {
    let bytes = fs::read(path).ok()?;
    let query_chars: Vec<char> = query.chars().collect();
    let found = lines_holding(&bytes, query)
        .filter_map(|line| serde_json::from_slice::<Value>(line).ok())
        .find_map(|entry| texts(&entry).into_iter().find_map(|text| split_around(&text, &query_chars)))?;
    Some((title(&bytes), found))
}

/// The lines of `bytes` holding `query` (lowercase), ignoring case. An ASCII query is found in the bytes directly,
/// without decoding the lines that don't hold it.
fn lines_holding<'a>(bytes: &'a [u8], query: &str) -> Box<dyn Iterator<Item = &'a [u8]> + 'a> {
    if !query.is_ascii() {
        let query = query.to_string();
        return Box::new(
            bytes
                .split(|byte| *byte == b'\n')
                .filter(move |line| String::from_utf8_lossy(line).to_lowercase().contains(&query)),
        );
    }

    let lowered = bytes.to_ascii_lowercase();
    let finder = memmem::Finder::new(query.as_bytes()).into_owned();
    let mut searched_to = 0;
    Box::new(std::iter::from_fn(move || {
        let hit = searched_to + finder.find(&lowered[searched_to..])?;
        let (start, end) = line_bounds(bytes, hit);
        searched_to = (end + 1).min(bytes.len());
        Some(&bytes[start..end])
    }))
}

fn line_bounds(bytes: &[u8], position: usize) -> (usize, usize) {
    let start = memchr::memrchr(b'\n', &bytes[..position]).map_or(0, |index| index + 1);
    let end = memchr::memchr(b'\n', &bytes[position..]).map_or(bytes.len(), |index| position + index);
    (start, end)
}

/// The last title Claude Code gave the session
fn title(bytes: &[u8]) -> Option<String> {
    let position = memmem::rfind(bytes, b"\"ai-title\"")?;
    let (start, end) = line_bounds(bytes, position);
    let entry: Value = serde_json::from_slice(&bytes[start..end]).ok()?;
    entry["aiTitle"].as_str().map(String::from)
}

/// The prompt or answer texts of a transcript line, as the agent view shows them
fn texts(entry: &Value) -> Vec<String> {
    let is_message = matches!(entry["type"].as_str(), Some("user" | "assistant"));
    if !is_message || entry["isSidechain"].as_bool() == Some(true) {
        return Vec::new();
    }
    let content = &entry["message"]["content"];
    let texts = match content.as_str() {
        Some(text) => vec![text.to_string()],
        None => content
            .as_array()
            .into_iter()
            .flatten()
            .filter(|block| block["type"] == "text")
            .filter_map(|block| block["text"].as_str().map(String::from))
            .collect(),
    };
    // Tag-prefixed user texts are what Claude Code adds (command output, reminders)
    texts.into_iter().filter(|text| !text.trim_start().starts_with('<')).collect()
}

fn split_around(text: &str, query: &[char]) -> Option<(String, String, String)> {
    let chars: Vec<char> = text.split_whitespace().collect::<Vec<_>>().join(" ").chars().collect();
    let lowered: Vec<char> = chars.iter().map(|c| c.to_lowercase().next().unwrap_or(*c)).collect();
    let start = lowered.windows(query.len()).position(|window| window == query)?;
    let end = start + query.len();
    let before_start = start.saturating_sub(SNIPPET_CHARS_BEFORE);
    let after_end = (end + SNIPPET_CHARS_AFTER).min(chars.len());
    let before = format!("{}{}", if before_start > 0 { "…" } else { "" }, chars[before_start..start].iter().collect::<String>());
    let after = format!("{}{}", chars[end..after_end].iter().collect::<String>(), if after_end < chars.len() { "…" } else { "" });
    Some((before, chars[start..end].iter().collect(), after))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn query(text: &str) -> Vec<char> {
        text.chars().flat_map(char::to_lowercase).collect()
    }

    fn found_lines<'a>(bytes: &'a [u8], query: &str) -> Vec<&'a str> {
        lines_holding(bytes, query).map(|line| std::str::from_utf8(line).unwrap()).collect()
    }

    #[test]
    fn splits_around_the_words_ignoring_case() {
        let (before, matched, after) = split_around("Fix the\n  Watcher limit", &query("watcher")).unwrap();
        assert_eq!((before.as_str(), matched.as_str(), after.as_str()), ("Fix the ", "Watcher", " limit"));
    }

    #[test]
    fn finds_each_line_holding_the_words_once_ignoring_case() {
        let bytes = b"one Tauri tauri\ntwo\nthree TAURI";
        assert_eq!(found_lines(bytes, "tauri"), ["one Tauri tauri", "three TAURI"]);
    }

    #[test]
    fn finds_words_with_accents_ignoring_case() {
        assert_eq!(found_lines("un Été\ndeux".as_bytes(), "été"), ["un Été"]);
    }

    #[test]
    fn reads_the_last_title() {
        let bytes = b"{\"type\":\"ai-title\",\"aiTitle\":\"Old\"}\n{\"type\":\"user\"}\n{\"type\":\"ai-title\",\"aiTitle\":\"New\"}";
        assert_eq!(title(bytes).as_deref(), Some("New"));
    }

    #[test]
    fn reads_prompts_and_answers_not_tags_nor_sidechains() {
        let prompt = serde_json::json!({"type": "user", "message": {"content": "hello"}});
        let tag = serde_json::json!({"type": "user", "message": {"content": "<command-name>/x</command-name>"}});
        let answer = serde_json::json!({"type": "assistant", "message": {"content": [{"type": "text", "text": "hi"}, {"type": "tool_use"}]}});
        let sidechain = serde_json::json!({"type": "assistant", "isSidechain": true, "message": {"content": "no"}});
        assert_eq!(texts(&prompt), ["hello"]);
        assert!(texts(&tag).is_empty());
        assert_eq!(texts(&answer), ["hi"]);
        assert!(texts(&sidechain).is_empty());
    }

    #[test]
    fn reads_prompts_answers_tools_and_their_results() {
        let lines = [
            serde_json::json!({"type": "user", "message": {"content": "fix the build"}}),
            serde_json::json!({"type": "assistant", "message": {"content": [
                {"type": "text", "text": "Looking."},
                {"type": "tool_use", "id": "t1", "name": "Bash", "input": {"command": "npm test\nmore"}}]}}),
            serde_json::json!({"type": "user", "message": {"content": [
                {"type": "tool_result", "tool_use_id": "t1", "content": [{"type": "text", "text": "1 failing"}], "is_error": true}]}}),
            serde_json::json!({"type": "ai-title", "aiTitle": "Fix the build"}),
        ];
        let bytes = lines.iter().map(|line| format!("{line}\n")).collect::<String>();
        let chunk = parse_chunk(bytes.as_bytes(), 0, false);
        assert_eq!(chunk.title.as_deref(), Some("Fix the build"));
        assert_eq!(chunk.next_byte, bytes.len() as u64);
        assert_eq!(chunk.entries, [
            TranscriptEntry::Prompt { text: "fix the build".into() },
            TranscriptEntry::Text { text: "Looking.".into() },
            TranscriptEntry::Tool { id: "t1".into(), name: "Bash".into(), summary: "npm test".into() },
            TranscriptEntry::Result { tool_id: "t1".into(), result: "1 failing".into(), is_error: true },
        ]);
    }

    #[test]
    fn skips_subagents_added_messages_and_stops_before_the_line_being_written() {
        let complete = [
            serde_json::json!({"type": "user", "isSidechain": true, "message": {"content": "subagent task"}}),
            serde_json::json!({"type": "user", "message": {"content": "<command-name>/clear</command-name>"}}),
            serde_json::json!({"type": "user", "message": {"content": [
                {"type": "text", "text": "<system-reminder>…</system-reminder>"}, {"type": "text", "text": "and the docs"}]}}),
        ].iter().map(|line| format!("{line}\n")).collect::<String>();
        let bytes = format!("{complete}{{\"type\":\"assistant\",\"mess");
        let chunk = parse_chunk(bytes.as_bytes(), 10, false);
        assert_eq!(chunk.entries, [TranscriptEntry::Prompt { text: "and the docs".into() }]);
        assert_eq!(chunk.next_byte, 10 + complete.len() as u64);
    }

    #[test]
    fn reads_from_a_byte_on_or_from_the_start_once_rewritten() {
        let path = std::env::temp_dir().join(format!("gitgud-transcript-{}.jsonl", std::process::id()));
        let first = format!("{}\n", serde_json::json!({"type": "user", "message": {"content": "one"}}));
        let second = format!("{}\n", serde_json::json!({"type": "user", "message": {"content": "two"}}));
        fs::write(&path, format!("{first}{second}")).unwrap();
        let path_text = path.to_string_lossy();

        let chunk = read_chunk(&path_text, first.len() as u64).unwrap();
        assert_eq!(chunk.entries, [TranscriptEntry::Prompt { text: "two".into() }]);
        assert!(!chunk.restarted);

        let chunk = read_chunk(&path_text, 10_000).unwrap();
        assert_eq!(chunk.entries.len(), 2);
        assert!(chunk.restarted);
        fs::remove_file(&path).unwrap();
    }

    #[test]
    #[ignore = "times a search of this machine's transcripts"]
    fn time_real_search() {
        let dir = format!("{}/.claude/projects/-home-zeuros-Documents-gitgud", std::env::var("HOME").unwrap());
        for query in ["tauri", "flamingo", "Rebase"] {
            let start = std::time::Instant::now();
            let count = AtomicUsize::new(0);
            search(std::slice::from_ref(&dir), query, &|| true, &|_| count.fetch_add(1, Ordering::Relaxed) < usize::MAX);
            eprintln!("TIMING {query}: {count:?} matches in {:?}", start.elapsed());
        }
    }

    #[test]
    #[ignore = "times reading this machine's largest transcript"]
    fn time_real_read() {
        let dir = format!("{}/.claude/projects/-home-zeuros-Documents-gitgud", std::env::var("HOME").unwrap());
        let largest = fs::read_dir(&dir).unwrap().flatten().max_by_key(|entry| entry.metadata().unwrap().len()).unwrap().path();
        let start = std::time::Instant::now();
        let chunk = read_chunk(&largest.to_string_lossy(), 0).unwrap();
        let read_ms = start.elapsed();
        let sent_bytes = serde_json::to_vec(&chunk).unwrap().len();
        let start = std::time::Instant::now();
        let next = read_chunk(&largest.to_string_lossy(), chunk.next_byte).unwrap();
        eprintln!("TIMING read {} bytes: {} entries, {sent_bytes} bytes sent, {read_ms:?}; next chunk {} entries in {:?}",
            chunk.next_byte, chunk.entries.len(), next.entries.len(), start.elapsed());
    }
}
