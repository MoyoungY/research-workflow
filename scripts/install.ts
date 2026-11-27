import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const pack = realpathSync(join(import.meta.dir, ".."));

function run(args: string[]) {
  const child = Bun.spawnSync(args, { stdout: "inherit", stderr: "inherit", stdin: "ignore" });
  if (child.exitCode !== 0) throw new Error(`接入失败（${child.exitCode}）。解决上面的错误后，可重复同一条命令。`);
}

function install() {
  const [dest, flag, ...extra] = Bun.argv.slice(2);
  if (!dest || dest.startsWith("--") || (flag !== undefined && flag !== "--existing") || extra.length) {
    throw new Error("用法：bun install.ts <课题目录> [--existing]（Codex 已通过插件提供 ARIS 时使用）");
  }
  mkdirSync(dest, { recursive: true });
  const root = realpathSync(dest);
  const skills = join(root, ".agents/skills");
  for (const path of [join(root, ".agents"), skills, join(root, ".aris")]) {
    const entry = lstatSync(path, { throwIfNoEntry: false });
    if (entry && !entry.isDirectory()) throw new Error(`接入目录不能是文件或符号链接：${path}`);
  }
  const link = join(skills, "research-workflow");
  if (lstatSync(link, { throwIfNoEntry: false }) && (!existsSync(link) || realpathSync(link) !== pack)) {
    throw new Error(`保留了现有同名技能，请核对安装来源：${link}`);
  }
  const manifest = join(root, ".aris/installed-skills-codex.txt");
  const locations = [skills, join(homedir(), ".agents/skills"), join(process.env.CODEX_HOME || join(homedir(), ".codex"), "skills")];
  const hasAris = existsSync(manifest) || locations.some(dir => existsSync(join(dir, "research-pipeline/SKILL.md")));
  let arisRepo: string | undefined;
  if (!hasAris && !flag) {
    const pointer = join(homedir(), ".aris/repo");
    const workspaceSkill = resolve("skills/research-workflow");
    const workspaceAris = existsSync(workspaceSkill) && realpathSync(workspaceSkill) === pack
      ? resolve("upstreams/Auto-claude-code-research-in-sleep") : "";
    const candidates = process.env.ARIS_REPO ? [process.env.ARIS_REPO] : [
      workspaceAris,
      resolve(pack, "../../upstreams/Auto-claude-code-research-in-sleep"),
      existsSync(pointer) ? readFileSync(pointer, "utf8").trim() : "",
      resolve(pack, "../Auto-claude-code-research-in-sleep"),
    ];
    const repo = candidates.find(path => path && existsSync(join(path, "tools/install_aris_codex.sh")));
    if (!repo) throw new Error("请将 ARIS_REPO 指向已有 ARIS 检出。Codex 已安装 ARIS 插件时可传 --existing。");
    arisRepo = realpathSync(repo);
  }
  run(["bash", join(pack, "scripts/init-project.sh"), root]);
  if (arisRepo) {
    run(["bash", join(arisRepo, "tools/install_aris_codex.sh"), root, "--aris-repo", arisRepo, "--all", "--quiet"]);
  }
  mkdirSync(skills, { recursive: true });
  if (!existsSync(link)) symlinkSync(pack, link, "dir");
  console.log("已接入 Codex。在课题根目录打开新会话，直接使用官方 ARIS。");
}

try { install(); } catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
