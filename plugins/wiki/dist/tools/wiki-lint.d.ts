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
export interface WikiLintResult {
    broken_links: Array<{
        page: string;
        link: string;
    }>;
    orphan_pages: string[];
    missing_frontmatter: Array<{
        page: string;
        missing: string[];
    }>;
    stale_embeddings: string[];
    missing_concepts: string[];
}
export interface WikiLintError {
    error: string;
    code: string;
}
export type WikiLintOutput = WikiLintResult | WikiLintError;
/**
 * Handles the wiki_lint tool call.
 */
export declare function wikiLint(): Promise<WikiLintOutput>;
//# sourceMappingURL=wiki-lint.d.ts.map