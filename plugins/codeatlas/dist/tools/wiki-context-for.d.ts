import { z } from "zod";
export declare const WikiContextForSchema: z.ZodObject<{
    file: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type WikiContextForInput = z.infer<typeof WikiContextForSchema>;
export interface WikiContextForSuccess {
    file: string;
    query_terms: string[];
    results: Array<{
        page: string;
        excerpt: string;
        score: number;
        path: string;
    }>;
}
export interface WikiContextForError {
    error: string;
    code: string;
}
export type WikiContextForResult = WikiContextForSuccess | WikiContextForError;
export declare function wikiContextFor(input: WikiContextForInput): Promise<WikiContextForResult>;
//# sourceMappingURL=wiki-context-for.d.ts.map