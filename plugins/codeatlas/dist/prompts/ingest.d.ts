/**
 * ingest.ts
 *
 * Prompt template for the wiki_ingest pipeline.
 * Instructs the LLM to extract structured wiki updates from raw source files.
 */
export interface IngestPromptParams {
    rawContent: string;
    hint?: string;
    existingPages: string[];
    existingPageContents: Record<string, string>;
}
/**
 * Builds the system prompt for wiki ingest.
 */
export declare function buildSystemPrompt(): string;
/**
 * Builds the user prompt for wiki ingest.
 */
export declare function buildUserPrompt(params: IngestPromptParams): string;
//# sourceMappingURL=ingest.d.ts.map