"use strict";
/**
 * vector-store.ts
 *
 * Wraps better-sqlite3 + sqlite-vec for vector storage and similarity search.
 *
 * Schema:
 *   wiki_meta(key, value)            — server metadata (embedding_dim, etc.)
 *   wiki_chunks(id, page, chunk_idx, content, embedded_at)
 *   wiki_vectors USING vec0(embedding FLOAT[N])  — N detected from Ollama
 *
 * wiki_chunks.rowid maps 1:1 to wiki_vectors.rowid.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStoredDimension = getStoredDimension;
exports.initDb = initDb;
exports.deletePageVectors = deletePageVectors;
exports.renamePageVectors = renamePageVectors;
exports.upsertPage = upsertPage;
exports.searchSimilar = searchSimilar;
exports.getPageEmbedTime = getPageEmbedTime;
const fs_1 = require("fs");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const sqliteVec = __importStar(require("sqlite-vec"));
/**
 * Serializes a float[] to a little-endian Float32 Buffer for sqlite-vec.
 */
function serializeVector(vec) {
    const buffer = Buffer.allocUnsafe(vec.length * 4);
    for (let i = 0; i < vec.length; i++) {
        buffer.writeFloatLE(vec[i], i * 4);
    }
    return buffer;
}
/**
 * Reads the stored embedding dimension from an existing DB.
 * Returns null if the DB doesn't exist or has no stored dimension
 * (e.g. pre-1.1 DBs without wiki_meta).
 */
function getStoredDimension(dbPath) {
    if (!(0, fs_1.existsSync)(dbPath))
        return null;
    let db = null;
    try {
        db = new better_sqlite3_1.default(dbPath, { readonly: true });
        const tableExists = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='wiki_meta'")
            .get();
        if (!tableExists)
            return null;
        const row = db
            .prepare("SELECT value FROM wiki_meta WHERE key = 'embedding_dim'")
            .get();
        return row ? parseInt(row.value, 10) : null;
    }
    catch {
        return null;
    }
    finally {
        db?.close();
    }
}
/**
 * Initializes the SQLite database and creates tables/virtual tables if needed.
 * embeddingDim is detected at startup from Ollama — not hardcoded.
 */
function initDb(dbPath, embeddingDim) {
    const db = new better_sqlite3_1.default(dbPath);
    // Load sqlite-vec extension
    sqliteVec.load(db);
    // Enable WAL for better concurrent read performance
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    // Metadata table — stores embedding_dim and other server-side config
    db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
    // Store dimension on first creation; no-op on subsequent starts
    db.prepare("INSERT OR IGNORE INTO wiki_meta (key, value) VALUES ('embedding_dim', ?)")
        .run(String(embeddingDim));
    // Create wiki_chunks table
    db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_chunks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      page        TEXT NOT NULL,
      chunk_idx   INTEGER NOT NULL,
      content     TEXT NOT NULL,
      embedded_at TEXT NOT NULL
    );
  `);
    // Create sqlite-vec virtual table — dimension comes from Ollama model info
    db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS wiki_vectors USING vec0(
      embedding FLOAT[${embeddingDim}]
    );
  `);
    return db;
}
/**
 * Deletes all chunks and vectors for a page.
 */
function deletePageVectors(db, page) {
    const existingIds = db
        .prepare("SELECT id FROM wiki_chunks WHERE page = ?")
        .all(page);
    if (existingIds.length > 0) {
        const ids = existingIds.map((r) => BigInt(r.id));
        const placeholders = ids.map(() => "?").join(", ");
        db.prepare(`DELETE FROM wiki_vectors WHERE rowid IN (${placeholders})`).run(...ids);
        db.prepare("DELETE FROM wiki_chunks WHERE page = ?").run(page);
    }
}
/**
 * Renames a page in the chunks table (vectors stay valid — content unchanged).
 */
function renamePageVectors(db, oldPage, newPage) {
    db.prepare("UPDATE wiki_chunks SET page = ? WHERE page = ?").run(newPage, oldPage);
}
/**
 * Upserts all chunk vectors for a page.
 * Deletes existing chunks for the page first (full replacement).
 */
function upsertPage(db, page, chunks) {
    const now = new Date().toISOString();
    const upsert = db.transaction(() => {
        // Delete existing chunks and their vectors
        const existingIds = db
            .prepare("SELECT id FROM wiki_chunks WHERE page = ?")
            .all(page);
        if (existingIds.length > 0) {
            const ids = existingIds.map((r) => BigInt(r.id));
            const placeholders = ids.map(() => "?").join(", ");
            db.prepare(`DELETE FROM wiki_vectors WHERE rowid IN (${placeholders})`).run(...ids);
            db.prepare(`DELETE FROM wiki_chunks WHERE page = ?`).run(page);
        }
        // Insert new chunks
        const insertChunk = db.prepare(`INSERT INTO wiki_chunks (page, chunk_idx, content, embedded_at)
       VALUES (?, ?, ?, ?)`);
        const insertVector = db.prepare(`INSERT INTO wiki_vectors (rowid, embedding) VALUES (?, ?)`);
        for (const chunk of chunks) {
            const result = insertChunk.run(page, chunk.chunk_idx, chunk.content, now);
            const rowid = BigInt(result.lastInsertRowid);
            insertVector.run(rowid, serializeVector(chunk.embedding));
        }
    });
    upsert();
}
/**
 * Performs cosine similarity search using sqlite-vec.
 * Returns top k results sorted by similarity (descending).
 */
function searchSimilar(db, queryVec, k) {
    const queryBuffer = serializeVector(queryVec);
    const rows = db
        .prepare(`SELECT
         wc.page,
         wc.content,
         wc.chunk_idx,
         wv.rowid,
         wv.distance
       FROM wiki_vectors wv
       JOIN wiki_chunks wc ON wc.id = wv.rowid
       WHERE wv.embedding MATCH ?
         AND k = ?
       ORDER BY wv.distance ASC`)
        .all(queryBuffer, k);
    return rows.map((row) => ({
        page: row.page,
        excerpt: row.content,
        score: 1 / (1 + row.distance), // convert distance to similarity score
        chunkIdx: row.chunk_idx,
        rowid: row.rowid,
    }));
}
/**
 * Gets the most recent embedding timestamp for a page.
 * Returns null if the page has no embeddings.
 */
function getPageEmbedTime(db, page) {
    const row = db
        .prepare(`SELECT embedded_at FROM wiki_chunks WHERE page = ?
       ORDER BY embedded_at DESC LIMIT 1`)
        .get(page);
    if (!row)
        return null;
    return new Date(row.embedded_at);
}
//# sourceMappingURL=vector-store.js.map