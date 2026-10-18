#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:-portable}"

echo "=== Windows 테스트 빌드 (mode: $MODE) ==="
echo ""

echo "[1/5] Clean"
rm -rf dist build/makeke-server node_modules/.cache
mkdir -p build/makeke-server api/bin

WIN_ARCH="${2:-arm64}"
echo "[2/5] Cross-compile Go API for Windows ($WIN_ARCH)"
(cd api && GOOS=windows GOARCH=$WIN_ARCH go build -o ./bin/makeke-server-go.exe ./cmd/makeke-server)

echo "[3/5] Bundle Bun for Windows ($WIN_ARCH)"
if [ "$WIN_ARCH" = "arm64" ]; then
  BUN_DIR="vendor/bun/win-arm64"
  BUN_ZIP="bun-windows-aarch64.zip"
  BUN_INNER="bun-windows-aarch64"
else
  BUN_DIR="vendor/bun/win-x64"
  BUN_ZIP="bun-windows-x64.zip"
  BUN_INNER="bun-windows-x64"
fi
if [ ! -f "$BUN_DIR/bun.exe" ]; then
  mkdir -p "$BUN_DIR"
  curl -fsSL "https://github.com/oven-sh/bun/releases/latest/download/$BUN_ZIP" -o /tmp/bun-win.zip
  unzip -j /tmp/bun-win.zip "$BUN_INNER/bun.exe" -d "$BUN_DIR/"
  rm /tmp/bun-win.zip
fi

echo "[4/5] Check frontend"
node --check static/app.js
node --check electron/main.js

echo "[5/5] Package Electron for Windows"
if [ "$WIN_ARCH" = "arm64" ]; then
  ARCH_FLAG="--arm64"
else
  ARCH_FLAG="--x64"
fi

if [ "$MODE" = "portable" ]; then
  npx electron-builder --win $ARCH_FLAG --dir
elif [ "$MODE" = "full" ]; then
  npx electron-builder --win $ARCH_FLAG
else
  npx electron-builder --win $ARCH_FLAG --dir
fi

echo ""
echo "=== 완료 ==="
echo ""
if [ -d "dist/win-unpacked" ]; then
  echo "Portable 실행파일: dist/win-unpacked/Makeke.exe"
  echo ""
  echo "Parallels Windows에서 접근:"
  echo "  \\\\Mac\\SAMSUNG\\apps\\projects\\makeke\\dist\\win-unpacked\\Makeke.exe"
fi
if ls dist/*.exe 1>/dev/null 2>&1; then
  echo "설치파일: $(ls dist/*.exe)"
fi
