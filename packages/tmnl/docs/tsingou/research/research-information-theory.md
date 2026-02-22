# Research: Information Theory for Signal Intelligence Analysis

```
Topic:     Information Theory, Entropy, Divergence, Channel Capacity
Purpose:   Raw research for RFC-002 Section TSG.29
Author:    diff-dataflow-theorist (Val team)
Date:      2026-02-18
Status:    COMPLETE
Sources:   [SHANNON-1948], [SHANNON-1949], [COVER-THOMAS], [KULLBACK-1951],
           [RENYI-1961], [BERGER-1971], [LIN-1991], [SHAPIRO-2011],
           Tsingou codebase, d2ts operator semantics
```

---

## 1. Historical Context

### 1.1 Shannon's Foundation (1948-1949)

Claude Shannon published "A Mathematical Theory of Communication" in 1948 [SHANNON-1948],
establishing information theory as a discipline. The paper introduced:

- **Entropy** as a measure of uncertainty/information content
- **Channel capacity** as the maximum reliable communication rate
- **Source coding theorem** (lossless compression limit)
- **Channel coding theorem** (noisy channel limit)

In 1949, Shannon published "Communication Theory of Secrecy Systems" [SHANNON-1949],
establishing information-theoretic security and proving the one-time pad achieves perfect
secrecy.

### 1.2 Key Extensions

| Year | Author(s) | Contribution |
|------|-----------|-------------|
| 1951 | Kullback, Leibler | KL divergence — relative entropy [KULLBACK-1951] |
| 1961 | Renyi | Generalized entropy of order alpha [RENYI-1961] |
| 1968 | Cover, Thomas | Elements of Information Theory textbook [COVER-THOMAS] |
| 1971 | Berger | Rate-distortion theory [BERGER-1971] |
| 1991 | Lin | Jensen-Shannon divergence [LIN-1991] |
| 2003 | Tsallis | Non-extensive entropy for complex systems [TSALLIS-2009] |

### 1.3 Relevance to Tsingou

Tsingou ingests signals from heterogeneous sources and must:
1. **Classify** signals by type/behavior (entropy-based feature extraction)
2. **Detect anomalies** when signal distributions shift (divergence measures)
3. **Correlate** sources that share information (mutual information)
4. **Bound** channel throughput for SDR reception (channel capacity)
5. **Compress** signal representations for storage/transport (rate-distortion)
6. **Assess** encryption strength of intercepted communications (information-theoretic security)

---

## 2. Entropy Measures

### 2.1 Shannon Entropy (Discrete)

For a discrete random variable X with probability mass function p(x):

```
H(X) = -Sum over x in X of p(x) * log2(p(x))
```

Properties:
- H(X) >= 0 (non-negative)
- H(X) = 0 iff X is deterministic (p(x) = 1 for some x)
- H(X) <= log2(|X|) with equality iff X is uniform
- H(X) is concave in p
- Units: bits (base 2), nats (base e), or hartleys (base 10)

**Interpretation**: H(X) is the expected number of bits needed to describe one outcome of X
using an optimal code. Higher entropy = more uncertainty = more information per symbol.

### 2.2 Differential Entropy (Continuous)

For a continuous random variable X with probability density function f(x):

```
h(X) = -Integral of f(x) * ln(f(x)) dx
```

Key differences from discrete entropy:
- Can be **negative** (e.g., h(X) = 1/2 * ln(2*pi*e*sigma^2) for Gaussian, negative when sigma < 1/sqrt(2*pi*e))
- Depends on the **scale** of measurement (not coordinate-free)
- Maximum entropy for fixed variance: Gaussian distribution
- Maximum entropy for fixed support [a,b]: uniform distribution

### 2.3 Renyi Entropy

Generalization of Shannon entropy parameterized by order alpha >= 0, alpha != 1:

```
H_alpha(X) = 1/(1-alpha) * log(Sum over x of p(x)^alpha)
```

