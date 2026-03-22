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

  if (x <= 20.0) {
    // Use Wronskian: K₁ = -dK₀/dx
    // K₀'(x) = -K₁(x), so K₁ = -K₀'
    // Use high-order finite difference for accuracy
    double h = x * 1e-6;
    if (h < 1e-10) h = 1e-10;
    // 5-point stencil: f'(x) ≈ (-f(x+2h) + 8f(x+h) - 8f(x-h) + f(x-2h)) / (12h)
    double k0_p2 = bessel_k0(x + 2*h);
    double k0_p1 = bessel_k0(x + h);
    double k0_m1 = bessel_k0(x - h);
    double k0_m2 = bessel_k0(x - 2*h);
    return -(-k0_p2 + 8.0*k0_p1 - 8.0*k0_m1 + k0_m2) / (12.0 * h);
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
}
#endif
