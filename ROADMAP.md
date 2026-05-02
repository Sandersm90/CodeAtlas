# CodeAtlas Roadmap

## v1.1 — Polish & robustness

- **Auto-detect embedding dimensions** — query Ollama for model info instead of hardcoding `FLOAT[768]`; allows swapping models without DB rebuild
- **`wiki_delete` tool** — remove a page + its vectors; currently orphans the DB rows
- **`wiki_rename` tool** — rename page + rewrite all incoming `[[links]]` in one atomic op
- **Validate links on write** — `wiki_update` warns when content references `[[PageName]]` that doesn't exist yet
- **PostInstall hook** — run `npm install + rebuild` automatically on plugin install/update so `start.sh` workaround becomes unnecessary

## v1.2 — Code-aware context

- **`wiki_context_for(file)` tool** — given a source file path, extracts filename + symbols and returns the most relevant wiki pages automatically; removes the need for Claude to manually guess search keywords when opening a file
- **`wiki_diff` tool** — show what would change before committing a `wiki_update`; surfaces as `wiki_update({ dry_run: true })` so it fits the existing tool rather than adding a separate call
- **Tag filtering** — `wiki_search({ query, tags: ["auth", "mqtt"] })` to scope results
- **`wiki_list` tool** — enumerate all pages with title, tags, updated date; useful for getting a map before deep search

## v1.3 — Ingest pipeline

- **Batch ingest** — `wiki_ingest({ files: ["a.md", "b.md"] })` processes multiple files in one call
- **Ingest from URL** — fetch a web page or GitHub file and ingest directly
- **Ingest deduplication** — before writing, check if ingest content overlaps significantly with existing page (cosine sim threshold)

## v1.4 — Maintenance tooling

- **`wiki_lint --fix`** — auto-fix simple issues: missing `updated` date, broken link suggestions based on fuzzy page name match
- **`wiki_reembed_all`** — batch re-embed all stale pages in one call
- **Git integration** — optionally `git add + commit` wiki pages after `wiki_update` with auto-generated commit message
- **Incremental re-embedding** — only re-embed chunks whose content changed, not full page replacement

## Backlog / nice to have

- **Obsidian-compatible graph export** — frontmatter + `[[links]]` already compatible; add JSON adjacency list export for visualization
- **Multi-wiki support** — single MCP server instance serving multiple `WIKI_ROOT` paths (monorepos)
- **OpenAI / local embedding fallback** — configurable embedding provider, not Ollama-only
- **`/wiki-update` slash command** — convenience wrapper around the `wiki_update` MCP tool
