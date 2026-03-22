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
// ── Cephes-style polynomial evaluation (forward declarations) ──────────
static double polevl(double x, const double* coef, int N);
static double p1evl(double x, const double* coef, int N);

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
  // Use exact PIO4 constant for maximum precision
  static const double PIO4 = 0.78539816339744830962;
  double xn = x - PIO4;
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
 * Fresnel integrals S(x) and C(x).
 * Cephes algorithm: rational approximations for small x,
 * Hankel asymptotic with rational auxiliary f/g for large x.
 * Peak relative error: 2.0e-15 (IEEE double).
 */
// S(x) for small x
static const double fres_sn[6] = {
  -2.99181919401019853726E3,  7.08840045257738576863E5,
  -6.29741486205862506537E7,  2.54890880573376359104E9,
  -4.42979518059697779103E10, 3.18016297876567817986E11,
};
static const double fres_sd[6] = {
  2.81376268889994315696E2,   4.55847810806532581675E4,
  5.17343888770096400730E6,   4.19320245898111231129E8,
  2.24411795645340920940E10,  6.07366389490084639049E11,
};
// C(x) for small x
static const double fres_cn[6] = {
  -4.98843114573573548651E-8, 9.50428062829859605134E-6,
  -6.45191435683965050962E-4, 1.88843319396703850064E-2,
  -2.05525900955013891793E-1, 9.99999999999999998822E-1,
};
static const double fres_cd[7] = {
  3.99982968972495980367E-12, 9.15439215774657478799E-10,
  1.25001862479598821474E-7,  1.22262789024179030997E-5,
  8.68029542941784300606E-4,  4.12142090722199792936E-2,
  1.00000000000000000118E0,
};
// Auxiliary f(x) for large x
static const double fres_fn[10] = {
  4.21543555043677546506E-1,  1.43407919780758885261E-1,
  1.15220955073585758835E-2,  3.45017939782574027900E-4,
  4.63613749287867322088E-6,  3.05568983790257605827E-8,
  1.02304514164907233465E-10, 1.72010743268161828879E-13,
  1.34283276233062758925E-16, 3.76329711269987889006E-20,
};
static const double fres_fd[10] = {
  7.51586398353378947175E-1,  1.16888925859191382142E-1,
  6.44051526508858611005E-3,  1.55934409164153020873E-4,
  1.84627567348930545870E-6,  1.12699224763999035261E-8,
  3.60140029589371370404E-11, 5.88754533621578410010E-14,
  4.52001434074129701496E-17, 1.25443237090011264384E-20,
};
// Auxiliary g(x) for large x
static const double fres_gn[11] = {
  5.04442073643383265887E-1,  1.97102833525523411709E-1,
  1.87648584092575249293E-2,  6.84079380915393090172E-4,
  1.15138826111884280931E-5,  9.82852443688422223854E-8,
  4.45344415861750144738E-10, 1.08268041139020870318E-12,
  1.37555460633261799868E-15, 8.36354435630677421531E-19,
  1.86958710162783235106E-22,
};
static const double fres_gd[11] = {
  1.47495759925128324529E0,   3.37748989120019970451E-1,
  2.53603741420338795122E-2,  8.14679107184306179049E-4,
  1.27545075667729118702E-5,  1.04314589657571990585E-7,
  4.60680728146520428211E-10, 1.10273215066240270757E-12,
  1.38796531259578871258E-15, 8.39158816283118707363E-19,
  1.86958710162783236342E-22,
};

static void fresnl_cephes(double xxa, double& ss, double& cc) {
  double x = std::abs(xxa);
  double x2 = x * x;

  if (x2 < 2.5625) {
    double t = x2 * x2;
    ss = x * x2 * polevl(t, fres_sn, 5) / p1evl(t, fres_sd, 6);
    cc = x * polevl(t, fres_cn, 5) / polevl(t, fres_cd, 6);
  } else if (x > 36974.0) {
    cc = 0.5;
    ss = 0.5;
  } else {
    double t = M_PI * x2;
    double u = 1.0 / (t * t);
    t = 1.0 / t;
    double f = 1.0 - u * polevl(u, fres_fn, 9) / p1evl(u, fres_fd, 10);
    double g = t * polevl(u, fres_gn, 10) / p1evl(u, fres_gd, 11);
    t = M_PI / 2.0 * x2;
    double c = std::cos(t);
    double s = std::sin(t);
    t = M_PI * x;
    cc = 0.5 + (f * s - g * c) / t;
    ss = 0.5 - (f * c + g * s) / t;
  }

  if (xxa < 0.0) { cc = -cc; ss = -ss; }
}

double fresnel_s(double x) {
  double ss, cc;
  fresnl_cephes(x, ss, cc);
  return ss;
}

/**
 * Fresnel C integral: C(x) = ∫₀ˣ cos(πt²/2) dt
 */
