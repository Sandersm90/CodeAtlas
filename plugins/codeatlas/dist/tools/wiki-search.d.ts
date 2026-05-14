/**
 * wiki-search.ts
 *
 * MCP tool: wiki_search
 * Hybrid semantic + TF-IDF keyword search across all wiki pages.
 */
import { z } from "zod";
export declare const WikiSearchSchema: z.ZodObject<{
    query: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
    mode: z.ZodDefault<z.ZodEnum<{
        hybrid: "hybrid";
        semantic: "semantic";
        keyword: "keyword";
    }>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type WikiSearchInput = z.infer<typeof WikiSearchSchema>;
export interface SearchResultItem {
    page: string;
    excerpt: string;
    score: number;
    path: string;
}
export interface WikiSearchSuccess {
    results: SearchResultItem[];
}
export interface WikiSearchError {
    error: string;
    code: string;
}
export type WikiSearchResult = WikiSearchSuccess | WikiSearchError;
/**
 * Handles the wiki_search tool call.
 */
export declare function wikiSearch(input: WikiSearchInput): Promise<WikiSearchResult>;
//# sourceMappingURL=wiki-search.d.ts.map