#!/usr/bin/env bash
# Screenshot a screen without a camera, a TV or a room.
#
#   test/preview/preview.sh [out.png] [ms]
#
# Boots the real app in ?debug (mouse stands in for a body) with the MediaPipe
# import mapped to a stub, then captures after `ms` of virtual time. Virtual
# time matters: the mouse starts at screen centre, which is exactly where the
# Play target sits, so a long budget dwells through it and you photograph the
# next screen instead.
set -euo pipefail
cd "$(dirname "$0")/../.."

OUT="${1:-/tmp/preview.png}"
MS="${2:-1300}"
PORT="${PORT:-8777}"

SHELL_BIN="$(find /opt/pw-browsers -name headless_shell -type f 2>/dev/null | head -1)"
[ -n "$SHELL_BIN" ] || { echo "no headless_shell under /opt/pw-browsers" >&2; exit 1; }

python3 - <<'PY'
import io
s = io.open('index.html', encoding='utf-8').read()
s = s.replace('<link rel="stylesheet"',
  '<script type="importmap">{"imports":'
  '{"@mediapipe/tasks-vision":"/test/preview/mediapipe-stub.js"}}</script>\n<link rel="stylesheet"', 1)
io.open('.preview.html', 'w', encoding='utf-8').write(s)
PY
trap 'rm -f .preview.html; kill %1 2>/dev/null || true' EXIT

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
sleep 1

"$SHELL_BIN" --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1920,1080 --virtual-time-budget="$MS" \
  --screenshot="$OUT" "http://127.0.0.1:$PORT/.preview.html?debug" 2>&1 \
  | grep -i "written" || true
echo "$OUT"
