# CodeAtlas Roadmap

## v1.1 — Polish & robustness

- **Auto-detect embedding dimensions** — query Ollama for model info instead of hardcoding `FLOAT[768]`; allows swapping models without DB rebuild
- **`wiki_delete` tool** — remove a page + its vectors; currently orphans the DB rows
- **`wiki_rename` tool** — rename page + rewrite all incoming `[[links]]` in one atomic op
- **Validate links on write** — `wiki_update` warns when content references `[[PageName]]` that doesn't exist yet
- **PostInstall hook** — run `npm install + rebuild` automatically on plugin install/update so `start.sh` workaround becomes unnecessary

## v1.2 — Search & discovery

- **Tag filtering** — `wiki_search({ query, tags: ["auth", "mqtt"] })` to scope results
- **`wiki_list` tool** — enumerate all pages with title, tags, updated date; useful for Claude to get a map before deep search
- **Incremental re-embedding** — only re-embed chunks whose content changed, not full page replacement; faster on large pages
- **Search ranking tuning** — expose RRF `k` and BM25 weight as config params in `.mcp.json`

## v1.3 — Ingest pipeline

- **Batch ingest** — `wiki_ingest({ files: ["a.md", "b.md"] })` processes multiple files in one call
- **Ingest from URL** — fetch a web page or GitHub file and ingest it directly
- **Ingest deduplication** — before writing, check if ingest content overlaps significantly with existing page (cosine sim threshold)

## v1.4 — Maintenance tooling

- **`wiki_lint --fix`** — auto-fix simple issues: missing `updated` date, broken link suggestions based on fuzzy page name match
- **Stale embedding auto-repair** — `wiki_lint` returns stale list; add a `wiki_reembed_all` convenience tool to batch-fix
- **Git integration** — optionally `git add + commit` wiki pages after `wiki_update` with auto-generated commit message

## Backlog / nice to have

- **Obsidian-compatible output** — frontmatter + `[[links]]` already compatible; add graph export (JSON adjacency list) for visualization
- **Multi-wiki support** — single MCP server instance serving multiple `WIKI_ROOT` paths (useful for monorepos)
- **OpenAI / local embedding fallback** — configurable embedding provider, not Ollama-only
- **`/wiki-update` slash command** — currently only `wiki_update` MCP tool exists; add convenience command
