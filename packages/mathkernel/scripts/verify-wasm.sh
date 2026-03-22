#!/usr/bin/env bash
# Verify WASM build and smoke-test all kernel functions.
# Run from packages/mathkernel/ inside nix shell or via: nix shell nixpkgs#emscripten ...
set -euo pipefail

cd "$(dirname "$0")/.."

# Unset Nix host header pollution
unset CPATH C_INCLUDE_PATH CPLUS_INCLUDE_PATH NIX_CFLAGS_COMPILE NIX_LDFLAGS 2>/dev/null || true

echo "=== Building WASM ==="
mkdir -p build && cd build
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release 2>&1 | tail -3
cmake --build . --parallel 2>&1 | tail -3
cd ..

echo ""
echo "=== Build artifacts ==="
ls -lh dist/mathkernel.{wasm,js,d.ts}

echo ""
echo "=== Smoke test ==="
node -e "
import('./dist/mathkernel.js').then(async mod => {
  const mk = await mod.default();
  const A = new Float64Array([3,1,2,4]);
  const I = new Float64Array([1,0,0,1]);
  
  // mmult
  const r = mk.mmult(A, 2, 2, I, 2, 2);
  console.assert(r[0] === 3 && r[3] === 4, 'mmult failed');
  console.log('  ✓ mmult');
  
  // det
  console.assert(mk.det(A, 2) === 10, 'det failed');
  console.log('  ✓ det');
  
  // trace
  console.assert(mk.trace(A, 2) === 7, 'trace failed');
  console.log('  ✓ trace');
  
  // rank
  console.assert(mk.rank(A, 2, 2) === 2, 'rank failed');
  console.log('  ✓ rank');
  
  // solve
  const x = mk.solve(A, 2, new Float64Array([5,6]));
  console.assert(Math.abs(x[0] - 1.4) < 1e-10, 'solve failed');
  console.log('  ✓ solve');
  
  // inverse
  const inv = mk.inverse(A, 2);
  console.assert(Math.abs(inv[0] - 0.4) < 1e-10, 'inverse failed');
  console.log('  ✓ inverse');
  
  // transpose
  const At = mk.transpose(A, 2, 2);
  console.assert(At[1] === 2 && At[2] === 1, 'transpose failed');
  console.log('  ✓ transpose');
  
  // norm
  console.assert(mk.norm(A, 2, 2) > 5.47, 'norm failed');
  console.log('  ✓ norm');
  
  console.log('');
  console.log('✓ All 8 kernels verified');
}).catch(e => { console.error(e); process.exit(1); });
"
