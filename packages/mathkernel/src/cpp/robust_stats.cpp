/**
 * @tmnl/mathkernel — Robust Statistics & Hypothesis Tests
 *
 * C++20 / Eigen. Shared primitives via common.hpp.
 * Kernels: bootstrap, jackknife, shapiro_wilk, ks_test,
 *          anderson_darling, autocorrelation, crosscorrelation, mahalanobis
 */

#include "common.hpp"
#include <random>

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
using namespace emscripten;
using mathkernel::js_to_matrix;
using mathkernel::js_to_vector;
using mathkernel::vector_to_js;
#endif

using mathkernel::MatrixXd;
using mathkernel::VectorXd;

namespace mathkernel {

// ── Internal ────────────────────────────────────────────────────────────────

namespace {

/** Standard normal CDF (Abramowitz & Stegun) */
inline double norm_cdf(double x) {
  const double a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const double a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  int sign = (x >= 0) ? 1 : -1;
  double ax = std::abs(x) / std::sqrt(2.0);
  double t = 1.0 / (1.0 + p * ax);
  double y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * std::exp(-ax*ax);
  return 0.5 * (1.0 + sign * y);
}

/** Percentile of sorted data (linear interpolation). */
inline double percentile_sorted(const VectorXd& sorted, double q) {
  int n = sorted.size();
  double pos = q * (n - 1);
  int lo = static_cast<int>(std::floor(pos));
  int hi = std::min(lo + 1, n - 1);
  double frac = pos - lo;
  return sorted(lo) * (1.0 - frac) + sorted(hi) * frac;
}

} // anonymous namespace

#ifdef __EMSCRIPTEN__

/**
 * Bootstrap confidence interval.
 * Resamples with replacement B times, computes mean each time.
 * Returns {estimate, bias, std_error, ci_lower, ci_upper}.
 */
val bootstrap(const val& data_arr, int B, double ci_level, int seed) {
  auto data = js_to_vector(data_arr);
  int n = data.size();
  if (n < 2) throw std::invalid_argument("bootstrap: need at least 2 data points");

  double original_stat = compute_mean(data);

  std::mt19937 rng(seed);
  std::uniform_int_distribution<int> dist(0, n - 1);

  VectorXd boot_stats(B);
  for (int b = 0; b < B; ++b) {
    double sum = 0.0;
    for (int i = 0; i < n; ++i) {
      sum += data(dist(rng));
    }
    boot_stats(b) = sum / n;
  }

  double boot_mean = compute_mean(boot_stats);
  double bias = boot_mean - original_stat;
  double std_error = compute_std(boot_stats, boot_mean);

  VectorXd sorted = sorted_copy(boot_stats);
  double alpha = (1.0 - ci_level) / 2.0;
  double ci_lower = percentile_sorted(sorted, alpha);
  double ci_upper = percentile_sorted(sorted, 1.0 - alpha);

  val result = val::object();
  result.set("estimate", original_stat);
  result.set("bias", bias);
  result.set("std_error", std_error);
  result.set("ci_lower", ci_lower);
  result.set("ci_upper", ci_upper);
  result.set("n_resamples", B);
  return result;
}

/**
 * Jackknife bias and variance estimation (leave-one-out).
 * Returns {estimate, bias, std_error, pseudovalues}.
 */
val jackknife(const val& data_arr) {
  auto data = js_to_vector(data_arr);
  int n = data.size();
  if (n < 2) throw std::invalid_argument("jackknife: need at least 2 data points");

  double full_stat = compute_mean(data);
  double sum_all = data.sum();

  VectorXd jack_stats(n);
  for (int i = 0; i < n; ++i) {
    jack_stats(i) = (sum_all - data(i)) / (n - 1);
  }

  double jack_mean = compute_mean(jack_stats);
  double bias = (n - 1) * (jack_mean - full_stat);
  double var_jack = ((n - 1.0) / n) * (jack_stats.array() - jack_mean).square().sum();
  double std_error = std::sqrt(var_jack);

  // Pseudovalues
  VectorXd pseudo(n);
  for (int i = 0; i < n; ++i) {
    pseudo(i) = n * full_stat - (n - 1) * jack_stats(i);
  }

  val result = val::object();
  result.set("estimate", full_stat);
  result.set("bias", bias);
  result.set("std_error", std_error);
  result.set("pseudovalues", vector_to_js(pseudo));
  return result;
}

/**
 * Shapiro-Wilk test for normality.
 * Uses Royston's algorithm for a-coefficients.
 * Returns {W, p_value}.
 */
val shapiro_wilk(const val& data_arr) {
  auto data = js_to_vector(data_arr);
  int n = data.size();
  if (n < 3) throw std::invalid_argument("shapiro_wilk: need at least 3 data points");
  if (n > 5000) throw std::invalid_argument("shapiro_wilk: n > 5000 not supported");

  VectorXd sorted = sorted_copy(data);
  double mean = compute_mean(data);
  double ss = (data.array() - mean).square().sum();

  // Compute a-coefficients via Blom's approximation for expected normal order stats
  // m_i = Φ⁻¹((i - 0.375) / (n + 0.25))
  // We use a simplified approach: a = m / ||m||
  VectorXd m(n);
  for (int i = 0; i < n; ++i) {
    double p = (i + 1.0 - 0.375) / (n + 0.25);
    // Inverse normal CDF approximation (Beasley-Springer-Moro)
    double t;
    if (p < 0.5) {
      t = std::sqrt(-2.0 * std::log(p));
      double c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
      double d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
      m(i) = -(t - (c0 + c1*t + c2*t*t) / (1 + d1*t + d2*t*t + d3*t*t*t));
    } else {
      t = std::sqrt(-2.0 * std::log(1.0 - p));
      double c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
      double d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
      m(i) = t - (c0 + c1*t + c2*t*t) / (1 + d1*t + d2*t*t + d3*t*t*t);
    }
  }

  // a = m / ||m||
  double m_norm = m.norm();
  VectorXd a = m / m_norm;

  // W = (Σ aᵢ x₍ᵢ₎)² / SS
  double numerator = a.dot(sorted);
  double W = (numerator * numerator) / ss;

  // P-value approximation via Royston (1992) transformation
  // ln(1 - W) is approximately normal for moderate n
  double z;
  if (n <= 11) {
    // Small sample: use polynomial approximation
    double gamma = 0.459 * n - 2.273;
    z = -std::log(gamma - std::log(1.0 - W));
  } else {
    double ln1mw = std::log(1.0 - W);
    double mu = -1.2725 + 1.0521 * std::log(static_cast<double>(n));
    double sigma = 1.0308 - 0.26758 * std::log(static_cast<double>(n));
    z = (ln1mw - mu) / sigma;
  }
  double p_value = 1.0 - norm_cdf(z);

  val result = val::object();
  result.set("W", W);
  result.set("p_value", std::clamp(p_value, 0.0, 1.0));
  return result;
}

/**
 * Kolmogorov-Smirnov test (one-sample, against standard normal).
 * D = max|F_n(x) - Φ(x)|
 * Returns {D, p_value}.
 */
val ks_test(const val& data_arr) {
  auto data = js_to_vector(data_arr);
  int n = data.size();
  if (n < 1) throw std::invalid_argument("ks_test: empty data");

  VectorXd sorted = sorted_copy(data);
  double D = 0.0;

  for (int i = 0; i < n; ++i) {
    double F_n = static_cast<double>(i + 1) / n;
    double F_n_prev = static_cast<double>(i) / n;
    double F_x = norm_cdf(sorted(i));
    D = std::max(D, std::abs(F_n - F_x));
    D = std::max(D, std::abs(F_n_prev - F_x));
  }

  // P-value: Kolmogorov distribution approximation
  // P(D_n > d) ≈ 2 Σ (-1)^{k-1} exp(-2k²n d²)  (first few terms)
  double sqn = std::sqrt(static_cast<double>(n));
  double lambda = (sqn + 0.12 + 0.11 / sqn) * D;
  double p_value = 0.0;
  for (int k = 1; k <= 100; ++k) {
    double term = std::exp(-2.0 * k * k * lambda * lambda);
    if (k % 2 == 1) p_value += term;
    else p_value -= term;
    if (term < 1e-15) break;
  }
  p_value = 2.0 * p_value;
  p_value = std::clamp(p_value, 0.0, 1.0);

  val result = val::object();
  result.set("D", D);
  result.set("p_value", p_value);
  return result;
}

/**
 * Anderson-Darling test for normality.
 * A² = -n - (1/n) Σ (2i-1)[ln(Φ(z_i)) + ln(1-Φ(z_{n+1-i}))]
 * Returns {A2, p_value}.
 */
val anderson_darling(const val& data_arr) {
  auto data = js_to_vector(data_arr);
  int n = data.size();
  if (n < 3) throw std::invalid_argument("anderson_darling: need at least 3 data points");

  double mean = compute_mean(data);
  double sd = compute_std(data, mean);
  if (sd < 1e-15) throw std::runtime_error("anderson_darling: zero variance");

  // Standardize and sort
  VectorXd z(n);
  for (int i = 0; i < n; ++i) z(i) = (data(i) - mean) / sd;
  z = sorted_copy(z);

  // Compute A²
  double A2 = 0.0;
  for (int i = 0; i < n; ++i) {
    double F_zi = norm_cdf(z(i));
    double F_zn = norm_cdf(z(n - 1 - i));
    F_zi = std::clamp(F_zi, 1e-15, 1.0 - 1e-15);
    F_zn = std::clamp(F_zn, 1e-15, 1.0 - 1e-15);
    A2 += (2.0 * (i + 1) - 1.0) * (std::log(F_zi) + std::log(1.0 - F_zn));
  }
  A2 = -static_cast<double>(n) - A2 / n;

  // Adjusted for estimated parameters
  double A2_star = A2 * (1.0 + 0.75 / n + 2.25 / (n * n));

  // P-value approximation (D'Agostino & Stephens)
  double p_value;
  if (A2_star >= 0.6) {
    p_value = std::exp(1.2937 - 5.709 * A2_star + 0.0186 * A2_star * A2_star);
  } else if (A2_star >= 0.34) {
    p_value = std::exp(0.9177 - 4.279 * A2_star - 1.38 * A2_star * A2_star);
  } else if (A2_star >= 0.2) {
    p_value = 1.0 - std::exp(-8.318 + 42.796 * A2_star - 59.938 * A2_star * A2_star);
  } else {
    p_value = 1.0 - std::exp(-13.436 + 101.14 * A2_star - 223.73 * A2_star * A2_star);
  }
  p_value = std::clamp(p_value, 0.0, 1.0);

  val result = val::object();
  result.set("A2", A2_star);
  result.set("p_value", p_value);
  return result;
}

/**
 * Autocorrelation function: r(k) = Cov(x_t, x_{t+k}) / Var(x)
 * Returns Float64Array of ACF values for lags 0..max_lag.
 */
val autocorrelation(const val& data_arr, int max_lag) {
  auto data = js_to_vector(data_arr);
  int n = data.size();
  if (max_lag < 0 || max_lag >= n) max_lag = n - 1;

  double mean = compute_mean(data);
  double var = (data.array() - mean).square().sum(); // not divided by n — cancels in ratio

  VectorXd acf(max_lag + 1);
  for (int k = 0; k <= max_lag; ++k) {
    double cov = 0.0;
    for (int t = 0; t < n - k; ++t) {
      cov += (data(t) - mean) * (data(t + k) - mean);
    }
    acf(k) = (var > 1e-15) ? cov / var : 0.0;
  }
  return vector_to_js(acf);
}

/**
 * Cross-correlation: r_xy(k) = Σ(x_t - μ_x)(y_{t+k} - μ_y) / (n σ_x σ_y)
 * Returns Float64Array for lags -max_lag..+max_lag.
 */
val crosscorrelation(const val& x_arr, const val& y_arr, int max_lag) {
  auto x = js_to_vector(x_arr);
  auto y = js_to_vector(y_arr);
  int n = x.size();
  if (y.size() != n) throw_dim_mismatch(n, y.size(), "crosscorrelation");
  if (max_lag < 0 || max_lag >= n) max_lag = n - 1;

  double mx = compute_mean(x), my = compute_mean(y);
  double sx = compute_std(x, mx), sy = compute_std(y, my);
  double denom = n * sx * sy;

  int out_len = 2 * max_lag + 1;
  VectorXd ccf(out_len);

  for (int lag = -max_lag; lag <= max_lag; ++lag) {
    double sum = 0.0;
    int t_start = std::max(0, -lag);
    int t_end = std::min(n, n - lag);
    for (int t = t_start; t < t_end; ++t) {
      sum += (x(t) - mx) * (y(t + lag) - my);
    }
    ccf(lag + max_lag) = (denom > 1e-15) ? sum / denom : 0.0;
  }
  return vector_to_js(ccf);
}

/**
 * Mahalanobis distance of each row from the centroid.
 * X: (n × p). Returns Float64Array of distances.
 */
val mahalanobis(const val& x, int n, int p) {
  auto X = js_to_matrix(x, n, p);

  VectorXd mean = X.colwise().mean();
  MatrixXd Xc = X.rowwise() - mean.transpose();

  // Covariance matrix
  MatrixXd cov = (Xc.transpose() * Xc) / (n - 1);
  MatrixXd cov_inv = cov.ldlt().solve(MatrixXd::Identity(p, p));

  VectorXd dist(n);
  for (int i = 0; i < n; ++i) {
    VectorXd d = Xc.row(i).transpose();
    dist(i) = std::sqrt(d.transpose() * cov_inv * d);
  }
  return vector_to_js(dist);
}

#endif // __EMSCRIPTEN__

} // namespace mathkernel

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(mathkernel_robust_stats) {
  function("bootstrap", &mathkernel::bootstrap);
  function("jackknife", &mathkernel::jackknife);
  function("shapiro_wilk", &mathkernel::shapiro_wilk);
  function("ks_test", &mathkernel::ks_test);
  function("anderson_darling", &mathkernel::anderson_darling);
  function("autocorrelation", &mathkernel::autocorrelation);
  function("crosscorrelation", &mathkernel::crosscorrelation);
  function("mahalanobis", &mathkernel::mahalanobis);
}
#endif
