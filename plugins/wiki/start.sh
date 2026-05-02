#!/bin/sh
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ ! -d "$PLUGIN_DIR/node_modules" ]; then
  npm install --prefix "$PLUGIN_DIR" --omit=dev --silent
fi
exec node "$PLUGIN_DIR/dist/index.js"
