# Wiki MCP Server — Build Outline

## Goal

Build a TypeScript/Node MCP server that gives Claude Code access to a
per-project markdown knowledge base (wiki). The server handles semantic
search via a remote Ollama instance, keyword search via BM25, and full
wiki lifecycle management (ingest, read, write, lint).

---

## Project Structure

```
wiki-mcp/
├── src/
│   ├── index.ts              # MCP server entrypoint
│   ├── tools/
│   │   ├── wiki-get.ts       # Read a single wiki page
│   │   ├── wiki-search.ts    # Hybrid search (semantic + BM25)
│   │   ├── wiki-update.ts    # Create or update a wiki page
│   │   ├── wiki-ingest.ts    # Process a raw source into wiki page(s)
│   │   └── wiki-lint.ts      # Health check the wiki
│   ├── lib/
│   │   ├── embedder.ts       # Remote Ollama embedding client
│   │   ├── vector-store.ts   # sqlite-vec read/write/search
│   │   ├── bm25.ts           # BM25 keyword search over wiki pages
│   │   ├── rrf.ts            # Reciprocal Rank Fusion combiner
│   │   ├── chunker.ts        # Markdown-aware page chunker
│   │   └── wiki-fs.ts        # Filesystem helpers (read/write wiki/)
│   └── config.ts             # Reads env vars (WIKI_ROOT, OLLAMA_URL, etc.)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Configuration

Configured entirely via environment variables, set per-project in `.mcp.json`:

| Variable | Description | Example |
|---|---|---|
| `WIKI_ROOT` | Absolute path to the project's `wiki/` folder | `/home/michael/projects/fragments-of-mars/wiki` |
| `OLLAMA_URL` | Base URL of the remote Ollama instance | `http://homelab:11434` |
| `OLLAMA_MODEL` | Embedding model to use | `nomic-embed-text` |
| `RAW_ROOT` | Absolute path to the project's `raw/` folder | `/home/michael/projects/fragments-of-mars/raw` |
| `DB_PATH` | Path to the sqlite-vec database file | `{WIKI_ROOT}/.embeddings.db` (default) |

---

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "latest",
  "better-sqlite3": "^9.x",
  "sqlite-vec": "^0.x",
  "natural": "^6.x",
  "gray-matter": "^4.x",
  "glob": "^10.x",
  "zod": "^3.x"
}
```

- **`@modelcontextprotocol/sdk`** — MCP server primitives
- **`better-sqlite3` + `sqlite-vec`** — local vector store, one `.db` file per wiki
- **`natural`** — BM25 implementation
- **`gray-matter`** — parse YAML frontmatter from wiki pages
- **`glob`** — enumerate wiki pages from filesystem
- **`zod`** — input validation for tool arguments

---

## Wiki Page Format

Every wiki page is a markdown file with YAML frontmatter:

```markdown
---
title: "AccessManager"
tags: [architecture, laravel, park-r]
related: ["DeviceVariant", "Location", "MQTT"]
created: 2026-05-01
updated: 2026-05-02
---

# AccessManager

One-paragraph summary of this concept.

## Overview
...

## Key Decisions
...

