import { z } from "zod";
export declare const WikiRenameSchema: z.ZodObject<{
    page: z.ZodString;
    new_name: z.ZodString;
}, z.core.$strip>;
export type WikiRenameInput = z.infer<typeof WikiRenameSchema>;
export interface WikiRenameSuccess {
    success: true;
    old_name: string;
    new_name: string;
    new_path: string;
    links_rewritten: number;
    modified_pages: string[];
}
export interface WikiRenameError {
    error: string;
    code: string;
}
export type WikiRenameResult = WikiRenameSuccess | WikiRenameError;
export declare function wikiRename(input: WikiRenameInput): Promise<WikiRenameResult>;
//# sourceMappingURL=wiki-rename.d.ts.map