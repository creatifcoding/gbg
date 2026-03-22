/**
 * @tmnl/mathkernel — Shared Primitives
 *
 * Common helpers used across all kernel .cpp files:
 * - Data marshalling (JS ↔ Eigen)
 * - Error throwing with context
 * - Statistical primitives
 * - Sorting/ranking utilities
 * - Convolution primitive
 *
 * Conditional compilation:
 *   __EMSCRIPTEN__   → Embind (WASM for browser)
 *   MATHKERNEL_NIF   → fine.hpp (Elixir NIF for BEAM VM)
 *   otherwise        → native C++ (tests, direct linking)
 */

#pragma once

#include <Eigen/Dense>
#include <cstddef>
#include <stdexcept>
#include <string>
#include <vector>
#include <algorithm>
#include <numeric>
#include <cmath>

#ifdef __EMSCRIPTEN__
#include <emscripten/val.h>
#endif

namespace mathkernel {

// ── Type Aliases ────────────────────────────────────────────────────────────

using Eigen::MatrixXd;
using Eigen::VectorXd;
using Eigen::Map;

// ── Data Marshalling (Emscripten only) ──────────────────────────────────────

#ifdef __EMSCRIPTEN__

/**
 * Map a JS Float64Array into an Eigen MatrixXd (row-major copy).
 * Data is copied — WASM linear memory isn't guaranteed stable across calls.
 */
inline MatrixXd js_to_matrix(const emscripten::val& arr, int rows, int cols) {
  const auto len = arr["length"].as<std::size_t>();
  if (static_cast<std::size_t>(rows * cols) != len) {
    throw std::invalid_argument(
      "DimensionMismatch: array length (" + std::to_string(len) +
      ") != rows * cols (" + std::to_string(rows) + " * " + std::to_string(cols) + ")");
  }
  MatrixXd m(rows, cols);
  for (int i = 0; i < rows; ++i) {
    for (int j = 0; j < cols; ++j) {
      m(i, j) = arr[i * cols + j].as<double>();
    }
  }
  return m;
}

/**
 * Map a JS Float64Array into an Eigen VectorXd.
 */
inline VectorXd js_to_vector(const emscripten::val& arr) {
  const auto len = arr["length"].as<std::size_t>();
  VectorXd v(len);
  for (std::size_t i = 0; i < len; ++i) {
    v(i) = arr[i].as<double>();
  }
  return v;
}

/**
 * Return an Eigen matrix as a JS Float64Array (row-major).
 */
inline emscripten::val matrix_to_js(const MatrixXd& m) {
  const auto rows = m.rows();
  const auto cols = m.cols();
  emscripten::val result = emscripten::val::global("Float64Array").new_(rows * cols);
  for (int i = 0; i < rows; ++i) {
    for (int j = 0; j < cols; ++j) {
      result.set(i * cols + j, emscripten::val(m(i, j)));
    }
  }
  return result;
}

/**
 * Return an Eigen vector as a JS Float64Array.
 */
inline emscripten::val vector_to_js(const VectorXd& v) {
  const auto n = v.size();
  emscripten::val result = emscripten::val::global("Float64Array").new_(n);
  for (int i = 0; i < n; ++i) {
    result.set(i, emscripten::val(v(i)));
  }
  return result;
}

#endif // __EMSCRIPTEN__

// ── Native Data Marshalling (non-Emscripten) ───────────────────────────────

/**
 * Map a flat std::vector<double> into an Eigen MatrixXd (row-major).
 */
inline MatrixXd vec_to_matrix(const std::vector<double>& data, int rows, int cols) {
  if (static_cast<std::size_t>(rows * cols) != data.size()) {
    throw std::invalid_argument(
      "DimensionMismatch: data size (" + std::to_string(data.size()) +
      ") != rows * cols (" + std::to_string(rows) + " * " + std::to_string(cols) + ")");
  }
  MatrixXd m(rows, cols);
  for (int i = 0; i < rows; ++i) {
    for (int j = 0; j < cols; ++j) {
      m(i, j) = data[i * cols + j];
    }
  }
  return m;
}

/**
 * Map an Eigen VectorXd from a std::vector<double>.
 */
inline VectorXd vec_to_vector(const std::vector<double>& data) {
  VectorXd v(data.size());
  for (std::size_t i = 0; i < data.size(); ++i) {
    v(i) = data[i];
  }
  return v;
}

/**
 * Flatten an Eigen MatrixXd to std::vector<double> (row-major).
 */
inline std::vector<double> matrix_to_vec(const MatrixXd& m) {
  std::vector<double> result(m.rows() * m.cols());
  for (int i = 0; i < m.rows(); ++i) {
    for (int j = 0; j < m.cols(); ++j) {
      result[i * m.cols() + j] = m(i, j);
    }
  }
  return result;
}

/**
 * Flatten an Eigen VectorXd to std::vector<double>.
 */
inline std::vector<double> vector_to_vec(const VectorXd& v) {
  return std::vector<double>(v.data(), v.data() + v.size());
}

// ── Error Throwing ──────────────────────────────────────────────────────────

[[noreturn]] inline void throw_dim_mismatch(int expected, int got, const char* context) {
  throw std::invalid_argument(
    std::string("DimensionMismatch in ") + context +
    ": expected " + std::to_string(expected) +
    ", got " + std::to_string(got));
}

[[noreturn]] inline void throw_singular(const char* context) {
  throw std::runtime_error(
    std::string("SingularMatrix in ") + context + ": matrix is singular or nearly singular");
}

[[noreturn]] inline void throw_convergence(int iters, double tol, const char* context) {
  throw std::runtime_error(
    std::string("ConvergenceFailure in ") + context +
    ": did not converge after " + std::to_string(iters) +
    " iterations (tol=" + std::to_string(tol) + ")");
}

// ── Statistical Primitives ──────────────────────────────────────────────────

/** Compute mean of a vector. */
inline double compute_mean(const VectorXd& v) {
  return v.mean();
}

/** Compute variance of a vector given precomputed mean. */
inline double compute_var(const VectorXd& v, double mean) {
  return (v.array() - mean).square().sum() / static_cast<double>(v.size() - 1);
}

/** Compute population variance (divide by n, not n-1). */
inline double compute_var_pop(const VectorXd& v, double mean) {
  return (v.array() - mean).square().mean();
}

/** Compute standard deviation. */
inline double compute_std(const VectorXd& v, double mean) {
  return std::sqrt(compute_var(v, mean));
}

/** Compute residuals: y - X*beta. */
inline VectorXd compute_residuals(const VectorXd& y, const MatrixXd& X, const VectorXd& beta) {
  return y - X * beta;
}

/** Compute hat matrix: H = X(X'X)^{-1}X'. */
inline MatrixXd hat_matrix(const MatrixXd& X) {
  auto XtX = (X.transpose() * X).eval();
  auto XtX_inv = XtX.ldlt().solve(MatrixXd::Identity(X.cols(), X.cols()));
  return X * XtX_inv * X.transpose();
}

/**
 * Standardize columns: subtract mean, divide by std.
 * Returns {standardized_X, means, stds}.
 */
inline std::tuple<MatrixXd, VectorXd, VectorXd>
standardize_columns(const MatrixXd& X) {
  const int n = X.rows();
  const int p = X.cols();
  VectorXd means(p), stds(p);
  MatrixXd Z(n, p);
  for (int j = 0; j < p; ++j) {
    means(j) = X.col(j).mean();
    stds(j) = std::sqrt((X.col(j).array() - means(j)).square().sum() / (n - 1));
    if (stds(j) < 1e-15) stds(j) = 1.0; // avoid division by zero
    Z.col(j) = (X.col(j).array() - means(j)) / stds(j);
  }
  return {Z, means, stds};
}

// ── Sorting / Ranking ───────────────────────────────────────────────────────

/** Return a sorted copy of the vector. */
inline VectorXd sorted_copy(const VectorXd& v) {
  std::vector<double> tmp(v.data(), v.data() + v.size());
  std::sort(tmp.begin(), tmp.end());
  return Eigen::Map<VectorXd>(tmp.data(), tmp.size());
}

/** Rank vector (1-based, average ties). */
inline VectorXd rank_vector(const VectorXd& v) {
  const int n = v.size();
  std::vector<int> idx(n);
  std::iota(idx.begin(), idx.end(), 0);
  std::sort(idx.begin(), idx.end(), [&](int a, int b) { return v(a) < v(b); });

  VectorXd ranks(n);
  int i = 0;
  while (i < n) {
    int j = i;
    while (j < n - 1 && v(idx[j]) == v(idx[j + 1])) ++j;
    double avg_rank = (i + j) / 2.0 + 1.0;
    for (int k = i; k <= j; ++k) ranks(idx[k]) = avg_rank;
    i = j + 1;
  }
  return ranks;
}

// ── Signal Primitives ───────────────────────────────────────────────────────

/**
 * 1D linear convolution: result[k] = Σ a[m] * b[k-m].
 * Output length = a.size() + b.size() - 1 (full convolution).
 */
inline VectorXd convolve_1d(const VectorXd& a, const VectorXd& b) {
  const int na = a.size(), nb = b.size();
  const int nc = na + nb - 1;
  VectorXd c = VectorXd::Zero(nc);
  for (int k = 0; k < nc; ++k) {
    const int m_min = std::max(0, k - nb + 1);
    const int m_max = std::min(na - 1, k);
    for (int m = m_min; m <= m_max; ++m) {
      c(k) += a(m) * b(k - m);
    }
  }
  return c;
}

} // namespace mathkernel
