/**
 * db.ts
 *
 * Singleton database instance.
 * Call initializeDb() once at startup (async — queries Ollama for dim if needed).
 * All tool calls use getDb() which is synchronous after initialization.
 */

import { initDb, getStoredDimension, DB } from "./lib/vector-store";
import { getEmbeddingDimension } from "./lib/embedder";
import { config } from "./config";

let db: DB | null = null;

/**
 * Async init: reads stored embedding dim or detects it from Ollama.
 * Must be awaited before getDb() is called.
 */
export async function initializeDb(): Promise<DB> {
  if (db) return db;

  const storedDim = getStoredDimension(config.dbPath);
  const dim = storedDim ?? await getEmbeddingDimension();

  db = initDb(config.dbPath, dim);

  console.error(
    `[wiki-mcp] DB initialized. embedding_dim=${dim}${storedDim === null ? " (detected from model)" : " (from DB)"}`
  );

  return db;
}

/**
 * Returns the shared database instance. Throws if initializeDb() was not called.
 */
export function getDb(): DB {
  if (!db) throw new Error("[wiki-mcp] DB not initialized — call initializeDb() first");
  return db;
}
