/**
 * @tmnl/mathkernel — Special Functions
 *
 * C++20. No Eigen dependency (scalar math only).
 *
 * Domain breakdown (14 functions):
 *   Bessel (3): bessel_j0, bessel_j1, bessel_jn
 *   Oscillatory/Integral (4): dawson, fresnel_s, fresnel_c, sinc
 *   Elliptic (2): elliptic_k, elliptic_e
 *   Other (5): gamma_fn, digamma, beta_fn, erf_fn, erfc_fn
 *
 * All implementations use series expansions or polynomial approximations
 * suitable for moderate-precision numerical work (double precision).
 */

#include "common.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
using namespace emscripten;
#endif

namespace mathkernel {

#ifdef __EMSCRIPTEN__

// ═══════════════════════════════════════════════════════════════════════════
// BESSEL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bessel function of the first kind J₀(x).
 * Series: J₀(x) = Σ (-1)^k (x/2)^{2k} / (k!)²
 *
 * For |x| ≤ 8: power series with up to 60 terms.
 * For |x| > 8: Hankel asymptotic expansion.
 */
// Cephes J0 rational approximation coefficients
static const double j0_PP[7] = {
  7.96936729297347051624E-4, 8.28352392107440799803E-2,
  1.23953371646414299388E0,  5.44725003058768775090E0,
  8.74716500199817011941E0,  5.30324038235394892183E0,
  9.99999999999999997821E-1,
};
static const double j0_PQ[7] = {
  9.24408810558863637013E-4, 8.56288474354474431428E-2,
  1.25352743901058953537E0,  5.47097740330417105182E0,
  8.76190883237069594232E0,  5.30605288235394617618E0,
  1.00000000000000000218E0,
};
static const double j0_QP[8] = {
  -1.13663838898469149931E-2, -1.28252718670509318512E0,
  -1.95539544257735972385E1,  -9.32060152123768231369E1,
  -1.77681167980488050595E2,  -1.47077505154951170175E2,
  -5.14105326766599330220E1,  -6.05014350600728481186E0,
};
static const double j0_QQ[7] = {
  6.43178256118178023184E1,  8.56430025976980587198E2,
  3.88240183605401609683E3,  7.24046774195652478189E3,
  5.93072701187316984827E3,  2.06209331660327847417E3,
  2.42005740240291393179E2,
};
static const double j0_RP[4] = {
  -4.79443220978201773821E9, 1.95617491946556577543E12,
  -2.49248344360967716204E14, 9.70862251047306323952E15,
};
static const double j0_RQ[8] = {
  4.99563147152651017219E2,  1.73785401676374683123E5,
  4.84409658339962045305E7,  1.11855537045356834862E10,
  2.11277520115489217587E12, 3.10518229857422583814E14,
  3.18121955943204943306E16, 1.71086294081043136091E18,
};
static const double j0_DR1 = 5.78318596294678452118E0;
static const double j0_DR2 = 3.04712623436620863991E1;
static const double SQ2OPI = 0.79788456080286535588;  // √(2/π)

double bessel_j0(double x) {
  if (x < 0) x = -x;

  if (x <= 5.0) {
    double z = x * x;
    if (x < 1.0e-5) return 1.0 - z / 4.0;
    double p = (z - j0_DR1) * (z - j0_DR2);
    p = p * polevl(z, j0_RP, 3) / p1evl(z, j0_RQ, 8);
    return p;
  }

  double w = 5.0 / x;
  double q = 25.0 / (x * x);
  double p = polevl(q, j0_PP, 6) / polevl(q, j0_PQ, 6);
  q = polevl(q, j0_QP, 7) / p1evl(q, j0_QQ, 7);
  double xn = x - M_PI / 4.0;
  p = p * std::cos(xn) - w * q * std::sin(xn);
  return p * SQ2OPI / std::sqrt(x);
}

/**
 * Bessel function of the first kind J₁(x).
 * Series: J₁(x) = (x/2) Σ (-1)^k (x/2)^{2k} / (k!(k+1)!)
 *
 * For |x| ≤ 8: power series with up to 60 terms.
 * For |x| > 8: Hankel asymptotic expansion.
 */
// Cephes J1 rational approximation coefficients
static const double j1_PP[7] = {
  7.62125616208173112003E-4, 7.31397056940917570436E-2,
  1.12719608129684925192E0,  5.11207951146807644818E0,
  8.42404590141772420927E0,  5.21451598682361504063E0,
  1.00000000000000000254E0,
};
static const double j1_PQ[7] = {
  5.71323128072548699714E-4, 6.88455908754495404082E-2,
  1.10514232634061696926E0,  5.07386386128601488557E0,
  8.39985554327604159757E0,  5.20982848682361821619E0,
  9.99999999999999997461E-1,
};
static const double j1_QP[8] = {
  5.10862594750176621635E-2, 4.98213872951233449420E0,
  7.58238284132545283818E1,  3.66779609360150777800E2,
  7.10856304998926107277E2,  5.97489612400613639965E2,
  2.11688757100572135698E2,  2.52070205858023719784E1,
};
static const double j1_QQ[7] = {
  7.42373277035675149943E1,  1.05644886038262816351E3,
  4.98641058337653607651E3,  9.56231892404756170795E3,
  7.99704160447350683650E3,  2.82619278517639096600E3,
  3.36093607810698293419E2,
};
static const double j1_RP[4] = {
  -8.99971225705559398224E8, 4.52228297998194034323E11,
  -7.27494245221818276015E13, 3.68295732863852883286E15,
};
static const double j1_RQ[8] = {
  6.20836478118054335476E2,  2.56987256757748830383E5,
  8.35146791431949253037E7,  2.21511595479792499675E10,
  4.74914122079991414898E12, 7.84369607876235854894E14,
  8.95222336184627338078E16, 5.32278620332680085395E18,
};
static const double j1_Z1 = 1.46819706421238932572E1;
static const double j1_Z2 = 4.92184563216946036703E1;
static const double THPIO4 = 2.35619449019234492885;  // 3π/4

double bessel_j1(double x) {
  if (x < 0) return -bessel_j1(-x);

  if (x <= 5.0) {
    double z = x * x;
    double w = polevl(z, j1_RP, 3) / p1evl(z, j1_RQ, 8);
    return w * x * (z - j1_Z1) * (z - j1_Z2);
  }

  double w = 5.0 / x;
  double z = w * w;
  double p = polevl(z, j1_PP, 6) / polevl(z, j1_PQ, 6);
  double q = polevl(z, j1_QP, 7) / p1evl(z, j1_QQ, 7);
  double xn = x - THPIO4;
  p = p * std::cos(xn) - w * q * std::sin(xn);
  return p * SQ2OPI / std::sqrt(x);
}

/**
 * Bessel function J_n(x) via Miller's backward recurrence.
 * Uses the recurrence: J_{n-1}(x) = (2n/x) J_n(x) - J_{n+1}(x)
 */
double bessel_jn(int n, double x) {
  if (n < 0) throw std::invalid_argument("bessel_jn: n must be >= 0");
  if (n == 0) return bessel_j0(x);
  if (n == 1) return bessel_j1(x);
  if (std::abs(x) < 1e-15) return 0.0;

  // Miller's algorithm: start from high order, recurse backward
  int m = std::max(n + 20, static_cast<int>(2 * std::abs(x)) + 20);
  double jnp1 = 0.0, jn = 1.0;
  double result = 0.0;

  for (int k = m; k >= 1; --k) {
    double jnm1 = (2.0 * k / x) * jn - jnp1;
    jnp1 = jn;
    jn = jnm1;
    if (k == n) result = jnp1;
  }
  // Normalize using J₀
  double scale = bessel_j0(x) / jn;
  return result * scale;
}

// ═══════════════════════════════════════════════════════════════════════════
// OSCILLATORY / INTEGRAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// ── Cephes-style polynomial evaluation ────────────────────────────────────
// polevl: evaluate polynomial of degree N
//   y = C[0] + C[1]*x + C[2]*x² + ... + C[N]*x^N
// Coefficients stored high-order first: C[0] = coeff of x^N
static double polevl(double x, const double* coef, int N) {
  double ans = coef[0];
  for (int i = 1; i <= N; ++i) ans = ans * x + coef[i];
  return ans;
}
// p1evl: same but leading coefficient is 1 (not stored)
static double p1evl(double x, const double* coef, int N) {
  double ans = x + coef[0];
  for (int i = 1; i < N; ++i) ans = ans * x + coef[i];
  return ans;
}

/**
 * Dawson function: D(x) = e^{-x²} ∫₀ˣ e^{t²} dt
 *
 * Cephes algorithm: three piecewise minimax rational approximations.
 * Peak relative error: 6.9e-16 on [0,10] (IEEE double).
 * Source: Cephes Math Library, S.L. Moshier.
 */
// Interval 0 to 3.25: D(x) = x * P(x²) / Q(x²)
static const double dawson_AN[10] = {
  1.13681498971755972054E-11, 8.49262267667473811108E-10,
  1.94434204175553054283E-8,  9.53151741254484363489E-7,
  3.07828309874913200438E-6,  3.52513368520288738649E-4,
 -8.50149846724410912031E-4,  4.22618223005546594270E-2,
 -9.17480371773452345351E-2,  9.99999999999999994612E-1,
};
static const double dawson_AD[11] = {
  2.40372073066762605484E-11, 1.48864681368493396752E-9,
  5.21265281010541664570E-8,  1.27258478273186970203E-6,
  2.32490249820789513991E-5,  3.25524741826057911661E-4,
  3.48805814657162590916E-3,  2.79448531198828973716E-2,
  1.58874241960120565368E-1,  5.74918629489320327824E-1,
  1.00000000000000000539E0,
};
// Interval 3.25 to 6.25: D(x) = 0.5 * (1/x + (1/x²) * P(1/x²) / (Q(1/x²) * x))
static const double dawson_BN[11] = {
  5.08955156417900903354E-1, -2.44754418142697847934E-1,
  9.41512335303534411857E-2, -2.18711255142039025206E-2,
  3.66207612329569181322E-3, -4.23209114460388756528E-4,
  3.59641304793896631888E-5, -2.14640351719968974225E-6,
  9.10010780076391431042E-8, -2.40274520828250956942E-9,
  3.59233385440928410398E-11,
};
static const double dawson_BD[10] = {
 -6.31839869873368190192E-1,  2.36706788228248691528E-1,
 -5.31806367003223277662E-2,  8.48041718586295374409E-3,
 -9.47996768486665330168E-4,  7.81025592944552338085E-5,
 -4.55875153252442634831E-6,  1.89100358111421846170E-7,
 -4.91324691331920606875E-9,  7.18466403235734541950E-11,
};
// Interval 6.25 to infinity
static const double dawson_CN[5] = {
 -5.90592860534773254987E-1,  6.29235242724368800674E-1,
 -1.72858975380388136411E-1,  1.64837047825189632310E-2,
 -4.86827613020462700845E-4,
};
static const double dawson_CD[5] = {
 -2.69820057197544900361E0,   1.73270799045947845857E0,
 -3.93708582281939493482E-1,  3.44278924041233391079E-2,
 -9.73655226040941223894E-4,
};

double dawson(double x) {
  int sign = 1;
  double xx = x;
  if (xx < 0.0) { sign = -1; xx = -xx; }

  if (xx < 3.25) {
    double u = xx * xx;
    return sign * xx * polevl(u, dawson_AN, 9) / polevl(u, dawson_AD, 10);
  }

  double u = 1.0 / (xx * xx);

  if (xx < 6.25) {
    double y = 1.0/xx + u * polevl(u, dawson_BN, 10) / (p1evl(u, dawson_BD, 10) * xx);
    return sign * 0.5 * y;
  }

  if (xx > 1.0e9) return sign * 0.5 / xx;

  // 6.25 to infinity
  double y = 1.0/xx + u * polevl(u, dawson_CN, 4) / (p1evl(u, dawson_CD, 5) * xx);
  return sign * 0.5 * y;
}

/**
 * Fresnel S integral: S(x) = ∫₀ˣ sin(πt²/2) dt
 *
 * Series: S(x) = Σ_{n=0}^∞ (-1)^n (π/2)^{2n+1} x^{4n+3} / ((2n+1)! · (4n+3))
 *
 * Recurrence for term ratio avoids recomputing factorials/powers.
 */
double fresnel_s(double x) {
  double ax = std::abs(x);
  double x2 = ax * ax;
  double piover2 = M_PI / 2.0;
  double piover2_x2 = piover2 * x2;  // (π/2)·x²

  // First term (n=0): (π/2)^1 · x³ / (1! · 3)
  double term = piover2 * ax * x2 / 3.0;
  double sum = term;

  for (int n = 1; n <= 40; ++n) {
    // Ratio: term_n / term_{n-1} =
    //   -(π/2)² · x⁴ / ((2n)(2n+1) · (4n+3)/(4n-1))
    //   = -(π/2·x²)² · (4n-1) / ((2n)(2n+1)(4n+3))
    term *= -piover2_x2 * piover2_x2
            * static_cast<double>(4*n - 1)
            / (static_cast<double>(2*n) * static_cast<double>(2*n + 1) * static_cast<double>(4*n + 3));
    sum += term;
    if (std::abs(term) < 1e-16 * std::abs(sum)) break;
  }

  return (x < 0) ? -sum : sum;
}

/**
 * Fresnel C integral: C(x) = ∫₀ˣ cos(πt²/2) dt
 *
 * Series: C(x) = Σ_{n=0}^∞ (-1)^n (π/2)^{2n} x^{4n+1} / ((2n)! · (4n+1))
 *
 * Recurrence for term ratio.
 */
double fresnel_c(double x) {
  double ax = std::abs(x);
  double x2 = ax * ax;
  double piover2 = M_PI / 2.0;
  double piover2_x2 = piover2 * x2;

  // First term (n=0): (π/2)^0 · x / (0! · 1) = x
  double term = ax;
  double sum = term;

  for (int n = 1; n <= 40; ++n) {
    // Ratio: term_n / term_{n-1} =
    //   -(π/2)² · x⁴ · (4n-3) / ((2n-1)(2n)(4n+1))
    term *= -piover2_x2 * piover2_x2
            * static_cast<double>(4*n - 3)
            / (static_cast<double>(2*n - 1) * static_cast<double>(2*n) * static_cast<double>(4*n + 1));
    sum += term;
    if (std::abs(term) < 1e-16 * std::abs(sum)) break;
  }

  return (x < 0) ? -sum : sum;
}

/**
 * Normalized sinc: sinc(x) = sin(πx) / (πx), sinc(0) = 1.
 */
double sinc(double x) {
  if (std::abs(x) < 1e-15) return 1.0;
  double px = M_PI * x;
  return std::sin(px) / px;
}

// ═══════════════════════════════════════════════════════════════════════════
// ELLIPTIC INTEGRALS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Complete elliptic integral of the first kind: K(k)
 *
 * Cephes algorithm: K(k) = P(m₁) - log(m₁)·Q(m₁) where m₁ = 1 - k².
 * Degree-10 polynomial approximations.
 * Peak relative error: 2.5e-16 (IEEE double).
 * Source: Cephes Math Library, S.L. Moshier.
 */
// Cephes ellpk coefficients — argument is m1 = 1 - k²
static const double ellipk_P[11] = {
  1.37982864606273237150E-4, 2.28025724005875567385E-3,
  7.97404013220415179367E-3, 9.85821379021226008714E-3,
  6.87489687449949877925E-3, 6.18901033637687613229E-3,
  8.79078273952743772254E-3, 1.49380448916805252718E-2,
  3.08851465246711995998E-2, 9.65735902811690126535E-2,
  1.38629436111989062502E0,
};
static const double ellipk_Q[11] = {
  2.94078955048598507511E-5, 9.14184723865917226571E-4,
  5.94058303753167793257E-3, 1.54850516649762399335E-2,
  2.39089602715924892727E-2, 3.01204715227604046988E-2,
  3.73774314173823228969E-2, 4.88280347570998239232E-2,
  7.03124996963957469739E-2, 1.24999999999870820058E-1,
  4.99999999999999999821E-1,
};

double elliptic_k(double k) {
  if (k < 0 || k >= 1) throw std::invalid_argument("elliptic_k: k must be in [0, 1)");
  double m1 = 1.0 - k * k;  // complementary parameter
  if (m1 < 1e-300) return 1e30;  // K → ∞ as k → 1
  if (m1 > 1.0 - 1e-15) return M_PI / 2.0;  // K(0) = π/2
  return polevl(m1, ellipk_P, 10) - std::log(m1) * polevl(m1, ellipk_Q, 10);
}

/**
 * Complete elliptic integral of the second kind: E(k)
 *
 * Cephes algorithm: E(k) = P(x) - x·log(x)·Q(x) where x = 1 - k².
 * Degree-10/9 polynomial approximations.
 * Peak relative error: 2.1e-16 (IEEE double).
 * Source: Cephes Math Library, S.L. Moshier.
 */
// Cephes ellpe coefficients — argument x = 1 - m = 1 - k²
static const double ellipe_P[11] = {
  1.53552577301013293365E-4, 2.50888492163602060990E-3,
  8.68786816565889628429E-3, 1.07350949056076193403E-2,
  7.77395492516787092951E-3, 7.58395289413514708519E-3,
  1.15688436810574127319E-2, 2.18317996015557253103E-2,
  5.68051945617860553470E-2, 4.43147180560990850618E-1,
  1.00000000000000000299E0,
};
static const double ellipe_Q[10] = {
  3.27954898576485872656E-5, 1.00962792679356715133E-3,
  6.50609489976927491433E-3, 1.68862163993311317300E-2,
  2.61769742454493659583E-2, 3.34833904888224918614E-2,
  4.27180926518931511717E-2, 5.85936634471101055642E-2,
  9.37499997197644278445E-2, 2.49999999999888314361E-1,
};

double elliptic_e(double k) {
  if (k < 0 || k > 1) throw std::invalid_argument("elliptic_e: k must be in [0, 1]");
  if (std::abs(k) < 1e-15) return M_PI / 2.0;
  if (std::abs(k - 1.0) < 1e-15) return 1.0;

  // x = 1 - m = 1 - k² (complementary parameter, same as ellpk)
  double x = 1.0 - k * k;
  // Cephes formula: E = P(x) - log(x) * x * Q(x)
  return polevl(x, ellipe_P, 10) - std::log(x) * (x * polevl(x, ellipe_Q, 9));
}

// ═══════════════════════════════════════════════════════════════════════════
// OTHER SPECIAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gamma function Γ(x) via Lanczos approximation (g=7, n=9).
 */
double gamma_fn(double x) {
  if (x <= 0 && x == std::floor(x))
    throw std::invalid_argument("gamma_fn: undefined for non-positive integers");

  // Reflection formula for x < 0.5
  if (x < 0.5) {
    return M_PI / (std::sin(M_PI * x) * gamma_fn(1.0 - x));
  }

  x -= 1.0;
  const double g = 7.0;
  const double c[] = {
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  };

  double sum = c[0];
  for (int i = 1; i < 9; ++i) sum += c[i] / (x + i);

  double t = x + g + 0.5;
  return std::sqrt(2.0 * M_PI) * std::pow(t, x + 0.5) * std::exp(-t) * sum;
}

/**
 * Digamma function ψ(x) = Γ'(x)/Γ(x).
 * Asymptotic expansion + recurrence.
 */
double digamma(double x) {
  if (x <= 0 && x == std::floor(x))
    throw std::invalid_argument("digamma: undefined for non-positive integers");

  double result = 0.0;

  // Reflection for negative x
  if (x < 0) {
    result -= M_PI / std::tan(M_PI * x);
    x = 1.0 - x;
  }

  // Recurrence: ψ(x+1) = ψ(x) + 1/x — shift x until x > 10
  while (x < 10.0) {
    result -= 1.0 / x;
    x += 1.0;
  }

  // Asymptotic expansion with Bernoulli numbers B_{2k}/(2k):
  // ψ(x) ≈ ln(x) - 1/(2x) - Σ B_{2k}/(2k · x^{2k})
  // B₂=1/6, B₄=-1/30, B₆=1/42, B₈=-1/30, B₁₀=5/66, B₁₂=-691/2730, B₁₄=7/6
  double x2 = 1.0 / (x * x);
  result += std::log(x) - 0.5 / x
    - x2 * (1.0/12.0
    - x2 * (1.0/120.0
    - x2 * (1.0/252.0
    - x2 * (1.0/240.0
    - x2 * (5.0/660.0
    - x2 * (691.0/32760.0
    - x2 * (1.0/12.0)))))));

  return result;
}

/**
 * Beta function B(a, b) = Γ(a)Γ(b)/Γ(a+b).
 */
double beta_fn(double a, double b) {
  return gamma_fn(a) * gamma_fn(b) / gamma_fn(a + b);
}

/**
 * Error function erf(x).
 *
 * For |x| < 1: convergent Taylor series with ~50 terms for full precision.
 *   erf(x) = (2/√π) Σ_{n=0}^∞ (-1)^n x^{2n+1} / (n! · (2n+1))
 *
 * For 1 ≤ |x| < 6: complementary erfc via continued fraction, then 1 - erfc.
 *
 * For |x| ≥ 6: erf ≈ ±1 to machine precision.
 */
// Forward declaration needed since erf_fn and erfc_fn are mutually recursive
double erfc_fn(double x);

double erf_fn(double x) {
  // Use C++ standard library — in Emscripten/musl, this is a
  // high-quality implementation (typically ~15 digit accuracy)
  return std::erf(x);
}

/**
 * Complementary error function erfc(x) = 1 - erf(x).
 *
 * For |x| < 1: 1 - erf(x) using the Taylor erf.
 * For |x| ≥ 1: Laplace continued fraction
 *   erfc(x) = exp(-x²)/√π · 1/(x + a₁/(x + a₂/(x + ...)))
 * where aₙ = n/2. Evaluated via backward recurrence.
 */
double erfc_fn(double x) {
  return std::erfc(x);
}

#endif // __EMSCRIPTEN__

} // namespace mathkernel

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(mathkernel_special) {
  // Bessel
  function("bessel_j0", &mathkernel::bessel_j0);
  function("bessel_j1", &mathkernel::bessel_j1);
  function("bessel_jn", &mathkernel::bessel_jn);
  // Oscillatory/Integral
  function("dawson", &mathkernel::dawson);
  function("fresnel_s", &mathkernel::fresnel_s);
  function("fresnel_c", &mathkernel::fresnel_c);
  function("sinc", &mathkernel::sinc);
  // Elliptic
  function("elliptic_k", &mathkernel::elliptic_k);
  function("elliptic_e", &mathkernel::elliptic_e);
  // Other
  function("gamma_fn", &mathkernel::gamma_fn);
  function("digamma", &mathkernel::digamma);
  function("beta_fn", &mathkernel::beta_fn);
  function("erf_fn", &mathkernel::erf_fn);
  function("erfc_fn", &mathkernel::erfc_fn);
}
#endif
