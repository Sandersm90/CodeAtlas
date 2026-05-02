import { z } from "zod";
import { readPage, deletePage } from "../lib/wiki-fs";
import { deletePageVectors } from "../lib/vector-store";
import { invalidateIndex } from "../lib/bm25";
import { getDb } from "../db";

export const WikiDeleteSchema = z.object({
  page: z.string().min(1).describe("Page name to delete, without .md extension"),
});

export type WikiDeleteInput = z.infer<typeof WikiDeleteSchema>;

export interface WikiDeleteSuccess {
  success: true;
  page: string;
}

export interface WikiDeleteError {
  error: string;
  code: string;
}

export type WikiDeleteResult = WikiDeleteSuccess | WikiDeleteError;

export async function wikiDelete(input: WikiDeleteInput): Promise<WikiDeleteResult> {
  const { page } = input;

  if (!readPage(page)) {
    return {
      error: `Page "${page}" does not exist.`,
      code: "PAGE_NOT_FOUND",
    };
  }

  try {
    const db = getDb();
    deletePageVectors(db, page);
    deletePage(page);
    invalidateIndex();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to delete page: ${message}`, code: "DELETE_ERROR" };
  }

  return { success: true, page };
}
