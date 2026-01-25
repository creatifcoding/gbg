#!/bin/bash
# Fix bun's hoisted node_modules by creating symlinks for Theia CLI
# This is necessary because @theia/application-manager expects certain binaries
# to be in nested node_modules/.bin directories

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
THEIA_AM="$REPO_ROOT/node_modules/.bun/@theia+application-manager@1.55.0/node_modules/@theia/application-manager/node_modules/.bin"

mkdir -p "$THEIA_AM"

# Symlink webpack
WEBPACK_BIN="$REPO_ROOT/node_modules/.bun/webpack@5.*/node_modules/webpack/bin/webpack.js"
WEBPACK_ACTUAL=$(ls $WEBPACK_BIN 2>/dev/null | head -1)
if [ -n "$WEBPACK_ACTUAL" ]; then
  ln -sf "$WEBPACK_ACTUAL" "$THEIA_AM/webpack"
  echo "✓ Symlinked webpack"
fi

# Symlink http-server
HTTP_SERVER_BIN="$REPO_ROOT/node_modules/.bun/http-server@*/node_modules/http-server/bin/http-server"
HTTP_SERVER_ACTUAL=$(ls $HTTP_SERVER_BIN 2>/dev/null | head -1)
if [ -n "$HTTP_SERVER_ACTUAL" ]; then
  ln -sf "$HTTP_SERVER_ACTUAL" "$THEIA_AM/http-server"
  echo "✓ Symlinked http-server"
fi

echo "Bun symlinks fixed for Theia CLI compatibility"
