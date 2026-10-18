#!/usr/bin/env bash
# HyperFrames 공식 저장소를 vendor/hyperframes-oss/ 에 내려받고 빌드한다.
# 쇼츠공장 메뉴의 "🎬 공식 MP4" 렌더 버튼이 이 빌드 결과물을 사용한다.
#
# 필수: git, node >= 22, bun (없으면 자동 설치)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/vendor"
TARGET="$VENDOR/hyperframes-oss"

mkdir -p "$VENDOR"

if [ ! -d "$TARGET/.git" ]; then
  echo "[setup] hyperframes-oss 클론 중..."
  GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/heygen-com/hyperframes.git "$TARGET"
else
  echo "[setup] 이미 존재 — 최신 main 으로 업데이트..."
  (cd "$TARGET" && GIT_LFS_SKIP_SMUDGE=1 git pull --ff-only || true)
fi

# LFS 가 없어도 checkout 강제
(cd "$TARGET" && \
  git config filter.lfs.clean cat && \
  git config filter.lfs.smudge cat && \
  git config filter.lfs.process '' && \
  git config filter.lfs.required false && \
  git checkout HEAD -- . 2>/dev/null || true)

if ! command -v bun >/dev/null 2>&1; then
  echo "[setup] bun 설치 중..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

export PATH="$HOME/.bun/bin:$PATH"
cd "$TARGET"
echo "[setup] 의존성 설치..."
bun install
echo "[setup] 빌드 실행..."
bun run build
echo "[setup] 완료: $TARGET/packages/cli/dist/cli.js"
