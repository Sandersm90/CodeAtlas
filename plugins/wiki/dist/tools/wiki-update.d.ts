/**
 * wiki-update.ts
 *
 * MCP tool: wiki_update
 * Creates or updates a wiki page, re-embeds it in the vector store,
 * and invalidates the BM25 index.
 */
import { z } from "zod";
export declare const WikiUpdateSchema: z.ZodObject<{
    page: z.ZodString;
    content: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    content: string;
    page: string;
    reason?: string | undefined;
}, {
    content: string;
    page: string;
    reason?: string | undefined;
}>;
export type WikiUpdateInput = z.infer<typeof WikiUpdateSchema>;
export interface WikiUpdateSuccess {
    success: true;
    chunks_embedded: number;
    path: string;
}
export interface WikiUpdateError {
    error: string;
    code: string;
}
export type WikiUpdateResult = WikiUpdateSuccess | WikiUpdateError;
/**
 * Handles the wiki_update tool call.
 */
export declare function wikiUpdate(input: WikiUpdateInput): Promise<WikiUpdateResult>;
//# sourceMappingURL=wiki-update.d.ts.map