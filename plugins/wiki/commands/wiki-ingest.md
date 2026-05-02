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
