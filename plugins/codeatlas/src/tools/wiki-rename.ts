import { z } from "zod";
import { readPage, renamePage, rewriteLinksInAllPages } from "../lib/wiki-fs";
import { renamePageVectors } from "../lib/vector-store";
import { invalidateIndex } from "../lib/tfidf";
import { getDb } from "../db";

export const WikiRenameSchema = z.object({
  page: z.string().min(1).describe("Current page name without .md extension"),
  new_name: z.string().min(1).describe("New page name without .md extension"),
});

export type WikiRenameInput = z.infer<typeof WikiRenameSchema>;

export interface WikiRenameSuccess {
  success: true;
  old_name: string;
  new_name: string;
  new_path: string;
  links_rewritten: number;
  modified_pages: string[];
}

export interface WikiRenameError {
  error: string;
  code: string;
}

export type WikiRenameResult = WikiRenameSuccess | WikiRenameError;

export async function wikiRename(input: WikiRenameInput): Promise<WikiRenameResult> {
  const { page, new_name } = input;

  if (!readPage(page)) {
    return { error: `Page "${page}" does not exist.`, code: "PAGE_NOT_FOUND" };
  }
  if (readPage(new_name)) {
    return { error: `Page "${new_name}" already exists.`, code: "PAGE_EXISTS" };
  }

  let newPath: string;
  try {
    newPath = renamePage(page, new_name);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to rename page: ${message}`, code: "RENAME_ERROR" };
  }

  // Rewrite [[page]] links across all pages (includes the renamed page itself)
  const modifiedPages = rewriteLinksInAllPages(page, new_name);

  try {
    const db = getDb();
    renamePageVectors(db, page, new_name);
    invalidateIndex();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `File renamed but DB update failed: ${message}`, code: "DB_ERROR" };
  }

  return {
    success: true,
    old_name: page,
    new_name,
    new_path: newPath,
    links_rewritten: modifiedPages.length,
    modified_pages: modifiedPages,
  };
}
