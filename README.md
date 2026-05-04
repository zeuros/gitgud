
# GitGud ⚔️

[![GitHub release](https://img.shields.io/github/v/release/zeuros/gitgud)](https://github.com/zeuros/gitgud/releases)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Platform](https://img.shields.io/badge/platform-linux%20%7C%20windows%20%7C%20mac-lightgrey)](#)
[![Angular](https://img.shields.io/badge/Angular-21-red)](https://angular.dev)
[![Electron](https://img.shields.io/badge/Electron-40-47848F)](https://www.electronjs.org)
[![Stars](https://img.shields.io/github/stars/zeuros/gitgud?style=social)](https://github.com/zeuros/gitgud/stargazers)

> **Get gud at git.**

A cross-platform Git GUI that doesn't get in your way.

## Download

| Platform | Package | Architecture |
|----------|---------|--------------|
| 🐧 Linux | [.deb (Ubuntu/Debian)](https://github.com/zeuros/gitgud/releases/latest) · [.rpm (Fedora/RHEL)](https://github.com/zeuros/gitgud/releases/latest) | x64 · ARM64 |
| 🪟 Windows | [.exe installer](https://github.com/zeuros/gitgud/releases/latest) | x64 |
| 🍎 macOS | [.dmg (Apple Silicon)](https://github.com/zeuros/gitgud/releases/latest) · [.dmg (Intel)](https://github.com/zeuros/gitgud/releases/latest) | M1–M4 · x64 | Dark interface, fast, and built for developers who know what they're doing.

## Features

- 🌿 **Visual commit graph** — branches, merges, stashes and tags at a glance
- 🔍 **Monaco diff editor** — the same editor as VS Code, with hunk-level staging by right-click
- 🏷️ **Full tag support** — create, annotate, push and delete tags
- 📦 **Stash management** — apply, pop or drop stashes from the sidebar
- ⌨️ **Keyboard friendly** — search commits, navigate fast

---

## TODOs

- Fix some commit right-click actions that leave git in a broken state
- Close to amend checkbox → add a fixup button, it will make user pick a commit to fixup, use the staged changes, then run corresponding workflow, it will stash (if possible), fixup one commit and interactive rebase, then unstash (if stashed before)
- Clean right click context menu in monaco (keep only necessary entries)
- fix all monaco viewer displays (untested)
- add shortcut ctrl+return to commit (shortcut should work for other forms, settings for example)
- Make diff editor disappear once all contents moved to staging area
- add force push message if force push is necessary, propose other choices, make it beginner-friendly
- broken state management (rebasing / ...)
- Light mode depends on system but is currently ugly, add it in settings, and make an ok light mode based on existing, use dotted background very stily
- Make three-way diff solver like in jetbrains IDEs / gitkraken
- Use aheadBehind() to show the count of commits to catch on for each branch
- Manage merge conflicts / rebase conflicts

---

## Many thanks & references

- [Gitcraken](https://github.com/Krf/gitcraken) — inspiring GUI and graph work
- [PVigier/gitamine](https://github.com/pvigier/gitamine) — open-source commit graph algorithm
- [github-desktop](https://github.com/desktop/desktop) — git/electron layer reference
- [Gitsquid](https://gitsquid.dev/) — Good interface ideas

## Built with

[Electron](https://www.electronjs.org) · [Angular](https://angular.dev) · [Monaco Editor](https://microsoft.github.io/monaco-editor/) · [PrimeNG](https://primeng.org)

---