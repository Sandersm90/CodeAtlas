---
name: wiki-lint
description: Run a health check on the wiki and report issues
allowed-tools: mcp__codeatlas__wiki_lint
---

Run `wiki_lint` and present the results in a readable summary.

Group the output into sections:
- 🔴 Broken links (fix immediately)
- 🟡 Stale embeddings (run wiki_update on each)
- 🟡 Missing concepts (consider creating pages)
- 🔵 Orphan pages (review if still relevant)
- 🔵 Missing frontmatter (fix formatting)

If everything is clean, say so clearly.
