/**
 * @tmnl/mathkernel — Vectorized Operations
 *
 * C++20 / Eigen. Shared primitives via common.hpp.
 *
 * Domain breakdown (33 functions):
 *   Norms (4): l1_norm, l2_norm, linf_norm, lp_norm
 *   Similarity (3): cosine_similarity, jaccard_index, pearson_corr
 *   Info Theory (5): entropy, cross_entropy, kl_divergence, mutual_info, js_divergence
 *   Rolling Stats (10): rolling_mean, rolling_std, rolling_min, rolling_max, rolling_sum,
 *                        rolling_median, rolling_var, rolling_zscore, ewma, rolling_corr
 *   Window Functions (6): hann, hamming, blackman, bartlett, kaiser, flat_top
 *   Transforms (5): softmax, log_softmax, normalize, standardize_vec, cumsum
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

#ifdef __EMSCRIPTEN__

// ═══════════════════════════════════════════════════════════════════════════
// NORMS
// ═══════════════════════════════════════════════════════════════════════════

double l1_norm(const val& v) { return js_to_vector(v).lpNorm<1>(); }
double l2_norm(const val& v) { return js_to_vector(v).norm(); }
double linf_norm(const val& v) { return js_to_vector(v).lpNorm<Eigen::Infinity>(); }
double lp_norm(const val& v, double p) {
  auto x = js_to_vector(v);
  if (p <= 0) throw std::invalid_argument("lp_norm: p must be > 0");
  return std::pow(x.array().abs().pow(p).sum(), 1.0 / p);
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMILARITY
// ═══════════════════════════════════════════════════════════════════════════

double cosine_similarity(const val& a, const val& b) {
  auto x = js_to_vector(a), y = js_to_vector(b);
  if (x.size() != y.size()) throw_dim_mismatch(x.size(), y.size(), "cosine_similarity");
  double denom = x.norm() * y.norm();
  return (denom > 1e-15) ? x.dot(y) / denom : 0.0;
}

double jaccard_index(const val& a, const val& b) {
  auto x = js_to_vector(a), y = js_to_vector(b);
  if (x.size() != y.size()) throw_dim_mismatch(x.size(), y.size(), "jaccard_index");
  double intersection = 0.0, union_size = 0.0;
  for (int i = 0; i < x.size(); ++i) {
    double xi = (x(i) != 0) ? 1.0 : 0.0;
    double yi = (y(i) != 0) ? 1.0 : 0.0;
    intersection += xi * yi;
    union_size += std::max(xi, yi);
  }
  return (union_size > 0) ? intersection / union_size : 1.0;
}

double pearson_corr(const val& a, const val& b) {
  auto x = js_to_vector(a), y = js_to_vector(b);
  if (x.size() != y.size()) throw_dim_mismatch(x.size(), y.size(), "pearson_corr");
  int n = x.size();
  double mx = compute_mean(x), my = compute_mean(y);
  double cov = 0.0, sx = 0.0, sy = 0.0;
  for (int i = 0; i < n; ++i) {
    double dx = x(i) - mx, dy = y(i) - my;
    cov += dx * dy;
    sx += dx * dx;
    sy += dy * dy;
  }
  double denom = std::sqrt(sx * sy);
  return (denom > 1e-15) ? cov / denom : 0.0;
}

// ═══════════════════════════════════════════════════════════════════════════
// INFORMATION THEORY
// ═══════════════════════════════════════════════════════════════════════════

double entropy(const val& p_arr) {
  auto p = js_to_vector(p_arr);
  double H = 0.0;
  for (int i = 0; i < p.size(); ++i) {
    if (p(i) > 1e-15) H -= p(i) * std::log2(p(i));
  }
  return H;
}

double cross_entropy(const val& p_arr, const val& q_arr) {
  auto p = js_to_vector(p_arr), q = js_to_vector(q_arr);
  if (p.size() != q.size()) throw_dim_mismatch(p.size(), q.size(), "cross_entropy");
  double H = 0.0;
  for (int i = 0; i < p.size(); ++i) {
    if (p(i) > 1e-15) H -= p(i) * std::log2(std::max(q(i), 1e-15));
  }
  return H;
}

double kl_divergence(const val& p_arr, const val& q_arr) {
  auto p = js_to_vector(p_arr), q = js_to_vector(q_arr);
  if (p.size() != q.size()) throw_dim_mismatch(p.size(), q.size(), "kl_divergence");
  double KL = 0.0;
  for (int i = 0; i < p.size(); ++i) {
    if (p(i) > 1e-15 && q(i) > 1e-15) KL += p(i) * std::log2(p(i) / q(i));
  }
  return KL;
}

double js_divergence(const val& p_arr, const val& q_arr) {
  auto p = js_to_vector(p_arr), q = js_to_vector(q_arr);
  if (p.size() != q.size()) throw_dim_mismatch(p.size(), q.size(), "js_divergence");
  int n = p.size();
  // M = (P + Q) / 2
  double kl_pm = 0.0, kl_qm = 0.0;
  for (int i = 0; i < n; ++i) {
    double m = (p(i) + q(i)) / 2.0;
    if (p(i) > 1e-15 && m > 1e-15) kl_pm += p(i) * std::log2(p(i) / m);
    if (q(i) > 1e-15 && m > 1e-15) kl_qm += q(i) * std::log2(q(i) / m);
  }
  return (kl_pm + kl_qm) / 2.0;
}

double mutual_info(const val& joint_arr, int rows, int cols) {
  // Joint probability table (rows × cols), flattened row-major
  auto joint = js_to_vector(joint_arr);
  if (joint.size() != rows * cols) throw_dim_mismatch(rows * cols, joint.size(), "mutual_info");

  // Marginals
  VectorXd px = VectorXd::Zero(rows), py = VectorXd::Zero(cols);
  for (int i = 0; i < rows; ++i)
    for (int j = 0; j < cols; ++j)
      px(i) += joint(i * cols + j);
  for (int j = 0; j < cols; ++j)
    for (int i = 0; i < rows; ++i)
      py(j) += joint(i * cols + j);

  double MI = 0.0;
  for (int i = 0; i < rows; ++i)
    for (int j = 0; j < cols; ++j) {
      double pij = joint(i * cols + j);
      if (pij > 1e-15 && px(i) > 1e-15 && py(j) > 1e-15)
        MI += pij * std::log2(pij / (px(i) * py(j)));
    }
  return MI;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLLING STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

val rolling_mean(const val& data_arr, int window) {
  auto x = js_to_vector(data_arr);
  int n = x.size();
  if (window < 1 || window > n) throw std::invalid_argument("rolling_mean: invalid window");
  int out_len = n - window + 1;
  VectorXd result(out_len);
  double sum = 0;
  for (int i = 0; i < window; ++i) sum += x(i);
  result(0) = sum / window;
  for (int i = 1; i < out_len; ++i) {
    sum += x(i + window - 1) - x(i - 1);
    result(i) = sum / window;
  }
  return vector_to_js(result);
}

val rolling_sum(const val& data_arr, int window) {
  auto x = js_to_vector(data_arr);
  int n = x.size(), out_len = n - window + 1;
  if (window < 1 || window > n) throw std::invalid_argument("rolling_sum: invalid window");
  VectorXd result(out_len);
  double sum = 0;
  for (int i = 0; i < window; ++i) sum += x(i);
  result(0) = sum;
  for (int i = 1; i < out_len; ++i) {
    sum += x(i + window - 1) - x(i - 1);
    result(i) = sum;
  }
  return vector_to_js(result);
}

val rolling_std(const val& data_arr, int window) {
  auto x = js_to_vector(data_arr);
  int n = x.size(), out_len = n - window + 1;
  if (window < 2 || window > n) throw std::invalid_argument("rolling_std: window must be >= 2");
  VectorXd result(out_len);
  for (int i = 0; i < out_len; ++i) {
    auto seg = x.segment(i, window);
    double m = seg.mean();
    result(i) = std::sqrt((seg.array() - m).square().sum() / (window - 1));
  }
  return vector_to_js(result);
}

val rolling_var(const val& data_arr, int window) {
  auto x = js_to_vector(data_arr);
  int n = x.size(), out_len = n - window + 1;
  if (window < 2 || window > n) throw std::invalid_argument("rolling_var: window must be >= 2");
  VectorXd result(out_len);
  for (int i = 0; i < out_len; ++i) {
    auto seg = x.segment(i, window);
    double m = seg.mean();
    result(i) = (seg.array() - m).square().sum() / (window - 1);
  }
  return vector_to_js(result);
}

val rolling_min(const val& data_arr, int window) {
  auto x = js_to_vector(data_arr);
  int n = x.size(), out_len = n - window + 1;
  if (window < 1 || window > n) throw std::invalid_argument("rolling_min: invalid window");
  VectorXd result(out_len);
  for (int i = 0; i < out_len; ++i) result(i) = x.segment(i, window).minCoeff();
  return vector_to_js(result);
}

val rolling_max(const val& data_arr, int window) {
  auto x = js_to_vector(data_arr);
  int n = x.size(), out_len = n - window + 1;
  if (window < 1 || window > n) throw std::invalid_argument("rolling_max: invalid window");
  VectorXd result(out_len);
  for (int i = 0; i < out_len; ++i) result(i) = x.segment(i, window).maxCoeff();
  return vector_to_js(result);
}

val rolling_median(const val& data_arr, int window) {
  auto x = js_to_vector(data_arr);
  int n = x.size(), out_len = n - window + 1;
  if (window < 1 || window > n) throw std::invalid_argument("rolling_median: invalid window");
  VectorXd result(out_len);
  for (int i = 0; i < out_len; ++i) {
    VectorXd seg = x.segment(i, window);
    auto sorted = sorted_copy(seg);
    if (window % 2 == 1) result(i) = sorted(window / 2);
    else result(i) = (sorted(window / 2 - 1) + sorted(window / 2)) / 2.0;
  }
  return vector_to_js(result);
}

val rolling_zscore(const val& data_arr, int window) {
  auto x = js_to_vector(data_arr);
  int n = x.size(), out_len = n - window + 1;
  if (window < 2 || window > n) throw std::invalid_argument("rolling_zscore: window must be >= 2");
  VectorXd result(out_len);
  for (int i = 0; i < out_len; ++i) {
    auto seg = x.segment(i, window);
    double m = seg.mean();
    double s = std::sqrt((seg.array() - m).square().sum() / (window - 1));
    // z-score of the last element in the window
    result(i) = (s > 1e-15) ? (x(i + window - 1) - m) / s : 0.0;
  }
  return vector_to_js(result);
}

/** EWMA (Exponentially Weighted Moving Average): s_t = α x_t + (1-α) s_{t-1} */
val ewma(const val& data_arr, double alpha) {
  auto x = js_to_vector(data_arr);
  int n = x.size();
  if (alpha <= 0 || alpha > 1) throw std::invalid_argument("ewma: alpha must be in (0,1]");
  VectorXd result(n);
  result(0) = x(0);
  for (int i = 1; i < n; ++i) result(i) = alpha * x(i) + (1.0 - alpha) * result(i-1);
  return vector_to_js(result);
}

