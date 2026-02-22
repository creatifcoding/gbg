# RFC Section TSG.22: visx Data Visualization Layer

```
Section:       TSG.22 — visx Data Visualization Layer
Parent RFC:    Tsingou Platform Specification
Status:        DRAFT
Author:        Val (graph-theory-specialist)
Created:       2026-02-18
Research Base: rfc-section-rendering-surface.md (TSG.3.3), ADR-012 (viz focus),
               ADR-013 (eight analysis techniques), rfc-section-state-management.md (TSG.4),
               rfc-section-dsp-foundations.md (TSG.25), rfc-section-signal-pipeline.md
```

> This section specifies the visx data visualization layer (z-index 1, SVG/Canvas)
> within Tsingou's 4-layer composited rendering architecture. It defines the chart
> type catalog, data binding pipeline from atom state, interaction patterns (brush,
> zoom, tooltip, crosshair), performance optimization strategies, scale and axis
> configuration, color encoding conventions, annotation layers, accessibility
> requirements, compound component composition, and cross-layer compositing rules.
> The visx layer is the primary surface for 2D analytical visualizations including
> time series, distributions, heatmaps, scatter plots, network graphs, and
> hierarchical displays. The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT",
> and "MAY" are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [TSG.22.1 Scope and Architecture Context](#tsg221-scope-and-architecture-context)
2.  [TSG.22.2 visx Architecture: D3-Based React Primitives](#tsg222-visx-architecture-d3-based-react-primitives)
3.  [TSG.22.3 Package Inventory and Dependency Map](#tsg223-package-inventory-and-dependency-map)
4.  [TSG.22.4 Chart Type Catalog](#tsg224-chart-type-catalog)
5.  [TSG.22.5 Signal Timeline](#tsg225-signal-timeline)
6.  [TSG.22.6 Spectrum Display](#tsg226-spectrum-display)
7.  [TSG.22.7 Data Binding from Atom State](#tsg227-data-binding-from-atom-state)
8.  [TSG.22.8 Scale Types and Configuration](#tsg228-scale-types-and-configuration)
9.  [TSG.22.9 Axis Formatting](#tsg229-axis-formatting)
10. [TSG.22.10 Color Encoding](#tsg2210-color-encoding)
11. [TSG.22.11 Responsive Sizing](#tsg2211-responsive-sizing)
12. [TSG.22.12 Annotation Layers](#tsg2212-annotation-layers)
13. [TSG.22.13 Interaction Patterns](#tsg2213-interaction-patterns)
14. [TSG.22.14 Performance Optimization](#tsg2214-performance-optimization)
15. [TSG.22.15 Cross-Layer Compositing](#tsg2215-cross-layer-compositing)
16. [TSG.22.16 Chart Composition Patterns](#tsg2216-chart-composition-patterns)
17. [TSG.22.17 Accessibility](#tsg2217-accessibility)
18. [TSG.22.18 Testing Strategy](#tsg2218-testing-strategy)
19. [TSG.22.19 Normative Requirements Summary](#tsg2219-normative-requirements-summary)
20. [TSG.22.20 References](#tsg2220-references)

---

## TSG.22.1 Scope and Architecture Context

### TSG.22.1.1 Layer Position

The visx layer occupies z-index 1 in the 4-layer composited rendering stack
defined in [TSG.3.1]. It renders as an SVG (or Canvas fallback) overlay above the
R3F WebGL scene (z:0) and below the p5 generative canvas (z:2) and DOM controls
(z:3).

```
  z:3  ┌──────────────────────────────────────┐  DOM (React + framer-motion)
       │  Controls, alerts, tables, text       │
  ─────├──────────────────────────────────────┤──────────────────────────────
  z:2  │  p5.js Canvas (generative/waterfall) │  p5 Layer
  ─────├──────────────────────────────────────┤──────────────────────────────
  z:1  │  ████████████████████████████████████│  visx Layer (THIS SECTION)
       │  █ SVG: charts, timelines, heatmaps █│
       │  █ Canvas fallback for >10k points  █│
       │  ████████████████████████████████████│
  ─────├──────────────────────────────────────┤──────────────────────────────
  z:0  │  R3F WebGL (3D scenes, force graphs)│  R3F Layer
       └──────────────────────────────────────┘
```

### TSG.22.1.2 Responsibility Boundaries

The visx layer is responsible for:

- All 2D analytical chart rendering (time series, bar, scatter, heatmap, network,
  hierarchy)
- Scale computation from atom-sourced domain data to pixel-space range
- Axis rendering with time-aware and SI-prefix formatting
- Interactive overlays: brush selection, zoom controls, tooltips, crosshairs
- Annotation layers: threshold lines, event markers, anomaly highlight regions
- Responsive viewport management via `ParentSize`

The visx layer is NOT responsible for:

- 3D visualization (R3F, z:0)
- Pixel-level generative rendering (p5, z:2)
- Text-heavy controls, tables, or alert panels (DOM, z:3)
- Spectrum waterfall rendering (p5, z:2 — visx provides only the 2D FFT line
  plot complement)

### TSG.22.1.3 Cross-Section Dependencies

| Dependency                   | Section    | Relationship                                  |
|------------------------------|------------|-----------------------------------------------|
| 4-layer compositing          | TSG.3.1    | visx at z:1, `pointer-events: none` default   |
| Atom-as-State doctrine       | TSG.4.1    | All chart data via `useAtomValue()`           |
| OutputBridge routing         | TSG.3.6    | Atom → scale → chart re-render pipeline       |
| Signal pipeline              | TSG.5      | Upstream data shapes: BaseSignal, FFT bins    |
| DSP foundations              | TSG.25     | FFT magnitude line plots, spectral math       |
| Analysis techniques          | TSG.3.7    | Timeline, heatmap, pattern-of-life in visx    |
| R3F layer                    | TSG.3.2    | 2D complement to 3D force graph               |
| p5 layer                     | TSG.3.4    | 2D complement to waterfall                    |
| DOM layer                    | TSG.3.5    | Sparklines embedded in DOM panels             |

---

## TSG.22.2 visx Architecture: D3-Based React Primitives

### TSG.22.2.1 Design Philosophy

visx is Airbnb's collection of expressive, low-level visualization primitives for
React. Unlike monolithic charting libraries (Recharts, Victory, Nivo), visx
exposes D3's mathematical functions (scales, shapes, layouts) as composable React
components without wrapping them in opinionated abstractions.

This design aligns with Tsingou's requirements:

| Requirement                       | Monolithic Library       | visx                               |
|-----------------------------------|--------------------------|-------------------------------------|
| Custom SIGINT visualizations      | Constrained by API       | Composable primitives               |
| D3 scale/shape access             | Abstracted away          | Direct D3 usage                     |
| React lifecycle integration       | Varies (some fight React)| Native React components             |
| TypeScript                        | Community types           | First-class TypeScript              |
| Bundle size                       | All-or-nothing (~200KB)  | Tree-shakeable packages (~5KB each) |
| Custom interaction (brush, zoom)  | Library-specific hooks   | D3-native via `@visx/brush`, `@visx/zoom` |
| SVG + Canvas hybrid               | Usually SVG-only         | `@visx/xychart` supports both       |

### TSG.22.2.2 Architectural Decomposition

visx decomposes charting into orthogonal concerns, each mapped to a package:

```
                         ┌──────────────────────────────────┐
                         │        @visx/xychart             │
                         │  (High-level XY chart wrapper)   │
                         └──────────┬───────────────────────┘
                                    │ orchestrates
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
   ┌────────▼────────┐   ┌─────────▼────────┐   ┌──────────▼─────────┐
   │  @visx/scale     │   │  @visx/shape      │   │  @visx/axis         │
   │  scaleLinear     │   │  LineSeries       │   │  AxisBottom         │
   │  scaleTime       │   │  AreaSeries       │   │  AxisLeft           │
   │  scaleLog        │   │  BarSeries        │   │  AxisRight          │
   │  scaleOrdinal    │   │  GlyphSeries      │   │  AxisTop            │
   │  scaleBand       │   │  AreaClosed       │   └────────────────────┘
   └──────────────────┘   │  Line, Bar, Arc   │
                          └────────────────────┘
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
   ┌────────▼────────┐   ┌─────────▼────────┐   ┌──────────▼─────────┐
   │  @visx/grid      │   │  @visx/tooltip    │   │  @visx/responsive   │
   │  GridRows        │   │  useTooltip       │   │  ParentSize         │
   │  GridColumns     │   │  TooltipWithBounds│   │  ScaleSVG           │
   │  GridRadial      │   │  Portal           │   │  debounced resize   │
   └──────────────────┘   └──────────────────┘   └────────────────────┘
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
   ┌────────▼────────┐   ┌─────────▼────────┐   ┌──────────▼─────────┐
   │  @visx/brush     │   │  @visx/zoom       │   │  @visx/annotation   │
   │  BaseBrush       │   │  Zoom             │   │  Annotation         │
   │  BrushHandle     │   │  transform matrix │   │  Connector          │
   │  selection rect  │   │  pan, pinch        │   │  Label              │
   └──────────────────┘   └──────────────────┘   └────────────────────┘
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
   ┌────────▼────────┐   ┌─────────▼────────┐   ┌──────────▼─────────┐
   │  @visx/heatmap   │   │  @visx/network    │   │  @visx/hierarchy    │
   │  HeatmapRect    │   │  Graph            │   │  Treemap            │
   │  HeatmapCircle  │   │  DefaultNode      │   │  Pack               │
   │  bin layout     │   │  DefaultLink      │   │  Partition (sunburst)│
   └──────────────────┘   └──────────────────┘   └────────────────────┘
```

### TSG.22.2.3 XYChart vs. Low-Level Primitives

`@visx/xychart` provides a higher-level API that composes scales, axes, series,
and tooltips into a single coordinated chart. Implementations SHOULD use
`@visx/xychart` for standard chart types (time series, bar, scatter) and fall
back to low-level primitives only for specialized visualizations (heatmap,
network, hierarchy).

| Use Case                       | API Choice          | Rationale                                |
|--------------------------------|---------------------|------------------------------------------|
| Time series line/area chart    | `@visx/xychart`     | Built-in scale sync, tooltip, axis        |
| Bar chart / stacked bars       | `@visx/xychart`     | BarSeries handles grouping, stacking      |
| Scatter / glyph plot           | `@visx/xychart`     | GlyphSeries with customizable renderGlyph |
| Heatmap (time x frequency)    | `@visx/heatmap`     | XYChart does not support heatmap layout   |
| Network graph (2D)             | `@visx/network`     | Force-directed requires custom layout     |
| Hierarchy (treemap/sunburst)   | `@visx/hierarchy`   | Specialized partition layout              |
| Sparkline (embedded in DOM)    | `@visx/shape` only  | Minimal: LinePath + scaleLinear           |

---

## TSG.22.3 Package Inventory and Dependency Map

### TSG.22.3.1 Required Packages

Implementations MUST include the following visx packages:

| Package              | Category     | Size (gzip) | Purpose in Tsingou                                        |
|----------------------|-------------|-------------|-----------------------------------------------------------|
| `@visx/xychart`      | Core        | ~18KB       | Orchestrated XY charts: line, area, bar, scatter          |
| `@visx/scale`        | Core        | ~3KB        | D3 scale wrappers: linear, log, time, ordinal, band       |
| `@visx/shape`        | Core        | ~5KB        | SVG shape primitives: Line, Bar, Area, Arc, Circle         |
| `@visx/axis`         | Core        | ~4KB        | Axis components with tick formatting                       |
| `@visx/grid`         | Core        | ~2KB        | Background grid lines (rows, columns, radial)              |
| `@visx/group`        | Core        | ~1KB        | SVG `<g>` wrapper with transform props                     |
| `@visx/tooltip`      | Interaction | ~3KB        | Tooltip positioning, portal, bounds detection              |
| `@visx/brush`        | Interaction | ~6KB        | Rectangular brush selection for time/frequency ranges       |
| `@visx/zoom`         | Interaction | ~4KB        | Pan/zoom transform matrix, minimap support                 |
| `@visx/responsive`   | Layout      | ~2KB        | `ParentSize` wrapper, debounced resize observer             |
| `@visx/heatmap`      | Specialty   | ~3KB        | Signal density heatmap (time x frequency, spectrogram 2D)  |
| `@visx/network`      | Specialty   | ~2KB        | 2D force-directed graph (complement to TSG.21 3D)          |
| `@visx/hierarchy`    | Specialty   | ~3KB        | Treemap, sunburst for signal taxonomy visualization         |
| `@visx/annotation`   | Analysis    | ~3KB        | Event markers, labels, connectors for signal annotations    |
| `@visx/threshold`    | Analysis    | ~2KB        | Above/below threshold area fill for anomaly detection       |
| `@visx/text`         | Typography  | ~2KB        | Rotated axis labels, signal annotations                    |
| `@visx/pattern`      | Visual      | ~2KB        | Pattern fills for categorical encoding                      |
| `@visx/voronoi`      | Interaction | ~2KB        | Nearest-point detection for efficient tooltip triggering    |
| `@visx/crosshair`    | Interaction | ~1KB        | Vertical + horizontal guide lines                          |

### TSG.22.3.2 Optional Packages

| Package              | Category   | Purpose                                                  |
|----------------------|-----------|----------------------------------------------------------|
| `@visx/stats`        | Specialty | Box plots, violin plots for signal feature distributions  |
| `@visx/wordcloud`    | Specialty | Keyword cloud for OSINT source analysis                   |
| `@visx/geo`          | Specialty | Geographic projections (if 2D geo needed alongside R3F)   |
| `@visx/gradient`     | Visual    | SVG gradient definitions for chart backgrounds             |
| `@visx/curve`        | Shape     | D3 curve interpolation (monotoneX, natural, step)         |
| `@visx/event`        | Utility   | Cross-browser event coordinate normalization               |
| `@visx/bounds`       | Utility   | Element bounds measurement                                 |
| `@visx/clip-path`    | Visual    | SVG clip paths for chart area masking                      |

### TSG.22.3.3 Package Dependency Graph

```
@visx/xychart
 ├── @visx/scale
 ├── @visx/shape
 ├── @visx/axis
 ├── @visx/grid
 ├── @visx/group
 ├── @visx/tooltip
 ├── @visx/text
 ├── @visx/responsive
 └── @visx/event

@visx/brush ──── @visx/scale (brush domain ↔ scale inversion)
@visx/zoom ───── (standalone, transform matrix)
@visx/heatmap ── @visx/scale (bin positioning)
@visx/network ── @visx/group (node/link grouping)
@visx/hierarchy ─ d3-hierarchy (layout computation)
@visx/voronoi ── d3-voronoi (Delaunay triangulation)
@visx/threshold ─ @visx/shape (area clipping)
@visx/annotation ─ @visx/group, @visx/text
```

---

## TSG.22.4 Chart Type Catalog

### TSG.22.4.1 Chart-to-Use-Case Mapping

| Chart Type     | visx Components                              | SIGINT Use Case                                       | Analysis Technique    | Data Atom                     |
|----------------|----------------------------------------------|-------------------------------------------------------|-----------------------|-------------------------------|
| Time Series    | XYChart + LineSeries + AreaSeries            | Signal rate over time, adapter throughput              | Timeline Analysis     | `activeSignalsAtom`           |
| Bar Chart      | XYChart + BarSeries                          | Signal kind distribution, source comparison            | Kill Chain / ATT&CK   | `signalKindCountAtom`         |
| Stacked Bar    | XYChart + BarSeries (stacked)                | Multi-source signal breakdown by kind per time bucket  | Timeline Analysis     | `signalSourceDistributionAtom`|
| Heatmap        | HeatmapRect                                  | Signal density by time x frequency (spectrogram 2D)    | Spectrum Analysis     | `spectralDensityAtom`         |
| Scatter        | XYChart + GlyphSeries                        | Signal correlation (confidence x recency)              | Pattern-of-Life       | `signalFeatureAtom`           |
| Network        | Graph + DefaultNode + DefaultLink            | 2D force-directed entity relationship graph            | Link Analysis         | `crossCorrelationAtom`        |
| Treemap        | Treemap (hierarchy)                          | Signal taxonomy: kind > subtype > source               | Kill Chain / ATT&CK   | `signalTaxonomyAtom`          |
| Sunburst       | Partition (hierarchy)                        | Hierarchical signal classification drill-down          | Kill Chain / ATT&CK   | `signalTaxonomyAtom`          |
| Sparkline      | LinePath + scaleLinear                       | Inline throughput gauges in DOM adapter cards           | (embedded in DOM)     | `adapterThroughputAtom`       |
| Threshold      | Threshold (above/below)                      | Anomaly deviation from baseline                        | Anomaly Detection     | `anomalyBaselineAtom`         |
| Box Plot       | BoxPlot (stats)                              | Signal feature distribution (SNR, bandwidth)           | Anomaly Detection     | `signalStatisticsAtom`        |

### TSG.22.4.2 Time Series Charts

Time series visualizations are the primary visx use case in Tsingou. They render
signal activity over temporal axes using `@visx/xychart`.

#### TSG.22.4.2.1 Line Series — Signal Rate Over Time

```typescript
import { XYChart, LineSeries, Axis, Grid, Tooltip } from '@visx/xychart'

type SignalRatePoint = {
  readonly timestamp: Date
  readonly count: number
  readonly kind: string
}

const accessors = {
  xAccessor: (d: SignalRatePoint) => d.timestamp,
  yAccessor: (d: SignalRatePoint) => d.count,
}

function SignalRateChart({ width, height }: { width: number; height: number }) {
  const rateData = useAtomValue(signalRateAtom)

  return (
    <XYChart
      width={width}
      height={height}
      xScale={{ type: 'time' }}
      yScale={{ type: 'linear', nice: true }}
    >
      <Grid columns={false} numTicks={4} />
      <Axis orientation="bottom" numTicks={6} />
      <Axis orientation="left" numTicks={4} />
      <LineSeries
        dataKey="signal-rate"
        data={rateData}
        {...accessors}
        stroke="var(--tmnl-accent)"
      />
      <Tooltip
        snapTooltipToDatumX
        snapTooltipToDatumY
        showVerticalCrosshair
        renderTooltip={({ tooltipData }) => (
          <SignalRateTooltip datum={tooltipData?.nearestDatum} />
        )}
      />
    </XYChart>
  )
}
```

#### TSG.22.4.2.2 Area Series — Cumulative Signal Volume

```typescript
function CumulativeSignalChart({ width, height }: Dimensions) {
  const cumulativeData = useAtomValue(cumulativeSignalAtom)

  return (
    <XYChart
      width={width}
      height={height}
      xScale={{ type: 'time' }}
      yScale={{ type: 'linear', nice: true }}
    >
      <Axis orientation="bottom" />
      <Axis orientation="left" />
      <AreaSeries
        dataKey="cumulative"
        data={cumulativeData}
        xAccessor={(d) => d.timestamp}
        yAccessor={(d) => d.total}
        fillOpacity={0.3}
        fill="var(--tmnl-accent)"
        lineProps={{ stroke: 'var(--tmnl-accent)' }}
      />
    </XYChart>
  )
}
```

#### TSG.22.4.2.3 Multi-Series — Source Comparison

When comparing signal rates across multiple adapter sources, each source MUST
render as a separate `LineSeries` with distinct stroke color from the ordinal
color map [TSG.22.10.1]:

```typescript
function MultiSourceRateChart({ width, height }: Dimensions) {
  const sourceData = useAtomValue(perSourceRateAtom)
  const sourceKeys = Object.keys(sourceData)

  return (
    <XYChart
      width={width}
      height={height}
      xScale={{ type: 'time' }}
      yScale={{ type: 'linear', nice: true }}
    >
      <Grid columns={false} numTicks={4} />
      <Axis orientation="bottom" numTicks={6} />
      <Axis orientation="left" numTicks={4} />
      {sourceKeys.map((sourceId) => (
        <LineSeries
          key={sourceId}
          dataKey={sourceId}
          data={sourceData[sourceId]}
          xAccessor={(d) => d.timestamp}
          yAccessor={(d) => d.count}
          stroke={sourceColorScale(sourceId)}
        />
      ))}
      <Tooltip
        showSeriesGlyphs
        renderTooltip={({ tooltipData }) => (
          <MultiSourceTooltip data={tooltipData} />
        )}
      />
    </XYChart>
  )
}
```

### TSG.22.4.3 Bar Charts

#### TSG.22.4.3.1 Signal Kind Distribution

Bar charts display categorical signal distributions using `@visx/xychart`
BarSeries with `scaleBand` on the ordinal axis:

```typescript
function SignalKindDistribution({ width, height }: Dimensions) {
  const kindCounts = useAtomValue(signalKindCountAtom)

  return (
    <XYChart
      width={width}
      height={height}
      xScale={{ type: 'band', paddingInner: 0.3 }}
      yScale={{ type: 'linear', nice: true }}
    >
      <Grid columns={false} numTicks={4} />
      <Axis orientation="bottom" />
      <Axis orientation="left" />
      <BarSeries
        dataKey="kind-distribution"
        data={kindCounts}
        xAccessor={(d) => d.kind}
        yAccessor={(d) => d.count}
        colorAccessor={(d) => kindColorScale(d.kind)}
      />
    </XYChart>
  )
}
```

#### TSG.22.4.3.2 Stacked Bars — Source x Kind Comparison

For comparing signal kind distributions across multiple sources, stacked bars
use multiple `BarSeries` with the same x-axis (time bucket or source):

```typescript
function StackedSourceComparison({ width, height }: Dimensions) {
  const distribution = useAtomValue(signalSourceDistributionAtom)

  return (
    <XYChart
      width={width}
      height={height}
      xScale={{ type: 'band', paddingInner: 0.2 }}
      yScale={{ type: 'linear', nice: true }}
    >
      <Axis orientation="bottom" />
      <Axis orientation="left" />
      {SIGNAL_KINDS.map((kind) => (
        <BarSeries
          key={kind}
          dataKey={kind}
          data={distribution}
          xAccessor={(d) => d.source}
          yAccessor={(d) => d.counts[kind] ?? 0}
          colorAccessor={() => kindColorScale(kind)}
        />
      ))}
    </XYChart>
  )
}
```

### TSG.22.4.4 Heatmap — Signal Density by Time x Frequency

The heatmap is a critical visualization for spectrum analysis, rendering signal
density across a 2D grid of time (x-axis) and frequency (y-axis). This provides
a spectrogram-like 2D view complementing the p5 layer's 3D waterfall [TSG.3.4].

```typescript
import { HeatmapRect } from '@visx/heatmap'
import { scaleLinear, scaleTime } from '@visx/scale'

type SpectralBin = {
  readonly timeBucket: Date
  readonly frequencyBin: number
  readonly magnitude: number  // dBFS
}

function SpectralHeatmap({ width, height }: Dimensions) {
  const spectralData = useAtomValue(spectralDensityAtom)
  const margin = { top: 20, right: 20, bottom: 40, left: 60 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const timeBuckets = useMemo(
    () => Array.from(new Set(spectralData.map((d) => d.timeBucket.getTime()))),
    [spectralData]
  )
  const freqBins = useMemo(
    () => Array.from(new Set(spectralData.map((d) => d.frequencyBin))).sort(),
    [spectralData]
  )

  const xScale = useMemo(
    () => scaleBand({ domain: timeBuckets, range: [0, innerWidth] }),
    [timeBuckets, innerWidth]
  )
  const yScale = useMemo(
    () => scaleBand({ domain: freqBins, range: [innerHeight, 0] }),
    [freqBins, innerHeight]
  )
  const colorScale = useMemo(
    () => scaleLinear({
      domain: [-100, -60, -30, 0],
      range: ['#000033', '#0066cc', '#00cc66', '#ff3300'],
    }),
    []
  )

  const binWidth = innerWidth / timeBuckets.length
  const binHeight = innerHeight / freqBins.length

  return (
    <svg width={width} height={height}>
      <Group top={margin.top} left={margin.left}>
        <HeatmapRect
          data={spectralData}
          xScale={(d) => xScale(d.timeBucket.getTime()) ?? 0}
          yScale={(d) => yScale(d.frequencyBin) ?? 0}
          colorScale={colorScale}
          binWidth={binWidth}
          binHeight={binHeight}
          gap={0}
        >
          {(heatmap) =>
            heatmap.map((bins) =>
              bins.map((bin) => (
                <rect
                  key={`heatmap-rect-${bin.row}-${bin.column}`}
                  width={bin.width}
                  height={bin.height}
                  x={bin.x}
                  y={bin.y}
                  fill={bin.color}
                />
              ))
            )
          }
        </HeatmapRect>
        <AxisBottom scale={xScale} top={innerHeight} />
        <AxisLeft scale={yScale} />
      </Group>
    </svg>
  )
}
```

### TSG.22.4.5 Scatter — Signal Correlation Plots

Scatter plots use `GlyphSeries` in `@visx/xychart` to render multi-dimensional
signal features. The primary use case is confidence-vs-recency correlation:

```typescript
function SignalCorrelationPlot({ width, height }: Dimensions) {
  const features = useAtomValue(signalFeatureAtom)

  return (
    <XYChart
      width={width}
      height={height}
      xScale={{ type: 'linear', domain: [0, 1], nice: true }}
      yScale={{ type: 'time' }}
    >
      <Grid numTicks={5} />
      <Axis orientation="bottom" label="Confidence" />
      <Axis orientation="left" label="Time Observed" />
      <GlyphSeries
        dataKey="correlation"
        data={features}
        xAccessor={(d) => d.confidence}
        yAccessor={(d) => d.firstObserved}
        colorAccessor={(d) => kindColorScale(d.kind)}
        size={(d) => Math.max(4, d.severity * 8)}
        renderGlyph={({ x, y, size, color, datum }) => (
          <circle
            cx={x}
            cy={y}
            r={size / 2}
            fill={color}
            fillOpacity={0.7}
            stroke={color}
            strokeWidth={1}
          />
        )}
      />
      <Tooltip renderTooltip={({ tooltipData }) => (
        <CorrelationTooltip datum={tooltipData?.nearestDatum} />
      )} />
    </XYChart>
  )
}
```

### TSG.22.4.6 Network — 2D Force-Directed Graph

`@visx/network` provides a 2D complement to the R3F 3D force graph [TSG.3.2].
The 2D view is used when the analyst needs a simpler, more readable entity
relationship view or when WebGL is unavailable.

```typescript
import { Graph, DefaultNode, DefaultLink } from '@visx/network'

type EntityNode = {
  readonly x: number
  readonly y: number
  readonly id: string
  readonly kind: string
}

type RelationshipLink = {
  readonly source: EntityNode
  readonly target: EntityNode
  readonly type: string
  readonly confidence: number
}

function EntityRelationshipGraph({ width, height }: Dimensions) {
  const correlations = useAtomValue(crossCorrelationAtom)
  const { nodes, links } = useMemo(
    () => buildNetworkLayout(correlations, width, height),
    [correlations, width, height]
  )

  return (
    <svg width={width} height={height}>
      <Graph
        graph={{ nodes, links }}
        nodeComponent={({ node }) => (
          <DefaultNode
            fill={kindColorScale(node.kind)}
            r={6}
          />
        )}
        linkComponent={({ link }) => (
          <DefaultLink
            link={link}
            stroke="var(--tmnl-muted)"
            strokeWidth={Math.max(1, link.confidence * 3)}
            strokeOpacity={0.6}
          />
        )}
      />
    </svg>
  )
}
```

### TSG.22.4.7 Hierarchy — Treemap and Sunburst

#### TSG.22.4.7.1 Treemap — Signal Taxonomy

The treemap displays signal taxonomy as nested rectangles sized by signal count:

```
┌────────────────────────────────────────────────────┐
│  indicator (45%)                                    │
│  ┌──────────────────┐ ┌────────────┐ ┌───────────┐ │
│  │ ip-addr (25%)    │ │domain (12%)│ │ url (8%)  │ │
│  │                  │ │            │ │           │ │
│  └──────────────────┘ └────────────┘ └───────────┘ │
├────────────────────────┬───────────────────────────┤
│  malware (30%)         │  attack-pattern (25%)      │
│  ┌────────┐ ┌────────┐ │  ┌──────────┐ ┌─────────┐ │
│  │ trojan │ │ransomwr│ │  │ T1566    │ │ T1059   │ │
│  └────────┘ └────────┘ │  └──────────┘ └─────────┘ │
└────────────────────────┴───────────────────────────┘
```

#### TSG.22.4.7.2 Sunburst — Hierarchical Classification

The sunburst (radial partition) provides drill-down through signal classification
hierarchy: kind > subtype > source > confidence level.

```typescript
import { Partition } from '@visx/hierarchy'
import { hierarchy } from 'd3-hierarchy'
import { scaleOrdinal } from '@visx/scale'
import { Arc } from '@visx/shape'

function SignalTaxonomySunburst({ width, height }: Dimensions) {
  const taxonomy = useAtomValue(signalTaxonomyAtom)
  const root = useMemo(
    () => hierarchy(taxonomy).sum((d) => d.count),
    [taxonomy]
  )
  const radius = Math.min(width, height) / 2

  return (
    <svg width={width} height={height}>
      <Group top={height / 2} left={width / 2}>
        <Partition root={root} size={[2 * Math.PI, radius]}>
          {(partitioned) =>
            partitioned.descendants().map((node, i) => (
              <Arc
                key={`arc-${i}`}
                data={node}
                innerRadius={node.y0}
                outerRadius={node.y1}
                startAngle={node.x0}
                endAngle={node.x1}
                fill={kindColorScale(node.data.kind)}
                fillOpacity={1 - node.depth * 0.15}
                stroke="var(--tmnl-bg)"
                strokeWidth={1}
              />
            ))
          }
        </Partition>
      </Group>
    </svg>
  )
}
```

---

## TSG.22.5 Signal Timeline

### TSG.22.5.1 Temporal Axis Architecture

The signal timeline is the most important visx visualization in Tsingou. It
renders signal events along a temporal axis with brush selection for time range
filtering and zoom for temporal detail.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Signal Timeline                                                     │
│                                                                      │
│  ▲ count                                                             │
│  │                                                                   │
│  │  ████                         ██████                              │
│  │  ████  ██                     ██████ ████                         │
│  │  ████  ████  ██          ██   ██████ ████████                     │
│  │  ████  ████  ████  ██    ██   ██████ ████████  ██                 │
│  │  ████  ████  ████  ████  ██   ██████ ████████  ████  ██           │
│  └──┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────▶ time   │
│    00:00  02:00  04:00  06:00  08:00  10:00  12:00  14:00  16:00     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  ░░░░░░░░░░░░█████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ││
│  │              ◄── brush selection ──►                              ││
│  └──────────────────────────────────────────────────────────────────┘│
│  minimap / overview                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### TSG.22.5.2 Brush Selection for Time Range Filtering

The brush interaction uses `@visx/brush` to enable analysts to select a time
range. The selected range updates a shared atom that filters data across all
layers:

```typescript
import { Brush } from '@visx/brush'
import { PatternLines } from '@visx/pattern'
import { scaleTime, scaleLinear } from '@visx/scale'

const selectedTimeRangeAtom = Atom.make<{
  start: Date
  end: Date
} | null>(null)

function TimelineBrush({ width, height, data }: TimelineBrushProps) {
  const brushHeight = 40
  const margin = { top: 0, right: 20, bottom: 20, left: 60 }
  const innerWidth = width - margin.left - margin.right

  const timeScale = useMemo(
    () => scaleTime({
      domain: [earliest(data), latest(data)],
      range: [0, innerWidth],
    }),
    [data, innerWidth]
  )

  const onBrushChange = useCallback((domain: Bounds | null) => {
    if (!domain) {
      setAtom(selectedTimeRangeAtom, null)
      return
    }
    setAtom(selectedTimeRangeAtom, {
      start: new Date(domain.x0),
      end: new Date(domain.x1),
    })
  }, [])

  return (
    <svg width={width} height={brushHeight + margin.bottom}>
      <Group left={margin.left}>
        <PatternLines
          id="brush-pattern"
          height={8}
          width={8}
          stroke="var(--tmnl-accent)"
          strokeWidth={1}
          orientation={['diagonal']}
        />
        {/* Minimap overview bars */}
        {data.map((d, i) => (
          <rect
            key={i}
            x={timeScale(d.timestamp)}
            y={brushHeight - (d.count / maxCount) * brushHeight}
            width={Math.max(1, innerWidth / data.length - 1)}
            height={(d.count / maxCount) * brushHeight}
            fill="var(--tmnl-muted)"
          />
        ))}
        <Brush
          xScale={timeScale}
          yScale={scaleLinear({ domain: [0, 1], range: [brushHeight, 0] })}
          width={innerWidth}
          height={brushHeight}
          handleSize={8}
          resizeTriggerAreas={['left', 'right']}
          brushDirection="horizontal"
          onChange={onBrushChange}
          selectedBoxStyle={{
            fill: 'url(#brush-pattern)',
            stroke: 'var(--tmnl-accent)',
          }}
        />
        <AxisBottom scale={timeScale} top={brushHeight} numTicks={8} />
      </Group>
    </svg>
  )
}
```

### TSG.22.5.3 Zoom for Temporal Detail

Zoom uses `@visx/zoom` to provide pan and zoom on the main timeline chart. The
zoom transform is applied to the time scale, allowing analysts to drill into
specific time windows:

```typescript
import { Zoom } from '@visx/zoom'

function ZoomableTimeline({ width, height, data }: ZoomableTimelineProps) {
  const margin = { top: 20, right: 20, bottom: 40, left: 60 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  return (
    <Zoom
      width={innerWidth}
      height={innerHeight}
      scaleXMin={1}
      scaleXMax={100}
      scaleYMin={1}
      scaleYMax={1}
      transformMatrix={{
        scaleX: 1, scaleY: 1,
        translateX: 0, translateY: 0,
        skewX: 0, skewY: 0,
      }}
    >
      {(zoom) => {
        const rescaledTimeScale = zoom.transformMatrix.scaleX !== 1
          ? timeScale.copy().range([
              zoom.transformMatrix.translateX,
              zoom.transformMatrix.translateX +
                innerWidth * zoom.transformMatrix.scaleX,
            ])
          : timeScale

        return (
          <svg width={width} height={height}>
            <rect
              width={innerWidth}
              height={innerHeight}
              x={margin.left}
              y={margin.top}
              fill="transparent"
              ref={zoom.containerRef}
              onWheel={zoom.handleWheel}
              onMouseDown={zoom.dragStart}
              onMouseMove={zoom.dragMove}
              onMouseUp={zoom.dragEnd}
              style={{ cursor: zoom.isDragging ? 'grabbing' : 'grab' }}
            />
            <Group top={margin.top} left={margin.left}>
              <clipPath id="timeline-clip">
                <rect width={innerWidth} height={innerHeight} />
              </clipPath>
              <g clipPath="url(#timeline-clip)">
                {/* Render data with rescaled time scale */}
                {data.map((d, i) => (
                  <circle
                    key={i}
                    cx={rescaledTimeScale(d.timestamp)}
                    cy={valueScale(d.value)}
                    r={3}
                    fill={kindColorScale(d.kind)}
                  />
                ))}
              </g>
              <AxisBottom scale={rescaledTimeScale} top={innerHeight} />
              <AxisLeft scale={valueScale} />
            </Group>
          </svg>
        )
      }}
    </Zoom>
  )
}
```

### TSG.22.5.4 Timeline Event Markers

Signal events on the timeline SHOULD be annotated with event markers using
`@visx/annotation` for significant signals (high severity, anomaly triggers):

```
  ▲ value
  │                    ┌── Annotation ──────────┐
  │         *          │ T1566.001 Phishing      │
  │        / \     ◄───│ Confidence: 0.92        │
  │  ─────/───\───────│ Source: STIX-TAXII-001  │
  │      /     \      └─────────────────────────┘
  │     /       \
  └────────────────────────────────────────────▶ time
```

---

## TSG.22.6 Spectrum Display

### TSG.22.6.1 FFT Magnitude Line Plots

The visx layer provides 2D FFT magnitude line plots as a complement to the p5
layer's 3D waterfall display [TSG.3.4]. This is a snapshot view: a single FFT
frame rendered as amplitude vs. frequency.

```
  ▲ Magnitude (dBFS)
  │
  0├──────────────────────────────────────────────────
  │
 -20├         ╱╲
  │        ╱  ╲              ╱╲
 -40├───────╱────╲────────────╱──╲──────────────────── threshold
  │      ╱      ╲          ╱    ╲
 -60├─────╱────────╲────────╱──────╲───────────────────
  │    ╱          ╲      ╱        ╲         ╱╲
 -80├───╱────────────╲────╱──────────╲───────╱──╲──────
  │  ╱              ╲──╱            ╲─────╱    ╲───
-100├╱────────────────────────────────────────────╲────
  └────┬─────┬─────┬─────┬─────┬─────┬─────┬─────▶
      0    200    400    600    800   1000  1200  freq (MHz)
```

Implementation uses `@visx/shape` LinePath with `scaleLog` or `scaleLinear` for
the frequency axis and `scaleLinear` for the magnitude axis:

```typescript
import { LinePath } from '@visx/shape'
import { scaleLinear, scaleLog } from '@visx/scale'
import { curveMonotoneX } from '@visx/curve'

function FFTMagnitudePlot({ width, height }: Dimensions) {
  const fftData = useAtomValue(fftMagnitudesAtom)
  const margin = { top: 20, right: 20, bottom: 40, left: 60 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const freqScale = useMemo(
    () => scaleLinear({
      domain: [fftData[0]?.frequency ?? 0, fftData[fftData.length - 1]?.frequency ?? 1],
      range: [0, innerWidth],
    }),
    [fftData, innerWidth]
  )

  const magScale = useMemo(
    () => scaleLinear({
      domain: [-100, 0],
      range: [innerHeight, 0],
    }),
    [innerHeight]
  )

  return (
    <svg width={width} height={height}>
      <Group top={margin.top} left={margin.left}>
        <GridRows scale={magScale} width={innerWidth} stroke="var(--tmnl-border)" />
        <LinePath
          data={fftData}
          x={(d) => freqScale(d.frequency)}
          y={(d) => magScale(d.magnitude)}
          stroke="var(--tmnl-accent)"
          strokeWidth={1.5}
          curve={curveMonotoneX}
        />
        {/* Noise floor threshold line */}
        <line
          x1={0}
          x2={innerWidth}
          y1={magScale(-40)}
          y2={magScale(-40)}
          stroke="var(--tmnl-warning)"
          strokeDasharray="4,4"
          strokeWidth={1}
        />
        <AxisBottom scale={freqScale} top={innerHeight} label="Frequency (MHz)" />
        <AxisLeft scale={magScale} label="Magnitude (dBFS)" />
      </Group>
    </svg>
  )
}
```

### TSG.22.6.2 Spectrogram 2D — Heatmap View

The spectrogram 2D view is a time-frequency heatmap using `@visx/heatmap` as
defined in [TSG.22.4.4]. This provides a flat 2D complement to the p5 layer's
scrolling 3D waterfall [TSG.3.4.2]:

| Dimension | Spectrogram 2D (visx)       | Waterfall 3D (p5)                    |
|-----------|-----------------------------|--------------------------------------|
| X axis    | Time (scaleTime)            | Frequency (pixel column)             |
| Y axis    | Frequency (scaleLinear)     | Time (scroll axis)                   |
| Color     | Magnitude → heatmap color   | Magnitude → HSB hue                  |
| Rendering | SVG `<rect>` per bin        | Canvas pixel manipulation             |
| Use case  | Overview, static analysis   | Real-time scrolling display           |
| Max bins  | ~5000 (SVG limit)           | ~400K pixels/frame (Canvas)           |

---

## TSG.22.7 Data Binding from Atom State

### TSG.22.7.1 Reactive Re-Render Pipeline

The data binding pipeline flows from atom state through scale computation to
chart rendering. This pipeline MUST be entirely reactive — charts re-render
when atom values change, with no imperative data pushing.

```
┌──────────────────────┐
│  OutputBridge         │
│  (upstream pipeline)  │
└──────────┬───────────┘
           │ Atom.set()
           ▼
┌──────────────────────┐
│  Atom Store           │
│  - activeSignalsAtom  │
│  - fftMagnitudesAtom  │
│  - crossCorrelationA. │
└──────────┬───────────┘
           │ useAtomValue()
           ▼
┌──────────────────────┐
│  Scale Computation    │
│  (useMemo)            │
│  - domain: data range │
│  - range: pixel space │
└──────────┬───────────┘
           │ scale(datum)
           ▼
┌──────────────────────┐
│  Chart Rendering      │
│  (React reconcile)    │
│  - SVG elements       │
│  - Canvas draw calls  │
└──────────────────────┘
```

### TSG.22.7.2 Scale Domain Computation

Scale domains MUST be computed from the atom data using `useMemo` to prevent
unnecessary recalculation:

```typescript
function useTimeScale(
  data: readonly SignalRatePoint[],
  width: number
) {
  return useMemo(
    () => scaleTime<number>({
      domain: [
        Math.min(...data.map((d) => d.timestamp.getTime())),
        Math.max(...data.map((d) => d.timestamp.getTime())),
      ],
      range: [0, width],
      nice: true,
    }),
    [data, width]
  )
}

function useLinearScale(
  data: readonly SignalRatePoint[],
  height: number,
  accessor: (d: SignalRatePoint) => number
) {
  return useMemo(
    () => scaleLinear<number>({
      domain: [0, Math.max(...data.map(accessor))],
      range: [height, 0],
      nice: true,
    }),
    [data, height, accessor]
  )
}
```

### TSG.22.7.3 Atom Subscription Rules

| Rule                                                          | Enforcement               |
|---------------------------------------------------------------|---------------------------|
| Charts MUST subscribe via `useAtomValue()`, never `useState`  | [TSG.4.1] Atom-as-State   |
| Charts MUST NOT subscribe to atoms they do not render         | [TSG.3.6.2] Selective sub |
| Scale computation MUST be memoized with `useMemo`             | Performance               |
| Atom data MUST NOT be mutated in the chart component          | Immutability              |
| Charts MUST NOT trigger atom updates (read-only consumers)    | Unidirectional flow       |

### TSG.22.7.4 Derived Atoms for Chart-Specific Projections

When a chart needs a projection of raw data (e.g., time-bucketed counts from
raw signals), implementations SHOULD create derived atoms rather than computing
the projection in the render function:

```typescript
// Derived atom: raw signals → time-bucketed rate counts
const signalRateAtom = Atom.derive((get) => {
  const signals = get(activeSignalsAtom)
  return bucketByTime(signals, '5m')  // 5-minute buckets
})

// Derived atom: raw signals → kind distribution counts
const signalKindCountAtom = Atom.derive((get) => {
  const signals = get(activeSignalsAtom)
  return countByKind(signals)
})

// Chart subscribes to the derived atom, not the raw data
function SignalRateChart({ width, height }: Dimensions) {
  const rateData = useAtomValue(signalRateAtom)  // pre-bucketed
  // ...render with rateData directly
}
```

This pattern ensures that:
1. Projection computation runs once per atom update, not once per render
2. Multiple charts sharing the same projection share the computed result
3. React reconciliation receives stable references when data is unchanged

---

## TSG.22.8 Scale Types and Configuration

### TSG.22.8.1 Scale Type Reference

| Scale Type     | visx Function     | Domain               | Range           | Tsingou Use Case                              |
|----------------|-------------------|----------------------|-----------------|-----------------------------------------------|
| `scaleLinear`  | `scaleLinear()`   | Numeric [min, max]   | Pixel [0, w/h]  | Signal count, magnitude, confidence            |
| `scaleLog`     | `scaleLog()`      | Numeric [min, max]   | Pixel [0, w/h]  | Frequency axis (logarithmic Hz scale)          |
| `scaleTime`    | `scaleTime()`     | Date [start, end]    | Pixel [0, w]    | Temporal axis on all time series               |
| `scaleOrdinal` | `scaleOrdinal()`  | String[]             | Color[]         | Signal kind → color mapping                    |
| `scaleBand`    | `scaleBand()`     | String[]             | Pixel [0, w]    | Bar chart categories (signal kinds, sources)   |
| `scaleThreshold`| `scaleThreshold()`| Numeric breakpoints | Color[]         | Threat level → sequential color                |
| `scaleQuantize`| `scaleQuantize()` | Numeric [min, max]  | Color[]         | Heatmap magnitude → discrete color steps       |

### TSG.22.8.2 Scale Configuration Table

| Chart Type         | X Scale           | Y Scale           | Color Scale               |
|--------------------|-------------------|--------------------|---------------------------|
| Time series        | `scaleTime`       | `scaleLinear`      | `scaleOrdinal` (series)   |
| Bar chart          | `scaleBand`       | `scaleLinear`      | `scaleOrdinal` (kind)     |
| Heatmap            | `scaleTime/Band`  | `scaleLinear/Band` | `scaleLinear` (magnitude) |
| Scatter            | `scaleLinear`     | `scaleTime`        | `scaleOrdinal` (kind)     |
| FFT magnitude      | `scaleLinear/Log` | `scaleLinear`      | (single stroke color)     |
| Network graph      | `scaleLinear`     | `scaleLinear`      | `scaleOrdinal` (kind)     |
| Treemap/sunburst   | (layout-driven)   | (layout-driven)    | `scaleOrdinal` (kind)     |

### TSG.22.8.3 Scale Invariants

1. All scales MUST use `nice: true` for numeric/time domains to produce
   human-readable tick values.
2. Time scales MUST use UTC-aware Date objects to prevent timezone skew.
3. Log scales MUST clamp the domain minimum to a positive value (e.g., 1 Hz,
   not 0 Hz) to avoid `log(0) = -Infinity`.
4. Ordinal color scales MUST use the Tsingou color palette defined in
   [TSG.22.10].
5. Scale domain recomputation MUST be gated behind `useMemo` with correct
   dependency arrays.

---

## TSG.22.9 Axis Formatting

### TSG.22.9.1 Time-Aware Tick Labels

Temporal axes MUST format tick labels based on the visible time span to prevent
label collision and maximize readability:

| Visible Span    | Tick Interval  | Label Format                 | Example          |
|-----------------|----------------|------------------------------|------------------|
| < 1 minute      | 5 seconds      | `HH:mm:ss`                  | `14:32:05`       |
| 1-60 minutes    | 1-5 minutes    | `HH:mm`                     | `14:32`          |
| 1-24 hours      | 1-4 hours      | `HH:mm`                     | `14:00`          |
| 1-7 days        | 1 day          | `MMM dd`                    | `Feb 18`         |
| 7-30 days       | 7 days         | `MMM dd`                    | `Feb 18`         |
| > 30 days       | 1 month        | `MMM yyyy`                  | `Feb 2026`       |

Implementation SHOULD use a format selector based on scale domain extent:

```typescript
function timeTickFormat(scale: ScaleTime<number, number>) {
  const [start, end] = scale.domain()
  const spanMs = end.getTime() - start.getTime()
  const spanHours = spanMs / (1000 * 60 * 60)

  if (spanHours < 1) return timeFormat('%H:%M:%S')
  if (spanHours < 24) return timeFormat('%H:%M')
  if (spanHours < 168) return timeFormat('%b %d')  // 7 days
  if (spanHours < 720) return timeFormat('%b %d')   // 30 days
  return timeFormat('%b %Y')
}
```

### TSG.22.9.2 SI Prefix for Large Numbers

Value axes displaying large numbers (signal counts, byte sizes, frequencies)
MUST use SI prefix formatting:

| Value Range        | SI Prefix | Formatted Example  |
|--------------------|-----------|--------------------|
| < 1,000            | (none)    | `842`              |
| 1,000 - 999,999    | k         | `12.4k`            |
| 1,000,000+         | M         | `3.2M`             |
| 1,000,000,000+     | G         | `1.8G`             |

```typescript
function siFormat(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}G`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return `${Math.round(value)}`
}
```

### TSG.22.9.3 Rotated Labels for Dense Axes

When category labels on the x-axis exceed the available space per tick (e.g.,
STIX attack pattern names, long source identifiers), labels MUST be rotated
to prevent overlap:

```typescript
<AxisBottom
  scale={bandScale}
  top={innerHeight}
  tickLabelProps={() => ({
    angle: -45,
    textAnchor: 'end',
    fontSize: 'var(--tmnl-text-xs)',  // 12px floor
    dy: '0.25em',
  })}
/>
```

Rotation angles MUST NOT exceed -60 degrees. If labels still collide at -45
degrees, implementations SHOULD reduce the number of visible ticks or truncate
label text with an ellipsis and full text in the tooltip.

### TSG.22.9.4 Frequency Axis Formatting

Frequency axes for spectrum displays MUST use engineering notation:

| Frequency Range | Unit  | Example      |
|-----------------|-------|--------------|
| < 1 kHz         | Hz    | `440 Hz`     |
| 1 kHz - 999 kHz | kHz   | `88.1 kHz`   |
| 1 MHz - 999 MHz | MHz   | `433.9 MHz`  |
| 1 GHz+          | GHz   | `2.4 GHz`    |

---

## TSG.22.10 Color Encoding

### TSG.22.10.1 Signal Kind Color Map (Ordinal)

Signal kinds are mapped to colors via `scaleOrdinal`. The palette MUST be
perceptually distinct and colorblind-safe:

| Signal Kind        | Color Variable           | Hex        | WCAG AA  |
|--------------------|--------------------------|------------|----------|
| `indicator`        | `--tsngu-kind-indicator` | `#4C9AFF`  | Pass     |
| `malware`          | `--tsngu-kind-malware`   | `#FF5630`  | Pass     |
| `attack-pattern`   | `--tsngu-kind-attack`    | `#FF991F`  | Pass     |
| `threat-actor`     | `--tsngu-kind-actor`     | `#6554C0`  | Pass     |
| `vulnerability`    | `--tsngu-kind-vuln`      | `#00B8D9`  | Pass     |
| `campaign`         | `--tsngu-kind-campaign`  | `#36B37E`  | Pass     |
| `identity`         | `--tsngu-kind-identity`  | `#8993A4`  | Pass     |
| `observed-data`    | `--tsngu-kind-observed`  | `#97A0AF`  | Pass     |
| `infrastructure`   | `--tsngu-kind-infra`     | `#C1C7D0`  | Pass     |

```typescript
const SIGNAL_KIND_COLORS = {
  'indicator':      '#4C9AFF',
  'malware':        '#FF5630',
  'attack-pattern': '#FF991F',
  'threat-actor':   '#6554C0',
  'vulnerability':  '#00B8D9',
  'campaign':       '#36B37E',
  'identity':       '#8993A4',
  'observed-data':  '#97A0AF',
  'infrastructure': '#C1C7D0',
} as const

const kindColorScale = scaleOrdinal({
  domain: Object.keys(SIGNAL_KIND_COLORS),
  range: Object.values(SIGNAL_KIND_COLORS),
})
```

### TSG.22.10.2 Threat Level Color Map (Sequential)

Threat severity is encoded as a sequential color gradient from low (cool) to
critical (hot):

| Threat Level | Color   | Hex        | Use Case                     |
|--------------|---------|------------|------------------------------|
| None         | Gray    | `#505F79`  | Informational signals        |
| Low          | Blue    | `#2684FF`  | Low-severity indicators      |
| Medium       | Yellow  | `#FFAB00`  | Medium-severity alerts       |
| High         | Orange  | `#FF5630`  | High-severity threats        |
| Critical     | Red     | `#DE350B`  | Critical / active compromise |

```typescript
const threatColorScale = scaleThreshold<number, string>({
  domain: [0.2, 0.4, 0.6, 0.8],
  range: ['#505F79', '#2684FF', '#FFAB00', '#FF5630', '#DE350B'],
})
```

### TSG.22.10.3 Confidence to Opacity Mapping

Signal confidence (0.0 to 1.0) is encoded as SVG fill opacity. Higher
confidence produces more opaque rendering:

```typescript
function confidenceToOpacity(confidence: number): number {
  return Math.max(0.15, confidence)  // Floor at 15% to remain visible
}

// Usage in scatter plot:
<circle
  fill={kindColorScale(datum.kind)}
  fillOpacity={confidenceToOpacity(datum.confidence)}
/>
```

### TSG.22.10.4 Heatmap Color Ramp

The heatmap uses a multi-stop linear gradient mapping magnitude (dBFS) to color.
This ramp MUST be consistent with the p5 waterfall color mapping [TSG.3.4.5]:

```
-100 dBFS ──▶ #000033 (dark blue / noise floor)
 -80 dBFS ──▶ #003366 (deep blue)
 -60 dBFS ──▶ #0066CC (blue)
 -40 dBFS ──▶ #00CC66 (green / threshold)
 -20 dBFS ──▶ #FFCC00 (yellow)
   0 dBFS ──▶ #FF3300 (red / clipping)
```

---

## TSG.22.11 Responsive Sizing

### TSG.22.11.1 ParentSize Wrapper

All visx charts MUST be wrapped in `@visx/responsive` `ParentSize` to receive
the parent container's dimensions. Charts MUST NOT use hardcoded pixel
dimensions:

```typescript
import { ParentSize } from '@visx/responsive'

function ResponsiveSignalRateChart() {
  return (
    <ParentSize debounceTime={150}>
      {({ width, height }) =>
        width > 0 && height > 0 ? (
          <SignalRateChart width={width} height={height} />
        ) : null
      }
    </ParentSize>
  )
}
```

### TSG.22.11.2 Debounced Resize Observer

`ParentSize` uses a `ResizeObserver` internally. The debounce time MUST be set
to at least 100ms to prevent excessive re-renders during window resize:

| Parameter      | Value   | Rationale                                        |
|----------------|---------|--------------------------------------------------|
| `debounceTime` | 150ms   | Prevents rapid re-render during drag-resize       |
| Min width      | 200px   | Below this, chart elements overlap                |
| Min height     | 120px   | Below this, axes consume all space                |

### TSG.22.11.3 Responsive Breakpoint Handling

Charts MUST adapt their rendering complexity based on available width:

| Width Range    | Adaptation                                              |
|----------------|---------------------------------------------------------|
| < 300px        | Hide axes, show data only (sparkline mode)              |
| 300-600px      | Show one axis (bottom), reduce tick count to 3-4         |
| 600-1000px     | Show both axes, standard tick count (5-6)               |
| > 1000px       | Full chart with grid, legend, annotations               |

```typescript
function adaptToWidth(width: number) {
  if (width < 300) return { showAxes: false, showGrid: false, numTicks: 0 }
  if (width < 600) return { showAxes: true, showGrid: false, numTicks: 3 }
  if (width < 1000) return { showAxes: true, showGrid: true, numTicks: 5 }
  return { showAxes: true, showGrid: true, numTicks: 8 }
}
```

### TSG.22.11.4 Margin Convention

All charts MUST use a consistent margin convention to prevent axis labels from
being clipped:

```typescript
type ChartMargin = {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

const DEFAULT_MARGIN: ChartMargin = {
  top: 20,
  right: 20,
  bottom: 40,  // space for x-axis labels
  left: 60,    // space for y-axis labels (SI prefix numbers)
}

const COMPACT_MARGIN: ChartMargin = {
  top: 8,
  right: 8,
  bottom: 24,
  left: 40,
}
```

---

## TSG.22.12 Annotation Layers

### TSG.22.12.1 Threshold Lines

Threshold lines mark reference values on charts. Common uses include anomaly
detection baselines, noise floor levels, and SLA targets:

```typescript
import { Annotation, Label, Connector } from '@visx/annotation'

function ThresholdLine({
  scale,
  value,
  label,
  width,
  color = 'var(--tmnl-warning)',
}: ThresholdLineProps) {
  const y = scale(value)

  return (
    <g>
      <line
        x1={0}
        x2={width}
        y1={y}
        y2={y}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="6,3"
      />
      <text
        x={width - 4}
        y={y - 4}
        textAnchor="end"
        fill={color}
        fontSize="var(--tmnl-text-xs)"
      >
        {label}
      </text>
    </g>
  )
}
```

### TSG.22.12.2 Event Markers

Event markers annotate specific timestamps on the timeline with contextual
information (e.g., "Adapter disconnected", "Anomaly spike detected"):

```typescript
function EventMarker({
  timeScale,
  event,
  chartHeight,
}: EventMarkerProps) {
  const x = timeScale(event.timestamp)

  return (
    <Annotation x={x} y={20} dx={0} dy={chartHeight - 40}>
      <Connector stroke="var(--tmnl-accent)" type="line" />
      <Label
        title={event.title}
        subtitle={event.description}
        showAnchorLine={false}
        backgroundFill="var(--tmnl-surface)"
        backgroundPadding={6}
        titleFontSize={12}  // 12px floor
        subtitleFontSize={12}
        fontColor="var(--tmnl-text)"
        width={160}
      />
      {/* Vertical marker line */}
      <line
        x1={x}
        x2={x}
        y1={0}
        y2={chartHeight}
        stroke="var(--tmnl-accent)"
        strokeWidth={1}
        strokeDasharray="4,2"
        opacity={0.6}
      />
    </Annotation>
  )
}
```

### TSG.22.12.3 Anomaly Highlight Regions

Anomalous time ranges are highlighted using `@visx/shape` `AreaClosed` with
reduced opacity, creating a shaded background region:

```typescript
import { AreaClosed } from '@visx/shape'

function AnomalyHighlight({
  timeScale,
  start,
  end,
  chartHeight,
  color = 'var(--tmnl-error)',
}: AnomalyHighlightProps) {
  const x0 = timeScale(start)
  const x1 = timeScale(end)

  return (
    <rect
      x={x0}
      y={0}
      width={x1 - x0}
      height={chartHeight}
      fill={color}
      fillOpacity={0.08}
      stroke={color}
      strokeWidth={1}
      strokeOpacity={0.3}
    />
  )
}
```

### TSG.22.12.4 Threshold Area (Above/Below)

`@visx/threshold` provides dual-area rendering that fills differently above and
below a threshold value. This is used for baseline deviation visualization:

```typescript
import { Threshold } from '@visx/threshold'

function BaselineDeviationChart({ width, height, data, baseline }: Props) {
  return (
    <svg width={width} height={height}>
      <Group top={margin.top} left={margin.left}>
        <Threshold
          id="baseline-threshold"
          data={data}
          x={(d) => timeScale(d.timestamp)}
          y0={(d) => valueScale(d.value)}
          y1={() => valueScale(baseline)}
          clipAboveTo={0}
          clipBelowTo={innerHeight}
          aboveAreaProps={{
            fill: 'var(--tmnl-error)',
            fillOpacity: 0.2,
          }}
          belowAreaProps={{
            fill: 'var(--tmnl-success)',
            fillOpacity: 0.2,
          }}
        />
        {/* Baseline reference line */}
        <line
          x1={0}
          x2={innerWidth}
          y1={valueScale(baseline)}
          y2={valueScale(baseline)}
          stroke="var(--tmnl-muted)"
          strokeDasharray="4,4"
        />
      </Group>
    </svg>
  )
}
```

---

## TSG.22.13 Interaction Patterns

### TSG.22.13.1 Interaction Model Overview

The visx layer provides four primary interaction patterns. Each operates
independently but MAY coordinate through shared atoms:

```
┌─────────────────────────────────────────────────────┐
│  Interaction Layer                                   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐│
│  │  Brush   │  │   Zoom   │  │ Tooltip  │  │Cross-││
│  │          │  │          │  │          │  │ hair ││
│  │ time/freq│  │ pan/zoom │  │ nearest  │  │ vert ││
│  │ selection│  │ + minimap│  │ datum    │  │+horiz││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──┬───┘│
│       │             │             │            │    │
│       ▼             ▼             ▼            ▼    │
│  selectedTime   zoomTransform  hoveredDatum  cursor │
│  RangeAtom      (local state)  IdAtom        pos   │
└─────────────────────────────────────────────────────┘
```

### TSG.22.13.2 Brush Interaction

Brush enables rectangular selection over the chart area. Primary use cases:

| Brush Type       | Direction    | Atom Updated                | Cross-Layer Effect          |
|------------------|-------------|-----------------------------|-----------------------------|
| Time range       | Horizontal  | `selectedTimeRangeAtom`     | All charts filter to range  |
| Frequency range  | Horizontal  | `selectedFreqRangeAtom`     | Spectrum zooms to range     |
| 2D selection     | Both        | `selectedRegionAtom`        | Scatter plot selection       |

Brush implementation details are defined in [TSG.22.5.2].

The brush selection atom is a shared cross-layer atom per [TSG.3.7.3]. When the
analyst brushes a time range in the timeline, ALL rendering layers filter their
data to that range:

```
Timeline (visx) ──brush──▶ selectedTimeRangeAtom
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              R3F filter      visx filter      DOM filter
              (3D nodes)    (other charts)   (alert table)
```

### TSG.22.13.3 Zoom Interaction

Zoom provides pan and scale on the chart area via `@visx/zoom`. The zoom
transform is maintained as local component state (not an atom) because zoom
is chart-specific, not cross-layer.

Implementation details are defined in [TSG.22.5.3].

Zoom constraints:

| Parameter          | Value     | Rationale                                         |
|--------------------|-----------|---------------------------------------------------|
| `scaleXMin`        | 1         | Cannot zoom out past original domain               |
| `scaleXMax`        | 100       | Maximum 100x zoom into temporal detail             |
| `scaleYMin`        | 1         | Y-axis zoom disabled for most charts               |
| `scaleYMax`        | 1         | Y-axis auto-scales to visible data range           |
| Wheel sensitivity  | 0.001     | Smooth zoom increments                             |
| Double-click       | Reset     | Double-click resets zoom to initial state           |

### TSG.22.13.4 Tooltip Interaction

Tooltips display detailed information about the nearest datum to the cursor.
`@visx/tooltip` provides positioning logic and portal rendering.

```typescript
import {
  useTooltip,
  useTooltipInPortal,
  TooltipWithBounds,
} from '@visx/tooltip'
import { localPoint } from '@visx/event'
import { voronoiLayout } from '@visx/voronoi'

function ChartWithTooltip({ width, height, data }: Props) {
  const {
    tooltipOpen,
    tooltipData,
    tooltipLeft,
    tooltipTop,
    showTooltip,
    hideTooltip,
  } = useTooltip<SignalDatum>()

  const voronoi = useMemo(
    () => voronoiLayout<SignalDatum>({
      x: (d) => timeScale(d.timestamp),
      y: (d) => valueScale(d.value),
      width: innerWidth,
      height: innerHeight,
    })(data),
    [data, innerWidth, innerHeight]
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event)
      if (!point) return
      const nearest = voronoi.find(point.x - margin.left, point.y - margin.top)
      if (nearest) {
        showTooltip({
          tooltipData: nearest.data,
          tooltipLeft: timeScale(nearest.data.timestamp) + margin.left,
          tooltipTop: valueScale(nearest.data.value) + margin.top,
        })
      }
    },
    [voronoi, showTooltip]
  )

  return (
    <>
      <svg width={width} height={height}>
        {/* Chart content */}
        <rect
          width={innerWidth}
          height={innerHeight}
          x={margin.left}
          y={margin.top}
          fill="transparent"
          onMouseMove={handleMouseMove}
          onMouseLeave={hideTooltip}
        />
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          left={tooltipLeft}
          top={tooltipTop}
          style={{
            backgroundColor: 'var(--tmnl-surface)',
            color: 'var(--tmnl-text)',
            border: '1px solid var(--tmnl-border)',
            borderRadius: '4px',
            padding: '8px',
            fontSize: 'var(--tmnl-text-xs)',  // 12px floor
          }}
        >
          <SignalTooltipContent datum={tooltipData} />
        </TooltipWithBounds>
      )}
    </>
  )
}
```

Tooltip via Voronoi provides O(log n) nearest-datum lookup via Delaunay
triangulation, which is critical for performance with large datasets.

### TSG.22.13.5 Crosshair Interaction

Crosshair renders vertical and horizontal guide lines from the cursor position,
helping analysts read exact values from axes:

```typescript
import { Crosshair } from '@visx/xychart'

// Within XYChart:
<XYChart /* ... */>
  {/* ...series, axes... */}
  <Tooltip
    showVerticalCrosshair
    showHorizontalCrosshair
    verticalCrosshairStyle={{
      stroke: 'var(--tmnl-accent)',
      strokeDasharray: '4,2',
      strokeWidth: 1,
      opacity: 0.5,
    }}
    horizontalCrosshairStyle={{
      stroke: 'var(--tmnl-accent)',
      strokeDasharray: '4,2',
      strokeWidth: 1,
      opacity: 0.5,
    }}
    renderTooltip={/* ... */}
  />
</XYChart>
```

### TSG.22.13.6 Pointer Events and Layer Compositing

By default, the visx layer at z:1 has `pointer-events: none` [TSG.3.1.2]. For
interactive charts, specific SVG elements MUST selectively re-enable pointer
events:

```typescript
// Container SVG remains pointer-events: none (inherited from layer CSS)
// Interactive overlay rect enables pointer events for that area
<svg
  width={width}
  height={height}
  style={{ pointerEvents: 'none' }}  // layer default
>
  <Group top={margin.top} left={margin.left}>
    {/* Data elements: no pointer events */}
    {data.map((d) => <circle /* ... */ />)}

    {/* Interaction overlay: pointer events enabled */}
    <rect
      width={innerWidth}
      height={innerHeight}
      fill="transparent"
      style={{ pointerEvents: 'all' }}  // override for interaction
      onMouseMove={handleMouseMove}
      onMouseLeave={hideTooltip}
    />
  </Group>
</svg>
```

---

## TSG.22.14 Performance Optimization

### TSG.22.14.1 Performance Thresholds

| Metric                        | Threshold   | Measurement                           |
|-------------------------------|-------------|---------------------------------------|
| SVG DOM node count            | < 5,000     | `document.querySelectorAll('svg *')`  |
| Chart render time             | < 16ms      | React Profiler commit phase           |
| Scale computation             | < 2ms       | `performance.now()` around `useMemo`  |
| Tooltip response              | < 50ms      | Voronoi lookup + React render         |
| Brush update propagation      | < 100ms     | Atom set → all charts re-render       |
| Data decimation                | < 5ms       | LTTB algorithm for N points           |

### TSG.22.14.2 Canvas Fallback for >10k Data Points

When data point count exceeds the SVG performance threshold (~5,000 DOM nodes),
implementations MUST switch to Canvas rendering via `@visx/xychart`'s Canvas
support:

```typescript
function LargeDatasetChart({ width, height, data }: Props) {
  const useCanvas = data.length > 5000

  return (
    <XYChart
      width={width}
      height={height}
      xScale={{ type: 'time' }}
      yScale={{ type: 'linear' }}
    >
      {useCanvas ? (
        <GlyphSeries
          dataKey="large-dataset"
          data={data}
          xAccessor={(d) => d.timestamp}
          yAccessor={(d) => d.value}
          renderGlyph={({ x, y, color }) => (
            // Canvas-rendered glyphs
            <circle cx={x} cy={y} r={2} fill={color} />
          )}
        />
      ) : (
        <LineSeries
          dataKey="standard-dataset"
          data={data}
          xAccessor={(d) => d.timestamp}
          yAccessor={(d) => d.value}
        />
      )}
    </XYChart>
  )
}
```

### TSG.22.14.3 LTTB Data Decimation

Largest-Triangle-Three-Buckets (LTTB) is the preferred downsampling algorithm
for time series data. LTTB preserves visual shape while reducing point count:

```
Original:  10,000 points ────▶ LTTB(1000) ────▶ 1,000 points
                                                  (shape preserved)

Algorithm: For each bucket of N/M points:
  1. Divide data into M buckets
  2. For each bucket, select the point that forms the
     largest triangle with the previous and next selected points
  3. This maximizes visual fidelity per rendered point
```

```typescript
function lttbDecimate<T>(
  data: readonly T[],
  targetCount: number,
  xAccessor: (d: T) => number,
  yAccessor: (d: T) => number
): T[] {
  if (data.length <= targetCount) return [...data]

  const bucketSize = (data.length - 2) / (targetCount - 2)
  const result: T[] = [data[0]]  // Always include first point

  for (let i = 0; i < targetCount - 2; i++) {
    const bucketStart = Math.floor((i + 0) * bucketSize) + 1
    const bucketEnd = Math.floor((i + 1) * bucketSize) + 1
    const nextBucketStart = Math.floor((i + 1) * bucketSize) + 1
    const nextBucketEnd = Math.min(
      Math.floor((i + 2) * bucketSize) + 1,
      data.length
    )

    // Average of next bucket (the "target" point)
    let avgX = 0, avgY = 0
    for (let j = nextBucketStart; j < nextBucketEnd; j++) {
      avgX += xAccessor(data[j])
      avgY += yAccessor(data[j])
    }
    avgX /= (nextBucketEnd - nextBucketStart)
    avgY /= (nextBucketEnd - nextBucketStart)

    // Find point in current bucket that maximizes triangle area
    const prev = result[result.length - 1]
    let maxArea = -1
    let maxIdx = bucketStart

    for (let j = bucketStart; j < bucketEnd; j++) {
      const area = Math.abs(
        (xAccessor(prev) - avgX) * (yAccessor(data[j]) - yAccessor(prev)) -
        (xAccessor(prev) - xAccessor(data[j])) * (avgY - yAccessor(prev))
      )
      if (area > maxArea) {
        maxArea = area
        maxIdx = j
      }
    }

    result.push(data[maxIdx])
  }

  result.push(data[data.length - 1])  // Always include last point
  return result
}
```

Implementations SHOULD apply LTTB when the data length exceeds the chart pixel
width, as rendering more points than there are horizontal pixels provides no
visual benefit.

### TSG.22.14.4 React.memo Boundaries

Each chart component MUST be wrapped in `React.memo` to prevent re-rendering
when parent state changes but chart data is unchanged:

```typescript
const SignalRateChart = React.memo(function SignalRateChart({
  width,
  height,
}: Dimensions) {
  const rateData = useAtomValue(signalRateAtom)
  // ... chart implementation
})
```

Memo boundaries SHOULD be placed at the chart container level, NOT at
individual SVG element level (which would add overhead exceeding savings).

### TSG.22.14.5 useMemo for Scale Computation

Scale objects MUST be memoized to prevent D3 scale reconstruction on every
render:

```typescript
// CORRECT: memoized scale
const timeScale = useMemo(
  () => scaleTime({
    domain: [earliest(data), latest(data)],
    range: [0, width],
  }),
  [data, width]
)

// INCORRECT: scale reconstructed every render
const timeScale = scaleTime({
  domain: [earliest(data), latest(data)],
  range: [0, width],
})
```

### TSG.22.14.6 Virtualized Rendering for Dense Data

For heatmaps with >5,000 bins or timelines with >10,000 events, implementations
SHOULD virtualize rendering to draw only visible elements:

```typescript
function VirtualizedHeatmap({ data, viewport }: VirtualizedProps) {
  const visibleBins = useMemo(
    () => data.filter((bin) =>
      bin.x >= viewport.left &&
      bin.x <= viewport.right &&
      bin.y >= viewport.top &&
      bin.y <= viewport.bottom
    ),
    [data, viewport]
  )

  // Only render bins within the viewport
  return visibleBins.map((bin) => (
    <rect key={bin.id} /* ... */ />
  ))
}
```

---

## TSG.22.15 Cross-Layer Compositing

### TSG.22.15.1 Z-Index Position

The visx layer sits at z-index 1 in the compositing stack [TSG.3.1.2]:

```css
.tsingou-layer--visx {
  z-index: 1;
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: transparent;
}
```

### TSG.22.15.2 Transparency Requirements

The visx SVG MUST have a transparent background to allow the R3F layer (z:0)
to show through. SVG elements that require opaque backgrounds (e.g., tooltip
content, axis label backgrounds) MUST use explicit background fills on those
elements only, never on the root SVG.

### TSG.22.15.3 Compositing Rules

| Rule                                                                  | Requirement |
|-----------------------------------------------------------------------|-------------|
| visx root SVG MUST have `background: transparent`                     | MUST        |
| visx MUST NOT import from R3F, p5, or DOM layer modules               | MUST NOT    |
| visx MUST subscribe to atoms independently, not receive layer props    | MUST        |
| Interactive elements MUST use `pointer-events: all` on specific rects  | MUST        |
| Non-interactive elements MUST inherit `pointer-events: none`           | MUST        |
| visx SVG SHOULD cover the full viewport (inset: 0)                    | SHOULD      |
| visx SHOULD use CSS custom properties for colors (shared palette)      | SHOULD      |

### TSG.22.15.4 Layer Communication via Atoms

Cross-layer interaction (e.g., analyst clicks a signal in visx, R3F highlights
the 3D node) happens exclusively through shared selection atoms:

```
visx (z:1) ──onClick──▶ selectedSignalIdsAtom ◀──useAtomValue── R3F (z:0)
                                               ◀──useAtomValue── DOM (z:3)
                                               ◀──useAtomValue── p5  (z:2)
```

The visx layer MUST NOT call functions on other layers. The visx layer MUST NOT
pass callback props to other layers. All coordination MUST happen through atoms.

### TSG.22.15.5 Visual Hierarchy with R3F

When visx charts overlay R3F 3D scenes, visual clarity requires:

1. visx chart backgrounds SHOULD be semi-transparent panels (`fillOpacity: 0.85`)
   to maintain readability while showing 3D context behind.
2. visx chart borders SHOULD use `var(--tmnl-border)` for consistent visual
   separation.
3. visx text MUST maintain the 12px floor regardless of underlying 3D content.
4. visx annotations SHOULD use high-contrast colors that stand out against
   both light and dark 3D backgrounds.

---

## TSG.22.16 Chart Composition Patterns

### TSG.22.16.1 Compound Component Pattern

Charts MUST use the compound component pattern for composability and
customization. This pattern provides a `ChartProvider` context that coordinates
scales, dimensions, and interaction state across child components:

```
┌────────────────────────────────────────────────────┐
│  <TsingouChart>                                     │
│    (ChartProvider: scales, dimensions, theme)        │
│                                                      │
│    ┌──────────────────────────────────────────────┐  │
│    │  <TsingouChart.Canvas>                       │  │
│    │    (SVG or Canvas element, margins applied)   │  │
│    │                                               │  │
│    │    ┌────────────────────────────────────────┐ │  │
│    │    │  <TsingouChart.Grid />                 │ │  │
│    │    │  <TsingouChart.Series type="line" />   │ │  │
│    │    │  <TsingouChart.Series type="bar" />    │ │  │
│    │    │  <TsingouChart.Axis orient="bottom" /> │ │  │
│    │    │  <TsingouChart.Axis orient="left" />   │ │  │
│    │    │  <TsingouChart.Threshold value={42} /> │ │  │
│    │    │  <TsingouChart.Annotations events />   │ │  │
│    │    └────────────────────────────────────────┘ │  │
│    └──────────────────────────────────────────────┘  │
│                                                      │
│    ┌──────────────────────────────────────────────┐  │
│    │  <TsingouChart.Tooltip />                    │  │
│    │  <TsingouChart.Brush />                      │  │
│    │  <TsingouChart.Legend />                     │  │
│    └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### TSG.22.16.2 Provider Context Shape

```typescript
type TsingouChartContext = {
  readonly width: number
  readonly height: number
  readonly margin: ChartMargin
  readonly innerWidth: number
  readonly innerHeight: number
  readonly xScale: ScaleTime<number, number> | ScaleBand<string>
  readonly yScale: ScaleLinear<number, number>
  readonly colorScale: ScaleOrdinal<string, string>
  readonly theme: TsingouChartTheme
}
```

### TSG.22.16.3 Composition Example

```typescript
function SignalAnalysisDashboard() {
  const signals = useAtomValue(activeSignalsAtom)
  const anomalies = useAtomValue(anomalyAtom)
  const baseline = useAtomValue(anomalyBaselineAtom)

  return (
    <ParentSize debounceTime={150}>
      {({ width, height }) => (
        <TsingouChart
          width={width}
          height={height}
          xScale={{ type: 'time' }}
          yScale={{ type: 'linear', nice: true }}
          data={signals}
        >
          <TsingouChart.Canvas>
            <TsingouChart.Grid columns={false} />
            <TsingouChart.Series
              type="area"
              dataKey="rate"
              xAccessor={(d) => d.timestamp}
              yAccessor={(d) => d.count}
              fillOpacity={0.2}
            />
            <TsingouChart.Threshold value={baseline} />
            <TsingouChart.Annotations events={anomalies} />
            <TsingouChart.Axis orient="bottom" />
            <TsingouChart.Axis orient="left" />
          </TsingouChart.Canvas>
          <TsingouChart.Tooltip />
          <TsingouChart.Brush height={40} />
        </TsingouChart>
      )}
    </ParentSize>
  )
}
```

### TSG.22.16.4 Theme Configuration

Chart theming MUST use CSS custom properties consistent with the TMNL design
system:

```typescript
type TsingouChartTheme = {
  readonly backgroundColor: string
  readonly gridColor: string
  readonly axisColor: string
  readonly tickLabelColor: string
  readonly tickLabelFontSize: number  // Minimum 12
  readonly tooltipBackground: string
  readonly tooltipBorder: string
  readonly tooltipText: string
}

const TSINGOU_CHART_THEME: TsingouChartTheme = {
  backgroundColor: 'transparent',
  gridColor: 'var(--tmnl-border)',
  axisColor: 'var(--tmnl-muted)',
  tickLabelColor: 'var(--tmnl-text-secondary)',
  tickLabelFontSize: 12,  // THE FLOOR
  tooltipBackground: 'var(--tmnl-surface)',
  tooltipBorder: 'var(--tmnl-border)',
  tooltipText: 'var(--tmnl-text)',
}
```

---

## TSG.22.17 Accessibility

### TSG.22.17.1 SVG Accessibility Requirements

All visx chart SVGs MUST comply with WAI-ARIA requirements for data
visualization:

| Requirement                                               | Implementation                         | Level |
|-----------------------------------------------------------|----------------------------------------|-------|
| `role="img"` on root SVG                                  | `<svg role="img" ...>`                 | MUST  |
| `aria-label` per chart                                    | Descriptive chart purpose              | MUST  |
| `<title>` element in SVG                                  | `<title>Signal Rate Over Time</title>` | MUST  |
| `<desc>` element in SVG                                   | Summary of data shown                  | SHOULD|
| Keyboard navigation for data points                       | Tab + Enter/Space to select             | SHOULD|
| Screen reader announcements for data changes              | aria-live region for updates            | SHOULD|
| High contrast mode support                                | Patterns in addition to colors          | SHOULD|
| Focus indicators on interactive elements                  | Visible focus ring                      | MUST  |

### TSG.22.17.2 Chart ARIA Pattern

```typescript
function AccessibleChart({ width, height, data, title, description }: Props) {
  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <desc>{description}</desc>
      {/* Chart content */}
    </svg>
  )
}
```

### TSG.22.17.3 Keyboard Navigation

Interactive charts SHOULD support keyboard navigation:

| Key          | Action                                    |
|--------------|-------------------------------------------|
| Tab          | Move focus to next interactive element     |
| Arrow Left   | Move to previous data point               |
| Arrow Right  | Move to next data point                   |
| Enter/Space  | Select focused data point                 |
| Escape       | Clear selection / close tooltip           |
| Home         | Move to first data point                  |
| End          | Move to last data point                   |

### TSG.22.17.4 Screen Reader Announcements

When chart data updates (e.g., new signals arrive, anomaly detected),
implementations SHOULD announce changes via an aria-live region:

```typescript
function ChartAnnouncements() {
  const anomalyCount = useAtomValue(anomalyCountAtom)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (anomalyCount > 0) {
      setAnnouncement(
        `${anomalyCount} new anomal${anomalyCount === 1 ? 'y' : 'ies'} detected`
      )
    }
  }, [anomalyCount])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{ position: 'absolute', clip: 'rect(0,0,0,0)' }}
    >
      {announcement}
    </div>
  )
}
```

### TSG.22.17.5 Color-Blind Safe Patterns

In addition to color encoding, charts SHOULD use pattern fills from
`@visx/pattern` to provide a secondary visual channel:

```typescript
import { PatternLines, PatternCircles, PatternWaves } from '@visx/pattern'

const KIND_PATTERNS = {
  'indicator':      { id: 'pat-indicator', Component: PatternLines, orientation: ['diagonal'] },
  'malware':        { id: 'pat-malware', Component: PatternCircles, radius: 2 },
  'attack-pattern': { id: 'pat-attack', Component: PatternWaves, height: 6 },
  'threat-actor':   { id: 'pat-actor', Component: PatternLines, orientation: ['horizontal'] },
} as const
```

---

## TSG.22.18 Testing Strategy

### TSG.22.18.1 Test Matrix

| Test Type               | Tool                              | What It Validates                          |
|-------------------------|-----------------------------------|--------------------------------------------|
| Unit: scale computation | Vitest                            | Domain → range mapping correctness         |
| Unit: data decimation   | Vitest                            | LTTB output shape, point count, edge cases |
| Component: SVG output   | @testing-library/react            | SVG element count, attributes, text         |
| Component: interaction  | @testing-library/react + userEvent| Brush, zoom, tooltip behavior              |
| Snapshot: SVG structure | Vitest snapshot                   | Regression detection for SVG output        |
| Visual regression       | Chromatic                         | Pixel-level chart rendering comparison      |
| Performance: render     | React Profiler                    | Commit phase < 16ms for target data size   |
| Integration: atom flow  | Registry.make() + render          | Atom update → chart re-render pipeline      |

### TSG.22.18.2 Unit Test — Scale Computation

```typescript
import { describe, it, expect } from 'vitest'
import { scaleTime, scaleLinear } from '@visx/scale'

describe('Scale computation', () => {
  it('time scale maps domain to pixel range', () => {
    const start = new Date('2026-02-18T00:00:00Z')
    const end = new Date('2026-02-18T12:00:00Z')

    const scale = scaleTime({
      domain: [start, end],
      range: [0, 800],
    })

    expect(scale(start)).toBe(0)
    expect(scale(end)).toBe(800)
    expect(scale(new Date('2026-02-18T06:00:00Z'))).toBe(400)
  })

  it('linear scale with nice produces human-readable ticks', () => {
    const scale = scaleLinear({
      domain: [0, 97],
      range: [400, 0],
      nice: true,
    })

    const ticks = scale.ticks(5)
    expect(ticks[ticks.length - 1]).toBe(100)  // nice rounds up
  })
})
```

### TSG.22.18.3 Component Test — Chart Rendering

```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Registry } from '@effect-rx/rx'

describe('SignalRateChart', () => {
  it('renders line path from atom data', () => {
    const registry = Registry.make()
    registry.set(signalRateAtom, [
      { timestamp: new Date('2026-02-18T00:00Z'), count: 10, kind: 'indicator' },
      { timestamp: new Date('2026-02-18T01:00Z'), count: 25, kind: 'indicator' },
      { timestamp: new Date('2026-02-18T02:00Z'), count: 15, kind: 'indicator' },
    ])

    const { container } = render(
      <RegistryProvider registry={registry}>
        <SignalRateChart width={800} height={400} />
      </RegistryProvider>
    )

    const paths = container.querySelectorAll('path')
    expect(paths.length).toBeGreaterThan(0)

    const axes = container.querySelectorAll('.visx-axis')
    expect(axes.length).toBe(2)  // bottom + left
  })

  it('updates when atom changes', () => {
    const registry = Registry.make()
    registry.set(signalRateAtom, [])

    const { container, rerender } = render(
      <RegistryProvider registry={registry}>
        <SignalRateChart width={800} height={400} />
      </RegistryProvider>
    )

    // Initially no data points
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(0)

    // Update atom with data
    registry.set(signalRateAtom, [
      { timestamp: new Date('2026-02-18T00:00Z'), count: 42, kind: 'indicator' },
    ])

    // Chart should re-render with data
    // (exact assertion depends on chart type — line vs scatter)
  })
})
```

### TSG.22.18.4 Integration Test — Atom Pipeline

```typescript
describe('Atom → Chart pipeline', () => {
  it('derived atom computes time buckets from raw signals', () => {
    const registry = Registry.make()
    const rawSignals = Array.from({ length: 100 }, (_, i) => ({
      id: `sig-${i}`,
      timestamp: new Date(Date.now() - i * 60_000),
      kind: 'indicator',
      confidence: 0.8,
    }))

    registry.set(activeSignalsAtom, rawSignals)
    const buckets = registry.get(signalRateAtom)

    expect(buckets.length).toBeGreaterThan(0)
    expect(buckets.every((b) => typeof b.count === 'number')).toBe(true)
  })
})
```

### TSG.22.18.5 Performance Regression Test

```typescript
describe('Performance', () => {
  it('renders 5000 points within 16ms', () => {
    const data = Array.from({ length: 5000 }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 1000),
      count: Math.random() * 100,
      kind: 'indicator',
    }))

    const registry = Registry.make()
    registry.set(signalRateAtom, data)

    const start = performance.now()

    render(
      <RegistryProvider registry={registry}>
        <SignalRateChart width={1200} height={600} />
      </RegistryProvider>
    )

    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(16)
  })

  it('LTTB decimation runs in < 5ms for 100k points', () => {
    const data = Array.from({ length: 100_000 }, (_, i) => ({
      x: i,
      y: Math.sin(i * 0.01) * 50 + Math.random() * 10,
    }))

    const start = performance.now()
    const decimated = lttbDecimate(data, 1000, (d) => d.x, (d) => d.y)
    const elapsed = performance.now() - start

    expect(decimated.length).toBe(1000)
    expect(elapsed).toBeLessThan(5)
  })
})
```

---

## TSG.22.19 Normative Requirements Summary

### MUST Requirements

| ID          | Requirement                                                                           | Source       |
|-------------|---------------------------------------------------------------------------------------|--------------|
| TSG.22-R1   | All charts MUST subscribe to atom state via `useAtomValue()`, never `useState`         | TSG.22.7.3   |
| TSG.22-R2   | Scale domain computation MUST be memoized with `useMemo`                               | TSG.22.14.5  |
| TSG.22-R3   | Charts MUST be wrapped in `ParentSize` for responsive dimensions                       | TSG.22.11.1  |
| TSG.22-R4   | Charts MUST NOT use hardcoded pixel dimensions                                         | TSG.22.11.1  |
| TSG.22-R5   | `ParentSize` debounce time MUST be at least 100ms                                      | TSG.22.11.2  |
| TSG.22-R6   | Text in visx charts MUST be at least 12px (the floor)                                  | TSG.22.9.3   |
| TSG.22-R7   | All chart SVGs MUST have `role="img"` and `aria-label`                                 | TSG.22.17.1  |
| TSG.22-R8   | All chart SVGs MUST contain a `<title>` element                                        | TSG.22.17.1  |
| TSG.22-R9   | Implementations MUST switch to Canvas rendering when data exceeds 5,000 SVG nodes      | TSG.22.14.2  |
| TSG.22-R10  | visx root SVG MUST have `background: transparent`                                      | TSG.22.15.2  |
| TSG.22-R11  | visx MUST NOT import from R3F, p5, or DOM layer modules                                | TSG.22.15.3  |
| TSG.22-R12  | Cross-layer coordination MUST happen through shared atoms, never direct calls           | TSG.22.15.4  |
| TSG.22-R13  | Log scales MUST clamp domain minimum to a positive value                                | TSG.22.8.3   |
| TSG.22-R14  | Time scales MUST use UTC-aware Date objects                                             | TSG.22.8.3   |
| TSG.22-R15  | Heatmap color ramp MUST be consistent with p5 waterfall mapping [TSG.3.4.5]            | TSG.22.10.4  |
| TSG.22-R16  | Each chart component MUST be wrapped in `React.memo`                                   | TSG.22.14.4  |
| TSG.22-R17  | Brush selection MUST update shared `selectedTimeRangeAtom` for cross-layer filtering    | TSG.22.13.2  |
| TSG.22-R18  | Interactive SVG elements MUST use `pointer-events: all` override                       | TSG.22.13.6  |
| TSG.22-R19  | Non-interactive SVG elements MUST inherit `pointer-events: none` from layer CSS         | TSG.22.13.6  |
| TSG.22-R20  | Charts MUST use the consistent margin convention                                        | TSG.22.11.4  |

### SHOULD Requirements

| ID          | Requirement                                                                           | Source       |
|-------------|---------------------------------------------------------------------------------------|--------------|
| TSG.22-S1   | Implementations SHOULD use `@visx/xychart` for standard chart types                   | TSG.22.2.3   |
| TSG.22-S2   | Charts SHOULD use derived atoms for chart-specific data projections                    | TSG.22.7.4   |
| TSG.22-S3   | Charts SHOULD adapt rendering complexity based on available width                       | TSG.22.11.3  |
| TSG.22-S4   | Charts SHOULD apply LTTB decimation when data length exceeds chart pixel width          | TSG.22.14.3  |
| TSG.22-S5   | Tooltip nearest-datum lookup SHOULD use Voronoi for O(log n) performance               | TSG.22.13.4  |
| TSG.22-S6   | Charts SHOULD support keyboard navigation (Tab, Arrow, Enter, Escape)                  | TSG.22.17.3  |
| TSG.22-S7   | Charts SHOULD use pattern fills in addition to colors for colorblind accessibility      | TSG.22.17.5  |
| TSG.22-S8   | Charts SHOULD announce significant data changes via aria-live regions                   | TSG.22.17.4  |
| TSG.22-S9   | Axis labels SHOULD rotate max -45 degrees; truncate and tooltip if still colliding      | TSG.22.9.3   |
| TSG.22-S10  | visx chart backgrounds SHOULD be semi-transparent when overlaying R3F                   | TSG.22.15.5  |
| TSG.22-S11  | Ordinal color scales SHOULD use the Tsingou colorblind-safe palette                    | TSG.22.10.1  |

### MAY Requirements

| ID          | Requirement                                                                           | Source       |
|-------------|---------------------------------------------------------------------------------------|--------------|
| TSG.22-M1   | Charts MAY use `useDeferredValue` for non-critical data updates                        | TSG.22.7.3   |
| TSG.22-M2   | Implementations MAY use `@visx/stats` for box plot / violin plot distributions          | TSG.22.3.2   |
| TSG.22-M3   | Implementations MAY use `@visx/geo` for 2D geographic projections                      | TSG.22.3.2   |
| TSG.22-M4   | Charts MAY use SVG gradients via `@visx/gradient` for visual polish                    | TSG.22.3.2   |
| TSG.22-M5   | Zoom transform MAY be maintained as local state (chart-specific, not cross-layer)       | TSG.22.13.3  |

---

## TSG.22.20 References

| Key              | Reference                                                                                   |
|------------------|---------------------------------------------------------------------------------------------|
| [RFC2119]        | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119   |
| [RFC8174]        | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174   |
| [VISX]           | Airbnb, "visx — A collection of expressive, low-level visualization primitives for React", https://airbnb.io/visx |
| [VISX-XYCHART]   | Airbnb, "@visx/xychart — Simplified XY chart API", https://airbnb.io/visx/docs/xychart      |
| [VISX-HEATMAP]   | Airbnb, "@visx/heatmap — Heatmap visualization", https://airbnb.io/visx/heatmaps            |
| [VISX-NETWORK]   | Airbnb, "@visx/network — Network graph visualization", https://airbnb.io/visx/network        |
| [VISX-HIERARCHY] | Airbnb, "@visx/hierarchy — Hierarchical visualizations", https://airbnb.io/visx/treemap      |
| [VISX-BRUSH]     | Airbnb, "@visx/brush — Brush selection interaction", https://airbnb.io/visx/brush            |
| [VISX-ZOOM]      | Airbnb, "@visx/zoom — Pan and zoom interaction", https://airbnb.io/visx/zoom                 |
| [D3-SCALE]       | Bostock, M., "d3-scale — Scales for visual encoding", https://d3js.org/d3-scale              |
| [LTTB]           | Steinarsson, S., "Downsampling Time Series for Visual Representation", MSc Thesis, 2013      |
| [TSG.3.1]        | Rendering Surface: 4-Layer Composited Architecture. `rfc-section-rendering-surface.md`        |
| [TSG.3.2]        | Rendering Surface: R3F Layer. `rfc-section-rendering-surface.md`                              |
| [TSG.3.3]        | Rendering Surface: visx Layer Summary. `rfc-section-rendering-surface.md`                     |
| [TSG.3.4]        | Rendering Surface: p5 Layer. `rfc-section-rendering-surface.md`                               |
| [TSG.3.4.5]      | Rendering Surface: p5 Color Mapping for SDR. `rfc-section-rendering-surface.md`               |
| [TSG.3.5]        | Rendering Surface: DOM Layer. `rfc-section-rendering-surface.md`                              |
| [TSG.3.6]        | Rendering Surface: OutputBridge Routing. `rfc-section-rendering-surface.md`                   |
| [TSG.3.6.2]      | Rendering Surface: Selective Subscription. `rfc-section-rendering-surface.md`                 |
| [TSG.3.7]        | Rendering Surface: Analysis Technique Mapping. `rfc-section-rendering-surface.md`             |
| [TSG.3.7.3]      | Rendering Surface: Cross-Layer Coordination. `rfc-section-rendering-surface.md`               |
| [TSG.4.1]        | State Management: Atom-as-State Doctrine. `rfc-section-state-management.md`                   |
| [TSG.25]         | DSP Foundations. `rfc-section-dsp-foundations.md`                                              |
| [ADR-005]        | ADR-005: Atom-as-State. `docs/tsingou/adr/`                                                  |
| [ADR-012]        | ADR-012: Visualization-Focused Platform. `docs/tsingou/adr/`                                 |
| [ADR-013]        | ADR-013: Eight Analysis Techniques. `docs/tsingou/adr/`                                      |
| [TSG.20]         | R3F 3D Visualization Layer. `rfc-section-rendering-surface.md` (R3F section)                  |
| [TSG.27]         | Signal Pipeline. `rfc-section-signal-pipeline.md`                                             |
| [TSG.28]         | Analysis Techniques. `rfc-section-analysis-techniques.md`                                     |
| [WCAG-2.1]       | W3C, "Web Content Accessibility Guidelines 2.1", https://www.w3.org/TR/WCAG21/               |
| [WAI-ARIA]       | W3C, "WAI-ARIA Authoring Practices", https://www.w3.org/WAI/ARIA/apg/                        |
