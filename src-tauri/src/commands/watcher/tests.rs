use super::*;

#[test]
fn git_ignore_rules_skip_ignored_dirs_and_files() {
    let worktree = std::env::temp_dir().join(format!("gitgud-watcher-git-ignore-test-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&worktree);
    for dir in [".git/info", ".venv/lib", "src/generated", "src/kept"] {
        std::fs::create_dir_all(worktree.join(dir)).unwrap();
    }
    std::fs::write(worktree.join(".gitignore"), ".venv/\n*.log\n").unwrap();
    std::fs::write(worktree.join("src/.gitignore"), "generated/\n!keep.log\n").unwrap();
    std::fs::write(worktree.join(".git/info/exclude"), "local.txt\n").unwrap();

    let dirs = tree_dirs(&worktree, &[".git".into()], true);
    let rules = GitIgnoreRules::read(&worktree, &dirs);
    let relative_dirs: Vec<_> = dirs.iter().map(|d| d.strip_prefix(&worktree).unwrap().to_path_buf()).collect();
    let _ = std::fs::remove_dir_all(&worktree);

    assert_eq!(relative_dirs.len(), 2, "{relative_dirs:?}");
    assert!(relative_dirs.contains(&PathBuf::from("src")) && relative_dirs.contains(&PathBuf::from("src/kept")));
    assert!(rules.is_ignored(Path::new(".venv/lib/site.py"), false));
    assert!(rules.is_ignored(Path::new("src/generated/a.ts"), false));
    assert!(rules.is_ignored(Path::new("build.log"), false));
    assert!(rules.is_ignored(Path::new("local.txt"), false));
    assert!(!rules.is_ignored(Path::new("src/keep.log"), false));
    assert!(!rules.is_ignored(Path::new("src/kept/a.ts"), false));
}