Special cases:
- alpha -> 0: H_0(X) = log(|support(X)|) (Hartley entropy / cardinality)
- alpha -> 1: H_1(X) = H(X) (Shannon entropy, by L'Hopital)
- alpha = 2: H_2(X) = -log(Sum of p(x)^2) (collision entropy)
- alpha -> infinity: H_inf(X) = -log(max_x p(x)) (min-entropy)

**Application to Tsingou**: Min-entropy (alpha -> infinity) gives the worst-case
unpredictability, relevant for security assessment. Collision entropy (alpha = 2) is
efficiently estimable from samples, useful for real-time signal classification.

### 2.4 Conditional Entropy

```
H(Y|X) = -Sum over x,y of p(x,y) * log2(p(y|x))
         = H(X,Y) - H(X)
```

Properties:
- H(Y|X) >= 0
- H(Y|X) <= H(Y) with equality iff X and Y are independent
- Conditioning reduces entropy: H(Y|X) <= H(Y)

**Interpretation**: How much uncertainty remains about Y after observing X. If X is a
signal source and Y is a signal type, H(Y|X) measures how much knowing the source helps
predict the signal type.

### 2.5 Joint Entropy

```
H(X,Y) = -Sum over x,y of p(x,y) * log2(p(x,y))
```

Chain rule: H(X,Y) = H(X) + H(Y|X) = H(Y) + H(X|Y)

---

## 3. Mutual Information

### 3.1 Definition

```
I(X;Y) = H(X) + H(Y) - H(X,Y)
        = H(X) - H(X|Y)
        = H(Y) - H(Y|X)
        = Sum over x,y of p(x,y) * log(p(x,y) / (p(x)*p(y)))
```

Properties:
- I(X;Y) >= 0 (non-negative)
- I(X;Y) = 0 iff X and Y are independent
- I(X;Y) = I(Y;X) (symmetric)
- I(X;Y) <= min(H(X), H(Y))
- I(X;X) = H(X) (self-information = entropy)

**Interpretation**: The amount of information shared between X and Y. How much knowing one
variable reduces uncertainty about the other.

### 3.2 Conditional Mutual Information

```
I(X;Y|Z) = H(X|Z) - H(X|Y,Z)
```

Measures the information X and Y share beyond what Z provides.

### 3.3 Application to Source Correlation

In Tsingou, mutual information between signal sources measures their statistical dependence:

- I(Source_A; Source_B) = 0: sources are statistically independent
- I(Source_A; Source_B) >> 0: sources share significant information (correlated)

This enables automated discovery of cross-source correlations without a priori join conditions.
The d2ts `reduce` operator can compute windowed mutual information estimates from empirical
signal distributions.

---

## 4. Divergence Measures

### 4.1 Kullback-Leibler Divergence

```
D_KL(P || Q) = Sum over x of p(x) * log(p(x) / q(x))
```

For continuous distributions:
```
D_KL(P || Q) = Integral of p(x) * ln(p(x) / q(x)) dx
```

Properties:
- D_KL(P || Q) >= 0 (Gibbs' inequality)
- D_KL(P || Q) = 0 iff P = Q
- NOT symmetric: D_KL(P || Q) != D_KL(Q || P) in general
- NOT a metric (violates triangle inequality)
- Can be infinite if Q(x) = 0 where P(x) > 0

**Interpretation**: The information lost when Q is used to approximate P. Or: the expected
log-likelihood ratio when data comes from P but is modeled by Q.

**Application to anomaly detection**: Establish a baseline distribution P_baseline from
historical signal data. Compare current window distribution Q_current against baseline.
Large D_KL(Q_current || P_baseline) indicates anomaly.

### 4.2 Jensen-Shannon Divergence

```
JSD(P || Q) = 1/2 * D_KL(P || M) + 1/2 * D_KL(Q || M)
where M = 1/2 * (P + Q)
```

Properties:
- 0 <= JSD(P || Q) <= 1 (when using log2)
- JSD(P || Q) = JSD(Q || P) (symmetric)
- sqrt(JSD) is a metric (satisfies triangle inequality)
- Always finite (unlike KL divergence)
- Related to mutual information: JSD(P || Q) = I(X; Z) where Z = Bernoulli(1/2) selects P or Q

**Application to Tsingou**: JSD is preferred over KL divergence for anomaly detection because:
1. It is symmetric (no preferred "baseline" direction)
2. It is always finite (no division-by-zero risk)
3. Its square root is a proper metric (enables distance-based algorithms)

### 4.3 Cross-Entropy

```
H(P, Q) = -Sum over x of p(x) * log(q(x))
         = H(P) + D_KL(P || Q)
```

The expected number of bits needed to encode samples from P using a code optimized for Q.
Cross-entropy >= entropy, with equality iff P = Q.

### 4.4 Fisher Information

```
I(theta) = E[(d/d_theta log f(X; theta))^2]
         = -E[d^2/d_theta^2 log f(X; theta)]
```

Measures how much a parameter theta can be estimated from data. Related to the Cramer-Rao
lower bound on estimator variance.

**Application**: Bounds the precision of parameter estimation from signal data (e.g.,
estimating carrier frequency, modulation index, or signal strength).

---

## 5. Channel Capacity

### 5.1 Shannon-Hartley Theorem

For an additive white Gaussian noise (AWGN) channel with bandwidth B and signal-to-noise
ratio SNR:

```
C = B * log2(1 + SNR)   bits/second
```

where:
- C = channel capacity (maximum achievable bit rate with arbitrarily low error probability)
- B = bandwidth in Hertz
- SNR = signal power / noise power (linear, not dB)

### 5.2 Regime Analysis

| Regime | Condition | Capacity Approximation | Constraint |
|--------|-----------|----------------------|------------|
| Bandwidth-limited | SNR >> 1 | C ~ B * log2(SNR) | Capacity grows slowly with power |
| Power-limited | SNR << 1 | C ~ SNR * B / ln(2) | Capacity linear in power |
| Infinite bandwidth | B -> infinity | C -> P / (N_0 * ln(2)) | Noise grows with bandwidth |

### 5.3 SDR Application

For an RTL-SDR with:
- B = 2.4 MHz bandwidth
- SNR = 20 dB (100 linear)

```
C = 2.4e6 * log2(1 + 100) = 2.4e6 * 6.66 = 15.98 Mbit/s
```

This is the theoretical maximum data rate. Practical systems achieve 50-80% of channel
capacity depending on modulation scheme, coding, and implementation losses.

### 5.4 Capacity of Wideband SDR Systems

For HackRF One (B = 20 MHz, typical SNR = 10 dB):
```
C = 20e6 * log2(1 + 10) = 20e6 * 3.46 = 69.2 Mbit/s
```

For USRP (B = 56 MHz, SNR = 30 dB):
```
C = 56e6 * log2(1 + 1000) = 56e6 * 9.97 = 558.3 Mbit/s
```

These bounds inform Tsingou's NATS subject bandwidth allocation for SDR signal ingestion.

---

## 6. Rate-Distortion Theory

### 6.1 Rate-Distortion Function

Given a source X with distribution P_X and a distortion measure d(x, x_hat):

```
R(D) = min over p(x_hat|x) such that E[d(X, X_hat)] <= D of I(X; X_hat)
```

R(D) is the minimum bit rate needed to represent X with average distortion at most D.

### 6.2 Key Results

**Gaussian source, squared error distortion**:
```
R(D) = max(0, 1/2 * log2(sigma^2 / D))   bits/sample
```

**Bernoulli source, Hamming distortion**:
```
R(D) = H(p) - H(D)   for 0 <= D <= min(p, 1-p)
```

### 6.3 Application to Tsingou

Rate-distortion theory bounds the trade-off between:
- **Signal fidelity** (distortion D) — how accurately signals are represented
- **Storage/bandwidth cost** (rate R) — how many bits per signal

For long-running analysis sessions with JetStream signal persistence, rate-distortion
bounds inform:
- Compaction strategies in d2ts Index (lossy merging of old versions)
- Signal downsampling for historical replay
- Metadata extraction (lossy: keep features, discard raw payload)

---

## 7. Information-Theoretic Security

### 7.1 Perfect Secrecy

**Definition (Shannon, 1949).** An encryption system has perfect secrecy if:

```
P(M = m | C = c) = P(M = m)   for all m, c
```

Observing the ciphertext C gives zero information about the plaintext M.

**Equivalent formulations**:
- I(M; C) = 0 (mutual information between plaintext and ciphertext is zero)
- H(M | C) = H(M) (entropy of plaintext unchanged after observing ciphertext)

### 7.2 Shannon's Theorem on Perfect Secrecy

**Theorem.** A cipher achieves perfect secrecy iff H(K) >= H(M), where K is the key
space. The one-time pad achieves this bound with equality.

**Corollary.** Perfect secrecy requires the key to be at least as long as the message.
No encryption with a shorter key can achieve information-theoretic security.

### 7.3 Unicity Distance

```
n_0 = H(K) / D
```

where D = log2(|alphabet|) - H(source) is the redundancy per symbol.

n_0 is the minimum ciphertext length at which a unique decryption key becomes
determinable (with enough computation). For English text with a 128-bit key:

```
n_0 = 128 / (log2(26) - 1.0) = 128 / 3.7 ~ 35 characters
```

### 7.4 SIGINT Implications

| Scenario | Information-Theoretic Status | SIGINT Consequence |
|----------|---------------------------|-------------------|
| One-time pad (proper use) | Perfect secrecy | Provably unbreakable |
| One-time pad (key reuse) | Broken — VENONA project | Vulnerable to known-plaintext |
| AES-256 | Computational security only | Breakable with quantum computing |
| Stream cipher | Computational security | Vulnerable to statistical analysis |
| Plaintext + noise | Noisy channel capacity limit | Extractable above capacity |

Tsingou's anomaly detection can identify encrypted vs. unencrypted traffic by measuring
entropy: encrypted data has entropy near log2(|alphabet|) (maximal), while plaintext has
lower entropy due to language redundancy.

---

## 8. Entropy-Based Signal Classification

### 8.1 Entropy as Feature

The entropy of a signal's value distribution serves as a classification feature:

| Signal Type | Expected Entropy | Rationale |
|-------------|-----------------|-----------|
| Encrypted traffic | High (near maximum) | Indistinguishable from random |
| Compressed data | High | Effective compression removes redundancy |
| Natural language text | Medium | Redundancy from language structure |
| Protocol headers | Low-medium | Structured, repetitive format |
| Constant/heartbeat | Very low | Highly predictable |
| Random noise | Maximum | Uniform distribution |

### 8.2 Entropy Rate

For a stationary stochastic process:

```
h = lim n->inf 1/n * H(X_1, X_2, ..., X_n)
```

The entropy rate captures temporal dependencies that single-symbol entropy misses.
For Markov processes of order k:

```
h = H(X_n | X_{n-1}, ..., X_{n-k})
```

### 8.3 Multi-Scale Entropy

Sample entropy and multi-scale entropy [COSTA-2002] analyze signal complexity across
time scales. Applied to Tsingou windowed signals:
1. Coarse-grain the signal at multiple time scales
2. Compute sample entropy at each scale
3. Complex signals show high entropy across scales
4. Simple periodic signals show low entropy at their characteristic scale

---

## 9. Information-Theoretic Anomaly Detection

### 9.1 Distribution Shift Detection

**Baseline phase**: Compute empirical distribution P_baseline from a reference window
of signals (e.g., first hour of collection).

**Monitoring phase**: For each new window of signals, compute empirical distribution
Q_current and measure:

```
anomaly_score = JSD(P_baseline || Q_current)
```

Alert when anomaly_score exceeds threshold theta.

### 9.2 Windowed KL Divergence

Using d2ts `window` and `reduce` operators:

1. `window(baseline_duration)` captures baseline signal distribution
2. `window(current_duration)` captures current signal distribution
3. `reduce` computes KL divergence between distributions
4. `filter(score > theta)` emits alerts

### 9.3 Source Diversity Measurement

Shannon's diversity index applied to signal sources:

```
D = -Sum over sources s of (n_s / N) * log2(n_s / N)
```

where n_s is the signal count from source s and N is the total signal count.

Low D = dominated by few sources (concentration risk).
High D = balanced across many sources (healthy diversity).

### 9.4 Information Gain for Feature Selection

When building signal classifiers, information gain selects the most discriminative features:

```
IG(Y; X_i) = H(Y) - H(Y | X_i)
```

Rank features by IG and select the top-k. This guides which BaseSignal metadata fields
are most useful for classification.

---

## 10. Connections to Differential Dataflow (TSG.26)

### 10.1 Entropy of MultiSet Differences

Given a differential dataflow trace with differences delta(v) at each version v, the
entropy of the difference distribution characterizes the "information content" of each
update:

```
H(delta(v)) = -Sum over d of |delta(v)(d)| / N * log2(|delta(v)(d)| / N)
```

where N = Sum of |delta(v)(d)|.

High-entropy updates contain diverse changes; low-entropy updates contain concentrated
changes (e.g., a single signal type dominating).

### 10.2 Mutual Information Between Input Streams

For two d2ts input streams A and B, the windowed mutual information I(A; B) measures
their statistical dependence. This can trigger automatic join suggestions in the derived
graph: if I(A; B) > threshold, propose a correlation analysis.

### 10.3 Entropy-Based Compaction

Rate-distortion theory suggests an optimal compaction strategy for the d2ts Index:
compact versions with the lowest information content first (highest redundancy with
neighboring versions).

---

## 11. Connections to DSP (TSG.25)

### 11.1 Spectral Entropy

Given an FFT power spectrum P(f_k) for k = 1, ..., N:

Normalize: p(f_k) = P(f_k) / Sum_k P(f_k)

```
H_spectral = -Sum over k of p(f_k) * log2(p(f_k))
```

- H_spectral = 0: all energy in one frequency bin (pure tone)
- H_spectral = log2(N): uniform energy across all bins (white noise)

### 11.2 Time-Frequency Entropy

Apply Renyi entropy to short-time Fourier transform (STFT) representations:

```
H_alpha(STFT) = 1/(1-alpha) * log(Sum over t,f of |STFT(t,f)|^(2*alpha) / (Sum of |STFT|^2)^alpha)
```

Low alpha emphasizes rare events; high alpha emphasizes dominant components.

---

## 12. Estimation from Finite Samples

### 12.1 Plug-In Estimator

```
H_hat(X) = -Sum over x of p_hat(x) * log2(p_hat(x))
where p_hat(x) = count(x) / N
```

Biased downward: E[H_hat] < H(X). Bias ~ (|X| - 1) / (2N) (Miller-Madow correction).

### 12.2 KL Divergence Estimation

For two empirical distributions from samples of size n and m:

```
D_KL_hat(P || Q) = Sum over x of p_hat(x) * log(p_hat(x) / q_hat(x))
```

Requires smoothing when q_hat(x) = 0 (Laplace smoothing: add 1/|X| pseudocount).

### 12.3 Mutual Information Estimation

```
I_hat(X; Y) = H_hat(X) + H_hat(Y) - H_hat(X, Y)
```

For continuous variables, k-nearest-neighbor estimators [KRASKOV-2004] avoid
discretization bias.

---

## 13. Bibliography

| Key | Full Citation |
|-----|--------------|
| [SHANNON-1948] | Shannon, C.E. "A Mathematical Theory of Communication." Bell System Technical Journal, 27(3-4), pp. 379-423, 623-656, 1948. |
| [SHANNON-1949] | Shannon, C.E. "Communication Theory of Secrecy Systems." Bell System Technical Journal, 28(4), pp. 656-715, 1949. |
| [COVER-THOMAS] | Cover, T.M., Thomas, J.A. "Elements of Information Theory." 2nd ed., Wiley, 2006. |
| [KULLBACK-1951] | Kullback, S., Leibler, R.A. "On Information and Sufficiency." Annals of Mathematical Statistics, 22(1), pp. 79-86, 1951. |
| [RENYI-1961] | Renyi, A. "On Measures of Entropy and Information." Proc. 4th Berkeley Symposium on Mathematical Statistics and Probability, Vol. 1, pp. 547-561, 1961. |
| [BERGER-1971] | Berger, T. "Rate Distortion Theory: A Mathematical Basis for Data Compression." Prentice-Hall, 1971. |
| [LIN-1991] | Lin, J. "Divergence Measures Based on the Shannon Entropy." IEEE Transactions on Information Theory, 37(1), pp. 145-151, 1991. |
| [TSALLIS-2009] | Tsallis, C. "Introduction to Nonextensive Statistical Mechanics." Springer, 2009. |
| [COSTA-2002] | Costa, M., Goldberger, A.L., Peng, C.K. "Multiscale Entropy Analysis of Complex Physiologic Time Series." Physical Review Letters, 89(6), 2002. |
| [KRASKOV-2004] | Kraskov, A., Stogbauer, H., Grassberger, P. "Estimating Mutual Information." Physical Review E, 69(6), 2004. |
| [HARTLEY-1928] | Hartley, R.V.L. "Transmission of Information." Bell System Technical Journal, 7(3), pp. 535-563, 1928. |
| [NYQUIST-1928] | Nyquist, H. "Certain Topics in Telegraph Transmission Theory." Transactions of the AIEE, 47(2), pp. 617-644, 1928. |
