"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiReembedAllSchema = void 0;
exports.wikiReembedAll = wikiReembedAll;
const zod_1 = require("zod");
const wiki_fs_1 = require("../lib/wiki-fs");
const chunker_1 = require("../lib/chunker");
const embedder_1 = require("../lib/embedder");
const vector_store_1 = require("../lib/vector-store");
const tfidf_1 = require("../lib/tfidf");
const db_1 = require("../db");
exports.WikiReembedAllSchema = zod_1.z.object({
    stale_only: zod_1.z
        .boolean()
        .optional()
        .describe("If true (default), only re-embed pages where 'updated' date is newer than last embed. If false, re-embed all pages."),
});
async function wikiReembedAll(input) {
    const staleOnly = input.stale_only !== false; // default true
    let pages;
    try {
        pages = await (0, wiki_fs_1.readAllPages)();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: `Failed to read wiki pages: ${message}`, code: "READ_ERROR" };
    }
    const db = (0, db_1.getDb)();
    const reembedded = [];
    const skipped = [];
    const errors = [];
    for (const page of pages) {
        const fm = page.frontmatter;
        if (staleOnly) {
            const embedTime = (0, vector_store_1.getPageEmbedTime)(db, page.name);
            const isStale = fm["updated"] && typeof fm["updated"] === "string"
                ? !embedTime || new Date(fm["updated"]) > embedTime
                : !embedTime;
            if (!isStale) {
                skipped.push(page.name);
                continue;
            }
        }
        try {
            const chunks = (0, chunker_1.chunkPage)(page.name, page.body);
            const embeddings = await (0, embedder_1.embedBatch)(chunks.map((c) => c.content));
            const chunkVectors = chunks.map((chunk, i) => ({
                chunk_idx: chunk.chunk_idx,
                content: chunk.content,
                embedding: embeddings[i],
            }));
            (0, vector_store_1.upsertPage)(db, page.name, chunkVectors);
            reembedded.push(page.name);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push({ page: page.name, error: message });
        }
    }
    if (reembedded.length > 0) {
        (0, tfidf_1.invalidateIndex)();
    }
    return {
        reembedded,
        skipped,
        errors,
        total: pages.length,
    };
}
//# sourceMappingURL=wiki-reembed-all.js.map