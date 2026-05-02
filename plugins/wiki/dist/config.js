"use strict";
/**
 * config.ts
 *
 * Reads and validates environment variables for wiki-mcp.
 * Exits the process with a descriptive message if required vars are missing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
function requireEnv(name) {
    const value = process.env[name];
    if (!value || value.trim() === "") {
        console.error(`[wiki-mcp] Fatal: required environment variable "${name}" is not set.\n` +
            `Please configure it in your .mcp.json env block.`);
        process.exit(1);
    }
    return value.trim();
}
function loadConfig() {
    const wikiRoot = requireEnv("WIKI_ROOT");
    const ollamaUrl = requireEnv("OLLAMA_URL");
    const ollamaModel = process.env["OLLAMA_MODEL"]?.trim() || "nomic-embed-text";
    const rawRoot = process.env["RAW_ROOT"]?.trim() || "";
    const dbPath = process.env["DB_PATH"]?.trim() || `${wikiRoot}/.embeddings.db`;
    return {
        wikiRoot,
        ollamaUrl,
        ollamaModel,
        rawRoot,
        dbPath,
    };
}
// Singleton config — loaded once at startup
exports.config = loadConfig();
//# sourceMappingURL=config.js.map