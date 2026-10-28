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

    let dirs = tree_dirs(&worktree, true, &[".git".into()], true);
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

#[test]
fn anchored_skip_entries_match_only_below_the_root() {
    let common_dir = std::env::temp_dir().join(format!("gitgud-watcher-anchored-test-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&common_dir);
    for dir in ["objects/ab", "refs/heads/hooks", "hooks"] {
        std::fs::create_dir_all(common_dir.join(dir)).unwrap();
    }
    let skip = ["/objects".to_string(), "/hooks".to_string()];

    let dirs = tree_dirs(&common_dir, true, &skip, false);
    let roots = [Root { path: common_dir.clone(), git_ignore_rules: None }];
    let _ = std::fs::remove_dir_all(&common_dir);

    assert_eq!(dirs.len(), 3, "{dirs:?}");
    assert!(dirs.contains(&common_dir.join("refs/heads/hooks")));
    assert!(is_ignored(&common_dir.join("objects/ab/cd"), false, &roots, &skip));
    assert!(!is_ignored(&common_dir.join("refs/heads/hooks/main"), false, &roots, &skip));
    assert!(!is_ignored(&common_dir.join("refs/heads/objects"), false, &roots, &skip));
}