/** Rolling Pearson correlation between two series. */
val rolling_corr(const val& a_arr, const val& b_arr, int window) {
  auto x = js_to_vector(a_arr), y = js_to_vector(b_arr);
  if (x.size() != y.size()) throw_dim_mismatch(x.size(), y.size(), "rolling_corr");
  int n = x.size(), out_len = n - window + 1;
  if (window < 2 || window > n) throw std::invalid_argument("rolling_corr: window must be >= 2");
  VectorXd result(out_len);
  for (int i = 0; i < out_len; ++i) {
    auto sx = x.segment(i, window), sy = y.segment(i, window);
    double mx = sx.mean(), my = sy.mean();
    double cov = 0, vx = 0, vy = 0;
    for (int j = 0; j < window; ++j) {
      double dx = sx(j) - mx, dy = sy(j) - my;
      cov += dx * dy; vx += dx * dx; vy += dy * dy;
    }
    double denom = std::sqrt(vx * vy);
    result(i) = (denom > 1e-15) ? cov / denom : 0.0;
  }
  return vector_to_js(result);
}

// ═══════════════════════════════════════════════════════════════════════════
// WINDOW FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

val hann_window(int N) {
  VectorXd w(N);
  for (int i = 0; i < N; ++i) w(i) = 0.5 * (1.0 - std::cos(2.0 * M_PI * i / (N - 1)));
  return vector_to_js(w);
}

