# Research: Spectrum Visualization Techniques

```
Research File:   Spectrum Visualization Techniques
Target Sections: TSG.19 (Spectrum Visualization)
Author:          Val (sdr-analyst)
Created:         2026-02-18
Sources:         [VIRIDIS], [P5JS], [VISX], [R3F], [OPENWEBRX], canvas API docs
```

---

## 1. Waterfall Display

### 1.1 Rendering Algorithm

The waterfall (spectrogram) displays frequency vs time with color-mapped intensity. Each horizontal row represents one FFT frame; time flows downward.

**Step-by-step rendering pipeline:**

```
1. Receive FFT magnitude array [m0, m1, ..., m_{N-1}] (dBFS values)
2. Map each magnitude to colormap index:
     index = clamp((m_i - min_dB) / (max_dB - min_dB) * 255, 0, 255)
3. Look up RGB from colormap: [R, G, B] = colormap[index]
4. Write pixel row to ImageData buffer:
     For each i in 0..N-1:
       offset = i * 4
       pixels[offset + 0] = R
       pixels[offset + 1] = G
       pixels[offset + 2] = B
       pixels[offset + 3] = 255  // Alpha
5. Scroll existing content down by 1 pixel row:
     Copy pixel block: dst(0, 1, W, H-1) ← src(0, 0, W, H-1)
6. Write new FFT row at top (y=0)
7. Draw to visible canvas: ctx.putImageData(imageData, 0, 0)
8. Overlay: frequency axis, time axis, cursor crosshair, annotations
```

### 1.2 Colormaps — RGB Lookup Tables

Each colormap maps a scalar value [0, 255] to an RGB triplet. Below are 16-point samples (full table has 256 entries):

**Viridis** (perceptually uniform, colorblind-safe):
```
Index   R    G    B
  0    68   1   84    (dark purple)
 16    72  35  116
 32    64  67  135
 48    52  94  141
 64    41  120 142
 80    32  144 140
 96    34  167 132
112    53  183 121
128    94  201  98
144   143  215  68
160   187  223  39
176   227  224  29
192   253  231  37
208   253  210  26
224   240  179  16
255   253  231  37    (bright yellow)
```

**Magma** (dark to bright, high contrast):
```
Index   R    G    B
  0     0    0    4    (near black)
 32    26   11   64
 64    89    9  110
 96   156   23  105
128   216   48   91
160   251   97   72
192   254  159   80
224   254  216  118
255   252  253  191    (cream yellow)
```

**Inferno** (warm tones):
```
Index   R    G    B
  0     0    0    4
 32    27    8   63
 64    96    3  100
 96   168   24   79
128   231   60   45
160   252  117    8
192   249  185   43
224   237  240  117
255   252  255  164
```

**Plasma** (warm to cool):
```
Index   R    G    B
  0    13    8  135
 32    84    2  163
 64   148    7  142
 96   193   35  109
128   225   72   78
160   246  116   51
192   251  164   38
224   241  211   56
255   240  249   33
```

**Jet** (classic rainbow — NOT recommended for quantitative analysis):
```
Index   R    G    B
  0     0    0  128    (dark blue)
 32     0    0  255    (blue)
 64     0  128  255    (cyan-blue)
 96     0  255  255    (cyan)
128     0  255    0    (green)
160   255  255    0    (yellow)
192   255  128    0    (orange)
224   255    0    0    (red)
255   128    0    0    (dark red)
```

**Grayscale:**
```
Index   R    G    B
  0     0    0    0    (black)
128   128  128  128    (gray)
255   255  255  255    (white)
```

### 1.3 Performance Optimization

| Technique | Impact | Implementation |
|-----------|--------|----------------|
| TypedArray pixel buffer | 2-5x faster than regular arrays | `new Uint8ClampedArray(width * height * 4)` |
| Inline colormap lookup | Avoids function call per pixel | `const r = cmap_r[idx]; const g = cmap_g[idx];` (separate arrays) |
| Avoid putImageData per row | Use ImageBitmap or batch | Accumulate N rows, draw once |
| requestAnimationFrame | Sync with display refresh | Throttle rendering to 60fps max |
| OffscreenCanvas + Worker | Move rendering off main thread | Worker computes pixels, transfers ImageBitmap |
| Double-buffering | Prevent tearing | Two canvas elements, swap visibility |
| Canvas resolution scaling | Reduce pixel count | `canvas.width = displayWidth * devicePixelRatio` (or lower for performance) |
| Pre-computed colormap LUT | O(1) per pixel | `const lut = new Uint32Array(256)` with pre-packed RGBA values |

