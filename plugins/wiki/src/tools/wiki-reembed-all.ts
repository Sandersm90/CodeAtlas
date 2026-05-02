import { z } from "zod";
import { readAllPages } from "../lib/wiki-fs";
import { chunkPage } from "../lib/chunker";
import { embedBatch } from "../lib/embedder";
import { upsertPage, ChunkVector, getPageEmbedTime } from "../lib/vector-store";
import { invalidateIndex } from "../lib/bm25";
import { getDb } from "../db";

export const WikiReembedAllSchema = z.object({
  stale_only: z
    .boolean()
    .optional()
    .describe(
      "If true (default), only re-embed pages where 'updated' date is newer than last embed. If false, re-embed all pages."
    ),
});

export type WikiReembedAllInput = z.infer<typeof WikiReembedAllSchema>;

export interface WikiReembedAllResult {
  reembedded: string[];
  skipped: string[];
  errors: Array<{ page: string; error: string }>;
  total: number;
}

export interface WikiReembedAllError {
  error: string;
  code: string;
}

export type WikiReembedAllOutput = WikiReembedAllResult | WikiReembedAllError;

export async function wikiReembedAll(input: WikiReembedAllInput): Promise<WikiReembedAllOutput> {
  const staleOnly = input.stale_only !== false; // default true

  let pages;
  try {
    pages = await readAllPages();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to read wiki pages: ${message}`, code: "READ_ERROR" };
  }

  const db = getDb();
  const reembedded: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ page: string; error: string }> = [];

  for (const page of pages) {
    const fm = page.frontmatter;

    if (staleOnly) {
      const embedTime = getPageEmbedTime(db, page.name);
      const isStale = fm["updated"] && typeof fm["updated"] === "string"
        ? !embedTime || new Date(fm["updated"] as string) > embedTime
        : !embedTime;

      if (!isStale) {
        skipped.push(page.name);
        continue;
      }
    }

    try {
      const chunks = chunkPage(page.name, page.body);
      const embeddings = await embedBatch(chunks.map((c) => c.content));
      const chunkVectors: ChunkVector[] = chunks.map((chunk, i) => ({
        chunk_idx: chunk.chunk_idx,
        content: chunk.content,
        embedding: embeddings[i],
      }));
      upsertPage(db, page.name, chunkVectors);
      reembedded.push(page.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ page: page.name, error: message });
    }
  }

  if (reembedded.length > 0) {
    invalidateIndex();
  }

  return {
    reembedded,
    skipped,
    errors,
    total: pages.length,
  };
}