val hamming_window(int N) {
  VectorXd w(N);
  for (int i = 0; i < N; ++i) w(i) = 0.54 - 0.46 * std::cos(2.0 * M_PI * i / (N - 1));
  return vector_to_js(w);
}

val blackman_window(int N) {
  VectorXd w(N);
  for (int i = 0; i < N; ++i)
    w(i) = 0.42 - 0.5 * std::cos(2.0 * M_PI * i / (N - 1))
                  + 0.08 * std::cos(4.0 * M_PI * i / (N - 1));
  return vector_to_js(w);
}

val bartlett_window(int N) {
  VectorXd w(N);
  double half = (N - 1) / 2.0;
  for (int i = 0; i < N; ++i) w(i) = 1.0 - std::abs((i - half) / half);
  return vector_to_js(w);
}

/** Kaiser window with parameter beta. Uses I₀ Bessel approximation. */
val kaiser_window(int N, double beta) {
  VectorXd w(N);
  // I₀(x) Bessel function approximation (polynomial)
  auto bessel_i0 = [](double x) -> double {
    double sum = 1.0, term = 1.0;
    for (int k = 1; k <= 20; ++k) {
      term *= (x / (2.0 * k)) * (x / (2.0 * k));
      sum += term;
      if (term < 1e-15 * sum) break;
    }
    return sum;
  };
  double denom = bessel_i0(beta);
  for (int i = 0; i < N; ++i) {
    double r = 2.0 * i / (N - 1) - 1.0;
    w(i) = bessel_i0(beta * std::sqrt(1.0 - r * r)) / denom;
  }
  return vector_to_js(w);
}

