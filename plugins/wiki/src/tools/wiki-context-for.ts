import * as fs from "fs";
import { z } from "zod";
import { extractSymbols } from "../lib/symbol-extractor";
import { embed } from "../lib/embedder";
import { searchSimilar } from "../lib/vector-store";
import { search as bm25Search } from "../lib/bm25";
import { reciprocalRankFusion } from "../lib/rrf";
import { resolvePage } from "../lib/wiki-fs";
import { getDb } from "../db";

export const WikiContextForSchema = z.object({
  file: z.string().min(1).describe("Absolute or relative path to the source file"),
  limit: z.number().int().min(1).max(10).default(5).describe("Maximum number of wiki pages to return (default: 5)"),
});

export type WikiContextForInput = z.infer<typeof WikiContextForSchema>;

export interface WikiContextForSuccess {
  file: string;
  query_terms: string[];
  results: Array<{
    page: string;
    excerpt: string;
    score: number;
    path: string;
  }>;
}

export interface WikiContextForError {
  error: string;
  code: string;
}

export type WikiContextForResult = WikiContextForSuccess | WikiContextForError;

export async function wikiContextFor(input: WikiContextForInput): Promise<WikiContextForResult> {
  const { file, limit = 5 } = input;

  if (!fs.existsSync(file)) {
    return { error: `File not found: ${file}`, code: "FILE_NOT_FOUND" };
  }

  const { filename, symbols } = extractSymbols(file);

  // Build query: filename first (highest signal), then extracted symbols
  const queryTerms = [filename, ...symbols];
  const query = queryTerms.join(" ");

  const db = getDb();
  const fetchCount = limit * 3;

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

  const combined = reciprocalRankFusion(semResults, kwResults, 60, limit);

  return {
    file,
    query_terms: queryTerms,
    results: combined.map((r) => ({
      page: r.page,
      excerpt: r.excerpt,
      score: r.score,
      path: r.path || resolvePage(r.page),
    })),
  };
}
