#!/bin/sh
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
BINDING="$PLUGIN_DIR/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if [ ! -f "$BINDING" ]; then
  npm install --prefix "$PLUGIN_DIR" --omit=dev --silent
fi
exec node "$PLUGIN_DIR/dist/index.js"
