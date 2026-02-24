#!/usr/bin/env bash
# Fix bun's hoisted node_modules by creating symlinks for Theia CLI
# This is necessary because @theia/application-manager expects certain binaries
# to be in nested node_modules/.bin directories
#
# Bun may add content hashes to package directory names (e.g. @1.55.0+4d97..),
# so we use a broad glob pattern to match any variant.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Resolve via the theia-ide symlink (bun sets this up correctly with hashes)
SCRIPT_PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -L "$SCRIPT_PKG_DIR/node_modules/@theia/application-manager" ]; then
  THEIA_AM_BASE="$(readlink -f "$SCRIPT_PKG_DIR/node_modules/@theia/application-manager")"
else
  # Fallback: glob match (prefer hashed variant)
  THEIA_AM_BASE=$(ls -d "$REPO_ROOT"/node_modules/.bun/@theia+application-manager@1.55.0*/node_modules/@theia/application-manager 2>/dev/null | sort -r | head -1)
fi

if [ -z "$THEIA_AM_BASE" ]; then
  echo "[fix-bun-symlinks] @theia/application-manager not found in node_modules/.bun, skipping"
  exit 0
fi

THEIA_AM_BIN="$THEIA_AM_BASE/node_modules/.bin"
mkdir -p "$THEIA_AM_BIN"

# Symlink webpack
WEBPACK_ACTUAL=$(ls "$REPO_ROOT"/node_modules/.bun/webpack@5.*/node_modules/webpack/bin/webpack.js 2>/dev/null | head -1)
if [ -n "$WEBPACK_ACTUAL" ]; then
  ln -sf "$WEBPACK_ACTUAL" "$THEIA_AM_BIN/webpack"
  echo "✓ Symlinked webpack -> $(basename "$(dirname "$(dirname "$(dirname "$WEBPACK_ACTUAL")")")")"
fi

# Symlink http-server
HTTP_SERVER_ACTUAL=$(ls "$REPO_ROOT"/node_modules/.bun/http-server@*/node_modules/http-server/bin/http-server 2>/dev/null | head -1)
if [ -n "$HTTP_SERVER_ACTUAL" ]; then
  ln -sf "$HTTP_SERVER_ACTUAL" "$THEIA_AM_BIN/http-server"
  echo "✓ Symlinked http-server -> $(basename "$(dirname "$(dirname "$(dirname "$HTTP_SERVER_ACTUAL")")")")"
fi

echo "Bun symlinks fixed for Theia CLI compatibility"
echo "  target: $THEIA_AM_BASE"
