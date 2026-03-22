/**
 * @tmnl/mathkernel — WASM Bridge
 *
 * Typed JS wrapper over the Embind-generated module.
 * Provides:
 *   1. Module loading with Effect lifecycle
 *   2. Typed function accessors grouped by domain
 *   3. Float64Array marshalling helpers
 */

// Re-export the auto-generated types
export type { MainModule } from '../../dist/mathkernel';
import type { MainModule } from '../../dist/mathkernel';

// ── Module Loader ───────────────────────────────────────────────────────────

let _module: MainModule | null = null;
let _loading: Promise<MainModule> | null = null;

/**
 * Load and cache the WASM module. Safe to call multiple times.
 */
export async function loadMathKernel(): Promise<MainModule> {
  if (_module) return _module;
  if (_loading) return _loading;

  _loading = (async () => {
    const factory = (await import('../../dist/mathkernel')).default;
    _module = await factory();
    return _module;
  })();

  return _loading;
}

/** Get the already-loaded module (throws if not loaded). */
export function getMathKernel(): MainModule {
  if (!_module) throw new Error('MathKernel WASM not loaded. Call loadMathKernel() first.');
  return _module;
}

/** Check if WASM is loaded. */
export function isMathKernelLoaded(): boolean {
  return _module !== null;
}

// ── Marshalling ─────────────────────────────────────────────────────────────

/** Convert number[] to Float64Array for WASM. */
export function toF64(arr: number[]): Float64Array {
  return new Float64Array(arr);
}

/** Convert Float64Array back to number[]. */
export function fromF64(arr: Float64Array): number[] {
  return Array.from(arr);
}

/** Flatten a 2D array row-major for matrix operations. */
export function flattenMatrix(matrix: number[][]): { data: Float64Array; rows: number; cols: number } {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const data = new Float64Array(rows * cols);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      data[i * cols + j] = matrix[i][j];
  return { data, rows, cols };
}

/** Unflatten a row-major Float64Array back to 2D. */
export function unflattenMatrix(data: Float64Array, rows: number, cols: number): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) row.push(data[i * cols + j]);
    result.push(row);
  }
  return result;
}

// ── Domain Accessors ────────────────────────────────────────────────────────
// Grouped by domain for ergonomic consumption.

/** All 100 function names exported from the WASM module. */
export const WASM_FUNCTIONS = [
  // Linear Algebra (8)
  'mmult', 'solve', 'inverse', 'det', 'transpose', 'trace', 'norm', 'rank',
  // Decompositions (5)
  'svd', 'qr', 'cholesky', 'eigen', 'pca',
  // Regression (3)
  'ols', 'ridge', 'lasso',
  // Regression Diagnostics (6)
  'logit_fit', 'probit_fit', 'leverage', 'cooks_distance', 'durbin_watson', 'standardized_residuals',
  // Time Series (6)
  'exp_smooth', 'double_exp_smooth', 'holt_winters', 'seasonal_avg', 'detrend', 'arima_forecast',
  // Signal Processing (5)
  'dft_magnitude', 'hilbert_envelope', 'convolve', 'butterworth', 'chebyshev_filter',
  // Robust Statistics (8)
  'bootstrap', 'jackknife', 'shapiro_wilk', 'ks_test', 'anderson_darling',
  'autocorrelation', 'crosscorrelation', 'mahalanobis',
  // Vectorized — Norms (4)
  'l1_norm', 'l2_norm', 'linf_norm', 'lp_norm',
  // Vectorized — Similarity (3)
  'cosine_similarity', 'jaccard_index', 'pearson_corr',
  // Vectorized — Info Theory (5)
  'entropy', 'cross_entropy', 'kl_divergence', 'js_divergence', 'mutual_info',
  // Vectorized — Rolling (10)
  'rolling_mean', 'rolling_sum', 'rolling_std', 'rolling_var', 'rolling_min',
  'rolling_max', 'rolling_median', 'rolling_zscore', 'ewma', 'rolling_corr',
  // Vectorized — Windows (6)
  'hann_window', 'hamming_window', 'blackman_window', 'bartlett_window', 'kaiser_window', 'flat_top_window',
  // Vectorized — Transforms (5)
  'softmax', 'log_softmax', 'normalize_vec', 'standardize_vec', 'cumsum',
  // Numerical Methods (12)
  'newton_raphson', 'bisect', 'secant', 'brentq',
  'trapezoid', 'simpson', 'romberg', 'gauss_legendre',
  'taylor_exp', 'taylor_sin', 'taylor_cos', 'golden_section_min',
  // Special Functions (14)
  'bessel_j0', 'bessel_j1', 'bessel_jn',
  'dawson', 'fresnel_s', 'fresnel_c', 'sinc',
  'elliptic_k', 'elliptic_e',
  'gamma_fn', 'digamma', 'beta_fn', 'erf_fn', 'erfc_fn',
] as const;

