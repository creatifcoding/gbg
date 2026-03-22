#!/bin/bash
# Ensure WASM still compiles after C++ changes
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/mathkernel
bash scripts/build-wasm.sh 2>&1 | tail -3
exit_code=$?
if [ $exit_code -ne 0 ]; then
  echo "BUILD FAILED"
  exit 1
fi
echo "BUILD OK"
