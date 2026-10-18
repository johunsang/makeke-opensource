#!/usr/bin/env bash
set -euo pipefail

echo "[Makeke] FFmpeg 설치 확인 중..."

if ! command -v brew >/dev/null 2>&1; then
  echo "[Makeke] Homebrew가 없어 먼저 설치합니다."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "[Makeke] Homebrew 설치 후 경로를 찾지 못했습니다. 터미널을 새로 열고 다시 실행하세요."
  exit 1
fi

echo "[Makeke] FFmpeg 설치 중..."
brew install ffmpeg

echo "[Makeke] 설치 확인:"
which ffmpeg
which ffprobe
ffmpeg -version | head -1
ffprobe -version | head -1

echo "[Makeke] 완료. 마케케를 완전히 종료했다가 다시 실행하세요."
