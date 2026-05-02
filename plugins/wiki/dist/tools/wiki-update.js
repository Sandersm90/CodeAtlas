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
});
/**
 * Handles the wiki_update tool call.
 */
async function wikiUpdate(input) {
    const { page, content } = input;
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
    // Generate embeddings for all chunks
    let embeddings;
    try {
        const texts = chunks.map((c) => c.content);
        embeddings = await (0, embedder_1.embedBatch)(texts);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            error: `Failed to generate embeddings via Ollama: ${message}`,
            code: "EMBEDDING_ERROR",
        };
    }
    // Build ChunkVector array
    const chunkVectors = chunks.map((chunk, i) => ({
        chunk_idx: chunk.chunk_idx,
        content: chunk.content,
        embedding: embeddings[i],
    }));
    // Upsert into vector store
    try {
        const db = (0, db_1.getDb)();
        (0, vector_store_1.upsertPage)(db, page, chunkVectors);
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
    return {
        success: true,
        chunks_embedded: chunks.length,
        path: filePath,
    };
}
//# sourceMappingURL=wiki-update.js.map