"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiIngestSchema = void 0;
exports.wikiIngest = wikiIngest;
const zod_1 = require("zod");
const wiki_fs_1 = require("../lib/wiki-fs");
exports.WikiIngestSchema = zod_1.z.object({
    file: zod_1.z.string().min(1).describe("Filename relative to RAW_ROOT, e.g. 'mqtt-auth-notes.md'"),
    hint: zod_1.z.string().optional().describe("Optional hint about what this file is about"),
});
const MAX_CONTEXT_PAGES = 5;
async function wikiIngest(input) {
    const { file, hint } = input;
    let rawContent;
    try {
        rawContent = (0, wiki_fs_1.readRawFile)(file);
    }
    catch (err) {
        return {
            error: `Failed to read raw file "${file}": ${err instanceof Error ? err.message : String(err)}`,
            code: "FILE_NOT_FOUND",
        };
    }
    let existingPages = [];
    try {
        existingPages = await (0, wiki_fs_1.listPages)();
    }
    catch {
        // non-fatal
    }
    const existingPageContents = {};
    for (const pageName of existingPages.slice(0, MAX_CONTEXT_PAGES)) {
        const page = (0, wiki_fs_1.readPage)(pageName);
        if (page)
            existingPageContents[pageName] = page.content;
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
//# sourceMappingURL=wiki-ingest.js.map