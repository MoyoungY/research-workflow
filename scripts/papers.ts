import { archive } from "./paper-archive";

type Paper = { title: string; year?: number; authors: string[]; doi?: string; arxiv?: string; links: string[] };
type Work = {
  id: string; title: string; publication_year: number; doi?: string; authorships: {author: {display_name: string}}[];
  locations: {landing_page_url?: string | null}[];
};
type Entry = { title?: string[]; DOI?: string; URL: string; issued?: {"date-parts": number[][]}; author?: {given?: string; family?: string; name?: string}[] };

async function request(url: URL | string) {
  const response = await fetch(url, {signal: AbortSignal.timeout(45_000)});
  if (!response.ok) throw new Error(`${new URL(url).hostname} HTTP ${response.status}`);
  return response;
}

const arxivId = /^(?:\d{4}\.\d{4,5}|[a-z][a-z\d.-]*\/\d{7})(?:v[1-9]\d*)?$/i;

function arxivFrom(doi?: string, locations: (string | null | undefined)[] = []) {
  for (const value of [doi, ...locations]) {
    const match = value?.match(/^(?:10\.48550\/arxiv\.|https?:\/\/(?:www\.)?arxiv\.org\/abs\/)(.+)$/i);
    if (match && arxivId.test(match[1])) return match[1];
  }
}

async function openAlex(query: string, limit: number): Promise<Paper[]> {
  const url = new URL("https://api.openalex.org/works");
  url.search = new URLSearchParams({ search: query, per_page: String(limit),
    select: "id,title,doi,publication_year,authorships,locations" }).toString();
  const {results} = await (await request(url)).json() as {results: Work[]};
  return results.filter(work => work.title).map(work => {
    const doi = work.doi?.replace(/^https?:\/\/doi\.org\//i, "");
    const locations = work.locations.map(loc => loc.landing_page_url);
    const arxiv = arxivFrom(doi, locations);
    const link = doi ? `https://doi.org/${doi}` : locations.find(loc => loc?.startsWith("https://"));
    return {title: work.title, year: work.publication_year, doi, arxiv, authors: work.authorships.map(item => item.author.display_name),
      links: [work.id, ...(link ? [link] : [])]};
  });
}

async function crossref(query: string, limit: number): Promise<Paper[]> {
  const url = new URL("https://api.crossref.org/works");
  url.search = new URLSearchParams({"query.bibliographic": query, rows: String(limit), select: "title,DOI,URL,issued,author"}).toString();
  const {message} = await (await request(url)).json() as {message: {items: Entry[]}};
  return message.items.filter(work => work.title?.[0]).map(work => ({
    title: work.title![0], year: work.issued?.["date-parts"]?.[0]?.[0],
    doi: work.DOI, arxiv: arxivFrom(work.DOI), links: [work.URL],
    authors: (work.author ?? []).map(item => item.name || [item.given, item.family].filter(Boolean).join(" "))
  }));
}

function normalized(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function sameWork(a: Paper, b: Paper) {
  if (a.doi && a.doi.toLowerCase() === b.doi?.toLowerCase()) return true;
  if (a.arxiv && a.arxiv.replace(/v\d+$/, "") === b.arxiv?.replace(/v\d+$/, "")) return true;
  const author = (p: Paper) => normalized(p.authors[0] ?? "").split(" ").at(-1);
  return normalized(a.title) === normalized(b.title) && Boolean(author(a)) && author(a) === author(b);
}

async function search(query: string, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error("条数范围为 1–50");
  const responses = await Promise.allSettled([openAlex(query, count), crossref(query, count)]);
  const failed: string[] = [];
  const groups = responses.map((response, index) => {
    if (response.status === "fulfilled") return response.value;
    failed.push(`${["OpenAlex", "Crossref"][index]}: ${response.reason}`);
    return [];
  });
  if (failed.length === groups.length) throw new Error(failed.join("\n"));
  const results: Paper[] = [];
  for (let i = 0; i < count; i++) {
    for (const group of groups) {
      const paper = group[i];
      if (!paper) continue;
      const previous = results.find(other => sameWork(other, paper));
      if (previous) {
        previous.links = [...new Set([...previous.links, ...paper.links])];
        previous.arxiv ??= paper.arxiv;
        previous.doi ??= paper.doi;
      } else results.push(paper);
    }
  }
  console.log(JSON.stringify({query, retrieved: new Date().toISOString(), unavailable: failed, results: results.slice(0, count)}, null, 2));
}

async function fetchPaper(input: string, slug?: string) {
  if (!arxivId.test(input)) throw new Error("需要 arXiv 编号，例如 1706.03762 或 cs/0601001v1");
  if (typeof Bun.Archive !== "function") throw new Error("归档需要支持 Bun.Archive 的 Bun（已验证 1.4.4）");
  let id = input;
  if (!/v\d+$/.test(input)) {
    const page = await request(`https://arxiv.org/abs/${input}`);
    let canonical = "";
    await new HTMLRewriter().on('meta[property="og:url"]', {
      element(el) { canonical = el.getAttribute("content") ?? ""; }
    }).transform(page).text();
    id = canonical.replace(/^https:\/\/arxiv\.org\/abs\//, "");
    if (!arxivId.test(id) || id.replace(/v\d+$/, "") !== input || !/v\d+$/.test(id))
      throw new Error("无法确定当前版本。请用论文页面明确列出的带版本编号重试。");
  }
  if (slug !== undefined && (slug !== input && slug.includes("/") || !slug.trim() ||
      /[\\\x00-\x1f]/.test(slug) || slug.split("/").some(part => part === "." || part === ".."))) {
    throw new Error("目录名须为单个文件夹名");
  }
  await archive(id, slug ?? id.replace("/", "-"), request);
}

const [command, value, extra, ...rest] = Bun.argv.slice(2);
try {
  if (command === "search" && value?.trim() && !rest.length) await search(value, Number(extra ?? 8));
  else if (command === "fetch" && value && !rest.length) await fetchPaper(value, extra);
  else throw new Error('用法: papers.ts search "关键词" [条数] | fetch <arXiv-ID> [目录名]');
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
