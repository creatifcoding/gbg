/**
 * @tmnl/mathkernel — Matrix Decomposition Kernels
 *
 * C++20 / Eigen. Shared primitives via common.hpp.
 * Kernels: SVD, QR, Cholesky, eigenvalues, PCA
 */

#include "common.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
using namespace emscripten;
using mathkernel::js_to_matrix;
using mathkernel::matrix_to_js;
using mathkernel::vector_to_js;
#endif

using mathkernel::MatrixXd;
using mathkernel::VectorXd;

namespace mathkernel {

#ifdef __EMSCRIPTEN__

/** SVD: A = UΣVᵀ. Returns {u, s, vt, m, n, k}. */
val svd(const val& a, int rows, int cols) {
  auto A = js_to_matrix(a, rows, cols);
  Eigen::JacobiSVD<MatrixXd> svd(A, Eigen::ComputeThinU | Eigen::ComputeThinV);

  val result = val::object();
  result.set("u", matrix_to_js(svd.matrixU()));
  result.set("s", vector_to_js(svd.singularValues()));
  result.set("vt", matrix_to_js(svd.matrixV().transpose()));
  result.set("m", rows);
  result.set("n", cols);
  result.set("k", static_cast<int>(svd.singularValues().size()));
  return result;
}

/** QR: A = QR. Returns {q, r, m, n}. */
val qr(const val& a, int rows, int cols) {
  auto A = js_to_matrix(a, rows, cols);
  Eigen::HouseholderQR<MatrixXd> qr(A);

  MatrixXd Q = qr.householderQ() * MatrixXd::Identity(rows, std::min(rows, cols));
  MatrixXd R = qr.matrixQR().triangularView<Eigen::Upper>().toDenseMatrix()
                 .topRows(std::min(rows, cols));

  val result = val::object();
  result.set("q", matrix_to_js(Q));
  result.set("r", matrix_to_js(R));
  result.set("m", rows);
  result.set("n", cols);
  return result;
}

/** Cholesky: A = LLᵀ. A must be symmetric positive-definite. */
val cholesky(const val& a, int n) {
  auto A = js_to_matrix(a, n, n);
  Eigen::LLT<MatrixXd> llt(A);
  if (llt.info() != Eigen::Success) {
    throw std::runtime_error("CholeskyFailed: matrix is not positive-definite");
  }
  return matrix_to_js(MatrixXd(llt.matrixL()));
}

/** Eigen decomposition: A = VΛV⁻¹. Returns {values_re, values_im, vectors, n}. */
val eigen(const val& a, int n) {
  auto A = js_to_matrix(a, n, n);
  Eigen::EigenSolver<MatrixXd> es(A);

  auto eigenvalues = es.eigenvalues();
  auto eigenvectors = es.eigenvectors();

  VectorXd values_re(n), values_im(n);
  MatrixXd vectors_re(n, n);
  for (int i = 0; i < n; ++i) {
    values_re(i) = eigenvalues(i).real();
    values_im(i) = eigenvalues(i).imag();
    for (int j = 0; j < n; ++j)
      vectors_re(j, i) = eigenvectors(j, i).real();
  }

  val result = val::object();
  result.set("values_re", vector_to_js(values_re));
  result.set("values_im", vector_to_js(values_im));
  result.set("vectors", matrix_to_js(vectors_re));
  result.set("n", n);
  return result;
}

/** PCA via SVD. Returns {components, explained_variance, mean, transformed, n_components}. */
val pca(const val& x, int n_samples, int n_features, int k) {
  auto X = js_to_matrix(x, n_samples, n_features);

  VectorXd mean = X.colwise().mean();
  MatrixXd Xc = X.rowwise() - mean.transpose();

  Eigen::JacobiSVD<MatrixXd> svd(Xc, Eigen::ComputeThinU | Eigen::ComputeThinV);

  int n_components = (k > 0 && k < n_features) ? k : n_features;

  MatrixXd components = svd.matrixV().leftCols(n_components).transpose();
  VectorXd sv = svd.singularValues().head(n_components);
  VectorXd explained_variance = (sv.array().square() / (n_samples - 1)).matrix();
  MatrixXd transformed = Xc * svd.matrixV().leftCols(n_components);

  val result = val::object();
  result.set("components", matrix_to_js(components));
  result.set("explained_variance", vector_to_js(explained_variance));
  result.set("mean", vector_to_js(mean));
  result.set("transformed", matrix_to_js(transformed));
  result.set("n_components", n_components);
  return result;
}

#endif // __EMSCRIPTEN__

} // namespace mathkernel

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(mathkernel_decompositions) {
  function("svd", &mathkernel::svd);
  function("qr", &mathkernel::qr);
  function("cholesky", &mathkernel::cholesky);
  function("eigen", &mathkernel::eigen);
  function("pca", &mathkernel::pca);
}
#endif
