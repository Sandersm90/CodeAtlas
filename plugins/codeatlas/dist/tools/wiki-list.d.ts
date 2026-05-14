import { z } from "zod";
export declare const WikiListSchema: z.ZodObject<{
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type WikiListInput = z.infer<typeof WikiListSchema>;
export interface WikiListEntry {
    page: string;
    title: string;
    tags: string[];
    updated: string;
    path: string;
}
export interface WikiListSuccess {
    pages: WikiListEntry[];
    total: number;
}
export interface WikiListError {
    error: string;
    code: string;
}
export type WikiListResult = WikiListSuccess | WikiListError;
export declare function wikiList(input: WikiListInput): Promise<WikiListResult>;
//# sourceMappingURL=wiki-list.d.ts.map