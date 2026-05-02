import { z } from "zod";
import { readRawFile, listPages, readPage } from "../lib/wiki-fs";
import { embed } from "../lib/embedder";
import { searchSimilar } from "../lib/vector-store";
import { getDb } from "../db";

export const WikiIngestBaseSchema = z.object({
  file: z
    .string()
    .min(1)
    .optional()
    .describe("Single filename relative to RAW_ROOT, e.g. 'mqtt-auth-notes.md'"),
  files: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .describe("Multiple filenames relative to RAW_ROOT for batch ingest"),
  url: z
    .string()
    .url()
    .optional()
    .describe("URL to fetch and ingest (web page or GitHub file URL)"),
  urls: z
    .array(z.string().url())
    .min(1)
    .optional()
    .describe("Multiple URLs to fetch and ingest in batch"),
  hint: z.string().optional().describe("Optional hint about what these sources are about"),
});

export const WikiIngestSchema = WikiIngestBaseSchema.refine(
  (d) =>
    d.file ||
    (d.files && d.files.length > 0) ||
    d.url ||
    (d.urls && d.urls.length > 0),
  { message: "Provide at least one of: 'file', 'files', 'url', 'urls'" }
);

export type WikiIngestInput = z.infer<typeof WikiIngestSchema>;

const GITHUB_BLOB_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/;

function toRawGithubUrl(url: string): string {
  const m = url.match(GITHUB_BLOB_RE);
  if (!m) return url;
  return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchUrlContent(url: string): Promise<string> {
  const fetchUrl = toRawGithubUrl(url);
  const response = await fetch(fetchUrl, {
    headers: { "User-Agent": "codeatlas-wiki-mcp/1.0" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (contentType.includes("text/html")) {
    return stripHtml(text);
  }

  return text;
}

export interface DuplicateCandidate {
  page: string;
  score: number;
}

export interface WikiIngestPayload {
  files: string[];
  raw_files: Record<string, string>;
  existing_pages: string[];
  existing_page_contents: Record<string, string>;
  potential_duplicates: Record<string, DuplicateCandidate[]>;
  instructions: string;
}

export interface WikiIngestError {
  error: string;
  code: string;
  failed_file?: string;
}

export type WikiIngestResult = WikiIngestPayload | WikiIngestError;

const MAX_CONTEXT_PAGES = 5;

export async function wikiIngest(input: WikiIngestInput): Promise<WikiIngestResult> {
  const { file, files, url, urls, hint } = input;

  const filesToProcess = [...(files ?? []), ...(file ? [file] : [])];
  const urlsToProcess = [...(urls ?? []), ...(url ? [url] : [])];

  const rawFiles: Record<string, string> = {};

  for (const f of filesToProcess) {
    try {
      rawFiles[f] = readRawFile(f);
    } catch (err) {
      return {
        error: `Failed to read raw file "${f}": ${err instanceof Error ? err.message : String(err)}`,
        code: "FILE_NOT_FOUND",
        failed_file: f,
      };
    }
  }

  for (const u of urlsToProcess) {
    try {
      rawFiles[u] = await fetchUrlContent(u);
    } catch (err) {
      return {
        error: `Failed to fetch URL "${u}": ${err instanceof Error ? err.message : String(err)}`,
        code: "FETCH_FAILED",
        failed_file: u,
      };
    }
  }

  let existingPages: string[] = [];
  try {
    existingPages = await listPages();
  } catch {
    // non-fatal
  }

  const existingPageContents: Record<string, string> = {};
  for (const pageName of existingPages.slice(0, MAX_CONTEXT_PAGES)) {
    const page = readPage(pageName);
    if (page) existingPageContents[pageName] = page.content;
  }

  // Deduplication: embed a sample of each source, find similar existing pages
  const DEDUP_THRESHOLD = 0.75;
  const SAMPLE_LENGTH = 1000;
  const potentialDuplicates: Record<string, DuplicateCandidate[]> = {};

  try {
    const db = getDb();
    for (const [source, content] of Object.entries(rawFiles)) {
      const sample = content.slice(0, SAMPLE_LENGTH);
      const vec = await embed(sample);
      const results = searchSimilar(db, vec, 3);
      const matches = results.filter((r) => r.score >= DEDUP_THRESHOLD);
      if (matches.length > 0) {
        const seen = new Set<string>();
        potentialDuplicates[source] = matches
          .filter((r) => {
            if (seen.has(r.page)) return false;
            seen.add(r.page);
            return true;
          })
          .map((r) => ({ page: r.page, score: Math.round(r.score * 1000) / 1000 }));
      }
    }
  } catch {
    // non-fatal — dedup is best-effort
  }

  const today = new Date().toISOString().split("T")[0];
  const sourceCount = filesToProcess.length + urlsToProcess.length;
  const sourceList = [
    ...filesToProcess.map((f) => `  - ${f} (file)`),
    ...urlsToProcess.map((u) => `  - ${u} (url)`),
  ].join("\n");

  const dedupSection =
    Object.keys(potentialDuplicates).length > 0
      ? `\nPotential duplicates detected (update these rather than creating new pages):\n${Object.entries(potentialDuplicates)
          .map(([src, candidates]) =>
            `  - ${src}: ${candidates.map((c) => `${c.page} (score ${c.score})`).join(", ")}`
          )
          .join("\n")}\n`
      : "";

  const instructions = `Analyze the raw_files (${sourceCount} source${sourceCount === 1 ? "" : "s"}) and create or update wiki pages using the wiki_update tool.

Sources to process:
${sourceList}
${dedupSection}
Rules:
- Today's date: ${today}${hint ? `\n- Hint: ${hint}` : ""}
- Process ALL entries in raw_files — do not skip any
- Use [[WikiLinks]] for ALL cross-references between pages
- NEVER duplicate content from existing_page_contents — only ADD new information
- If a concept already has a page, UPDATE it rather than create a duplicate
- Frontmatter must include: title, tags, related, updated (${today})
- Tags: lowercase, hyphen-separated
- Writing style: concise and factual, no fluff
- Only create pages for concepts with REAL content to add
- Call wiki_update once per page — do NOT call wiki_ingest again`;

  return {
    files: Object.keys(rawFiles),
    raw_files: rawFiles,
    existing_pages: existingPages,
    existing_page_contents: existingPageContents,
    potential_duplicates: potentialDuplicates,
    instructions,
  };
}
