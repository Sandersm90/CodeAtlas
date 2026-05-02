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
         "args": ["${CLAUDE_PLUGIN_ROOT}/start.sh"],
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
