#!/usr/bin/env bash
# Re-vendor @uswriting/exiftool + @6over3/zeroperl-ts into capture/vendor/.
# Run from this file's directory: ./vendor.sh
set -euo pipefail

EXIFTOOL_VERSION="${EXIFTOOL_VERSION:-1.0.9}"
ZEROPERL_VERSION="${ZEROPERL_VERSION:-1.0.10}"
DROP_MAX_BYTES=$((25 * 1024 * 1024))

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENDOR="$ROOT/vendor"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "Downloading npm tarballs into $TMP"
curl -fsSL -o "$TMP/exiftool.tgz" \
  "https://registry.npmjs.org/@uswriting/exiftool/-/exiftool-${EXIFTOOL_VERSION}.tgz"
curl -fsSL -o "$TMP/zeroperl.tgz" \
  "https://registry.npmjs.org/@6over3/zeroperl-ts/-/zeroperl-ts-${ZEROPERL_VERSION}.tgz"

mkdir -p "$TMP/exiftool" "$TMP/zeroperl" "$VENDOR"
tar -xzf "$TMP/exiftool.tgz" -C "$TMP/exiftool"
tar -xzf "$TMP/zeroperl.tgz" -C "$TMP/zeroperl"

cp "$TMP/exiftool/package/dist/esm/index.js" "$VENDOR/exiftool.js"
cp "$TMP/zeroperl/package/dist/esm/index.js" "$VENDOR/zeroperl.js"
cp "$TMP/zeroperl/package/dist/esm/zeroperl.wasm" "$VENDOR/zeroperl.wasm"
if [[ -f "$TMP/exiftool/package/LICENSE" ]]; then
  cp "$TMP/exiftool/package/LICENSE" "$VENDOR/LICENSE-uswriting-exiftool.txt"
fi

python3 - "$VENDOR/exiftool.js" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
old = 'from"@6over3/zeroperl-ts"'
new = 'from"./zeroperl.js"'
if old not in text:
    raise SystemExit(f"expected {old!r} in {path}")
path.write_text(text.replace(old, new, 1))
print("patched exiftool.js import -> ./zeroperl.js")
PY

over=0
while IFS= read -r -d '' file; do
  size="$(stat -c%s "$file")"
  mib="$(awk -v s="$size" 'BEGIN { printf "%.3f", s / 1024 / 1024 }')"
  flag=""
  if (( size >= DROP_MAX_BYTES )); then
    flag=" OVER 25 MiB"
    over=1
  fi
  printf '%12s  %s MiB%s  %s\n' "$size" "$mib" "$flag" "${file#$VENDOR/}"
done < <(find "$VENDOR" -type f -print0 | sort -z)

if (( over )); then
  echo "error: a vendored file is at or over Cloudflare Drop's 25 MiB per-file limit" >&2
  exit 1
fi

cat > "$VENDOR/NOTICE.txt" <<EOF
Vendored for the static capture page (no npm/CDN at runtime).

@uswriting/exiftool ${EXIFTOOL_VERSION}  (Apache-2.0)
@6over3/zeroperl-ts ${ZEROPERL_VERSION}  (Apache-2.0)

Re-vendor: from packages/specimendb/capture run ./vendor.sh
EOF

echo "Vendored into $VENDOR"
