#!/usr/bin/env bash
# Records a demo video of GitGud and saves it to docs/show.mp4
#
# Usage:
#   cd /home/zeuros/Documents/gitgud
#   bash e2e/record.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DISPLAY_NUM=99
XDISPLAY=":$DISPLAY_NUM"
RESOLUTION="1920x1080"
RAW_VIDEO="/tmp/gitgud-demo-raw.mp4"
OUTPUT_MP4="$REPO_ROOT/docs/show.mp4"
OUTPUT_WEBM="$REPO_ROOT/docs/show.webm"
# Seconds of raw capture to drop from the head (app launch / splash screen)
TRIM_START=5

cd "$REPO_ROOT"

# tauri-plugin-window-state restores the window size of your last real session
# (~1972x1179 when maximized), which is bigger than the Xvfb screen — the app then
# hangs off the bottom/right and the recording clips it. A throwaway XDG_CONFIG_HOME
# hides that state file, so the window opens at the tauri.conf.json size (= RESOLUTION).
export XDG_CONFIG_HOME="/tmp/gitgud-record-config"
rm -rf "$XDG_CONFIG_HOME"
mkdir -p "$XDG_CONFIG_HOME"

# The demo runs the prebuilt release binary (see wdio.conf.ts), which embeds the Angular
# bundle at compile time: rebuild it if sources are newer, or the video shows an old UI
BINARY="src-tauri/target/release/gitgud"
if [[ ! -x "$BINARY" || -n "$(find src src-tauri/src src-tauri/Cargo.toml package.json -type f -newer "$BINARY" -print -quit)" ]]; then
  echo "[record] release binary is missing or stale, rebuilding..."
  npx tauri build --no-bundle
fi

# The soundtrack is rendered from the Strudel tune, and not committed: render it again when the tune is newer
MUSIC="$REPO_ROOT/e2e/music.wav"
if [[ ! -f "$MUSIC" || "$REPO_ROOT/e2e/music.html" -nt "$MUSIC" ]]; then
  echo "[record] rendering the soundtrack..."
  node e2e/export-music.mjs
fi

cleanup() {
  [[ -n "${WDIO_PID:-}" ]]   && kill "$WDIO_PID"      2>/dev/null && wait "$WDIO_PID"      2>/dev/null || true
  [[ -n "${FFMPEG_PID:-}" ]] && kill -INT "$FFMPEG_PID" 2>/dev/null && wait "$FFMPEG_PID" 2>/dev/null || true
  [[ -n "${XVFB_PID:-}" ]]  && kill "$XVFB_PID"       2>/dev/null && wait "$XVFB_PID"    2>/dev/null || true
  echo "[record] cleanup done"
}
trap cleanup EXIT

echo "[record] creating demo repos..."
npm run e2e:setup

echo "[record] starting Xvfb on $XDISPLAY at $RESOLUTION..."
Xvfb "$XDISPLAY" -screen 0 "${RESOLUTION}x24" -ac +extension GLX +render &
XVFB_PID=$!
sleep 1

# Dark background so the titlebar / margins don't look jarring
DISPLAY="$XDISPLAY" xsetroot -solid "#0d0d0d" 2>/dev/null || true

echo "[record] running demo spec (background)..."
DISPLAY="$XDISPLAY" npx wdio run wdio.demo.conf.ts &
WDIO_PID=$!

# Give the app window 1.5 s to fully render before recording starts
sleep 1.5

echo "[record] starting ffmpeg..."
rm -f "$RAW_VIDEO"
ffmpeg -nostdin \
  -f x11grab -draw_mouse 0 -r 30 -s "$RESOLUTION" -i "$XDISPLAY" \
  -c:v libx264 -preset ultrafast -crf 16 \
  -pix_fmt yuv420p \
  "$RAW_VIDEO" &
FFMPEG_PID=$!

wait "$WDIO_PID"

echo "[record] stopping ffmpeg..."
kill -INT "$FFMPEG_PID"
wait "$FFMPEG_PID" 2>/dev/null || true
FFMPEG_PID=""

echo "[record] encoding final video..."
# Trim the first $TRIM_START s (app launch / splash), add fade-in and fade-out
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$RAW_VIDEO")
DURATION_INT=$(printf "%.0f" "$DURATION")
FADE_OUT_START=$((DURATION_INT - TRIM_START - 2))
VF="trim=start=${TRIM_START},setpts=PTS-STARTPTS,fade=in:0:30:color=black,fade=out:st=${FADE_OUT_START}:d=1.5:color=black"
# The music fades out with the picture, and is padded with silence (then cut by -shortest) to the video's length
AF="afade=in:st=0:d=0.5,afade=out:st=${FADE_OUT_START}:d=1.5,apad"

echo "[record] → MP4 (H.264 + AAC)"
ffmpeg -nostdin -y \
  -i "$RAW_VIDEO" -i "$MUSIC" \
  -map 0:v -map 1:a \
  -vf "$VF" -af "$AF" -shortest \
  -c:v libx264 -preset slow -crf 20 \
  -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  "$OUTPUT_MP4"

echo "[record] → WebM (VP9 + Opus)"
ffmpeg -nostdin -y \
  -i "$RAW_VIDEO" -i "$MUSIC" \
  -map 0:v -map 1:a \
  -vf "$VF" -af "$AF" -shortest \
  -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 \
  -pix_fmt yuv420p \
  -c:a libopus -b:a 128k \
  "$OUTPUT_WEBM"

rm -f "$RAW_VIDEO"
echo "[record] done → $OUTPUT_MP4 + $OUTPUT_WEBM"