export type WasmFunctionName = typeof WASM_FUNCTIONS[number];

/**
 * Map from FUNC_MAP opcode names (uppercase) to WASM function names.
 * Used by the VM bridge to dispatch WASM-accelerated operations.
 */
export const OPCODE_TO_WASM: Record<string, WasmFunctionName> = {
  // Direct mappings (opcode → wasm fn)
  'MDETERM': 'det',
  'MINVERSE': 'inverse',
  'MMULT': 'mmult',
  'BESSEL_J0': 'bessel_j0',
  'BESSEL_J1': 'bessel_j1',
  'BESSEL_JN': 'bessel_jn',
  'BESSELJ': 'bessel_j0',
  'DAWSON': 'dawson',
  'FRESNEL_S': 'fresnel_s',
  'FRESNEL_C': 'fresnel_c',
  'SINC': 'sinc',
  'ELLIPK': 'elliptic_k',
  'ELLIPE': 'elliptic_e',
  'GAMMA': 'gamma_fn',
  'DIGAMMA': 'digamma',
  'BETAFN': 'beta_fn',
  'ERF': 'erf_fn',
  'ERFC': 'erfc_fn',
  'ENTROPY': 'entropy',
  'COSINE_SIMILARITY': 'cosine_similarity',
  'PEARSON_CORR': 'pearson_corr',
  'KL_DIVERGENCE': 'kl_divergence',
  'SOFTMAX': 'softmax',
  'LOG_SOFTMAX': 'log_softmax',
  'CUMSUM': 'cumsum',
  'DETREND': 'detrend',
  'EXP_SMOOTH': 'exp_smooth',
  'HOLT_WINTERS': 'holt_winters',
  'ARIMA': 'arima_forecast',
  'DFT': 'dft_magnitude',
  'HILBERT': 'hilbert_envelope',
  'CONVOLVE': 'convolve',
  'BUTTERWORTH': 'butterworth',
  'CHEBYSHEV_FILTER': 'chebyshev_filter',
  'BOOTSTRAP': 'bootstrap',
  'JACKKNIFE': 'jackknife',
  'SHAPIRO_WILK': 'shapiro_wilk',
  'KS_TEST': 'ks_test',
  'ANDERSON_DARLING': 'anderson_darling',
  'AUTOCORRELATION': 'autocorrelation',
  'CROSSCORRELATION': 'crosscorrelation',
  'MAHALANOBIS': 'mahalanobis',
  'OLS': 'ols',
  'RIDGE': 'ridge',
  'LASSO': 'lasso',
  'LOGIT': 'logit_fit',
  'PROBIT': 'probit_fit',
  'COOKS_D': 'cooks_distance',
  'DURBIN_WATSON': 'durbin_watson',
  'LEVERAGE': 'leverage',
  'SVD': 'svd',
  'QR': 'qr',
  'CHOLESKY': 'cholesky',
  'EIGEN_DECOMP': 'eigen',
  'PCA': 'pca',
  'L1_NORM': 'l1_norm',
  'L2_NORM': 'l2_norm',
  'LINF_NORM': 'linf_norm',
  'LP_NORM': 'lp_norm',
  'ROLLING_MEAN': 'rolling_mean',
  'ROLLING_STD': 'rolling_std',
  'ROLLING_MIN': 'rolling_min',
  'ROLLING_MAX': 'rolling_max',
  'ROLLING_MEDIAN': 'rolling_median',
  'EWMA': 'ewma',
  'NEWTON_RAPHSON': 'newton_raphson',
  'BISECT': 'bisect',
  'TRAPEZOID': 'trapezoid',
  'SIMPSON': 'simpson',
  'GOLDEN_SECTION': 'golden_section_min',
  'HANN_WINDOW': 'hann_window',
  'HAMMING_WINDOW': 'hamming_window',
  'BLACKMAN_WINDOW': 'blackman_window',
};
