# Research: Statistical Analysis & Anomaly Detection

```
Topic:          Statistical Analysis & Anomaly Detection
Platform:       Tsingou (SIGINT/OSINT analysis)
Author:         Val (data-fusion-mathematician)
Date:           2026-02-18
Status:         COMPLETE
Lines:          ~550
Sections:       11
Frameworks:     Z-score, EWMA, CUSUM, Grubbs, BOCPD, STL, Welch, KS, Cross-correlation
Purpose:        Raw research feeding RFC section TSG.27
```

---

## 1. Descriptive Statistics for Signal Streams

### 1.1 Running Statistics (Online Algorithms)

For streaming data, batch computation is infeasible. Online (incremental) algorithms update
statistics with each new observation in O(1) time and O(1) space.

**Welford's online algorithm for mean and variance** (numerically stable):

```
Initialize: n = 0, mean = 0, M2 = 0

Update(x):
  n += 1
  delta = x - mean
  mean += delta / n
  delta2 = x - mean
  M2 += delta * delta2

Variance:     M2 / n          (population)
              M2 / (n - 1)    (sample, Bessel correction)
Std Dev:      sqrt(Variance)
```

### 1.2 Higher-Order Moments

**Skewness** (asymmetry of distribution):
```
gamma_1 = E[(X - mu)^3] / sigma^3
         = (1/n) * sum_i (x_i - x_bar)^3 / s^3
```
- gamma_1 > 0: right-skewed (long right tail)
- gamma_1 < 0: left-skewed (long left tail)
- gamma_1 = 0: symmetric

**Kurtosis** (tail heaviness):
```
gamma_2 = E[(X - mu)^4] / sigma^4 - 3     (excess kurtosis)
```
- gamma_2 > 0: leptokurtic (heavier tails than Gaussian) — more extreme outliers
- gamma_2 < 0: platykurtic (lighter tails)
- gamma_2 = 0: mesokurtic (Gaussian)

Tsingou application: Signal streams from SIGINT sources often exhibit heavy tails (leptokurtic).
Positive kurtosis indicates a higher probability of extreme values — relevant for anomaly scoring.

### 1.3 Online Higher-Order Moments

Pebay (2008) extended Welford's algorithm to compute skewness and kurtosis incrementally.
The terracotta-parallel algorithm supports merging partial statistics from distributed nodes.

---

## 2. Z-Score Anomaly Detection

### 2.1 Standard Z-Score

```
z_i = (x_i - mu) / sigma
```

Decision rule: |z_i| > z_threshold => anomaly.

Common thresholds:
- z = 2: ~4.6% false positive (two-tailed)
- z = 3: ~0.27% false positive (three-sigma rule)
- z = 4: ~0.006% false positive

### 2.2 Modified Z-Score (Robust)

Uses median and MAD (Median Absolute Deviation) instead of mean and std dev:

```
M_i = 0.6745 * (x_i - median) / MAD
```

where MAD = median(|x_i - median(x)|) and 0.6745 is the 75th percentile of the standard normal.

Advantage: Resistant to masking (where outliers inflate sigma, hiding other outliers).

### 2.3 Sliding Window Z-Score

For non-stationary streams, compute mu and sigma over a sliding window of size W:

```
z_i = (x_i - mu_W) / sigma_W
```

where mu_W and sigma_W are the mean and std dev of the last W observations.

Tsingou mapping: d2ts `window(duration)` operator maintains the sliding window; `map` computes
the z-score for each incoming value.

---

## 3. EWMA (Exponentially Weighted Moving Average)

### 3.1 Recursion

```
S_t = lambda * x_t + (1 - lambda) * S_{t-1}
S_0 = mu_0 (target or initial mean)
```

Lambda (smoothing factor): 0 < lambda <= 1.
- lambda close to 0: heavy smoothing, slow response
- lambda close to 1: light smoothing, fast response

### 3.2 EWMA Control Chart