## Related
- [[DeviceVariant]]
- [[Location]]
```

The frontmatter fields `title`, `tags`, `related`, `updated` are required.
Claude Code is responsible for keeping these accurate when writing pages.

---

## MCP Tools

### 1. `wiki_get`

Fetch a single wiki page by name.

**Input:**
```ts
{ page: string }  // page name, e.g. "AccessManager" (without .md)
```

**Behavior:**
- Resolves `{WIKI_ROOT}/{page}.md`
- Returns full file contents as a string
- Returns a clear error if the page does not exist

**Output:** `{ content: string, path: string }`

---

### 2. `wiki_search`

Hybrid semantic + keyword search across all wiki pages.

**Input:**
```ts
{
  query: string,
  limit?: number,   // default: 5
  mode?: "hybrid" | "semantic" | "keyword"  // default: "hybrid"
}
```

**Behavior:**
- **Semantic path:** embed the query via Ollama → cosine similarity search in sqlite-vec → return top N chunks with their page names
- **Keyword path:** BM25 search over all page content → return top N matches
- **Hybrid path:** run both → combine results with Reciprocal Rank Fusion (RRF) → deduplicate by page → return top N
- Each result includes: page name, relevant excerpt, score

**Output:**
```ts
{
  results: Array<{
    page: string,
    excerpt: string,
    score: number,
    path: string
  }>
}
```

---

### 3. `wiki_update`

Create a new wiki page or update an existing one. Also re-embeds the page.

**Input:**
```ts
{
  page: string,         // page name (without .md)
  content: string,      // full markdown content including frontmatter
  reason?: string       // brief description of why this was updated
}
```

**Behavior:**
- Writes `{WIKI_ROOT}/{page}.md` with the provided content
- Validates that frontmatter contains required fields (`title`, `tags`, `updated`)
- Chunks the page content with `chunker.ts`
- Generates embeddings for all chunks via Ollama
- Upserts all chunk vectors into sqlite-vec (deletes old chunks for this page first)
- Returns confirmation with the number of chunks embedded

**Output:** `{ success: boolean, chunks_embedded: number, path: string }`

---

### 4. `wiki_ingest`

Process a raw source file from `raw/` into one or more wiki pages.

**Input:**
```ts
{
  file: string,         // filename relative to RAW_ROOT, e.g. "mqtt-auth-notes.md"
  hint?: string         // optional: tell Claude what this file is about
}
```

**Behavior:**
- Reads the file from `{RAW_ROOT}/{file}`
- Sends the file content + hint to the configured LLM (via Anthropic API or a local prompt) with instructions to:
  - Identify which wiki pages this content is relevant to
  - Extract new information for each relevant page
  - Return a list of `{ page, content }` updates
- For each update: calls `wiki_update` internally
- Raw file is not deleted (it stays in `raw/` as an immutable source)

**Note:** The ingest prompt is defined in `src/prompts/ingest.ts` and should be
tunable. It instructs the LLM to follow the wiki page format, use `[[wiki-links]]`
for cross-references, and not duplicate existing content.

**Output:**
```ts
{
  pages_updated: string[],
  pages_created: string[]
}
```

---

### 5. `wiki_lint`

Run a health check on the entire wiki and return a structured report.

**Input:** none

**Behavior:** Scans all `.md` files in `{WIKI_ROOT}` and checks for:

1. **Broken links** — `[[PageName]]` references where `PageName.md` does not exist
2. **Orphan pages** — pages with no incoming links from other pages
3. **Missing frontmatter fields** — pages lacking `title`, `tags`, or `updated`
4. **Stale embeddings** — pages whose `updated` frontmatter date is newer than their last embedding timestamp in the DB
5. **Referenced-but-missing concepts** — concept names mentioned in multiple pages that have no dedicated page (heuristic: capitalized noun phrases appearing 3+ times across pages without a matching `.md` file)

**Output:**
```ts
{
  broken_links: Array<{ page: string, link: string }>,
  orphan_pages: string[],
  missing_frontmatter: Array<{ page: string, missing: string[] }>,
  stale_embeddings: string[],
  missing_concepts: string[]
}
```

---

## lib/embedder.ts

Thin client for remote Ollama.

```ts
interface EmbedderConfig {
  ollamaUrl: string   // from env OLLAMA_URL
  model: string       // from env OLLAMA_MODEL
}

// Returns a float[] vector
async function embed(text: string): Promise<number[]>

// Batch embed, respects Ollama rate limits
async function embedBatch(texts: string[]): Promise<number[][]>
```

- Uses `fetch` against `{OLLAMA_URL}/api/embeddings`
- No external dependencies beyond Node built-ins

---

## lib/vector-store.ts

Wraps `better-sqlite3` + `sqlite-vec`.

```ts
// Initialize DB and create tables if not exist
function initDb(dbPath: string): Database

// Upsert chunk vectors for a page (deletes existing chunks for that page first)
function upsertPage(db: Database, page: string, chunks: ChunkVector[]): void

// Cosine similarity search, returns top K results
function searchSimilar(db: Database, queryVec: number[], k: number): SearchResult[]

