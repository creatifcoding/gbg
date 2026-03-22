/**
 * @tmnl/mathkernel — Time Series Kernels
 *
 * C++20 / Eigen. Shared primitives via common.hpp.
 * Kernels: exp_smooth, double_exp_smooth, holt_winters,
 *          seasonal_avg, detrend, arima_forecast
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

namespace mathkernel {

#ifdef __EMSCRIPTEN__

/**
 * Simple Exponential Smoothing: s_t = α y_t + (1-α) s_{t-1}
 * Returns {smoothed, alpha}.
 */
val exp_smooth(const val& data_arr, double alpha) {
  auto y = js_to_vector(data_arr);
  int n = y.size();
  if (n < 1) throw std::invalid_argument("exp_smooth: empty data");
  if (alpha < 0 || alpha > 1) throw std::invalid_argument("exp_smooth: alpha must be in [0,1]");

  VectorXd s(n);
  s(0) = y(0);
  for (int t = 1; t < n; ++t) {
    s(t) = alpha * y(t) + (1.0 - alpha) * s(t - 1);
  }

  val result = val::object();
  result.set("smoothed", vector_to_js(s));
  result.set("alpha", alpha);
  return result;
}

/**
 * Double Exponential Smoothing (Holt's linear method).
 * Level: l_t = α y_t + (1-α)(l_{t-1} + b_{t-1})
 * Trend: b_t = β (l_t - l_{t-1}) + (1-β) b_{t-1}
 * Forecast: f_{t+h} = l_t + h b_t
 * Returns {smoothed, level, trend, forecast}.
 */
val double_exp_smooth(const val& data_arr, double alpha, double beta, int horizon) {
  auto y = js_to_vector(data_arr);
  int n = y.size();
  if (n < 2) throw std::invalid_argument("double_exp_smooth: need at least 2 data points");

  VectorXd level(n), trend(n), smoothed(n);

  // Initialize
  level(0) = y(0);
  trend(0) = y(1) - y(0);
  smoothed(0) = level(0);

  for (int t = 1; t < n; ++t) {
    level(t) = alpha * y(t) + (1.0 - alpha) * (level(t-1) + trend(t-1));
    trend(t) = beta * (level(t) - level(t-1)) + (1.0 - beta) * trend(t-1);
    smoothed(t) = level(t);
  }

  // Forecast
  VectorXd forecast(horizon);
  for (int h = 0; h < horizon; ++h) {
    forecast(h) = level(n-1) + (h + 1) * trend(n-1);
  }

  val result = val::object();
  result.set("smoothed", vector_to_js(smoothed));
  result.set("level", vector_to_js(level));
  result.set("trend", vector_to_js(trend));
  result.set("forecast", vector_to_js(forecast));
  return result;
}

/**
 * Holt-Winters triple exponential smoothing (additive seasonality).
 * Level:  l_t = α(y_t - s_{t-m}) + (1-α)(l_{t-1} + b_{t-1})
 * Trend:  b_t = β(l_t - l_{t-1}) + (1-β)b_{t-1}
 * Season: s_t = γ(y_t - l_{t-1} - b_{t-1}) + (1-γ)s_{t-m}
 * Returns {smoothed, level, trend, seasonal, forecast}.
 */
