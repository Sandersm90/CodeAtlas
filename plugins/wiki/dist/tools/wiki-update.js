"use strict";
/**
 * wiki-update.ts
 *
 * MCP tool: wiki_update
 * Creates or updates a wiki page, re-embeds it in the vector store,
 * and invalidates the BM25 index.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiUpdateSchema = void 0;
exports.wikiUpdate = wikiUpdate;
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const gray_matter_1 = __importDefault(require("gray-matter"));
const wiki_fs_1 = require("../lib/wiki-fs");
const chunker_1 = require("../lib/chunker");
const embedder_1 = require("../lib/embedder");
const vector_store_1 = require("../lib/vector-store");
const bm25_1 = require("../lib/bm25");
const db_1 = require("../db");
exports.WikiUpdateSchema = zod_1.z.object({
    page: zod_1.z.string().min(1).describe("Page name without .md extension, e.g. 'AccessManager'"),
    content: zod_1.z.string().min(1).describe("Full markdown content including YAML frontmatter"),
    reason: zod_1.z.string().optional().describe("Brief description of why this page was updated"),
    dry_run: zod_1.z.boolean().optional().describe("If true, validate and diff without writing to disk or re-embedding"),
    git_commit: zod_1.z.boolean().optional().describe("If true, run git add + git commit after writing the page"),
});
function diffLines(oldText, newText) {
    const oldLines = new Set(oldText.split("\n"));
    const newLines = new Set(newText.split("\n"));
    let added = 0;
    let removed = 0;
    for (const line of newText.split("\n"))
        if (!oldLines.has(line))
            added++;
    for (const line of oldText.split("\n"))
        if (!newLines.has(line))
            removed++;
    return { added, removed };
}
/**
 * Handles the wiki_update tool call.
 */
async function wikiUpdate(input) {
    const { page, content, dry_run, git_commit } = input;
    // Parse and validate frontmatter
    let parsed;
    try {
        parsed = (0, gray_matter_1.default)(content);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            error: `Failed to parse frontmatter: ${message}`,
            code: "INVALID_FRONTMATTER",
        };
    }
    const missing = (0, wiki_fs_1.validateFrontmatter)(parsed.data);
    if (missing.length > 0) {
        return {
            error: `Page frontmatter is missing required fields: ${missing.join(", ")}. All wiki pages must have "title", "tags", and "updated" fields.`,
            code: "MISSING_FRONTMATTER_FIELDS",
        };
    }
    const referencedLinks = (0, wiki_fs_1.extractWikiLinks)(parsed.content);
    const missingLinks = referencedLinks.filter((link) => !(0, wiki_fs_1.pageExists)(link));
    if (dry_run) {
        const existing = (0, wiki_fs_1.readPage)(page);
        const oldContent = existing?.content ?? null;
        return {
            dry_run: true,
            page,
            is_new: !existing,
            old_content: oldContent,
            new_content: content,
            line_changes: oldContent ? diffLines(oldContent, content) : { added: content.split("\n").length, removed: 0 },
            ...(missingLinks.length > 0 ? { missing_links: missingLinks } : {}),
        };
    }
    // Write page to disk
    let filePath;
    try {
        filePath = (0, wiki_fs_1.writePage)(page, content);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            error: `Failed to write page to disk: ${message}`,
            code: "WRITE_ERROR",
        };
    }
    // Chunk the page body for embedding
    const chunks = (0, chunker_1.chunkPage)(page, parsed.content);
    // Incremental embedding: reuse existing vectors for unchanged chunks
    const db = (0, db_1.getDb)();
    const existingVectors = (0, vector_store_1.getChunkVectorsForPage)(db, page);
    const existingByIdx = new Map(existingVectors.map((v) => [v.chunk_idx, v]));
    const toEmbed = [];
    const recycled = [];
    for (const chunk of chunks) {
        const existing = existingByIdx.get(chunk.chunk_idx);
        if (existing && existing.content === chunk.content) {
            recycled.push({ chunk_idx: chunk.chunk_idx, content: chunk.content, embedding: existing.embedding });
        }
        else {
            toEmbed.push(chunk);
        }
    }
    let newEmbeddings = [];
    if (toEmbed.length > 0) {
        try {
            newEmbeddings = await (0, embedder_1.embedBatch)(toEmbed.map((c) => c.content));
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                error: `Failed to generate embeddings via Ollama: ${message}`,
                code: "EMBEDDING_ERROR",
            };
        }
    }
    const freshVectors = toEmbed.map((chunk, i) => ({
        chunk_idx: chunk.chunk_idx,
        content: chunk.content,
        embedding: newEmbeddings[i],
    }));
    const allVectors = [...recycled, ...freshVectors].sort((a, b) => a.chunk_idx - b.chunk_idx);
    // Upsert into vector store
    try {
        (0, vector_store_1.upsertPage)(db, page, allVectors);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            error: `Failed to upsert vectors into database: ${message}`,
            code: "DB_ERROR",
        };
    }
    // Invalidate BM25 index so it's rebuilt on next search
    (0, bm25_1.invalidateIndex)();
    // Optional git commit
    let gitCommitted;
    if (git_commit) {
        try {
            (0, child_process_1.execSync)(`git add "${filePath}"`, { stdio: "pipe" });
            const verb = existingVectors.length === 0 ? "create" : "update";
            (0, child_process_1.execSync)(`git commit -m "wiki: ${verb} ${page}"`, { stdio: "pipe" });
            gitCommitted = true;
        }
        catch {
            gitCommitted = false;
        }
    }
    return {
        success: true,
        chunks_embedded: toEmbed.length,
        chunks_skipped: recycled.length,
        path: filePath,
        ...(gitCommitted !== undefined ? { git_committed: gitCommitted } : {}),
        ...(missingLinks.length > 0 ? { missing_links: missingLinks } : {}),
    };
}
//# sourceMappingURL=wiki-update.js.map