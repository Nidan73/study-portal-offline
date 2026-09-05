#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=================================================="
echo "      🎓 Starting Universal Study Hub             "
echo "  100% Local • Offline • Hardware Accelerated     "
echo "=================================================="

# Ensure dist exists
if [ ! -d "dist" ]; then
  echo "📦 Initial build detected. Building frontend..."
  npm run build
fi

PORT=3000
URL="http://localhost:${PORT}"

# Launch browser after 1 second in the background
(
  sleep 1.2
  if which brave >/dev/null 2>&1; then
    brave "$URL" >/dev/null 2>&1 || true
  elif which google-chrome >/dev/null 2>&1; then
    google-chrome "$URL" >/dev/null 2>&1 || true
  elif which xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  fi
) &

echo "🚀 Live at: $URL"
echo "Press Ctrl+C to stop the local server at any time."
echo "=================================================="

exec npx tsx server.ts
