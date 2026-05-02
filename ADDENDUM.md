# Wiki MCP — Plugin Addendum

This addendum assumes the MCP server from `wiki-mcp-outline.md` is complete
and working. The goal is to wrap it in a Claude Code plugin so it can be
installed once globally and bootstrapped in any project with a single command.

---

## What changes vs. the standalone MCP

Nothing in the MCP server itself changes. The plugin is purely a DX layer:
- Skills replace the manual CLAUDE.md copy-paste
- Slash commands replace typing out instructions
- `plugin.json` makes it installable via `/plugin install`

---

## Final directory layout

```
wiki-plugin/                          # lives alongside wiki-mcp/, e.g. /mnt/projects/codeatlas/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── wiki/
│       └── SKILL.md                  # teaches Claude Code the full wiki workflow
└── commands/
    ├── wiki-init.md                  # /wiki-init
    ├── wiki-ingest.md                # /wiki-ingest <file>
    ├── wiki-lint.md                  # /wiki-lint
    └── wiki-search.md                # /wiki-search <query>  (optional convenience)
```

---

## .claude-plugin/plugin.json

```json
{
  "name": "wiki",
  "version": "1.0.0",
  "description": "LLM wiki knowledge base — semantic search, ingest, and lifecycle management",
  "author": "michael",
  "skills": ["skills/wiki"],
  "commands": [
    "commands/wiki-init.md",
    "commands/wiki-ingest.md",
    "commands/wiki-lint.md",
    "commands/wiki-search.md"
  ]
}
```

---

## skills/wiki/SKILL.md

This replaces the manual CLAUDE.md snippet from the MCP outline. Because it
lives in a skill, Claude Code loads it automatically and can invoke it without
an explicit slash command.

```markdown
---
name: wiki
description: >
  Use this skill to interact with the project wiki knowledge base.
  Invoke autonomously when starting a task, after implementing something new,
  or when uncertain about existing architecture.
---

# Wiki Knowledge Base

This project has a wiki knowledge base accessible via MCP tools.

## When to use (autonomous triggers)

- **Start of every task** — run `wiki_search` with 2-3 keywords before writing any code
- **After implementing something new** — run `wiki_update` to record design decisions
- **Uncertain about existing architecture** — run `wiki_search` before making assumptions
- **User provides a spec, doc, or notes** — place in `raw/` and run `wiki_ingest`

## Workflow

1. `wiki_search(query)` — load relevant context
2. Do the work
3. `wiki_update(page, content)` — document what changed or was decided

## Tool reference

| Tool | When |
|------|------|
| `wiki_search` | Before starting any non-trivial task |
| `wiki_get` | When you need a full page, not just an excerpt |
| `wiki_update` | After implementing, deciding, or designing something |
| `wiki_ingest` | When a new raw source is provided by the user |
| `wiki_lint` | At the end of a large feature or refactor |

## Page format rules

Every wiki page must have YAML frontmatter with: `title`, `tags`, `related`, `updated`.
Use `[[PageName]]` for cross-references. Keep the summary paragraph under 3 sentences.
Never duplicate content that already exists on a linked page — reference it instead.
```

---

## commands/wiki-init.md

Bootstraps the wiki structure in the current project.

```markdown
---
name: wiki-init
description: Initialize the LLM wiki knowledge base for this project
allowed-tools: Bash, Write, Read
---

Initialize the wiki knowledge base for this project. Do the following steps
in order and confirm each one:

1. Create `wiki/` directory if it does not exist
2. Create `raw/` directory if it does not exist
3. Create `wiki/.gitkeep` so the folder is tracked by git
4. Add `wiki/.embeddings.db` to `.gitignore` (create .gitignore if missing)
5. Write `.mcp.json` in the project root with this content, replacing
   PROJECT_PATH with the absolute path of the current project root,
   and HOMELAB_IP with a placeholder the user must fill in:

   {
     "mcpServers": {
       "wiki": {
         "command": "node",
         "args": ["/mnt/projects/codeatlas/wiki-mcp/dist/index.js"],
         "env": {
           "WIKI_ROOT": "PROJECT_PATH/wiki",
           "RAW_ROOT": "PROJECT_PATH/raw",
           "OLLAMA_URL": "http://HOMELAB_IP:11434",
           "OLLAMA_MODEL": "nomic-embed-text"
         }
       }
     }
   }

6. Check if CLAUDE.md exists. If it does, append the following section.
   If it does not, create it with only this section:

   ## Wiki
   This project uses the wiki MCP skill. See ~/.claude/skills/wiki/SKILL.md
   for the full workflow. OLLAMA_URL in .mcp.json must point to your homelab.

7. Report what was created/modified and remind the user to:
   - Set the correct HOMELAB_IP in `.mcp.json`
   - Restart Claude Code to load the MCP server
```

---

## commands/wiki-ingest.md

```markdown
---
name: wiki-ingest
description: Process a file from raw/ into wiki pages
argument-hint: <filename>
allowed-tools: mcp__wiki__wiki_ingest
---

Ingest the file `$ARGUMENTS` from the raw/ directory into the wiki.

Call the `wiki_ingest` MCP tool with `{ "file": "$ARGUMENTS" }`.
Report which pages were created and which were updated.
If the file does not exist in raw/, tell the user and stop.
```

---

## commands/wiki-lint.md

```markdown
---
name: wiki-lint
description: Run a health check on the wiki and report issues
allowed-tools: mcp__wiki__wiki_lint
---

Run `wiki_lint` and present the results in a readable summary.

Group the output into sections:
- 🔴 Broken links (fix immediately)
- 🟡 Stale embeddings (run wiki_update on each)
- 🟡 Missing concepts (consider creating pages)
- 🔵 Orphan pages (review if still relevant)
- 🔵 Missing frontmatter (fix formatting)

If everything is clean, say so clearly.
```

---

## commands/wiki-search.md

Optional — useful for quick ad-hoc lookups from the CLI.

```markdown
---
name: wiki-search
description: Search the wiki knowledge base
argument-hint: <query>
allowed-tools: mcp__wiki__wiki_search
---

Search the wiki for `$ARGUMENTS` using hybrid search.

Call `wiki_search` with `{ "query": "$ARGUMENTS", "mode": "hybrid", "limit": 5 }`.
Present results as a numbered list with page name and excerpt.
Offer to open any page in full with wiki_get.
```

---

## Installation

Once the plugin folder is ready, install it globally so it's available in
every project:

```bash
# From inside Claude Code
/plugin install /mnt/projects/mcp/codeatlas/wiki-plugin

# Or symlink for development (changes reflect immediately)
ln -s /mnt/projects/mcp/codeatlas/wiki-plugin ~/.claude/plugins/wiki
```

Then in any new project:

```
/wiki-init
```

---

## Implementation order

1. Finish and test the MCP server completely first
2. Create `wiki-plugin/` directory next to `wiki-mcp/`
3. Write `plugin.json`
4. Write `SKILL.md` — most important piece, test that Claude picks it up autonomously
5. Write `wiki-init.md` — test in a throwaway project directory
6. Write remaining commands
7. Install globally and verify with `/plugin list`