// Get last embedded timestamp for a page
function getPageEmbedTime(db: Database, page: string): Date | null
```

**DB schema:**
```sql
CREATE TABLE wiki_chunks (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  page      TEXT NOT NULL,
  chunk_idx INTEGER NOT NULL,
  content   TEXT NOT NULL,
  embedded_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE wiki_vectors USING vec0(
  embedding FLOAT[768]   -- dimension matches nomic-embed-text
);
```

`wiki_chunks.rowid` maps 1:1 to `wiki_vectors.rowid`.

---

## lib/chunker.ts

Splits a markdown page into overlapping chunks for embedding.

**Strategy:**
- Split on `##` headings first — each section becomes a base chunk
- If a section exceeds 512 tokens, split further with a sliding window (256 token chunks, 64 token overlap)
- Always prepend the page title to every chunk for context
- Return `Array<{ chunk_idx: number, content: string }>`

---

## lib/bm25.ts

BM25 search over all wiki pages.

- On first call: loads all `.md` files from `WIKI_ROOT`, builds an in-memory BM25 index using `natural`
- Index is rebuilt when `wiki_update` or `wiki_ingest` is called (invalidate + lazy rebuild)
- `search(query: string, k: number): BM25Result[]`

---

## lib/rrf.ts

Reciprocal Rank Fusion combiner.

```ts
function reciprocalRankFusion(
  semantic: SearchResult[],
  keyword: BM25Result[],
  k?: number,       // RRF constant, default 60
  topN?: number     // results to return, default 5
): CombinedResult[]
```

Standard RRF formula: `score = Σ 1 / (k + rank)` per result across lists.
Results are deduplicated by page name before returning.

---

## Error Handling

- All tools return a structured error object on failure: `{ error: string, code: string }`
- Ollama connection failures are caught and reported clearly (not thrown)
- Missing `WIKI_ROOT` or `OLLAMA_URL` at startup → server exits with a descriptive message

---

## CLAUDE.md Snippet (per project)

Include this section in every project's `CLAUDE.md` to teach Claude Code when
to use the wiki tools:

```markdown
## Wiki Knowledge Base

This project has a wiki knowledge base managed via MCP tools.

### When to use wiki tools

- **Start of every task:** run `wiki_search` with 2-3 keywords from the task
  description to load relevant context before writing any code.
- **After implementing something new:** run `wiki_update` to record the
  design, key decisions, and any non-obvious behavior.
- **When uncertain about existing architecture:** run `wiki_search` before
  making assumptions — the answer is likely already documented.
- **Never design a new system** without first searching whether it already
  exists or was already decided against.

### Workflow

1. `wiki_search(keywords)` — load context
2. Do the work
3. `wiki_update(page, content)` — document what changed

### Ingesting new sources

When the user provides a document, notes, or specification:
1. Place it in `raw/` if not already there
2. Run `wiki_ingest(file)` to process it into the wiki
3. Do NOT manually summarize raw files into wiki pages — let ingest handle it

### Linting

Run `wiki_lint()` periodically (e.g. at the end of a large feature) to find
broken links, orphan pages, and missing concepts.
```

---

## .mcp.json (per project root)

```json
{
  "mcpServers": {
    "wiki": {
      "command": "node",
      "args": ["/home/michael/tools/wiki-mcp/dist/index.js"],
      "env": {
        "WIKI_ROOT": "/home/michael/projects/YOUR_PROJECT/wiki",
        "RAW_ROOT": "/home/michael/projects/YOUR_PROJECT/raw",
        "OLLAMA_URL": "http://YOUR_HOMELAB_IP:11434",
        "OLLAMA_MODEL": "nomic-embed-text"
      }
    }
  }
}
```

---

## Implementation Order for Claude Code

Build in this order to keep things testable at each step:

1. `config.ts` — env var loading + validation
2. `lib/wiki-fs.ts` — read/write wiki pages, list all pages
3. `lib/embedder.ts` — Ollama client, test against homelab
4. `lib/vector-store.ts` — sqlite-vec DB init, upsert, search
5. `lib/chunker.ts` — markdown chunker
6. `lib/bm25.ts` — BM25 index over wiki files
7. `lib/rrf.ts` — RRF combiner
8. `tools/wiki-get.ts` — simplest tool, good smoke test
9. `tools/wiki-update.ts` — write page + embed
10. `tools/wiki-search.ts` — hybrid search, wires everything together
11. `tools/wiki-ingest.ts` — ingest pipeline
12. `tools/wiki-lint.ts` — health check
13. `src/index.ts` — MCP server entrypoint, registers all tools
