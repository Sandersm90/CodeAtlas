/**
 * db.ts
 *
 * Singleton database instance.
 * Initialized once at server startup, shared across all tool calls.
 */

import { initDb, DB } from "./lib/vector-store";
import { config } from "./config";

let db: DB | null = null;

/**
 * Returns the shared database instance, initializing it if necessary.
 */
export function getDb(): DB {
  if (!db) {
    db = initDb(config.dbPath);
  }
  return db;
}
