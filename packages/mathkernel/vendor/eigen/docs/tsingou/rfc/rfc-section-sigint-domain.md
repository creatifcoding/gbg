# RFC Section TSG.2: SIGINT/OSINT Domain Reference

```
Section:       TSG.2 — SIGINT/OSINT Domain Reference
Parent RFC:    Tsingou Platform Specification (TMNL-RFC-002)
Status:        DRAFT
Author:        Val (sigint-researcher)
Created:       2026-02-18
Research Base: research-sigint-disciplines.md (10 sections, 8 disciplines, 28 references)
```

> This section establishes the signals intelligence and open-source intelligence
> domain context for the Tsingou visualization platform. It defines the taxonomy
> of intelligence disciplines, their relevance to Tsingou's mission, and the
> normative mappings between each discipline and Tsingou's technical architecture
> (adapters, d2ts operators, rendering layers, and STIX export). The key words
> "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" are to be interpreted
> as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Scope and Applicability](#1-scope-and-applicability)
2. [Intelligence Discipline Taxonomy](#2-intelligence-discipline-taxonomy)
3. [COMINT: Communications Intelligence](#3-comint-communications-intelligence)
4. [ELINT: Electronic Intelligence](#4-elint-electronic-intelligence)
5. [FISINT: Foreign Instrumentation Signals Intelligence](#5-fisint-foreign-instrumentation-signals-intelligence)
6. [CYBINT: Cyber/Digital Network Intelligence](#6-cybint-cyberdigital-network-intelligence)
7. [MASINT: Measurement and Signature Intelligence](#7-masint-measurement-and-signature-intelligence)
8. [GEOINT: Geospatial Intelligence](#8-geoint-geospatial-intelligence)
9. [OSINT: Open Source Intelligence](#9-osint-open-source-intelligence)
10. [Legal and Classification Frameworks](#10-legal-and-classification-frameworks)
11. [Adapter-to-Discipline Master Matrix](#11-adapter-to-discipline-master-matrix)
12. [Platform Positioning and Integration Boundaries](#12-platform-positioning-and-integration-boundaries)
13. [Normative Requirements Summary](#13-normative-requirements-summary)
14. [Bibliography](#14-bibliography)

---

## 1. Scope and Applicability

### 1.1 Purpose

This section defines the intelligence domain model that governs Tsingou's
data ingestion, processing, analysis, and visualization capabilities. Every
source adapter, d2ts pipeline operator, rendering decision, and STIX export
mapping traces to the discipline taxonomy established herein.

### 1.2 Architecture Context

Tsingou operates at the Processing, Exploitation, and Dissemination (PED)
stages of the intelligence cycle [JP-2-01]. The platform does NOT perform
signals collection — it ingests from external collection sources and
provides visualization, analysis, and export capabilities.

```
┌─────────────────────────────────────────────────────────────────┐
│                    COLLECTION LAYER (External)                   │
│                                                                  │
│  SDR Hardware │ Network Sensors │ OSINT Crawlers │ Feeds/APIs    │
│       │              │                │               │          │
│       ▼              ▼                ▼               ▼          │
│  GNU Radio     Zeek/Suricata    SpiderFoot      Recorded Future  │
│       │              │                │               │          │
└───────┼──────────────┼────────────────┼───────────────┼──────────┘
        │              │                │               │
        ▼              ▼                ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TSINGOU PED LAYER                             │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │   NATS   │   │   HTTP   │   │   RSS    │   │WebSocket │     │
│  │ Adapter  │   │ Adapter  │   │ Adapter  │   │ Adapter  │     │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘     │
│       │              │               │              │            │
│       ▼              ▼               ▼              ▼            │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              d2ts Ingest Graph                        │       │
│  │  normalize → validate → dedup → enrich → version     │       │
│  └────────────────────────┬─────────────────────────────┘       │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              d2ts Derived Graph                       │       │
│  │  join → window → aggregate → anomaly → topK          │       │
│  └────────────────────────┬─────────────────────────────┘       │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              4-Layer Rendering                        │       │
│  │  R3F (z:0) │ visx (z:1) │ p5 (z:2) │ DOM (z:3)     │       │
│  └──────────────────────────────────────────────────────┘       │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              STIX Export / TAXII Bridge               │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Terminology

| Term | Definition |
|------|-----------|
| **BaseSignal** | The internal signal representation defined by Effect.Schema, with branded IDs, d2ts versioning, and kind discriminator [FLOW-ARCH] |
| **Signal Kind** | The `kind` discriminator field on BaseSignal — one of 8 known types or runtime-registered custom kinds |
| **Adapter** | A source adapter that converts external data into BaseSignal for d2ts ingestion |
| **d2ts** | Differential dataflow engine from `@electric-sql/d2ts` used for incremental computation |
| **PED** | Processing, Exploitation, and Dissemination — the intelligence cycle stages Tsingou owns |
| **TPED/TCPED** | Tasking, (Collection), Processing, Exploitation, Dissemination — full cycle [JP-2-01.3] |
| **INT** | Intelligence discipline (e.g., SIGINT, OSINT, CYBINT) |
| **Multi-INT** | Integration of intelligence from multiple disciplines |

---

## 2. Intelligence Discipline Taxonomy

### 2.1 Discipline Hierarchy

Tsingou recognizes the following intelligence discipline hierarchy, aligned
with ODNI IC discipline categories [NIDC-2022]:

```
Intelligence Disciplines
├── SIGINT (Signals Intelligence)
│   ├── COMINT (Communications Intelligence)
│   ├── ELINT (Electronic Intelligence)
│   └── FISINT (Foreign Instrumentation Signals Intelligence)
├── CYBINT/DNINT (Cyber/Digital Network Intelligence)
├── MASINT (Measurement and Signature Intelligence)
│   ├── RADINT, NUCINT, ACINT, IRINT, LASINT
│   ├── CBRINT, ELECTRO-OPTINT, RF/EMPINT
│   └── Seismic, Debris
├── GEOINT (Geospatial Intelligence)
│   ├── IMINT (Imagery Intelligence)
│   └── Geospatial Analysis
├── OSINT (Open Source Intelligence)
└── HUMINT (Human Intelligence) — NOT in Tsingou scope
```

### 2.2 Tsingou Support Levels

Each discipline is assigned a normative support level per [RFC2119]:

| Discipline | Support Level | Rationale |
|-----------|--------------|-----------|
| **CYBINT/DNINT** | MUST | Primary discipline — most STIX-native, direct adapter mapping |
| **OSINT** | MUST | Primary discipline — RSS, HTTP, WebSocket adapters are OSINT-native |
| **COMINT** | SHOULD | Core SIGINT — metadata analysis via API adapters, SDR bridge for RF |
| **ELINT** | SHOULD | Core SIGINT — SDR bridge provides PDW streams, spectrum data |
| **GEOINT** | SHOULD | Geospatial correlation enriches all disciplines via R3F layer |
| **MASINT** | MAY | Sensor data ingestible via custom adapters and schema extension |
| **FISINT** | MAY | Telemetry ingestible via custom adapters and schema extension |
| **HUMINT** | NOT SUPPORTED | Tsingou is a technical collection visualization platform |

**Normative Statement TSG.2-1**: Implementations MUST provide full support
for CYBINT and OSINT disciplines, including adapter ingestion, d2ts
processing, analysis operator coverage, and STIX export.

**Normative Statement TSG.2-2**: Implementations SHOULD provide support
for COMINT, ELINT, and GEOINT disciplines through appropriate adapter
configurations and rendering layer assignments.

**Normative Statement TSG.2-3**: Implementations MAY provide support for
MASINT and FISINT disciplines through runtime schema extension and custom
adapter registration.

### 2.3 Discipline-to-Architecture Mapping Overview

| Discipline | Primary Adapter(s) | d2ts Operators | Rendering Layer | STIX Export |
|-----------|-------------------|---------------|-----------------|-------------|
| CYBINT | HTTP, NATS, WebSocket, File | join, window, anomaly | DOM (matrix), visx (chart), R3F (graph) | indicator, malware, attack-pattern |
| OSINT | RSS, HTTP, WebSocket | map, filter, join | DOM (text), visx (timeline), R3F (graph) | observed-data, report |
| COMINT | HTTP, NATS, File | join, aggregate, window | visx (timeline, chart), DOM (table) | observed-data, relationship |
| ELINT | NATS (SDR bridge) | map, filter, iterate | p5 (spectrum, waterfall), visx (scatter) | observed-data (custom ext.) |
| GEOINT | HTTP (tile server, API) | join (geo-key) | R3F (3D map), visx (2D map) | location, observed-data |
| MASINT | NATS, WebSocket, HTTP | map, window, anomaly | visx (time-series), p5 (spectrogram) | observed-data |
| FISINT | HTTP, NATS | map, window | R3F (trajectory), visx (telemetry) | observed-data |

---

## 3. COMINT: Communications Intelligence

### 3.1 Definition

COMINT is intelligence derived from intercepted communications — the
content of messages, the metadata surrounding them, and the patterns
of communication behavior [JP-2-0]. COMINT is the largest SIGINT
sub-discipline by volume and organizational investment.

### 3.2 Tsingou COMINT Scope

Tsingou processes COMINT-derived data, not raw COMINT intercepts.
The distinction is critical:

| Activity | In Tsingou Scope? | Reason |
|----------|------------------|--------|
| Signal interception | NO | Requires classified collection platforms |
| Decryption | NO | Requires cryptanalytic capability |
| Translation | NO | External NLP service, results ingested via adapter |
| Metadata analysis | YES | CDR, contact chaining, traffic analysis via d2ts |
| Content analysis (post-processing) | YES | NLP-extracted entities via adapter |
| Visualization | YES | All rendering layers available |
| Pattern detection | YES | d2ts window, anomaly, aggregate operators |
| STIX export | YES | Observed-data, relationship SROs |

**Normative Statement TSG.2-4**: Implementations SHOULD support COMINT
metadata ingestion through at least `HttpSourceAdapter` (API polling for
CDR/metadata feeds) and `NatsSourceAdapter` (event streams from
processing systems).

### 3.3 COMINT Data Model in Tsingou

COMINT data enters Tsingou as BaseSignal instances with discipline-specific
metadata in the `meta` extension field:

```typescript
// Conceptual COMINT metadata extension
const ComintMetadata = Schema.Struct({
  discipline: Schema.Literal('COMINT'),
  sub_type: Schema.Literal('cdr', 'metadata', 'content_extract', 'traffic_analysis'),
  selector_type: Schema.optional(
    Schema.Literal('phone', 'email', 'imsi', 'ip', 'domain', 'account')
  ),
  source_reliability: Schema.optional(
    Schema.Literal('A', 'B', 'C', 'D', 'E', 'F')
  ),
  info_accuracy: Schema.optional(
    Schema.Literal('1', '2', '3', '4', '5', '6')
  ),
  classification: Schema.optional(Schema.String), // e.g., "TLP:AMBER"
})
```

### 3.4 COMINT Processing in d2ts

| Processing Activity | d2ts Operator | Requirement Level | Description |
|--------------------|--------------|------------------|-------------|
| Contact chaining (1-2 hop) | `join` (selector key) | SHOULD | Build social network from CDR selector co-occurrence |
| Traffic volume analysis | `window` + `count` | SHOULD | Aggregate communication events per time bucket |
| Temporal pattern detection | `window` + anomaly | SHOULD | Detect deviations from normal communication patterns |
| Selector co-occurrence | `join` (temporal key) | SHOULD | Identify selectors appearing together in time windows |
| Communication burst detection | `window` + threshold | MAY | Flag sudden increase in communication volume |
| Geographic call pattern | `join` (geo-key) + `window` | MAY | Correlate communication events with geospatial position |
| Protocol distribution | `aggregate` (group-by protocol) | MAY | Measure relative usage of communication protocols |
| Contact frequency profiling | `iterate` (rolling count) | SHOULD | Maintain per-selector contact frequency baselines |

### 3.5 COMINT Contact Chaining

Contact chaining is the primary COMINT analysis technique — constructing
social network graphs from communication metadata. In Tsingou, this maps
to d2ts `join` operators:

```
Contact Chaining Pipeline (d2ts Derived Graph)

CDR Stream (BaseSignal, kind: nats)
    │
    ▼
┌───────────────────────────────────────────────────────┐
│  Stage 1: Selector Extraction                          │
│  map(signal → { caller, callee, timestamp, duration }) │
└────────────────────────┬──────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────┐
│  Stage 2: 1-Hop Join (Direct Contacts)                 │
│  join(caller == callee, within: window(24h))           │
│                                                         │
│  Input:  A calls B, B calls C                          │
│  Output: A → B → C (1-hop chain)                       │
└────────────────────────┬──────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────┐
│  Stage 3: Contact Frequency Scoring                    │
│  aggregate(pair_key, count, window(7d))                │
│                                                         │
│  Output: { pair: (A,B), frequency: 47, window: 7d }   │
└────────────────────────┬──────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────┐
│  Stage 4: Anomaly Detection                            │
│  iterate(baseline) + filter(deviation > threshold)     │
│                                                         │
│  Flags: new contacts, frequency spikes, dormant        │
│  reactivation, timing changes                          │
└───────────────────────────────────────────────────────┘
```

**Normative Statement TSG.2-4a**: COMINT contact chaining SHOULD support
configurable chain depth (1-hop, 2-hop) with analyst-defined selectors as
seed nodes. Chain depth beyond 2 hops is NOT RECOMMENDED due to
combinatorial explosion.

### 3.6 COMINT Traffic Analysis

Traffic analysis extracts intelligence from communication patterns without
access to message content — a critical capability when content is encrypted
or legally restricted:

| Traffic Analysis Technique | d2ts Implementation | Output |
|---------------------------|-------------------|--------|
| Volume analysis | `window(1h)` + `count` | Signal volume per time bucket |
| Frequency analysis | `iterate(rolling_freq)` | Contact frequency baseline + deviation |
| Timing analysis | `window(variable)` + pattern | Communication timing regularity |
| Network structure | `join(pair_key)` + centrality | Social graph topology metrics |
| Anomaly detection | `iterate(EWMA)` + threshold | Deviation from established patterns |
| Correlation with events | `join(temporal)` with OSINT | Communication surges around events |

### 3.7 COMINT Rendering

| Visualization | Rendering Layer | Data Source | Analyst Interaction |
|--------------|-----------------|-------------|-------------------|
| Contact network graph | R3F (z:0 WebGL) | d2ts join output — entity relationships | Click-to-expand, degree filtering |
| Communication timeline | visx (z:1 SVG) | d2ts window output — temporal events | Brush selection, zoom |
| Traffic volume chart | visx (z:1 SVG) | d2ts aggregate output — counts over time | Threshold overlay, export |
| Selector detail panel | DOM (z:3 React) | BaseSignal metadata | Search, filter, annotate |
| Alert indicators | DOM (z:3 React) | Anomaly detection threshold crossings | Acknowledge, escalate |
| Geographic overlay | R3F (z:0 WebGL) | Geolocation enrichment data | Layer toggle |
| Frequency heatmap | visx (z:1 SVG) | Contact frequency matrix | Sort by centrality |

---

## 4. ELINT: Electronic Intelligence

### 4.1 Definition

ELINT is intelligence derived from non-communications electromagnetic
emissions — primarily radar systems, navigation aids, IFF transponders,
and electronic emitters [JP-2-0]. ELINT analysis centers on characterizing
emitters through their Pulse Descriptor Word (PDW) parameters.

### 4.2 Tsingou ELINT Scope

Tsingou processes ELINT data received from SDR hardware via the GNU Radio
bridge [ADR-011]:

```
┌──────────────┐     ┌──────────────────┐     ┌────────────┐     ┌──────────┐
│  SDR Hardware │────▶│  GNU Radio       │────▶│  NATS      │────▶│ Tsingou  │
│  (RTL-SDR,   │     │  (signal proc.)  │     │ (transport)│     │ (PED)    │
│   HackRF,    │     │                  │     │            │     │          │
│   USRP)      │     │  - Decimation    │     │ Topics:    │     │ Adapters:│
│              │     │  - Channelizing  │     │ .sdr.fft.* │     │ NATS     │
│              │     │  - Demodulation  │     │ .sdr.pdw.* │     │          │
│              │     │  - PDW extraction│     │ .sdr.iq.*  │     │          │
└──────────────┘     └──────────────────┘     └────────────┘     └──────────┘
```

### 4.3 PDW Schema (Normative)

**Normative Statement TSG.2-5**: ELINT PDW data ingested by Tsingou
MUST conform to the following schema or a compatible superset:

```typescript
// TSG.2 Normative PDW Schema
const PulseDescriptorWord = Schema.Struct({
  // Required fields
  rf_mhz: Schema.Number.pipe(
    Schema.between(0.1, 100000),
    Schema.description('Center frequency in MHz')
  ),
  toa_us: Schema.Number.pipe(
    Schema.positive(),
    Schema.description('Time of arrival in microseconds (epoch-referenced)')
  ),

  // Conditionally required fields (SHOULD be present)
  pa_dbm: Schema.optional(Schema.Number.pipe(
    Schema.between(-150, 50),
    Schema.description('Pulse amplitude in dBm')
  )),
  pw_us: Schema.optional(Schema.Number.pipe(
    Schema.positive(),
    Schema.description('Pulse width in microseconds')
  )),
  pri_us: Schema.optional(Schema.Number.pipe(
    Schema.positive(),
    Schema.description('Pulse repetition interval in microseconds')
  )),

  // Optional fields (MAY be present)
  aoa_deg: Schema.optional(Schema.Number.pipe(
    Schema.between(0, 360),
    Schema.description('Angle of arrival in degrees')
  )),
  mop_type: Schema.optional(Schema.Literal(
    'none', 'linear_fm', 'barker', 'polyphase', 'frequency_hop', 'unknown'
  )),
  emitter_id: Schema.optional(Schema.String.pipe(
    Schema.description('Identified emitter from EOB matching')
  )),
})
```

### 4.4 Radar Type Classification

ELINT analysis requires understanding the radar types that produce the
electromagnetic emissions being analyzed. Tsingou's ELINT pipeline SHOULD
support classification against the following radar categories:

| Radar Type | Function | Key PDW Characteristics | Tsingou Visualization |
|-----------|----------|------------------------|---------------------|
| Early warning (EW) | Long-range air surveillance | Low PRF (250-500 Hz), L/S band | R3F coverage overlay |
| Height finder | Altitude determination | V-beam or nodding beam, variable PRI | visx altitude plot |
| Acquisition | Target acquisition for weapons | Medium PRF (500-2000 Hz), S/C band | R3F sector display |
| Track-while-scan | Simultaneous track + search | Complex PRI, multiple modes | visx mode timeline |
| Fire control | Weapons guidance | High PRF (5-50 kHz), X/Ku band | DOM threat alert |
| Airborne intercept | Fighter radar | Multiple modes, frequency agile | visx parametric scatter |
| SAR/ISAR | Imaging radar | Wideband, long dwell | p5 image reconstruction |
| Weather | Meteorological | C/S band, low power | visx precipitation map |
| Navigation | Ship/aircraft navigation | X band, medium power | R3F track display |
| IFF | Identification Friend/Foe | 1030/1090 MHz interrogation/reply | DOM transponder log |

### 4.5 Emitter Deinterleaving

When multiple radar emitters illuminate an ELINT receiver simultaneously,
their pulses arrive interleaved in a single PDW stream. Deinterleaving
separates the composite stream into per-emitter pulse trains:

```
Composite PDW Stream (from GNU Radio via NATS)
    │
    │  ┌─ Emitter A: RF=9400 MHz, PRI=1000 μs
    │  │  ┌─ Emitter B: RF=3200 MHz, PRI=2500 μs
    │  │  │  ┌─ Emitter C: RF=9400 MHz, PRI=750 μs  (same RF as A!)
    ▼  ▼  ▼  ▼
┌──────────────────────────────────────────────────────┐
│  Stage 1: Primary Sort (RF frequency bins)            │
│  filter(rf_mhz ∈ bin) — separate by frequency band   │
│                                                        │
│  Note: Emitters A and C share RF band — requires       │
│  secondary discrimination                              │
└────────────────────────┬─────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│  Stage 2: PRI Analysis (within RF bin)                 │
│  iterate(toa_diff) — compute inter-pulse intervals    │
│                                                        │
│  A: PRI = 1000 ± 5 μs (stable)                       │
│  C: PRI = 750 ± 3 μs (stable, different from A)      │
│  → Separated by PRI discrimination                     │
└────────────────────────┬─────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│  Stage 3: Emitter Clustering                           │
│  Cluster on multi-dimensional PDW space:               │
│  (RF, PRI, PW, MOP, AOA)                              │
│                                                        │
│  Output: Separate pulse trains per emitter             │
│  Each tagged with emitter_id                           │
└────────────────────────┬─────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│  Stage 4: EOB Matching                                 │
│  join(emitter_params, eob_database)                    │
│                                                        │
│  Match deinterleaved parameters against Electronic     │
│  Order of Battle (EOB) reference database              │
│  → Emitter identification + threat classification      │
└──────────────────────────────────────────────────────┘
```

**Normative Statement TSG.2-5a**: ELINT deinterleaving, if implemented,
SHOULD use at minimum RF frequency and PRI as primary discriminants. AOA,
pulse width, and modulation-on-pulse (MOP) SHOULD serve as secondary
discriminants when available.

### 4.6 Scan Pattern Taxonomy

Radar scan patterns provide critical intelligence about emitter type and
operational mode. The following taxonomy defines the scan patterns Tsingou
SHOULD recognize:

| Scan Pattern | Description | Detection Method | Intelligence Value |
|-------------|-------------|-----------------|-------------------|
| Circular | 360° continuous rotation | Periodic amplitude modulation, constant period | Surveillance radar (EW) |
| Sector | Limited angular sweep | Periodic amplitude with asymmetric profile | Directed search mode |
| Raster | Rectangular area coverage | Nested scan periods (azimuth + elevation) | Height finder, PAR |
| Helical | Continuous circular + elevation | Amplitude modulation with elevation drift | 3D surveillance |
| Conical | Small cone around target | Amplitude modulation at scan rate | Tracking, fire control |
| Track-while-scan | Interleaved track + scan | Mode switching in PDW stream | Multi-function radar |
| Palmer | Conical + circular combined | Complex amplitude pattern | Anti-jamming tracking |
| Lobe-on-receive-only | No transmit scan pattern | Requires multi-receiver analysis | Passive radar |
| Electronic (ESA/AESA) | Beam steering without mechanical | Near-instantaneous frequency/PRI change | Modern AESA radars |
| Frequency agile | Rapid frequency hopping | Wide RF spread in short intervals | ECCM-equipped systems |

### 4.7 ELINT Schema Extensions

```typescript
// TSG.2 ELINT Extended Metadata Schema
const ElintMetadata = Schema.Struct({
  discipline: Schema.Literal('ELINT'),
  sub_type: Schema.Literal('pdw', 'spectrum', 'emitter_report', 'eob_match'),

  // PDW-specific fields (when sub_type === 'pdw')
  pdw: Schema.optional(PulseDescriptorWord),

  // Emitter classification (when sub_type === 'emitter_report')
  emitter: Schema.optional(Schema.Struct({
    emitter_id: Schema.String,
    radar_type: Schema.optional(Schema.Literal(
      'early_warning', 'height_finder', 'acquisition', 'track_while_scan',
      'fire_control', 'airborne_intercept', 'sar_isar', 'weather',
      'navigation', 'iff', 'unknown'
    )),
    scan_pattern: Schema.optional(Schema.Literal(
      'circular', 'sector', 'raster', 'helical', 'conical',
      'track_while_scan', 'palmer', 'loro', 'electronic', 'frequency_agile'
    )),
    pri_type: Schema.optional(Schema.Literal(
      'stable', 'jittered', 'stagger', 'dwell_switch', 'sliding', 'unknown'
    )),
    threat_level: Schema.optional(Schema.Literal('friendly', 'neutral', 'hostile', 'unknown')),
    eob_match_confidence: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  })),

  // Spectrum snapshot (when sub_type === 'spectrum')
  spectrum: Schema.optional(Schema.Struct({
    center_freq_mhz: Schema.Number,
    bandwidth_mhz: Schema.Number,
    bin_count: Schema.Number,
    sample_rate_hz: Schema.Number,
  })),
})
```

### 4.8 ELINT Processing in d2ts

| Processing Activity | d2ts Operator | Requirement Level | Description |
|--------------------|--------------|------------------|-------------|
| PDW stream ingestion | `map` (normalize) | MUST (if ELINT) | Convert raw PDW to BaseSignal with ElintMetadata |
| Frequency histogram | `window` + `count` (RF bins) | SHOULD | Aggregate pulse counts per frequency bin |
| PRI analysis | `iterate` (rolling statistics) | SHOULD | Compute PRI statistics, classify PRI type |
| Emitter deinterleaving | `filter` + clustering | MAY | Separate interleaved PDW streams per emitter |
| Scan pattern detection | `window` + temporal analysis | MAY | Classify radar scan pattern from amplitude envelope |
| Spectrum occupancy | `window` + `aggregate` | SHOULD | Track which frequency bands are active over time |
| EOB matching | `join` (emitter_params, eob_ref) | MAY | Match parameters against known emitter database |
| Threat classification | `map` (threat_level) | MAY | Assign threat level from EOB match + context |
| Frequency agility detection | `iterate` (RF spread) | MAY | Detect frequency-hopping or agile emitters |
| Emitter activity timeline | `window` + presence | SHOULD | Track when each identified emitter is active |

### 4.9 ELINT Rendering

| Visualization | Layer | Description | Analyst Interaction |
|--------------|-------|-------------|-------------------|
| Waterfall display | p5 (z:2 Canvas) | Time x frequency x amplitude heatmap | Zoom, frequency select |
| Spectrum plot (FFT) | p5 (z:2 Canvas) | Real-time frequency power display | Peak marker, bandwidth |
| PDW scatter plot | visx (z:1 SVG) | RF vs. PRI, RF vs. PW parametric plots | Cluster selection |
| Emitter location map | R3F (z:0 WebGL) | 3D geospatial emitter positions (AOA/TDOA) | Layer toggle, filter |
| Emitter parameter table | DOM (z:3 React) | Sortable/filterable emitter catalog | Sort, search, export |
| Signal timeline | visx (z:1 SVG) | Temporal activity of identified emitters | Brush select, zoom |
| Scan pattern display | p5 (z:2 Canvas) | Polar plot of detected scan pattern | Pattern match overlay |
| Constellation diagram | p5 (z:2 Canvas) | I/Q phase diagram for MOP analysis | Modulation classification |
| PRI histogram | visx (z:1 SVG) | PRI distribution for classification | Bin selection, overlay |
| Threat indicator | DOM (z:3 React) | EOB-matched threat classification badge | Acknowledge, escalate |

### 4.10 EW Doctrine Cross-Reference

ELINT analysis in Tsingou aligns with the Electronic Warfare Support (ES)
mission area as defined in [JP-3-85] and TSG.36. Key mapping points:

| EW Concept (TSG.36) | Tsingou ELINT Mapping | Cross-Reference |
|---------------------|---------------------|-----------------|
| ES search and intercept | GNU Radio flowgraph → NATS | TSG.36.4 (ES vs SIGINT) |
| Emitter identification | EOB matching via d2ts join | TSG.36.18 (subdiscipline mapping) |
| Electronic Order of Battle | Reference dataset for join operator | TSG.36.10 (TPED mapping) |
| ECCM awareness | Frequency agility detection | TSG.36.11 (cycle extension) |
| Threat warning | Fire control radar detection → alert | TSG.36.4 (immediate ES function) |

Cross-reference: DSP foundations in TSG.25. SDR hardware in TSG.16. GNU
Radio bridge in TSG.17. Spectrum visualization in TSG.19. EW doctrine
alignment in TSG.36.

---

## 5. FISINT: Foreign Instrumentation Signals Intelligence

### 5.1 Definition

FISINT is intelligence derived from foreign instrumentation signals
associated with aerospace, surface, and subsurface system testing —
including telemetry, beaconry, video data links, and command signals
[JP-2-0].

### 5.2 Tsingou FISINT Scope

**Normative Statement TSG.2-6**: Implementations MAY support FISINT
data ingestion via custom schema registration in the SchemaRegistry
(NATS KV). FISINT support is NOT required for conformance.

If implemented, FISINT data SHOULD enter Tsingou through:

- `HttpSourceAdapter`: REST API for telemetry archives
- `NatsSourceAdapter`: Real-time telemetry event streams
- `WebSocketSourceAdapter`: Live telemetry feeds

FISINT visualization maps to:

| Data Type | Rendering Layer |
|----------|-----------------|
| Vehicle trajectory | R3F (z:0 WebGL) — 3D path visualization |
| Telemetry time-series | visx (z:1 SVG) — parameter plots |
| Event markers | DOM (z:3 React) — annotated timeline |

---

## 6. CYBINT: Cyber/Digital Network Intelligence

### 6.1 Definition

CYBINT (also DNINT) is intelligence derived from computer networks, digital
infrastructure, and cyber operations. CYBINT is the fastest-growing
intelligence discipline and the most natively aligned with STIX 2.1 data
modeling [STIX-2.1].

### 6.2 Tsingou CYBINT Scope

**Normative Statement TSG.2-7**: Implementations MUST provide full CYBINT
support, including:

a) Ingestion of threat intelligence feeds via `HttpSourceAdapter` (TAXII
   poll, REST API) and `RssSourceAdapter` (advisory feeds)
b) Real-time alert processing via `WebSocketSourceAdapter` and
   `NatsSourceAdapter`
c) IOC correlation via d2ts `join` operators
d) ATT&CK technique mapping via d2ts `map` operators
e) STIX 2.1 bundle export for all CYBINT-derived intelligence

### 6.3 IOC Correlation Pipeline

```
Threat Intel Feed (STIX/API)        Network Telemetry (NATS)
        │                                    │
        ▼                                    ▼
  ┌───────────┐                       ┌───────────┐
  │  HTTP     │                       │  NATS     │
  │  Adapter  │                       │  Adapter  │
  └─────┬─────┘                       └─────┬─────┘
        │                                    │
        ▼ BaseSignal (kind: http)            ▼ BaseSignal (kind: nats)
  ┌──────────────────────────────────────────────────┐
  │                d2ts Ingest Graph                   │
  │  normalize → validate → extract-IOCs → tag        │
  └────────────────────────┬─────────────────────────┘
                           │
                           ▼
  ┌──────────────────────────────────────────────────┐
  │                d2ts Derived Graph                  │
  │                                                    │
  │  join(ioc_key) ─── Correlate IOCs across sources  │
  │       │                                            │
  │       ▼                                            │
  │  map(att&ck_tag) ─── Map to ATT&CK techniques     │
  │       │                                            │
  │       ▼                                            │
  │  window(time) ─── Detect temporal clustering       │
  │       │                                            │
  │       ▼                                            │
  │  anomaly ─── Score deviation from baseline         │
  └────────────────────────┬─────────────────────────┘
                           │
                           ▼
  ┌──────────────────────────────────────────────────┐
  │              Output Bridge                         │
  │  → indicator SDOs      → R3F graph visualization  │
  │  → relationship SROs   → visx timeline            │
  │  → attack-pattern SDOs → DOM ATT&CK matrix        │
  └──────────────────────────────────────────────────┘
```

### 6.4 ATT&CK Integration

**Normative Statement TSG.2-8**: CYBINT analysis MUST support mapping
of detected activities to MITRE ATT&CK Enterprise Matrix techniques.
Implementations SHOULD maintain an ATT&CK technique catalog as a
reference dataset.

**Full ATT&CK Tactic Coverage:**

| # | ATT&CK Tactic | ID | Detection d2ts Operator | Signal Source | STIX Export |
|---|---------------|-----|------------------------|---------------|-------------|
| 1 | Reconnaissance | TA0043 | `window` + frequency analysis | OSINT feeds, network logs | `attack-pattern` |
| 2 | Resource Development | TA0042 | `join` (infrastructure IOCs) | Threat intel, DNS | `infrastructure` |
| 3 | Initial Access | TA0001 | `join` (IOC correlation) | Threat intel + network | `indicator` → `attack-pattern` |
| 4 | Execution | TA0002 | `anomaly` (process behavior) | Endpoint telemetry | `malware`, `attack-pattern` |
| 5 | Persistence | TA0003 | `iterate` (state tracking) | Endpoint telemetry | `indicator`, `malware` |
| 6 | Privilege Escalation | TA0004 | `anomaly` (access pattern) | Auth logs, endpoint | `attack-pattern` |
| 7 | Defense Evasion | TA0005 | `iterate` (baseline deviation) | Endpoint, network | `attack-pattern` |
| 8 | Credential Access | TA0006 | `window` (auth failure bursts) | Auth logs | `indicator` |
| 9 | Discovery | TA0007 | `window` (scan patterns) | Network flows | `indicator` |
| 10 | Lateral Movement | TA0008 | `join` (source-dest chain) | Network, auth logs | `indicator`, `relationship` |
| 11 | Collection | TA0009 | `anomaly` (data access spikes) | File access, network | `attack-pattern` |
| 12 | Command and Control | TA0011 | `window` + periodicity | Network flows, DNS | `indicator`, `infrastructure` |
| 13 | Exfiltration | TA0010 | `anomaly` (volume deviation) | Network telemetry | `indicator` |
| 14 | Impact | TA0040 | `anomaly` (service disruption) | System telemetry | `attack-pattern` |

### 6.5 Diamond Model Integration

The Diamond Model of Intrusion Analysis [CALTAGIRONE-2013] provides a
complementary analytic framework to ATT&CK. Each intrusion event comprises
four vertices:

```
                    Adversary
                    ┌───────┐
                    │       │
                    │  Who  │
                    │       │
                    └───┬───┘
                        │
            ┌───────────┼───────────┐
            │           │           │
            ▼           │           ▼
      ┌───────┐         │     ┌───────┐
      │       │         │     │       │
      │ Infra-│◀────────┼────▶│Capabi-│
      │struct.│         │     │ lity  │
      │       │         │     │       │
      └───┬───┘         │     └───┬───┘
          │             │         │
          └─────────────┼─────────┘
                        │
                    ┌───┴───┐
                    │       │
                    │Victim │
                    │       │
                    └───────┘
```

**Diamond Model → Tsingou Mapping:**

| Diamond Vertex | Tsingou Representation | d2ts Processing | STIX Mapping |
|---------------|----------------------|-----------------|-------------|
| **Adversary** | BaseSignal with `actor` tag | `join` (attribution) | `threat-actor` SDO |
| **Infrastructure** | IP/domain/URL IOCs | `join` (IOC correlation) | `infrastructure` SDO |
| **Capability** | Malware, exploits, tools | `map` (ATT&CK tagging) | `malware`, `tool` SDOs |
| **Victim** | Targeted systems/organizations | `join` (target correlation) | `identity` SDO |

**Normative Statement TSG.2-8a**: Implementations SHOULD support Diamond
Model meta-features (timestamp, phase, result, direction, methodology,
resources) as BaseSignal metadata extensions for CYBINT signals.

### 6.6 Cyber Kill Chain Mapping

The Lockheed Martin Cyber Kill Chain [HUTCHINS-2011] defines seven phases
of an intrusion. Tsingou maps these to d2ts analysis stages:

| Kill Chain Phase | ATT&CK Tactics | d2ts Detection | Tsingou Response |
|-----------------|---------------|----------------|-----------------|
| 1. Reconnaissance | TA0043 | `window` (scan frequency) | Alert + OSINT correlation |
| 2. Weaponization | TA0042 | `join` (malware samples) | Threat intel enrichment |
| 3. Delivery | TA0001 | `join` (IOC match) | Block recommendation |
| 4. Exploitation | TA0002, TA0004 | `anomaly` (behavior) | Alert escalation |
| 5. Installation | TA0003 | `iterate` (persistence) | Alert + forensic markers |
| 6. C2 | TA0011 | `window` (periodicity) | Alert + infrastructure mapping |
| 7. Actions on Objectives | TA0009, TA0010, TA0040 | `anomaly` (exfil/impact) | Critical alert + STIX export |

### 6.7 CYBINT IOC Type Catalog

**Normative Statement TSG.2-8b**: Implementations MUST support the
following IOC types for CYBINT processing:

| IOC Type | STIX Cyber Observable | d2ts Join Key | Example |
|---------|----------------------|--------------|---------|
| IPv4 address | `ipv4-addr` | `value` | `192.168.1.1` |
| IPv6 address | `ipv6-addr` | `value` | `2001:db8::1` |
| Domain name | `domain-name` | `value` | `evil.example.com` |
| URL | `url` | `value` | `https://evil.example.com/payload` |
| Email address | `email-addr` | `value` | `phisher@evil.com` |
| File hash (MD5) | `file.hashes.MD5` | `hash` | `d41d8cd98f00b204e9800998ecf8427e` |
| File hash (SHA-256) | `file.hashes.SHA-256` | `hash` | `e3b0c44298fc1c149afbf4c8996fb924...` |
| File name | `file.name` | `name` | `malware.exe` |
| Registry key | `windows-registry-key` | `key` | `HKLM\Software\...` |
| Process name | `process.name` | `name` | `svchost.exe` (anomalous) |
| Mutex | `mutex.name` | `name` | `Global\MalwareMutex` |
| X.509 certificate | `x509-certificate` | `serial_number` | Certificate serial |
| User-agent string | `network-traffic.extensions` | `value` | Anomalous UA strings |
| CIDR range | `ipv4-addr` (network) | `value` | `10.0.0.0/8` |
| AS number | `autonomous-system` | `number` | `AS12345` |
| CVE identifier | `vulnerability` | `name` | `CVE-2024-12345` |

### 6.8 CYBINT Rendering

| Visualization | Layer | Description | Analyst Interaction |
|--------------|-------|-------------|-------------------|
| ATT&CK matrix heatmap | DOM (z:3) | Tactic x technique with activity heat coloring | Click technique for detail |
| Threat actor relationship graph | R3F (z:0) | Diamond Model entity graph with attributed edges | Expand vertices, filter |
| IOC timeline | visx (z:1) | Temporal distribution of indicators by type | Brush select, export |
| Kill chain progress | visx (z:1) | Phase tracking for active campaigns | Phase click, detail |
| Alert dashboard | DOM (z:3) | Real-time alert feed with severity and ATT&CK tag | Acknowledge, escalate |
| Network topology | R3F (z:0) | Infrastructure mapping with IOC overlay | Zoom to cluster |
| IOC correlation matrix | visx (z:1) | Source x IOC co-occurrence heatmap | Filter by source |
| Campaign timeline | visx (z:1) | Multi-phase intrusion progression | Phase annotation |

---

## 7. MASINT: Measurement and Signature Intelligence

### 7.1 Definition

MASINT is intelligence derived from the detection, tracking,
identification, and characterization of phenomena associated with
target signatures — acoustic, seismic, chemical, nuclear, electromagnetic,
and other physical properties [JP-2-0].

### 7.2 Tsingou MASINT Scope

**Normative Statement TSG.2-9**: Implementations MAY support MASINT data
ingestion. MASINT support is NOT required for conformance. If implemented,
MASINT data SHOULD enter through sensor adapters (`NatsSourceAdapter`,
`WebSocketSourceAdapter`, or custom adapters via runtime registration).

### 7.3 MASINT Sub-Discipline Mapping

| Sub-Discipline | Tsingou Adapter Path | Rendering Layer | Feasibility |
|---------------|---------------------|-----------------|-------------|
| RADINT | NATS (radar returns) | R3F (3D), p5 (PPI display) | Medium |
| NUCINT | HTTP (monitoring data) | visx (time-series) | Low (niche) |
| ACINT | WebSocket (hydrophone) | p5 (spectrogram), visx | Medium |
| IRINT | HTTP (thermal feeds) | R3F (3D overlay), p5 (heatmap) | Medium |
| CBRINT | HTTP (sensor data) | visx (charts), DOM (alerts) | Low (niche) |
| ELECTRO-OPTINT | HTTP (imagery tiles) | R3F (texture overlay) | Medium |
| Seismic | WebSocket/NATS | visx (seismogram), p5 | Low (niche) |

---

## 8. GEOINT: Geospatial Intelligence

### 8.1 Definition

GEOINT is intelligence derived from the exploitation and analysis of
imagery and geospatial information to describe, assess, and visually
depict physical features and geographically referenced activities
[NGA-GEOINT].

### 8.2 Tsingou GEOINT Scope

**Normative Statement TSG.2-10**: Implementations SHOULD support geospatial
data integration for enrichment of all intelligence disciplines. At minimum,
implementations SHOULD:

a) Accept geospatial coordinates (latitude, longitude, altitude) as
   BaseSignal metadata fields
b) Render geospatial data in the R3F layer (3D map) or visx layer (2D map)
c) Support GeoJSON feature ingestion via `HttpSourceAdapter`
d) Provide geospatial join capabilities in d2ts (co-location analysis)

### 8.3 Geospatial Enrichment Pattern

All intelligence disciplines benefit from geospatial context:

| Discipline | Geospatial Enrichment | Analysis |
|-----------|----------------------|----------|
| CYBINT | IP geolocation, infrastructure mapping | Geographic clustering of C2 servers |
| OSINT | Geotagged social media, news event locations | Event location correlation |
| COMINT | Cell tower locations, TDOA geolocation | Communication origin mapping |
| ELINT | Emitter geolocation (AOA, TDOA, FDOA) | Electronic Order of Battle |
| MASINT | Sensor placement, detection zones | Coverage analysis |

### 8.4 GEOINT Rendering

| Visualization | Layer | Data Source |
|--------------|-------|-------------|
| 3D globe/map | R3F (z:0) | Tile server (Mapbox, OSM) |
| Entity markers | R3F (z:0) | Geolocated BaseSignals |
| Heat map overlay | R3F (z:0) or visx (z:1) | Signal density by area |
| Geofence visualization | R3F (z:0) | Analyst-defined regions |
| Route/trajectory | R3F (z:0) | FISINT, COMINT movement data |

Cross-reference: Geospatial mathematics in TSG.30.

---

## 9. OSINT: Open Source Intelligence

### 9.1 Definition

OSINT is intelligence produced from publicly available information
collected, exploited, and disseminated in a timely manner [JP-2-0].
OSINT is a primary discipline for Tsingou alongside CYBINT.

### 9.2 Tsingou OSINT Scope

**Normative Statement TSG.2-11**: Implementations MUST provide full OSINT
support, including:

a) RSS/Atom feed ingestion via `RssSourceAdapter`
b) REST API polling and SSE streaming via `HttpSourceAdapter`
c) WebSocket stream consumption via `WebSocketSourceAdapter`
d) File import (CSV, JSON, structured text) via `HolonetBridgeAdapter`
e) NLP entity extraction for text-based signals (via external NLP
   service → NATS → adapter, or inline extraction operator)
f) Source evaluation metadata (Admiralty reliability/accuracy codes)

### 9.3 OSINT Source Categories and Adapter Mapping

| OSINT Category | Tsingou Adapter | Signal Kind | Processing |
|---------------|-----------------|-------------|------------|
| News feeds | `RssSourceAdapter` | `rss` | NLP entity extraction, topic classification |
| Social media APIs | `HttpSourceAdapter` (poll/SSE) | `http` | Entity extraction, sentiment, geo-tagging |
| Threat intel feeds | `HttpSourceAdapter` (TAXII) | `http` | STIX parsing, IOC extraction |
| Forum/dark web | `HttpSourceAdapter` (scraper API) | `http` | Content analysis, threat detection |
| Government data | `HttpSourceAdapter` (API) | `http` | Structured data parsing |
| Technical (DNS, Shodan) | `HttpSourceAdapter` (API) | `http` | Infrastructure profiling |
| Real-time streams | `WebSocketSourceAdapter` | `websocket` | Live event processing |
| Document imports | `HolonetBridgeAdapter` (file) | `file-watch` | Batch processing, entity extraction |

### 9.4 Source Evaluation

**Normative Statement TSG.2-12**: OSINT signals SHOULD carry source
evaluation metadata using the Admiralty/NATO system:

```typescript
// TSG.2 Source Evaluation Schema
const SourceEvaluation = Schema.Struct({
  reliability: Schema.Literal('A', 'B', 'C', 'D', 'E', 'F').pipe(
    Schema.description('Source reliability per Admiralty system')
  ),
  accuracy: Schema.Literal('1', '2', '3', '4', '5', '6').pipe(
    Schema.description('Information accuracy per Admiralty system')
  ),
})
```

Default reliability ratings SHOULD be configurable per adapter instance:

| Adapter Configuration | Default Reliability | Rationale |
|----------------------|--------------------|-----------|
| Established RSS feed (Reuters, AP) | B2 | Usually reliable, probably true |
| Government API (US-CERT, CISA) | A2 | Completely reliable, probably true |
| Social media stream | D3 | Not usually reliable, possibly true |
| Unknown WebSocket source | F6 | Cannot judge reliability or accuracy |
| Established threat intel (OTX) | B2 | Usually reliable, probably true |

### 9.5 OSINT Rendering

| Visualization | Layer | Description |
|--------------|-------|-------------|
| Feed aggregation | DOM (z:3) | Scrollable news/alert feed |
| Entity mention timeline | visx (z:1) | Temporal distribution of entity mentions |
| Source network graph | R3F (z:0) | Relationships between entities from OSINT |
| Topic heat map | visx (z:1) | Topic frequency × time visualization |
| Geographic event map | R3F (z:0) | Geotagged OSINT events on map |
| Word cloud / key phrases | DOM (z:3) | NLP-extracted significant terms |

---

## 10. Legal and Classification Frameworks

### 10.1 Traffic Light Protocol (TLP) — Normative

**Normative Statement TSG.2-13**: Implementations MUST support Traffic
Light Protocol (TLP) 2.0 marking on all signals and derived products.
TLP markings MUST map to STIX 2.1 `marking-definition` objects for export.

| TLP Level | STIX marking-definition ID | Sharing Scope |
|-----------|---------------------------|---------------|
| TLP:RED | `marking-definition--5e57c739-391a-4eb3-b6be-7d15ca92d5ed` | Named recipients only |
| TLP:AMBER | `marking-definition--f88d31f6-486f-44da-b317-01333bde0b82` | Organization + need-to-know |
| TLP:AMBER+STRICT | `marking-definition--826578e1-40a3-4b26-bf4c-9ea95e106e15` | Organization only |
| TLP:GREEN | `marking-definition--34098fce-860f-48ae-8e50-ebd3cc5e41da` | Community sharing |
| TLP:CLEAR | `marking-definition--613f2e26-407d-48c7-9eca-b8e91df99dc9` | Unrestricted |

### 10.2 TLP Schema

```typescript
// TSG.2 Normative TLP Schema
const TLPMarking = Schema.Literal(
  'TLP:RED', 'TLP:AMBER', 'TLP:AMBER+STRICT', 'TLP:GREEN', 'TLP:CLEAR'
)

const TLPStixMapping = Schema.Record({
  key: TLPMarking,
  value: Schema.String.pipe(Schema.description('STIX marking-definition UUID'))
})
```

### 10.3 Classification Display

**Normative Statement TSG.2-14**: Implementations SHOULD display TLP
marking indicators in the DOM rendering layer for all signals and derived
products. TLP:RED and TLP:AMBER signals SHOULD be visually distinguished
from TLP:GREEN and TLP:CLEAR signals.

### 10.4 Data Handling

**Normative Statement TSG.2-15**: Implementations SHOULD enforce data
handling rules consistent with TLP markings:

| TLP Level | Export Allowed | Persistence | Display |
|-----------|---------------|-------------|---------|
| TLP:RED | Only to named recipients | Encrypted at rest | Red banner |
| TLP:AMBER | Organization + need-to-know | Standard | Amber banner |
| TLP:AMBER+STRICT | Organization only | Standard | Amber+S banner |
| TLP:GREEN | Community | Standard | Green banner |
| TLP:CLEAR | Unrestricted | Standard | No banner |

---

## 11. Adapter-to-Discipline Master Matrix

**Normative Statement TSG.2-16**: The following matrix defines the
normative adapter-to-discipline mappings. Cells marked "Primary"
indicate the most natural data path for that discipline.

| Adapter | CYBINT | OSINT | COMINT | ELINT | GEOINT | MASINT | FISINT |
|---------|--------|-------|--------|-------|--------|--------|--------|
| `RssSourceAdapter` | Secondary | **Primary** | — | — | — | — | — |
| `HttpSourceAdapter` (poll) | **Primary** | **Primary** | Secondary | — | **Primary** | Secondary | Secondary |
| `HttpSourceAdapter` (SSE) | **Primary** | Secondary | — | — | — | — | — |
| `WebSocketSourceAdapter` | **Primary** | Secondary | — | — | — | Secondary | Secondary |
| `NatsSourceAdapter` | **Primary** | — | **Primary** | **Primary** | — | **Primary** | **Primary** |
| `HolonetBridgeAdapter` (file) | Secondary | Secondary | Secondary | — | — | — | — |
| `HolonetBridgeAdapter` (serial) | — | — | — | Secondary | — | Secondary | — |
| Stub (MIDI) | — | — | — | — | — | — | — |
| Stub (OSC) | — | — | — | — | — | Secondary | — |

**Legend:**
- **Primary**: Most natural/direct data path for this discipline
- Secondary: Viable but not primary
- —: Not applicable or not recommended

---

## 12. Platform Positioning and Integration Boundaries

### 12.1 Own vs. Defer Decision Matrix

Per [ADR-012], Tsingou is a visualization-focused platform. The following
matrix defines what Tsingou owns versus what it defers to external
platforms:

| Capability | Own | Defer | Defer To | Rationale |
|-----------|-----|-------|----------|-----------|
| Signal visualization | YES | — | — | Core mission |
| Real-time streaming analysis | YES | — | — | d2ts differentiator |
| Source adapter management | YES | — | — | Hot-plug lifecycle |
| STIX export | YES | — | — | Interoperability requirement |
| Knowledge graph (large-scale) | — | YES | Palantir, Neo4j | Scale, maturity |
| Indicator sharing network | — | YES | MISP | Community, protocol |
| Incident response workflow | — | YES | TheHive | Case management |
| Automated enrichment | — | YES | Cortex, IntelOwl | Analyzer ecosystem |
| Full-text document search | — | YES | Elastic/OpenSearch | Search at scale |
| Signal collection | — | YES | GNU Radio, SDR tools | Collection platforms |
| Cryptanalysis | — | YES | Specialized tools | Not in scope |

### 12.2 Integration Architecture

**Normative Statement TSG.2-17**: Tsingou MUST support bidirectional
integration with downstream CTI platforms via:

a) STIX 2.1 bundle export (`toStixBundle()`) per [ADR-009]
b) STIX 2.1 bundle import (`fromStixBundle()`) per [ADR-009]
c) TAXII 2.1 transport via NATS subject mapping per [ADR-009]

**Normative Statement TSG.2-18**: Tsingou SHOULD support direct API
integration with at least the following platform categories:

a) CTI platforms (OpenCTI, MISP) — via REST API adapters
b) SIEM systems — via NATS/syslog bridge
c) SDR processing (GNU Radio) — via NATS/ZMQ bridge per [ADR-011]

