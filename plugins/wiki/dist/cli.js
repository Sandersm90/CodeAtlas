#!/usr/bin/env node
"use strict";
// Entry point — routes to init CLI or MCP server based on argv.
// Must not import config at the top level: config calls process.exit if env vars missing.
const arg = process.argv[2];
if (arg === "init") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runInit } = require("./init");
    runInit(process.argv.slice(3)).catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}
else {
    require("./index");
}
//# sourceMappingURL=cli.js.map