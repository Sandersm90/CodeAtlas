"use strict";
/**
 * wiki-ingest.ts
 *
 * MCP tool: wiki_ingest
 * Processes a raw source file from RAW_ROOT into one or more wiki pages
 * using the Anthropic API (claude-sonnet-4-6).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiIngestSchema = void 0;
exports.wikiIngest = wikiIngest;
const zod_1 = require("zod");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const wiki_fs_1 = require("../lib/wiki-fs");
const wiki_update_1 = require("./wiki-update");
const ingest_1 = require("../prompts/ingest");
exports.WikiIngestSchema = zod_1.z.object({
    file: zod_1.z
        .string()
        .min(1)
        .describe("Filename relative to RAW_ROOT, e.g. 'mqtt-auth-notes.md'"),
    hint: zod_1.z
        .string()
        .optional()
        .describe("Optional hint to Claude about what this file is about"),
});
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
// Maximum number of existing page contents to include in prompt context
const MAX_CONTEXT_PAGES = 5;
/**
 * Handles the wiki_ingest tool call.
 */
async function wikiIngest(input) {
    const { file, hint } = input;
    // Read raw file
    let rawContent;
    try {
        rawContent = (0, wiki_fs_1.readRawFile)(file);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            error: `Failed to read raw file "${file}": ${message}`,
            code: "FILE_NOT_FOUND",
        };
    }
    // Get list of existing wiki pages
    let existingPages;
    try {
        existingPages = await (0, wiki_fs_1.listPages)();
    }
    catch (err) {
        existingPages = [];
    }
    // Load content of a subset of existing pages to provide context
    // Limit to avoid token overflow — take up to MAX_CONTEXT_PAGES pages
    const existingPageContents = {};
    const pagesToLoad = existingPages.slice(0, MAX_CONTEXT_PAGES);
    for (const pageName of pagesToLoad) {
        const page = (0, wiki_fs_1.readPage)(pageName);
        if (page) {
            existingPageContents[pageName] = page.content;
        }
    }
    // Build prompts
    const systemPrompt = (0, ingest_1.buildSystemPrompt)();
    const userPrompt = (0, ingest_1.buildUserPrompt)({
        rawContent,
        hint,
        existingPages,
        existingPageContents,
    });
    // Call Anthropic API
    const client = new sdk_1.default();
    let responseText;
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            error: `Anthropic API call failed: ${message}`,
            code: "LLM_ERROR",
        };
    }
    // Parse the JSON response
    let updates;
    try {
        // Strip any markdown code fences the model may have wrapped around the JSON
        const cleaned = responseText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();
        updates = JSON.parse(cleaned);
        if (!Array.isArray(updates)) {
            throw new Error("Response is not a JSON array");
        }
        // Validate structure of each item
        for (const item of updates) {
            if (typeof item.page !== "string" || typeof item.content !== "string") {
                throw new Error(`Invalid page update format: expected {page: string, content: string}`);
            }
        }
    }
    catch (err) {
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
    const pagesCreated = [];
    const pagesUpdated = [];
    const errors = [];
    for (const update of updates) {
        const wasExisting = existingPages.includes(update.page);
        const result = await (0, wiki_update_1.wikiUpdate)({
            page: update.page,
            content: update.content,
            reason: `Ingested from ${file}`,
        });
        if ("error" in result) {
            errors.push(`Failed to update page "${update.page}": ${result.error}`);
        }
        else {
            if (wasExisting) {
                pagesUpdated.push(update.page);
            }
            else {
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
            ? { warnings: errors }
            : {}),
    };
}
//# sourceMappingURL=wiki-ingest.js.map