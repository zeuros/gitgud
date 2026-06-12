
# GitGud ⚔️

[![GitHub release](https://img.shields.io/github/v/release/zeuros/gitgud)](https://github.com/zeuros/gitgud/releases)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Platform](https://img.shields.io/badge/platform-linux%20%7C%20windows%20%7C%20mac-lightgrey)](#)
[![Angular](https://img.shields.io/badge/Angular-21-red)](https://angular.dev)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131)](https://tauri.app)
[![Stars](https://img.shields.io/github/stars/zeuros/gitgud?style=social)](https://github.com/zeuros/gitgud/stargazers)

> **Get gud at git.**

A cross-platform Git GUI that doesn't get in your way.

<video src="https://github.com/user-attachments/assets/b6e6ef04-b569-4695-95f4-d9525c0a6748" autoplay loop muted playsinline width="100%"></video>

## Download

| Platform | Package | Architecture |
|----------|---------|--------------|
| 🐧 Linux | [.deb](https://github.com/zeuros/gitgud/releases/latest) · [.rpm](https://github.com/zeuros/gitgud/releases/latest) · [AppImage](https://github.com/zeuros/gitgud/releases/latest) · [Flatpak](https://github.com/zeuros/gitgud/releases/latest) · [.tar.gz](https://github.com/zeuros/gitgud/releases/latest) | x64 · ARM64 |
| 🪟 Windows | [installer](https://github.com/zeuros/gitgud/releases/latest) · [portable](https://github.com/zeuros/gitgud/releases/latest) | x64 · ARM64 |
| 🍎 macOS | [.dmg (Apple Silicon)](https://github.com/zeuros/gitgud/releases/latest) · [.dmg (Intel)](https://github.com/zeuros/gitgud/releases/latest) | M1–M4 · x64 |

## Features

- 🌿 **Visual commit graph** — branches, merges, stashes and tags at a glance
- 🔍 **Monaco diff editor** — the same editor as VS Code, with hunk-level staging by right-click
- 🏷️ **Full tag support** — create, annotate, push and delete tags
- 📦 **Stash management** — apply, pop or drop stashes from the sidebar
- ⌨️ **Keyboard friendly** — search commits, navigate fast

---

## Next steps

- Find edge cases, list bugs, make it more reliable / practical

---

## Development

### Prerequisites

Node.js, npm, and a [Rust toolchain](https://rustup.rs). On Linux you also need the WebKitGTK dev libraries:

```bash
# Fedora / RHEL
sudo dnf install webkit2gtk4.1-devel libappindicator-gtk3-devel

# Ubuntu / Debian
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev
```

Then:

```bash
npm i
npm start        # tauri dev — Angular dev server + Tauri shell
```

### Build packages

```bash
npm run tauri:build               # native installer for current platform
npm run tauri:build:linux-deb     # .deb
npm run tauri:build:linux-rpm     # .rpm
npm run tauri:build:win           # .exe (NSIS)
npm run tauri:build:mac           # .dmg
```

---

## Many thanks & references

- [Gitkraken](https://github.com/Krf/gitcraken) — inspiring GUI and graph work
- [PVigier/gitamine](https://github.com/pvigier/gitamine) — open-source commit graph algorithm
- [Gitsquid](https://gitsquid.dev/) — Great interface ideas
- [github-desktop](https://github.com/desktop/desktop) — git layer reference (bit too complex)

## Built with

[Tauri 2](https://tauri.app) · [Angular](https://angular.dev) · [Monaco Editor](https://microsoft.github.io/monaco-editor/) · [PrimeNG](https://primeng.org)

---
