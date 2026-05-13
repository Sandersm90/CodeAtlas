/**
 * db.ts
 *
 * Singleton database instance.
 * Call initializeDb() once at startup (async — queries Ollama for dim if needed).
 * All tool calls use getDb() which is synchronous after initialization.
 */
import { DB } from "./lib/vector-store";
/**
 * Async init: reads stored embedding dim or detects it from Ollama.
 * Must be awaited before getDb() is called.
 */
export declare function initializeDb(): Promise<DB>;
/**
 * Returns the shared database instance. Throws if initializeDb() was not called.
 */
export declare function getDb(): DB;
//# sourceMappingURL=db.d.ts.map