Control limits:

```
UCL = mu_0 + L * sigma * sqrt(lambda / (2 - lambda) * (1 - (1-lambda)^{2t}))
LCL = mu_0 - L * sigma * sqrt(lambda / (2 - lambda) * (1 - (1-lambda)^{2t}))
```

As t -> infinity, the asymptotic limits:

```
UCL = mu_0 + L * sigma * sqrt(lambda / (2 - lambda))
LCL = mu_0 - L * sigma * sqrt(lambda / (2 - lambda))
```

L is the width parameter (typically L = 3 for ARL_0 ~ 500).

### 3.3 Performance Characteristics

| Lambda | Optimal for detecting | ARL_0 (L=3) |
|--------|----------------------|-------------|
| 0.05 | 0.25-0.5 sigma shifts | ~500 |
| 0.10 | 0.5-1.0 sigma shifts | ~500 |
| 0.20 | 1.0-1.5 sigma shifts | ~500 |
| 0.40 | 1.5-2.0 sigma shifts | ~500 |

EWMA with lambda=0.05-0.1 detects small persistent shifts faster than Shewhart charts.

### 3.4 Tsingou Application

EWMA applied to signal rate (messages/second) from each source adapter. A slow drift in rate
indicates changing source behavior (e.g., sensor degradation, network throttling).

---

## 4. CUSUM (Cumulative Sum Control Chart)

### 4.1 Tabular CUSUM

Two-sided CUSUM with reference value k and decision interval h:

```
C_upper(t) = max(0, C_upper(t-1) + (x_t - mu_0) - k)
C_lower(t) = min(0, C_lower(t-1) + (x_t - mu_0) + k)

Signal if: C_upper(t) > h  OR  C_lower(t) < -h
```

Parameters:
- k (allowance/slack): typically k = delta/2 where delta is the minimum shift to detect
- h (decision interval): set for desired ARL_0 (e.g., h = 4*sigma for ARL_0 ~ 200)

### 4.2 Page's CUSUM

Sequential test statistic for detecting mean shift from mu_0 to mu_1:

```
S_t = max(0, S_{t-1} + (x_t - mu_0 - k))

Signal if: S_t > h
```

Runtime complexity: O(n) single pass.

### 4.3 Comparison with EWMA

| Property | CUSUM | EWMA |
|----------|-------|------|
| Optimal for | Small sustained shifts | Small sustained shifts |
| Memory | Accumulates evidence | Exponential weighting |
| Reset | Resets to 0 after signal | Continuous |
| Tuning | k, h | lambda, L |
| Diagnostic | Change point locatable | Trend visible |

### 4.4 Tsingou Application

CUSUM on signal metadata fields (e.g., response latency from HTTP APIs). Change-point detection
identifies when a source's behavior regime shifts — indicative of infrastructure changes or
adversary adaptation.

---

## 5. Grubbs Test for Outlier Detection

### 5.1 Test Statistic

```
G = max_i |x_i - x_bar| / s
```

where x_bar is the sample mean and s is the sample standard deviation.

### 5.2 Critical Value

```
G_crit = (n - 1) / sqrt(n) * sqrt(t^2_{alpha/(2n), n-2} / (n - 2 + t^2_{alpha/(2n), n-2}))
```

where t is the critical value from Student's t-distribution.

Decision: G > G_crit => outlier detected.

### 5.3 Generalized ESD (Rosner, 1983)

Extends Grubbs to detect up to R outliers by iteratively removing the most extreme value
and recomputing.

### 5.4 Tsingou Application

Applied to batch windows of signal features (e.g., packet sizes, timing intervals). Identifies
individual observations that are extreme relative to the window — potential injection attacks
or sensor malfunctions.

---

## 6. Bayesian Change-Point Detection

### 6.1 Adams-MacKay BOCPD (2007)

Online algorithm that computes the posterior distribution over the current run length r_t
(time since last change point):

