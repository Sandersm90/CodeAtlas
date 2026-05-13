import { z } from "zod";
import { readAllPages } from "../lib/wiki-fs";

export const WikiListSchema = z.object({
  tags: z.array(z.string()).optional().describe("Filter to pages that have ALL specified tags"),
});

export type WikiListInput = z.infer<typeof WikiListSchema>;

export interface WikiListEntry {
  page: string;
  title: string;
  tags: string[];
  updated: string;
  path: string;
}

export interface WikiListSuccess {
  pages: WikiListEntry[];
  total: number;
}

export interface WikiListError {
  error: string;
  code: string;
}

export type WikiListResult = WikiListSuccess | WikiListError;

export async function wikiList(input: WikiListInput): Promise<WikiListResult> {
  const { tags } = input;

  let pages;
  try {
    pages = await readAllPages();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to read wiki pages: ${message}`, code: "READ_ERROR" };
  }

  let entries: WikiListEntry[] = pages.map((p) => ({
    page: p.name,
    title: String(p.frontmatter.title ?? p.name),
    tags: Array.isArray(p.frontmatter.tags) ? (p.frontmatter.tags as string[]) : [],
    updated: String(p.frontmatter.updated ?? ""),
    path: p.path,
  }));

  if (tags && tags.length > 0) {
    const required = tags.map((t) => t.toLowerCase());
    entries = entries.filter((e) =>
      required.every((t) => e.tags.map((x) => x.toLowerCase()).includes(t))
    );
  }

  entries.sort((a, b) => a.page.localeCompare(b.page));

  return { pages: entries, total: entries.length };
}
