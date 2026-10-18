#!/usr/bin/env bash
# Bun 번들 다운로드 — npx 미설치 PC 에서도 Remotion·HyperFrames CLI 가 동작하도록
# vendor/bun/{platform}/bun 으로 저장. CI 빌드는 .github/workflows/build.yml 가 직접 처리.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

UNAME_S="$(uname -s)"
UNAME_M="$(uname -m)"

case "$UNAME_S" in
  Darwin)
    case "$UNAME_M" in
      arm64|aarch64) PLAT="darwin-arm64"; URL_PLAT="darwin-aarch64" ;;
      x86_64)        PLAT="darwin-x64";   URL_PLAT="darwin-x64" ;;
      *) echo "지원하지 않는 macOS 아키텍처: $UNAME_M" >&2; exit 1 ;;
    esac ;;
  Linux)
    case "$UNAME_M" in
      x86_64|amd64)  PLAT="linux-x64";    URL_PLAT="linux-x64" ;;
      aarch64|arm64) PLAT="linux-aarch64"; URL_PLAT="linux-aarch64" ;;
      *) echo "지원하지 않는 Linux 아키텍처: $UNAME_M" >&2; exit 1 ;;
    esac ;;
  *) echo "Windows 는 git-bash 또는 PowerShell 에서 직접: scripts/setup_bun.ps1" >&2; exit 1 ;;
esac

DEST="vendor/bun/$PLAT"
if [ -x "$DEST/bun" ]; then
  echo "이미 설치됨: $DEST/bun ($($DEST/bun --version))"
  exit 0
fi

mkdir -p "$DEST"
URL="https://github.com/oven-sh/bun/releases/latest/download/bun-${URL_PLAT}.zip"
TMP=$(mktemp -d)
echo "다운로드 중: $URL"
curl -fsSL "$URL" -o "$TMP/bun.zip"
unzip -j "$TMP/bun.zip" "bun-${URL_PLAT}/bun" -d "$DEST"
chmod +x "$DEST/bun"
ln -f "$DEST/bun" "$DEST/bunx"
rm -rf "$TMP"

echo "✅ 설치 완료: $DEST/bun ($($DEST/bun --version))"
echo "   bunx hard link: $DEST/bunx"