val holt_winters(const val& data_arr, double alpha, double beta, double gamma,
                 int season_length, int horizon) {
  auto y = js_to_vector(data_arr);
  int n = y.size();
  int m = season_length;
  if (n < 2 * m) throw std::invalid_argument("holt_winters: need at least 2 full seasons");
  if (m < 2) throw std::invalid_argument("holt_winters: season_length must be >= 2");

  VectorXd level(n), trend_v(n), seasonal(n), smoothed(n);

  // Initialize: first season average for level, trend from first two seasons
  double first_season_avg = 0.0;
  for (int i = 0; i < m; ++i) first_season_avg += y(i);
  first_season_avg /= m;

  double second_season_avg = 0.0;
  for (int i = m; i < 2 * m; ++i) second_season_avg += y(i);
  second_season_avg /= m;

  level(0) = first_season_avg;
  trend_v(0) = (second_season_avg - first_season_avg) / m;

  // Initial seasonal indices
  for (int i = 0; i < m; ++i) {
    seasonal(i) = y(i) - first_season_avg;
  }

  smoothed(0) = level(0) + seasonal(0);

  for (int t = 1; t < n; ++t) {
    int s_idx = (t >= m) ? t - m : t; // seasonal lookback
    double prev_seasonal = seasonal(s_idx);

    level(t) = alpha * (y(t) - prev_seasonal) + (1.0 - alpha) * (level(t-1) + trend_v(t-1));
    trend_v(t) = beta * (level(t) - level(t-1)) + (1.0 - beta) * trend_v(t-1);
    seasonal(t) = gamma * (y(t) - level(t-1) - trend_v(t-1)) + (1.0 - gamma) * prev_seasonal;
    smoothed(t) = level(t) + seasonal(t);
  }

  // Forecast
  VectorXd forecast(horizon);
  for (int h = 0; h < horizon; ++h) {
    int s_idx = n - m + (h % m);
    forecast(h) = level(n-1) + (h + 1) * trend_v(n-1) + seasonal(s_idx);
  }

  val result = val::object();
  result.set("smoothed", vector_to_js(smoothed));
  result.set("level", vector_to_js(level));
  result.set("trend", vector_to_js(trend_v));
  result.set("seasonal", vector_to_js(seasonal));
  result.set("forecast", vector_to_js(forecast));
  return result;
}

/**
 * Seasonal average: average by season position.
 * Returns Float64Array of length season_length.
 */
val seasonal_avg(const val& data_arr, int season_length) {
  auto y = js_to_vector(data_arr);
  int n = y.size();
  int m = season_length;
  if (m < 1 || m > n) throw std::invalid_argument("seasonal_avg: invalid season_length");

  VectorXd avgs = VectorXd::Zero(m);
  VectorXd counts = VectorXd::Zero(m);

  for (int t = 0; t < n; ++t) {
    avgs(t % m) += y(t);
    counts(t % m) += 1.0;
  }
  avgs = avgs.array() / counts.array();

  return vector_to_js(avgs);
}

/**
 * Detrend: remove linear trend via OLS on time index.
 * Returns {detrended, slope, intercept}.
 */
val detrend(const val& data_arr) {
  auto y = js_to_vector(data_arr);
  int n = y.size();
  if (n < 2) throw std::invalid_argument("detrend: need at least 2 data points");

  // OLS: y = a + b*t
  double t_mean = (n - 1.0) / 2.0;
  double y_mean = compute_mean(y);

  double num = 0.0, den = 0.0;
  for (int t = 0; t < n; ++t) {
    num += (t - t_mean) * (y(t) - y_mean);
    den += (t - t_mean) * (t - t_mean);
  }
  double slope = num / den;
  double intercept = y_mean - slope * t_mean;

  VectorXd detrended(n);
  for (int t = 0; t < n; ++t) {
    detrended(t) = y(t) - (intercept + slope * t);
  }

  val result = val::object();
  result.set("detrended", vector_to_js(detrended));
  result.set("slope", slope);
  result.set("intercept", intercept);
  return result;
}

/**
 * ARIMA(p,d,q) forecast.
 * Differencing d times, then AR(p) via Yule-Walker.
 * MA(q) via innovations algorithm (simplified: CSS).
 * Returns {forecast, ar_coefficients, differenced}.
 */
