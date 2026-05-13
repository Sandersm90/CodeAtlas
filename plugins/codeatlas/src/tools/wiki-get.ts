/**
 * wiki-get.ts
 *
 * MCP tool: wiki_get
 * Fetches a single wiki page by name.
 */

import { z } from "zod";
import { readPage } from "../lib/wiki-fs";

export const WikiGetSchema = z.object({
  page: z.string().min(1).describe("Page name without .md extension, e.g. 'AccessManager'"),
});

export type WikiGetInput = z.infer<typeof WikiGetSchema>;

export interface WikiGetSuccess {
  content: string;
  path: string;
}

export interface WikiGetError {
  error: string;
  code: string;
}

export type WikiGetResult = WikiGetSuccess | WikiGetError;

/**
 * Handles the wiki_get tool call.
 */
export async function wikiGet(input: WikiGetInput): Promise<WikiGetResult> {
  const { page } = input;

  const wikiPage = readPage(page);

  if (!wikiPage) {
    return {
      error: `Wiki page "${page}" does not exist. Use wiki_search to find similar pages or wiki_update to create it.`,
      code: "PAGE_NOT_FOUND",
    };
  }

  return {
    content: wikiPage.content,
    path: wikiPage.path,
  };
}
