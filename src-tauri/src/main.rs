// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Started by git as the sequence editor of an interactive rebase: poll its todo file, don't start the app
    if let Some(exit_code) = gitgud_lib::sequence_editor::run_if_requested() {
        std::process::exit(exit_code);
    }
    gitgud_lib::run()
}
