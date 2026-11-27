import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Only records that could not be written belong here. Research commands never run here.
function pending([project, action, ...args]: string[]) {
  if (!project) throw new Error("用法：bun pending.ts <课题目录> list | add <待补文件> <证据位置> <缺项> | done <编号>");
  const parent = join(realpathSync(project), ".research-workflow");
  const dir = join(parent, "pending");
  for (const path of [parent, dir]) {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat && !stat.isDirectory()) throw new Error(`待补目录不可用：${path}`);
  }
  if (action === "add" && args.length === 3 && args.every(arg => arg.trim())) {
    const [target, evidence, missing] = args;
    const json = JSON.stringify({ target, evidence, missing }, null, 2) + "\n";
    const id = createHash("sha256").update(json).digest("hex");
    mkdirSync(dir, { recursive: true });
    const tmp = join(dir, randomUUID() + ".tmp");
    try {
      writeFileSync(tmp, json, { flag: "wx" });
      renameSync(tmp, join(dir, id + ".json"));
    } finally { rmSync(tmp, { force: true }); }
    console.log(id);
  } else if (action === "list" && !args.length) {
    const files = existsSync(dir) ? readdirSync(dir).filter(name => /^[a-f0-9]{64}\.json$/.test(name)).sort() : [];
    console.log(JSON.stringify(files.map(name => {
      const path = join(dir, name);
      if (!lstatSync(path).isFile()) throw new Error(`待补条目不可读：${name}`);
      return { id: name.slice(0, -5), ...JSON.parse(readFileSync(path, "utf8")) };
    }), null, 2));
  } else if (action === "done" && args.length === 1 && /^[a-f0-9]{64}$/.test(args[0])) {
    rmSync(join(dir, args[0] + ".json"), { force: true });
  } else {
    throw new Error("用法：bun pending.ts <课题目录> list | add <待补文件> <证据位置> <缺项> | done <编号>");
  }
}

try { pending(Bun.argv.slice(2)); } catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
