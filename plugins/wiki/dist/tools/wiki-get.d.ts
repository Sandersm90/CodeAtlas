/**
 * wiki-get.ts
 *
 * MCP tool: wiki_get
 * Fetches a single wiki page by name.
 */
import { z } from "zod";
export declare const WikiGetSchema: z.ZodObject<{
    page: z.ZodString;
}, "strip", z.ZodTypeAny, {
    page: string;
}, {
    page: string;
}>;
export type WikiGetInput = z.infer<typeof WikiGetSchema>;
export interface WikiGetSuccess {
    content: string;
    path: string;
}
export interface WikiGetError {
    error: string;
    code: string;
}
export type WikiGetResult = WikiGetSuccess | WikiGetError;
/**
 * Handles the wiki_get tool call.
 */
export declare function wikiGet(input: WikiGetInput): Promise<WikiGetResult>;
//# sourceMappingURL=wiki-get.d.ts.map