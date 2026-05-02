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
    dry_run: z.ZodOptional<z.ZodBoolean>;
    git_commit: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    content: string;
    page: string;
    reason?: string | undefined;
    dry_run?: boolean | undefined;
    git_commit?: boolean | undefined;
}, {
    content: string;
    page: string;
    reason?: string | undefined;
    dry_run?: boolean | undefined;
    git_commit?: boolean | undefined;
}>;
export type WikiUpdateInput = z.infer<typeof WikiUpdateSchema>;
export interface WikiUpdateSuccess {
    success: true;
    chunks_embedded: number;
    chunks_skipped: number;
    path: string;
    git_committed?: boolean;
    missing_links?: string[];
}
export interface WikiUpdateDryRun {
    dry_run: true;
    page: string;
    is_new: boolean;
    old_content: string | null;
    new_content: string;
    line_changes: {
        added: number;
        removed: number;
    };
    missing_links?: string[];
}
export interface WikiUpdateError {
    error: string;
    code: string;
}
export type WikiUpdateResult = WikiUpdateSuccess | WikiUpdateDryRun | WikiUpdateError;
/**
 * Handles the wiki_update tool call.
 */
export declare function wikiUpdate(input: WikiUpdateInput): Promise<WikiUpdateResult>;
//# sourceMappingURL=wiki-update.d.ts.map