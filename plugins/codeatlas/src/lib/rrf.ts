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
export function reciprocalRankFusion(
  semantic: SearchResult[],
  keyword: TfIdfResult[],
  k: number = 60,
  topN: number = 5
): CombinedResult[] {
  // Accumulate RRF scores per page
  const pageScores = new Map<string, number>();

  // Track best excerpt per page (from whichever list scores it highest)
  const pageExcerpts = new Map<string, string>();
  const pagePaths = new Map<string, string>();

  // Process semantic results (1-based rank)
  for (let i = 0; i < semantic.length; i++) {
    const result = semantic[i];
    const rank = i + 1;
    const rrfScore = 1 / (k + rank);

    pageScores.set(result.page, (pageScores.get(result.page) ?? 0) + rrfScore);

    if (!pageExcerpts.has(result.page)) {
      pageExcerpts.set(result.page, result.excerpt);
    }
  }

  // Process keyword results (1-based rank)
  for (let i = 0; i < keyword.length; i++) {
    const result = keyword[i];
    const rank = i + 1;
    const rrfScore = 1 / (k + rank);

    pageScores.set(result.page, (pageScores.get(result.page) ?? 0) + rrfScore);
    pagePaths.set(result.page, result.path);

    // Prefer keyword excerpt as it tends to contain query terms
    if (!pageExcerpts.has(result.page)) {
      pageExcerpts.set(result.page, result.excerpt);
    }
  }

  // Build sorted combined results
  const combined: CombinedResult[] = [];

  for (const [page, score] of pageScores.entries()) {
    combined.push({
      page,
      excerpt: pageExcerpts.get(page) ?? "",
      score,
      path: pagePaths.get(page) ?? "",
    });
  }

  // Sort by RRF score descending
  combined.sort((a, b) => b.score - a.score);

  return combined.slice(0, topN);
}
