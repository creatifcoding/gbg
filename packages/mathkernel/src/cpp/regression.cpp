/**
 * @tmnl/mathkernel — Regression Kernels
 *
 * C++20 / Eigen. Shared primitives via common.hpp.
 * Kernels: OLS, Ridge, Lasso/ElasticNet
 */

#include "common.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
using namespace emscripten;
using mathkernel::js_to_matrix;
using mathkernel::js_to_vector;
using mathkernel::vector_to_js;
#endif

using mathkernel::MatrixXd;
using mathkernel::VectorXd;

// ── Internal Helpers ────────────────────────────────────────────────────────

namespace {

/** Soft-threshold for coordinate descent: S(z, γ) = sign(z) * max(|z| - γ, 0) */
double soft_threshold(double z, double gamma) {
  if (z > gamma) return z - gamma;
  if (z < -gamma) return z + gamma;
  return 0.0;
}

/** Prepend column of 1s for intercept. Returns (n × (p+1)). */
MatrixXd add_intercept(const MatrixXd& X) {
  MatrixXd Xi(X.rows(), X.cols() + 1);
  Xi.col(0) = VectorXd::Ones(X.rows());
  Xi.rightCols(X.cols()) = X;
  return Xi;
}

} // anonymous namespace

// ── Regression Kernels ──────────────────────────────────────────────────────

