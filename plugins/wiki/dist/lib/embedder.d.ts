/**
 * embedder.ts
 *
 * Thin client for remote Ollama embedding endpoint.
 * Uses Node's built-in fetch (Node 18+).
 */
export interface EmbedderConfig {
    ollamaUrl: string;
    model: string;
}
/**
 * Embeds a single text string via the Ollama /api/embeddings endpoint.
 * Returns a float[] vector.
 */
export declare function embed(text: string): Promise<number[]>;
/**
 * Batch embeds multiple texts sequentially.
 * Runs one request at a time to respect Ollama rate limits.
 */
export declare function embedBatch(texts: string[]): Promise<number[][]>;
//# sourceMappingURL=embedder.d.ts.map