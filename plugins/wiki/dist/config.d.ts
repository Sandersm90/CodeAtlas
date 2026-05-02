/**
 * config.ts
 *
 * Reads and validates environment variables for wiki-mcp.
 * Exits the process with a descriptive message if required vars are missing.
 */
export interface Config {
    wikiRoot: string;
    ollamaUrl: string;
    ollamaModel: string;
    rawRoot: string;
    dbPath: string;
}
export declare const config: Config;
//# sourceMappingURL=config.d.ts.map