namespace mathkernel {

#ifdef __EMSCRIPTEN__

/** OLS: β = (XᵀX)⁻¹ Xᵀy. Returns {coefficients, intercept, residuals, r_squared, fitted_values, mse}. */
val ols(const val& x, int n, int p, const val& y_arr, bool fit_intercept) {
  auto X_raw = js_to_matrix(x, n, p);
  auto y = js_to_vector(y_arr);
  if (y.size() != n) throw_dim_mismatch(n, y.size(), "ols: y length");

  MatrixXd X = fit_intercept ? add_intercept(X_raw) : X_raw;
  VectorXd beta = X.colPivHouseholderQr().solve(y);
  VectorXd fitted = X * beta;
  VectorXd residuals = y - fitted;

  double ss_res = residuals.squaredNorm();
  double y_mean = y.mean();
  double ss_tot = (y.array() - y_mean).square().sum();
  double r_squared = (ss_tot > 1e-14) ? (1.0 - ss_res / ss_tot) : 0.0;

  val result = val::object();
  if (fit_intercept) {
    result.set("intercept", beta(0));
    result.set("coefficients", vector_to_js(beta.tail(p)));
  } else {
    result.set("intercept", 0.0);
    result.set("coefficients", vector_to_js(beta));
  }
  result.set("residuals", vector_to_js(residuals));
  result.set("fitted_values", vector_to_js(fitted));
  result.set("r_squared", r_squared);
  result.set("mse", ss_res / n);
  result.set("n", n);
  result.set("p", p);
  return result;
}

/** Ridge: β = (XᵀX + λI)⁻¹ Xᵀy. Intercept not penalized. */
val ridge(const val& x, int n, int p, const val& y_arr,
          double lambda, bool fit_intercept) {
  auto X_raw = js_to_matrix(x, n, p);
  auto y = js_to_vector(y_arr);
  if (y.size() != n) throw_dim_mismatch(n, y.size(), "ridge: y length");
  if (lambda < 0) throw std::invalid_argument("InvalidParameter: lambda must be >= 0");

  MatrixXd X = fit_intercept ? add_intercept(X_raw) : X_raw;
  int p_full = X.cols();

  MatrixXd penalty = MatrixXd::Identity(p_full, p_full) * lambda;
  if (fit_intercept) penalty(0, 0) = 0.0;

  VectorXd beta = (X.transpose() * X + penalty).llt().solve(X.transpose() * y);
  VectorXd fitted = X * beta;
  VectorXd residuals = y - fitted;
  double ss_res = residuals.squaredNorm();
  double y_mean = y.mean();
  double ss_tot = (y.array() - y_mean).square().sum();
  double r_squared = (ss_tot > 1e-14) ? (1.0 - ss_res / ss_tot) : 0.0;

  val result = val::object();
  if (fit_intercept) {
    result.set("intercept", beta(0));
    result.set("coefficients", vector_to_js(beta.tail(p)));
  } else {
    result.set("intercept", 0.0);
    result.set("coefficients", vector_to_js(beta));
  }
  result.set("residuals", vector_to_js(residuals));
  result.set("fitted_values", vector_to_js(fitted));
  result.set("r_squared", r_squared);
  result.set("mse", ss_res / n);
  result.set("lambda", lambda);
  return result;
}

/** Lasso/ElasticNet via coordinate descent. ρ=1→Lasso, ρ=0→Ridge, 0<ρ<1→ElasticNet. */
val lasso(const val& x, int n, int p, const val& y_arr,
          double alpha, double l1_ratio, int max_iter, double tol,
          bool fit_intercept) {
  auto X_raw = js_to_matrix(x, n, p);
  auto y = js_to_vector(y_arr);
  if (y.size() != n) throw_dim_mismatch(n, y.size(), "lasso: y length");
  if (alpha < 0) throw std::invalid_argument("InvalidParameter: alpha must be >= 0");

  // Standardize X columns
  VectorXd X_mean = X_raw.colwise().mean();
  VectorXd X_std = ((X_raw.rowwise() - X_mean.transpose()).colwise().squaredNorm() / n).cwiseSqrt();
  for (int j = 0; j < p; ++j)
    if (X_std(j) < 1e-14) X_std(j) = 1.0;
  MatrixXd X_scaled = (X_raw.rowwise() - X_mean.transpose()).array().rowwise() / X_std.transpose().array();

  double y_mean = fit_intercept ? y.mean() : 0.0;
  VectorXd y_centered = y.array() - y_mean;
  VectorXd col_norms = X_scaled.colwise().squaredNorm() / n;

  VectorXd beta = VectorXd::Zero(p);
  VectorXd residual = y_centered;
  double l1_penalty = alpha * l1_ratio;
  double l2_penalty = alpha * (1.0 - l1_ratio);

  int iter = 0;
  for (; iter < max_iter; ++iter) {
    double max_delta = 0.0;
    for (int j = 0; j < p; ++j) {
      double old_beta = beta(j);
      residual += X_scaled.col(j) * old_beta;
      double rho_j = X_scaled.col(j).dot(residual) / n;
      beta(j) = soft_threshold(rho_j, l1_penalty) / (col_norms(j) + l2_penalty);
      residual -= X_scaled.col(j) * beta(j);
      max_delta = std::max(max_delta, std::abs(beta(j) - old_beta));
    }
    if (max_delta < tol) { ++iter; break; }
  }

  // Unscale
  VectorXd beta_orig = beta.array() / X_std.array();
  double intercept = y_mean - (X_mean.array() * beta_orig.array()).sum();
  VectorXd fitted = X_raw * beta_orig;
  if (fit_intercept) fitted.array() += intercept;
  VectorXd residuals = y - fitted;
  double ss_res = residuals.squaredNorm();
  double ss_tot = (y.array() - y.mean()).square().sum();
  double r_squared = (ss_tot > 1e-14) ? (1.0 - ss_res / ss_tot) : 0.0;

  int n_nonzero = 0;
  for (int j = 0; j < p; ++j)
    if (std::abs(beta_orig(j)) > 1e-14) ++n_nonzero;

  val result = val::object();
  result.set("coefficients", vector_to_js(beta_orig));
  result.set("intercept", fit_intercept ? intercept : 0.0);
  result.set("residuals", vector_to_js(residuals));
  result.set("fitted_values", vector_to_js(fitted));
  result.set("r_squared", r_squared);
  result.set("mse", ss_res / n);
  result.set("alpha", alpha);
  result.set("l1_ratio", l1_ratio);
  result.set("n_iter", iter);
  result.set("n_nonzero", n_nonzero);
  return result;
}

#endif // __EMSCRIPTEN__

} // namespace mathkernel

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(mathkernel_regression) {
  function("ols", &mathkernel::ols);
  function("ridge", &mathkernel::ridge);
  function("lasso", &mathkernel::lasso);
}
#endif
