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
import { resolvePage, readPage } from "../lib/wiki-fs";
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

function matchesTags(page: string, requiredTags: string[]): boolean {
  const p = readPage(page);
  if (!p) return false;
  const pageTags: string[] = Array.isArray(p.frontmatter.tags)
    ? (p.frontmatter.tags as string[]).map((t) => t.toLowerCase())
    : [];
  return requiredTags.every((t) => pageTags.includes(t.toLowerCase()));
}

/**
 * Handles the wiki_search tool call.
 */
export async function wikiSearch(input: WikiSearchInput): Promise<WikiSearchResult> {
  const { query, limit = 5, mode = "hybrid", tags } = input;
  const db = getDb();
  const filterLimit = tags && tags.length > 0 ? limit * 4 : limit;

  const applyTagFilter = (items: SearchResultItem[]): SearchResultItem[] =>
    tags && tags.length > 0
      ? items.filter((r) => matchesTags(r.page, tags)).slice(0, limit)
      : items.slice(0, limit);

  if (mode === "keyword") {
    let kwResults;
    try {
      kwResults = await bm25Search(query, filterLimit);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `Keyword search failed: ${message}`, code: "SEARCH_ERROR" };
    }

    return {
      results: applyTagFilter(kwResults.map((r) => ({
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

    return { results: applyTagFilter(Array.from(seen.values())) };
  }

  // Hybrid: run both searches and combine with RRF
  const fetchCount = filterLimit * 3;

  let queryVec: number[];
  try {
    queryVec = await embed(query);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to embed query via Ollama: ${message}`, code: "EMBEDDING_ERROR" };
  }

  let semResults;
  try {
    semResults = searchSimilar(db, queryVec, fetchCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Vector search failed: ${message}`, code: "SEARCH_ERROR" };
  }

  let kwResults;
  try {
    kwResults = await bm25Search(query, fetchCount);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Keyword search failed: ${message}`, code: "SEARCH_ERROR" };
  }

  const combined: CombinedResult[] = reciprocalRankFusion(semResults, kwResults, 60, filterLimit);

  return {
    results: applyTagFilter(combined.map((r) => ({
      page: r.page,
      excerpt: r.excerpt,
      score: r.score,
      path: r.path || resolvePage(r.page),
    }))),
  };
}
