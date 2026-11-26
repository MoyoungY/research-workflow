#!/usr/bin/env bash
set -eu
if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "用法: fetch-paper.sh <arxiv-id> [目录名]" >&2
  exit 2
fi
if ! command -v bun >/dev/null 2>&1; then
  echo "抓取论文需要 Bun（已验证 1.4.4），请安装后重试原命令。" >&2
  exit 127
fi
exec bun "$(dirname "$0")/papers.ts" fetch "$1" "${2:-$1}"
