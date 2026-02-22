# RFC Section TSG.3: Intelligence Cycle

```
Section:       TSG.3 — Intelligence Cycle
Parent RFC:    Tsingou Platform Specification (TMNL-RFC-002)
Status:        DRAFT
Author:        Val (sigint-researcher)
Created:       2026-02-18
Research Base: research-intelligence-cycle.md (5 sections, 7 frameworks, 24 references)
```

> This section specifies how Tsingou implements the six-phase intelligence cycle
> defined in [JP-2-0] and mandated by [ADR-010]. Every phase maps to concrete
> platform capabilities — from session configuration (Direction) through source
> adapters (Collection), d2ts pipeline (Processing), analysis operators (Analysis),
> STIX export (Dissemination), and closed-loop adjustment (Feedback). The key
> words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" are to be
> interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Scope and Applicability](#1-scope-and-applicability)
2. [Intelligence Cycle Overview](#2-intelligence-cycle-overview)
3. [Direction: Planning and Requirements](#3-direction-planning-and-requirements)
4. [Collection: Source Adapters](#4-collection-source-adapters)
5. [Processing: Ingest Graph](#5-processing-ingest-graph)
6. [Analysis: Derived Graph](#6-analysis-derived-graph)
7. [Dissemination: Output Bridge and STIX Export](#7-dissemination-output-bridge-and-stix-export)
8. [Feedback: Closed-Loop Adjustment](#8-feedback-closed-loop-adjustment)
9. [Structured Analytic Techniques Integration](#9-structured-analytic-techniques-integration)
10. [ICD 203 Analytic Standards Compliance](#10-icd-203-analytic-standards-compliance)
11. [Normative Requirements Summary](#11-normative-requirements-summary)
12. [Bibliography](#12-bibliography)

---

## 1. Scope and Applicability

### 1.1 Purpose

This section defines how Tsingou maps to each phase of the six-phase
intelligence cycle. The mapping is normative — implementations claiming
Tsingou conformance MUST support all six phases at the levels specified
herein [ADR-010].

### 1.2 Relationship to TCPED

The DoD TCPED (Tasking, Collection, Processing, Exploitation,
Dissemination) framework [JP-2-01.3] maps to the intelligence cycle as
follows:

| TCPED Stage | Intelligence Cycle Phase | Tsingou Component |
|------------|------------------------|-------------------|
| Tasking | Direction | Session configuration, adapter selection |
| Collection | Collection | Source adapters, hot-plug management |
| Processing | Processing | d2ts ingest graph |
| Exploitation | Analysis | d2ts derived graph, analysis operators |
| Dissemination | Dissemination | Output bridge, STIX export, rendering |
| (implicit) | Feedback | Analyst annotation, parameter tuning |

### 1.3 F3EAD Integration

The F3EAD (Find, Fix, Finish, Exploit, Analyze, Disseminate) targeting
cycle used in military operations maps to Tsingou capabilities:

| F3EAD Phase | Tsingou Mapping | Notes |
|------------|----------------|-------|
| Find | OSINT/CYBINT adapters + d2ts filter | Identify signals of interest |
| Fix | d2ts join + geospatial correlation | Locate and confirm target |
| Finish | NOT IN SCOPE | Kinetic/cyber action external to Tsingou |
| Exploit | d2ts derived graph + analysis operators | Extract intelligence from collected data |
| Analyze | Analysis techniques (ADR-013) | Apply SATs, produce assessments |
| Disseminate | STIX export, rendering, alerts | Deliver to consumers |

---

## 2. Intelligence Cycle Overview

### 2.1 Six-Phase Model

**Normative Statement TSG.3-1**: Tsingou MUST implement all six phases of
the intelligence cycle as defined in [JP-2-0]:

```
                    ┌─────────────────┐
                    │   1. DIRECTION   │
                    │   Session Config │
                    │   Adapter Select │
                    └────────┬────────┘
                             │
              ┌──────────────┤
              │              ▼
    ┌─────────┴───┐   ┌─────────────┐
    │ 6. FEEDBACK  │   │2. COLLECTION │
    │ Annotation   │   │ Source       │
    │ Tuning       │   │ Adapters     │
    │ Quality      │   │ Hot-Plug     │
    └─────────▲───┘   └──────┬──────┘
              │              │
              │              ▼
    ┌─────────┴───┐   ┌─────────────┐
    │5. DISSEM.    │   │3. PROCESSING │
    │ STIX Export  │   │ d2ts Ingest  │
    │ 4-Layer Viz  │   │ Normalize    │
    │ Alerts       │   │ Validate     │
    └─────────▲───┘   └──────┬──────┘
              │              │
              │              ▼
              │        ┌─────────────┐
              └────────│ 4. ANALYSIS  │
                       │ d2ts Derived │
                       │ 8 Techniques │
                       │ ICD 203      │
                       └─────────────┘
```

### 2.2 Phase-to-Component Mapping Summary

| Phase | Tsingou Component | Key Technologies | Latency Target |
|-------|------------------|-----------------|----------------|
| Direction | SessionConfiguration service | Effect.Schema, DOM layer | Interactive (ms) |
| Collection | AdapterManager, 8+ adapter types | Effect.Service, NATS | Per-adapter (<1s typical) |
| Processing | d2ts ingest graph | d2ts operators, Schema validation | Sub-second |
| Analysis | d2ts derived graph | 8 analysis techniques [ADR-013] | Sub-second to seconds |
| Dissemination | OutputBridge, STIX codec, rendering | STIX 2.1, 4-layer rendering | Sub-second (viz), seconds (export) |
| Feedback | Analyst annotation, parameter tuning | DOM layer, d2ts reconfiguration | Interactive (ms) |

---

## 3. Direction: Planning and Requirements

### 3.1 Session Configuration

**Normative Statement TSG.3-2**: Tsingou MUST support session configuration
that allows analysts to define:

a) Signal sources to activate (adapter selection and configuration)
b) Analysis parameters (window sizes, anomaly thresholds, join keys)
c) Rendering preferences (which layers active, layout, color schemes)
d) Alert conditions (threshold values, notification targets)
e) Export configuration (STIX bundle settings, TAXII endpoints)

### 3.2 Session Configuration Schema

```typescript
// TSG.3 Session Configuration Schema (Conceptual)
const SessionConfiguration = Schema.Struct({
  session_id: SessionId,
  name: Schema.NonEmptyString,
  created_at: Schema.DateTimeUtc,

  // Direction: Source selection
  sources: Schema.Array(Schema.Struct({
    adapter_type: Schema.Literal(
      'rss', 'http', 'websocket', 'nats', 'file-watch', 'serial', 'midi', 'osc'
    ),
    config: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    enabled: Schema.Boolean,
    reliability_default: Schema.optional(Schema.Literal('A','B','C','D','E','F')),
  })),

  // Direction: Analysis parameters
  analysis: Schema.Struct({
    window_duration_ms: Schema.Number.pipe(Schema.positive()),
    anomaly_threshold_sigma: Schema.Number.pipe(Schema.positive()),
    join_keys: Schema.Array(Schema.String),
    techniques_enabled: Schema.Array(Schema.Literal(
      'link_analysis', 'timeline', 'geospatial', 'anomaly_detection',
      'pattern_of_life', 'kill_chain', 'spectrum', 'signal_flow'
    )),
  }),

  // Direction: Rendering
  rendering: Schema.Struct({
    layers_active: Schema.Struct({
      r3f: Schema.Boolean,
      visx: Schema.Boolean,
      p5: Schema.Boolean,
      dom: Schema.Boolean,
    }),
  }),

  // Direction: Alert configuration
  alerts: Schema.Array(Schema.Struct({
    condition: Schema.String,
    threshold: Schema.Number,
    notification: Schema.Literal('visual', 'audio', 'external'),
  })),

  // Direction: Export
  export: Schema.optional(Schema.Struct({
    stix_enabled: Schema.Boolean,
    taxii_endpoint: Schema.optional(Schema.String),
    tlp_default: Schema.Literal(
      'TLP:RED', 'TLP:AMBER', 'TLP:AMBER+STRICT', 'TLP:GREEN', 'TLP:CLEAR'
    ),
  })),
})
```

### 3.3 Requirements Mapping

Tsingou's session configuration maps to intelligence requirements
terminology:

| Intelligence Concept | Tsingou Equivalent | Description |
|---------------------|-------------------|-------------|
| PIR (Priority Intelligence Requirement) | Session purpose/name | What the analyst is investigating |
| EEI (Essential Element of Information) | Enabled analysis techniques | What types of analysis to apply |
| Source selection | Adapter configuration | Which sources to collect from |
| Collection priority | Source ordering, reliability defaults | Which sources to prioritize |
| Alert conditions | Anomaly thresholds, window parameters | What triggers notification |

---

## 4. Collection: Source Adapters

### 4.1 Adapter Architecture

**Normative Statement TSG.3-3**: Tsingou MUST support hot-plug adapter
management — adding and removing signal sources at runtime without
platform restart.

The AdapterManager service provides lifecycle management for all
source adapters:

```
┌─────────────────────────────────────────────────────────┐
│                   AdapterManager                         │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  RSS     │  │  HTTP    │  │  WebSock  │  ... more    │
│  │  Adapter │  │  Adapter │  │  Adapter  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│       ▼              ▼              ▼                    │
│  ┌──────────────────────────────────────────────┐       │
│  │         SignalQueue (Effect.Queue, 4096)      │       │
│  │         push(BaseSignal) → drain loop         │       │
│  └──────────────────────┬───────────────────────┘       │
│                         │                                │
│                         ▼                                │
│  Health Monitor: heartbeat, error count, throughput      │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Adapter Deployment Model

**Normative Statement TSG.3-4**: Each adapter MUST report its deployment
model, latency class, and bandwidth class for collection management:

| Adapter | Deployment Model | Latency Class | Bandwidth Class |
|---------|-----------------|---------------|-----------------|
| `RssSourceAdapter` | Pull (scheduled poll) | High (minutes) | Low (KB/poll) |
| `HttpSourceAdapter` (poll) | Pull (scheduled poll) | Medium (seconds) | Medium (KB-MB/poll) |
| `HttpSourceAdapter` (SSE) | Push (server-sent events) | Low (sub-second) | Medium (continuous) |
| `WebSocketSourceAdapter` | Push (bidirectional) | Very low (ms) | High (continuous) |
| `NatsSourceAdapter` | Push (subscribe) | Very low (ms) | Very high (continuous) |
| `HolonetBridgeAdapter` (file) | Event (fs watch) | Medium (seconds) | Variable (batch) |
| `HolonetBridgeAdapter` (serial) | Push (stream) | Very low (ms) | Low-medium (continuous) |
| Stub (MIDI) | Push (event) | Very low (ms) | Very low (events) |
| Stub (OSC) | Push (UDP) | Very low (ms) | Low-medium (packets) |

### 4.3 Health Monitoring

**Normative Statement TSG.3-5**: Each adapter MUST expose health metrics
via effect-atom state:

```typescript
// TSG.3 Adapter Health Schema (Conceptual)
const AdapterHealth = Schema.Struct({
  adapter_id: Schema.String,
  adapter_type: Schema.String,
  status: Schema.Literal('connected', 'disconnected', 'error', 'degraded'),
  last_signal_at: Schema.optional(Schema.DateTimeUtc),
  signals_received: Schema.Number,
  errors_count: Schema.Number,
  latency_ms: Schema.optional(Schema.Number),
  throughput_signals_per_sec: Schema.optional(Schema.Number),
})
```

### 4.4 Collection Synchronization

**Normative Statement TSG.3-6**: Multi-source collection MUST maintain
temporal ordering through BaseSignal versioning:

- `BaseSignal.version` tuple `[tick, source_seq]` provides d2ts-compatible
  multi-dimensional versioning [FLOW-ARCH]
- `tick`: Global logical clock advanced by the TsingouFlow service
- `source_seq`: Per-source sequence number for ordering within a source

This ensures that signals from different sources with different latencies
are correctly ordered in the d2ts graph.

---

## 5. Processing: Ingest Graph

### 5.1 Processing Pipeline

**Normative Statement TSG.3-7**: The d2ts ingest graph MUST perform the
following processing stages on all ingested signals:

| Stage | Operator | Requirement | Description |
|-------|----------|-------------|-------------|
| 1. Normalization | `map` | MUST | Convert raw adapter output to BaseSignal |
| 2. Schema validation | `schema-validate` | MUST | Validate against registered schemas |
| 3. Deduplication | `distinct` | SHOULD | Remove duplicate signals (same source + hash) |
| 4. Enrichment | `map` | SHOULD | Add metadata (geo, classification, tags) |
| 5. Versioning | `map` | MUST | Assign d2ts version [tick, source_seq] |
| 6. Routing | `filter`/`map` | MUST | Route to appropriate derived graph paths |

### 5.2 Ingest Graph Architecture

```
Adapter Output (raw)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│                  d2ts INGEST GRAPH                    │
│                                                       │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐         │
│  │ normalize │──▶│ validate │──▶│  dedup   │         │
│  │ (map)     │   │ (filter) │   │(distinct)│         │
│  └──────────┘   └──────────┘   └──────────┘         │
│                                      │               │
│                                      ▼               │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐         │
│  │  route   │◀──│ version  │◀──│ enrich   │         │
│  │ (filter) │   │  (map)   │   │  (map)   │         │
│  └──────────┘   └──────────┘   └──────────┘         │
│       │                                               │
│       ├──▶ CYBINT path (IOC extraction, ATT&CK)      │
│       ├──▶ OSINT path (NLP, entity extraction)       │
│       ├──▶ ELINT path (PDW processing, spectrum)     │
│       └──▶ General path (all other signals)          │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 5.3 Processing Activity Mapping

| Processing Activity | d2ts Operator | Requirement Level | Intelligence Cycle Sub-phase |
|--------------------|--------------|-------------------|----------------------------|
| Format conversion | `map` (normalize) | MUST | Processing |
| Schema enforcement | `filter` (validate) | MUST | Processing |
| Duplicate removal | `distinct` | SHOULD | Processing |
| Geo-enrichment | `map` (enricher) | SHOULD | Processing |
| TLP tagging | `map` (tag) | MUST | Processing |
| Source reliability annotation | `map` (annotate) | SHOULD | Processing |
| Content extraction (NLP) | `map` (external NLP) | MAY | Exploitation |
| IOC extraction | `map` (regex/pattern) | MUST (CYBINT) | Exploitation |
| Entity extraction | `map` (NER) | SHOULD (OSINT) | Exploitation |

---

## 6. Analysis: Derived Graph

### 6.1 Analysis Technique Catalog

**Normative Statement TSG.3-8**: Tsingou MUST implement the eight analysis
techniques defined in [ADR-013], mapped to d2ts operators and rendering
layers:

| # | Technique | d2ts Operators | Primary Layer | STIX Output |
|---|----------|---------------|---------------|-------------|
| 1 | **Link Analysis** | `join`, `count`, `aggregate` | R3F (3D graph) | `relationship` SROs |
| 2 | **Timeline Analysis** | `window`, `aggregate` | visx (SVG timeline) | `observed-data` SDOs |
| 3 | **Geospatial Analysis** | `join` (geo-key), `aggregate` | R3F (3D map) | `location` SDOs |
| 4 | **Anomaly Detection** | `iterate`, statistical ops | visx (charts) | `indicator` SDOs |
| 5 | **Pattern-of-Life** | `window`, `join`, `aggregate` | visx + DOM | `observed-data` bundles |
| 6 | **Kill Chain / ATT&CK** | `map` (ATT&CK tag), `join` | DOM (matrix) | `attack-pattern` SDOs |
| 7 | **Spectrum Analysis** | FFT, waterfall operators | p5 (canvas) | Custom extensions |
| 8 | **Signal Flow** | `topK`, routing analysis | R3F (topology) | `infrastructure` SDOs |

### 6.2 Derived Graph Architecture

```
From Ingest Graph (BaseSignal, normalized, versioned)
    │
    ▼
┌───────────────────────────────────────────────────────┐
│                 d2ts DERIVED GRAPH                      │
│                                                         │
│  ┌─── Cross-Source Correlation ───────────────────┐    │
│  │  join(key) — match signals across sources       │    │
│  │  join(temporal) — temporal co-occurrence         │    │
│  │  join(geo) — geospatial proximity               │    │
│  └─────────────────────┬─────────────────────────┘    │
│                        │                               │
│  ┌─── Temporal Analysis ──────────────────────────┐    │
│  │  window(duration) — sliding time windows        │    │
│  │  aggregate(count/sum/avg) — windowed statistics │    │
│  │  iterate(rolling_stats) — EWMA, z-scores        │    │
│  └─────────────────────┬─────────────────────────┘    │
│                        │                               │
│  ┌─── Anomaly Detection ─────────────────────────┐    │
│  │  iterate(baseline) — establish normal patterns  │    │
│  │  iterate(deviation) — compute deviations        │    │
│  │  filter(threshold) — flag anomalies             │    │
│  └─────────────────────┬─────────────────────────┘    │
│                        │                               │
│  ┌─── Ranking and Selection ─────────────────────┐    │
│  │  topK(priority) — surface highest-priority      │    │
│  │  filter(relevance) — remove noise               │    │
│  └─────────────────────┬─────────────────────────┘    │
│                        │                               │
│                        ▼                               │
│              Output Collection                         │
│              (feeds OutputBridge)                       │
└───────────────────────────────────────────────────────┘
```

### 6.3 ICD 203 Confidence Scoring

**Normative Statement TSG.3-9**: Analysis outputs SHOULD carry confidence
annotations conforming to [ICD-203] probability language:

| Term | Probability Range | Numeric Encoding | Usage |
|------|------------------|-----------------|-------|
| Almost no chance | 01-05% | 0.01-0.05 | Very low confidence assessments |
| Very unlikely | 05-20% | 0.05-0.20 | Low confidence assessments |
| Unlikely | 20-45% | 0.20-0.45 | Below-median confidence |
| Roughly even chance | 45-55% | 0.45-0.55 | Evenly balanced evidence |
| Likely | 55-80% | 0.55-0.80 | Above-median confidence |
| Very likely | 80-95% | 0.80-0.95 | High confidence assessments |
| Almost certain(ly) | 95-99% | 0.95-0.99 | Very high confidence assessments |

```typescript
// TSG.3 Confidence Annotation Schema (Conceptual)
const AnalysisConfidence = Schema.Struct({
  probability: Schema.Number.pipe(Schema.between(0.01, 0.99)),
  probability_term: Schema.Literal(
    'almost_no_chance', 'very_unlikely', 'unlikely',
    'roughly_even', 'likely', 'very_likely', 'almost_certain'
  ),
  confidence_level: Schema.Literal('low', 'moderate', 'high'),
  source_count: Schema.Number.pipe(Schema.nonNegative()),
  corroborating_sources: Schema.Number.pipe(Schema.nonNegative()),
  basis: Schema.String,
})
```

### 6.4 Cross-Source Correlation

**Normative Statement TSG.3-10**: The derived graph MUST support
cross-source correlation via d2ts `join` operators with at least the
following join key types:

| Join Key Type | Description | Use Case |
|--------------|-------------|----------|
| Selector match | Same identifier across sources (IP, domain, hash) | IOC correlation |
| Temporal proximity | Events within configurable time window | Activity clustering |
| Geospatial proximity | Events within configurable distance | Co-location analysis |
| Entity match | Same NLP-extracted entity across sources | Entity profiling |
| Custom key | Analyst-defined join criteria | Ad-hoc correlation |

---

## 7. Dissemination: Output Bridge and STIX Export

### 7.1 Output Bridge

**Normative Statement TSG.3-11**: The OutputBridge MUST provide:

a) Real-time delivery of derived signals to rendering layers via
   effect-atom state (`activeSignalsAtom`, etc.)
b) Batched write optimization to prevent render thrashing
c) Configurable output filtering (by signal kind, confidence, priority)

### 7.2 Rendering as Dissemination

The 4-layer rendering surface serves as the primary dissemination channel
for real-time intelligence:

| Layer | Dissemination Role | Consumer |
|-------|-------------------|----------|
| R3F (z:0) | Spatial context — network topology, geospatial display | Spatial analysts |
| visx (z:1) | Analytical overlays — timelines, charts, distributions | Data analysts |
| p5 (z:2) | Signal representation — spectrum, waterfall, generative | Signal analysts |
| DOM (z:3) | Text and controls — alerts, details, annotations | All analysts |

### 7.3 STIX Export

**Normative Statement TSG.3-12**: Tsingou MUST support STIX 2.1 bundle
export per [ADR-009]:

| Export Operation | Function | Input | Output |
|-----------------|----------|-------|--------|
| `toStixBundle()` | Convert analysis state to STIX bundle | Derived signals | STIX Bundle JSON |
| `toObservedData()` | Convert signal to observed-data SDO | Single BaseSignal | `observed-data` SDO |
| `toIndicator()` | Convert anomaly to indicator SDO | Anomaly detection output | `indicator` SDO |
| `toRelationship()` | Convert correlation to relationship SRO | d2ts join output | `relationship` SRO |

### 7.4 TAXII Transport

**Normative Statement TSG.3-13**: Tsingou SHOULD support TAXII 2.1
transport for STIX bundle delivery. TAXII collections SHOULD map to
NATS subjects per [ADR-009]:

| TAXII Concept | NATS Mapping |
|--------------|-------------|
| API Root | NATS subject prefix `tsingou.taxii.` |
| Collection | NATS subject `tsingou.taxii.{collection_id}` |
| Object | STIX bundle published to collection subject |
| Status | NATS request-reply for operation status |

### 7.5 CTI Platform Integration

**Normative Statement TSG.3-14**: Tsingou SHOULD support export to at
least the following CTI platform categories:

| Platform | Integration Method | Data Format |
|---------|-------------------|-------------|
| OpenCTI | GraphQL API / STIX import | STIX 2.1 Bundle |
| MISP | REST API / MISP push | MISP format or STIX |
| TheHive | Alert API | TheHive alert JSON |
| Palantir | STIX import / custom API | STIX 2.1 or Ontology |
| Generic SIEM | NATS → syslog/CEF bridge | Syslog, CEF, STIX |

---

## 8. Feedback: Closed-Loop Adjustment

### 8.1 Feedback Mechanisms

**Normative Statement TSG.3-15**: Tsingou MUST support at least the
following feedback mechanisms:

| Mechanism | Description | Implementation |
|----------|-------------|----------------|
| False positive marking | Analyst marks alert as false positive | DOM annotation → derived graph weight adjustment |
| Source quality feedback | Analyst rates source reliability | Admiralty rating update → adapter weight |
| Threshold tuning | Analyst adjusts anomaly thresholds | Session config update → d2ts parameter change |
| Graph topology adjustment | Add/remove analysis paths | d2ts graph reconfiguration (hot-plug operators) |
| Collection gap reporting | Analyst identifies missing coverage | Session config update → new adapter activation |

### 8.2 Feedback Loop Architecture

```
Analyst Interaction (DOM Layer)
    │
    ├──▶ False Positive Annotation
    │         │
    │         ▼
    │    Derived Graph: weight adjustment
    │    (reduce score for similar patterns)
    │
    ├──▶ Source Quality Rating
    │         │
    │         ▼
    │    Adapter Health: reliability update
    │    (Admiralty code change, weight in joins)
    │
    ├──▶ Threshold Adjustment
    │         │
    │         ▼
    │    d2ts Parameters: anomaly_threshold_sigma
    │    (immediate effect via d2ts incremental)
    │
    └──▶ New Source Activation
              │
              ▼
         AdapterManager: hot-plug new adapter
         (runtime addition, no restart)
```

### 8.3 Feedback Metrics

**Normative Statement TSG.3-16**: Implementations SHOULD track the
following feedback metrics:

| Metric | Measurement | Purpose |
|--------|-------------|---------|
| False positive rate | FP annotations / total alerts | Alert quality assessment |
| Source freshness | Time since last signal per adapter | Collection health monitoring |
| Coverage ratio | Active adapters / configured adapters | Collection completeness |
| Analysis latency | Time from signal ingest to derived output | Pipeline performance |
| Export latency | Time from analysis to STIX export | Dissemination timeliness |
| Analyst annotation rate | Annotations per session hour | Analyst engagement |

---

## 9. Structured Analytic Techniques Integration

### 9.1 ACH (Analysis of Competing Hypotheses)

**Normative Statement TSG.3-17**: Implementations SHOULD support ACH
integration with the following capabilities:

a) Hypothesis definition via DOM layer interface
b) Evidence-to-hypothesis consistency scoring (C/I/NA matrix)
c) Automated evidence generation from d2ts analysis outputs
d) Diagnosticity calculation (inconsistency counting)
e) Sensitivity analysis (impact of removing key evidence)

