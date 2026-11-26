# research-workflow

> A Claude Code skill that organizes a research project into a fixed file structure,
> so both you and every fresh agent window know where to read context and where to
> write results. **中文说明在下面。**

用 Agent 协作做科研的项目工作流，做成了 Claude Code skill。

核心想法很简单：**科研项目里人和 Agent 的协作，靠一套固定的文件结构来承载**——
每个文档职责单一，每个新开的 Agent 窗口都知道先读什么、往哪写。

## 安装

```bash
git clone https://github.com/MoyoungY/research-workflow.git ~/.claude/skills/research-workflow
```

Cursor 用户放 `~/.cursor/skills/` 或 `.agents/skills/`。

在 Codex 项目中，可将本仓库克隆到项目的 `.agents/skills/research-workflow/`。建课题只需 Bash；跨库检索、抓取归档和逐次实验记录使用 Bun，已在 Bun 1.4.4 验证。

装完对 Claude 说「开个新坑做 X」，它会问你三个问题（项目名、目标、领域术语），
然后把整套结构建好。

## 文件结构

```
你的项目/
├── AGENTS.md              项目总纲：在做什么、硬规矩 —— 每个新窗口第一个读
├── handoff.md             进度交接 —— 每个窗口结束前更新，下一个窗口靠它接上
├── brainstorm.md          问题和假设的讨论记录，倒序
├── related_work/          文献，每篇 paper.pdf + source/
├── reproduction/          baseline 复现，每个方法一份 report.md
├── experiment/
│   ├── results.md         每版实验一行，不覆盖不删
│   └── evaluation.md      标准化测评，防止临时挑指标
└── DataSet/ + dataset.md  数据和处理说明
```

## 常用脚本

**建骨架**（幂等，已有文件不覆盖）：

```bash
bash ~/.claude/skills/research-workflow/scripts/init-project.sh ~/Code/my-paper
```

**抓论文**（PDF + LaTeX 源码都下，源码自动清洗——隔离作者打包进来的旧稿、剥掉注释掉的正文）：

```bash
bash ~/.claude/skills/research-workflow/scripts/fetch-paper.sh 2301.11305 detectgpt
```

## 工作节奏

```
抓文献 → 复现关键 baseline → 提假设 → 跑实验 → （循环）
```

复现放在提假设之前：论文只报平均值和成功配置，
真正的问题往往在自己跑一遍才看得见的地方。

在原有环节中可以直接提出这些请求：

| 请求 | 交付 |
|---|---|
| 帮我查这个方向的文献 | 从 OpenAlex 和 Crossref 检索、去重，给出论文出处；按指定目录归档选中的 arXiv 论文。 |
| 先把这个假设设计成实验 | 沿用项目的评测协议，列明对照、固定变量、种子、运行顺序和算力预算。 |
| 按方案跑，用标准化测评测一下这个版本 | 在版本目录中保存日志、指标、图和固定失败样例，向 `experiment/results.md` 追加版本记录。 |

研究者决定方向和结论。具体用法见[文献检索与归档](references/literature.md)和[实验设计与运行](references/experiments.md)。在仓库根目录运行 `bun test tests` 可验证建档和归档兼容性。

## 内置的几条警示

- 效果突然变好，先查数据泄漏（split 是不是按样本分了）
- verify 中间过程，不只是看代码——小问题都藏在输入输出的处理里
- 每一版实验都命名、都留着，失败的也留
- 测评照 `evaluation.md` 走，不临时挑指标
- 上下文快满就更新 `handoff.md`，别硬撑到被截断

## License

项目结构和模板来自 skJack 的 research-workflow，使用 [Apache License 2.0](LICENSE)。检索与实验执行方法参考 wanshuiyin 的 Auto-claude-code-research-in-sleep（ARIS）。[ARIS 许可](licenses/ARIS-MIT.txt)
