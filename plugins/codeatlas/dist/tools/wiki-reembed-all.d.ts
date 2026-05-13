import { z } from "zod";
export declare const WikiReembedAllSchema: z.ZodObject<{
    stale_only: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    stale_only?: boolean | undefined;
}, {
    stale_only?: boolean | undefined;
}>;
export type WikiReembedAllInput = z.infer<typeof WikiReembedAllSchema>;
export interface WikiReembedAllResult {
    reembedded: string[];
    skipped: string[];
    errors: Array<{
        page: string;
        error: string;
    }>;
    total: number;
}
export interface WikiReembedAllError {
    error: string;
    code: string;
}
export type WikiReembedAllOutput = WikiReembedAllResult | WikiReembedAllError;
export declare function wikiReembedAll(input: WikiReembedAllInput): Promise<WikiReembedAllOutput>;
//# sourceMappingURL=wiki-reembed-all.d.ts.map