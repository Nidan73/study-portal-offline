#!/usr/bin/env bash
set -euo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"
SELF="$DIR/$(basename "${BASH_SOURCE[0]}")"

# Double-clicking a .sh in a file manager runs it with no terminal attached, so
# there is nothing to see and nothing to press Ctrl+C in — the server ends up
# running invisibly. Re-launch inside a real terminal window when that happens.
if [ ! -t 1 ] && [ -z "${STUDYHUB_IN_TERMINAL:-}" ] && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
  INNER="STUDYHUB_IN_TERMINAL=1 \"$SELF\"; echo; echo \"Study Hub has stopped. You can close this window.\"; exec bash"
  for TERM_APP in x-terminal-emulator gnome-terminal ptyxis tilix konsole xfce4-terminal alacritty kitty foot xterm; do
    command -v "$TERM_APP" >/dev/null 2>&1 || continue
    case "$TERM_APP" in
      gnome-terminal|ptyxis|tilix)
        exec "$TERM_APP" -- bash -c "$INNER" ;;
      konsole|xfce4-terminal|alacritty|kitty|foot|xterm|x-terminal-emulator)
        exec "$TERM_APP" -e bash -c "$INNER" ;;
    esac
  done
  # No terminal emulator found: carry on headless rather than doing nothing.
fi

echo "=================================================="
echo "      🎓 Starting Universal Study Hub             "
echo "  100% Local • Offline • Hardware Accelerated     "
echo "=================================================="

# --- Prerequisites ------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed."
  echo "   Install Node 18 or newer from https://nodejs.org and run this again."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ Node $(node -v) is too old. Node 18 or newer is required."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm is not installed (it normally ships with Node.js)."
  exit 1
fi

# --- Dependencies -------------------------------------------------------
# A fresh clone has no node_modules, so the build would fail on a missing tsc.
if [ ! -d "node_modules" ]; then
  echo "📦 First run — installing dependencies (this takes a minute)..."
  npm install --no-audit --no-fund
fi

# --- First-run data file ------------------------------------------------
# data/ is gitignored so nobody's notes end up in the repository; seed it.
mkdir -p data
if [ ! -f "data/study-hub-data.json" ]; then
  if [ -f "data/study-hub-data.example.json" ]; then
    cp data/study-hub-data.example.json data/study-hub-data.json
    echo "🗂  Created data/study-hub-data.json from the bundled example."
  fi
fi

# --- Build --------------------------------------------------------------
# Rebuilding only when dist is missing meant that after a `git pull` the old
# interface kept being served, with no sign anything was stale.
NEEDS_BUILD=0
if [ ! -f "dist/index.html" ]; then
  NEEDS_BUILD=1
elif [ -n "$(find src server.ts index.html package.json vite.config.* tailwind.config.* \
             -newer dist/index.html 2>/dev/null | head -1)" ]; then
  echo "🔄 Source files changed since the last build."
  NEEDS_BUILD=1
fi

if [ "$NEEDS_BUILD" = "1" ]; then
  echo "🔨 Building the interface..."
  npm run build
fi

LOG="$(mktemp -t studyhub-XXXXXX.log)"

# The server starts at 47285 and walks upward if that is taken, so wait for it
# to report the port it actually bound rather than assuming one.
open_when_ready() {
  local url=""
  for _ in $(seq 1 60); do
    url="$(grep -oE 'http://localhost:[0-9]+' "$LOG" 2>/dev/null | head -1 || true)"
    [ -n "$url" ] && break
    sleep 0.5
  done

  if [ -z "$url" ]; then
    echo "⚠️  The server did not report a port within 30s. Log: $LOG"
    return
  fi

  echo ""
  echo "🚀 Live at: $url"
  echo ""
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  fi
}

open_when_ready &

echo "To stop it: press Ctrl+C here, or click \"Stop the server\" at the"
echo "bottom of the page in your browser."
echo "=================================================="

npx tsx server.ts 2>&1 | tee "$LOG"
