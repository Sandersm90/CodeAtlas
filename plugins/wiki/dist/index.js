#!/usr/bin/env node
"use strict";
/**
 * index.ts
 *
 * MCP server entrypoint for wiki-mcp.
 * Registers all 5 wiki tools and starts the stdio transport.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const zod_1 = require("zod");
// Config is loaded (and validated) at import time — exits if required vars missing
const config_1 = require("./config");
// Tool handlers
const wiki_get_1 = require("./tools/wiki-get");
const wiki_search_1 = require("./tools/wiki-search");
const wiki_update_1 = require("./tools/wiki-update");
const wiki_ingest_1 = require("./tools/wiki-ingest");
const wiki_lint_1 = require("./tools/wiki-lint");
const wiki_delete_1 = require("./tools/wiki-delete");
const wiki_rename_1 = require("./tools/wiki-rename");
const wiki_context_for_1 = require("./tools/wiki-context-for");
const wiki_list_1 = require("./tools/wiki-list");
// Initialize DB at startup so errors surface early
const db_1 = require("./db");
/**
 * Converts a Zod schema to a JSON Schema object suitable for MCP tool definitions.
 */
function zodToJsonSchema(schema) {
    const shape = schema.shape;
    const properties = {};
    const required = [];
    for (const [key, field] of Object.entries(shape)) {
        const zodField = field;
        const isOptional = zodField instanceof zod_1.z.ZodOptional || zodField instanceof zod_1.z.ZodDefault;
        const innerField = isOptional
            ? zodField.unwrap?.() ?? zodField
            : zodField;
        const description = zodField.description ?? undefined;
        let type = "string";
        let extra = {};
        const unwrapped = innerField instanceof zod_1.z.ZodDefault
            ? innerField._def.innerType
            : innerField;
        if (unwrapped instanceof zod_1.z.ZodNumber) {
            type = "number";
        }
        else if (unwrapped instanceof zod_1.z.ZodBoolean) {
            type = "boolean";
        }
        else if (unwrapped instanceof zod_1.z.ZodEnum) {
            type = "string";
            extra["enum"] = unwrapped.options;
        }
        else if (unwrapped instanceof zod_1.z.ZodArray) {
            type = "array";
        }
        properties[key] = {
            type,
            ...(description ? { description } : {}),
            ...extra,
        };
        if (!isOptional) {
            required.push(key);
        }
    }
    return {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
    };
}
async function main() {
    // Initialize DB (detects embedding dim from Ollama if needed)
    try {
        await (0, db_1.initializeDb)();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[wiki-mcp] Failed to initialize database at "${config_1.config.dbPath}": ${message}`);
        process.exit(1);
    }
    const server = new index_js_1.Server({
        name: "wiki-mcp",
        version: "1.0.0",
    }, {
        capabilities: {
            tools: {},
        },
    });
    // --- List tools handler ---
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "wiki_get",
                    description: "Fetch a single wiki page by name. Returns the full markdown content including frontmatter.",
                    inputSchema: zodToJsonSchema(wiki_get_1.WikiGetSchema),
                },
                {
                    name: "wiki_search",
                    description: "Search the wiki using hybrid semantic + BM25 keyword search. Returns ranked results with excerpts.",
                    inputSchema: zodToJsonSchema(wiki_search_1.WikiSearchSchema),
                },
                {
                    name: "wiki_update",
                    description: "Create a new wiki page or update an existing one. Validates frontmatter, writes to disk, and re-embeds the page in the vector store.",
                    inputSchema: zodToJsonSchema(wiki_update_1.WikiUpdateSchema),
                },
                {
                    name: "wiki_ingest",
                    description: "Process a raw source file from RAW_ROOT into one or more wiki pages using Claude. The raw file is not deleted.",
                    inputSchema: zodToJsonSchema(wiki_ingest_1.WikiIngestSchema),
                },
                {
                    name: "wiki_lint",
                    description: "Run a health check on the entire wiki. Finds broken links, orphan pages, missing frontmatter, stale embeddings, and referenced-but-missing concepts.",
                    inputSchema: {
                        type: "object",
                        properties: {},
                    },
                },
                {
                    name: "wiki_delete",
                    description: "Delete a wiki page and remove its vectors from the database.",
                    inputSchema: zodToJsonSchema(wiki_delete_1.WikiDeleteSchema),
                },
                {
                    name: "wiki_rename",
                    description: "Rename a wiki page and atomically rewrite all [[links]] pointing to it across every page in the wiki.",
                    inputSchema: zodToJsonSchema(wiki_rename_1.WikiRenameSchema),
                },
                {
                    name: "wiki_list",
                    description: "List all wiki pages with their title, tags, and updated date. Optionally filter by tags.",
                    inputSchema: zodToJsonSchema(wiki_list_1.WikiListSchema),
                },
                {
                    name: "wiki_context_for",
                    description: "Given a source file path, extracts the filename and symbols (classes, functions, types) and returns the most relevant wiki pages. Use this when opening a file to automatically load relevant context without manually guessing search terms.",
                    inputSchema: zodToJsonSchema(wiki_context_for_1.WikiContextForSchema),
                },
            ],
        };
    });
    // --- Call tool handler ---
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            switch (name) {
                case "wiki_get": {
                    const input = wiki_get_1.WikiGetSchema.parse(args);
                    const result = await (0, wiki_get_1.wikiGet)(input);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                }
                case "wiki_search": {
                    const input = wiki_search_1.WikiSearchSchema.parse(args);
                    const result = await (0, wiki_search_1.wikiSearch)(input);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                }
                case "wiki_update": {
                    const input = wiki_update_1.WikiUpdateSchema.parse(args);
                    const result = await (0, wiki_update_1.wikiUpdate)(input);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                }
                case "wiki_ingest": {
                    const input = wiki_ingest_1.WikiIngestSchema.parse(args);
                    const result = await (0, wiki_ingest_1.wikiIngest)(input);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                }
                case "wiki_lint": {
                    const result = await (0, wiki_lint_1.wikiLint)();
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                }
                case "wiki_delete": {
                    const input = wiki_delete_1.WikiDeleteSchema.parse(args);
                    const result = await (0, wiki_delete_1.wikiDelete)(input);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                }
                case "wiki_rename": {
                    const input = wiki_rename_1.WikiRenameSchema.parse(args);
                    const result = await (0, wiki_rename_1.wikiRename)(input);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                }
                case "wiki_list": {
                    const input = wiki_list_1.WikiListSchema.parse(args);
                    const result = await (0, wiki_list_1.wikiList)(input);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                }
                case "wiki_context_for": {
                    const input = wiki_context_for_1.WikiContextForSchema.parse(args);
                    const result = await (0, wiki_context_for_1.wikiContextFor)(input);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                }
                default:
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ error: `Unknown tool: ${name}`, code: "UNKNOWN_TOOL" }),
                            },
                        ],
                        isError: true,
                    };
            }
        }
        catch (err) {
            // Handle Zod validation errors
            if (err instanceof zod_1.z.ZodError) {
                const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                error: `Invalid tool arguments: ${issues}`,
                                code: "VALIDATION_ERROR",
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            const message = err instanceof Error ? err.message : String(err);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: `Internal server error: ${message}`, code: "INTERNAL_ERROR" }),
                    },
                ],
                isError: true,
            };
        }
    });
    // Start stdio transport
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    // Log to stderr so it doesn't pollute the MCP stdio channel
    console.error(`[wiki-mcp] Server started. WIKI_ROOT=${config_1.config.wikiRoot}, OLLAMA_URL=${config_1.config.ollamaUrl}`);
}
main().catch((err) => {
    console.error(`[wiki-mcp] Fatal error:`, err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map