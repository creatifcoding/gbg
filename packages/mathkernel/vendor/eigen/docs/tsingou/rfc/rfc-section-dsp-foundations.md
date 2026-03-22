# RFC Section TSG.25: Digital Signal Processing Foundations

```
Section:       TSG.25 — Digital Signal Processing Foundations
Parent RFC:    Tsingou Platform Specification
Status:        DRAFT
Author:        Val (dsp-specialist)
Created:       2026-02-18
Research Base: research-dsp-foundations.md (11 sections, 29 references)
```

> This section establishes the mathematical and algorithmic foundations for all
> digital signal processing operations within the Tsingou SIGINT visualization
> platform. Every spectral display, waterfall rendering, demodulation output, and
> noise measurement traces to the theory defined herein. Implementations MUST
> satisfy these mathematical constraints; deviations require explicit justification
> against the cited theory. The key words "MUST", "MUST NOT", "SHOULD", "SHOULD
> NOT", and "MAY" are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Scope and Applicability](#1-scope-and-applicability)
2. [Discrete Fourier Transform (DFT) and Fast Fourier Transform (FFT)](#2-discrete-fourier-transform-dft-and-fast-fourier-transform-fft)
3. [Windowing Functions](#3-windowing-functions)
4. [Sampling Theory](#4-sampling-theory)
5. [IQ Signal Representation](#5-iq-signal-representation)
6. [Demodulation Theory](#6-demodulation-theory)
7. [Digital Filter Design](#7-digital-filter-design)
8. [Multirate Signal Processing](#8-multirate-signal-processing)
9. [Spectral Estimation](#9-spectral-estimation)
10. [Time-Frequency Analysis](#10-time-frequency-analysis)
11. [Noise Characterization and Dynamic Range](#11-noise-characterization-and-dynamic-range)
12. [Tsingou Integration Mapping](#12-tsingou-integration-mapping)
13. [Normative Requirements Summary](#13-normative-requirements-summary)
14. [Bibliography](#14-bibliography)

---

## 1. Scope and Applicability

### 1.1 Purpose

This section defines the mathematical models, algorithmic requirements, and
performance bounds for DSP operations in the Tsingou signal intelligence
visualization platform. The DSP pipeline spans from analog-to-digital conversion
at the SDR hardware through GNU Radio processing to NATS-published spectral
data consumed by Tsingou's visualization layers.

### 1.2 Architecture Context

The DSP processing chain is partitioned across three execution domains:

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  SDR Hardware │────▶│  GNU Radio Sidecar │────▶│  Tsingou Visualization│
│              │     │                  │     │                      │
│  - ADC       │     │  - Decimation    │     │  - Spectral plots    │
│  - LNA       │     │  - Channelization│     │  - Waterfall display │
│  - Mixing    │     │  - FFT/windowing │     │  - Constellation     │
│  - Filtering │     │  - Demodulation  │     │  - Signal metadata   │
│              │     │  - PSD estimation│     │  - IQ recording      │
└──────────────┘     └──────────────────┘     └──────────────────────┘
      Hardware              Software                 Visualization
```

Tsingou receives processed data via NATS subjects:
- `tsingou.signal.sdr.fft.*` — Windowed FFT magnitude data
- `tsingou.signal.sdr.iq.*` — Raw or decimated IQ samples
- `tsingou.signal.sdr.demod.*` — Demodulated baseband data
- `tsingou.signal.sdr.metadata.*` — SigMF-compliant signal metadata

### 1.3 Normative Scope

The mathematical definitions in this section are normative. Implementations of
DSP blocks within the GNU Radio sidecar and Tsingou visualization layers MUST
conform to these definitions. Where multiple valid algorithmic approaches exist,
the RECOMMENDED algorithm is identified with justification.

---

## 2. Discrete Fourier Transform (DFT) and Fast Fourier Transform (FFT)

### 2.1 DFT Definition

The N-point Discrete Fourier Transform of a finite-length sequence x[n] is
defined as [OPPENHEIM-DSP]:

```
X[k] = sum_{n=0}^{N-1} x[n] * e^{-j*2*pi*k*n/N},   k = 0, 1, ..., N-1
```

The inverse DFT recovers the original sequence:

```
x[n] = (1/N) * sum_{k=0}^{N-1} X[k] * e^{j*2*pi*k*n/N},   n = 0, 1, ..., N-1
```

The DFT is a unitary transform (up to a factor of sqrt(N)) that provides a
complete, invertible mapping between time-domain and frequency-domain
representations of finite-length discrete signals.

### 2.2 DFT Properties

Implementations MUST preserve the following DFT properties:

| Property | Definition | Normative Requirement |
|----------|-----------|----------------------|
| **Linearity** | DFT{a*x + b*y} = a*DFT{x} + b*DFT{y} | MUST hold exactly in floating-point to within machine epsilon |
| **Parseval's theorem** | sum |x[n]|^2 = (1/N)*sum |X[k]|^2 | Total energy MUST be preserved across transform |
| **Circular convolution** | DFT{x (*) y} = DFT{x} * DFT{y} | Frequency-domain multiplication MUST equal circular convolution |
| **Periodicity** | X[k] = X[k + N] | DFT output MUST be interpreted as periodic with period N |

### 2.3 Frequency Resolution

The frequency spacing between adjacent DFT bins is:

```
Delta_f = f_s / N    (Hz)
```

where f_s is the sampling rate and N is the DFT length. This defines the
minimum frequency separation at which two sinusoidal components can be
distinguished. Implementations MUST document the effective frequency resolution
for each spectral display, accounting for both DFT bin spacing and windowing
effects (Section 3).

### 2.4 Zero-Padding

Zero-padding extends a length-L sequence to length N > L by appending N-L zeros.
This provides interpolation in the frequency domain (denser bin spacing of f_s/N)
but does NOT improve the intrinsic frequency resolution, which remains f_s/L
[OPPENHEIM-DSP].

Implementations MAY use zero-padding to produce visually smoother spectral
displays. When zero-padding is applied, implementations MUST NOT represent the
resulting display as having resolution better than f_s/L, where L is the
original (non-padded) data length.

### 2.5 FFT Algorithms

The direct computation of the DFT requires O(N^2) complex multiply-accumulate
operations. Fast Fourier Transform algorithms reduce this to O(N log N) by
exploiting the periodicity and symmetry of the complex exponential basis
functions [COOLEY-TUKEY-1965].

#### 2.5.1 Cooley-Tukey Radix-2 Decimation-in-Time

For N = 2^m, the radix-2 DIT algorithm decomposes the N-point DFT into two
N/2-point DFTs [COOLEY-TUKEY-1965]:

```
X[k] = E[k] + W_N^k * O[k]           (k = 0, ..., N/2 - 1)
X[k + N/2] = E[k] - W_N^k * O[k]     (k = 0, ..., N/2 - 1)

where:
  E[k] = DFT of even-indexed samples {x[0], x[2], ..., x[N-2]}
  O[k] = DFT of odd-indexed samples  {x[1], x[3], ..., x[N-1]}
  W_N^k = e^{-j*2*pi*k/N}            (twiddle factor)
```

The butterfly operation is the fundamental computational unit. Each of the
log_2(N) stages performs N/2 butterfly operations, yielding:

```
Complexity = (N/2) * log_2(N)  complex multiplications
           = N * log_2(N)      complex additions
```

| N | DFT Operations | Radix-2 FFT Operations | Speedup |
|---|---------------|----------------------|---------|
| 256 | 65,536 | 1,024 | 64x |
| 1,024 | 1,048,576 | 5,120 | 205x |
| 4,096 | 16,777,216 | 24,576 | 683x |
| 8,192 | 67,108,864 | 53,248 | 1,261x |
| 65,536 | 4,294,967,296 | 524,288 | 8,192x |

#### 2.5.2 Split-Radix FFT

The split-radix algorithm combines radix-2 and radix-4 decompositions, exploiting
the fact that the first radix-2 sub-transform requires no twiddle factor
multiplication. This yields the lowest known operation count for power-of-two
sizes among standard algorithms:

```
Multiplications = (N/3)(log_2(N) - 3) + 4/3
Additions       = (N)(log_2(N) - 3) + 4
```

Implementations SHOULD use split-radix or equivalent algorithms for power-of-two
FFT lengths when maximum computational efficiency is required.

#### 2.5.3 Bluestein's Algorithm

For arbitrary N (including prime sizes), Bluestein's algorithm [BLUESTEIN-1970]
converts the DFT into a linear convolution using the chirp-z transform identity:

```
kn = -(k-n)^2/2 + k^2/2 + n^2/2
```

This expresses X[k] as:

```
X[k] = W_N^{k^2/2} * [x[n]*W_N^{n^2/2}] (*) [W_N^{-n^2/2}]
```

where (*) denotes linear convolution, computable via three FFTs of length
M >= 2N-1 (zero-padded to a power of 2). The complexity is O(N log N) for any N,
but with a constant factor 3-6x larger than Cooley-Tukey for composite sizes.

Implementations SHOULD use Bluestein's algorithm or Rader's algorithm when
non-power-of-two DFT lengths are required.

#### 2.5.4 Algorithm Selection Requirements

| Requirement | Algorithm | Normative Level |
|------------|-----------|-----------------|
| N = 2^m (standard use) | Radix-2 or split-radix | RECOMMENDED |
| N = composite | Mixed-radix Cooley-Tukey | RECOMMENDED |
| N = prime | Bluestein or Rader | MUST use O(N log N) |
| Adaptive selection | FFTW-style planning | MAY use |

Implementations MUST NOT use the direct O(N^2) DFT algorithm for N > 64.
All production FFT computations MUST achieve O(N log N) complexity.

---

## 3. Windowing Functions

### 3.1 Spectral Leakage

Finite-length observation of a continuous signal is equivalent to multiplication
by a rectangular window, which in the frequency domain convolves the signal
spectrum with the Dirichlet kernel [HARRIS-WINDOWS]. The sidelobes of this kernel
cause spectral leakage — energy from a spectral component spreading into
adjacent frequency bins.

For SIGINT applications, spectral leakage can mask weak signals near strong
emitters. Window function selection is therefore a critical design parameter.

### 3.2 Window Function Specifications

The following window functions are defined for use in Tsingou DSP operations.
All definitions assume a window of length N samples, indexed n = 0, ..., N-1.

#### 3.2.1 Rectangular Window

```
w[n] = 1,   n = 0, ..., N-1
```

- Mainlobe width: 2/N (bin-to-bin)
- Peak sidelobe: -13.3 dB
- Sidelobe rolloff: -6 dB/octave
- ENBW: 1.00 bins
- Processing loss: 0.0 dB

#### 3.2.2 Hann Window

```
w[n] = 0.5 * (1 - cos(2*pi*n / (N-1)))
```

- Mainlobe width: 4/N
- Peak sidelobe: -31.5 dB
- Sidelobe rolloff: -18 dB/octave
- ENBW: 1.50 bins
- Processing loss: 1.42 dB

#### 3.2.3 Hamming Window

```
w[n] = 0.54 - 0.46 * cos(2*pi*n / (N-1))
```

- Mainlobe width: 4/N
- Peak sidelobe: -42.7 dB
- Sidelobe rolloff: -6 dB/octave
- ENBW: 1.36 bins
- Processing loss: 1.36 dB

#### 3.2.4 Blackman Window

```
w[n] = 0.42 - 0.5*cos(2*pi*n/(N-1)) + 0.08*cos(4*pi*n/(N-1))
```

- Mainlobe width: 6/N
- Peak sidelobe: -58.1 dB
- Sidelobe rolloff: -18 dB/octave
- ENBW: 1.73 bins
- Processing loss: 1.73 dB

#### 3.2.5 Blackman-Harris (4-term)

```
w[n] = a_0 - a_1*cos(2*pi*n/(N-1)) + a_2*cos(4*pi*n/(N-1)) - a_3*cos(6*pi*n/(N-1))

a_0 = 0.35875,  a_1 = 0.48829,  a_2 = 0.14128,  a_3 = 0.01168
```

- Mainlobe width: 8/N
- Peak sidelobe: -92.0 dB
- Sidelobe rolloff: -6 dB/octave
- ENBW: 2.00 bins
- Processing loss: 2.00 dB

#### 3.2.6 Kaiser Window

```
w[n] = I_0(beta * sqrt(1 - ((2n/(N-1)) - 1)^2)) / I_0(beta)

where I_0 is the zeroth-order modified Bessel function of the first kind
```

The Kaiser window is parametric — the beta parameter controls the
sidelobe-mainlobe tradeoff continuously:

| Beta | Peak Sidelobe (dB) | ENBW (bins) | Approximate Equivalent |
|------|--------------------|-----------|-----------------------|
| 0 | -13.3 | 1.00 | Rectangular |
| 5.0 | -36.7 | 1.40 | ~ Hamming |
| 6.0 | -44.0 | 1.50 | ~ Hann |
| 8.6 | -64.0 | 1.80 | ~ Blackman |
| 14.0 | -105.0 | 2.30 | ~ Blackman-Harris |

#### 3.2.7 Flat-Top Window

```
w[n] = 1 - 1.93*cos(2*pi*n/(N-1)) + 1.29*cos(4*pi*n/(N-1))
       - 0.388*cos(6*pi*n/(N-1)) + 0.0322*cos(8*pi*n/(N-1))
```

- Mainlobe width: 10/N
- Peak sidelobe: -93.6 dB
- Sidelobe rolloff: -6 dB/octave
- ENBW: 3.77 bins
- Processing loss: 3.77 dB
- Scalloping loss: < 0.01 dB (primary use case: amplitude accuracy)

### 3.3 Window Selection Requirements

| Application | RECOMMENDED Window | Rationale |
|------------|-------------------|-----------|
| General spectrum monitoring | Hann | Balanced resolution/leakage [HARRIS-WINDOWS] |
| Weak signal detection near strong emitters | Blackman-Harris | -92 dB sidelobe suppression masks strong-near-weak interference |
| Frequency measurement | Flat-top | < 0.01 dB scalloping loss ensures amplitude accuracy |
| Real-time waterfall display | Hann or Hamming | Computational efficiency with adequate leakage control |
| Adjustable resolution/leakage | Kaiser | Continuous beta parameter allows runtime tuning |
| Broadband power measurement | Rectangular | No amplitude distortion; acceptable when leakage is tolerable |

Implementations MUST apply a window function before computing the FFT for
spectral display purposes. The rectangular window (no windowing) MUST NOT be used
for spectral displays unless explicitly selected by the operator for a documented
reason.

Implementations MUST normalize window functions for correct power spectral
density computation:

```
PSD[k] = |X_w[k]|^2 / (f_s * S_2)

where S_2 = sum_{n=0}^{N-1} |w[n]|^2   (window energy)
```

### 3.4 Equivalent Noise Bandwidth (ENBW)

The ENBW defines the width of an ideal rectangular bandpass filter that would
pass the same noise power as the actual window:

```
ENBW = N * (sum |w[n]|^2) / (sum w[n])^2    (in bins)
ENBW_Hz = ENBW * (f_s / N)                   (in Hz)
```

ENBW MUST be used to convert between spectral density (dBm/Hz) and spectral
power (dBm) in spectral displays. Implementations MUST document the ENBW of the
applied window function.

### 3.5 Coherent Gain and Scalloping Loss

**Coherent gain** is the DC response of the window relative to the rectangular
window:

```
CG = (1/N) * sum_{n=0}^{N-1} w[n]
```

**Scalloping loss** is the maximum amplitude error when a spectral component
falls between two DFT bins:

| Window | Scalloping Loss (dB) |
|--------|---------------------|
| Rectangular | 3.92 |
| Hann | 1.42 |
| Hamming | 1.78 |
| Blackman | 1.10 |
| Blackman-Harris | 0.83 |
| Flat-top | < 0.01 |

Implementations SHOULD compensate for scalloping loss when precise frequency
measurement is required (e.g., by parabolic interpolation between adjacent bins).

---

## 4. Sampling Theory

### 4.1 Nyquist-Shannon Sampling Theorem

**Theorem** [SHANNON-1949]: If a continuous-time signal x(t) is bandlimited with
maximum frequency component f_max (i.e., X(f) = 0 for |f| > f_max), then x(t)
is uniquely determined by its samples x[n] = x(n*T_s) taken at sampling rate
f_s = 1/T_s, provided:

```
f_s > 2 * f_max
```

The minimum sampling rate f_Nyquist = 2 * f_max is the Nyquist rate. The maximum
unambiguous frequency f_s/2 is the Nyquist frequency.

### 4.2 Reconstruction

Perfect reconstruction from samples is given by the Whittaker-Shannon
interpolation formula [SHANNON-1949]:

```
x(t) = sum_{n=-inf}^{inf} x[n] * sinc((t - n*T_s) / T_s)

where sinc(u) = sin(pi*u) / (pi*u)
```

This formula is non-causal and requires infinite summation. Practical
reconstruction uses finite-order interpolation filters that approximate the
ideal sinc response.

### 4.3 Aliasing

When f_s < 2 * f_max, frequency components above f_s/2 fold back into the
baseband through the aliasing relation:

```
f_alias = |f_signal - k * f_s|,   k in Z chosen so 0 <= f_alias <= f_s/2
```

Aliasing is irreversible after sampling. Implementations MUST prevent aliasing
through one of the following mechanisms:

1. **Analog anti-aliasing filter** before the ADC (hardware approach)
2. **Oversampling** with digital anti-aliasing filter and decimation
3. **Bandpass sampling** where aliasing is intentional and controlled (see 4.5)

### 4.4 Anti-Aliasing Filter Specifications

The anti-aliasing lowpass filter preceding analog-to-digital conversion MUST
satisfy:

| Parameter | Requirement |
|-----------|-------------|
| Passband | 0 to f_max with ripple < 0.5 dB |
| Transition band | f_max to f_s/2 |
| Stopband | f_s/2 to infinity with attenuation > A_stop dB |

The required stopband attenuation A_stop depends on the ADC resolution:

```
A_stop >= 6.02 * N_bits + 10    (dB)
```

This ensures aliased components are below the ADC quantization noise floor.

| ADC Bits | Minimum Stopband Attenuation |
|----------|------------------------------|
| 8 | 58 dB |
| 12 | 82 dB |
| 14 | 94 dB |
| 16 | 106 dB |

### 4.5 Complex (IQ) Sampling

For complex baseband (IQ) sampling, the sampling theorem applies to the
single-sided bandwidth:

```
f_s >= B    (where B is the total signal bandwidth)
```

IQ sampling captures both positive and negative frequencies, representing a
bandwidth of [-f_s/2, +f_s/2] centered at the tuned frequency f_c. This
effectively halves the required sample rate compared to real sampling.

Implementations MUST correctly interpret IQ-sampled data as spanning the
frequency range [f_c - f_s/2, f_c + f_s/2].

### 4.6 Bandpass Sampling

Bandpass sampling allows a narrowband signal centered at f_c >> f_s/2 to be
sampled at a rate related to the signal bandwidth B rather than 2*f_c:

```
f_s >= 2*B    (minimum rate for bandpass signal of bandwidth B)
```

The valid sampling rates that avoid aliasing are determined by:

```
2*f_H/n <= f_s <= 2*f_L/(n-1),   n = 1, 2, 3, ...

where f_L = lower band edge, f_H = upper band edge, B = f_H - f_L
```

Bandpass sampling is NOT commonly used in SDR receivers (most use direct
conversion or low-IF architectures with IQ sampling).

---

## 5. IQ Signal Representation

### 5.1 Analytic Signal

Given a real-valued signal x(t), the analytic signal z(t) is defined as
[GABOR-1946]:

```
z(t) = x(t) + j * H{x(t)}
```

where H{} denotes the Hilbert transform:

```
H{x(t)} = (1/pi) * PV integral_{-inf}^{inf} x(tau)/(t - tau) d(tau)
```

The analytic signal has the property Z(f) = 0 for f < 0 (all negative-frequency
components are suppressed). In the frequency domain:

```
Z(f) = 2*X(f)   for f > 0
Z(f) = X(f)     for f = 0
Z(f) = 0        for f < 0
```

### 5.2 Complex Baseband Representation

A bandpass signal s(t) centered at carrier frequency f_c is represented in
complex baseband as:

```
s(t) = Re{ z_bb(t) * e^{j*2*pi*f_c*t} }
     = I(t)*cos(2*pi*f_c*t) - Q(t)*sin(2*pi*f_c*t)
```

where z_bb(t) = I(t) + j*Q(t) is the complex envelope (complex baseband signal):

- **I(t)** = In-phase component = Re{z_bb(t)}
- **Q(t)** = Quadrature component = Im{z_bb(t)}

### 5.3 Instantaneous Parameters

From the complex baseband representation, the instantaneous signal parameters
are extracted as:

```
Instantaneous amplitude:   A(t) = |z_bb(t)| = sqrt(I(t)^2 + Q(t)^2)
Instantaneous phase:       phi(t) = arg(z_bb(t)) = arctan(Q(t)/I(t))
Instantaneous frequency:   f(t) = (1/2*pi) * d(phi)/dt
```

These instantaneous parameters are fundamental to demodulation (Section 6) and
signal classification.

### 5.4 IQ Data Formats

Implementations MUST support the following IQ data formats as defined by the
SigMF specification [SIGMF]:

| Format Code | Encoding | Bits/Sample | Dynamic Range | MUST Support |
|------------|----------|-------------|---------------|-------------|
| `cu8` | Unsigned 8-bit integer | 8 | ~48 dB | YES (RTL-SDR native) |
| `cs8` | Signed 8-bit integer | 8 | ~48 dB | YES |
| `cs16_le` | Signed 16-bit integer, little-endian | 16 | ~96 dB | YES (HackRF, USRP) |
| `cf32_le` | IEEE 754 float, little-endian | 32 | ~150 dB | YES (GNU Radio native) |
| `cf64_le` | IEEE 754 double, little-endian | 64 | ~300 dB | MAY |

Implementations MUST correctly convert between formats, including the DC offset
correction required for `cu8` format (RTL-SDR outputs unsigned 8-bit with
DC offset of 127.5):

```
I_corrected = (I_raw - 127.5) / 127.5
Q_corrected = (Q_raw - 127.5) / 127.5
```

### 5.5 IQ Imbalance

Practical IQ receivers exhibit gain imbalance (epsilon) and phase imbalance
(delta) between the I and Q channels:

```
I_actual(t) = (1 + epsilon) * I_ideal(t)
Q_actual(t) = Q_ideal(t) * cos(delta) + I_ideal(t) * sin(delta)
```

IQ imbalance creates an image signal at -f (mirrored around DC) with suppression:

```
Image rejection (dB) ~ -20*log_10(sqrt(epsilon^2 + delta^2)/2)
```

| Hardware | Typical Image Rejection | IQ Correction Required |
|----------|----------------------|----------------------|
| RTL-SDR | 30-40 dB | RECOMMENDED |
| HackRF | 35-45 dB | RECOMMENDED |
| USRP | 45-60 dB | MAY |
| High-end SDR | > 60 dB | MAY |

Implementations SHOULD apply IQ imbalance correction when image rejection is
less than the required dynamic range for the application.

### 5.6 SigMF Metadata Integration

Signal metadata MUST conform to the SigMF specification [SIGMF] version 1.0.
The minimum required metadata fields for Tsingou ingestion are:

| Field | Scope | Description | Requirement |
|-------|-------|-------------|-------------|
| `core:datatype` | global | IQ format code (e.g., "cf32_le") | MUST |
| `core:sample_rate` | global | Sample rate in samples/second | MUST |
| `core:version` | global | SigMF version (e.g., "1.0.0") | MUST |
| `core:frequency` | capture | Center frequency in Hz | MUST |
| `core:sample_start` | capture | Sample offset from start | MUST |
| `core:label` | annotation | Human-readable signal label | SHOULD |
| `core:freq_lower_edge` | annotation | Signal lower frequency bound | SHOULD |
| `core:freq_upper_edge` | annotation | Signal upper frequency bound | SHOULD |

Tsingou publishes SigMF metadata to `tsingou.signal.sdr.metadata.*` NATS subjects.

---

## 6. Demodulation Theory

### 6.1 Demodulation Architecture

Demodulation extracts the information-bearing baseband signal from a modulated
carrier. In the Tsingou architecture, demodulation is performed by GNU Radio
processing blocks; Tsingou visualizes both the modulated signal (spectral/IQ view)
and the demodulated output (audio/data view).

### 6.2 Amplitude Modulation (AM)

Standard AM modulates the carrier amplitude:

```
s_AM(t) = A_c * [1 + m*x(t)] * cos(2*pi*f_c*t)

where:
  A_c = carrier amplitude
  m = modulation index (0 < m <= 1 for conventional AM)
  x(t) = normalized message signal (|x(t)| <= 1)
```

**Demodulation by envelope detection** in the IQ domain:

```
A(t) = |z_bb(t)| = sqrt(I^2 + Q^2)
x_demod(t) = A(t) - A_c    (DC removal)
```

Implementations MUST support AM envelope detection as a baseline demodulator.
This requires no carrier synchronization and is computationally trivial.

### 6.3 Frequency Modulation (FM)

FM modulates the instantaneous frequency of the carrier proportional to the
message signal:

```
s_FM(t) = A_c * cos(2*pi*f_c*t + 2*pi*k_f * integral_0^t x(tau) d(tau))

where k_f = frequency sensitivity (Hz per unit amplitude)
```

**Bandwidth** (Carson's rule [CARSON-1922]):

```
B_FM ~ 2*(Delta_f_max + W) = 2*W*(beta + 1)

where:
  Delta_f_max = k_f * max|x(t)| = maximum frequency deviation
  W = message bandwidth
  beta = Delta_f_max / W = modulation index
```

| Application | Deviation | Bandwidth | Beta |
|-------------|----------|-----------|------|
| NFM (narrowband FM, land mobile) | +/- 5 kHz | ~16 kHz | ~1.67 |
| WFM (broadcast FM) | +/- 75 kHz | ~200 kHz | ~5 |
| FM stereo (pilot tone) | +/- 75 kHz | ~200 kHz | ~5 |

**Demodulation by IQ differentiation:**

The discrete-time instantaneous frequency estimator [OPPENHEIM-DSP]:

```
f_inst[n] = (f_s / 2*pi) * arg(z_bb[n] * conj(z_bb[n-1]))
```

This single-sample delay discriminator is the RECOMMENDED FM demodulation
algorithm for its computational simplicity and numerical stability.

### 6.4 Phase-Locked Loop (PLL)

A digital PLL tracks carrier phase and frequency through a feedback loop:

```
Phase error:    e[n] = arg(z_bb[n] * conj(e^{j*theta[n]}))
Loop filter:    v[n] = alpha*e[n] + beta*sum_{k=0}^{n} e[k]    (PI filter)
NCO update:     theta[n+1] = theta[n] + 2*pi*v[n]/f_s
```

The PLL serves multiple roles:
- **FM demodulation**: Loop filter output v[n] is the demodulated signal
- **Carrier recovery**: Theta tracks the carrier phase for coherent demodulation
- **Frequency tracking**: v[n] tracks the instantaneous frequency

PLL parameters:

| Parameter | Symbol | Effect |
|-----------|--------|--------|
| Natural frequency | omega_n | Determines acquisition range and speed |
| Damping ratio | zeta | Controls overshoot (zeta = 0.707 is critically damped) |
| Loop bandwidth | B_L | Trade-off: wider = faster tracking but more noise |

Implementations SHOULD provide configurable PLL loop bandwidth to support both
fast-acquisition (wide BW) and low-noise tracking (narrow BW) modes.

### 6.5 Single-Sideband (SSB) Demodulation

SSB modulation occupies only one sideband around the carrier:

- **Upper Sideband (USB)**: f_c to f_c + B
- **Lower Sideband (LSB)**: f_c - B to f_c

Demodulation requires:

```
x_USB(t) = Re{ z_bb(t) }                       (for signal already at baseband)
x_LSB(t) = Re{ z_bb(t) * e^{-j*2*pi*B*t} }    (frequency-reversed)
```

In practice, the operator tunes the BFO (Beat Frequency Oscillator) frequency
to shift the desired sideband to audio range. Implementations MUST support
USB and LSB demodulation with configurable BFO offset.

### 6.6 Digital Modulation Schemes

#### 6.6.1 Phase-Shift Keying (PSK)

M-PSK maps log_2(M) bits per symbol to M equally-spaced phase states on the
unit circle in the IQ plane:

```
s_k = A * e^{j*2*pi*k/M},   k = 0, 1, ..., M-1
```

| Scheme | Bits/Symbol | Phase Spacing | Eb/N0 @ BER=10^-5 |
|--------|-------------|---------------|---------------------|
| BPSK | 1 | 180 deg | 9.6 dB |
| QPSK | 2 | 90 deg | 9.6 dB |
| 8-PSK | 3 | 45 deg | 13.0 dB |
| 16-PSK | 4 | 22.5 deg | 18.5 dB |

#### 6.6.2 Quadrature Amplitude Modulation (QAM)

M-QAM maps log_2(M) bits per symbol to a rectangular grid of M constellation
points in the IQ plane:

```
s_k = (I_k + j*Q_k)

where (I_k, Q_k) are the coordinates of the kth constellation point
```

| Scheme | Bits/Symbol | Points | Eb/N0 @ BER=10^-5 |
|--------|-------------|--------|---------------------|
| 4-QAM (= QPSK) | 2 | 4 | 9.6 dB |
| 16-QAM | 4 | 16 | 13.4 dB |
| 64-QAM | 6 | 64 | 17.8 dB |
| 256-QAM | 8 | 256 | 23.8 dB |

#### 6.6.3 Symbol Detection

Maximum likelihood detection selects the nearest constellation point:

```
s_hat = argmin_{s_k in C} |r - s_k|^2

where r = received (noisy) symbol, C = constellation set
```

Implementations MUST support constellation diagram visualization for PSK and QAM
signals, displaying received symbols overlaid on the ideal constellation grid.

### 6.7 Modulation Classification

In SIGINT, the modulation type is typically unknown a priori. Automatic Modulation
Classification (AMC) identifies the modulation scheme from the received signal
characteristics. Common features include:

| Feature | Discriminates Between |
|---------|----------------------|
| Higher-order statistics (kurtosis, cumulants) | AM vs FM vs digital |
| Cyclostationary features | PSK vs QAM vs FSK |
| Spectral symmetry | SSB vs DSB |
| Zero-crossing rate | Bandwidth estimation |
| Constellation shape | PSK order, QAM order |

Implementations SHOULD support at least manual modulation type selection.
Implementations MAY support automated modulation classification.

---

## 7. Digital Filter Design

### 7.1 FIR Filters

A Finite Impulse Response filter of order M implements the convolution:

```
y[n] = sum_{k=0}^{M} h[k] * x[n-k]
```

where h[k] are the filter coefficients. FIR filters have the following properties
that make them the RECOMMENDED filter type for SDR signal processing:

1. **Unconditional stability** — no feedback, no poles outside the unit circle
2. **Exact linear phase** — achievable with symmetric coefficients: h[k] = h[M-k]
3. **Predictable latency** — group delay is constant at (M/2) samples

#### 7.1.1 Parks-McClellan (Optimal Equiripple) Design

The Parks-McClellan algorithm [PARKS-MCCLELLAN] designs FIR filters that minimize
the maximum weighted approximation error (Chebyshev/minimax criterion):

```
min max_{f in passband U stopband} |W(f) * (H_desired(f) - H_actual(f))|
```

This produces equiripple behavior in both passband and stopband. The Remez
exchange algorithm iteratively refines the extremal frequencies until convergence.

The filter order required for a given specification is approximately:

```
M ~ (-20*log_10(sqrt(delta_p * delta_s)) - 13) / (14.6 * Delta_f / f_s)

where:
  delta_p = passband ripple (linear)
  delta_s = stopband attenuation (linear)
  Delta_f = transition bandwidth
```

Implementations SHOULD use the Parks-McClellan algorithm for FIR filter design
when equiripple behavior is acceptable.

### 7.2 IIR Filters

Infinite Impulse Response filters implement the difference equation:

```
y[n] = sum_{k=0}^{M} b_k*x[n-k] - sum_{k=1}^{N} a_k*y[n-k]
```

IIR filters achieve sharper transitions with lower order than FIR filters, at the
cost of nonlinear phase and potential instability.

#### 7.2.1 Butterworth Design

Maximally flat magnitude response with no ripple in passband or stopband:

```
|H(j*Omega)|^2 = 1 / (1 + (Omega/Omega_c)^{2N})

where N = filter order, Omega_c = cutoff frequency
```

Rolloff: -20*N dB/decade. Requires highest order for a given transition width.

#### 7.2.2 Chebyshev Type I Design

Equiripple passband with monotonic stopband:

```
|H(j*Omega)|^2 = 1 / (1 + epsilon^2 * T_N^2(Omega/Omega_c))

where T_N = Chebyshev polynomial of order N, epsilon = ripple parameter
```

Sharper transition than Butterworth for the same order, at the cost of passband
ripple.

#### 7.2.3 Elliptic (Cauer) Design

Equiripple in both passband and stopband:

```
|H(j*Omega)|^2 = 1 / (1 + epsilon^2 * R_N^2(Omega, L))

where R_N = Chebyshev rational function, L = selectivity parameter
```

Achieves the minimum filter order for any given set of specifications (passband
ripple, stopband attenuation, transition width).

### 7.3 Filter Type Selection

| Specification | RECOMMENDED Type | Rationale |
|--------------|-----------------|-----------|
| Linear phase required (demodulation) | FIR (Parks-McClellan) | IIR cannot achieve linear phase |
| Minimum computation per sample | IIR (Elliptic) | Lowest order for given specs |
| Maximum stopband attenuation | FIR (equiripple) | Predictable, no quantization sensitivity |
| AGC, audio processing | IIR (Butterworth) | Smooth response, acceptable phase |
| Channelization | FIR (polyphase) | Linear phase + efficient multirate structure |

### 7.4 Filter Order Comparison

For a lowpass filter with passband ripple 0.1 dB, stopband attenuation 60 dB,
and normalized transition width Delta_f/f_s:

| Delta_f/f_s | Butterworth | Chebyshev I | Elliptic | FIR (Parks-McClellan) |
|------------|------------|------------|----------|----------------------|
| 0.1 | 10 | 7 | 5 | ~43 |
| 0.05 | 19 | 13 | 9 | ~86 |
| 0.02 | 47 | 32 | 22 | ~214 |
| 0.01 | 94 | 63 | 44 | ~428 |

Implementations MUST document the filter type, order, and design method for
all digital filters in the processing chain.

---

## 8. Multirate Signal Processing

### 8.1 Decimation

Decimation reduces the sample rate by an integer factor D:

```
y[n] = x_filtered[n*D]
```

A lowpass anti-aliasing filter with cutoff frequency f_s/(2*D) MUST precede
the downsampler to prevent aliasing. By the Noble identity, the filter can
operate at the lower output rate, reducing computation by factor D:

```
x[n] --> [H_LP(z)] --> [downsample D] --> y[n]
       = x[n] --> [downsample D] --> [H_LP(z^D)] --> y[n]  (Noble identity)
```

### 8.2 Interpolation

Interpolation increases the sample rate by integer factor L:

```
x_up[n] = x[n/L]   if n mod L = 0
         = 0         otherwise
```

A lowpass interpolation filter with cutoff f_s/(2*L) and gain L smooths the
zero-stuffed signal.

### 8.3 Rational Rate Conversion

To convert sample rate by a rational factor L/D, interpolate by L then decimate
by D:

```
f_out = f_in * L / D
```

The order of operations (interpolate first, then decimate) ensures no aliasing
occurs at any intermediate stage.

### 8.4 Polyphase Filter Implementation

A length-M FIR decimation filter can be decomposed into D polyphase branches
[OPPENHEIM-DSP]:

```
H(z) = sum_{k=0}^{D-1} z^{-k} * E_k(z^D)

where E_k(z) = sum_{m=0}^{M/D-1} h[m*D + k] * z^{-m}
```

Each branch computes at 1/D the input rate, reducing total multiplications by
factor D. This is the standard implementation for:

- **Polyphase channelizers** — wideband SDR receivers splitting the spectrum into
  multiple narrowband channels simultaneously
- **Efficient decimation filters** — cascaded with CIC for high-ratio decimation
- **Efficient interpolation filters** — transmitter upsampling

Implementations SHOULD use polyphase decomposition for all multirate FIR filters
to minimize computational cost.

### 8.5 CIC (Cascaded Integrator-Comb) Filters

CIC filters [HOGENAUER-1981] implement high-decimation-ratio lowpass filtering
using only additions and subtractions (no multipliers):

**Transfer function:**

```
H_CIC(z) = [(1 - z^{-R*M}) / (1 - z^{-1})]^N

where:
  R = decimation rate
  M = differential delay (usually 1 or 2)
  N = number of cascaded stages
```

**Frequency response (magnitude):**

```
|H_CIC(f)| = |sin(pi*f*R*M) / sin(pi*f)|^N
```

**Key characteristics:**

| Parameter | Effect |
|-----------|--------|
| N (stages) | Higher N = better aliasing rejection, more passband droop |
| R (decimation) | Higher R = larger bandwidth reduction |
| M (diff. delay) | M=2 provides wider first null than M=1 |
| Passband droop | Compensate with short FIR filter at output rate |

**CIC droop compensation** — a short FIR filter with inverse CIC passband
response SHOULD follow the CIC filter:

```
H_comp(f) ~ |sin(pi*f) / sin(pi*f*R*M)|^N    (inverse of CIC passband)
```

### 8.6 Typical SDR Multirate Processing Chain

```
ADC (e.g., 64 MSPS, 14-bit)
  |
  v
CIC Decimation (R=16, N=4, M=1)
  --> 4 MSPS, passband droop compensated
  |
  v
Polyphase Channelizer (K=128 channels, each 31.25 kHz)
  --> Select channel(s) of interest
  |
  v
Channel Filter (FIR, Parks-McClellan, ~60 taps)
  --> Shaped to signal bandwidth
  |
  v
Final Decimation (to demodulator rate, e.g., 48 kHz)
  |
  v
Demodulator
```

Each stage is documented with its filter type, order, and frequency response.
Implementations MUST ensure that the composite filter response from ADC to
demodulator meets the passband and stopband specifications.

---

## 9. Spectral Estimation

### 9.1 Power Spectral Density (PSD)

The power spectral density S_xx(f) of a wide-sense stationary random process
x[n] is defined as the Fourier transform of the autocorrelation function
[OPPENHEIM-DSP]:

```
S_xx(f) = sum_{m=-inf}^{inf} r_xx[m] * e^{-j*2*pi*f*m}

where r_xx[m] = E{x[n]*conj(x[n+m])}
```

PSD is measured in units of power/Hz (e.g., dBm/Hz, V^2/Hz).

### 9.2 Periodogram

The periodogram estimates PSD from a single finite data record:

```
S_per(f_k) = (1/(N*f_s)) * |X_w[k]|^2

where X_w[k] = sum_{n=0}^{N-1} w[n]*x[n]*e^{-j*2*pi*k*n/N}
```

The periodogram is an asymptotically unbiased but inconsistent estimator — its
variance does not decrease with increasing N [WELCH-1967].

### 9.3 Welch's Method (RECOMMENDED)

Welch's method [WELCH-1967] divides the data into overlapping segments, windows
each segment, computes periodograms, and averages:

```
S_Welch(f_k) = (1/K) * sum_{i=0}^{K-1} S_per_i(f_k)
```

**Parameters:**

| Parameter | Symbol | Typical Value | Effect |
|-----------|--------|--------------|--------|
| Segment length | L | 1024-8192 | Controls frequency resolution |
| Overlap | D | L/2 (50%) | More segments = lower variance |
| Window | w[n] | Hann | Controls leakage |
| Number of segments | K | depends on data | Higher K = lower variance |

**Resolution-variance trade-off:**

```
Frequency resolution = f_s / L
Variance reduction ~ K (number of independent segments)
K ~ N / (L * (1 - overlap_fraction))  for 50% overlap
```

Implementations MUST use Welch's method as the default PSD estimator for real-time
spectral displays. The segment length, overlap, and window function MUST be
configurable.

### 9.4 Bartlett's Method

Bartlett's method is a special case of Welch's method with no overlap and
rectangular windowing:

```
S_Bartlett(f_k) = (1/K) * sum_{i=0}^{K-1} (1/L) * |DFT{x_i[n]}|^2
```

Implementations MAY support Bartlett's method as a simplified alternative.

### 9.5 Multitaper Method

Thomson's multitaper method [THOMSON-1982] uses K orthogonal Slepian tapers
(DPSS sequences) to produce K approximately uncorrelated spectral estimates from
the full data record:

```
S_MT(f_k) = (1/K) * sum_{i=0}^{K-1} |sum_{n=0}^{N-1} v_i[n]*x[n]*e^{-j*2*pi*k*n/N}|^2
```

where {v_i[n]} are the discrete prolate spheroidal sequences of orders 0 through
K-1, parameterized by the half-bandwidth W.

**Advantages over Welch:**
- Uses the entire data record (no segmenting, no resolution loss)
- Optimal bias-variance trade-off in a minimax sense
- Superior for short data records

**Parameters:**
- Half-bandwidth W: controls resolution (resolution ~ 2*W*f_s)
- Number of tapers K ~ 2*N*W (use floor(2*N*W) - 1 for stable estimates)

Implementations SHOULD support multitaper estimation for offline analysis of
captured IQ recordings where short-record high-resolution estimation is required.

### 9.6 Spectral Estimation Comparison

| Method | Resolution | Variance | Computation | Best Application |
|--------|-----------|----------|-------------|-----------------|
| Periodogram | f_s/N | High | O(N log N) | Quick single-shot |
| Bartlett | f_s/L | Moderate | K * O(L log L) | Non-overlapping segments |
| Welch | f_s/L | Low | K * O(L log L) | Real-time displays (DEFAULT) |
| Multitaper | ~2W | Lowest | K * O(N log N) | Short records, high quality |

### 9.7 PSD Display Requirements

Implementations MUST correctly display PSD in the following units:

| Display Mode | Units | Formula |
|-------------|-------|---------|
| Power spectral density | dBm/Hz | 10*log_10(S(f) * 1000) |
| Power spectrum | dBm | PSD + 10*log_10(ENBW_Hz) |
| Relative power | dBFS | 10*log_10(S(f) / S_fullscale) |

The conversion between PSD and power spectrum depends on the window function's
ENBW (Section 3.4). Implementations MUST account for ENBW in all power
measurements.

---

## 10. Time-Frequency Analysis

### 10.1 Short-Time Fourier Transform (STFT)

The STFT computes the DFT of successive windowed segments of the signal:

```
STFT{x[n]}(m, k) = sum_{n=0}^{N-1} x[n + m*H] * w[n] * e^{-j*2*pi*k*n/N}

where:
  m = time frame index
  k = frequency bin index (0 to N-1)
  H = hop size (frame advance in samples)
  w[n] = analysis window of length N
```

The spectrogram is the squared magnitude:

```
S(m, k) = |STFT(m, k)|^2
```

### 10.2 STFT Parameters and Trade-offs

| Parameter | Symbol | Controls | Trade-off |
|-----------|--------|----------|-----------|
| FFT size | N | Frequency resolution (f_s/N) | Larger N = better freq res, worse time res |
| Window length | L <= N | Effective frequency resolution (f_s/L) | Longer = better freq res |
| Hop size | H | Time resolution (H/f_s seconds) | Smaller H = finer time grid, more computation |
| Overlap | (L-H)/L | Temporal continuity | Higher overlap = smoother, more frames |

The Heisenberg-Gabor uncertainty principle [GABOR-1946] constrains the
simultaneous time-frequency resolution:

```
sigma_t * sigma_f >= 1/(4*pi)
```

where sigma_t and sigma_f are the RMS time and frequency spreads of the analysis
window. The Gaussian window achieves equality (minimum uncertainty product).

**Practical consequence:** There is no "best" STFT configuration — improving
time resolution necessarily degrades frequency resolution and vice versa.

### 10.3 Spectrogram/Waterfall Display

The waterfall display is the primary visualization mode for wideband SIGINT
monitoring. It maps the spectrogram to a scrolling 2D image:

- **Horizontal axis**: Frequency (f_c - f_s/2 to f_c + f_s/2)
- **Vertical axis**: Time (scrolling, most recent at bottom or top)
- **Color**: Power in dB, mapped through a perceptual colormap

#### 10.3.1 Waterfall Display Parameters

| Parameter | RECOMMENDED Value | Normative Level |
|-----------|------------------|-----------------|
| FFT size | 1024-8192 | Implementation-dependent |
| Window function | Hann or Blackman-Harris | MUST apply window (Section 3.3) |
| Overlap | 50-75% | SHOULD use >= 50% |
| Update rate | >= 10 fps | MUST achieve >= 10 fps for usable display |
| Color map | Perceptually uniform (Viridis, Inferno, Turbo) | SHOULD use perceptually uniform |
| Dynamic range | >= 60 dB | MUST display >= 60 dB dynamic range |
| Frequency axis | Linear (default) or logarithmic | MUST support linear; MAY support log |

#### 10.3.2 Waterfall Data Flow in Tsingou

```
GNU Radio Sidecar                       Tsingou Visualization
┌──────────────────┐                   ┌─────────────────────┐
│ Signal Source     │                   │ NATS Subscriber     │
│   → Window        │                   │   → Deserialize      │
│   → FFT           │   NATS publish    │   → dB conversion    │
│   → Mag^2         │ ──────────────▶   │   → Color mapping    │
│   → Log scale     │ fft.* subjects   │   → p5/visx render   │
│   → Serialize     │                   │   → Scroll buffer    │
└──────────────────┘                   └─────────────────────┘
```

The FFT data published to NATS MUST include:
- FFT magnitude array (float32 or float16)
- Center frequency
- Sample rate (determines frequency axis span)
- FFT size (determines number of bins)
- Timestamp (for time axis)
- Window type (for correct power calibration)

### 10.4 Continuous Wavelet Transform (CWT)

The CWT decomposes a signal using dilated and translated versions of a mother
wavelet psi(t):

```
CWT{x(t)}(a, b) = (1/sqrt(|a|)) * integral x(t) * psi*((t-b)/a) dt

where:
  a = scale (inversely proportional to frequency)
  b = time translation
  psi* = complex conjugate of mother wavelet
```

The CWT provides variable time-frequency resolution:

| Frequency Range | Time Resolution | Frequency Resolution |
|----------------|----------------|---------------------|
| High (small scale a) | Good (narrow wavelet) | Poor (wide bandwidth) |
| Low (large scale a) | Poor (wide wavelet) | Good (narrow bandwidth) |

This variable resolution property makes CWT superior to STFT for analyzing
signals with both transient (high-frequency) and tonal (low-frequency) components.

**Mother wavelets for SIGINT applications:**

| Wavelet | Properties | Use Case |
|---------|-----------|----------|
| Morlet | Complex, good TF localization | General TF analysis, chirp detection |
| Mexican hat | Real, second derivative of Gaussian | Transient detection |
| Daubechies (db4-db20) | Compact support, orthogonal | DWT decomposition, denoising |

### 10.5 Discrete Wavelet Transform (DWT)

The DWT samples the CWT at dyadic scales and positions, implemented efficiently
via the Mallat filter bank algorithm [MALLAT-1989]:

```
Decomposition (analysis):
  a_{j+1}[n] = sum_k h[k-2n] * a_j[k]    (approximation coefficients)
  d_{j+1}[n] = sum_k g[k-2n] * a_j[k]    (detail coefficients)

Reconstruction (synthesis):
  a_j[n] = sum_k h_tilde[n-2k] * a_{j+1}[k] + sum_k g_tilde[n-2k] * d_{j+1}[k]
```

where h, g are analysis filters and h_tilde, g_tilde are synthesis filters.

Properties:
- O(N) computation (vs O(N log N) for FFT)
- Perfect reconstruction for orthogonal/biorthogonal wavelet families
- Octave-band frequency decomposition
- Compact representation of transients

**SIGINT applications:**
- Signal denoising (wavelet shrinkage/thresholding)
- Transient detection (chirp, pulse, burst identification)
- Signal compression (for IQ recording storage)

Implementations MAY support CWT/DWT analysis for offline signal analysis.
Implementations MUST NOT require CWT/DWT for real-time visualization.

### 10.6 Reassigned Spectrogram

The reassigned spectrogram sharpens the standard spectrogram by moving each
time-frequency point to the center of gravity of its energy distribution:

```
t_hat(m, k) = m*H/f_s - Re{(STFT_tw * conj(STFT_w)) / |STFT_w|^2}
f_hat(m, k) = k*f_s/N + Im{(STFT_dw * conj(STFT_w)) / |STFT_w|^2}

where:
  STFT_tw = STFT with time-ramped window t*w[n]
  STFT_dw = STFT with derivative window w'[n]
```

The reassigned spectrogram provides better localization than the standard
spectrogram at the cost of 3x computation (three STFTs) and loss of
invertibility.

Implementations MAY offer reassigned spectrogram as an enhanced visualization
mode for detailed signal analysis.

---

## 11. Noise Characterization and Dynamic Range

### 11.1 Thermal Noise Floor

The fundamental noise power in bandwidth B at temperature T is [OPPENHEIM-DSP]:

```
P_noise = k * T * B    (watts)

where:
  k = 1.381 * 10^{-23} J/K    (Boltzmann's constant)
  T = absolute temperature (K)  (290K = standard room temperature)
  B = noise bandwidth (Hz)
```

At room temperature (T = 290K):

```
P_noise (dBm) = -174 + 10*log_10(B)
```

| Bandwidth | Thermal Noise Floor |
|-----------|-------------------|
| 1 Hz | -174 dBm |
| 1 kHz | -144 dBm |
| 10 kHz | -134 dBm |
| 100 kHz | -124 dBm |
| 1 MHz | -114 dBm |
| 10 MHz | -104 dBm |
| 2.4 MHz (RTL-SDR) | -110.2 dBm |
| 56 MHz (USRP B210) | -96.5 dBm |

### 11.2 Noise Figure

The noise figure NF quantifies how much noise a component adds relative to an
ideal noiseless component:

```
NF = SNR_in / SNR_out    (linear)
NF (dB) = 10*log_10(NF)
```

**Cascaded noise figure** (Friis formula):

```
NF_total = NF_1 + (NF_2 - 1)/G_1 + (NF_3 - 1)/(G_1*G_2) + ...
```

The first stage dominates total noise figure — the LNA (Low Noise Amplifier)
MUST have the lowest NF in the receive chain.

### 11.3 Receiver Sensitivity

Minimum Detectable Signal (MDS):

```
MDS (dBm) = -174 + 10*log_10(B) + NF + SNR_min

where:
  B = receiver bandwidth (Hz)
  NF = system noise figure (dB)
  SNR_min = minimum SNR for the application (dB)
```

| Application | SNR_min | Justification |
|------------|---------|---------------|
| CW (Morse) | 3 dB | Operator ear as detector |
| SSB voice | 10 dB | Intelligibility threshold |
| FM voice (12 dB SINAD) | 12 dB | Standard sensitivity criterion |
| Digital (BPSK, BER=10^-5) | 10 dB | Eb/N0 with coding gain |
| Signal detection only | 0 dB | Energy detection threshold |

### 11.4 ADC Performance Metrics

#### 11.4.1 Signal-to-Noise Ratio (SNR)

For an ideal N-bit ADC with full-scale sinusoidal input:

```
SNR_ideal = 6.02*N + 1.76    (dB)
```

| ADC Bits | Ideal SNR | Typical ENOB | Effective SNR |
|----------|-----------|-------------|---------------|
| 8 | 49.9 dB | ~7 | ~44 dB |
| 12 | 74.0 dB | ~10 | ~62 dB |
| 14 | 86.0 dB | ~12 | ~74 dB |
| 16 | 98.1 dB | ~13 | ~80 dB |

#### 11.4.2 SINAD (Signal-to-Noise-and-Distortion Ratio)

```
SINAD = P_signal / (P_noise + P_distortion)
SINAD (dB) = 10*log_10(SINAD)
```

#### 11.4.3 ENOB (Effective Number of Bits)

```
ENOB = (SINAD_dB - 1.76) / 6.02
```

ENOB represents the actual ADC resolution accounting for all noise and distortion
sources. Implementations MUST use ENOB (not nominal bits) for dynamic range
calculations.

#### 11.4.4 SFDR (Spurious-Free Dynamic Range)

```
SFDR = P_fundamental - P_worst_spur    (dBc)
```

SFDR defines the usable dynamic range before spurious signals become visible.

### 11.5 Processing Gain

Coherent integration (FFT) provides processing gain by concentrating signal energy
into a single bin while spreading noise across all bins:

```
G_processing = 10*log_10(N)    (dB)

where N = FFT length (number of samples integrated)
```

| FFT Length | Processing Gain |
|-----------|----------------|
| 256 | 24.1 dB |
| 1,024 | 30.1 dB |
| 4,096 | 36.1 dB |
| 16,384 | 42.1 dB |
| 65,536 | 48.2 dB |

Processing gain enables detection of signals below the per-sample noise floor.
Implementations MUST account for processing gain when calculating detection
thresholds for spectral displays.

### 11.6 SDR Hardware Dynamic Range

| SDR Hardware | ADC Bits | Max BW | System NF | Usable DR | MDS (25 kHz BW) |
|-------------|----------|--------|-----------|-----------|-----------------|
| RTL-SDR v3 | 8 | 2.4 MHz | ~3.5 dB | ~50 dB | ~-127 dBm |
| HackRF One | 8 | 20 MHz | ~10 dB | ~45 dB | ~-120 dBm |
| Airspy R2 | 12 | 10 MHz | ~3.5 dB | ~70 dB | ~-127 dBm |
| USRP B210 | 12 | 56 MHz | ~5 dB | ~65 dB | ~-125 dBm |
| Ettus X310 | 14 | 160 MHz | ~5 dB | ~80 dB | ~-125 dBm |

Implementations MUST display the noise floor and dynamic range of the connected
SDR hardware in the system status panel. The displayed noise floor MUST account
for the system noise figure, bandwidth, and any applied processing gain.

### 11.7 Dynamic Range Display Requirements

The spectral display MUST support the following dynamic range configurations:

| Requirement | Specification | Normative Level |
|------------|---------------|-----------------|
| Minimum displayed DR | >= 60 dB | MUST |
| Reference level | Configurable (dBm or dBFS) | MUST |
| Scale resolution | <= 10 dB/division | MUST |
| Auto-scaling | Automatic reference level adjustment | SHOULD |
| Noise floor marker | Visual indicator of computed noise floor | SHOULD |
| Peak hold | Retains maximum values across frames | SHOULD |

---

## 12. Tsingou Integration Mapping

### 12.1 DSP-to-NATS Subject Mapping

| DSP Operation | NATS Subject Pattern | Data Format | Update Rate |
|--------------|---------------------|-------------|-------------|
| FFT/PSD | `tsingou.signal.sdr.fft.{device_id}` | Float32 array + metadata | 10-60 Hz |
| IQ stream | `tsingou.signal.sdr.iq.{device_id}` | CF32/CS16 chunks + SigMF | Continuous |
| Demodulated audio | `tsingou.signal.sdr.demod.{device_id}` | PCM16/Float32 audio | Continuous |
| Signal metadata | `tsingou.signal.sdr.metadata.{device_id}` | SigMF JSON | On change |
| Device status | `tsingou.signal.sdr.status.{device_id}` | JSON status object | 1 Hz |

### 12.2 Visualization Layer Mapping

| DSP Concept | Visualization Layer | Rendering Technology |
|------------|-------------------|---------------------|
| PSD / spectrum plot | visx layer | SVG/Canvas line plot |
| Waterfall / spectrogram | p5 layer | WebGL pixel buffer |
| Constellation diagram | visx layer | SVG scatter plot |
| IQ time-domain | visx layer | SVG/Canvas line plot |
| Audio waveform | visx layer | SVG/Canvas line plot |
| Audio spectrogram | p5 layer | WebGL pixel buffer |

### 12.3 DSP Parameter Configuration

Implementations MUST expose the following DSP parameters for operator
configuration via the Tsingou UI:

| Parameter | Range | Default | Affect |
|-----------|-------|---------|--------|
| FFT size | 256-65536 (powers of 2) | 4096 | Frequency resolution |
| Window function | {Rectangular, Hann, Hamming, Blackman, BH4, Kaiser, Flat-top} | Hann | Spectral leakage |
| Kaiser beta | 0-20 | 6.0 | Sidelobe/mainlobe tradeoff |
| Averaging | 1-100 | 10 | PSD variance reduction |
| Overlap | 0-95% | 50% | Time resolution |
| Reference level | -150 to 0 dBm | -30 dBm | Display scale |
| Dynamic range | 20-120 dB | 80 dB | Display range |
| Color map | {Viridis, Inferno, Turbo, Grayscale, Custom} | Viridis | Waterfall colors |
| Peak hold | {Off, 1s, 5s, 30s, Infinite} | Off | Peak detection |

---

## 13. Normative Requirements Summary

### 13.1 MUST Requirements

| ID | Requirement | Section |
|----|------------|---------|
| DSP-1 | MUST NOT use O(N^2) DFT for N > 64 | 2.5.4 |
| DSP-2 | MUST apply window function before FFT for spectral display | 3.3 |
| DSP-3 | MUST normalize windows for correct PSD computation | 3.3 |
| DSP-4 | MUST document ENBW of applied window | 3.4 |
| DSP-5 | MUST prevent aliasing (anti-aliasing filter or oversampling) | 4.3 |
| DSP-6 | MUST correctly interpret IQ data as [-f_s/2, +f_s/2] bandwidth | 4.5 |
| DSP-7 | MUST support cu8, cs8, cs16_le, cf32_le IQ formats | 5.4 |
| DSP-8 | MUST apply DC offset correction for cu8 format | 5.4 |
| DSP-9 | MUST support AM envelope detection as baseline demodulator | 6.2 |
| DSP-10 | MUST support USB and LSB demodulation with configurable BFO | 6.5 |
| DSP-11 | MUST support constellation diagram visualization | 6.6.3 |
| DSP-12 | MUST document filter type, order, and design method | 7.4 |
| DSP-13 | MUST ensure composite filter response meets specs (ADC to demod) | 8.6 |
| DSP-14 | MUST use Welch's method as default PSD estimator | 9.3 |
| DSP-15 | MUST correctly display PSD in dBm/Hz, dBm, or dBFS | 9.7 |
| DSP-16 | MUST achieve >= 10 fps waterfall update rate | 10.3.1 |
| DSP-17 | MUST display >= 60 dB dynamic range | 10.3.1, 11.7 |
| DSP-18 | MUST include FFT metadata in NATS publications | 10.3.2 |
| DSP-19 | MUST use ENOB for dynamic range calculations | 11.4.3 |
| DSP-20 | MUST account for processing gain in detection thresholds | 11.5 |
| DSP-21 | MUST display SDR hardware noise floor and dynamic range | 11.6 |
| DSP-22 | MUST expose DSP parameters for operator configuration | 12.3 |

### 13.2 SHOULD Requirements

| ID | Requirement | Section |
|----|------------|---------|
| DSP-S1 | SHOULD use split-radix for max FFT performance | 2.5.2 |
| DSP-S2 | SHOULD compensate scalloping loss for frequency measurement | 3.5 |
| DSP-S3 | SHOULD apply IQ imbalance correction when image rejection < DR | 5.5 |
| DSP-S4 | SHOULD provide configurable PLL loop bandwidth | 6.4 |
| DSP-S5 | SHOULD use Parks-McClellan for FIR equiripple design | 7.1.1 |
| DSP-S6 | SHOULD use polyphase decomposition for multirate FIR | 8.4 |
| DSP-S7 | SHOULD apply CIC droop compensation | 8.5 |
| DSP-S8 | SHOULD support multitaper for offline analysis | 9.5 |
| DSP-S9 | SHOULD use >= 50% STFT overlap | 10.3.1 |
| DSP-S10 | SHOULD use perceptually uniform color maps | 10.3.1 |
| DSP-S11 | SHOULD display noise floor marker | 11.7 |
| DSP-S12 | SHOULD support peak hold | 11.7 |

### 13.3 MAY Requirements

| ID | Requirement | Section |
|----|------------|---------|
| DSP-M1 | MAY use FFTW-style adaptive algorithm selection | 2.5.4 |
| DSP-M2 | MAY use zero-padding for smoother spectral display | 2.4 |
| DSP-M3 | MAY support cf64_le (double precision IQ) | 5.4 |
| DSP-M4 | MAY support automated modulation classification | 6.7 |
| DSP-M5 | MAY support CWT/DWT for offline analysis | 10.5 |
| DSP-M6 | MAY offer reassigned spectrogram | 10.6 |
| DSP-M7 | MAY support logarithmic frequency axis | 10.3.1 |

---

## 14. Bibliography

### Primary References

| Key | Citation | Relevance |
|-----|----------|-----------|
| [COOLEY-TUKEY-1965] | J.W. Cooley and J.W. Tukey, "An algorithm for the machine calculation of complex Fourier series," *Mathematics of Computation*, vol. 19, no. 90, pp. 297-301, 1965. | FFT algorithm origin |
| [OPPENHEIM-DSP] | A.V. Oppenheim and R.W. Schafer, *Discrete-Time Signal Processing*, 3rd ed., Pearson, 2009. | Canonical DSP reference |
| [HARRIS-WINDOWS] | F.J. Harris, "On the use of windows for harmonic analysis with the discrete Fourier transform," *Proc. IEEE*, vol. 66, no. 1, pp. 51-83, 1978. | Window function comparison |
| [WELCH-1967] | P.D. Welch, "The use of fast Fourier transform for the estimation of power spectra: A method based on time averaging over short, modified periodograms," *IEEE Trans. Audio and Electroacoustics*, vol. 15, no. 2, pp. 70-73, 1967. | Welch PSD method |
| [THOMSON-1982] | D.J. Thomson, "Spectrum estimation and harmonic analysis," *Proc. IEEE*, vol. 70, no. 9, pp. 1055-1096, 1982. | Multitaper method |
| [HOGENAUER-1981] | E. Hogenauer, "An economical class of digital filters for decimation and interpolation," *IEEE Trans. ASSP*, vol. 29, no. 2, pp. 155-162, 1981. | CIC filters |
| [PARKS-MCCLELLAN] | T.W. Parks and J.H. McClellan, "Chebyshev approximation for nonrecursive digital filters with linear phase," *IEEE Trans. Circuit Theory*, vol. 19, no. 2, pp. 189-194, 1972. | Optimal FIR design |
| [SHANNON-1949] | C.E. Shannon, "Communication in the presence of noise," *Proc. IRE*, vol. 37, no. 1, pp. 10-21, 1949. | Sampling theorem |
| [NYQUIST-1928] | H. Nyquist, "Certain topics in telegraph transmission theory," *Trans. AIEE*, vol. 47, no. 2, pp. 617-644, 1928. | Sampling theory foundation |
| [BLUESTEIN-1970] | L.I. Bluestein, "A linear filtering approach to the computation of discrete Fourier transform," *IEEE Trans. Audio and Electroacoustics*, vol. 18, no. 4, pp. 451-455, 1970. | Chirp-Z transform |
| [GABOR-1946] | D. Gabor, "Theory of communication," *J. IEE*, vol. 93, no. 26, pp. 429-457, 1946. | Time-frequency uncertainty |
| [MALLAT-1989] | S. Mallat, "A theory for multiresolution signal decomposition: The wavelet representation," *IEEE Trans. PAMI*, vol. 11, no. 7, pp. 674-693, 1989. | Wavelet filter banks |
| [CARSON-1922] | J.R. Carson, "Notes on the theory of modulation," *Proc. IRE*, vol. 10, no. 1, pp. 57-64, 1922. | FM bandwidth rule |

### Standards and Specifications

| Key | Citation | Relevance |
|-----|----------|-----------|
| [RFC2119] | S. Bradner, "Key words for use in RFCs to Indicate Requirement Levels," BCP 14, RFC 2119, March 1997. | Requirement keywords |
| [RFC8174] | B. Leiba, "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words," BCP 14, RFC 8174, May 2017. | Requirement keyword clarification |
| [SIGMF] | Signal Metadata Format Specification, v1.0.0, https://sigmf.org | IQ recording metadata |
| [IEEE-754] | IEEE 754-2019, "IEEE Standard for Floating-Point Arithmetic" | Float format for CF32/CF64 |

### Software and Implementation References

| Key | Citation | Relevance |
|-----|----------|-----------|
| [FFTW] | M. Frigo and S.G. Johnson, "The Design and Implementation of FFTW3," *Proc. IEEE*, vol. 93, no. 2, pp. 216-231, 2005. | Adaptive FFT library |
| [GNURADIO] | GNU Radio Project, https://gnuradio.org | SDR processing framework |
| [PYSDR] | PySDR.org, "A Guide to SDR and DSP using Python," https://pysdr.org | SDR practical guide |
| [DSPRELATED] | J.O. Smith III, "Mathematics of the DFT," https://www.dsprelated.com/freebooks/mdft/ | DFT mathematics reference |
| [LIQUID-DSP] | J. Gaeddert, "liquid-dsp: Software-Defined Radio Digital Signal Processing Library," https://liquidsdr.org | DSP modem library |

---

<!-- INTEGRATION NOTES
- This section provides mathematical foundations for ALL spectral/signal processing in Tsingou
- Sections 2-3 (FFT/windowing) directly govern the waterfall and PSD display implementations
- Section 4 (sampling) constrains SDR hardware configuration
- Section 5 (IQ) defines data format support requirements for NATS ingestion
- Section 6 (demodulation) specifies GNU Radio sidecar processing capabilities
- Section 7-8 (filters/multirate) constrain the DSP processing chain
- Section 9 (spectral estimation) defines the PSD computation algorithm
- Section 10 (time-frequency) specifies waterfall display parameters
- Section 11 (noise/DR) calibrates display scales and detection thresholds
- Section 12 maps DSP concepts to Tsingou architecture (NATS, visx, p5)

CROSS-REFERENCES:
- TSG.26 (Differential Dataflow): Data fusion from multiple SDR sources
- TSG.28 (Graph Theory): Signal correlation and network analysis
- TSG.4 (Data Fusion): Multi-sensor spectral fusion
- ADR-011 (SDR Integration): Hardware interface decisions

CODEBASE INTEGRATION:
- GNU Radio sidecar process publishes to NATS via GR-NATS OOT module
- Tsingou subscribes via NATS client in effect-ts service layer
- Visualization uses visx (SVG/Canvas) for spectrum plots, p5 (WebGL) for waterfall
- SigMF metadata parsed and stored as Effect Schema types
-->
