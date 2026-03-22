/**
 * @tmnl/mathkernel — Elixir NIF Bridge via fine
 *
 * Compile with: -DMATHKERNEL_NIF -std=c++17
 * Link against: Erlang NIF headers + Eigen
 *
 * This file is ONLY compiled for the NIF target, not WASM.
 * Uses elixir-nx/fine for auto-encoding/decoding NIF arguments.
 *
 * PoC scope: mmult kernel only.
 */

#ifdef MATHKERNEL_NIF

#include "common.hpp"
#include <fine.hpp>

using mathkernel::MatrixXd;
using mathkernel::VectorXd;

namespace mathkernel {
namespace nif {

/**
 * Matrix multiply via Eigen.
 *
 * NIF signature: mmult(a :: [float], rows_a :: int, cols_a :: int,
 *                       b :: [float], rows_b :: int, cols_b :: int) :: [float]
 *
 * Input/output as flat row-major double lists (Elixir lists of floats).
 * The fine library auto-converts between Erlang terms and C++ types.
 */
std::vector<double> mmult(
  std::vector<double> a_flat, int rows_a, int cols_a,
  std::vector<double> b_flat, int rows_b, int cols_b
) {
  if (cols_a != rows_b) {
    throw std::invalid_argument("mmult: dimension mismatch");
  }

  auto A = vec_to_matrix(a_flat, rows_a, cols_a);
  auto B = vec_to_matrix(b_flat, rows_b, cols_b);
  MatrixXd C = A * B;

  return matrix_to_vec(C);
}

/**
 * Determinant via Eigen.
 */
double det(std::vector<double> a_flat, int n) {
  auto A = vec_to_matrix(a_flat, n, n);
  return A.determinant();
}

/**
 * Matrix inverse via Eigen.
 */
std::vector<double> inverse(std::vector<double> a_flat, int n) {
  auto A = vec_to_matrix(a_flat, n, n);
  MatrixXd inv = A.inverse();
  return matrix_to_vec(inv);
}

} // namespace nif
} // namespace mathkernel

// ── fine NIF registration ───────────────────────────────────────────────────

// Each FINE_NIF registers a function as an Erlang NIF.
// The first arg is the C++ function, the second is NIF flags.
// ERL_NIF_DIRTY_CPU marks these as CPU-intensive (runs on dirty scheduler).

FINE_NIF(mathkernel::nif::mmult, ERL_NIF_DIRTY_CPU)
FINE_NIF(mathkernel::nif::det, ERL_NIF_DIRTY_CPU)
FINE_NIF(mathkernel::nif::inverse, ERL_NIF_DIRTY_CPU)

// FINE_INIT generates the ErlNifEntry struct with module name.
// This module will be loaded in Elixir as :math_kernel_nif
FINE_INIT("Elixir.MathKernel.NIF")

#endif // MATHKERNEL_NIF
