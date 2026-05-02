/**
 * chunker.ts
 *
 * Markdown-aware page chunker for embedding.
 *
 * Strategy:
 *   1. Split on ## headings — each section becomes a base chunk.
 *   2. If a section exceeds 512 tokens, split further with a sliding window
 *      (256 token chunks, 64 token overlap).
 *   3. Always prepend the page title to every chunk for context.
 */
export interface Chunk {
    chunk_idx: number;
    content: string;
}
/**
 * Splits a markdown page into chunks suitable for embedding.
 * Prepends the page title to every chunk for retrieval context.
 */
export declare function chunkPage(pageName: string, markdownBody: string): Chunk[];
//# sourceMappingURL=chunker.d.ts.map