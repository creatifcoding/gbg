#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$workspace_dir"
export PYTHONPATH="$workspace_dir/tooling/python/mantis-lab/src${PYTHONPATH:+:$PYTHONPATH}"

python3 scripts/validate-contracts.py
python3 -m mantis_lab.cli --workspace "$workspace_dir" check-workspace
python3 -m mantis_lab.cli --workspace "$workspace_dir" check-terrarium
bash scripts/test-python.sh
node --test tooling/typescript/mantis-lab/test/*.test.ts

# Reproducibility smoke: generate a fresh JSON manifest, then verify it through
# both implementations. This is not the reviewed release-integrity baseline.
mkdir -p evidence/generated
python3 -m mantis_lab.cli --workspace "$workspace_dir" manifest \
  --output evidence/generated/terrarium-draft-b.reproducibility-smoke.json \
  terrarium/cad/mantis_terrarium.scad \
  terrarium/schematics/schematics.pdf \
  terrarium/params.json \
  terrarium/bus.json
python3 -m mantis_lab.cli --workspace "$workspace_dir" verify-manifest \
  evidence/generated/terrarium-draft-b.reproducibility-smoke.json

# The checked-in baseline is the independent integrity gate for the complete
# current terrarium tree. It is generated only as an explicit release action.
(cd terrarium && sha256sum -c MANIFEST.sha256)

if command -v tsc >/dev/null 2>&1; then
  (cd tooling/typescript/mantis-lab && tsc --noEmit)
else
  echo "BLOCKED: tsc is absent; install the pinned package dependencies" >&2
  exit 69
fi

if command -v cargo >/dev/null 2>&1; then
  cargo test --manifest-path tooling/rust/mantis-lab-verifier/Cargo.toml
  cargo run --quiet --manifest-path tooling/rust/mantis-lab-verifier/Cargo.toml -- \
    --root "$workspace_dir" \
    --lab workspace.json \
    --manifest evidence/generated/terrarium-draft-b.reproducibility-smoke.json \
    > evidence/generated/terrarium-draft-b.rust-verification-report.json
else
  echo "BLOCKED: cargo is absent; enter nix develop .#fabrication" >&2
  exit 69
fi