**Pre-computed RGBA LUT technique:**
```typescript
// Pre-compute colormap as packed RGBA uint32 values
const lut = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  const [r, g, b] = viridisColormap(i)
  // Pack as ABGR (little-endian) for direct Uint32Array write
  lut[i] = (255 << 24) | (b << 16) | (g << 8) | r
}

// Apply to pixel buffer (4x fewer writes)
const pixels32 = new Uint32Array(imageData.data.buffer)
for (let i = 0; i < fftSize; i++) {
  const idx = clamp(Math.floor((mag[i] - minDB) / range * 255), 0, 255)
  pixels32[row * fftSize + i] = lut[idx]
}
```

### 1.4 Scroll Techniques

**Method 1: Canvas self-copy (fastest)**
```typescript
// Scroll down by 1 pixel
ctx.drawImage(canvas, 0, 0, width, height - 1, 0, 1, width, height - 1)
// Draw new row at top
ctx.putImageData(rowImageData, 0, 0)
```

**Method 2: Circular buffer (no copy)**
```typescript
// Maintain write pointer, draw from pointer position
let writeRow = 0
function addRow(magnitudes: Float32Array) {
  drawRowAt(writeRow, magnitudes)
  writeRow = (writeRow + 1) % height

  // When displaying, offset the canvas to create scrolling illusion
  ctx.drawImage(canvas, 0, writeRow, width, height - writeRow, 0, 0, width, height - writeRow)
  ctx.drawImage(canvas, 0, 0, width, writeRow, 0, height - writeRow, width, writeRow)
}
```

---

## 2. Spectrum Plot

### 2.1 Components

A spectrum plot shows instantaneous FFT magnitude vs frequency:

- **X-axis**: Frequency (center +- bandwidth/2), labeled in MHz
- **Y-axis**: Power (dBFS), typically -120 to 0 dBFS
- **Current trace**: Latest FFT magnitude (primary, bright line)
- **Peak hold**: Maximum value seen at each frequency bin (decays or holds)
- **Average trace**: Exponential moving average over N FFTs
- **Min hold**: Minimum value seen (shows noise floor)
- **Reference level**: User-configurable horizontal line

### 2.2 Trace Algorithms

**Peak hold (with decay):**
```typescript
const peakDecay = 0.5 // dB per frame
for (let i = 0; i < fftSize; i++) {
  if (magnitudes[i] > peakHold[i]) {
    peakHold[i] = magnitudes[i]
  } else {
    peakHold[i] -= peakDecay
  }
}
```

**Exponential moving average:**
```typescript
const alpha = 0.1 // smoothing factor (0 = no smoothing, 1 = no memory)
for (let i = 0; i < fftSize; i++) {
  average[i] = alpha * magnitudes[i] + (1 - alpha) * average[i]
}
```

**Min hold:**
```typescript
for (let i = 0; i < fftSize; i++) {
  minHold[i] = Math.min(minHold[i], magnitudes[i])
}
```

### 2.3 visx Components for Spectrum Plot

```typescript
import { LinePath, AxisBottom, AxisLeft, GridRows, GridColumns, Tooltip } from '@visx/visx'
import { scaleLinear } from '@visx/scale'

// Scales
const freqScale = scaleLinear({
  domain: [centerFreq - bandwidth/2, centerFreq + bandwidth/2],
  range: [margin.left, width - margin.right],
})

const powerScale = scaleLinear({
  domain: [minDB, maxDB],  // e.g., [-120, 0]
  range: [height - margin.bottom, margin.top],
})

// Components:
// <GridRows scale={powerScale} width={plotWidth} />
// <GridColumns scale={freqScale} height={plotHeight} />
// <LinePath data={magnitudes} x={(d,i) => freqScale(freqs[i])} y={d => powerScale(d)} />
// <AxisBottom scale={freqScale} label="Frequency (MHz)" />
// <AxisLeft scale={powerScale} label="Power (dBFS)" />
```

