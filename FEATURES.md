# GitGud features

GitGud is a free, open-source, cross-platform Git GUI client for Linux, Windows and macOS.
Here are 100 things it does.

## Commit graph and history

1. Visual commit graph showing branches and merges, drawn on a canvas for smooth scrolling
2. The checked-out branch stays a straight line on the left of the graph
3. Stashes appear in the commit log next to the commits they were made on
4. Tags and branch labels are shown on their commits in the log
5. A `+N` badge when several branches point to the same commit
6. A work-in-progress row at the top of the log whenever the working directory has changes
7. Detached HEAD is shown as its own label in the log
8. Author avatars in the log, with a generated identicon when no picture is found
9. Search commits by message, and by branch name
10. Selecting a branch selects its commit and scrolls it into view
11. Ahead / behind commit counts between a local branch and its tracked remote branch
12. A conflict count warning in the log while a merge or rebase is conflicted
13. Sharp graph rendering on HiDPI screens and at any zoom level

## Inspecting commits

14. Commit details panel with author, date, parent and changed files
15. Copy a commit SHA in one click
16. Select several commits to see their combined diff
17. One summary card for a multi-commit selection, with every author's avatar
18. A mini timeline showing when each selected commit was made
19. File history for any file
20. Blame view for any file
21. Open a file as it was at a given commit in the system's default application
22. Restore a file from a given commit
23. Copy a file's absolute or relative path, or reveal it in the file manager

## Rewriting history

24. Reword the message of any commit on the checked-out branch
25. Amend the last commit
26. Fixup a commit into its parent
27. Drop a commit from history, with the commits above it rebased automatically
28. Move a commit up or down in history
29. Cherry-pick a commit
30. Revert a commit
31. Reset a branch to a commit: soft, mixed or hard
32. Interactive rebase dialog with pick, reword, squash, fixup and drop
33. Drag and drop to reorder commits in the interactive rebase
34. Start an interactive rebase from any commit, or onto any branch
35. Skip a commit during a rebase, with an option to skip empty commits
36. Continue or abort a rebase in progress
37. Undo and redo git actions, derived from the reflog
38. Undo covers stash, branch and tag actions, including deleting a remote branch or tag

## Branches

39. Local branches in a foldable tree, grouped by their `/` prefixes
40. Remote branches nested under their remote
41. Double-click a branch to check it out
42. Create a branch from the toolbar or from any commit
43. Rename a branch
44. Delete a local or remote branch, with force delete when it is not merged
45. Remove every branch of a folder at once
46. Merge a branch into the current one
47. Rebase the current branch onto another
48. Fast-forward a branch to another
49. Drag a branch onto another to merge, rebase, fast-forward or push
50. Conflict prediction: the number of conflicting files is shown before a merge or rebase
51. Diverged branches: choose between rebase, merge or force push

## Remotes

52. Push, pull and fetch from the toolbar
53. Set the upstream when pushing a branch that has none
54. Automatic background fetch
55. Time since the last fetch shown in the toolbar
56. Edit a remote's URL
57. Clone a repository from a dialog
58. Initialise a new repository

## Tags

59. Tags in a foldable tree, nested by their `/` prefixes
60. Create a lightweight tag on any commit
61. Annotate a tag
62. Push a tag to the remote
63. Delete a tag locally or from the remote
64. Drag a tag onto a branch to fast-forward or merge
65. Reset the current branch to a tag, or check out the tag's commit

## Stashes

66. Stash and pop from the toolbar
67. Stash list in the sidebar
68. Apply, pop or drop any stash
69. Browse the files and diffs of a stash

## Worktrees

70. Create a worktree from a dialog
71. Open a worktree in a new tab
72. Remove a worktree, optionally deleting its branch
73. Prune stale worktrees

## Staging and committing

74. Staged and unstaged file lists with one-click stage and unstage
75. Stage or unstage a single hunk by right-click in the diff
76. Stage or unstage a single line, or a selection of lines
77. Discard a file, a hunk, a line or a selection of lines
78. Commit with `Ctrl+Enter`
79. A dedicated section for conflicted files
80. The file lists and the open diff refresh live when files change on disk
81. Multi-file selection and a context menu in the file lists

## Diff and merge editor

82. Monaco diff editor, the editor that powers VS Code
83. Split, inline and hunk diff views
84. The diff opens scrolled to the first change
85. Image diffs, and a dedicated screen for other binary files
86. Line-ending (CRLF / LF) changes are made visible
87. Copy a file and line reference from the diff editor
88. Three-way merge editor to resolve conflicts
89. Accept all changes from either side of a conflict

## Application

90. Several repositories open at once, each in its own tab
91. Reorder tabs by drag and drop
92. `Ctrl+T`, `Ctrl+W` and `Ctrl+Shift+T` to open, close and reopen tabs; middle-click closes a tab
93. Recently opened repositories on the new-tab page
94. Themes: Light, Dark, Darcula, Forest, Submarine and One Rainbow
95. Zoom the whole interface in and out
96. Choose which git binary to use, with a clear message when git is not found
97. Edit the global and per-repository git identity (name and email)
98. A history of every git command the app ran for you
99. Update check, with a download link for the package matching your install
100. Native and lightweight: built with Tauri and Rust, packaged for Linux, Windows and macOS

[Download GitGud](https://github.com/zeuros/gitgud/releases/latest) · [Back to the README](README.md)
