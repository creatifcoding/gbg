#!/usr/bin/env bash
# Patch generated index.js to include VANTA theme extension
# This runs after theia generate since our local extension isn't auto-discovered

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INDEX_JS="$SCRIPT_DIR/../src-gen/frontend/index.js"

if [ ! -f "$INDEX_JS" ]; then
    echo "[patch-vanta] index.js not found, skipping"
    exit 0
fi

# Check if already patched
if grep -q "VANTA Theme Extension" "$INDEX_JS" 2>/dev/null; then
    echo "[patch-vanta] Already patched"
    exit 0
fi

# Insert VANTA extension load before MonacoInit
sed -i "s|await load(container, require('@theia/output/lib/browser/output-frontend-module'));|await load(container, require('@theia/output/lib/browser/output-frontend-module'));\n\n        // TMNL VANTA Theme Extension (local)\n        await load(container, require('../../lib/browser/frontend-module'));|" "$INDEX_JS"

echo "[patch-vanta] Injected VANTA theme extension into index.js"
