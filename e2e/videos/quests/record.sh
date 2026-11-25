#!/usr/bin/env bash
# Records the website's Quests videos into docs/quests/<quest>.mp4 + .webm, on a private Xvfb
#
# Usage, from the repository root:
#   bash e2e/videos/quests/record.sh                  # every quest
#   bash e2e/videos/quests/record.sh 03-fast-forward  # only these quests
#
# Each spec marks when its scene starts and ends (markScene in quest.ts): the video is cut to it

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
QUESTS_DIR="$REPO_ROOT/e2e/videos/quests"
OUTPUT_DIR="$REPO_ROOT/docs/quests"
DISPLAY_NUM=98
XDISPLAY=":$DISPLAY_NUM"
RESOLUTION="1920x1080"
# Native size: the app is already zoomed, a downscale blurs its text
OUTPUT_SIZE="1920:1080"
WORK_DIR="$(mktemp -d /tmp/gitgud-quests-record-XXXXXX)"

cd "$REPO_ROOT"
mkdir -p "$OUTPUT_DIR"

# A throwaway config folder hides the window state of your last real session, so the window opens at the
# tauri.conf.json size (= RESOLUTION)
export XDG_CONFIG_HOME="$WORK_DIR/config"
mkdir -p "$XDG_CONFIG_HOME"

# On a Wayland desktop GDK would open the app there rather than on Xvfb, even without WAYLAND_DISPLAY
unset WAYLAND_DISPLAY
export GDK_BACKEND=x11

BINARY="src-tauri/target/release/gitgud"
if [[ ! -x "$BINARY" || -n "$(find src src-tauri/src src-tauri/Cargo.toml package.json -type f -newer "$BINARY" -print -quit)" ]]; then
  echo "[quests] release binary is missing or stale, rebuilding..."
  npx tauri build --no-bundle
fi

if ss -ltn | grep -q ':4444 '; then
  echo "[quests] something already listens on port 4444 (a leftover tauri-driver?): stop it first" >&2
  exit 1
fi

cleanup() {
  [[ -n "${FFMPEG_PID:-}" ]] && kill -INT "$FFMPEG_PID" 2>/dev/null && wait "$FFMPEG_PID" 2>/dev/null || true
  [[ -n "${XVFB_PID:-}" ]] && kill "$XVFB_PID" 2>/dev/null && wait "$XVFB_PID" 2>/dev/null || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

if (($#)); then
  QUESTS=("$@")
else
  mapfile -t QUESTS < <(find "$QUESTS_DIR" -name '*.spec.ts' -printf '%f\n' | sed 's/\.spec\.ts$//' | sort)
fi

echo "[quests] starting Xvfb on $XDISPLAY at $RESOLUTION..."
Xvfb "$XDISPLAY" -screen 0 "${RESOLUTION}x24" -ac +extension GLX +render &
XVFB_PID=$!
sleep 1
DISPLAY="$XDISPLAY" xsetroot -solid "#0d0d0d" 2>/dev/null || true

record_quest() {
  local quest="$1"
  local raw_video="$WORK_DIR/$quest.mkv"
  local marks_file="$WORK_DIR/$quest.marks"
  : > "$marks_file"

  echo "[quests] $quest: recording..."
  ffmpeg -nostdin -loglevel error \
    -f x11grab -draw_mouse 0 -r 30 -s "$RESOLUTION" -i "$XDISPLAY" \
    -c:v libx264 -preset ultrafast -crf 16 -pix_fmt yuv420p \
    "$raw_video" &
  FFMPEG_PID=$!
  local capture_start
  capture_start=$(date +%s.%N)

  local spec_status=0
  QUEST_MARKS_FILE="$marks_file" DISPLAY="$XDISPLAY" \
    npx wdio run wdio.demo.conf.ts --spec "$QUESTS_DIR/$quest.spec.ts" || spec_status=$?

  kill -INT "$FFMPEG_PID"
  wait "$FFMPEG_PID" 2>/dev/null || true
  FFMPEG_PID=""

  if ((spec_status)); then
    echo "[quests] $quest: the spec failed, no video written" >&2
    return 1
  fi

  local scene_start scene_end
  scene_start=$(awk -v origin="$capture_start" '$1 == "start" { printf "%.2f", $2 - origin; exit }' "$marks_file")
  scene_end=$(awk -v origin="$capture_start" '$1 == "end" { printf "%.2f", $2 - origin; exit }' "$marks_file")
  if [[ -z "$scene_start" || -z "$scene_end" ]]; then
    echo "[quests] $quest: the spec never marked its scene start and end" >&2
    return 1
  fi
  local duration fade_out_start
  duration=$(awk -v start="$scene_start" -v end="$scene_end" 'BEGIN { printf "%.2f", end - start }')
  fade_out_start=$(awk -v duration="$duration" 'BEGIN { printf "%.2f", duration - 0.8 }')
  local filters="trim=start=$scene_start:end=$scene_end,setpts=PTS-STARTPTS,scale=$OUTPUT_SIZE:flags=lanczos,fade=in:st=0:d=0.5,fade=out:st=$fade_out_start:d=0.8"

  echo "[quests] $quest: encoding ${duration}s..."
  ffmpeg -nostdin -loglevel error -y -i "$raw_video" -vf "$filters" -an \
    -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart "$OUTPUT_DIR/$quest.mp4"
  ffmpeg -nostdin -loglevel error -y -i "$raw_video" -vf "$filters" -an \
    -c:v libvpx-vp9 -crf 38 -b:v 0 -row-mt 1 -pix_fmt yuv420p "$OUTPUT_DIR/$quest.webm"
  # The website's poster: the scene's last frame before the fade
  ffmpeg -nostdin -loglevel error -y -ss "$(awk -v end="$scene_end" 'BEGIN { printf "%.2f", end - 1.2 }')" -i "$raw_video" \
    -frames:v 1 -vf "scale=$OUTPUT_SIZE:flags=lanczos" -q:v 4 "$OUTPUT_DIR/$quest.jpg"
  rm -f "$raw_video"
}

failed=()
for quest in "${QUESTS[@]}"; do
  record_quest "$quest" || failed+=("$quest")
done

if ((${#failed[@]})); then
  echo "[quests] failed: ${failed[*]}" >&2
  exit 1
fi
echo "[quests] done → $OUTPUT_DIR"
