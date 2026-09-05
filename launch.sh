#!/usr/bin/env bash
set -euo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

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
if [ ! -d "dist" ]; then
  echo "🔨 Building the interface..."
  npm run build
fi

LOG="$(mktemp -t studyhub-XXXXXX.log)"

# The server walks 3000 -> 3001 -> ... when a port is taken, so wait for it to
# report the port it actually bound instead of assuming 3000.
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

echo "Press Ctrl+C to stop the server."
echo "=================================================="

npx tsx server.ts 2>&1 | tee "$LOG"
