#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

status=0

echo "[effect-sui:audit] Effect boundary leakage"
if rg -n "throw new|throw error|Promise\.reject|new Promise|async function" src -g'*.ts'; then
  echo "[effect-sui:audit] Imperative error/async construct found in src" >&2
  status=1
fi

echo "[effect-sui:audit] Forbidden source imports"
if rg -n "from ['\"](\.\./\.\./|.*test/e2e|.*test/property|.*test/unit)" src -g'*.ts'; then
  echo "[effect-sui:audit] Source imports crossed into forbidden test/outside boundaries" >&2
  status=1
fi

echo "[effect-sui:audit] Runtime modules must not depend on testing helpers"
if find src -path 'src/testing' -prune -o -path 'src/index.ts' -prune -o -name '*.ts' -print | xargs rg -n "from ['\"].*/testing|from ['\"]\.\.?/testing"; then
  echo "[effect-sui:audit] Non-testing source imports testing helpers" >&2
  status=1
fi

exit "$status"
