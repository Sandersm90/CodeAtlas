/**
 * wiki-update.ts
 *
 * MCP tool: wiki_update
 * Creates or updates a wiki page, re-embeds it in the vector store,
 * and invalidates the BM25 index.
 */

import { z } from "zod";
import { execSync } from "child_process";
import matter from "gray-matter";
import { readPage, writePage, validateFrontmatter, extractWikiLinks, pageExists } from "../lib/wiki-fs";
import { chunkPage } from "../lib/chunker";
import { embedBatch } from "../lib/embedder";
import { upsertPage, ChunkVector, getChunkVectorsForPage } from "../lib/vector-store";
import { invalidateIndex } from "../lib/bm25";
import { getDb } from "../db";

export const WikiUpdateSchema = z.object({
  page: z.string().min(1).describe("Page name without .md extension, e.g. 'AccessManager'"),
  content: z.string().min(1).describe("Full markdown content including YAML frontmatter"),
  reason: z.string().optional().describe("Brief description of why this page was updated"),
  dry_run: z.boolean().optional().describe("If true, validate and diff without writing to disk or re-embedding"),
  git_commit: z.boolean().optional().describe("If true, run git add + git commit after writing the page"),
});

export type WikiUpdateInput = z.infer<typeof WikiUpdateSchema>;

export interface WikiUpdateSuccess {
  success: true;
  chunks_embedded: number;
  chunks_skipped: number;
  path: string;
  git_committed?: boolean;
  missing_links?: string[];
}

export interface WikiUpdateDryRun {
  dry_run: true;
  page: string;
  is_new: boolean;
  old_content: string | null;
  new_content: string;
  line_changes: { added: number; removed: number };
  missing_links?: string[];
}

export interface WikiUpdateError {
  error: string;
  code: string;
}

export type WikiUpdateResult = WikiUpdateSuccess | WikiUpdateDryRun | WikiUpdateError;

function diffLines(oldText: string, newText: string): { added: number; removed: number } {
  const oldLines = new Set(oldText.split("\n"));
  const newLines = new Set(newText.split("\n"));
  let added = 0;
  let removed = 0;
  for (const line of newText.split("\n")) if (!oldLines.has(line)) added++;
  for (const line of oldText.split("\n")) if (!newLines.has(line)) removed++;
  return { added, removed };
}

/**
 * Handles the wiki_update tool call.
 */
export async function wikiUpdate(input: WikiUpdateInput): Promise<WikiUpdateResult> {
  const { page, content, dry_run, git_commit } = input;

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

  const referencedLinks = extractWikiLinks(parsed.content);
  const missingLinks = referencedLinks.filter((link) => !pageExists(link));

  if (dry_run) {
    const existing = readPage(page);
    const oldContent = existing?.content ?? null;
    return {
      dry_run: true,
      page,
      is_new: !existing,
      old_content: oldContent,
      new_content: content,
      line_changes: oldContent ? diffLines(oldContent, content) : { added: content.split("\n").length, removed: 0 },
      ...(missingLinks.length > 0 ? { missing_links: missingLinks } : {}),
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

  // Incremental embedding: reuse existing vectors for unchanged chunks
  const db = getDb();
  const existingVectors = getChunkVectorsForPage(db, page);
  const existingByIdx = new Map(existingVectors.map((v) => [v.chunk_idx, v]));

  const toEmbed: typeof chunks = [];
  const recycled: ChunkVector[] = [];

  for (const chunk of chunks) {
    const existing = existingByIdx.get(chunk.chunk_idx);
    if (existing && existing.content === chunk.content) {
      recycled.push({ chunk_idx: chunk.chunk_idx, content: chunk.content, embedding: existing.embedding });
    } else {
      toEmbed.push(chunk);
    }
  }

  let newEmbeddings: number[][] = [];
  if (toEmbed.length > 0) {
    try {
      newEmbeddings = await embedBatch(toEmbed.map((c) => c.content));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        error: `Failed to generate embeddings via Ollama: ${message}`,
        code: "EMBEDDING_ERROR",
      };
    }
  }

  const freshVectors: ChunkVector[] = toEmbed.map((chunk, i) => ({
    chunk_idx: chunk.chunk_idx,
    content: chunk.content,
    embedding: newEmbeddings[i],
  }));

  const allVectors = [...recycled, ...freshVectors].sort((a, b) => a.chunk_idx - b.chunk_idx);

  // Upsert into vector store
  try {
    upsertPage(db, page, allVectors);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Failed to upsert vectors into database: ${message}`,
      code: "DB_ERROR",
    };
  }

  // Invalidate BM25 index so it's rebuilt on next search
  invalidateIndex();

  // Optional git commit
  let gitCommitted: boolean | undefined;
  if (git_commit) {
    try {
      execSync(`git add "${filePath}"`, { stdio: "pipe" });
      const verb = existingVectors.length === 0 ? "create" : "update";
      execSync(`git commit -m "wiki: ${verb} ${page}"`, { stdio: "pipe" });
      gitCommitted = true;
    } catch {
      gitCommitted = false;
    }
  }

  return {
    success: true,
    chunks_embedded: toEmbed.length,
    chunks_skipped: recycled.length,
    path: filePath,
    ...(gitCommitted !== undefined ? { git_committed: gitCommitted } : {}),
    ...(missingLinks.length > 0 ? { missing_links: missingLinks } : {}),
  };
}
