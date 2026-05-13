"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiDeleteSchema = void 0;
exports.wikiDelete = wikiDelete;
const zod_1 = require("zod");
const wiki_fs_1 = require("../lib/wiki-fs");
const vector_store_1 = require("../lib/vector-store");
const tfidf_1 = require("../lib/tfidf");
const db_1 = require("../db");
exports.WikiDeleteSchema = zod_1.z.object({
    page: zod_1.z.string().min(1).describe("Page name to delete, without .md extension"),
});
async function wikiDelete(input) {
    const { page } = input;
    if (!(0, wiki_fs_1.readPage)(page)) {
        return {
            error: `Page "${page}" does not exist.`,
            code: "PAGE_NOT_FOUND",
        };
    }
    try {
        const db = (0, db_1.getDb)();
        (0, vector_store_1.deletePageVectors)(db, page);
        (0, wiki_fs_1.deletePage)(page);
        (0, tfidf_1.invalidateIndex)();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: `Failed to delete page: ${message}`, code: "DELETE_ERROR" };
    }
    return { success: true, page };
}
//# sourceMappingURL=wiki-delete.js.map