"use strict";
/**
 * wiki-get.ts
 *
 * MCP tool: wiki_get
 * Fetches a single wiki page by name.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiGetSchema = void 0;
exports.wikiGet = wikiGet;
const zod_1 = require("zod");
const wiki_fs_1 = require("../lib/wiki-fs");
exports.WikiGetSchema = zod_1.z.object({
    page: zod_1.z.string().min(1).describe("Page name without .md extension, e.g. 'AccessManager'"),
});
/**
 * Handles the wiki_get tool call.
 */
async function wikiGet(input) {
    const { page } = input;
    const wikiPage = (0, wiki_fs_1.readPage)(page);
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
//# sourceMappingURL=wiki-get.js.map