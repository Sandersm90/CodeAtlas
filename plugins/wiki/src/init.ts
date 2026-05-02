import * as fs from "fs";
import * as path from "path";

interface InitOptions {
  wikiRoot: string;
  rawRoot: string;
  ollamaUrl: string;
  ollamaModel: string;
}

function parseArgs(args: string[]): Partial<InitOptions> {
  const opts: Partial<InitOptions> = {};
  for (let i = 0; i < args.length; i++) {
    const [key, val] = args[i].split("=");
    const v = val ?? args[++i];
    if (key === "--wiki-root") opts.wikiRoot = v;
    else if (key === "--raw-root") opts.rawRoot = v;
    else if (key === "--ollama-url") opts.ollamaUrl = v;
    else if (key === "--ollama-model") opts.ollamaModel = v;
  }
  return opts;
}

function ensureDir(p: string): void {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
    console.log(`  created  ${p}`);
  } else {
    console.log(`  exists   ${p}`);
  }
}

function appendIfMissing(filePath: string, line: string): void {
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (!content.includes(line)) {
    fs.writeFileSync(filePath, content.endsWith("\n") || content === "" ? content + line + "\n" : content + "\n" + line + "\n");
    console.log(`  updated  ${filePath}`);
  } else {
    console.log(`  exists   ${filePath} (${line})`);
  }
}

export async function runInit(args: string[]): Promise<void> {
  const cwd = process.cwd();
  const parsed = parseArgs(args);

  const opts: InitOptions = {
    wikiRoot: parsed.wikiRoot ?? path.join(cwd, ".wiki"),
    rawRoot: parsed.rawRoot ?? path.join(cwd, ".docs"),
    ollamaUrl: parsed.ollamaUrl ?? "http://HOMELAB_IP:11434",
    ollamaModel: parsed.ollamaModel ?? "nomic-embed-text",
  };

  console.log("\nCodeAtlas init\n");

  // 1. Create directories
  ensureDir(opts.wikiRoot);
  ensureDir(opts.rawRoot);

  // 2. .gitkeep so wiki dir is tracked
  const gitkeep = path.join(opts.wikiRoot, ".gitkeep");
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, "");
    console.log(`  created  ${gitkeep}`);
  }

  // 3. Add .embeddings.db to .gitignore
  const gitignore = path.join(cwd, ".gitignore");
  appendIfMissing(gitignore, path.join(path.relative(cwd, opts.wikiRoot), ".embeddings.db"));

  // 4. Write .mcp.json (skip if exists)
  const mcpJson = path.join(cwd, ".mcp.json");
  if (fs.existsSync(mcpJson)) {
    console.log(`  skipped  ${mcpJson} (already exists)`);
  } else {
    const config = {
      mcpServers: {
        wiki: {
          type: "stdio",
          command: "npx",
          args: ["--package=@synnode/codeatlas", "--yes", "codeatlas"],
          env: {
            WIKI_ROOT: opts.wikiRoot,
            RAW_ROOT: opts.rawRoot,
            OLLAMA_URL: opts.ollamaUrl,
            OLLAMA_MODEL: opts.ollamaModel,
          },
        },
      },
    };
    fs.writeFileSync(mcpJson, JSON.stringify(config, null, 2) + "\n");
    console.log(`  created  ${mcpJson}`);
  }

  // 5. Update CLAUDE.md
  const claudeMd = path.join(cwd, "CLAUDE.md");
  const wikiSection = `\n## Wiki\nThis project uses the wiki MCP skill. See ~/.claude/skills/wiki/SKILL.md\nfor the full workflow. OLLAMA_URL in .mcp.json must point to your Ollama instance.\n`;
  const claudeContent = fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, "utf8") : "";
  if (!claudeContent.includes("## Wiki")) {
    fs.writeFileSync(claudeMd, claudeContent + wikiSection);
    console.log(`  updated  ${claudeMd}`);
  } else {
    console.log(`  exists   ${claudeMd} (## Wiki section)`);
  }

  console.log("\nDone.");

  if (opts.ollamaUrl.includes("HOMELAB_IP")) {
    console.log("\n\x1b[33mNext steps:\x1b[0m");
    console.log("  1. Set OLLAMA_URL in .mcp.json");
    console.log("  2. Restart Claude Code to load the MCP server");
  } else {
    console.log("\n\x1b[33mNext step:\x1b[0m Restart Claude Code to load the MCP server");
  }
}
