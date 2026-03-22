# TSG-RFC-002 Section: Spectrum Visualization

```
Section:       Spectrum Visualization
Section ID:    TSG.19
Parent RFC:    TSG-RFC-002 (Tsingou SIGINT Visualization Platform)
Part:          IV -- SDR & RF Integration (Normative)
Status:        DRAFT
Author:        Val (sdr-analyst)
Created:       2026-02-18
Research Base: research-sdr-hardware-ecosystem.md (1,019 lines),
               research-gnu-radio-architecture.md (1,478 lines)
Codebase Refs: src/lib/tsingou-flow/schemas/base-signal.ts (159 lines),
               src/lib/tsingou-flow/adapters/HolonetBridgeAdapter.ts (277 lines)
Cross-Refs:    TSG.16 (SDR Hardware), TSG.17 (GNU Radio Bridge),
               TSG.18 (SigMF Codec), TSG.20 (4-Layer Rendering Surface),
               TSG.22 (visx Data Visualization Layer), TSG.25 (DSP Foundations)
```

> This section specifies the spectrum visualization subsystem for the Tsingou
> SIGINT visualization platform. It establishes the data pipeline from FFT
> output to rendered display, specifies the waterfall, spectrum analyzer,
> spectrogram, and signal browser visualization modes, defines the rendering
> layer architecture for RF data, and establishes the atom-based reactive
> state model for real-time spectrum display. The key words "MUST", "MUST NOT",
> "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",
> "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted
> as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [TSG.19.1 Scope and Design Philosophy](#tsg191-scope-and-design-philosophy)
2. [TSG.19.2 Data Pipeline Architecture](#tsg192-data-pipeline-architecture)
3. [TSG.19.3 Spectrum Analyzer View](#tsg193-spectrum-analyzer-view)
4. [TSG.19.4 Waterfall Display](#tsg194-waterfall-display)
5. [TSG.19.5 Spectrogram View](#tsg195-spectrogram-view)
6. [TSG.19.6 Signal Browser View](#tsg196-signal-browser-view)
7. [TSG.19.7 Wideband Composite Display](#tsg197-wideband-composite-display)
8. [TSG.19.8 Color Mapping and Palettes](#tsg198-color-mapping-and-palettes)
9. [TSG.19.9 Axis Systems and Frequency Labels](#tsg199-axis-systems-and-frequency-labels)
10. [TSG.19.10 Reactive State Model](#tsg1910-reactive-state-model)
11. [TSG.19.11 Performance Budget](#tsg1911-performance-budget)
12. [TSG.19.12 Interaction Model](#tsg1912-interaction-model)
13. [TSG.19.13 Rendering Layer Integration](#tsg1913-rendering-layer-integration)
14. [TSG.19.14 BaseSignal SDR Schema](#tsg1914-basesignal-sdr-schema)
15. [TSG.19.15 Annotation Overlay](#tsg1915-annotation-overlay)
16. [TSG.19.16 Normative Requirements Summary](#tsg1916-normative-requirements-summary)
17. [TSG.19.17 References](#tsg1917-references)

---

## TSG.19.1 Scope and Design Philosophy

### TSG.19.1.1 Purpose

Spectrum visualization is the primary user interface for SDR data in Tsingou.
It transforms frequency-domain data (FFT magnitudes) into visual
representations that enable operators to detect, classify, and analyze radio
frequency signals in real-time.

### TSG.19.1.2 Visualization Modes

Tsingou provides four complementary spectrum visualization modes:

```
┌───────────────────────────────────────────────────┐
│  Spectrum Analyzer                                │
│  ________________________________________________ │
│ -40 ╭──╮                          ╭─╮            │
│ -60 │  │     ╭──╮                 │ │            │
│ -80 │  ╰─────╯  ╰─────────────╮  │ │  ╭──╮     │
│ -100│                          ╰──╯ ╰──╯  ╰──   │
│     433.0    433.5    434.0    434.5   435.0 MHz  │
├───────────────────────────────────────────────────┤
│  Waterfall (time ↓, frequency →, power = color)   │
│  ▓▓▓▓░░░░░▓▓░░░░░░░░░░░░░░░░░▓▓░░░░▓▓░░░░░░   │
│  ▓▓▓▓░░░░░▓▓░░░░░░░░░░░░░░░░░▓▓░░░░▓▓░░░░░░   │
│  ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░▓▓░░░░░░░░░░░░   │
│  ▓▓▓▓░░░░░▓▓▓░░░░░░░░░░░░░░░░▓▓░░░░▓▓▓░░░░   │
│  ▓▓▓▓░░░░░▓▓░░░░░░░░░░░░░░░░░▓▓░░░░▓▓░░░░░░   │
│     433.0    433.5    434.0    434.5   435.0 MHz  │
└───────────────────────────────────────────────────┘
```

| Mode | Axes | Data | Primary Use |
|------|------|------|-------------|
| Spectrum Analyzer | Frequency (x) vs Power (y) | Single FFT frame | Signal detection, power measurement |
| Waterfall | Frequency (x) vs Time (y), Power (color) | Rolling FFT history | Temporal signal patterns |
| Spectrogram | Frequency (x) vs Time (y), Power (intensity) | Full recording | Long-duration signal analysis |
| Signal Browser | Time (x) vs IQ (y) | Raw IQ samples | Modulation analysis, timing |

### TSG.19.1.3 Relationship to 4-Layer Rendering

Spectrum visualization operates within the Tsingou 4-layer rendering
surface (TSG.20):

```
Layer 4: DOM Control Layer
    |  Frequency labels, toolbar, controls, annotation popups
    |
Layer 3: visx Data Visualization Layer  ← SPECTRUM ANALYZER (SVG/Canvas)
    |  Spectrum line chart, axis grid, markers
    |
Layer 2: p5/Canvas Layer  ← WATERFALL (Canvas 2D / WebGL)
    |  Waterfall pixel rendering, spectrogram heatmap
    |
Layer 1: R3F 3D Scene Layer  ← 3D SPECTRUM (optional)
    |  3D waterfall surface, perspective spectrum view
```

The spectrum analyzer view renders on Layer 3 (visx) for precision SVG
graphics with data-driven axes. The waterfall renders on Layer 2 (Canvas)
for high-throughput pixel operations. The 3D spectrum view (if present)
renders on Layer 1 (R3F).

### TSG.19.1.4 Performance Constraints

Spectrum visualization must maintain real-time responsiveness at the FFT
output rate. Key constraints:

| Parameter | Minimum | Recommended | Maximum |
|-----------|---------|-------------|---------|
| FFT update rate | 1 Hz | 10 Hz | 30 Hz |
| FFT size (points per frame) | 128 | 1024 | 16384 |
| Waterfall history depth | 100 rows | 500 rows | 2000 rows |
| Frame render time | -- | <16 ms | 33 ms |
| NATS → display latency | -- | <50 ms | 200 ms |

Implementations MUST maintain at least 10 Hz display update rate for
spectrum visualization. Implementations SHOULD target 30 Hz when GPU
resources are available.

---

## TSG.19.2 Data Pipeline Architecture

### TSG.19.2.1 End-to-End Pipeline

```
SDR Device
    |
    | IQ samples (CU8/CS8/CS16/CF32)
    v
Sidecar / GNU Radio
    |
    | FFT computation (windowed, dBFS conversion)
    v
NATS Message
    |
    | JSON: { type: "fft", magnitudes: [...], centerFrequency, ... }
    v
HolonetBridgeAdapter (kind: "sdr")
    |
    | BaseSignal validation + schema enforcement
    v
d2ts Ingest Pipeline
    |
    | Incremental processing, operator chain
    v
Atom State (SpectrumAtoms)
    |
    | Reactive subscription
    v
React Components (Spectrum Analyzer, Waterfall, etc.)
    |
    | visx / Canvas 2D / WebGL rendering
    v
Display
```

### TSG.19.2.2 NATS to Atom Bridge

The HolonetBridgeAdapter subscribes to NATS FFT subjects and converts
incoming messages to BaseSignal objects that feed the d2ts pipeline. The
pipeline output drives atom state updates:

```typescript
// Atom declarations for spectrum state
export const currentFftAtom = Atom.make<Float64Array>(
  new Float64Array(1024)
)

export const waterfallHistoryAtom = Atom.make<Float64Array[]>([])

export const centerFrequencyAtom = Atom.make<number>(0)

export const bandwidthAtom = Atom.make<number>(0)

export const fftSizeAtom = Atom.make<number>(1024)
```

### TSG.19.2.3 Data Flow Rate Analysis

| Source | FFT Rate | Points/Frame | JSON Payload | NATS Bandwidth |
|--------|----------|-------------|-------------|----------------|
| RTL-SDR 2.4 MSPS, 1024-pt | ~4,688 Hz raw | 1024 | ~12 KB | ~56 MB/s |
| RTL-SDR 2.4 MSPS, 1024-pt, avg=10 | ~469 Hz | 1024 | ~12 KB | ~5.6 MB/s |
| RTL-SDR 2.4 MSPS, 1024-pt, avg=100 | ~47 Hz | 1024 | ~12 KB | ~564 KB/s |
| HackRF 8 MSPS, 4096-pt | ~3,906 Hz raw | 4096 | ~47 KB | ~184 MB/s |
| HackRF 8 MSPS, 4096-pt, avg=100 | ~39 Hz | 4096 | ~47 KB | ~1.8 MB/s |

FFT averaging in the sidecar is REQUIRED to reduce NATS bandwidth to
manageable levels. Without averaging, even modest FFT rates overwhelm both
NATS and the browser rendering pipeline.

Implementations MUST configure FFT averaging such that the output rate does
not exceed 60 Hz. Implementations SHOULD default to an averaging count that
produces approximately 10-15 Hz output rate.

**Recommended averaging counts:**

| Sample Rate | FFT Size | Raw FFT Rate | Recommended Avg | Output Rate |
|-------------|----------|-------------|----------------|-------------|
| 2.4 MSPS | 1024 | 4,688 Hz | 200 | ~23 Hz |
| 2.4 MSPS | 2048 | 2,344 Hz | 100 | ~23 Hz |
| 8 MSPS | 1024 | 15,625 Hz | 800 | ~20 Hz |
| 8 MSPS | 4096 | 3,906 Hz | 200 | ~20 Hz |
| 20 MSPS | 4096 | 9,766 Hz | 500 | ~20 Hz |

---

## TSG.19.3 Spectrum Analyzer View

### TSG.19.3.1 Visual Design

The spectrum analyzer displays a single FFT frame as a frequency-domain
power plot:

```
Power (dBFS)
     ^
 -20 |
 -30 |      ╭─╮
 -40 |   ╭──╯ ╰──╮                     ╭──╮
 -50 |  ╭╯       ╰─╮              ╭──╮╭╯  ╰╮
 -60 | ╭╯          ╰─╮   ╭──╮   ╭╯  ╰╯    ╰╮
 -70 |╭╯              ╰─╮╭╯ ╰╮ ╭╯           ╰╮
 -80 |╯                 ╰╯   ╰─╯             ╰
 -90 |
-100 |───────────────────────────────────────────
     +──────┬──────┬──────┬──────┬──────┬───────>
          433.0  433.5  434.0  434.5  435.0   MHz
                        Frequency
```

### TSG.19.3.2 Display Elements

| Element | Description | Rendering Layer |
|---------|-------------|----------------|
| Spectrum trace | Current FFT magnitude line | visx LinePath (SVG) or Canvas |
| Max hold trace | Historical peak values | visx LinePath (dashed, semi-transparent) |
| Average trace | Exponential moving average | visx LinePath (dotted) |
| Noise floor line | Estimated noise floor | visx horizontal line |
| Grid lines | Reference grid (major/minor) | visx AxisBottom/AxisLeft |
| Frequency axis | Bottom axis with Hz/kHz/MHz labels | visx AxisBottom |
| Power axis | Left axis with dBFS labels | visx AxisLeft |
| Cursor readout | Frequency + power at cursor position | DOM overlay |
| Markers | User-placed frequency markers | visx circles + DOM labels |
| Peak markers | Automatic peak detection markers | visx circles (auto) |
| Channel overlays | Protocol channel boundaries | visx rect (semi-transparent) |

### TSG.19.3.3 Trace Modes

Implementations MUST support the following trace modes:

| Mode | Formula | Description |
|------|---------|-------------|
| Live | `trace[k] = fft[k]` | Current FFT frame (default) |
| Max Hold | `trace[k] = max(trace[k], fft[k])` | Persistent peak envelope |
| Min Hold | `trace[k] = min(trace[k], fft[k])` | Persistent minimum |
| Average | `trace[k] = alpha * fft[k] + (1-alpha) * trace[k]` | Exponential moving average |
| Peak | `trace[k] = fft[k]; peak[k] = max(peak[k], fft[k])` | Live + peak overlay |

The averaging alpha parameter controls the smoothing time constant:

```
alpha = 1 - exp(-1 / (averaging_time * fft_rate))
```

Where `averaging_time` is in seconds. Typical values:

| Averaging Time | Alpha (@ 10 Hz FFT) | Visual Effect |
|---------------|---------------------|---------------|
| 0.1 s | 0.632 | Fast tracking, noisy |
| 0.5 s | 0.181 | Moderate smoothing |
| 1.0 s | 0.095 | Smooth, ~1s response |
| 5.0 s | 0.020 | Very smooth, slow response |
| 10.0 s | 0.010 | Near-static display |

### TSG.19.3.4 Peak Detection

Automatic peak detection identifies local maxima in the FFT frame:

```
A bin k is a peak if:
  1. fft[k] > fft[k-1]  AND  fft[k] > fft[k+1]     (local maximum)
  2. fft[k] > noise_floor + threshold_db              (above noise floor)
  3. fft[k] is among the top N peaks                   (limit count)
```

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `threshold_db` | 10 | 3-30 | Minimum dB above noise floor |
| `max_peaks` | 10 | 1-50 | Maximum number of peaks displayed |
| `noise_percentile` | 25 | 10-50 | Percentile for noise floor estimation |

The noise floor is estimated as the Nth percentile of the FFT magnitude
array. The 25th percentile is RECOMMENDED as a robust noise floor estimator
that tolerates moderate signal occupancy.

### TSG.19.3.5 Frequency Resolution Display

The spectrum analyzer SHOULD display the current frequency resolution:

```
delta_f = sample_rate / fft_size
```

This value SHOULD be shown in the display header or tooltip to inform the
operator about the measurement granularity.

### TSG.19.3.6 visx Implementation Architecture

The spectrum analyzer is implemented as a visx compound component:

```typescript
interface SpectrumAnalyzerProps {
  /** Width in pixels */
  readonly width: number
  /** Height in pixels */
  readonly height: number
  /** FFT magnitude data (dBFS) */
  readonly magnitudes: Float64Array
  /** Center frequency in Hz */
  readonly centerFrequency: number
  /** Bandwidth in Hz (= sample rate) */
  readonly bandwidth: number
  /** Trace modes to display */
  readonly traces: readonly TraceMode[]
  /** Power range (dBFS) */
  readonly powerRange: readonly [number, number]
  /** Whether to show peak markers */
  readonly showPeaks: boolean
  /** Peak detection threshold (dB above noise) */
  readonly peakThreshold: number
  /** Callback on frequency click */
  readonly onFrequencyClick?: (freqHz: number) => void
  /** Callback on range selection */
  readonly onRangeSelect?: (lower: number, upper: number) => void
}
```

The component uses visx scales for frequency-to-pixel and power-to-pixel
mapping:

```typescript
const freqScale = scaleLinear({
  domain: [
    centerFrequency - bandwidth / 2,
    centerFrequency + bandwidth / 2,
  ],
  range: [margin.left, width - margin.right],
})

const powerScale = scaleLinear({
  domain: [powerRange[1], powerRange[0]],  // inverted: top = high power
  range: [margin.top, height - margin.bottom],
})
```

---

## TSG.19.4 Waterfall Display

### TSG.19.4.1 Visual Design

The waterfall display maps FFT history to a scrolling 2D image where the
x-axis is frequency, the y-axis is time (most recent at top), and pixel
color represents power:

```
     433.0    433.5    434.0    434.5    435.0 MHz
  t  ▓▓▓▓░░░░░▓▓░░░░░░░░░░░░░░░░▓▓░░░░▓▓░░░░  ← newest
  |  ▓▓▓▓░░░░░▓▓░░░░░░░░░░░░░░░░▓▓░░░░▓▓░░░░
  |  ▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░▓▓░░░░░░░░░░
  |  ▓▓▓▓░░░░░▓▓▓░░░░░░░░░░░░░░░▓▓░░░░▓▓▓░░
  |  ▓▓▓▓░░░░░▓▓░░░░░░░░░░░░░░░░▓▓░░░░▓▓░░░░
  v  ░░░░░░░░░▓▓░░░░░░░░░░░░░░░░░░░░░░▓▓░░░░  ← oldest
```

### TSG.19.4.2 Rendering Strategy

The waterfall renders on Canvas 2D (Layer 2) for maximum pixel throughput.
Two rendering strategies are supported:

**Strategy A: ImageData scroll (CPU-bound)**

```
On each new FFT frame:
  1. Shift existing pixels down by 1 row (memmove or getImageData/putImageData)
  2. Map new FFT magnitudes to colors using the active palette
  3. Write new pixel row at y=0
```

**Strategy B: Circular buffer + OffscreenCanvas (GPU-assisted)**

```
Maintain a circular buffer of FFT rows (Ring<Float64Array>):
  1. Append new FFT to circular buffer at write_index
  2. On render: draw from write_index backward, wrapping around
  3. Use OffscreenCanvas for palette-to-pixel mapping
```

Strategy B is RECOMMENDED for waterfall depths > 500 rows as it avoids the
O(rows * width) memmove cost on each frame.

**Strategy C: WebGL texture scroll (GPU-optimal)**

```
Maintain FFT data as a WebGL 2D texture:
  1. Upload new FFT row to texture at y = write_index (glTexSubImage2D)
  2. Render with fragment shader that:
     a. Reads from texture with circular offset
     b. Applies color palette lookup texture
  3. Write_index advances modulo texture_height
```

Strategy C is RECOMMENDED for maximum performance. The fragment shader
performs the color mapping on the GPU, completely offloading the CPU.

### TSG.19.4.3 WebGL Fragment Shader

```glsl
// Waterfall fragment shader
precision highp float;

uniform sampler2D u_fftTexture;     // FFT magnitude data (R channel)
uniform sampler2D u_paletteTexture; // Color palette lookup (256 entries)
uniform float u_writeIndex;         // Current write position (0.0-1.0)
uniform float u_powerMin;           // Minimum power (dBFS) for color map
uniform float u_powerMax;           // Maximum power (dBFS) for color map

varying vec2 v_texCoord;

void main() {
    // Circular buffer offset
    float y = mod(v_texCoord.y + u_writeIndex, 1.0);

    // Read FFT magnitude from texture
    float power = texture2D(u_fftTexture, vec2(v_texCoord.x, y)).r;

    // Normalize to 0-1 range for palette lookup
    float normalized = clamp((power - u_powerMin) / (u_powerMax - u_powerMin), 0.0, 1.0);

    // Look up color from palette texture
    gl_FragColor = texture2D(u_paletteTexture, vec2(normalized, 0.5));
}
```

### TSG.19.4.4 Waterfall Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `historyDepth` | uint | 500 | Number of FFT rows to display |
| `scrollDirection` | enum | `"down"` | `"down"` (newest top) or `"up"` (newest bottom) |
| `palette` | string | `"viridis"` | Color palette name |
| `powerMin` | number | -100 | Minimum power for color mapping (dBFS) |
| `powerMax` | number | -20 | Maximum power for color mapping (dBFS) |
| `renderStrategy` | enum | `"webgl"` | `"imagedata"`, `"circular"`, or `"webgl"` |

### TSG.19.4.5 Waterfall Time Scale

The vertical axis represents time. The time span covered by the waterfall
depends on the FFT output rate and history depth:

```
time_span = history_depth / fft_output_rate

Example: 500 rows / 10 Hz = 50 seconds of history
```

Implementations SHOULD display the time scale on the right axis, with
labels in seconds or minutes as appropriate.

---

## TSG.19.5 Spectrogram View

### TSG.19.5.1 Distinction from Waterfall

The spectrogram view differs from the waterfall in scope and interaction:

| Aspect | Waterfall | Spectrogram |
|--------|-----------|-------------|
| Time span | Recent history (seconds) | Full recording (minutes-hours) |
| Data source | Live FFT stream | SigMF recording or accumulated buffer |
| Scrolling | Auto-scroll (real-time) | User-controlled pan/zoom |
| Resolution | 1:1 pixel-per-FFT-bin | Downsampled to fit viewport |
| Interaction | Limited (cursor readout) | Rich (selection, annotation, zoom) |

### TSG.19.5.2 Data Structure

The spectrogram operates on a 2D matrix of FFT magnitudes:

```typescript
interface SpectrogramData {
  /** 2D matrix: rows = time, columns = frequency bins */
  readonly matrix: Float64Array[]
  /** Number of time rows */
  readonly timeRows: number
  /** Number of frequency bins per row */
  readonly freqBins: number
  /** Sample rate (Hz) */
  readonly sampleRate: number
  /** FFT size */
  readonly fftSize: number
  /** Center frequency (Hz) */
  readonly centerFrequency: number
  /** Start time (Unix seconds) */
  readonly startTime: number
  /** Time resolution (seconds per row) */
  readonly timeResolution: number
}
```

### TSG.19.5.3 Level-of-Detail Rendering

For recordings with thousands of FFT rows, the spectrogram MUST implement
level-of-detail (LOD) rendering to maintain interactive performance:

| Zoom Level | Strategy | Description |
|-----------|----------|-------------|
| Overview (full recording) | Max-pooled thumbnail | Downsample to viewport pixels |
| Medium (10-100x) | Tile-based rendering | Load tiles on demand |
| Detail (1-10x) | Full resolution | Render all FFT bins in viewport |
| Pixel (1:1) | Direct mapping | Each pixel = one FFT bin |

The LOD system computes the appropriate resolution based on the current
viewport dimensions and zoom level:

```
target_freq_bins = viewport_width
target_time_rows = viewport_height
freq_downsample = ceil(total_freq_bins / target_freq_bins)
time_downsample = ceil(total_time_rows / target_time_rows)
```

When downsampling, implementations MUST use max-pooling (not averaging) to
preserve peak signal visibility.

### TSG.19.5.4 Tile-Based Architecture

For large recordings, the spectrogram uses a tile-based architecture:

```
┌────────┬────────┬────────┬────────┐
│ Tile   │ Tile   │ Tile   │ Tile   │
│ (0,0)  │ (1,0)  │ (2,0)  │ (3,0)  │  ← Row 0
├────────┼────────┼────────┼────────┤
│ Tile   │ Tile   │ Tile   │ Tile   │
│ (0,1)  │ (1,1)  │ (2,1)  │ (3,1)  │  ← Row 1
├────────┼────────┼────────┼────────┤
│ Tile   │ Tile   │ Tile   │ Tile   │
│ (0,2)  │ (1,2)  │ (2,2)  │ (3,2)  │  ← Row 2
└────────┴────────┴────────┴────────┘
```

Each tile is a fixed-size image (e.g., 256x256 pixels) pre-rendered at
multiple LOD levels. Only tiles visible in the current viewport are rendered.

Tile cache size SHOULD be limited to 2x the viewport area to balance memory
usage and scroll smoothness.

---

## TSG.19.6 Signal Browser View

### TSG.19.6.1 Purpose

The signal browser displays time-domain IQ samples for detailed signal
analysis:

```
  I(t) / Q(t)
     ^
 1.0 |  ╭╮  ╭╮  ╭╮  ╭╮  ╭╮
     | ╭╯╰╮╭╯╰╮╭╯╰╮╭╯╰╮╭╯╰╮    ← I channel
 0.0 |─╯──╰╯──╰╯──╰╯──╰╯──╰─
     |                             ← Q channel (dashed)
-1.0 |  ╰╯  ╰╯  ╰╯  ╰╯  ╰╯
     └──────────────────────────>
                              Time (samples)
```

### TSG.19.6.2 Display Modes

| Mode | Y-Axis | Description |
|------|--------|-------------|
| IQ (I + Q overlay) | Amplitude | In-phase and quadrature on same plot |
| IQ (I vs Q scatter) | Q amplitude | Constellation diagram |
| Magnitude | `|z|` | Signal envelope |
| Phase | `arg(z)` | Instantaneous phase |
| Frequency | `d(arg(z))/dt` | Instantaneous frequency |
| Eye Diagram | Amplitude | Overlapped symbol periods for ISI analysis |

### TSG.19.6.3 Constellation Diagram

The IQ scatter mode displays the I/Q constellation:

```
  Q
  ^
  |  x    x    x    x
  |  x    x    x    x
  |  x    x    x    x
  |  x    x    x    x
  +─────────────────────> I
  |  x    x    x    x
  |  x    x    x    x
  |  x    x    x    x
  |  x    x    x    x
```

For phase-shift keying (PSK) and quadrature amplitude modulation (QAM),
the constellation diagram reveals modulation order, SNR, and impairments
(phase noise, IQ imbalance, amplitude droop).

### TSG.19.6.4 Data Source

The signal browser operates on raw IQ samples, not FFT data. IQ data
arrives via:

1. **Live stream**: NATS subject `tsingou.signal.sdr.iq.{device_id}` in
   binary format (TSG.17.4.5)
2. **SigMF recording**: Loaded from `.sigmf-data` file via SigMF codec
   (TSG.18)
3. **Captured segment**: User-selected time window from the waterfall,
   triggering a burst capture request to the sidecar

Due to the high data rate of raw IQ (see TSG.16.7.6), the signal browser
MUST NOT attempt to display more than 100,000 samples simultaneously.
For longer signals, implementations MUST provide pan/zoom controls to
navigate through the recording.

---

## TSG.19.7 Wideband Composite Display

### TSG.19.7.1 Purpose

When using HackRF sweep mode (TSG.16.3.4), the sidecar publishes FFT
segments from different center frequencies as it sweeps across the band.
The composite display assembles these segments into a single wideband
spectrum view.

### TSG.19.7.2 Segment Assembly

```
Segment 1:          Segment 2:          Segment 3:
fc=100 MHz          fc=120 MHz          fc=140 MHz
BW=20 MHz           BW=20 MHz           BW=20 MHz
[── 90-110 MHz ──]  [── 110-130 MHz ──] [── 130-150 MHz ──]

Assembled composite:
[────────────────── 90-150 MHz ─────────────────────]
```

### TSG.19.7.3 Assembly Algorithm

```
For each incoming FFT segment:
  1. Extract centerFrequency and bandwidth from NATS message
  2. Calculate frequency range: [fc - bw/2, fc + bw/2]
  3. Map FFT bins to absolute frequencies
  4. Place bins into the composite buffer at correct positions
  5. Mark this frequency range as "fresh" (timestamp updated)

For rendering:
  1. Iterate composite buffer left to right
  2. Color-code by age: fresh = normal, stale = dimmed
  3. Show sweep coverage indicator
```

### TSG.19.7.4 Sweep Freshness

Each frequency bin in the composite display has an associated timestamp.
Bins are rendered differently based on age:

| Age | Visual Treatment | Opacity |
|-----|-----------------|---------|
| < 1 sweep cycle | Normal | 100% |
| 1-2 sweep cycles | Slightly dimmed | 75% |
| 2-5 sweep cycles | Dimmed | 50% |
| > 5 sweep cycles | Very dim | 25% |

This visual aging provides immediate feedback about which parts of the
spectrum have been recently observed.

### TSG.19.7.5 HackRF Sweep Mode NATS Message

Each sweep segment includes the center frequency of that specific segment:

```json
{
  "type": "fft",
  "magnitudes": [-80.5, -78.2, ...],
  "centerFrequency": 120000000,
  "bandwidth": 20000000,
  "fftSize": 1024,
  "sweepSegment": true,
  "sweepIndex": 2,
  "sweepTotal": 10,
  "timestamp": 1708300000.123,
  "seq": 42
}
```

The `sweepSegment`, `sweepIndex`, and `sweepTotal` fields are RECOMMENDED
for sweep mode to enable the composite display to track sweep progress.

---

## TSG.19.8 Color Mapping and Palettes

### TSG.19.8.1 Palette Requirements

Color palettes map normalized power values (0.0-1.0) to RGB colors. The
palette MUST provide:

1. **Perceptual uniformity**: Equal power differences produce equal
   perceptual color differences
2. **Monotonic luminance**: Increasing power always increases brightness
3. **Colorblind safety**: Distinguishable by deuteranopia and protanopia
4. **Print safety**: Meaningful when printed in grayscale

### TSG.19.8.2 Built-In Palettes

Implementations MUST support the following palettes:

| Name | Source | Description | Primary Use |
|------|--------|-------------|-------------|
| `viridis` | matplotlib | Blue-green-yellow, perceptually uniform | Default, general purpose |
| `inferno` | matplotlib | Black-red-yellow-white, high contrast | Weak signal detection |
| `plasma` | matplotlib | Blue-pink-yellow, good range | Wide dynamic range |
| `turbo` | Google AI | Rainbow-like but perceptually improved | SDR tradition |
| `grayscale` | -- | Black to white linear | Print, minimal distractions |
| `hot` | -- | Black-red-yellow-white | Traditional heatmap |

### TSG.19.8.3 Palette Lookup Table

Each palette is represented as a 256-entry lookup table (LUT):

```typescript
type PaletteLUT = Uint8Array  // 256 * 4 = 1024 bytes (RGBA)

function applyPalette(
  normalized: number,  // 0.0-1.0
  lut: PaletteLUT
): [number, number, number, number] {
  const index = Math.floor(Math.min(normalized, 0.999) * 256) * 4
  return [lut[index], lut[index+1], lut[index+2], lut[index+3]]
}
```

For WebGL waterfall rendering, the palette LUT is uploaded as a 256x1
RGBA texture and sampled in the fragment shader (see TSG.19.4.3).

### TSG.19.8.4 Power Normalization

The normalization function maps dBFS values to the 0-1 palette range:

```
normalized = clamp((power_dbfs - power_min) / (power_max - power_min), 0, 1)
```

Where `power_min` and `power_max` are user-adjustable thresholds that
control the dynamic range window. Default values:

| Parameter | Default | Typical Range | Description |
|-----------|---------|---------------|-------------|
| `power_min` | -100 dBFS | -120 to -60 | Maps to palette index 0 (darkest) |
| `power_max` | -20 dBFS | -40 to 0 | Maps to palette index 255 (brightest) |

### TSG.19.8.5 Auto-Scaling

Implementations SHOULD support automatic power range adjustment:

```
power_min = percentile(all_bins, 5)   // 5th percentile = noise floor
power_max = percentile(all_bins, 99)  // 99th percentile = strongest signal
```

Auto-scaling SHOULD update at a slow rate (once per second) to avoid
visual instability. Implementations MAY use exponential smoothing on the
percentile values.

---

## TSG.19.9 Axis Systems and Frequency Labels

### TSG.19.9.1 Frequency Axis

The frequency axis MUST display human-readable frequency labels with
appropriate unit scaling:

| Frequency Range | Unit | Example |
|----------------|------|---------|
| < 1 kHz | Hz | `500 Hz` |
| 1 kHz - 1 MHz | kHz | `433.920 kHz` |
| 1 MHz - 1 GHz | MHz | `433.920 MHz` |
| >= 1 GHz | GHz | `2.437 GHz` |

### TSG.19.9.2 Frequency Label Precision

Implementations MUST display sufficient decimal places to distinguish
adjacent grid lines:

```
Grid spacing: delta_f = bandwidth / num_grid_lines

Required decimals: ceil(-log10(delta_f / unit_scale))

Example:
  bandwidth = 2.4 MHz, 8 grid lines
  delta_f = 300 kHz = 0.3 MHz
  Required: ceil(-log10(0.3)) = 1 decimal place
  Labels: 433.0, 433.3, 433.6, 433.9, 434.2, 434.5, 434.8, 435.1 MHz
```

### TSG.19.9.3 Power Axis

The power axis MUST use dBFS (decibels relative to full scale):

| Parameter | Requirement |
|-----------|-------------|
| Unit | dBFS |
| Range | At least 80 dB visible |
| Grid spacing | 10 dB major grid lines |
| Minor grid | 5 dB or 2 dB |

The axis label MUST read "Power (dBFS)" or "Magnitude (dBFS)".

### TSG.19.9.4 Time Axis (Waterfall/Spectrogram)

For waterfall and spectrogram views, the time axis SHOULD display:

| Time Span | Format | Example |
|-----------|--------|---------|
| < 60 seconds | `-Ns` (relative) | `-30s`, `-15s`, `-5s`, `0s` |
| 1-60 minutes | `HH:MM:SS` | `12:30:00`, `12:30:30` |
| > 60 minutes | `HH:MM` | `12:30`, `13:00`, `13:30` |

---

## TSG.19.10 Reactive State Model

### TSG.19.10.1 Atom Architecture

Spectrum visualization state is managed via effect-atom, following the
Atom-as-State doctrine:

```typescript
// === FFT Data Atoms ===

/** Current FFT magnitude array (dBFS values) */
export const currentFftAtom = Atom.make<Float64Array>(
  new Float64Array(0)
)

/** Waterfall history ring buffer */
export const waterfallHistoryAtom = Atom.make<{
  readonly buffer: Float64Array[]
  readonly writeIndex: number
  readonly depth: number
}>({
  buffer: [],
  writeIndex: 0,
  depth: 500,
})

/** Max-hold trace */
export const maxHoldAtom = Atom.make<Float64Array>(
  new Float64Array(0)
)

/** Average trace (exponential moving average) */
export const averageTraceAtom = Atom.make<Float64Array>(
  new Float64Array(0)
)

// === Configuration Atoms ===

/** Center frequency in Hz */
export const centerFrequencyAtom = Atom.make<number>(0)

/** Bandwidth in Hz */
export const bandwidthAtom = Atom.make<number>(0)

/** FFT size */
export const fftSizeAtom = Atom.make<number>(1024)

/** Active trace modes */
export const traceModesAtom = Atom.make<readonly TraceMode[]>(
  ["live"]
)

/** Power range for color mapping */
export const powerRangeAtom = Atom.make<readonly [number, number]>(
  [-100, -20]
)

/** Active color palette */
export const paletteAtom = Atom.make<string>("viridis")

/** Whether auto-scaling is enabled */
export const autoScaleAtom = Atom.make<boolean>(false)

// === Interaction Atoms ===

/** Cursor frequency (null when not hovering) */
export const cursorFrequencyAtom = Atom.make<number | null>(null)

/** Cursor power (null when not hovering) */
export const cursorPowerAtom = Atom.make<number | null>(null)

/** User-placed frequency markers */
export const markersAtom = Atom.make<readonly FrequencyMarker[]>([])

/** Selection range (frequency) */
export const selectionRangeAtom = Atom.make<{
  readonly lower: number
  readonly upper: number
} | null>(null)

// === Derived Atoms ===

/** Detected peaks (derived from currentFft + config) */
export const detectedPeaksAtom = Atom.derived((get) => {
  const fft = get(currentFftAtom)
  const centerFreq = get(centerFrequencyAtom)
  const bandwidth = get(bandwidthAtom)
  const range = get(powerRangeAtom)
  return detectPeaks(fft, centerFreq, bandwidth, range)
})

/** Noise floor estimate (derived) */
export const noiseFloorAtom = Atom.derived((get) => {
  const fft = get(currentFftAtom)
  return estimateNoiseFloor(fft, 25)  // 25th percentile
})
```

### TSG.19.10.2 Update Path

When a new FFT frame arrives:

```
NATS message received
    |
    v
HolonetBridgeAdapter.onMessage()
    |
    v
ctx.set(currentFftAtom, newMagnitudes)     ← triggers spectrum re-render
ctx.set(centerFrequencyAtom, newCenterFreq) ← if changed
ctx.set(bandwidthAtom, newBandwidth)        ← if changed
    |
    v
Update waterfall history:
  ctx.set(waterfallHistoryAtom, pushRow(current, newMagnitudes))
    |
    v
Update max-hold (if active):
  ctx.set(maxHoldAtom, elementWiseMax(current, newMagnitudes))
    |
    v
Update average (if active):
  ctx.set(averageTraceAtom, ema(current, newMagnitudes, alpha))
```

### TSG.19.10.3 React Subscription

Components subscribe to atoms via `useAtomValue`:

```typescript
function SpectrumAnalyzer() {
  const magnitudes = useAtomValue(currentFftAtom)
  const centerFreq = useAtomValue(centerFrequencyAtom)
  const bandwidth = useAtomValue(bandwidthAtom)
  const powerRange = useAtomValue(powerRangeAtom)
  const peaks = useAtomValue(detectedPeaksAtom)

  // Render with visx...
}

function WaterfallDisplay() {
  const history = useAtomValue(waterfallHistoryAtom)
  const palette = useAtomValue(paletteAtom)
  const powerRange = useAtomValue(powerRangeAtom)

  // Render with Canvas 2D or WebGL...
}
```

---

## TSG.19.11 Performance Budget

### TSG.19.11.1 Frame Budget

At 30 Hz display update rate, each frame has 33.3 ms. The budget is
allocated as follows:

| Phase | Budget | Description |
|-------|--------|-------------|
| NATS receive + parse | 2 ms | JSON parse of FFT message |
| Schema validation | 1 ms | BaseSignal validation |
| d2ts pipeline | 3 ms | Operator chain processing |
| Atom update | 1 ms | State mutation + subscriber notification |
| Spectrum trace render | 4 ms | visx SVG path or Canvas line |
| Waterfall row render | 3 ms | Palette lookup + pixel write |
| Peak detection | 2 ms | Local maxima scan |
| Axis labels | 2 ms | visx axis render |
| DOM overlay update | 2 ms | Cursor readout, markers |
| **Total** | **20 ms** | **13 ms margin** |

### TSG.19.11.2 Memory Budget

| Structure | Size | Calculation |
|-----------|------|-------------|
| Current FFT (4096 points) | 32 KB | 4096 * 8 bytes |
| Max-hold trace | 32 KB | Same as current FFT |
| Average trace | 32 KB | Same as current FFT |
| Waterfall history (500 x 4096) | 16 MB | 500 * 4096 * 8 bytes |
| Waterfall ImageData (500 x 4096 RGBA) | 8 MB | 500 * 4096 * 4 bytes |
| Palette LUT | 1 KB | 256 * 4 bytes |
| **Total** | **~24 MB** | |

For FFT sizes of 1024 (default), the total is approximately 6 MB. This is
within the acceptable range for a desktop application.

### TSG.19.11.3 Optimization Strategies

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| FFT averaging in sidecar | Reduces NATS bandwidth 10-100x | Reduced time resolution |
| WebGL waterfall rendering | GPU-accelerated palette mapping | Requires WebGL support |
| Typed arrays (Float64Array) | No GC pressure for FFT data | Slightly more complex API |
| Ring buffer for waterfall | O(1) append, no array copy | Fixed history depth |
| requestAnimationFrame throttle | Limits render to display rate | May skip FFT frames |
| OffscreenCanvas for waterfall | Moves rendering to worker | Async, delayed display |

---

## TSG.19.12 Interaction Model

### TSG.19.12.1 Mouse Interactions

| Action | Spectrum Analyzer | Waterfall | Spectrogram |
|--------|------------------|-----------|-------------|
| Hover | Show frequency + power readout | Show freq + time + power | Show freq + time + power |
| Click | Place frequency marker | Select time row | Select time-freq point |
| Drag horizontal | Select frequency range | Select frequency range | Zoom frequency |
| Drag vertical | Adjust power range | N/A | Zoom time |
| Scroll wheel | Zoom frequency range | Zoom frequency range | Zoom both axes |
| Double-click | Reset zoom | Center on click frequency | Reset zoom |
| Right-click | Context menu (marker, annotation) | Context menu | Context menu |

### TSG.19.12.2 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` / `=` | Zoom in (frequency) |
| `-` | Zoom out (frequency) |
| `Arrow Left` / `Arrow Right` | Pan frequency |
| `Arrow Up` / `Arrow Down` | Adjust power range |
| `M` | Toggle max-hold |
| `A` | Toggle averaging |
| `P` | Toggle peak markers |
| `R` | Reset all views |
| `Space` | Pause/resume live display |
| `C` | Center on strongest signal |
| `1` | Spectrum analyzer view |
| `2` | Waterfall view |
| `3` | Split view (spectrum + waterfall) |
| `4` | Spectrogram view |

### TSG.19.12.3 Touch Interactions

For mobile and tablet deployments:

| Gesture | Action |
|---------|--------|
| Single tap | Show readout at point |
| Long press | Context menu |
| Pinch horizontal | Zoom frequency |
| Pinch vertical | Zoom power range |
| Two-finger pan | Pan frequency + time |
| Double-tap | Reset zoom |

### TSG.19.12.4 Frequency Tuning Integration

When the user clicks a frequency in the spectrum analyzer or waterfall,
implementations SHOULD offer to retune the SDR device to that frequency:

```
User clicks at 434.5 MHz
    |
    v
Context menu: "Tune to 434.5 MHz?"
    |
    v (if confirmed)
NATS publish to tsingou.signal.sdr.command.{device_id}:
{
  "command": "tune",
  "centerFrequency": 434500000,
  "timestamp": 1708300000.123
}
```

---

## TSG.19.13 Rendering Layer Integration

### TSG.19.13.1 Layer Assignment

| Visualization Component | Rendering Layer | Technology | Rationale |
|------------------------|----------------|------------|-----------|
| Spectrum trace (line chart) | Layer 3 (visx) | SVG or Canvas 2D | Precise data-driven axis, interaction |
| Spectrum grid / axes | Layer 3 (visx) | SVG | Clean vector graphics |
| Waterfall pixels | Layer 2 (Canvas) | Canvas 2D / WebGL | High-throughput pixel rendering |
| Spectrogram tiles | Layer 2 (Canvas) | Canvas 2D / WebGL | Large-area pixel rendering |
| 3D spectrum surface | Layer 1 (R3F) | Three.js / WebGL | Optional 3D perspective view |
| Frequency labels | Layer 4 (DOM) | HTML/CSS | Crisp text, accessible |
| Cursor readout | Layer 4 (DOM) | HTML/CSS | Floating overlay |
| Toolbar / controls | Layer 4 (DOM) | React components | Standard UI |
| Annotation popups | Layer 4 (DOM) | Floating panel | Rich content |

### TSG.19.13.2 Layer Synchronization

All layers share the same frequency axis and MUST be synchronized:

```typescript
// Shared frequency domain
const freqDomain = useAtomValue(freqDomainAtom)  // [lowerHz, upperHz]

// Layer 3 (visx): use visx scaleLinear
const freqScale = scaleLinear({
  domain: freqDomain,
  range: [0, width],
})

// Layer 2 (Canvas): use same mapping
function freqToPixel(freqHz: number): number {
  return ((freqHz - freqDomain[0]) / (freqDomain[1] - freqDomain[0])) * width
}

// Layer 1 (R3F): use same mapping in world coordinates
function freqToWorld(freqHz: number): number {
  return ((freqHz - freqDomain[0]) / (freqDomain[1] - freqDomain[0])) * worldWidth - worldWidth / 2
}
```

When the user zooms or pans in any layer, the shared `freqDomainAtom`
is updated, and all layers re-render with the new frequency range.

### TSG.19.13.3 Split View Layout

The default spectrum visualization layout is a vertical split:

```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │  Spectrum Analyzer                  │ │  40% height
│ │  (Layer 3: visx)                    │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │  Waterfall                          │ │  60% height
│ │  (Layer 2: Canvas/WebGL)            │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │  Frequency Axis (shared)            │ │  Fixed height
│ │  (Layer 4: DOM)                     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

The split ratio SHOULD be adjustable by dragging a divider handle. The
frequency axis at the bottom MUST be shared between both views.

---

## TSG.19.14 BaseSignal SDR Schema

### TSG.19.14.1 SDR Signal Kind

SDR data enters Tsingou through the BaseSignal schema (TSG.8) with
`kind: "sdr"`. The SDR-specific metadata fields are:

```typescript
const SdrSignalMetadata = Schema.Struct({
  /** Center frequency in Hz */
  centerFrequency: Schema.Number,
  /** Bandwidth in Hz (= sample rate for baseband) */
  bandwidth: Schema.Number,
  /** FFT size */
  fftSize: Schema.Number,
  /** Window function used */
  windowFunction: Schema.optional(Schema.String),
  /** Number of FFTs averaged */
  averageCount: Schema.optional(Schema.Number),
  /** Device identifier */
  deviceId: Schema.optional(Schema.String),
  /** Device type */
  deviceType: Schema.optional(
    Schema.Literal("rtlsdr", "hackrf", "usrp", "soapy", "gnuradio")
  ),
})
```

### TSG.19.14.2 FFT Signal

```typescript
const SdrFftSignal = Schema.TaggedStruct("SdrFftSignal", {
  kind: Schema.Literal("sdr"),
  subKind: Schema.Literal("fft"),
  /** FFT magnitudes in dBFS */
  magnitudes: Schema.Unknown,  // Float64Array at runtime
  /** Metadata */
  metadata: SdrSignalMetadata,
  /** Sequence number */
  seq: Schema.Number,
  /** Timestamp */
  timestamp: Schema.Number,
})
```

### TSG.19.14.3 Decoded Signal

```typescript
const SdrDecodedSignal = Schema.TaggedStruct("SdrDecodedSignal", {
  kind: Schema.Literal("sdr"),
  subKind: Schema.Literal("decoded"),
  /** Protocol name */
  protocol: Schema.String,
  /** Decoded data (protocol-specific) */
  data: Schema.Unknown,
  /** Reception frequency in Hz */
  frequency: Schema.Number,
  /** Signal strength in dBFS */
  signalStrength: Schema.optional(Schema.Number),
  /** Timestamp */
  timestamp: Schema.Number,
})
```

### TSG.19.14.4 Health Signal

```typescript
const SdrHealthSignal = Schema.TaggedStruct("SdrHealthSignal", {
  kind: Schema.Literal("sdr"),
  subKind: Schema.Literal("health"),
  /** Device identifier */
  deviceId: Schema.String,
  /** Device status */
  status: Schema.Literal("running", "paused", "error", "disconnected"),
  /** Uptime in seconds */
  uptime: Schema.Number,
  /** Device metrics */
  metrics: Schema.Struct({
    sampleRate: Schema.Number,
    droppedSamples: Schema.Number,
    fftRate: Schema.Number,
    usbErrors: Schema.Number,
    cpuUsage: Schema.optional(Schema.Number),
  }),
  /** Timestamp */
  timestamp: Schema.Number,
})
```

### TSG.19.14.5 HolonetBridgeAdapter SDR Configuration

The `makeSdrBridgeConfig` factory creates the adapter configuration for
SDR signal ingestion:

```typescript
function makeSdrBridgeConfig(deviceId: string): HolonetBridgeConfig {
  return {
    kind: "sdr",
    natsSubjects: [
      `tsingou.signal.sdr.fft.${deviceId}`,
      `tsingou.signal.sdr.decoded.*`,
      `tsingou.signal.sdr.health.${deviceId}`,
    ],
    schemaValidator: SdrSignalSchema,
    batchSize: 1,          // FFT frames are individual messages
    maxLag: 100,           // Drop frames if >100 behind
    processingPriority: 1, // High priority (real-time display)
  }
}
```

---

## TSG.19.15 Annotation Overlay

### TSG.19.15.1 Visual Representation

Annotations from the d2ts pipeline or SigMF metadata are displayed as
overlays on the spectrum and waterfall views:

```
Spectrum Analyzer with Annotations:
      ┌───── "ISM Device" ─────┐
      │                        │
 -40  │  ╭──╮                  │
 -60  │╭╯  ╰╮    ╭──╮         │
 -80  ╰╯    ╰────╯  ╰─────────╰─────────────
      433.8        434.0
           freq_lower  freq_upper

Waterfall with Annotations:
  ┌──────── Annotation Box ────────┐
  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← annotation region
  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│     (semi-transparent border)
  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
  └────────────────────────────────┘
```

### TSG.19.15.2 Annotation Rendering

| Element | Layer | Style |
|---------|-------|-------|
| Frequency band highlight | Layer 3 (visx) | Semi-transparent rectangle |
| Time-frequency box | Layer 2 (Canvas overlay) | Dashed border rectangle |
| Label text | Layer 4 (DOM) | Positioned div with CSS class |
| Confidence indicator | Layer 4 (DOM) | Color-coded badge |
| Click-to-expand | Layer 4 (DOM) | Popover with full annotation |

### TSG.19.15.3 Annotation Atom

```typescript
interface SpectrumAnnotation {
  readonly id: string
  readonly label: string
  readonly freqLower: number
  readonly freqUpper: number
  readonly timeStart: number
  readonly timeEnd: number
  readonly confidence: number
  readonly protocol: string | null
  readonly source: string
}

export const spectrumAnnotationsAtom = Atom.make<
  readonly SpectrumAnnotation[]
>([])
```

---

## TSG.19.16 Normative Requirements Summary

### TSG.19.16.1 Visualization Modes

| Requirement | Level |
|-------------|-------|
| Support spectrum analyzer view | MUST |
| Support waterfall display | MUST |
| Support spectrogram view | SHOULD |
| Support signal browser (IQ) view | MAY |
| Support wideband composite (sweep) display | MAY |
| Support split view (spectrum + waterfall) | SHOULD |

### TSG.19.16.2 Spectrum Analyzer

| Requirement | Level |
|-------------|-------|
| Display current FFT as frequency-domain plot | MUST |
| Support live, max-hold, and average trace modes | MUST |
| Automatic peak detection with configurable threshold | SHOULD |
| Display frequency and power at cursor position | MUST |
| User-adjustable power range | MUST |

### TSG.19.16.3 Waterfall

| Requirement | Level |
|-------------|-------|
| Display FFT history as scrolling color image | MUST |
| Configurable history depth | MUST |
| Support multiple color palettes | MUST |
| Default palette: viridis | SHOULD |
| WebGL-accelerated rendering | RECOMMENDED |

### TSG.19.16.4 Performance

| Requirement | Level |
|-------------|-------|
| Maintain >= 10 Hz display update rate | MUST |
| Target 30 Hz when GPU resources available | SHOULD |
| FFT averaging to limit output to <= 60 Hz | MUST |
| Frame render time < 33 ms | MUST |
| NATS-to-display latency < 200 ms | MUST |
| Typed arrays for FFT data (no GC pressure) | SHOULD |

### TSG.19.16.5 Interaction

| Requirement | Level |
|-------------|-------|
| Frequency readout on hover | MUST |
| Zoom/pan on frequency axis | MUST |
| Adjustable power range | MUST |
| Frequency markers | SHOULD |
| Range selection | SHOULD |
| Keyboard shortcuts | SHOULD |

### TSG.19.16.6 Data Model

| Requirement | Level |
|-------------|-------|
| BaseSignal schema for SDR signals (kind: "sdr") | MUST |
| Atom-based reactive state model | MUST |
| Effect Schema for all SDR data types | MUST |
| HolonetBridgeAdapter configuration for SDR | MUST |

### TSG.19.16.7 Rendering Layer

| Requirement | Level |
|-------------|-------|
| Spectrum trace on Layer 3 (visx) | SHOULD |
| Waterfall on Layer 2 (Canvas/WebGL) | SHOULD |
| Shared frequency axis across layers | MUST |
| Annotation overlay rendering | SHOULD |
| Font size minimum 12px for all labels | MUST |

---

## TSG.19.17 References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [VISX] | visx visualization primitives, https://airbnb.io/visx/ |
| [D3SCALE] | d3-scale, https://github.com/d3/d3-scale |
| [WEBGL2] | WebGL 2.0 Specification, https://www.khronos.org/webgl/ |
| [VIRIDIS] | van der Walt, S. and Smith, N., "mpl colormaps", https://bids.github.io/colormap/ |
| [TURBO] | Mikhailov, A., "Turbo, An Improved Rainbow Colormap for Visualization", Google AI Blog, 2019 |
| [EFFECT-ATOM] | tim-smart, "effect-atom", https://github.com/tim-smart/effect-atom |
| [EFFECT] | "Effect-TS", https://effect.website |
| [ADR-011] | "ADR-011: SDR Integration via GNU Radio Bridge + RTL-SDR Sidecar", Tsingou ADR |
