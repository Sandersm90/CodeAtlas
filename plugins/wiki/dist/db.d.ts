/**
 * db.ts
 *
 * Singleton database instance.
 * Initialized once at server startup, shared across all tool calls.
 */
import { DB } from "./lib/vector-store";
/**
 * Returns the shared database instance, initializing it if necessary.
 */
export declare function getDb(): DB;
//# sourceMappingURL=db.d.ts.map