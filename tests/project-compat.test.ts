import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Project scaffold snapshot, including the Codex routing, handoff and results templates.
const originalFiles = {
  ".gitignore": "38b93e3f755de57d8a3c9814f55a4c5372c011f8de541c44587637cb7c30e7fc",
  "AGENTS.md": "fc87768e27caf8dada63641925828bb80cbcf7d9932889113d838c26a7a2f5a0",
  "brainstorm.md": "14aa23a706c9c86a02564f5b0b4ad918e52a06efacc290262bafec3da4a5a772",
  "dataset.md": "11571d1acb8e454ef53dad8ee25a0b9d06393c033cd97c1fcc669249f537c2fe",
  "experiment/evaluation.md": "06e2e61ce3cfd27580c97d3443886188f076356184cef1a7967e931035ad620b",
  "experiment/results.md": "2c3dd7fa482a10e8a8818c667c568838464635cde823d29c7db7b6fd8832dfdd",
  "handoff.md": "6fa7a35aa511afaaffe7f9d23f5d2bc29c60a297c41c22ba87bf0fcf7695982e",
};
const originalDirectories = ["DataSet", "experiment", "related_work", "reproduction"];

async function initialize(project: string) {
  const script = resolve(import.meta.dir, "../scripts/init-project.sh");
  const child = Bun.spawn(["bash", script, project], { stdout: "ignore", stderr: "inherit" });
  expect(await child.exited).toBe(0);
}

test("旧命令建出的目录、模板和已有记录与原版兼容", async () => {
  const root = await mkdtemp(join(tmpdir(), "research workflow "));
  try {
    const project = join(root, "课题");
    await initialize(project);
    const entries = await readdir(project, { recursive: true });
    expect(entries.sort()).toEqual([...originalDirectories, ...Object.keys(originalFiles)].sort());
    for (const [path, checksum] of Object.entries(originalFiles)) {
      const bytes = await readFile(join(project, path));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(checksum);
    }
    const handoff = join(project, "handoff.md");
    await writeFile(handoff, "保留上一窗口确认的实验条件。\n");
    await initialize(project);
    expect(await readFile(handoff, "utf8")).toBe("保留上一窗口确认的实验条件。\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
