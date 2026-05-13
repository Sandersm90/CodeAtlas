/**
 * wiki-fs.ts
 *
 * Filesystem helpers for reading and writing wiki pages.
 * All paths are resolved relative to WIKI_ROOT.
 */
export interface WikiPage {
    name: string;
    path: string;
    content: string;
    frontmatter: Record<string, unknown>;
    body: string;
}
export interface FrontmatterData {
    title?: string;
    tags?: string[];
    related?: string[];
    created?: string;
    updated?: string;
    [key: string]: unknown;
}
/**
 * Resolves a page name to its absolute filesystem path.
 * Adds .md extension if not present.
 */
export declare function resolvePage(pageName: string): string;
/**
 * Reads a wiki page by name. Returns null if it does not exist.
 */
export declare function readPage(pageName: string): WikiPage | null;
/**
 * Writes a wiki page to disk. Creates the wiki root directory if needed.
 */
export declare function writePage(pageName: string, content: string): string;
/**
 * Checks whether a wiki page exists.
 */
export declare function pageExists(pageName: string): boolean;
/**
 * Lists all wiki page names (without .md extension) in WIKI_ROOT.
 */
export declare function listPages(): Promise<string[]>;
/**
 * Reads all wiki pages from WIKI_ROOT. Returns an array of WikiPage objects.
 */
export declare function readAllPages(): Promise<WikiPage[]>;
/**
 * Validates that a wiki page's frontmatter contains the required fields.
 * Returns an array of missing field names.
 */
export declare function validateFrontmatter(frontmatter: FrontmatterData): string[];
/**
 * Extracts all [[WikiLink]] references from a markdown body.
 */
export declare function extractWikiLinks(content: string): string[];
/**
 * Deletes a wiki page from disk. Returns false if the page did not exist.
 */
export declare function deletePage(pageName: string): boolean;
/**
 * Renames a wiki page on disk. If the frontmatter title exactly matches the
 * old name it is updated to the new name. Returns the new file path.
 */
export declare function renamePage(oldName: string, newName: string): string;
/**
 * Rewrites all [[oldName]] references to [[newName]] across every page in
 * WIKI_ROOT. Returns the names of pages that were modified.
 */
export declare function rewriteLinksInAllPages(oldName: string, newName: string): string[];
/**
 * Reads a file from RAW_ROOT.
 */
export declare function readRawFile(filename: string): string;
//# sourceMappingURL=wiki-fs.d.ts.map