val arima_forecast(const val& data_arr, int p, int d, int q, int horizon) {
  auto y = js_to_vector(data_arr);
  int n = y.size();

  // 1. Differencing
  VectorXd z = y;
  for (int dd = 0; dd < d; ++dd) {
    VectorXd z_new(z.size() - 1);
    for (int i = 0; i < z_new.size(); ++i) {
      z_new(i) = z(i + 1) - z(i);
    }
    z = z_new;
  }
  int nz = z.size();
  if (nz < p + q + 1) throw std::invalid_argument("arima: not enough data after differencing");

  double z_mean = compute_mean(z);
  VectorXd zc = z.array() - z_mean;

  // 2. AR coefficients via Yule-Walker if p > 0
  VectorXd phi = VectorXd::Zero(std::max(p, 1));
  if (p > 0) {
    // Autocorrelation
    VectorXd r(p + 1);
    for (int k = 0; k <= p; ++k) {
      double sum = 0.0;
      for (int t = k; t < nz; ++t) sum += zc(t) * zc(t - k);
      r(k) = sum / nz;
    }

    // Toeplitz system: R φ = r
    MatrixXd R(p, p);
    VectorXd rhs(p);
    for (int i = 0; i < p; ++i) {
      rhs(i) = r(i + 1);
      for (int j = 0; j < p; ++j) {
        R(i, j) = r(std::abs(i - j));
      }
    }
    phi = R.ldlt().solve(rhs);
  }

  // 3. Compute residuals for MA estimation
  VectorXd resid = VectorXd::Zero(nz);
  for (int t = p; t < nz; ++t) {
    double pred = z_mean;
    for (int i = 0; i < p; ++i) {
      pred += phi(i) * (z(t - 1 - i) - z_mean);
    }
    resid(t) = z(t) - pred;
  }

  // 4. MA coefficients via simple correlation of residuals (if q > 0)
  VectorXd theta = VectorXd::Zero(std::max(q, 1));
  if (q > 0) {
    double var_e = resid.tail(nz - p).squaredNorm() / (nz - p);
    for (int k = 1; k <= q; ++k) {
      double sum = 0.0;
      for (int t = p + k; t < nz; ++t) {
        sum += resid(t) * resid(t - k);
      }
      theta(k - 1) = (var_e > 1e-15) ? sum / ((nz - p - k) * var_e) : 0.0;
    }
  }

  // 5. Forecast on differenced series
  VectorXd forecast_diff(horizon);
  // Extend z and resid arrays for forecasting
  std::vector<double> z_ext(z.data(), z.data() + nz);
  std::vector<double> e_ext(resid.data(), resid.data() + nz);

  for (int h = 0; h < horizon; ++h) {
    double pred = z_mean;
    int t = nz + h;
    for (int i = 0; i < p; ++i) {
      int idx = t - 1 - i;
      pred += phi(i) * ((idx < static_cast<int>(z_ext.size()) ? z_ext[idx] : z_mean) - z_mean);
    }
    for (int j = 0; j < q; ++j) {
      int idx = t - 1 - j;
      pred += theta(j) * (idx < static_cast<int>(e_ext.size()) ? e_ext[idx] : 0.0);
    }
    forecast_diff(h) = pred;
    z_ext.push_back(pred);
    e_ext.push_back(0.0); // future errors assumed 0
  }

  // 6. Integrate back (reverse differencing)
  VectorXd forecast_level = forecast_diff;
  for (int dd = 0; dd < d; ++dd) {
    double last_val = y(n - 1 - dd); // crude: use last observed value
    VectorXd integrated(forecast_level.size());
    for (int h = 0; h < forecast_level.size(); ++h) {
      integrated(h) = last_val + forecast_level(h);
      last_val = integrated(h);
    }
    forecast_level = integrated;
  }

  val result = val::object();
  result.set("forecast", vector_to_js(forecast_level));
  result.set("ar_coefficients", vector_to_js(phi.head(p)));
  if (q > 0) result.set("ma_coefficients", vector_to_js(theta.head(q)));
  result.set("differenced", vector_to_js(z));
  return result;
}

#endif // __EMSCRIPTEN__

} // namespace mathkernel

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(mathkernel_timeseries) {
  function("exp_smooth", &mathkernel::exp_smooth);
  function("double_exp_smooth", &mathkernel::double_exp_smooth);
  function("holt_winters", &mathkernel::holt_winters);
  function("seasonal_avg", &mathkernel::seasonal_avg);
  function("detrend", &mathkernel::detrend);
  function("arima_forecast", &mathkernel::arima_forecast);
}
#endif
