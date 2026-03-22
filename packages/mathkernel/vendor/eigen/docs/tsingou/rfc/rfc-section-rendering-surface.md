# TSG-RFC-001 Section: Rendering Surface

```
Section:       Rendering Surface
Parent RFC:    TSG-RFC-001 (Tsingou Signal Analysis Platform)
Status:        DRAFT
Author:        Val (architecture-reviewer)
Created:       2026-02-18
Research Base: R3F_MIGRATION.md (1038 lines), ADR-007 (framer-motion), ADR-012 (viz focus),
               ADR-013 (analysis techniques), SPEC.md (215 lines),
               nw-wrld-reference/05_DASHBOARD_UI.md, ARCHITECTURE_ANALYSIS.md
```

> This section specifies the composited rendering surface architecture for Tsingou. It
> covers the 4-layer rendering model, per-layer technology selection, the OutputBridge
> signal routing mechanism, analysis technique mapping to rendering layers, and the
> nw_wrld module migration strategy. The key words "MUST", "MUST NOT", "SHOULD",
> "SHOULD NOT", and "MAY" are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [TSG.3.1 4-Layer Composited Architecture](#tsg31-4-layer-composited-architecture)
2. [TSG.3.2 R3F Layer (z:0, WebGL 3D)](#tsg32-r3f-layer-z0-webgl-3d)
3. [TSG.3.3 visx Layer (z:1, SVG)](#tsg33-visx-layer-z1-svg)
4. [TSG.3.4 p5 Layer (z:2, Canvas 2D)](#tsg34-p5-layer-z2-canvas-2d)
5. [TSG.3.5 DOM Layer (z:3, React/framer-motion)](#tsg35-dom-layer-z3-reactframer-motion)
6. [TSG.3.6 OutputBridge Routing](#tsg36-outputbridge-routing)
7. [TSG.3.7 Analysis Technique Mapping](#tsg37-analysis-technique-mapping)
8. [TSG.3.8 nw_wrld Module Migration](#tsg38-nw_wrld-module-migration)
9. [TSG.3.9 Normative Requirements](#tsg39-normative-requirements)
10. [TSG.3.10 References](#tsg310-references)

---

## TSG.3.1 4-Layer Composited Architecture

### TSG.3.1.1 Layer Stack

Tsingou renders analysis output across four composited layers, each using a rendering technology optimized for its data type. The layers are stacked via CSS z-index with transparent backgrounds, allowing all four layers to be visible simultaneously.

| Layer | Z-Index | Technology | Rendering Target | Primary Use Cases |
|-------|---------|-----------|-----------------|-------------------|
| **3D Scene** | 0 | React Three Fiber (R3F) | WebGL | Network graphs, geospatial, signal topology, link analysis |
| **Data Visualization** | 1 | visx (D3 composable) | SVG | Timelines, heatmaps, distributions, ATT&CK matrix |
| **Generative Canvas** | 2 | p5.js (@p5-wrapper/react) | Canvas 2D | Spectrum waterfall, noise fields, constellation diagrams |
| **Controls & Text** | 3 | React + framer-motion | DOM | Controls, alerts, status panels, tables, annotation |

### TSG.3.1.2 Compositing Strategy

The 4-layer compositing uses CSS stacking context with the following constraints:

```css
.tsingou-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.tsingou-layer {
  position: absolute;
  inset: 0;
}

.tsingou-layer--r3f      { z-index: 0; }  /* WebGL canvas, opaque background */
.tsingou-layer--visx     { z-index: 1; pointer-events: none; }  /* SVG overlay */
.tsingou-layer--p5       { z-index: 2; pointer-events: none; }  /* Canvas overlay */
.tsingou-layer--dom      { z-index: 3; }  /* DOM controls, captures events */
```

Key compositing rules:

1. **R3F (z:0)** renders the base 3D scene. It MUST have an opaque or semi-transparent background.
2. **visx (z:1)** and **p5 (z:2)** overlay the 3D scene with transparent backgrounds. They MUST have `pointer-events: none` unless specific interactive elements require event handling.
3. **DOM (z:3)** sits on top as the control surface. It captures pointer events for buttons, sliders, and text input.
4. Layers MUST NOT have inter-layer import dependencies. Each layer subscribes to atoms independently [TSG.2.8.4].

### TSG.3.1.3 Layer Independence Guarantees

Each rendering layer operates independently:

- **Data flow**: Each layer subscribes to the same output atoms via `useAtomValue()`. No layer passes data to another layer.
- **Lifecycle**: Each layer can be mounted/unmounted independently. Removing the p5 layer does not affect R3F or visx.
- **Performance**: Each layer manages its own render loop. R3F uses `requestAnimationFrame` via Three.js. p5 uses its own draw loop. visx re-renders on atom change. DOM re-renders via React.
- **Failure isolation**: A crash in one layer (e.g., WebGL context loss) MUST NOT propagate to other layers.

Implementations MUST maintain this independence. If a new visualization requires data from multiple layers, the coordination MUST happen through shared atoms, not through direct inter-layer communication.

---

## TSG.3.2 R3F Layer (z:0, WebGL 3D)

### TSG.3.2.1 Technology Selection

React Three Fiber (R3F) replaces nw_wrld's imperative Three.js code with a declarative React renderer for Three.js [R3F_MIGRATION]. This decision was driven by:

| Factor | nw_wrld (imperative Three.js) | Tsingou (R3F) |
|--------|------------------------------|---------------|
| Scene management | Manual `scene.add()`, `scene.remove()` | React component tree |
| State synchronization | Manual sync between Jotai atoms and Three.js objects | `useAtomValue()` drives component props directly |
| Memory management | Manual `dispose()` on unmount | React lifecycle handles cleanup |
| Code organization | Monolithic render loop with conditional branches | Composable components with hooks |
| Hot module reload | Breaks scene state | Preserves scene tree |
| TypeScript integration | Weak (Three.js types are complex) | Strong (R3F provides React-style types) |

### TSG.3.2.2 R3F Use Cases for SIGINT Analysis

| Visualization | Data Source | R3F Components | d2ts Operator |
|--------------|-----------|----------------|---------------|
| **Link analysis graph** | Cross-source correlation atoms | `<ForceGraph3D>`, `<Line>`, `<Sphere>` | `join`, `distinct` |
| **Geospatial overlay** | Location-enriched signals | `<GeoJsonMesh>`, `<Globe>`, `<Marker>` | `join` (signal x location) |
| **Signal flow topology** | Pipeline metadata | `<FlowGraph>`, `<Edge>`, `<Node>` | Graph topology |
| **3D scatter plot** | Multi-dimensional signal features | `<Points>`, `<InstancedMesh>` | `reduce`, `window` |
| **Network topology** | NATS subject routing | `<HierarchicalGraph>` | Subject tree |

### TSG.3.2.3 R3F Integration with Atom-as-State

R3F components subscribe to pipeline output atoms via `useAtomValue()`:

```typescript
function SignalFlowScene() {
  const signals = useAtomValue(activeSignalsAtom)
  const correlations = useAtomValue(crossCorrelationAtom)

  return (
    <Canvas>
      <ambientLight />
      {signals.map(signal => (
        <SignalNode key={signal.id} signal={signal} />
      ))}
      {correlations.map(corr => (
        <CorrelationEdge key={corr.id} correlation={corr} />
      ))}
    </Canvas>
  )
}
```

This pattern preserves the zero-coupling guarantee: the R3F layer knows nothing about TsingouFlow, d2ts, or queues. It reads atoms and renders.

### TSG.3.2.4 R3F Performance Considerations

WebGL rendering in R3F introduces performance constraints that implementations MUST account for:

| Concern | Constraint | Mitigation |
|---------|-----------|------------|
| Draw calls | >1000 draw calls degrades FPS | Use `<InstancedMesh>` for repeated geometries (signal nodes) |
| Texture memory | WebGL has finite texture slots | Pool textures, dispose unused materials |
| Re-render scope | `useFrame()` runs every frame | Avoid atom reads in `useFrame()` — use refs |
| State updates | React state changes trigger full scene reconciliation | Prefer `useRef` + imperative mutation for animations |
| Context loss | WebGL context can be lost (tab switch, GPU pressure) | Handle `onContextLost` event, rebuild scene |

For link analysis graphs with >10,000 nodes, implementations SHOULD use:
- `<InstancedMesh>` for node rendering (single draw call for all nodes)
- GPU-based force simulation via compute shaders or Web Workers
- Level-of-detail (LOD) to reduce geometry complexity at distance
- Frustum culling to skip off-screen nodes

### TSG.3.2.5 R3F Ecosystem Libraries

| Library | Purpose | Use in Tsingou |
|---------|---------|---------------|
| `@react-three/fiber` | Core React Three Fiber renderer | All R3F rendering |
| `@react-three/drei` | Helper components (OrbitControls, Text, etc.) | Camera controls, labels |
| `@react-three/postprocessing` | Post-processing effects | Bloom for highlighted signals |
| `react-force-graph-3d` | Force-directed graph in 3D | Link analysis visualization |
| `three-globe` | Globe with data points | Geospatial signal overlay |

---

## TSG.3.3 visx Layer (z:1, SVG)

### TSG.3.3.1 Technology Selection

visx replaces nw_wrld's raw D3.js usage with composable React components built on D3 primitives. visx provides:

| Capability | Raw D3 | visx |
|-----------|--------|------|
| React integration | Manual DOM manipulation conflicts with React | Native React components |
| Composability | Monolithic chart functions | Small, composable primitives (`@visx/scale`, `@visx/axis`, etc.) |
| TypeScript | Community types, often incomplete | First-class TypeScript |
| SSR support | Browser-only (requires `window`) | SSR-compatible |
| Animation | D3 transition (fights React) | Compatible with framer-motion |

### TSG.3.3.2 visx Use Cases for SIGINT Analysis

| Visualization | visx Packages | Data Source | d2ts Operator |
|--------------|--------------|-----------|---------------|
| **Timeline analysis** | `@visx/timeline`, `@visx/axis`, `@visx/scale` | `observed-data.first_observed` | `window`, `count` |
| **Heatmap** | `@visx/heatmap` | Signal density by kind x time | `reduce`, `count` |
| **ATT&CK matrix** | `@visx/grid`, `@visx/group` | ATT&CK technique mappings | `join` (signal x ATT&CK) |
| **Pattern-of-life** | `@visx/voronoi`, `@visx/pattern` | Temporal activity patterns | `window`, `reduce`, `iterate` |
| **Distribution** | `@visx/stats`, `@visx/boxplot` | Signal feature distributions | `reduce` |
| **Network graph (2D)** | `@visx/network` | Entity relationships | `join`, `distinct` |
| **Sparklines** | `@visx/sparkline` | Signal rate over time | `window`, `count` |

### TSG.3.3.3 visx Package Inventory

The visx ecosystem provides fine-grained packages. Tsingou uses the following:

| Package | Size | Purpose in Tsingou |
|---------|------|-------------------|
| `@visx/scale` | Core | Map signal timestamps, values to pixel coordinates |
| `@visx/axis` | Core | Time axes, value axes for all charts |
| `@visx/shape` | Core | Lines, bars, areas, arcs for signal visualization |
| `@visx/group` | Core | SVG group composition |
| `@visx/grid` | Layout | ATT&CK matrix grid, heatmap grid |
| `@visx/heatmap` | Specialty | Signal density heatmap (kind x time) |
| `@visx/network` | Specialty | 2D link analysis graph |
| `@visx/hierarchy` | Specialty | NATS subject tree visualization |
| `@visx/stats` | Specialty | Signal feature distributions |
| `@visx/tooltip` | Interaction | Signal detail on hover |
| `@visx/voronoi` | Interaction | Efficient nearest-point detection for selection |
| `@visx/responsive` | Layout | Viewport-responsive chart sizing |
| `@visx/pattern` | Visual | Pattern fills for categorical encoding |
| `@visx/text` | Typography | Rotated axis labels, signal annotations |
| `@visx/threshold` | Analysis | Anomaly threshold lines |
| `@visx/annotation` | Analysis | Signal event annotations |

### TSG.3.3.4 SVG Performance Considerations

SVG rendering has performance characteristics distinct from Canvas and WebGL:

| Concern | SVG Behavior | Threshold | Mitigation |
|---------|-------------|-----------|------------|
| DOM node count | Each SVG element is a DOM node | >5000 elements degrades | Virtualize: only render visible elements |
| Reflow | SVG layout triggers reflow | On any attribute change | Use `transform` instead of `x/y` changes |
| Text rendering | SVG text is crisp at any zoom | CPU-intensive for many labels | Limit visible labels, hide on zoom-out |
| Animation | CSS/SMIL animation available | 60fps for <1000 elements | framer-motion for complex animations |

For timeline visualizations with >10,000 signal events, implementations SHOULD:
- Aggregate signals into time buckets (bar chart instead of individual points)
- Use Canvas fallback for the signal density layer
- Implement viewport-based rendering (only render visible time range)

### TSG.3.3.5 SVG Overlay Pattern

visx renders as an SVG overlay on top of the R3F canvas:

```typescript
function TimelineOverlay() {
  const signals = useAtomValue(activeSignalsAtom)
  const { width, height } = useViewportSize()

  const timeScale = scaleTime({
    domain: [earliest(signals), latest(signals)],
    range: [0, width],
  })

  return (
    <svg width={width} height={height} style={{ pointerEvents: 'none' }}>
      <Group>
        <AxisBottom scale={timeScale} top={height - 40} />
        {signals.map(s => (
          <Circle
            key={s.id}
            cx={timeScale(s.timestamp)}
            cy={height / 2}
            r={3}
            fill={kindToColor(s.kind)}
          />
        ))}
      </Group>
    </svg>
  )
}
```

---

## TSG.3.4 p5 Layer (z:2, Canvas 2D)

### TSG.3.4.1 Technology Selection

p5.js provides creative coding capabilities not available in R3F or visx. It is integrated via `@p5-wrapper/react` for React lifecycle management.

| Capability | p5.js Strength | Alternative Weakness |
|-----------|---------------|---------------------|
| Spectrum waterfall | Pixel-level control, efficient canvas updates | R3F: overkill for 2D; visx: SVG too slow for pixel operations |
| Noise fields | Built-in `noise()` function, Perlin noise | No equivalent in R3F or visx |
| Constellation diagrams | Direct canvas draw with blending modes | SVG cannot do per-pixel blending efficiently |
| Generative patterns | `draw()` loop with state accumulation | React re-render model incompatible with accumulation |

### TSG.3.4.2 p5 Use Cases for SIGINT Analysis

| Visualization | p5 Features | Data Source | d2ts Operator |
|--------------|------------|-----------|---------------|
| **Spectrum waterfall** | Canvas pixel manipulation, color mapping | SDR FFT magnitudes | Custom FFT operators |
| **Noise field** | `noise()`, `map()`, `lerpColor()` | Signal density patterns | `reduce`, `window` |
| **Constellation diagram** | Points with alpha blending | IQ sample data (SDR) | Raw signal pass-through |
| **Signal waveform** | `beginShape()`, `vertex()`, `endShape()` | Time-domain signal samples | `window` |
| **Particle system** | `createVector()`, `applyForce()` | Signal events as particle emitters | Event accumulation |

### TSG.3.4.3 Sketch Lifecycle Management

p5 sketches are managed via `@p5-wrapper/react`:

```typescript
function SpectrumWaterfall() {
  const fftData = useAtomValue(fftMagnitudesAtom)

  const sketch = useCallback((p5: P5) => {
    let waterfall: number[][] = []

    p5.setup = () => {
      p5.createCanvas(800, 400)
      p5.colorMode(p5.HSB)
    }

    p5.draw = () => {
      // Shift waterfall down, add new FFT line at top
      waterfall.unshift([...fftData])
      if (waterfall.length > p5.height) waterfall.pop()

      for (let y = 0; y < waterfall.length; y++) {
        for (let x = 0; x < waterfall[y].length; x++) {
          const magnitude = waterfall[y][x]
          p5.stroke(p5.map(magnitude, -100, 0, 240, 0), 100, 100)
          p5.point(x, y)
        }
      }
    }
  }, [fftData])

  return <ReactP5Wrapper sketch={sketch} />
}
```

The p5 `draw()` loop runs independently of React's render cycle. Atom values are read at the start of each frame. This decoupling is essential for maintaining smooth 60fps rendering even when React is busy.

### TSG.3.4.4 p5 Performance Considerations

Canvas 2D rendering is efficient for pixel-level operations but has distinct constraints:

| Concern | Canvas Behavior | Mitigation |
|---------|----------------|------------|
| Pixel access | `loadPixels()` / `updatePixels()` for per-pixel manipulation | Minimize calls per frame, batch updates |
| State accumulation | `draw()` loop accumulates visual state over frames | Use offscreen buffer for waterfall scroll |
| Canvas size | Large canvases consume proportional GPU memory | Match canvas to viewport, use `pixelDensity(1)` |
| Text rendering | Canvas text is rasterized (not crisp at zoom) | Use DOM overlay for text labels |

For spectrum waterfall displays receiving SDR data at 1024 FFT bins x 60fps:
- Each frame shifts the waterfall image down by one pixel row
- New FFT data is drawn as a colored line at the top
- Total pixel operations: 1024 x 400 = 409,600 per frame (feasible at 60fps)
- Implementations SHOULD use `p5.Graphics` offscreen buffer for scroll performance

### TSG.3.4.5 p5 Color Mapping for SDR

Spectrum waterfall displays require mapping dB magnitude to color. The standard SDR color mapping:

| dB Range | Color | Interpretation |
|----------|-------|---------------|
| -100 to -80 dB | Dark blue/black | Noise floor |
| -80 to -60 dB | Blue → cyan | Weak signal |
| -60 to -40 dB | Cyan → green | Moderate signal |
| -40 to -20 dB | Green → yellow | Strong signal |
| -20 to 0 dB | Yellow → red | Very strong / clipping |

```typescript
// p5 HSB color mapping for SDR waterfall
p5.colorMode(p5.HSB, 360, 100, 100)
const hue = p5.map(magnitudeDb, -100, 0, 240, 0)  // Blue(240) → Red(0)
p5.stroke(hue, 100, p5.map(magnitudeDb, -100, 0, 20, 100))
```

---

## TSG.3.5 DOM Layer (z:3, React/framer-motion)

### TSG.3.5.1 Technology Selection

The DOM layer uses standard React components with framer-motion for animation [ADR-007]. It handles all text rendering, controls, alerts, tables, and user interaction that does not require canvas or WebGL.

### TSG.3.5.2 framer-motion Integration

framer-motion was chosen over TMNL's custom `animatable()` system (GSAP + anime.js drivers) for Tsingou-specific use [ADR-007]:

| Factor | Custom animatable | framer-motion |
|--------|------------------|---------------|
| React integration | Hook-based, manual cleanup | `motion.*` components, declarative |
| Layout animation | Manual FLIP calculation | `layoutId` + `AnimatePresence` |
| Exit animations | Manual cleanup on unmount | `AnimatePresence` handles unmount |
| Gesture support | None built-in | Drag, tap, hover, pan built-in |
| TypeScript | Custom types | First-class TypeScript |
| Bundle size | GSAP + anime.js + custom code | framer-motion standalone (~30KB) |

### TSG.3.5.3 DOM Layer Use Cases

| Component | framer-motion Feature | Data Source |
|-----------|----------------------|-----------|
| **Alert panel** | `AnimatePresence`, `motion.div` with `layout` | `anomalyAtom` |
| **Signal table** | `motion.tr` with `layout` for row transitions | `activeSignalsAtom` |
| **Adapter status cards** | `motion.div` with `initial/animate/exit` | `adapterHealthAtom` |
| **Pipeline metrics** | `motion.span` with number spring | `throughputAtom`, `totalProcessedAtom` |
| **Session controls** | Drag handles, expandable panels | Session configuration state |
| **Source controls** | Toggle adapters, configure parameters | `adapterRegistryAtom` |

### TSG.3.5.4 framer-motion Animation Patterns

Tsingou uses specific framer-motion patterns for SIGINT analysis interfaces:

**Alert entry/exit animation** — Anomaly alerts animate in from the right and exit to the left:

```typescript
function AlertItem({ anomaly }: { anomaly: Anomaly }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <AlertContent anomaly={anomaly} />
    </motion.div>
  )
}

function AlertPanel() {
  const anomalies = useAtomValue(anomalyAtom)
  return (
    <AnimatePresence mode="popLayout">
      {anomalies.map(a => <AlertItem key={a.id} anomaly={a} />)}
    </AnimatePresence>
  )
}
```

**Adapter card status transition** — Health status changes trigger color transitions:

```typescript
function AdapterCard({ adapter, health }: Props) {
  const statusColor = {
    connected: 'var(--tmnl-success)',
    degraded: 'var(--tmnl-warning)',
    error: 'var(--tmnl-error)',
    disconnected: 'var(--tmnl-muted)',
  }[health?.status ?? 'disconnected']

  return (
    <motion.div
      animate={{ borderColor: statusColor }}
      transition={{ duration: 0.3 }}
      layout
    >
      {/* adapter details */}
    </motion.div>
  )
}
```

**Pipeline metrics spring animation** — Throughput counter uses spring physics for smooth number transitions:

```typescript
function ThroughputGauge() {
  const throughput = useAtomValue(throughputAtom)
  const springValue = useSpring(throughput, { stiffness: 100, damping: 30 })

  return (
    <motion.span>
      {useTransform(springValue, v => `${Math.round(v)} sig/s`)}
    </motion.span>
  )
}
```

### TSG.3.5.5 Typography Constraints

All text in the DOM layer MUST comply with the TMNL typography discipline:

| Token | Size | Use Case |
|-------|------|----------|
| `--tmnl-text-xs` | 12px | Labels, badges, captions — THE FLOOR |
| `--tmnl-text-sm` | 14px | Secondary text, table cells |
| `--tmnl-text-base` | 16px | Body text, input fields |
| `--tmnl-text-lg` | 18px | Subheadings, panel titles |

Text below 12px is prohibited. Implementations MUST NOT use Tailwind arbitrary values below 12px (e.g., `text-[8px]`, `text-[9px]`).

---

## TSG.3.6 OutputBridge Routing

### TSG.3.6.1 Atom-Mediated Routing

The OutputBridge [TSG.2.8] delivers processed signals to rendering layers through atoms. Each rendering layer subscribes to the atoms relevant to its visualization:

```
OutputBridge
    │
    ├──▶ activeSignalsAtom ──────────▶ R3F (all signals as 3D nodes)
    │                                ──▶ visx (signal timeline)
    │                                ──▶ DOM (signal table)
    │
    ├──▶ crossCorrelationAtom ───────▶ R3F (correlation edges)
    │                                ──▶ visx (correlation matrix)
    │
    ├──▶ anomalyAtom ────────────────▶ R3F (alert markers)
    │                                ──▶ DOM (alert panel)
    │
    ├──▶ fftMagnitudesAtom ──────────▶ p5 (spectrum waterfall)
    │
    └──▶ topKSignalsAtom ────────────▶ visx (ranking display)
                                     ──▶ DOM (top-K table)
```

### TSG.3.6.2 Selective Subscription

Rendering layers SHOULD subscribe only to the atoms they need. Subscribing to `activeSignalsAtom` when only `anomalyAtom` is needed wastes render cycles.

```typescript
// CORRECT — selective subscription
function AlertPanel() {
  const anomalies = useAtomValue(anomalyAtom)  // Only anomalies
  return <AnimatePresence>{anomalies.map(/* ... */)}</AnimatePresence>
}

// INCORRECT — over-subscription
function AlertPanel() {
  const signals = useAtomValue(activeSignalsAtom)  // ALL signals
  const anomalies = signals.filter(isAnomaly)       // Filter in render
  return <AnimatePresence>{anomalies.map(/* ... */)}</AnimatePresence>
}
```

### TSG.3.6.3 Batch Update Performance

The OutputBridge batches signals in groups of 8 before updating atoms [TSG.2.8.1]. This reduces React re-render frequency:

- **Without batching**: 10,000 signals/sec = 10,000 atom updates/sec = 10,000 React re-renders/sec (unsustainable)
- **With batching(8)**: 10,000 signals/sec = 1,250 atom updates/sec = 1,250 React re-renders/sec (manageable)
- **With requestAnimationFrame**: Rendering layers MAY further throttle their subscription to 60fps using `requestAnimationFrame` or React's `useDeferredValue`.

---

## TSG.3.7 Analysis Technique Mapping

### TSG.3.7.1 Eight Techniques Across Four Layers

Tsingou supports 8 intelligence analysis techniques, each mapped to optimal rendering layers [ADR-013]:

| # | Technique | Primary Layer | Secondary Layer | d2ts Operators | STIX Objects |
|---|-----------|--------------|----------------|----------------|-------------|
| 1 | **Link Analysis** | R3F (z:0) | visx (z:1) | `join`, `distinct` | SDOs + SROs (relationship) |
| 2 | **Timeline Analysis** | visx (z:1) | DOM (z:3) | `window`, `count` | `observed-data.first_observed` |
| 3 | **Geospatial Analysis** | R3F (z:0) | visx (z:1) | `join` (signal x location) | `location` SDO |
| 4 | **Anomaly Detection** | DOM (z:3) | visx (z:1) | `reduce`, `window`, custom | `indicator` SDO |
| 5 | **Pattern-of-Life** | visx (z:1) | R3F (z:0) | `window`, `reduce`, `iterate` | `observed-data` sequences |
| 6 | **Signal Flow** | R3F (z:0) | p5 (z:2) | Graph topology viz | Pipeline metadata |
| 7 | **Kill Chain / ATT&CK** | visx (z:1) | DOM (z:3) | `join` (signal x ATT&CK) | `attack-pattern` SDO |
| 8 | **Spectrum Analysis** | p5 (z:2) | visx (z:1) | Custom FFT operators | `artifact` SCO (SigMF) |

### TSG.3.7.2 MVP-per-Layer Strategy

Each technique is implemented with an MVP for its primary rendering layer [ADR-013]. The secondary layer adds supplementary views:

```
Primary MVP:   Minimum viable visualization in the primary layer
Secondary:     Additional views in secondary layer(s)
Full:          Cross-layer coordinated visualization with linked selection
```

Implementation wave:
1. **Wave 1 (MVP)**: One technique per layer as proof-of-concept
   - R3F: Link analysis graph
   - visx: Timeline with signal density
   - p5: Spectrum waterfall (SDR)
   - DOM: Alert panel with anomaly list
2. **Wave 2 (Breadth)**: Remaining techniques, primary layer only
3. **Wave 3 (Depth)**: Secondary layers, cross-layer coordination

### TSG.3.7.3 Cross-Layer Coordination

When an analyst selects a signal in one layer, the selection MUST propagate to all layers through a shared selection atom:

```typescript
// Selection state — shared across all layers
const selectedSignalIdsAtom = Atom.make<Set<string>>(new Set())
const hoveredSignalIdAtom = Atom.make<string | null>(null)

// R3F highlights selected nodes
function SignalNode({ signal }: { signal: BaseSignal }) {
  const selectedIds = useAtomValue(selectedSignalIdsAtom)
  const isSelected = selectedIds.has(signal.id)
  return <Sphere color={isSelected ? 'yellow' : 'blue'} />
}

// visx highlights selected points on timeline
function TimelinePoint({ signal }: { signal: BaseSignal }) {
  const selectedIds = useAtomValue(selectedSignalIdsAtom)
  const isSelected = selectedIds.has(signal.id)
  return <Circle fill={isSelected ? 'yellow' : 'blue'} />
}
```

This coordination happens through atoms, preserving the zero-coupling guarantee between layers.

### TSG.3.7.4 Rendering Layer Budget

Each analysis session SHOULD distribute rendering resources across layers based on the active techniques:

| Configuration | R3F Budget | visx Budget | p5 Budget | DOM Budget |
|--------------|-----------|------------|----------|-----------|
| Link analysis focused | 60% GPU | 20% SVG | 5% Canvas | 15% DOM |
| Timeline focused | 10% GPU | 60% SVG | 5% Canvas | 25% DOM |
| SDR/spectrum focused | 5% GPU | 15% SVG | 60% Canvas | 20% DOM |
| Multi-technique | 30% GPU | 30% SVG | 20% Canvas | 20% DOM |

"Budget" refers to the relative allocation of visual viewport area, update frequency, and signal routing. Implementations MAY adjust these budgets dynamically based on the analyst's focus area.

### TSG.3.7.5 Technique Interaction Matrix

Some techniques produce outputs that feed into other techniques:

| Producer Technique | Consumer Technique | Shared Atom | Data |
|-------------------|-------------------|-------------|------|
| Anomaly Detection | Timeline Analysis | `anomalyAtom` | Anomaly timestamps for timeline markers |
| Link Analysis | Kill Chain / ATT&CK | `crossCorrelationAtom` | Entity relationships for ATT&CK mapping |
| Spectrum Analysis | Signal Flow | `fftMagnitudesAtom` | Frequency domain data for flow visualization |
| Pattern-of-Life | Anomaly Detection | `polBaselineAtom` | Baseline patterns for deviation detection |

These interactions happen exclusively through atoms. No technique implementation imports code from another technique.

---

## TSG.3.8 nw_wrld Module Migration

### TSG.3.8.1 Module Inventory

R3F_MIGRATION.md documents 21 nw_wrld starter modules (note: module count varies between 20 and 21 across documents — see [ADR INDEX — Consistency Note 6.6][INDEX-6.6]). Each module maps to a Tsingou rendering layer:

| # | nw_wrld Module | Category | Tsingou Layer | Migration Strategy |
|---|---------------|----------|--------------|-------------------|
| 1 | `visualizer-3d` | 3D Scene | R3F (z:0) | Full R3F rewrite with `@react-three/fiber` |
| 2 | `particle-system` | 3D Scene | R3F (z:0) | `<InstancedMesh>` with `@react-three/drei` |
| 3 | `terrain-mesh` | 3D Scene | R3F (z:0) | `<Plane>` with displacement map |
| 4 | `galaxy-spiral` | 3D Scene | R3F (z:0) | Procedural geometry with `useFrame()` |
| 5 | `force-graph` | 3D Scene | R3F (z:0) | `react-force-graph-3d` or custom |
| 6 | `globe` | 3D Scene | R3F (z:0) | `@react-three/drei` Globe |
| 7 | `bar-chart` | Data Viz | visx (z:1) | `@visx/bar` |
| 8 | `line-chart` | Data Viz | visx (z:1) | `@visx/curve` + `@visx/shape` |
| 9 | `heatmap` | Data Viz | visx (z:1) | `@visx/heatmap` |
| 10 | `radar-chart` | Data Viz | visx (z:1) | `@visx/shape` RadialArea |
| 11 | `treemap` | Data Viz | visx (z:1) | `@visx/hierarchy` Treemap |
| 12 | `network-graph` | Data Viz | visx (z:1) | `@visx/network` |
| 13 | `noise-field` | Generative | p5 (z:2) | p5 `noise()` direct |
| 14 | `flow-field` | Generative | p5 (z:2) | p5 vector field |
| 15 | `reaction-diffusion` | Generative | p5 (z:2) | p5 pixel buffer |
| 16 | `cellular-automata` | Generative | p5 (z:2) | p5 grid |
| 17 | `waveform` | Generative | p5 (z:2) | p5 `beginShape()` |
| 18 | `text-overlay` | DOM | DOM (z:3) | React + framer-motion |
| 19 | `control-panel` | DOM | DOM (z:3) | React compound components |
| 20 | `status-dashboard` | DOM | DOM (z:3) | React + visx sparklines |
| 21 | `sequencer-grid` | DOM | DOM (z:3) | React grid with framer-motion |

### TSG.3.8.2 Migration Principles

1. **No code copy**: nw_wrld module code is NOT copied. Modules are reimplemented using the appropriate layer's technology.
2. **Declarative over imperative**: All R3F modules use the React component tree, not `scene.add()`.
3. **Atom-driven**: All module state comes from atoms, not from props drilling or global mutable state.
4. **Schema-typed**: Module configurations use `Effect.Schema`, not raw interfaces.
5. **Scoped lifecycle**: Module resources (WebGL textures, audio buffers) use `Effect.addFinalizer()` for cleanup.

### TSG.3.8.3 Migration Priority

Not all 21 modules are equally relevant to Tsingou's SIGINT/OSINT mission. Migration priority is based on analysis technique relevance:

| Priority | Modules | Rationale |
|----------|---------|-----------|
| **P0 (immediate)** | `force-graph`, `network-graph`, `heatmap`, `line-chart`, `text-overlay`, `control-panel` | Core link analysis, timeline, controls |
| **P1 (Wave 2)** | `globe`, `bar-chart`, `radar-chart`, `status-dashboard`, `noise-field` | Geospatial, frequency analysis, monitoring |
| **P2 (Wave 3)** | `particle-system`, `waveform`, `flow-field`, `treemap` | Signal flow viz, hierarchy viz |
| **P3 (low)** | `terrain-mesh`, `galaxy-spiral`, `reaction-diffusion`, `cellular-automata`, `sequencer-grid`, `visualizer-3d` | Creative/experimental, low SIGINT relevance |

Implementations SHOULD prioritize P0 modules first, as they directly serve the analysis techniques defined in [ADR-013].

### TSG.3.8.4 Key Architectural Differences

| Aspect | nw_wrld Modules | Tsingou Rendering Layers |
|--------|----------------|-------------------------|
| Container | iframe sandbox per module | React component tree (no iframe) |
| Communication | `postMessage` IPC | Atom subscription (zero-copy) |
| State | Module-local + `UserData` sync | Shared atoms + module-scoped atoms |
| Rendering | Single canvas, shared context | 4 independent rendering contexts |
| Lifecycle | `init()` / `update()` / `destroy()` | React mount/unmount + `Effect.addFinalizer()` |
| Hot reload | `require()` re-evaluation | React Fast Refresh (Vite HMR) |

### TSG.3.8.3 Layer Integration Testing Strategy

Each rendering layer MUST be testable in isolation. The atom-mediated architecture enables this by decoupling layers from the pipeline:

**Unit test pattern** — Layer components receive data exclusively through atoms. Tests can set atom values directly without running the pipeline:

```typescript
import { Registry } from '@effect-rx/rx'
import { render } from '@testing-library/react'

describe('AlertPanel', () => {
  it('renders anomalies from atom', () => {
    const registry = Registry.make()
    registry.set(anomalyAtom, [
      { id: '1', type: 'z_score', severity: 'high', timestamp: Date.now() },
    ])

    const { getByText } = render(
      <RegistryProvider registry={registry}>
        <AlertPanel />
      </RegistryProvider>
    )

    expect(getByText('z_score')).toBeDefined()
  })
})
```

**Layer isolation test matrix:**

| Layer | Test Strategy | Mock Data Source | Assertion Target |
|-------|--------------|------------------|------------------|
| R3F (z:0) | `@react-three/test-renderer` | `activeSignalsAtom` with synthetic signals | Scene graph node count, material colors |
| visx (z:1) | `@testing-library/react` + SVG queries | `activeSignalsAtom` with timestamps | SVG element count, axis labels |
| p5 (z:2) | Canvas pixel sampling | `activeSignalsAtom` with frequency data | Canvas dimensions, draw() call count |
| DOM (z:3) | `@testing-library/react` | `anomalyAtom`, `adapterHealthAtom` | Text content, animation classes |

**Cross-layer integration test** — Verifies that selection propagation works across all layers by setting `selectedSignalIdsAtom` and asserting that each layer reflects the selection:

```typescript
describe('Cross-layer selection', () => {
  it('propagates selection to all layers', () => {
    const registry = Registry.make()
    registry.set(activeSignalsAtom, testSignals)
    registry.set(selectedSignalIdsAtom, new Set(['signal-1']))

    const { container } = render(
      <RegistryProvider registry={registry}>
        <CompositeRenderingSurface />
      </RegistryProvider>
    )

    // R3F layer highlights selected node
    const r3fLayer = container.querySelector('[data-layer="r3f"]')
    expect(r3fLayer).toBeDefined()

    // DOM layer shows selection detail
    const domLayer = container.querySelector('[data-layer="dom"]')
    expect(domLayer?.textContent).toContain('signal-1')
  })
})
```

**Performance regression test** — Each layer SHOULD have a benchmark test that renders N signals and asserts frame time remains below threshold:

| Layer | Signal Count | Max Frame Time | Measurement |
|-------|-------------|---------------|-------------|
| R3F | 1,000 nodes | 16ms (60fps) | `performance.now()` around render |
| visx | 5,000 points | 16ms (60fps) | SVG element creation time |
| p5 | 2,048 FFT bins | 16ms (60fps) | `draw()` duration |
| DOM | 100 alerts | 16ms (60fps) | React commit phase |

---

## TSG.3.9 Normative Requirements

### MUST Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.3-R1 | Rendering layers MUST NOT have inter-layer import dependencies | TSG.3.1.2 |
| TSG.3-R2 | Each layer MUST subscribe to atoms independently via useAtomValue() | TSG.3.1.2 |
| TSG.3-R3 | A crash in one layer MUST NOT propagate to other layers | TSG.3.1.3 |
| TSG.3-R4 | Cross-layer coordination MUST happen through shared atoms, not direct communication | TSG.3.1.3 |
| TSG.3-R5 | R3F (z:0) MUST have an opaque or semi-transparent background | TSG.3.1.2 |
| TSG.3-R6 | visx (z:1) and p5 (z:2) MUST have pointer-events: none unless specific elements require interaction | TSG.3.1.2 |
| TSG.3-R7 | All text in the DOM layer MUST be at least 12px | TSG.3.5.4 |
| TSG.3-R8 | Text below 12px is prohibited across all rendering layers | TSG.3.5.4 |
| TSG.3-R9 | Signal selection MUST propagate to all layers through the selectedSignalIdsAtom | TSG.3.7.3 |
| TSG.3-R10 | Module reimplementation MUST NOT copy nw_wrld source code | TSG.3.8.2 |

### SHOULD Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.3-S1 | Rendering layers SHOULD subscribe only to atoms they need (selective subscription) | TSG.3.6.2 |
| TSG.3-S2 | High-throughput rendering layers SHOULD throttle subscription updates to 60fps | TSG.3.6.3 |
| TSG.3-S3 | Module configurations SHOULD use Effect.Schema for type safety | TSG.3.8.2 |

### MAY Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.3-M1 | Rendering layers MAY use useDeferredValue for non-critical updates | TSG.3.6.3 |
| TSG.3-M2 | p5 sketches MAY accumulate state across frames in the draw() loop | TSG.3.4.3 |

---

## TSG.3.10 References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [ADR-007] | ADR-007: Framer Motion for Animation. `docs/tsingou/adr/ADR-007-framer-motion-for-animation.md` |
| [ADR-012] | ADR-012: Visualization-Focused Platform. `docs/tsingou/adr/ADR-012-visualization-focused-platform.md` |
| [ADR-013] | ADR-013: Eight Analysis Techniques. `docs/tsingou/adr/ADR-013-analysis-techniques.md` |
| [INDEX-6.6] | ADR Index — Consistency Note 6.6. `docs/tsingou/adr/INDEX.md` |
| [R3F_MIGRATION] | R3F Migration Document. `docs/tsingou/R3F_MIGRATION.md` |
| [R3F] | React Three Fiber. "React renderer for Three.js." https://docs.pmnd.rs/react-three-fiber |
| [VISX] | Airbnb. "visx — A collection of expressive, low-level visualization primitives for React." https://airbnb.io/visx |
| [P5] | Processing Foundation. "p5.js — JavaScript library for creative coding." https://p5js.org |
| [FRAMER] | Framer. "framer-motion — A production-ready motion library for React." https://www.framer.com/motion |
| [DREI] | Poimandres. "@react-three/drei — Useful helpers for React Three Fiber." |
