#pragma once
/**
 * linalg.h — Linear algebra kernels (Eigen-backed)
 *
 * Matrix operations that are impossible on a flat stack VM:
 * multiply, inverse, determinant, solve, transpose.
 */

#include <Eigen/Dense>
#include <vector>
#include <cstdint>

namespace mathkernel::linalg {

using Vec = std::vector<double>;

// ── Matrix multiply: C = A × B ──
Vec mmult(const Vec& a, int a_rows, int a_cols,
          const Vec& b, int b_rows, int b_cols);

// ── Matrix inverse: A⁻¹ ──
Vec minverse(const Vec& a, int rows, int cols);

// ── Determinant: det(A) ──
double mdeterm(const Vec& a, int n);

// ── Solve linear system: Ax = b → x ──
Vec msolve(const Vec& a, int n, const Vec& b);

// ── Transpose ──
Vec mtranspose(const Vec& a, int rows, int cols);

// ── Trace ──
double mtrace(const Vec& a, int n);

// ── Frobenius norm ──
double mnorm(const Vec& a, int rows, int cols);

// ── Matrix rank ──
int mrank(const Vec& a, int rows, int cols);

} // namespace mathkernel::linalg
