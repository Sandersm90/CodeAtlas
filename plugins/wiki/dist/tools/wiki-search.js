"use strict";
/**
 * wiki-search.ts
 *
 * MCP tool: wiki_search
 * Hybrid semantic + TF-IDF keyword search across all wiki pages.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiSearchSchema = void 0;
exports.wikiSearch = wikiSearch;
const zod_1 = require("zod");
const embedder_1 = require("../lib/embedder");
const vector_store_1 = require("../lib/vector-store");
const tfidf_1 = require("../lib/tfidf");
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
    tags: zod_1.z.array(zod_1.z.string()).optional().describe("Filter results to pages that have ALL specified tags"),
});
async function matchesTags(page, requiredTags) {
    const pageTags = await (0, tfidf_1.getPageTags)(page);
    return requiredTags.every((t) => pageTags.includes(t.toLowerCase()));
}
/**
 * Handles the wiki_search tool call.
 */
async function wikiSearch(input) {
    const { query, limit = 5, mode = "hybrid", tags } = input;
    const db = (0, db_1.getDb)();
    const filterLimit = tags && tags.length > 0 ? limit * 4 : limit;
    const applyTagFilter = async (items) => {
        if (!tags || tags.length === 0)
            return items.slice(0, limit);
        const matches = await Promise.all(items.map((r) => matchesTags(r.page, tags)));
        return items.filter((_, i) => matches[i]).slice(0, limit);
    };
    if (mode === "keyword") {
        let kwResults;
        try {
            kwResults = await (0, tfidf_1.search)(query, filterLimit);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { error: `Keyword search failed: ${message}`, code: "SEARCH_ERROR" };
        }
        return {
            results: await applyTagFilter(kwResults.map((r) => ({
                page: r.page,
                excerpt: r.excerpt,
                score: r.score,
                path: r.path,
            }))),
        };
    }
    if (mode === "semantic") {
        let queryVec;
        try {
            queryVec = await (0, embedder_1.embed)(query);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { error: `Failed to embed query via Ollama: ${message}`, code: "EMBEDDING_ERROR" };
        }
        let semResults;
        try {
            semResults = (0, vector_store_1.searchSimilar)(db, queryVec, filterLimit);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { error: `Vector search failed: ${message}`, code: "SEARCH_ERROR" };
        }
        const seen = new Map();
        for (const r of semResults) {
            if (!seen.has(r.page) || r.score > (seen.get(r.page)?.score ?? 0)) {
                seen.set(r.page, { page: r.page, excerpt: r.excerpt, score: r.score, path: (0, wiki_fs_1.resolvePage)(r.page) });
            }
        }
        return { results: await applyTagFilter(Array.from(seen.values())) };
    }
    // Hybrid: run both searches and combine with RRF
    const fetchCount = filterLimit * 3;
    let queryVec;
    try {
        queryVec = await (0, embedder_1.embed)(query);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: `Failed to embed query via Ollama: ${message}`, code: "EMBEDDING_ERROR" };
    }
    let semResults;
    try {
        semResults = (0, vector_store_1.searchSimilar)(db, queryVec, fetchCount);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: `Vector search failed: ${message}`, code: "SEARCH_ERROR" };
    }
    let kwResults;
    try {
        kwResults = await (0, tfidf_1.search)(query, fetchCount);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: `Keyword search failed: ${message}`, code: "SEARCH_ERROR" };
    }
    const combined = (0, rrf_1.reciprocalRankFusion)(semResults, kwResults, 60, filterLimit);
    return {
        results: await applyTagFilter(combined.map((r) => ({
            page: r.page,
            excerpt: r.excerpt,
            score: r.score,
            path: r.path || (0, wiki_fs_1.resolvePage)(r.page),
        }))),
    };
}
//# sourceMappingURL=wiki-search.js.map