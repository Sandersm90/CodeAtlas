/**
 * wiki-ingest.ts
 *
 * MCP tool: wiki_ingest
 * Processes a raw source file from RAW_ROOT into one or more wiki pages
 * using the Anthropic API (claude-sonnet-4-6).
 */
import { z } from "zod";
export declare const WikiIngestSchema: z.ZodObject<{
    file: z.ZodString;
    hint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    file: string;
    hint?: string | undefined;
}, {
    file: string;
    hint?: string | undefined;
}>;
export type WikiIngestInput = z.infer<typeof WikiIngestSchema>;
export interface WikiIngestSuccess {
    pages_updated: string[];
    pages_created: string[];
}
export interface WikiIngestError {
    error: string;
    code: string;
}
export type WikiIngestResult = WikiIngestSuccess | WikiIngestError;
/**
 * Handles the wiki_ingest tool call.
 */
export declare function wikiIngest(input: WikiIngestInput): Promise<WikiIngestResult>;
//# sourceMappingURL=wiki-ingest.d.ts.map