#!/usr/bin/env bash
# npm `version` hook: stamps the new version where npm doesn't, then stages it into the version commit
set -euo pipefail

node scripts/sync-version.mjs
node scripts/add-metainfo-release.mjs
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/linux build/flatpak docs/index.html
