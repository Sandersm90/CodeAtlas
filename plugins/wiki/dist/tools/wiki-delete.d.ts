import { z } from "zod";
export declare const WikiDeleteSchema: z.ZodObject<{
    page: z.ZodString;
}, "strip", z.ZodTypeAny, {
    page: string;
}, {
    page: string;
}>;
export type WikiDeleteInput = z.infer<typeof WikiDeleteSchema>;
export interface WikiDeleteSuccess {
    success: true;
    page: string;
}
export interface WikiDeleteError {
    error: string;
    code: string;
}
export type WikiDeleteResult = WikiDeleteSuccess | WikiDeleteError;
export declare function wikiDelete(input: WikiDeleteInput): Promise<WikiDeleteResult>;
//# sourceMappingURL=wiki-delete.d.ts.map