#!/usr/bin/env bash
# Harness remote WS server launcher
# Injects libstdc++.so.6 for native addons (DuckDB, msgpackr-extract) on NixOS

set -euo pipefail

# Resolve gcc runtime lib path via nix (cached after first eval)
if command -v nix &>/dev/null; then
  GCC_LIB=$(nix eval --raw nixpkgs#stdenv.cc.cc.lib 2>/dev/null || true)
  if [[ -n "$GCC_LIB" && -d "$GCC_LIB/lib" ]]; then
    export LD_LIBRARY_PATH="${GCC_LIB}/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  fi
fi

exec bun run scripts/harness-remote-ws-server.ts "$@"