val flat_top_window(int N) {
  VectorXd w(N);
  const double a0 = 0.21557895, a1 = 0.41663158, a2 = 0.277263158;
  const double a3 = 0.083578947, a4 = 0.006947368;
  for (int i = 0; i < N; ++i) {
    double x = 2.0 * M_PI * i / (N - 1);
    w(i) = a0 - a1*std::cos(x) + a2*std::cos(2*x) - a3*std::cos(3*x) + a4*std::cos(4*x);
  }
  return vector_to_js(w);
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFORMS
// ═══════════════════════════════════════════════════════════════════════════

val softmax(const val& data_arr) {
  auto x = js_to_vector(data_arr);
  double max_val = x.maxCoeff();
  VectorXd exp_x = (x.array() - max_val).exp();
  VectorXd result = exp_x / exp_x.sum();
  return vector_to_js(result);
}

val log_softmax(const val& data_arr) {
  auto x = js_to_vector(data_arr);
  double max_val = x.maxCoeff();
  VectorXd shifted = x.array() - max_val;
  double log_sum_exp = std::log(shifted.array().exp().sum());
  VectorXd result = shifted.array() - log_sum_exp;
  return vector_to_js(result);
}

/** Normalize to [0, 1] range (min-max). */
val normalize_vec(const val& data_arr) {
  auto x = js_to_vector(data_arr);
  double mn = x.minCoeff(), mx = x.maxCoeff();
  double range = mx - mn;
  VectorXd result;
  if (range > 1e-15) result = ((x.array() - mn) / range).matrix();
  else result = VectorXd::Zero(x.size());
  return vector_to_js(result);
}

/** Standardize: (x - mean) / std. */
val standardize_vec(const val& data_arr) {
  auto x = js_to_vector(data_arr);
  double m = compute_mean(x), s = compute_std(x, m);
  VectorXd result;
  if (s > 1e-15) result = ((x.array() - m) / s).matrix();
  else result = VectorXd::Zero(x.size());
  return vector_to_js(result);
}

/** Cumulative sum. */
val cumsum(const val& data_arr) {
  auto x = js_to_vector(data_arr);
  int n = x.size();
  VectorXd result(n);
  result(0) = x(0);
  for (int i = 1; i < n; ++i) result(i) = result(i-1) + x(i);
  return vector_to_js(result);
}

#endif // __EMSCRIPTEN__

} // namespace mathkernel

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(mathkernel_vectorized) {
  // Norms
  function("l1_norm", &mathkernel::l1_norm);
  function("l2_norm", &mathkernel::l2_norm);
  function("linf_norm", &mathkernel::linf_norm);
  function("lp_norm", &mathkernel::lp_norm);
  // Similarity
  function("cosine_similarity", &mathkernel::cosine_similarity);
  function("jaccard_index", &mathkernel::jaccard_index);
  function("pearson_corr", &mathkernel::pearson_corr);
  // Info Theory
  function("entropy", &mathkernel::entropy);
  function("cross_entropy", &mathkernel::cross_entropy);
  function("kl_divergence", &mathkernel::kl_divergence);
  function("js_divergence", &mathkernel::js_divergence);
  function("mutual_info", &mathkernel::mutual_info);
  // Rolling Stats
  function("rolling_mean", &mathkernel::rolling_mean);
  function("rolling_sum", &mathkernel::rolling_sum);
  function("rolling_std", &mathkernel::rolling_std);
  function("rolling_var", &mathkernel::rolling_var);
  function("rolling_min", &mathkernel::rolling_min);
  function("rolling_max", &mathkernel::rolling_max);
  function("rolling_median", &mathkernel::rolling_median);
  function("rolling_zscore", &mathkernel::rolling_zscore);
  function("ewma", &mathkernel::ewma);
  function("rolling_corr", &mathkernel::rolling_corr);
  // Window Functions
  function("hann_window", &mathkernel::hann_window);
  function("hamming_window", &mathkernel::hamming_window);
  function("blackman_window", &mathkernel::blackman_window);
  function("bartlett_window", &mathkernel::bartlett_window);
  function("kaiser_window", &mathkernel::kaiser_window);
  function("flat_top_window", &mathkernel::flat_top_window);
  // Transforms
  function("softmax", &mathkernel::softmax);
  function("log_softmax", &mathkernel::log_softmax);
  function("normalize_vec", &mathkernel::normalize_vec);
  function("standardize_vec", &mathkernel::standardize_vec);
  function("cumsum", &mathkernel::cumsum);
}
#endif