```
P(r_t | x_{1:t}) proportional to sum_{r_{t-1}} P(r_t | r_{t-1}) * P(x_t | r_{t-1}, x_{t}^{(r)}) * P(r_{t-1} | x_{1:t-1})
```

Key components:
- **Hazard function** H(tau): Prior probability of a change point at each step. Constant hazard
  H = 1/lambda gives geometric prior on run lengths.
- **Run length posterior**: P(r_t | x_{1:t}) — distribution over how long current regime has lasted.
- **Predictive distribution**: P(x_t | r_{t-1}, x) — likelihood of observation given current regime.

### 6.2 Offline Bayesian Change-Point

Uses reversible-jump MCMC or dynamic programming to find optimal segmentation of the
complete time series.

### 6.3 Tsingou Application

BOCPD applied to multi-variate signal streams. Unlike CUSUM (which detects mean shifts),
BOCPD can detect changes in variance, distribution shape, or any sufficient statistic.
Particularly suited for detecting behavioral regime changes in threat actor activity patterns.

---

## 7. Time Series Decomposition

### 7.1 Classical Decomposition

Additive: Y_t = T_t + S_t + R_t
Multiplicative: Y_t = T_t * S_t * R_t

where T = trend, S = seasonal, R = residual.

### 7.2 STL Decomposition (Cleveland et al., 1990)

Seasonal-Trend decomposition using LOESS. Two nested loops:
- Inner loop: Iterates between detrending (to find seasonal) and deseasonalizing (to find trend)
- Outer loop: Robustness weights to down-weight outliers

Parameters:
- n_p: Period of seasonal component
- n_s: LOESS window for seasonal extraction (must be odd, >= 7)
- n_t: LOESS window for trend extraction (must be odd)

Advantages: Handles any seasonality period, seasonal component can change over time,
robust to outliers.

### 7.3 Tsingou Application

STL decomposition on signal volume time series. The residual component (after removing trend
and seasonality) is the anomaly signal — unexpected deviations from the expected pattern.
d2ts `iterate` operator can implement the LOESS inner loop incrementally.

---

## 8. Spectral Density Estimation

### 8.1 Periodogram

Direct estimate of power spectral density:

```
I(f) = (1/N) * |sum_{t=0}^{N-1} x_t * exp(-2*pi*i*f*t)|^2
```

High variance (inconsistent estimator). Variance does not decrease with N.

### 8.2 Welch's Method

1. Divide signal into K overlapping segments of length L with overlap D
2. Apply window function w(t) to each segment
3. Compute periodogram for each windowed segment
4. Average K periodograms

```
P_welch(f) = (1/K) * sum_{k=1}^{K} I_k(f)
```

Variance reduced by factor ~1/K. Frequency resolution = 1/L (trade-off with variance).

### 8.3 Cross-Reference to TSG.25

Welch's method and window functions are covered in detail in TSG.25 (DSP Foundations).
This section focuses on the statistical interpretation: spectral density as the Fourier
transform of the autocovariance function (Wiener-Khinchin theorem).

---

## 9. Non-Parametric Tests

### 9.1 Kolmogorov-Smirnov (KS) Test

Two-sample test statistic:

```
D = sup_x |F_1(x) - F_2(x)|
```

where F_1, F_2 are the empirical CDFs. Sensitive to any distributional difference (location,
scale, shape).

### 9.2 Mann-Whitney U Test

Rank-based test for location shift. Test statistic:

```
U = sum of ranks of sample 1 - n_1*(n_1+1)/2
```

Sensitive primarily to median differences (not shape or scale).

### 9.3 Tsingou Application

KS test: Compare the distribution of a signal feature in the current window against a
baseline window. Significant D indicates the source's statistical character has changed.

Mann-Whitney: Compare signal levels before and after a suspected change point (detected by
CUSUM or BOCPD) to confirm the shift is statistically significant.

---

## 10. Correlation Analysis

### 10.1 Pearson Correlation

