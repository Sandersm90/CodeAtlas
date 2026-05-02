"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiRenameSchema = void 0;
exports.wikiRename = wikiRename;
const zod_1 = require("zod");
const wiki_fs_1 = require("../lib/wiki-fs");
const vector_store_1 = require("../lib/vector-store");
const bm25_1 = require("../lib/bm25");
const db_1 = require("../db");
exports.WikiRenameSchema = zod_1.z.object({
    page: zod_1.z.string().min(1).describe("Current page name without .md extension"),
    new_name: zod_1.z.string().min(1).describe("New page name without .md extension"),
});
async function wikiRename(input) {
    const { page, new_name } = input;
    if (!(0, wiki_fs_1.readPage)(page)) {
        return { error: `Page "${page}" does not exist.`, code: "PAGE_NOT_FOUND" };
    }
    if ((0, wiki_fs_1.readPage)(new_name)) {
        return { error: `Page "${new_name}" already exists.`, code: "PAGE_EXISTS" };
    }
    let newPath;
    try {
        newPath = (0, wiki_fs_1.renamePage)(page, new_name);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: `Failed to rename page: ${message}`, code: "RENAME_ERROR" };
    }
    // Rewrite [[page]] links across all pages (includes the renamed page itself)
    const modifiedPages = (0, wiki_fs_1.rewriteLinksInAllPages)(page, new_name);
    try {
        const db = (0, db_1.getDb)();
        (0, vector_store_1.renamePageVectors)(db, page, new_name);
        (0, bm25_1.invalidateIndex)();
    }
    catch (err) {
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
//# sourceMappingURL=wiki-rename.js.map