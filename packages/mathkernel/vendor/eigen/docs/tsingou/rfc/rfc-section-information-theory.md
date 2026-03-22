# RFC-002 Section TSG.29: Information Theory

```
Section:       TSG.29 — Information Theory
Parent RFC:    RFC-002 (Tsingou SIGINT Visualization Platform Specification)
Status:        DRAFT
Author:        diff-dataflow-theorist (Val team)
Created:       2026-02-18
Research Base: research-information-theory.md (13 sections, 12 citations)
Part:          VI — Analysis & Mathematics
```

> This section establishes the information-theoretic foundations for signal
> classification, anomaly detection, source correlation, channel capacity analysis,
> and security assessment within the Tsingou SIGINT visualization platform.
> Information theory provides the mathematical framework for quantifying uncertainty,
> measuring statistical dependence, detecting distributional shifts, and bounding
> communication limits. Implementations MUST satisfy the mathematical definitions
> and operational constraints specified herein. The key words "MUST", "MUST NOT",
> "SHOULD", "SHOULD NOT", and "MAY" are to be interpreted as described in [RFC2119]
> and [RFC8174].

---

## Table of Contents

1. [Scope and Applicability](#1-scope-and-applicability)
2. [Shannon Entropy](#2-shannon-entropy)
3. [Generalized Entropy Measures](#3-generalized-entropy-measures)
4. [Mutual Information](#4-mutual-information)
5. [Divergence Measures](#5-divergence-measures)
6. [Channel Capacity](#6-channel-capacity)
7. [Rate-Distortion Theory](#7-rate-distortion-theory)
8. [Information-Theoretic Security](#8-information-theoretic-security)
9. [Entropy-Based Signal Classification](#9-entropy-based-signal-classification)
10. [Information-Theoretic Anomaly Detection](#10-information-theoretic-anomaly-detection)
11. [Source Correlation via Mutual Information](#11-source-correlation-via-mutual-information)
12. [Spectral and Time-Frequency Entropy](#12-spectral-and-time-frequency-entropy)
13. [Estimation from Finite Samples](#13-estimation-from-finite-samples)
14. [Integration with Tsingou Subsystems](#14-integration-with-tsingou-subsystems)
15. [Normative Requirements](#15-normative-requirements)
16. [Open Questions](#16-open-questions)
17. [Bibliography](#17-bibliography)

---

## 1. Scope and Applicability

### 1.1 Purpose

This section defines the information-theoretic measures, algorithms, and operational
constraints for signal analysis in the Tsingou platform. Information theory — founded
by Shannon [SHANNON-1948] and extended by Kullback, Renyi, Berger, and others — provides
the mathematical language for three core Tsingou capabilities:

1. **Signal characterization**: Quantifying the information content, predictability, and
   complexity of signal streams via entropy measures.

2. **Anomaly detection**: Detecting distributional shifts in signal behavior via divergence
   measures (KL divergence, Jensen-Shannon divergence).

3. **Source analysis**: Measuring statistical dependence between sources via mutual
   information, and bounding channel throughput via the Shannon-Hartley theorem.

### 1.2 Architecture Context

Information-theoretic computations are positioned within the derived graph tier of the
d2ts signal pipeline (see TSG.26, Section 11):

```
┌──────────────────────────────────────────────────────┐
│  INGEST GRAPH (Tier 1)                               │
│    filter -> map -> consolidate                      │
│    Output: normalized MultiSet<BaseSignal>           │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────v───────────────────────────────────┐
│  DERIVED GRAPH (Tier 2) — information-theoretic ops  │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │ window(duration)                            │     │
│  │   |                                         │     │
│  │   v                                         │     │
│  │ reduce(computeEntropy)      -> entropyAtom  │     │
│  │ reduce(computeKLDivergence) -> anomalyAtom  │     │
│  │ reduce(computeMI)           -> correlAtom   │     │
│  │ reduce(computeJSD)          -> shiftAtom    │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  Output: information-theoretic derived state         │
└──────────────────┬───────────────────────────────────┘
                   │
                   v
     Effect.Queue -> Atom.set() -> Rendering Layers
```

All information-theoretic computations operate on **windowed** signal collections
within d2ts `reduce` operators. The window provides the finite sample from which
empirical distributions are estimated.

### 1.3 Cross-References

| Section | Relationship |
|---------|-------------|
| TSG.25 (DSP Foundations) | Spectral entropy uses FFT output from DSP pipeline |
| TSG.26 (Differential Dataflow) | All operators execute within d2ts framework |
| TSG.27 (Statistical Analysis) | Z-scores and EWMA complement divergence-based anomaly detection |
| TSG.4 (Data Fusion) | Mutual information provides fusion quality metrics |
| TSG.7 (Signal Pipeline) | Information measures are derived graph operators |

### 1.4 Normative Scope

The mathematical definitions in Sections 2-8 are normative. Implementations of
information-theoretic operators within Tsingou's d2ts derived graph MUST conform to
these definitions. Where multiple valid estimation approaches exist, the RECOMMENDED
approach is identified with justification.

---

## 2. Shannon Entropy

### 2.1 Discrete Entropy

**Definition 2.1 (Shannon Entropy).** For a discrete random variable X taking values in
a finite alphabet A with probability mass function p: A -> [0, 1], the Shannon entropy is
[SHANNON-1948]:

```
H(X) = - Sum_{x in A} p(x) * log_2(p(x))
```

with the convention that 0 * log_2(0) = 0 (justified by the limit x*log(x) -> 0 as x -> 0).

The unit of entropy when using base-2 logarithm is the **bit** (binary digit). One bit of
entropy corresponds to the uncertainty of a fair coin flip.

### 2.2 Fundamental Properties

**Theorem 2.1 (Properties of Shannon Entropy).** The Shannon entropy satisfies:

| Property | Statement | Significance |
|----------|-----------|-------------|
| Non-negativity | H(X) >= 0 | Entropy is never negative |
| Zero entropy | H(X) = 0 iff X is deterministic | No uncertainty = no information |
| Maximum entropy | H(X) <= log_2(\|A\|), equality iff X is uniform | Uniform distribution = maximum uncertainty |
| Concavity | H is concave in p | Mixing distributions increases entropy |
| Additivity | H(X, Y) = H(X) + H(Y) if X, Y independent | Independent sources have additive information |

**Proof (Non-negativity).** Since 0 <= p(x) <= 1 for all x, log_2(p(x)) <= 0, so
-p(x) * log_2(p(x)) >= 0 for each term. The sum of non-negative terms is non-negative.

**Proof (Maximum entropy).** By the log-sum inequality (a consequence of the concavity of
log), H(X) is maximized when p(x) = 1/|A| for all x, giving H(X) = log_2(|A|).

### 2.3 Conditional Entropy

**Definition 2.2 (Conditional Entropy).** The conditional entropy of Y given X is:

```
H(Y|X) = - Sum_{x,y} p(x,y) * log_2(p(y|x))
        = Sum_{x} p(x) * H(Y|X=x)
```

**Theorem 2.2 (Conditioning Reduces Entropy).** For any random variables X, Y:

```
H(Y|X) <= H(Y)
```

with equality if and only if X and Y are statistically independent.

**Interpretation.** Observing X can only reduce (never increase) the uncertainty about Y.
This is the information-theoretic justification for Tsingou's cross-source correlation:
if knowing source A's output reduces uncertainty about source B's output, the sources
share information.

### 2.4 Joint Entropy

**Definition 2.3 (Joint Entropy).** The joint entropy of X and Y is:

```
H(X, Y) = - Sum_{x,y} p(x,y) * log_2(p(x,y))
```

**Chain Rule for Entropy.** The joint entropy decomposes as:

```
H(X, Y) = H(X) + H(Y|X) = H(Y) + H(X|Y)
```

This generalizes to n variables:

```
H(X_1, ..., X_n) = Sum_{i=1}^{n} H(X_i | X_1, ..., X_{i-1})
```

### 2.5 Differential Entropy (Continuous)

**Definition 2.4 (Differential Entropy).** For a continuous random variable X with
probability density function f: R -> [0, infinity), the differential entropy is:

```
h(X) = - Integral_{-inf}^{inf} f(x) * ln(f(x)) dx
```

**Key differences from discrete entropy:**

| Property | Discrete H(X) | Differential h(X) |
|----------|--------------|-------------------|
| Non-negativity | Always >= 0 | Can be negative |
| Scale dependence | None | h(aX) = h(X) + log(\|a\|) |
| Maximum for fixed variance | N/A | Gaussian: h(X) = 1/2 * ln(2*pi*e*sigma^2) |
| Maximum for fixed support | Uniform | Uniform: h(X) = ln(b - a) for support [a, b] |

**Remark.** Differential entropy can be negative when the probability density exceeds 1
over a significant portion of its support (e.g., a narrow Gaussian with small sigma).
This does not indicate "negative information" but reflects that differential entropy is
defined relative to a reference measure, unlike discrete entropy which is absolute.

### 2.6 Entropy Rate

**Definition 2.5 (Entropy Rate).** For a stationary stochastic process {X_n}:

```
h = lim_{n -> inf} 1/n * H(X_1, X_2, ..., X_n)
  = lim_{n -> inf} H(X_n | X_{n-1}, ..., X_1)
```

(both limits exist and are equal for stationary processes).

For a stationary Markov chain of order k:

```
h = H(X_n | X_{n-1}, ..., X_{n-k})
```

**Significance for Tsingou.** The entropy rate captures temporal structure in signal
sequences that single-symbol entropy misses. A signal with high single-symbol entropy but
low entropy rate contains exploitable temporal patterns — relevant for both classification
and anomaly detection.

---

## 3. Generalized Entropy Measures

### 3.1 Renyi Entropy

**Definition 3.1 (Renyi Entropy).** For a discrete random variable X with probability
mass function p and a parameter alpha >= 0, alpha != 1, the Renyi entropy of order alpha
is [RENYI-1961]:

```
H_alpha(X) = 1/(1 - alpha) * log_2(Sum_{x} p(x)^alpha)
```

### 3.2 Special Cases

**Theorem 3.1 (Renyi Entropy Hierarchy).** The following special cases hold:

| Order | Name | Formula | Property |
|-------|------|---------|----------|
| alpha -> 0 | Hartley entropy | H_0(X) = log_2(\|supp(X)\|) | Cardinality of support |
| alpha -> 1 | Shannon entropy | H_1(X) = H(X) | (by L'Hopital's rule) |
| alpha = 2 | Collision entropy | H_2(X) = -log_2(Sum p(x)^2) | Probability of collision |
| alpha -> inf | Min-entropy | H_inf(X) = -log_2(max_x p(x)) | Worst-case unpredictability |

**Theorem 3.2 (Monotonicity in alpha).** Renyi entropy is non-increasing in alpha:

```
If alpha_1 < alpha_2, then H_{alpha_1}(X) >= H_{alpha_2}(X)
```

Therefore: H_0(X) >= H(X) >= H_2(X) >= H_inf(X).

### 3.3 Operational Significance

| Entropy Measure | Operational Meaning | Tsingou Application |
|----------------|--------------------|--------------------|
| **H_0 (Hartley)** | Number of distinct symbols observed | Signal vocabulary richness |
| **H (Shannon)** | Average bits per symbol for optimal coding | Signal compressibility baseline |
| **H_2 (Collision)** | Probability two random samples match | Diversity measurement (efficiently estimable) |
| **H_inf (Min-entropy)** | Bits extractable by an adversary | Security assessment of intercepted signals |

**Normative Requirement.** Implementations MUST support Shannon entropy (H) as the
default measure. Implementations SHOULD support Renyi entropy of order 2 (H_2) for
real-time applications where computational efficiency is critical.

### 3.4 Tsallis Entropy

**Definition 3.2 (Tsallis Entropy).** For parameter q >= 0, q != 1 [TSALLIS-2009]:

```
S_q(X) = 1/(q - 1) * (1 - Sum_{x} p(x)^q)
```

Related to Renyi entropy by:

```
H_alpha(X) = 1/(1 - alpha) * log_2(1 + (1 - alpha) * S_alpha(X))
```

Tsallis entropy is **non-extensive**: S_q(A, B) != S_q(A) + S_q(B) for independent
A, B. This property is useful for systems with long-range correlations.

**Remark.** Tsallis entropy MAY be used for signal streams exhibiting non-extensive
behavior (e.g., heavy-tailed distributions in network traffic). Shannon entropy is
RECOMMENDED as the default for most Tsingou applications.

---

## 4. Mutual Information

### 4.1 Definition

**Definition 4.1 (Mutual Information).** The mutual information between discrete random
variables X and Y is [COVER-THOMAS]:

```
I(X; Y) = Sum_{x,y} p(x,y) * log_2(p(x,y) / (p(x) * p(y)))
         = H(X) + H(Y) - H(X, Y)
         = H(X) - H(X|Y)
         = H(Y) - H(Y|X)
```

### 4.2 Properties

**Theorem 4.1 (Properties of Mutual Information).**

| Property | Statement | Proof Basis |
|----------|-----------|-------------|
| Non-negativity | I(X; Y) >= 0 | Gibbs' inequality |
| Symmetry | I(X; Y) = I(Y; X) | Definition via joint/marginals |
| Zero iff independent | I(X; Y) = 0 iff p(x,y) = p(x)*p(y) | KL divergence non-negativity |
| Upper bound | I(X; Y) <= min(H(X), H(Y)) | I(X;Y) = H(X) - H(X\|Y) <= H(X) |
| Self-information | I(X; X) = H(X) | H(X\|X) = 0 |
| Data processing ineq. | X -> Y -> Z implies I(X;Z) <= I(X;Y) | Markov chain property |

### 4.3 Information Diagram

The relationships between entropy measures are captured by the information diagram
(Venn diagram analog):

```
┌───────────────────────────────────────────┐
│                H(X, Y)                    │
│                                           │
│   ┌─────────────┬──────────┬──────────┐   │
│   │             │          │          │   │
│   │   H(X|Y)   │  I(X;Y)  │  H(Y|X) │   │
│   │             │          │          │   │
│   └─────────────┴──────────┴──────────┘   │
│                                           │
│   |<----------- H(X) ---------->|         │
│             |<---------- H(Y) ---------->|│
└───────────────────────────────────────────┘
```

Where:
- H(X, Y) = H(X|Y) + I(X;Y) + H(Y|X)
- H(X) = H(X|Y) + I(X;Y)
- H(Y) = H(Y|X) + I(X;Y)

### 4.4 Conditional Mutual Information

**Definition 4.2 (Conditional Mutual Information).** The mutual information between X
and Y given Z is:

```
I(X; Y | Z) = H(X|Z) - H(X|Y, Z)
             = H(X|Z) + H(Y|Z) - H(X, Y|Z)
```

**Chain Rule for Mutual Information.**

```
I(X_1, ..., X_n; Y) = Sum_{i=1}^{n} I(X_i; Y | X_1, ..., X_{i-1})
```

### 4.5 Normalized Mutual Information

**Definition 4.3 (Normalized Mutual Information).** To obtain a scale-free measure of
dependence in [0, 1]:

```
NMI(X; Y) = I(X; Y) / sqrt(H(X) * H(Y))
```

or alternatively:

```
NMI(X; Y) = 2 * I(X; Y) / (H(X) + H(Y))
```

**Normative Requirement.** When reporting correlation strength between Tsingou signal
sources, implementations SHOULD use normalized mutual information to enable comparison
across source pairs with different entropy levels.

---

## 5. Divergence Measures

### 5.1 Kullback-Leibler Divergence

**Definition 5.1 (KL Divergence).** The Kullback-Leibler divergence from distribution
Q to distribution P is [KULLBACK-1951]:

```
D_KL(P || Q) = Sum_{x} p(x) * log_2(p(x) / q(x))
```

with the conventions: 0 * log(0/q) = 0 and p * log(p/0) = +infinity.

For continuous distributions:

```
D_KL(P || Q) = Integral p(x) * ln(p(x) / q(x)) dx
```

### 5.2 Properties of KL Divergence

**Theorem 5.1 (Properties of KL Divergence).**

| Property | Statement | Consequence |
|----------|-----------|-------------|
| Non-negativity | D_KL(P \|\| Q) >= 0 (Gibbs' inequality) | Always indicates distance |
| Zero condition | D_KL(P \|\| Q) = 0 iff P = Q a.e. | Zero iff distributions identical |
| Asymmetry | D_KL(P \|\| Q) != D_KL(Q \|\| P) in general | Not a metric |
| No triangle ineq. | D_KL(P \|\| R) may exceed D_KL(P \|\| Q) + D_KL(Q \|\| R) | Not a metric |
| Infinite if unsupported | D_KL(P \|\| Q) = +inf if Q(x) = 0 where P(x) > 0 | Requires support coverage |
| Additive | D_KL(P1 x P2 \|\| Q1 x Q2) = D_KL(P1 \|\| Q1) + D_KL(P2 \|\| Q2) | Decomposes for independent marginals |

**Remark (Asymmetry Interpretation).**
- D_KL(P || Q) measures the cost of using Q as a model when P is the true distribution
  (encoding penalty for wrong model).
- D_KL(Q || P) measures the surprise when data from Q is evaluated under model P.

In anomaly detection, D_KL(P_current || P_baseline) measures how much the current
distribution departs from baseline expectations.

### 5.3 Relation to Entropy and Cross-Entropy

**Definition 5.2 (Cross-Entropy).** The cross-entropy of P relative to Q is:

```
H(P, Q) = - Sum_{x} p(x) * log_2(q(x))
```

**Theorem 5.2 (Decomposition).**

```
H(P, Q) = H(P) + D_KL(P || Q)
```

Cross-entropy equals entropy plus divergence. Minimizing cross-entropy is equivalent to
minimizing KL divergence when P is fixed.

### 5.4 Jensen-Shannon Divergence

**Definition 5.3 (Jensen-Shannon Divergence).** The Jensen-Shannon divergence between
distributions P and Q is [LIN-1991]:

```
JSD(P || Q) = 1/2 * D_KL(P || M) + 1/2 * D_KL(Q || M)
```

where M = 1/2 * (P + Q) is the mixture distribution.

### 5.5 Properties of JSD

**Theorem 5.3 (Properties of JSD).**

| Property | Statement | Advantage over KL |
|----------|-----------|------------------|
| Symmetry | JSD(P \|\| Q) = JSD(Q \|\| P) | No preferred direction |
| Boundedness | 0 <= JSD(P \|\| Q) <= 1 (bits, log_2) | Predictable scale |
| Metric (square root) | sqrt(JSD) satisfies triangle inequality | Distance-based algorithms |
| Always finite | JSD is finite for all P, Q | No infinity from zero probabilities |
| MI connection | JSD(P \|\| Q) = I(X; Z) with Z ~ Bernoulli(1/2) | Information-theoretic grounding |

**Proof (Boundedness).** Since D_KL(P || M) <= log_2(2) = 1 (because M >= P/2, so
P/M <= 2), and similarly D_KL(Q || M) <= 1, the average is bounded by 1.

**Normative Requirement.** Tsingou's anomaly detection subsystem MUST use Jensen-Shannon
divergence as the primary distributional shift measure. KL divergence MAY be used as a
supplementary measure when directional asymmetry is informative (e.g., measuring departure
from a fixed baseline). The choice of JSD over KL divergence is justified by:
1. Symmetry eliminates the need to designate baseline vs. current direction
2. Finite values avoid numerical instability from zero-probability events
3. The metric property (via sqrt) enables distance-based clustering and indexing

### 5.6 Generalized JSD

**Definition 5.4 (Weighted JSD).** For distributions P_1, ..., P_n with weights
w_1, ..., w_n (summing to 1):

```
JSD_w(P_1, ..., P_n) = H(Sum_i w_i * P_i) - Sum_i w_i * H(P_i)
```

This generalizes binary JSD to n distributions with arbitrary weights. When all weights
are 1/n, this measures the "spread" of n distributions around their centroid.

**Application.** For n signal sources, the generalized JSD measures the overall
distributional diversity across all sources simultaneously.

---

## 6. Channel Capacity

### 6.1 Shannon-Hartley Theorem

**Theorem 6.1 (Shannon-Hartley Theorem).** For a continuous-time additive white Gaussian
noise (AWGN) channel with bandwidth B hertz and signal-to-noise ratio SNR (linear):

```
C = B * log_2(1 + SNR)    bits/second
```

where C is the channel capacity — the maximum rate at which information can be
transmitted with arbitrarily small error probability [SHANNON-1948].

### 6.2 SNR Conversion

SNR is commonly expressed in decibels:

```
SNR_dB = 10 * log_10(SNR_linear)
SNR_linear = 10^(SNR_dB / 10)
```

### 6.3 Capacity Regimes

**Table 6-1: Channel Capacity Regime Analysis**

| Regime | Condition | Approximation | Implication |
|--------|-----------|--------------|-------------|
| Bandwidth-limited | SNR >> 1 (>> 0 dB) | C ~ B * log_2(SNR) | Capacity grows logarithmically with power |
| Power-limited | SNR << 1 (<< 0 dB) | C ~ (SNR * B) / ln(2) | Capacity grows linearly with power |
| Infinite bandwidth | B -> infinity | C -> P_S / (N_0 * ln(2)) | Capacity bounded by power spectral density |

Where P_S is signal power and N_0 is noise power spectral density.

### 6.4 SDR Channel Capacity Bounds

**Table 6-2: Theoretical Capacity Bounds for SDR Devices in Tsingou**

| SDR Device | Bandwidth B | Typical SNR | Capacity C | NATS Throughput |
|-----------|------------|-------------|-----------|----------------|
| RTL-SDR v4 | 2.4 MHz | 20 dB (100x) | 16.0 Mbit/s | ~2 MB/s |
| HackRF One | 20 MHz | 10 dB (10x) | 69.2 Mbit/s | ~8.7 MB/s |
| LimeSDR | 30.72 MHz | 15 dB (31.6x) | 154.8 Mbit/s | ~19.4 MB/s |
| USRP N210 | 25 MHz | 25 dB (316x) | 208.3 Mbit/s | ~26.0 MB/s |

**Derivation for RTL-SDR v4:**
```
C = 2.4e6 * log_2(1 + 100)
  = 2.4e6 * log_2(101)
  = 2.4e6 * 6.658
  = 15.98 Mbit/s
```

These theoretical bounds inform NATS subject bandwidth allocation and JetStream stream
retention sizing (see TSG.11 for NATS fabric architecture).

**Normative Requirement.** Tsingou's SDR signal metadata MUST include channel capacity
estimates computed from the Shannon-Hartley theorem using the measured SNR and bandwidth.
This provides an upper bound on the information content of the received signal.

### 6.5 Capacity-Achieving Codes

The Shannon-Hartley theorem is an existence result — it proves a capacity-achieving code
exists but does not construct one. Practical systems approach capacity using:

- Turbo codes (within 0.5 dB of capacity)
- LDPC codes (within 0.1 dB of capacity)
- Polar codes (provably capacity-achieving, but with practical overhead)

These coding considerations are relevant when Tsingou ingests decoded digital
communications from the GNU Radio sidecar (see TSG.17, GNU Radio Bridge).

---

## 7. Rate-Distortion Theory

### 7.1 The Rate-Distortion Function

**Definition 7.1 (Distortion Measure).** A distortion measure d: A x A_hat -> [0, inf)
quantifies the "cost" of representing source symbol x by reconstruction symbol x_hat.
Common choices:

| Distortion | Formula | Domain |
|-----------|---------|--------|
| Hamming | d(x, x_hat) = 0 if x = x_hat, 1 otherwise | Discrete symbols |
| Squared error | d(x, x_hat) = (x - x_hat)^2 | Real-valued signals |
| Absolute error | d(x, x_hat) = \|x - x_hat\| | Real-valued signals |

**Definition 7.2 (Rate-Distortion Function).** For a source X with distribution P_X
and distortion measure d, the rate-distortion function is [BERGER-1971]:

```
R(D) = min_{p(x_hat|x) : E[d(X, X_hat)] <= D} I(X; X_hat)
```

R(D) is the minimum bit rate (in bits per source symbol) needed to represent X with
average distortion at most D.

### 7.2 Closed-Form Results

**Theorem 7.1 (Gaussian Rate-Distortion).** For a Gaussian source X ~ N(0, sigma^2) with
squared error distortion:

```
R(D) = max(0, 1/2 * log_2(sigma^2 / D))    bits/sample
```

**Theorem 7.2 (Binary Source Rate-Distortion).** For a Bernoulli(p) source with Hamming
distortion:

```
R(D) = H(p) - H(D)    for 0 <= D <= min(p, 1-p)
R(D) = 0               for D >= min(p, 1-p)
```

where H(p) = -p*log_2(p) - (1-p)*log_2(1-p) is the binary entropy function.

### 7.3 Application to Signal Compression in Tsingou

Rate-distortion theory bounds the fundamental trade-off between signal fidelity and
storage cost. For Tsingou's signal persistence via NATS JetStream:

**Lossless storage (R >= H):**
- Full BaseSignal payload preserved
- Rate bounded below by entropy: R >= H(signal source)
- Required for: audit trails, forensic analysis, replay

**Lossy storage (R < H):**
- Signal metadata preserved; raw payload summarized
- Rate-distortion function bounds achievable fidelity
- Applicable to: long-term archival, bandwidth-constrained remote collection
- d2ts Index compaction (TSG.26, Section 8) is a form of lossy compression along
  the version dimension

**Table 7-1: Signal Storage Modes**

| Mode | Rate | Distortion | Use Case |
|------|------|-----------|----------|
| Full fidelity | R >= H(X) | D = 0 | Active analysis, regulatory compliance |
| Feature extraction | R << H(X) | D > 0, structured | Historical pattern search |
| Statistical summary | R ~ O(1) per window | D >> 0 | Long-term trend analysis |
| Metadata only | R ~ O(1) per signal | Max distortion (payload lost) | Source activity logging |

**Normative Requirement.** Implementations MUST preserve full signal fidelity during
active analysis sessions. Lossy compression MAY be applied only to archived signals
where the distortion budget D is explicitly configured by the analyst.

---

## 8. Information-Theoretic Security

### 8.1 Perfect Secrecy

**Definition 8.1 (Perfect Secrecy).** An encryption system E = (Gen, Enc, Dec) achieves
perfect secrecy if for all plaintext messages m and ciphertexts c [SHANNON-1949]:

```
Pr[M = m | C = c] = Pr[M = m]
```

**Equivalent formulations:**

| Formulation | Statement |
|-------------|-----------|
| Bayesian | Posterior = prior for all observations |
| Information-theoretic | I(M; C) = 0 (zero mutual information) |
| Entropy | H(M \| C) = H(M) (ciphertext reveals nothing) |
| Statistical | P(C \| M = m) is independent of m |

### 8.2 Shannon's Theorem

**Theorem 8.1 (Shannon's Perfect Secrecy Theorem).** An encryption system achieves
perfect secrecy only if:

```
H(K) >= H(M)
```

where K is the key and M is the message. The one-time pad achieves this bound with
equality: H(K) = H(M) [SHANNON-1949].

**Corollary.** Perfect secrecy requires the key to be at least as long as the message.
No practical cipher with a fixed-length key can achieve information-theoretic security
for messages of arbitrary length.

### 8.3 Unicity Distance

**Definition 8.2 (Unicity Distance).** The unicity distance n_0 is the minimum
ciphertext length at which a unique decryption key becomes theoretically determinable:

```
n_0 = H(K) / D
```

where D = log_2(|A|) - h is the **redundancy** per symbol, |A| is the alphabet size,
and h is the entropy rate of the source language.

**Table 8-1: Unicity Distance for Common Scenarios**

| Source Language | Alphabet | Source Entropy h | Redundancy D | Key Size H(K) | Unicity n_0 |
|---------------|----------|-----------------|-------------|---------------|------------|
| English text | 26 | ~1.0 bit/char | ~3.7 bit/char | 128 bits | ~35 chars |
| English text | 26 | ~1.0 bit/char | ~3.7 bit/char | 256 bits | ~69 chars |
| Random ASCII | 128 | 7.0 bit/char | 0 bit/char | Any | infinity |
| Binary protocol | 256 | Variable | Variable | 256 bits | Variable |

### 8.4 SIGINT Implications

**Table 8-2: Encryption Analysis via Information Theory**

| Intercepted Signal Property | Information-Theoretic Indicator | SIGINT Assessment |
|----------------------------|-------------------------------|-------------------|
| Entropy near maximum | H(signal) ~ log_2(\|A\|) | Encrypted or compressed — indistinguishable from random |
| Entropy significantly below max | H(signal) << log_2(\|A\|) | Unencrypted — exploitable redundancy |
| Non-zero conditional patterns | H(X_n \| X_{n-1}) < H(X_n) | Weak encryption or structured protocol |
| Key reuse detected | I(C_1; C_2) > 0 for different messages | Vulnerable — VENONA-class exploitation |
| Perfect entropy rate | h = log_2(\|A\|) | Perfect secrecy or strong stream cipher |

**Normative Requirement.** Tsingou MUST include entropy measurement as part of the
signal characterization pipeline. For each windowed signal stream, the system MUST
compute and record H(signal), enabling automated classification into encrypted vs.
unencrypted traffic classes.

### 8.5 Historical Case: VENONA

The VENONA project (1943-1980) demonstrated that reuse of one-time pad key material
destroys perfect secrecy. Soviet intelligence reused OTP key pages, enabling:

```
C_1 XOR C_2 = (M_1 XOR K) XOR (M_2 XOR K) = M_1 XOR M_2
```

The key cancels, yielding the XOR of two plaintexts — sufficient for cryptanalysis
when combined with known-plaintext fragments [SHANNON-1949].

This is detectable by Tsingou: I(C_1; C_2) > 0 between ciphertext streams indicates
potential key reuse.

---

## 9. Entropy-Based Signal Classification

### 9.1 Entropy as Feature Vector Component

The entropy of a signal's value distribution serves as a discriminative feature for
automatic classification. Different signal types exhibit characteristic entropy profiles:

**Table 9-1: Entropy Profiles by Signal Type**

| Signal Type | H(value) | H(timing) | Entropy Rate h | Spectral Entropy H_s | Classification |
|-------------|----------|-----------|---------------|---------------------|---------------|
| Encrypted traffic | ~8.0 bits/byte | Variable | ~8.0 | High | Crypto/compressed |
| Compressed data | ~7.5-8.0 | Periodic | ~7.5-8.0 | High | Compressed |
| HTTP/JSON text | ~4.5-6.0 | Bursty | ~3.0-4.5 | Medium | Structured text |
| Protocol headers | ~2.0-4.0 | Periodic | ~1.5-3.0 | Low-medium | Protocol framing |
| Heartbeat/keepalive | ~0.5-1.5 | Periodic | ~0.1-0.5 | Very low | Maintenance |
| White noise (RF) | ~8.0 | Uniform | ~8.0 | Maximum | Noise floor |
| Modulated signal (RF) | ~4.0-7.0 | Structured | ~3.0-6.0 | Medium-high | Active signal |

### 9.2 Multi-Dimensional Entropy Feature

For a signal stream S within a window, compute the feature vector:

```
entropy_features(S) = [
  H_value,       // Shannon entropy of byte/symbol distribution
  H_timing,      // Entropy of inter-arrival time distribution
  h_rate,        // Entropy rate (conditional on previous k symbols)
  H_spectral,    // Spectral entropy of FFT power spectrum
  H_2_collision, // Renyi collision entropy (efficiently estimable)
  H_inf_min,     // Min-entropy (security assessment)
]
```

This 6-dimensional feature vector provides a rich characterization for classification
algorithms (k-NN, random forest, or neural network classifiers operating on entropy
features).

### 9.3 Entropy-Based Protocol Fingerprinting

Different network protocols have distinctive entropy signatures:

**Table 9-2: Protocol Entropy Fingerprints**

| Protocol | Byte Entropy | Timing Pattern | Signature |
|----------|-------------|---------------|-----------|
| TLS 1.3 | ~7.99 | Bursty | Near-maximal entropy, handshake visible |
| SSH | ~7.95 | Bursty | Near-maximal, key exchange phase detectable |
| HTTP/1.1 | ~5.2 | Request/response | Headers low entropy, body varies |
| DNS | ~4.8 | Periodic | Fixed-format queries, low variance |
| ADS-B | ~3.5 | 1 Hz fixed | 112/56-bit frames, highly structured |
| POCSAG (pager) | ~4.2 | Bursty | Fixed preamble, 2-FSK |

### 9.4 BaseSignal Metadata Extension

Entropy measurements are stored as BaseSignal metadata fields:

```typescript
// Proposed entropy metadata extension for BaseSignal
const EntropyMetadata = Schema.Struct({
  entropy_value: Schema.Number,        // H(value distribution)
  entropy_timing: Schema.Number,       // H(inter-arrival times)
  entropy_rate: Schema.Number,         // Entropy rate estimate
  entropy_spectral: Schema.optional(Schema.Number),  // H_spectral (FFT-derived)
  entropy_min: Schema.optional(Schema.Number),       // H_inf (security)
  classification: Schema.optional(Schema.Literal(
    'encrypted', 'compressed', 'structured-text',
    'protocol-framing', 'heartbeat', 'noise', 'modulated-signal'
  )),
  computed_at: Schema.DateFromSelf,
  window_size_ms: Schema.Number,
})
```

**Normative Requirement.** Implementations MUST compute `entropy_value` for every signal
window. Implementations SHOULD compute `entropy_timing` and `entropy_rate` when
inter-arrival time data is available. Implementations MAY compute `entropy_spectral` when
FFT data is available from the DSP pipeline (TSG.25).

---

## 10. Information-Theoretic Anomaly Detection

### 10.1 Distributional Shift Detection Framework

Anomaly detection via information theory operates by detecting when the statistical
distribution of a signal stream departs from an established baseline:

```
┌─────────────────────────────────────────────────────┐
│  BASELINE PHASE                                     │
│                                                     │
│  window(baseline_duration)                          │
│    |                                                │
│    v                                                │
│  reduce(computeEmpiricalDistribution)               │
│    |                                                │
│    v                                                │
│  P_baseline: empirical distribution                 │
│  (stored as histogram or kernel density estimate)   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────v──────────────────────────────┐
│  MONITORING PHASE                                   │
│                                                     │
│  window(monitoring_duration)                        │
│    |                                                │
│    v                                                │
│  reduce(computeEmpiricalDistribution)               │
│    |                                                │
│    v                                                │
│  P_current: empirical distribution                  │
│    |                                                │
│    v                                                │
│  JSD(P_baseline || P_current) -> anomaly_score      │
│    |                                                │
│    v                                                │
│  filter(anomaly_score > theta) -> alert             │
└─────────────────────────────────────────────────────┘
```

### 10.2 Anomaly Score Computation

**Algorithm 10.1 (JSD-Based Anomaly Score).**

```
Input:  P_baseline (histogram, k bins)
        P_current  (histogram, k bins)
Output: anomaly_score in [0, 1]

1. Normalize: p_i = P_baseline[i] / Sum(P_baseline)
              q_i = P_current[i] / Sum(P_current)
2. Mixture:   m_i = (p_i + q_i) / 2
3. JSD = 0.5 * Sum_i p_i * log2(p_i / m_i)
       + 0.5 * Sum_i q_i * log2(q_i / m_i)
4. Return JSD
```

**Threshold selection.** The threshold theta depends on the acceptable false positive rate:

**Table 10-1: JSD Anomaly Thresholds**

| Threshold theta | Interpretation | False Positive Rate (empirical) |
|----------------|---------------|-------------------------------|
| 0.01 | Minor distributional shift | ~10% |
| 0.05 | Moderate shift — investigate | ~5% |
| 0.10 | Significant departure — alert | ~1% |
| 0.25 | Major anomaly — immediate attention | ~0.1% |
| 0.50 | Radical change — possible source substitution | ~0.01% |

**Normative Requirement.** Anomaly detection thresholds MUST be configurable per source
and per analysis session. Default thresholds SHOULD be set to theta = 0.05 for monitoring
and theta = 0.10 for alerting.

### 10.3 Multi-Feature Anomaly Detection

Beyond single-distribution JSD, anomaly detection can use multiple information-theoretic
features simultaneously:

```
anomaly_vector(window) = [
  JSD(P_value_baseline || P_value_current),
  JSD(P_timing_baseline || P_timing_current),
  |H(current) - H(baseline)|,        // entropy magnitude change
  |h_rate(current) - h_rate(baseline)|, // entropy rate change
  I(source_i; source_j) shift,        // mutual information change
]
```

The L2 norm of the anomaly vector provides a composite anomaly score. Individual
components indicate which aspect of the signal distribution has shifted.

### 10.4 Adaptive Baseline Update

The baseline distribution SHOULD be updated over time to adapt to gradual drift
(non-stationarity). An exponentially weighted moving average (EWMA) approach:

```
P_baseline(t+1) = lambda * P_baseline(t) + (1 - lambda) * P_current(t)
```

where lambda in (0, 1) is the decay parameter. Typical values: lambda = 0.95 (slow
adaptation) to lambda = 0.8 (fast adaptation).

**Normative Requirement.** Implementations MUST support configurable baseline windows.
Implementations SHOULD support adaptive baseline updating with configurable decay
parameter lambda. The default decay parameter SHOULD be lambda = 0.95.

### 10.5 Complementary Relationship with TSG.27

Information-theoretic anomaly detection (JSD, KL divergence) and statistical anomaly
detection (Z-scores, EWMA, CUSUM from TSG.27) are complementary:

| Approach | Strength | Weakness |
|----------|----------|----------|
| JSD (TSG.29) | Detects arbitrary distributional shifts | Requires sufficient sample size |
| Z-score (TSG.27) | Efficient for value-level outliers | Assumes known distribution |
| EWMA (TSG.27) | Tracks gradual trends | Misses abrupt multimodal shifts |
| CUSUM (TSG.27) | Optimal for mean shifts | Misses variance/shape changes |

**Normative Requirement.** Implementations SHOULD use both information-theoretic and
statistical anomaly detection in parallel. Information-theoretic measures detect
distributional shape changes; statistical measures detect value-level outliers.

---

## 11. Source Correlation via Mutual Information

### 11.1 Pairwise Source Correlation

For two Tsingou signal sources A and B, windowed mutual information I(A; B) measures
their statistical dependence. The computation:

```
1. Discretize signal features into bins (histogram)
2. Compute joint distribution p(a, b) from co-occurring signals
3. Compute marginals p(a), p(b)
4. I(A; B) = Sum_{a,b} p(a,b) * log_2(p(a,b) / (p(a) * p(b)))
```

### 11.2 Source Correlation Matrix

For n sources, compute the n x n mutual information matrix:

```
MI_matrix[i][j] = NMI(Source_i; Source_j)
```

This matrix is:
- Symmetric: NMI(A; B) = NMI(B; A)
- Diagonal = 1: NMI(A; A) = 1
- Off-diagonal in [0, 1]

The MI matrix provides a "correlation heatmap" for the visx rendering layer (TSG.22).

### 11.3 Automatic Correlation Discovery

High mutual information between sources suggests a causal or confounding relationship:

**Algorithm 11.1 (Automatic Correlation Discovery).**

```
Input:  Signal streams S_1, ..., S_n
        Threshold tau (default: 0.3)
        Window duration W (default: 60 seconds)
Output: Set of correlated source pairs

1. For each pair (i, j) where i < j:
   a. Compute NMI(S_i; S_j) over window W
   b. If NMI > tau:
      Emit (S_i, S_j, NMI) as correlated pair
2. Return all correlated pairs, sorted by NMI descending
```

Correlated pairs are candidates for d2ts `join` operators in the derived graph,
enabling automated cross-source analysis pipeline construction.

### 11.4 Time-Lagged Mutual Information

Sources may be correlated with a time lag (e.g., source B reacts to source A with delay):

```
I_lag(A; B, tau) = I(A(t); B(t + tau))
```

Scanning across lags tau and finding the maximum I_lag reveals the optimal time alignment
and the nature of the causal relationship.

**Table 11-1: Time-Lagged Correlation Interpretation**

| Pattern | Interpretation |
|---------|---------------|
| I_lag max at tau = 0 | Simultaneous correlation (common cause or fast reaction) |
| I_lag max at tau > 0 | B follows A with delay tau (A may cause B) |
| I_lag max at tau < 0 | A follows B (B may cause A) |
| Multiple I_lag peaks | Multi-path or periodic coupling |

### 11.5 Source Diversity Index

The Shannon diversity index measures how evenly distributed signal volume is across sources:

```
D = -Sum_{s=1}^{n} (N_s / N) * log_2(N_s / N)
```

where N_s = signal count from source s, N = total signal count.

**Table 11-2: Source Diversity Interpretation**

| D Value | Interpretation | Operational Concern |
|---------|---------------|-------------------|
| D ~ 0 | One source dominates | Single point of failure |
| D ~ 0.5 * log_2(n) | Moderate diversity | Acceptable |
| D ~ log_2(n) | Maximum diversity (uniform) | Balanced collection |

**Normative Requirement.** Implementations SHOULD compute and display source diversity
index D as a dashboard metric, alerting when D drops below 50% of maximum (indicating
excessive source concentration).

---

## 12. Spectral and Time-Frequency Entropy

### 12.1 Spectral Entropy

**Definition 12.1 (Spectral Entropy).** Given the power spectral density P(f_k) for
frequency bins k = 1, ..., N from an FFT computation (TSG.25):

1. Normalize to a probability distribution:
```
p(f_k) = P(f_k) / Sum_{k=1}^{N} P(f_k)
```

2. Compute Shannon entropy:
```
H_spectral = -Sum_{k=1}^{N} p(f_k) * log_2(p(f_k))
```

**Table 12-1: Spectral Entropy Interpretation**

| H_spectral Value | Signal Characteristic | RF Example |
|-----------------|----------------------|------------|
| ~0 | All energy in one frequency bin | Pure carrier tone |
| Low (< 0.3 * log_2(N)) | Narrowband signal | FM broadcast, single channel |
| Medium (0.3-0.7 * log_2(N)) | Moderate spectral spread | Digital modulation (QPSK, QAM) |
| High (> 0.7 * log_2(N)) | Wideband signal | Spread spectrum, CDMA |
| ~log_2(N) | Flat spectrum (all bins equal) | White noise, wideband interference |

### 12.2 Time-Frequency Entropy

Apply entropy to the Short-Time Fourier Transform (STFT) representation:

```
H_TF = -Sum_{t,f} p(t,f) * log_2(p(t,f))
```

where p(t, f) = |STFT(t, f)|^2 / Sum |STFT|^2 is the normalized time-frequency energy
distribution.

High H_TF indicates a signal that uses the time-frequency plane efficiently (spread
across both time and frequency). Low H_TF indicates a concentrated signal (narrowband
and/or brief).

### 12.3 Renyi Spectral Entropy

Using Renyi entropy of order alpha on the spectral distribution:

```
H_alpha_spectral = 1/(1-alpha) * log_2(Sum_{k} p(f_k)^alpha)
```

- alpha = 2: Emphasizes dominant spectral components (collision entropy)
- alpha -> infinity: Detects the single strongest frequency component (min-entropy)
- alpha -> 0: Counts non-zero spectral bins (Hartley spectral entropy)

**Normative Requirement.** When FFT data is available from the DSP pipeline (TSG.25),
implementations MUST compute spectral entropy H_spectral and include it in signal
metadata. Implementations SHOULD compute Renyi spectral entropy at alpha = 2 for
efficient real-time classification.

### 12.4 Spectral Entropy for Signal Detection

Spectral entropy provides a signal detection statistic:

```
Signal present: H_spectral < H_noise (signal concentrates energy)
Noise only:     H_spectral ~ log_2(N) (energy uniformly spread)
```

The detection threshold is set relative to the noise-only spectral entropy H_noise,
calibrated during a noise-characterization phase:

```
Detect signal iff H_spectral < H_noise - delta
```

where delta is the detection margin (RECOMMENDED: delta = 0.5 * log_2(N)).

---

## 13. Estimation from Finite Samples

### 13.1 The Estimation Problem

All information-theoretic quantities in Tsingou are computed from **finite samples**
within d2ts windows. The true distribution is unknown; only an empirical approximation
is available. This introduces estimation bias and variance.

### 13.2 Plug-In (Maximum Likelihood) Estimator

The simplest estimator replaces the true distribution with the empirical distribution:

```
p_hat(x) = count(x) / N
H_hat(X) = -Sum_{x} p_hat(x) * log_2(p_hat(x))
```

**Bias.** The plug-in estimator is biased downward:

```
E[H_hat] = H(X) - (|A| - 1) / (2 * N * ln(2)) + O(1/N^2)
```

where |A| is the alphabet size and N is the sample size (Miller-Madow correction)
[COVER-THOMAS].

### 13.3 Miller-Madow Bias Correction

```
H_MM(X) = H_hat(X) + (|A_nonzero| - 1) / (2 * N * ln(2))
```

where |A_nonzero| is the number of symbols with non-zero count.

### 13.4 Jackknife Estimator

```
H_JK = N * H_hat - (N-1)/N * Sum_{i=1}^{N} H_hat_{-i}
```

where H_hat_{-i} is the plug-in estimate computed with sample i removed.

### 13.5 KL Divergence Estimation

The plug-in KL divergence estimator:

```
D_KL_hat(P || Q) = Sum_{x} p_hat(x) * log_2(p_hat(x) / q_hat(x))
```

**Problem.** This is undefined when q_hat(x) = 0 for some x where p_hat(x) > 0
(division by zero / log of zero).

**Solution: Laplace Smoothing.**

```
q_smoothed(x) = (count_Q(x) + alpha) / (N_Q + alpha * |A|)
```

where alpha is the smoothing parameter. Typical choice: alpha = 1 (Laplace) or
alpha = 1/|A| (Jeffreys).

**Normative Requirement.** Implementations MUST apply smoothing when computing KL
divergence or cross-entropy from empirical distributions. The RECOMMENDED smoothing
method is Laplace smoothing with alpha = 1.

### 13.6 JSD Estimation

JSD estimation inherits the smoothing requirement from KL divergence, but the mixture
distribution M = (P + Q)/2 naturally has non-zero support wherever either P or Q has
non-zero support, reducing (but not eliminating) zero-probability issues.

**Normative Requirement.** Implementations MUST apply smoothing to both P and Q before
computing JSD, even though the mixture M mitigates some zero-probability issues.

### 13.7 Mutual Information Estimation

For discrete variables, the plug-in estimator:

```
I_hat(X; Y) = H_hat(X) + H_hat(Y) - H_hat(X, Y)
```

inherits the downward bias from entropy estimation. The bias is approximately:

```
Bias(I_hat) ~ (|A_X| - 1)(|A_Y| - 1) / (2 * N * ln(2))
```

For continuous variables, discretization introduces additional bias. The
Kraskov-Stogbauer-Grassberger (KSG) estimator [KRASKOV-2004] based on k-nearest
neighbors avoids discretization entirely:

```
I_KSG(X; Y) = psi(k) - <psi(n_x + 1) + psi(n_y + 1)> + psi(N)
```

where psi is the digamma function, n_x and n_y are neighbor counts in the marginal
spaces, and k is the number of nearest neighbors.

**Normative Requirement.** For discrete signals (protocol messages, categorical data),
implementations MUST use the plug-in estimator with Miller-Madow correction. For
continuous signals (RF samples, analog measurements), implementations SHOULD use the
KSG estimator to avoid discretization bias.

### 13.8 Minimum Sample Size Requirements

Information-theoretic estimates require sufficient sample sizes to be meaningful:

**Table 13-1: Minimum Sample Size Guidelines**

| Measure | Alphabet Size |A| | Minimum N | Rationale |
|---------|--------------|-----------|-----------|
| Entropy H(X) | |A| <= 16 | 10 * \|A\| | Bias < 5% of true value |
| Entropy H(X) | |A| <= 256 | 50 * \|A\| | For byte distributions |
| KL divergence | |A| <= 256 | 100 * \|A\| per distribution | Both distributions well-sampled |
| JSD | |A| <= 256 | 50 * \|A\| per distribution | Less sensitive than KL |
| Mutual information | |A_X| * \|A_Y\| | 20 * \|A_X\| * \|A_Y\| | Joint distribution coverage |

**Normative Requirement.** Implementations MUST NOT compute information-theoretic measures
from samples smaller than the minimum sizes in Table 13-1. When sample size is
insufficient, the system MUST report "insufficient data" rather than a potentially
misleading estimate.

---

## 14. Integration with Tsingou Subsystems

### 14.1 d2ts Operator Mapping

Information-theoretic computations map to d2ts operators as follows:

**Table 14-1: Information Theory to d2ts Operator Mapping**

| IT Measure | d2ts Operator Chain | Input | Output |
|-----------|--------------------|---------|----|
| Shannon entropy H(X) | window -> reduce(entropy) | MultiSet\<BaseSignal\> | Number (bits) |
| Entropy rate h | window -> reduce(conditional_entropy) | MultiSet\<BaseSignal\> | Number (bits/symbol) |
| KL divergence D_KL | window x2 -> reduce(kl_divergence) | Two MultiSet streams | Number (bits) |
| JSD | window x2 -> reduce(jsd) | Two MultiSet streams | Number in [0,1] |
| Mutual information I(X;Y) | window -> join -> reduce(mi) | Two source streams | Number (bits) |
| NMI | reduce(mi) / reduce(entropy) | Two source streams | Number in [0,1] |
| Spectral entropy H_s | map(fft) -> reduce(spectral_entropy) | FFT data | Number (bits) |
| Channel capacity C | map(extract_snr_bw) -> map(shannon_hartley) | SDR metadata | Number (bits/s) |

### 14.2 Atom State for Rendering

Information-theoretic derived state feeds rendering layers via atoms:

```typescript
// Information-theoretic state atoms
const entropyAtom = Atom.make<EntropyState>({
  perSource: new Map(),      // source_id -> current entropy
  global: 0,                 // entropy of all-sources aggregate
  rate: 0,                   // entropy rate
})

const anomalyAtom = Atom.make<AnomalyState>({
  scores: new Map(),         // source_id -> JSD anomaly score
  alerts: [],                // active anomaly alerts
  baselineAge: 0,            // time since baseline was set
})

const correlationAtom = Atom.make<CorrelationState>({
  matrix: [],                // n x n NMI matrix
  pairs: [],                 // top-k correlated pairs
  diversity: 0,              // Shannon diversity index
})

const channelAtom = Atom.make<ChannelState>({
  capacities: new Map(),     // device_id -> Shannon capacity estimate
  utilization: new Map(),    // device_id -> measured vs. capacity ratio
})
```

### 14.3 Rendering Layer Mapping

**Table 14-2: Information-Theoretic Measures to Rendering Layers**

| Measure | Primary Layer | Visualization | Component |
|---------|-------------|--------------|-----------|
| Entropy per source | DOM (z:3) | Entropy bar chart, sorted by source | `EntropyPanel` |
| Entropy sparkline | visx (z:1) | Time-series of entropy values | `EntropyTimeline` |
| JSD anomaly score | DOM (z:3) | Alert panel with severity coloring | `AnomalyAlertPanel` |
| JSD heatmap | visx (z:1) | Source x Time heatmap of JSD scores | `AnomalyHeatmap` |
| NMI correlation matrix | visx (z:1) | Color-coded matrix with dendrogram | `CorrelationMatrix` |
| Source diversity gauge | DOM (z:3) | Single-value indicator (0-1 scale) | `DiversityGauge` |
| Spectral entropy | visx (z:1) | Overlay on FFT spectrum display | `SpectralEntropyOverlay` |
| Channel capacity | DOM (z:3) | SDR device capacity table | `ChannelCapacityPanel` |
| MI-based link graph | R3F (z:0) | Force-directed graph, edge weight = NMI | `MILinkGraph` |

### 14.4 BaseSignal Schema Integration

Information-theoretic measures are recorded as BaseSignal metadata, enabling downstream
operators to use entropy features as inputs:

```typescript
const InformationTheoreticMetadata = Schema.Struct({
  _it_entropy_value: Schema.optional(Schema.Number),
  _it_entropy_timing: Schema.optional(Schema.Number),
  _it_entropy_rate: Schema.optional(Schema.Number),
  _it_entropy_spectral: Schema.optional(Schema.Number),
  _it_entropy_min: Schema.optional(Schema.Number),
  _it_jsd_score: Schema.optional(Schema.Number),
  _it_classification: Schema.optional(Schema.String),
  _it_channel_capacity_bps: Schema.optional(Schema.Number),
  _it_computed_at: Schema.optional(Schema.DateFromSelf),
  _it_window_ms: Schema.optional(Schema.Number),
  _it_sample_count: Schema.optional(Schema.Number),
})
```

The `_it_` prefix namespace avoids collision with other metadata extensions. These fields
are populated by the information-theoretic reduce operators in the derived graph.

### 14.5 NATS Subject Structure

Information-theoretic derived state is published to NATS for cross-node distribution:

```
tsingou.derived.entropy.{source_id}        — per-source entropy updates
tsingou.derived.anomaly.{source_id}        — per-source JSD anomaly scores
tsingou.derived.correlation.{pair_id}      — pairwise NMI updates
tsingou.derived.diversity                  — global diversity index
tsingou.derived.channel.{device_id}        — SDR channel capacity estimates
```

### 14.6 Intelligence Cycle Integration

Information-theoretic measures map to the intelligence cycle phases (ADR-010):

| Phase | IT Measure | Role |
|-------|-----------|------|
| **Direction** | Source diversity D | Identifies collection gaps (low diversity) |
| **Collection** | Channel capacity C | Bounds achievable collection rate per SDR |
| **Processing** | Entropy H(X) | Classifies signals (encrypted vs. plaintext) |
| **Analysis** | JSD, MI, NMI | Detects anomalies and correlations |
| **Dissemination** | Rate-distortion R(D) | Bounds compressed report size |
| **Feedback** | JSD(P_t || P_{t-1}) | Measures analysis drift over time |

---

## 15. Normative Requirements

### 15.1 MUST Requirements

1. **Shannon entropy computation.** Implementations MUST compute Shannon entropy H(X) for
   every windowed signal stream. The entropy MUST be computed in bits (base-2 logarithm).
   [Derived from: Definition 2.1, Section 9]

2. **JSD for anomaly detection.** Implementations MUST use Jensen-Shannon divergence as
   the primary distributional shift measure for anomaly detection.
   [Derived from: Section 5.4, Section 10]

3. **Configurable thresholds.** Anomaly detection thresholds MUST be configurable per
   source and per analysis session.
   [Derived from: Section 10.2, Table 10-1]

4. **Smoothing for divergence computation.** Implementations MUST apply distribution
   smoothing (RECOMMENDED: Laplace with alpha = 1) when computing KL divergence, JSD,
   or cross-entropy from empirical distributions.
   [Derived from: Section 13.5]

5. **Minimum sample size.** Implementations MUST NOT compute information-theoretic
   measures from samples smaller than the minimums in Table 13-1. Insufficient data
   MUST be reported rather than producing misleading estimates.
   [Derived from: Section 13.8]

6. **Channel capacity in SDR metadata.** SDR signal metadata MUST include channel
   capacity estimates computed from measured SNR and bandwidth.
   [Derived from: Section 6.4]

7. **Entropy in signal metadata.** Computed entropy values MUST be stored as BaseSignal
   metadata with the `_it_` namespace prefix.
   [Derived from: Section 14.4]

8. **Full fidelity during active analysis.** Implementations MUST preserve full signal
   fidelity during active analysis sessions. Lossy compression MAY be applied only to
   archived signals with explicit distortion budget.
   [Derived from: Section 7.3]

### 15.2 SHOULD Requirements

1. **Renyi collision entropy.** Implementations SHOULD support Renyi entropy at alpha = 2
   for computationally efficient real-time applications.
   [Derived from: Section 3.3]

2. **Normalized mutual information.** Source correlation reports SHOULD use NMI for
   comparability across source pairs with different entropy levels.
   [Derived from: Section 4.5]

3. **Adaptive baseline.** Implementations SHOULD support adaptive baseline updating with
   configurable decay parameter (RECOMMENDED default: lambda = 0.95).
   [Derived from: Section 10.4]

4. **Dual anomaly detection.** Implementations SHOULD use both information-theoretic
   (JSD) and statistical (Z-score, EWMA from TSG.27) anomaly detection in parallel.
   [Derived from: Section 10.5]

5. **Source diversity display.** Implementations SHOULD compute and display the Shannon
   diversity index as a dashboard metric.
   [Derived from: Section 11.5]

6. **Spectral entropy.** When FFT data is available, implementations SHOULD compute
   spectral entropy and include it in signal metadata.
   [Derived from: Section 12.1]

7. **KSG estimator for continuous signals.** For continuous signals, implementations
   SHOULD use the KSG nearest-neighbor estimator for mutual information.
   [Derived from: Section 13.7]

8. **Miller-Madow correction.** Implementations SHOULD apply the Miller-Madow bias
   correction to entropy estimates from finite samples.
   [Derived from: Section 13.3]

### 15.3 MUST NOT Requirements

1. **Implementations MUST NOT report entropy values computed from fewer than 10 * |A|
   samples** (where |A| is the effective alphabet size) without a confidence warning.
   [Derived from: Section 13.8]

2. **Implementations MUST NOT compute KL divergence without smoothing.** Unsmoothed KL
   divergence is undefined when Q assigns zero probability to events observed under P.
   [Derived from: Section 13.5]

3. **Implementations MUST NOT apply lossy compression to signals during active analysis
   sessions** without explicit analyst authorization.
   [Derived from: Section 7.3]

### 15.4 MAY Requirements

1. **Tsallis entropy.** Implementations MAY support Tsallis entropy for signals exhibiting
   non-extensive behavior.
   [Derived from: Section 3.4]

2. **Time-lagged mutual information.** Implementations MAY compute time-lagged mutual
   information for causal relationship discovery.
   [Derived from: Section 11.4]

3. **Automatic correlation discovery.** Implementations MAY automatically identify
   correlated source pairs via NMI and suggest join operators for the derived graph.
   [Derived from: Section 11.3]

---

## 16. Open Questions

### 16.1 Continuous vs. Discrete Estimation

Many Tsingou signal sources produce continuous-valued data (RF samples, sensor readings)
that must be discretized for entropy estimation. The choice of binning strategy (equal-width,
equal-frequency, or adaptive) affects estimation accuracy. A systematic comparison of
binning strategies for Tsingou's signal types is needed.

### 16.2 High-Dimensional Mutual Information

For sources with high-dimensional signal spaces (e.g., FFT spectra with 1024+ bins), mutual
information estimation in the joint space requires exponentially many samples. Dimensionality
reduction techniques (PCA, autoencoders) may be needed before MI computation.

### 16.3 Non-Stationary Sources

Information-theoretic measures assume stationarity within the estimation window. Many SIGINT
sources are inherently non-stationary (e.g., intermittent transmissions, protocol state
machines). Adaptive window sizing based on stationarity tests is an open design question.

### 16.4 Real-Time Complexity

The d2ts `reduce` operator recomputes the reduction function on every window update. For
large alphabet sizes (|A| = 256 for byte distributions) with multiple simultaneous sources,
the computational cost of entropy estimation may impact real-time performance. Incremental
entropy update algorithms (maintaining running counts rather than recomputing from scratch)
could improve efficiency.

### 16.5 Entropy-Based Signal Detection vs. Energy Detection

For SDR signals, spectral entropy provides an alternative to traditional energy detection
(comparing total power against a threshold). The relative operating characteristics (ROC)
of entropy-based vs. energy-based detection for Tsingou's target signal types require
empirical evaluation.

---

## 17. Bibliography

### Primary Sources

| Key | Full Citation |
|-----|--------------|
| [SHANNON-1948] | Shannon, C.E. "A Mathematical Theory of Communication." Bell System Technical Journal, 27(3-4), pp. 379-423, 623-656, 1948. |
| [SHANNON-1949] | Shannon, C.E. "Communication Theory of Secrecy Systems." Bell System Technical Journal, 28(4), pp. 656-715, 1949. |
| [COVER-THOMAS] | Cover, T.M., Thomas, J.A. "Elements of Information Theory." 2nd ed., Wiley-Interscience, 2006. |

### Divergence and Entropy Generalizations

| Key | Full Citation |
|-----|--------------|
| [KULLBACK-1951] | Kullback, S., Leibler, R.A. "On Information and Sufficiency." Annals of Mathematical Statistics, 22(1), pp. 79-86, 1951. |
| [RENYI-1961] | Renyi, A. "On Measures of Entropy and Information." Proc. 4th Berkeley Symposium on Mathematical Statistics and Probability, Vol. 1, pp. 547-561, 1961. |
| [LIN-1991] | Lin, J. "Divergence Measures Based on the Shannon Entropy." IEEE Transactions on Information Theory, 37(1), pp. 145-151, 1991. |
| [TSALLIS-2009] | Tsallis, C. "Introduction to Nonextensive Statistical Mechanics: Approaching a Complex World." Springer, 2009. |

### Rate-Distortion and Compression

| Key | Full Citation |
|-----|--------------|
| [BERGER-1971] | Berger, T. "Rate Distortion Theory: A Mathematical Basis for Data Compression." Prentice-Hall, 1971. |

### Estimation

| Key | Full Citation |
|-----|--------------|
| [KRASKOV-2004] | Kraskov, A., Stogbauer, H., Grassberger, P. "Estimating Mutual Information." Physical Review E, 69(6), 066138, 2004. |

### Signal Processing Applications

| Key | Full Citation |
|-----|--------------|
| [COSTA-2002] | Costa, M., Goldberger, A.L., Peng, C.K. "Multiscale Entropy Analysis of Complex Physiologic Time Series." Physical Review Letters, 89(6), 068102, 2002. |

### Historical and Foundational

| Key | Full Citation |
|-----|--------------|
| [HARTLEY-1928] | Hartley, R.V.L. "Transmission of Information." Bell System Technical Journal, 7(3), pp. 535-563, 1928. |
| [NYQUIST-1928] | Nyquist, H. "Certain Topics in Telegraph Transmission Theory." Transactions of the AIEE, 47(2), pp. 617-644, 1928. |

### Tsingou Architecture

| Key | Full Citation |
|-----|--------------|
| [ADR-001] | "ADR-001: d2ts as Signal Pipeline Core." docs/tsingou/adr/ADR-001-d2ts-as-signal-pipeline.md, 2026. |
| [ADR-010] | "ADR-010: Full Intelligence Cycle Coverage." docs/tsingou/adr/ADR-010-full-intelligence-cycle.md, 2026. |
| [ADR-011] | "ADR-011: SDR Integration via GNU Radio Bridge." docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md, 2026. |
| [ADR-013] | "ADR-013: Eight Analysis Techniques." docs/tsingou/adr/ADR-013-analysis-techniques.md, 2026. |
| [FLOW-ARCH] | "TSINGOU_FLOW_ARCHITECTURE.md." docs/tsingou/FLOW_ARCHITECTURE.md, 2026. |

### Standards

| Key | Full Citation |
|-----|--------------|
| [RFC2119] | Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels." BCP 14, RFC 2119, 1997. |
| [RFC8174] | Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." BCP 14, RFC 8174, 2017. |

---

<!-- INTEGRATION NOTES

Section TSG.29 — Information Theory

PART VI: Analysis & Mathematics

Dependencies:
  - TSG.25 (DSP Foundations) — FFT data feeds spectral entropy (Section 12)
  - TSG.26 (Differential Dataflow) — all operators run in d2ts framework (Section 14.1)
  - TSG.7 (Signal Pipeline) — information measures are derived graph operators
  - ADR-001 — d2ts as signal processing backbone
  - ADR-011 — SDR integration provides channel capacity context
  - ADR-013 — anomaly detection technique mapping

Dependents:
  - TSG.27 (Statistical Analysis) — complementary anomaly detection (Section 10.5)
  - TSG.4 (Data Fusion) — MI provides fusion quality metrics
  - TSG.31 (Analysis Techniques Catalog) — cites entropy-based classification

Cross-references:
  - TSG.25: FFT output feeds spectral entropy computation (Section 12)
  - TSG.26: d2ts window + reduce operators for all IT computations (Section 14.1)
  - TSG.27: Statistical anomaly detection complements JSD (Section 10.5)
  - TSG.4:  Mutual information as data fusion quality metric
  - TSG.7:  Information measures as derived graph operators
  - TSG.8:  BaseSignal metadata extension for entropy fields (Section 14.4)
  - TSG.11: NATS subjects for derived IT state distribution (Section 14.5)
  - TSG.22: visx layer renders correlation matrix, anomaly heatmap (Section 14.3)

Codebase files referenced:
  - src/lib/tsingou-flow/graph/derived.ts (reduce operators)
  - src/lib/tsingou-flow/operators/window.ts (windowing for estimation)
  - src/lib/tsingou-flow/graph/multiset-helpers.ts (MultiSet structure)
  - docs/tsingou/adr/ADR-010-full-intelligence-cycle.md
  - docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md
  - docs/tsingou/adr/ADR-013-analysis-techniques.md
  - docs/tsingou/FLOW_ARCHITECTURE.md

Research base:
  - research-information-theory.md (13 sections, 12 citations)

Line count: ~2,100 lines
Status: DRAFT
-->
