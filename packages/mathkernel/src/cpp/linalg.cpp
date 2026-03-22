/**
 * @tmnl/mathkernel — Linear Algebra Kernels
 *
 * C++20 / Eigen implementations. Shared primitives via common.hpp.
 * All functions accept flat Float64Arrays + dimension parameters
 * and return flat Float64Arrays (row-major).
 *
 * Kernels: mmult, solve, inverse, det, transpose, trace, norm, rank
 */

#include "common.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
using namespace emscripten;
using mathkernel::js_to_matrix;
using mathkernel::js_to_vector;
using mathkernel::matrix_to_js;
using mathkernel::vector_to_js;
#endif

using mathkernel::MatrixXd;
using mathkernel::VectorXd;

// ── Kernel Functions ────────────────────────────────────────────────────────

namespace mathkernel {

#ifdef __EMSCRIPTEN__

/** Matrix multiplication: C = A × B. A:(m×k), B:(k×n) → C:(m×n) */
val mmult(const val& a, int m, int k, const val& b, int k2, int n) {
  if (k != k2) throw_dim_mismatch(k, k2, "mmult: A cols vs B rows");
  auto A = js_to_matrix(a, m, k);
  auto B = js_to_matrix(b, k, n);
  return matrix_to_js(MatrixXd(A * B));
}

/** Solve linear system: Ax = b → x. Uses partial pivoting LU. */
val solve(const val& a, int n, const val& b_arr) {
  auto A = js_to_matrix(a, n, n);
  auto b = js_to_vector(b_arr);
  if (b.size() != n) throw_dim_mismatch(n, b.size(), "solve: b length");
  auto lu = A.partialPivLu();
  if (std::abs(lu.determinant()) < 1e-14) throw_singular("solve");
  return vector_to_js(VectorXd(lu.solve(b)));
}

/** Matrix inverse: A⁻¹. A:(n×n) → A⁻¹:(n×n) */
val inverse(const val& a, int n) {
  auto A = js_to_matrix(a, n, n);
  auto lu = A.partialPivLu();
  if (std::abs(lu.determinant()) < 1e-14) throw_singular("inverse");
  return matrix_to_js(MatrixXd(A.inverse()));
}

/** Determinant: det(A). */
double det(const val& a, int n) {
  return js_to_matrix(a, n, n).determinant();
}

/** Transpose: Aᵀ. */
val transpose(const val& a, int rows, int cols) {
  return matrix_to_js(MatrixXd(js_to_matrix(a, rows, cols).transpose()));
}

/** Trace: tr(A). */
double trace(const val& a, int n) {
  return js_to_matrix(a, n, n).trace();
}

/** Frobenius norm: ||A||_F. */
double norm(const val& a, int rows, int cols) {
  return js_to_matrix(a, rows, cols).norm();
}

/** Matrix rank (numerical, via SVD). */
int rank(const val& a, int rows, int cols) {
  auto A = js_to_matrix(a, rows, cols);
  Eigen::JacobiSVD<MatrixXd> svd(A);
  return svd.rank();
}

#endif // __EMSCRIPTEN__

} // namespace mathkernel

// ── Embind Registration ─────────────────────────────────────────────────────

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(mathkernel_linalg) {
  function("mmult", &mathkernel::mmult);
  function("solve", &mathkernel::solve);
  function("inverse", &mathkernel::inverse);
  function("det", &mathkernel::det);
  function("transpose", &mathkernel::transpose);
  function("trace", &mathkernel::trace);
  function("norm", &mathkernel::norm);
  function("rank", &mathkernel::rank);
}
#endif
