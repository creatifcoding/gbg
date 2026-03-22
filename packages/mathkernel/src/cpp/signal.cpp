/**
 * @tmnl/mathkernel — Signal Processing Kernels
 *
 * C++20 / Eigen. Shared primitives via common.hpp.
 * Kernels: dft_magnitude, hilbert_envelope, convolve, butterworth, chebyshev_filter
 *
 * FFT: Manual Cooley-Tukey radix-2 (Eigen unsupported FFT may not compile under Emscripten).
 */

#include "common.hpp"
#include <complex>

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
using namespace emscripten;
using mathkernel::js_to_vector;
using mathkernel::vector_to_js;
#endif

using mathkernel::VectorXd;

namespace mathkernel {

// ── Internal FFT ────────────────────────────────────────────────────────────

namespace {

using Complex = std::complex<double>;

/** Bit-reversal permutation for FFT. */
void bit_reverse(std::vector<Complex>& a) {
  int n = a.size();
  for (int i = 1, j = 0; i < n; ++i) {
    int bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) std::swap(a[i], a[j]);
  }
}

/**
 * In-place Cooley-Tukey FFT (radix-2, decimation-in-time).
 * Input size must be power of 2.
 * invert=true for inverse FFT.
 */
void fft_radix2(std::vector<Complex>& a, bool invert = false) {
  int n = a.size();
  if (n == 1) return;

  bit_reverse(a);

  for (int len = 2; len <= n; len <<= 1) {
    double ang = 2 * M_PI / len * (invert ? -1 : 1);
    Complex wlen(std::cos(ang), std::sin(ang));
    for (int i = 0; i < n; i += len) {
      Complex w(1);
      for (int j = 0; j < len / 2; ++j) {
        Complex u = a[i + j];
        Complex v = a[i + j + len/2] * w;
        a[i + j] = u + v;
        a[i + j + len/2] = u - v;
        w *= wlen;
      }
    }
  }

  if (invert) {
    for (auto& x : a) x /= n;
  }
}

/** Next power of 2 >= n. */
int next_pow2(int n) {
  int p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** Zero-pad and run FFT. Returns complex spectrum. */
std::vector<Complex> compute_fft(const VectorXd& signal) {
  int n = signal.size();
  int N = next_pow2(n);
  std::vector<Complex> a(N);
  for (int i = 0; i < n; ++i) a[i] = Complex(signal(i), 0);
  for (int i = n; i < N; ++i) a[i] = Complex(0, 0);
  fft_radix2(a);
  return a;
}

/** Polynomial multiply via vectors (for filter coefficient computation). */
std::vector<double> poly_multiply(const std::vector<double>& a, const std::vector<double>& b) {
  int na = a.size(), nb = b.size();
  std::vector<double> c(na + nb - 1, 0.0);
  for (int i = 0; i < na; ++i)
    for (int j = 0; j < nb; ++j)
      c[i+j] += a[i] * b[j];
  return c;
}

} // anonymous namespace

// ── Kernel Functions ────────────────────────────────────────────────────────

#ifdef __EMSCRIPTEN__

/**
 * DFT Magnitude spectrum: |X[k]| for k = 0..N/2.
 * Returns Float64Array of N/2+1 magnitude values.
 */
val dft_magnitude(const val& data_arr) {
  auto signal = js_to_vector(data_arr);
  auto spectrum = compute_fft(signal);
  int N = spectrum.size();
  int half = N / 2 + 1;

  VectorXd mag(half);
  for (int k = 0; k < half; ++k) {
    mag(k) = std::abs(spectrum[k]);
  }
  return vector_to_js(mag);
}

/**
 * Hilbert envelope (analytic signal magnitude).
 * Uses FFT → zero negative frequencies → IFFT → magnitude.
 */
val hilbert_envelope(const val& data_arr) {
  auto signal = js_to_vector(data_arr);
  int n = signal.size();
  auto spectrum = compute_fft(signal);
  int N = spectrum.size();

  // Zero negative frequencies, double positive (except DC and Nyquist)
  spectrum[0] *= 1.0; // DC
  for (int k = 1; k < N / 2; ++k) spectrum[k] *= 2.0;
  // Nyquist
  if (N > 1) spectrum[N/2] *= 1.0;
  for (int k = N / 2 + 1; k < N; ++k) spectrum[k] = Complex(0, 0);

  // IFFT
  fft_radix2(spectrum, true);

  // Envelope = |analytic signal|
  VectorXd envelope(n);
  for (int i = 0; i < n; ++i) {
    envelope(i) = std::abs(spectrum[i]);
  }
  return vector_to_js(envelope);
}

/**
 * 1D convolution (uses common.hpp convolve_1d).
 * Returns Float64Array of length len(a) + len(b) - 1.
 */
val convolve(const val& a_arr, const val& b_arr) {
  auto a = js_to_vector(a_arr);
  auto b = js_to_vector(b_arr);
  return vector_to_js(convolve_1d(a, b));
}

/**
 * Butterworth filter design (lowpass).
 * Returns {b, a} coefficient arrays for transfer function H(z) = B(z)/A(z).
 *
 * order: filter order (1..10)
 * cutoff: normalized cutoff frequency (0..1, where 1 = Nyquist)
 */
val butterworth(int order, double cutoff) {
  if (order < 1 || order > 10) throw std::invalid_argument("butterworth: order must be 1..10");
  if (cutoff <= 0 || cutoff >= 1) throw std::invalid_argument("butterworth: cutoff must be in (0,1)");

  // Pre-warp: Ω_c = tan(π * f_c)
  double Wc = std::tan(M_PI * cutoff / 2.0);

  // Analog Butterworth poles: s_k = Wc * e^{j π (2k + n + 1) / 2n}
  // Convert to digital via bilinear transform: z = (1 + s/2) / (1 - s/2)
  std::vector<double> b_total = {1.0};
  std::vector<double> a_total = {1.0};

  for (int k = 0; k < order; ++k) {
    double angle = M_PI * (2.0 * k + order + 1.0) / (2.0 * order);
    Complex s_k = Wc * Complex(std::cos(angle), std::sin(angle));

    // Bilinear transform: z-domain second-order section
    // For each conjugate pole pair, we get a second-order section
    // Single real pole or complex pair
    Complex z_k = (1.0 + s_k) / (1.0 - s_k);

    if (std::abs(z_k.imag()) < 1e-12) {
      // Real pole: first-order section
      // H(z) = (1 + z⁻¹) / (1 - p z⁻¹) * gain
      double p = z_k.real();
      double gain = (1.0 - p) / 2.0;
      std::vector<double> b_sec = {gain, gain};
      std::vector<double> a_sec = {1.0, -p};
      b_total = poly_multiply(b_total, b_sec);
      a_total = poly_multiply(a_total, a_sec);
    } else if (z_k.imag() > 0) {
      // Complex conjugate pair: second-order section
      double re = z_k.real(), im = z_k.imag();
      double a1 = -2.0 * re;
      double a2 = re * re + im * im;
      double gain = (1.0 + a1 + a2) / 4.0;
      std::vector<double> b_sec = {gain, 2*gain, gain};
      std::vector<double> a_sec = {1.0, a1, a2};
      b_total = poly_multiply(b_total, b_sec);
      a_total = poly_multiply(a_total, a_sec);
    }
    // Skip conjugate (imag < 0) — already handled
  }

  VectorXd b_out(b_total.size()), a_out(a_total.size());
  for (size_t i = 0; i < b_total.size(); ++i) b_out(i) = b_total[i];
  for (size_t i = 0; i < a_total.size(); ++i) a_out(i) = a_total[i];

  val result = val::object();
  result.set("b", vector_to_js(b_out));
  result.set("a", vector_to_js(a_out));
  result.set("order", order);
  result.set("cutoff", cutoff);
  return result;
}

/**
 * Chebyshev Type I filter design (lowpass).
 * Returns {b, a} coefficient arrays.
 *
 * order: filter order (1..10)
 * cutoff: normalized cutoff frequency (0..1)
 * ripple_db: passband ripple in dB (e.g., 0.5, 1.0)
 */
val chebyshev_filter(int order, double cutoff, double ripple_db) {
  if (order < 1 || order > 10) throw std::invalid_argument("chebyshev_filter: order must be 1..10");
  if (cutoff <= 0 || cutoff >= 1) throw std::invalid_argument("chebyshev_filter: cutoff must be in (0,1)");
  if (ripple_db <= 0) throw std::invalid_argument("chebyshev_filter: ripple_db must be > 0");

  double eps = std::sqrt(std::pow(10.0, ripple_db / 10.0) - 1.0);
  double Wc = std::tan(M_PI * cutoff / 2.0);

  // Chebyshev poles: on an ellipse in the s-plane
  double v0 = std::asinh(1.0 / eps) / order;

  std::vector<double> b_total = {1.0};
  std::vector<double> a_total = {1.0};

  for (int k = 0; k < order; ++k) {
    double angle = M_PI * (2.0 * k + 1.0) / (2.0 * order);
    Complex s_k = Wc * Complex(-std::sinh(v0) * std::sin(angle),
                                 std::cosh(v0) * std::cos(angle));

    Complex z_k = (1.0 + s_k) / (1.0 - s_k);

    if (std::abs(z_k.imag()) < 1e-12) {
      double p = z_k.real();
      double gain = (1.0 - p) / 2.0;
      std::vector<double> b_sec = {gain, gain};
      std::vector<double> a_sec = {1.0, -p};
      b_total = poly_multiply(b_total, b_sec);
      a_total = poly_multiply(a_total, a_sec);
    } else if (z_k.imag() > 0) {
      double re = z_k.real(), im = z_k.imag();
      double a1 = -2.0 * re;
      double a2 = re * re + im * im;
      double gain = (1.0 + a1 + a2) / 4.0;
      std::vector<double> b_sec = {gain, 2*gain, gain};
      std::vector<double> a_sec = {1.0, a1, a2};
      b_total = poly_multiply(b_total, b_sec);
      a_total = poly_multiply(a_total, a_sec);
    }
  }

  VectorXd b_out(b_total.size()), a_out(a_total.size());
  for (size_t i = 0; i < b_total.size(); ++i) b_out(i) = b_total[i];
  for (size_t i = 0; i < a_total.size(); ++i) a_out(i) = a_total[i];

  val result = val::object();
  result.set("b", vector_to_js(b_out));
  result.set("a", vector_to_js(a_out));
  result.set("order", order);
  result.set("cutoff", cutoff);
  result.set("ripple_db", ripple_db);
  return result;
}

#endif // __EMSCRIPTEN__

} // namespace mathkernel

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(mathkernel_signal) {
  function("dft_magnitude", &mathkernel::dft_magnitude);
  function("hilbert_envelope", &mathkernel::hilbert_envelope);
  function("convolve", &mathkernel::convolve);
  function("butterworth", &mathkernel::butterworth);
  function("chebyshev_filter", &mathkernel::chebyshev_filter);
}
#endif
