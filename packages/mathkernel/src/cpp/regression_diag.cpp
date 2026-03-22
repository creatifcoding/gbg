/**
 * @tmnl/mathkernel — Regression Diagnostics Kernels
 *
 * C++20 / Eigen. Shared primitives via common.hpp.
 * Kernels: logit, probit, residuals, leverage, cooksd, durbin_watson
 */

#include "common.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
using namespace emscripten;
using mathkernel::js_to_matrix;
using mathkernel::js_to_vector;
using mathkernel::vector_to_js;
using mathkernel::matrix_to_js;
#endif

using mathkernel::MatrixXd;
using mathkernel::VectorXd;

namespace mathkernel {

// ── Internal: link functions ────────────────────────────────────────────────

namespace {

/** Logistic (sigmoid) function: 1 / (1 + exp(-x)) */
inline double logistic(double x) {
  if (x >= 0) {
    double ez = std::exp(-x);
    return 1.0 / (1.0 + ez);
  } else {
    double ez = std::exp(x);
    return ez / (1.0 + ez);
  }
}

/** Standard normal CDF (Φ) via Abramowitz & Stegun approximation */
inline double norm_cdf(double x) {
  // Horner form of the rational approximation
  const double a1 =  0.254829592;
  const double a2 = -0.284496736;
  const double a3 =  1.421413741;
  const double a4 = -1.453152027;
  const double a5 =  1.061405429;
  const double p  =  0.3275911;

  int sign = (x >= 0) ? 1 : -1;
  double ax = std::abs(x) / std::sqrt(2.0);
  double t = 1.0 / (1.0 + p * ax);
  double y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t * std::exp(-ax*ax);
  return 0.5 * (1.0 + sign * y);
}

/** Standard normal PDF: φ(x) = (1/√2π) exp(-x²/2) */
inline double norm_pdf(double x) {
  return std::exp(-0.5 * x * x) / std::sqrt(2.0 * M_PI);
}

/** Prepend intercept column */
MatrixXd add_intercept(const MatrixXd& X) {
  MatrixXd Xi(X.rows(), X.cols() + 1);
  Xi.col(0) = VectorXd::Ones(X.rows());
  Xi.rightCols(X.cols()) = X;
  return Xi;
}

} // anonymous namespace

// ── Kernel Functions ────────────────────────────────────────────────────────

#ifdef __EMSCRIPTEN__

/**
 * Logistic Regression via IRLS (Iteratively Reweighted Least Squares).
 * Link function: logit(p) = log(p/(1-p))
 *
 * Returns {coefficients, intercept, fitted_probs, deviance, n_iter, converged}
 */
val logit_fit(const val& x, int n, int p, const val& y_arr,
              int max_iter, double tol, bool fit_intercept) {
  auto X_raw = js_to_matrix(x, n, p);
  auto y = js_to_vector(y_arr);
  if (y.size() != n) throw_dim_mismatch(n, y.size(), "logit_fit: y length");

  MatrixXd X = fit_intercept ? add_intercept(X_raw) : X_raw;
  int p_full = X.cols();

  VectorXd beta = VectorXd::Zero(p_full);
  bool converged = false;
  int iter = 0;

  for (; iter < max_iter; ++iter) {
    // Compute μ = logistic(Xβ)
    VectorXd eta = X * beta;
    VectorXd mu(n);
    for (int i = 0; i < n; ++i) mu(i) = logistic(eta(i));

    // Weight matrix: W = diag(μ(1-μ))
    VectorXd w = mu.array() * (1.0 - mu.array());
    // Clamp to avoid numerical issues
    for (int i = 0; i < n; ++i)
      if (w(i) < 1e-10) w(i) = 1e-10;

    // Working response: z = η + (y - μ) / w
    VectorXd z = (eta.array() + (y - mu).array() / w.array()).matrix();

    // Solve WLS: (X'WX)β = X'Wz
    MatrixXd XtWX = X.transpose() * w.asDiagonal() * X;
    VectorXd XtWz = X.transpose() * (w.asDiagonal() * z);
    VectorXd beta_new = XtWX.ldlt().solve(XtWz);

    double max_delta = (beta_new - beta).cwiseAbs().maxCoeff();
    beta = beta_new;

    if (max_delta < tol) { converged = true; ++iter; break; }
  }

  // Fitted probabilities
  VectorXd eta_final = X * beta;
  VectorXd probs(n);
  for (int i = 0; i < n; ++i) probs(i) = logistic(eta_final(i));

  // Deviance: -2 Σ [yᵢ log(μᵢ) + (1-yᵢ) log(1-μᵢ)]
  double deviance = 0.0;
  for (int i = 0; i < n; ++i) {
    double pi = std::clamp(probs(i), 1e-15, 1.0 - 1e-15);
    deviance += -2.0 * (y(i) * std::log(pi) + (1.0 - y(i)) * std::log(1.0 - pi));
  }

  val result = val::object();
  if (fit_intercept) {
    result.set("intercept", beta(0));
    result.set("coefficients", vector_to_js(beta.tail(p)));
  } else {
    result.set("intercept", 0.0);
    result.set("coefficients", vector_to_js(beta));
  }
  result.set("fitted_probs", vector_to_js(probs));
  result.set("deviance", deviance);
  result.set("n_iter", iter);
  result.set("converged", converged);
  return result;
}

/**
 * Probit Regression via IRLS.
 * Link function: Φ⁻¹(p)
 *
 * Returns {coefficients, intercept, fitted_probs, deviance, n_iter, converged}
 */
val probit_fit(const val& x, int n, int p, const val& y_arr,
               int max_iter, double tol, bool fit_intercept) {
  auto X_raw = js_to_matrix(x, n, p);
  auto y = js_to_vector(y_arr);
  if (y.size() != n) throw_dim_mismatch(n, y.size(), "probit_fit: y length");

  MatrixXd X = fit_intercept ? add_intercept(X_raw) : X_raw;
  int p_full = X.cols();

  VectorXd beta = VectorXd::Zero(p_full);
  bool converged = false;
  int iter = 0;

  for (; iter < max_iter; ++iter) {
    VectorXd eta = X * beta;
    VectorXd mu(n), w(n);

    for (int i = 0; i < n; ++i) {
      mu(i) = norm_cdf(eta(i));
      double phi = norm_pdf(eta(i));
      double mu_clamped = std::clamp(mu(i), 1e-10, 1.0 - 1e-10);
      w(i) = (phi * phi) / (mu_clamped * (1.0 - mu_clamped));
      if (w(i) < 1e-10) w(i) = 1e-10;
    }

    // Working response: z_i = η_i + (y_i - μ_i) / φ(η_i)
    VectorXd z(n);
    for (int i = 0; i < n; ++i) {
      double phi = norm_pdf(eta(i));
      z(i) = (phi > 1e-10) ? eta(i) + (y(i) - mu(i)) / phi : eta(i);
    }

    MatrixXd XtWX = X.transpose() * w.asDiagonal() * X;
    VectorXd XtWz = X.transpose() * (w.asDiagonal() * z);
    VectorXd beta_new = XtWX.ldlt().solve(XtWz);

    double max_delta = (beta_new - beta).cwiseAbs().maxCoeff();
    beta = beta_new;

    if (max_delta < tol) { converged = true; ++iter; break; }
  }

  VectorXd eta_final = X * beta;
  VectorXd probs(n);
  for (int i = 0; i < n; ++i) probs(i) = norm_cdf(eta_final(i));

  double deviance = 0.0;
  for (int i = 0; i < n; ++i) {
    double pi = std::clamp(probs(i), 1e-15, 1.0 - 1e-15);
    deviance += -2.0 * (y(i) * std::log(pi) + (1.0 - y(i)) * std::log(1.0 - pi));
  }

  val result = val::object();
  if (fit_intercept) {
    result.set("intercept", beta(0));
    result.set("coefficients", vector_to_js(beta.tail(p)));
  } else {
    result.set("intercept", 0.0);
    result.set("coefficients", vector_to_js(beta));
  }
  result.set("fitted_probs", vector_to_js(probs));
  result.set("deviance", deviance);
  result.set("n_iter", iter);
  result.set("converged", converged);
  return result;
}

/**
 * Leverage values: h_ii = diag(H) where H = X(X'X)⁻¹X'
 * Returns Float64Array of leverage values.
 */
val leverage(const val& x, int n, int p, bool fit_intercept) {
  auto X_raw = js_to_matrix(x, n, p);
  MatrixXd X = fit_intercept ? add_intercept(X_raw) : X_raw;
  MatrixXd H = hat_matrix(X);
  VectorXd h(n);
  for (int i = 0; i < n; ++i) h(i) = H(i, i);
  return vector_to_js(h);
}

/**
 * Cook's Distance: D_i = (e_i² / (p * MSE)) * (h_ii / (1 - h_ii)²)
 * X: design matrix, y: response, fit_intercept: prepend 1s.
 * Returns Float64Array of Cook's D values.
 */
val cooks_distance(const val& x, int n, int p, const val& y_arr, bool fit_intercept) {
  auto X_raw = js_to_matrix(x, n, p);
  auto y = js_to_vector(y_arr);
  if (y.size() != n) throw_dim_mismatch(n, y.size(), "cooks_distance: y length");

  MatrixXd X = fit_intercept ? add_intercept(X_raw) : X_raw;
  int p_full = X.cols();

  VectorXd beta = X.colPivHouseholderQr().solve(y);
  VectorXd resid = y - X * beta;
  double mse = resid.squaredNorm() / (n - p_full);

  MatrixXd H = hat_matrix(X);
  VectorXd D(n);
  for (int i = 0; i < n; ++i) {
    double h = H(i, i);
    double denom = p_full * mse * (1.0 - h) * (1.0 - h);
    D(i) = (denom > 1e-15) ? (resid(i) * resid(i) * h) / denom : 0.0;
  }
  return vector_to_js(D);
}

/**
 * Durbin-Watson statistic: d = Σ(eₜ - eₜ₋₁)² / Σeₜ²
 * Tests for autocorrelation in residuals.
 */
double durbin_watson(const val& residuals_arr) {
  auto e = js_to_vector(residuals_arr);
  int n = e.size();
  if (n < 2) throw std::invalid_argument("durbin_watson: need at least 2 residuals");

  double ss_diff = 0.0, ss_res = 0.0;
  ss_res += e(0) * e(0);
  for (int t = 1; t < n; ++t) {
    double diff = e(t) - e(t - 1);
    ss_diff += diff * diff;
    ss_res += e(t) * e(t);
  }
  return (ss_res > 1e-15) ? ss_diff / ss_res : 2.0; // 2.0 = no autocorrelation
}

/**
 * Standardized residuals: r_i = e_i / (σ̂ √(1 - h_ii))
 * Returns Float64Array.
 */
val standardized_residuals(const val& x, int n, int p, const val& y_arr, bool fit_intercept) {
  auto X_raw = js_to_matrix(x, n, p);
  auto y = js_to_vector(y_arr);
  if (y.size() != n) throw_dim_mismatch(n, y.size(), "standardized_residuals: y length");

  MatrixXd X = fit_intercept ? add_intercept(X_raw) : X_raw;
  int p_full = X.cols();

  VectorXd beta = X.colPivHouseholderQr().solve(y);
  VectorXd resid = y - X * beta;
  double sigma = std::sqrt(resid.squaredNorm() / (n - p_full));

  MatrixXd H = hat_matrix(X);
  VectorXd sr(n);
  for (int i = 0; i < n; ++i) {
    double denom = sigma * std::sqrt(std::max(1.0 - H(i, i), 1e-15));
    sr(i) = resid(i) / denom;
  }
  return vector_to_js(sr);
}

#endif // __EMSCRIPTEN__

} // namespace mathkernel

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(mathkernel_regression_diag) {
  function("logit_fit", &mathkernel::logit_fit);
  function("probit_fit", &mathkernel::probit_fit);
  function("leverage", &mathkernel::leverage);
  function("cooks_distance", &mathkernel::cooks_distance);
  function("durbin_watson", &mathkernel::durbin_watson);
  function("standardized_residuals", &mathkernel::standardized_residuals);
}
#endif
