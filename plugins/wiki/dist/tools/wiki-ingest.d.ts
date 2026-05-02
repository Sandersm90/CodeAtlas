import { z } from "zod";
export declare const WikiIngestSchema: z.ZodObject<{
    file: z.ZodString;
    hint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    file: string;
    hint?: string | undefined;
}, {
    file: string;
    hint?: string | undefined;
}>;
export type WikiIngestInput = z.infer<typeof WikiIngestSchema>;
export interface WikiIngestPayload {
    file: string;
    raw_content: string;
    existing_pages: string[];
    existing_page_contents: Record<string, string>;
    instructions: string;
}
export interface WikiIngestError {
    error: string;
    code: string;
}
export type WikiIngestResult = WikiIngestPayload | WikiIngestError;
export declare function wikiIngest(input: WikiIngestInput): Promise<WikiIngestResult>;
//# sourceMappingURL=wiki-ingest.d.ts.map