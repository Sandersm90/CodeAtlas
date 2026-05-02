"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSymbols = extractSymbols;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Ordered by priority — first match wins per line for deduplication
const PATTERNS = [
    // TypeScript / JavaScript
    /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Z]\w+)/g,
    /(?:export\s+)?interface\s+([A-Z]\w+)/g,
    /(?:export\s+)?type\s+([A-Z]\w+)\s*[=<{(]/g,
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*[(<]/g,
    /(?:export\s+)?(?:const|let)\s+(\w+)\s*[:=]\s*(?:async\s+)?\(/g,
    // Python
    /^(?:async\s+)?def\s+(\w+)\s*\(/gm,
    /^class\s+([A-Z]\w+)\s*[:(]/gm,
    // Rust
    /^pub\s+(?:async\s+)?fn\s+(\w+)\s*[(<]/gm,
    /^pub\s+(?:struct|enum|trait)\s+([A-Z]\w+)/gm,
    // Go
    /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/gm,
    /^type\s+([A-Z]\w+)\s+(?:struct|interface)/gm,
];
// Single-char names, common noise words, and test helpers
const NOISE = new Set([
    "new", "this", "self", "super", "true", "false", "null", "undefined",
    "get", "set", "has", "add", "run", "use", "log", "err", "res", "req",
    "fn", "it", "db",
]);
/**
 * Extracts the filename stem and recognizable symbols from a source file.
 */
function extractSymbols(filePath) {
    const filename = path.basename(filePath, path.extname(filePath));
    const symbols = [];
    const seen = new Set([filename.toLowerCase()]);
    let content;
    try {
        content = fs.readFileSync(filePath, "utf-8");
    }
    catch {
        return { filename, symbols: [] };
    }
    for (const pattern of PATTERNS) {
        // Reset stateful regex
        const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
        let match;
        while ((match = re.exec(content)) !== null) {
            const name = match[1];
            if (name &&
                name.length > 2 &&
                !NOISE.has(name.toLowerCase()) &&
                !seen.has(name.toLowerCase())) {
                symbols.push(name);
                seen.add(name.toLowerCase());
                if (symbols.length >= 20)
                    break;
            }
        }
        if (symbols.length >= 20)
            break;
    }
    return { filename, symbols };
}
//# sourceMappingURL=symbol-extractor.js.map