---

## 3. Constellation Diagram

### 3.1 Reference Constellations

**BPSK (1 bit/symbol):**
```
I/Q coordinates: (1, 0), (-1, 0)

    Q
    │
    │
────┼────►── I
 -1 │  +1
    │
```

**QPSK (2 bits/symbol):**
```
I/Q coordinates (normalized):
  (1/sqrt(2), 1/sqrt(2))    → 00
  (-1/sqrt(2), 1/sqrt(2))   → 01
  (-1/sqrt(2), -1/sqrt(2))  → 11
  (1/sqrt(2), -1/sqrt(2))   → 10

    Q
    │
 01 ● │ ● 00
    │
────┼────── I
    │
 11 ● │ ● 10
    │
```

**8PSK (3 bits/symbol):**
```
Points on unit circle at 0, 45, 90, 135, 180, 225, 270, 315 degrees:
  (cos(k*pi/4), sin(k*pi/4)) for k = 0..7
```

**16QAM (4 bits/symbol):**
```
4x4 grid, normalized by sqrt(10):
  {-3, -1, +1, +3} x {-3, -1, +1, +3} / sqrt(10)

      Q
      │
  ●  ●│ ●  ●
      │
  ●  ●│ ●  ●
──────┼────── I
  ●  ●│ ●  ●
      │
  ●  ●│ ●  ●
      │
```

**64QAM (6 bits/symbol):**
```
8x8 grid, normalized by sqrt(42):
  {-7, -5, -3, -1, +1, +3, +5, +7} x same / sqrt(42)
```

### 3.2 Quality Metrics

**EVM (Error Vector Magnitude):**
```
EVM_rms = sqrt(mean(|actual - ideal|^2)) / sqrt(mean(|ideal|^2)) * 100%
```

**MER (Modulation Error Ratio):**
```
MER = 10 * log10(mean(|ideal|^2) / mean(|actual - ideal|^2))  [dB]
```

Typical requirements:
| Modulation | Max EVM | Min MER |
|------------|---------|---------|
| BPSK | 30% | ~10 dB |
| QPSK | 17% | ~15 dB |
| 16QAM | 12.5% | ~18 dB |
| 64QAM | 8% | ~22 dB |
| 256QAM | 3.5% | ~29 dB |

### 3.3 Eye Diagram

An eye diagram overlays successive symbol periods to reveal signal quality:

```
Amplitude
    │   ╱╲    ╱╲    ╱╲
    │  ╱  ╲  ╱  ╲  ╱  ╲
    │ ╱    ╲╱    ╲╱    ╲
    ├──────────────────── time
    │ ╲    ╱╲    ╱╲    ╱
    │  ╲  ╱  ╲  ╱  ╲  ╱
    │   ╲╱    ╲╱    ╲╱

    ← 1 symbol period →
```

Measurements:
- **Eye opening (vertical)**: noise margin — larger = better
- **Eye opening (horizontal)**: timing margin — wider = less ISI
- **Jitter**: horizontal spread at crossing points
- **Rise/fall time**: slope at crossings

---

## 4. Decoded Data Display

### 4.1 ADS-B Aircraft Table

| Column | Source Field | Format | Sort | Width |
|--------|-------------|--------|------|-------|
| ICAO | `data.icao` | Hex (6 chars) | Alpha | 80px |
| Callsign | `data.callsign` | String | Alpha | 100px |
| Altitude | `data.altitude` | Number + " ft" | Numeric | 80px |
| Speed | `data.speed` | Number + " kts" | Numeric | 80px |
| Heading | `data.heading` | Number + "deg" | Numeric | 70px |
| Lat | `data.lat` | Fixed 4 decimal | Numeric | 90px |
| Lon | `data.lon` | Fixed 4 decimal | Numeric | 100px |
| V/Rate | `data.verticalRate` | Number + " ft/min" | Numeric | 90px |
| RSSI | `data.rssi` | Number + " dB" | Numeric | 60px |
| Age | computed | "Xs ago" | Numeric | 60px |

