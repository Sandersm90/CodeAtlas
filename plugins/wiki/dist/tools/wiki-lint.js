"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.wikiLint = wikiLint;
const wiki_fs_1 = require("../lib/wiki-fs");
const vector_store_1 = require("../lib/vector-store");
const db_1 = require("../db");
/**
 * Extracts capitalized noun phrases (2+ word sequences or single capitalized words)
 * that look like concept names from text.
 */
function extractConceptCandidates(text) {
    const candidates = [];
    // Single capitalized words (not at start of sentence, not common words)
    const commonWords = new Set([
        "The", "A", "An", "In", "On", "At", "By", "To", "Of", "For",
        "And", "Or", "But", "With", "From", "This", "That", "These",
        "Those", "It", "Is", "Are", "Was", "Were", "Be", "Been",
        "Have", "Has", "Had", "Do", "Does", "Did", "Will", "Would",
        "Can", "Could", "Should", "May", "Might", "Must",
    ]);
    // Match capitalized words that are not at the start of a line/sentence
    const wordRegex = /(?<![.!?\n]\s{0,2})(?<!\[\[)\b([A-Z][a-zA-Z]{2,})\b(?!\]\])/g;
    let match;
    while ((match = wordRegex.exec(text)) !== null) {
        const word = match[1];
        if (!commonWords.has(word)) {
            candidates.push(word);
        }
    }
    // Multi-word capitalized phrases (e.g. "Access Manager", "Device Variant")
    const phraseRegex = /(?<!\[\[)\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b(?!\]\])/g;
    while ((match = phraseRegex.exec(text)) !== null) {
        candidates.push(match[1]);
    }
    return candidates;
}
/**
 * Handles the wiki_lint tool call.
 */
async function wikiLint() {
    let pages;
    try {
        pages = await (0, wiki_fs_1.readAllPages)();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            error: `Failed to read wiki pages: ${message}`,
            code: "READ_ERROR",
        };
    }
    const pageNames = new Set(pages.map((p) => p.name));
    const db = (0, db_1.getDb)();
    // --- 1. Broken links ---
    const brokenLinks = [];
    // --- 2. Orphan pages ---
    // Track which pages are referenced (have incoming links)
    const referencedPages = new Set();
    // --- 3. Missing frontmatter ---
    const missingFrontmatter = [];
    // --- 4. Stale embeddings ---
    const staleEmbeddings = [];
    // --- 5. Concept frequency map ---
    const conceptFrequency = new Map();
    for (const page of pages) {
        // Check broken links and track referenced pages
        const links = (0, wiki_fs_1.extractWikiLinks)(page.content);
        for (const link of links) {
            referencedPages.add(link);
            if (!pageNames.has(link)) {
                brokenLinks.push({ page: page.name, link });
            }
        }
        // Check missing frontmatter fields
        const fm = page.frontmatter;
        const missing = [];
        if (!fm["title"])
            missing.push("title");
        if (!fm["tags"])
            missing.push("tags");
        if (!fm["updated"])
            missing.push("updated");
        if (missing.length > 0) {
            missingFrontmatter.push({ page: page.name, missing });
        }
        // Check stale embeddings
        const embedTime = (0, vector_store_1.getPageEmbedTime)(db, page.name);
        if (fm["updated"] && typeof fm["updated"] === "string") {
            const updatedDate = new Date(fm["updated"]);
            if (!embedTime || updatedDate > embedTime) {
                staleEmbeddings.push(page.name);
            }
        }
        else if (!embedTime) {
            // No embeddings at all
            staleEmbeddings.push(page.name);
        }
        // Collect concept candidates from page body
        const candidates = extractConceptCandidates(page.body);
        for (const candidate of candidates) {
            conceptFrequency.set(candidate, (conceptFrequency.get(candidate) ?? 0) + 1);
        }
    }
    // Orphan pages: pages not referenced by any other page
    const orphanPages = pages
        .filter((p) => !referencedPages.has(p.name))
        .map((p) => p.name);
    // Missing concepts: appear 3+ times but have no dedicated page
    const missingConcepts = [];
    for (const [concept, count] of conceptFrequency.entries()) {
        if (count >= 3 && !pageNames.has(concept)) {
            missingConcepts.push(concept);
        }
    }
    missingConcepts.sort();
    return {
        broken_links: brokenLinks,
        orphan_pages: orphanPages,
        missing_frontmatter: missingFrontmatter,
        stale_embeddings: staleEmbeddings,
        missing_concepts: missingConcepts,
    };
}
//# sourceMappingURL=wiki-lint.js.map