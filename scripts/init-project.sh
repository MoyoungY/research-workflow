#!/bin/bash
# 建一个科研项目的骨架。
#
#   ./init-project.sh ~/Code/my-new-paper
#   ./init-project.sh .                     # 在当前目录建
#
# 补齐缺少的模板，并在项目指令中登记一次记录入口。

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

# Codex 从课题 AGENTS.md 读取记录约定。
record_route='运行 ARIS 全流程或单个 skill 时，按已安装的 research-workflow/SKILL.md 管理课题记录。接手、阶段状态变化、遇到阻塞或交接时刷新 handoff.md，有 run_id 时从 ARIS 读取进度。'
record_outcome='直接调用 ARIS 产生新报告或阶段产物时，在同一任务中把证据链接和下一步写进 handoff.md，并更新对应索引：已实测的实验版本写进 experiment/results.md（每版一行），已确认的方向取舍写进 brainstorm.md。只有方案时交接方案位置。明确只读时不写文件。'
record_resume='接着做时先读 handoff.md，优先执行研究者留下的明确安排；显式调用官方续跑照其运行状态恢复。正式开跑的失败版本也入表，指标留空、链接日志。评测口径不同的结果先记口径，待同口径复测再判优。阶段产物、阻塞或决定一出现就随任务更新。记录写入失败时交付原始产物，按管理技能的「只补记录」约定保存缺项。'
if [[ -L AGENTS.md || ! -f AGENTS.md ]]; then
  echo "无法为 AGENTS.md 添加课题记录入口：需要课题内的普通文件。" >&2
  exit 1
fi
for instruction in "$record_route" "$record_outcome" "$record_resume"; do
  grep -Fxq "$instruction" AGENTS.md || printf '\n\n%s\n' "$instruction" >> AGENTS.md
done

cat <<EOF
课题记录已接入：$(pwd)
新课题填写 AGENTS.md 的目标和术语；已有课题从 handoff.md 接手。
接下来进入与你的任务对应的 ARIS 工作流或单个 skill。
EOF
