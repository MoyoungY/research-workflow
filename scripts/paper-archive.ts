import { link, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";

async function inspect(path: string) {
  const entry = await lstat(path).catch(error => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (entry?.isSymbolicLink()) throw new Error(`遇到符号链接，已保留：${path}`);
  return entry;
}

// All names are relative to the project. Check each existing directory before descent.
async function directory(path: string) {
  if (path === ".") return;
  await directory(dirname(path));
  await mkdir(path).catch(error => { if (error.code !== "EEXIST") throw error; });
  if (!(await inspect(path))?.isDirectory()) throw new Error(`需要目录：${path}`);
}

// Publish only complete files. Preserve concurrent downloads and local edits.
async function save(path: string, data: Uint8Array | string) {
  const folder = dirname(path);
  await directory(folder);
  if (await inspect(path)) return;
  const tmp = await mkdtemp(join(folder, ".download-"));
  try {
    const file = join(tmp, "contents");
    await writeFile(file, data);
    await link(file, path).catch(error => { if (error.code !== "EEXIST") throw error; });
  } finally { await rm(tmp, {recursive: true, force: true}); }
}

const oldDraft = /^(history|old|backup|draft|previous|archive|submitted)$/i;

// Bun.Archive.files returns regular-file payloads; no archive symlinks or modes
// are reproduced on disk. A lone gzipped TeX submission is also valid on arXiv.
async function members(bytes: Uint8Array): Promise<Map<string, Blob>> {
  try {
    return await new Bun.Archive(bytes).files();
  } catch {
    const plain = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
    if (!/\\(?:documentclass|documentstyle|begin\{document\})/.test(Buffer.from(plain).toString("latin1"))) {
      throw new Error("未找到 TeX 源码");
    }
    return new Map([["main.tex", new Blob([plain])]]);
  }
}

function outputName(name: string) {
  if (name.startsWith("/") || /[\\\x00-\x1f]/.test(name)) return;
  const parts = name.split("/").filter(part => part !== "" && part !== ".");
  if (!parts.length || parts.some(part => part.startsWith("."))) return;
  if (parts[0] === "submission" || /\.tex\.orig$/i.test(name)) return;
  return parts.slice(0, -1).some(part => oldDraft.test(part)) ? join(".stale", ...parts) : join(...parts);
}

async function unpack(sourceDir: string, files: Map<string, Blob>) {
  let count = 0;
  for (const [name, blob] of files) {
    const relative = outputName(name);
    if (!relative) continue;
    const path = join(sourceDir, relative);
    const contents = Buffer.from(await blob.arrayBuffer());
    if (!relative.startsWith(".stale/") && /\.tex$/i.test(relative)) {
      await save(path + ".orig", contents);
      // latin1 maps bytes one-to-one, including legacy TeX encodings.
      const cleaned = contents.toString("latin1").replace(/(^|[^\\\r\n])((?:\\\\)*)%[^\r\n]*/gm, "$1$2");
      await save(path, Buffer.from(cleaned, "latin1"));
      count++;
    } else {
      await save(path, contents);
    }
  }
  return count;
}

export async function archive(id: string, slug: string, request: (url: string) => Promise<Response>) {
  const dir = join("related_work", slug);
  const marker = join(dir, ".arxiv-id");
  const pdf = join(dir, "paper.pdf");
  const sourceDir = join(dir, "source");
  const submission = join(sourceDir, "submission");
  await directory(dir);
  const existing = (await inspect(pdf))?.isFile();
  const boundId = await inspect(marker) ? (await readFile(marker, "utf8")).trim() : undefined;
  if (boundId !== undefined && boundId !== id) throw new Error(`该目录已归档其他论文或版本：${dir}`);
  if (!existing || boundId === undefined) {
    if (!existing && boundId === undefined && (await readdir(dir)).some(name => name !== ".arxiv-id" && !name.startsWith(".download-"))) {
      throw new Error(`无法确认已有目录里的论文版本，已保留：${dir}`);
    }
    const bytes = await (await request(`https://arxiv.org/pdf/${id}`)).bytes();
    if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") throw new Error("下载结果没有 PDF 文件头");
    // Older projects have no marker. Verify their PDF before binding this name.
    if (existing && !(await readFile(pdf)).equals(bytes)) throw new Error(`已有 PDF 与 ${id} 不一致，已保留：${pdf}`);
    await save(marker, id + "\n");
    if ((await readFile(marker, "utf8")).trim() !== id) throw new Error(`该目录已归档其他论文或版本：${dir}`);
    await save(pdf, bytes);
  }
  if (await Bun.file(pdf).slice(0, 5).text() !== "%PDF-") throw new Error(`无效 PDF，已保留：${pdf}`);
  console.log(`${pdf}  https://arxiv.org/abs/${id}`);
  await directory(sourceDir);
  let data: Uint8Array;
  if (await inspect(submission)) {
    data = await readFile(submission);
  } else {
    try {
      data = await (await request(`https://arxiv.org/e-print/${id}`)).bytes();
    } catch (error) {
      console.error(`PDF 已归档；本次未取得源码：${error}`);
      return;
    }
  }
  let entries: Map<string, Blob>;
  try {
    entries = await members(data);
  } catch (error) {
    console.error(`PDF 已归档；本次未识别到源码：${error}`);
    return;
  }
  await save(submission, data);
  const count = await unpack(sourceDir, entries);
  console.log(`可读 TeX 文件：${count}，目录：${sourceDir}`);
}
