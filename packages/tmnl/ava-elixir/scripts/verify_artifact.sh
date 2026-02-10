#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/dist/nif"

shopt -s nullglob
checksum_files=( *.sha256 )

if [[ ${#checksum_files[@]} -eq 0 ]]; then
  echo "No .sha256 files found in dist/nif" >&2
  exit 1
fi

for checksum_file in "${checksum_files[@]}"; do
  echo "Verifying $checksum_file"
  sha256sum -c "$checksum_file"
done

echo "All artifact checksums verified"
