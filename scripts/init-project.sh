#!/bin/bash
# 建一个科研项目的骨架。
#
#   ./init-project.sh ~/Code/my-new-paper
#   ./init-project.sh .                     # 在当前目录建
#
# 已存在的文件不会被覆盖——在已有项目里跑也安全，只补缺的。

set -euo pipefail

DEST="${1:?用法: init-project.sh <项目目录>}"
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TPL="$SCRIPTS/../assets/templates"

mkdir -p "$DEST"/{related_work,reproduction,experiment,DataSet}
cd "$DEST"

put() { # $1=模板名 $2=目标路径
  if [ -e "$2" ] || [ -L "$2" ]; then
    echo "  ·  $2  已存在，跳过"
  else
    cp -n "$TPL/$1" "$2"
    echo "  +  $2"
  fi
}

put AGENTS.md      AGENTS.md
put handoff.md     handoff.md
put brainstorm.md  brainstorm.md
put dataset.md     dataset.md
put results.md     experiment/results.md
put evaluation.md  experiment/evaluation.md

put gitignore.txt .gitignore

cat <<EOF

骨架建好了：$(pwd)

下一步按顺序：

  1. 填 AGENTS.md 的 {{占位符}} —— 尤其是「核心主张」那一条，
     那是整个项目的锚，Agent 靠它判断什么该做什么不该做

  2. 抓文献：
       bash "$SCRIPTS/fetch-paper.sh" <arxiv-id> <目录名>

  3. **先复现再找问题** —— 挑两三篇有开源代码的跑通，写 reproduction/<method>/report.md
     论文只报平均和成功配置，卡在哪、哪个 setting 崩了，只有自己跑才看得见

  4. 复现跑完之后再进 brainstorm.md 提假设

每个窗口结束前更新 handoff.md。
EOF
