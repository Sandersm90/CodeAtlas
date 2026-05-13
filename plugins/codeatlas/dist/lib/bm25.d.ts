/**
 * bm25.ts
 *
 * BM25 keyword search over all wiki pages.
 * Uses the `natural` library's TfIdf as a BM25-like scorer.
 *
 * - Index is built lazily on first search call.
 * - Index is invalidated (and rebuilt on next call) after wiki_update or wiki_ingest.
 */
export interface BM25Result {
    page: string;
    excerpt: string;
    score: number;
    path: string;
}
/**
 * Marks the index as dirty so it will be rebuilt on the next search.
 */
export declare function invalidateIndex(): void;
/**
 * Searches wiki pages using BM25/TF-IDF.
 * Returns top k results sorted by relevance score (descending).
 */
export declare function search(query: string, k: number): Promise<BM25Result[]>;
//# sourceMappingURL=bm25.d.ts.map