# ADR-013: Eight Analysis Techniques Across 4 Rendering Layers

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user), Val (architect)  
**Evidence**: Questionnaire `tsingou-sigint-scope` — Q3: All 8 selected, Q8: "All parallel"

---

## Context

Intelligence analysis uses established visualization and analytical techniques. Each technique has different data requirements, interaction patterns, and rendering needs. Tsingou's 4-layer rendering architecture maps each technique to the optimal rendering technology.

## Decision

**All 8 analysis techniques are supported, built in parallel (MVP per layer).**

### Technique → Layer Mapping

| # | Technique | Primary Layer | Secondary | d2ts Operator | STIX Objects |
|---|-----------|--------------|-----------|---------------|-------------|
| 1 | **Link Analysis** | R3F (z:0) | visx (z:1) | `join`, `distinct` | SDOs + SROs |
| 2 | **Timeline Analysis** | visx (z:1) | DOM (z:3) | `window`, `count` | `observed-data.first_observed` |
| 3 | **Geospatial Analysis** | R3F (z:0) | visx (z:1) | `join` (signal × location) | `location` SDO |
| 4 | **Anomaly Detection** | DOM (z:3) | visx (z:1) | `reduce`, `window`, custom | `indicator` SDO |
| 5 | **Pattern-of-Life** | visx (z:1) | R3F (z:0) | `window`, `reduce`, `iterate` | `observed-data` sequences |
| 6 | **Signal Flow** | R3F (z:0) | p5 (z:2) | Graph topology viz | Pipeline metadata |
| 7 | **Kill Chain / ATT&CK** | visx (z:1) | DOM (z:3) | `join` (signal × ATT&CK) | `attack-pattern` SDO |
| 8 | **Spectrum Analysis** | p5 (z:2) | visx (z:1) | Custom FFT operators | `artifact` SCO (SigMF) |

### Technique Details

#### 1. Link Analysis (R3F)
**What**: Force-directed graph visualization of entity relationships.  
**Data**: STIX SDOs (nodes) + SROs (edges). Entity types as node colors/shapes.  
**Interaction**: Click node → expand connections. Hover → show entity card. Drag → rearrange.  
**R3F implementation**: `@react-three/fiber` + `three-forcegraph` or custom force layout.  
**Comparable to**: Maltego, i2 Analyst's Notebook, Palantir Gotham graph view.

#### 2. Timeline Analysis (visx)
**What**: Chronological event visualization with entity grouping.  
**Data**: STIX observed-data sorted by `first_observed`. Grouped by source/entity.  
**Interaction**: Pan/zoom timeline. Click event → expand. Brush select → filter.  
**visx implementation**: `@visx/axis` + `@visx/scale` + custom timeline component.  
**Comparable to**: KronoGraph, Palantir timeline view.

#### 3. Geospatial Analysis (R3F)
**What**: Map-based overlay of geolocated signals.  
**Data**: STIX `location` SDOs with lat/lng. Heatmaps for density. Traces for movement.  
**Interaction**: Pan/zoom map. Click marker → entity card. Toggle heatmap/markers.  
**R3F implementation**: Globe visualization with signal markers, or 2D map with deck.gl overlay.  
**Comparable to**: MapWeave, Palantir map view, Google Earth.

#### 4. Anomaly Detection (DOM + visx)
**What**: Statistical deviation alerts with visual indicators.  
**Data**: Rolling baselines per source/entity. Z-score thresholds.  
**Interaction**: Alert panel with severity ranking. Click alert → zoom to relevant timeline/graph.  
**Implementation**: d2ts `reduce` for rolling statistics. `window` for time bounds. framer-motion for alert animations.  
**Comparable to**: Splunk alerts, Grafana alerting.

#### 5. Pattern-of-Life (visx + R3F)
**What**: Behavioral routine analysis — what does "normal" look like for an entity?  
**Data**: Spatiotemporal observation sequences. Activity density over time-of-day × day-of-week.  
**Interaction**: Select entity → view POL heatmap. Compare current vs. baseline.  
**visx implementation**: `@visx/heatmap` for activity density. `@visx/stats` for distributions.  
**Comparable to**: Cambridge Intelligence POL tools, Palantir behavior analysis.

#### 6. Signal Flow Visualization (R3F)
**What**: Real-time animated view of the d2ts processing pipeline.  
**Data**: Pipeline topology (adapters → ingest → derived → output). Signal counts per node.  
**Interaction**: Hover node → show throughput. Click → expand operator details.  
**R3F implementation**: Animated particles flowing through graph edges. Node size = throughput.  
**Comparable to**: Apache Flink dashboard, custom pipeline visualizations.

#### 7. Kill Chain / ATT&CK Mapping (visx)
**What**: Map observed signals to MITRE ATT&CK tactics and techniques.  
**Data**: STIX `attack-pattern` SDOs with ATT&CK external references.  
**Interaction**: ATT&CK matrix view with highlighted techniques. Click technique → show related signals.  
**visx implementation**: Grid/matrix layout with `@visx/group` + `@visx/text`. Coverage heatmap.  
**Comparable to**: ATT&CK Navigator, MISP ATT&CK matrix.

#### 8. Spectrum Analysis (p5)
**What**: RF spectrum visualization from SDR data.  
**Data**: FFT magnitude arrays, IQ samples, waterfall data from GNU Radio bridge.  
**Interaction**: Tune frequency. Adjust bandwidth. Mark signals of interest.  
**p5 implementation**: `P5Canvas` with `updateWithProps` receiving FFT data via atoms.  
**Comparable to**: GQRX, SDR#, CubicSDR waterfall displays.

## Implementation: MVP Per Layer

Each layer gets **one component** in Wave 1 to prove the 4-layer composition:

| Layer | MVP Component | Data Source |
|-------|--------------|-------------|
| R3F (z:0) | Simple force-directed graph (3-5 nodes) | Hardcoded + live NATS signals |
| visx (z:1) | Timeline with signal events | `activeSignalsAtom` |
| p5 (z:2) | Animated noise field (signal-reactive) | `throughputAtom` drives parameters |
| DOM (z:3) | Signal table + adapter health panel | `adapterHealthAtom` + `activeSignalsAtom` |

## Consequences

### Positive
- **Complete analysis surface** — every intelligence technique has a home
- **Layer specialization** — each rendering tech does what it's best at
- **Composable** — layers overlay; analyst sees all techniques simultaneously
- **STIX-driven** — each technique maps to specific STIX object types

### Negative
- **8 techniques = significant UI work** — each needs components, interactions, state
- **R3F for geospatial is complex** — may need deck.gl or Mapbox GL integration
- **p5 for spectrum is niche** — limited to SDR use cases

### Risk Mitigation
- MVP-per-layer approach proves composition before investing in full techniques
- Each technique is independently deployable — analyst enables what they need
