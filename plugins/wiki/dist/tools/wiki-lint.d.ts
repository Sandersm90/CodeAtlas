/**
 * wiki-lint.ts
 *
 * MCP tool: wiki_lint
 * Runs a health check on the entire wiki and returns a structured report.
 *
 * Checks:
 *   1. Broken links — [[PageName]] refs where PageName.md does not exist
 *   2. Orphan pages — pages with no incoming links
 *   3. Missing frontmatter — pages lacking title, tags, or updated
 *   4. Stale embeddings — pages whose frontmatter updated > last embed time
 *   5. Missing concepts — capitalized noun phrases appearing 3+ times without a dedicated page
 */
import { z } from "zod";
export declare const WikiLintSchema: z.ZodObject<{
    fix: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    fix?: boolean | undefined;
}, {
    fix?: boolean | undefined;
}>;
export type WikiLintInput = z.infer<typeof WikiLintSchema>;
export interface BrokenLink {
    page: string;
    link: string;
    suggestion: string | null;
}
export interface FixedField {
    page: string;
    field: string;
    value: string;
}
export interface WikiLintResult {
    broken_links: BrokenLink[];
    orphan_pages: string[];
    missing_frontmatter: Array<{
        page: string;
        missing: string[];
    }>;
    stale_embeddings: string[];
    missing_concepts: string[];
    fixed?: FixedField[];
}
export interface WikiLintError {
    error: string;
    code: string;
}
export type WikiLintOutput = WikiLintResult | WikiLintError;
/**
 * Handles the wiki_lint tool call.
 */
export declare function wikiLint(input?: WikiLintInput): Promise<WikiLintOutput>;
//# sourceMappingURL=wiki-lint.d.ts.map