**Age-based fading:**
```typescript
const opacity = Math.max(0.3, 1.0 - (ageSeconds / maxAge))
// Row style: { opacity }
// After maxAge (e.g., 60s), remove row
```

### 4.2 AIS Vessel Table

| Column | Source Field | Format |
|--------|-------------|--------|
| MMSI | `data.mmsi` | 9-digit number |
| Name | `data.name` | String (20 chars max) |
| Type | `data.shipType` | Enum + icon |
| Lat | `data.lat` | Fixed 4 decimal |
| Lon | `data.lon` | Fixed 4 decimal |
| COG | `data.cog` | Degrees |
| SOG | `data.sog` | Knots |
| Heading | `data.heading` | Degrees |
| Nav Status | `data.navStatus` | Enum string |
| Destination | `data.destination` | String |
| Class | computed | "A" or "B" (from message type) |

Ship type icon mapping (subset):
| Code | Type | Icon |
|------|------|------|
| 30 | Fishing | fish icon |
| 60-69 | Passenger | cruise icon |
| 70-79 | Cargo | container icon |
| 80-89 | Tanker | tank icon |
| 31-32 | Towing | tug icon |
| 50 | Pilot | pilot icon |
| 52 | Tug | tug icon |
| 36 | Sailing | sail icon |
| 37 | Pleasure craft | yacht icon |

---

## 5. Performance Budgets

### 5.1 Data Rate Per Scenario

| Scenario | Device | Mode | FFT Size | Rate | NATS Msg/s | NATS KB/s |
|----------|--------|------|----------|------|-----------|-----------|
| Hobby FFT | RTL-SDR | FFT | 1024 | 10/s | 10 | ~45 |
| Hobby FFT | RTL-SDR | FFT | 2048 | 5/s | 5 | ~45 |
| Wideband FFT | HackRF | FFT | 4096 | 20/s | 20 | ~350 |
| ADS-B decoded | RTL-SDR | Decoded | N/A | ~5/s | 5 | ~5 |
| AIS decoded | RTL-SDR | Decoded | N/A | ~2/s | 2 | ~2 |
| ISM decoded | RTL-SDR | Decoded | N/A | ~1/s | 1 | ~1 |
| Raw IQ | RTL-SDR | IQ (CU8) | N/A | 2.4M/s | ~4700 | ~4700 |
| Raw IQ | HackRF | IQ (CS8) | N/A | 20M/s | ~39000 | ~39000 |

### 5.2 Memory Budget

| Component | Formula | Typical Value |
|-----------|---------|---------------|
| FFT history (waterfall) | height * fftSize * 4 bytes | 500 * 1024 * 4 = 2 MB |
| Waterfall canvas | width * height * 4 bytes (RGBA) | 1024 * 500 * 4 = 2 MB |
| Spectrum traces (4x) | 4 * fftSize * 4 bytes | 4 * 1024 * 4 = 16 KB |
| Decoded data table | maxRows * ~200 bytes/row | 1000 * 200 = 200 KB |
| Colormap LUT | 256 * 4 bytes | 1 KB |
| Total (typical) | | ~4-5 MB |

### 5.3 CPU Budget (Per Frame)

| Operation | Complexity | @ 1024 FFT | @ 4096 FFT |
|-----------|-----------|-----------|-----------|
| FFT (if client-side) | O(N log N) | ~10K ops | ~50K ops |
| Colormap | O(N) | ~1K ops | ~4K ops |
| Canvas scroll | O(W * H) | ~512K ops | ~2M ops |
| DOM table update | O(visible rows) | ~100 ops | ~100 ops |
| Total per frame | | <1 ms | ~2-3 ms |

At 60 fps budget = 16.67 ms per frame. SDR visualization overhead is well within budget for modern browsers.

### 5.4 Scaling Tiers