### 9.2 ACH Data Model

```typescript
// TSG.3 ACH Schema (Conceptual)
const ACHHypothesis = Schema.Struct({
  id: Schema.String,
  description: Schema.NonEmptyString,
  status: Schema.Literal('active', 'rejected', 'accepted'),
})

const ACHEvidence = Schema.Struct({
  id: Schema.String,
  description: Schema.NonEmptyString,
  source_signal_ids: Schema.Array(SignalId),
  credibility: Schema.Literal('high', 'medium', 'low'),
  relevance: Schema.Literal('high', 'medium', 'low'),
})

const ACHRating = Schema.Struct({
  evidence_id: Schema.String,
  hypothesis_id: Schema.String,
  rating: Schema.Literal('C', 'I', 'NA'),  // Consistent, Inconsistent, Not Applicable
})

const ACHMatrix = Schema.Struct({
  session_id: SessionId,
  hypotheses: Schema.Array(ACHHypothesis),
  evidence: Schema.Array(ACHEvidence),
  ratings: Schema.Array(ACHRating),
  conclusion: Schema.optional(Schema.Struct({
    best_hypothesis_id: Schema.String,
    confidence: AnalysisConfidence,
    rationale: Schema.String,
  })),
})
```

### 9.3 Indicators and Warnings (I&W)

