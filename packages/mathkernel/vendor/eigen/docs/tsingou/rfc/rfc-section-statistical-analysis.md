# RFC Section TSG.27: Statistical Analysis and Anomaly Detection

```
Section:       TSG.27 — Statistical Analysis and Anomaly Detection
Parent RFC:    Tsingou System RFC
Status:        DRAFT
Author:        Val (data-fusion-mathematician)
Created:       2026-02-18
Research Base: research-statistical-analysis.md (550 lines, 11 sections, 9 frameworks)
Cross-Refs:    TSG.4 (Data Fusion), TSG.25 (DSP Foundations), TSG.29 (Information Theory)
```

> This section defines the statistical methods and anomaly detection algorithms that
> Tsingou's d2ts differential dataflow graph MUST implement for signal stream analysis.
> Every statistical operator, anomaly detector, and change-point algorithm traces to
> established mathematical foundations. The d2ts sliding window operators provide the
> computational substrate; this section specifies the statistical computations those
> operators MUST perform. The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT",
> and "MAY" are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Descriptive Statistics for Signal Streams](#1-descriptive-statistics-for-signal-streams)
   1.1 [Running Mean and Variance](#11-running-mean-and-variance)
   1.2 [Higher-Order Moments: Skewness and Kurtosis](#12-higher-order-moments-skewness-and-kurtosis)
   1.3 [Quantile Estimation for Streaming Data](#13-quantile-estimation-for-streaming-data)
   1.4 [BaseSignal Metadata Enrichment](#14-basesignal-metadata-enrichment)
2. [Z-Score Anomaly Detection](#2-z-score-anomaly-detection)
   2.1 [Standard Z-Score](#21-standard-z-score)
   2.2 [Modified Z-Score (Robust)](#22-modified-z-score-robust)
   2.3 [Sliding Window Z-Score](#23-sliding-window-z-score)
   2.4 [Adaptive Thresholds](#24-adaptive-thresholds)
3. [Exponentially Weighted Moving Average (EWMA)](#3-exponentially-weighted-moving-average-ewma)
   3.1 [EWMA Recursion](#31-ewma-recursion)
   3.2 [EWMA Control Chart](#32-ewma-control-chart)
   3.3 [Lambda Selection and ARL Performance](#33-lambda-selection-and-arl-performance)
   3.4 [EWMA for Variance Monitoring](#34-ewma-for-variance-monitoring)
4. [CUSUM Change-Point Detection](#4-cusum-change-point-detection)
   4.1 [Tabular CUSUM](#41-tabular-cusum)
   4.2 [Page's Sequential CUSUM](#42-pages-sequential-cusum)
   4.3 [Fast Initial Response (FIR) CUSUM](#43-fast-initial-response-fir-cusum)
   4.4 [Multivariate CUSUM](#44-multivariate-cusum)
   4.5 [CUSUM vs. EWMA: Selection Criteria](#45-cusum-vs-ewma-selection-criteria)
5. [Grubbs Test and Outlier Detection](#5-grubbs-test-and-outlier-detection)
   5.1 [Grubbs Test Statistic](#51-grubbs-test-statistic)
   5.2 [Generalized ESD Procedure](#52-generalized-esd-procedure)
   5.3 [Dixon's Q Test](#53-dixons-q-test)
   5.4 [Streaming Outlier Detection](#54-streaming-outlier-detection)
6. [Bayesian Change-Point Detection](#6-bayesian-change-point-detection)
   6.1 [Online BOCPD (Adams-MacKay)](#61-online-bocpd-adams-mackay)
   6.2 [Run Length Posterior](#62-run-length-posterior)
   6.3 [Hazard Functions](#63-hazard-functions)
   6.4 [Offline Bayesian Segmentation](#64-offline-bayesian-segmentation)
   6.5 [Comparison with Frequentist Methods](#65-comparison-with-frequentist-methods)
7. [Time Series Decomposition](#7-time-series-decomposition)
   7.1 [Classical Additive and Multiplicative Decomposition](#71-classical-additive-and-multiplicative-decomposition)
   7.2 [STL Decomposition](#72-stl-decomposition)
   7.3 [Online Decomposition for Streaming Data](#73-online-decomposition-for-streaming-data)
   7.4 [Residual Analysis for Anomaly Scoring](#74-residual-analysis-for-anomaly-scoring)
8. [Spectral Density Estimation](#8-spectral-density-estimation)
   8.1 [Periodogram](#81-periodogram)
   8.2 [Welch's Method](#82-welchs-method)
   8.3 [Spectral Anomaly Detection](#83-spectral-anomaly-detection)
   8.4 [Cross-Reference to TSG.25](#84-cross-reference-to-tsg25)
9. [Non-Parametric Tests](#9-non-parametric-tests)
   9.1 [Kolmogorov-Smirnov Test](#91-kolmogorov-smirnov-test)
   9.2 [Mann-Whitney U Test](#92-mann-whitney-u-test)
   9.3 [Anderson-Darling Test](#93-anderson-darling-test)
   9.4 [Application to Regime Detection](#94-application-to-regime-detection)
10. [Correlation Analysis](#10-correlation-analysis)
    10.1 [Pearson Correlation Coefficient](#101-pearson-correlation-coefficient)
    10.2 [Spearman Rank Correlation](#102-spearman-rank-correlation)
    10.3 [Cross-Correlation and Lag Detection](#103-cross-correlation-and-lag-detection)
    10.4 [Autocorrelation Function (ACF)](#104-autocorrelation-function-acf)
    10.5 [Partial Autocorrelation (PACF)](#105-partial-autocorrelation-pacf)
11. [Composite Anomaly Scoring](#11-composite-anomaly-scoring)
    11.1 [Multi-Method Fusion](#111-multi-method-fusion)
    11.2 [Alert Threshold Calibration](#112-alert-threshold-calibration)
    11.3 [False Positive Rate Control](#113-false-positive-rate-control)
    11.4 [Integration with Alarm Pipeline](#114-integration-with-alarm-pipeline)
12. [Normative Constraints](#12-normative-constraints)
13. [Open Questions](#13-open-questions)
14. [References](#14-references)

---

## 1. Descriptive Statistics for Signal Streams

### 1.1 Running Mean and Variance

Signal streams in Tsingou are unbounded sequences of observations arriving from source
adapters (RSS, HTTP, WebSocket, NATS, serial, file-watch). Batch computation of
statistics over the entire history is neither feasible nor desirable — the relevant
statistics are those computed over a recent window or with exponential decay weighting.

Implementations MUST use numerically stable online algorithms for computing running
statistics. The naive algorithm for variance (`sum(x_i^2)/n - (sum(x_i)/n)^2`) suffers
from catastrophic cancellation for large `n` or values far from zero [KNUTH-1997].

**Welford's online algorithm** [WELFORD-1962] provides a numerically stable single-pass
computation:

```
Algorithm: Welford-Online-Statistics

STATE:
  n     : integer = 0        -- observation count
  mean  : float   = 0.0      -- running mean
  M2    : float   = 0.0      -- sum of squared deviations from mean

UPDATE(x):
  n    <- n + 1
  delta <- x - mean
  mean  <- mean + delta / n
  delta2 <- x - mean           -- note: uses UPDATED mean
  M2    <- M2 + delta * delta2

QUERY:
  population_variance <- M2 / n
  sample_variance     <- M2 / (n - 1)        -- Bessel correction
  std_dev             <- sqrt(sample_variance)
```

**Properties**:

| Property | Value |
|----------|-------|
| Time per update | O(1) |
| Space | O(1) — three scalars |
| Numerical stability | Superior to naive two-pass |
| Parallelizable | Yes — via Chan's merging formula |

**Chan's parallel merging** [CHAN-1979]: When merging statistics from two partitions
`(n_A, mean_A, M2_A)` and `(n_B, mean_B, M2_B)`:

```
n_AB   = n_A + n_B
delta  = mean_B - mean_A
mean_AB = mean_A + delta * n_B / n_AB
M2_AB  = M2_A + M2_B + delta^2 * n_A * n_B / n_AB
```

This merging formula is REQUIRED for d2ts operators that partition work across parallel
dataflow branches. Implementations MUST use Chan's formula (not sequential recomputation)
when merging statistics from parallel computations.

**Sliding window variant**: For a fixed-size window of `W` observations, the mean and
variance MUST be maintained using a circular buffer with O(1) amortized update cost.
The sliding window algorithm maintains `sum` and `sum_of_squares` and subtracts the
departing observation:

```
Algorithm: Sliding-Window-Mean-Variance

STATE:
  buffer[W]  : circular buffer of recent W observations
  sum        : float = 0.0
  sum_sq     : float = 0.0
  n          : integer = 0

UPDATE(x_new):
  IF n >= W:
    x_old <- buffer.dequeue()
    sum   <- sum - x_old
    sum_sq <- sum_sq - x_old * x_old
    n     <- n - 1

  buffer.enqueue(x_new)
  sum   <- sum + x_new
  sum_sq <- sum_sq + x_new * x_new
  n     <- n + 1

QUERY:
  mean     <- sum / n
  variance <- (sum_sq - sum * sum / n) / (n - 1)
```

**Caution**: The sliding window algorithm using `sum_sq` is less numerically stable than
Welford's method. For applications where numerical precision is critical (small variance
relative to mean), implementations SHOULD use a sliding window adaptation of Welford's
algorithm that maintains `M2` incrementally. For most Tsingou signal processing (where
values are normalized to a common range), the simpler algorithm is sufficient.

### 1.2 Higher-Order Moments: Skewness and Kurtosis

Higher-order moments characterize the shape of the signal distribution beyond mean and
variance. These shape statistics are critical for anomaly detection because many signal
anomalies manifest as changes in distribution shape rather than location or scale.

**Skewness** (third standardized moment) measures asymmetry:

```
gamma_1 = m_3 / m_2^{3/2}

where m_k = (1/n) * sum_{i=1}^{n} (x_i - x_bar)^k
```

| Skewness | Distribution Shape | Signal Interpretation |
|----------|-------------------|-----------------------|
| `gamma_1 > 0` | Right-skewed (long right tail) | Occasional high-value spikes |
| `gamma_1 < 0` | Left-skewed (long left tail) | Occasional low-value dips |
| `gamma_1 = 0` | Symmetric | Normal or uniform behavior |

**Kurtosis** (fourth standardized moment) measures tail heaviness:

```
gamma_2 = m_4 / m_2^2 - 3        (excess kurtosis, Gaussian = 0)
```

| Excess Kurtosis | Distribution Shape | Signal Interpretation |
|-----------------|-------------------|-----------------------|
| `gamma_2 > 0` | Leptokurtic (heavy tails) | More extreme values than Gaussian; typical for SIGINT |
| `gamma_2 < 0` | Platykurtic (light tails) | Fewer extremes; bounded signals |
| `gamma_2 = 0` | Mesokurtic (Gaussian tails) | Baseline reference |

**Online computation**: Pebay [PEBAY-2008] extended Welford's algorithm to compute
higher-order central moments incrementally:

```
Algorithm: Pebay-Online-Higher-Moments

STATE:
  n, mean, M2, M3, M4 : all initialized to 0

UPDATE(x):
  n1     <- n
  n      <- n + 1
  delta  <- x - mean
  delta_n <- delta / n
  delta_n2 <- delta_n * delta_n
  term1  <- delta * delta_n * n1

  mean <- mean + delta_n
  M4   <- M4 + term1 * delta_n2 * (n*n - 3*n + 3)
              + 6 * delta_n2 * M2 - 4 * delta_n * M3
  M3   <- M3 + term1 * delta_n * (n - 2) - 3 * delta_n * M2
  M2   <- M2 + term1

QUERY:
  variance <- M2 / (n - 1)
  skewness <- sqrt(n) * M3 / M2^{1.5}
  kurtosis <- n * M4 / (M2 * M2) - 3
```

Implementations MUST compute skewness and kurtosis for each signal stream using Pebay's
algorithm. These statistics MUST be included in the BaseSignal metadata envelope (Section 1.4).

A significant change in skewness or kurtosis (relative to the baseline window) SHOULD
trigger an anomaly flag even when mean and variance remain stable. This captures distribution
shape anomalies that Z-score and EWMA methods miss.

### 1.3 Quantile Estimation for Streaming Data

Exact quantile computation requires sorting, which is O(n log n) and requires O(n) storage —
infeasible for unbounded streams. Implementations MUST use approximate quantile estimators.

**t-digest** [DUNNING-2021]: A data structure for accurate estimation of quantiles from
streaming data. The t-digest maintains a compressed representation of the distribution using
a set of centroids, with higher accuracy near the tails (q near 0 or 1).

| Property | t-digest | GK sketch | Random sample |
|----------|----------|-----------|---------------|
| Accuracy near tails | High | Medium | Low |
| Accuracy near median | Medium | High | Medium |
| Space | O(delta) where delta ~ 100-300 | O(1/epsilon * log(epsilon * n)) | O(1/epsilon^2) |
| Mergeability | Yes | Yes | Yes |
| Streaming | Yes | Yes | Yes |

Implementations SHOULD use t-digest for quantile estimation due to its superior tail accuracy,
which is critical for anomaly detection (anomalies are by definition in the tails).

**Quantile-based anomaly detection**: The Interquartile Range (IQR) method provides a
non-parametric alternative to Z-score:

```
IQR = Q_75 - Q_25
Lower fence = Q_25 - k * IQR
Upper fence = Q_75 + k * IQR
```

where `k = 1.5` for outliers and `k = 3.0` for extreme outliers. This method SHOULD be used
when the signal distribution is non-Gaussian (which is the typical case for SIGINT data).

### 1.4 BaseSignal Metadata Enrichment

Every signal processed through the d2ts graph carries a metadata envelope. Statistical
operators MUST enrich this envelope with computed statistics.

The following metadata fields MUST be computed and attached by statistical operators at
the Transform tier:

| Field | Type | Computation | Window |
|-------|------|-------------|--------|
| `stat_mean` | `float64` | Welford running mean | Sliding window W |
| `stat_variance` | `float64` | Welford running variance | Sliding window W |
| `stat_stddev` | `float64` | `sqrt(stat_variance)` | Sliding window W |
| `stat_skewness` | `float64` | Pebay third moment | Sliding window W |
| `stat_kurtosis` | `float64` | Pebay fourth moment (excess) | Sliding window W |
| `stat_min` | `float64` | Running minimum | Sliding window W |
| `stat_max` | `float64` | Running maximum | Sliding window W |
| `stat_count` | `uint64` | Observation count | Sliding window W |
| `stat_q25` | `float64` | t-digest 25th percentile | Sliding window W |
| `stat_q50` | `float64` | t-digest median | Sliding window W |
| `stat_q75` | `float64` | t-digest 75th percentile | Sliding window W |
| `stat_q99` | `float64` | t-digest 99th percentile | Sliding window W |

The window size `W` MUST be configurable per signal source and SHOULD default to 300 seconds
(5 minutes) for real-time analysis and 86400 seconds (24 hours) for baseline profiling.

---

## 2. Z-Score Anomaly Detection

### 2.1 Standard Z-Score

The Z-score (standard score) measures how many standard deviations an observation deviates
from the mean:

```
z_i = (x_i - mu) / sigma
```

where `mu` is the population mean and `sigma` is the population standard deviation. In
practice, `mu` and `sigma` are estimated from a reference window.

**Decision rule**: An observation is flagged as anomalous if:

```
|z_i| > z_threshold
```

**Threshold selection** based on Gaussian assumptions:

| Threshold | Expected FPR (two-tailed) | Use Case |
|-----------|---------------------------|----------|
| `z = 2.0` | 4.56% | Low-sensitivity screening |
| `z = 2.5` | 1.24% | Moderate sensitivity |
| `z = 3.0` | 0.27% | Standard anomaly detection (three-sigma) |
| `z = 3.5` | 0.047% | High-confidence detection |
| `z = 4.0` | 0.006% | Extreme anomalies only |

Implementations MUST support configurable Z-score thresholds per signal source. The default
threshold SHOULD be `z = 3.0` (three-sigma rule) unless domain-specific calibration
indicates otherwise.

**Limitations**: The Z-score assumes:
1. Approximately Gaussian distribution
2. Independent and identically distributed (i.i.d.) observations
3. Stationary mean and variance

When these assumptions are violated (which is common in SIGINT data), implementations
MUST use the modified Z-score (Section 2.2) or non-parametric methods (Section 9).

### 2.2 Modified Z-Score (Robust)

The modified Z-score [IGLEWICZ-HOAGLIN-1993] replaces mean and standard deviation with
median and Median Absolute Deviation (MAD), which are robust to outlier contamination:

```
MAD = median(|x_i - median(x)|)
M_i = 0.6745 * (x_i - median(x)) / MAD
```

The constant `0.6745` is the 75th percentile of the standard normal distribution, which
ensures that `M_i` is comparable to the standard Z-score for Gaussian data.

**Why robustness matters**: In a contaminated sample, outliers inflate the standard deviation,
making the standard Z-score for the outlier SMALLER (the masking effect). The modified
Z-score is immune to masking because the median and MAD are breakdown-resistant
(breakdown point = 50% for median, 50% for MAD).

| Statistic | Breakdown Point | Sensitivity to Outliers |
|-----------|----------------|------------------------|
| Mean | 0% | A single extreme value shifts the mean arbitrarily |
| Standard deviation | 0% | Inflated by outliers |
| Median | 50% | Unaffected by up to 50% contamination |
| MAD | 50% | Unaffected by up to 50% contamination |

**Decision rule**: `|M_i| > 3.5` is RECOMMENDED as the threshold for the modified Z-score
[IGLEWICZ-HOAGLIN-1993].

Implementations MUST support both standard and modified Z-scores. The modified Z-score
SHOULD be the default for SIGINT signal streams, which are typically non-Gaussian and
subject to outlier contamination from adversarial injection or sensor malfunction.

### 2.3 Sliding Window Z-Score

For non-stationary signals (where the mean and variance drift over time), the Z-score
MUST be computed relative to a sliding window of recent observations:

```
z_i = (x_i - mu_W(i)) / sigma_W(i)
```

where `mu_W(i)` and `sigma_W(i)` are the mean and standard deviation computed over the
window `[i - W + 1, ..., i - 1]`. Note: the current observation `x_i` MUST NOT be
included in the reference statistics to avoid contamination.

**Implementation in d2ts**: The sliding window Z-score maps to the following d2ts operator
chain:

```
signal_stream
  |> window(duration: W)           -- collect sliding window
  |> map(compute_welford_stats)    -- compute mu_W, sigma_W
  |> map(z_score)                  -- z_i = (x_i - mu_W) / sigma_W
  |> filter(|z| > threshold)       -- emit anomalies
```

The `window(duration)` operator maintains the reference window. The statistical computation
and anomaly test are applied by subsequent `map` and `filter` operators.

### 2.4 Adaptive Thresholds

Fixed thresholds produce excessive false positives during high-variance periods and miss
anomalies during low-variance periods. Adaptive thresholds adjust the sensitivity based
on the local statistical properties of the signal.

**Adaptive threshold algorithm**:

```
threshold(i) = z_base + alpha * |gamma_2(i)|
```

where `z_base` is the minimum threshold (RECOMMENDED: 3.0), `alpha` is a kurtosis
sensitivity parameter (RECOMMENDED: 0.5), and `gamma_2(i)` is the excess kurtosis
computed over the window.

**Rationale**: Leptokurtic distributions (positive excess kurtosis) naturally produce
more extreme values. Increasing the threshold during high-kurtosis periods reduces
false positives without sacrificing detection of genuinely anomalous events.

Implementations SHOULD support adaptive thresholds. The adaptation MUST be documented
in the alert metadata so analysts can understand why a particular threshold was applied.

---

## 3. Exponentially Weighted Moving Average (EWMA)

### 3.1 EWMA Recursion

The EWMA [ROBERTS-1959] computes a weighted average that gives exponentially decreasing
weight to older observations:

```
S_t = lambda * x_t + (1 - lambda) * S_{t-1}
S_0 = mu_0
```

where:
- `S_t` is the EWMA statistic at time `t`
- `x_t` is the observation at time `t`
- `lambda in (0, 1]` is the smoothing factor (weighting constant)
- `mu_0` is the target value (typically the in-control process mean)

The effective weight of observation `x_{t-j}` in `S_t` is `lambda * (1 - lambda)^j`,
which decays geometrically. The effective memory span is approximately `2/lambda - 1`
observations:

| Lambda | Effective Memory (obs) | Half-Life (obs) |
|--------|----------------------|-----------------|
| 0.05 | 39 | 13.5 |
| 0.10 | 19 | 6.6 |
| 0.20 | 9 | 3.1 |
| 0.30 | 5.7 | 1.9 |
| 0.50 | 3 | 1.0 |

Implementations MUST compute the EWMA for each monitored signal stream. The computation
is O(1) per observation and O(1) space (a single scalar state variable).

### 3.2 EWMA Control Chart

The EWMA control chart detects shifts in the process mean by comparing `S_t` against
control limits:

```
UCL_t = mu_0 + L * sigma * sqrt(lambda / (2 - lambda) * (1 - (1 - lambda)^{2t}))
CL    = mu_0
LCL_t = mu_0 - L * sigma * sqrt(lambda / (2 - lambda) * (1 - (1 - lambda)^{2t}))
```

where `L` is the control limit width parameter and `sigma` is the in-control standard
deviation.

**Asymptotic limits** (as `t -> infinity`):

```
UCL_inf = mu_0 + L * sigma * sqrt(lambda / (2 - lambda))
LCL_inf = mu_0 - L * sigma * sqrt(lambda / (2 - lambda))
```

The transient term `(1 - (1 - lambda)^{2t})` approaches 1 rapidly; for `lambda = 0.2`,
the limits reach 95% of their asymptotic value by `t = 14`. Implementations MAY use the
asymptotic limits after a burn-in period of `ceil(3 / lambda)` observations.

**Signal rule**: An alarm is raised when `S_t` exceeds `UCL_t` or falls below `LCL_t`.
After an alarm, the EWMA SHOULD be reset to the current observation value (or to the
target `mu_0`, depending on the reset policy).

### 3.3 Lambda Selection and ARL Performance

The Average Run Length (ARL) is the expected number of observations before a signal is
triggered:

- **ARL_0** (in-control): The expected time between false alarms. Higher is better.
- **ARL_1** (out-of-control): The expected time to detect a true shift. Lower is better.

**ARL performance for selected (lambda, L) combinations**:

| Lambda | L | ARL_0 | ARL_1 (0.5 sigma shift) | ARL_1 (1.0 sigma shift) | ARL_1 (2.0 sigma shift) |
|--------|---|-------|-------------------------|-------------------------|-------------------------|
| 0.05 | 2.615 | 500 | 26.2 | 10.8 | 4.4 |
| 0.10 | 2.814 | 500 | 29.8 | 10.3 | 4.0 |
| 0.20 | 2.962 | 500 | 41.8 | 11.1 | 4.1 |
| 0.25 | 3.000 | 500 | 50.2 | 12.0 | 4.2 |
| 0.40 | 3.054 | 500 | 77.0 | 14.3 | 4.4 |

**Selection guidelines**:

| Expected Shift Size | RECOMMENDED Lambda | Rationale |
|--------------------|--------------------|-----------|
| 0.25 - 0.75 sigma | 0.05 - 0.10 | Small shifts need heavy smoothing |
| 0.75 - 1.50 sigma | 0.10 - 0.20 | Moderate shifts — balanced response |
| 1.50 - 3.00 sigma | 0.20 - 0.40 | Large shifts — fast response |
| Unknown | 0.10 | Conservative default |

Implementations MUST document the chosen `(lambda, L)` pair for each monitored signal
and the rationale for the choice. Implementations SHOULD support dynamic lambda adjustment
based on the observed shift sizes detected in the recent history.

### 3.4 EWMA for Variance Monitoring

The standard EWMA monitors the mean. To detect changes in variance, the EWMA can be
applied to the squared residuals:

```
e_t = (x_t - mu_0)^2
V_t = lambda * e_t + (1 - lambda) * V_{t-1}
V_0 = sigma_0^2
```

**Control limits for variance EWMA**:

```
UCL_V = sigma_0^2 * (1 + L * sqrt(2 * lambda / (2 - lambda)))
LCL_V = max(0, sigma_0^2 * (1 - L * sqrt(2 * lambda / (2 - lambda))))
```

An alarm on the variance EWMA indicates a change in signal volatility — potentially
more informative than a mean shift for SIGINT analysis, where adversary behavioral
changes often manifest as increased variability before a coordinated action.

Implementations SHOULD compute both mean EWMA and variance EWMA for critical signal
streams.

---

## 4. CUSUM Change-Point Detection

### 4.1 Tabular CUSUM

The Cumulative Sum (CUSUM) control chart [PAGE-1954] accumulates evidence of a mean
shift by maintaining running sums of deviations from the target:

```
C^+(t) = max(0, C^+(t-1) + (x_t - mu_0) - k)     [upper CUSUM]
C^-(t) = max(0, C^-(t-1) - (x_t - mu_0) - k)     [lower CUSUM]

C^+(0) = C^-(0) = 0
```

**Signal rule**: An upward shift is signaled when `C^+(t) > h`. A downward shift is
signaled when `C^-(t) > h`.

**Parameters**:

| Parameter | Symbol | Definition | RECOMMENDED Value |
|-----------|--------|------------|-------------------|
| Reference value (allowance) | `k` | Half the shift to detect: `k = delta/2` where delta is the minimum shift | `k = 0.5 * sigma` for 1-sigma shift |
| Decision interval | `h` | Threshold for signaling | `h = 4 * sigma` to `h = 5 * sigma` for ARL_0 ~ 200-500 |
| Target | `mu_0` | In-control process mean | Estimated from baseline window |

**Change-point estimation**: When a signal is triggered at time `T`, the estimated change
point is the time at which the CUSUM last returned to zero:

```
tau_hat = max{t < T : C^+(t) = 0}     [for upward shift]
```

This property makes CUSUM diagnostic: it not only detects that a change occurred but
estimates WHEN it occurred — critical for forensic analysis in SIGINT investigations.

### 4.2 Page's Sequential CUSUM

Page's original formulation [PAGE-1954] is a one-sided test for detecting an increase
in the mean:

```
S_t = max(0, S_{t-1} + x_t - mu_0 - k)
S_0 = 0

Signal when: S_t > h
```

This is equivalent to the upper CUSUM `C^+(t)` in the tabular formulation. The sequential
nature makes it ideal for streaming data: each new observation requires O(1) computation.

**Theoretical basis**: The CUSUM is the discrete-time analog of the optimal sequential test
derived from Wald's Sequential Probability Ratio Test (SPRT) [WALD-1945]. For detecting
a shift from `mu_0` to `mu_1 = mu_0 + delta`, the CUSUM with `k = delta/2` is optimal
in the sense of minimizing the worst-case expected detection delay for a given false alarm
rate [MOUSTAKIDES-1986].

### 4.3 Fast Initial Response (FIR) CUSUM

Standard CUSUM starts from zero, which delays initial detection. The FIR enhancement
initializes the CUSUM at a nonzero value (head start):

```
C^+(0) = C^-(0) = h/2     [half the decision interval]
```

This allows the CUSUM to signal more quickly if the process starts in an out-of-control
state. The FIR CUSUM is RECOMMENDED for Tsingou's signal monitoring because new signal
sources may already be in an anomalous state when first observed.

### 4.4 Multivariate CUSUM

For vector-valued signals (e.g., multiple features extracted from a single source),
the multivariate CUSUM extends the scalar version:

**Crosier's multivariate CUSUM** [CROSIER-1988]:

```
S_t = (S_{t-1} + z_t) * max(0, 1 - k / ||S_{t-1} + z_t||)

where z_t = Sigma^{-1/2} * (x_t - mu_0)    [standardized vector]

Signal when: ||S_t|| > h
```

**Pignatiello-Runger MC1** [PIGNATIELLO-1990]:

```
C_t = max(0, C_{t-1} + (x_t - mu_0)^T * Sigma^{-1} * (x_t - mu_0) - k)

Signal when: C_t > h
```

Multivariate CUSUM SHOULD be used when monitoring correlated signal features. The choice
between Crosier and Pignatiello-Runger depends on whether the shift direction is known
(Crosier is directional; PR is omnidirectional).

### 4.5 CUSUM vs. EWMA: Selection Criteria

| Criterion | CUSUM | EWMA |
|-----------|-------|------|
| Optimal for | Known shift size | Unknown shift size |
| Diagnostic information | Change-point location | Trend visualization |
| Memory model | Accumulation (total evidence) | Exponential (recent evidence) |
| Reset after alarm | Reset to 0 | Reset to target or current |
| Multivariate extension | Well-developed | Limited |
| Computational cost | O(1) per step | O(1) per step |
| Tuning difficulty | k and h (requires shift size estimate) | lambda and L (more intuitive) |

**RECOMMENDED selection**:

- Use CUSUM when the expected shift size is approximately known (e.g., detecting a specific
  attack signature)
- Use EWMA when the shift size is unknown or variable (e.g., general signal monitoring)
- Use BOTH in parallel for critical signal streams — CUSUM for rapid detection of known
  threats, EWMA for general trend monitoring

Implementations SHOULD support both CUSUM and EWMA as d2ts operators. For the highest
detection sensitivity, implementations MAY run both methods in parallel on the same
signal stream and combine their outputs via the anomaly scoring fusion (Section 11.1).

---

## 5. Grubbs Test and Outlier Detection

### 5.1 Grubbs Test Statistic

Grubbs' test [GRUBBS-1950] detects a single outlier in a univariate sample assumed to
follow an approximately normal distribution.

**Test statistic**:

```
G = max_{i=1,...,n} |x_i - x_bar| / s
```

where `x_bar` is the sample mean and `s` is the sample standard deviation.

**Critical value**:

```
G_crit = (n - 1) / sqrt(n) * sqrt(t^2_{alpha/(2n), n-2} / (n - 2 + t^2_{alpha/(2n), n-2}))
```

where `t_{alpha/(2n), n-2}` is the critical value of the t-distribution with `n-2` degrees
of freedom at significance level `alpha/(2n)`.

**Decision rule**: Reject the null hypothesis (no outlier) if `G > G_crit`.

**Assumptions**: The data (excluding the suspected outlier) are approximately normally
distributed. This assumption MUST be verified (e.g., via Shapiro-Wilk test or visual
inspection of Q-Q plots) before applying Grubbs' test.

### 5.2 Generalized ESD Procedure

The Generalized Extreme Studentized Deviate (ESD) test [ROSNER-1983] extends Grubbs'
test to detect up to `R` outliers, avoiding the masking problem where multiple outliers
inflate the standard deviation and hide each other.

```
Algorithm: Generalized-ESD

INPUT:  Sample {x_1, ..., x_n}, maximum number of outliers R, significance alpha
OUTPUT: Number of outliers detected

FOR i = 1 TO R:
  1. Compute G_i = max_j |x_j - x_bar| / s   [Grubbs statistic on current sample]
  2. Remove the observation with maximum |x_j - x_bar|
  3. Compute critical value lambda_i for reduced sample size (n - i + 1)

Determine k = largest i such that G_i > lambda_i
Report k outliers
```

The generalized ESD is RECOMMENDED over iterative Grubbs for batch windows where multiple
outliers may be present.

### 5.3 Dixon's Q Test

Dixon's Q test [DIXON-1950] provides a simpler outlier test based on the ratio of the
gap between the suspect observation and its nearest neighbor to the range:

```
Q = |x_suspect - x_nearest| / (x_max - x_min)
```

**Advantage**: Does not require computation of mean and standard deviation; operates
directly on the order statistics. Less powerful than Grubbs but more robust when the
sample is very small (`n < 10`).

Implementations MAY support Dixon's Q test for small-sample scenarios (very short windows
or sparse signal streams).

### 5.4 Streaming Outlier Detection

Grubbs, ESD, and Dixon's Q are batch tests — they operate on fixed-size samples. For
streaming data, these tests MUST be applied within the d2ts `window` operator:

```
signal_stream
  |> window(duration: W, slide: S)     -- tumbling or sliding window
  |> map(apply_esd_test(R, alpha))     -- detect outliers within window
  |> filter(outlier_detected)          -- emit flagged observations
```

The window size `W` MUST be large enough for the tests to have statistical power
(RECOMMENDED: `W >= 25` observations for Grubbs, `W >= 50` for ESD).

---

## 6. Bayesian Change-Point Detection

### 6.1 Online BOCPD (Adams-MacKay)

Bayesian Online Changepoint Detection (BOCPD) [ADAMS-MACKAY-2007] computes the posterior
distribution over the current **run length** `r_t` — the number of time steps since the
last change point — as each new observation arrives.

**Generative model**: The data are generated by a sequence of i.i.d. segments. Within
each segment, observations are drawn from the same distribution (the **underlying
predictive model**, UPM). At random times, a change point occurs and the distribution
parameters reset.

### 6.2 Run Length Posterior

The joint distribution of run length and observations factorizes as:

```
P(r_t, x_{1:t}) = sum_{r_{t-1}} P(r_t | r_{t-1}) * P(x_t | r_{t-1}, x_t^{(r)}) * P(r_{t-1}, x_{1:t-1})
```

where `x_t^{(r)}` denotes the observations since the last change point (the current run).

**Transition probabilities**:

```
P(r_t = r_{t-1} + 1) = 1 - H(r_{t-1})     [growth: no change point]
P(r_t = 0)           = H(r_{t-1})          [change point: reset run length]
```

where `H(tau)` is the hazard function (Section 6.3).

**Recursive update algorithm**:

```
Algorithm: BOCPD-Online

STATE:
  R[0:t]    : run length probability vector
  suff[0:t] : sufficient statistics for each run length hypothesis

INITIALIZE:
  R[0] = 1.0    -- all mass on r_0 = 0

UPDATE(x_t):
  1. PREDICTIVE: For each r, compute pi_r = P(x_t | suff[r])   [UPM prediction]
  2. GROWTH:     growth_r = R[r] * pi_r * (1 - H(r))           [no change point]
  3. CHANGE:     change   = sum_r R[r] * pi_r * H(r)           [change point]
  4. CONCATENATE: R_new = [change, growth_0, growth_1, ..., growth_{t-1}]
  5. NORMALIZE:  R_new = R_new / sum(R_new)
  6. UPDATE SUFFICIENT STATS: Update suff[r] with x_t for each r

QUERY:
  MAP run length: r* = argmax_r R[r]
  Change point probability: P(cp at t) = R[0]
  Expected run length: E[r] = sum_r r * R[r]
```

**Computational cost**: O(t) per update (growing linearly with time). Implementations
MUST truncate the run length vector at a maximum length `r_max` to bound computational
cost. RECOMMENDED: `r_max = 500` (change points separated by more than 500 steps are
treated as different segments regardless).

### 6.3 Hazard Functions

The hazard function `H(tau)` encodes the prior belief about change-point frequency:

| Hazard Function | H(tau) | Prior on Run Length | Use Case |
|-----------------|--------|--------------------|---------|
| **Constant** | `H = 1/lambda` | Geometric (memoryless) | No prior knowledge of change-point timing |
| **Increasing** | `H(tau) = (a + tau) / (a + b + tau)` | Beta-Bernoulli | Change points become more likely with time |
| **Logistic** | `H(tau) = sigma(a * tau + b)` | Sigmoid-shaped | Soft periodicity assumption |

The constant hazard function with `lambda = 250` (expected 250 observations between
change points) is RECOMMENDED as the default. The hazard rate `1/lambda` SHOULD be
configurable per signal source based on the expected stability of the source.

### 6.4 Offline Bayesian Segmentation

For retrospective analysis (NATS JetStream replay), offline Bayesian segmentation provides
optimal partitioning of the complete time series.

**Dynamic programming formulation**: Given observations `x_{1:T}`, find the partition
into `K` segments that maximizes the posterior:

```
max_{t_1, ..., t_K} sum_{k=1}^{K} log P(x_{t_k:t_{k+1}-1}) + log P(K) + sum_k log P(t_k)
```

The Bayesian Information Criterion (BIC) or marginal likelihood provides the model
evidence for segment count selection.

Implementations SHOULD support offline segmentation for retrospective analysis via
NATS JetStream replay. The offline algorithm runs on the stored signal history and
produces a segmentation that can be overlaid on the temporal visualization.

### 6.5 Comparison with Frequentist Methods

| Property | CUSUM | EWMA | BOCPD |
|----------|-------|------|-------|
| Detects mean shift | Yes | Yes | Yes |
| Detects variance change | With modification | Variance EWMA | Yes (via UPM) |
| Detects distribution change | No | No | Yes (via UPM) |
| Change-point location | Yes (CUSUM zero-crossing) | Approximate | Yes (MAP run length) |
| Prior knowledge required | Shift size estimate | Shift size estimate | Hazard function |
| Uncertainty quantification | No | No | Yes (full posterior) |
| Computational cost per step | O(1) | O(1) | O(r_max) |
| False alarm control | ARL-based | ARL-based | Posterior probability threshold |

BOCPD is RECOMMENDED for complex signals where the nature of the change is unknown
(mean, variance, shape, or multimodal). CUSUM and EWMA are RECOMMENDED for well-characterized
signals where the expected shift type is known and computational cost must be minimized.

---

## 7. Time Series Decomposition

### 7.1 Classical Additive and Multiplicative Decomposition

Time series decomposition separates a signal into systematic components and noise.

**Additive model** (when seasonal amplitude is constant):

```
Y_t = T_t + S_t + R_t
```

**Multiplicative model** (when seasonal amplitude scales with trend):

```
Y_t = T_t * S_t * R_t
```

where:
- `T_t` = trend-cycle component (long-term progression)
- `S_t` = seasonal component (periodic variation)
- `R_t` = residual (irregular, noise, anomalies)

**Classical decomposition algorithm**:

1. **Estimate trend** `T_hat_t` using centered moving average of order `m` (period length)
2. **Detrend**: `Y_t - T_hat_t` (additive) or `Y_t / T_hat_t` (multiplicative)
3. **Estimate seasonality** `S_hat_t` as the average of detrended values for each season
4. **Compute residual**: `R_t = Y_t - T_hat_t - S_hat_t` (additive)

**Limitations of classical decomposition**:

1. Trend estimate is missing for the first and last `m/2` observations
2. Seasonal component is assumed constant over time
3. Not robust to outliers
4. Only handles fixed-period seasonality

### 7.2 STL Decomposition

STL (Seasonal-Trend decomposition using LOESS) [CLEVELAND-1990] addresses all limitations
of classical decomposition.

**Algorithm outline**:

```
Algorithm: STL-Decomposition

INPUT:  Time series Y[1:N], period n_p, seasonal smoothing n_s, trend smoothing n_t
OUTPUT: Components T[1:N], S[1:N], R[1:N]

OUTER LOOP (robustness, typically 1-2 iterations):
  Compute robustness weights rho[t] from previous residuals

  INNER LOOP (typically 2-3 iterations):
    Step 1: DETREND
      Y_detrended[t] = Y[t] - T[t]

    Step 2: SEASONAL SMOOTHING
      For each subseries (observations at same seasonal position):
        Apply LOESS smoother with window n_s
      Result: C[t] (cycle-subseries)

    Step 3: LOW-PASS FILTER of C to extract seasonal
      Apply moving average (3 x 3 x n_p) then LOESS with window n_s
      S[t] = C[t] - low_pass_filtered_C[t]

    Step 4: DESEASONALIZE
      Y_deseasonalized[t] = Y[t] - S[t]

    Step 5: TREND SMOOTHING
      Apply LOESS smoother with window n_t to Y_deseasonalized
      Result: T[t]

COMPUTE RESIDUAL:
  R[t] = Y[t] - T[t] - S[t]
```

**STL parameters**:

| Parameter | Symbol | Effect | RECOMMENDED Default |
|-----------|--------|--------|---------------------|
| Period | `n_p` | Seasonal period length | Domain-specific (e.g., 24h for daily patterns) |
| Seasonal smoothing | `n_s` | Smoothness of seasonal component | Must be odd, >= 7; larger = smoother |
| Trend smoothing | `n_t` | Smoothness of trend component | Must be odd; `ceil(1.5 * n_p / (1 - 1.5/n_s))` |
| Inner loops | `n_i` | Convergence iterations | 2 (usually sufficient) |
| Outer loops | `n_o` | Robustness iterations | 1 for clean data; 6+ for outlier-contaminated |

**Advantages of STL**:

| Feature | Classical | STL |
|---------|-----------|-----|
| Seasonal variation over time | Fixed | Adapts (controlled by `n_s`) |
| Robustness to outliers | None | Via outer loop weights |
| Missing data handling | Fails | LOESS handles gaps |
| Trend smoothness control | Fixed by `m` | Tunable via `n_t` |
| Any period length | Integer `m` only | Any `n_p` |

### 7.3 Online Decomposition for Streaming Data

STL as defined above is a batch algorithm. For streaming data in d2ts, an online
approximation is needed.

**Online STL approach**:

1. Maintain a rolling buffer of `K * n_p` observations (K complete periods)
2. Run STL on the buffer whenever a new period completes
3. Use the most recent trend and seasonal estimates for real-time decomposition
4. The residual `R_t = Y_t - T_hat_t - S_hat_t` is computed per-observation

**Incremental trend estimation**: Between full STL runs, the trend can be approximated
using EWMA (Section 3.1) on the deseasonalized signal:

```
T_hat_t approximately equal to EWMA(Y_t - S_hat_t)
```

where `S_hat_t` uses the seasonal estimate from the most recent STL run.

Implementations MUST support decomposition for signal streams with known periodicity
(e.g., daily patterns in network traffic, weekly patterns in OSINT feed volumes).
The decomposition SHOULD be computed incrementally using the online STL approximation.

### 7.4 Residual Analysis for Anomaly Scoring

The residual component `R_t` contains the signal after removing trend and seasonality —
the "unexpected" component. Anomaly detection on the residual is more sensitive than on
the raw signal because systematic patterns have been removed.

**Anomaly scoring pipeline**:

```
Y_t                                         [raw signal]
  |> STL decompose                          [extract T, S, R]
  |> take residual R_t                      [unexpected component]
  |> compute z-score on R_t                 [standardize]
  |> apply CUSUM on z-scored residual       [detect sustained shifts]
  |> apply BOCPD on residual                [detect regime changes]
  |> fuse anomaly scores (Section 11.1)     [combine evidence]
```

This pipeline is RECOMMENDED as the canonical anomaly detection flow for periodic signal
streams. Implementations MUST apply decomposition before anomaly detection for any signal
stream with detectable periodicity (determined by autocorrelation analysis — Section 10.4).

---

## 8. Spectral Density Estimation

### 8.1 Periodogram

The periodogram is the simplest estimator of the power spectral density (PSD):

```
I(f_k) = (1/N) * |X(f_k)|^2

where X(f_k) = sum_{t=0}^{N-1} x_t * exp(-2*pi*i*f_k*t)   [DFT]
```

and `f_k = k/N` for `k = 0, 1, ..., N-1`.

**Statistical properties**:

| Property | Value |
|----------|-------|
| Expectation | `E[I(f)] -> S(f)` (asymptotically unbiased) |
| Variance | `Var[I(f)] -> S(f)^2` (does NOT decrease with N) |
| Consistency | **Inconsistent** — variance does not shrink |
| Resolution | `Delta_f = 1/N` (N observations) |

The periodogram's inconsistency (constant variance regardless of sample size) makes it
unsuitable for direct use. Implementations MUST NOT use the raw periodogram for spectral
density estimation; smoothing (Welch's method) or parametric methods MUST be applied.

### 8.2 Welch's Method

Welch's method [WELCH-1967] reduces periodogram variance by averaging over overlapping
windowed segments:

```
Algorithm: Welch-Spectral-Estimation

INPUT:  Signal x[0:N-1], segment length L, overlap D, window function w

1. Divide into K = floor((N - D) / (L - D)) overlapping segments
   Segment k: x_k[t] = x[k*(L-D) + t]  for t = 0, ..., L-1

2. Apply window: y_k[t] = w[t] * x_k[t]

3. Compute periodogram per segment:
   I_k(f) = (1 / (L * U)) * |sum_{t=0}^{L-1} y_k[t] * exp(-2*pi*i*f*t)|^2
   where U = (1/L) * sum_{t=0}^{L-1} w[t]^2   [window power normalization]

4. Average: P_welch(f) = (1/K) * sum_{k=1}^{K} I_k(f)
```

**Bias-variance trade-off**:

| Parameter | Effect on Variance | Effect on Resolution |
|-----------|-------------------|-----------------------|
| More segments (larger K) | Decreases (~1/K) | Decreases (shorter segments) |
| Longer segments (larger L) | Increases | Increases (Delta_f = 1/L) |
| More overlap (larger D) | Mild decrease | No effect |
| Narrower window | Increases | Increases |

**RECOMMENDED defaults**: Segment length `L = N/8`, overlap `D = L/2` (50%), Hann window.
These provide a reasonable balance between resolution and variance for most signal analysis
applications.

**Cross-reference to TSG.25**: Window function selection (Hann, Hamming, Blackman, Kaiser)
and their spectral properties (main lobe width, side lobe attenuation) are specified in
TSG.25 (DSP Foundations). This section uses the window functions defined there.

### 8.3 Spectral Anomaly Detection

Changes in the spectral density indicate changes in the signal's frequency content —
new periodic components appearing, existing ones disappearing, or frequency shifts.

**Spectral flatness** (Wiener entropy) quantifies how "tone-like" vs. "noise-like" a
signal is:

```
SF = exp((1/N) * sum_k log S(f_k)) / ((1/N) * sum_k S(f_k))
     = geometric_mean(S) / arithmetic_mean(S)
```

| Spectral Flatness | Interpretation | Signal Character |
|-------------------|----------------|-----------------|
| SF close to 1 | Flat spectrum | White noise; no dominant frequencies |
| SF close to 0 | Peaked spectrum | Strong periodic components |
| SF change over time | Spectral anomaly | New periodicity or lost periodicity |

Implementations SHOULD compute spectral flatness for each signal stream's spectral
estimate. A significant change in spectral flatness (relative to the baseline window)
SHOULD trigger a spectral anomaly flag.

**Spectral divergence**: The Kullback-Leibler divergence [TSG.29] between the current
spectral density and the baseline spectral density:

```
D_KL(S_current || S_baseline) = sum_k S_current(f_k) * log(S_current(f_k) / S_baseline(f_k))
```

A high spectral divergence indicates that the signal's frequency content has changed
significantly. This metric SHOULD be computed per-window and tracked over time.

### 8.4 Cross-Reference to TSG.25

The following topics are covered in TSG.25 (DSP Foundations) and are referenced but not
duplicated here:

- FFT implementation and computational complexity
- Window function catalog (Hann, Hamming, Blackman, Kaiser, Flat-top)
- Spectral leakage and resolution
- Sampling theory and Nyquist frequency
- Filter design for signal conditioning

This section (TSG.27) focuses on the STATISTICAL interpretation of spectral estimates
(variance, bias, consistency) and their application to anomaly detection, while TSG.25
covers the SIGNAL PROCESSING mechanics.

---

## 9. Non-Parametric Tests

### 9.1 Kolmogorov-Smirnov Test

The two-sample Kolmogorov-Smirnov (KS) test [KOLMOGOROV-1933] [SMIRNOV-1948] compares
the empirical cumulative distribution functions (ECDFs) of two samples to test whether
they come from the same distribution.

**Test statistic**:

```
D = sup_x |F_1(x) - F_2(x)|
```

where `F_1` and `F_2` are the empirical CDFs of the two samples.

**Properties**:

| Property | Value |
|----------|-------|
| Sensitivity | Any distributional difference (location, scale, shape) |
| Assumptions | Continuous distributions; independent samples |
| Power | Moderate (less powerful than specialized tests for specific alternatives) |
| Computational cost | O(n log n) for sorting + O(n) for D statistic |

**Critical values**: For large samples (`n_1, n_2 > 40`), the asymptotic critical value
at significance level `alpha`:

```
D_crit = c(alpha) * sqrt((n_1 + n_2) / (n_1 * n_2))

where c(alpha):  alpha = 0.10 -> c = 1.22
                 alpha = 0.05 -> c = 1.36
                 alpha = 0.01 -> c = 1.63
```

**Tsingou application**: The KS test is applied to compare the distribution of a signal
feature in the current observation window against a baseline window. A significant `D`
value indicates that the source's statistical character has changed — a potential indicator
of regime change (adversary adaptation, sensor reconfiguration, network topology change).

Implementations MUST support the two-sample KS test as a d2ts operator. The test SHOULD
be applied periodically (e.g., every `n_p` observations for periodic signals) to detect
distributional shifts that Z-score and EWMA methods may miss.

### 9.2 Mann-Whitney U Test

The Mann-Whitney U test [MANN-WHITNEY-1947] (also called the Wilcoxon rank-sum test)
is a non-parametric test for location shift between two independent samples.

**Test statistic**:

```
1. Combine both samples and rank all observations
2. U_1 = sum of ranks in sample 1 - n_1 * (n_1 + 1) / 2
3. U = min(U_1, n_1 * n_2 - U_1)
```

For large samples, `U` is approximately normal:

```
z_U = (U - n_1 * n_2 / 2) / sqrt(n_1 * n_2 * (n_1 + n_2 + 1) / 12)
```

**Comparison with KS test**:

| Property | KS Test | Mann-Whitney U |
|----------|---------|----------------|
| Sensitivity | Any distributional difference | Primarily location (median) shift |
| Robustness | Moderate | High (rank-based) |
| Tied values | Problematic | Handles via average ranks |
| Power for location shift | Lower | Higher |
| Power for shape change | Higher | Lower |

**Tsingou application**: Mann-Whitney confirms suspected mean shifts detected by CUSUM
or EWMA. After a change point is detected, the test compares the pre-change and post-change
windows to determine whether the location shift is statistically significant at the
desired confidence level.

### 9.3 Anderson-Darling Test

The Anderson-Darling test [ANDERSON-DARLING-1952] is a modification of the KS test that
gives more weight to the tails of the distribution:

```
A^2 = -n - (1/n) * sum_{i=1}^{n} (2i - 1) * [log(F_0(x_i)) + log(1 - F_0(x_{n+1-i}))]
```

where `F_0` is the hypothesized CDF and `x_i` are the sorted observations.

**Advantage over KS**: More sensitive to deviations in the tails, which is precisely where
anomalies occur. The Anderson-Darling test is RECOMMENDED for goodness-of-fit testing when
the tail behavior is important (e.g., testing whether a signal distribution is Gaussian
before applying Z-score methods).

### 9.4 Application to Regime Detection

Non-parametric tests enable distribution-free regime detection by comparing adjacent
windows without assuming any parametric family:

```
Algorithm: Non-Parametric-Regime-Detection

INPUT:  Signal stream, window size W, slide step S, significance alpha
OUTPUT: Regime change points

FOR each pair of consecutive windows (W_prev, W_curr):
  D, p_value = KS_test(W_prev, W_curr)
  IF p_value < alpha:
    EMIT regime change at boundary between W_prev and W_curr
    U, p_U = MannWhitney(W_prev, W_curr)
    IF p_U < alpha:
      ANNOTATE "location shift confirmed"
    ELSE:
      ANNOTATE "shape/scale change (not location)"
```

This layered approach first detects any distributional change (KS) and then characterizes
it (Mann-Whitney for location). Implementations SHOULD support this pattern for signals
where the parametric assumptions of CUSUM and EWMA are suspect.

---

## 10. Correlation Analysis

### 10.1 Pearson Correlation Coefficient

The Pearson product-moment correlation coefficient [PEARSON-1895] measures the linear
relationship between two variables:

```
r_{xy} = sum_{i=1}^{n} (x_i - x_bar)(y_i - y_bar)
         / sqrt(sum_{i=1}^{n} (x_i - x_bar)^2 * sum_{i=1}^{n} (y_i - y_bar)^2)
```

| Value | Interpretation |
|-------|---------------|
| `r = 1` | Perfect positive linear relationship |
| `r = 0` | No linear relationship (may still be nonlinearly dependent) |
| `r = -1` | Perfect negative linear relationship |
| `|r| > 0.7` | Strong linear relationship |
| `0.3 < |r| < 0.7` | Moderate linear relationship |
| `|r| < 0.3` | Weak linear relationship |

**Online computation**: Pearson correlation can be computed incrementally using a variant
of Welford's algorithm:

```
Algorithm: Online-Pearson

STATE:
  n, mean_x, mean_y, M2_x, M2_y, C_xy

UPDATE(x, y):
  n      <- n + 1
  dx     <- x - mean_x
  mean_x <- mean_x + dx / n
  dy     <- y - mean_y
  mean_y <- mean_y + dy / n
  C_xy   <- C_xy + dx * (y - mean_y)    [note: uses old dx, new mean_y]
  M2_x   <- M2_x + dx * (x - mean_x)
  M2_y   <- M2_y + dy * (y - mean_y)

QUERY:
  r = C_xy / sqrt(M2_x * M2_y)
```

Implementations MUST support online Pearson correlation for monitoring relationships
between signal streams from different source adapters.

### 10.2 Spearman Rank Correlation

The Spearman rank correlation coefficient [SPEARMAN-1904] measures the monotonic
(not necessarily linear) relationship between two variables:

```
rho_s = 1 - 6 * sum_{i=1}^{n} d_i^2 / (n * (n^2 - 1))
```

where `d_i = rank(x_i) - rank(y_i)`.

**Advantages over Pearson**:

| Property | Pearson | Spearman |
|----------|---------|----------|
| Measures | Linear relationship | Monotonic relationship |
| Robust to outliers | No | Yes (rank-based) |
| Distribution assumption | Bivariate normal for inference | None |
| Handles nonlinear monotonic | Poorly | Well |

Implementations SHOULD support both Pearson and Spearman correlation. Spearman SHOULD
be preferred for SIGINT signal streams, which are typically non-Gaussian and may contain
outliers.

### 10.3 Cross-Correlation and Lag Detection

The cross-correlation function (CCF) measures the similarity between two signals as a
function of time lag:

```
R_{xy}(tau) = E[X(t) * Y(t + tau)]
```

**Normalized cross-correlation**:

```
rho_{xy}(tau) = R_{xy}(tau) / sqrt(R_{xx}(0) * R_{yy}(0))
```

**Lag detection**: The peak of `|rho_{xy}(tau)|` at lag `tau_0` indicates that signal `Y`
lags signal `X` by `tau_0` time units (or equivalently, `X` leads `Y`).

```
tau_optimal = argmax_tau |rho_{xy}(tau)|
```

**Statistical significance**: For independent Gaussian signals of length `N`, the
approximate 95% confidence interval for the cross-correlation at any lag is:

```
+/- 1.96 / sqrt(N)
```

Cross-correlation values exceeding this bound are statistically significant.

**Tsingou application**: Cross-correlation between signal streams from different source
adapters reveals:

1. **Causal relationships**: Source A leads Source B by `tau_0` — events in A predict events in B
2. **Common upstream cause**: Both sources correlate with similar lag to an unobserved driver
3. **Coordinated activity**: Multiple sources show simultaneous correlation increase

This analysis directly feeds JDL Level 2 situation assessment [TSG.4, Section 1.1]:
cross-source correlations establish entity relationships in the situation graph.

Implementations MUST compute pairwise cross-correlations between all monitored signal
streams. The computation SHOULD be performed in the frequency domain using the FFT
(Wiener-Khinchin theorem: `R_{xy}(tau) = IFFT(X(f)^* * Y(f))`) for efficiency:
O(n log n) instead of O(n^2) for the direct method.

### 10.4 Autocorrelation Function (ACF)

The autocorrelation function is the cross-correlation of a signal with itself:

```
rho_{xx}(tau) = R_{xx}(tau) / R_{xx}(0)
```

**Interpretation**:

| ACF Pattern | Signal Property | Implication |
|-------------|----------------|-------------|
| Peaks at multiples of `p` | Periodicity with period `p` | Seasonal decomposition applicable |
| Slow exponential decay | Long-range dependence | EWMA appropriate; Z-score may need longer window |
| Sharp cutoff after lag `q` | Moving average process of order `q` | MA(q) model appropriate |
| Alternating signs | Oscillatory behavior | Check for sampling artifacts |

Implementations MUST compute the ACF for each signal stream during the baseline profiling
phase. The ACF determines:

1. Whether the signal has periodicity (and the period length `n_p` for STL decomposition)
2. The appropriate window size for sliding statistics (should be at least 2x the decorrelation time)
3. Whether successive observations are independent (required assumption for many tests)

### 10.5 Partial Autocorrelation (PACF)

The partial autocorrelation at lag `k` is the correlation between `x_t` and `x_{t+k}`
after removing the linear effect of the intermediate observations `x_{t+1}, ..., x_{t+k-1}`.

**Interpretation**:

| PACF Pattern | Model Implied | Significance |
|--------------|---------------|-------------|
| Sharp cutoff after lag `p` | Autoregressive process AR(p) | `p` is the model order |
| Exponential decay | Moving average process | Use ACF for order selection instead |
| Cutoff at `p` + exponential decay | ARMA(p, q) | Mixed model |

The PACF is essential for model selection: it determines the order of autoregressive
models that may be used for prediction and residual-based anomaly detection.

Implementations SHOULD compute the PACF during baseline profiling and use it to select
appropriate model orders for parametric anomaly detection methods.

---

## 11. Composite Anomaly Scoring

### 11.1 Multi-Method Fusion

No single statistical method detects all anomaly types. Implementations MUST fuse the
outputs of multiple detection methods into a composite anomaly score.

**Detection method strengths**:

| Method | Detects | Misses |
|--------|---------|--------|
| Z-score | Point anomalies (large deviations) | Gradual drift, distributional changes |
| EWMA | Small sustained mean shifts | Sudden spikes, variance changes |
| CUSUM | Mean shifts with known size | Unknown shift types, distributional changes |
| BOCPD | Any distributional change | Requires sufficient data per regime |
| Grubbs/ESD | Individual outliers in batch | Streaming anomalies, contextual anomalies |
| STL residual | Pattern violations (unexpected deviations from trend/season) | Anomalies consistent with pattern |
| Spectral | Frequency content changes | Broadband anomalies |
| KS test | Any distributional shift between windows | Within-window anomalies |

**Fusion via Dempster-Shafer**: Each method produces a Basic Probability Assignment (BPA)
over the binary frame `Theta = {anomalous, normal}` [TSG.4, Section 3.1]:

```
For method m with test statistic T_m and p-value p_m:
  m_m({anomalous}) = 1 - p_m                     [evidence of anomaly]
  m_m({normal})    = 0                            [methods don't assert normalcy]
  m_m(Theta)       = p_m                          [remaining uncertainty]
```

The BPAs from all methods are combined using Dempster's rule [TSG.4, Section 3.2] with
conflict resolution:

```
m_fused = m_zscore combine m_ewma combine m_cusum combine m_bocpd combine ...
```

The composite anomaly score is the belief in `{anomalous}`:

```
anomaly_score = Bel({anomalous}) = m_fused({anomalous})
```

This fusion directly uses the Dempster-Shafer framework established in TSG.4 — each
statistical detection method is treated as an independent evidence source, and the fusion
mathematics from TSG.4 applies unchanged.

### 11.2 Alert Threshold Calibration

The composite anomaly score `Bel({anomalous}) in [0, 1]` is compared against configurable
thresholds to generate alerts at different severity levels:

| Severity | Threshold (Bel) | STIX Confidence Mapping | Action |
|----------|----------------|------------------------|--------|
| **Info** | `Bel >= 0.3` | 30-49 | Log to signal metadata; no alert |
| **Low** | `Bel >= 0.5` | 50-69 | Generate low-priority alert |
| **Medium** | `Bel >= 0.7` | 70-84 | Generate alert; notify analyst |
| **High** | `Bel >= 0.85` | 85-94 | Generate urgent alert; escalate |
| **Critical** | `Bel >= 0.95` | 95-100 | Immediate alert; automatic response MAY trigger |

The thresholds MUST be configurable per signal source and analysis domain. The STIX
confidence mapping aligns anomaly scores with the confidence calibration framework
defined in TSG.4, Section 8.2.

### 11.3 False Positive Rate Control

For operational deployments, the false positive rate (FPR) must be controlled to prevent
analyst fatigue (alarm flooding).

**Bonferroni correction**: When running `M` tests simultaneously (across multiple signal
streams and detection methods), the per-test significance level MUST be adjusted:

```
alpha_adjusted = alpha_target / M
```

For `alpha_target = 0.01` (1% system-wide FPR) and `M = 100` simultaneous tests,
`alpha_adjusted = 0.0001`.

**Benjamini-Hochberg FDR control**: When the Bonferroni correction is too conservative
(too many missed detections), the False Discovery Rate (FDR) procedure [BENJAMINI-HOCHBERG-1995]
provides a less conservative alternative:

```
1. Sort all M p-values: p_(1) <= p_(2) <= ... <= p_(M)
2. Find largest k such that p_(k) <= k * alpha / M
3. Reject hypotheses 1 through k
```

The FDR procedure controls the expected proportion of false positives among all positives,
rather than the probability of any false positive.

Implementations MUST apply multiple testing correction when monitoring multiple signal
streams simultaneously. The Benjamini-Hochberg procedure is RECOMMENDED over Bonferroni
for large-scale monitoring (M > 20).

### 11.4 Integration with Alarm Pipeline

Anomaly scores from statistical analysis feed directly into Tsingou's alarm generation
pipeline. The integration points are:

| Statistical Output | Alarm Pipeline Input | Cross-Reference |
|-------------------|---------------------|-----------------|
| Composite anomaly score `Bel({anomalous})` | Alert severity determination | This section, 11.2 |
| Change-point location (CUSUM, BOCPD) | Alert timestamp and context window | Sections 4.1, 6.2 |
| Distributional test results (KS, MW) | Alert characterization metadata | Section 9.4 |
| Cross-correlation lag detection | Relationship annotation in situation graph | Section 10.3, TSG.4 |
| Spectral anomaly (flatness change) | Frequency domain alert flag | Section 8.3 |
| STL residual z-score | Pattern violation alert | Section 7.4 |

Each anomaly alert MUST carry:

1. The composite `Bel({anomalous})` score
2. The individual method scores that contributed
3. The conflict mass `K` from the Dempster-Shafer combination
4. The estimated change-point time (if applicable)
5. The baseline statistics against which the anomaly was detected

This metadata enables analyst drill-down: understanding not just THAT an anomaly occurred
but WHY the system flagged it and WHICH methods contributed to the detection.

---

## 12. Normative Constraints

| ID | Constraint | Derived From | Enforcement |
|----|-----------|--------------|-------------|
| **TSG.27-N1** | Running statistics MUST use numerically stable algorithms (Welford or equivalent) | Section 1.1 | Code review |
| **TSG.27-N2** | Chan's parallel merging MUST be used for combining statistics from parallel branches | Section 1.1 | Architecture review |
| **TSG.27-N3** | Skewness and kurtosis MUST be computed for each signal stream (Pebay algorithm) | Section 1.2 | Operator specification |
| **TSG.27-N4** | BaseSignal metadata MUST include all fields specified in Table 1.4 | Section 1.4 | Schema validation |
| **TSG.27-N5** | Z-score thresholds MUST be configurable per signal source; default z=3.0 | Section 2.1 | Configuration validation |
| **TSG.27-N6** | Modified Z-score SHOULD be default for SIGINT streams | Section 2.2 | Configuration default |
| **TSG.27-N7** | EWMA (lambda, L) pairs MUST be documented with selection rationale | Section 3.3 | Documentation review |
| **TSG.27-N8** | Both CUSUM and EWMA SHOULD run in parallel on critical streams | Section 4.5 | Monitoring configuration |
| **TSG.27-N9** | FIR CUSUM is RECOMMENDED for new signal source monitoring | Section 4.3 | Algorithm selection |
| **TSG.27-N10** | BOCPD run length vector MUST be truncated at r_max to bound cost | Section 6.2 | Runtime monitoring |
| **TSG.27-N11** | STL decomposition MUST precede anomaly detection for periodic signals | Section 7.4 | Operator ordering |
| **TSG.27-N12** | Raw periodogram MUST NOT be used for spectral estimation without smoothing | Section 8.1 | Code review |
| **TSG.27-N13** | ACF MUST be computed during baseline profiling for periodicity detection | Section 10.4 | Profiling protocol |
| **TSG.27-N14** | Cross-correlations MUST be computed in frequency domain for efficiency | Section 10.3 | Implementation review |
| **TSG.27-N15** | Composite anomaly scores MUST fuse multiple methods via Dempster-Shafer [TSG.4] | Section 11.1 | Architecture review |
| **TSG.27-N16** | Multiple testing correction MUST be applied for simultaneous monitoring | Section 11.3 | Statistical validity |
| **TSG.27-N17** | BH procedure RECOMMENDED over Bonferroni for M > 20 streams | Section 11.3 | Configuration |
| **TSG.27-N18** | Every anomaly alert MUST carry composite score, method scores, conflict mass, and baseline | Section 11.4 | Schema validation |

---

## 13. Open Questions

| ID | Question | Relevant Section | Impact |
|----|----------|-----------------|--------|
| **OQ-27.1** | What is the optimal sliding window size for each signal source type? The 5-minute default may be too short for slow-evolving sources and too long for high-frequency streams. | Section 1.4 | Configuration tuning |
| **OQ-27.2** | Should BOCPD use conjugate exponential family UPMs (efficient but limited) or nonparametric UPMs (flexible but expensive)? | Section 6.1 | Algorithm selection |
| **OQ-27.3** | Can the STL inner loop be fully replaced by EWMA for online decomposition, or does periodic full-batch STL remain necessary? | Section 7.3 | Implementation complexity |
| **OQ-27.4** | How should the Dempster-Shafer fusion weights be set when detection methods have different base false positive rates? | Section 11.1 | Calibration methodology |
| **OQ-27.5** | Should spectral flatness monitoring use absolute thresholds or relative change detection? | Section 8.3 | Alert tuning |
| **OQ-27.6** | Is the Bonferroni/BH correction sufficient, or should spatial correlation between streams be modeled for more precise FDR control? | Section 11.3 | Statistical methodology |

---

## 14. References

- [WELFORD-1962] B. P. Welford. "Note on a Method for Calculating Corrected Sums of Squares and Products." Technometrics, 4(3):419-420, 1962.
- [CHAN-1979] T. F. Chan, G. H. Golub, R. J. LeVeque. "Updating Formulae and a Pairwise Algorithm for Computing Sample Variances." Stanford University Technical Report STAN-CS-79-773, 1979.
- [PEBAY-2008] P. Pebay. "Formulas for Robust, One-Pass Parallel Computation of Covariances and Arbitrary-Order Statistical Moments." Sandia National Laboratories Report SAND2008-6212, 2008.
- [DUNNING-2021] T. Dunning, O. Ertl. "Computing Extremely Accurate Quantiles Using t-Digests." arXiv:1902.04023, 2021.
- [KNUTH-1997] D. E. Knuth. The Art of Computer Programming, Volume 2: Seminumerical Algorithms. 3rd ed., Addison-Wesley, 1997.
- [IGLEWICZ-HOAGLIN-1993] B. Iglewicz, D. C. Hoaglin. Volume 16: How to Detect and Handle Outliers. ASQC Quality Press, 1993.
- [ROBERTS-1959] S. W. Roberts. "Control Chart Tests Based on Geometric Moving Averages." Technometrics, 1(3):239-250, 1959.
- [PAGE-1954] E. S. Page. "Continuous Inspection Schemes." Biometrika, 41(1/2):100-115, 1954.
- [WALD-1945] A. Wald. "Sequential Tests of Statistical Hypotheses." Annals of Mathematical Statistics, 16(2):117-186, 1945.
- [MOUSTAKIDES-1986] G. V. Moustakides. "Optimal Stopping Times for Detecting Changes in Distributions." Annals of Statistics, 14(4):1379-1387, 1986.
- [CROSIER-1988] R. B. Crosier. "Multivariate Generalizations of Cumulative Sum Quality-Control Schemes." Technometrics, 30(3):291-303, 1988.
- [PIGNATIELLO-1990] J. J. Pignatiello, G. C. Runger. "Comparisons of Multivariate CUSUM Charts." Journal of Quality Technology, 22(3):173-186, 1990.
- [GRUBBS-1950] F. E. Grubbs. "Sample Criteria for Testing Outlying Observations." Annals of Mathematical Statistics, 21(1):27-58, 1950.
- [ROSNER-1983] B. Rosner. "Percentage Points for a Generalized ESD Many-Outlier Procedure." Technometrics, 25(2):165-172, 1983.
- [DIXON-1950] W. J. Dixon. "Analysis of Extreme Values." Annals of Mathematical Statistics, 21(4):488-506, 1950.
- [ADAMS-MACKAY-2007] R. P. Adams, D. J. C. MacKay. "Bayesian Online Changepoint Detection." arXiv:0710.3742, 2007.
- [CLEVELAND-1990] R. B. Cleveland, W. S. Cleveland, J. E. McRae, I. Terpenning. "STL: A Seasonal-Trend Decomposition Procedure Based on Loess." Journal of Official Statistics, 6(1):3-73, 1990.
- [WELCH-1967] P. D. Welch. "The Use of Fast Fourier Transform for the Estimation of Power Spectra." IEEE Transactions on Audio and Electroacoustics, 15(2):70-73, 1967.
- [KOLMOGOROV-1933] A. N. Kolmogorov. "Sulla determinazione empirica di una legge di distribuzione." Giornale dell'Istituto Italiano degli Attuari, 4:83-91, 1933.
- [SMIRNOV-1948] N. V. Smirnov. "Table for Estimating the Goodness of Fit of Empirical Distributions." Annals of Mathematical Statistics, 19(2):279-281, 1948.
- [ANDERSON-DARLING-1952] T. W. Anderson, D. A. Darling. "Asymptotic Theory of Certain 'Goodness of Fit' Criteria Based on Stochastic Processes." Annals of Mathematical Statistics, 23(2):193-212, 1952.
- [MANN-WHITNEY-1947] H. B. Mann, D. R. Whitney. "On a Test of Whether One of Two Random Variables is Stochastically Larger than the Other." Annals of Mathematical Statistics, 18(1):50-60, 1947.
- [PEARSON-1895] K. Pearson. "Notes on Regression and Inheritance in the Case of Two Parents." Proceedings of the Royal Society, 58:240-242, 1895.
- [SPEARMAN-1904] C. Spearman. "The Proof and Measurement of Association between Two Things." American Journal of Psychology, 15(1):72-101, 1904.
- [BENJAMINI-HOCHBERG-1995] Y. Benjamini, Y. Hochberg. "Controlling the False Discovery Rate: A Practical and Powerful Approach to Multiple Testing." Journal of the Royal Statistical Society Series B, 57(1):289-300, 1995.
- [RFC2119] S. Bradner. "Key Words for Use in RFCs to Indicate Requirement Levels." RFC 2119, March 1997.
- [RFC8174] B. Leiba. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." RFC 8174, May 2017.

---

*End of Section TSG.27*
