"use strict";
/**
 * wiki-fs.ts
 *
 * Filesystem helpers for reading and writing wiki pages.
 * All paths are resolved relative to WIKI_ROOT.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePage = resolvePage;
exports.readPage = readPage;
exports.writePage = writePage;
exports.pageExists = pageExists;
exports.listPages = listPages;
exports.readAllPages = readAllPages;
exports.validateFrontmatter = validateFrontmatter;
exports.extractWikiLinks = extractWikiLinks;
exports.readRawFile = readRawFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const gray_matter_1 = __importDefault(require("gray-matter"));
const glob_1 = require("glob");
const config_1 = require("../config");
/**
 * Resolves a page name to its absolute filesystem path.
 * Adds .md extension if not present.
 */
function resolvePage(pageName) {
    const name = pageName.endsWith(".md") ? pageName : `${pageName}.md`;
    return path.join(config_1.config.wikiRoot, name);
}
/**
 * Reads a wiki page by name. Returns null if it does not exist.
 */
function readPage(pageName) {
    const filePath = resolvePage(pageName);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = (0, gray_matter_1.default)(raw);
    return {
        name: pageName.replace(/\.md$/, ""),
        path: filePath,
        content: raw,
        frontmatter: parsed.data,
        body: parsed.content,
    };
}
/**
 * Writes a wiki page to disk. Creates the wiki root directory if needed.
 */
function writePage(pageName, content) {
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
function pageExists(pageName) {
    return fs.existsSync(resolvePage(pageName));
}
/**
 * Lists all wiki page names (without .md extension) in WIKI_ROOT.
 */
async function listPages() {
    if (!fs.existsSync(config_1.config.wikiRoot)) {
        return [];
    }
    const files = await (0, glob_1.glob)("*.md", {
        cwd: config_1.config.wikiRoot,
        absolute: false,
    });
    return files.map((f) => f.replace(/\.md$/, "")).sort();
}
/**
 * Reads all wiki pages from WIKI_ROOT. Returns an array of WikiPage objects.
 */
async function readAllPages() {
    const names = await listPages();
    const pages = [];
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
function validateFrontmatter(frontmatter) {
    const required = ["title", "tags", "updated"];
    const missing = [];
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
function extractWikiLinks(content) {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const links = [];
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
        links.push(match[1]);
    }
    return [...new Set(links)];
}
/**
 * Reads a file from RAW_ROOT.
 */
function readRawFile(filename) {
    if (!config_1.config.rawRoot) {
        throw new Error("RAW_ROOT environment variable is not set");
    }
    const filePath = path.join(config_1.config.rawRoot, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Raw file not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, "utf-8");
}
//# sourceMappingURL=wiki-fs.js.map