"use strict";
/**
 * wiki-search.ts
 *
 * MCP tool: wiki_search
 * Hybrid semantic + BM25 keyword search across all wiki pages.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiSearchSchema = void 0;
exports.wikiSearch = wikiSearch;
const zod_1 = require("zod");
const embedder_1 = require("../lib/embedder");
const vector_store_1 = require("../lib/vector-store");
const bm25_1 = require("../lib/bm25");
const rrf_1 = require("../lib/rrf");
const wiki_fs_1 = require("../lib/wiki-fs");
const db_1 = require("../db");
exports.WikiSearchSchema = zod_1.z.object({
    query: zod_1.z.string().min(1).describe("Search query"),
    limit: zod_1.z.number().int().min(1).max(20).default(5).describe("Maximum number of results to return (default: 5)"),
    mode: zod_1.z
        .enum(["hybrid", "semantic", "keyword"])
        .default("hybrid")
        .describe("Search mode: hybrid (default), semantic only, or keyword only"),
});
/**
 * Handles the wiki_search tool call.
 */
async function wikiSearch(input) {
    const { query, limit = 5, mode = "hybrid" } = input;
    const db = (0, db_1.getDb)();
    if (mode === "keyword") {
        // Pure BM25 keyword search
        let kwResults;
        try {
            kwResults = await (0, bm25_1.search)(query, limit);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { error: `Keyword search failed: ${message}`, code: "SEARCH_ERROR" };
        }
        return {
            results: kwResults.map((r) => ({
                page: r.page,
                excerpt: r.excerpt,
                score: r.score,
                path: r.path,
            })),
        };
    }
    if (mode === "semantic") {
        // Pure semantic (vector) search
        let queryVec;
        try {
            queryVec = await (0, embedder_1.embed)(query);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                error: `Failed to embed query via Ollama: ${message}`,
                code: "EMBEDDING_ERROR",
            };
        }
        let semResults;
        try {
            semResults = (0, vector_store_1.searchSimilar)(db, queryVec, limit);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { error: `Vector search failed: ${message}`, code: "SEARCH_ERROR" };
        }
        // Deduplicate by page name, keep highest score per page
        const seen = new Map();
        for (const r of semResults) {
            if (!seen.has(r.page) || r.score > (seen.get(r.page)?.score ?? 0)) {
                seen.set(r.page, {
                    page: r.page,
                    excerpt: r.excerpt,
                    score: r.score,
                    path: (0, wiki_fs_1.resolvePage)(r.page),
                });
            }
        }
        return { results: Array.from(seen.values()).slice(0, limit) };
    }
    // Hybrid: run both searches and combine with RRF
    const semFetchCount = limit * 3; // fetch more to give RRF room to work
    const kwFetchCount = limit * 3;
    let queryVec;
    try {
        queryVec = await (0, embedder_1.embed)(query);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            error: `Failed to embed query via Ollama: ${message}`,
            code: "EMBEDDING_ERROR",
        };
    }
    let semResults;
    try {
        semResults = (0, vector_store_1.searchSimilar)(db, queryVec, semFetchCount);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: `Vector search failed: ${message}`, code: "SEARCH_ERROR" };
    }
    let kwResults;
    try {
        kwResults = await (0, bm25_1.search)(query, kwFetchCount);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: `Keyword search failed: ${message}`, code: "SEARCH_ERROR" };
    }
    const combined = (0, rrf_1.reciprocalRankFusion)(semResults, kwResults, 60, limit);
    // Fill in page paths that may be missing from semantic-only results
    const results = combined.map((r) => ({
        page: r.page,
        excerpt: r.excerpt,
        score: r.score,
        path: r.path || (0, wiki_fs_1.resolvePage)(r.page),
    }));
    return { results };
}
//# sourceMappingURL=wiki-search.js.map