---

## 13. Normative Requirements Summary

| ID | Requirement | Level | Section |
|----|------------|-------|---------|
| TSG.2-1 | Full CYBINT and OSINT support | MUST | 2.2 |
| TSG.2-2 | COMINT, ELINT, and GEOINT support | SHOULD | 2.2 |
| TSG.2-3 | MASINT and FISINT via schema extension | MAY | 2.2 |
| TSG.2-4 | COMINT metadata ingestion adapters | SHOULD | 3.2 |
| TSG.2-5 | ELINT PDW schema conformance | MUST (if ELINT) | 4.3 |
| TSG.2-6 | FISINT via custom schema registration | MAY | 5.2 |
| TSG.2-7 | Full CYBINT support (5 sub-requirements) | MUST | 6.2 |
| TSG.2-8 | ATT&CK Enterprise Matrix mapping | MUST (CYBINT) | 6.4 |
| TSG.2-9 | MASINT via sensor adapters | MAY | 7.2 |
| TSG.2-10 | Geospatial enrichment (4 sub-requirements) | SHOULD | 8.2 |
| TSG.2-11 | Full OSINT support (6 sub-requirements) | MUST | 9.2 |
| TSG.2-12 | Admiralty source evaluation metadata | SHOULD | 9.4 |
| TSG.2-13 | TLP 2.0 marking support | MUST | 10.1 |
| TSG.2-14 | TLP display indicators | SHOULD | 10.3 |
| TSG.2-15 | TLP-based data handling | SHOULD | 10.4 |
| TSG.2-16 | Adapter-to-discipline matrix | MUST | 11 |
| TSG.2-17 | STIX/TAXII bidirectional integration | MUST | 12.2 |
| TSG.2-18 | Direct API integration (CTI, SIEM, SDR) | SHOULD | 12.2 |

