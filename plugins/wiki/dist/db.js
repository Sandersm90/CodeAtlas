"use strict";
/**
 * db.ts
 *
 * Singleton database instance.
 * Initialized once at server startup, shared across all tool calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
const vector_store_1 = require("./lib/vector-store");
const config_1 = require("./config");
let db = null;
/**
 * Returns the shared database instance, initializing it if necessary.
 */
function getDb() {
    if (!db) {
        db = (0, vector_store_1.initDb)(config_1.config.dbPath);
    }
    return db;
}
//# sourceMappingURL=db.js.map