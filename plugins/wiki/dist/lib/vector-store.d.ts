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
 * Initializes the SQLite database and creates tables/virtual tables if needed.
 */
export declare function initDb(dbPath: string): DB;
/**
 * Upserts all chunk vectors for a page.
 * Deletes existing chunks for the page first (full replacement).
 */
export declare function upsertPage(db: DB, page: string, chunks: ChunkVector[]): void;
/**
 * Performs cosine similarity search using sqlite-vec.
 * Returns top k results sorted by similarity (descending).
 */
export declare function searchSimilar(db: DB, queryVec: number[], k: number): SearchResult[];
/**
 * Gets the most recent embedding timestamp for a page.
 * Returns null if the page has no embeddings.
 */
export declare function getPageEmbedTime(db: DB, page: string): Date | null;
//# sourceMappingURL=vector-store.d.ts.map