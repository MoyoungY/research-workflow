// ARIS owns phase order and acceptance. Its resume command selects the next phase.
import { existsSync, lstatSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

const labels: Record<string, string> = {
  pending: "待开始", running: "执行中", done: "已产出，待验收", failed: "失败",
  accepted: "已验收", provisional: "临时评审（provisional）", skipped: "已跳过",
};

function resolveHelper(project: string) {
  const manifest = join(project, ".aris/installed-skills-codex.txt");
  if (existsSync(manifest)) {
    const repo = readFileSync(manifest, "utf8").split(/\r?\n/).find(line => line.startsWith("repo_root\t"))?.slice(10);
    if (!repo || !isAbsolute(repo) || !existsSync(join(repo, "tools/run_state.py"))) {
      throw new Error("Codex 安装清单指定的 ARIS 工具不可用，请核对课题清单中的 repo_root。");
    }
    return join(repo, "tools/run_state.py");
  }
  const candidates: string[] = [join(project, ".aris/tools/run_state.py"), join(project, "tools/run_state.py")];
  if (process.env.ARIS_REPO) candidates.push(join(process.env.ARIS_REPO, "tools/run_state.py"));
  const pointer = join(homedir(), ".aris/repo");
  if (existsSync(pointer)) {
    const repo = readFileSync(pointer, "utf8").trim();
    if (repo) candidates.push(join(repo, "tools/run_state.py"));
  }
  const helper = candidates.find(path => Bun.file(path).size > 0);
  if (!helper) throw new Error("找不到 ARIS 的 tools/run_state.py。请将 ARIS_REPO 指向本次运行使用的上游检出目录。");
  return helper;
}

function plain(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/[&<>|\\`*_\[\]]/g, char => "&#" + char.charCodeAt(0) + ";");
}

function artifactLink(root: string, artifact: unknown) {
  if (!artifact) return "—";
  if (typeof artifact !== "string") throw new Error("无法识别 ARIS 产物字段。");
  const [name, ...fragment] = existsSync(resolve(root, artifact)) ? [artifact] : artifact.split("#");
  const target = resolve(root, name);
  const path = relative(root, target);
  if (!path || path === ".." || path.startsWith(".." + sep) || isAbsolute(path) || !existsSync(target)) {
    return plain(artifact) + "（原始记录）";
  }
  const url = path.split(sep).map(encodeURIComponent).join("/").replace(/[()]/g, c => c === "(" ? "%28" : "%29");
  const anchor = fragment.length ? "#" + encodeURIComponent(fragment.join("#")) : "";
  return "[" + plain(artifact) + "](./" + url + anchor + ")";
}

function snapshot(root: string, id: string) {
  const file = join(root, ".aris/runs", id + ".json");
  const source = readFileSync(file, "utf8");
  const state = JSON.parse(source);
  if (state?.run_id !== id || !Array.isArray(state.phases) || !state.phases.length) {
    throw new Error("无法识别 ARIS 运行记录。请核对版本和 run_id。");
  }
  const result = Bun.spawnSync(["python3", resolveHelper(root), "resume", root, id], {
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (result.exitCode !== 0) throw new Error("ARIS resume 失败。 " + result.stderr.toString().trim());
  if (source !== readFileSync(file, "utf8")) throw new Error("读取期间 ARIS 更新了状态，请重新同步。");
  const next = result.stdout.toString().trim();
  if (next !== "COMPLETE" && !state.phases.some((p: { phase: string }) => p?.phase === next)) {
    throw new Error("无法识别 ARIS 返回的续跑位置。");
  }
  const rows = state.phases.map((p: { phase: string; status: string; artifact?: string }) => {
    if (typeof p?.phase !== "string" || typeof p.status !== "string") throw new Error("无法识别 ARIS 阶段。");
    return "| " + plain(p.phase) + " | " + (Object.hasOwn(labels, p.status) ? labels[p.status] : plain(p.status)) +
      " | " + artifactLink(root, p.artifact) + " |";
  });
  const blockers: string[] = [];
  for (const [name, gate] of Object.entries(state.gates ?? {})) {
    const check = gate as { verdict?: string; reasons?: unknown };
    if (check?.verdict !== "BLOCKED") continue;
    const reasons = Array.isArray(check.reasons) ? check.reasons.filter(r => typeof r === "string").map(plain) : [];
    blockers.push("阻塞：" + plain(name) + (reasons.length ? " — " + reasons.join("；") : ""), "");
  }
  return [
    "## ARIS 运行 · " + plain(id), "",
    "续跑位置：" + (next === "COMPLETE" ? "COMPLETE（本次运行没有待续阶段）" : plain(next)),
    "", "[原始运行记录](.aris/runs/" + encodeURIComponent(id) + ".json)" +
      (typeof state.updated === "string" ? " · 状态时间 " + plain(state.updated) : ""),
    "", ...blockers, "| 阶段 | 状态 | 原始产物 |", "|---|---|---|", ...rows,
  ].join("\n");
}

function refresh(root: string, id: string) {
  const page = join(root, "handoff.md");
  // Resolve intentional handoff symlinks so an atomic write preserves the link.
  const file = lstatSync(page, { throwIfNoEntry: false }) ? realpathSync(page) : page;
  const local = relative(realpathSync(root), file);
  if (local === ".." || local.startsWith(".." + sep) || isAbsolute(local)) {
    throw new Error("handoff.md 指向课题目录以外，未写入。");
  }
  const lock = file + ".aris-lock";
  try {
    writeFileSync(lock, hostname() + " " + process.pid + "\n", { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    throw new Error("另一进程持有 " + lock + "。请重试；若曾强制中断，核对锁内主机与 PID，确认进程已结束后移除该锁。");
  }
  const tmp = join(dirname(file), ".aris-handoff-" + randomUUID());
  try {
    const block = snapshot(root, id);
    const previous = existsSync(file) ? readFileSync(file, "utf8") : "";
    const start = "<!-- aris-handoff:" + id + " -->";
    const end = "<!-- /aris-handoff:" + id + " -->";
    const section = [start, block, end].join("\n");
    const first = previous.indexOf(start);
    const last = previous.indexOf(end);
    if ((first < 0) !== (last < 0) || last < first || first !== previous.lastIndexOf(start) || last !== previous.lastIndexOf(end)) {
      throw new Error("handoff.md 的运行区块标记不完整或重复，请检查标记。");
    }
    const updated = first < 0 ? previous + (previous ? "\n\n" : "") + section + "\n" :
      previous.slice(0, first) + section + previous.slice(last + end.length);
    if (updated !== previous) {
      writeFileSync(tmp, updated, { flag: "wx", mode: existsSync(file) ? lstatSync(file).mode : 0o644 });
      if ((existsSync(file) ? readFileSync(file, "utf8") : "") !== previous) throw new Error("人工交接刚刚有更新，请重新同步。");
      renameSync(tmp, file);
    }
  } finally {
    rmSync(tmp, { force: true });
    rmSync(lock);
  }
}

try {
  const [project, id, ...rest] = Bun.argv.slice(2);
  if (!project || !id || rest.length || !/^[\p{L}\p{N}._-]+$/u.test(id) || id === "." || id === "..") {
    throw new Error("用法：bun aris-handoff.ts <课题目录> <run_id>");
  }
  const root = realpathSync(project);
  refresh(root, id);
  console.log(join(root, "handoff.md"));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
