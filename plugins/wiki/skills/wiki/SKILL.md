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
