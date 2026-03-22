/**
 * linalg.cpp — Eigen-backed linear algebra kernels
 *
 * All functions accept flat column-major vectors + dimensions,
 * and return flat column-major vectors. The Embind layer handles
 * JS TypedArray ↔ std::vector conversion.
 */

#include "linalg.h"

namespace mathkernel::linalg {

using Eigen::Map;
using Eigen::MatrixXd;
using Eigen::VectorXd;

Vec mmult(const Vec& a, int a_rows, int a_cols,
          const Vec& b, int b_rows, int b_cols) {
  if (a_cols != b_rows) return {};  // dimension mismatch

  Map<const MatrixXd> A(a.data(), a_rows, a_cols);
  Map<const MatrixXd> B(b.data(), b_rows, b_cols);
  MatrixXd C = A * B;

  return Vec(C.data(), C.data() + C.size());
}

Vec minverse(const Vec& a, int rows, int cols) {
  if (rows != cols) return {};  // must be square

  Map<const MatrixXd> A(a.data(), rows, cols);

  // Use full-pivot LU for numerical stability
  Eigen::FullPivLU<MatrixXd> lu(A);
  if (!lu.isInvertible()) return {};  // singular

  MatrixXd inv = lu.inverse();
  return Vec(inv.data(), inv.data() + inv.size());
}

double mdeterm(const Vec& a, int n) {
  Map<const MatrixXd> A(a.data(), n, n);
  return A.determinant();
}

Vec msolve(const Vec& a, int n, const Vec& b) {
  Map<const MatrixXd> A(a.data(), n, n);
  Map<const VectorXd> rhs(b.data(), n);

  // ColPivHouseholderQR: good balance of speed and stability
  VectorXd x = A.colPivHouseholderQr().solve(rhs);

  return Vec(x.data(), x.data() + x.size());
}

Vec mtranspose(const Vec& a, int rows, int cols) {
  Map<const MatrixXd> A(a.data(), rows, cols);
  MatrixXd At = A.transpose();

  return Vec(At.data(), At.data() + At.size());
}

double mtrace(const Vec& a, int n) {
  Map<const MatrixXd> A(a.data(), n, n);
  return A.trace();
}

double mnorm(const Vec& a, int rows, int cols) {
  Map<const MatrixXd> A(a.data(), rows, cols);
  return A.norm();  // Frobenius by default
}

int mrank(const Vec& a, int rows, int cols) {
  Map<const MatrixXd> A(a.data(), rows, cols);
  Eigen::FullPivLU<MatrixXd> lu(A);
  return static_cast<int>(lu.rank());
}

} // namespace mathkernel::linalg
