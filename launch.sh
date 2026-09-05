#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=================================================="
echo "      🎓 Starting Universal Study Hub             "
echo "  100% Local • Offline • Hardware Accelerated     "
echo "=================================================="

if [ ! -d "dist" ]; then
  echo "📦 Initial build detected. Building frontend..."
  npm run build
fi

LOG="$(mktemp -t studyhub-XXXXXX.log)"

# The server walks 3000 -> 3001 -> ... when a port is taken, so wait for it to
# report the port it actually bound instead of assuming 3000 and opening a dead
# page. Give up after 30s rather than hanging.
open_when_ready() {
  local url=""
  for _ in $(seq 1 60); do
    url="$(grep -oE 'http://localhost:[0-9]+' "$LOG" 2>/dev/null | head -1 || true)"
    [ -n "$url" ] && break
    sleep 0.5
  done

  if [ -z "$url" ]; then
    echo "⚠️  Server did not report a port within 30s. Check the log: $LOG"
    return
  fi

  echo "🚀 Live at: $url"
  if command -v brave >/dev/null 2>&1; then
    brave "$url" >/dev/null 2>&1 || true
  elif command -v google-chrome >/dev/null 2>&1; then
    google-chrome "$url" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  fi
}

open_when_ready &

echo "Press Ctrl+C to stop the local server at any time."
echo "=================================================="

npx tsx server.ts 2>&1 | tee "$LOG"
