#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p dist/nif

if [[ -f "priv/native/ava_bridge.so" ]]; then
  LIB_PATH="priv/native/ava_bridge.so"
elif [[ -f "priv/native/ava_bridge.dylib" ]]; then
  LIB_PATH="priv/native/ava_bridge.dylib"
elif [[ -f "priv/native/ava_bridge.dll" ]]; then
  LIB_PATH="priv/native/ava_bridge.dll"
else
  echo "No compiled NIF binary found under priv/native" >&2
  exit 1
fi

TARGET="${RUST_TARGET:-$(rustc -vV | awk '/host:/ {print $2}') }"
TARGET="${TARGET// /}"
VERSION="$(awk -F'"' '/version:/ {print $2; exit}' mix.exs)"
ARTIFACT_BASENAME="ava_bridge-${VERSION}-${TARGET}"
ARTIFACT_DIR="dist/nif/${ARTIFACT_BASENAME}"

rm -rf "$ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"
cp "$LIB_PATH" "$ARTIFACT_DIR/"

cat > "$ARTIFACT_DIR/metadata.json" <<EOF
{
  "version": "${VERSION}",
  "target": "${TARGET}",
  "library": "$(basename "$LIB_PATH")"
}
EOF

TARBALL="dist/nif/${ARTIFACT_BASENAME}.tar.gz"
rm -f "$TARBALL"
tar -czf "$TARBALL" -C "dist/nif" "${ARTIFACT_BASENAME}"

( cd dist/nif && sha256sum "${ARTIFACT_BASENAME}.tar.gz" > "${ARTIFACT_BASENAME}.sha256" )

echo "Built precompiled artifact: $TARBALL"
