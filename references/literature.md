# 文献检索与归档

先从课题给出的术语、同义词和已知论文形成检索式。保留检索词、来源、检索日期，让下一次检索能复现。本地脚本使用 Bun 和公开的 OpenAlex、Crossref 接口，无需 API key。在研究项目根目录运行，脚本路径指向本 skill 的安装目录。

```sh
bun "$SKILL_DIR/scripts/papers.ts" search "contrastive learning false negatives" 8
bash "$SKILL_DIR/scripts/fetch-paper.sh" 2301.11305 detectgpt
```

检索输出 JSON。两个来源按各自返回顺序交替呈现，按 DOI、arXiv 编号或标准化题名加第一作者姓氏合并。保留的链接用于复核；同名论文、会议版与预印本若实验设置或数据不同，应在整理时标清版本。遇到限流或超时，输出中的 `unavailable` 会注明缺失来源。两个接口都失败时脚本以非零状态退出，可按原检索式查 arXiv、会议论文集或出版社站点并记录实际覆盖的来源。

对与问题相关的条目，打开原文核对作者、版本与实际研究内容。交付一张短表，包括题名、年份、原文链接、与当前问题相关的方法或对照、证据所在章节/表号。仅看到摘要时注明“摘要”，全文无法核实的细节留空。选文标准使用你提供的主题、年份、数据集或方法范围，保留关键差异供你判断。

要求归档时，使用原命令 `bash "$SKILL_DIR/scripts/fetch-paper.sh" <arxiv-id> [目录名]`。目录名省略时沿用输入的编号。比如示例会得到 `related_work/detectgpt/paper.pdf`。可用源码展开到同目录的 `source/`；查表格、公式和引用可直接读其中的 `.tex`。每份正文保留 `.tex.orig` 原件，并清理未转义的百分号注释；作者附带的旧稿归入 `source/.stale/`。遇到 PDF-only 投稿或源码下载失败时，报告具体情况并用 PDF 查阅。内置脚本需要具备 `Bun.Archive` 的 Bun 版本。

归档记录确切的 arXiv 版本。已有论文文件保留原样，目录与请求版本冲突时使用另一个目录名。增强版的 `bun "$SKILL_DIR/scripts/papers.ts" fetch <arxiv-id>` 入口也可使用，省略目录名时沿用它的固定版本目录命名。

非 arXiv 论文通过 DOI 链接定位出版社或作者开放版本，核对题名、作者与版本后保存获准访问的 PDF 到 `related_work/<论文标识>/paper.pdf` 并记录来源。若只能访问元数据，则提供落地页并注明全文可用性。文献清单归入 `related_work/`，参与 baseline 复现的论文从对应的 `reproduction/<方法>/report.md` 引用。