**Normative Statement TSG.3-18**: Implementations SHOULD support I&W
monitoring with the following capabilities:

a) Indicator definition linked to d2ts operators (window thresholds,
   anomaly scores, frequency changes)
b) Warning condition levels (WATCHCON 5 through WATCHCON 1)
c) Automated WATCHCON escalation based on indicator threshold crossings
d) WATCHCON dashboard display in DOM layer

| WATCHCON | Condition | Tsingou Response |
|----------|----------|-----------------|
| 5 (Normal) | No indicators triggered | Standard monitoring |
| 4 (Increased) | 1-2 low-priority indicators | Enhanced collection (add adapters) |
| 3 (Heightened) | Multiple indicators or 1 high-priority | Analyst notification, increased analysis |
| 2 (Possible) | Strong indicator convergence | Alert generation, STIX export |
| 1 (Imminent) | Critical threshold exceeded | Full alert, all layers active |

---

## 10. ICD 203 Analytic Standards Compliance

**Normative Statement TSG.3-19**: Tsingou analysis outputs SHOULD comply
with [ICD-203] analytic tradecraft standards to the extent applicable
for an automated analysis platform:

| # | Standard | Tsingou Implementation | Compliance Level |
|---|---------|----------------------|-----------------|
| 1 | Objectivity | Multi-source ingestion, no source bias in pipeline | SHOULD |
| 2 | Political Independence | N/A (tool-level, not policy) | N/A |
| 3 | Timeliness | Real-time d2ts pipeline, sub-second visualization | MUST |
| 4 | Sourcing | Source tracking in BaseSignal metadata, Admiralty codes | SHOULD |
| 5 | Uncertainty | ICD 203 probability language in confidence annotations | SHOULD |
| 6 | Distinguishing | Annotation layer distinguishes evidence vs. assumption | SHOULD |
| 7 | Analysis of Alternatives | ACH integration (Section 9.1) | SHOULD |
| 8 | Customer Relevance | Session configuration ties to PIR/EEI | SHOULD |
| 9 | Logical Argumentation | Signal lineage audit trail via d2ts versioning | SHOULD |

