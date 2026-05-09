/**
 * rrf.ts
 *
 * Reciprocal Rank Fusion (RRF) combiner.
 *
 * Standard formula: score = Σ 1 / (k + rank)
 * where rank is 1-based position in each result list.
 *
 * Results are deduplicated by page name before returning.
 */
import { SearchResult } from "./vector-store";
import { TfIdfResult } from "./tfidf";
export interface CombinedResult {
    page: string;
    excerpt: string;
    score: number;
    path: string;
}
/**
 * Combines semantic and keyword search results using Reciprocal Rank Fusion.
 *
 * @param semantic - Results from vector similarity search
 * @param keyword  - Results from TF-IDF keyword search
 * @param k        - RRF constant (default 60)
 * @param topN     - Number of results to return (default 5)
 */
export declare function reciprocalRankFusion(semantic: SearchResult[], keyword: TfIdfResult[], k?: number, topN?: number): CombinedResult[];
//# sourceMappingURL=rrf.d.ts.map