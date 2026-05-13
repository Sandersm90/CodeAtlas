/**
 * wiki-search.ts
 *
 * MCP tool: wiki_search
 * Hybrid semantic + TF-IDF keyword search across all wiki pages.
 */

import { z } from "zod";
import { embed } from "../lib/embedder";
import { searchSimilar } from "../lib/vector-store";
import { search as kwSearch, getPageTags } from "../lib/tfidf";
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
  tags: z.array(z.string()).optional().describe("Filter results to pages that have ALL specified tags"),
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

async function matchesTags(page: string, requiredTags: string[]): Promise<boolean> {
  const pageTags = await getPageTags(page);
  return requiredTags.every((t) => pageTags.includes(t.toLowerCase()));
}

/**
 * Handles the wiki_search tool call.
 */
export async function wikiSearch(input: WikiSearchInput): Promise<WikiSearchResult> {
  const { query, limit = 5, mode = "hybrid", tags } = input;
  const db = getDb();
  const filterLimit = tags && tags.length > 0 ? limit * 4 : limit;

  const applyTagFilter = async (items: SearchResultItem[]): Promise<SearchResultItem[]> => {
    if (!tags || tags.length === 0) return items.slice(0, limit);
    const matches = await Promise.all(items.map((r) => matchesTags(r.page, tags)));
    return items.filter((_, i) => matches[i]).slice(0, limit);
  };

  if (mode === "keyword") {
    let kwResults;
    try {
      kwResults = await kwSearch(query, filterLimit);
    } catch (err) {
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
    let queryVec: number[];
    try {
      queryVec = await embed(query);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `Failed to embed query via Ollama: ${message}`, code: "EMBEDDING_ERROR" };
    }

    let semResults;
    try {
      semResults = searchSimilar(db, queryVec, filterLimit);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `Vector search failed: ${message}`, code: "SEARCH_ERROR" };
    }

    const seen = new Map<string, SearchResultItem>();
    for (const r of semResults) {
      if (!seen.has(r.page) || r.score > (seen.get(r.page)?.score ?? 0)) {
        seen.set(r.page, { page: r.page, excerpt: r.excerpt, score: r.score, path: resolvePage(r.page) });
      }
    }

    return { results: await applyTagFilter(Array.from(seen.values())) };
  }

  // Hybrid: run both searches and combine with RRF
  const fetchCount = filterLimit * 3;

  let queryVec: number[] | null = null;
  try {
    queryVec = await embed(query);
  } catch {
    // Ollama unavailable — fall back to keyword-only
  }

  let semResults: Awaited<ReturnType<typeof searchSimilar>> = [];
  if (queryVec !== null) {
    try {
      semResults = searchSimilar(db, queryVec, fetchCount);
    } catch {
      // non-fatal — proceed with keyword results only
    }
  }

  let kwResults;
  try {
    kwResults = await kwSearch(query, fetchCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Keyword search failed: ${message}`, code: "SEARCH_ERROR" };
  }

  if (semResults.length === 0) {
    // Semantic unavailable — return keyword results directly
    return {
      results: await applyTagFilter(kwResults.map((r) => ({
        page: r.page,
        excerpt: r.excerpt,
        score: r.score,
        path: r.path,
      }))),
    };
  }

  const combined: CombinedResult[] = reciprocalRankFusion(semResults, kwResults, 60, filterLimit);

  return {
    results: await applyTagFilter(combined.map((r) => ({
      page: r.page,
      excerpt: r.excerpt,
      score: r.score,
      path: r.path || resolvePage(r.page),
    }))),
  };
}
