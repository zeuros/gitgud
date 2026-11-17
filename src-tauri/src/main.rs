// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Started by git as the sequence editor of an interactive rebase: edit its todo file, don't start the app
    if let Some(exit_code) = gitgud_lib::sequence_editor::run_if_requested() {
        std::process::exit(exit_code);
    }
    // Started by git as its credential helper: answer from the keyring, don't start the app
    if let Some(exit_code) = gitgud_lib::credential_helper::run_if_requested() {
        std::process::exit(exit_code);
    }
    gitgud_lib::run()
}
