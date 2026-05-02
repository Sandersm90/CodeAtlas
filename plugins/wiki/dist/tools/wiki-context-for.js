"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiContextForSchema = void 0;
exports.wikiContextFor = wikiContextFor;
const fs = __importStar(require("fs"));
const zod_1 = require("zod");
const symbol_extractor_1 = require("../lib/symbol-extractor");
const embedder_1 = require("../lib/embedder");
const vector_store_1 = require("../lib/vector-store");
const bm25_1 = require("../lib/bm25");
const rrf_1 = require("../lib/rrf");
const wiki_fs_1 = require("../lib/wiki-fs");
const db_1 = require("../db");
exports.WikiContextForSchema = zod_1.z.object({
    file: zod_1.z.string().min(1).describe("Absolute or relative path to the source file"),
    limit: zod_1.z.number().int().min(1).max(10).default(5).describe("Maximum number of wiki pages to return (default: 5)"),
});
async function wikiContextFor(input) {
    const { file, limit = 5 } = input;
    if (!fs.existsSync(file)) {
        return { error: `File not found: ${file}`, code: "FILE_NOT_FOUND" };
    }
    const { filename, symbols } = (0, symbol_extractor_1.extractSymbols)(file);
    // Build query: filename first (highest signal), then extracted symbols
    const queryTerms = [filename, ...symbols];
    const query = queryTerms.join(" ");
    const db = (0, db_1.getDb)();
    const fetchCount = limit * 3;
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
        kwResults = await (0, bm25_1.search)(query, fetchCount);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: `Keyword search failed: ${message}`, code: "SEARCH_ERROR" };
    }
    const combined = (0, rrf_1.reciprocalRankFusion)(semResults, kwResults, 60, limit);
    return {
        file,
        query_terms: queryTerms,
        results: combined.map((r) => ({
            page: r.page,
            excerpt: r.excerpt,
            score: r.score,
            path: r.path || (0, wiki_fs_1.resolvePage)(r.page),
        })),
    };
}
//# sourceMappingURL=wiki-context-for.js.map