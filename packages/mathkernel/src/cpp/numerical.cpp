/**
 * @tmnl/mathkernel — Numerical Methods
 *
 * C++20 / Eigen. Shared primitives via common.hpp.
 *
 * Domain breakdown (12 functions):
 *   Root-finding (4): newton_raphson, bisect, secant, brentq
 *   Integration (4): trapezoid, simpson, romberg, gauss_legendre
 *   Taylor/Misc (3): taylor_exp, taylor_sin, taylor_cos
 *   Optimization (1): golden_section_min
 *
 * NOTE: Functions operating on JS callbacks use eval-string approach.
 * For WASM we accept coefficient arrays that define polynomials,
 * or pre-evaluated y-values for integration.
 */

#include "common.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
using namespace emscripten;
using mathkernel::js_to_vector;
using mathkernel::vector_to_js;
#endif

using mathkernel::VectorXd;

namespace mathkernel {

// ── Internal ────────────────────────────────────────────────────────────────

namespace {

/** Evaluate polynomial: c[0] + c[1]*x + c[2]*x² + ... */
inline double poly_eval(const VectorXd& c, double x) {
  double result = 0.0;
  double xp = 1.0;
  for (int i = 0; i < c.size(); ++i) {
    result += c(i) * xp;
    xp *= x;
  }
  return result;
}

/** Evaluate polynomial derivative: c[1] + 2*c[2]*x + 3*c[3]*x² + ... */
inline double poly_deriv_eval(const VectorXd& c, double x) {
  double result = 0.0;
  double xp = 1.0;
  for (int i = 1; i < c.size(); ++i) {
    result += i * c(i) * xp;
    xp *= x;
  }
  return result;
}

} // anonymous namespace

#ifdef __EMSCRIPTEN__

// ═══════════════════════════════════════════════════════════════════════════
// ROOT-FINDING (for polynomials)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Newton-Raphson: find root of polynomial defined by coefficients.
 * c = [c0, c1, c2, ...] → f(x) = c0 + c1*x + c2*x² + ...
 * Returns {root, n_iter, converged}.
 */
val newton_raphson(const val& coeff_arr, double x0, int max_iter, double tol) {
  auto c = js_to_vector(coeff_arr);
  double x = x0;
  bool converged = false;
  int iter = 0;

  for (; iter < max_iter; ++iter) {
    double fx = poly_eval(c, x);
    double fpx = poly_deriv_eval(c, x);
    if (std::abs(fpx) < 1e-15) break; // derivative too small
    double x_new = x - fx / fpx;
    if (std::abs(x_new - x) < tol) { converged = true; x = x_new; ++iter; break; }
    x = x_new;
  }

  val result = val::object();
  result.set("root", x);
  result.set("n_iter", iter);
  result.set("converged", converged);
  result.set("f_root", poly_eval(c, x));
  return result;
}

/**
 * Bisection method: find root in [a, b] for polynomial.
 * Returns {root, n_iter, converged}.
 */
val bisect(const val& coeff_arr, double a, double b, int max_iter, double tol) {
  auto c = js_to_vector(coeff_arr);
  double fa = poly_eval(c, a), fb = poly_eval(c, b);
  if (fa * fb > 0) throw std::invalid_argument("bisect: f(a) and f(b) must have opposite signs");

  bool converged = false;
  int iter = 0;
  double mid = a;

  for (; iter < max_iter; ++iter) {
    mid = (a + b) / 2.0;
    double fm = poly_eval(c, mid);
    if (std::abs(fm) < tol || (b - a) / 2.0 < tol) { converged = true; ++iter; break; }
    if (fa * fm < 0) { b = mid; fb = fm; }
    else { a = mid; fa = fm; }
  }

  val result = val::object();
  result.set("root", mid);
  result.set("n_iter", iter);
  result.set("converged", converged);
  result.set("f_root", poly_eval(c, mid));
  return result;
}

/**
 * Secant method: root-finding without derivative.
 * Returns {root, n_iter, converged}.
 */
val secant(const val& coeff_arr, double x0, double x1, int max_iter, double tol) {
  auto c = js_to_vector(coeff_arr);
  double f0 = poly_eval(c, x0), f1 = poly_eval(c, x1);
  bool converged = false;
  int iter = 0;

  for (; iter < max_iter; ++iter) {
    if (std::abs(f1 - f0) < 1e-15) break;
    double x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
    if (std::abs(x2 - x1) < tol) { converged = true; x1 = x2; ++iter; break; }
    x0 = x1; f0 = f1;
    x1 = x2; f1 = poly_eval(c, x1);
  }

  val result = val::object();
  result.set("root", x1);
  result.set("n_iter", iter);
  result.set("converged", converged);
  result.set("f_root", poly_eval(c, x1));
  return result;
}

/**
 * Brent's method: robust bracketed root-finding.
 * Combines bisection, secant, and inverse quadratic interpolation.
 * Returns {root, n_iter, converged}.
 */
val brentq(const val& coeff_arr, double a, double b, int max_iter, double tol) {
  auto c = js_to_vector(coeff_arr);
  double fa = poly_eval(c, a), fb = poly_eval(c, b);
  if (fa * fb > 0) throw std::invalid_argument("brentq: f(a) and f(b) must have opposite signs");

  if (std::abs(fa) < std::abs(fb)) { std::swap(a, b); std::swap(fa, fb); }

  double cc = a, fc = fa, d = b - a, e = d;
  bool converged = false;
  int iter = 0;

  for (; iter < max_iter; ++iter) {
    if (std::abs(fb) < tol) { converged = true; ++iter; break; }
    if (fa != fc && fb != fc) {
      // Inverse quadratic interpolation
      double s = a*fb*fc / ((fa-fb)*(fa-fc)) + b*fa*fc / ((fb-fa)*(fb-fc)) + cc*fa*fb / ((fc-fa)*(fc-fb));
      // Check if s is in (b, (3a+b)/4)
      double cond1 = (s - (3*a+b)/4) * (s - b);
      if (cond1 < 0 && std::abs(s - b) < std::abs(e) / 2) {
        e = d; d = s - b; b = s;
      } else {
        d = (a + b) / 2 - b; e = d; b += d;
      }
    } else {
      // Secant
      d = (a + b) / 2 - b; e = d; b += d;
    }

    fb = poly_eval(c, b);
    if (fb * fc > 0) { cc = a; fc = fa; }
    else { a = b; fa = fb; }

    if (std::abs(fa) < std::abs(fb)) { std::swap(a, b); std::swap(fa, fb); }
  }

  val result = val::object();
  result.set("root", b);
  result.set("n_iter", iter);
  result.set("converged", converged);
  result.set("f_root", poly_eval(c, b));
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION (over tabulated y-values at equal spacing)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trapezoidal rule: ∫f dx ≈ h/2 [f₀ + 2f₁ + ... + 2fₙ₋₁ + fₙ]
 * y: function values, h: step size.
 */
double trapezoid(const val& y_arr, double h) {
  auto y = js_to_vector(y_arr);
  int n = y.size();
  if (n < 2) throw std::invalid_argument("trapezoid: need at least 2 points");
  double sum = (y(0) + y(n-1)) / 2.0;
  for (int i = 1; i < n - 1; ++i) sum += y(i);
  return sum * h;
}

/**
 * Simpson's rule: ∫f dx ≈ h/3 [f₀ + 4f₁ + 2f₂ + 4f₃ + ... + fₙ]
 * n must be odd (even number of intervals).
 */
double simpson(const val& y_arr, double h) {
  auto y = js_to_vector(y_arr);
  int n = y.size();
  if (n < 3 || n % 2 == 0) throw std::invalid_argument("simpson: need odd number of points >= 3");
  double sum = y(0) + y(n-1);
  for (int i = 1; i < n - 1; ++i) {
    sum += (i % 2 == 1) ? 4.0 * y(i) : 2.0 * y(i);
  }
  return sum * h / 3.0;
}

/**
 * Romberg integration: Richardson extrapolation on trapezoidal rule.
 * y: function values (must be 2^k + 1 points), h: initial step.
 * Returns the best estimate.
 */
double romberg(const val& y_arr, double h) {
  auto y = js_to_vector(y_arr);
  int n = y.size();

  // Compute how many levels of refinement
  int levels = 0;
  int nn = n - 1;
  while (nn > 1 && nn % 2 == 0) { ++levels; nn /= 2; }
  if (levels == 0) return trapezoid(y_arr, h); // fallback

  // R[j][k] table
  std::vector<std::vector<double>> R(levels + 1, std::vector<double>(levels + 1, 0.0));

  // R[0][0] = trapezoidal with full spacing
  R[0][0] = (y(0) + y(n-1)) / 2.0;
  int step = (n - 1);
  for (int i = step; i < n - 1; i += step) R[0][0] += y(i);
  R[0][0] *= h * step;

  // Refine
  for (int j = 1; j <= levels; ++j) {
    step = (n - 1) / (1 << j);
    double hj = h * step;
    // Trapezoidal at this level
    double sum = (y(0) + y(n-1)) / 2.0;
    for (int i = step; i < n - 1; i += step) sum += y(i);
    R[j][0] = sum * hj;

    // Richardson extrapolation
    for (int k = 1; k <= j; ++k) {
      double factor = std::pow(4.0, k);
      R[j][k] = (factor * R[j][k-1] - R[j-1][k-1]) / (factor - 1.0);
    }
  }

  return R[levels][levels];
}

/**
 * Gauss-Legendre quadrature (5-point) on tabulated data.
 * x: abscissae, y: function values. Integrates over [x[0], x[n-1]].
 * Uses linear interpolation on the tabulated data.
 */
double gauss_legendre(const val& x_arr, const val& y_arr) {
  auto x = js_to_vector(x_arr), y = js_to_vector(y_arr);
  if (x.size() != y.size()) throw_dim_mismatch(x.size(), y.size(), "gauss_legendre");
  int n = x.size();
  if (n < 2) throw std::invalid_argument("gauss_legendre: need at least 2 points");

  double a = x(0), b = x(n-1);

  // 5-point Gauss-Legendre nodes and weights on [-1, 1]
  const double nodes[] = {-0.9061798459, -0.5384693101, 0.0, 0.5384693101, 0.9061798459};
  const double weights[] = {0.2369268851, 0.4786286705, 0.5688888889, 0.4786286705, 0.2369268851};

  // Map [-1,1] → [a,b]: t = (b-a)/2 * ξ + (b+a)/2
  double result = 0.0;
  for (int k = 0; k < 5; ++k) {
    double t = (b - a) / 2.0 * nodes[k] + (b + a) / 2.0;
    // Linear interpolation on tabulated data
    double ft = 0.0;
    if (t <= x(0)) ft = y(0);
    else if (t >= x(n-1)) ft = y(n-1);
    else {
      for (int i = 0; i < n - 1; ++i) {
        if (t >= x(i) && t <= x(i+1)) {
          double frac = (t - x(i)) / (x(i+1) - x(i));
          ft = y(i) + frac * (y(i+1) - y(i));
          break;
        }
      }
    }
    result += weights[k] * ft;
  }
  return result * (b - a) / 2.0;
}

// ═══════════════════════════════════════════════════════════════════════════
// TAYLOR SERIES
// ═══════════════════════════════════════════════════════════════════════════

/** Taylor expansion of e^x around 0. */
double taylor_exp(double x, int terms) {
  if (terms < 1 || terms > 100) throw std::invalid_argument("taylor_exp: terms must be 1..100");
  double sum = 0.0, term = 1.0;
  for (int k = 0; k < terms; ++k) {
    sum += term;
    term *= x / (k + 1);
  }
  return sum;
}

/** Taylor expansion of sin(x) around 0. */
double taylor_sin(double x, int terms) {
  if (terms < 1 || terms > 50) throw std::invalid_argument("taylor_sin: terms must be 1..50");
  double sum = 0.0, term = x;
  for (int k = 0; k < terms; ++k) {
    sum += term;
    term *= -x * x / ((2*k + 2) * (2*k + 3));
  }
  return sum;
}

/** Taylor expansion of cos(x) around 0. */
double taylor_cos(double x, int terms) {
  if (terms < 1 || terms > 50) throw std::invalid_argument("taylor_cos: terms must be 1..50");
  double sum = 0.0, term = 1.0;
  for (int k = 0; k < terms; ++k) {
    sum += term;
    term *= -x * x / ((2*k + 1) * (2*k + 2));
  }
  return sum;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Golden section search: find minimum of unimodal polynomial in [a, b].
 * Returns {x_min, f_min, n_iter, converged}.
 */
val golden_section_min(const val& coeff_arr, double a, double b, int max_iter, double tol) {
  auto c = js_to_vector(coeff_arr);
  const double gr = (std::sqrt(5.0) - 1.0) / 2.0; // golden ratio

  double x1 = b - gr * (b - a);
  double x2 = a + gr * (b - a);
  double f1 = poly_eval(c, x1), f2 = poly_eval(c, x2);
  bool converged = false;
  int iter = 0;

  for (; iter < max_iter; ++iter) {
    if (std::abs(b - a) < tol) { converged = true; ++iter; break; }
    if (f1 < f2) {
      b = x2;
      x2 = x1; f2 = f1;
      x1 = b - gr * (b - a);
      f1 = poly_eval(c, x1);
    } else {
      a = x1;
      x1 = x2; f1 = f2;
      x2 = a + gr * (b - a);
      f2 = poly_eval(c, x2);
    }
  }

  double x_min = (a + b) / 2.0;
  val result = val::object();
  result.set("x_min", x_min);
  result.set("f_min", poly_eval(c, x_min));
  result.set("n_iter", iter);
  result.set("converged", converged);
  return result;
}

#endif // __EMSCRIPTEN__

} // namespace mathkernel

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(mathkernel_numerical) {
  // Root-finding
  function("newton_raphson", &mathkernel::newton_raphson);
  function("bisect", &mathkernel::bisect);
  function("secant", &mathkernel::secant);
  function("brentq", &mathkernel::brentq);
  // Integration
  function("trapezoid", &mathkernel::trapezoid);
  function("simpson", &mathkernel::simpson);
  function("romberg", &mathkernel::romberg);
  function("gauss_legendre", &mathkernel::gauss_legendre);
  // Taylor
  function("taylor_exp", &mathkernel::taylor_exp);
  function("taylor_sin", &mathkernel::taylor_sin);
  function("taylor_cos", &mathkernel::taylor_cos);
  // Optimization
  function("golden_section_min", &mathkernel::golden_section_min);
}
#endif
