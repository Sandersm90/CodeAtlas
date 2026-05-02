/**
 * vector-store.ts
 *
 * Wraps better-sqlite3 + sqlite-vec for vector storage and similarity search.
 *
 * Schema:
 *   wiki_chunks(id, page, chunk_idx, content, embedded_at)
 *   wiki_vectors USING vec0(embedding FLOAT[768])
 *
 * wiki_chunks.rowid maps 1:1 to wiki_vectors.rowid.
 */

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

export type DB = Database.Database;

export interface ChunkVector {
  chunk_idx: number;
  content: string;
  embedding: number[];
}

export interface SearchResult {
  page: string;
  excerpt: string;
  score: number;
  chunkIdx: number;
  rowid: number;
}

/**
 * Serializes a float[] to a little-endian Float32 Buffer for sqlite-vec.
 */
function serializeVector(vec: number[]): Buffer {
  const buffer = Buffer.allocUnsafe(vec.length * 4);
  for (let i = 0; i < vec.length; i++) {
    buffer.writeFloatLE(vec[i], i * 4);
  }
  return buffer;
}

/**
 * Initializes the SQLite database and creates tables/virtual tables if needed.
 */
export function initDb(dbPath: string): DB {
  const db = new Database(dbPath);

  // Load sqlite-vec extension
  sqliteVec.load(db);

  // Enable WAL for better concurrent read performance
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

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

  // Create sqlite-vec virtual table for embeddings
  // FLOAT[768] matches nomic-embed-text output dimension
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS wiki_vectors USING vec0(
      embedding FLOAT[768]
    );
  `);

  return db;
}

/**
 * Upserts all chunk vectors for a page.
 * Deletes existing chunks for the page first (full replacement).
 */
export function upsertPage(
  db: DB,
  page: string,
  chunks: ChunkVector[]
): void {
  const now = new Date().toISOString();

  const upsert = db.transaction(() => {
    // Delete existing chunks and their vectors
    const existingIds = db
      .prepare("SELECT id FROM wiki_chunks WHERE page = ?")
      .all(page) as { id: number }[];

    if (existingIds.length > 0) {
      const ids = existingIds.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(", ");

      db.prepare(`DELETE FROM wiki_vectors WHERE rowid IN (${placeholders})`).run(
        ...ids
      );
      db.prepare(`DELETE FROM wiki_chunks WHERE page = ?`).run(page);
    }

    // Insert new chunks
    const insertChunk = db.prepare(
      `INSERT INTO wiki_chunks (page, chunk_idx, content, embedded_at)
       VALUES (?, ?, ?, ?)`
    );
    const insertVector = db.prepare(
      `INSERT INTO wiki_vectors (rowid, embedding) VALUES (?, ?)`
    );

    for (const chunk of chunks) {
      const result = insertChunk.run(
        page,
        chunk.chunk_idx,
        chunk.content,
        now
      );
      const rowid = Number(result.lastInsertRowid);
      insertVector.run(rowid, serializeVector(chunk.embedding));
    }
  });

  upsert();
}

/**
 * Performs cosine similarity search using sqlite-vec.
 * Returns top k results sorted by similarity (descending).
 */
export function searchSimilar(
  db: DB,
  queryVec: number[],
  k: number
): SearchResult[] {
  const queryBuffer = serializeVector(queryVec);

  const rows = db
    .prepare(
      `SELECT
         wc.page,
         wc.content,
         wc.chunk_idx,
         wv.rowid,
         wv.distance
       FROM wiki_vectors wv
       JOIN wiki_chunks wc ON wc.id = wv.rowid
       WHERE wv.embedding MATCH ?
         AND k = ?
       ORDER BY wv.distance ASC`
    )
    .all(queryBuffer, k) as Array<{
    page: string;
    content: string;
    chunk_idx: number;
    rowid: number;
    distance: number;
  }>;

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
export function getPageEmbedTime(db: DB, page: string): Date | null {
  const row = db
    .prepare(
      `SELECT embedded_at FROM wiki_chunks WHERE page = ?
       ORDER BY embedded_at DESC LIMIT 1`
    )
    .get(page) as { embedded_at: string } | undefined;

  if (!row) return null;
  return new Date(row.embedded_at);
}
