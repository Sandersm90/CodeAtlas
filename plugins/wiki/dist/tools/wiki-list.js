"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiListSchema = void 0;
exports.wikiList = wikiList;
const zod_1 = require("zod");
const wiki_fs_1 = require("../lib/wiki-fs");
exports.WikiListSchema = zod_1.z.object({
    tags: zod_1.z.array(zod_1.z.string()).optional().describe("Filter to pages that have ALL specified tags"),
});
async function wikiList(input) {
    const { tags } = input;
    let pages;
    try {
        pages = await (0, wiki_fs_1.readAllPages)();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: `Failed to read wiki pages: ${message}`, code: "READ_ERROR" };
    }
    let entries = pages.map((p) => ({
        page: p.name,
        title: String(p.frontmatter.title ?? p.name),
        tags: Array.isArray(p.frontmatter.tags) ? p.frontmatter.tags : [],
        updated: String(p.frontmatter.updated ?? ""),
        path: p.path,
    }));
    if (tags && tags.length > 0) {
        const required = tags.map((t) => t.toLowerCase());
        entries = entries.filter((e) => required.every((t) => e.tags.map((x) => x.toLowerCase()).includes(t)));
    }
    entries.sort((a, b) => a.page.localeCompare(b.page));
    return { pages: entries, total: entries.length };
}
//# sourceMappingURL=wiki-list.js.map