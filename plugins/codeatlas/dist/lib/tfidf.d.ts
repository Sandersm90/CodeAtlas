/**
 * tfidf.ts
 *
 * TF-IDF keyword search over all wiki pages using the `natural` library.
 *
 * - Index is built lazily on first search call.
 * - Index is invalidated (and rebuilt on next call) after wiki_update or wiki_ingest.
 */
export interface TfIdfResult {
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
 * Returns tags for a page from the in-memory index.
 * Builds the index first if needed.
 */
export declare function getPageTags(page: string): Promise<string[]>;
/**
 * Searches wiki pages using TF-IDF.
 * Returns top k results sorted by relevance score (descending).
 */
export declare function search(query: string, k: number): Promise<TfIdfResult[]>;
//# sourceMappingURL=tfidf.d.ts.map