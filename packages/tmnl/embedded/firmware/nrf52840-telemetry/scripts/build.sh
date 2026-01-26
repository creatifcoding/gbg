#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
BOARD=${TMNL_NRF_BOARD:-nrf52840dk_nrf52840}
VENV_DIR=${TMNL_PY_VENV:-$ROOT_DIR/.venv}
VENV_PY="$VENV_DIR/bin/python"
WEST_BIN="$VENV_DIR/bin/west"

if [ -z "${ZEPHYR_SDK_INSTALL_DIR:-}" ]; then
  if command -v nix >/dev/null 2>&1; then
    exec nix develop ".#tmnl-embedded" -c "$0" "$@"
  fi

  echo "[tmnl-fw] nix not found. Run: nix develop .#tmnl-embedded" >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "[tmnl-fw] uv not found. Use the tmnl-embedded nix shell." >&2
  exit 1
fi

cd "$ROOT_DIR"

if [ ! -x "$VENV_PY" ]; then
  uv venv "$VENV_DIR"
fi

if [ ! -x "$WEST_BIN" ]; then
  uv pip install --python "$VENV_PY" west
fi

if [ ! -d "$ROOT_DIR/.west" ]; then
  "$WEST_BIN" init -l .
fi

"$WEST_BIN" update
"$WEST_BIN" zephyr-export

"$WEST_BIN" build -b "$BOARD" app -d "$BUILD_DIR"

echo "[tmnl-fw] build complete: $BUILD_DIR/zephyr/zephyr.elf"
