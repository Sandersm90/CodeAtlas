import * as fs from "fs";
import * as path from "path";

export interface ExtractedSymbols {
  filename: string;
  symbols: string[];
}

// Ordered by priority — first match wins per line for deduplication
const PATTERNS: RegExp[] = [
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
export function extractSymbols(filePath: string): ExtractedSymbols {
  const filename = path.basename(filePath, path.extname(filePath));
  const symbols: string[] = [];
  const seen = new Set<string>([filename.toLowerCase()]);

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return { filename, symbols: [] };
  }

  for (const pattern of PATTERNS) {
    // Reset stateful regex
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const name = match[1];
      if (
        name &&
        name.length > 2 &&
        !NOISE.has(name.toLowerCase()) &&
        !seen.has(name.toLowerCase())
      ) {
        symbols.push(name);
        seen.add(name.toLowerCase());
        if (symbols.length >= 20) break;
      }
    }
    if (symbols.length >= 20) break;
  }

  return { filename, symbols };
}