double fresnel_c(double x) {
  double ss, cc;
  fresnl_cephes(x, ss, cc);
  return cc;
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
  return std::tgamma(x);
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
  // Use lgamma to avoid overflow for large arguments
  return std::exp(std::lgamma(a) + std::lgamma(b) - std::lgamma(a + b));
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

/**
 * Log-gamma function: lgamma(x) = log(|Γ(x)|).
 * Uses C++ standard library implementation.
 */
double lgamma_fn(double x) {
  return std::lgamma(x);
}

/**
 * Bessel function of the second kind Y₀(x).
 * Uses the relation: Y₀(x) = (2/π)(J₀(x)(γ + ln(x/2)) + series)
 * For x > 5: Hankel asymptotic with Cephes rational coefficients.
 * For x ≤ 5: series expansion.
 */
// Cephes Y0 coefficients for small x
static const double y0_YP[8] = {
  1.55924367855235737965E4,  -1.46639295903971606143E7,
  5.43526477051876500413E9,  -9.82136065717911466409E11,
  8.75906394395366999549E13, -3.46628303384729719441E15,
  4.42733268572569800351E16, -1.84950800436986690637E16,
};
static const double y0_YQ[7] = {
  1.04128353664259848412E3,  6.26107330137134956842E5,
  2.68919633393814121987E8,  8.64002487103935000337E10,
  2.02979612750105546709E13, 3.17157752842975028269E15,
  2.50596256172653059228E17,
};

double bessel_y0(double x) {
  if (x <= 0) {
    if (x == 0) return -INFINITY;
    return NAN;
  }

  if (x <= 5.0) {
    double z = x * x;
    double w = polevl(z, y0_YP, 7) / p1evl(z, y0_YQ, 7);
    w += (2.0 / M_PI) * std::log(x) * bessel_j0(x);
    return w;
  }

  // Large x: Hankel asymptotic (same PP/PQ/QP/QQ as J0)
  double w = 5.0 / x;
  double q = 25.0 / (x * x);
  double p = polevl(q, j0_PP, 6) / polevl(q, j0_PQ, 6);
  q = polevl(q, j0_QP, 7) / p1evl(q, j0_QQ, 7);
  static const double PIO4 = 0.78539816339744830962;
  double xn = x - PIO4;
  p = p * std::sin(xn) + w * q * std::cos(xn);
  return p * SQ2OPI / std::sqrt(x);
}

/**
 * Bessel Y₁(x) — second kind, order 1.
 * Uses Wronskian: J₀Y₁ - J₁Y₀ = 2/(πx)
 * So Y₁(x) = (2/(πx) + J₁(x)·Y₀(x)) / J₀(x)
 * For zeros of J₀, falls back to Hankel asymptotic.
 */
double bessel_y1(double x) {
  if (x <= 0) {
    if (x == 0) return -INFINITY;
    return NAN;
  }

  if (x > 5.0) {
    // Large x: Hankel asymptotic (shares J1 PP/PQ/QP/QQ)
    double w = 5.0 / x;
    double z = w * w;
    double p = polevl(z, j1_PP, 6) / polevl(z, j1_PQ, 6);
    double q = polevl(z, j1_QP, 7) / p1evl(z, j1_QQ, 7);
    static const double THPIO4 = 2.35619449019234492885;
    double xn = x - THPIO4;
    p = p * std::sin(xn) + w * q * std::cos(xn);
    return p * SQ2OPI / std::sqrt(x);
  }

  // Wronskian: J₁Y₀ - J₀Y₁ = 2/(πx), so Y₁ = (J₁·Y₀ - 2/(πx)) / J₀
  double j0 = bessel_j0(x);
  double j1 = bessel_j1(x);
  double y0 = bessel_y0(x);

  if (std::abs(j0) > 1e-10) {
    return (j1 * y0 - 2.0 / (M_PI * x)) / j0;
  }
  // Near J₀ zeros, use forward recurrence: Y₁ = (2·0/x)Y₀ - Y_{-1}
  // Y_{-1} = -Y₁ by reflection, so 2Y₁ = (0)·Y₀... this doesn't help.
  // Use numerical differentiation instead.
  double h = 1e-7;
  double y0p = bessel_y0(x + h);
  double y0m = bessel_y0(x - h);
  // Y₁(x) = -Y₀'(x) (DLMF 10.6.2 with n=0)
  return -(y0p - y0m) / (2.0 * h);
}

/**
 * Modified Bessel I₀(x) = Σ (x²/4)^k / (k!)².
 * Series converges for all x; for large x we use Miller-type
 * exponential scaling to avoid overflow.
 */
double bessel_i0(double x) {
  double ax = std::abs(x);
  if (ax <= 15.0) {
    // Direct series: I₀(x) = Σ_{k=0}^∞ (x²/4)^k / (k!)²
    double x24 = ax * ax / 4.0;
    double term = 1.0;
    double sum = 1.0;
    for (int k = 1; k <= 60; ++k) {
      term *= x24 / (static_cast<double>(k) * static_cast<double>(k));
      sum += term;
      if (term < 1e-16 * sum) break;
    }
    return sum;
  }
  // Large x: asymptotic I₀(x) ~ e^x / √(2πx) · Σ aₖ/xᵏ
  // Use Hankel's expansion
  double t = 1.0 / ax;
  double sum = 1.0;
  double term = 1.0;
  for (int k = 1; k <= 30; ++k) {
    double dk = static_cast<double>(k);
    term *= (2.0*dk - 1.0) * (2.0*dk - 1.0) / (8.0 * dk * ax);
    if (std::abs(term) < 1e-16) break;
    sum += term;
  }
  return std::exp(ax) / std::sqrt(2.0 * M_PI * ax) * sum;
}

/**
 * Modified Bessel I₁(x).
 * Series: I₁(x) = Σ_{k=0}^∞ (x/2)^{2k+1} / (k! · (k+1)!)
 */
double bessel_i1(double x) {
  double ax = std::abs(x);
  double z;
  if (ax <= 15.0) {
    double x24 = ax * ax / 4.0;
    double term = ax / 2.0;
    double sum = term;
    for (int k = 1; k <= 60; ++k) {
      term *= x24 / (static_cast<double>(k) * static_cast<double>(k + 1));
      sum += term;
      if (term < 1e-16 * sum) break;
    }
    z = sum;
  } else {
    // Large x: I₁(x) ~ e^x / √(2πx) · Σ bₖ/xᵏ
    double t = 1.0 / ax;
    double sum = 1.0;
    double term = 1.0;
    for (int k = 1; k <= 30; ++k) {
      double dk = static_cast<double>(k);
      double num = (4.0*dk*dk - 1.0);
      term *= -num / (8.0 * dk * ax);
      if (std::abs(term) < 1e-16) break;
      sum += term;
    }
    z = std::exp(ax) / std::sqrt(2.0 * M_PI * ax) * sum;
  }
  return (x < 0) ? -z : z;
}

/**
 * Exponential integral E₁(x) = ∫₁^∞ e^{-xt}/t dt  for x > 0.
 * Cephes: power series for x ≤ 1, continued fraction for x > 1.
 */
double expint_e1(double x) {
  if (x <= 0) {
    if (x == 0) return INFINITY;
    return NAN; // E1 not defined for x < 0 in this impl
  }

  if (x <= 1.0) {
    // Power series: E1(x) = -γ - ln(x) - Σ (-x)^n/(n·n!)
    static const double EULER = 0.57721566490153286060;
    double sum = 0.0;
    double term = -x;
    for (int n = 1; n <= 60; ++n) {
      sum += term / static_cast<double>(n);
      term *= -x / static_cast<double>(n + 1);
      if (std::abs(term / (n + 1)) < 1e-17 * std::abs(sum)) break;
    }
    return -EULER - std::log(x) - sum;
  }

  // Continued fraction: E1(x) = e^{-x} * CF
  // CF: 1/(x+1-1·1/(x+3-2·2/(x+5-...)))
  // Evaluate via Lentz's method
  double a = 1.0;
  double b = x + 1.0;
  double f = 1.0 / b;
  double c = 1.0 / 1e-30;
  double d = 1.0 / b;
  double h = d;
  for (int n = 1; n <= 100; ++n) {
    double an = -static_cast<double>(n * n);
    double bn = x + 2.0 * n + 1.0;
    d = bn + an * d;
    if (std::abs(d) < 1e-30) d = 1e-30;
    c = bn + an / c;
    if (std::abs(c) < 1e-30) c = 1e-30;
    d = 1.0 / d;
    double del = d * c;
    h *= del;
    if (std::abs(del - 1.0) < 1e-16) break;
  }
  return std::exp(-x) * h;
}

/**
 * Modified Bessel K₀(x) — second kind, order 0.
 * K₀(x) = -[ln(x/2) + γ]·I₀(x) + Σ_{k=1}^∞ (x²/4)^k · H_k / (k!)²
 * where H_k = 1 + 1/2 + ... + 1/k (harmonic numbers).
 */
double bessel_k0(double x) {
  if (x <= 0) {
    if (x == 0) return INFINITY;
    return NAN;
  }

  if (x <= 20.0) {
    // Series: K₀(x) = -(ln(x/2)+γ)I₀(x) + Σ (x²/4)^k H_k/(k!)²
    static const double EULER = 0.57721566490153286060;
    double x24 = x * x / 4.0;
    // First compute I₀(x) via series
    double i0 = 1.0;
    double t_i = 1.0;
    for (int k = 1; k <= 80; ++k) {
      t_i *= x24 / (static_cast<double>(k) * static_cast<double>(k));
      i0 += t_i;
      if (t_i < 1e-17 * i0) break;
    }
    // Harmonic sum series
    double hk = 0.0;
    double term = 0.0; // k=0 term has H_0=0
    double sum = 0.0;
    double t = 1.0;
    for (int k = 1; k <= 80; ++k) {
      hk += 1.0 / static_cast<double>(k);
      t *= x24 / (static_cast<double>(k) * static_cast<double>(k));
      sum += t * hk;
      if (t * hk < 1e-17 * std::abs(sum)) break;
    }
    return -(std::log(x / 2.0) + EULER) * i0 + sum;
  }

  // Large x: K₀(x) ~ √(π/(2x)) · e^{-x} · Σ aₖ/(8x)^k
  double t = 1.0 / (8.0 * x);
  double sum = 1.0;
  double term = 1.0;
  for (int k = 1; k <= 30; ++k) {
    double dk = static_cast<double>(k);
    double num = (2.0 * dk - 1.0) * (2.0 * dk - 1.0);
    term *= num * t / dk;
    if (std::abs(term) < 1e-16) break;
    sum += term;
  }
  return std::sqrt(M_PI / (2.0 * x)) * std::exp(-x) * sum;
}

/**
 * Modified Bessel K₁(x) — second kind, order 1.
 * K₁(x) = (1/x) + [ln(x/2)+γ-½]·x·... — complex series.
 * Use recurrence: K₁(x) = -(d/dx)K₀(x) for medium x.
 * For small x: K₁(x) ~ 1/x.
 * For large x: asymptotic expansion.
 */
double bessel_k1(double x) {
  if (x <= 0) {
    if (x == 0) return INFINITY;
    return NAN;
  }

  if (x <= 2.0) {
    // K₁(x) = 1/x + (x/2)·ln(x/2)·I₁(x) + series
    // A&S 9.6.11: K₁(x) = 1/x + x/2·(ln(x/2)+γ)·I₁(x) - x/4·Σ...
    // Better: direct series from A&S 9.6.11
    // K₁(x) = 1/x + (x/2)·[ln(x/2) + γ]·I₁(x)
    //        - (1/2)·Σ_{k=0}^∞ (-1)^k·[(ψ(k+1)+ψ(k+2))/2]·(x/2)^{2k+1} / (k!·(k+1)!)
    // Actually use the cleaner Cephes-style approach:
    // K₁(x) = log(x/2)·I₁(x) + 1/x + (x/4)·S
    double x2 = x / 2.0;
    double lnx2 = std::log(x2);

    // Compute I₁(x) via series: I₁(x) = Σ (x/2)^{2k+1} / (k!·(k+1)!)
    double i1 = bessel_i1(x);

    // Series part: Σ_{k=0}^∞ (ψ(k+1) + ψ(k+2))·(x²/4)^k / (k!·(k+1)!)
    // Where ψ(k+1) = -γ + H_k
    double gamma_em = 0.5772156649015329;
    double psi_sum = 0.0;
    double hk = 0.0;      // H_k = Σ 1/j
    double hk1 = 1.0;     // H_{k+1} = 1
    double term = 1.0;    // (x²/4)^k / (k!·(k+1)!)
    double x24 = x * x / 4.0;

    for (int k = 0; k <= 30; ++k) {
      double psi_k1 = -gamma_em + hk;      // ψ(k+1)
      double psi_k2 = -gamma_em + hk1;     // ψ(k+2)
      psi_sum += (psi_k1 + psi_k2) * term;

      // Update for next iteration
      double dk = static_cast<double>(k + 1);
      hk += 1.0 / dk;
      hk1 += 1.0 / (dk + 1.0);
      term *= x24 / (dk * (dk + 1.0));
      if (std::abs(term) < 1e-18) break;
    }

    return lnx2 * i1 + 1.0 / x - 0.5 * x2 * psi_sum;
  }

  if (x <= 20.0) {
    // Intermediate x: Wronskian K₁(x) = (I₁K₀ - I₀K₁ = 1/x)
    // Actually use: K₁ = (1/x - I₁·K₀) / I₀ ... no, that's circular.
    // Use asymptotic polynomial:
    // K₁(x) ≈ √(π/(2x))·e^{-x}·(1 + Σ bₖ/x^k)
    double inv_x = 1.0 / x;
    // Polynomial coefficients for K₁ asymptotic: bₖ = (4·1²-1)(4·1²-9)...(4·1²-(2k-1)²) / (k!·8^k)
    // = (4ν²-1²)(4ν²-3²)...(4ν²-(2k-1)²) / (k!·(8x)^k) where ν=1
    // 4ν²=4, so: (4-1)/8x, (4-1)(4-9)/(2·64x²), ...
    // = 3/(8x), 3·(-5)/(128x²), 3·(-5)·(-21)/(3·1024x³), ...
    double t = 1.0 / (8.0 * x);
    double mu = 4.0; // 4ν² where ν=1
    double sum = 1.0;
    double term2 = 1.0;
    for (int k = 1; k <= 30; ++k) {
      double dk = static_cast<double>(k);
      double factor = (mu - (2.0*dk - 1.0)*(2.0*dk - 1.0)) / (dk * 8.0 * x);
      double old_term = term2;
      term2 *= factor;
      if (std::abs(term2) > std::abs(old_term) && k > 2) break;
      sum += term2;
    }
    return std::sqrt(M_PI / (2.0 * x)) * std::exp(-x) * sum;
  }

  // Large x: K₁(x) ~ √(π/(2x)) · e^{-x} · Σ bₖ
  double t = 1.0 / (8.0 * x);
  double sum = 1.0;
  double term = 1.0;
  for (int k = 1; k <= 30; ++k) {
    double dk = static_cast<double>(k);
    double num = (4.0 * dk * dk - 1.0);
    term *= num * t / dk;
    if (std::abs(term) < 1e-16) break;
    sum += term;
  }
  return std::sqrt(M_PI / (2.0 * x)) * std::exp(-x) * sum;
}

/**
 * Riemann zeta function ζ(s) for real s > 1.
 * Uses Borwein's acceleration for convergence.
 * For s close to 1: pole, returns INFINITY.
 */
double riemann_zeta(double s) {
  if (s <= 1.0) {
    if (s == 1.0) return INFINITY;
    // For s < 1, use reflection formula
    // ζ(s) = 2^s π^{s-1} sin(πs/2) Γ(1-s) ζ(1-s)
    if (s == 0.0) return -0.5;
    double zeta_1ms = riemann_zeta(1.0 - s);
    return std::pow(2.0, s) * std::pow(M_PI, s - 1.0) *
           std::sin(M_PI * s / 2.0) * std::tgamma(1.0 - s) * zeta_1ms;
  }

  // Borwein acceleration via Dirichlet eta function
  // η(s) = (1 - 2^{1-s}) ζ(s) = Σ_{k=1}^∞ (-1)^{k+1}/k^s
  // Accelerate with Euler-Knopp transform (n=30)
  const int n = 30;
  // Compute binomial weights: c_k = C(n,k)/2^n
  double c[31];
  c[0] = 1.0;
  for (int k = 1; k <= n; ++k) {
    c[k] = c[k-1] * static_cast<double>(n - k + 1) / static_cast<double>(k);
  }
  double pow2n = std::pow(2.0, n);
  // Accelerated eta: Σ_{k=0}^{n} c_k * (-1)^k / (k+1)^s / 2^n
  double sum = 0.0;
  for (int k = 0; k <= n; ++k) {
    double sign = (k % 2 == 0) ? 1.0 : -1.0;
    sum += sign * c[k] / std::pow(static_cast<double>(k + 1), s);
  }
  sum /= pow2n;
  // But this only gives eta for the partial sum. 
  // Need the tail: partial sums of η converge, not the full thing.
  // Actually Euler-Knopp transform of alternating series converges:
  // η(s) ≈ Σ_{k=0}^{n} (-1)^k · d_k / (k+1)^s  where d_k are weights
  // Simpler: just use enough terms of the direct series with Kahan summation
  double eta = 0.0;
  double comp = 0.0;
  for (int k = 1; k <= 100000; ++k) {
    double sign = (k % 2 == 1) ? 1.0 : -1.0;
    double term = sign / std::pow(static_cast<double>(k), s);
    double y = term - comp;
    double t = eta + y;
    comp = (t - eta) - y;
    eta = t;
    if (k > 100 && std::abs(term) < 1e-16 * std::abs(eta)) break;
  }
  return eta / (1.0 - std::pow(2.0, 1.0 - s));
}

/**
 * Dilogarithm Li₂(x) = -∫₀ˣ ln(1-t)/t dt = Σ_{k=1}^∞ x^k/k².
 * For |x| ≤ 0.5: direct series.
 * For 0.5 < x ≤ 1: Li₂(x) = π²/6 - ln(x)·ln(1-x) - Li₂(1-x).
 * For x > 1: Li₂(x) = -Li₂(1/x) + π²/3 - ½(ln x)².
 */
double spence(double x) {
  if (x == 1.0) return M_PI * M_PI / 6.0;
  if (x == 0.0) return 0.0;

  if (x < 0.0) {
    // Li₂(x) = -Li₂(x/(x-1)) - ½ ln²(1-x)
    double u = x / (x - 1.0);
    double lnv = std::log(1.0 - x);
    return -spence(u) - 0.5 * lnv * lnv;
  }

  if (x > 1.0) {
    // Li₂(x) = -Li₂(1/x) + π²/3 - ½(ln x)²
    double lnx = std::log(x);
    return -spence(1.0 / x) + M_PI * M_PI / 3.0 - 0.5 * lnx * lnx;
  }

  if (x > 0.5) {
    // Li₂(x) = π²/6 - ln(x)·ln(1-x) - Li₂(1-x)
    double lnx = std::log(x);
    double ln1mx = std::log(1.0 - x);
    return M_PI * M_PI / 6.0 - lnx * ln1mx - spence(1.0 - x);
  }

  // Series: Σ x^k/k² for |x| ≤ 0.5
  double sum = 0.0;
  double xk = x;
  for (int k = 1; k <= 80; ++k) {
    sum += xk / (static_cast<double>(k) * static_cast<double>(k));
    xk *= x;
    if (std::abs(xk / (k * k)) < 1e-17 * std::abs(sum)) break;
  }
  return sum;
}

/**
 * Trigamma function ψ₁(x) = d²ln(Γ(x))/dx².
 * For x > 10: asymptotic series ψ₁(x) = 1/x + 1/(2x²) + Σ B_{2k}/(x^{2k+1}).
 * For x ≤ 10: recurrence ψ₁(x) = ψ₁(x+1) + 1/x².
 */
double trigamma(double x) {
  if (x <= 0 && x == std::floor(x)) return NAN;

  // Shift x to large value using recurrence
  double sum = 0.0;
  double xx = x;
  while (xx < 20.0) {
    sum += 1.0 / (xx * xx);
    xx += 1.0;
  }

  // Asymptotic: ψ₁(x) = 1/x + 1/(2x²) + Σ B_{2k}/(x^{2k+1})
  // B₂=1/6, B₄=-1/30, B₆=1/42, B₈=-1/30, B₁₀=5/66, B₁₂=-691/2730
  double ix = 1.0 / xx;
  double ix2 = ix * ix;
  double result = ix + ix2 / 2.0
    + ix2 * ix / 6.0
    - ix2 * ix2 * ix / 30.0
    + ix2 * ix2 * ix2 * ix / 42.0
    - ix2 * ix2 * ix2 * ix2 * ix / 30.0
    + ix2 * ix2 * ix2 * ix2 * ix2 * ix * 5.0 / 66.0
    - ix2 * ix2 * ix2 * ix2 * ix2 * ix2 * ix * 691.0 / 2730.0
    + ix2 * ix2 * ix2 * ix2 * ix2 * ix2 * ix2 * ix * 7.0 / 6.0;

  return result + sum;
}

/**
 * Airy function Ai(x).
 * For x < 0: oscillatory, use ascending series.
 * For x ≥ 0: exponentially decaying, use ascending series for small x,
 *            asymptotic for large x.
 */
double airy_ai(double x) {
  // Taylor series via ODE recurrence: Ai''(x) = x·Ai(x)
  // c[n+2] = c[n-1] / ((n+1)(n+2)) for n ≥ 1
  // c[0] = Ai(0), c[1] = Ai'(0), c[2] = 0
  static const double AI_C1 = 0.35502805388781723926; // Ai(0) = 1/(3^{2/3}Γ(2/3))
  static const double AI_C2 = 0.25881940379280679841; // -Ai'(0) = 1/(3^{1/3}Γ(1/3))

  double c[200];
  c[0] = AI_C1;
  c[1] = -AI_C2;
  c[2] = 0.0;
  for (int n = 1; n <= 196; ++n) {
    c[n+2] = c[n-1] / (static_cast<double>(n+1) * static_cast<double>(n+2));
  }
  // Horner-like evaluation
  double xpow = 1.0;
  double sum = 0.0;
  for (int n = 0; n < 199; ++n) {
    sum += c[n] * xpow;
    xpow *= x;
    if (n > 30 && std::abs(c[n] * xpow) < 1e-17 * std::abs(sum)) break;
  }
  return sum;
}

/**
 * Laguerre polynomial L_n(x) via forward recurrence.
 * L_0 = 1, L_1 = 1-x, L_{n+1} = ((2n+1-x)L_n - nL_{n-1}) / (n+1)
 */
double laguerre_l(int n, double x) {
  if (n == 0) return 1.0;
  if (n == 1) return 1.0 - x;
  double l0 = 1.0, l1 = 1.0 - x;
  for (int k = 1; k < n; ++k) {
    double l2 = ((2.0*k + 1.0 - x) * l1 - static_cast<double>(k) * l0) / static_cast<double>(k + 1);
    l0 = l1;
    l1 = l2;
  }
  return l1;
}

/**
 * Hermite polynomial H_n(x) (probabilist's version He_n).
 * He_0 = 1, He_1 = x, He_{n+1} = x·He_n - n·He_{n-1}
 * Physicist's H_n(x): H_0=1, H_1=2x, H_{n+1}=2x·H_n - 2n·H_{n-1}
 * We use physicist's convention.
 */
double hermite_h(int n, double x) {
  if (n == 0) return 1.0;
  if (n == 1) return 2.0 * x;
  double h0 = 1.0, h1 = 2.0 * x;
  for (int k = 1; k < n; ++k) {
    double h2 = 2.0 * x * h1 - 2.0 * static_cast<double>(k) * h0;
    h0 = h1;
    h1 = h2;
  }
  return h1;
}

/**
 * Legendre polynomial P_n(x) via forward recurrence.
 * P_0 = 1, P_1 = x, (n+1)P_{n+1} = (2n+1)x·P_n - n·P_{n-1}
 */
double legendre_p(int n, double x) {
  if (n == 0) return 1.0;
  if (n == 1) return x;
  double p0 = 1.0, p1 = x;
  for (int k = 1; k < n; ++k) {
    double p2 = ((2.0*k + 1.0) * x * p1 - static_cast<double>(k) * p0) / static_cast<double>(k + 1);
    p0 = p1;
    p1 = p2;
  }
  return p1;
}

/**
 * Chebyshev polynomial T_n(x).
 * T_0 = 1, T_1 = x, T_{n+1} = 2x·T_n - T_{n-1}
 */
double chebyshev_t(int n, double x) {
  if (n == 0) return 1.0;
  if (n == 1) return x;
  double t0 = 1.0, t1 = x;
  for (int k = 1; k < n; ++k) {
    double t2 = 2.0 * x * t1 - t0;
    t0 = t1;
    t1 = t2;
  }
  return t1;
}

/**
 * Hyperbolic sine integral Shi(x) = ∫₀ˣ sinh(t)/t dt.
 * Series: Shi(x) = Σ_{k=0}^∞ x^{2k+1} / ((2k+1)·(2k+1)!)
 */
double shi(double x) {
  double x2 = x * x;
  double term = x;
  double sum = x;
  for (int k = 1; k <= 60; ++k) {
    term *= x2 / (static_cast<double>(2*k) * static_cast<double>(2*k + 1));
    double contrib = term / static_cast<double>(2*k + 1);
    sum += contrib;
    if (std::abs(contrib) < 1e-16 * std::abs(sum)) break;
  }
  return sum;
}

/**
 * Hyperbolic cosine integral Chi(x) = γ + ln(x) + ∫₀ˣ (cosh(t)-1)/t dt.
 * Series: Chi(x) = γ + ln(x) + Σ_{k=1}^∞ x^{2k} / (2k·(2k)!)
 */
double chi(double x) {
  if (x <= 0) return NAN;
  static const double EULER = 0.57721566490153286060;
  double x2 = x * x;
  double term = 1.0;
  double sum = 0.0;
  for (int k = 1; k <= 60; ++k) {
    term *= x2 / (static_cast<double>(2*k - 1) * static_cast<double>(2*k));
    double contrib = term / static_cast<double>(2*k);
    sum += contrib;
    if (std::abs(contrib) < 1e-16 * std::abs(sum)) break;
  }
  return EULER + std::log(x) + sum;
}

/**
 * Airy function Bi(x) — companion to Ai(x).
 * Same ODE Bi''(x) = x·Bi(x), different initial conditions:
 * Bi(0) = 1/(3^{1/6}Γ(2/3)), Bi'(0) = 3^{1/6}/Γ(1/3)
 */
double airy_bi(double x) {
  static const double BI_C1 = 0.61492662744600073516; // Bi(0)
  static const double BI_C2 = 0.44828835735382635791; // Bi'(0)

  double c[200];
  c[0] = BI_C1;
  c[1] = BI_C2;
  c[2] = 0.0;
  for (int n = 1; n <= 196; ++n) {
    c[n+2] = c[n-1] / (static_cast<double>(n+1) * static_cast<double>(n+2));
  }
  double xpow = 1.0;
  double sum = 0.0;
  for (int n = 0; n < 199; ++n) {
    sum += c[n] * xpow;
    xpow *= x;
    if (n > 30 && std::abs(c[n] * xpow) < 1e-17 * std::abs(sum)) break;
  }
  return sum;
}

/**
 * Sine integral Si(x) = ∫₀ˣ sin(t)/t dt.
 * Series: Si(x) = Σ_{k=0}^∞ (-1)^k x^{2k+1} / ((2k+1)·(2k+1)!)
 */
double sine_integral(double x) {
  double x2 = x * x;
  double term = x;
  double sum = x;
  for (int k = 1; k <= 60; ++k) {
    term *= -x2 / (static_cast<double>(2*k) * static_cast<double>(2*k + 1));
    double contrib = term / static_cast<double>(2*k + 1);
    sum += contrib;
    if (std::abs(contrib) < 1e-16 * std::abs(sum)) break;
  }
  return sum;
}

/**
 * Cosine integral Ci(x) = γ + ln(x) + ∫₀ˣ (cos(t)-1)/t dt.
 * Series: Ci(x) = γ + ln(x) + Σ_{k=1}^∞ (-1)^k x^{2k} / (2k·(2k)!)
 */
double cosine_integral(double x) {
  if (x <= 0) return NAN;
  static const double EULER = 0.57721566490153286060;
  double x2 = x * x;
  double term = 1.0;
  double sum = 0.0;
  for (int k = 1; k <= 60; ++k) {
    term *= -x2 / (static_cast<double>(2*k - 1) * static_cast<double>(2*k));
    double contrib = term / static_cast<double>(2*k);
    sum += contrib;
    if (std::abs(contrib) < 1e-16 * std::abs(sum)) break;
  }
  return EULER + std::log(x) + sum;
}

/**
 * Inverse error function erfinv(p): x such that erf(x) = p.
 * Newton iteration on erf(x) - p = 0, starting from rational approximation.
 */
double erfinv(double p) {
  if (p <= -1.0) return -INFINITY;
  if (p >= 1.0) return INFINITY;
  if (p == 0.0) return 0.0;

  // Initial guess via rational approx
  double a = 0.147;
  double ln1mp2 = std::log(1.0 - p * p);
  double t = 2.0 / (M_PI * a) + ln1mp2 / 2.0;
  double x0 = (p > 0 ? 1 : -1) * std::sqrt(std::sqrt(t * t - ln1mp2 / a) - t);

  // Newton iterations: x_{n+1} = x_n - (erf(x_n) - p) / (2/√π · e^{-x_n²})
  double x = x0;
  for (int i = 0; i < 10; ++i) {
    double f = std::erf(x) - p;
    double fp = 2.0 / std::sqrt(M_PI) * std::exp(-x * x);
    double dx = f / fp;
    x -= dx;
    if (std::abs(dx) < 1e-16 * std::abs(x)) break;
  }
  return x;
}

/**
 * Lambert W function W₀(x): principal branch of w·e^w = x.
 * Newton iteration with Halley step.
 */
double lambertw(double x) {
  if (x == 0.0) return 0.0;
  if (x < -1.0/M_E) return NAN;
  if (x == -1.0/M_E) return -1.0;

  // Initial guess
  double w;
  if (x < 1.0) {
    w = x * (1.0 - x * (1.0 - 2.0 * x)); // Taylor near 0
  } else {
    w = std::log(x);
    if (x > 3.0) w -= std::log(w);
  }

  // Halley iteration
  for (int i = 0; i < 20; ++i) {
    double ew = std::exp(w);
    double wew = w * ew;
    double f = wew - x;
    double fp = ew * (w + 1.0);
    double fpp = ew * (w + 2.0);
    double dw = f / (fp - f * fpp / (2.0 * fp));
    w -= dw;
    if (std::abs(dw) < 1e-16 * std::abs(w)) break;
  }
  return w;
}

/**
 * Clausen function Cl₂(θ) = -∫₀^θ ln|2sin(t/2)| dt = Σ sin(kθ)/k².
 * Series converges for all θ.
 */
double clausen(double theta) {
  double sum = 0.0;
  for (int k = 1; k <= 200; ++k) {
    double term = std::sin(k * theta) / (static_cast<double>(k) * static_cast<double>(k));
    sum += term;
    if (std::abs(term) < 1e-16 * std::abs(sum) && k > 10) break;
  }
  return sum;
}

/**
 * Debye function D_n(x) = (n/x^n) ∫₀ˣ t^n/(e^t - 1) dt.
 * For n=1: D₁(x). Use series for small x, quadrature for moderate x.
 */
double debye1(double x) {
  if (x == 0) return 1.0;
  if (std::abs(x) < 1e-6) return 1.0 - x/4.0;

  // Series: D₁(x) = 1 - x/4 + Σ_{k=1}^∞ B_{2k}·x^{2k}/((2k+1)·(2k)!)
  // For x <= 4: series
  if (x <= 4.0) {
    // Numerical integration via Simpson's rule
    int N = 1000;
    double h = x / N;
    double sum = 0.0; // f(0) = lim t/(e^t-1) = 1
    sum += 1.0; // f(0) = 1
    sum += (x * std::exp(-x) / (1.0 - std::exp(-x))); // f(x)
    for (int i = 1; i < N; ++i) {
      double t = i * h;
      double f = t / (std::exp(t) - 1.0);
      sum += f * ((i % 2 == 0) ? 2.0 : 4.0);
    }
    return sum * h / (3.0 * x);
  }

  // Large x: D₁(x) → π²/(6x) approximately
  return M_PI * M_PI / (6.0 * x);
}

/**
 * Inverse hyperbolic sine integral inverse.
 * Actually: normal distribution quantile (probit) Φ⁻¹(p).
 * Uses Beasley-Springer-Moro algorithm.
 */
double normsinv(double p) {
  if (p <= 0) return -INFINITY;
  if (p >= 1) return INFINITY;
  if (p == 0.5) return 0.0;

  // Rational approximation (Abramowitz & Stegun 26.2.23)
  double t;
  if (p < 0.5) {
    t = std::sqrt(-2.0 * std::log(p));
  } else {
    t = std::sqrt(-2.0 * std::log(1.0 - p));
  }

  // Coefficients from A&S
  static const double c0 = 2.515517;
  static const double c1 = 0.802853;
  static const double c2 = 0.010328;
  static const double d1 = 1.432788;
  static const double d2 = 0.189269;
  static const double d3 = 0.001308;

  double x0 = t - (c0 + t * (c1 + t * c2)) / (1.0 + t * (d1 + t * (d2 + t * d3)));
  double x = (p < 0.5) ? -x0 : x0;

  // Polish with Newton: Φ(x) = p, Φ'(x) = φ(x) = pdf
  for (int i = 0; i < 5; ++i) {
    double phi = 0.5 * std::erfc(-x / std::sqrt(2.0));
    double pdf = std::exp(-x * x / 2.0) / std::sqrt(2.0 * M_PI);
    double dx = (phi - p) / pdf;
    x -= dx;
    if (std::abs(dx) < 1e-16 * (1.0 + std::abs(x))) break;
  }

  return x;
}

/**
 * Logistic sigmoid σ(x) = 1/(1+e^{-x}).
 */
double sigmoid(double x) {
  if (x >= 0) {
    return 1.0 / (1.0 + std::exp(-x));
  }
  double ex = std::exp(x);
  return ex / (1.0 + ex);
}

/**
 * Complementary log-log function: log(-log(1-p)).
 * cloglog(p) = ln(-ln(1-p))
 */
double cloglog(double p) {
  if (p <= 0 || p >= 1) return NAN;
  return std::log(-std::log(1.0 - p));
}

/**
 * Logit function: logit(p) = ln(p/(1-p)).
 */
double logit(double p) {
  if (p <= 0 || p >= 1) return NAN;
  return std::log(p / (1.0 - p));
}

/**
 * Inverse logit (expit): expit(x) = 1/(1+e^{-x}) = sigmoid.
 */
double expit(double x) {
  return sigmoid(x);
}

/**
 * Struve function H₀(x).
 * H₀(x) = (2/π) Σ_{k=0}^∞ (-1)^k (x/2)^{2k+1} / ((2k+1)!!)²  
 * Actually: H₀(x) = (2/π) Σ (-1)^k x^{2k+1} / (Γ(k+3/2)Γ(k+3/2)·...)
 * Simpler: use the series H₀(x) = (2/π)·x·Σ_{k=0} (-x²/4)^k / ((1·3)·(1·3·5)·...)²
 * Standard form: H₀(x) = (2x/π) · Σ_{k=0}^∞ (-x²/4)^k / ((2k+1)!!)²
 */
double struve_h0(double x) {
  double x24 = -x * x / 4.0;
  double term = 1.0;  // k=0 term
  double sum = 1.0;
  double odd_prod = 1.0;  // (2k+1)!! squared denominator tracker
  for (int k = 1; k <= 60; ++k) {
    double odd = static_cast<double>(2*k + 1);
    term *= x24 / (static_cast<double>(2*k - 1) * static_cast<double>(2*k - 1));
    // Actually: ratio = (-x²/4) / ((2k-1)(2k+1))... this is getting messy.
    // Let me use a cleaner recurrence.
    // H₀(x) = (2/π) Σ_{k=0}^∞ (-1)^k · (x/2)^{2k+1} / (Γ(k+3/2))²
    // Γ(k+3/2) = (2k+1)!! √π / 2^{k+1}
    break;
  }
  // Actually just implement directly:
  // H₀(x) = (2/π) x Σ_{k=0}^∞ (-1)^k (x²/4)^k / ((1·3)(3·5)(5·7)...) — wrong
  // Use the defining series:
  // H_ν(x) = (x/2)^{ν+1} Σ (-1)^k (x/2)^{2k} / (Γ(k+3/2)Γ(k+ν+3/2))
  // For ν=0: H₀(x) = (2/π) Σ_{k=0}^∞ (-1)^k (x/2)^{2k+1} / ((2k+1)·(2k-1)!!·(2k+1)!!)
  // This is complex. Let me just do numerical integration.
  // H₀(x) = (2/π) ∫₀^{π/2} sin(x cos θ) dθ
  if (x == 0) return 0.0;
  int N = 1000;
  double h_step = M_PI / 2.0 / N;
  double s = 0.0;
  for (int i = 0; i < N; ++i) {
    double theta = (i + 0.5) * h_step;
    s += std::sin(x * std::cos(theta));
  }
  s *= h_step;
  return (2.0 / M_PI) * s;
}

/**
 * Catalan's constant G = Σ_{k=0}^∞ (-1)^k / (2k+1)² ≈ 0.9159655941772190...
 * (Not really a function, but useful as a benchmark constant.)
 * Returns G via Euler acceleration.
 */
double catalan_constant() {
  // Direct series with Kahan summation
  double sum = 0.0, comp = 0.0;
  for (int k = 0; k <= 100000; ++k) {
    double sign = (k % 2 == 0) ? 1.0 : -1.0;
    double den = static_cast<double>(2*k + 1);
    double term = sign / (den * den);
    double y = term - comp;
    double t = sum + y;
    comp = (t - sum) - y;
    sum = t;
    if (k > 1000 && std::abs(term) < 1e-16 * std::abs(sum)) break;
  }
  return sum;
}

/**
 * Gegenbauer (ultraspherical) polynomial C_n^λ(x).
 * C_0^λ = 1, C_1^λ = 2λx
 * (n+1)C_{n+1}^λ = 2(n+λ)x·C_n^λ - (n+2λ-1)C_{n-1}^λ
 */
double gegenbauer_c(int n, double lambda, double x) {
  if (n == 0) return 1.0;
  if (n == 1) return 2.0 * lambda * x;
  double c0 = 1.0, c1 = 2.0 * lambda * x;
  for (int k = 1; k < n; ++k) {
    double dk = static_cast<double>(k);
    double c2 = (2.0 * (dk + lambda) * x * c1 - (dk + 2.0*lambda - 1.0) * c0) / (dk + 1.0);
    c0 = c1;
    c1 = c2;
  }
  return c1;
}

/**
 * Upper incomplete gamma Γ(a,x) = ∫_x^∞ t^{a-1} e^{-t} dt.
 * For x > a+1: continued fraction (Legendre).
 * For x ≤ a+1: use Γ(a) - γ(a,x) via series.
 */
double upper_gamma(double a, double x) {
  if (x < 0) return NAN;
  if (x == 0) return std::tgamma(a);

  if (x > a + 1.0) {
    // Continued fraction: Γ(a,x) = e^{-x} x^a · CF
    // CF via Lentz's method
    double b = x + 1.0 - a;
    double c = 1e30;
    double d = 1.0 / b;
    double h = d;
    for (int k = 1; k <= 100; ++k) {
      double an = -static_cast<double>(k) * (static_cast<double>(k) - a);
      b += 2.0;
      d = b + an * d;
      if (std::abs(d) < 1e-30) d = 1e-30;
      c = b + an / c;
      if (std::abs(c) < 1e-30) c = 1e-30;
      d = 1.0 / d;
      double del = d * c;
      h *= del;
      if (std::abs(del - 1.0) < 1e-16) break;
    }
    return std::exp(-x + a * std::log(x)) * h;
  }

  // Series: γ(a,x) = e^{-x} x^a Σ x^k / (a(a+1)...(a+k))
  // Then Γ(a,x) = Γ(a) - γ(a,x)
  double term = 1.0 / a;
  double sum = term;
  for (int k = 1; k <= 100; ++k) {
    term *= x / (a + static_cast<double>(k));
    sum += term;
    if (std::abs(term) < 1e-16 * std::abs(sum)) break;
  }
  double lower = std::exp(-x + a * std::log(x)) * sum;
  return std::tgamma(a) - lower;
}

/**
 * Lower incomplete gamma ratio P(a,x) = γ(a,x)/Γ(a).
 * Also known as the regularized gamma function.
 */
double gamma_p(double a, double x) {
  if (x < 0) return NAN;
  if (x == 0) return 0.0;
  return 1.0 - upper_gamma(a, x) / std::tgamma(a);
}

/**
 * Chebyshev polynomial of the second kind U_n(x).
 * U_0 = 1, U_1 = 2x, U_{n+1} = 2x·U_n - U_{n-1}
 */
double chebyshev_u(int n, double x) {
  if (n == 0) return 1.0;
  if (n == 1) return 2.0 * x;
  double u0 = 1.0, u1 = 2.0 * x;
  for (int k = 1; k < n; ++k) {
    double u2 = 2.0 * x * u1 - u0;
    u0 = u1;
    u1 = u2;
  }
  return u1;
}

/**
 * Pochhammer symbol (rising factorial) (a)_n = a(a+1)(a+2)...(a+n-1).
 */
double pochhammer(double a, int n) {
  if (n == 0) return 1.0;
  if (n < 0) return NAN;
  double result = 1.0;
  for (int k = 0; k < n; ++k) {
    result *= (a + static_cast<double>(k));
  }
  return result;
}

/**
 * Falling factorial x^{(n)} = x(x-1)(x-2)...(x-n+1).
 */
double falling_factorial(double x, int n) {
  if (n == 0) return 1.0;
  if (n < 0) return NAN;
  double result = 1.0;
  for (int k = 0; k < n; ++k) {
    result *= (x - static_cast<double>(k));
  }
  return result;
}

/**
 * Double factorial n!!.
 * n!! = n·(n-2)·(n-4)·...·1 (odd), or n·(n-2)·...·2 (even)
 */
double double_factorial(int n) {
  if (n <= 0) return 1.0;
  double result = 1.0;
  for (int k = n; k >= 1; k -= 2) {
    result *= static_cast<double>(k);
  }
  return result;
}

/**
 * Binomial coefficient C(n,k) = n! / (k!(n-k)!).
 * Uses lgamma for numerical stability.
 */
double binomial_coeff(int n, int k) {
  if (k < 0 || k > n) return 0.0;
  if (k == 0 || k == n) return 1.0;
  return std::round(std::exp(
    std::lgamma(n + 1.0) - std::lgamma(k + 1.0) - std::lgamma(n - k + 1.0)
  ));
}

/**
 * Spherical Bessel j_n(x) = √(π/(2x)) J_{n+1/2}(x).
 * For n=0: j_0(x) = sin(x)/x.
 * Forward recurrence from j_0 and j_1.
 */
double sph_bessel_j(int n, double x) {
  if (x == 0) return (n == 0) ? 1.0 : 0.0;
  if (n == 0) return std::sin(x) / x;
  if (n == 1) return std::sin(x) / (x * x) - std::cos(x) / x;
  double j0 = std::sin(x) / x;
  double j1 = std::sin(x) / (x * x) - std::cos(x) / x;
  for (int k = 1; k < n; ++k) {
    double j2 = (2.0 * k + 1.0) / x * j1 - j0;
    j0 = j1;
    j1 = j2;
  }
  return j1;
}

/**
 * Spherical Bessel y_n(x) = √(π/(2x)) Y_{n+1/2}(x).
 * y_0(x) = -cos(x)/x.
 */
double sph_bessel_y(int n, double x) {
  if (x == 0) return -INFINITY;
  if (n == 0) return -std::cos(x) / x;
  if (n == 1) return -std::cos(x) / (x * x) - std::sin(x) / x;
  double y0 = -std::cos(x) / x;
  double y1 = -std::cos(x) / (x * x) - std::sin(x) / x;
  for (int k = 1; k < n; ++k) {
    double y2 = (2.0 * k + 1.0) / x * y1 - y0;
    y0 = y1;
    y1 = y2;
  }
  return y1;
}

/**
 * Regularized incomplete beta function I_x(a,b).
 * Series expansion for x < (a+1)/(a+b+2), CF otherwise.
 */
double betainc(double a, double b, double x) {
  if (x <= 0) return 0.0;
  if (x >= 1) return 1.0;

  // Use the identity: I_x(a,b) = 1 - I_{1-x}(b,a) for better convergence
  bool flip = x > (a + 1.0) / (a + b + 2.0);
  double aa = flip ? b : a;
  double bb = flip ? a : b;
  double xx = flip ? 1.0 - x : x;

  // Series: I_x(a,b) = x^a (1-x)^b / (a·B(a,b)) · Σ_{k=0} (1-b)_k x^k / ((a+k) k!)
  double prefix = std::exp(
    aa * std::log(xx) + bb * std::log(1.0 - xx)
    - std::lgamma(aa) - std::lgamma(bb) + std::lgamma(aa + bb)
  ) / aa;

  double term = 1.0;
  double sum = 1.0;
  for (int k = 1; k <= 200; ++k) {
    term *= xx * (static_cast<double>(k) - bb) / static_cast<double>(k);
    double contrib = term * aa / (aa + static_cast<double>(k));
    sum += contrib;
    if (std::abs(contrib) < 1e-16 * std::abs(sum)) break;
  }

  double result = prefix * sum;
  return flip ? 1.0 - result : result;
}

/**
 * Harmonic number H_n = 1 + 1/2 + 1/3 + ... + 1/n.
 */
double harmonic(int n) {
  if (n <= 0) return 0.0;
  double sum = 0.0;
  for (int k = n; k >= 1; --k) { // reverse for Kahan-like stability
    sum += 1.0 / static_cast<double>(k);
  }
  return sum;
}

/**
 * Generalized harmonic number H_n^m = Σ_{k=1}^n 1/k^m.
 */
double gen_harmonic(int n, double m) {
  if (n <= 0) return 0.0;
  double sum = 0.0;
  for (int k = n; k >= 1; --k) {
    sum += 1.0 / std::pow(static_cast<double>(k), m);
  }
  return sum;
}

/**
 * Jacobi polynomial P_n^{α,β}(x).
 * P_0 = 1
 * P_1 = (α-β)/2 + (α+β+2)x/2
 * Recurrence: a1·P_{n+1} = (a2 + a3·x)·P_n - a4·P_{n-1}
 */
double jacobi_p(int n, double alpha, double beta, double x) {
  if (n == 0) return 1.0;
  double p0 = 1.0;
  double p1 = (alpha - beta) / 2.0 + (alpha + beta + 2.0) * x / 2.0;
  if (n == 1) return p1;
  for (int k = 1; k < n; ++k) {
    double dk = static_cast<double>(k);
    double ab = alpha + beta;
    double a1 = 2.0 * (dk + 1.0) * (dk + ab + 1.0) * (2.0 * dk + ab);
    double a2 = (2.0 * dk + ab + 1.0) * (alpha * alpha - beta * beta);
    double a3 = (2.0 * dk + ab) * (2.0 * dk + ab + 1.0) * (2.0 * dk + ab + 2.0);
    double a4 = 2.0 * (dk + alpha) * (dk + beta) * (2.0 * dk + ab + 2.0);
    double p2 = ((a2 + a3 * x) * p1 - a4 * p0) / a1;
    p0 = p1;
    p1 = p2;
  }
  return p1;
}

/**
 * Associated Legendre function P_l^m(x) (without Condon-Shortley phase).
 * Uses forward recurrence.
 */
double assoc_legendre(int l, int m, double x) {
  if (m < 0 || m > l) return 0.0;
  // P_m^m(x) = (2m-1)!! (1-x²)^{m/2}
  double pmm = 1.0;
  if (m > 0) {
    double somx2 = std::sqrt(1.0 - x * x);
    double fact = 1.0;
    for (int i = 1; i <= m; ++i) {
      pmm *= fact * somx2;
      fact += 2.0;
    }
  }
  if (l == m) return pmm;
  // P_{m+1}^m = x(2m+1) P_m^m
  double pmm1 = x * (2.0 * m + 1.0) * pmm;
  if (l == m + 1) return pmm1;
  // Forward recurrence
  double pll = 0.0;
  for (int ll = m + 2; ll <= l; ++ll) {
    pll = (x * (2.0 * ll - 1.0) * pmm1 - (ll + m - 1.0) * pmm) / (ll - m);
    pmm = pmm1;
    pmm1 = pll;
  }
  return pll;
}

/**
 * Exponential integral Ei(x) = -PV ∫_{-x}^∞ e^{-t}/t dt = γ + ln|x| + Σ x^k/(k·k!).
 */
double expint_ei(double x) {
  if (x == 0) return -INFINITY;
  if (x < 0) {
    // Ei(-x) = -E1(x) for x > 0
    return -expint_e1(-x);
  }
  if (x <= 40.0) {
    // Series: Ei(x) = γ + ln(x) + Σ_{k=1}^∞ x^k/(k·k!)
    double sum = 0.5772156649015329 + std::log(x);
    double term = x;
    sum += term;
    for (int k = 2; k <= 100; ++k) {
      term *= x / static_cast<double>(k);
      double contrib = term / static_cast<double>(k);
      sum += contrib;
      if (std::abs(contrib) < 1e-16 * std::abs(sum)) break;
    }
    return sum;
  }
  // Asymptotic: Ei(x) ≈ e^x/x (1 + 1!/x + 2!/x² + ...)
  double sum = 0.0;
  double term = 1.0;
  for (int k = 1; k <= 40; ++k) {
    double old_term = term;
    term *= static_cast<double>(k) / x;
    if (std::abs(term) > std::abs(old_term)) break;
    sum += term;
  }
  return std::exp(x) / x * (1.0 + sum);
}

/**
 * Bessel Y_n(x) for arbitrary order n via forward recurrence from Y0/Y1.
 */
double bessel_yn(int n, double x) {
  if (n == 0) return bessel_y0(x);
  if (n == 1) return bessel_y1(x);
  double y0 = bessel_y0(x);
  double y1 = bessel_y1(x);
  for (int k = 1; k < n; ++k) {
    double y2 = (2.0 * k) / x * y1 - y0;
    y0 = y1;
    y1 = y2;
  }
  return y1;
}

/**
 * Lanczos approximation of Γ(x) — not used directly, but for reference.
 * Here we implement reciprocal gamma: 1/Γ(x) which avoids overflow.
 */
double rgamma(double x) {
  return 1.0 / std::tgamma(x);
}

/**
 * Log of binomial coefficient: ln C(n,k).
 * More numerically stable than log(C(n,k)) for large n.
 */
double log_binomial(int n, int k) {
  if (k < 0 || k > n) return -INFINITY;
  if (k == 0 || k == n) return 0.0;
  return std::lgamma(n + 1.0) - std::lgamma(k + 1.0) - std::lgamma(n - k + 1.0);
}

/**
 * Inverse error function complement: erfcinv(p) = erfinv(1-p).
 * Uses the same Newton iteration approach as erfinv.
 */
double erfcinv(double p) {
  return erfinv(1.0 - p);
}

/**
 * Bessel I_n(x) for arbitrary integer order via forward recurrence from I₀, I₁.
 * Uses Miller's backward recurrence for stability.
 */
double bessel_in(int n, double x) {
  if (n == 0) return bessel_i0(x);
  if (n == 1) return bessel_i1(x);
  if (x == 0.0) return 0.0;

  // Miller's backward recurrence for I_n
  int nmax = n + 30 + static_cast<int>(std::sqrt(40.0 * n));
  double tox = 2.0 / x;
  double bip = 0.0, bi = 1.0;
  double ans = 0.0;
  for (int j = nmax; j >= 1; --j) {
    double bim = bip + static_cast<double>(j) * tox * bi;
    bip = bi;
    bi = bim;
    // Prevent overflow
    if (std::abs(bi) > 1e10) {
      ans *= 1e-10;
      bi *= 1e-10;
      bip *= 1e-10;
    }
    if (j == n) ans = bip;
  }
  // Normalize: I₀ = sum
  ans *= bessel_i0(x) / bi;
  return (x < 0 && (n % 2 == 1)) ? -ans : ans;
}

/**
 * Polygamma ψ^{(n)}(x) — the n-th derivative of digamma.
 * ψ^{(0)} = digamma, ψ^{(1)} = trigamma, etc.
 * For n ≥ 1: ψ^{(n)}(x) = (-1)^{n+1} n! Σ_{k=0}^∞ 1/(x+k)^{n+1}
 */
double polygamma(int n, double x) {
  if (n == 0) return digamma(x);
  if (n == 1) return trigamma(x);
  if (x <= 0 || n < 0) return NAN;

  // Shift to large x for asymptotic convergence
  double result = 0.0;
  while (x < 20.0) {
    result += 1.0 / std::pow(x, n + 1);
    x += 1.0;
  }

  // Asymptotic: ψ^{(n)}(x) ~ (-1)^{n+1} [ (n-1)!/x^n + n!/(2x^{n+1}) + Σ B_{2k}·.../(x^{n+2k}) ]
  double inv_x = 1.0 / x;
  double sum = 0.0;
  // Leading term: (n-1)! / x^n
  double n_fact_m1 = std::tgamma(static_cast<double>(n)); // (n-1)!
  sum += n_fact_m1 * std::pow(inv_x, n);
  // Next: n! / (2x^{n+1})
  double n_fact = n_fact_m1 * n;
  sum += 0.5 * n_fact * std::pow(inv_x, n + 1);
  // Bernoulli terms
  static const double B[] = {1.0/6, -1.0/30, 1.0/42, -1.0/30, 5.0/66, -691.0/2730, 7.0/6};
  double term = 1.0;
  for (int k = 0; k < 7; ++k) {
    int m = 2*k + 2;
    double rising = 1.0;
    for (int j = 0; j < m; ++j) {
      rising *= static_cast<double>(n + j);
    }
    double contrib = B[k] * rising / std::tgamma(m + 1.0) * std::pow(inv_x, n + m);
    sum += contrib;
  }

  result += sum;
  return (n % 2 == 0) ? -result : result;
}

/**
 * Exponential integral E_n(x) = ∫₁^∞ e^{-xt}/t^n dt.
 * For n=1 uses our existing E1. For n≥2 uses the recurrence:
 * E_{n+1}(x) = (1/n)(e^{-x} - x·E_n(x))
 */
double expint_en(int n, double x) {
  if (n == 1) return expint_e1(x);
  if (x < 0) return NAN;
  if (x == 0) return 1.0 / static_cast<double>(n - 1);

  // Forward recurrence from E1
  double e = expint_e1(x);
  double emx = std::exp(-x);
  for (int k = 1; k < n; ++k) {
    e = (emx - x * e) / static_cast<double>(k);
  }
  return e;
}

/**
 * Associated Laguerre polynomial L_n^α(x).
 * L_0^α = 1, L_1^α = 1+α-x.
 * (n+1)L_{n+1}^α = (2n+1+α-x)L_n^α - (n+α)L_{n-1}^α.
 */
double assoc_laguerre(int n, double alpha, double x) {
  if (n == 0) return 1.0;
  double l0 = 1.0;
  double l1 = 1.0 + alpha - x;
  if (n == 1) return l1;
  for (int k = 1; k < n; ++k) {
    double dk = static_cast<double>(k);
    double l2 = ((2.0*dk + 1.0 + alpha - x) * l1 - (dk + alpha) * l0) / (dk + 1.0);
    l0 = l1;
    l1 = l2;
  }
  return l1;
}

/**
 * Bessel K_n(x) for arbitrary integer order via forward recurrence from K₀, K₁.
 */
double bessel_kn(int n, double x) {
  if (n == 0) return bessel_k0(x);
  if (n == 1) return bessel_k1(x);
  if (x <= 0) return (x == 0) ? INFINITY : NAN;
  double k0 = bessel_k0(x);
  double k1 = bessel_k1(x);
  for (int k = 1; k < n; ++k) {
    double k2 = k0 + 2.0 * static_cast<double>(k) / x * k1;
    k0 = k1;
    k1 = k2;
  }
  return k1;
}

/**
 * Spherical harmonic normalization factor
 * Y_l^m normalization: √((2l+1)/(4π) · (l-m)!/(l+m)!)
 */
double sph_harm_norm(int l, int m) {
  if (m < 0) m = -m;
  double factor = (2.0*l + 1.0) / (4.0 * M_PI);
  for (int j = l - m + 1; j <= l + m; ++j) {
    factor /= static_cast<double>(j);
  }
  return std::sqrt(factor);
}

/**
 * Hurwitz zeta ζ(s,a) = Σ_{n=0}^∞ 1/(n+a)^s for s > 1.
 */
double hurwitz_zeta(double s, double a) {
  if (s <= 1.0 || a <= 0.0) return NAN;
  // Euler-Maclaurin with sufficient terms
  double sum = 0.0;
  int N = 1000;
  for (int n = 0; n < N; ++n) {
    sum += 1.0 / std::pow(static_cast<double>(n) + a, s);
  }
  // Integral approximation for tail: ∫_N^∞ 1/(t+a)^s dt = (N+a)^{1-s}/(s-1)
  double Na = static_cast<double>(N) + a;
  sum += std::pow(Na, 1.0 - s) / (s - 1.0);
  // Leading Bernoulli corrections
  sum += 0.5 * std::pow(Na, -s);
  sum += s / 12.0 * std::pow(Na, -s - 1.0);
  return sum;
}

/**
 * Bernstein basis polynomial B_{k,n}(t) = C(n,k) t^k (1-t)^{n-k}.
 */
double bernstein(int n, int k, double t) {
  if (k < 0 || k > n) return 0.0;
  return binomial_coeff(n, k) * std::pow(t, k) * std::pow(1.0 - t, n - k);
}

/**
 * Catalan number C_n = C(2n,n)/(n+1).
 */
double catalan_number(int n) {
  if (n < 0) return 0.0;
  return binomial_coeff(2*n, n) / static_cast<double>(n + 1);
}

/**
 * Chi-squared CDF: P(k/2, x/2) where P is the regularized lower gamma.
 */
double chi2_cdf(double k, double x) {
  return gamma_p(k / 2.0, x / 2.0);
}

/**
 * Wigner 3j symbol lookup for (j1=1, j2=1, j3=1, m1=0, m2=0, m3=0).
 * Too specialized — skip.
 * Instead: Stirling number of the second kind S(n,k).
 * S(n,1)=1, S(n,n)=1, S(n,k) = k·S(n-1,k) + S(n-1,k-1).
 */
double stirling2(int n, int k) {
  if (k < 0 || k > n) return 0.0;
  if (k == 0) return (n == 0) ? 1.0 : 0.0;
  if (k == 1 || k == n) return 1.0;

  // DP table for moderate n
  if (n > 100) return NAN;
  // Use recurrence row by row
  std::vector<double> prev(k + 1, 0.0);
  std::vector<double> curr(k + 1, 0.0);
  prev[1] = 1.0;
  for (int i = 2; i <= n; ++i) {
    for (int j = 1; j <= std::min(i, k); ++j) {
      curr[j] = static_cast<double>(j) * prev[j] + prev[j - 1];
    }
    std::swap(prev, curr);
    std::fill(curr.begin(), curr.end(), 0.0);
  }
  return prev[k];
}

/**
 * Bell number B_n = Σ S(n,k).
 */
double bell_number(int n) {
  if (n < 0) return 0.0;
  if (n == 0) return 1.0;
  double sum = 0.0;
  for (int k = 1; k <= n; ++k) {
    sum += stirling2(n, k);
  }
  return sum;
}

/**
 * Euler number E_n (the secant/tangent numbers).
 * E_0=1, E_1=0, E_2=-1, E_3=0, E_4=5, E_5=0, E_6=-61...
 * Using the formula: E_{2n} = (-1)^n × sum formula.
 * Simpler: use forward differences.
 */
double euler_number(int n) {
  if (n < 0) return 0.0;
  if (n % 2 == 1) return 0.0; // Odd Euler numbers are 0
  int m = n / 2;
  if (m == 0) return 1.0;
  // E_{2m} via the recursion involving binomial coefficients
  // E_0=1, and E_{2m} = -Σ_{k=0}^{m-1} C(2m,2k)·E_{2k}
  std::vector<double> E(m + 1, 0.0);
  E[0] = 1.0;
  for (int i = 1; i <= m; ++i) {
    double sum = 0.0;
    for (int j = 0; j < i; ++j) {
      sum += binomial_coeff(2*i, 2*j) * E[j];
    }
    E[i] = -sum;
  }
  return E[m];
}

/**
 * Stirling numbers of the first kind |s(n,k)| (unsigned).
 * |s(n,0)| = 0, |s(n,n)| = 1, |s(n+1,k)| = n·|s(n,k)| + |s(n,k-1)|.
 */
double stirling1(int n, int k) {
  if (k < 0 || k > n) return 0.0;
  if (n == 0) return (k == 0) ? 1.0 : 0.0;
  if (k == 0) return 0.0;
  if (k == n) return 1.0;
  if (n > 100) return NAN;

  std::vector<double> prev(k + 1, 0.0);
  std::vector<double> curr(k + 1, 0.0);
  prev[1] = 1.0; // |s(1,1)| = 1
  for (int i = 2; i <= n; ++i) {
    for (int j = 1; j <= std::min(i, k); ++j) {
      curr[j] = static_cast<double>(i - 1) * prev[j] + prev[j - 1];
    }
    std::swap(prev, curr);
    std::fill(curr.begin(), curr.end(), 0.0);
  }
  return prev[k];
}

/**
 * Mittag-Leffler function E_α(x) = Σ_{k=0}^∞ x^k / Γ(αk+1).
 * For α=1: E₁(x) = eˣ.
 * For α=2: E₂(x) = cosh(√x) (for x≥0).
 */
double mittag_leffler(double alpha, double x) {
  if (alpha <= 0) return NAN;
  double sum = 0.0;
  double term = 1.0; // x^0 / Γ(1)
  sum += term;
  for (int k = 1; k <= 200; ++k) {
    term *= x / std::tgamma(alpha * k + 1.0) * std::tgamma(alpha * (k - 1) + 1.0);
    // Simpler: just compute directly
    double contrib = std::pow(x, k) / std::tgamma(alpha * k + 1.0);
    sum += contrib;
    if (std::abs(contrib) < 1e-17 * std::abs(sum) && k > 5) break;
  }
  return sum;
}

/**
 * Poisson CDF: P(X ≤ k) = Q(k+1, λ) = 1 - P(k+1, λ)  
 * where P is the regularized lower gamma, Q = 1 - P is the upper.
 */
double poisson_cdf(int k, double lambda) {
  if (lambda < 0) return NAN;
  if (lambda == 0) return 1.0;
  if (k < 0) return 0.0;
  // Q(k+1, λ) = Γ(k+1, λ) / Γ(k+1)
  return 1.0 - gamma_p(static_cast<double>(k + 1), lambda);
}

/**
 * Gauss hypergeometric 2F1(a,b;c;z) for |z| < 1.
 * Series: Σ (a)_k (b)_k z^k / ((c)_k k!).
 */
double hyp2f1(double a, double b, double c, double z) {
  if (std::abs(z) >= 1.0) return NAN; // Series diverges
  double sum = 1.0;
  double term = 1.0;
  for (int k = 1; k <= 200; ++k) {
    double dk = static_cast<double>(k);
    term *= (a + dk - 1.0) * (b + dk - 1.0) / ((c + dk - 1.0) * dk) * z;
    sum += term;
    if (std::abs(term) < 1e-16 * std::abs(sum) && k > 5) break;
  }
  return sum;
}

/**
 * Confluent hypergeometric 1F1(a;b;z) = Σ (a)_k z^k / ((b)_k k!).
 */
double hyp1f1(double a, double b, double z) {
  double sum = 1.0;
  double term = 1.0;
  for (int k = 1; k <= 200; ++k) {
    double dk = static_cast<double>(k);
    term *= (a + dk - 1.0) / ((b + dk - 1.0) * dk) * z;
    sum += term;
    if (std::abs(term) < 1e-16 * std::abs(sum) && k > 5) break;
  }
  return sum;
}

/**
 * Confluent hypergeometric limit function 0F1(;b;z) = Σ z^k / ((b)_k k!).
 */
double hyp0f1(double b, double z) {
  double sum = 1.0;
  double term = 1.0;
  for (int k = 1; k <= 200; ++k) {
    double dk = static_cast<double>(k);
    term *= z / ((b + dk - 1.0) * dk);
    sum += term;
    if (std::abs(term) < 1e-16 * std::abs(sum) && k > 5) break;
  }
  return sum;
}

/**
 * Generalized Laguerre function via 1F1:
 * L_n^α(x) = C(n+α,n) · 1F1(-n; α+1; x)
 * (Alternative implementation for verification)
 */

/**
 * Owen's T function T(h,a).
 * T(h,a) = (1/2π) ∫₀^a exp(-h²(1+t²)/2)/(1+t²) dt.
 * For small a: numerical integration.
 */
double owens_t(double h, double a) {
  if (a == 0) return 0.0;
  if (h == 0) return std::atan(a) / (2.0 * M_PI);
  // Midpoint quadrature
  int N = 200;
  double step = a / N;
  double sum = 0.0;
  double h2 = h * h;
  for (int i = 0; i < N; ++i) {
    double t = (i + 0.5) * step;
    double t2 = t * t;
    sum += std::exp(-0.5 * h2 * (1.0 + t2)) / (1.0 + t2);
  }
  return sum * step / (2.0 * M_PI);
}

/**
 * Multinomial coefficient n! / (k1! · k2! · ... · km!).
 * Takes n, and the number of parts follows.
 * Here simplified: trinomial(n, k1, k2) = n! / (k1! k2! (n-k1-k2)!)
 */
double trinomial(int n, int k1, int k2) {
  int k3 = n - k1 - k2;
  if (k1 < 0 || k2 < 0 || k3 < 0) return 0.0;
  return std::round(std::exp(
    std::lgamma(n + 1.0) - std::lgamma(k1 + 1.0) - std::lgamma(k2 + 1.0) - std::lgamma(k3 + 1.0)
  ));
}

/**
 * Log of the gamma function sign: returns sign of Γ(x).
 * Γ(x) is positive when x > 0 or x ∈ (-2,-1)∪(-4,-3)∪...
 */
double gamma_sign(double x) {
  if (x > 0) return 1.0;
  if (x == std::floor(x)) return NAN; // poles
  int n = static_cast<int>(std::floor(-x));
  return (n % 2 == 0) ? -1.0 : 1.0;
}

/**
 * Struve function H₁(x) via numerical integration.
 * H₁(x) = (2/π) ∫₀^{π/2} sin(x cos θ) sin²(θ) dθ... 
 * Actually: H₁(x) = (2x/π) ∫₀^{π/2} sin(x cos θ) sin²(θ) dθ.
 * Let me use: H_ν(x) = (2(x/2)^ν)/(√π Γ(ν+1/2)) ∫₀^{π/2} sin(x cos θ) sin^{2ν}(θ) dθ
 * For ν=1: H₁(x) = (2x/2)/(√π·Γ(3/2)) ∫₀^{π/2} sin(x cosθ) sin²θ dθ
 * Γ(3/2) = √π/2, so factor = x / (√π · √π/2) = x/(π/2) = 2x/π
 * H₁(x) = (2x/π) ∫₀^{π/2} sin(x cosθ) sin²θ dθ
 */
double struve_h1(double x) {
  if (x == 0) return 0.0;
  int N = 1000;
  double h_step = M_PI / 2.0 / N;
  double s = 0.0;
  for (int i = 0; i < N; ++i) {
    double theta = (i + 0.5) * h_step;
    double sin_theta = std::sin(theta);
    s += std::sin(x * std::cos(theta)) * sin_theta * sin_theta;
  }
  s *= h_step;
  return (2.0 * x / M_PI) * s;
}

/**
 * Exponential sum: Σ_{k=0}^{n} x^k / k! (partial sum of eˣ).
 * Useful for computing P(X≤n; λ=x) = e^{-x} · expsum(n, x).
 */
double exp_sum(int n, double x) {
  double sum = 1.0;
  double term = 1.0;
  for (int k = 1; k <= n; ++k) {
    term *= x / static_cast<double>(k);
    sum += term;
  }
  return sum;
}

/**
 * Normalized sinc: sin(πx)/(πx). Already have sinc — this is a no-op alias
 * but we can add: unnormalized sinc: sin(x)/x.
 */
double sinc_unnorm(double x) {
  if (std::abs(x) < 1e-15) return 1.0;
  return std::sin(x) / x;
}

/**
 * Absolute value of Gamma: |Γ(x)| for all real x.
 */
double abs_gamma(double x) {
  return std::abs(std::tgamma(x));
}

/**
 * Dirichlet eta function η(s) = (1 - 2^{1-s})·ζ(s).
 * Converges faster than zeta for s near 1.
 */
double dirichlet_eta(double s) {
  if (s == 1.0) return std::log(2.0); // η(1) = ln(2)
  if (s == 0.0) return 0.5;
  return (1.0 - std::pow(2.0, 1.0 - s)) * riemann_zeta(s);
}

/**
 * Debye function D₂(x) = (2/x²)∫₀ˣ t²/(eᵗ-1) dt.
 */
double debye2(double x) {
  if (x == 0) return 1.0;
  if (std::abs(x) < 1e-6) return 1.0 - x/3.0;
  int N = 1000;
  double h = x / N;
  double sum = 0.0;
  // f(0) = lim t²/(eᵗ-1) = 0 (L'Hôpital → 0)
  // Actually: lim_{t→0} t²/(e^t-1) = lim t²/t = t → 0. Yes.
  for (int i = 1; i < N; ++i) {
    double t = i * h;
    double f = t * t / (std::exp(t) - 1.0);
    sum += f * ((i % 2 == 0) ? 2.0 : 4.0);
  }
  // Endpoints: f(0) = 0, f(x) = x²/(eˣ-1)
  sum += x * x / (std::exp(x) - 1.0);
  return sum * h / (3.0 * x * x / 2.0);
}

/**
 * Debye function D₃(x) = (3/x³)∫₀ˣ t³/(eᵗ-1) dt.
 * Important for Debye model of specific heat.
 */
double debye3(double x) {
  if (x == 0) return 1.0;
  if (std::abs(x) < 1e-6) return 1.0 - 3.0*x/8.0;
  int N = 1000;
  double h = x / N;
  double sum = 0.0;
  for (int i = 1; i < N; ++i) {
    double t = i * h;
    double f = t * t * t / (std::exp(t) - 1.0);
    sum += f * ((i % 2 == 0) ? 2.0 : 4.0);
  }
  sum += x * x * x / (std::exp(x) - 1.0);
  return sum * h / (3.0 * x * x * x / 3.0);
}

/**
 * Modified spherical Bessel i_n(x) = √(π/(2x)) I_{n+1/2}(x).
 * i_0(x) = sinh(x)/x.
 */
double sph_bessel_i(int n, double x) {
  if (x == 0) return (n == 0) ? 1.0 : 0.0;
  if (n == 0) return std::sinh(x) / x;
  if (n == 1) return std::cosh(x) / x - std::sinh(x) / (x * x);
  // Forward recurrence: i_{n+1} = i_{n-1} - (2n+1)/x · i_n
  double i0 = std::sinh(x) / x;
  double i1 = std::cosh(x) / x - std::sinh(x) / (x * x);
  for (int k = 1; k < n; ++k) {
    double i2 = i0 - (2.0 * k + 1.0) / x * i1;
    i0 = i1;
    i1 = i2;
  }
  return i1;
}

/**
 * Modified spherical Bessel k_n(x) = √(π/(2x)) K_{n+1/2}(x).
 * k_0(x) = π/(2x) e^{-x}.
 * k_1(x) = k_0(x) (1+1/x).
 */
double sph_bessel_k(int n, double x) {
  if (x <= 0) return INFINITY;
  if (n == 0) return M_PI / (2.0 * x) * std::exp(-x);
  double k0 = M_PI / (2.0 * x) * std::exp(-x);
  double k1 = k0 * (1.0 + 1.0 / x);
  if (n == 1) return k1;
  for (int k = 1; k < n; ++k) {
    double k2 = k0 + (2.0 * k + 1.0) / x * k1;
    k0 = k1;
    k1 = k2;
  }
  return k1;
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
  function("lgamma_fn", &mathkernel::lgamma_fn);
  function("bessel_y0", &mathkernel::bessel_y0);
  function("bessel_y1", &mathkernel::bessel_y1);
  function("bessel_i0", &mathkernel::bessel_i0);
  function("bessel_i1", &mathkernel::bessel_i1);
  function("expint_e1", &mathkernel::expint_e1);
  function("bessel_k0", &mathkernel::bessel_k0);
  function("bessel_k1", &mathkernel::bessel_k1);
  function("riemann_zeta", &mathkernel::riemann_zeta);
  function("spence", &mathkernel::spence);
  function("trigamma", &mathkernel::trigamma);
  function("airy_ai", &mathkernel::airy_ai);
  function("laguerre_l", &mathkernel::laguerre_l);
  function("hermite_h", &mathkernel::hermite_h);
  function("legendre_p", &mathkernel::legendre_p);
  function("chebyshev_t", &mathkernel::chebyshev_t);
  function("shi", &mathkernel::shi);
  function("chi", &mathkernel::chi);
  function("airy_bi", &mathkernel::airy_bi);
  function("sine_integral", &mathkernel::sine_integral);
  function("cosine_integral", &mathkernel::cosine_integral);
  function("erfinv", &mathkernel::erfinv);
  function("lambertw", &mathkernel::lambertw);
  function("clausen", &mathkernel::clausen);
  function("debye1", &mathkernel::debye1);
  function("normsinv", &mathkernel::normsinv);
  function("sigmoid", &mathkernel::sigmoid);
  function("logit", &mathkernel::logit);
  function("struve_h0", &mathkernel::struve_h0);
  function("catalan_constant", &mathkernel::catalan_constant);
  function("gegenbauer_c", &mathkernel::gegenbauer_c);
  function("upper_gamma", &mathkernel::upper_gamma);
  function("gamma_p", &mathkernel::gamma_p);
  function("chebyshev_u", &mathkernel::chebyshev_u);
  function("pochhammer", &mathkernel::pochhammer);
  function("falling_factorial", &mathkernel::falling_factorial);
  function("double_factorial", &mathkernel::double_factorial);
  function("binomial_coeff", &mathkernel::binomial_coeff);
  function("sph_bessel_j", &mathkernel::sph_bessel_j);
  function("sph_bessel_y", &mathkernel::sph_bessel_y);
  function("betainc", &mathkernel::betainc);
  function("harmonic", &mathkernel::harmonic);
  function("gen_harmonic", &mathkernel::gen_harmonic);
  function("jacobi_p", &mathkernel::jacobi_p);
  function("assoc_legendre", &mathkernel::assoc_legendre);
  function("expint_ei", &mathkernel::expint_ei);
  function("bessel_yn", &mathkernel::bessel_yn);
  function("rgamma", &mathkernel::rgamma);
  function("log_binomial", &mathkernel::log_binomial);
  function("erfcinv", &mathkernel::erfcinv);
  function("bessel_in", &mathkernel::bessel_in);
  function("polygamma", &mathkernel::polygamma);
  function("expint_en", &mathkernel::expint_en);
  function("assoc_laguerre", &mathkernel::assoc_laguerre);
  function("bessel_kn", &mathkernel::bessel_kn);
  function("hurwitz_zeta", &mathkernel::hurwitz_zeta);
  function("bernstein", &mathkernel::bernstein);
  function("catalan_number", &mathkernel::catalan_number);
  function("sph_harm_norm", &mathkernel::sph_harm_norm);
  function("chi2_cdf", &mathkernel::chi2_cdf);
  function("stirling2", &mathkernel::stirling2);
  function("bell_number", &mathkernel::bell_number);
  function("euler_number", &mathkernel::euler_number);
  function("stirling1", &mathkernel::stirling1);
  function("mittag_leffler", &mathkernel::mittag_leffler);
  function("poisson_cdf", &mathkernel::poisson_cdf);
  function("hyp2f1", &mathkernel::hyp2f1);
  function("hyp1f1", &mathkernel::hyp1f1);
  function("hyp0f1", &mathkernel::hyp0f1);
  function("owens_t", &mathkernel::owens_t);
  function("trinomial", &mathkernel::trinomial);
  function("gamma_sign", &mathkernel::gamma_sign);
  function("struve_h1", &mathkernel::struve_h1);
  function("exp_sum", &mathkernel::exp_sum);
  function("sinc_unnorm", &mathkernel::sinc_unnorm);
  function("abs_gamma", &mathkernel::abs_gamma);
  function("dirichlet_eta", &mathkernel::dirichlet_eta);
  function("debye2", &mathkernel::debye2);
  function("debye3", &mathkernel::debye3);
  function("sph_bessel_i", &mathkernel::sph_bessel_i);
  function("sph_bessel_k", &mathkernel::sph_bessel_k);
}
#endif
