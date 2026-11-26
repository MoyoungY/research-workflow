import { join } from "node:path";

const args = Bun.argv.slice(2);
if (args.length !== 1 || !args[0].trim()) {
  console.error("用法: bun init-project.ts <课题目录>");
  process.exit(2);
}

const child = Bun.spawnSync(["bash", join(import.meta.dir, "init-project.sh"), ...args], {
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(child.exitCode);