---

## 11. Normative Requirements Summary

| ID | Requirement | Level | Section |
|----|------------|-------|---------|
| TSG.3-1 | Implement all six intelligence cycle phases | MUST | 2.1 |
| TSG.3-2 | Session configuration (5 sub-requirements) | MUST | 3.1 |
| TSG.3-3 | Hot-plug adapter management | MUST | 4.1 |
| TSG.3-4 | Adapter deployment model reporting | MUST | 4.2 |
| TSG.3-5 | Adapter health metrics | MUST | 4.3 |
| TSG.3-6 | Temporal ordering via BaseSignal versioning | MUST | 4.4 |
| TSG.3-7 | Ingest graph processing stages (6 stages) | MUST/SHOULD | 5.1 |
| TSG.3-8 | Eight analysis techniques implementation | MUST | 6.1 |
| TSG.3-9 | ICD 203 confidence annotations | SHOULD | 6.3 |
| TSG.3-10 | Cross-source correlation join keys (5 types) | MUST | 6.4 |
| TSG.3-11 | OutputBridge capabilities (3 sub-requirements) | MUST | 7.1 |
| TSG.3-12 | STIX 2.1 bundle export | MUST | 7.3 |
| TSG.3-13 | TAXII 2.1 transport via NATS | SHOULD | 7.4 |
| TSG.3-14 | CTI platform export | SHOULD | 7.5 |
| TSG.3-15 | Feedback mechanisms (5 types) | MUST | 8.1 |
| TSG.3-16 | Feedback metrics tracking (6 metrics) | SHOULD | 8.3 |
| TSG.3-17 | ACH integration (5 capabilities) | SHOULD | 9.1 |
| TSG.3-18 | I&W monitoring (4 capabilities) | SHOULD | 9.3 |
| TSG.3-19 | ICD 203 compliance (9 standards) | SHOULD | 10 |

