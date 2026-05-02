/**
 * wiki-search.ts
 *
 * MCP tool: wiki_search
 * Hybrid semantic + BM25 keyword search across all wiki pages.
 */

import { z } from "zod";
import { embed } from "../lib/embedder";
import { searchSimilar } from "../lib/vector-store";
import { search as bm25Search } from "../lib/bm25";
import { reciprocalRankFusion, CombinedResult } from "../lib/rrf";
import { resolvePage } from "../lib/wiki-fs";
import { getDb } from "../db";

export const WikiSearchSchema = z.object({
  query: z.string().min(1).describe("Search query"),
  limit: z.number().int().min(1).max(20).default(5).describe("Maximum number of results to return (default: 5)"),
  mode: z
    .enum(["hybrid", "semantic", "keyword"])
    .default("hybrid")
    .describe("Search mode: hybrid (default), semantic only, or keyword only"),
});

export type WikiSearchInput = z.infer<typeof WikiSearchSchema>;

export interface SearchResultItem {
  page: string;
  excerpt: string;
  score: number;
  path: string;
}

export interface WikiSearchSuccess {
  results: SearchResultItem[];
}

export interface WikiSearchError {
  error: string;
  code: string;
}

export type WikiSearchResult = WikiSearchSuccess | WikiSearchError;

/**
 * Handles the wiki_search tool call.
 */
export async function wikiSearch(input: WikiSearchInput): Promise<WikiSearchResult> {
  const { query, limit = 5, mode = "hybrid" } = input;
  const db = getDb();

  if (mode === "keyword") {
    // Pure BM25 keyword search
    let kwResults;
    try {
      kwResults = await bm25Search(query, limit);
    } catch (err) {
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
    let queryVec: number[];
    try {
      queryVec = await embed(query);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        error: `Failed to embed query via Ollama: ${message}`,
        code: "EMBEDDING_ERROR",
      };
    }

    let semResults;
    try {
      semResults = searchSimilar(db, queryVec, limit);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `Vector search failed: ${message}`, code: "SEARCH_ERROR" };
    }

    // Deduplicate by page name, keep highest score per page
    const seen = new Map<string, SearchResultItem>();
    for (const r of semResults) {
      if (!seen.has(r.page) || r.score > (seen.get(r.page)?.score ?? 0)) {
        seen.set(r.page, {
          page: r.page,
          excerpt: r.excerpt,
          score: r.score,
          path: resolvePage(r.page),
        });
      }
    }

    return { results: Array.from(seen.values()).slice(0, limit) };
  }

  // Hybrid: run both searches and combine with RRF
  const semFetchCount = limit * 3; // fetch more to give RRF room to work
  const kwFetchCount = limit * 3;

  let queryVec: number[];
  try {
    queryVec = await embed(query);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Failed to embed query via Ollama: ${message}`,
      code: "EMBEDDING_ERROR",
    };
  }

  let semResults;
  try {
    semResults = searchSimilar(db, queryVec, semFetchCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Vector search failed: ${message}`, code: "SEARCH_ERROR" };
  }

  let kwResults;
  try {
    kwResults = await bm25Search(query, kwFetchCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Keyword search failed: ${message}`, code: "SEARCH_ERROR" };
  }

  const combined: CombinedResult[] = reciprocalRankFusion(
    semResults,
    kwResults,
    60,
    limit
  );

  // Fill in page paths that may be missing from semantic-only results
  const results: SearchResultItem[] = combined.map((r) => ({
    page: r.page,
    excerpt: r.excerpt,
    score: r.score,
    path: r.path || resolvePage(r.page),
  }));

  return { results };
}
