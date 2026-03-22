# TSG.1: Introduction & Vision

```
Section:    TSG.1
Title:      Introduction & Vision
Status:     DRAFT
Created:    2026-02-19
Authors:    Val (architecture-reviewer)
Part:       I — Domain & Context (Informative)
Depends:    (none — root section)
Feeds:      All subsequent sections (TSG.2 through TSG.36, Appendices A-F)
```

> This section introduces the Tsingou Signal Intelligence Visualization Platform,
> establishes the problem domain, articulates the design vision, and provides a
> comprehensive orientation to the RFC-002 specification. It defines the platform
> identity, design philosophy, technology stack, target deployment scenarios,
> intelligence discipline coverage, and key architectural decisions. Forward
> references to all 35 subsequent sections are provided for navigation. The key
> words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD
> NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
> interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [TSG.1.1  Problem Statement](#tsg11-problem-statement)
2.  [TSG.1.2  Tsingou Vision](#tsg12-tsingou-vision)
    - [TSG.1.2.6  Signal Taxonomy and the SIGINT Processing Hierarchy](#tsg126-signal-taxonomy-and-the-sigint-processing-hierarchy)
3.  [TSG.1.3  Design Philosophy](#tsg13-design-philosophy)
4.  [TSG.1.4  Scope of This Document](#tsg14-scope-of-this-document)
5.  [TSG.1.5  Document Conventions](#tsg15-document-conventions)
6.  [TSG.1.6  Relationship to Prior Art](#tsg16-relationship-to-prior-art)
7.  [TSG.1.7  System Overview](#tsg17-system-overview)
8.  [TSG.1.8  Intelligence Disciplines Supported](#tsg18-intelligence-disciplines-supported)
9.  [TSG.1.9  Key Architectural Decisions](#tsg19-key-architectural-decisions)
10. [TSG.1.10 Technology Stack](#tsg110-technology-stack)
11. [TSG.1.11 Target Deployment Scenarios](#tsg111-target-deployment-scenarios)
12. [TSG.1.12 Terminology](#tsg112-terminology)
13. [TSG.1.13 Normative Requirements Summary](#tsg113-normative-requirements-summary)
14. [TSG.1.14 References](#tsg114-references)

---

## TSG.1.1 Problem Statement

### TSG.1.1.1 Fragmentation of Intelligence Analysis Tooling

The contemporary signals intelligence (SIGINT) and open-source intelligence (OSINT)
analyst operates within a fragmented ecosystem of disconnected platforms, each
addressing a narrow slice of the intelligence cycle. Radio frequency (RF) spectrum
analysis is performed in one application. Network traffic inspection resides in
another. Threat intelligence feeds are consumed through a third. Geospatial
correlation requires a fourth. Link analysis demands a fifth. The analyst is left
to perform the cognitive integration that the tooling ecosystem fails to provide.

This fragmentation manifests across several dimensions:

| Dimension | Manifestation | Consequence |
|-----------|--------------|-------------|
| **Temporal** | Tools operate on different time horizons — real-time RF analysis alongside batch-processed threat feeds | Correlation across time scales requires manual alignment |
| **Spatial** | Geospatial data (GEOINT) and network topology (SIGINT) are rendered in separate coordinate systems | Multi-domain spatial reasoning is performed mentally, not computationally |
| **Syntactic** | Each tool defines its own data model — PCAP, SigMF, STIX, CSV, JSON, proprietary binary formats | Data exchange requires format conversion at every boundary |
| **Semantic** | Intelligence meaning is encoded differently across platforms — an "indicator" in MISP differs from an "indicator" in OpenCTI | Ontological reconciliation is manual and error-prone |
| **Operational** | Each tool has its own deployment model, authentication scheme, and operational lifecycle | The analyst context-switches between 5-10 applications during a single analysis session |

The net effect is that the analyst's cognitive bandwidth — the scarcest resource
in any intelligence operation — is consumed by tool management rather than
analytical reasoning. Correlation insights that span multiple intelligence
disciplines are discovered late or not at all, because the tooling architecture
makes cross-discipline analysis prohibitively expensive in terms of human effort.

### TSG.1.1.2 The Multi-INT Visualization Gap

Existing visualization platforms fall into two categories, neither of which
addresses the multi-INT visualization requirement:

**Category 1: Domain-Specific Visualization Tools**

These tools excel within a single intelligence discipline but provide no
mechanism for cross-discipline correlation:

| Tool | Domain | Strength | Limitation |
|------|--------|----------|------------|
| GNU Radio Companion | SIGINT (RF) | Flow graph DSP, arbitrary modulation | No network or OSINT integration |
| Wireshark | SIGINT (COMINT) | Deep packet inspection, protocol dissection | No RF or geospatial correlation |
| Maltego | OSINT | Entity relationship graphing, transforms | No real-time signal ingestion |
| QGIS / Google Earth | GEOINT | Geospatial rendering, layer composition | No signal pipeline, no temporal analysis |
| Kibana / Grafana | Telemetry | Time-series dashboards, alerting | No intelligence-specific semantics |
| Palantir Gotham | Multi-INT | Knowledge graph, ontology management | Proprietary, no local-first operation |

**Category 2: General-Purpose Analysis Platforms**

These platforms provide extensibility but lack the signal processing pipeline
and rendering architecture required for real-time multi-INT analysis:

| Platform | Extensibility | Limitation |
|----------|--------------|------------|
| Jupyter / Observable | Arbitrary computation via notebooks | No real-time pipeline, no composited rendering |
| Splunk | Log ingestion and search | Enterprise-oriented, no RF or MIDI integration |
| Elastic SIEM | Security event correlation | No SDR integration, limited visualization |
| Apache NiFi | Dataflow orchestration | ETL-focused, no interactive visualization |

The gap is clear: no existing platform provides (a) real-time ingestion from
heterogeneous signal sources, (b) incremental computation via differential
dataflow, (c) multi-layer composited visualization, and (d) interoperability
with established intelligence data models (STIX 2.1, TAXII 2.1, SigMF) — all
within a single, locally deployable application.

### TSG.1.1.3 The Real-Time Correlation Problem

Intelligence analysis is fundamentally a correlation problem. The value of any
individual signal increases exponentially when correlated with signals from other
sources, disciplines, and time windows. Consider the following scenario:

```
Signal A: RSS feed reports unusual military vehicle movement (OSINT)
Signal B: SDR detects increased HF radio traffic in same region (SIGINT/COMINT)
Signal C: HTTP threat intel API reports new indicators for region (CYBINT)
Signal D: Serial GPS sensor shows analyst's own position relative to activity (GEOINT)
```

Each signal, in isolation, is informative but not actionable. Correlated across
time, space, and discipline, they paint an operational picture. The correlation
must happen in real time — the analyst cannot afford to wait for batch processing
when the operational tempo demands immediate situational awareness.

Current tooling requires the analyst to mentally correlate these signals, switching
between applications, manually aligning timestamps, and reasoning about spatial
proximity without computational assistance. This cognitive load is unsustainable
at scale and produces errors under the time pressure of active collection
operations.

### TSG.1.1.4 The Local-First Imperative

Intelligence analysis frequently occurs in environments where persistent cloud
connectivity cannot be assumed:

- Field collection stations with intermittent satellite uplinks
- Cyber Electromagnetic Activities (CEMA) cells operating in contested spectrum
- Disconnected analyst workstations in sensitive compartmented information
  facilities (SCIFs)
- Maritime and airborne platforms with bandwidth-constrained communications

These environments demand a local-first architecture where the full analysis
capability operates on the analyst's own hardware, with optional federation to
central repositories when connectivity permits. Cloud-dependent SaaS platforms
are categorically unsuitable for these deployment scenarios.

The platform MUST be capable of full analytical operation in a disconnected
state. Network connectivity SHOULD enhance capabilities (federation, shared
threat intelligence, distributed sensor networks) but MUST NOT be required for
core analysis functions.

### TSG.1.1.5 The Schema Validation Deficit

A persistent failure mode in intelligence analysis systems is the ingestion of
malformed or invalid data that propagates through the processing pipeline
undetected, producing erroneous analytical outputs. This failure mode is
particularly acute when:

1. Data arrives from untrusted external sources (TAXII feeds, public APIs,
   sensor networks)
2. Multiple data formats converge in a single pipeline (JSON, XML, binary,
   protocol-specific encodings)
3. Schema evolution occurs without version tracking (a field is added to
   an upstream API, silently breaking downstream consumers)

Systems that rely on runtime type checks (`typeof`, `instanceof`, assertion
functions) or no validation at all are brittle. The cost of a malformed signal
reaching the analysis layer is not merely a rendering glitch — it is a
potentially incorrect analytical conclusion derived from corrupted data.

The platform MUST validate all ingested signals against declared schemas at the
ingestion boundary. Invalid signals MUST NOT propagate to the analysis or
rendering layers.

---

## TSG.1.2 Tsingou Vision

### TSG.1.2.1 Platform Identity

Tsingou is a unified signal intelligence visualization platform. It ingests
signals from arbitrary sources — network feeds, messaging fabrics, hardware
interfaces, and local data — processes them through a differential dataflow
pipeline, and delivers derived analytical state to a composited rendering
surface spanning four technology layers.

The system is named after **Mary Tsingou (1928-2023)**, a programmer at Los
Alamos National Laboratory who programmed the MANIAC I computer for the
Fermi-Pasta-Ulam-Tsingou (FPUT) problem in 1955 [TSINGOU-NAMING]. Her work
established that nonlinear systems exhibit recurrent, quasi-periodic behavior —
a foundational insight for signal analysis. She was systematically uncredited
for decades until the problem was renamed to include her contribution in 2008.

The name carries the values of: **signals, analysis, computation, and justice.**

### TSG.1.2.2 Core Value Proposition

Tsingou delivers four capabilities that do not exist in combination in any
current platform:

| Capability | Description | Section Reference |
|-----------|-------------|-------------------|
| **Unified Multi-INT Ingestion** | 8+ source adapter types covering SIGINT, OSINT, GEOINT, CYBINT input modalities, with hot-plug runtime addition/removal | TSG.9 |
| **Incremental Differential Computation** | d2ts-based signal pipeline with joins, windowing, aggregation, and anomaly detection operating on incrementally maintained state | TSG.7, TSG.26 |
| **4-Layer Composited Rendering** | WebGL 3D (R3F) + SVG data visualization (visx) + Canvas generative (p5) + DOM controls, composited in a single viewport | TSG.20-TSG.24 |
| **Standards-Based Interoperability** | STIX 2.1 data model with bidirectional codec, TAXII 2.1 transport, SigMF metadata for RF captures, CTI platform connectors | TSG.12-TSG.15, TSG.18 |

### TSG.1.2.3 Signal as Primary Product

Implementations MUST treat the signal pipeline as the primary product [ADR-008].
The rendering surface is an output modality, not the product itself. This
distinction separates Tsingou from audiovisual sequencers, creative coding
tools, and dashboard platforms. The pipeline ingests, validates, processes,
correlates, and derives analytical state from signals. The rendering surface
makes that state visible to the analyst.

This principle has concrete architectural consequences:

1. The pipeline operates independently of any rendering layer. Removing all
   rendering layers does not affect signal ingestion, processing, or derived
   state computation.

2. Multiple rendering surfaces MAY consume the same pipeline output
   simultaneously. A desktop application and a web dashboard could subscribe
   to the same output atoms without pipeline modification.

3. Pipeline correctness is validated independently of rendering. Unit and
   integration tests exercise the pipeline without instantiating any rendering
   layer.

### TSG.1.2.4 Analyst-Centric Design

The platform is designed for the intelligence analyst as primary user. All
architectural decisions are evaluated against the criterion: "Does this reduce
the analyst's cognitive load or increase analytical throughput?"

Design decisions driven by this criterion include:

| Decision | Analyst Impact |
|----------|---------------|
| Hot-plug adapter registration (no restart required) | Analyst adds new sources during active investigation without interrupting analysis |
| Atom-as-state reactive model | UI updates instantly reflect pipeline state changes — no manual refresh |
| Cross-layer signal selection | Clicking a signal in the DOM table highlights it in R3F, visx, and p5 simultaneously |
| NATS JetStream replay | Analyst can replay historical signals through the same analysis pipeline for retrospective investigation |
| 4-layer composited rendering | Each intelligence discipline uses the rendering technology best suited to its data type |

### TSG.1.2.5 The Tsingou Principle

The namesake's discovery — that nonlinear systems exhibit recurrent, quasi-periodic
behavior rather than the expected thermodynamic equilibrium — informs the platform's
analytical philosophy. Intelligence signals are inherently nonlinear: threat actors
exhibit patterns that recur with variation, communication networks form and dissolve
cyclically, and electromagnetic spectrum usage follows quasi-periodic patterns
driven by operational rhythms.

Tsingou's differential dataflow pipeline is designed to detect and visualize these
recurrence patterns. The d2ts incremental computation model maintains state across
processing cycles, enabling the system to detect patterns that emerge only over
extended observation windows — the computational analogue of the FPUT recurrence
that Mary Tsingou first observed.

### TSG.1.2.6 Signal Taxonomy and the SIGINT Processing Hierarchy

#### TSG.1.2.6.1 The Semantic Overload of "Signal"

The word "signal" is semantically overloaded across the domains that Tsingou
spans. Failure to disambiguate leads to architectural confusion — specifically,
the expectation that a "signal intelligence visualization platform" must
necessarily process raw electromagnetic waveforms. This subsection establishes
a precise taxonomy.

The word "signal" carries at least four distinct technical meanings:

| Domain | "Signal" Means | Data Shape | Bandwidth |
|--------|---------------|------------|-----------|
| **RF Engineering** | An electromagnetic emission; a waveform defined by frequency, amplitude, phase, and modulation | IQ sample pairs (`Float32Array`), raw ADC captures, spectrograms | 10 MB/s – 1 GB/s per receiver |
| **Digital Signal Processing** | A discrete-time sequence of numerical samples subject to mathematical transformation (FFT, filtering, convolution) | `Float64Array` sample buffers, windowed frames, spectral coefficients | 1 MB/s – 100 MB/s per stream |
| **Intelligence Analysis** | A piece of actionable information derived from any collection discipline — an indicator, an observable, a reportable event | Structured metadata: entities, relationships, timestamps, confidence scores, source attribution | 1 KB – 100 KB per datum |
| **Software Engineering** | A named event carrying a payload through a reactive pipeline | Typed envelope: `{ id, source, timestamp, kind, payload }` | 100 B – 10 KB per message |

Tsingou's `BaseSignal` schema implements the **third and fourth meanings
simultaneously**. It is an intelligence datum in software envelope form. It is
explicitly NOT an RF waveform, NOT an IQ sample buffer, and NOT a DSP sample
sequence.

This is not a limitation. It is a deliberate architectural decision that
reflects how professional SIGINT systems are actually structured.

#### TSG.1.2.6.2 The Four Levels of SIGINT Processing

Real-world SIGINT operations follow a processing hierarchy that separates
concerns by data type, bandwidth, latency requirement, and analytical
function. This hierarchy is well-documented in doctrine (JP 2-01.3, FM 2-0)
and consistently reflected in the architecture of operational SIGINT systems:

```
Level 1 — COLLECTION
├── Function:    Intercept and capture raw electromagnetic emissions
├── Data:        IQ samples, raw RF captures, antenna pattern data
├── Bandwidth:   10 MB/s – 1 GB/s per receiver
├── Systems:     RTL-SDR, HackRF, USRP, dedicated SIGINT receivers,
│                antenna arrays, satellite ground stations
├── Output:      Raw captures in SigMF or proprietary binary format
└── Operator:    Collection technician, SIGINT collector (MOS 35N/S)

Level 2 — PROCESSING & EXPLOITATION (PED)
├── Function:    Demodulate, decrypt, decode, transcribe, characterize
├── Data:        Demodulated audio, decoded protocols, emitter parameters,
│                ELINT pulse descriptor words (PDWs), transcripts
├── Bandwidth:   100 KB/s – 10 MB/s per stream
├── Systems:     GNU Radio, MATLAB, custom DSP pipelines, speech-to-text,
│                protocol analyzers, ELINT Intercept Model (EIM)
├── Output:      Serialized SIGINT reports, emitter databases (EWIRDB),
│                decoded message traffic, parametric characterizations
└── Operator:    SIGINT analyst, EW officer, cryptologic linguist

Level 3 — ANALYSIS & CORRELATION
├── Function:    Correlate processed intelligence across sources, disciplines,
│                and time; identify patterns; assess significance; produce
│                analytical judgments
├── Data:        Entities, relationships, events, indicators, observables,
│                confidence assessments, temporal/spatial correlations
├── Bandwidth:   1 KB – 100 KB per analytical datum
├── Systems:     Palantir Gotham, IBM i2 Analyst Notebook, XKEYSCORE,
│                TRAFFICTHIEF, OpenCTI, MISP, Maltego
├── Output:      Intelligence products, link charts, pattern assessments,
│                target packages, threat assessments
└── Operator:    All-source analyst, intelligence analyst (MOS 35F)

Level 4 — DISSEMINATION & VISUALIZATION
├── Function:    Present analytical products to consumers; enable interactive
│                exploration; provide situational awareness displays;
│                generate formatted reports and feeds
├── Data:        Rendered visualizations, formatted reports, STIX bundles,
│                alerting feeds, dashboard state
├── Bandwidth:   Visual rendering pipeline (60 fps × viewport pixels)
├── Systems:     Analyst workstations, C2 dashboards, STIX/TAXII feeds,
│                intelligence community portals, briefing systems
├── Output:      Commander's intelligence updates, threat feeds,
│                watchlisted-entity alerts, operational graphics
└── Consumer:    Commander, decision-maker, partner analyst, allied service
```

These levels are NOT a waterfall — they operate concurrently with feedback
loops. An analyst at Level 3 may task Level 1 collectors based on analytical
findings. Level 4 dissemination may trigger new Level 2 processing against
archived collections. The hierarchy describes **data transformation stages**,
not sequential phases.

#### TSG.1.2.6.3 Where Tsingou Operates

Tsingou is a **Level 3–4 platform**. Its primary function is intelligence
analysis, correlation, and visualization — not raw signal collection or DSP
processing.

```
                    ┌─────────────────────────────────────────┐
                    │         TSINGOU PLATFORM BOUNDARY        │
                    │                                         │
Level 1             │                                         │
  Collection ───────┤  Ingestion boundary: BaseSignal envelope │
                    │      ┌───────────────────────────┐      │
Level 2             │      │                           │      │
  Processing ───────┤      │  Level 3: Analysis        │      │
                    │      │  ┌─────────────────────┐  │      │
Level 3             │      │  │ d2ts differential   │  │      │
  Analysis ─────────┤      │  │ dataflow pipeline   │  │      │
                    │      │  │                     │  │      │
                    │      │  │ Joins, windows,     │  │      │
                    │      │  │ anomaly detection,  │  │      │
                    │      │  │ link analysis       │  │      │
                    │      │  └─────────┬───────────┘  │      │
                    │      │            │              │      │
                    │      │            ▼              │      │
                    │      │  ┌─────────────────────┐  │      │
Level 4             │      │  │ Level 4: Rendering  │  │      │
  Dissemination ────┤      │  │ R3F / visx / p5 /   │  │      │
                    │      │  │ DOM composited      │  │      │
                    │      │  │ viewport            │  │      │
                    │      │  └─────────────────────┘  │      │
                    │      └───────────────────────────┘      │
                    └─────────────────────────────────────────┘
```

External systems at Level 1 and Level 2 emit **processed intelligence products**
into Tsingou's ingestion boundary. Each product arrives as a `BaseSignal`
envelope carrying structured metadata — not raw IQ samples. The source adapter
translates the external system's native format into a `BaseSignal` at the
boundary.

This positioning is consistent with the dominant architecture of professional
SIGINT analysis platforms:

| Platform | Level | Data Model | Signal Type |
|----------|-------|-----------|-------------|
| **Palantir Gotham** | 3–4 | Objects, relationships, events | Intelligence datums, not RF |
| **IBM i2 Analyst Notebook** | 3–4 | Entities, links, timelines | Intelligence datums, not RF |
| **TRAFFICTHIEF (NSA)** | 3 | Selectors, alerts, target activity | Metadata from collection systems |
| **OpenCTI** | 3–4 | STIX objects, indicators, observables | Structured CTI, not RF |
| **MISP** | 3–4 | Events, attributes, correlations | Threat indicators, not RF |
| **GNU Radio** | 1–2 | IQ samples, flowgraph blocks | Raw RF waveforms |
| **SDR#** | 1–2 | IQ samples, demodulated audio | Raw RF waveforms |
| **MATLAB Signal Processing** | 2 | Sample arrays, spectral matrices | Processed DSP data |
| **Tsingou** | **3–4** | **BaseSignal envelopes, STIX objects** | **Intelligence datums** |

Tsingou belongs in the same architectural category as Palantir Gotham and
TRAFFICTHIEF — not in the same category as GNU Radio or SDR#. This is an
intentional and defensible design choice, not an implementation gap.

#### TSG.1.2.6.4 What BaseSignal Actually Carries

When Tsingou ingests a "signal," it is receiving one of the following:

| Source | BaseSignal Kind | What's in `payload` | Level 1–2 System That Produced It |
|--------|----------------|--------------------|---------------------------------|
| RSS threat intelligence feed | `rss` | Feed entry: title, summary, indicators, source attribution | OSINT collection platform |
| STIX/TAXII CTI server | `http` | STIX 2.1 bundle: SDOs, SROs, observables | Threat intelligence platform |
| NATS sensor telemetry | `nats` | Sensor reading: temperature, position, status, timestamp | IoT/IIoT collection system |
| SDR/GNU Radio sidecar | `nats` or `websocket` | **Processed product**: detected emitter parameters, demodulated metadata, spectral features — NOT raw IQ samples | GNU Radio flowgraph (Level 2) |
| MIDI controller input | `midi` | Note/CC event: channel, type, note, velocity | Hardware MIDI device |
| Serial GPS receiver | `serial` | NMEA sentence: position fix, satellite count, HDOP | GPS receiver hardware |
| WebSocket live feed | `websocket` | Structured event: entity update, alert, status change | External analysis system |
| File system watcher | `file-watch` | File event: path, operation, content hash | Local filesystem |

The critical row is the SDR/GNU Radio entry. When Tsingou integrates with an
SDR system (as specified in TSG.16–TSG.19), it does NOT ingest raw IQ sample
buffers. The GNU Radio sidecar process (Level 2) performs demodulation, feature
extraction, and emitter characterization. The sidecar then publishes **processed
products** — structured metadata about what was detected — as `BaseSignal`
envelopes via NATS. Tsingou's d2ts pipeline correlates these detection events
with other intelligence sources.

This is the same architecture used by operational SIGINT systems: the collection
and processing infrastructure feeds structured intelligence into the analysis
platform. The analysis platform never touches raw waveforms.

#### TSG.1.2.6.5 The Bandwidth Argument

The data bandwidth difference between SIGINT levels makes the architectural
separation non-negotiable:

```
Level 1 (Collection):     500 MB/s    RTL-SDR at 2.4 Msps × 2 × float32
                          ───────────────────────────────────────── █████████████████████

Level 2 (Processing):       5 MB/s    Demodulated audio + metadata
                          ─────────── ██

Level 3 (Analysis):        50 KB/s    Entity/relationship events
                          ─ (invisible at this scale)

Level 4 (Visualization):   Rendering pipeline (GPU-bound, not data-bound)
```

A single RTL-SDR receiver at 2.4 Msps generates ~500 MB/s of raw IQ data. The
d2ts differential dataflow pipeline, which operates on JSON-serialized
`MultiSet<BaseSignal>` collections with version tracking and frontier
management, is architecturally unsuited to this data rate. Attempting to push
raw IQ samples through the d2ts graph would:

1. Serialize `Float32Array` sample buffers to JSON (catastrophic overhead)
2. Version-track individual samples (meaningless — samples have no independent
   identity)
3. Exhaust the NATS JetStream persistence layer (designed for KB-scale messages,
   not MB-scale sample buffers)
4. Collapse the d2ts frontier tracking (the version space would grow faster
   than the garbage collector can reclaim)

The correct architecture — and the one specified in TSG.17 (GNU Radio Bridge)
— is to run DSP processing in a sidecar process (Rust, C++, or Python with
GNU Radio) that maintains its own sample-rate-appropriate data pipeline, and
have the sidecar emit **detection events** into Tsingou's BaseSignal pipeline
at Level 3 rates (KB/s, not MB/s).

#### TSG.1.2.6.6 Future Level 1–2 Integration

The SDR integration sections (TSG.16–TSG.19) specify how Tsingou interfaces
with Level 1–2 systems. This integration follows the sidecar pattern:

```
┌──────────────────────────┐       ┌─────────────────────────────┐
│   SIDECAR (Level 1–2)    │       │   TSINGOU (Level 3–4)       │
│                          │       │                             │
│  RTL-SDR ──► GNU Radio   │       │                             │
│              flowgraph    │       │   BaseSignal pipeline       │
│              ┌────────┐  │  NATS │   ┌────────────────────┐    │
│              │ Demod   │──┼──────┼──►│ Source adapter      │    │
│              │ Detect  │  │      │   │ (nats kind)         │    │
│              │ Feature │  │      │   └────────┬───────────┘    │
│              │ Extract │  │      │            │               │
│              └────────┘  │       │            ▼               │
│                          │       │   d2ts ──► Atoms ──► Render │
│  SigMF recording  ◄─────┤       │                             │
│  (raw capture archive)   │       │                             │
└──────────────────────────┘       └─────────────────────────────┘
```

The sidecar publishes structured detection events:

```typescript
// What the GNU Radio sidecar publishes (Level 2 output → Level 3 input)
{
  id: "sig_sdr_0042" as SignalId,
  sourceId: "gnu-radio-sidecar-1" as SourceId,
  timestamp: new Date("2026-02-19T14:32:11.847Z"),
  version: [1042, 7],
  kind: "sdr",                    // Registered at runtime via schema registry
  payload: {
    detectionType: "emitter",
    centerFrequencyHz: 462_562_500, // FRS Channel 1
    bandwidthHz: 12_500,
    modulationType: "FM",
    signalStrengthDbm: -67.3,
    durationMs: 3_420,
    bearingDeg: 127.4,            // If DF antenna available
    confidence: 0.89,
    sigmfRecordingRef: "capture_20260219_143211.sigmf-meta",  // Reference to Level 1 archive
    demodulatedContent: "voice-detected",  // Or decoded digital payload
    emitterClassification: "handheld-radio",
    spectralFeatures: {
      peakFrequencyHz: 462_562_100,
      bandwidthAt3dB: 11_200,
      spurCount: 2,
    },
  },
  metadata: {
    receiverModel: "RTL-SDR V4",
    antennaType: "discone-omnidirectional",
    sampleRate: 2_400_000,
    gnuRadioFlowgraph: "frs_detector_v3.grc",
  },
}
```

This detection event is a Level 3 intelligence datum. It carries **what was
detected** (an FM emitter on FRS Channel 1, bearing 127.4 degrees, 89%
confidence), not **the raw waveform** that was detected. The raw waveform is
archived separately in SigMF format on the sidecar's local storage, referenced
by `sigmfRecordingRef` for forensic replay if the analyst needs to examine the
raw capture.

This architecture enables the d2ts pipeline to correlate SDR detections with
other intelligence sources — an emitter detection at bearing 127.4 degrees
correlated with an OSINT report of vehicle movement in the same azimuth,
cross-referenced with a STIX indicator for a known threat actor's radio
equipment. That correlation is Tsingou's value proposition. The DSP that
extracted the emitter parameters is the sidecar's job.

#### TSG.1.2.6.7 Normative Requirements

| ID | Requirement | Level |
|----|-------------|-------|
| SIG-T1 | Implementations MUST treat `BaseSignal` as a Level 3 intelligence datum, not a Level 1 RF sample container | MUST |
| SIG-T2 | Raw IQ sample data MUST NOT be transmitted through the d2ts differential dataflow pipeline | MUST NOT |
| SIG-T3 | Level 1–2 systems (SDR receivers, DSP pipelines) SHOULD interface with Tsingou via the sidecar pattern, publishing processed detection events as `BaseSignal` envelopes over NATS | SHOULD |
| SIG-T4 | SDR detection events SHOULD include a `sigmfRecordingRef` field referencing the raw capture archive for forensic replay | SHOULD |
| SIG-T5 | The schema registry (TSG.8.8) MUST support runtime registration of an `sdr` signal kind with a structured detection payload schema | MUST |
| SIG-T6 | Implementations MUST NOT conflate "signal" in the BaseSignal sense (intelligence datum) with "signal" in the RF sense (electromagnetic waveform) in user-facing documentation, API naming, or error messages | MUST NOT |
| SIG-T7 | Spectrum visualization (TSG.19) SHOULD render detection event metadata (frequency, bandwidth, bearing, confidence) received as BaseSignal payloads, NOT raw spectral data computed from IQ samples within the Tsingou process | SHOULD |

---

## TSG.1.3 Design Philosophy

### TSG.1.3.1 Effect-Native TypeScript

Tsingou is built entirely on Effect-TS [EFFECT]. Every service, adapter, pipeline
stage, state primitive, error type, and schema definition uses the Effect algebra
for composition, error handling, resource management, and lifecycle control. This
is a non-negotiable architectural constraint [ADR-005], [ADR-006].

The rationale for Effect-native architecture:

| Concern | Traditional TypeScript | Effect-TS | Benefit |
|---------|----------------------|-----------|---------|
| Error handling | `try/catch` with `unknown` error type | `Effect<A, E, R>` with typed `E` channel | Every error is typed, every recovery is explicit |
| Dependency injection | Constructor injection or global singletons | `Effect.Service<A>()` + Layer composition | Compile-time verified, test-friendly, tree-shakeable |
| Resource management | Manual `finally` blocks, forgotten cleanup | `Effect.addFinalizer`, `Scope` | Deterministic cleanup regardless of exit path |
| Concurrency | Raw `Promise.all`, unstructured `async/await` | `Fiber`, structured concurrency, `Effect.fork` | Interruption propagates, no orphan promises |
| State management | `useState`, `useEffect`, prop drilling | `Atom.make()` (effect-atom), `useAtomValue()` | Reactive, scoped, no setter soup |
| Schema validation | Zod/Yup at boundaries, raw types internally | `Schema` everywhere, branded types | Runtime + compile-time safety, single source of truth |
| Streaming | `AsyncIterable`, manual backpressure | `Stream` with built-in backpressure | Composable, resource-safe, interruptible |
| Observability | `console.log`, scattered instrumentation | `Effect.withSpan`, built-in tracing | Structured telemetry across all pipeline stages |

Raw TypeScript `interface` types for domain models, `Promise` for asynchronous
operations, `try/catch` for error handling, and `EventEmitter` for pub/sub are
all prohibited within Tsingou's core packages. These primitives MAY appear at
system boundaries (e.g., third-party library interop) but MUST be wrapped in
Effect types before crossing the boundary into Tsingou code.

The full specification of the Effect-TS implementation architecture is provided
in TSG.32.

### TSG.1.3.2 Differential Dataflow

The signal pipeline uses d2ts (`@electric-sql/d2ts`) for incremental
computation [ADR-001]. Differential dataflow is a computational model in which
collections are maintained incrementally: rather than recomputing results from
scratch when inputs change, the system propagates only the changes (deltas)
through the computation graph.

The key concepts of differential dataflow as applied in Tsingou:

| Concept | Definition | Tsingou Application |
|---------|-----------|---------------------|
| **MultiSet** | A collection where each element has an integer multiplicity (+1 for addition, -1 for retraction) | Signals enter with multiplicity +1; invalid or retracted signals get -1 |
| **Version** | A multi-dimensional timestamp that partially orders events | `[tick, source_seq]` tuple enabling concurrent source advancement |
| **Frontier** | An antichain of versions below which no further data will arrive | Enables garbage collection of operator state |
| **Operator** | A stateful transformation on versioned multisets | `map`, `filter`, `join`, `reduce`, `window`, `throttle` |
| **Graph** | A DAG of operators with input/output collections | Ingest graph (validation, normalization) feeds derived graph (analysis) |

Differential dataflow provides three capabilities that are unavailable in
traditional imperative pipelines:

1. **Incremental maintenance** — When a new signal arrives, only the affected
   portions of the derived state are recomputed. A join over 100,000 signals
   does not rescan all 100,000 when one new signal arrives.

2. **Retraction** — Signals can be explicitly retracted (multiplicity -1),
   causing all derived state that depends on the retracted signal to be
   updated. This enables correction of false positives without pipeline restart.

3. **Temporal reasoning** — The multi-dimensional version model enables
   operations that reason about time windows, causal ordering, and concurrent
   sources without global synchronization.

The full specification of the differential dataflow model is provided in TSG.26.
The signal pipeline architecture is specified in TSG.7.

### TSG.1.3.3 Atom-as-State Reactive Model

State management in Tsingou follows the atom-as-state pattern [ADR-005]. Atoms
are the primary state primitive. Effect services mutate atoms via `ctx.set()`.
React components subscribe to atoms via `useAtomValue()`. There is no
intermediate state management layer.

```
┌─────────────────────┐     ctx.set()     ┌──────────────┐
│   Effect Services    │ ───────────────── │    Atoms      │
│                      │                   │              │
│  TsingouFlow         │                   │  active-     │
│  AdapterManager      │                   │  SignalsAtom  │
│  OutputBridge        │                   │              │
│  SchemaRegistry      │                   │  healthAtom  │
└─────────────────────┘                   │              │
                                          │  tickAtom    │
                                          └──────┬───────┘
                                                 │
                                     useAtomValue()
                                                 │
                                          ┌──────▼───────┐
                                          │    React      │
                                          │  Components   │
                                          │              │
                                          │  R3F layer   │
                                          │  visx layer  │
                                          │  p5 layer    │
                                          │  DOM layer   │
                                          └──────────────┘
```

The atom-as-state pattern eliminates three classes of bugs that are endemic to
`useState`-based architectures:

| Bug Class | `useState` Cause | Atom Resolution |
|-----------|-----------------|-----------------|
| Stale closures | Callbacks capture stale setter references | Atoms are mutable references; `ctx.set()` always writes to current |
| Prop drilling | State must be threaded through component trees | Atoms are module-level; any component subscribes directly |
| Setter soup | Multiple `setX` calls in event handlers | `ctx.set()` batches writes within Effect transactions |

The atom-as-state pattern is fully specified in TSG.10.

### TSG.1.3.4 Four-Layer Composited Rendering

Tsingou renders analysis output across four composited layers, each using a
rendering technology optimized for its intelligence data type [ADR-012],
[ADR-013]:

```
┌───────────────────────────────────────────────────────────────┐
│                    TSINGOU VIEWPORT                             │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  z:3  DOM (React + framer-motion)                        │  │
│  │  Controls, alerts, tables, status panels, annotation     │  │
│  │  pointer-events: auto                                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  z:2  p5.js (Canvas 2D via @p5-wrapper/react)            │  │
│  │  Spectrum waterfall, noise fields, constellation diag.   │  │
│  │  pointer-events: none                                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  z:1  visx (SVG, D3-based composable)                    │  │
│  │  Timelines, heatmaps, distributions, ATT&CK matrix      │  │
│  │  pointer-events: none                                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  z:0  R3F (WebGL 3D via React Three Fiber)               │  │
│  │  Network graphs, geospatial, signal topology, links      │  │
│  │  pointer-events: auto (3D interaction)                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

Each layer operates independently. No layer imports from another layer. All
layers subscribe to the same output atoms via `useAtomValue()`. This
independence guarantees that a failure in one layer (e.g., WebGL context loss)
does not propagate to other layers. The rendering surface architecture is fully
specified in TSG.20.

### TSG.1.3.5 NATS Messaging Backbone

NATS serves as the universal messaging fabric for Tsingou, fulfilling five
distinct roles [ADR-003]:

| Role | Description | Example |
|------|-------------|---------|
| **Direct Source** | Tsingou subscribes to NATS subjects as a signal source | External sensor publishes to `tsingou.signal.temperature.sensor-1` |
| **Message Bus** | Internal communication between Tsingou components | Adapter lifecycle events, schema change notifications |
| **Bridge** | Sidecar processes publish hardware/network data to NATS | Serial sidecar publishes to `tsingou.signal.serial.COM3` |
| **Fan-out** | Multiple consumers subscribe to the same signal subjects | Multiple rendering layers consume the same signal feed |
| **JetStream Replay** | Historical signal playback for retrospective analysis | Replay last 24h of signals through the same d2ts graph |

The NATS fabric is abstracted behind the Holonet service stack — a set of
Effect.Service wrappers that provide typed pub/sub, JetStream access, and KV
store operations. The distinction is intentional: "NATS" refers to the
underlying technology, "Holonet" refers to Tsingou's typed service layer.

The NATS messaging fabric is fully specified in TSG.11. The Holonet service
stack is specified as part of the Effect-TS implementation architecture in
TSG.32.

### TSG.1.3.6 Schema-First Domain Modeling

All domain types in Tsingou MUST be defined as Effect Schema constructs
[EFFECT-SCHEMA]. This discipline enables:

1. **Runtime validation** — Signals from external sources are validated at the
   ingestion boundary. `Schema.decodeUnknown(BaseSignal)(data)` returns
   `Effect<BaseSignal, ParseError>`.

2. **Encode/decode transformations** — Bidirectional codecs for STIX 2.1
   interoperability, NATS JetStream persistence, and WebSocket transport.

3. **JSON Schema generation** — `JSONSchema.make(BaseSignal)` produces
   compliant JSON Schema for API documentation, external validation tools,
   and schema registry storage.

4. **Branded identifiers** — `Schema.brand()` creates types like `SignalId`,
   `SourceId`, and `SessionId` that are compile-time distinct despite being
   runtime strings. A `SignalId` cannot be passed where a `SourceId` is
   expected.

5. **Composition** — `Schema.extend()`, `Schema.Union()`, and
   `Schema.Struct()` compose algebraically, enabling extension schemas that
   inherit all base signal fields while narrowing the `kind` discriminator
   and `payload` type.

Raw TypeScript `interface` and `type` declarations MUST NOT be used for domain
types that enter the signal pipeline. The BaseSignal schema is fully specified
in TSG.8.

---

## TSG.1.4 Scope of This Document

### TSG.1.4.1 What RFC-002 Covers

This specification — TMNL-RFC-002: Tsingou Signal Intelligence Visualization
Platform — is the complete architectural and design specification for the
Tsingou platform. It comprises 36 sections organized across 8 parts, plus
6 appendices:

| Part | Sections | Character | Content Summary |
|------|----------|-----------|-----------------|
| **I: Domain & Context** | TSG.1-TSG.5 | Informative | Problem domain, intelligence cycle, data fusion mathematics, competitive analysis |
| **II: Architecture** | TSG.6-TSG.11 | Normative | System architecture, signal pipeline, BaseSignal schema, source adapters, state management, NATS fabric |
| **III: Interoperability** | TSG.12-TSG.15 | Normative | STIX 2.1 data model, BaseSignal-STIX codec, TAXII 2.1 transport, CTI platform interop |
| **IV: SDR & RF Integration** | TSG.16-TSG.19 | Normative | SDR hardware landscape, GNU Radio bridge, SigMF codec, spectrum visualization |
| **V: Rendering & Visualization** | TSG.20-TSG.24 | Normative | 4-layer rendering surface, R3F layer, visx layer, p5 layer, DOM layer |
| **VI: Analysis & Mathematics** | TSG.25-TSG.31 | Normative | DSP foundations, differential dataflow theory, statistical analysis, graph theory, information theory, geospatial math, analysis catalog |
| **VII: Implementation** | TSG.32-TSG.36 | Mixed | Effect-TS architecture, Palantir integration, deployment topology, error handling, EW doctrine alignment |
| **VIII: Appendices** | A-F | Informative | ADR index, bibliography, signal kind catalog, STIX mappings, research index, glossary |

The total specification comprises approximately 44,000+ lines of normative and
informative content across 36 sections, with an additional 18,000+ lines of
supporting research material in 21 research files.

### TSG.1.4.2 Section Summary

| Section | Title | Lines | Key Deliverable |
|---------|-------|-------|-----------------|
| TSG.1 | Introduction & Vision | (this section) | Problem statement, design philosophy, system overview |
| TSG.2 | SIGINT/OSINT Domain Reference | 1,129 | Intelligence discipline taxonomy, collection methods |
| TSG.3 | Intelligence Cycle | 732 | 6-phase cycle mapping to Tsingou subsystems |
| TSG.4 | Data Fusion Mathematics | 1,607 | JDL model, Dempster-Shafer, Kalman filtering |
| TSG.5 | Competitive Analysis | 648 | Platform comparison matrix, capability gaps |
| TSG.6 | Architecture Overview | 808 | System topology, layer composition, service dependencies |
| TSG.7 | Signal Pipeline & d2ts | 812 | Pipeline architecture, operators, backpressure |
| TSG.8 | BaseSignal Schema | 1,682 | Universal signal contract, branded IDs, extensions |
| TSG.9 | Source Adapter Contract | 1,952 | Adapter interface, 8 implementations, deployment patterns |
| TSG.10 | State Management | 834 | Atom-as-state doctrine, service-to-view bridge |
| TSG.11 | NATS Messaging Fabric | (pending) | Holonet service stack, subject topology, JetStream |
| TSG.12 | STIX 2.1 Data Model | 842 | SDO/SRO/SCO taxonomy, Tsingou-relevant objects |
| TSG.13 | BaseSignal-STIX Codec | 1,003 | Bidirectional encode/decode, field mapping |
| TSG.14 | TAXII 2.1 Transport | 773 | Collection mapping, poll/subscribe patterns |
| TSG.15 | CTI Platform Interop | 954 | MISP, OpenCTI, TheHive, Cortex connectors |
| TSG.16 | SDR Hardware Landscape | 940 | Device taxonomy, capability matrix, integration paths |
| TSG.17 | GNU Radio Bridge | 753 | ZMQ bridge, flowgraph integration, sidecar architecture |
| TSG.18 | SigMF Codec | 1,334 | Signal Metadata Format encode/decode |
| TSG.19 | Spectrum Visualization | 1,454 | Waterfall, spectrogram, constellation rendering |
| TSG.20 | 4-Layer Rendering Surface | 813 | Compositing architecture, layer independence |
| TSG.21 | R3F 3D Scene Layer | (pending) | WebGL scene graph, network visualization |
| TSG.22 | visx Data Visualization | (pending) | SVG chart composition, timeline rendering |
| TSG.23 | p5 Generative Layer | 1,636 | Canvas generative rendering, spectrum waterfall |
| TSG.24 | DOM Control Layer | 1,517 | React component architecture, framer-motion animation |
| TSG.25 | DSP Foundations | 1,701 | FFT, windowing, demodulation, Nyquist, filter design |
| TSG.26 | Differential Dataflow Theory | 1,505 | Lattice theory, partial ordering, MVCC, frontiers |
| TSG.27 | Statistical Analysis | 1,624 | Z-scores, EWMA, Grubbs, Bayesian change-point |
| TSG.28 | Graph Theory & Link Analysis | 1,904 | Centrality metrics, community detection, k-cores |
| TSG.29 | Information Theory | 1,618 | Shannon entropy, mutual information, channel capacity |
| TSG.30 | Geospatial Mathematics | 1,645 | Haversine, Vincenty, H3 indexing, R-tree |
| TSG.31 | Analysis Techniques Catalog | 1,872 | 43 techniques across 8 domains, cross-reference matrix |
| TSG.32 | Effect-TS Architecture | 1,926 | Service model, schema discipline, concurrency, RPC |
| TSG.33 | Palantir Knowledge Graph | 1,645 | Ontology mapping, entity resolution, graph federation |
| TSG.34 | Deployment Topology | 2,178 | Tauri v2, sidecars, NATS leaf nodes, edge deployment |
| TSG.35 | Error Handling | 2,113 | Tagged error taxonomy, recovery patterns, propagation |
| TSG.36 | EW/SIGINT Doctrine Alignment | 1,826 | ATP 3-12.3, JP 3-13.1, CEMA integration |

### TSG.1.4.3 What RFC-002 Does NOT Cover

This specification explicitly excludes the following topics, which are deferred
to future work or separate specifications:

| Excluded Topic | Rationale | Future Vehicle |
|---------------|-----------|---------------|
| **User interface design** | UI is implementation-dependent; the RFC specifies the rendering architecture, not specific layouts or interaction patterns | Implementation-level design documents |
| **Authentication and authorization** | Security architecture is deployment-dependent and requires a dedicated threat model | TMNL-RFC-003 (proposed) |
| **Classification markings and handling** | Classified information handling is governed by organizational policy, not platform specification | Deployment-specific configuration guides |
| **Specific threat intelligence content** | The RFC specifies the ingestion and processing architecture, not the intelligence itself | Operational procedures |
| **Performance benchmarks** | Performance is hardware-dependent; the RFC specifies the architectural constraints that enable performance | Test and evaluation reports |
| **NATS cluster administration** | NATS operational procedures are governed by NATS documentation | NATS administration guides [NATS] |
| **Tauri plugin development** | Tauri plugin APIs are governed by Tauri documentation | Tauri plugin developer guides [TAURI] |
| **GNU Radio flowgraph design** | Specific DSP flowgraphs are operational configuration, not platform architecture | SDR operational procedures |
| **Tauri SQLite local state** | Local persistence via SQLite is deferred pending d2ts stabilization | TMNL-RFC-002 amendment or Epic 21 |
| **EMQX MQTT bridge** | MQTT integration is banked for future activation | Epic 26/28 when activated |

### TSG.1.4.4 Relationship to RFC-001

TMNL-RFC-001 specified the IIoT (Industrial Internet of Things) event sourcing
architecture for the TMNL platform. RFC-002 replicates RFC-001's sectional
authoring strategy — each section is authored as an independent document and
assembled into the final RFC — but addresses a fundamentally different domain.

| Aspect | RFC-001 (IIoT) | RFC-002 (Tsingou) |
|--------|---------------|------------------|
| Domain | Industrial IoT event sourcing | Signal intelligence visualization |
| Data model | EventLog with CQRS | BaseSignal with differential dataflow |
| Transport | NATS RPC + Entity system | NATS Holonet + d2ts pipeline |
| Rendering | AG-Grid data surfaces | 4-layer composited rendering |
| State | Event sourcing with projections | Atom-as-state with pipeline output |
| Interop | OPC UA, Sparkplug B | STIX 2.1, TAXII 2.1, SigMF |

The two RFCs share the Effect-TS runtime, NATS messaging fabric, and atom-as-state
pattern. They diverge in domain model, processing architecture, rendering
strategy, and interoperability targets.

---

## TSG.1.5 Document Conventions

### TSG.1.5.1 Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this specification are to
be interpreted as described in [RFC2119] and [RFC8174].

When these words appear in uppercase, they carry their normative meaning. When
they appear in lowercase, they carry their natural English meaning.

| Keyword | Meaning | Usage |
|---------|---------|-------|
| MUST, REQUIRED, SHALL | Absolute requirement | Implementation is non-conformant without this |
| MUST NOT, SHALL NOT | Absolute prohibition | Implementation is non-conformant with this |
| SHOULD, RECOMMENDED | Strong recommendation with justified exceptions | Default behavior; deviation requires documented rationale |
| SHOULD NOT, NOT RECOMMENDED | Strong discouragement with justified exceptions | Avoidance is expected; usage requires documented rationale |
| MAY, OPTIONAL | Truly optional | Implementation may include or omit without affecting conformance |

### TSG.1.5.2 Section Numbering

All sections use the `TSG.N` prefix, where N is the section number. Subsections
use dotted notation: `TSG.N.M` for major subsections, `TSG.N.M.P` for minor
subsections. This document uses `TSG.1.x` numbering.

```
TSG.1          Section-level identifier
TSG.1.3        Major subsection
TSG.1.3.2      Minor subsection
```

Appendices use letter identifiers: Appendix A, Appendix B, etc.

### TSG.1.5.3 Citation Format

References to other documents, standards, and specifications use the `[KEY]`
citation format. Citations are resolved in the References section at the end
of each section (e.g., TSG.1.14) and in the consolidated bibliography
(Appendix B).

| Citation Pattern | Example | Resolution |
|-----------------|---------|------------|
| Standard | `[RFC2119]` | IETF RFC document |
| Technology | `[EFFECT]` | Effect-TS documentation |
| ADR | `[ADR-001]` | Architecture Decision Record in `docs/tsingou/adr/` |
| Section | `TSG.8` | Cross-reference to another RFC section |
| Index note | `[INDEX-6.1]` | Consistency note in ADR INDEX.md |
| Memory | `[MEMORY-NATS-KV]` | Persistent memory entry (Val operational context) |

### TSG.1.5.4 Code Examples

All code examples in this specification are written in Effect-TS using Effect
Schema types. Code examples use the following conventions:

- Import statements reference the actual package paths used in the Tsingou
  codebase
- Schema definitions use `Schema.Struct`, `Schema.Literal`, `Schema.brand`,
  and `Schema.extend` per the schema discipline (TSG.1.3.6)
- Service definitions use `Effect.Service<A>()` with Layer composition
- Error types use `Data.TaggedError` with `_tag` discriminators
- Comments indicate verified source locations where applicable (e.g.,
  "verified from `file.ts:42-55`")

Code examples are illustrative. The normative definition is the prose
specification. Where a code example conflicts with the prose, the prose
governs.

### TSG.1.5.5 Diagrams

Architectural diagrams in this specification use ASCII art within fenced code
blocks. This ensures rendering fidelity across all Markdown viewers and
avoids dependency on external diagram rendering services.

Box-drawing characters used:

```
┌──┐  ┌──┐
│  │──│  │   Horizontal connection (data flow)
└──┘  └──┘

┌──┐
│  │
└──┘
 │
 ▼            Vertical connection (data flow, downward)
┌──┐
│  │
└──┘

├──           Branch point
└──           Terminal branch

┊             Layer boundary (dashed vertical)
═             Major section separator
─             Minor connection
```

### TSG.1.5.6 Tables

Tables are used for all comparison, mapping, enumeration, and specification
content. Every table includes a header row. Columns are aligned for readability.
Tables with more than 5 rows include a summary count where applicable.

### TSG.1.5.7 Requirement Identifiers

Normative requirements are assigned identifiers in the format `TSG.N-Rn` for
MUST requirements, `TSG.N-Sn` for SHOULD requirements, and `TSG.N-Mn` for
MAY requirements, where N is the section number and n is a sequential counter
within that section.

Example: `TSG.1-R1` is the first MUST requirement in section TSG.1.

Each section concludes with a normative requirements summary table that
consolidates all requirements defined within that section.

---

## TSG.1.6 Relationship to Prior Art

### TSG.1.6.1 nw_wrld as Architectural Reference

Tsingou is NOT a fork of nw_wrld [ADR-008]. nw_wrld (`submodules/nw_wrld/`,
GPL-3.0, v0.5.0-beta) is an Electron-based event-driven visual sequencer — 177
source files, approximately 32,700 lines of code, 21 starter modules [NWWRLD].
It is included as a git submodule for architectural reference only.

The relationship is study, not derivation. No nw_wrld code is copied into the
Tsingou codebase. The implementation is entirely new, built on Effect-TS.
Tsingou studies nw_wrld's patterns, learns from its design decisions, and
deliberately diverges in every major architectural dimension where the
SIGINT/OSINT mission demands different architecture.

### TSG.1.6.2 What Tsingou Learns from nw_wrld

nw_wrld demonstrates five architectural insights that Tsingou preserves in
evolved form:

| Insight | nw_wrld Implementation | Tsingou Evolution |
|---------|----------------------|-------------------|
| **Signal normalization** | 7-stage imperative pipeline (Origin -> Normalize -> IPC -> Listener -> Dispatch -> Execute -> Sandbox) | d2ts ingest graph with `schemaValidate` operator at ingestion boundary |
| **Module isolation** | iframe sandbox per module, `postMessage` IPC | Effect.Service scoping with Layer composition — same isolation, lower overhead, type safety |
| **Workspace concept** | Project directory structure (`workspace/projects/<name>/`) | Adapted for Tauri filesystem scoping and NATS session persistence |
| **Real-time rendering** | Live signal-to-visual pipeline at 60fps via single Three.js canvas | Extended to 4 rendering layers, each optimized for its data type |
| **Channel dispatch** | `channelDispatch` routing signals to modules by channel and method | d2ts graph-based routing with incremental computation semantics |

### TSG.1.6.3 Architectural Divergence Summary

Tsingou diverges from nw_wrld in every major architectural dimension. The
complete divergence analysis is provided in TSG.6 (Architecture Overview).
A summary of the 14 most significant divergence points:

| Dimension | nw_wrld | Tsingou | Rationale |
|-----------|---------|---------|-----------|
| Runtime | Electron (Node.js + Chromium) | Tauri v2 (Rust + WebView) | 10x smaller binary, 6x lower memory |
| Language paradigm | OOP (classes, `this`, prototype) | FP (Effect-TS, algebraic composition) | Typed effects, testable services |
| Process model | 3 processes (main/renderer/sandbox) | 1 process + sidecar daemons | Simpler IPC, NATS replaces ipcRenderer |
| Signal pipeline | 7-stage imperative broadcast | d2ts differential dataflow graph | Incremental computation, joins, windowing |
| State management | Jotai atoms + closures + UserData | effect-atom `Atom.make()` + `Effect.Ref` | Reactive, scoped, no god-objects |
| IPC / messaging | `ipcMain` / `ipcRenderer` | NATS (transport-agnostic, distributed) | Works across processes, machines |
| Error handling | `try/catch` + `console.error` | `Data.TaggedError` + `catchTag` | Every error typed, every recovery explicit |
| Rendering | Single Canvas (imperative Three.js) | 4-layer composited (R3F + visx + p5 + DOM) | Domain-specific rendering per data type |
| Module system | iframe sandbox with `require()` | Effect.Service with Layer composition | Type-safe DI, no iframe overhead |
| Persistence | `fs.writeFile` + `.backup` | NATS KV + JetStream | Transactional, distributed |
| Schema validation | None (raw JSON, `typeof` checks) | Effect.Schema (branded, runtime validated) | Invalid signals caught at ingest |
| Animation | Custom `animatable()` + GSAP | framer-motion (declarative, React-native) | Simpler API, React integration |
| Hot reload | Module-level `require()` | Effect.Service hot-swap via AdapterManager | Type-safe, no eval, no sandbox risks |
| Dashboard | 300-line root + 60 hooks + 15 modals | Composited DOM layer with framer-motion | Decomposed, animated, accessible |

### TSG.1.6.4 IIoT RFC-001 as Process Model

TMNL-RFC-001 (IIoT Event Sourcing) established the multi-agent sectional
authoring strategy that RFC-002 replicates. Key process elements inherited:

| Process Element | Description |
|----------------|-------------|
| Sectional authoring | Each section is an independent Markdown document assembled into the final RFC |
| Research-first writing | Research files are produced before section authoring begins |
| Agent specialization | Domain-expert agents author sections in their specialty |
| Cross-reference QA | Dedicated pass for inter-section consistency |
| Normative requirements tables | Every section concludes with consolidated requirement tables |
| ADR integration | Architecture decisions are referenced by `[ADR-N]` throughout |

### TSG.1.6.5 Divergence from Legacy SIGINT Architectures

Traditional SIGINT processing architectures (as documented in military doctrine
[ATP-3-12.3], [JP-3-13.1]) follow a pipeline model:

```
Collection ──▶ Processing ──▶ Exploitation ──▶ Dissemination
```

Tsingou diverges from this linear model in three ways:

1. **Feedback loops** — The intelligence cycle (TSG.3) includes a feedback
   phase where analytical results influence collection priorities. Tsingou
   models this as a d2ts graph cycle where derived state feeds back into
   collection configuration.

2. **Concurrent multi-INT** — Traditional architectures process each INT
   discipline in a separate pipeline. Tsingou processes all disciplines
   in a single d2ts graph, enabling cross-discipline joins and correlations
   that would require manual analyst effort in a siloed architecture.

3. **Incremental rather than batch** — Traditional SIGINT processing is
   batch-oriented (process a recording, produce a report). Tsingou operates
   incrementally: every new signal immediately updates all derived state,
   enabling real-time situational awareness rather than periodic reporting.

The alignment of Tsingou's architecture with current EW/SIGINT doctrine is
fully analyzed in TSG.36.

---

## TSG.1.7 System Overview

### TSG.1.7.1 High-Level Architecture

The following diagram illustrates the complete signal flow from source to pixel:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          TSINGOU PLATFORM                                │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      SOURCE ADAPTERS [TSG.9]                       │  │
│  │                                                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │  │
│  │  │ In-Process   │  │ Sidecar     │  │ NATS Leaf   │               │  │
│  │  │              │  │ (bridge)    │  │ (edge)      │               │  │
│  │  │  NATS        │  │             │  │             │               │  │
│  │  │  HTTP (x4)   │  │  Serial     │  │  Remote     │               │  │
│  │  │  WebSocket   │  │  FileWatch  │  │  Sensors    │               │  │
│  │  │  RSS         │  │  GNU Radio  │  │  (Pi+SDR)   │               │  │
│  │  │              │  │  RTL-SDR    │  │             │               │  │
│  │  │  MIDI (stub) │  │             │  │             │               │  │
│  │  │  OSC (stub)  │  │             │  │             │               │  │
│  │  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘               │  │
│  │         │ push()          │ NATS pub        │ NATS leaf           │  │
│  └─────────┼─────────────────┼─────────────────┼─────────────────────┘  │
│            │                 │                  │                        │
│            ▼                 ▼                  ▼                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │          SIGNAL QUEUE  [TSG.7]                                    │   │
│  │          Queue.bounded<BaseSignal>(4096)                          │   │
│  │          Backpressure: adapters block on full queue               │   │
│  └──────────────────────────┬───────────────────────────────────────┘   │
│                              │                                          │
│                              ▼ TsingouFlow drain loop                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │          INGEST GRAPH  [TSG.7, TSG.26]                            │   │
│  │                                                                   │   │
│  │  schemaValidate ──▶ normalize ──▶ enrich ──▶ consolidate         │   │
│  │                                                                   │   │
│  │  Input:  raw MultiSet<BaseSignal>                                 │   │
│  │  Output: validated, normalized MultiSet<BaseSignal>               │   │
│  └──────────────────────────┬───────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │          DERIVED GRAPH  [TSG.7, TSG.26, TSG.31]                   │   │
│  │                                                                   │   │
│  │  join ──▶ window ──▶ reduce ──▶ topK ──▶ iterate                 │   │
│  │                                                                   │   │
│  │  Cross-source correlation, anomaly detection, pattern matching   │   │
│  │  43 analysis techniques across 8 mathematical domains             │   │
│  └──────────────────────────┬───────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │          OUTPUT BRIDGE  [TSG.7, TSG.10]                           │   │
│  │                                                                   │   │
│  │  Queue(1024) ──▶ batch(8) ──▶ Atom.set(activeSignalsAtom)        │   │
│  │                                                                   │   │
│  │  Zero coupling: pipeline has no knowledge of rendering layers    │   │
│  └──────────────────────────┬───────────────────────────────────────┘   │
│                              │                                          │
│                    useAtomValue()                                        │
│                              │                                          │
│  ┌──────────────────────────▼───────────────────────────────────────┐   │
│  │          RENDERING SURFACE  [TSG.20-TSG.24]                       │   │
│  │                                                                   │   │
│  │  z:0  R3F ────── Network graphs, geospatial, signal topology     │   │
│  │  z:1  visx ───── Timelines, heatmaps, ATT&CK matrix             │   │
│  │  z:2  p5 ─────── Spectrum waterfall, noise fields, constellations│   │
│  │  z:3  DOM ────── Controls, alerts, tables, annotation            │   │
│  │                                                                   │   │
│  │  Each layer independent. No inter-layer imports. All subscribe    │   │
│  │  to shared atoms via useAtomValue().                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌────────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ STATE MANAGEMENT       │  │ MESSAGING FABRIC                      │  │
│  │ [TSG.10]               │  │ [TSG.11]                              │  │
│  │                        │  │                                        │  │
│  │ Atom.make()  (primary) │  │ NATS Core (pub/sub)                   │  │
│  │ Effect.Ref   (internal)│  │ JetStream (persistence + replay)      │  │
│  │ useAtomValue  (React)  │  │ KV Store (schemas, config, sessions)  │  │
│  └────────────────────────┘  │ Holonet service stack (typed wrappers)│  │
│                               └───────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ INTELLIGENCE INTEGRATION  [TSG.12-TSG.15, TSG.18]                 │   │
│  │                                                                   │   │
│  │ STIX 2.1 codec ┊ TAXII transport ┊ SigMF codec ┊ CTI connectors │   │
│  │ (bidirectional)  (poll/subscribe)  (RF metadata)  (MISP/OpenCTI) │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ APPLICATION SHELL  [TSG.34]                                       │   │
│  │                                                                   │   │
│  │ Tauri v2 ──── Rust core, system WebView, fs scoping              │   │
│  │ Sidecars ──── Serial, GNU Radio, RTL-SDR (communicate via NATS)  │   │
│  │ Leaf nodes ── Edge sensors, remote collection stations            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### TSG.1.7.2 Signal Flow Summary

The signal flow from source to pixel traverses seven stages:

| Stage | Component | Section | Description |
|-------|-----------|---------|-------------|
| 1. **Creation** | Source Adapter | TSG.9 | Adapter receives raw data, constructs BaseSignal with branded IDs, kind, timestamp |
| 2. **Ingestion** | Signal Queue | TSG.7 | Signal offered to `Queue.bounded(4096)` with backpressure |
| 3. **Normalization** | Ingest Graph | TSG.7, TSG.8 | Schema validation, timestamp normalization, metadata enrichment |
| 4. **Processing** | Derived Graph | TSG.7, TSG.26 | Cross-source joins, windowing, aggregation, anomaly detection |
| 5. **Routing** | Output Bridge | TSG.7, TSG.10 | Batched atom writes (batch size 8), capped at 10,000 items |
| 6. **Rendering** | 4-Layer Surface | TSG.20-TSG.24 | Each layer subscribes via `useAtomValue()`, renders independently |
| 7. **Archival** | JetStream | TSG.11 | Published to NATS JetStream for historical replay |

### TSG.1.7.3 Service Composition

The Effect Layer tree defines the dependency composition from leaf services to
the root:

```
TsingouFlowLive (root)
  └── TsingouFlow.Default (scoped service)
       └── AdapterManager.Default (scoped service)
            └── [adapters consume SignalQueueTag via register()]
                 └── NatsPubSubService.Default
                      └── NatsHubService.Default
                           └── NatsInnerService.Default
                                └── NatsConnectionService.Default
                                     └── HolonetConfigTag.Default
```

Individual services MUST NOT construct their own dependencies. All dependencies
are resolved at the composition root via `Effect.provide(TsingouFlowLive)`.
The full service architecture is specified in TSG.6 and TSG.32.

### TSG.1.7.4 Cross-Section Data Flow Map

The following table maps each data artifact to the sections that produce and
consume it:

| Data Artifact | Produced By | Consumed By |
|--------------|-------------|-------------|
| Raw external data | External sources | TSG.9 (Source Adapters) |
| `BaseSignal` | TSG.9 (Source Adapters) | TSG.7 (Signal Pipeline), TSG.8 (Schema) |
| Validated `BaseSignal` | TSG.7 (Ingest Graph) | TSG.7 (Derived Graph) |
| Derived analytical state | TSG.7 (Derived Graph) | TSG.10 (Output Bridge) |
| Output atoms | TSG.10 (Output Bridge) | TSG.20-TSG.24 (Rendering Layers) |
| STIX bundles | TSG.13 (STIX Codec) | TSG.14 (TAXII Transport) |
| SigMF metadata | TSG.18 (SigMF Codec) | TSG.19 (Spectrum Visualization) |
| JetStream messages | TSG.11 (NATS Fabric) | TSG.7 (Replay), TSG.9 (Audit) |
| Schema registry entries | TSG.8 (Schema) | TSG.7 (Validation), TSG.11 (NATS KV) |
| Tagged errors | TSG.35 (Error Handling) | All services |

---

## TSG.1.8 Intelligence Disciplines Supported

### TSG.1.8.1 Multi-INT Coverage

Tsingou is designed as a multi-INT platform, supporting the ingestion, processing,
and visualization of signals from five intelligence disciplines. The level of
support varies by discipline maturity within the platform.

### TSG.1.8.2 SIGINT — Signals Intelligence

Signals Intelligence is the primary discipline for Tsingou. SIGINT encompasses
the interception and analysis of electronic signals, subdivided into three
sub-disciplines:

**COMINT — Communications Intelligence**

| Aspect | Description | Tsingou Mechanism |
|--------|-------------|-------------------|
| Definition | Intelligence derived from the interception of communications between parties | Ingestion of network traffic, chat streams, messaging feeds |
| Sources | WebSocket streams (IRC, Matrix, Discord), HTTP APIs (social media), RSS/Atom feeds (blogs, news) | WebSocket, HTTP, RSS source adapters (TSG.9) |
| Processing | Content analysis, entity extraction, temporal pattern detection | d2ts derived graph operators (TSG.7), NLP enrichment (future) |
| Visualization | Timeline correlation, entity network graphs, communication pattern heatmaps | visx timelines (TSG.22), R3F network graphs (TSG.21), p5 pattern viz (TSG.23) |

**ELINT — Electronic Intelligence**

| Aspect | Description | Tsingou Mechanism |
|--------|-------------|-------------------|
| Definition | Intelligence derived from non-communication electromagnetic emanations | RF spectrum analysis via SDR hardware |
| Sources | RTL-SDR, HackRF, LimeSDR, USRP via GNU Radio bridge or direct sidecar | SDR integration (TSG.16-TSG.19), GNU Radio bridge (TSG.17) |
| Processing | FFT, spectral analysis, signal detection, modulation classification | DSP operators (TSG.25), d2ts windowing for spectral history |
| Visualization | Spectrum waterfall display, constellation diagrams, signal strength maps | p5 generative layer (TSG.23), R3F geospatial (TSG.21) |

**FISINT — Foreign Instrumentation Signals Intelligence**

| Aspect | Description | Tsingou Mechanism |
|--------|-------------|-------------------|
| Definition | Intelligence derived from the interception of telemetry, tracking, and remote control signals from foreign instruments | Serial adapter for telemetry streams, NATS for sensor networks |
| Sources | Serial port (UART/USB) for embedded device telemetry, NATS subjects for sensor arrays | Serial adapter, NATS adapter (TSG.9) |
| Processing | Protocol decoding, telemetry value extraction, anomaly detection | Schema-validated parsing, d2ts statistical operators (TSG.27) |
| Visualization | Time-series telemetry charts, anomaly highlight overlays | visx charts (TSG.22), DOM alert panels (TSG.24) |

### TSG.1.8.3 OSINT — Open-Source Intelligence

| Aspect | Description | Tsingou Mechanism |
|--------|-------------|-------------------|
| Definition | Intelligence derived from publicly available information sources | RSS feeds, HTTP APIs, file monitoring, WebSocket streams |
| Sources | News RSS feeds, social media APIs, government data portals, academic publications, dark web monitoring (via proxy) | RSS, HTTP (poll/SSE/webhook/long-poll), WebSocket, FileWatch adapters (TSG.9) |
| Processing | Feed deduplication (GUID-based), content extraction, entity recognition, temporal correlation | RSS dedup in adapter, d2ts graph for cross-source correlation (TSG.7) |
| Visualization | News timeline, entity relationship graph, geographic heat map, topic clustering | visx timeline (TSG.22), R3F entity graph (TSG.21), DOM feed panel (TSG.24) |

### TSG.1.8.4 GEOINT — Geospatial Intelligence

| Aspect | Description | Tsingou Mechanism |
|--------|-------------|-------------------|
| Definition | Intelligence derived from geospatial data — imagery, maps, and location information | GPS serial adapter, H3 geospatial indexing, coordinate correlation |
| Sources | Serial GPS receivers (NMEA sentences), HTTP geolocation APIs, file-based GeoJSON data | Serial adapter, HTTP adapter, FileWatch adapter (TSG.9) |
| Processing | Haversine distance, Vincenty geodesic, H3 hexagonal indexing, R-tree spatial queries, geofencing | Geospatial mathematics (TSG.30), d2ts spatial join operators |
| Visualization | 3D globe rendering, marker clustering, movement track visualization, geofence overlays | R3F 3D geospatial scene (TSG.21), visx map overlays (TSG.22) |

### TSG.1.8.5 HUMINT — Human Intelligence (Manual Entry)

| Aspect | Description | Tsingou Mechanism |
|--------|-------------|-------------------|
| Definition | Intelligence derived from human sources — interviews, observations, reports | Manual signal entry through DOM control layer |
| Sources | Analyst keyboard input, structured form submission, file upload | DOM layer input components (TSG.24), FileWatch adapter for bulk import |
| Processing | Schema validation of manually entered signals, cross-referencing with automated feeds | BaseSignal validation (TSG.8), d2ts join with automated sources (TSG.7) |
| Visualization | Annotation overlays on other visualization layers, manual marker placement on 3D globe | DOM annotation layer (TSG.24), R3F marker system (TSG.21) |

HUMINT support in Tsingou is limited to manual signal entry and annotation.
Tsingou does not automate HUMINT collection (which is inherently a human
activity), but provides the mechanism for human-sourced intelligence to be
entered into the same pipeline as automated sources, enabling cross-INT
correlation.

### TSG.1.8.6 CYBINT — Cyber Intelligence

| Aspect | Description | Tsingou Mechanism |
|--------|-------------|-------------------|
| Definition | Intelligence derived from cyber domain activity — threat indicators, malware analysis, vulnerability data | STIX/TAXII ingestion, threat intel API polling |
| Sources | TAXII 2.1 feeds (TSG.14), threat intel HTTP APIs (AlienVault OTX, VirusTotal, Shodan), MISP/OpenCTI connectors (TSG.15) | HTTP adapter, STIX codec (TSG.13), TAXII transport (TSG.14), CTI connectors (TSG.15) |
| Processing | IOC correlation, ATT&CK technique mapping, vulnerability scoring, threat actor attribution | d2ts join operators for IOC matching, ATT&CK matrix rendering (TSG.7, TSG.31) |
| Visualization | ATT&CK matrix heatmap, IOC timeline, threat actor relationship graph, vulnerability dashboard | visx ATT&CK matrix (TSG.22), R3F relationship graph (TSG.21), DOM indicator table (TSG.24) |

### TSG.1.8.7 Intelligence Discipline Coverage Matrix

| Discipline | Collection | Processing | Analysis | Visualization | Dissemination | Maturity |
|-----------|-----------|-----------|----------|---------------|---------------|----------|
| SIGINT/COMINT | Built (4 adapters) | Stubbed (d2ts) | Designed | Designed (R3F, visx, DOM) | Designed (STIX export) | Wave 1-2 |
| SIGINT/ELINT | Designed (SDR bridge) | Designed (DSP ops) | Designed | Designed (p5 waterfall) | Designed (SigMF) | Wave 2-3 |
| SIGINT/FISINT | Built (Serial adapter) | Stubbed (d2ts) | Designed | Designed (visx charts) | Designed (STIX export) | Wave 1-2 |
| OSINT | Built (3 adapters) | Stubbed (d2ts) | Designed | Designed (visx, DOM) | Designed (STIX export) | Wave 1-2 |
| GEOINT | Partial (Serial GPS) | Designed (spatial ops) | Designed | Designed (R3F globe) | Designed | Wave 2-3 |
| HUMINT | Manual entry only | Same pipeline | Same pipeline | Annotation overlays | Same export | Wave 3-4 |
| CYBINT | Designed (STIX/TAXII) | Designed (IOC matching) | Designed | Designed (ATT&CK viz) | Designed (STIX export) | Wave 2-3 |

---

## TSG.1.9 Key Architectural Decisions

### TSG.1.9.1 ADR Summary

Tsingou's architecture is governed by 13 Architecture Decision Records, all
accepted on 2026-02-18 during a concentrated architectural design session. The
ADRs fall into three decision waves.

### TSG.1.9.2 Decision Wave 1: Core Infrastructure (ADR-001 through ADR-008)

These decisions establish the foundational technology stack:

| ADR | Title | Decision | Section Reference |
|-----|-------|---------|-------------------|
| ADR-001 | d2ts as Signal Pipeline Core | Use `@electric-sql/d2ts` for differential dataflow incremental computation | TSG.7, TSG.26 |
| ADR-002 | Source Adapter Contract | Define `SourceAdapterShape` as Effect.Service with push API and scoped lifecycle | TSG.9 |
| ADR-003 | NATS as Universal Signal Fabric | Use NATS for 5 roles: direct source, message bus, bridge, fan-out, JetStream replay | TSG.11 |
| ADR-004 | @effect/platform for I/O | Use `@effect/platform` HttpClient, Socket, and FileSystem for adapter I/O | TSG.9, TSG.32 |
| ADR-005 | Atom-as-State Pattern | Use effect-atom `Atom.make()` for all React-consumed state; prohibit `useState` for cross-component state | TSG.10 |
| ADR-006 | Tagged Errors Everywhere | Use `Data.TaggedError` for all error types; enable `catchTag` precision recovery | TSG.35 |
| ADR-007 | Framer Motion for Animation | Use framer-motion for DOM layer animation; replace nw_wrld's GSAP/anime.js/custom `animatable()` | TSG.24 |
| ADR-008 | System Named "Tsingou" | Name the system after Mary Tsingou; establish identity as SIGINT/OSINT analysis platform | TSG.1 |

### TSG.1.9.3 Decision Wave 2: Domain Integration (ADR-009 through ADR-011)

These decisions connect Tsingou to the intelligence domain:

| ADR | Title | Decision | Section Reference |
|-----|-------|---------|-------------------|
| ADR-009 | STIX Interoperability Layer | Use custom internal signal model (BaseSignal) with bidirectional STIX 2.1 codec; NOT STIX-native signals | TSG.12, TSG.13 |
| ADR-010 | Full Intelligence Cycle Coverage | Map all 6 intelligence cycle phases to Tsingou subsystems | TSG.3 |
| ADR-011 | SDR Integration via GNU Radio Bridge | Dual-path SDR: GNU Radio bridge (full DSP) + RTL-SDR sidecar (lightweight FFT) | TSG.16, TSG.17 |

### TSG.1.9.4 Decision Wave 3: Visualization Strategy (ADR-012 through ADR-013)

These decisions define the visualization scope and analysis portfolio:

| ADR | Title | Decision | Section Reference |
|-----|-------|---------|-------------------|
| ADR-012 | Tsingou as Visualization Platform | Position as real-time visualization layer; delegate knowledge graph to Palantir Gotham | TSG.33 |
| ADR-013 | Eight Analysis Techniques | Map 8 analysis techniques across 4 rendering layers with mathematical foundations | TSG.31 |

### TSG.1.9.5 ADR Dependency Graph

```
ADR-001 (d2ts) ──────────┬──▶ ADR-002 (adapter contract)
                          │        │
                          │        ├──▶ ADR-003 (NATS fabric)
                          │        │        │
                          │        │        └──▶ ADR-011 (SDR bridge)
                          │        │
                          │        ├──▶ ADR-004 (@effect/platform)
                          │        │        │
                          │        │        └──▶ ADR-011 (SDR bridge)
                          │        │
                          │        └──▶ ADR-010 (intelligence cycle)
                          │
                          └──▶ ADR-009 (STIX interop)
                                   │
                                   └──▶ ADR-012 (viz platform)
                                            │
                                            └──▶ ADR-013 (analysis techniques)

ADR-005 (Atom-as-State) ......... cross-cutting (all services)
ADR-006 (Tagged Errors) ......... cross-cutting (all services)
ADR-007 (Framer Motion) ......... independent (DOM layer only)
ADR-008 (Naming)         ......... independent (identity only)
```

Solid arrows indicate hard dependencies. Dotted lines indicate cross-cutting
concerns that apply universally. The full ADR index with consistency notes
and implementation status is provided in Appendix A.

### TSG.1.9.6 ADR Cross-Reference Table

| ADR | Depends On | Depended On By | Cross-Cutting |
|-----|-----------|---------------|---------------|
| ADR-001 | (none) | ADR-002, ADR-009, ADR-010 | No |
| ADR-002 | ADR-001 | ADR-003, ADR-004, ADR-009, ADR-010 | No |
| ADR-003 | ADR-002 | ADR-004, ADR-011 | No |
| ADR-004 | ADR-002, ADR-003 | ADR-011 | No |
| ADR-005 | (none) | (all services) | Yes |
| ADR-006 | (none) | (all services) | Yes |
| ADR-007 | (none) | (none) | No |
| ADR-008 | (none) | (none) | No |
| ADR-009 | ADR-001, ADR-002 | ADR-012 | No |
| ADR-010 | ADR-001, ADR-002 | ADR-012 | No |
| ADR-011 | ADR-003, ADR-004 | (none) | No |
| ADR-012 | ADR-009, ADR-010 | ADR-013 | No |
| ADR-013 | ADR-012 | (none) | No |

---

## TSG.1.10 Technology Stack

### TSG.1.10.1 Core Runtime

| Technology | Version | Role | Section | Maturity |
|-----------|---------|------|---------|----------|
| **Effect-TS** | ^3.x | Service composition, typed errors, streams, scheduling, scoped resources | TSG.32 | Stable, production-ready |
| **effect-atom** | ^0.x | Reactive state, React subscriptions, service-to-view bridge | TSG.10 | Stable, used in production |
| **TypeScript** | ^5.x | Language | (all) | Stable |

### TSG.1.10.2 Signal Pipeline

| Technology | Version | Role | Section | Maturity |
|-----------|---------|------|---------|----------|
| **d2ts** (`@electric-sql/d2ts`) | ^0.x | Differential dataflow incremental computation | TSG.7, TSG.26 | **Pre-alpha** (critical path blocker) |
| **Effect.Schema** | (Effect) | Runtime validation, encode/decode, JSON Schema generation | TSG.8, TSG.32 | Stable |

### TSG.1.10.3 Messaging & Transport

| Technology | Version | Role | Section | Maturity |
|-----------|---------|------|---------|----------|
| **NATS** (`@nats-io/nats.js`) | ^3.x | Core pub/sub, universal signal fabric | TSG.11 | Stable, production-ready |
| **NATS JetStream** (`@nats-io/jetstream`) | ^3.x | Persistent message streams, replay | TSG.11 | Stable |
| **NATS KV** (`@nats-io/kv`) | ^3.x | Key-value store for schemas, config, sessions | TSG.11 | Stable |

### TSG.1.10.4 Rendering

| Technology | Version | Role | Section | Maturity |
|-----------|---------|------|---------|----------|
| **React Three Fiber (R3F)** | ^8.x | Declarative WebGL 3D scene graph | TSG.21 | Stable, production-ready |
| **visx** | ^3.x | D3-powered composable React charts | TSG.22 | Stable, production-ready |
| **p5.js** (`@p5-wrapper/react`) | ^4.x | Creative coding, spectrum visualization | TSG.23 | Stable |
| **framer-motion** | ^11.x | Layout transitions, enter/exit, gestures | TSG.24 | Stable, production-ready |
| **React** | ^18.x / ^19.x | Component framework | TSG.20-TSG.24 | Stable |

### TSG.1.10.5 Interoperability Standards

| Standard | Version | Role | Section |
|----------|---------|------|---------|
| **STIX** | 2.1 | Structured Threat Information eXpression — data model for CTI | TSG.12, TSG.13 |
| **TAXII** | 2.1 | Trusted Automated eXchange of Intelligence Information — transport | TSG.14 |
| **SigMF** | 1.x | Signal Metadata Format — RF capture metadata | TSG.18 |
| **MITRE ATT&CK** | (current) | Adversary tactics, techniques, and procedures framework | TSG.31 |

### TSG.1.10.6 Application Shell

| Technology | Version | Role | Section | Maturity |
|-----------|---------|------|---------|----------|
| **Tauri** | v2 | Native application shell (Rust + WebView) | TSG.34 | Stable |
| **Bun** | ^1.x | JavaScript runtime for sidecars | TSG.34 | Stable |

### TSG.1.10.7 Integration Targets

| Platform | Integration Role | Transport | Section |
|----------|-----------------|-----------|---------|
| **Palantir Gotham** | Knowledge graph persistence, ontology management | REST API + Streaming | TSG.33 |
| **MISP** | Threat intelligence sharing, IOC correlation | MISP API + STIX | TSG.15 |
| **OpenCTI** | CTI knowledge management | GraphQL + STIX/TAXII | TSG.15 |
| **TheHive** | Incident response, case management | REST API | TSG.15 |
| **Cortex** | Automated enrichment, observable analysis | REST API | TSG.15 |
| **GNU Radio** | DSP flowgraph processing, demodulation | ZMQ PUB socket | TSG.17 |

### TSG.1.10.8 Critical Path Dependency

The critical path dependency for Tsingou's implementation is `@electric-sql/d2ts`.
Until d2ts stabilizes, the differential dataflow graph processing remains stubbed
with a pass-through implementation in `TsingouFlow.ts`. All other dependencies in
the technology stack are production-ready.

| Dependency | Status | Impact if Unavailable |
|-----------|--------|----------------------|
| `@electric-sql/d2ts` | Pre-alpha, API stabilizing | d2ts graph processing stubbed; signals pass through without differential computation |
| All others | Stable | No impact — ready for production use |

The stub preserves the full service contract and data flow architecture. The d2ts
integration will be activated when `@electric-sql/d2ts` stabilizes. The stub MUST
NOT be removed until d2ts is fully wired [TSG.7].

---

## TSG.1.11 Target Deployment Scenarios

### TSG.1.11.1 Scenario Overview

Tsingou is designed for deployment across four operational scenarios, ranging from
a single analyst laptop to a distributed sensor network. The platform's local-first
architecture and NATS-based messaging fabric enable operation across this spectrum
without architectural changes.

### TSG.1.11.2 Scenario A: Analyst Laptop

| Aspect | Specification |
|--------|--------------|
| **Environment** | Single analyst workstation (laptop/desktop) |
| **Connectivity** | Intermittent or full internet access |
| **Users** | 1 analyst |
| **Hardware** | Modern laptop (8GB+ RAM, 4+ cores) |
| **Deployment** | Tauri application (single binary, ~10MB) |
| **NATS** | Embedded NATS server or localhost NATS daemon |
| **Sidecars** | Optional: serial sidecar for SDR, file watcher |
| **Sources** | 2-5 simultaneous adapters (RSS, HTTP, WebSocket, optional SDR) |
| **Throughput** | Low-medium (100-1,000 signals/minute) |
| **Use Case** | OSINT monitoring, threat feed correlation, individual analysis |

```
┌──────────────────────────────────────┐
│  ANALYST LAPTOP                       │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │  Tsingou (Tauri)                │ │
│  │  ├── Embedded NATS              │ │
│  │  ├── 3-4 in-process adapters    │ │
│  │  ├── d2ts pipeline              │ │
│  │  └── 4-layer rendering          │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │  Optional: RTL-SDR sidecar      │ │
│  │  (communicates via localhost     │ │
│  │   NATS)                          │ │
│  └─────────────────────────────────┘ │
│                                       │
│  Internet ──▶ RSS/HTTP/WS adapters   │
└──────────────────────────────────────┘
```

### TSG.1.11.3 Scenario B: Field Collection Station

| Aspect | Specification |
|--------|--------------|
| **Environment** | Forward-deployed collection station |
| **Connectivity** | Limited/intermittent satellite or HF radio data link |
| **Users** | 1-3 analysts |
| **Hardware** | Ruggedized laptop or small form factor PC, SDR hardware, antenna systems |
| **Deployment** | Tauri application + sidecar daemons |
| **NATS** | Local NATS server with JetStream for signal persistence |
| **Sidecars** | Serial (SDR), GNU Radio bridge, GPS receiver |
| **Sources** | 3-8 simultaneous adapters, emphasis on SIGINT/ELINT |
| **Throughput** | Medium-high (1,000-10,000 signals/minute from SDR) |
| **Use Case** | RF spectrum monitoring, communications interception, ELINT collection |

```
┌───────────────────────────────────────────────────┐
│  FIELD COLLECTION STATION                          │
│                                                    │
│  ┌─────────────────────────┐  ┌────────────────┐ │
│  │  Tsingou (Tauri)         │  │  GNU Radio     │ │
│  │  ├── NATS (local)        │  │  bridge        │ │
│  │  ├── In-process adapters │  │  (HackRF)      │ │
│  │  ├── d2ts pipeline       │  └───────┬────────┘ │
│  │  └── 4-layer rendering   │          │ NATS pub │
│  │                          │◀─────────┘          │
│  └──────────┬───────────────┘                     │
│             │                                      │
│  ┌──────────▼───────────────┐  ┌────────────────┐ │
│  │  JetStream               │  │  RTL-SDR       │ │
│  │  (signal persistence     │  │  sidecar       │ │
│  │   for disconnected ops)  │  │  (spectrum)    │ │
│  └──────────────────────────┘  └───────┬────────┘ │
│                                         │ NATS pub │
│                                ◀────────┘          │
│                                                    │
│  ── Satellite uplink (when available) ──           │
│     └── NATS leaf node to HQ NATS cluster          │
└───────────────────────────────────────────────────┘
```

### TSG.1.11.4 Scenario C: CEMA Cell

| Aspect | Specification |
|--------|--------------|
| **Environment** | Cyber Electromagnetic Activities (CEMA) cell within a tactical operations center |
| **Connectivity** | Tactical network (SIPR/JWICS equivalent) with limited bandwidth |
| **Users** | 3-10 analysts with role-based views |
| **Hardware** | Server rack + analyst workstations, multiple SDR receivers, antenna array |
| **Deployment** | Multi-instance Tsingou with shared NATS cluster |
| **NATS** | Dedicated NATS cluster (3-node minimum for HA) |
| **Sidecars** | Multiple GNU Radio bridges, serial sensors, network taps |
| **Sources** | 10-30 simultaneous adapters across all INT disciplines |
| **Throughput** | High (10,000-100,000 signals/minute from multiple SDRs) |
| **Use Case** | Full-spectrum CEMA operations, real-time EW situational awareness |

```
┌────────────────────────────────────────────────────────────┐
│  CEMA CELL                                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  NATS Cluster (3-node HA)                            │   │
│  │  JetStream + KV                                      │   │
│  └───────────────────┬─────────────────────────────────┘   │
│                      │                                      │
│  ┌───────────┐  ┌────▼──────┐  ┌───────────┐              │
│  │ Analyst 1  │  │ Analyst 2  │  │ Analyst 3  │   ...       │
│  │ (SIGINT)   │  │ (OSINT)    │  │ (CYBINT)   │              │
│  │ Tsingou    │  │ Tsingou    │  │ Tsingou    │              │
│  └───────────┘  └───────────┘  └───────────┘              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Collection Layer                                      │  │
│  │  GNU Radio (x3) + RTL-SDR (x5) + Network taps (x2)   │  │
│  │  All publish to shared NATS cluster                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ── Tactical network ──▶ Higher HQ (NATS leaf node)        │
└────────────────────────────────────────────────────────────┘
```

### TSG.1.11.5 Scenario D: Distributed Sensor Network

| Aspect | Specification |
|--------|--------------|
| **Environment** | Geographically distributed sensor nodes with centralized analysis |
| **Connectivity** | Variable — satellite, cellular, wired, mesh radio |
| **Users** | 1-20 analysts at central facility |
| **Hardware** | Edge: Raspberry Pi + SDR per node. Central: server cluster + analyst workstations |
| **Deployment** | Edge: NATS leaf nodes with local JetStream. Central: NATS cluster + Tsingou instances |
| **NATS** | Leaf node topology — edge nodes connect to central cluster when connectivity permits |
| **Sidecars** | Edge: RTL-SDR sidecar + GPS. Central: GNU Radio bridge for re-processing |
| **Sources** | 50+ edge sensors, each contributing 1-3 signal types |
| **Throughput** | Very high aggregate (100,000+ signals/minute across all nodes) |
| **Use Case** | Wide-area spectrum monitoring, geolocation via multilateration, pattern-of-life analysis |

```
                     ┌──────────────────────────┐
                     │  CENTRAL ANALYSIS FACILITY │
                     │                           │
                     │  NATS Cluster (HA)         │
                     │  Tsingou Instances (x5)    │
                     │  JetStream (30-day retain) │
                     └─────────┬─────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
     ┌────────▼────────┐ ┌────▼──────────┐ ┌───▼────────────┐
     │  Edge Node A     │ │  Edge Node B   │ │  Edge Node C    │
     │  (hilltop)       │ │  (urban)       │ │  (maritime)     │
     │                  │ │                │ │                 │
     │  Pi + RTL-SDR    │ │  Pi + HackRF   │ │  Pi + RTL-SDR   │
     │  + GPS           │ │  + GPS         │ │  + GPS          │
     │  NATS leaf node  │ │  NATS leaf node│ │  NATS leaf node │
     │  Local JetStream │ │  Local JS      │ │  Local JS       │
     └─────────────────┘ └────────────────┘ └────────────────┘

     Edge nodes buffer signals locally (JetStream) and forward
     to central facility when connectivity permits (leaf node).
```

### TSG.1.11.6 Deployment Scenario Comparison

| Capability | A: Laptop | B: Field Station | C: CEMA Cell | D: Sensor Network |
|-----------|----------|-----------------|-------------|------------------|
| Analyst count | 1 | 1-3 | 3-10 | 1-20 |
| Adapter count | 2-5 | 3-8 | 10-30 | 50+ (aggregate) |
| Signal throughput | 100-1K/min | 1K-10K/min | 10K-100K/min | 100K+/min |
| NATS topology | Embedded/local | Local server | 3-node cluster | Leaf node network |
| SDR hardware | Optional RTL-SDR | HackRF + RTL-SDR | Multiple SDRs | RTL-SDR per node |
| Connectivity | Internet | Intermittent sat | Tactical net | Variable |
| JetStream retention | 24h | 24-72h | 7-30 days | 30 days (central) |
| Primary INT focus | OSINT, CYBINT | SIGINT, ELINT | Full-spectrum | SIGINT, GEOINT |

The deployment topology is fully specified in TSG.34.

---

## TSG.1.12 Terminology

### TSG.1.12.1 Core Platform Terms

| Term | Definition | Section |
|------|-----------|---------|
| **BaseSignal** | The universal data contract for all signals entering, traversing, and exiting the Tsingou pipeline. Defined as an Effect Schema with 7 fields: `id`, `sourceId`, `timestamp`, `version`, `kind`, `payload`, `metadata`. | TSG.8 |
| **Signal kind** | The discriminator field on a BaseSignal that determines which extension schema validates the payload. Eight known kinds are defined at compile time; custom kinds are validated via the schema registry at runtime. | TSG.8.4 |
| **Source adapter** | An Effect.Service implementation of the `SourceAdapterShape` contract that ingests data from an external source and produces BaseSignal instances. Eight adapter types are defined. | TSG.9 |
| **Signal pipeline** | The complete data processing chain from source adapter through d2ts graphs to output bridge. Comprises ingestion, normalization, processing, and routing stages. | TSG.7 |
| **Output bridge** | The component that connects the d2ts pipeline output to rendering layers via batched atom writes. Enforces zero coupling between pipeline and rendering. | TSG.7 |
| **Rendering surface** | The 4-layer composited viewport (R3F + visx + p5 + DOM) that visualizes pipeline output. Each layer subscribes to output atoms independently. | TSG.20 |
| **Holonet** | Tsingou's typed Effect.Service abstraction layer over NATS. "NATS" refers to the underlying technology; "Holonet" refers to the typed service wrappers. | TSG.11, TSG.32 |
| **TsingouFlow** | The root service that manages the signal pipeline lifecycle, including the processing loop, output bridge, and adapter management. | TSG.6, TSG.7 |

### TSG.1.12.2 Differential Dataflow Terms

| Term | Definition | Section |
|------|-----------|---------|
| **Differential dataflow** | A computational model where collections are maintained incrementally by propagating deltas (changes) through a dataflow graph rather than recomputing from scratch. | TSG.26 |
| **MultiSet** | A collection where each element has an integer multiplicity. +1 represents addition, -1 represents retraction. The fundamental data structure in d2ts. | TSG.7, TSG.26 |
| **Version** | A multi-dimensional timestamp that partially orders events. In Tsingou, a 2-tuple `[tick, source_seq]` where tick is the global processing cycle and source_seq is a per-source counter. | TSG.8.3 |
| **Frontier** | An antichain of versions below which no further data will arrive. Enables garbage collection of operator state and progress tracking. | TSG.26 |
| **Antichain** | A set of versions where no version dominates another. Used to represent frontiers in the partial order. | TSG.26 |
| **Operator** | A stateful transformation on versioned multisets. Standard operators: `map`, `filter`, `join`, `reduce`. Custom operators: `window`, `throttle`, `schemaValidate`. | TSG.7 |
| **Consolidation** | The process of merging retractions with additions to produce a net multiset at a given version. | TSG.26 |

### TSG.1.12.3 Effect-TS Terms

| Term | Definition | Section |
|------|-----------|---------|
| **Effect** | The fundamental computation type `Effect<A, E, R>` — a lazy description of a computation that succeeds with `A`, fails with `E`, and requires environment `R`. | TSG.32 |
| **Layer** | A recipe for constructing a service from its dependencies. Layers compose to build the complete dependency graph. | TSG.32 |
| **Scope** | A resource management boundary. When a scope closes, all finalizers registered within it are executed, ensuring deterministic cleanup. | TSG.32 |
| **Atom** | A reactive state primitive from effect-atom. Created via `Atom.make()`, mutated via `ctx.set()`, subscribed via `useAtomValue()`. | TSG.10 |
| **Fiber** | A lightweight concurrency primitive. Fibers support structured concurrency with interruption propagation. | TSG.32 |
| **Schema** | An Effect Schema type definition that provides runtime validation, encode/decode, and JSON Schema generation. | TSG.8, TSG.32 |
| **TaggedError** | An error type created via `Data.TaggedError` with a `_tag` discriminator enabling `catchTag` precision recovery. | TSG.35 |
| **Branded type** | A string or number type with a compile-time brand (e.g., `SignalId`, `SourceId`) that prevents accidental cross-assignment while remaining a plain value at runtime. | TSG.8.2 |

### TSG.1.12.4 Intelligence Terms

| Term | Definition | Section |
|------|-----------|---------|
| **SIGINT** | Signals Intelligence — intelligence derived from electronic signals. Subdivided into COMINT (communications), ELINT (electronic), and FISINT (foreign instrumentation signals). | TSG.2 |
| **OSINT** | Open-Source Intelligence — intelligence derived from publicly available information. | TSG.2 |
| **GEOINT** | Geospatial Intelligence — intelligence derived from imagery, maps, and location data. | TSG.2 |
| **HUMINT** | Human Intelligence — intelligence derived from human sources. In Tsingou, limited to manual signal entry. | TSG.1.8 |
| **CYBINT** | Cyber Intelligence — intelligence derived from cyber domain activity including threat indicators, malware, and vulnerabilities. | TSG.1.8 |
| **Multi-INT** | The fusion of intelligence from multiple disciplines to produce a more complete analytical picture than any single discipline provides. | TSG.4 |
| **Intelligence cycle** | The 6-phase process: Direction, Collection, Processing, Analysis, Dissemination, Feedback. | TSG.3 |
| **STIX** | Structured Threat Information eXpression — OASIS standard for representing cyber threat intelligence objects and relationships. | TSG.12 |
| **TAXII** | Trusted Automated eXchange of Intelligence Information — OASIS standard for transporting STIX data between parties. | TSG.14 |
| **SigMF** | Signal Metadata Format — standard for annotating RF signal recordings. | TSG.18 |
| **IOC** | Indicator of Compromise — an observable artifact (IP address, domain, hash) that indicates potential malicious activity. | TSG.12 |
| **ATT&CK** | MITRE ATT&CK — a globally accessible knowledge base of adversary tactics, techniques, and procedures. | TSG.31 |

### TSG.1.12.5 Rendering Terms

| Term | Definition | Section |
|------|-----------|---------|
| **4-layer composited rendering** | Tsingou's rendering architecture: R3F (z:0), visx (z:1), p5 (z:2), DOM (z:3) stacked via CSS z-index with transparent backgrounds. | TSG.20 |
| **R3F** | React Three Fiber — a React renderer for Three.js, providing declarative WebGL 3D rendering. | TSG.21 |
| **visx** | A collection of composable D3-based React visualization primitives from Airbnb. | TSG.22 |
| **p5** | p5.js — a creative coding library used in Tsingou for generative signal visualization (spectrum waterfall, noise fields). | TSG.23 |
| **DOM layer** | The topmost rendering layer (z:3) built with React and framer-motion for controls, tables, alerts, and annotation. | TSG.24 |
| **Spectrum waterfall** | A visualization that displays frequency on the horizontal axis, time on the vertical axis, and signal power as color intensity. Standard SIGINT display for RF analysis. | TSG.19, TSG.23 |

### TSG.1.12.6 Deployment Terms

| Term | Definition | Section |
|------|-----------|---------|
| **Sidecar** | A separate process that communicates with the main Tsingou application via NATS. Used for hardware access (serial, SDR) and CPU-intensive processing (GNU Radio). | TSG.34 |
| **Leaf node** | A NATS leaf node deployed at the edge (e.g., Raspberry Pi with SDR) that connects to a central NATS cluster when connectivity permits. | TSG.34 |
| **CEMA cell** | Cyber Electromagnetic Activities cell — a military unit responsible for planning, integrating, and synchronizing cyber and electronic warfare operations. | TSG.36 |
| **Tauri v2** | The application shell technology for Tsingou, providing a Rust-based backend with a system WebView frontend. Replaces Electron. | TSG.34 |

---

## TSG.1.13 Normative Requirements Summary

### TSG.1.13.1 MUST Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.1-R1 | Implementations MUST treat the signal pipeline as the primary product; the rendering surface is an output modality | TSG.1.2.3 |
| TSG.1-R2 | The platform MUST be capable of full analytical operation in a disconnected state | TSG.1.1.4 |
| TSG.1-R3 | Network connectivity MUST NOT be required for core analysis functions | TSG.1.1.4 |
| TSG.1-R4 | The platform MUST validate all ingested signals against declared schemas at the ingestion boundary | TSG.1.1.5 |
| TSG.1-R5 | Invalid signals MUST NOT propagate to the analysis or rendering layers | TSG.1.1.5 |
| TSG.1-R6 | All domain types MUST be defined as Effect Schema constructs; raw TypeScript interface/type declarations MUST NOT be used for pipeline domain types | TSG.1.3.6 |
| TSG.1-R7 | Raw TypeScript Promise, try/catch, and EventEmitter MUST NOT be used within Tsingou core packages; Effect-TS primitives MUST be used for all concerns listed in the technology mapping table | TSG.1.3.1 |
| TSG.1-R8 | No rendering layer MUST import from another rendering layer; all layers MUST subscribe to shared atoms via useAtomValue() | TSG.1.3.4 |
| TSG.1-R9 | Individual services MUST NOT construct their own dependencies; all dependencies MUST be resolved at the composition root | TSG.1.7.3 |
| TSG.1-R10 | The d2ts stub MUST NOT be removed until d2ts is fully wired | TSG.1.10.8 |
| TSG.1-R11 | Normative keywords (MUST, SHALL, etc.) in uppercase MUST carry their RFC 2119 / RFC 8174 meaning | TSG.1.5.1 |

### TSG.1.13.2 SHOULD Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.1-S1 | Network connectivity SHOULD enhance capabilities (federation, shared threat intelligence, distributed sensor networks) | TSG.1.1.4 |
| TSG.1-S2 | Effect-TS boundary wrappers SHOULD be used when integrating with third-party libraries that do not use Effect | TSG.1.3.1 |
| TSG.1-S3 | Where a code example conflicts with the prose specification, the prose SHOULD govern | TSG.1.5.4 |

### TSG.1.13.3 MAY Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.1-M1 | Multiple rendering surfaces MAY consume the same pipeline output simultaneously | TSG.1.2.3 |
| TSG.1-M2 | Raw TypeScript primitives (Promise, try/catch) MAY appear at system boundaries for third-party library interop | TSG.1.3.1 |
| TSG.1-M3 | Implementations MAY deploy in any of the four target scenarios (Analyst Laptop, Field Station, CEMA Cell, Distributed Sensor Network) without architectural changes | TSG.1.11.1 |

---

## TSG.1.14 References

### TSG.1.14.1 Normative References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |

### TSG.1.14.2 Technology References

| Key | Reference |
|-----|-----------|
| [EFFECT] | Effect-TS. "Effect: A TypeScript library for building production-grade applications." https://effect.website |
| [EFFECT-SCHEMA] | Effect-TS. "@effect/schema — Schema validation and transformation." Part of the Effect ecosystem. |
| [D2TS] | Electric SQL. "@electric-sql/d2ts — Differential dataflow in TypeScript." |
| [NATS] | NATS.io. "NATS — Cloud Native Messaging System." https://nats.io |
| [TAURI] | Tauri. "Tauri — Build an optimized, secure, and frontend-independent application." https://tauri.app |
| [R3F] | Poimandres. "React Three Fiber — A React renderer for Three.js." https://docs.pmnd.rs/react-three-fiber |
| [VISX] | Airbnb. "visx — A collection of reusable low-level visualization components." https://airbnb.io/visx |
| [P5JS] | Processing Foundation. "p5.js — A JavaScript library for creative coding." https://p5js.org |
| [FRAMER-MOTION] | Framer. "Framer Motion — A production-ready motion library for React." https://www.framer.com/motion/ |

### TSG.1.14.3 Standards References

| Key | Reference |
|-----|-----------|
| [STIX-2.1] | OASIS CTI TC. "STIX Version 2.1." OASIS Standard, June 2021. https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html |
| [TAXII-2.1] | OASIS CTI TC. "TAXII Version 2.1." OASIS Standard, June 2021. |
| [SIGMF] | The SigMF Specification. "Signal Metadata Format." https://sigmf.org |
| [MITRE-ATTACK] | MITRE Corporation. "ATT&CK: Adversarial Tactics, Techniques, and Common Knowledge." https://attack.mitre.org |

### TSG.1.14.4 Doctrine References

| Key | Reference |
|-----|-----------|
| [ATP-3-12.3] | U.S. Army. "ATP 3-12.3: Electronic Warfare Techniques." Headquarters, Department of the Army. |
| [JP-3-13.1] | Joint Chiefs of Staff. "JP 3-13.1: Electronic Warfare." Joint Publication. |

### TSG.1.14.5 Architecture Decision Records

| Key | Reference |
|-----|-----------|
| [ADR-001] | ADR-001: d2ts as Signal Pipeline Core. `docs/tsingou/adr/ADR-001-d2ts-as-signal-pipeline.md` |
| [ADR-002] | ADR-002: Source Adapter Contract. `docs/tsingou/adr/ADR-002-source-adapter-contract.md` |
| [ADR-003] | ADR-003: NATS as Universal Signal Fabric. `docs/tsingou/adr/ADR-003-nats-as-universal-fabric.md` |
| [ADR-004] | ADR-004: @effect/platform for HTTP, WebSocket, FileSystem. `docs/tsingou/adr/ADR-004-effect-platform-adapters.md` |
| [ADR-005] | ADR-005: Atom-as-State Pattern. `docs/tsingou/adr/ADR-005-atom-as-state.md` |
| [ADR-006] | ADR-006: Tagged Errors Everywhere. `docs/tsingou/adr/ADR-006-tagged-errors-everywhere.md` |
| [ADR-007] | ADR-007: Framer Motion for Animation. `docs/tsingou/adr/ADR-007-framer-motion-for-animation.md` |
| [ADR-008] | ADR-008: System Named "Tsingou". `docs/tsingou/adr/ADR-008-tsingou-naming-and-identity.md` |
| [ADR-009] | ADR-009: STIX Interoperability Layer. `docs/tsingou/adr/ADR-009-stix-interop-layer.md` |
| [ADR-010] | ADR-010: Full Intelligence Cycle Coverage. `docs/tsingou/adr/ADR-010-full-intelligence-cycle.md` |
| [ADR-011] | ADR-011: SDR Integration via GNU Radio Bridge. `docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md` |
| [ADR-012] | ADR-012: Tsingou as Visualization Platform. `docs/tsingou/adr/ADR-012-visualization-focused-platform.md` |
| [ADR-013] | ADR-013: Eight Analysis Techniques. `docs/tsingou/adr/ADR-013-analysis-techniques.md` |

### TSG.1.14.6 Project References

| Key | Reference |
|-----|-----------|
| [NWWRLD] | aagentah. "nw_wrld — Event-driven visual sequencer." GPL-3.0, v0.5.0-beta. `submodules/nw_wrld/` |
| [TSINGOU-NAMING] | ADR-008: System Named "Tsingou". Named after Mary Tsingou (1928-2023), Los Alamos National Laboratory. |
| [SPEC] | Tsingou System Specification. `docs/tsingou/SPEC.md` |

### TSG.1.14.7 Section Cross-References

| Target Section | Title | Relationship to TSG.1 |
|---------------|-------|----------------------|
| TSG.2 | SIGINT/OSINT Domain Reference | Expands intelligence discipline taxonomy from TSG.1.8 |
| TSG.3 | Intelligence Cycle | Expands 6-phase cycle mapping from TSG.1.8 |
| TSG.4 | Data Fusion Mathematics | Mathematical foundations for multi-INT fusion from TSG.1.1.3 |
| TSG.5 | Competitive Analysis | Detailed comparison of platforms from TSG.1.1.2 |
| TSG.6 | Architecture Overview | Detailed system topology from TSG.1.7 |
| TSG.7 | Signal Pipeline & d2ts | Detailed pipeline architecture from TSG.1.3.2, TSG.1.7.2 |
| TSG.8 | BaseSignal Schema | Detailed schema specification from TSG.1.3.6 |
| TSG.9 | Source Adapter Contract | Detailed adapter specification from TSG.1.7.1 |
| TSG.10 | State Management | Detailed atom-as-state specification from TSG.1.3.3 |
| TSG.11 | NATS Messaging Fabric | Detailed NATS specification from TSG.1.3.5 |
| TSG.12 | STIX 2.1 Data Model | STIX standard detail from TSG.1.10.5 |
| TSG.13 | BaseSignal-STIX Codec | Codec specification from TSG.1.10.5 |
| TSG.14 | TAXII 2.1 Transport | TAXII specification from TSG.1.10.5 |
| TSG.15 | CTI Platform Interop | Platform connectors from TSG.1.10.7 |
| TSG.16 | SDR Hardware Landscape | SDR hardware from TSG.1.10.7 |
| TSG.17 | GNU Radio Bridge | GNU Radio integration from TSG.1.10.7 |
| TSG.18 | SigMF Codec | Signal metadata from TSG.1.10.5 |
| TSG.19 | Spectrum Visualization | RF visualization from TSG.1.8.2 |
| TSG.20 | 4-Layer Rendering Surface | Rendering architecture from TSG.1.3.4 |
| TSG.21 | R3F 3D Scene Layer | WebGL layer from TSG.1.3.4 |
| TSG.22 | visx Data Visualization | SVG layer from TSG.1.3.4 |
| TSG.23 | p5 Generative Layer | Canvas layer from TSG.1.3.4 |
| TSG.24 | DOM Control Layer | DOM layer from TSG.1.3.4 |
| TSG.25 | DSP Foundations | DSP math from TSG.1.8.2 |
| TSG.26 | Differential Dataflow Theory | Dataflow theory from TSG.1.3.2 |
| TSG.27 | Statistical Analysis | Anomaly detection from TSG.1.8.2 |
| TSG.28 | Graph Theory & Link Analysis | Link analysis from TSG.1.8.6 |
| TSG.29 | Information Theory | Information theory from TSG.1.3.2 |
| TSG.30 | Geospatial Mathematics | Geospatial math from TSG.1.8.4 |
| TSG.31 | Analysis Techniques Catalog | Technique catalog from TSG.1.9.4 |
| TSG.32 | Effect-TS Architecture | Effect implementation from TSG.1.3.1 |
| TSG.33 | Palantir Knowledge Graph | Knowledge graph from TSG.1.10.7 |
| TSG.34 | Deployment Topology | Deployment from TSG.1.11 |
| TSG.35 | Error Handling | Error handling from TSG.1.3.1 |
| TSG.36 | EW/SIGINT Doctrine Alignment | Doctrine from TSG.1.6.5 |
| Appendix A | ADR Cross-Reference Index | ADR details from TSG.1.9 |
| Appendix B | Bibliography | Full citations from TSG.1.14 |
| Appendix C | Signal Kind Catalog | Signal kinds from TSG.1.12.1 |
| Appendix D | STIX Mapping Tables | STIX mappings from TSG.1.8.6 |
| Appendix E | Research Document Index | Research inventory from TSG.1.4 |
| Appendix F | Glossary & Acronyms | Term definitions from TSG.1.12 |
