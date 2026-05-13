---
name: wiki-search
description: Search the wiki knowledge base
argument-hint: <query>
allowed-tools: mcp__codeatlas__wiki_search
---

Search the wiki for `$ARGUMENTS` using hybrid search.

Call `wiki_search` with `{ "query": "$ARGUMENTS", "mode": "hybrid", "limit": 5 }`.
Present results as a numbered list with page name and excerpt.
Offer to open any page in full with wiki_get.
