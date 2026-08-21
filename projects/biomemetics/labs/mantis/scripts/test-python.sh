#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PYTHONPATH="$workspace_dir/tooling/python/mantis-lab/src${PYTHONPATH:+:$PYTHONPATH}"

exec python3 -m unittest discover \
  -s "$workspace_dir/tooling/python/mantis-lab/tests" \
  -p 'test_*.py' \
  -v