| Tier | Setup | NATS Traffic | Browser Load | Feasibility |
|------|-------|-------------|-------------|-------------|
| 1 (Hobby) | 1 RTL-SDR, FFT only | ~40 KB/s | Minimal | Any modern browser |
| 2 (Enthusiast) | 4 RTL-SDR array, FFT + decoded | ~200 KB/s | Low | Modern browser, 4 GB RAM |
| 3 (Professional) | 1-2 HackRF, wideband FFT | ~1 MB/s | Medium | WebWorker offloading recommended |
| 4 (USRP) | 1 USRP B210, 56 MSPS | FFT only: ~500 KB/s | Medium | FFT computed sidecar-side |
| 4b (USRP IQ) | 1 USRP B210, raw IQ | ~200 MB/s | NOT feasible via NATS | Shared memory / DPDK required |

---

## 6. Reference Implementations

### 6.1 OpenWebRX / OpenWebRX+

Architecture:
```
SDR Hardware → SoapySDR → DSP (C) → WebSocket → Browser (Canvas waterfall + audio)
```

What Tsingou learns:
- Browser-based waterfall rendering approach (canvas pixel buffer)
- WebSocket for real-time spectrum data delivery
- Multi-client SDR sharing (single device, multiple receivers via bandwidth slicing)

Where Tsingou differs:
- NATS transport (not WebSocket point-to-point)
- Effect-TS services (not raw JavaScript)
- 4-layer rendering surface (not single canvas)
- SIGINT analysis focus (not just listening)
- Multi-source fusion (not single SDR)

### 6.2 SDR++

Architecture:
```
SDR Hardware → SoapySDR → Custom DSP (C++) → ImGui/OpenGL (native UI)
```

What Tsingou learns:
- Plugin architecture for decoder modules
- High-performance FFT rendering with OpenGL
- Multi-VFO (virtual frequency oscillator) for simultaneous channel monitoring

Where Tsingou differs:
- Web-based (not native desktop)
- Analysis platform (not radio receiver application)
- Effect-TS architecture (not C++ monolith)
- Distributed processing via NATS (not single-process)

### 6.3 SigDigger

Architecture:
```
SDR Hardware → SoapySDR → Suscan DSP library (C) → Qt5 UI
```

What Tsingou learns:
- Signal analysis workflow UX (spectrum inspector, channel analyzer)
- Custom DSP library (not GNU Radio) for lower latency

Where Tsingou differs:
- Web-based, not desktop-only
- Multi-source, not single-SDR
- Service-oriented (Effect-TS layers), not monolithic

---

## 7. Tsingou 4-Layer Rendering Assignment

| SDR Visualization | Rendering Layer | z-index | Technology | Rationale |
|-------------------|----------------|---------|------------|-----------|
| 3D Signal Topology | R3F Layer | 0 | Three.js / React Three Fiber | 3D mesh, camera controls |
| Spectrum Plot | visx Layer | 1 | visx (D3-based SVG) | Precise axes, tooltips, interaction |
| Waterfall Display | p5 Layer | 2 | p5.js (Canvas) | Pixel-level rendering, scrolling |
| Constellation | p5 Layer | 2 | p5.js (Canvas) | Scatter plot, reference overlays |
| Decoded Data Tables | DOM Layer | 3 | React + AG-Grid | Tables, filtering, sorting |
| Signal Dashboard | DOM Layer | 3 | React | Sparklines, health indicators |

---

## 8. Citations

| Key | Reference |
|-----|-----------|
| [VIRIDIS] | "mpl colormaps", Matplotlib, https://matplotlib.org/stable/users/explain/colors/colormaps.html |
| [P5JS] | p5.js, https://p5js.org/ |
| [VISX] | visx by Airbnb, https://airbnb.io/visx/ |
| [R3F] | React Three Fiber, https://docs.pmnd.rs/react-three-fiber |
| [OPENWEBRX] | OpenWebRX+, https://github.com/luarvique/openwebrx |
| [SDRPP] | SDR++, https://github.com/AlexandreRouma/SDRPlusPlus |
| [SIGDIGGER] | SigDigger, https://github.com/BatchDrake/SigDigger |
| [CANVAS] | Canvas API, https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API |
| [OFFSCREEN] | OffscreenCanvas, https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas |
| [AGGRID] | AG-Grid, https://www.ag-grid.com/ |
