import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Snapshot of a new project produced by init-project.sh at revision 198b77d.
const originalFiles = {
  ".gitignore": "38b93e3f755de57d8a3c9814f55a4c5372c011f8de541c44587637cb7c30e7fc",
  "AGENTS.md": "464775289e66434c62c88e5e9e7bdf5338f55a9c5d7a8dfc66200ea12dd07ee2",
  "brainstorm.md": "14aa23a706c9c86a02564f5b0b4ad918e52a06efacc290262bafec3da4a5a772",
  "dataset.md": "11571d1acb8e454ef53dad8ee25a0b9d06393c033cd97c1fcc669249f537c2fe",
  "experiment/evaluation.md": "06e2e61ce3cfd27580c97d3443886188f076356184cef1a7967e931035ad620b",
  "experiment/results.md": "e51c6fe1f258e539bf34b8330035b01ed9f11ac1f549900027ac672b4bff7c05",
  "handoff.md": "101cd58e1b9428ec0ab9bcf611ddbda5073a182bf95810755abdf68572e5c359",
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
