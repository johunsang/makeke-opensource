#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export MAKEKE_DATA_DIR="${MAKEKE_DATA_DIR:-$HOME/Library/Application Support/Makeke}"
export MAKEKE_BACKEND_RUNTIME="${MAKEKE_BACKEND_RUNTIME:-go}"
export MAKEKE_PORT="${MAKEKE_PORT:-8818}"

cd "$ROOT_DIR"

echo "[Makeke] 앱 실행 (backend: $MAKEKE_BACKEND_RUNTIME, port: $MAKEKE_PORT)"
if [ "${MAKEKE_ELECTRON_DEBUG:-0}" = "1" ]; then
  exec ./node_modules/.bin/electron . --dev --remote-debugging-port=9222 --remote-allow-origins=*
fi

exec ./node_modules/.bin/electron .
