/**
 * tfidf.ts
 *
 * TF-IDF keyword search over all wiki pages using the `natural` library.
 *
 * - Index is built lazily on first search call.
 * - Index is invalidated (and rebuilt on next call) after wiki_update or wiki_ingest.
 */

import * as natural from "natural";
import { readAllPages, WikiPage } from "./wiki-fs";

export interface TfIdfResult {
  page: string;
  excerpt: string;
  score: number;
  path: string;
}

interface IndexEntry {
  page: string;
  path: string;
  content: string;
  tags: string[];
}

let tfidf: natural.TfIdf | null = null;
let indexEntries: IndexEntry[] = [];
let indexDirty = true;

/**
 * Marks the index as dirty so it will be rebuilt on the next search.
 */
export function invalidateIndex(): void {
  indexDirty = true;
  tfidf = null;
  indexEntries = [];
}

/**
 * Builds the TF-IDF index from all wiki pages.
 */
async function buildIndex(): Promise<void> {
  const pages: WikiPage[] = await readAllPages();

  tfidf = new natural.TfIdf();
  indexEntries = [];

  for (const page of pages) {
    const rawTags = page.frontmatter["tags"];
    const tags: string[] = Array.isArray(rawTags)
      ? (rawTags as string[]).map((t) => String(t).toLowerCase())
      : [];

    const entry: IndexEntry = {
      page: page.name,
      path: page.path,
      content: page.body,
      tags,
    };
    indexEntries.push(entry);
    tfidf.addDocument(page.body);
  }

  indexDirty = false;
}

/**
 * Returns tags for a page from the in-memory index.
 * Builds the index first if needed.
 */
export async function getPageTags(page: string): Promise<string[]> {
  if (indexDirty || tfidf === null) {
    await buildIndex();
  }
  return indexEntries.find((e) => e.page === page)?.tags ?? [];
}

/**
 * Extracts a relevant excerpt from page content for a given query.
 * Returns the first 300 characters of the most relevant passage.
 */
function extractExcerpt(content: string, query: string): string {
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
 * Searches wiki pages using TF-IDF.
 * Returns top k results sorted by relevance score (descending).
 */
export async function search(query: string, k: number): Promise<TfIdfResult[]> {
  if (indexDirty || tfidf === null) {
    await buildIndex();
  }

  if (!tfidf || indexEntries.length === 0) {
    return [];
  }

  // Collect scores for all documents
  const scores: Array<{ idx: number; score: number }> = [];

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
