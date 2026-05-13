"use strict";
/**
 * db.ts
 *
 * Singleton database instance.
 * Call initializeDb() once at startup (async — queries Ollama for dim if needed).
 * All tool calls use getDb() which is synchronous after initialization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDb = initializeDb;
exports.getDb = getDb;
const vector_store_1 = require("./lib/vector-store");
const embedder_1 = require("./lib/embedder");
const config_1 = require("./config");
let db = null;
/**
 * Async init: reads stored embedding dim or detects it from Ollama.
 * Must be awaited before getDb() is called.
 */
async function initializeDb() {
    if (db)
        return db;
    const storedDim = (0, vector_store_1.getStoredDimension)(config_1.config.dbPath);
    const dim = storedDim ?? await (0, embedder_1.getEmbeddingDimension)();
    db = (0, vector_store_1.initDb)(config_1.config.dbPath, dim);
    console.error(`[wiki-mcp] DB initialized. embedding_dim=${dim}${storedDim === null ? " (detected from model)" : " (from DB)"}`);
    return db;
}
/**
 * Returns the shared database instance. Throws if initializeDb() was not called.
 */
function getDb() {
    if (!db)
        throw new Error("[wiki-mcp] DB not initialized — call initializeDb() first");
    return db;
}
//# sourceMappingURL=db.js.map