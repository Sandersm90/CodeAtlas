/**
 * embedder.ts
 *
 * Thin client for remote Ollama embedding endpoint.
 * Uses Node's built-in fetch (Node 18+).
 */

import { config } from "../config";

export interface EmbedderConfig {
  ollamaUrl: string;
  model: string;
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

/**
 * Embeds a single text string via the Ollama /api/embeddings endpoint.
 * Returns a float[] vector.
 */
export async function embed(text: string): Promise<number[]> {
  const url = `${config.ollamaUrl}/api/embeddings`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.ollamaModel, prompt: text }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Ollama connection failed (${config.ollamaUrl}): ${message}`
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Ollama embedding request failed with status ${response.status}: ${body}`
    );
  }

  const data = (await response.json()) as OllamaEmbeddingResponse;

  if (!Array.isArray(data.embedding)) {
    throw new Error(
      `Ollama returned unexpected response: missing "embedding" array`
    );
  }

  return data.embedding;
}

/**
 * Batch embeds multiple texts sequentially.
 * Runs one request at a time to respect Ollama rate limits.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  for (const text of texts) {
    const vector = await embed(text);
    results.push(vector);
  }

  return results;
}
