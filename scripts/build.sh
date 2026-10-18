#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[1/5] Clean build directories"
rm -rf build_dist dist build/makeke-server node_modules/.cache
mkdir -p build/makeke-server api/bin

echo "[2/5] Build Go API"
(cd api && go build -o ./bin/makeke-server-go ./cmd/makeke-server)

echo "[3/5] Bundle Bun"
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  BUN_DIR="vendor/bun/darwin-arm64"
  BUN_ZIP="bun-darwin-aarch64.zip"
  BUN_INNER="bun-darwin-aarch64"
elif [ "$ARCH" = "x86_64" ]; then
  BUN_DIR="vendor/bun/darwin-x64"
  BUN_ZIP="bun-darwin-x64.zip"
  BUN_INNER="bun-darwin-x64"
fi
if [ ! -f "$BUN_DIR/bun" ]; then
  mkdir -p "$BUN_DIR"
  curl -fsSL "https://github.com/oven-sh/bun/releases/latest/download/$BUN_ZIP" -o /tmp/bun.zip
  unzip -j /tmp/bun.zip "$BUN_INNER/bun" -d "$BUN_DIR/"
  chmod +x "$BUN_DIR/bun"
  (cd "$BUN_DIR" && ln -f bun bunx)
  rm /tmp/bun.zip
fi
echo "   Bun: $(ls -lh "$BUN_DIR/bun" | awk '{print $5}')"

echo "[4/5] Check frontend entry scripts"
node --check static/app.js
node --check electron/main.js

echo "[5/5] Package Electron"
npx electron-builder
