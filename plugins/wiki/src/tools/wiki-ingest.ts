import { z } from "zod";
import { readRawFile, listPages, readPage } from "../lib/wiki-fs";

export const WikiIngestSchema = z.object({
  file: z.string().min(1).describe("Filename relative to RAW_ROOT, e.g. 'mqtt-auth-notes.md'"),
  hint: z.string().optional().describe("Optional hint about what this file is about"),
});

export type WikiIngestInput = z.infer<typeof WikiIngestSchema>;

export interface WikiIngestPayload {
  file: string;
  raw_content: string;
  existing_pages: string[];
  existing_page_contents: Record<string, string>;
  instructions: string;
}

export interface WikiIngestError {
  error: string;
  code: string;
}

export type WikiIngestResult = WikiIngestPayload | WikiIngestError;

const MAX_CONTEXT_PAGES = 5;

export async function wikiIngest(input: WikiIngestInput): Promise<WikiIngestResult> {
  const { file, hint } = input;

  let rawContent: string;
  try {
    rawContent = readRawFile(file);
  } catch (err) {
    return {
      error: `Failed to read raw file "${file}": ${err instanceof Error ? err.message : String(err)}`,
      code: "FILE_NOT_FOUND",
    };
  }

  let existingPages: string[] = [];
  try {
    existingPages = await listPages();
  } catch {
    // non-fatal
  }

  const existingPageContents: Record<string, string> = {};
  for (const pageName of existingPages.slice(0, MAX_CONTEXT_PAGES)) {
    const page = readPage(pageName);
    if (page) existingPageContents[pageName] = page.content;
  }

  const today = new Date().toISOString().split("T")[0];

  const instructions = `Analyze the raw_content and create or update wiki pages using the wiki_update tool.

Rules:
- Today's date: ${today}${hint ? `\n- Hint: ${hint}` : ""}
- Use [[WikiLinks]] for ALL cross-references between pages
- NEVER duplicate content from existing_page_contents — only ADD new information
- If a concept already has a page, UPDATE it rather than create a duplicate
- Frontmatter must include: title, tags, related, updated (${today})
- Tags: lowercase, hyphen-separated
- Writing style: concise and factual, no fluff
- Only create pages for concepts with REAL content to add
- Call wiki_update once per page — do NOT call wiki_ingest again`;

  return {
    file,
    raw_content: rawContent,
    existing_pages: existingPages,
    existing_page_contents: existingPageContents,
    instructions,
  };
}
