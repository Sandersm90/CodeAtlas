"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiIngestSchema = exports.WikiIngestBaseSchema = void 0;
exports.wikiIngest = wikiIngest;
const zod_1 = require("zod");
const wiki_fs_1 = require("../lib/wiki-fs");
const embedder_1 = require("../lib/embedder");
const vector_store_1 = require("../lib/vector-store");
const db_1 = require("../db");
exports.WikiIngestBaseSchema = zod_1.z.object({
    file: zod_1.z
        .string()
        .min(1)
        .optional()
        .describe("Single filename relative to RAW_ROOT, e.g. 'mqtt-auth-notes.md'"),
    files: zod_1.z
        .array(zod_1.z.string().min(1))
        .min(1)
        .optional()
        .describe("Multiple filenames relative to RAW_ROOT for batch ingest"),
    url: zod_1.z
        .string()
        .url()
        .optional()
        .describe("URL to fetch and ingest (web page or GitHub file URL)"),
    urls: zod_1.z
        .array(zod_1.z.string().url())
        .min(1)
        .optional()
        .describe("Multiple URLs to fetch and ingest in batch"),
    hint: zod_1.z.string().optional().describe("Optional hint about what these sources are about"),
});
exports.WikiIngestSchema = exports.WikiIngestBaseSchema.refine((d) => d.file ||
    (d.files && d.files.length > 0) ||
    d.url ||
    (d.urls && d.urls.length > 0), { message: "Provide at least one of: 'file', 'files', 'url', 'urls'" });
const GITHUB_BLOB_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/;
function toRawGithubUrl(url) {
    const m = url.match(GITHUB_BLOB_RE);
    if (!m)
        return url;
    return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
}
function stripHtml(html) {
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
async function fetchUrlContent(url) {
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
const MAX_CONTEXT_PAGES = 5;
async function wikiIngest(input) {
    const { file, files, url, urls, hint } = input;
    const filesToProcess = [...(files ?? []), ...(file ? [file] : [])];
    const urlsToProcess = [...(urls ?? []), ...(url ? [url] : [])];
    const rawFiles = {};
    for (const f of filesToProcess) {
        try {
            rawFiles[f] = (0, wiki_fs_1.readRawFile)(f);
        }
        catch (err) {
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
        }
        catch (err) {
            return {
                error: `Failed to fetch URL "${u}": ${err instanceof Error ? err.message : String(err)}`,
                code: "FETCH_FAILED",
                failed_file: u,
            };
        }
    }
    let existingPages = [];
    try {
        existingPages = await (0, wiki_fs_1.listPages)();
    }
    catch {
        // non-fatal
    }
    const existingPageContents = {};
    for (const pageName of existingPages.slice(0, MAX_CONTEXT_PAGES)) {
        const page = (0, wiki_fs_1.readPage)(pageName);
        if (page)
            existingPageContents[pageName] = page.content;
    }
    // Deduplication: embed a sample of each source, find similar existing pages
    const DEDUP_THRESHOLD = 0.75;
    const SAMPLE_LENGTH = 1000;
    const potentialDuplicates = {};
    try {
        const db = (0, db_1.getDb)();
        for (const [source, content] of Object.entries(rawFiles)) {
            const sample = content.slice(0, SAMPLE_LENGTH);
            const vec = await (0, embedder_1.embed)(sample);
            const results = (0, vector_store_1.searchSimilar)(db, vec, 3);
            const matches = results.filter((r) => r.score >= DEDUP_THRESHOLD);
            if (matches.length > 0) {
                const seen = new Set();
                potentialDuplicates[source] = matches
                    .filter((r) => {
                    if (seen.has(r.page))
                        return false;
                    seen.add(r.page);
                    return true;
                })
                    .map((r) => ({ page: r.page, score: Math.round(r.score * 1000) / 1000 }));
            }
        }
    }
    catch {
        // non-fatal — dedup is best-effort
    }
    const today = new Date().toISOString().split("T")[0];
    const sourceCount = filesToProcess.length + urlsToProcess.length;
    const sourceList = [
        ...filesToProcess.map((f) => `  - ${f} (file)`),
        ...urlsToProcess.map((u) => `  - ${u} (url)`),
    ].join("\n");
    const dedupSection = Object.keys(potentialDuplicates).length > 0
        ? `\nPotential duplicates detected (update these rather than creating new pages):\n${Object.entries(potentialDuplicates)
            .map(([src, candidates]) => `  - ${src}: ${candidates.map((c) => `${c.page} (score ${c.score})`).join(", ")}`)
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
//# sourceMappingURL=wiki-ingest.js.map