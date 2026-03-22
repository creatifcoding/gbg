#!/usr/bin/env node
/**
 * WASM Accuracy Benchmark
 *
 * Tests all 14 special functions against NIST/DLMF/Abramowitz&Stegun reference
 * values at multiple sample points. Reports max |relative error| per function.
 *
 * Primary metric: sum of -log10(max_rel_err) across all functions.
 *   Higher = more accurate. Each function contributes its "digits of accuracy."
 *   E.g. if max_rel_err = 1e-10, that function scores 10 digits.
 *
 * Reference values sourced from:
 *   - NIST DLMF (https://dlmf.nist.gov)
 *   - Abramowitz & Stegun Tables
 *   - Wolfram Alpha (cross-validated)
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadWasm() {
  const wasmPath = path.resolve(__dirname, "../dist/mathkernel.js");
  const mod = await import(wasmPath);
  return await mod.default();
}

// ── Reference data ─────────────────────────────────────────────────────────
// Format: [functionName, input(s), expectedValue, source]

type RefEntry = {
  fn: string;
  args: number[];
  expected: number;
  source: string;
};

const REFERENCES: RefEntry[] = [
  // ── Bessel J0 ──
  { fn: "bessel_j0", args: [0],    expected: 1.0,                  source: "DLMF 10.2" },
  { fn: "bessel_j0", args: [1],    expected: 0.7651976865579666,   source: "A&S Table 9.1" },
  { fn: "bessel_j0", args: [2.4048255577],  expected: 0.0,         source: "First zero of J0" },
  { fn: "bessel_j0", args: [5],    expected: -0.1775967713143383,  source: "A&S Table 9.1" },
  { fn: "bessel_j0", args: [10],   expected: -0.24593576445134832, source: "Cephes Python" },

  // ── Bessel J1 ──
  { fn: "bessel_j1", args: [0],    expected: 0.0,                  source: "DLMF 10.2" },
  { fn: "bessel_j1", args: [1],    expected: 0.4400505857449335,   source: "A&S Table 9.1" },
  { fn: "bessel_j1", args: [3.8317059702],  expected: 0.0,         source: "First zero of J1" },
  { fn: "bessel_j1", args: [5],    expected: -0.3275791375914652,  source: "A&S Table 9.1" },

  // ── Dawson ──
  { fn: "dawson", args: [0],       expected: 0.0,                  source: "Definition" },
  { fn: "dawson", args: [0.1],     expected: 0.09933599239785286,  source: "Wolfram" },
  { fn: "dawson", args: [0.5],     expected: 0.4244363835020223,   source: "A&S 7.1.17" },
  { fn: "dawson", args: [1.0],     expected: 0.5380795069127684,   source: "NIST" },
  { fn: "dawson", args: [2.0],     expected: 0.30134038892379196,  source: "Wolfram" },
  { fn: "dawson", args: [5.0],     expected: 0.10213407442427674,  source: "Simpson 1M quadrature" },

  // ── Fresnel S ──
  { fn: "fresnel_s", args: [0],    expected: 0.0,                  source: "Definition" },
  { fn: "fresnel_s", args: [0.5],  expected: 0.06473243285999929,  source: "A&S Table 7.5" },
  { fn: "fresnel_s", args: [1.0],  expected: 0.4382591473903548,   source: "A&S Table 7.5" },
  { fn: "fresnel_s", args: [2.0],  expected: 0.34341567836369824,  source: "A&S Table 7.5" },
  { fn: "fresnel_s", args: [3.0],  expected: 0.49631299896737496,  source: "Cephes Python" },

  // ── Fresnel C ──
  { fn: "fresnel_c", args: [0],    expected: 0.0,                  source: "Definition" },
  { fn: "fresnel_c", args: [0.5],  expected: 0.4923442258714464,   source: "A&S Table 7.5" },
  { fn: "fresnel_c", args: [1.0],  expected: 0.7798934003768228,   source: "A&S Table 7.5" },
  { fn: "fresnel_c", args: [2.0],  expected: 0.4882534060753408,   source: "A&S Table 7.5" },
  { fn: "fresnel_c", args: [3.0],  expected: 0.6057207892976857,   source: "Cephes Python" },

  // ── Sinc (normalized) ──
  { fn: "sinc", args: [0],         expected: 1.0,                  source: "Limit definition" },
  { fn: "sinc", args: [0.5],       expected: 0.6366197723675814,   source: "sin(π/2)/(π/2)" },
  { fn: "sinc", args: [1.0],       expected: 0.0,                  source: "sin(π)/π" },

  // ── Elliptic K (modulus k convention: m = k²) ──
  { fn: "elliptic_k", args: [0],     expected: 1.5707963267948966, source: "K(0) = π/2" },
  { fn: "elliptic_k", args: [0.5],   expected: 1.6857503548125961, source: "Cephes (modulus k=0.5)" },
  { fn: "elliptic_k", args: [0.9],   expected: 2.2805491384227703, source: "Cephes (modulus k=0.9)" },
  { fn: "elliptic_k", args: [0.99],  expected: 3.3566005233611915, source: "Cephes (modulus k=0.99)" },

  // ── Elliptic E (modulus k convention: m = k²) ──
  { fn: "elliptic_e", args: [0],     expected: 1.5707963267948966, source: "E(0) = π/2" },
  { fn: "elliptic_e", args: [0.5],   expected: 1.4674622093394272, source: "Cephes (modulus k=0.5)" },
  { fn: "elliptic_e", args: [0.9],   expected: 1.1716970527816142, source: "Cephes (modulus k=0.9)" },
  { fn: "elliptic_e", args: [1.0],   expected: 1.0,                source: "E(1) = 1" },

  // ── Gamma ──
  { fn: "gamma_fn", args: [0.5],   expected: 1.7724538509055159,   source: "Γ(1/2) = √π" },
  { fn: "gamma_fn", args: [1],     expected: 1.0,                  source: "Γ(1) = 0! = 1" },
  { fn: "gamma_fn", args: [5],     expected: 24.0,                 source: "Γ(5) = 4!" },
  { fn: "gamma_fn", args: [10],    expected: 362880.0,             source: "Γ(10) = 9!" },
  { fn: "gamma_fn", args: [0.25],  expected: 3.6256099082219083,   source: "Wolfram" },

  // ── Digamma ──
  { fn: "digamma", args: [1],      expected: -0.5772156649015329,  source: "ψ(1) = -γ (Euler-Mascheroni)" },
  { fn: "digamma", args: [2],      expected: 0.4227843350984671,   source: "ψ(2) = 1 - γ" },
  { fn: "digamma", args: [0.5],    expected: -1.9635100260214235,  source: "Wolfram" },
  { fn: "digamma", args: [10],     expected: 2.2517525890667211,   source: "Wolfram" },

  // ── Beta ──
  { fn: "beta_fn", args: [1, 1],   expected: 1.0,                  source: "B(1,1) = 1" },
  { fn: "beta_fn", args: [2, 3],   expected: 0.08333333333333333,  source: "B(2,3) = 1/12" },
  { fn: "beta_fn", args: [0.5, 0.5], expected: 3.141592653589793,  source: "B(1/2,1/2) = π" },

  // ── Erf ──
  { fn: "erf_fn", args: [0],       expected: 0.0,                  source: "erf(0) = 0" },
  { fn: "erf_fn", args: [0.5],     expected: 0.5204998778130465,   source: "A&S Table 7.1" },
  { fn: "erf_fn", args: [1.0],     expected: 0.8427007929497149,   source: "A&S Table 7.1" },
  { fn: "erf_fn", args: [2.0],     expected: 0.9953222650189527,   source: "A&S Table 7.1" },
  { fn: "erf_fn", args: [3.0],     expected: 0.9999779095030014,   source: "A&S 7.1 / Python math.erf" },

  // ── Bessel Jn (general order via Miller recurrence) ──
  { fn: "bessel_jn", args: [2, 1],  expected: 0.11490348493190048, source: "Wolfram J_2(1)" },
  { fn: "bessel_jn", args: [2, 5],  expected: 0.04656511627775222, source: "Wolfram J_2(5)" },
  { fn: "bessel_jn", args: [3, 2],  expected: 0.12894324947440205, source: "Wolfram J_3(2)" },
  { fn: "bessel_jn", args: [5, 3],  expected: 0.04302843487704758, source: "Python scipy J_5(3)" },

  // ── Log-Gamma ──
  { fn: "lgamma_fn", args: [1],    expected: 0.0,                  source: "log(Γ(1)) = log(1) = 0" },
  { fn: "lgamma_fn", args: [0.5],  expected: 0.5723649429247001,   source: "log(√π)" },
  { fn: "lgamma_fn", args: [5],    expected: 3.1780538303479458,   source: "log(4!) = log(24)" },
  { fn: "lgamma_fn", args: [10],   expected: 12.801827480081469,   source: "log(9!)" },
  { fn: "lgamma_fn", args: [100],  expected: 359.1342053695754,    source: "Wolfram" },

  // ── Bessel Y0 ──
  { fn: "bessel_y0", args: [0.5],  expected: -0.44451873350670656, source: "A&S Table 9.1" },
  { fn: "bessel_y0", args: [1],    expected: 0.08825696421567696,  source: "A&S Table 9.1" },
  { fn: "bessel_y0", args: [5],    expected: -0.30851762524903303, source: "Cephes Python" },

  // ── Erfc ──
  { fn: "erfc_fn", args: [0],      expected: 1.0,                  source: "erfc(0) = 1" },
  { fn: "erfc_fn", args: [0.5],    expected: 0.4795001221869535,   source: "Python math.erfc" },
  { fn: "erfc_fn", args: [1.0],    expected: 0.1572992070502851,   source: "1 - erf(1)" },
  { fn: "erfc_fn", args: [1.5],    expected: 0.033894853524689270, source: "Python math.erfc" },
  { fn: "erfc_fn", args: [2.0],    expected: 0.004677734981047266, source: "1 - erf(2)" },

  // ── Bessel Y1 ──
  { fn: "bessel_y1", args: [0.5],  expected: -1.4714723926702431, source: "A&S Table 9.1" },
  { fn: "bessel_y1", args: [1],    expected: -0.7812128213002887, source: "A&S Table 9.1" },
  { fn: "bessel_y1", args: [5],    expected: 0.14786314339122827, source: "Wronskian Python" },
  { fn: "bessel_y1", args: [10],   expected: 0.24901542420695388, source: "A&S Table 9.1" },

  // ── Modified Bessel I0 ──
  { fn: "bessel_i0", args: [0],    expected: 1.0,                  source: "Definition" },
  { fn: "bessel_i0", args: [1],    expected: 1.2660658777520082,   source: "A&S Table 9.8" },
  { fn: "bessel_i0", args: [5],    expected: 27.23987182360445,    source: "Series Python" },

  // ── Modified Bessel I1 ──
  { fn: "bessel_i1", args: [1],    expected: 0.5651591039924850,   source: "A&S Table 9.8" },
  { fn: "bessel_i1", args: [5],    expected: 24.33564214245053,    source: "Series Python" },

  // ── Exponential Integral E1 ──
  { fn: "expint_e1", args: [0.5],  expected: 0.5597735947761608,   source: "A&S Table 5.1" },
  { fn: "expint_e1", args: [1],    expected: 0.21938393439552027,  source: "A&S Table 5.1" },
  { fn: "expint_e1", args: [5],    expected: 0.0011482955912753258, source: "A&S Table 5.1" },

  // ── Modified Bessel K0 ──
  { fn: "bessel_k0", args: [0.5],  expected: 0.9244190712276659,   source: "Series Python" },
  { fn: "bessel_k0", args: [1],    expected: 0.42102443824070834,  source: "A&S Table 9.8" },
  { fn: "bessel_k0", args: [2],    expected: 0.11389387274953343,  source: "Python mpmath" },

  // ── Riemann Zeta ──
  { fn: "riemann_zeta", args: [3],  expected: 1.2020569031595942,  source: "Apéry's constant" },
  { fn: "riemann_zeta", args: [4],  expected: 1.0823232337111381,  source: "π⁴/90" },
  { fn: "riemann_zeta", args: [10], expected: 1.0009945751278180,  source: "Wolfram" },

  // ── Spence / Dilogarithm Li₂ ──
  { fn: "spence", args: [0],       expected: 0.0,                  source: "Definition" },
  { fn: "spence", args: [0.5],     expected: 0.5822405264650125,   source: "Wolfram" },
  { fn: "spence", args: [1],       expected: 1.6449340668482264,   source: "π²/6" },
  { fn: "spence", args: [-1],      expected: -0.8224670334241132,  source: "-π²/12" },

  // ── Trigamma ψ₁ ──
  { fn: "trigamma", args: [1],      expected: 1.6449340668482264,  source: "π²/6" },
  { fn: "trigamma", args: [2],      expected: 0.6449340668482264,  source: "π²/6 - 1" },
  { fn: "trigamma", args: [0.5],    expected: 4.934802200544679,   source: "Wolfram" },

  // ── Airy Ai ──
  { fn: "airy_ai", args: [0],      expected: 0.35502805388781724, source: "1/(3^{2/3}Γ(2/3))" },
  { fn: "airy_ai", args: [1],      expected: 0.13529241631288141, source: "A&S Table 10.11" },
  { fn: "airy_ai", args: [-1],     expected: 0.5355608832923521,  source: "A&S Table 10.11" },

  // ── Laguerre L_n ──
  { fn: "laguerre_l", args: [0, 1],   expected: 1.0,                source: "Definition" },
  { fn: "laguerre_l", args: [2, 1],   expected: -0.5,               source: "L2(1) = (1-2+1²/2)" },
  { fn: "laguerre_l", args: [5, 3],   expected: 0.85,               source: "Recurrence" },
  { fn: "laguerre_l", args: [10, 2],  expected: -0.30906525573192222, source: "Python recurrence" },

  // ── Hermite H_n ──
  { fn: "hermite_h", args: [2, 1],    expected: 2.0,                source: "4x²-2 at x=1" },
  { fn: "hermite_h", args: [3, 2],    expected: 40.0,               source: "8x³-12x at x=2" },
  { fn: "hermite_h", args: [5, 1],    expected: -8.0,               source: "Recurrence" },

  // ── Legendre P_n ──
  { fn: "legendre_p", args: [2, 0.5], expected: -0.125,             source: "(3x²-1)/2 at 0.5" },
  { fn: "legendre_p", args: [5, 0.5], expected: 0.08984375,         source: "Recurrence" },
  { fn: "legendre_p", args: [10, 0.5], expected: -0.18822860717773438, source: "Recurrence" },

  // ── Chebyshev T_n ──
  { fn: "chebyshev_t", args: [5, 0.5],  expected: 0.5,               source: "cos(5·arccos(0.5))" },
  { fn: "chebyshev_t", args: [10, 0.3], expected: 0.9955225088,      source: "cos(10·arccos(0.3))" },
  { fn: "chebyshev_t", args: [7, 0.9],  expected: -0.9998784,        source: "cos(7·arccos(0.9))" },
];

// ── Run benchmark ──────────────────────────────────────────────────────────

async function main() {
  const wasm = await loadWasm();

  const results: Map<string, { maxRelErr: number; maxAbsErr: number; tests: number; fails: string[] }> = new Map();

  for (const ref of REFERENCES) {
    if (!results.has(ref.fn)) {
      results.set(ref.fn, { maxRelErr: 0, maxAbsErr: 0, tests: 0, fails: [] });
    }
    const entry = results.get(ref.fn)!;
    entry.tests++;

    const fn = wasm[ref.fn];
    if (!fn) {
      entry.fails.push(`${ref.fn}(${ref.args.join(", ")}): FUNCTION NOT FOUND`);
      entry.maxRelErr = 1;
      continue;
    }

    let actual: number;
    try {
      actual = fn(...ref.args);
    } catch (e: any) {
      entry.fails.push(`${ref.fn}(${ref.args.join(", ")}): THREW ${e.message}`);
      entry.maxRelErr = 1;
      continue;
    }

    const absErr = Math.abs(actual - ref.expected);
    // For zero-expected values, use absolute error bounded by the function's
    // typical magnitude (1.0 for Bessel, etc.) to get meaningful "digits"
    const relErr = ref.expected === 0
      ? (actual === 0 ? 0 : Math.abs(actual))  // absolute when expected=0
      : absErr / Math.abs(ref.expected);

    // Skip zero-expected points from max relative error — they dominate unfairly
    if (ref.expected === 0) {
      // Still track absolute error for reporting
      entry.maxAbsErr = Math.max(entry.maxAbsErr, absErr);
      if (absErr > 1e-10) {
        entry.fails.push(
          `${ref.fn}(${ref.args.join(", ")}): got ${actual}, expected 0, absErr=${absErr.toExponential(3)}`
        );
      }
      continue;  // Don't let zero-expected inflate maxRelErr
    }

    entry.maxAbsErr = Math.max(entry.maxAbsErr, absErr);
    entry.maxRelErr = Math.max(entry.maxRelErr, relErr);

    if (relErr > 1e-4) {
      entry.fails.push(
        `${ref.fn}(${ref.args.join(", ")}): got ${actual}, expected ${ref.expected}, relErr=${relErr.toExponential(3)}`
      );
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────
  let totalDigits = 0;
  let totalFunctions = 0;

  console.log("\n┌─────────────────┬───────────┬──────────────┬───────────────┬───────┐");
  console.log("│ Function        │   Tests   │  Max RelErr  │  Digits Acc   │ Score │");
  console.log("├─────────────────┼───────────┼──────────────┼───────────────┼───────┤");

  const sorted = [...results.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [fn, data] of sorted) {
    totalFunctions++;
    const digits = data.maxRelErr > 0
      ? Math.max(0, -Math.log10(data.maxRelErr))
      : 16;  // Machine precision
    const cappedDigits = Math.min(digits, 16);
    totalDigits += cappedDigits;

    const status = cappedDigits >= 8 ? "✓" : cappedDigits >= 4 ? "~" : "✗";
    console.log(
      `│ ${fn.padEnd(15)} │ ${String(data.tests).padStart(5)}     │ ${data.maxRelErr.toExponential(3).padStart(12)} │ ${cappedDigits.toFixed(1).padStart(8)}      │   ${status}   │`
    );
  }

  console.log("├─────────────────┼───────────┼──────────────┼───────────────┼───────┤");
  console.log(
    `│ TOTAL           │ ${String(REFERENCES.length).padStart(5)}     │              │ ${totalDigits.toFixed(1).padStart(8)}      │       │`
  );
  console.log("└─────────────────┴───────────┴──────────────┴───────────────┴───────┘");

  // Print failures
  for (const [fn, data] of sorted) {
    for (const f of data.fails) {
      console.log(`  FAIL: ${f}`);
    }
  }

  // METRIC line for autoresearch
  console.log(`\nMETRIC total_digits=${totalDigits.toFixed(1)}`);
  console.log(`METRIC functions=${totalFunctions}`);
  console.log(`METRIC test_points=${REFERENCES.length}`);

  // Per-function digits as secondary metrics
  for (const [fn, data] of sorted) {
    const d = data.maxRelErr > 0 ? Math.max(0, -Math.log10(data.maxRelErr)) : 16;
    console.log(`METRIC ${fn}_digits=${Math.min(d, 16).toFixed(1)}`);
  }
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