---

## 12. Bibliography

| Key | Reference |
|-----|-----------|
| [RFC2119] | RFC 2119 — Key words for use in RFCs to Indicate Requirement Levels |
| [RFC8174] | RFC 8174 — Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words |
| [JP-2-0] | Joint Publication 2-0, Joint Intelligence (2013, revised 2022) |
| [JP-2-01] | Joint Publication 2-01, Joint and National Intelligence Support |
| [JP-2-01.3] | Joint Publication 2-01.3, Signals Intelligence Support to Operations |
| [ICD-203] | Intelligence Community Directive 203 — Analytic Standards (2015) |
| [HEUER-1999] | Heuer, Richards J. "Psychology of Intelligence Analysis" (CIA, 1999) |
| [HEUER-PHERSON-2010] | Heuer & Pherson, "Structured Analytic Techniques" (2010, 3rd ed. 2020) |
| [ADR-009] | Tsingou ADR-009: STIX Interop Layer |
| [ADR-010] | Tsingou ADR-010: Full Intelligence Cycle Coverage |
| [ADR-013] | Tsingou ADR-013: Analysis Techniques Catalog |
| [FLOW-ARCH] | Tsingou Flow Architecture Document |
| [STIX-2.1] | STIX Version 2.1, OASIS Standard (2021) |
| [TAXII-2.1] | TAXII Version 2.1, OASIS Standard (2021) |
| [ATT&CK] | MITRE ATT&CK Framework, Enterprise Matrix v14 (2024) |
| [TSG.2] | RFC Section TSG.2: SIGINT/OSINT Domain Reference |
| [TSG.5] | RFC Section TSG.5: Competitive Analysis |
| [TSG.12] | RFC Section TSG.12: STIX 2.1 Data Model |
| [TSG.13] | RFC Section TSG.13: BaseSignal-STIX Codec |

---

*TSG.3 — Intelligence Cycle. 19 normative statements.*
*Cross-references: TSG.2 (SIGINT Domain), TSG.5 (Competitive Analysis),*
*TSG.12/13 (STIX), ADR-009/010/013.*