```
r_{xy} = cov(X, Y) / (sigma_X * sigma_Y)
       = sum_i (x_i - x_bar)(y_i - y_bar) / sqrt(sum_i (x_i - x_bar)^2 * sum_i (y_i - y_bar)^2)
```

Measures linear relationship. Range: [-1, 1].

### 10.2 Spearman Rank Correlation

```
rho = 1 - 6 * sum_i d_i^2 / (n * (n^2 - 1))
```

where d_i = rank(x_i) - rank(y_i). Measures monotonic relationship. Robust to outliers.

### 10.3 Cross-Correlation Function (CCF)

```
R_{xy}(tau) = E[X(t) * Y(t + tau)]

Normalized: rho_{xy}(tau) = R_{xy}(tau) / sqrt(R_{xx}(0) * R_{yy}(0))
```

Peak of |rho_{xy}(tau)| at tau = tau_0 indicates Y lags X by tau_0 time units.

### 10.4 Autocorrelation Function (ACF)

```
rho_{xx}(tau) = R_{xx}(tau) / R_{xx}(0)
```

Detects periodicity (peaks at multiples of period) and persistence (slow decay).

### 10.5 Tsingou Application

Cross-correlation between signal streams from different source adapters. Significant
correlation at lag tau indicates one source's signals predict another's with delay tau —
evidence of causal relationship or shared upstream cause. Feeds into JDL Level 2 situation
assessment [TSG.4, Section 1.1].

---

## 11. Sources and Citations

- [WELFORD-1962] B. P. Welford. "Note on a Method for Calculating Corrected Sums of Squares and Products." Technometrics, 4(3):419-420, 1962.
- [PEBAY-2008] P. Pebay. "Formulas for Robust, One-Pass Parallel Computation of Covariances and Arbitrary-Order Statistical Moments." Sandia National Laboratories, 2008.
- [PAGE-1954] E. S. Page. "Continuous Inspection Schemes." Biometrika, 41(1/2):100-115, 1954.
- [ROBERTS-1959] S. W. Roberts. "Control Chart Tests Based on Geometric Moving Averages." Technometrics, 1(3):239-250, 1959.
- [GRUBBS-1950] F. E. Grubbs. "Sample Criteria for Testing Outlying Observations." Annals of Mathematical Statistics, 21(1):27-58, 1950.
- [ROSNER-1983] B. Rosner. "Percentage Points for a Generalized ESD Many-Outlier Procedure." Technometrics, 25(2):165-172, 1983.
- [ADAMS-MACKAY-2007] R. P. Adams, D. J. C. MacKay. "Bayesian Online Changepoint Detection." arXiv:0710.3742, 2007.
- [CLEVELAND-1990] R. B. Cleveland, W. S. Cleveland, J. E. McRae, I. Terpenning. "STL: A Seasonal-Trend Decomposition Procedure Based on Loess." Journal of Official Statistics, 6(1):3-73, 1990.
- [WELCH-1967] P. D. Welch. "The Use of Fast Fourier Transform for the Estimation of Power Spectra." IEEE Trans. Audio and Electroacoustics, 15(2):70-73, 1967.
- [KOLMOGOROV-1933] A. N. Kolmogorov. "Sulla determinazione empirica di una legge di distribuzione." Giornale dell'Istituto Italiano degli Attuari, 4:83-91, 1933.
- [MANN-WHITNEY-1947] H. B. Mann, D. R. Whitney. "On a Test of Whether One of Two Random Variables is Stochastically Larger than the Other." Annals of Mathematical Statistics, 18(1):50-60, 1947.
- [PEARSON-1895] K. Pearson. "Notes on Regression and Inheritance in the Case of Two Parents." Proceedings of the Royal Society, 58:240-242, 1895.
- [SPEARMAN-1904] C. Spearman. "The Proof and Measurement of Association between Two Things." American Journal of Psychology, 15(1):72-101, 1904.
