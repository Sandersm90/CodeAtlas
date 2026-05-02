/**
 * wiki-update.ts
 *
 * MCP tool: wiki_update
 * Creates or updates a wiki page, re-embeds it in the vector store,
 * and invalidates the BM25 index.
 */

import { z } from "zod";
import matter from "gray-matter";
import { writePage, validateFrontmatter } from "../lib/wiki-fs";
import { chunkPage } from "../lib/chunker";
import { embedBatch } from "../lib/embedder";
import { upsertPage, ChunkVector } from "../lib/vector-store";
import { invalidateIndex } from "../lib/bm25";
import { getDb } from "../db";

export const WikiUpdateSchema = z.object({
  page: z.string().min(1).describe("Page name without .md extension, e.g. 'AccessManager'"),
  content: z.string().min(1).describe("Full markdown content including YAML frontmatter"),
  reason: z.string().optional().describe("Brief description of why this page was updated"),
});

export type WikiUpdateInput = z.infer<typeof WikiUpdateSchema>;

export interface WikiUpdateSuccess {
  success: true;
  chunks_embedded: number;
  path: string;
}

export interface WikiUpdateError {
  error: string;
  code: string;
}

export type WikiUpdateResult = WikiUpdateSuccess | WikiUpdateError;

/**
 * Handles the wiki_update tool call.
 */
export async function wikiUpdate(input: WikiUpdateInput): Promise<WikiUpdateResult> {
  const { page, content } = input;

  // Parse and validate frontmatter
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Failed to parse frontmatter: ${message}`,
      code: "INVALID_FRONTMATTER",
    };
  }

  const missing = validateFrontmatter(parsed.data);
  if (missing.length > 0) {
    return {
      error: `Page frontmatter is missing required fields: ${missing.join(", ")}. All wiki pages must have "title", "tags", and "updated" fields.`,
      code: "MISSING_FRONTMATTER_FIELDS",
    };
  }

  // Write page to disk
  let filePath: string;
  try {
    filePath = writePage(page, content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Failed to write page to disk: ${message}`,
      code: "WRITE_ERROR",
    };
  }

  // Chunk the page body for embedding
  const chunks = chunkPage(page, parsed.content);

  // Generate embeddings for all chunks
  let embeddings: number[][];
  try {
    const texts = chunks.map((c) => c.content);
    embeddings = await embedBatch(texts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Failed to generate embeddings via Ollama: ${message}`,
      code: "EMBEDDING_ERROR",
    };
  }

  // Build ChunkVector array
  const chunkVectors: ChunkVector[] = chunks.map((chunk, i) => ({
    chunk_idx: chunk.chunk_idx,
    content: chunk.content,
    embedding: embeddings[i],
  }));

  // Upsert into vector store
  try {
    const db = getDb();
    upsertPage(db, page, chunkVectors);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Failed to upsert vectors into database: ${message}`,
      code: "DB_ERROR",
    };
  }

  // Invalidate BM25 index so it's rebuilt on next search
  invalidateIndex();

  return {
    success: true,
    chunks_embedded: chunks.length,
    path: filePath,
  };
}
