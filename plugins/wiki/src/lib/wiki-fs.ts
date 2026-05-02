/**
 * wiki-fs.ts
 *
 * Filesystem helpers for reading and writing wiki pages.
 * All paths are resolved relative to WIKI_ROOT.
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { glob } from "glob";
import { config } from "../config";

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
export function resolvePage(pageName: string): string {
  const name = pageName.endsWith(".md") ? pageName : `${pageName}.md`;
  return path.join(config.wikiRoot, name);
}

/**
 * Reads a wiki page by name. Returns null if it does not exist.
 */
export function readPage(pageName: string): WikiPage | null {
  const filePath = resolvePage(pageName);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(raw);

  return {
    name: pageName.replace(/\.md$/, ""),
    path: filePath,
    content: raw,
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
  };
}

/**
 * Writes a wiki page to disk. Creates the wiki root directory if needed.
 */
export function writePage(pageName: string, content: string): string {
  const filePath = resolvePage(pageName);

  // Ensure the wiki root directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

/**
 * Checks whether a wiki page exists.
 */
export function pageExists(pageName: string): boolean {
  return fs.existsSync(resolvePage(pageName));
}

/**
 * Lists all wiki page names (without .md extension) in WIKI_ROOT.
 */
export async function listPages(): Promise<string[]> {
  if (!fs.existsSync(config.wikiRoot)) {
    return [];
  }

  const files = await glob("*.md", {
    cwd: config.wikiRoot,
    absolute: false,
  });

  return files.map((f) => f.replace(/\.md$/, "")).sort();
}

/**
 * Reads all wiki pages from WIKI_ROOT. Returns an array of WikiPage objects.
 */
export async function readAllPages(): Promise<WikiPage[]> {
  const names = await listPages();
  const pages: WikiPage[] = [];

  for (const name of names) {
    const page = readPage(name);
    if (page) {
      pages.push(page);
    }
  }

  return pages;
}

/**
 * Validates that a wiki page's frontmatter contains the required fields.
 * Returns an array of missing field names.
 */
export function validateFrontmatter(frontmatter: FrontmatterData): string[] {
  const required: string[] = ["title", "tags", "updated"];
  const missing: string[] = [];

  for (const field of required) {
    const value = frontmatter[field];
    if (value === undefined || value === null || value === "") {
      missing.push(field);
    }
  }

  return missing;
}

/**
 * Extracts all [[WikiLink]] references from a markdown body.
 */
export function extractWikiLinks(content: string): string[] {
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  return [...new Set(links)];
}

/**
 * Reads a file from RAW_ROOT.
 */
export function readRawFile(filename: string): string {
  if (!config.rawRoot) {
    throw new Error("RAW_ROOT environment variable is not set");
  }

  const filePath = path.join(config.rawRoot, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Raw file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf-8");
}
