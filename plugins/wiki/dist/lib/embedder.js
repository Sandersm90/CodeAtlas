"use strict";
/**
 * embedder.ts
 *
 * Thin client for remote Ollama embedding endpoint.
 * Uses Node's built-in fetch (Node 18+).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.embed = embed;
exports.embedBatch = embedBatch;
const config_1 = require("../config");
/**
 * Embeds a single text string via the Ollama /api/embeddings endpoint.
 * Returns a float[] vector.
 */
async function embed(text) {
    const url = `${config_1.config.ollamaUrl}/api/embeddings`;
    let response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: config_1.config.ollamaModel, prompt: text }),
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Ollama connection failed (${config_1.config.ollamaUrl}): ${message}`);
    }
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Ollama embedding request failed with status ${response.status}: ${body}`);
    }
    const data = (await response.json());
    if (!Array.isArray(data.embedding)) {
        throw new Error(`Ollama returned unexpected response: missing "embedding" array`);
    }
    return data.embedding;
}
/**
 * Batch embeds multiple texts sequentially.
 * Runs one request at a time to respect Ollama rate limits.
 */
async function embedBatch(texts) {
    const results = [];
    for (const text of texts) {
        const vector = await embed(text);
        results.push(vector);
    }
    return results;
}
//# sourceMappingURL=embedder.js.map