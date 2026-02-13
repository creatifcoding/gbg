#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MIX_HOME="${MIX_HOME:-$PWD/.nix-mix}"
HEX_HOME="${HEX_HOME:-$PWD/.nix-hex}"

mkdir -p "$MIX_HOME" "$HEX_HOME"

export MIX_HOME
export HEX_HOME
export PATH="$MIX_HOME/bin:$HEX_HOME/bin:$PATH"

if [[ -n "${ERL_LIBS:-}" ]]; then
  echo "[hex-repair] unsetting ERL_LIBS to avoid Hex archive conflicts"
  unset ERL_LIBS
fi

echo "[hex-repair] MIX_HOME=$MIX_HOME"
echo "[hex-repair] HEX_HOME=$HEX_HOME"

echo "[hex-repair] removing Hex archives"
rm -rf "$MIX_HOME/archives/hex"* "$MIX_HOME/archives/hex-"* 2>/dev/null || true

echo "[hex-repair] reinstalling Hex + Rebar"
mix local.hex --force
mix local.rebar --force

echo "[hex-repair] validating Hex"
mix hex.info

echo "[hex-repair] complete"
