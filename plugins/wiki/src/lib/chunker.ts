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

const MAX_TOKENS = 512;
const WINDOW_TOKENS = 256;
const OVERLAP_TOKENS = 64;

/**
 * Naive token estimator — roughly 4 characters per token.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Splits text into word-based sliding windows.
 */
function slidingWindow(
  text: string,
  windowTokens: number,
  overlapTokens: number
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const charsPerToken = 4;
  const windowWords = windowTokens * charsPerToken;
  const overlapWords = overlapTokens * charsPerToken;

  // Convert token counts to approximate word counts (avg 5 chars per word)
  const wordsPerWindow = Math.ceil(windowWords / 5);
  const wordsPerOverlap = Math.ceil(overlapWords / 5);
  const step = Math.max(1, wordsPerWindow - wordsPerOverlap);

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerWindow, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start += step;
  }

  return chunks;
}

/**
 * Splits a markdown page into chunks suitable for embedding.
 * Prepends the page title to every chunk for retrieval context.
 */
export function chunkPage(pageName: string, markdownBody: string): Chunk[] {
  const titlePrefix = `# ${pageName}\n\n`;
  const chunks: Chunk[] = [];
  let chunkIdx = 0;

  // Split on ## headings (H2 and deeper)
  // Regex captures the heading line and all content until the next heading
  const sectionRegex = /(?=^##+ )/m;
  const rawSections = markdownBody.split(sectionRegex);

  // If there's content before the first ## heading, treat it as the intro section
  const sections: string[] = rawSections.filter((s) => s.trim().length > 0);

  if (sections.length === 0) {
    // No sections at all — treat the whole body as one chunk
    const full = `${titlePrefix}${markdownBody.trim()}`;
    chunks.push({ chunk_idx: chunkIdx++, content: full });
    return chunks;
  }

  for (const section of sections) {
    const sectionText = section.trim();
    if (!sectionText) continue;

    const withTitle = `${titlePrefix}${sectionText}`;
    const tokenCount = estimateTokens(withTitle);

    if (tokenCount <= MAX_TOKENS) {
      chunks.push({ chunk_idx: chunkIdx++, content: withTitle });
    } else {
      // Section too large — apply sliding window over the section body
      const windows = slidingWindow(sectionText, WINDOW_TOKENS, OVERLAP_TOKENS);
      for (const window of windows) {
        const windowWithTitle = `${titlePrefix}${window}`;
        chunks.push({ chunk_idx: chunkIdx++, content: windowWithTitle });
      }
    }
  }

  // Guard against empty output
  if (chunks.length === 0) {
    const full = `${titlePrefix}${markdownBody.trim()}`;
    chunks.push({ chunk_idx: chunkIdx++, content: full });
  }

  return chunks;
}
