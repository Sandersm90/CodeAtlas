/**
 * ingest.ts
 *
 * Prompt template for the wiki_ingest pipeline.
 * Instructs the LLM to extract structured wiki updates from raw source files.
 */

export interface IngestPromptParams {
  rawContent: string;
  hint?: string;
  existingPages: string[];
  existingPageContents: Record<string, string>;
}

/**
 * Builds the system prompt for wiki ingest.
 */
export function buildSystemPrompt(): string {
  return `You are a knowledge base curator for a software project wiki.
Your job is to read raw source material (notes, specs, changelogs, meeting notes, etc.)
and extract structured information into wiki pages.

Wiki pages follow this format:
\`\`\`markdown
---
title: "PageName"
tags: [tag1, tag2]
related: ["RelatedPage1", "RelatedPage2"]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# PageName

One-paragraph summary of this concept.

## Overview
...

## Key Decisions
...

## Related
- [[RelatedPage1]]
- [[RelatedPage2]]
\`\`\`

Rules:
1. Use [[WikiLinks]] for ALL cross-references to other wiki pages.
2. NEVER duplicate content that already exists in a page — only ADD new information.
3. If a concept already has a page, UPDATE it. Do not create a duplicate.
4. Use concise, factual writing. No fluff. Engineers will read this.
5. The "updated" date should be today's date in YYYY-MM-DD format.
6. "tags" should be lowercase, hyphen-separated keywords.
7. "related" should list page names (without .md) that are genuinely related.
8. Only create or update pages for concepts that have REAL content to add.
9. Do not create pages for trivial or transient information.

Your response MUST be a JSON array (no other text) in this exact format:
[
  {
    "page": "PageName",
    "content": "---\\ntitle: \\"PageName\\"\\n...full markdown content..."
  }
]

If there is nothing meaningful to add to the wiki, return an empty array: []`;
}

/**
 * Builds the user prompt for wiki ingest.
 */
export function buildUserPrompt(params: IngestPromptParams): string {
  const { rawContent, hint, existingPages, existingPageContents } = params;

  const today = new Date().toISOString().split("T")[0];

  let prompt = `Today's date: ${today}\n\n`;

  if (hint) {
    prompt += `Hint about this file: ${hint}\n\n`;
  }

  if (existingPages.length > 0) {
    prompt += `Existing wiki pages (do not duplicate these):\n`;
    prompt += existingPages.map((p) => `  - ${p}`).join("\n");
    prompt += "\n\n";
  }

  if (Object.keys(existingPageContents).length > 0) {
    prompt += `Current content of potentially relevant pages:\n\n`;
    for (const [page, content] of Object.entries(existingPageContents)) {
      prompt += `=== ${page} ===\n${content}\n\n`;
    }
  }

  prompt += `Raw source file to process:\n\n${rawContent}\n\n`;
  prompt += `Return a JSON array of wiki page updates. Only include pages with genuinely new information.`;

  return prompt;
}
