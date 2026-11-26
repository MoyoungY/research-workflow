import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archive } from "../scripts/paper-archive";

test("paper archive preserves readable TeX, old drafts and existing project material", async () => {
  const cwd = process.cwd();
  const project = await mkdtemp(join(tmpdir(), "research-paper-test-"));
  const tex = "\\documentclass{article}\n% note\n20\\% accuracy % comment\n";
  const bytes = await new Bun.Archive({ "main.tex": tex, "history/v1.tex": "draft" }).bytes();
  const request = async (url: string) => new Response(url.includes("/pdf/") ? "%PDF-fixture" : bytes);
  try {
    process.chdir(project);
    await archive("2301.11305v2", "detectgpt", request);
    const source = "related_work/detectgpt/source";
    expect(await Bun.file(join(source, "main.tex")).text()).toBe("\\documentclass{article}\n\n20\\% accuracy \n");
    expect(await Bun.file(join(source, "main.tex.orig")).text()).toBe(tex);
    expect(await Bun.file(join(source, ".stale/history/v1.tex")).text()).toBe("draft");
    expect(await Bun.file(join(source, "history/v1.tex")).exists()).toBe(false);

    await writeFile(join(source, "main.tex"), "researcher's note");
    await archive("2301.11305v2", "detectgpt", request);
    expect(await Bun.file(join(source, "main.tex")).text()).toBe("researcher's note");

    await mkdir("related_work/legacy");
    await writeFile("related_work/legacy/paper.pdf", "%PDF-other-paper");
    await expect(archive("2301.11305v2", "legacy", request)).rejects.toThrow("不一致");
    expect(await Bun.file("related_work/legacy/paper.pdf").text()).toBe("%PDF-other-paper");
    expect(await Bun.file("related_work/legacy/.arxiv-id").exists()).toBe(false);

    await archive("2301.11305v2", "pdf-only", async () => new Response("%PDF-fixture"));
    expect(await Bun.file("related_work/pdf-only/paper.pdf").text()).toBe("%PDF-fixture");
    expect(await Bun.file("related_work/pdf-only/source/main.tex").exists()).toBe(false);
  } finally {
    process.chdir(cwd);
    await rm(project, { recursive: true, force: true });
  }
});
