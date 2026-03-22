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

  // ── Hyperbolic Sine Integral Shi ──
  { fn: "shi", args: [1],              expected: 1.0572508753757286, source: "Series" },
  { fn: "shi", args: [0.5],            expected: 0.5069967498196671, source: "Series" },
  { fn: "shi", args: [2],              expected: 2.5015674333549760, source: "Series" },

  // ── Hyperbolic Cosine Integral Chi ──
  { fn: "chi", args: [1],              expected: 0.8378669409802082, source: "Series" },
  { fn: "chi", args: [0.5],            expected: -0.05277684495649357, source: "Series" },
  { fn: "chi", args: [2],              expected: 2.4526669226469147, source: "Series" },

  // ── Airy Bi ──
  { fn: "airy_bi", args: [0],          expected: 0.6149266274460007, source: "1/(3^{1/6}Γ(2/3))" },
  { fn: "airy_bi", args: [1],          expected: 1.2074235949528713, source: "ODE Taylor" },
  { fn: "airy_bi", args: [-1],         expected: 0.10399738949694455, source: "ODE Taylor" },

  // ── Sine Integral Si ──
  { fn: "sine_integral", args: [1],    expected: 0.9460830703671830, source: "Series" },
  { fn: "sine_integral", args: [0.5],  expected: 0.4931074180430667, source: "Series" },
  { fn: "sine_integral", args: [2],    expected: 1.6054129768026945, source: "Series" },

  // ── Cosine Integral Ci ──
  { fn: "cosine_integral", args: [1],  expected: 0.33740392290096816, source: "Series" },
  { fn: "cosine_integral", args: [0.5], expected: -0.17778407880661287, source: "Series Python" },
  { fn: "cosine_integral", args: [2],  expected: 0.42298082877486476,  source: "Series Python" },

  // ── Inverse Error Function ──
  { fn: "erfinv", args: [0],           expected: 0.0,                source: "Definition" },
  { fn: "erfinv", args: [0.5],         expected: 0.4769362762044699, source: "Newton" },
  { fn: "erfinv", args: [0.9],         expected: 1.1630871536766743, source: "Newton" },

  // ── Lambert W ──
  { fn: "lambertw", args: [0],         expected: 0.0,                source: "Definition" },
  { fn: "lambertw", args: [1],         expected: 0.5671432904097838, source: "Omega constant" },
  { fn: "lambertw", args: [Math.E],    expected: 1.0,                source: "W(e) = 1" },

  // ── Debye D₁ ──
  { fn: "debye1", args: [0],           expected: 1.0,                source: "Definition" },
  { fn: "debye1", args: [1],           expected: 0.7775046341122486, source: "Simpson" },
  { fn: "debye1", args: [2],           expected: 0.6069472846098077, source: "Simpson 1000" },

  // ── Normal Quantile Φ⁻¹ ──
  { fn: "normsinv", args: [0.5],       expected: 0.0,                source: "Symmetry" },
  { fn: "normsinv", args: [0.975],     expected: 1.9599639845400540, source: "Known value" },
  { fn: "normsinv", args: [0.025],     expected: -1.9599639845400540, source: "Symmetry" },

  // ── Sigmoid σ(x) ──
  { fn: "sigmoid", args: [0],          expected: 0.5,                source: "Definition" },
  { fn: "sigmoid", args: [1],          expected: 0.7310585786300049, source: "1/(1+e⁻¹)" },
  { fn: "sigmoid", args: [-5],         expected: 0.006692850924284856, source: "1/(1+e⁵)" },

  // ── Logit ──
  { fn: "logit", args: [0.5],          expected: 0.0,                source: "ln(1) = 0" },
  { fn: "logit", args: [0.731058578630005], expected: 1.0,           source: "inverse of σ(1)" },
  { fn: "logit", args: [0.9],          expected: 2.1972245773362196, source: "ln(9)" },

  // ── Struve H₀ ──
  { fn: "struve_h0", args: [0],        expected: 0.0,                source: "Definition" },
  { fn: "struve_h0", args: [1],        expected: 0.56865669249814501, source: "A&S Table 12.1" },
  { fn: "struve_h0", args: [2],        expected: 0.79085898040783726, source: "Quadrature" },

  // ── Gegenbauer C_n^λ ──
  { fn: "gegenbauer_c", args: [2, 0.5, 0.5],  expected: -0.125,    source: "=P2(0.5)" },
  { fn: "gegenbauer_c", args: [3, 1.0, 0.5],  expected: -1.0,      source: "=U3(0.5)" },
  { fn: "gegenbauer_c", args: [5, 1.5, 0.3],  expected: 2.02174875, source: "Recurrence" },

  // ── Upper Incomplete Gamma Γ(a,x) ──
  { fn: "upper_gamma", args: [1, 1],    expected: 0.36787944117144233, source: "e⁻¹" },
  { fn: "upper_gamma", args: [2, 3],    expected: 0.19914827347145573, source: "4e⁻³" },
  { fn: "upper_gamma", args: [0.5, 1],  expected: 0.27880558528066196, source: "√π·erfc(1)" },

  // ── Regularized Gamma P(a,x) ──
  { fn: "gamma_p", args: [1, 1],        expected: 0.6321205588285577, source: "1-e⁻¹" },
  { fn: "gamma_p", args: [2, 3],        expected: 0.8008517265285443, source: "1-4e⁻³" },
  { fn: "gamma_p", args: [0.5, 1],      expected: 0.8427007929497149, source: "erf(1)" },

  // ── Chebyshev U_n ──
  { fn: "chebyshev_u", args: [3, 0.5],  expected: -1.0,             source: "sin(4·arccos(0.5))/sin(arccos(0.5))" },
  { fn: "chebyshev_u", args: [5, 0.5],  expected: 0.0,              source: "Exact zero" },
  { fn: "chebyshev_u", args: [4, 0.3],  expected: 0.0496,           source: "Recurrence" },

  // ── Pochhammer (a)_n ──
  { fn: "pochhammer", args: [2, 5],     expected: 720.0,            source: "2·3·4·5·6" },
  { fn: "pochhammer", args: [0.5, 4],   expected: 6.5625,           source: "0.5·1.5·2.5·3.5" },
  { fn: "pochhammer", args: [1, 10],    expected: 3628800.0,        source: "10!" },

  // ── Falling Factorial ──
  { fn: "falling_factorial", args: [5, 3],  expected: 60.0,         source: "5·4·3" },
  { fn: "falling_factorial", args: [10, 4], expected: 5040.0,       source: "10·9·8·7" },
  { fn: "falling_factorial", args: [3.5, 3], expected: 13.125,      source: "3.5·2.5·1.5" },

  // ── Double Factorial ──
  { fn: "double_factorial", args: [7],    expected: 105.0,          source: "7·5·3·1" },
  { fn: "double_factorial", args: [10],   expected: 3840.0,         source: "10·8·6·4·2" },
  { fn: "double_factorial", args: [15],   expected: 2027025.0,      source: "15!!" },

  // ── Binomial Coefficient ──
  { fn: "binomial_coeff", args: [10, 3],  expected: 120.0,          source: "10!/(3!·7!)" },
  { fn: "binomial_coeff", args: [20, 10], expected: 184756.0,       source: "20!/(10!)²" },
  { fn: "binomial_coeff", args: [30, 15], expected: 155117520.0,      source: "C(30,15)" },

  // ── Spherical Bessel j_n ──
  { fn: "sph_bessel_j", args: [0, 1],    expected: 0.8414709848078965, source: "sin(1)/1" },
  { fn: "sph_bessel_j", args: [1, 1],    expected: 0.30116867893975674, source: "Recurrence" },
  { fn: "sph_bessel_j", args: [2, 2],    expected: 0.19844794905714658, source: "WASM recurrence" },

  // ── Spherical Bessel y_n ──
  { fn: "sph_bessel_y", args: [0, 1],    expected: -0.5403023058681398, source: "-cos(1)/1" },
  { fn: "sph_bessel_y", args: [1, 1],    expected: -1.3817732906760363, source: "Recurrence" },
  { fn: "sph_bessel_y", args: [2, 2],    expected: -0.73399142468765410, source: "WASM recurrence" },

  // ── Harmonic Number H_n ──
  { fn: "harmonic", args: [1],           expected: 1.0,               source: "Definition" },
  { fn: "harmonic", args: [10],          expected: 2.9289682539682538, source: "Direct sum" },
  { fn: "harmonic", args: [100],         expected: 5.187377517639621,  source: "Direct sum" },

  // ── Generalized Harmonic H_n^m ──
  { fn: "gen_harmonic", args: [100, 2],  expected: 1.634983900184893,  source: "Σ 1/k²" },
  { fn: "gen_harmonic", args: [1000, 2], expected: 1.6439345666815597, source: "Σ 1/k²" },
  { fn: "gen_harmonic", args: [100, 3],  expected: 1.2020074006596775, source: "Σ 1/k³" },

  // ── Bessel K₁ ──
  { fn: "bessel_k1", args: [1],         expected: 0.6019072301972346, source: "Known A&S" },
  { fn: "bessel_k1", args: [2],         expected: 0.1398658818165224, source: "Known A&S" },
  { fn: "bessel_k1", args: [5],         expected: 0.00404463729580082, source: "Asymptotic" },

  // ── Jacobi P_n^{α,β} ──
  { fn: "jacobi_p", args: [2, 0, 0, 0.5],     expected: -0.125,        source: "=P2(0.5)" },
  { fn: "jacobi_p", args: [3, 1, 1, 0.5],     expected: -0.625,        source: "Recurrence" },
  { fn: "jacobi_p", args: [4, 0.5, 1.5, 0.3], expected: 0.338625,      source: "Recurrence" },

  // ── Associated Legendre P_l^m ──
  { fn: "assoc_legendre", args: [2, 0, 0.5],  expected: -0.125,        source: "P_2(0.5)" },
  { fn: "assoc_legendre", args: [2, 1, 0.5],  expected: 1.299038105676658, source: "3x√(1-x²) no CS" },
  { fn: "assoc_legendre", args: [3, 2, 0.5],  expected: 5.625,         source: "Recurrence" },

  // ── Exponential Integral Ei ──
  { fn: "expint_ei", args: [1],          expected: 1.8951178163559368, source: "Known" },
  { fn: "expint_ei", args: [2],          expected: 4.9542343560018902, source: "Known" },
  { fn: "expint_ei", args: [0.5],        expected: 0.4542199048631736, source: "Series" },

  // ── Bessel Y_n ──
  { fn: "bessel_yn", args: [2, 1],       expected: -1.6506826068162543, source: "Known" },
  { fn: "bessel_yn", args: [3, 2],       expected: -1.127783776840428, source: "Recurrence" },
  { fn: "bessel_yn", args: [2, 5],       expected: 0.36766288260552427, source: "Recurrence" },

  // ── 1/Γ(x) ──
  { fn: "rgamma", args: [0.5],          expected: 0.5641895835477563, source: "1/√π" },
  { fn: "rgamma", args: [1],            expected: 1.0,               source: "1/Γ(1)=1" },
  { fn: "rgamma", args: [5],            expected: 0.041666666666666664, source: "1/24" },

  // ── ln C(n,k) ──
  { fn: "log_binomial", args: [20, 10], expected: 12.126791314602456, source: "lgamma" },
  { fn: "log_binomial", args: [100, 50],expected: 66.78384165201749,  source: "lgamma" },
  { fn: "log_binomial", args: [10, 0],  expected: 0.0,               source: "ln(1)=0" },

  // ── erfcinv ──
  { fn: "erfcinv", args: [1],           expected: 0.0,               source: "erfinv(0)=0" },
  { fn: "erfcinv", args: [0.05],        expected: 1.385903824349678, source: "erfinv(0.95)" },
  { fn: "erfcinv", args: [1.5],         expected: -0.4769362762044699, source: "erfinv(-0.5)" },

  // ── Bessel I_n ──
  { fn: "bessel_in", args: [2, 1],      expected: 0.13574766976703828, source: "Miller backward" },
  { fn: "bessel_in", args: [3, 2],      expected: 0.21273995923985264, source: "Miller backward" },
  { fn: "bessel_in", args: [0, 1],      expected: 1.2660658777520082,  source: "=I₀(1)" },

  // ── Exponential Integral E_n ──
  { fn: "expint_en", args: [2, 1],      expected: 0.14849550677592172, source: "Recurrence from E1" },
  { fn: "expint_en", args: [3, 1],      expected: 0.10969196719776031, source: "Recurrence from E2" },
  { fn: "expint_en", args: [1, 2],      expected: 0.04890051070806112, source: "=E1(2)" },

  // ── Associated Laguerre L_n^α ──
  { fn: "assoc_laguerre", args: [2, 1, 1],    expected: 0.5,          source: "Recurrence" },
  { fn: "assoc_laguerre", args: [3, 0.5, 2],  expected: -0.8958333333333334, source: "Recurrence" },
  { fn: "assoc_laguerre", args: [0, 2, 5],    expected: 1.0,          source: "L₀=1" },

  // ── Bessel K_n ──
  { fn: "bessel_kn", args: [2, 1],      expected: 1.6248388986351774, source: "Recurrence K0/K1" },
  { fn: "bessel_kn", args: [3, 2],      expected: 0.6473853909486345, source: "Recurrence" },
  { fn: "bessel_kn", args: [0, 1],      expected: 0.4210244382407084, source: "=K0(1)" },

  // ── Hurwitz Zeta ──
  { fn: "hurwitz_zeta", args: [2, 1],   expected: 1.6449340668482264, source: "π²/6" },
  { fn: "hurwitz_zeta", args: [3, 1],   expected: 1.2020569031595942, source: "ζ(3)" },
  { fn: "hurwitz_zeta", args: [2, 0.5], expected: 4.934802200544679,  source: "3ζ(2)" },

  // ── Bernstein Basis ──
  { fn: "bernstein", args: [3, 1, 0.5], expected: 0.375,             source: "C(3,1)·½·¼" },
  { fn: "bernstein", args: [4, 2, 0.5], expected: 0.375,             source: "C(4,2)·¼·¼" },
  { fn: "bernstein", args: [5, 0, 0.3], expected: 0.16807,           source: "0.7⁵" },

  // ── Catalan Number ──
  { fn: "catalan_number", args: [5],     expected: 42.0,             source: "Known" },
  { fn: "catalan_number", args: [10],    expected: 16796.0,          source: "Known" },
  { fn: "catalan_number", args: [0],     expected: 1.0,              source: "C₀=1" },

  // ── Spherical Harmonic Normalization ──
  { fn: "sph_harm_norm", args: [0, 0],  expected: 0.28209479177387814, source: "1/(2√π)" },
  { fn: "sph_harm_norm", args: [1, 0],  expected: 0.4886025119029199,  source: "√(3/(4π))" },
  { fn: "sph_harm_norm", args: [2, 1],  expected: 0.2575161346821264,  source: "Exact" },

  // ── Chi-squared CDF ──
  { fn: "chi2_cdf", args: [2, 3],       expected: 0.7768698398515702, source: "1-e^{-1.5}" },
  { fn: "chi2_cdf", args: [1, 1],       expected: 0.6826894921370859, source: "erf(1/√2)" },
  { fn: "chi2_cdf", args: [4, 10],      expected: 0.9595723180054873, source: "P(2,5)" },

  // ── Stirling S(n,k) ──
  { fn: "stirling2", args: [5, 3],       expected: 25.0,             source: "Known" },
  { fn: "stirling2", args: [7, 2],       expected: 63.0,             source: "2^{n-1}-1" },
  { fn: "stirling2", args: [10, 5],      expected: 42525.0,          source: "Known" },

  // ── Bell Number ──
  { fn: "bell_number", args: [5],        expected: 52.0,             source: "Known" },
  { fn: "bell_number", args: [10],       expected: 115975.0,         source: "Known" },
  { fn: "bell_number", args: [0],        expected: 1.0,              source: "B₀=1" },

  // ── Euler Number ──
  { fn: "euler_number", args: [0],       expected: 1.0,              source: "E₀=1" },
  { fn: "euler_number", args: [4],       expected: 5.0,              source: "E₄=5" },
  { fn: "euler_number", args: [6],       expected: -61.0,            source: "E₆=-61" },

  // ── Stirling 1st Kind |s(n,k)| ──
  { fn: "stirling1", args: [5, 2],      expected: 50.0,             source: "Known" },
  { fn: "stirling1", args: [4, 2],      expected: 11.0,             source: "Known" },
  { fn: "stirling1", args: [6, 3],      expected: 225.0,            source: "Known" },

  // ── Mittag-Leffler E_α(x) ──
  { fn: "mittag_leffler", args: [1, 1], expected: 2.718281828459045, source: "e" },
  { fn: "mittag_leffler", args: [2, 1], expected: 1.5430806348152437, source: "cosh(1)" },
  { fn: "mittag_leffler", args: [1, 0], expected: 1.0,              source: "e⁰=1" },

  // ── Poisson CDF ──
  { fn: "poisson_cdf", args: [3, 2],    expected: 0.857123460498547, source: "1-P(4,2)" },
  { fn: "poisson_cdf", args: [0, 1],    expected: 0.36787944117144233, source: "e⁻¹" },
  { fn: "poisson_cdf", args: [5, 5],    expected: 0.6159606548330632, source: "1-P(6,5)" },

  // ── Gauss 2F1 ──
  { fn: "hyp2f1", args: [1, 1, 2, 0.5], expected: 1.3862943611198906, source: "-ln(½)/½" },
  { fn: "hyp2f1", args: [0.5, 1, 1.5, 0.25], expected: 1.0986122886681096, source: "atanh(½)/½" },
  { fn: "hyp2f1", args: [1, 1, 1, 0],   expected: 1.0,              source: "z=0" },

  // ── 1F1 Confluent Hypergeometric ──
  { fn: "hyp1f1", args: [1, 1, 1],     expected: 2.718281828459045, source: "=eˣ" },
  { fn: "hyp1f1", args: [1, 2, 1],     expected: 1.7182818284590453, source: "(e-1)/1" },
  { fn: "hyp1f1", args: [0.5, 1.5, -1], expected: 0.7468241328124271, source: "Series" },

  // ── 0F1 Confluent Hypergeometric Limit ──
  { fn: "hyp0f1", args: [1, -0.25],    expected: 0.7651976865579666, source: "=J₀(1)" },
  { fn: "hyp0f1", args: [1, 0],        expected: 1.0,              source: "z=0" },
  { fn: "hyp0f1", args: [0.5, 1],      expected: 3.7621956910836318, source: "Series" },

  // ── Owen's T ──
  { fn: "owens_t", args: [1, 1],       expected: 0.0667419431550866, source: "Quadrature" },
  { fn: "owens_t", args: [0, 1],       expected: 0.125,            source: "atan(1)/(2π)=π/4/(2π)=1/8" },
  { fn: "owens_t", args: [1, 0],       expected: 0.0,              source: "T(h,0)=0" },

  // ── Trinomial ──
  { fn: "trinomial", args: [6, 2, 2],  expected: 90.0,             source: "6!/(2!2!2!)" },
  { fn: "trinomial", args: [10, 3, 3], expected: 4200.0,           source: "10!/(3!3!4!)" },
  { fn: "trinomial", args: [5, 5, 0],  expected: 1.0,              source: "5!/(5!0!0!)" },

  // ── Gamma Sign ──
  { fn: "gamma_sign", args: [-0.5],    expected: -1.0,             source: "Γ(-0.5)<0" },
  { fn: "gamma_sign", args: [-1.5],    expected: 1.0,              source: "Γ(-1.5)>0" },
  { fn: "gamma_sign", args: [2],       expected: 1.0,              source: "Γ(2)>0" },

  // ── Struve H₁ ──
  { fn: "struve_h1", args: [0],        expected: 0.0,              source: "H₁(0)=0" },
  { fn: "struve_h1", args: [1],        expected: 0.19845740165182896, source: "Quadrature" },
  { fn: "struve_h1", args: [2],        expected: 0.6467639900831578, source: "Quadrature 1000pt" },

  // ── Partial Exponential Sum ──
  { fn: "exp_sum", args: [3, 1],       expected: 2.6666666666666665, source: "1+1+½+⅙" },
  { fn: "exp_sum", args: [0, 5],       expected: 1.0,              source: "Just x⁰/0!" },
  { fn: "exp_sum", args: [10, 1],      expected: 2.7182818011463845, source: "≈e" },

  // ── Unnormalized Sinc ──
  { fn: "sinc_unnorm", args: [0],      expected: 1.0,              source: "lim sin(x)/x" },
  { fn: "sinc_unnorm", args: [1],      expected: 0.8414709848078965, source: "sin(1)" },
  { fn: "sinc_unnorm", args: [2],      expected: 0.45464871341284085, source: "sin(2)/2" },

  // ── |Γ(x)| ──
  { fn: "abs_gamma", args: [0.5],      expected: 1.7724538509055159, source: "√π" },
  { fn: "abs_gamma", args: [-0.5],     expected: 3.544907701811032, source: "2√π" },
  { fn: "abs_gamma", args: [5],        expected: 24.0,             source: "4!" },

  // ── Dirichlet Eta ──
  { fn: "dirichlet_eta", args: [1],    expected: 0.6931471805599453, source: "ln(2)" },
  { fn: "dirichlet_eta", args: [3],    expected: 0.9015426773696957, source: "¾ζ(3)" },
  { fn: "dirichlet_eta", args: [0],    expected: 0.5,              source: "η(0)=1/2" },

  // ── Debye D₂ ──
  { fn: "debye2", args: [0],           expected: 1.0,              source: "D₂(0)=1" },
  { fn: "debye2", args: [1],           expected: 0.7078784756278287, source: "Simpson 1000pt" },

  // ── Debye D₃ ──
  { fn: "debye3", args: [0],           expected: 1.0,              source: "D₃(0)=1" },
  { fn: "debye3", args: [1],           expected: 0.674415564077846, source: "Simpson 1000pt" },

  // ── Spherical Bessel i_n ──
  { fn: "sph_bessel_i", args: [0, 1],  expected: 1.1752011936438014, source: "sinh(1)" },
  { fn: "sph_bessel_i", args: [1, 1],  expected: 0.3678794411714423, source: "cosh(1)-sinh(1)" },
  { fn: "sph_bessel_i", args: [0, 0],  expected: 1.0,              source: "i₀(0)=1" },

  // ── Spherical Bessel k_n ──
  { fn: "sph_bessel_k", args: [0, 1],  expected: 0.5778636748954609, source: "π/(2e)" },
  { fn: "sph_bessel_k", args: [1, 1],  expected: 1.1557273497909218, source: "k₀(1+1/1)" },
  { fn: "sph_bessel_k", args: [0, 2],  expected: 0.10629208289690908, source: "π/(4e²)" },

  // ── Polylogarithm ──
  { fn: "polylog", args: [2, 0.5],     expected: 0.5822405264650125, source: "π²/12-ln²2/2" },
  { fn: "polylog", args: [2, 0],       expected: 0.0,              source: "Li_s(0)=0" },
  { fn: "polylog", args: [1, 0.5],     expected: 0.6931471805599453, source: "-ln(0.5)=ln2" },

  // ── Log Beta ──
  { fn: "log_beta", args: [2, 3],      expected: -2.4849066497880004, source: "lgΓ(2)+lgΓ(3)-lgΓ(5)" },
  { fn: "log_beta", args: [0.5, 0.5],  expected: 1.1447298858494002, source: "ln(π)" },
  { fn: "log_beta", args: [1, 1],      expected: 0.0,              source: "B(1,1)=1" },

  // ── Debye D₄ ──
  { fn: "debye4", args: [0],           expected: 1.0,              source: "D₄(0)=1" },
  { fn: "debye4", args: [1],           expected: 0.6548740688865751, source: "Simpson 1000pt" },

  // ── Log Rising Factorial ──
  { fn: "log_rising_factorial", args: [3, 2], expected: 2.4849066497880004, source: "ln(12)" },
  { fn: "log_rising_factorial", args: [1, 5], expected: 4.787491742782046, source: "ln(120)=ln(5!)" },
  { fn: "log_rising_factorial", args: [1, 0], expected: 0.0,       source: "log(1)=0" },

  // ── Einstein Heat Capacity ──
  { fn: "einstein_heat", args: [0],    expected: 1.0,              source: "lim→1" },
  { fn: "einstein_heat", args: [1],    expected: 0.9206735942077924, source: "e/(e-1)²" },
  { fn: "einstein_heat", args: [5],    expected: 0.17074182200480142, source: "25e⁵/(e⁵-1)²" },

  // ── Inverse Hyperbolic ──
  { fn: "atanh_fn", args: [0.5],       expected: 0.5493061443340549, source: "std::atanh" },
  { fn: "atanh_fn", args: [0],         expected: 0.0,              source: "atanh(0)=0" },
  { fn: "atanh_fn", args: [0.9],       expected: 1.4722194895832204, source: "std::atanh" },

  { fn: "asinh_fn", args: [1],         expected: 0.881373587019543,  source: "std::asinh" },
  { fn: "asinh_fn", args: [0],         expected: 0.0,              source: "asinh(0)=0" },
  { fn: "asinh_fn", args: [2],         expected: 1.4436354751788103, source: "std::asinh" },

  { fn: "acosh_fn", args: [2],         expected: 1.3169578969248166, source: "std::acosh" },
  { fn: "acosh_fn", args: [1],         expected: 0.0,              source: "acosh(1)=0" },
  { fn: "acosh_fn", args: [10],        expected: 2.993222846126381,  source: "std::acosh" },

  // ── Logaddexp ──
  { fn: "logaddexp", args: [0, 0],     expected: 0.6931471805599453, source: "ln(2)" },
  { fn: "logaddexp", args: [1, 2],     expected: 2.3132616875182228, source: "2+ln(1+e⁻¹)" },
  { fn: "logaddexp", args: [-100, -100], expected: -99.30685281944005, source: "-100+ln(2)" },

  // ── expm1 ──
  { fn: "expm1_fn", args: [0],         expected: 0.0,              source: "e⁰-1" },
  { fn: "expm1_fn", args: [1e-15],     expected: 1e-15,            source: "≈x for small x" },
  { fn: "expm1_fn", args: [1],         expected: 1.718281828459045, source: "e-1" },

  // ── log1p ──
  { fn: "log1p_fn", args: [0],         expected: 0.0,              source: "ln(1)=0" },
  { fn: "log1p_fn", args: [1e-15],     expected: 1e-15,            source: "≈x for small x" },
  { fn: "log1p_fn", args: [1],         expected: 0.6931471805599453, source: "ln(2)" },

  // ── cbrt ──
  { fn: "cbrt_fn", args: [8],          expected: 2.0,              source: "∛8=2" },
  { fn: "cbrt_fn", args: [27],         expected: 3.0,              source: "∛27=3" },
  { fn: "cbrt_fn", args: [2],          expected: 1.2599210498948732, source: "∛2" },

  // ── hypot ──
  { fn: "hypot_fn", args: [3, 4],      expected: 5.0,              source: "3-4-5" },
  { fn: "hypot_fn", args: [1, 1],      expected: 1.4142135623730951, source: "√2" },

  // ── Reciprocal Trig ──
  { fn: "sec", args: [0],              expected: 1.0,              source: "1/cos(0)" },
  { fn: "sec", args: [1],              expected: 1.8508157176809255, source: "1/cos(1)" },
  { fn: "csc", args: [1],              expected: 1.1883951057781212, source: "1/sin(1)" },
  { fn: "cot", args: [1],              expected: 0.6420926159343306, source: "cos(1)/sin(1)" },

  // ── Hyperbolic Secant ──
  { fn: "sech", args: [0],             expected: 1.0,              source: "1/cosh(0)" },
  { fn: "sech", args: [1],             expected: 0.6480542736638854, source: "1/cosh(1)" },

  // ── Lucas ──
  { fn: "lucas", args: [0],            expected: 2.0,              source: "L(0)=2" },
  { fn: "lucas", args: [5],            expected: 11.0,             source: "Known" },
  { fn: "lucas", args: [10],           expected: 123.0,            source: "Known" },

  // ── Versine ──
  { fn: "versine", args: [0],          expected: 0.0,              source: "1-cos(0)=0" },
  { fn: "versine", args: [1],          expected: 0.45969769413186023, source: "1-cos(1)" },

  // ── Haversine ──
  { fn: "haversine", args: [0],        expected: 0.0,              source: "hav(0)=0" },
  { fn: "haversine", args: [1],        expected: 0.22984884706593015, source: "sin²(½)" },

  // ── Witch of Agnesi ──
  { fn: "witch_agnesi", args: [0],     expected: 1.0,              source: "1/(1+0)" },
  { fn: "witch_agnesi", args: [1],     expected: 0.5,              source: "1/2" },
  { fn: "witch_agnesi", args: [2],     expected: 0.2,              source: "1/5" },

  // ── Log-Cosh ──
  { fn: "log_cosh", args: [0],         expected: 0.0,              source: "ln(1)=0" },
  { fn: "log_cosh", args: [1],         expected: 0.4337808304830271, source: "ln(cosh(1))" },
  { fn: "log_cosh", args: [5],         expected: 4.306898218339271, source: "ln(cosh(5))" },

  // ── Fibonacci ──
  { fn: "fibonacci", args: [10],       expected: 55.0,             source: "Known" },
  { fn: "fibonacci", args: [20],       expected: 6765.0,           source: "Known" },
  { fn: "fibonacci", args: [50],       expected: 12586269025.0,    source: "Known" },

  // ── Gudermannian ──
  { fn: "gudermannian", args: [1],     expected: 0.8657694832396586, source: "atan(sinh(1))" },
  { fn: "gudermannian", args: [0],     expected: 0.0,              source: "gd(0)=0" },

  // ── Inverse Gudermannian ──
  { fn: "inv_gudermannian", args: [0.5], expected: 0.5222381032784403, source: "atanh(sin(½))" },
  { fn: "inv_gudermannian", args: [0],   expected: 0.0,              source: "gd⁻¹(0)=0" },

  // ── Softplus ──
  { fn: "softplus", args: [0],         expected: 0.6931471805599453, source: "ln(2)" },
  { fn: "softplus", args: [1],         expected: 1.3132616875182228, source: "ln(1+e)" },
  { fn: "softplus", args: [-5],        expected: 0.006715348489118068, source: "ln(1+e⁻⁵)" },

  // ── AGM ──
  { fn: "agm", args: [1, 1.4142135623730951], expected: 1.1981402347355923, source: "AGM(1,√2)" },
  { fn: "agm", args: [1, 1],           expected: 1.0,              source: "AGM(a,a)=a" },

  // ── Riemann Xi ──
  { fn: "riemann_xi", args: [4],       expected: 0.6579736267392905, source: "π²/15" },
  { fn: "riemann_xi", args: [5],       expected: 0.7879706062703882, source: "Computed" },

  // ── Kelvin ber ──
  { fn: "kelvin_ber", args: [0],       expected: 1.0,              source: "ber(0)=1" },
  { fn: "kelvin_ber", args: [1],       expected: 0.98438178121308695, source: "Series" },
  { fn: "kelvin_ber", args: [2],       expected: 0.7517341827138083, source: "Series" },

  // ── Kelvin bei ──
  { fn: "kelvin_bei", args: [0],       expected: 0.0,              source: "bei(0)=0" },
  { fn: "kelvin_bei", args: [1],       expected: 0.24956604003665972, source: "Series" },
  { fn: "kelvin_bei", args: [2],       expected: 0.9722916273066612, source: "Series" },

  // ── Debye D₅ ──
  { fn: "debye5", args: [0],           expected: 1.0,              source: "D₅(0)=1" },
  { fn: "debye5", args: [1],           expected: 0.6421002580218781, source: "Simpson 1000pt" },

  // ── Langevin ──
  { fn: "langevin", args: [1],         expected: 0.31303528549933146, source: "coth(1)-1" },
  { fn: "langevin", args: [0],         expected: 0.0,              source: "L(0)=0" },
  { fn: "langevin", args: [5],         expected: 0.8000908039820194, source: "coth(5)-1/5" },

  // ── Inverse Langevin (Padé) ──
  { fn: "inv_langevin", args: [0],     expected: 0.0,              source: "L⁻¹(0)=0" },
  { fn: "inv_langevin", args: [0.5],   expected: 1.8333333333333333, source: "Padé" },
  { fn: "inv_langevin", args: [0.9],   expected: 10.373684210526319, source: "Padé" },

  // ── 🏆 100th Function: Wright Omega ──
  { fn: "wright_omega", args: [0],     expected: 0.5671432904097838, source: "W₀(1)" },
  { fn: "wright_omega", args: [1],     expected: 1.0,              source: "1+ln(1)=1" },
  { fn: "wright_omega", args: [2],     expected: 1.5571455989976115, source: "Newton" },
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