---

## 14. Bibliography

| Key | Reference |
|-----|-----------|
| [RFC2119] | RFC 2119 — Key words for use in RFCs to Indicate Requirement Levels |
| [RFC8174] | RFC 8174 — Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words |
| [JP-2-0] | Joint Publication 2-0, Joint Intelligence (2013, revised 2022) |
| [JP-2-01] | Joint Publication 2-01, Joint and National Intelligence Support to Military Operations |
| [JP-2-01.3] | Joint Publication 2-01.3, Signals Intelligence Support to Operations |
| [NIDC-2022] | ODNI National Intelligence Discipline Categories (2022 revision) |
| [STIX-2.1] | STIX Version 2.1, OASIS Standard (2021) |
| [ATT&CK] | MITRE ATT&CK Framework, Enterprise Matrix v14 (2024) |
| [TLP-2.0] | Traffic Light Protocol 2.0, FIRST (2022) |
| [NGA-GEOINT] | NGA Geospatial Intelligence Basic Doctrine (2018) |
| [ADR-009] | Tsingou ADR-009: STIX Interop Layer |
| [ADR-010] | Tsingou ADR-010: Full Intelligence Cycle Coverage |
| [ADR-011] | Tsingou ADR-011: SDR/GNU Radio Bridge |
| [ADR-012] | Tsingou ADR-012: Visualization-Focused Platform |
| [ADR-013] | Tsingou ADR-013: Analysis Techniques Catalog |
| [FLOW-ARCH] | Tsingou Flow Architecture Document |
| [ADMIRALTY] | NATO Source/Information Evaluation System (Admiralty System) |
| [TSG.3] | RFC Section TSG.3: Intelligence Cycle |
| [TSG.5] | RFC Section TSG.5: Competitive Analysis |
| [TSG.16] | RFC Section TSG.16: SDR Hardware Landscape |
| [TSG.17] | RFC Section TSG.17: GNU Radio Bridge |
| [TSG.19] | RFC Section TSG.19: Spectrum Visualization |
| [TSG.25] | RFC Section TSG.25: DSP Foundations |
| [TSG.30] | RFC Section TSG.30: Geospatial Mathematics |
| [TSG.36] | RFC Section TSG.36: EW/SIGINT Doctrine Alignment |

---

*TSG.2 — SIGINT/OSINT Domain Reference. 18 normative statements.*
*Cross-references: TSG.3 (Intelligence Cycle), TSG.5 (Competitive Analysis),*
*TSG.16/17/19 (SDR), TSG.25 (DSP), TSG.30 (Geospatial), TSG.36 (EW Doctrine).*
