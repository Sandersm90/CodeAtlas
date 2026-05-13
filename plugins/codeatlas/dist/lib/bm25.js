"use strict";
/**
 * bm25.ts
 *
 * BM25 keyword search over all wiki pages.
 * Uses the `natural` library's TfIdf as a BM25-like scorer.
 *
 * - Index is built lazily on first search call.
 * - Index is invalidated (and rebuilt on next call) after wiki_update or wiki_ingest.
 */
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
exports.invalidateIndex = invalidateIndex;
exports.search = search;
const natural = __importStar(require("natural"));
const wiki_fs_1 = require("./wiki-fs");
let tfidf = null;
let indexEntries = [];
let indexDirty = true;
/**
 * Marks the index as dirty so it will be rebuilt on the next search.
 */
function invalidateIndex() {
    indexDirty = true;
    tfidf = null;
    indexEntries = [];
}
/**
 * Builds the BM25/TF-IDF index from all wiki pages.
 */
async function buildIndex() {
    const pages = await (0, wiki_fs_1.readAllPages)();
    tfidf = new natural.TfIdf();
    indexEntries = [];
    for (const page of pages) {
        // Use plain body text for indexing (strip frontmatter)
        const entry = {
            page: page.name,
            path: page.path,
            content: page.body,
        };
        indexEntries.push(entry);
        tfidf.addDocument(page.body);
    }
    indexDirty = false;
}
/**
 * Extracts a relevant excerpt from page content for a given query.
 * Returns the first 300 characters of the most relevant passage.
 */
function extractExcerpt(content, query) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?\n]+/).filter((s) => s.trim().length > 0);
    // Find sentence with most query word matches
    let bestSentence = sentences[0] || content.slice(0, 300);
    let bestScore = 0;
    for (const sentence of sentences) {
        const lc = sentence.toLowerCase();
        const score = queryWords.filter((w) => lc.includes(w)).length;
        if (score > bestScore) {
            bestScore = score;
            bestSentence = sentence;
        }
    }
    const trimmed = bestSentence.trim();
    return trimmed.length > 300 ? trimmed.slice(0, 297) + "..." : trimmed;
}
/**
 * Searches wiki pages using BM25/TF-IDF.
 * Returns top k results sorted by relevance score (descending).
 */
async function search(query, k) {
    if (indexDirty || tfidf === null) {
        await buildIndex();
    }
    if (!tfidf || indexEntries.length === 0) {
        return [];
    }
    // Collect scores for all documents
    const scores = [];
    tfidf.tfidfs(query, (idx, measure) => {
        if (measure > 0) {
            scores.push({ idx, score: measure });
        }
    });
    // Sort by score descending and take top k
    scores.sort((a, b) => b.score - a.score);
    const topScores = scores.slice(0, k);
    return topScores
        .filter((s) => s.idx < indexEntries.length)
        .map((s) => {
        const entry = indexEntries[s.idx];
        return {
            page: entry.page,
            excerpt: extractExcerpt(entry.content, query),
            score: s.score,
            path: entry.path,
        };
    });
}
//# sourceMappingURL=bm25.js.map