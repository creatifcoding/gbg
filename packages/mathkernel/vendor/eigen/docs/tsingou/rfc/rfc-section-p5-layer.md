# TSG.23: p5 Generative Layer

```
Section:       TSG.23 — p5 Generative Layer
Parent RFC:    TMNL-RFC-002 (Tsingou Signal Intelligence Visualization Platform)
Status:        DRAFT
Author:        Val (dsp-specialist)
Created:       2026-02-18
Research Base: p5.js documentation, SDR waterfall architectures, generative coding references
```

> This section specifies the p5.js generative visualization layer within Tsingou's
> 4-layer rendering surface architecture. It establishes the instance-mode integration
> pattern, generative visualization techniques (particle systems, flow fields, Perlin
> noise), real-time signal-driven animation, spectrum waterfall rendering, shader
> programming, performance budgeting, atom state integration, cross-layer compositing,
> and rendering mode selection. The p5 layer occupies Layer 2 (Canvas Generative) in
> the rendering surface stack, positioned between the R3F 3D Scene (Layer 1) and the
> visx Data Visualization (Layer 3). The key words "MUST", "MUST NOT", "SHOULD",
> "SHOULD NOT", and "MAY" are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [TSG.23.1 Layer Architecture and Position](#tsg231-layer-architecture-and-position)
2. [TSG.23.2 Instance Mode Integration](#tsg232-instance-mode-integration)
3. [TSG.23.3 Rendering Mode Selection](#tsg233-rendering-mode-selection)
4. [TSG.23.4 Generative Visualization Primitives](#tsg234-generative-visualization-primitives)
5. [TSG.23.5 Particle Systems](#tsg235-particle-systems)
6. [TSG.23.6 Flow Fields](#tsg236-flow-fields)
7. [TSG.23.7 Noise Functions and Procedural Generation](#tsg237-noise-functions-and-procedural-generation)
8. [TSG.23.8 Spectrum Waterfall Rendering](#tsg238-spectrum-waterfall-rendering)
9. [TSG.23.9 Signal-Driven Animation](#tsg239-signal-driven-animation)
10. [TSG.23.10 Shader Programming](#tsg2310-shader-programming)
11. [TSG.23.11 Atom State Integration](#tsg2311-atom-state-integration)
12. [TSG.23.12 Cross-Layer Compositing](#tsg2312-cross-layer-compositing)
13. [TSG.23.13 Performance Budget and Optimization](#tsg2313-performance-budget-and-optimization)
14. [TSG.23.14 Audio and Spectral Visualization](#tsg2314-audio-and-spectral-visualization)
15. [TSG.23.15 Creative Coding Patterns](#tsg2315-creative-coding-patterns)
16. [TSG.23.16 Accessibility and Degradation](#tsg2316-accessibility-and-degradation)
17. [TSG.23.17 Testing Patterns](#tsg2317-testing-patterns)
18. [TSG.23.18 Normative Requirements Summary](#tsg2318-normative-requirements-summary)
19. [TSG.23.19 Tsingou Integration Mapping](#tsg2319-tsingou-integration-mapping)
20. [TSG.23.20 References](#tsg2320-references)

---

## TSG.23.1 Layer Architecture and Position

### TSG.23.1.1 4-Layer Rendering Surface

Tsingou's rendering surface consists of four composited layers, each responsible for a distinct visualization concern (see TSG.20 for the full rendering surface specification):

| Layer | Technology | Purpose | Z-Order |
|-------|-----------|---------|---------|
| Layer 1 | React Three Fiber (R3F) | 3D scene, globe, spatial objects | Bottom |
| **Layer 2** | **p5.js (this section)** | **Generative visualization, waterfall, particles** | **Above R3F** |
| Layer 3 | visx (D3-based) | Statistical charts, time series, annotations | Above p5 |
| Layer 4 | DOM/React | Controls, labels, panels, text | Top |

The p5 layer is the **generative canvas** — responsible for effects, animations, and signal-driven visualizations that do not fit the structured grammar of D3-based charts (Layer 3) or the 3D scene graph (Layer 1).

### TSG.23.1.2 Layer Responsibilities

The p5 layer is responsible for:

1. **Spectrum waterfall displays** — Scrolling frequency-time plots from SDR/IQ data
2. **Signal constellation diagrams** — IQ scatter plots with real-time updates
3. **Particle-based signal flow** — Animated particles following signal paths
4. **Flow field overlays** — Vector fields driven by signal intensity or bearing data
5. **Ambient generative effects** — Background atmospheric effects (noise textures, gradient fields)
6. **Audio visualization** — FFT-driven waveforms, spectrograms, level meters
7. **Watermark and annotation overlays** — Procedural textures for classification markings

**Requirement P5L-1**: The p5 layer MUST NOT duplicate functionality available in the visx layer (Layer 3). Statistical charts, axis-labeled time series, and structured data visualizations MUST use visx. The p5 layer is reserved for generative, procedural, and signal-driven effects.

### TSG.23.1.3 Canvas Element Ownership

Each layer owns its own rendering target:

| Layer | Rendering Target | Transparency |
|-------|-----------------|-------------|
| Layer 1 (R3F) | WebGL Canvas | Opaque or transparent background |
| Layer 2 (p5) | Canvas 2D or WebGL Canvas | Transparent (alpha compositing) |
| Layer 3 (visx) | SVG or Canvas | Transparent |
| Layer 4 (DOM) | HTML elements | CSS transparency |

**Requirement P5L-2**: The p5 canvas MUST render with a transparent background to allow Layer 1 (R3F) content to show through. Opaque backgrounds on the p5 canvas are prohibited unless the p5 layer is the sole visible layer.

**Requirement P5L-3**: The p5 canvas element MUST use CSS `position: absolute` and `pointer-events: none` to prevent blocking mouse events intended for other layers. Interactive p5 elements MUST selectively enable `pointer-events: auto` on specific regions.

---

## TSG.23.2 Instance Mode Integration

### TSG.23.2.1 Global vs. Instance Mode

p5.js provides two execution modes [P5-MODES]:

| Mode | Scope | Use Case | Compatibility |
|------|-------|----------|--------------|
| **Global mode** | Functions pollute window scope | Quick prototypes | Conflicts with React |
| **Instance mode** | Namespaced under variable | Production, React integration | Required for Tsingou |

Global mode injects `setup()`, `draw()`, `mousePressed()`, and all p5 functions into the global scope. This conflicts with React's component lifecycle and creates naming collisions.

**Requirement P5L-4**: All p5.js sketches in Tsingou MUST use instance mode. Global mode is prohibited. The instance mode pattern namespaces all p5 functions under a parameter variable, preventing global scope pollution.

### TSG.23.2.2 Instance Mode Pattern

```typescript
const sketch = (p: p5) => {
  // All p5 functions accessed via 'p' parameter
  p.setup = () => {
    p.createCanvas(width, height)
    p.background(0, 0, 0, 0) // Transparent
  }

  p.draw = () => {
    p.clear() // Clear for transparency
    // Drawing operations via p.*
    p.fill(255, 100)
    p.ellipse(p.width / 2, p.height / 2, 50)
  }
}

// Mount to DOM element
const p5Instance = new p5(sketch, containerElement)
```

### TSG.23.2.3 React Integration Pattern

The p5 sketch lifecycle MUST be managed through React's component lifecycle:

```typescript
interface P5LayerProps {
  readonly width: number
  readonly height: number
  readonly sketchFactory: (p: p5) => void
  readonly className?: string
}

function P5Layer({ width, height, sketchFactory, className }: P5LayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<p5 | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Create p5 instance in instance mode
    instanceRef.current = new p5(sketchFactory, containerRef.current)

    return () => {
      // Cleanup: remove p5 instance
      instanceRef.current?.remove()
      instanceRef.current = null
    }
  }, [sketchFactory])

  // Handle resize
  useEffect(() => {
    instanceRef.current?.resizeCanvas(width, height)
  }, [width, height])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  )
}
```

**Requirement P5L-5**: The p5 instance MUST be created in a React `useEffect` hook and removed in the cleanup function. The p5 instance MUST NOT be created during component render.

**Requirement P5L-6**: The `sketchFactory` function MUST be stable across renders (wrapped in `useCallback` or defined at module level). Unstable sketch factories cause p5 instance recreation on every render.

### TSG.23.2.4 Instance Lifecycle

| React Event | p5 Action | Effect |
|-------------|-----------|--------|
| Component mount | `new p5(sketch, container)` | Canvas created, `setup()` called |
| Props change (data) | Update via closure variables | No instance recreation |
| Props change (size) | `p.resizeCanvas(w, h)` | Canvas resized, `windowResized()` called |
| Sketch factory change | Remove + recreate instance | Full reset |
| Component unmount | `instance.remove()` | Canvas destroyed, event listeners removed |

**Requirement P5L-7**: Size changes MUST use `p.resizeCanvas()` rather than instance recreation. Instance recreation causes visual flicker and state loss.

---

## TSG.23.3 Rendering Mode Selection

### TSG.23.3.1 Canvas 2D vs. WebGL

p5.js supports two rendering backends [P5-WEBGL]:

| Property | Canvas 2D | WebGL |
|----------|-----------|-------|
| Context | `CanvasRenderingContext2D` | `WebGLRenderingContext` |
| Coordinate system | Top-left origin | Center origin |
| 3D primitives | Not available | `box()`, `sphere()`, `torus()` |
| Custom shaders | Not available | `createShader()`, `shader()` |
| Texture mapping | `image()` only | `texture()` on geometry |
| Blend modes | All supported | Subset supported |
| Fill/stroke | Full support | Limited in some contexts |
| Performance ceiling | Lower (CPU-bound) | Higher (GPU-accelerated) |
| Memory overhead | Lower | Higher (GPU buffers) |

### TSG.23.3.2 Mode Selection Criteria

| Visualization Type | Required Mode | Rationale |
|-------------------|--------------|-----------|
| Spectrum waterfall | Canvas 2D | Pixel manipulation via `loadPixels()` |
| Particle systems (< 10K) | Canvas 2D | Sufficient performance, simpler code |
| Particle systems (> 10K) | WebGL | GPU acceleration required |
| Flow fields | Canvas 2D | Vector line drawing, adequate perf |
| Custom shaders | WebGL | Required for GLSL |
| 3D constellation | WebGL | 3D primitives required |
| Noise textures | Canvas 2D or WebGL | WebGL for shader-based noise |
| Watermark overlays | Canvas 2D | Simple alpha compositing |

**Requirement P5L-8**: The rendering mode MUST be selected based on the visualization's performance requirements and feature needs. Canvas 2D SHOULD be the default; WebGL MUST be used only when Canvas 2D cannot meet performance or feature requirements.

### TSG.23.3.3 Mode-Specific Initialization

```typescript
// Canvas 2D (default)
p.setup = () => {
  p.createCanvas(width, height) // 2D mode
}

// WebGL
p.setup = () => {
  p.createCanvas(width, height, p.WEBGL) // WebGL mode
  p.setAttributes('alpha', true) // Enable transparency
}
```

**Requirement P5L-9**: WebGL sketches MUST call `p.setAttributes('alpha', true)` during setup to enable alpha channel transparency for cross-layer compositing.

### TSG.23.3.4 Coordinate System Normalization

Canvas 2D uses top-left origin; WebGL uses center origin. To maintain consistent coordinate APIs across modes:

```typescript
const normalizeCoords = (p: p5, mode: 'P2D' | 'WEBGL') => ({
  toScreen: (x: number, y: number) =>
    mode === 'WEBGL'
      ? { x: x - p.width / 2, y: -(y - p.height / 2) }
      : { x, y },
  fromScreen: (x: number, y: number) =>
    mode === 'WEBGL'
      ? { x: x + p.width / 2, y: -(y - p.height / 2) }
      : { x, y },
})
```

**Requirement P5L-10**: Sketch implementations that support both rendering modes MUST normalize coordinates through a conversion layer. Direct coordinate values MUST NOT assume a specific origin convention.

---

## TSG.23.4 Generative Visualization Primitives

### TSG.23.4.1 Drawing Primitives

p5.js provides a comprehensive drawing API. The following primitives are most relevant to Tsingou's signal visualization:

| Category | Primitives | Use in Tsingou |
|----------|-----------|---------------|
| **Shape** | `point`, `line`, `rect`, `ellipse`, `arc`, `quad`, `triangle` | Signal markers, zones, regions |
| **Vertex** | `beginShape`, `vertex`, `curveVertex`, `bezierVertex`, `endShape` | Signal trajectories, waveforms |
| **Color** | `fill`, `stroke`, `colorMode`, `lerpColor` | Signal intensity mapping |
| **Transform** | `translate`, `rotate`, `scale`, `push`, `pop` | Coordinate transformations |
| **Pixel** | `loadPixels`, `updatePixels`, `pixels[]`, `set`, `get` | Waterfall, heatmap, direct manipulation |
| **Image** | `createImage`, `createGraphics`, `image` | Offscreen rendering, layer compositing |
| **Typography** | `text`, `textSize`, `textAlign` | Frequency labels, annotations |

### TSG.23.4.2 Color Modes and Mapping

Signal data maps to visual color through color modes:

```typescript
// HSB mode for signal intensity mapping
p.colorMode(p.HSB, 360, 100, 100, 100)

// Signal strength to color (blue = weak, red = strong)
const signalColor = (dbm: number, min: number, max: number) => {
  const normalized = p.map(dbm, min, max, 0, 1)
  const hue = p.lerp(240, 0, normalized) // Blue → Red
  return p.color(hue, 80, 90, 80)
}
```

**Requirement P5L-11**: Signal-to-color mapping functions MUST use `p.colorMode(p.HSB)` for perceptually uniform intensity gradients. RGB color mode MUST NOT be used for signal intensity visualization due to perceptual non-uniformity.

### TSG.23.4.3 Offscreen Graphics

For complex compositing and buffering:

```typescript
const buffer = p.createGraphics(width, height)
buffer.background(0, 0) // Transparent

// Draw to buffer
buffer.fill(255)
buffer.ellipse(x, y, size)

// Composite onto main canvas
p.image(buffer, 0, 0)
```

**Requirement P5L-12**: Persistent visual elements (waterfall history, accumulated traces) MUST use `p.createGraphics()` offscreen buffers. Redrawing accumulated history on every frame is prohibited for performance reasons.

---

## TSG.23.5 Particle Systems

### TSG.23.5.1 Particle Architecture

Particles represent individual signal events, data points, or visual effects. The particle system manages creation, update, rendering, and disposal.

```typescript
interface Particle {
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly age: number
  readonly maxAge: number
  readonly size: number
  readonly color: [number, number, number, number] // HSBA
  readonly signalStrength: number
}
```

### TSG.23.5.2 Particle Lifecycle

| Phase | Action | Trigger |
|-------|--------|---------|
| **Spawn** | Create particle with initial position, velocity, color | New signal event, periodic emission |
| **Update** | Apply velocity, forces, aging | Every `draw()` frame |
| **Render** | Draw particle at current position | Every `draw()` frame |
| **Cull** | Remove particle when expired or offscreen | Age > maxAge, out of bounds |

### TSG.23.5.3 Object Pool Pattern

Creating and garbage-collecting particles every frame causes GC pressure. Object pooling avoids this:

```typescript
class ParticlePool {
  private pool: Particle[] = []
  private active: Particle[] = []
  private readonly maxParticles: number

  constructor(maxParticles: number) {
    this.maxParticles = maxParticles
    // Pre-allocate
    for (let i = 0; i < maxParticles; i++) {
      this.pool.push(createDefaultParticle())
    }
  }

  acquire(config: ParticleConfig): Particle | null {
    if (this.pool.length === 0) return null
    const particle = this.pool.pop()!
    Object.assign(particle, config)
    this.active.push(particle)
    return particle
  }

  release(particle: Particle): void {
    const idx = this.active.indexOf(particle)
    if (idx >= 0) {
      this.active.splice(idx, 1)
      this.pool.push(particle)
    }
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]
      p.age += dt
      if (p.age >= p.maxAge) {
        this.release(p)
      } else {
        p.x += p.vx * dt
        p.y += p.vy * dt
      }
    }
  }
}
```

**Requirement P5L-13**: Particle systems with more than 100 particles MUST use object pooling. Per-frame allocation and garbage collection of particle objects is prohibited for systems exceeding 100 active particles.

**Requirement P5L-14**: The maximum particle count MUST be configurable and MUST NOT exceed the frame budget (see TSG.23.13). Particle count limits SHOULD be enforced at the pool level.

### TSG.23.5.4 Signal-Driven Particle Emission

Particles are emitted in response to signal events:

```typescript
// Signal event → particle emission
const onSignalEvent = (signal: BaseSignal) => {
  const position = signalToScreenPosition(signal)
  const color = severityToColor(signal.metadata?.severity)
  const velocity = bearingToVelocity(signal.metadata?.bearing)

  pool.acquire({
    x: position.x,
    y: position.y,
    vx: velocity.vx,
    vy: velocity.vy,
    age: 0,
    maxAge: 120, // frames
    size: signalStrengthToSize(signal.metadata?.strength),
    color,
    signalStrength: signal.metadata?.strength ?? 0,
  })
}
```

### TSG.23.5.5 Force Fields

Particles can be influenced by force fields:

| Force Type | Formula | Use Case |
|-----------|---------|----------|
| Gravity | `vy += g * dt` | Aging/decay visualization |
| Drag | `v *= (1 - drag)` | Signal attenuation |
| Attraction | `f = G * m / r^2` toward attractor | Source clustering |
| Repulsion | `f = -k / r^2` from repeller | Signal separation |
| Noise | `f = noiseField(x, y, t)` | Turbulent atmosphere |

---

## TSG.23.6 Flow Fields

### TSG.23.6.1 Flow Field Concept

A flow field is a 2D grid of force vectors that influence particle motion. In Tsingou, flow fields represent:

- **Signal bearing fields** — Vectors pointing in the direction of detected signal bearings
- **Interference patterns** — Overlapping wave fronts creating constructive/destructive zones
- **Traffic patterns** — Directional flows of entity movements (ADS-B tracks, AIS vessels)
- **Signal strength gradients** — Vectors flowing from weak to strong signal areas

### TSG.23.6.2 Flow Field Data Structure

```typescript
interface FlowField {
  readonly cols: number
  readonly rows: number
  readonly cellSize: number
  readonly vectors: Float32Array // Interleaved [angle0, magnitude0, angle1, magnitude1, ...]
}

const createFlowField = (
  width: number,
  height: number,
  cellSize: number
): FlowField => {
  const cols = Math.ceil(width / cellSize)
  const rows = Math.ceil(height / cellSize)
  return {
    cols,
    rows,
    cellSize,
    vectors: new Float32Array(cols * rows * 2),
  }
}
```

**Requirement P5L-15**: Flow field vectors MUST be stored in `Float32Array` for memory efficiency. JavaScript object arrays for flow field cells are prohibited for fields exceeding 64x64 resolution.

### TSG.23.6.3 Noise-Driven Flow Fields

Perlin noise generates smooth, continuous vector fields:

```typescript
const updateNoiseField = (field: FlowField, p: p5, time: number) => {
  const noiseScale = 0.01
  for (let y = 0; y < field.rows; y++) {
    for (let x = 0; x < field.cols; x++) {
      const idx = (y * field.cols + x) * 2
      const angle = p.noise(x * noiseScale, y * noiseScale, time * 0.005) * p.TWO_PI * 2
      field.vectors[idx] = angle
      field.vectors[idx + 1] = 1.0 // magnitude
    }
  }
}
```

### TSG.23.6.4 Signal-Driven Flow Fields

Real signal data overrides noise-generated vectors:

```typescript
const updateSignalField = (
  field: FlowField,
  signals: readonly BaseSignal[],
  p: p5
) => {
  // Reset field
  field.vectors.fill(0)

  for (const signal of signals) {
    if (!signal.metadata?.bearing || !signal.metadata?.position) continue

    const screenPos = geoToScreen(signal.metadata.position)
    const col = Math.floor(screenPos.x / field.cellSize)
    const row = Math.floor(screenPos.y / field.cellSize)

    if (col >= 0 && col < field.cols && row >= 0 && row < field.rows) {
      const idx = (row * field.cols + col) * 2
      const bearing = signal.metadata.bearing * (Math.PI / 180) // deg → rad
      const strength = signal.metadata.strength ?? 1.0

      // Accumulate bearing vectors
      field.vectors[idx] += Math.cos(bearing) * strength
      field.vectors[idx + 1] += Math.sin(bearing) * strength
    }
  }

  // Normalize accumulated vectors
  for (let i = 0; i < field.vectors.length; i += 2) {
    const magnitude = Math.hypot(field.vectors[i], field.vectors[i + 1])
    if (magnitude > 0) {
      field.vectors[i] /= magnitude
      field.vectors[i + 1] /= magnitude
    }
  }
}
```

### TSG.23.6.5 Flow Field Rendering

```typescript
const renderFlowField = (field: FlowField, p: p5, showVectors: boolean) => {
  if (!showVectors) return

  p.stroke(255, 255, 255, 40)
  p.strokeWeight(1)
  const halfCell = field.cellSize / 2

  for (let y = 0; y < field.rows; y++) {
    for (let x = 0; x < field.cols; x++) {
      const idx = (y * field.cols + x) * 2
      const angle = Math.atan2(field.vectors[idx + 1], field.vectors[idx])
      const magnitude = Math.hypot(field.vectors[idx], field.vectors[idx + 1])

      if (magnitude < 0.01) continue

      const cx = x * field.cellSize + halfCell
      const cy = y * field.cellSize + halfCell
      const len = halfCell * 0.8 * magnitude

      p.push()
      p.translate(cx, cy)
      p.rotate(angle)
      p.line(0, 0, len, 0)
      // Arrowhead
      p.line(len, 0, len - 4, -3)
      p.line(len, 0, len - 4, 3)
      p.pop()
    }
  }
}
```

---

## TSG.23.7 Noise Functions and Procedural Generation

### TSG.23.7.1 Perlin Noise in p5.js

p5's `noise()` function returns values sampled from Perlin noise space [P5-NOISE]:

```typescript
// 1D noise — time-varying value
const value1D = p.noise(time * 0.01) // Range: [0, 1]

// 2D noise — spatial texture
const value2D = p.noise(x * scale, y * scale)

// 3D noise — animated spatial texture
const value3D = p.noise(x * scale, y * scale, time * 0.005)
```

| Dimension | Parameters | Use Case |
|-----------|-----------|----------|
| 1D | `noise(t)` | Time-varying signal jitter |
| 2D | `noise(x, y)` | Static texture, terrain |
| 3D | `noise(x, y, t)` | Animated texture, flow field |
| 4D | `noise(x, y, z, t)` | 3D animated texture (requires custom implementation) |

### TSG.23.7.2 Noise Configuration

```typescript
// Set noise detail (octaves, falloff)
p.noiseDetail(4, 0.5)
// 4 octaves: fine detail
// 0.5 falloff: each octave contributes half the amplitude

// Seed for reproducibility
p.noiseSeed(42)
```

| Parameter | Effect | Signal Visualization Use |
|-----------|--------|--------------------------|
| Octaves (1-8) | Detail complexity | Low for smooth gradients, high for turbulent textures |
| Falloff (0-1) | Amplitude reduction per octave | Low for smooth, high for rough |
| Seed | Reproducibility | Deterministic backgrounds for testing |

**Requirement P5L-16**: Noise-driven visualizations MUST set `p.noiseDetail()` explicitly. Relying on default noise parameters produces unpredictable visual quality across p5 versions.

### TSG.23.7.3 Noise-Based Signal Visualization

**Signal jitter** — Adding organic movement to signal markers:

```typescript
const jitteredX = signalX + (p.noise(signalId * 100, frameCount * 0.02) - 0.5) * jitterAmount
const jitteredY = signalY + (p.noise(signalId * 200, frameCount * 0.02) - 0.5) * jitterAmount
```

**Interference patterns** — Overlapping noise fields:

```typescript
const interference = (x: number, y: number, sources: readonly Point[]) => {
  let sum = 0
  for (const source of sources) {
    const dist = Math.hypot(x - source.x, y - source.y)
    sum += Math.sin(dist * 0.1 + frameCount * 0.05) * source.amplitude
  }
  return sum / sources.length
}
```

### TSG.23.7.4 Procedural Texture Generation

For background atmospherics and classification watermarks:

```typescript
const generateNoiseTexture = (p: p5, w: number, h: number, scale: number) => {
  const buffer = p.createGraphics(w, h)
  buffer.loadPixels()

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = p.noise(x * scale, y * scale)
      const brightness = Math.floor(n * 255)
      const idx = (y * w + x) * 4
      buffer.pixels[idx] = brightness
      buffer.pixels[idx + 1] = brightness
      buffer.pixels[idx + 2] = brightness
      buffer.pixels[idx + 3] = Math.floor(n * 40) // Low alpha for subtlety
    }
  }

  buffer.updatePixels()
  return buffer
}
```

**Requirement P5L-17**: Procedural textures that do not change per frame MUST be generated once during `setup()` or on parameter change and cached as `p5.Graphics` objects. Per-frame regeneration of static textures is prohibited.

---

## TSG.23.8 Spectrum Waterfall Rendering

### TSG.23.8.1 Waterfall Display Architecture

The spectrum waterfall is the primary SDR visualization in Tsingou. It displays frequency-domain data as a scrolling time-frequency heatmap [OPENWEBRX-WATERFALL]:

```
         Frequency →
     ┌──────────────────────┐
     │ ████████░░████░░██░░ │ ← Current FFT frame (newest)
  T  │ ██████░░░████░░░██░░ │
  i  │ █████░░░░████░░░██░░ │
  m  │ ████░░░░░████░░░██░░ │
  e  │ ███░░░░░░████░░░██░░ │
  ↓  │ ██░░░░░░░████░░░██░░ │ ← Oldest visible frame
     └──────────────────────┘
```

Each row represents one FFT frame. Each pixel's color maps to signal amplitude at that frequency bin.

### TSG.23.8.2 Waterfall Data Pipeline

```
IQ Samples → FFT → Magnitude (dB) → Color Map → Pixel Row → Canvas Scroll
```

| Stage | Input | Output | Timing |
|-------|-------|--------|--------|
| IQ Samples | `Float32Array` (I/Q pairs) | Complex samples | From SDR via NATS |
| FFT | Complex samples | Complex spectrum | Per FFT frame |
| Magnitude | Complex spectrum | `Float32Array` (dB values) | Per FFT frame |
| Color Map | dB values | RGBA pixel row | Per FFT frame |
| Pixel Row | RGBA pixels | Canvas row update | Per `draw()` frame |
| Canvas Scroll | Full canvas | Shifted canvas + new row | Per `draw()` frame |

### TSG.23.8.3 Scrolling Implementation

Two approaches for waterfall scrolling:

**Approach A — Canvas Shift (simple, moderate performance)**:

```typescript
const waterfallBuffer = p.createGraphics(fftSize, historyDepth)

const addWaterfallRow = (fftData: Float32Array, colorMap: ColorMap) => {
  // Shift existing content down by 1 pixel
  const img = waterfallBuffer.get()
  waterfallBuffer.image(img, 0, 1)

  // Draw new row at top
  waterfallBuffer.loadPixels()
  for (let i = 0; i < fftData.length; i++) {
    const color = colorMap.map(fftData[i])
    const idx = i * 4
    waterfallBuffer.pixels[idx] = color[0]     // R
    waterfallBuffer.pixels[idx + 1] = color[1] // G
    waterfallBuffer.pixels[idx + 2] = color[2] // B
    waterfallBuffer.pixels[idx + 3] = 255      // A
  }
  waterfallBuffer.updatePixels()
}
```

**Approach B — Ring Buffer (high performance)**:

```typescript
class WaterfallRingBuffer {
  private buffer: Uint8ClampedArray
  private writeRow: number = 0
  private readonly width: number
  private readonly height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.buffer = new Uint8ClampedArray(width * height * 4)
  }

  addRow(fftData: Float32Array, colorMap: ColorMap): void {
    const offset = this.writeRow * this.width * 4
    for (let i = 0; i < this.width && i < fftData.length; i++) {
      const color = colorMap.map(fftData[i])
      const idx = offset + i * 4
      this.buffer[idx] = color[0]
      this.buffer[idx + 1] = color[1]
      this.buffer[idx + 2] = color[2]
      this.buffer[idx + 3] = 255
    }
    this.writeRow = (this.writeRow + 1) % this.height
  }

  render(p: p5): void {
    // Render in two segments: writeRow to end, then start to writeRow
    const imgData = new ImageData(this.buffer, this.width, this.height)
    // ... blit to canvas with appropriate offset
  }
}
```

**Requirement P5L-18**: Spectrum waterfall displays with more than 256 rows of history MUST use the ring buffer approach. Canvas shift operations on large buffers exceed the frame budget.

**Requirement P5L-19**: Waterfall row insertion MUST use `loadPixels()` / `updatePixels()` for direct pixel manipulation. Drawing individual `point()` calls per frequency bin is prohibited.

### TSG.23.8.4 Color Maps

Standard SDR color maps for signal amplitude visualization:

| Color Map | Range | Use Case |
|-----------|-------|----------|
| **Iron** | Black → Blue → Purple → Red → Yellow → White | General spectrum |
| **Viridis** | Purple → Blue → Teal → Green → Yellow | Perceptually uniform |
| **Hot** | Black → Red → Yellow → White | High-contrast signals |
| **Cool** | Cyan → Magenta | Low-amplitude detail |
| **Grayscale** | Black → White | Print-friendly |

```typescript
interface ColorMap {
  readonly name: string
  readonly map: (dbValue: number) => readonly [number, number, number] // RGB
  readonly range: readonly [number, number] // [minDb, maxDb]
}

const ironColorMap: ColorMap = {
  name: 'iron',
  range: [-120, 0], // dBFS
  map: (db) => {
    const t = Math.max(0, Math.min(1, (db - (-120)) / 120))
    // Interpolate through iron palette stops
    if (t < 0.2) return lerpRGB([0, 0, 0], [0, 0, 128], t / 0.2)
    if (t < 0.4) return lerpRGB([0, 0, 128], [128, 0, 128], (t - 0.2) / 0.2)
    if (t < 0.6) return lerpRGB([128, 0, 128], [255, 0, 0], (t - 0.4) / 0.2)
    if (t < 0.8) return lerpRGB([255, 0, 0], [255, 255, 0], (t - 0.6) / 0.2)
    return lerpRGB([255, 255, 0], [255, 255, 255], (t - 0.8) / 0.2)
  },
}
```

**Requirement P5L-20**: Color maps MUST be configurable at runtime. Hardcoded color maps are prohibited. At least three color map options MUST be available: iron (default), viridis (perceptually uniform), and grayscale (accessibility).

### TSG.23.8.5 Waterfall Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Row insertion time | < 2ms | `performance.now()` around `addRow()` |
| Render time | < 4ms | `performance.now()` around `render()` |
| Memory usage | < 50MB per waterfall | Width x Height x 4 bytes |
| FFT frame rate | 10-60 fps | Matches SDR sample rate / FFT size |

---

## TSG.23.9 Signal-Driven Animation

### TSG.23.9.1 Signal-to-Visual Mapping

Signal data from the Tsingou pipeline drives visual parameters:

| Signal Property | Visual Parameter | Mapping |
|----------------|-----------------|---------|
| `strength` (dBm) | Particle size, brightness | Linear or logarithmic |
| `bearing` (degrees) | Particle velocity direction | Direct angle mapping |
| `frequency` (Hz) | Color hue | Frequency → hue wheel |
| `bandwidth` (Hz) | Element width | Proportional |
| `modulation` type | Shape or texture | Categorical |
| `confidence` (0-1) | Alpha opacity | Direct |
| `timestamp` | Position on time axis | Temporal mapping |
| `position` (lat/lon) | Screen coordinates | Geo projection |

### TSG.23.9.2 Animation Frame Synchronization

p5's `draw()` loop runs at the display refresh rate (typically 60fps). Signal data arrives asynchronously from NATS streams. These must be synchronized:

```typescript
let pendingSignals: BaseSignal[] = []
let lastProcessedTimestamp = 0

// Async: Signal arrives from atom subscription
const onSignalBatch = (signals: readonly BaseSignal[]) => {
  pendingSignals = [...signals] // Copy to prevent mutation
}

// Sync: p5 draw loop consumes pending signals
p.draw = () => {
  // Process pending signals
  for (const signal of pendingSignals) {
    if (signal.timestamp > lastProcessedTimestamp) {
      emitParticle(signal)
      lastProcessedTimestamp = signal.timestamp
    }
  }
  pendingSignals = []

  // Update and render
  particlePool.update(1 / 60)
  particlePool.render(p)
}
```

**Requirement P5L-21**: Signal data ingestion MUST be decoupled from the `draw()` loop via a buffer. The `draw()` function MUST NOT perform I/O operations, Effect execution, or atom reads that could block.

**Requirement P5L-22**: Signal data MUST be copied into the p5 sketch's local state before consumption. Direct references to atom state objects from within `draw()` are prohibited to prevent concurrent modification.

### TSG.23.9.3 Temporal Smoothing

Signal events arrive in bursts. Visual transitions should be smooth:

```typescript
const lerp = (current: number, target: number, factor: number) =>
  current + (target - current) * factor

class SmoothedValue {
  private current: number
  private target: number
  private readonly smoothFactor: number

  constructor(initial: number, smoothFactor: number = 0.1) {
    this.current = initial
    this.target = initial
    this.smoothFactor = smoothFactor
  }

  setTarget(value: number): void {
    this.target = value
  }

  update(): number {
    this.current = lerp(this.current, this.target, this.smoothFactor)
    return this.current
  }
}
```

**Requirement P5L-23**: Visual parameters driven by discrete signal events SHOULD use temporal smoothing (exponential interpolation) to prevent visual discontinuities. The smoothing factor MUST be configurable.

---

## TSG.23.10 Shader Programming

### TSG.23.10.1 Shader Architecture

p5.js WebGL mode supports custom GLSL shaders [P5-SHADERS]:

```typescript
let myShader: p5.Shader

p.preload = () => {
  myShader = p.loadShader('vertex.vert', 'fragment.frag')
}

p.setup = () => {
  p.createCanvas(width, height, p.WEBGL)
}

p.draw = () => {
  p.shader(myShader)
  myShader.setUniform('u_time', p.millis() / 1000.0)
  myShader.setUniform('u_resolution', [p.width, p.height])
  myShader.setUniform('u_signalData', signalTexture)
  p.rect(0, 0, p.width, p.height)
}
```

### TSG.23.10.2 Vertex Shader

The vertex shader positions geometry:

```glsl
// vertex.vert — Standard pass-through for 2D
attribute vec3 aPosition;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0; // Normalize to [-1, 1]
  gl_Position = positionVec4;
}
```

### TSG.23.10.3 Fragment Shader Examples

**Signal heatmap shader**:

```glsl
// heatmap.frag
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_signalTexture; // 1D texture: frequency → amplitude
uniform float u_minDb;
uniform float u_maxDb;

varying vec2 vTexCoord;

vec3 ironColorMap(float t) {
  if (t < 0.2) return mix(vec3(0.0), vec3(0.0, 0.0, 0.5), t / 0.2);
  if (t < 0.4) return mix(vec3(0.0, 0.0, 0.5), vec3(0.5, 0.0, 0.5), (t - 0.2) / 0.2);
  if (t < 0.6) return mix(vec3(0.5, 0.0, 0.5), vec3(1.0, 0.0, 0.0), (t - 0.4) / 0.2);
  if (t < 0.8) return mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.6) / 0.2);
  return mix(vec3(1.0, 1.0, 0.0), vec3(1.0), (t - 0.8) / 0.2);
}

void main() {
  float amplitude = texture2D(u_signalTexture, vec2(vTexCoord.x, 0.5)).r;
  float normalized = clamp((amplitude - u_minDb) / (u_maxDb - u_minDb), 0.0, 1.0);
  vec3 color = ironColorMap(normalized);
  gl_FragColor = vec4(color, normalized * 0.8 + 0.2);
}
```

### TSG.23.10.4 Shader Uniform Types

| Uniform Type | GLSL Type | p5 Method | Example |
|-------------|-----------|-----------|---------|
| Scalar | `float` | `setUniform('name', value)` | Time, amplitude |
| Vector2 | `vec2` | `setUniform('name', [x, y])` | Resolution |
| Vector3 | `vec3` | `setUniform('name', [r, g, b])` | Color |
| Texture | `sampler2D` | `setUniform('name', texture)` | Signal data |
| Array | `float[N]` | `setUniform('name', array)` | FFT bins (limited) |

**Requirement P5L-24**: Custom shaders MUST be loaded via `p.loadShader()` from separate `.vert`/`.frag` files or via `p.createShader()` with string literals defined at module level. Inline shader strings within `draw()` are prohibited.

**Requirement P5L-25**: Signal data passed to shaders as textures MUST use `p.createImage()` or `p.createGraphics()` as texture sources. Raw `Float32Array` data MUST be packed into texture RGBA channels before upload.

---

## TSG.23.11 Atom State Integration

### TSG.23.11.1 Data Flow

Signal data flows from Effect services through atoms to the p5 sketch:

```
NATS Stream → Effect Service → Atom.set() → useAtomValue() → p5 sketch closure
```

### TSG.23.11.2 React-to-p5 Data Bridge

The React component subscribes to atoms and passes data to the p5 sketch via closure variables:

```typescript
function SignalWaterfall() {
  const fftData = useAtomValue(fftDataAtom)
  const colorMap = useAtomValue(waterfallColorMapAtom)
  const config = useAtomValue(waterfallConfigAtom)

  // Stable reference for p5 to read
  const dataRef = useRef({ fftData, colorMap, config })
  dataRef.current = { fftData, colorMap, config }

  const sketchFactory = useCallback((p: p5) => {
    let waterfall: WaterfallRingBuffer

    p.setup = () => {
      p.createCanvas(config.width, config.height)
      waterfall = new WaterfallRingBuffer(config.fftSize, config.historyDepth)
    }

    p.draw = () => {
      const { fftData, colorMap } = dataRef.current
      if (fftData) {
        waterfall.addRow(fftData, colorMap)
      }
      p.clear()
      waterfall.render(p)
    }
  }, []) // Empty deps — sketch factory is stable

  return <P5Layer width={config.width} height={config.height} sketchFactory={sketchFactory} />
}
```

**Requirement P5L-26**: The p5 sketch MUST access atom data through `useRef` bridges, not through direct `useAtomValue` calls inside the sketch. The sketch closure captures the ref, which is updated by React on each render.

**Requirement P5L-27**: The `sketchFactory` callback MUST be stable (empty `useCallback` dependencies or module-level definition). Unstable factories destroy and recreate the p5 instance on every React render.

### TSG.23.11.3 p5-to-Atom Feedback

For interactive p5 elements that produce data (e.g., user-drawn frequency selection):

```typescript
// Module-level atoms
const selectedFrequencyRangeAtom = Atom.make<[number, number] | null>(null)

// Inside sketch — use registry for sync writes
const registry = useRegistry()

const sketchFactory = useCallback((p: p5) => {
  let dragStart: number | null = null

  p.mousePressed = () => {
    if (p.mouseY < 0 || p.mouseY > p.height) return
    dragStart = p.mouseX
  }

  p.mouseReleased = () => {
    if (dragStart !== null) {
      const freqRange = screenToFrequencyRange(dragStart, p.mouseX)
      registry.set(selectedFrequencyRangeAtom, freqRange) // Sync write
      dragStart = null
    }
  }
}, [registry])
```

**Requirement P5L-28**: p5 sketch interactions that update atom state MUST use `registry.set()` (synchronous) not `Atom.set()` (returns Effect). Effect execution inside p5 event handlers is prohibited.

---

## TSG.23.12 Cross-Layer Compositing

### TSG.23.12.1 Layer Stack Compositing Order

```
     ┌────────────────────┐
  4  │ DOM Control Layer   │ ← Highest z-index
     ├────────────────────┤
  3  │ visx Data Layer     │
     ├────────────────────┤
  2  │ p5 Generative Layer │ ← This section
     ├────────────────────┤
  1  │ R3F 3D Scene Layer  │ ← Lowest z-index
     └────────────────────┘
```

### TSG.23.12.2 CSS Stacking

```css
.rendering-surface {
  position: relative;
  width: 100%;
  height: 100%;
}

.layer-r3f { position: absolute; z-index: 1; }
.layer-p5 { position: absolute; z-index: 2; pointer-events: none; }
.layer-visx { position: absolute; z-index: 3; pointer-events: none; }
.layer-dom { position: absolute; z-index: 4; }
```

### TSG.23.12.3 Transparency Requirements

For Layer 2 to composite correctly over Layer 1:

1. p5 canvas background MUST be transparent (`p.clear()` each frame)
2. p5 elements MUST use appropriate alpha values
3. Blend modes MUST be compatible with alpha compositing

```typescript
p.draw = () => {
  p.clear() // Transparent background — required for compositing
  // Draw elements with alpha
  p.fill(255, 0, 0, 128) // 50% alpha red
  p.noStroke()
  p.ellipse(x, y, 20)
}
```

**Requirement P5L-29**: The p5 `draw()` function MUST call `p.clear()` at the start of each frame to reset the canvas to fully transparent. Using `p.background()` with an opaque color blocks underlying layers.

### TSG.23.12.4 Cross-Layer Coordinate Alignment

All four layers share the same viewport dimensions. Coordinates MUST be aligned:

```typescript
// Shared viewport dimensions from container
const viewportWidth = containerRef.current.clientWidth
const viewportHeight = containerRef.current.clientHeight

// All layers use identical dimensions
// R3F: camera aspect ratio = viewportWidth / viewportHeight
// p5: p.createCanvas(viewportWidth, viewportHeight)
// visx: <svg width={viewportWidth} height={viewportHeight}>
// DOM: style={{ width: viewportWidth, height: viewportHeight }}
```

**Requirement P5L-30**: All layers MUST use the same viewport dimensions. The p5 canvas MUST resize to match the rendering surface container via `ResizeObserver` or parent dimension tracking.

### TSG.23.12.5 Blend Modes for Compositing

p5's blend modes affect how the p5 canvas composites with underlying layers [P5-BLEND]:

| Blend Mode | Effect | Use Case |
|-----------|--------|----------|
| `BLEND` (default) | Normal alpha compositing | Standard overlays |
| `ADD` | Additive blending | Glow effects, signal peaks |
| `MULTIPLY` | Darkening blend | Shadow overlays |
| `SCREEN` | Lightening blend | Light effects |
| `OVERLAY` | Contrast enhancement | Signal highlighting |

**Requirement P5L-31**: Blend mode changes MUST be scoped with `p.push()`/`p.pop()`. Global blend mode changes affect the entire canvas and can produce unexpected interactions with cross-layer compositing.

---

## TSG.23.13 Performance Budget and Optimization

### TSG.23.13.1 Frame Budget

At 60fps, each frame has a 16.67ms budget. The p5 layer MUST NOT consume the entire budget:

| Component | Budget | Purpose |
|-----------|--------|---------|
| R3F (Layer 1) | 6ms | 3D scene rendering |
| **p5 (Layer 2)** | **4ms** | **Generative visualization** |
| visx (Layer 3) | 2ms | Data chart updates |
| DOM (Layer 4) | 2ms | Control panel updates |
| Browser | 2.67ms | Compositing, layout, paint |

**Requirement P5L-32**: The p5 `draw()` function MUST complete within 4ms at 60fps. Implementations MUST measure `draw()` duration and shed work when exceeding the budget.

### TSG.23.13.2 Performance Monitoring

```typescript
let frameTimeAccumulator = 0
let frameCount = 0

p.draw = () => {
  const startTime = performance.now()

  // ... drawing operations ...

  const elapsed = performance.now() - startTime
  frameTimeAccumulator += elapsed
  frameCount++

  if (frameCount >= 60) {
    const avgFrameTime = frameTimeAccumulator / frameCount
    if (avgFrameTime > 4.0) {
      // Reduce quality: fewer particles, lower resolution, skip effects
      adaptQuality(avgFrameTime)
    }
    frameTimeAccumulator = 0
    frameCount = 0
  }
}
```

### TSG.23.13.3 Adaptive Quality

When frame budget is exceeded, the system reduces visual quality:

| Quality Level | Particles | Waterfall Res | Flow Field | Effects |
|--------------|-----------|--------------|------------|---------|
| **High** | 10,000 | Full resolution | 128x128 | All enabled |
| **Medium** | 5,000 | 1/2 resolution | 64x64 | Reduce noise octaves |
| **Low** | 2,000 | 1/4 resolution | 32x32 | Disable flow field |
| **Minimal** | 500 | 1/8 resolution | Disabled | Essential only |

**Requirement P5L-33**: The p5 layer MUST implement adaptive quality reduction. When average frame time exceeds the 4ms budget for 60 consecutive frames, the quality level MUST be reduced. Quality SHOULD recover when average frame time drops below 3ms.

### TSG.23.13.4 Optimization Techniques

| Technique | Impact | When to Apply |
|-----------|--------|--------------|
| **Object pooling** | Eliminates GC pauses | > 100 particles |
| **Spatial hashing** | Reduces collision checks from O(n^2) to O(n) | > 500 interacting particles |
| **Offscreen buffers** | Avoids redrawing static content | Waterfall, accumulated traces |
| **requestAnimationFrame alignment** | Prevents dropped frames | Always (p5 does this internally) |
| **TypedArray storage** | Reduced memory, faster iteration | Flow fields, pixel buffers |
| **Canvas 2D over WebGL** | Lower overhead for simple drawing | < 10K draw calls |
| **buildGeometry()** | Caches static geometry (WebGL) | Reused 3D shapes |
| **Reduced noise octaves** | Faster noise() calls | Under frame pressure |
| **Frame skipping** | Halves render load | Extreme budget pressure |

**Requirement P5L-34**: TypedArrays (`Float32Array`, `Uint8ClampedArray`) MUST be used for bulk numerical data (flow field vectors, pixel buffers, FFT bins). JavaScript arrays of numbers are prohibited for datasets exceeding 1,000 elements.

---

## TSG.23.14 Audio and Spectral Visualization

### TSG.23.14.1 p5.FFT Integration

p5.sound's FFT analyzer provides frequency and waveform data [P5-FFT]:

```typescript
let fft: p5.FFT

p.setup = () => {
  fft = new p5.FFT(0.8, 1024) // smoothing=0.8, bins=1024
}

p.draw = () => {
  const spectrum = fft.analyze()   // Uint8Array[1024], 0-255
  const waveform = fft.waveform()  // Float32Array[1024], -1 to 1

  // Render spectrum bars
  p.noStroke()
  const barWidth = p.width / spectrum.length
  for (let i = 0; i < spectrum.length; i++) {
    const amplitude = spectrum[i]
    p.fill(amplitude, 100, 255 - amplitude)
    p.rect(i * barWidth, p.height - amplitude, barWidth, amplitude)
  }
}
```

### TSG.23.14.2 External FFT Data

For SDR-derived FFT data (not browser audio), the p5 layer receives pre-computed FFT bins via atoms:

```typescript
// Atom receives FFT data from Effect service
const fftBinsAtom = Atom.make<Float32Array | null>(null)

// p5 renders from atom data, not from p5.FFT
p.draw = () => {
  const bins = dataRef.current.fftBins
  if (!bins) return

  // Render using same visualization techniques
  renderSpectrumBars(p, bins, colorMap)
}
```

**Requirement P5L-35**: SDR-derived spectral data MUST be consumed from atoms, not from `p5.FFT`. The `p5.FFT` object is for browser-local audio analysis only. SDR FFT data arrives pre-computed from the signal pipeline via NATS.

### TSG.23.14.3 Waveform Display

```typescript
const renderWaveform = (p: p5, samples: Float32Array) => {
  p.stroke(0, 255, 128, 200)
  p.strokeWeight(1)
  p.noFill()

  p.beginShape()
  for (let i = 0; i < samples.length; i++) {
    const x = p.map(i, 0, samples.length, 0, p.width)
    const y = p.map(samples[i], -1, 1, p.height * 0.8, p.height * 0.2)
    p.vertex(x, y)
  }
  p.endShape()
}
```

### TSG.23.14.4 Spectrogram (2D FFT History)

The spectrogram is the visual representation of the waterfall data (see TSG.23.8):

| Parameter | Typical Value | Configurable |
|-----------|-------------|-------------|
| FFT size | 1024, 2048, 4096 | Yes |
| Window function | Hann, Blackman-Harris | Yes |
| Overlap | 50%, 75% | Yes |
| Color map | Iron, Viridis | Yes |
| History depth | 256-1024 rows | Yes |
| dB range | -120 to 0 dBFS | Yes |

---

## TSG.23.15 Creative Coding Patterns

### TSG.23.15.1 Organic Motion

Natural-looking motion for signal visualization:

```typescript
// Lissajous curves for signal marker orbits
const lissajousX = (t: number, a: number, phaseX: number) =>
  Math.sin(a * t + phaseX)

const lissajousY = (t: number, b: number, phaseY: number) =>
  Math.sin(b * t + phaseY)

// Bezier curves for signal trajectories
p.bezier(
  source.x, source.y,
  control1.x, control1.y,
  control2.x, control2.y,
  target.x, target.y
)
```

### TSG.23.15.2 Emergent Patterns

Emergent visual patterns from simple rules:

| Pattern | Rule | Signal Application |
|---------|------|-------------------|
| **Flocking** (Boids) | Separation + Alignment + Cohesion | Signal cluster visualization |
| **Reaction-Diffusion** | Chemical diffusion + reaction | Signal propagation modeling |
| **Cellular Automata** | Neighbor-based state transitions | Spatial coverage mapping |
| **L-Systems** | Recursive string rewriting | Hierarchical network display |
| **Strange Attractors** | Iterative chaotic equations | Signal attractor basins |

### TSG.23.15.3 Classification Watermarks

Procedural watermarks for document classification:

```typescript
const renderClassificationBanner = (
  p: p5,
  classification: 'UNCLASSIFIED' | 'CUI' | 'SECRET' | 'TOP SECRET'
) => {
  const colors = {
    UNCLASSIFIED: [0, 128, 0],    // Green
    CUI: [128, 0, 128],           // Purple
    SECRET: [255, 0, 0],          // Red
    'TOP SECRET': [255, 165, 0],  // Orange
  }

  const [r, g, b] = colors[classification]
  p.fill(r, g, b, 200)
  p.noStroke()
  p.rect(0, 0, p.width, 24)

  p.fill(255)
  p.textAlign(p.CENTER, p.CENTER)
  p.textSize(14) // Minimum 12px floor enforced
  p.text(classification, p.width / 2, 12)
}
```

**Requirement P5L-36**: Text rendered by p5.js MUST observe the 12px minimum font size. `p.textSize()` values below 12 are prohibited.

---

## TSG.23.16 Accessibility and Degradation

### TSG.23.16.1 Graceful Degradation

When p5.js is unavailable or WebGL fails:

| Failure | Detection | Fallback |
|---------|-----------|----------|
| p5.js not loaded | Module import check | Static SVG placeholder |
| WebGL not supported | `p.WEBGL` canvas creation fails | Canvas 2D mode |
| Canvas 2D not supported | `getContext('2d')` returns null | DOM-based fallback |
| Performance too low | Adaptive quality reaches minimum | Disable p5 layer entirely |

**Requirement P5L-37**: The rendering surface MUST function without the p5 layer. If p5 initialization fails, the other three layers (R3F, visx, DOM) MUST continue operating. The p5 layer failure MUST NOT block the application.

### TSG.23.16.2 Color Accessibility

For color-deficient users:

**Requirement P5L-38**: Signal visualizations MUST NOT rely solely on color to convey information. Color MUST be supplemented with shape, size, animation, or pattern differences. The viridis color map SHOULD be the default for perceptual uniformity and colorblind accessibility.

### TSG.23.16.3 Motion Sensitivity

**Requirement P5L-39**: Implementations MUST respect the `prefers-reduced-motion` media query. When reduced motion is preferred, particle animations SHOULD be replaced with static markers, flow field animations SHOULD be frozen, and waterfall scrolling SHOULD use discrete steps rather than smooth scrolling.

```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

p.draw = () => {
  if (prefersReducedMotion) {
    renderStaticVisualization(p) // No animation
  } else {
    renderAnimatedVisualization(p)
  }
}
```

### TSG.23.16.4 Screen Reader Compatibility

Canvas elements are opaque to screen readers. For critical information rendered on the p5 canvas:

**Requirement P5L-40**: The p5 canvas element MUST include an `aria-label` describing its content. Critical data displayed only on the p5 canvas (e.g., signal count, waterfall frequency range) MUST be duplicated in the DOM layer (Layer 4) for screen reader access.

---

## TSG.23.17 Testing Patterns

### TSG.23.17.1 Unit Testing Sketch Logic

Sketch logic (particle physics, flow field math, color mapping) should be extracted into pure functions testable without p5:

```typescript
// Extractable pure functions
export const signalToColor = (strength: number, range: [number, number]): RGBA => { ... }
export const applyForce = (particle: Particle, force: Vector2): Particle => { ... }
export const noiseFieldAt = (x: number, y: number, t: number, scale: number): number => { ... }

// Test without p5
describe('signalToColor', () => {
  it('maps minimum strength to blue', () => {
    expect(signalToColor(-120, [-120, 0])).toEqual([0, 0, 128, 255])
  })
})
```

**Requirement P5L-41**: Computationally significant sketch logic (physics, color mapping, data transformation) MUST be extracted into pure functions testable without p5 instance. Tests MUST NOT require canvas creation.

### TSG.23.17.2 Visual Regression Testing

For waterfall and particle renderings:

```typescript
// Deterministic setup for regression tests
p.noiseSeed(42)
p.randomSeed(42)

// Known input → known visual output
const testFFTData = Float32Array.from({ length: 1024 }, (_, i) =>
  -120 + Math.sin(i / 100) * 60
)
```

**Requirement P5L-42**: Visual regression tests MUST use fixed random seeds (`p.noiseSeed`, `p.randomSeed`) for deterministic output. Non-deterministic visual tests provide no regression value.

### TSG.23.17.3 Performance Testing

```typescript
describe('waterfall performance', () => {
  it('addRow completes within 2ms for 4096 bins', () => {
    const waterfall = new WaterfallRingBuffer(4096, 512)
    const fftData = new Float32Array(4096)
    const colorMap = ironColorMap

    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      waterfall.addRow(fftData, colorMap)
    }
    const elapsed = (performance.now() - start) / 100

    expect(elapsed).toBeLessThan(2.0) // ms per row
  })
})
```

---

## TSG.23.18 Normative Requirements Summary

### MUST Requirements

| ID | Section | Requirement |
|----|---------|-------------|
| P5L-1 | 23.1.2 | p5 layer MUST NOT duplicate visx functionality |
| P5L-2 | 23.1.3 | p5 canvas MUST render with transparent background |
| P5L-3 | 23.1.3 | p5 canvas MUST use pointer-events: none |
| P5L-4 | 23.2.1 | All p5 sketches MUST use instance mode |
| P5L-5 | 23.2.3 | p5 instance MUST be created in useEffect |
| P5L-7 | 23.2.4 | Size changes MUST use resizeCanvas() |
| P5L-8 | 23.3.2 | Rendering mode MUST match performance requirements |
| P5L-9 | 23.3.3 | WebGL MUST enable alpha channel |
| P5L-10 | 23.3.4 | Dual-mode sketches MUST normalize coordinates |
| P5L-11 | 23.4.2 | Signal-to-color MUST use HSB color mode |
| P5L-12 | 23.4.3 | Persistent elements MUST use offscreen buffers |
| P5L-13 | 23.5.3 | >100 particles MUST use object pooling |
| P5L-15 | 23.6.2 | Flow field vectors MUST use Float32Array |
| P5L-16 | 23.7.2 | Noise visualizations MUST set noiseDetail explicitly |
| P5L-17 | 23.7.4 | Static textures MUST be cached |
| P5L-18 | 23.8.3 | >256 row waterfalls MUST use ring buffer |
| P5L-19 | 23.8.3 | Waterfall rows MUST use loadPixels/updatePixels |
| P5L-20 | 23.8.4 | Color maps MUST be configurable at runtime |
| P5L-21 | 23.9.2 | Signal ingestion MUST be decoupled from draw() |
| P5L-22 | 23.9.2 | Signal data MUST be copied before consumption |
| P5L-24 | 23.10.1 | Shaders MUST be loaded from separate files or module-level strings |
| P5L-25 | 23.10.1 | Shader signal data MUST be packed into textures |
| P5L-26 | 23.11.2 | Sketch MUST access atom data through useRef bridges |
| P5L-27 | 23.11.2 | sketchFactory MUST be stable across renders |
| P5L-28 | 23.11.3 | p5 state updates MUST use registry.set() |
| P5L-29 | 23.12.3 | draw() MUST call p.clear() for transparency |
| P5L-30 | 23.12.4 | All layers MUST use same viewport dimensions |
| P5L-32 | 23.13.1 | draw() MUST complete within 4ms at 60fps |
| P5L-33 | 23.13.3 | Adaptive quality reduction MUST be implemented |
| P5L-34 | 23.13.4 | Bulk data MUST use TypedArrays |
| P5L-35 | 23.14.2 | SDR spectral data MUST come from atoms, not p5.FFT |
| P5L-36 | 23.15.3 | Text MUST observe 12px minimum font size |
| P5L-37 | 23.16.1 | Application MUST function without p5 layer |
| P5L-38 | 23.16.2 | Color MUST NOT be sole information channel |
| P5L-39 | 23.16.3 | MUST respect prefers-reduced-motion |
| P5L-40 | 23.16.4 | Canvas MUST include aria-label |
| P5L-41 | 23.17.1 | Sketch logic MUST be extractable pure functions |
| P5L-42 | 23.17.2 | Visual tests MUST use fixed random seeds |

### SHOULD Requirements

| ID | Section | Requirement |
|----|---------|-------------|
| P5L-S1 | 23.3.2 | Canvas 2D SHOULD be default rendering mode |
| P5L-S2 | 23.5.3 | Particle count limits SHOULD be enforced at pool level |
| P5L-S3 | 23.9.3 | Signal-driven parameters SHOULD use temporal smoothing |
| P5L-S4 | 23.13.3 | Quality SHOULD recover when frame time drops below 3ms |
| P5L-S5 | 23.16.2 | Viridis SHOULD be default color map for accessibility |
| P5L-S6 | 23.16.3 | Reduced motion: static markers SHOULD replace animations |

### MAY Requirements

| ID | Section | Requirement |
|----|---------|-------------|
| P5L-M1 | 23.1.3 | Interactive p5 elements MAY enable pointer-events selectively |
| P5L-M2 | 23.3.2 | WebGL MAY be used when Canvas 2D insufficient |
| P5L-M3 | 23.5.5 | Force field types MAY include gravity, drag, attraction, noise |
| P5L-M4 | 23.10 | Custom GLSL shaders MAY be used for GPU-accelerated effects |
| P5L-M5 | 23.15.2 | Emergent patterns (boids, CA, L-systems) MAY be used |
| P5L-M6 | 23.6.4 | Flow fields MAY be driven by real signal bearing data |

---

## TSG.23.19 Tsingou Integration Mapping

### TSG.23.19.1 p5 Layer Configurations

| Visualization | Mode | Data Source (Atom) | Layer Interaction |
|--------------|------|-------------------|-------------------|
| Spectrum waterfall | Canvas 2D | `fftBinsAtom` | Below visx frequency labels |
| Signal particles | Canvas 2D | `signalEventsAtom` | Above R3F globe positions |
| Flow field overlay | Canvas 2D | `bearingDataAtom` | Above R3F, below visx charts |
| IQ constellation | Canvas 2D or WebGL | `iqSamplesAtom` | Standalone panel |
| Noise atmosphere | Canvas 2D | None (procedural) | Background texture |
| Classification banner | Canvas 2D | `classificationAtom` | Top edge overlay |

### TSG.23.19.2 NATS Subject Mapping

| p5 Visualization | NATS Subject | Data Type |
|-----------------|-------------|-----------|
| Spectrum waterfall | `tsingou.signals.spectrum` | FFT magnitude bins |
| Signal particles | `tsingou.signals.{kind}` | BaseSignal events |
| Flow field | `tsingou.telemetry.{source}` | Bearing/strength data |
| IQ constellation | `tsingou.signals.iq` | Raw IQ samples |

### TSG.23.19.3 Cross-Section References

| Reference | Section | Integration Point |
|-----------|---------|------------------|
| 4-Layer Rendering Surface | TSG.20 | Layer stack architecture |
| R3F 3D Scene Layer | TSG.21 | Layer 1 compositing below p5 |
| visx Data Visualization | TSG.22 | Layer 3 compositing above p5 |
| DOM Control Layer | TSG.24 | Layer 4, accessibility fallback |
| DSP Foundations | TSG.25 | FFT, windowing for waterfall input |
| Spectrum Visualization | TSG.19 | Spectrum display requirements |
| BaseSignal Schema | TSG.8 | Signal data format |
| Atom-as-State | TSG.32 | State bridge architecture |
| Source Adapters | TSG.9 | SDR data ingestion path |

---

## TSG.23.20 References

[P5] Processing Foundation. "p5.js." https://p5js.org/

[P5-MODES] Processing Foundation. "Global and Instance Mode." GitHub Wiki. https://github.com/processing/p5.js/wiki/Global-and-instance-mode

[P5-WEBGL] Processing Foundation. "Getting Started with WebGL in p5." https://p5js.org/tutorials/optimizing-webgl-sketches/

[P5-SHADERS] Processing Foundation. "Introduction to Shaders." https://p5js.org/tutorials/intro-to-shaders/

[P5-BLEND] Processing Foundation. "blendMode." https://p5js.org/reference/p5/blendMode/

[P5-NOISE] Processing Foundation. "noise." https://p5js.org/reference/p5/noise/

[P5-FFT] Processing Foundation. "p5.FFT." https://p5js.org/reference/p5.sound/p5.FFT/

[P5-REACT] P5-wrapper. "@p5-wrapper/react." GitHub. https://github.com/P5-wrapper/react

[OPENWEBRX-WATERFALL] OpenWebRX. "Waterfall Display Architecture." DeepWiki. https://deepwiki.com/jketterl/openwebrx/2.2-waterfall-display

[CANVAS-WATERFALL] jledet. "HTML Canvas Waterfall Plot." GitHub. https://github.com/jledet/waterfall

[P5-SHADER-EXAMPLES] aferriss. "p5jsShaderExamples." GitHub. https://github.com/aferriss/p5jsShaderExamples

[RFC2119] Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels." BCP 14, RFC 2119, DOI 10.17487/RFC2119, March 1997.

[RFC8174] Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." BCP 14, RFC 8174, DOI 10.17487/RFC8174, May 2017.
