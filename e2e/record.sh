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

cd "$REPO_ROOT"

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
# Trim first 3 s (app launch / blank screen), add fade-in and fade-out
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$RAW_VIDEO")
DURATION_INT=$(printf "%.0f" "$DURATION")
FADE_OUT_START=$((DURATION_INT - 3 - 2))
VF="trim=start=3,setpts=PTS-STARTPTS,fade=in:0:30:color=black,fade=out:st=${FADE_OUT_START}:d=1.5:color=black"

echo "[record] → MP4 (H.264)"
ffmpeg -nostdin -y \
  -i "$RAW_VIDEO" \
  -vf "$VF" \
  -c:v libx264 -preset slow -crf 20 \
  -pix_fmt yuv420p \
  "$OUTPUT_MP4"

echo "[record] → WebM (VP9)"
ffmpeg -nostdin -y \
  -i "$RAW_VIDEO" \
  -vf "$VF" \
  -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 \
  -pix_fmt yuv420p \
  "$OUTPUT_WEBM"

rm -f "$RAW_VIDEO"
echo "[record] done → $OUTPUT_MP4 + $OUTPUT_WEBM"
