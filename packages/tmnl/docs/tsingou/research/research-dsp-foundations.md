# Research: DSP Mathematical Foundations for SIGINT Visualization

```
Document:     research-dsp-foundations.md
Purpose:      Raw research with mathematical derivations for TSG.25
Author:       Val (dsp-specialist)
Created:      2026-02-18
Status:       COMPLETE
Feeds Into:   rfc-section-dsp-foundations.md (TSG.25)
```

> This document collects the mathematical foundations, algorithmic analysis, and
> performance characteristics of digital signal processing operations relevant to
> SIGINT visualization in the Tsingou platform. All derivations are presented with
> sufficient rigor to justify the normative requirements in the RFC section.

---

## Table of Contents

1. [Discrete Fourier Transform (DFT)](#1-discrete-fourier-transform-dft)
2. [Fast Fourier Transform (FFT) Algorithms](#2-fast-fourier-transform-fft-algorithms)
3. [Windowing Functions](#3-windowing-functions)
4. [Nyquist-Shannon Sampling Theorem](#4-nyquist-shannon-sampling-theorem)
5. [IQ Signal Representation](#5-iq-signal-representation)
6. [Demodulation Theory](#6-demodulation-theory)
7. [Digital Filter Design](#7-digital-filter-design)
8. [Multirate Signal Processing](#8-multirate-signal-processing)
9. [Spectral Estimation Methods](#9-spectral-estimation-methods)
10. [Time-Frequency Analysis](#10-time-frequency-analysis)
11. [Noise Characterization and Dynamic Range](#11-noise-characterization-and-dynamic-range)

---

## 1. Discrete Fourier Transform (DFT)

### 1.1 Definition

The Discrete Fourier Transform maps a finite-length sequence x[n] of N complex
numbers to a sequence X[k] of N complex numbers:

```
X[k] = sum_{n=0}^{N-1} x[n] * W_N^{kn},   k = 0, 1, ..., N-1

where W_N = e^{-j*2*pi/N}  (the Nth root of unity)
```

The inverse DFT recovers x[n]:

```
x[n] = (1/N) * sum_{k=0}^{N-1} X[k] * W_N^{-kn},   n = 0, 1, ..., N-1
```

### 1.2 Properties

| Property | Time Domain | Frequency Domain |
|----------|-------------|------------------|
| Linearity | a*x[n] + b*y[n] | a*X[k] + b*Y[k] |
| Time shift | x[n - m] | W_N^{km} * X[k] |
| Frequency shift | W_N^{-ln} * x[n] | X[k - l] |
| Convolution | x[n] (*) y[n] | X[k] * Y[k] |
| Parseval's | sum |x[n]|^2 | (1/N) * sum |X[k]|^2 |
| Duality | X[n] | N * x[-k] mod N |

### 1.3 Frequency Resolution

The DFT frequency resolution is:

```
Delta_f = f_s / N
```

where f_s is the sampling frequency and N is the transform length. Increasing N
improves frequency resolution but increases computational cost (O(N^2) for direct
DFT) and reduces temporal resolution (longer observation window).

### 1.4 Zero-Padding

Zero-padding a sequence from length N to length M > N does NOT improve spectral
resolution (the underlying bandwidth remains f_s/N), but it does provide denser
frequency-domain sampling (interpolation in frequency). The frequency bin spacing
becomes f_s/M, providing smoother spectral displays.

---

## 2. Fast Fourier Transform (FFT) Algorithms

### 2.1 Cooley-Tukey Radix-2 Decimation-in-Time (DIT)

The Cooley-Tukey algorithm decomposes an N-point DFT (N = 2^m) into two N/2-point
DFTs by splitting even and odd indexed samples:

```
X[k] = sum_{n=0}^{N/2-1} x[2n] * W_{N/2}^{kn}
      + W_N^k * sum_{n=0}^{N/2-1} x[2n+1] * W_{N/2}^{kn}

     = E[k] + W_N^k * O[k]
```

where E[k] is the DFT of even-indexed samples and O[k] is the DFT of odd-indexed
samples. The twiddle factor W_N^k provides the phase rotation.

**Butterfly operation** (the core computational unit):

```
X[k]       = E[k] + W_N^k * O[k]
X[k + N/2] = E[k] - W_N^k * O[k]
```

**Computational complexity:**

- Direct DFT: O(N^2) complex multiplications
- Radix-2 FFT: (N/2) * log_2(N) complex multiplications
- For N = 1024: DFT = 1,048,576 ops; FFT = 5,120 ops (205x speedup)
- For N = 4096: DFT = 16,777,216 ops; FFT = 24,576 ops (683x speedup)

### 2.2 Radix-4 and Split-Radix

**Radix-4** decomposes the DFT into four N/4-point sub-transforms, exploiting
the trivial twiddle factors W_4^0=1, W_4^1=-j, W_4^2=-1, W_4^3=j:

```
Complexity: (3N/8) * log_2(N) complex multiplications
```

**Split-radix** merges radix-2 and radix-4 decompositions. The first sub-transform
(radix-2, no twiddle factor) is combined with two radix-4 sub-transforms:

```
Complexity: (N/3)(log_2(N) - 3) + 4/3  complex multiplications (for N >= 4)
```

This was the lowest known operation count for power-of-two FFTs for many years.
Recent variants (conjugate pair split-radix by Johnson and Frigo, 2007) achieve
slightly lower counts.

### 2.3 Mixed-Radix FFT

For composite N = r_1 * r_2 * ... * r_m, the Cooley-Tukey decomposition
generalizes to mixed radices. Each stage i performs r_i-point sub-DFTs.
The total complexity remains O(N log N) for smooth numbers (highly composite N).

### 2.4 Bluestein's Algorithm (Chirp-Z Transform)

For arbitrary N (including primes), Bluestein's algorithm reformulates the DFT
as a convolution by substituting kn = -(k-n)^2/2 + k^2/2 + n^2/2:

```
X[k] = W_N^{k^2/2} * sum_{n=0}^{N-1} [x[n] * W_N^{n^2/2}] * W_N^{-(k-n)^2/2}
```

This is a convolution of the chirped input x[n]*W_N^{n^2/2} with the chirp
sequence W_N^{-n^2/2}, computable via three FFTs of length M >= 2N-1 (padded
to a power of 2).

**Complexity:** O(N log N) for ANY N, even prime — but 3-6x slower than
Cooley-Tukey for composite sizes due to three FFT calls and the chirp
multiplication overhead.

### 2.5 FFT Algorithm Selection for SIGINT

| Algorithm | When to Use | Complexity | Notes |
|-----------|------------|------------|-------|
| Radix-2 DIT | N = 2^m (most common) | (N/2)*log_2(N) mults | Standard choice |
| Split-radix | N = 2^m, max performance | ~(N/3)*log_2(N) mults | Lowest op count |
| Mixed-radix | Composite N | O(N*log(N)) | Flexible |
| Bluestein | Arbitrary/prime N | O(N*log(N)) | 3-6x overhead |
| Rader | Prime N | O(N*log(N)) | Based on number theory |

For Tsingou: GNU Radio typically uses power-of-two FFT lengths (256, 512, 1024,
2048, 4096, 8192), so radix-2 or split-radix algorithms dominate. FFTW library
auto-selects the optimal algorithm at runtime via its planning mechanism.

---

## 3. Windowing Functions

### 3.1 The Spectral Leakage Problem

Finite-length observation of a signal is mathematically equivalent to multiplication
by a rectangular window w_rect[n] = 1 for 0 <= n <= N-1. In the frequency domain,
this is convolution with the Dirichlet kernel:

```
W_rect(f) = sin(pi*f*N) / sin(pi*f) * e^{-j*pi*f*(N-1)}
```

The Dirichlet kernel has:
- Mainlobe width: 2/N (first null-to-null)
- Peak sidelobe: -13.3 dB
- Sidelobe rolloff: -6 dB/octave

These sidelobes cause spectral leakage — energy from one frequency "leaking" into
adjacent frequency bins, potentially masking weak signals near strong ones.

### 3.2 Window Function Comparison

| Window | Mainlobe Width (bins) | Peak Sidelobe (dB) | Sidelobe Rolloff (dB/oct) | Processing Loss (dB) | ENBW (bins) |
|--------|----------------------|--------------------|--------------------------|--------------------|-------------|
| Rectangular | 2 | -13.3 | -6 | 0.0 | 1.00 |
| Hann | 4 | -31.5 | -18 | 1.42 | 1.50 |
| Hamming | 4 | -42.7 | -6 | 1.36 | 1.36 |
| Blackman | 6 | -58.1 | -18 | 1.73 | 1.73 |
| Blackman-Harris (4-term) | 8 | -92.0 | -6 | 2.00 | 2.00 |
| Kaiser (beta=6) | ~5 | -44.0 | varies | ~1.5 | ~1.5 |
| Kaiser (beta=9) | ~7 | -69.0 | varies | ~1.8 | ~1.8 |
| Kaiser (beta=14) | ~10 | -105.0 | varies | ~2.3 | ~2.3 |
| Flat-top | 10 | -93.6 | -6 | 3.77 | 3.77 |

ENBW = Equivalent Noise Bandwidth (in bins). Processing loss = 10*log_10(ENBW).

### 3.3 Mathematical Definitions

**Hann window:**
```
w[n] = 0.5 * (1 - cos(2*pi*n / (N-1))),   n = 0, ..., N-1
```

**Hamming window:**
```
w[n] = 0.54 - 0.46 * cos(2*pi*n / (N-1)),   n = 0, ..., N-1
```

**Blackman window:**
```
w[n] = 0.42 - 0.5*cos(2*pi*n/(N-1)) + 0.08*cos(4*pi*n/(N-1))
```

**Blackman-Harris (4-term):**
```
w[n] = a_0 - a_1*cos(2*pi*n/(N-1)) + a_2*cos(4*pi*n/(N-1)) - a_3*cos(6*pi*n/(N-1))

a_0 = 0.35875,  a_1 = 0.48829,  a_2 = 0.14128,  a_3 = 0.01168
```

**Kaiser window:**
```
w[n] = I_0(beta * sqrt(1 - ((2n/(N-1)) - 1)^2)) / I_0(beta)

where I_0 is the zeroth-order modified Bessel function of the first kind
```

The Kaiser window is parametric: beta controls the sidelobe-mainlobe tradeoff.

### 3.4 Window Selection for SIGINT Applications

| Scenario | Recommended Window | Rationale |
|----------|-------------------|-----------|
| General spectrum monitoring | Hann | Good balance of resolution and leakage |
| Weak signal detection near strong | Blackman-Harris | -92 dB sidelobes suppress masking |
| Frequency measurement accuracy | Flat-top | Minimal scalloping loss |
| Real-time waterfall display | Hann or Hamming | Computational efficiency + adequate leakage |
| Narrowband signal identification | Kaiser (high beta) | Adjustable resolution/leakage |
| Broadband power measurement | Rectangular | No amplitude distortion |

For Tsingou: The waterfall display and PSD plots rendered on visx and p5 layers
typically use Hann or Blackman-Harris windows. The window function MUST be applied
before the FFT in the GNU Radio processing chain; the windowed FFT data published
to NATS already reflects the chosen window.

---

## 4. Nyquist-Shannon Sampling Theorem

### 4.1 Statement

If a continuous-time signal x(t) is bandlimited with maximum frequency f_max
(i.e., X(f) = 0 for |f| > f_max), then x(t) is uniquely determined by its
samples x[n] = x(n*T_s) taken at rate f_s = 1/T_s, provided:

```
f_s > 2 * f_max    (strict inequality for exact reconstruction)
f_s >= 2 * f_max   (sufficient for practical purposes with ideal reconstruction)
```

The minimum sampling rate 2*f_max is called the **Nyquist rate**. The maximum
representable frequency f_s/2 is the **Nyquist frequency**.

### 4.2 Reconstruction (Whittaker-Shannon Interpolation)

Perfect reconstruction from samples uses the sinc interpolation formula:

```
x(t) = sum_{n=-inf}^{inf} x[n] * sinc((t - n*T_s) / T_s)

where sinc(u) = sin(pi*u) / (pi*u)
```

This formula is not causal and requires infinite samples — practical systems use
finite-length approximations (FIR interpolation filters).

### 4.3 Aliasing

When f_s < 2*f_max, frequencies above f_s/2 fold back (alias) into the band
[0, f_s/2]:

```
f_alias = |f_signal - k*f_s|,   k chosen so that 0 <= f_alias <= f_s/2
```

Aliasing is irreversible once the signal has been sampled. Prevention requires
analog anti-aliasing lowpass filtering before the ADC.

### 4.4 Anti-Aliasing Filter Requirements

The anti-aliasing filter must satisfy:
- Passband: 0 to f_max with acceptable ripple (typically < 0.1 dB)
- Transition band: f_max to f_s/2
- Stopband: f_s/2 to infinity with sufficient attenuation

The transition band width (f_s/2 - f_max) determines filter complexity. Narrow
transition bands require high-order filters. In SDR systems, oversampling relaxes
this requirement — sampling at f_s >> 2*f_max widens the transition band.

### 4.5 Complex (IQ) Sampling

For complex baseband signals (Section 5), the sampling theorem applies to the
one-sided bandwidth:

```
f_s >= B    (where B is the total signal bandwidth, not 2*B)
```

This is because the I and Q channels independently sample real signals, and the
complex representation captures both positive and negative frequencies. An IQ
sampled signal at rate f_s covers the frequency range [-f_s/2, +f_s/2].

---

## 5. IQ Signal Representation

### 5.1 Analytic Signal

Given a real signal x(t), the analytic signal is:

```
z(t) = x(t) + j * H{x(t)}
```

where H{} denotes the Hilbert transform:

```
H{x(t)} = (1/pi) * PV integral_{-inf}^{inf} x(tau) / (t - tau) d(tau)
```

(PV = Cauchy principal value)

The analytic signal has the property that its Fourier transform Z(f) = 0 for
f < 0 (all negative frequencies are suppressed).

### 5.2 Complex Baseband (IQ) Representation

A bandpass signal centered at carrier frequency f_c:

```
s(t) = Re{ z_bb(t) * e^{j*2*pi*f_c*t} }
     = I(t)*cos(2*pi*f_c*t) - Q(t)*sin(2*pi*f_c*t)
```

where z_bb(t) = I(t) + j*Q(t) is the complex baseband (complex envelope).

- I(t) = In-phase component
- Q(t) = Quadrature component
- |z_bb(t)| = instantaneous amplitude (envelope)
- arg(z_bb(t)) = instantaneous phase
- (1/2*pi) * d/dt[arg(z_bb(t))] = instantaneous frequency deviation from f_c

### 5.3 IQ Data Formats in SDR

| Format | Bits/Sample | Description | Dynamic Range |
|--------|-------------|-------------|---------------|
| CU8 | 8 unsigned | RTL-SDR native (0-255, offset binary) | ~48 dB |
| CS8 | 8 signed | Signed 8-bit (-128 to 127) | ~48 dB |
| CS16 | 16 signed | HackRF, Airspy, USRP (little-endian) | ~96 dB |
| CF32 | 32 float | GNU Radio native (IEEE 754 float) | ~150 dB |
| CF64 | 64 float | Double precision (scientific use) | ~300 dB |

The IQ sample rate determines the instantaneous bandwidth:

```
Bandwidth = f_s (for complex IQ sampling)
```

For RTL-SDR at 2.4 MSPS: 2.4 MHz instantaneous bandwidth.
For USRP B210 at 56 MSPS: 56 MHz instantaneous bandwidth.

### 5.4 SigMF Metadata

Signal Metadata Format (SigMF) standardizes metadata for IQ recordings:

```json
{
  "global": {
    "core:datatype": "cf32_le",
    "core:sample_rate": 2400000,
    "core:version": "1.0.0"
  },
  "captures": [{
    "core:sample_start": 0,
    "core:frequency": 162400000
  }],
  "annotations": [{
    "core:sample_start": 0,
    "core:sample_count": 2400000,
    "core:label": "NOAA Weather Radio"
  }]
}
```

Tsingou ingests SigMF metadata via `tsingou.signal.sdr.metadata.*` NATS subjects.

---

## 6. Demodulation Theory

### 6.1 Amplitude Modulation (AM)

**Modulated signal:**
```
s_AM(t) = [1 + m*x(t)] * A_c * cos(2*pi*f_c*t)

where m = modulation index (0 < m <= 1 for standard AM)
```

**Envelope detection (demodulation):**
```
|z_bb(t)| = A_c * [1 + m*x(t)]
x_demod(t) = |z_bb(t)| - DC_offset
```

In the IQ domain: envelope = sqrt(I^2 + Q^2). This is computationally trivial
and does not require carrier synchronization.

### 6.2 Frequency Modulation (FM)

**Modulated signal:**
```
s_FM(t) = A_c * cos(2*pi*f_c*t + 2*pi*k_f * integral_0^t x(tau) d(tau))

where k_f = frequency sensitivity (Hz per unit amplitude)
```

**Frequency deviation:**
```
Delta_f(t) = k_f * x(t)
```

**Carson's bandwidth rule:**
```
B_FM ~ 2*(Delta_f_max + f_max) = 2*f_max*(beta + 1)

where beta = Delta_f_max / f_max  (modulation index)
```

**FM demodulation via IQ differentiation:**
```
f_inst(t) = (1/2*pi) * d/dt[arg(z_bb(t))]
           = (1/2*pi) * d/dt[arctan(Q(t)/I(t))]
           = (1/2*pi) * [I(t)*Q'(t) - Q(t)*I'(t)] / [I(t)^2 + Q(t)^2]
```

**Discrete-time approximation:**
```
f_inst[n] ~ (f_s/2*pi) * arg(z_bb[n] * conj(z_bb[n-1]))
```

This single-sample delay discriminator is the most common FM demodulation
algorithm in SDR implementations.

### 6.3 Phase-Locked Loop (PLL) Demodulation

A digital PLL tracks the carrier phase and frequency:

```
Phase detector:    e[n] = arg(z_bb[n] * conj(e^{j*theta[n]}))
Loop filter:       v[n] = alpha*e[n] + beta*sum_{k=0}^{n} e[k]
NCO update:        theta[n+1] = theta[n] + v[n]
```

The PLL can demodulate FM (the loop filter output v[n] IS the demodulated signal),
track carrier phase for coherent demodulation, and perform carrier recovery for
PSK/QAM.

PLL loop bandwidth determines tracking speed vs noise rejection:
- Wide loop BW: fast acquisition, more noise
- Narrow loop BW: better noise rejection, slower tracking

### 6.4 Single-Sideband (SSB) Demodulation

SSB signals occupy only one sideband (upper USB or lower LSB) around the carrier:

```
USB: f_c to f_c + B
LSB: f_c - B to f_c
```

Demodulation requires:
1. Frequency shift to baseband (mix with local oscillator at f_c)
2. Lowpass filter to bandwidth B
3. Take the real part

The Hilbert transform method generates the analytic signal, then frequency-shifts:

```
x_demod(t) = Re{ z_bb(t) * e^{-j*2*pi*f_BFO*t} }

where f_BFO is the beat frequency oscillator offset
```

### 6.5 Digital Modulation (PSK, QAM)

**Phase-Shift Keying (PSK):**

M-PSK maps log_2(M) bits to one of M equally-spaced phase points:

```
s_k(t) = A * cos(2*pi*f_c*t + 2*pi*k/M),   k = 0, 1, ..., M-1
```

IQ constellation: M points equally spaced on a circle of radius A.

| Scheme | Bits/Symbol | Phase Spacing | Eb/N0 for BER=10^-5 |
|--------|-------------|---------------|---------------------|
| BPSK | 1 | 180 deg | 9.6 dB |
| QPSK | 2 | 90 deg | 9.6 dB |
| 8-PSK | 3 | 45 deg | 13.0 dB |
| 16-PSK | 4 | 22.5 deg | 18.5 dB |

**Quadrature Amplitude Modulation (QAM):**

M-QAM maps log_2(M) bits to a rectangular grid in the IQ plane:

```
s(t) = I_k*cos(2*pi*f_c*t) - Q_k*sin(2*pi*f_c*t)

where (I_k, Q_k) are the constellation point coordinates
```

| Scheme | Bits/Symbol | Constellation Points | Eb/N0 for BER=10^-5 |
|--------|-------------|---------------------|---------------------|
| 4-QAM (= QPSK) | 2 | 4 | 9.6 dB |
| 16-QAM | 4 | 16 | 13.4 dB |
| 64-QAM | 6 | 64 | 17.8 dB |
| 256-QAM | 8 | 256 | 23.8 dB |

**Demodulation (symbol detection):**

Maximum likelihood detection selects the constellation point closest to the
received symbol in Euclidean distance:

```
k_hat = argmin_k |r - s_k|^2

where r = received symbol, s_k = kth constellation point
```

### 6.6 Demodulation in SIGINT Context

In SIGINT, the demodulation mode is often unknown a priori. The system must:

1. **Detect** the modulation type (AMC - Automatic Modulation Classification)
2. **Configure** the appropriate demodulator
3. **Extract** the baseband signal

Tsingou does NOT perform demodulation itself — GNU Radio handles demodulation
in the sidecar process. Tsingou receives:
- Raw IQ samples via `tsingou.signal.sdr.iq.*`
- FFT magnitude data via `tsingou.signal.sdr.fft.*`
- Demodulated audio/data via `tsingou.signal.sdr.demod.*`

---

## 7. Digital Filter Design

### 7.1 FIR Filter Design

**General FIR filter:**
```
y[n] = sum_{k=0}^{M} b_k * x[n-k]
```

where {b_k} are the filter coefficients and M is the filter order.

Properties:
- Always stable (no feedback)
- Can achieve exact linear phase (symmetric coefficients)
- Higher order needed for sharp transitions (vs IIR)

**Parks-McClellan (Remez Exchange) Algorithm:**

Designs optimal equiripple FIR filters that minimize the maximum error
(Chebyshev/minimax criterion) in the passband and stopband:

```
min max_{f in bands} |W(f) * [H_desired(f) - H_actual(f)]|
```

where W(f) is a weighting function controlling relative ripple.

The algorithm iterates:
1. Initialize extremal frequency set
2. Compute optimal filter on extremals (solve linear system)
3. Find new extremals of error function
4. Repeat until convergence

### 7.2 IIR Filter Design

**General IIR filter (direct form):**
```
y[n] = sum_{k=0}^{M} b_k * x[n-k] - sum_{k=1}^{N} a_k * y[n-k]
```

Transfer function:
```
H(z) = (sum_{k=0}^{M} b_k * z^{-k}) / (1 + sum_{k=1}^{N} a_k * z^{-k})
```

**Butterworth:**
- Maximally flat magnitude response in passband
- Monotonic rolloff, no ripple
- -20*N dB/decade rolloff (N = filter order)
- Requires highest order for a given transition width

**Chebyshev Type I:**
- Equiripple passband, monotonic stopband
- Sharper rolloff than Butterworth for same order
- Passband ripple controlled by epsilon parameter

**Chebyshev Type II:**
- Monotonic passband, equiripple stopband
- Less common, used when flat passband is critical

**Elliptic (Cauer):**
- Equiripple in both passband and stopband
- Minimum order for given specifications
- Highest passband and stopband ripple complexity

### 7.3 Filter Type Comparison

| Property | Butterworth | Chebyshev I | Chebyshev II | Elliptic |
|----------|------------|------------|-------------|----------|
| Passband | Maximally flat | Equiripple | Monotonic | Equiripple |
| Stopband | Monotonic | Monotonic | Equiripple | Equiripple |
| Transition band | Widest | Moderate | Moderate | Narrowest |
| Order (for spec) | Highest | Moderate | Moderate | Lowest |
| Phase linearity | Best | Moderate | Moderate | Worst |
| Group delay | Most uniform | Less uniform | Less uniform | Least uniform |

### 7.4 FIR vs IIR Trade-offs

| Criterion | FIR | IIR |
|-----------|-----|-----|
| Stability | Always stable | Can be unstable |
| Linear phase | Achievable | Not achievable |
| Filter order | Higher | Lower |
| Computation per sample | More multiplies | Fewer multiplies |
| Latency | Higher (long filters) | Lower |
| Coefficient quantization | Robust | Sensitive |

For SIGINT/SDR: FIR filters dominate in channelization and decimation because
linear phase is required for many demodulators, and polyphase decomposition
(Section 8) makes them efficient. IIR filters are used for audio processing
and AGC loops where phase linearity is less critical.

---

## 8. Multirate Signal Processing

### 8.1 Decimation

Decimation by factor D reduces the sample rate by D:

```
y[n] = x[n*D]
```

To prevent aliasing, a lowpass anti-aliasing filter with cutoff f_s/(2*D) MUST
precede the downsampler:

```
x[n] --> [H_LP(z)] --> [downsample by D] --> y[n]
```

The decimation filter can be implemented efficiently using the Noble identity —
the filter operates at the lower output rate, reducing computation by factor D.

### 8.2 Interpolation

Interpolation by factor L increases the sample rate by L:

```
x_up[n] = x[n/L]  if n mod L = 0
         = 0        otherwise
```

An interpolation lowpass filter with cutoff f_s/(2*L) and gain L smooths the
zero-stuffed signal:

```
x[n] --> [upsample by L] --> [H_LP(z) * L] --> y[n]
```

### 8.3 Polyphase Decomposition

A length-M FIR filter H(z) can be decomposed into D polyphase components:

```
H(z) = sum_{k=0}^{D-1} z^{-k} * E_k(z^D)

where E_k(z) = sum_{m=0}^{M/D-1} h[m*D + k] * z^{-m}
```

Each polyphase component operates at 1/D the original rate, reducing total
computation by factor D. This is the key to efficient channelizer implementation
in wideband SDR receivers.

### 8.4 CIC (Cascaded Integrator-Comb) Filters

CIC filters implement high-decimation-ratio lowpass filtering without multipliers:

**Integrator section (running accumulator):**
```
y_I[n] = y_I[n-1] + x[n]
```

**Comb section (delayed difference):**
```
y_C[n] = x[n] - x[n-D]
```

An Nth-order CIC filter cascades N integrator stages followed by a downsampler
(by D) followed by N comb stages:

```
H_CIC(z) = [(1 - z^{-D}) / (1 - z^{-1})]^N
```

**Frequency response:**
```
|H_CIC(f)| = |sin(pi*f*D) / sin(pi*f)|^N    (normalized to DC gain = D^N)
```

Characteristics:
- No multipliers — only additions and subtractions
- Passband droop: compensate with a short FIR filter (CIC compensation filter)
- Aliasing rejection controlled by N (stages)
- Used for initial decimation from high ADC rates (e.g., 100+ MSPS to <1 MSPS)

### 8.5 Multirate Processing in SDR Pipeline

Typical SDR receive chain:

```
ADC (e.g., 64 MSPS)
  --> CIC decimation (D=16, to 4 MSPS)
  --> Channelizer (polyphase, select channel at ~25 kHz)
  --> Final decimation (to audio rate ~48 kHz)
  --> Demodulator
```

For Tsingou, this processing occurs in the GNU Radio sidecar. The sample rate
of data published to NATS depends on the processing stage:
- Raw FFT: at display update rate (typically 10-60 Hz)
- Demodulated audio: at audio sample rate (8-48 kHz)
- IQ captures: at full or decimated sample rate

---

## 9. Spectral Estimation Methods

### 9.1 Periodogram

The periodogram estimates the power spectral density (PSD) from a single
windowed DFT:

```
S_per(f_k) = (1/N) * |X_w[k]|^2

where X_w[k] = DFT of windowed signal x[n]*w[n]
```

Properties:
- Inconsistent estimator: variance does NOT decrease with N
- Frequency resolution: f_s/N
- Bias from windowing (spectral leakage)

### 9.2 Bartlett's Method

Divides the signal into K non-overlapping segments of length L, computes the
periodogram of each, and averages:

```
S_Bartlett(f) = (1/K) * sum_{i=0}^{K-1} S_per_i(f)
```

Properties:
- Variance reduced by factor K (vs single periodogram)
- Frequency resolution reduced to f_s/L (L = N/K < N)
- Trade-off: better variance vs worse resolution

### 9.3 Welch's Method

Extends Bartlett by allowing overlapping segments and applying a window:

```
S_Welch(f) = (1/K) * sum_{i=0}^{K-1} (1/(L*U)) * |DFT{w[n]*x_i[n]}|^2

where U = (1/L) * sum_{n=0}^{L-1} |w[n]|^2   (window power normalization)
```

Typical parameters:
- Segment length L (e.g., 1024, 4096)
- Overlap: 50% (Hann window) or 66.7% (other windows)
- Window: Hann (most common)

Properties:
- Lower variance than Bartlett (more segments from overlap)
- Standard method in most spectrum analyzers
- Controllable resolution/variance trade-off via L and overlap

### 9.4 Multitaper Method (Thomson, 1982)

Uses K orthogonal Slepian (DPSS — Discrete Prolate Spheroidal Sequence) tapers
to produce K approximately uncorrelated spectral estimates from the SAME data:

```
S_MT(f) = (1/K) * sum_{k=0}^{K-1} |sum_{n=0}^{N-1} v_k[n]*x[n]*e^{-j*2*pi*f*n}|^2

where {v_k[n]} are the Slepian sequences of order 0, 1, ..., K-1
```

Properties:
- Uses the entire signal for each estimate (no segmenting)
- Frequency resolution controlled by half-bandwidth parameter W
- Approximately 2*N*W tapers available
- Optimal bias-variance trade-off (in a minimax sense)
- Superior to Welch for short data records

### 9.5 Method Comparison

| Method | Resolution | Variance | Best For |
|--------|-----------|----------|----------|
| Periodogram | f_s/N (best) | High (worst) | Quick look, long data |
| Bartlett | f_s/L | Moderate | Non-overlapping segments |
| Welch | f_s/L | Low (good) | General-purpose PSD |
| Multitaper | ~2*W | Lowest (best) | Short records, high-quality |

For Tsingou: Welch's method is the standard for real-time PSD displays. The
FFT data published from GNU Radio typically uses Welch averaging with configurable
segment length and overlap. Multitaper analysis may be used for offline high-
resolution spectral analysis of captured IQ recordings.

---

## 10. Time-Frequency Analysis

### 10.1 Short-Time Fourier Transform (STFT)

The STFT applies a sliding window and computes the DFT at each position:

```
STFT{x[n]}(m, k) = sum_{n} x[n] * w[n - m*H] * e^{-j*2*pi*k*n/N}

where:
  m = time frame index
  k = frequency bin index
  H = hop size (window advance per frame)
  w[n] = analysis window
  N = FFT length
```

The spectrogram is the squared magnitude of the STFT:

```
S(m, k) = |STFT(m, k)|^2
```

Parameters:
- Window length L: controls frequency resolution (Delta_f = f_s/L)
- Hop size H: controls time resolution (Delta_t = H/f_s)
- FFT length N >= L: zero-padding for smoother frequency display
- Overlap = (L - H)/L (typically 50-75%)

### 10.2 Heisenberg-Gabor Uncertainty Principle

The time-bandwidth product of any analysis window is bounded:

```
sigma_t * sigma_f >= 1/(4*pi)
```

where sigma_t is the RMS time spread and sigma_f is the RMS frequency spread.

Practical consequence: improving time resolution (shorter window) necessarily
degrades frequency resolution, and vice versa. The Gaussian window achieves
the theoretical minimum (equality).

### 10.3 Waterfall Display

The waterfall display maps STFT data to a 2D image:
- Horizontal axis: frequency
- Vertical axis: time (scrolling)
- Color/intensity: power (dB scale)

Typical waterfall parameters for SIGINT:

| Parameter | Typical Value | Effect |
|-----------|--------------|--------|
| FFT size | 1024-8192 | Frequency resolution |
| Window | Hann or Blackman-Harris | Sidelobe suppression |
| Overlap | 50-75% | Time continuity |
| Update rate | 10-60 fps | Visual smoothness |
| Color map | Viridis, Inferno, Turbo | Perceptual uniformity |
| Dynamic range | 60-100 dB | Visibility of weak signals |

### 10.4 Continuous Wavelet Transform (CWT)

The CWT uses dilated and translated versions of a mother wavelet psi(t):

```
CWT{x(t)}(a, b) = (1/sqrt(|a|)) * integral x(t) * psi*((t-b)/a) dt

where:
  a = scale parameter (inversely related to frequency)
  b = translation parameter (time position)
  psi* = complex conjugate of the mother wavelet
```

The CWT provides variable time-frequency resolution:
- High frequencies (small a): good time resolution, poor frequency resolution
- Low frequencies (large a): poor time resolution, good frequency resolution

Common mother wavelets:
- Morlet: psi(t) = C * e^{j*omega_0*t} * e^{-t^2/2} (complex, good TF localization)
- Mexican hat: psi(t) = (1 - t^2) * e^{-t^2/2} (real, second derivative of Gaussian)
- Daubechies: compact support, orthogonal (used in DWT)

### 10.5 Discrete Wavelet Transform (DWT)

The DWT samples the CWT at dyadic scales a = 2^j and translations b = k*2^j:

```
DWT{x[n]}(j, k) = sum_n x[n] * psi_{j,k}[n]
```

Implemented efficiently via the Mallat algorithm (filter bank):

```
x[n] --> [H_LP] --> [downsample 2] --> approximation coefficients (a_j)
     --> [H_HP] --> [downsample 2] --> detail coefficients (d_j)
```

Iterated on approximation coefficients for multi-level decomposition.

Properties:
- Octave-band frequency resolution (each level halves the bandwidth)
- Efficient O(N) computation (vs O(N log N) for FFT)
- Perfect reconstruction via inverse DWT
- Used for denoising, compression, transient detection

### 10.6 Time-Frequency Analysis in SIGINT

| Analysis | Use Case | Resolution |
|----------|----------|------------|
| STFT/Spectrogram | Continuous monitoring, waterfall | Fixed TF resolution |
| CWT/Scalogram | Transient detection, chirp analysis | Variable TF resolution |
| DWT | Signal denoising, compression | Octave bands |
| Wigner-Ville | High resolution TF (offline) | Best, but cross-terms |
| Reassigned spectrogram | Sharpened spectrogram | Enhanced localization |

For Tsingou: The primary visualization is the STFT-based spectrogram/waterfall
rendered on the p5 layer. CWT analysis may be offered for offline analysis of
captured signals. The FFT data arriving via NATS is already windowed STFT frames.

---

## 11. Noise Characterization and Dynamic Range

### 11.1 Thermal Noise Floor

The thermal noise power in bandwidth B at temperature T:

```
P_noise = k * T * B    (watts)

where k = 1.381 * 10^{-23} J/K  (Boltzmann's constant)
      T = temperature in Kelvin (typically 290K for room temperature)
      B = noise bandwidth in Hz
```

At room temperature (T = 290K):

```
P_noise = -174 dBm/Hz + 10*log_10(B)
```

Examples:
- B = 1 Hz:       -174 dBm
- B = 1 kHz:      -144 dBm
- B = 1 MHz:      -114 dBm
- B = 10 MHz:     -104 dBm
- B = 2.4 MHz:    -110.2 dBm (RTL-SDR bandwidth)

### 11.2 Noise Figure and System Sensitivity

Noise figure NF quantifies how much noise a component adds:

```
NF = SNR_in / SNR_out    (linear)
NF_dB = 10*log_10(NF)    (dB)
```

Receiver sensitivity (minimum detectable signal):

```
MDS = -174 + 10*log_10(B) + NF + SNR_min    (dBm)

where SNR_min is the minimum SNR required for the application
```

Cascaded noise figure (Friis formula):

```
NF_total = NF_1 + (NF_2 - 1)/G_1 + (NF_3 - 1)/(G_1*G_2) + ...
```

The first stage dominates — hence LNA (Low Noise Amplifier) placement is critical.

### 11.3 ADC Dynamic Range Metrics

**SNR (Signal-to-Noise Ratio):**
```
SNR_ideal = 6.02*N_bits + 1.76    (dB, for ideal N-bit ADC)
```

| ADC Bits | Ideal SNR | Typical ENOB | Effective SNR |
|----------|-----------|-------------|---------------|
| 8 (RTL-SDR) | 49.9 dB | ~7 | ~44 dB |
| 12 (HackRF) | 74.0 dB | ~10 | ~62 dB |
| 14 (Airspy) | 86.0 dB | ~12 | ~74 dB |
| 16 (USRP) | 98.1 dB | ~13 | ~80 dB |

**ENOB (Effective Number of Bits):**
```
ENOB = (SINAD - 1.76) / 6.02
```

**SINAD (Signal-to-Noise-and-Distortion):**
```
SINAD = 10*log_10(P_signal / (P_noise + P_distortion))
```

**SFDR (Spurious-Free Dynamic Range):**
```
SFDR = P_fundamental - P_worst_spur    (dBc)
```

### 11.4 Processing Gain

Coherent integration (FFT) provides processing gain:

```
G_processing = 10*log_10(N)    (dB)

where N = number of FFT points (= number of samples integrated)
```

For N = 1024: G = 30.1 dB
For N = 4096: G = 36.1 dB
For N = 65536: G = 48.2 dB

This allows detection of signals below the noise floor in a single sample.

### 11.5 Dynamic Range Budget for SDR Receiver

```
+--------------------------------------------------+
| Antenna → LNA → Mixer → IF Filter → ADC         |
|                                                    |
| Noise floor = -174 + 10*log10(BW) + NF_system    |
| Max signal  = ADC_fullscale - headroom            |
| Dynamic range = Max signal - Noise floor          |
+--------------------------------------------------+
```

| SDR Hardware | ADC Bits | Bandwidth | Approx. System NF | Usable DR |
|-------------|----------|-----------|-------------------|-----------|
| RTL-SDR | 8 | 2.4 MHz | ~3.5 dB | ~50 dB |
| HackRF One | 8 | 20 MHz | ~10 dB | ~45 dB |
| Airspy R2 | 12 | 10 MHz | ~3.5 dB | ~70 dB |
| USRP B210 | 12 | 56 MHz | ~5 dB | ~65 dB |
| Ettus X310 | 14 | 160 MHz | ~5 dB | ~80 dB |

---

## References

| Key | Title | Relevance |
|-----|-------|-----------|
| [COOLEY-TUKEY-1965] | Cooley & Tukey, "An algorithm for the machine calculation of complex Fourier series" (1965) | FFT algorithm origin |
| [OPPENHEIM-DSP] | Oppenheim & Schafer, "Discrete-Time Signal Processing" (3rd ed.) | Canonical DSP textbook |
| [HARRIS-WINDOWS] | Harris, "On the use of windows for harmonic analysis with the DFT" (1978) | Windowing function comparison |
| [WELCH-1967] | Welch, "The use of FFT for the estimation of power spectra" (1967) | Welch spectral method |
| [THOMSON-1982] | Thomson, "Spectrum estimation and harmonic analysis" (1982) | Multitaper method |
| [HOGENAUER-1981] | Hogenauer, "An economical class of digital filters for decimation and interpolation" (1981) | CIC filters |
| [PARKS-MCCLELLAN] | Parks & McClellan, "Chebyshev approximation for nonrecursive digital filters" (1972) | Optimal FIR design |
| [NYQUIST-1928] | Nyquist, "Certain topics in telegraph transmission theory" (1928) | Sampling theorem |
| [SHANNON-1949] | Shannon, "Communication in the presence of noise" (1949) | Sampling theorem proof |
| [BLUESTEIN-1970] | Bluestein, "A linear filtering approach to the computation of discrete Fourier transform" (1970) | Chirp-Z transform |
| [PYSDR] | PySDR.org, "A Guide to SDR and DSP using Python" | SDR/DSP practical guide |
| [SIGMF] | Signal Metadata Format specification, v1.0 | IQ recording metadata |
| [FFTW] | Frigo & Johnson, "The Design and Implementation of FFTW3" (2005) | Adaptive FFT library |
| [GNURADIO] | GNU Radio Project, gnuradio.org | SDR framework |
| [DSPRELATED] | dsprelated.com, "Mathematics of the DFT" (J.O. Smith) | DFT mathematics |
| [CARSON-1922] | Carson, "Notes on the theory of modulation" (1922) | FM bandwidth rule |
| [GABOR-1946] | Gabor, "Theory of communication" (1946) | Time-frequency uncertainty |
| [MALLAT-1989] | Mallat, "A theory for multiresolution signal decomposition" (1989) | Wavelet filter banks |

---

<!-- INTEGRATION NOTES
- This research feeds into rfc-section-dsp-foundations.md (TSG.25)
- Mathematical derivations are self-contained and can be verified independently
- All numerical values are standard DSP reference values
- SDR hardware specs reflect 2024-2025 product specifications
- Tsingou-specific integration points are marked throughout
-->
