use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::io::{Read, Seek, SeekFrom};

// Of a tool's output, the agent view shows the start
const MAX_RESULT_CHARS: usize = 2000;

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

#[cfg(test)]
mod tests {
    use super::*;

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
