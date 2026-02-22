# RFC-002 Section TSG.31: Analysis Techniques Catalog

```
Section:       TSG.31 — Analysis Techniques Catalog
Parent RFC:    RFC-002 (Tsingou — Signal Intelligence Visualization Platform)
Status:        DRAFT
Author:        dataflow-theorist (Val team)
Created:       2026-02-18
Research Base: Synthesized from TSG.4, TSG.25, TSG.26, TSG.27, TSG.28, TSG.29, TSG.30
Part:          VI — Analysis & Mathematics
```

> This section provides a unified catalog of all analysis techniques available in the
> Tsingou platform, synthesizing the mathematical foundations established in Sections
> TSG.4 (Data Fusion), TSG.25 (DSP), TSG.26 (Differential Dataflow), TSG.27 (Statistics),
> TSG.28 (Graph Theory), TSG.29 (Information Theory), and TSG.30 (Geospatial Mathematics).
> For each technique, this catalog specifies: mathematical domain, d2ts operator mapping,
> input signal types, output enrichments, rendering layer affinity, intelligence cycle
> phase, computational complexity, and normative requirements. Implementations MUST
> support the techniques marked REQUIRED in this catalog. The key words "MUST", "MUST
> NOT", "SHOULD", "SHOULD NOT", and "MAY" are to be interpreted as described in
> [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Scope and Purpose](#1-scope-and-purpose)
2. [Catalog Structure](#2-catalog-structure)
3. [Technique Domain: Digital Signal Processing (TSG.25)](#3-technique-domain-digital-signal-processing-tsg25)
4. [Technique Domain: Differential Dataflow (TSG.26)](#4-technique-domain-differential-dataflow-tsg26)
5. [Technique Domain: Statistical Analysis (TSG.27)](#5-technique-domain-statistical-analysis-tsg27)
6. [Technique Domain: Graph Theory (TSG.28)](#6-technique-domain-graph-theory-tsg28)
7. [Technique Domain: Information Theory (TSG.29)](#7-technique-domain-information-theory-tsg29)
8. [Technique Domain: Geospatial Mathematics (TSG.30)](#8-technique-domain-geospatial-mathematics-tsg30)
9. [Technique Domain: Data Fusion (TSG.4)](#9-technique-domain-data-fusion-tsg4)
10. [Cross-Domain Composite Techniques](#10-cross-domain-composite-techniques)
11. [ADR-013 Analysis Techniques Mapping](#11-adr-013-analysis-techniques-mapping)
12. [d2ts Operator-to-Technique Matrix](#12-d2ts-operator-to-technique-matrix)
13. [Rendering Layer Affinity Matrix](#13-rendering-layer-affinity-matrix)
14. [Intelligence Cycle Phase Mapping](#14-intelligence-cycle-phase-mapping)
15. [Computational Complexity Summary](#15-computational-complexity-summary)
16. [Normative Requirements](#16-normative-requirements)
17. [Open Questions](#17-open-questions)
18. [Bibliography](#18-bibliography)

---

## 1. Scope and Purpose

### 1.1 Catalog Rationale

The Tsingou platform specification defines mathematical foundations across seven RFC
sections (TSG.4, TSG.25, TSG.26, TSG.27, TSG.28, TSG.29, TSG.30), totaling over
10,000 lines of formal definitions, algorithms, and normative requirements. While each
section is internally complete, analysts and implementers need a single reference that:

1. **Enumerates** every available technique in a uniform format
2. **Maps** each technique to its d2ts operator realization
3. **Classifies** techniques by rendering layer, intelligence phase, and signal type
4. **Specifies** computational complexity bounds for capacity planning
5. **Identifies** cross-domain techniques that span multiple mathematical foundations

This catalog serves as the implementer's index into the mathematical specification.
Technique entries reference their source sections for full mathematical detail;
this section does NOT duplicate the formal definitions.

### 1.2 Technique Lifecycle

Each technique in the catalog follows a standard lifecycle within the Tsingou pipeline:

```
Signal Ingestion               Analysis                     Visualization
─────────────────      ──────────────────────      ─────────────────────────
Source Adapter         d2ts Operator(s)              Rendering Layer
  → BaseSignal           → Technique Application       → Visual Output
    → MultiSet             → Enriched Signal              → Analyst Interaction
      → Ingest Graph         → Atom State                   → Intelligence Product
```

A technique is characterized by WHERE it executes in this pipeline (ingest vs. derived
graph), WHAT operators it requires, and HOW the output renders.

### 1.3 Technique Classification Axes

Each technique is classified along six axes:

| Axis | Values | Purpose |
|------|--------|---------|
| **Math Domain** | DSP, Statistics, Graph, InfoTheory, Geospatial, Fusion | Source section reference |
| **d2ts Operators** | map, filter, join, reduce, iterate, window, custom | Implementation mapping |
| **Signal Types** | RF/SDR, OSINT, COMINT, SIGINT, Cyber, Multi-INT | Applicability |
| **Rendering Layer** | R3F (z:0), visx (z:1), p5 (z:2), DOM (z:3) | Visualization target |
| **Intel Phase** | Collection, Processing, Analysis, Dissemination | Cycle mapping |
| **Requirement Level** | REQUIRED, RECOMMENDED, OPTIONAL | Implementation priority |

---

## 2. Catalog Structure

### 2.1 Technique Entry Format

Each technique entry follows a standardized format:

```
### N.M Technique Name

**Source:** TSG.XX Section Y.Z
**Math Domain:** {DSP | Statistics | Graph | InfoTheory | Geospatial | Fusion}
**Requirement Level:** {REQUIRED | RECOMMENDED | OPTIONAL}

| Attribute | Value |
|-----------|-------|
| d2ts Operators | {operator list} |
| Input Signal Types | {signal types} |
| Output Enrichment | {BaseSignal metadata fields} |
| Rendering Layer | {layer(s)} |
| Intel Phase | {phase(s)} |
| Time Complexity | O(...) |
| Space Complexity | O(...) |
| Incremental? | {Yes / Warm-start / No} |
| NATS Subject | tsingou.analysis.{category}.{technique} |

**Brief Description:** One-paragraph summary of what the technique computes and why.

**Normative Requirements:** List of MUST/SHOULD constraints from source section.
```

### 2.2 Technique Identifier Convention

Each technique receives a unique identifier: `AT-{domain}-{sequence}`.

| Prefix | Domain | Section |
|--------|--------|---------|
| AT-DSP | Digital Signal Processing | TSG.25 |
| AT-DDF | Differential Dataflow | TSG.26 |
| AT-STA | Statistical Analysis | TSG.27 |
| AT-GRA | Graph Theory | TSG.28 |
| AT-INF | Information Theory | TSG.29 |
| AT-GEO | Geospatial Mathematics | TSG.30 |
| AT-FUS | Data Fusion | TSG.4 |
| AT-CMP | Cross-Domain Composite | Multiple |

---

## 3. Technique Domain: Digital Signal Processing (TSG.25)

### 3.1 AT-DSP-01: Fast Fourier Transform (FFT) Spectral Analysis

**Source:** TSG.25 Sections 2.1-2.5
**Math Domain:** DSP
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `map` (windowing), custom (FFT computation) |
| Input Signal Types | RF/SDR (IQ samples, FFT magnitude arrays) |
| Output Enrichment | `spectralPeaks`, `peakFrequency`, `bandwidth` |
| Rendering Layer | visx (z:1) spectrum plot, p5 (z:2) waterfall |
| Intel Phase | Processing |
| Time Complexity | O(N log N) per FFT frame, N = FFT size |
| Space Complexity | O(N) |
| Incremental? | No (per-frame computation) |
| NATS Subject | `tsingou.analysis.dsp.fft` |

**Brief Description:** Transforms time-domain IQ samples into frequency-domain
magnitude spectra via the Fast Fourier Transform. The FFT is the fundamental building
block for all spectral visualization (spectrum plots, waterfall displays, spectrograms).
Implementations MUST use O(N log N) algorithms (Cooley-Tukey radix-2 or split-radix
for power-of-two sizes; Bluestein for arbitrary sizes).

**Normative Requirements:**
- MUST NOT use O(N^2) DFT for N > 64 [TSG.25 DSP-1]
- MUST achieve O(N log N) complexity for all FFT computations [TSG.25 Sec 2.5.4]

### 3.2 AT-DSP-02: Windowed Spectral Analysis

**Source:** TSG.25 Section 3
**Math Domain:** DSP
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `map` (window application) |
| Input Signal Types | RF/SDR (IQ samples) |
| Output Enrichment | `windowType`, `enbw`, `processingLoss` |
| Rendering Layer | visx (z:1), p5 (z:2) |
| Intel Phase | Processing |
| Time Complexity | O(N) per frame |
| Space Complexity | O(N) for window coefficients |
| Incremental? | No (per-frame) |
| NATS Subject | `tsingou.analysis.dsp.windowing` |

**Brief Description:** Applies window functions (Hann, Hamming, Blackman, Blackman-Harris,
Kaiser, Flat-top) before FFT to control spectral leakage. Window selection trades off
frequency resolution against sidelobe suppression. Critical for SIGINT where weak signals
near strong emitters must be detectable.

**Normative Requirements:**
- MUST apply window before FFT for spectral displays [TSG.25 DSP-2]
- MUST normalize windows for correct PSD computation [TSG.25 DSP-3]
- MUST document ENBW of applied window [TSG.25 DSP-4]

### 3.3 AT-DSP-03: Power Spectral Density Estimation (Welch)

**Source:** TSG.25 Section 9.3
**Math Domain:** DSP
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `window` (segment overlap), `reduce` (averaging) |
| Input Signal Types | RF/SDR (IQ samples) |
| Output Enrichment | `psdEstimate`, `varianceReduction`, `frequencyResolution` |
| Rendering Layer | visx (z:1) PSD plot |
| Intel Phase | Processing |
| Time Complexity | O(K * L log L), K segments of length L |
| Space Complexity | O(L) |
| Incremental? | Yes (running average) |
| NATS Subject | `tsingou.analysis.dsp.psd` |

**Brief Description:** Welch's method divides data into overlapping windowed segments,
computes periodograms, and averages them to reduce PSD variance. This is the REQUIRED
default spectral estimator for all real-time displays.

**Normative Requirements:**
- MUST use Welch's method as default PSD estimator [TSG.25 DSP-14]
- MUST correctly display PSD in dBm/Hz, dBm, or dBFS [TSG.25 DSP-15]

### 3.4 AT-DSP-04: Waterfall / Spectrogram Display

**Source:** TSG.25 Section 10
**Math Domain:** DSP
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `map` (dB conversion, color mapping), custom (scroll buffer) |
| Input Signal Types | RF/SDR (FFT magnitude arrays) |
| Output Enrichment | `spectrogramFrame`, `timeFrequencyMatrix` |
| Rendering Layer | p5 (z:2) WebGL pixel buffer |
| Intel Phase | Processing, Analysis |
| Time Complexity | O(N) per frame (color mapping) |
| Space Complexity | O(N * T) for T-frame scroll buffer |
| Incremental? | Yes (append-only scroll) |
| NATS Subject | `tsingou.analysis.dsp.waterfall` |

**Brief Description:** The waterfall display maps successive STFT frames to a scrolling
2D image with frequency on the horizontal axis, time on the vertical axis, and power
encoded as color. This is the primary wideband monitoring visualization for SIGINT.

**Normative Requirements:**
- MUST achieve >= 10 fps waterfall update rate [TSG.25 DSP-16]
- MUST display >= 60 dB dynamic range [TSG.25 DSP-17]
- SHOULD use perceptually uniform color maps (Viridis, Inferno, Turbo) [TSG.25 DSP-S10]

### 3.5 AT-DSP-05: Demodulation (AM/FM/SSB/Digital)

**Source:** TSG.25 Section 6
**Math Domain:** DSP
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `map` (IQ processing), custom (PLL, discriminator) |
| Input Signal Types | RF/SDR (IQ samples) |
| Output Enrichment | `modulationType`, `demodAudio`, `symbolRate`, `constellation` |
| Rendering Layer | visx (z:1) constellation, audio player (DOM z:3) |
| Intel Phase | Processing |
| Time Complexity | O(N) per sample block |
| Space Complexity | O(1) (stateful filter state) |
| Incremental? | Yes (streaming) |
| NATS Subject | `tsingou.analysis.dsp.demod` |

**Brief Description:** Extracts information-bearing baseband signals from modulated
carriers. Supports AM envelope detection, FM discriminator, SSB (USB/LSB) demodulation,
and digital PSK/QAM constellation visualization. The GNU Radio sidecar performs heavy
demodulation; Tsingou visualizes results and provides operator controls.

**Normative Requirements:**
- MUST support AM envelope detection [TSG.25 DSP-9]
- MUST support USB/LSB demodulation with configurable BFO [TSG.25 DSP-10]
- MUST support constellation diagram visualization [TSG.25 DSP-11]

### 3.6 AT-DSP-06: Time-Frequency Analysis (STFT/CWT)

**Source:** TSG.25 Sections 10.1-10.5
**Math Domain:** DSP
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `window` (frame segmentation), `map` (transform) |
| Input Signal Types | RF/SDR (IQ samples) |
| Output Enrichment | `timeFrequencyMatrix`, `waveletCoefficients` |
| Rendering Layer | p5 (z:2) |
| Intel Phase | Analysis |
| Time Complexity | O(N log N) per STFT frame; O(N * S) for CWT with S scales |
| Space Complexity | O(N * F) for F frames |
| Incremental? | Yes (STFT is streaming); No (CWT offline) |
| NATS Subject | `tsingou.analysis.dsp.timefreq` |

**Brief Description:** The Short-Time Fourier Transform provides fixed-resolution
time-frequency analysis for spectrograms. The Continuous Wavelet Transform provides
variable resolution — better time resolution at high frequencies, better frequency
resolution at low frequencies — suited to chirp and transient detection.

**Normative Requirements:**
- MUST NOT require CWT/DWT for real-time visualization [TSG.25 Sec 10.5]
- MAY offer reassigned spectrogram for enhanced localization [TSG.25 DSP-M6]

### 3.7 AT-DSP-07: Noise Floor and Dynamic Range Measurement

**Source:** TSG.25 Section 11
**Math Domain:** DSP
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (noise statistics), `map` (calibration) |
| Input Signal Types | RF/SDR (FFT magnitude, device metadata) |
| Output Enrichment | `noiseFloorDbm`, `dynamicRangeDb`, `enob`, `sfdr` |
| Rendering Layer | DOM (z:3) status panel, visx (z:1) noise marker |
| Intel Phase | Collection, Processing |
| Time Complexity | O(N) per measurement |
| Space Complexity | O(1) |
| Incremental? | Yes (running statistics) |
| NATS Subject | `tsingou.analysis.dsp.noise` |

**Brief Description:** Measures the receiver noise floor, effective number of bits
(ENOB), spurious-free dynamic range (SFDR), and processing gain. These calibration
metrics inform detection thresholds and display scaling.

**Normative Requirements:**
- MUST use ENOB for dynamic range calculations [TSG.25 DSP-19]
- MUST account for processing gain in detection thresholds [TSG.25 DSP-20]
- MUST display SDR hardware noise floor and dynamic range [TSG.25 DSP-21]

---

## 4. Technique Domain: Differential Dataflow (TSG.26)

### 4.1 AT-DDF-01: Incremental Collection Maintenance

**Source:** TSG.26 Sections 4.1-4.3
**Math Domain:** Differential Dataflow
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | All operators (core substrate) |
| Input Signal Types | All (universal) |
| Output Enrichment | `version`, `multiplicity`, `frontierStatus` |
| Rendering Layer | All (infrastructure) |
| Intel Phase | Processing |
| Time Complexity | O(|delta|) for linear ops; O(|delta| * |S|) for stateful |
| Space Complexity | O(|S|) accumulated state |
| Incremental? | Yes (by definition) |
| NATS Subject | N/A (internal substrate) |

**Brief Description:** The differential dataflow substrate maintains versioned
collections as functions from data to integer multiplicities. When input changes by
delta, only affected portions of derived state recompute. This is not a user-facing
technique but the computational foundation enabling all other techniques to operate
incrementally.

**Normative Requirements:**
- MUST respect Abelian group structure on collections [TSG.26 Sec 15.1.1]
- MUST advance frontiers monotonically [TSG.26 Sec 15.1.2]
- MUST guarantee incremental-batch equivalence [TSG.26 Sec 15.1.3]

### 4.2 AT-DDF-02: Cross-Source Signal Correlation (Join)

**Source:** TSG.26 Section 6.2
**Math Domain:** Differential Dataflow
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `join` (bilinear), `reduce` (key extraction) |
| Input Signal Types | Multi-INT (cross-source) |
| Output Enrichment | `correlatedSignals`, `joinKey`, `correlationScore` |
| Rendering Layer | R3F (z:0) graph edges, visx (z:1) timeline |
| Intel Phase | Analysis |
| Time Complexity | O(|dA| * |S_B| + |S_A| * |dB| + |dA| * |dB|) |
| Space Complexity | O(|S_A| + |S_B|) Index state |
| Incremental? | Yes (bilinear delta propagation) |
| NATS Subject | `tsingou.analysis.correlation.join` |

**Brief Description:** Joins signals from independent sources by a shared key (timestamp
bucket, geographic region, entity identifier, topic). The join is bilinear: when source
A changes by dA, the output change is dA join B + A join dB + dA join dB. The
JoinOperator maintains two Index structures for accumulated state.

**Normative Requirements:**
- SHOULD use windowed joins to limit accumulated state [TSG.26 Sec 15.2.3]
- MUST NOT assume total order on versions [TSG.26 Sec 15.3.1]

### 4.3 AT-DDF-03: Sliding Window Computation

**Source:** TSG.26 Section 11.3, `src/lib/tsingou-flow/operators/window.ts`
**Math Domain:** Differential Dataflow
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `window` (custom operator) |
| Input Signal Types | All (universal) |
| Output Enrichment | `windowStart`, `windowEnd`, `windowSize` |
| Rendering Layer | All (infrastructure) |
| Intel Phase | Processing |
| Time Complexity | O(|delta|) per advancement |
| Space Complexity | O(W) where W = window size in signals |
| Incremental? | Yes (slide emits additions and retractions) |
| NATS Subject | N/A (internal operator) |

**Brief Description:** Maintains a time-bounded view of recent signals. As the window
advances, old signals are retracted (multiplicity -1) and new signals are inserted
(multiplicity +1). The window operator is the temporal substrate for all time-bounded
analyses (running statistics, temporal correlation, activity monitoring).

### 4.4 AT-DDF-04: Fixed-Point Iteration (Iterate)

**Source:** TSG.26 Section 6.5
**Math Domain:** Differential Dataflow
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `iterate` |
| Input Signal Types | All (convergence computations) |
| Output Enrichment | `iterationCount`, `convergenceResidual` |
| Rendering Layer | Depends on enclosed computation |
| Intel Phase | Analysis |
| Time Complexity | O(|delta| * I), I = iterations to convergence |
| Space Complexity | O(|S|) per iteration dimension |
| Incremental? | Yes (extended version space) |
| NATS Subject | N/A (internal operator) |

**Brief Description:** Computes least fixed points by extending the version space with
an iteration dimension. Used for convergent algorithms: PageRank, eigenvector centrality,
label propagation, iterative entity resolution. Convergence is detected dynamically
(no fixed iteration bound).

**Normative Requirements:**
- MUST detect convergence dynamically [TSG.26 Sec 6.5]
- MUST NOT assume fixed iteration bound [TSG.26 Sec 6.5]

---

## 5. Technique Domain: Statistical Analysis (TSG.27)

### 5.1 AT-STA-01: Running Descriptive Statistics (Welford)

**Source:** TSG.27 Section 1.1
**Math Domain:** Statistics
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (running accumulation) |
| Input Signal Types | All numeric signal streams |
| Output Enrichment | `mean`, `variance`, `stddev`, `count` |
| Rendering Layer | DOM (z:3) metrics panel, visx (z:1) trend line |
| Intel Phase | Processing |
| Time Complexity | O(1) per observation |
| Space Complexity | O(1) per stream (3 accumulators) |
| Incremental? | Yes (online algorithm) |
| NATS Subject | `tsingou.analysis.stats.descriptive` |

**Brief Description:** Welford's online algorithm computes running mean and variance
in a single pass with O(1) memory, avoiding the catastrophic cancellation of the naive
two-pass formula. Chan's parallel algorithm merges statistics from concurrent branches.

**Normative Requirements:**
- MUST use numerically stable algorithms (Welford or equivalent) [TSG.27-N1]
- MUST use Chan's parallel merging for parallel branches [TSG.27-N2]

### 5.2 AT-STA-02: Higher-Order Moments (Skewness, Kurtosis)

**Source:** TSG.27 Section 1.2
**Math Domain:** Statistics
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (Pebay algorithm) |
| Input Signal Types | All numeric signal streams |
| Output Enrichment | `skewness`, `kurtosis`, `excessKurtosis` |
| Rendering Layer | DOM (z:3) distribution summary |
| Intel Phase | Processing |
| Time Complexity | O(1) per observation |
| Space Complexity | O(1) per stream (4 accumulators) |
| Incremental? | Yes (online algorithm) |
| NATS Subject | `tsingou.analysis.stats.moments` |

**Brief Description:** Extends Welford's algorithm to compute third and fourth central
moments (skewness and kurtosis) in a single pass. Kurtosis detects heavy-tailed
distributions (potential anomaly indicators); skewness detects asymmetric activity.

**Normative Requirements:**
- MUST compute skewness and kurtosis for each signal stream [TSG.27-N3]

### 5.3 AT-STA-03: Z-Score Anomaly Detection

**Source:** TSG.27 Section 2
**Math Domain:** Statistics
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `map` (z-score computation), `filter` (threshold) |
| Input Signal Types | All numeric signal streams |
| Output Enrichment | `zScore`, `isAnomaly`, `anomalyDirection` |
| Rendering Layer | DOM (z:3) alert panel, visx (z:1) deviation overlay |
| Intel Phase | Analysis |
| Time Complexity | O(1) per observation (given running stats) |
| Space Complexity | O(1) |
| Incremental? | Yes |
| NATS Subject | `tsingou.analysis.anomaly.zscore` |

**Brief Description:** Computes the z-score z = (x - mu) / sigma for each observation
against the running baseline. Observations with |z| > threshold (default 3.0) are
flagged as anomalies. The modified z-score (using median and MAD) provides robustness
against masking by prior outliers.

**Normative Requirements:**
- MUST have configurable thresholds per signal source [TSG.27-N5]
- Modified z-score SHOULD be default for SIGINT streams [TSG.27-N6]

### 5.4 AT-STA-04: EWMA Control Chart

**Source:** TSG.27 Section 3
**Math Domain:** Statistics
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (recursive EWMA), `filter` (control limits) |
| Input Signal Types | All numeric signal streams |
| Output Enrichment | `ewmaValue`, `controlLimitUpper`, `controlLimitLower`, `outOfControl` |
| Rendering Layer | visx (z:1) control chart, DOM (z:3) alert |
| Intel Phase | Analysis |
| Time Complexity | O(1) per observation |
| Space Complexity | O(1) (single state variable Z_i) |
| Incremental? | Yes |
| NATS Subject | `tsingou.analysis.anomaly.ewma` |

**Brief Description:** The Exponentially Weighted Moving Average applies exponential
decay weighting (lambda parameter) to detect small persistent shifts in the signal
mean. EWMA is sensitive to sustained level changes; CUSUM (AT-STA-05) detects
abrupt shifts. Both SHOULD run in parallel on critical streams.

**Normative Requirements:**
- MUST document (lambda, L) pairs with selection rationale [TSG.27-N7]
- Both CUSUM and EWMA SHOULD run in parallel on critical streams [TSG.27-N8]

### 5.5 AT-STA-05: CUSUM Change-Point Detection

**Source:** TSG.27 Section 4
**Math Domain:** Statistics
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (cumulative sum), `filter` (threshold) |
| Input Signal Types | All numeric signal streams |
| Output Enrichment | `cusumPlus`, `cusumMinus`, `changePointDetected`, `shiftMagnitude` |
| Rendering Layer | visx (z:1) CUSUM chart, DOM (z:3) alert |
| Intel Phase | Analysis |
| Time Complexity | O(1) per observation |
| Space Complexity | O(1) (two accumulators S+, S-) |
| Incremental? | Yes |
| NATS Subject | `tsingou.analysis.anomaly.cusum` |

**Brief Description:** Page's Cumulative Sum algorithm maintains running sums of
deviations from the target mean, detecting both positive and negative shifts. Tabular
CUSUM uses decision threshold h and slack parameter k. Fast Initial Response (FIR)
CUSUM starts with S_0 = h/2 for faster detection of initial-state anomalies.

**Normative Requirements:**
- FIR CUSUM is RECOMMENDED for new signal source monitoring [TSG.27-N9]
- Both CUSUM and EWMA SHOULD run in parallel on critical streams [TSG.27-N8]

### 5.6 AT-STA-06: Grubbs/ESD Outlier Detection

**Source:** TSG.27 Section 5
**Math Domain:** Statistics
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (windowed statistics), `filter` (test) |
| Input Signal Types | Batch/windowed signal collections |
| Output Enrichment | `grubbsStatistic`, `isOutlier`, `outlierCount` |
| Rendering Layer | visx (z:1) box plot, DOM (z:3) outlier list |
| Intel Phase | Analysis |
| Time Complexity | O(N) per test; O(k * N) for ESD with k outliers |
| Space Complexity | O(N) (window buffer) |
| Incremental? | No (batch per window) |
| NATS Subject | `tsingou.analysis.anomaly.outlier` |

**Brief Description:** Grubbs' test detects single outliers in normally distributed
windowed samples. The Generalized Extreme Studentized Deviate (ESD) procedure extends
to k simultaneous outliers. Dixon's Q test provides a quick approximation for small
samples (N < 25).

### 5.7 AT-STA-07: Bayesian Online Change-Point Detection (BOCPD)

**Source:** TSG.27 Section 6
**Math Domain:** Statistics
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (run length posterior), `map` (hazard) |
| Input Signal Types | All numeric signal streams |
| Output Enrichment | `runLength`, `changePointProbability`, `posteriorSegments` |
| Rendering Layer | visx (z:1) run length heatmap, DOM (z:3) segment boundaries |
| Intel Phase | Analysis |
| Time Complexity | O(r_max) per observation, r_max = max run length |
| Space Complexity | O(r_max) |
| Incremental? | Yes (sequential posterior update) |
| NATS Subject | `tsingou.analysis.anomaly.bocpd` |

**Brief Description:** Adams-MacKay BOCPD maintains a posterior distribution over the
current "run length" (time since last change point). Unlike CUSUM/EWMA which detect
deviations from a fixed baseline, BOCPD adapts to regime changes and provides
probabilistic confidence in change-point locations.

**Normative Requirements:**
- MUST truncate run length vector at r_max [TSG.27-N10]

### 5.8 AT-STA-08: Time Series Decomposition (STL)

**Source:** TSG.27 Section 7
**Math Domain:** Statistics
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `window` (seasonal window), `reduce` (LOESS smoother) |
| Input Signal Types | Periodic/seasonal signal streams |
| Output Enrichment | `trendComponent`, `seasonalComponent`, `residualComponent` |
| Rendering Layer | visx (z:1) decomposition plot |
| Intel Phase | Processing, Analysis |
| Time Complexity | O(N * P) per decomposition, P = seasonal period |
| Space Complexity | O(N) |
| Incremental? | No (batch per window) |
| NATS Subject | `tsingou.analysis.stats.decomposition` |

**Brief Description:** STL (Seasonal and Trend decomposition using LOESS) separates
a time series into trend, seasonal, and residual components. The residual component
feeds anomaly detection — anomalies are deviations from expected trend + season.

**Normative Requirements:**
- MUST precede anomaly detection for periodic signals [TSG.27-N11]

### 5.9 AT-STA-09: Correlation and Cross-Correlation

**Source:** TSG.27 Section 10
**Math Domain:** Statistics
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `join` (pairwise), `reduce` (correlation computation) |
| Input Signal Types | Multi-source numeric streams |
| Output Enrichment | `pearsonR`, `spearmanRho`, `lagAtMaxCorrelation`, `acfValues` |
| Rendering Layer | visx (z:1) correlogram, R3F (z:0) correlation network |
| Intel Phase | Analysis |
| Time Complexity | O(N log N) per pair (FFT-based cross-correlation) |
| Space Complexity | O(N) per pair |
| Incremental? | Partially (FFT-based requires window) |
| NATS Subject | `tsingou.analysis.stats.correlation` |

**Brief Description:** Measures linear (Pearson) and rank-order (Spearman) correlation
between signal streams. Cross-correlation with lag detection identifies delayed causal
relationships between sources. Autocorrelation (ACF/PACF) detects periodicity and
temporal structure.

**Normative Requirements:**
- MUST compute cross-correlations in frequency domain [TSG.27-N14]
- MUST compute ACF during baseline profiling [TSG.27-N13]

### 5.10 AT-STA-10: Composite Anomaly Scoring

**Source:** TSG.27 Section 11
**Math Domain:** Statistics + Fusion
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (score fusion), `map` (normalization) |
| Input Signal Types | All (combines outputs from AT-STA-03 through AT-STA-07) |
| Output Enrichment | `compositeAnomalyScore`, `methodScores`, `conflictMass` |
| Rendering Layer | DOM (z:3) alert panel, visx (z:1) anomaly timeline |
| Intel Phase | Analysis |
| Time Complexity | O(M) per observation, M = number of anomaly methods |
| Space Complexity | O(M) |
| Incremental? | Yes |
| NATS Subject | `tsingou.analysis.anomaly.composite` |

**Brief Description:** Fuses anomaly scores from multiple detection methods (z-score,
EWMA, CUSUM, BOCPD) into a single composite score using Dempster-Shafer combination
(cross-reference TSG.4). Reduces false positives by requiring agreement across methods.

**Normative Requirements:**
- MUST fuse methods via Dempster-Shafer [TSG.27-N15]
- MUST apply multiple testing correction for M > 20 streams [TSG.27-N16]
- Every alert MUST carry composite score, method scores, conflict mass [TSG.27-N18]

---

## 6. Technique Domain: Graph Theory (TSG.28)

### 6.1 AT-GRA-01: Degree Centrality

**Source:** TSG.28 Section 3.1
**Math Domain:** Graph Theory
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `count` (per-vertex edge count) |
| Input Signal Types | STIX SDO/SRO graphs (OSINT, COMINT, Cyber) |
| Output Enrichment | `degreeIn`, `degreeOut`, `degreeTotal`, `degreeCentrality` |
| Rendering Layer | R3F (z:0) node size, visx (z:1) bar chart |
| Intel Phase | Analysis |
| Time Complexity | O(n + m) |
| Space Complexity | O(n) |
| Incremental? | Yes (O(1) per edge addition) |
| NATS Subject | `tsingou.analysis.graph.centrality.degree` |

**Brief Description:** Counts direct connections per entity. In-degree measures prestige
(receiving); out-degree measures activity (initiating). Hub entities with high total
degree are central to communication structure.

**Normative Requirements:**
- MUST compute in-degree and out-degree independently [TSG.28 NC-5, Sec 3.1]

### 6.2 AT-GRA-02: Betweenness Centrality (Brandes)

**Source:** TSG.28 Section 3.2
**Math Domain:** Graph Theory
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | Custom (Brandes BFS/Dijkstra), debounced recomputation |
| Input Signal Types | STIX SDO/SRO graphs |
| Output Enrichment | `betweennessCentrality`, `normalizedBetweenness` |
| Rendering Layer | R3F (z:0) node color/glow, visx (z:1) ranking |
| Intel Phase | Analysis |
| Time Complexity | O(n * m) unweighted; O(n * m + n^2 log n) weighted |
| Space Complexity | O(n + m) |
| Incremental? | No (full recompute; debounce at 1Hz) |
| NATS Subject | `tsingou.analysis.graph.centrality.betweenness` |

**Brief Description:** Identifies brokers and gatekeepers — entities controlling
information flow between otherwise disconnected groups. Uses Brandes' algorithm for
efficient all-vertex computation. High-betweenness vertices are optimal disruption
targets in dark network analysis.

**Normative Requirements:**
- MUST use Brandes algorithm [TSG.28 NC-1]
- MUST NOT use naive O(n^3) APSP [TSG.28 NC-1]
- MUST normalize to [0, 1] [TSG.28 NC-5]

### 6.3 AT-GRA-03: Harmonic Closeness Centrality

**Source:** TSG.28 Section 3.3
**Math Domain:** Graph Theory
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | Custom (BFS/Dijkstra from each vertex) |
| Input Signal Types | STIX SDO/SRO graphs |
| Output Enrichment | `harmonicCentrality` |
| Rendering Layer | R3F (z:0) node color, visx (z:1) ranking |
| Intel Phase | Analysis |
| Time Complexity | O(n * m) |
| Space Complexity | O(n) |
| Incremental? | No (full recompute) |
| NATS Subject | `tsingou.analysis.graph.centrality.closeness` |

**Brief Description:** Measures proximity to all other entities using harmonic mean of
inverse distances. Unlike classical closeness, harmonic centrality is well-defined on
disconnected graphs (critical for intelligence networks with partial observation).

**Normative Requirements:**
- MUST use harmonic centrality over classical closeness [TSG.28 NC-2]

### 6.4 AT-GRA-04: PageRank

**Source:** TSG.28 Section 3.5
**Math Domain:** Graph Theory
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `iterate` (power iteration convergence) |
| Input Signal Types | STIX SDO/SRO graphs |
| Output Enrichment | `pageRank`, `pageRankRank` |
| Rendering Layer | R3F (z:0) node size, visx (z:1) ranking |
| Intel Phase | Analysis |
| Time Complexity | O(m * iters), iters ~ 50-100 |
| Space Complexity | O(n) |
| Incremental? | Warm-start via d2ts iterate |
| NATS Subject | `tsingou.analysis.graph.centrality.pagerank` |

**Brief Description:** Google's eigenvector-variant centrality with damping factor
modeling random teleportation. Handles directed graphs with dangling nodes naturally.
SHOULD be the default centrality measure for STIX relationship graphs.

**Normative Requirements:**
- MUST use damping factor d in [0.5, 0.95], default 0.85 [TSG.28 NC-3]
- MUST converge to epsilon < 10^-6 [TSG.28 NC-4]
- MUST normalize to [0, 1] [TSG.28 NC-5]

### 6.5 AT-GRA-05: Community Detection (Leiden)

**Source:** TSG.28 Section 4.3
**Math Domain:** Graph Theory
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | Custom (Leiden algorithm), `iterate` (refinement) |
| Input Signal Types | STIX SDO/SRO graphs |
| Output Enrichment | `communityId`, `modularity`, `communitySize` |
| Rendering Layer | R3F (z:0) node/cluster color, visx (z:1) community chart |
| Intel Phase | Analysis |
| Time Complexity | O(n + m) per pass, ~ O(log n) passes |
| Space Complexity | O(n + m) |
| Incremental? | Warm-start |
| NATS Subject | `tsingou.analysis.graph.community` |

**Brief Description:** Detects communities (organizational cells, social groups,
coordinated activity clusters) via modularity optimization with guaranteed connectivity.
Leiden improves on Louvain by eliminating badly connected communities (up to 25% in
Louvain). The resolution parameter gamma controls granularity.

**Normative Requirements:**
- MUST use Leiden over Louvain for production [TSG.28 NC-6]
- MUST disclose resolution limit [TSG.28 NC-7]
- MUST expose resolution parameter gamma [TSG.28 Sec 4.3]

### 6.6 AT-GRA-06: k-Core Decomposition

**Source:** TSG.28 Section 5.1
**Math Domain:** Graph Theory
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (degree tracking), `filter` (coreness) |
| Input Signal Types | STIX SDO/SRO graphs |
| Output Enrichment | `coreness`, `coreShell` |
| Rendering Layer | R3F (z:0) concentric shells, visx (z:1) core histogram |
| Intel Phase | Analysis |
| Time Complexity | O(n + m) |
| Space Complexity | O(n) |
| Incremental? | Yes (local updates) |
| NATS Subject | `tsingou.analysis.graph.kcore` |

**Brief Description:** Peels the network into density shells. The innermost core
identifies the most tightly connected subgroup — often the operational leadership
circle in a dark network. Linear-time via Batagelj-Zaversnik algorithm.

### 6.7 AT-GRA-07: Force-Directed Graph Layout

**Source:** TSG.28 Section 9
**Math Domain:** Graph Theory
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | N/A (web worker computation) |
| Input Signal Types | STIX SDO/SRO graphs |
| Output Enrichment | `positionX`, `positionY`, `positionZ` |
| Rendering Layer | R3F (z:0) |
| Intel Phase | Dissemination |
| Time Complexity | O((n log n + m) * iters) with Barnes-Hut |
| Space Complexity | O(n) |
| Incremental? | Warm-start (perturb from previous layout) |
| NATS Subject | N/A (client-side only) |

**Brief Description:** Positions graph vertices in 3D space using spring-electrical
force simulation. Barnes-Hut acceleration reduces repulsive force computation from
O(n^2) to O(n log n). ForceAtlas2 variant emphasizes community structure.

**Normative Requirements:**
- MUST use Barnes-Hut for n > 500 [TSG.28 NC-13]
- MUST support level-of-detail for n > 5,000 [TSG.28 NC-14]

### 6.8 AT-GRA-08: Temporal Graph Analysis

**Source:** TSG.28 Section 7
**Math Domain:** Graph Theory
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `window` (temporal slice), `join` (temporal path) |
| Input Signal Types | STIX graphs with timestamps |
| Output Enrichment | `temporalBetweenness`, `earliestArrivalTime`, `temporalMotifs` |
| Rendering Layer | visx (z:1) temporal timeline, R3F (z:0) animated graph |
| Intel Phase | Analysis |
| Time Complexity | O(n * m) for temporal betweenness |
| Space Complexity | O(n + m_T) where m_T = temporal edges |
| Incremental? | Partially (window-based) |
| NATS Subject | `tsingou.analysis.graph.temporal` |

**Brief Description:** Respects the arrow of time in graph analysis. Static analysis
on time-collapsed graphs overestimates reachability; temporal analysis reveals which
paths are actually feasible given edge timestamps. Temporal motifs reveal communication
protocols (dead-drop, command-and-control, pre-operation coordination).

**Normative Requirements:**
- MUST label results as static vs. temporal [TSG.28 NC-10]
- MUST specify temporal window [TSG.28 NC-11]
- MUST validate temporal paths [TSG.28 NC-12]

### 6.9 AT-GRA-09: Link Prediction

**Source:** TSG.28 Section 8.5
**Math Domain:** Graph Theory
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `join` (neighbor intersection), `reduce` (score) |
| Input Signal Types | STIX SDO/SRO graphs (dark networks) |
| Output Enrichment | `predictedEdges`, `predictionScore`, `predictionMethod` |
| Rendering Layer | R3F (z:0) dashed edges, DOM (z:3) prediction table |
| Intel Phase | Analysis |
| Time Complexity | O(d^2 * n) for neighbor-based (d = avg degree) |
| Space Complexity | O(n^2) worst case (predicted edges) |
| Incremental? | No (recompute on graph change) |
| NATS Subject | `tsingou.analysis.graph.linkprediction` |

**Brief Description:** Infers unobserved connections in incomplete intelligence networks
using structural similarity (common neighbors, Jaccard, Adamic-Adar, Katz index).
Predicted edges MUST be visually distinct from observed edges.

**Normative Requirements:**
- MUST distinguish predicted from observed edges visually [TSG.28 NC-15]

### 6.10 AT-GRA-10: Network Flow and Disruption Analysis

**Source:** TSG.28 Section 6.3
**Math Domain:** Graph Theory
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | Custom (Edmonds-Karp BFS) |
| Input Signal Types | STIX graphs (capacitated) |
| Output Enrichment | `maxFlow`, `minCutEdges`, `vertexConnectivity` |
| Rendering Layer | R3F (z:0) highlighted cut edges, DOM (z:3) disruption report |
| Intel Phase | Analysis |
| Time Complexity | O(n * m^2) |
| Space Complexity | O(n + m) |
| Incremental? | No |
| NATS Subject | `tsingou.analysis.graph.flow` |

**Brief Description:** Computes maximum flow and minimum cut between entity pairs.
The minimum s-t cut identifies the smallest set of relationships whose disruption
isolates a target entity — fundamental to intelligence disruption planning.

---

## 7. Technique Domain: Information Theory (TSG.29)

### 7.1 AT-INF-01: Shannon Entropy Signal Classification

**Source:** TSG.29 Section 2
**Math Domain:** Information Theory
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (histogram accumulation), `map` (entropy computation) |
| Input Signal Types | All (symbol/event streams) |
| Output Enrichment | `shannonEntropy`, `normalizedEntropy`, `entropyClass` |
| Rendering Layer | visx (z:1) entropy trend, DOM (z:3) classification badge |
| Intel Phase | Processing, Analysis |
| Time Complexity | O(K) per window, K = alphabet size |
| Space Complexity | O(K) for symbol histogram |
| Incremental? | Yes (histogram update) |
| NATS Subject | `tsingou.analysis.inftheory.entropy` |

**Brief Description:** Computes Shannon entropy H(X) = -sum p(x) log2 p(x) over
windowed signal distributions. High entropy indicates diverse/unpredictable content
(encrypted, compressed); low entropy indicates structured/repetitive content (protocol,
beacon). Normalized entropy (H/log2 K) enables cross-source comparison.

**Normative Requirements:**
- MUST compute Shannon entropy for every signal stream [TSG.29 Sec 16]
- MUST normalize entropy for cross-source comparison [TSG.29 Sec 2]

### 7.2 AT-INF-02: Mutual Information Source Correlation

**Source:** TSG.29 Section 4
**Math Domain:** Information Theory
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `join` (pairwise), `reduce` (joint histogram) |
| Input Signal Types | Multi-source (pairwise correlation) |
| Output Enrichment | `mutualInformation`, `normalizedMI`, `informationCorrelation` |
| Rendering Layer | visx (z:1) MI matrix, R3F (z:0) correlation graph edges |
| Intel Phase | Analysis |
| Time Complexity | O(K^2) per pair per window |
| Space Complexity | O(K^2) joint histogram |
| Incremental? | Partially (histogram update, then recompute MI) |
| NATS Subject | `tsingou.analysis.inftheory.mi` |

**Brief Description:** Mutual information I(X;Y) = H(X) + H(Y) - H(X,Y) measures
statistical dependence between signal sources without assuming linearity (unlike
Pearson correlation). Normalized MI enables cross-pair comparison. Detects nonlinear
dependencies invisible to correlation analysis.

**Normative Requirements:**
- MUST compute MI for all configured source pairs [TSG.29 Sec 16]

### 7.3 AT-INF-03: KL/JS Divergence Anomaly Detection

**Source:** TSG.29 Section 5
**Math Domain:** Information Theory
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `window` (baseline vs. current), `reduce` (divergence) |
| Input Signal Types | All (distribution comparison) |
| Output Enrichment | `klDivergence`, `jsDivergence`, `divergenceAnomaly` |
| Rendering Layer | visx (z:1) divergence trend, DOM (z:3) anomaly alert |
| Intel Phase | Analysis |
| Time Complexity | O(K) per comparison |
| Space Complexity | O(K) per distribution |
| Incremental? | Yes (sliding baseline) |
| NATS Subject | `tsingou.analysis.inftheory.divergence` |

**Brief Description:** Compares current signal distribution against a learned baseline
using Kullback-Leibler divergence D_KL(P||Q) = sum P(x) log(P(x)/Q(x)) or the
symmetric Jensen-Shannon divergence JSD(P||Q) = H((P+Q)/2) - (H(P)+H(Q))/2. Spikes in
divergence indicate regime changes — behavioral shifts, new protocols, anomalous activity.

**Normative Requirements:**
- MUST use JSD (not raw KL) for anomaly detection (symmetry) [TSG.29 Sec 5]

### 7.4 AT-INF-04: Channel Capacity Bounds (Shannon-Hartley)

**Source:** TSG.29 Section 6
**Math Domain:** Information Theory
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `map` (capacity computation from SNR + bandwidth) |
| Input Signal Types | RF/SDR (channel measurements) |
| Output Enrichment | `channelCapacityBps`, `spectralEfficiency`, `snrDb` |
| Rendering Layer | visx (z:1) capacity gauge, DOM (z:3) channel metrics |
| Intel Phase | Collection |
| Time Complexity | O(1) per measurement |
| Space Complexity | O(1) |
| Incremental? | Yes |
| NATS Subject | `tsingou.analysis.inftheory.capacity` |

**Brief Description:** Computes the Shannon-Hartley channel capacity
C = B * log2(1 + SNR) for SDR receiver channels. Determines the theoretical maximum
data rate achievable on the monitored channel — useful for assessing whether observed
signals are approaching capacity limits.

### 7.5 AT-INF-05: Spectral Entropy

**Source:** TSG.29 Section 12
**Math Domain:** Information Theory + DSP
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `map` (PSD normalization + entropy) |
| Input Signal Types | RF/SDR (FFT magnitude arrays) |
| Output Enrichment | `spectralEntropy`, `spectralFlatness` |
| Rendering Layer | visx (z:1) spectral entropy trend |
| Intel Phase | Processing, Analysis |
| Time Complexity | O(N) per FFT frame, N = FFT bins |
| Space Complexity | O(N) |
| Incremental? | Yes (per-frame) |
| NATS Subject | `tsingou.analysis.inftheory.spectralentropy` |

**Brief Description:** Treats the normalized PSD as a probability distribution and
computes its entropy. High spectral entropy indicates flat (noise-like) spectrum; low
spectral entropy indicates concentrated energy (tonal signals). Spectral flatness
(geometric mean / arithmetic mean of PSD) provides a complementary measure.

---

## 8. Technique Domain: Geospatial Mathematics (TSG.30)

### 8.1 AT-GEO-01: Great-Circle Distance (Haversine/Vincenty)

**Source:** TSG.30 Section 2
**Math Domain:** Geospatial
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `map` (distance computation) |
| Input Signal Types | Geolocated signals (lat/lng metadata) |
| Output Enrichment | `distanceKm`, `bearing` |
| Rendering Layer | R3F (z:0) globe/map |
| Intel Phase | Processing |
| Time Complexity | O(1) per point pair |
| Space Complexity | O(1) |
| Incremental? | Yes |
| NATS Subject | `tsingou.analysis.geo.distance` |

**Brief Description:** Computes geodesic distance between geolocated signals. Haversine
provides fast spherical approximation (< 0.3% error); Vincenty provides high-accuracy
ellipsoidal computation (< 0.5mm error) for precision requirements.

### 8.2 AT-GEO-02: Spatial Indexing (H3/R-tree)

**Source:** TSG.30 Section 3
**Math Domain:** Geospatial
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `map` (H3 cell assignment), `reduce` (cell aggregation) |
| Input Signal Types | Geolocated signals |
| Output Enrichment | `h3Index`, `h3Resolution`, `cellSignalCount` |
| Rendering Layer | R3F (z:0) hexagonal heatmap |
| Intel Phase | Processing |
| Time Complexity | O(1) per point (H3 encoding); O(log n) per query (R-tree) |
| Space Complexity | O(n) |
| Incremental? | Yes (index insertion) |
| NATS Subject | `tsingou.analysis.geo.index` |

**Brief Description:** H3 hexagonal hierarchical spatial indexing assigns signals to
uniform-area hexagonal cells at configurable resolution (0-15). R-tree indexing enables
efficient spatial range and nearest-neighbor queries for proximity analysis.

### 8.3 AT-GEO-03: Geofence Monitoring

**Source:** TSG.30 Section 5
**Math Domain:** Geospatial
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `filter` (point-in-polygon test), `map` (fence assignment) |
| Input Signal Types | Geolocated signals |
| Output Enrichment | `insideFences`, `fenceEntryTime`, `fenceExitTime` |
| Rendering Layer | R3F (z:0) fence overlay, DOM (z:3) alert |
| Intel Phase | Analysis |
| Time Complexity | O(F * V) per signal, F = fences, V = vertices per fence |
| Space Complexity | O(F * V) |
| Incremental? | Yes |
| NATS Subject | `tsingou.analysis.geo.geofence` |

**Brief Description:** Monitors geolocated signals against analyst-defined geofence
polygons. Generates alerts on fence entry/exit events. Supports circular, polygonal,
and H3 cell-based fence definitions.

### 8.4 AT-GEO-04: Spatial Clustering (DBSCAN/HDBSCAN)

**Source:** TSG.30 Section 4
**Math Domain:** Geospatial + Statistics
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | Custom (DBSCAN with spatial index), `reduce` (cluster labels) |
| Input Signal Types | Geolocated signals |
| Output Enrichment | `spatialClusterId`, `clusterDensity`, `isNoise` |
| Rendering Layer | R3F (z:0) cluster markers, visx (z:1) cluster stats |
| Intel Phase | Analysis |
| Time Complexity | O(n log n) with spatial index |
| Space Complexity | O(n) |
| Incremental? | No (recompute on change) |
| NATS Subject | `tsingou.analysis.geo.cluster` |

**Brief Description:** Discovers spatial activity clusters without requiring a
predefined number of clusters. DBSCAN identifies dense regions and classifies sparse
signals as noise. HDBSCAN provides hierarchical multi-density clustering.

### 8.5 AT-GEO-05: Movement Pattern Analysis

**Source:** TSG.30 Section 6
**Math Domain:** Geospatial
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `window` (trajectory), `reduce` (pattern metrics) |
| Input Signal Types | Entity tracks (timestamped lat/lng sequences) |
| Output Enrichment | `speed`, `heading`, `acceleration`, `dwellTime`, `routeDeviation` |
| Rendering Layer | R3F (z:0) trajectory traces, visx (z:1) speed chart |
| Intel Phase | Analysis |
| Time Complexity | O(T) per entity, T = track length |
| Space Complexity | O(T) per entity |
| Incremental? | Yes (append to track) |
| NATS Subject | `tsingou.analysis.geo.movement` |

**Brief Description:** Analyzes entity movement patterns: speed, heading, acceleration,
dwell times at locations, deviation from established routes. Enables pattern-of-life
analysis and anomalous movement detection (unexpected stops, route changes, speed
anomalies).

---

## 9. Technique Domain: Data Fusion (TSG.4)

### 9.1 AT-FUS-01: Bayesian Multi-Source Fusion

**Source:** TSG.4 Section 2
**Math Domain:** Data Fusion
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `join` (source combination), `reduce` (posterior update) |
| Input Signal Types | Multi-INT (all source types) |
| Output Enrichment | `fusedConfidence`, `posteriorProbability`, `likelihoodRatio` |
| Rendering Layer | DOM (z:3) confidence indicator, visx (z:1) fusion timeline |
| Intel Phase | Processing, Analysis |
| Time Complexity | O(H^S) exact; O(N) particle filter |
| Space Complexity | O(H^S) exact; O(N) particles |
| Incremental? | Yes (recursive Bayesian update) |
| NATS Subject | `tsingou.analysis.fusion.bayesian` |

**Brief Description:** Combines evidence from multiple intelligence sources using
Bayes' theorem. Each new observation updates the posterior probability of hypotheses.
Particle filters (Sequential Monte Carlo) approximate the posterior for nonlinear
state spaces.

### 9.2 AT-FUS-02: Dempster-Shafer Evidence Combination

**Source:** TSG.4 Section 3
**Math Domain:** Data Fusion
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `join` (source pairing), `reduce` (DS combination) |
| Input Signal Types | Multi-INT (with belief mass assignments) |
| Output Enrichment | `belief`, `plausibility`, `uncertainty`, `conflictMass` |
| Rendering Layer | DOM (z:3) belief/plausibility gauge, visx (z:1) belief evolution |
| Intel Phase | Analysis |
| Time Complexity | O(2^H) per combination, H = hypothesis space size |
| Space Complexity | O(2^H) |
| Incremental? | Yes (sequential combination) |
| NATS Subject | `tsingou.analysis.fusion.ds` |

**Brief Description:** Dempster-Shafer theory generalizes Bayesian inference by allowing
belief mass assignment to subsets of hypotheses (not just singletons). Handles ignorance
explicitly via the uncertainty interval [Bel(A), Pl(A)]. Conflict mass K measures source
disagreement.

**Normative Requirements:**
- MUST report conflict mass K with every fusion result [TSG.4 Sec 3.3]

### 9.3 AT-FUS-03: Kalman Filtering (State Estimation)

**Source:** TSG.4 Section 5
**Math Domain:** Data Fusion
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (predict-update cycle) |
| Input Signal Types | Tracking signals (position, velocity, bearing) |
| Output Enrichment | `filteredState`, `predictionError`, `kalmanGain`, `innovationSequence` |
| Rendering Layer | R3F (z:0) track visualization, visx (z:1) prediction ellipse |
| Intel Phase | Processing |
| Time Complexity | O(n^3) per update, n = state dimension |
| Space Complexity | O(n^2) for covariance matrix |
| Incremental? | Yes (predict-update streaming) |
| NATS Subject | `tsingou.analysis.fusion.kalman` |

**Brief Description:** Optimal linear state estimator for tracking problems. Linear
Kalman filter for linear dynamics; Extended Kalman Filter (EKF) for mildly nonlinear;
Unscented Kalman Filter (UKF) for strongly nonlinear state spaces.

### 9.4 AT-FUS-04: Multi-Target Track Association

**Source:** TSG.4 Section 6
**Math Domain:** Data Fusion
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `join` (observation-track pairing), `iterate` (MHT) |
| Input Signal Types | Multi-sensor tracking (radar, SIGINT, OSINT) |
| Output Enrichment | `trackId`, `associationProbability`, `trackStatus` |
| Rendering Layer | R3F (z:0) track display, DOM (z:3) track table |
| Intel Phase | Processing |
| Time Complexity | O(M * T) per frame (GNN); exponential (MHT) |
| Space Complexity | O(M * T) GNN; O(H^k) MHT hypotheses |
| Incremental? | Yes (sequential frames) |
| NATS Subject | `tsingou.analysis.fusion.tracking` |

**Brief Description:** Associates observations from multiple sensors to tracks
(entity trajectories). Methods range from simple nearest-neighbor to sophisticated
Multiple Hypothesis Tracking (MHT) and Probability Hypothesis Density (PHD) filters.

### 9.5 AT-FUS-05: Source Reliability Calibration

**Source:** TSG.4 Section 8.2
**Math Domain:** Data Fusion
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `reduce` (reliability history), `map` (weight adjustment) |
| Input Signal Types | All (meta-analysis of source performance) |
| Output Enrichment | `sourceReliability`, `calibratedConfidence`, `biasEstimate` |
| Rendering Layer | DOM (z:3) source reliability dashboard |
| Intel Phase | Processing |
| Time Complexity | O(1) per observation |
| Space Complexity | O(S) for S sources |
| Incremental? | Yes |
| NATS Subject | `tsingou.analysis.fusion.reliability` |

**Brief Description:** Tracks historical accuracy of each intelligence source and
adjusts fusion weights accordingly. Unreliable sources receive less weight in Bayesian
and DS fusion. STIX `confidence` scores serve as prior reliability estimates, updated
via Bayesian learning from observed accuracy.

---

## 10. Cross-Domain Composite Techniques

These techniques span multiple mathematical domains and require coordinated operators
from several source sections.

### 10.1 AT-CMP-01: Pattern-of-Life Analysis

**Source:** ADR-013 Technique 5, TSG.27 + TSG.28 + TSG.30
**Math Domain:** Statistics + Graph + Geospatial
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `window` (time buckets), `reduce` (activity histogram), `join` (entity-location) |
| Input Signal Types | Multi-INT (spatiotemporal observations) |
| Output Enrichment | `activityHeatmap`, `baselineProfile`, `deviationScore` |
| Rendering Layer | visx (z:1) heatmap, R3F (z:0) trajectory |
| Intel Phase | Analysis |
| Time Complexity | O(T * E) per update, T = time buckets, E = entities |
| Space Complexity | O(T * D * E) where D = day-of-week bins |
| Incremental? | Yes (histogram update) |
| NATS Subject | `tsingou.analysis.composite.pol` |

**Brief Description:** Builds behavioral baseline profiles for entities: what does
"normal" look like across time-of-day, day-of-week, location, and activity type?
Deviations from the baseline trigger anomaly alerts. Combines temporal statistics
(TSG.27), geospatial patterns (TSG.30), and entity graphs (TSG.28).

### 10.2 AT-CMP-02: Kill Chain / ATT&CK Mapping

**Source:** ADR-013 Technique 7, TSG.28 + TSG.29
**Math Domain:** Graph + Information Theory
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `join` (signal x ATT&CK), `reduce` (coverage count) |
| Input Signal Types | Cyber, OSINT (STIX attack-pattern SDOs) |
| Output Enrichment | `attackTechniques`, `killChainPhase`, `coverageScore` |
| Rendering Layer | visx (z:1) ATT&CK matrix heatmap, DOM (z:3) technique list |
| Intel Phase | Analysis |
| Time Complexity | O(S * T) per update, S = signals, T = techniques |
| Space Complexity | O(T) technique coverage |
| Incremental? | Yes (join + reduce) |
| NATS Subject | `tsingou.analysis.composite.attck` |

**Brief Description:** Maps observed signals to MITRE ATT&CK tactics and techniques
via STIX attack-pattern external references. The coverage heatmap shows which ATT&CK
cells have been observed, enabling gap identification. Entropy of the coverage
distribution (TSG.29) measures adversary technique diversity.

### 10.3 AT-CMP-03: Multi-INT Signal Fusion Pipeline

**Source:** TSG.4 + TSG.26 + TSG.27 + TSG.29
**Math Domain:** Fusion + Dataflow + Statistics + InfoTheory
**Requirement Level:** REQUIRED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | `join` (cross-source), `reduce` (DS combination), `map` (calibration) |
| Input Signal Types | Multi-INT (all sources simultaneously) |
| Output Enrichment | `fusedAssessment`, `sourceContributions`, `uncertaintyBounds` |
| Rendering Layer | DOM (z:3) fusion dashboard, visx (z:1) confidence timeline |
| Intel Phase | Processing, Analysis |
| Time Complexity | O(S * 2^H) per fusion cycle |
| Space Complexity | O(S * 2^H) |
| Incremental? | Yes (d2ts differential updates) |
| NATS Subject | `tsingou.analysis.composite.fusion` |

**Brief Description:** The end-to-end fusion pipeline: source adapters ingest signals
(TSG.26 differential dataflow), source reliability calibration adjusts weights (TSG.4),
statistical anomaly detection flags deviations (TSG.27), information-theoretic measures
quantify source diversity and redundancy (TSG.29), and Dempster-Shafer combination
produces fused assessments with uncertainty bounds (TSG.4).

### 10.4 AT-CMP-04: Signal Flow Visualization

**Source:** ADR-013 Technique 6, TSG.26
**Math Domain:** Differential Dataflow + Visualization
**Requirement Level:** RECOMMENDED

| Attribute | Value |
|-----------|-------|
| d2ts Operators | Meta-monitoring (pipeline topology) |
| Input Signal Types | Pipeline metadata (throughput, latency, queue depth) |
| Output Enrichment | `operatorThroughput`, `queueDepth`, `latency` |
| Rendering Layer | R3F (z:0) animated particles, p5 (z:2) flow visualization |
| Intel Phase | Processing (operational monitoring) |
| Time Complexity | O(O) per update, O = number of operators |
| Space Complexity | O(O) |
| Incremental? | Yes |
| NATS Subject | `tsingou.analysis.composite.flow` |

**Brief Description:** Real-time visualization of the d2ts processing pipeline itself:
signal counts per operator, queue depths, processing latency, frontier advancement.
Animated particles flow through the graph topology, with node size proportional to
throughput. Enables operational monitoring of the analysis infrastructure.

---

## 11. ADR-013 Analysis Techniques Mapping

ADR-013 defines 8 high-level analysis techniques. This section maps each to its
constituent catalog entries.

| ADR-013 Technique | Primary Catalog Entries | Secondary Entries |
|-------------------|------------------------|-------------------|
| **1. Link Analysis** | AT-GRA-01 through AT-GRA-07 | AT-GRA-08, AT-GRA-09 |
| **2. Timeline Analysis** | AT-STA-01, AT-STA-09 | AT-DDF-03, AT-INF-01 |
| **3. Geospatial Analysis** | AT-GEO-01 through AT-GEO-05 | AT-GRA-01 (spatial graph) |
| **4. Anomaly Detection** | AT-STA-03 through AT-STA-10 | AT-INF-03, AT-FUS-02 |
| **5. Pattern-of-Life** | AT-CMP-01 | AT-STA-08, AT-GEO-05, AT-INF-01 |
| **6. Signal Flow** | AT-CMP-04, AT-DDF-01 | AT-DSP-07 |
| **7. Kill Chain / ATT&CK** | AT-CMP-02 | AT-GRA-04, AT-INF-02 |
| **8. Spectrum Analysis** | AT-DSP-01 through AT-DSP-07 | AT-INF-05, AT-INF-04 |

### 11.1 Rendering Layer Mapping (from ADR-013)

| ADR-013 Technique | Primary Layer | Secondary Layer | d2ts Operators |
|-------------------|--------------|----------------|----------------|
| Link Analysis | R3F (z:0) | visx (z:1) | `join`, `distinct`, `iterate` |
| Timeline Analysis | visx (z:1) | DOM (z:3) | `window`, `count` |
| Geospatial Analysis | R3F (z:0) | visx (z:1) | `join` (signal x location) |
| Anomaly Detection | DOM (z:3) | visx (z:1) | `reduce`, `window`, custom |
| Pattern-of-Life | visx (z:1) | R3F (z:0) | `window`, `reduce`, `iterate` |
| Signal Flow | R3F (z:0) | p5 (z:2) | Graph topology viz |
| Kill Chain / ATT&CK | visx (z:1) | DOM (z:3) | `join` (signal x ATT&CK) |
| Spectrum Analysis | p5 (z:2) | visx (z:1) | Custom FFT operators |

---

## 12. d2ts Operator-to-Technique Matrix

This matrix shows which d2ts operators are required by each technique domain.

| d2ts Operator | DSP | DDF | Statistics | Graph | InfoTheory | Geospatial | Fusion |
|--------------|-----|-----|-----------|-------|------------|-----------|--------|
| `map` | **Primary** | Used | Used | — | Used | Used | Used |
| `filter` | Used | — | Used | Used | — | **Primary** | — |
| `join` | — | **Primary** | Used | Used | **Primary** | — | **Primary** |
| `reduce` | Used | — | **Primary** | Used | **Primary** | Used | **Primary** |
| `iterate` | — | **Primary** | — | **Primary** | — | — | Used |
| `window` | Used | **Primary** | **Primary** | Used | Used | — | — |
| `count` | — | — | — | **Primary** | — | — | — |
| `distinct` | — | Used | — | Used | — | — | — |
| `consolidate` | — | **Primary** | — | — | — | — | — |
| `concat` | — | Used | — | — | — | — | — |
| Custom | **Primary** | — | Used | **Primary** | Used | Used | — |

**Legend:** **Primary** = technique requires this operator as its main computational
substrate. Used = technique may use this operator for supporting computations.
— = not applicable.

### 12.1 Operator Utilization Summary

| Operator | Technique Count | Domains |
|----------|----------------|---------|
| `reduce` | 24 | All 7 |
| `map` | 20 | 6 of 7 |
| `join` | 12 | 5 of 7 |
| `window` | 10 | 5 of 7 |
| `filter` | 8 | 4 of 7 |
| `iterate` | 5 | 3 of 7 |
| Custom | 11 | 5 of 7 |
| `count` | 3 | 2 of 7 |
| `distinct` | 2 | 2 of 7 |
| `consolidate` | 1 | 1 of 7 |

The `reduce` operator is the most universally required — nearly every analysis technique
requires accumulating state over signal streams. The `join` operator is the primary
cross-source operator, fundamental to correlation, fusion, and graph construction.

---

## 13. Rendering Layer Affinity Matrix

Each technique has a primary rendering target and optional secondary targets.

| Technique ID | R3F (z:0) | visx (z:1) | p5 (z:2) | DOM (z:3) |
|-------------|----------|----------|---------|----------|
| **DSP Domain** | | | | |
| AT-DSP-01 FFT | — | **Primary** | Secondary | — |
| AT-DSP-02 Windowing | — | Secondary | — | — |
| AT-DSP-03 PSD/Welch | — | **Primary** | — | — |
| AT-DSP-04 Waterfall | — | — | **Primary** | — |
| AT-DSP-05 Demodulation | — | Secondary | — | Secondary |
| AT-DSP-06 Time-Freq | — | — | **Primary** | — |
| AT-DSP-07 Noise Floor | — | Secondary | — | **Primary** |
| **Dataflow Domain** | | | | |
| AT-DDF-01 Incremental | Infrastructure (all layers) | | | |
| AT-DDF-02 Join | Secondary | Secondary | — | — |
| AT-DDF-03 Window | Infrastructure (all layers) | | | |
| AT-DDF-04 Iterate | Depends on enclosed computation | | | |
| **Statistics Domain** | | | | |
| AT-STA-01 Descriptive | — | Secondary | — | **Primary** |
| AT-STA-02 Moments | — | — | — | **Primary** |
| AT-STA-03 Z-Score | — | Secondary | — | **Primary** |
| AT-STA-04 EWMA | — | **Primary** | — | Secondary |
| AT-STA-05 CUSUM | — | **Primary** | — | Secondary |
| AT-STA-06 Grubbs | — | Secondary | — | Secondary |
| AT-STA-07 BOCPD | — | **Primary** | — | Secondary |
| AT-STA-08 STL | — | **Primary** | — | — |
| AT-STA-09 Correlation | Secondary | **Primary** | — | — |
| AT-STA-10 Composite | — | Secondary | — | **Primary** |
| **Graph Domain** | | | | |
| AT-GRA-01 Degree | **Primary** | Secondary | — | — |
| AT-GRA-02 Betweenness | **Primary** | Secondary | — | — |
| AT-GRA-03 Closeness | **Primary** | Secondary | — | — |
| AT-GRA-04 PageRank | **Primary** | Secondary | — | — |
| AT-GRA-05 Leiden | **Primary** | Secondary | — | — |
| AT-GRA-06 k-Core | **Primary** | Secondary | — | — |
| AT-GRA-07 Layout | **Primary** | — | — | — |
| AT-GRA-08 Temporal | Secondary | **Primary** | — | — |
| AT-GRA-09 Link Pred. | **Primary** | — | — | Secondary |
| AT-GRA-10 Flow/Cut | **Primary** | — | — | Secondary |
| **InfoTheory Domain** | | | | |
| AT-INF-01 Entropy | — | **Primary** | — | Secondary |
| AT-INF-02 MI | Secondary | **Primary** | — | — |
| AT-INF-03 Divergence | — | **Primary** | — | Secondary |
| AT-INF-04 Capacity | — | Secondary | — | **Primary** |
| AT-INF-05 Spec.Entropy | — | **Primary** | — | — |
| **Geospatial Domain** | | | | |
| AT-GEO-01 Distance | **Primary** | — | — | — |
| AT-GEO-02 H3/R-tree | **Primary** | — | — | — |
| AT-GEO-03 Geofence | **Primary** | — | — | Secondary |
| AT-GEO-04 DBSCAN | **Primary** | Secondary | — | — |
| AT-GEO-05 Movement | **Primary** | Secondary | — | — |
| **Fusion Domain** | | | | |
| AT-FUS-01 Bayesian | — | Secondary | — | **Primary** |
| AT-FUS-02 DS Evidence | — | Secondary | — | **Primary** |
| AT-FUS-03 Kalman | **Primary** | Secondary | — | — |
| AT-FUS-04 Tracking | **Primary** | — | — | Secondary |
| AT-FUS-05 Reliability | — | — | — | **Primary** |
| **Composite Domain** | | | | |
| AT-CMP-01 POL | Secondary | **Primary** | — | — |
| AT-CMP-02 ATT&CK | — | **Primary** | — | Secondary |
| AT-CMP-03 Multi-INT | — | Secondary | — | **Primary** |
| AT-CMP-04 Signal Flow | **Primary** | — | Secondary | — |

### 13.1 Layer Load Summary

| Layer | Primary Techniques | Secondary | Infrastructure |
|-------|-------------------|-----------|---------------|
| R3F (z:0) | 16 | 8 | 2 |
| visx (z:1) | 17 | 14 | 2 |
| p5 (z:2) | 3 | 2 | 2 |
| DOM (z:3) | 12 | 9 | 2 |

The visx layer carries the highest analytical load (31 total technique renderings),
making it the primary data visualization surface. R3F carries the highest spatial load
(24 total) for graph and geospatial rendering. The p5 layer is specialized (5 total)
for high-performance pixel-buffer rendering (waterfall, spectrogram, generative).
The DOM layer serves as the primary dashboard and alert surface (21 total).

---

## 14. Intelligence Cycle Phase Mapping

Each technique maps to one or more phases of the intelligence cycle
(TSG.3, TSG.10 ADR-010):

| Phase | Description | Technique IDs | Count |
|-------|------------|---------------|-------|
| **Collection** | Signal acquisition and ingestion | AT-DSP-07, AT-INF-04 | 2 |
| **Processing** | Signal normalization and enrichment | AT-DSP-01 through AT-DSP-06, AT-DDF-01, AT-DDF-03, AT-STA-01, AT-STA-02, AT-INF-01, AT-GEO-01, AT-GEO-02, AT-FUS-01, AT-FUS-03, AT-FUS-05 | 15 |
| **Analysis** | Intelligence derivation and assessment | AT-STA-03 through AT-STA-10, AT-GRA-01 through AT-GRA-10, AT-INF-01 through AT-INF-05, AT-GEO-03 through AT-GEO-05, AT-FUS-01, AT-FUS-02, AT-FUS-04, AT-CMP-01 through AT-CMP-03 | 30 |
| **Dissemination** | Visualization and reporting | AT-GRA-07, AT-CMP-04 | 2 |

The Analysis phase dominates technique count (30), reflecting Tsingou's primary role as
an analysis platform. Processing (15) provides the pipeline substrate. Collection (2)
and Dissemination (2) are at the edges.

### 14.1 Phase Distribution by Domain

| Domain | Collection | Processing | Analysis | Dissemination |
|--------|-----------|-----------|----------|--------------|
| DSP | 1 | 6 | 1 | — |
| Differential Dataflow | — | 3 | 1 | — |
| Statistics | — | 2 | 8 | — |
| Graph Theory | — | — | 9 | 1 |
| Information Theory | 1 | 2 | 3 | — |
| Geospatial | — | 2 | 3 | — |
| Data Fusion | — | 3 | 3 | — |
| Composite | — | 1 | 3 | 1 |

---

## 15. Computational Complexity Summary

### 15.1 Real-Time Techniques (O(1) to O(N) per observation)

These techniques operate within interactive latency budgets and are suitable for
streaming analysis at high signal rates (>1,000 signals/second):

| Technique | Per-Observation Cost | Memory | Notes |
|-----------|---------------------|--------|-------|
| AT-STA-01 Welford | O(1) | O(1) | |
| AT-STA-02 Moments | O(1) | O(1) | |
| AT-STA-03 Z-Score | O(1) | O(1) | Requires AT-STA-01 |
| AT-STA-04 EWMA | O(1) | O(1) | |
| AT-STA-05 CUSUM | O(1) | O(1) | |
| AT-INF-04 Capacity | O(1) | O(1) | |
| AT-FUS-05 Reliability | O(1) | O(S) | S = sources |
| AT-GEO-01 Distance | O(1) | O(1) | |
| AT-GEO-02 H3 Index | O(1) | O(n) | Insertion |
| AT-GEO-03 Geofence | O(F * V) | O(F * V) | F fences |
| AT-DSP-07 Noise Floor | O(N) | O(1) | N = FFT bins |
| AT-INF-01 Entropy | O(K) | O(K) | K = alphabet |

### 15.2 Frame-Rate Techniques (O(N log N) per frame)

These techniques operate per-frame at display rates (10-60 fps):

| Technique | Per-Frame Cost | Memory | Notes |
|-----------|---------------|--------|-------|
| AT-DSP-01 FFT | O(N log N) | O(N) | N = FFT size |
| AT-DSP-02 Windowing | O(N) | O(N) | |
| AT-DSP-04 Waterfall | O(N) | O(N * T) | T = scroll depth |
| AT-DSP-05 Demodulation | O(N) | O(1) | |
| AT-INF-05 Spectral Entropy | O(N) | O(N) | |

### 15.3 Window-Rate Techniques (O(W) to O(W^2) per window)

These techniques recompute when the sliding window advances:

| Technique | Per-Window Cost | Memory | Notes |
|-----------|----------------|--------|-------|
| AT-STA-06 Grubbs | O(W) | O(W) | |
| AT-STA-07 BOCPD | O(r_max) | O(r_max) | |
| AT-STA-08 STL | O(W * P) | O(W) | P = season |
| AT-STA-09 Correlation | O(W log W) | O(W) | FFT-based |
| AT-INF-02 MI | O(K^2) | O(K^2) | |
| AT-INF-03 Divergence | O(K) | O(K) | |

### 15.4 Graph-Rate Techniques (recompute on graph change)

These techniques recompute when the STIX graph changes, debounced:

| Technique | Cost | Memory | Incremental? |
|-----------|------|--------|-------------|
| AT-GRA-01 Degree | O(n + m) | O(n) | Yes, O(1) |
| AT-GRA-02 Betweenness | O(n * m) | O(n + m) | No, debounce |
| AT-GRA-03 Closeness | O(n * m) | O(n) | No, debounce |
| AT-GRA-04 PageRank | O(m * 100) | O(n) | Warm-start |
| AT-GRA-05 Leiden | O((n+m) * log n) | O(n + m) | Warm-start |
| AT-GRA-06 k-Core | O(n + m) | O(n) | Yes, local |
| AT-GRA-07 Layout | O((n log n + m) * 200) | O(n) | Warm-start |
| AT-GRA-08 Temporal | O(n * m) | O(n + m_T) | Partial |
| AT-GRA-09 Link Pred. | O(d^2 * n) | O(n^2) | No |
| AT-GRA-10 Flow | O(n * m^2) | O(n + m) | No |

### 15.5 Complexity Tiers for Capacity Planning

| Tier | Complexity Class | Max Signal Rate | Techniques |
|------|-----------------|----------------|------------|
| **T1: Ultra-Real-Time** | O(1) per signal | >100K/sec | AT-STA-01/02/03/04/05, AT-FUS-05 |
| **T2: Real-Time** | O(K) per signal | >10K/sec | AT-INF-01, AT-INF-03, AT-GEO-01/02/03 |
| **T3: Frame-Rate** | O(N log N) per frame | 10-60 fps | AT-DSP-01/02/03/04/05, AT-INF-05 |
| **T4: Window-Rate** | O(W log W) per window | 0.1-10 Hz | AT-STA-06/07/08/09, AT-INF-02 |
| **T5: Graph-Rate** | O(n * m) on change | Debounced 1 Hz | AT-GRA-02/03/04/05/07 |
| **T6: Batch** | O(n * m^2) or worse | On demand | AT-GRA-10, AT-FUS-04 (MHT) |

---

## 16. Normative Requirements

### 16.1 Catalog-Level MUST Requirements

| ID | Requirement | Derived From |
|----|-----------|--------------|
| TSG.31-N1 | Implementations MUST support ALL techniques marked REQUIRED | This section |
| TSG.31-N2 | Implementations MUST document which RECOMMENDED/OPTIONAL techniques are implemented | This section |
| TSG.31-N3 | Every technique output MUST be routed to its specified NATS subject | Sec 2.1 |
| TSG.31-N4 | Every technique output MUST include BaseSignal metadata enrichments specified in the technique entry | Sec 2.1 |
| TSG.31-N5 | Techniques in Tier T5+ MUST be debounced to prevent UI thrashing | Sec 15.5 |
| TSG.31-N6 | Composite anomaly detection MUST fuse at least 3 independent methods | AT-STA-10 |
| TSG.31-N7 | Multi-INT fusion MUST include source reliability calibration | AT-FUS-05 |
| TSG.31-N8 | Graph analytics MUST use incremental computation via d2ts where available | AT-DDF-01 |

### 16.2 Catalog-Level SHOULD Requirements

| ID | Requirement | Derived From |
|----|-----------|--------------|
| TSG.31-S1 | Implementations SHOULD support ALL techniques marked RECOMMENDED | This section |
| TSG.31-S2 | Each technique SHOULD emit performance telemetry (latency, throughput) | AT-CMP-04 |
| TSG.31-S3 | Graph analytics that lack incremental implementations SHOULD debounce at max 1 Hz | Sec 15.4 |
| TSG.31-S4 | Rendering layer assignments SHOULD follow the affinity matrix (Sec 13) | ADR-013 |
| TSG.31-S5 | Cross-domain composite techniques SHOULD be decomposable into constituent catalog entries | Sec 10 |

### 16.3 Catalog-Level MUST NOT Requirements

| ID | Requirement | Derived From |
|----|-----------|--------------|
| TSG.31-MN1 | Implementations MUST NOT present uncalibrated confidence scores in fusion results | AT-FUS-05 |
| TSG.31-MN2 | Implementations MUST NOT use single-method anomaly detection in production alerting | AT-STA-10 |
| TSG.31-MN3 | Implementations MUST NOT conflate static and temporal graph analysis results | TSG.28 NC-10 |

### 16.4 Technique Requirement Summary

| Level | Technique Count | Identifiers |
|-------|----------------|-------------|
| **REQUIRED** | 28 | AT-DSP-01/02/03/04/05/07, AT-DDF-01/02/03, AT-STA-01/02/03/04/05/09/10, AT-GRA-01/02/03/04/05/06/07, AT-INF-01/02/03, AT-GEO-01/02/03, AT-FUS-01/02/05, AT-CMP-01/03 |
| **RECOMMENDED** | 15 | AT-DSP-06, AT-DDF-04, AT-STA-06/07/08, AT-GRA-08/09/10, AT-INF-04/05, AT-GEO-04/05, AT-FUS-03/04, AT-CMP-02/04 |
| **OPTIONAL** | 0 | (All cataloged techniques are at least RECOMMENDED) |

---

## 17. Open Questions

### 17.1 Technique Composition Framework

How should analysts compose techniques into custom analysis workflows? The current
catalog treats techniques as independent units. A composition framework would allow:
- Chaining: AT-STA-08 (decomposition) -> AT-STA-03 (z-score on residuals)
- Parallel: AT-STA-04 (EWMA) + AT-STA-05 (CUSUM) -> AT-STA-10 (fusion)
- Conditional: IF AT-INF-01 entropy > threshold THEN enable AT-DSP-06 (time-freq)

### 17.2 Dynamic Technique Selection

Can the system automatically select appropriate techniques based on signal
characteristics? For example:
- High-entropy signals -> enable AT-INF-03 divergence detection
- Periodic signals (detected via AT-STA-09 ACF) -> enable AT-STA-08 STL
- Geolocated signals -> enable AT-GEO-01 through AT-GEO-05
- Multi-source signals -> enable AT-FUS-01 through AT-FUS-05

### 17.3 Technique Performance Benchmarking

Empirical benchmarks for each technique at various signal rates and graph sizes
are needed to validate the complexity-tier assignments in Section 15.5. Particularly:
- AT-GRA-02 (Brandes) scaling for n = 10K, 50K, 100K entities
- AT-FUS-02 (DS combination) scaling for |H| = 8, 16, 32 hypothesis space
- AT-DSP-01 (FFT) sustained throughput at N = 4096, 8192, 65536

### 17.4 Technique Versioning

As the mathematical specification evolves, technique entries may gain new normative
requirements or change requirement levels. A versioning scheme for the catalog
(technique-level semver or catalog-level revision number) would enable backward
compatibility tracking.

### 17.5 Missing Technique Domains

The current catalog does not cover:
- **Natural Language Processing**: Entity extraction, sentiment analysis, topic
  modeling from OSINT text sources
- **Machine Learning**: Supervised classifiers for signal type, anomaly detection
  via autoencoders, embedding-based entity resolution
- **Cryptanalysis**: Pattern analysis of encrypted communications (frequency analysis,
  protocol fingerprinting)

These domains may be added in future revisions as TSG.37+ sections.

---

## 18. Bibliography

### Synthesized Section References

| Key | Section | Line Count | Techniques Cataloged |
|-----|---------|-----------|---------------------|
| [TSG.4] | Data Fusion Mathematics | 1,607 | AT-FUS-01 through AT-FUS-05 |
| [TSG.25] | DSP Foundations | 1,702 | AT-DSP-01 through AT-DSP-07 |
| [TSG.26] | Differential Dataflow Theory | 1,505 | AT-DDF-01 through AT-DDF-04 |
| [TSG.27] | Statistical Analysis | 1,624 | AT-STA-01 through AT-STA-10 |
| [TSG.28] | Graph Theory & Link Analysis | 1,905 | AT-GRA-01 through AT-GRA-10 |
| [TSG.29] | Information Theory | 1,618 | AT-INF-01 through AT-INF-05 |
| [TSG.30] | Geospatial Mathematics | (in progress) | AT-GEO-01 through AT-GEO-05 |

### Architecture References

| Key | Full Citation |
|-----|--------------|
| [ADR-001] | "ADR-001: d2ts as Signal Pipeline Core." docs/tsingou/adr/ADR-001-d2ts-as-signal-pipeline.md, 2026. |
| [ADR-013] | "ADR-013: Eight Analysis Techniques Across 4 Rendering Layers." docs/tsingou/adr/ADR-013-analysis-techniques.md, 2026. |
| [FLOW-ARCH] | "TSINGOU_FLOW_ARCHITECTURE.md." docs/tsingou/FLOW_ARCHITECTURE.md, 2026. |
| [TSINGOU-SPEC] | "TSINGOU — System Specification." docs/tsingou/SPEC.md, 2026. |

### Standards

| Key | Full Citation |
|-----|--------------|
| [RFC2119] | Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels." BCP 14, RFC 2119, 1997. |
| [RFC8174] | Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." BCP 14, RFC 8174, 2017. |

---

<!-- INTEGRATION NOTES

Section TSG.31 — Analysis Techniques Catalog

PART VI: Analysis & Mathematics (capstone section)

Dependencies:
  - TSG.4 (Data Fusion Mathematics) — AT-FUS techniques
  - TSG.25 (DSP Foundations) — AT-DSP techniques
  - TSG.26 (Differential Dataflow Theory) — AT-DDF techniques
  - TSG.27 (Statistical Analysis) — AT-STA techniques
  - TSG.28 (Graph Theory) — AT-GRA techniques
  - TSG.29 (Information Theory) — AT-INF techniques
  - TSG.30 (Geospatial Mathematics) — AT-GEO techniques
  - ADR-013 (Eight Analysis Techniques) — High-level technique mapping

Dependents:
  - TSG.32 (Effect-TS Implementation Architecture) — cites for service design
  - TSG.20 (4-Layer Rendering Surface) — cites for layer load planning
  - TSG.7 (Signal Pipeline) — cites for operator requirements

Cross-references:
  - TSG.7:  d2ts operator requirements derived from technique catalog
  - TSG.8:  BaseSignal metadata enrichments per technique
  - TSG.10: Atom state management for technique outputs
  - TSG.11: NATS subject taxonomy for technique outputs
  - TSG.20: Rendering layer affinity matrix
  - TSG.21: R3F layer load (16 primary techniques)
  - TSG.22: visx layer load (17 primary techniques)
  - TSG.23: p5 layer load (3 primary techniques)
  - TSG.24: DOM layer load (12 primary techniques)

Codebase files referenced:
  - src/lib/tsingou-flow/operators/window.ts (AT-DDF-03)
  - src/lib/tsingou-flow/graph/ingest.ts (AT-DDF-01)
  - src/lib/tsingou-flow/graph/derived.ts (AT-DDF-02, AT-DDF-03)
  - src/lib/tsingou-flow/graph/multiset-helpers.ts (AT-DDF-01)
  - src/lib/tsingou-flow/graph/version.ts (AT-DDF-01)

Total cataloged techniques: 43
  - REQUIRED: 28
  - RECOMMENDED: 15
  - Across 7 mathematical domains + 1 composite domain

Line count: ~2,000 lines
Status: DRAFT
-->
