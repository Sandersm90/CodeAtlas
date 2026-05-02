import { z } from "zod";
export declare const WikiIngestBaseSchema: z.ZodObject<{
    file: z.ZodOptional<z.ZodString>;
    files: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    url: z.ZodOptional<z.ZodString>;
    urls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    hint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    file?: string | undefined;
    files?: string[] | undefined;
    url?: string | undefined;
    urls?: string[] | undefined;
    hint?: string | undefined;
}, {
    file?: string | undefined;
    files?: string[] | undefined;
    url?: string | undefined;
    urls?: string[] | undefined;
    hint?: string | undefined;
}>;
export declare const WikiIngestSchema: z.ZodEffects<z.ZodObject<{
    file: z.ZodOptional<z.ZodString>;
    files: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    url: z.ZodOptional<z.ZodString>;
    urls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    hint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    file?: string | undefined;
    files?: string[] | undefined;
    url?: string | undefined;
    urls?: string[] | undefined;
    hint?: string | undefined;
}, {
    file?: string | undefined;
    files?: string[] | undefined;
    url?: string | undefined;
    urls?: string[] | undefined;
    hint?: string | undefined;
}>, {
    file?: string | undefined;
    files?: string[] | undefined;
    url?: string | undefined;
    urls?: string[] | undefined;
    hint?: string | undefined;
}, {
    file?: string | undefined;
    files?: string[] | undefined;
    url?: string | undefined;
    urls?: string[] | undefined;
    hint?: string | undefined;
}>;
export type WikiIngestInput = z.infer<typeof WikiIngestSchema>;
export interface DuplicateCandidate {
    page: string;
    score: number;
}
export interface WikiIngestPayload {
    files: string[];
    raw_files: Record<string, string>;
    existing_pages: string[];
    existing_page_contents: Record<string, string>;
    potential_duplicates: Record<string, DuplicateCandidate[]>;
    instructions: string;
}
export interface WikiIngestError {
    error: string;
    code: string;
    failed_file?: string;
}
export type WikiIngestResult = WikiIngestPayload | WikiIngestError;
export declare function wikiIngest(input: WikiIngestInput): Promise<WikiIngestResult>;
//# sourceMappingURL=wiki-ingest.d.ts.map