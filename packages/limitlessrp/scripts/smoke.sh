#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

bun run typecheck
bun run build
PYTHONPATH=python python -m limitlessrp.smoke
cargo test --manifest-path rust/limitlessrp-core/Cargo.toml
node -e 'const fs=require("fs"); JSON.parse(fs.readFileSync("data/sources/iridium.sources.json", "utf8")); console.log("source registry ok")'
test -f workflows/iridium-commodity-trade-analysis.prose.md
test -f workflows/iridium-research-scrape.prose.md
node dist/smoke.js
