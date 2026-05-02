/**
 * wiki-ingest.ts
 *
 * MCP tool: wiki_ingest
 * Processes a raw source file from RAW_ROOT into one or more wiki pages
 * using the Anthropic API (claude-sonnet-4-6).
 */

import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { readRawFile, listPages, readPage } from "../lib/wiki-fs";
import { wikiUpdate } from "./wiki-update";
import { buildSystemPrompt, buildUserPrompt } from "../prompts/ingest";

export const WikiIngestSchema = z.object({
  file: z
    .string()
    .min(1)
    .describe("Filename relative to RAW_ROOT, e.g. 'mqtt-auth-notes.md'"),
  hint: z
    .string()
    .optional()
    .describe("Optional hint to Claude about what this file is about"),
});

export type WikiIngestInput = z.infer<typeof WikiIngestSchema>;

interface PageUpdate {
  page: string;
  content: string;
}

export interface WikiIngestSuccess {
  pages_updated: string[];
  pages_created: string[];
}

export interface WikiIngestError {
  error: string;
  code: string;
}

export type WikiIngestResult = WikiIngestSuccess | WikiIngestError;

const ANTHROPIC_MODEL = "claude-sonnet-4-6";

// Maximum number of existing page contents to include in prompt context
const MAX_CONTEXT_PAGES = 5;

/**
 * Handles the wiki_ingest tool call.
 */
export async function wikiIngest(input: WikiIngestInput): Promise<WikiIngestResult> {
  const { file, hint } = input;

  // Read raw file
  let rawContent: string;
  try {
    rawContent = readRawFile(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Failed to read raw file "${file}": ${message}`,
      code: "FILE_NOT_FOUND",
    };
  }

  // Get list of existing wiki pages
  let existingPages: string[];
  try {
    existingPages = await listPages();
  } catch (err) {
    existingPages = [];
  }

  // Load content of a subset of existing pages to provide context
  // Limit to avoid token overflow — take up to MAX_CONTEXT_PAGES pages
  const existingPageContents: Record<string, string> = {};
  const pagesToLoad = existingPages.slice(0, MAX_CONTEXT_PAGES);
  for (const pageName of pagesToLoad) {
    const page = readPage(pageName);
    if (page) {
      existingPageContents[pageName] = page.content;
    }
  }

  // Build prompts
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    rawContent,
    hint,
    existingPages,
    existingPageContents,
  });

  // Call Anthropic API
  const client = new Anthropic();
  let responseText: string;

  try {
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 8096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const firstBlock = message.content[0];
    if (!firstBlock || firstBlock.type !== "text") {
      return {
        error: "Anthropic API returned unexpected response format",
        code: "LLM_RESPONSE_ERROR",
      };
    }

    responseText = firstBlock.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Anthropic API call failed: ${message}`,
      code: "LLM_ERROR",
    };
  }

  // Parse the JSON response
  let updates: PageUpdate[];
  try {
    // Strip any markdown code fences the model may have wrapped around the JSON
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    updates = JSON.parse(cleaned) as PageUpdate[];

    if (!Array.isArray(updates)) {
      throw new Error("Response is not a JSON array");
    }

    // Validate structure of each item
    for (const item of updates) {
      if (typeof item.page !== "string" || typeof item.content !== "string") {
        throw new Error(
          `Invalid page update format: expected {page: string, content: string}`
        );
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Failed to parse LLM response as JSON: ${message}\n\nRaw response:\n${responseText.slice(0, 500)}`,
      code: "LLM_PARSE_ERROR",
    };
  }

  if (updates.length === 0) {
    return {
      pages_updated: [],
      pages_created: [],
    };
  }

  // Apply each update via wiki_update
  const pagesCreated: string[] = [];
  const pagesUpdated: string[] = [];
  const errors: string[] = [];

  for (const update of updates) {
    const wasExisting = existingPages.includes(update.page);

    const result = await wikiUpdate({
      page: update.page,
      content: update.content,
      reason: `Ingested from ${file}`,
    });

    if ("error" in result) {
      errors.push(`Failed to update page "${update.page}": ${result.error}`);
    } else {
      if (wasExisting) {
        pagesUpdated.push(update.page);
      } else {
        pagesCreated.push(update.page);
      }
    }
  }

  if (errors.length > 0 && pagesCreated.length === 0 && pagesUpdated.length === 0) {
    return {
      error: `Ingest failed for all pages:\n${errors.join("\n")}`,
      code: "ALL_UPDATES_FAILED",
    };
  }

  // Partial success is still a success — return results with any errors noted
  return {
    pages_updated: pagesUpdated,
    pages_created: pagesCreated,
    ...(errors.length > 0
      ? ({ warnings: errors } as unknown as Record<string, unknown>)
      : {}),
  } as WikiIngestSuccess;
}
