# RFC Section TSG.5: Competitive Analysis

```
Section:       TSG.5 — Competitive Analysis
Parent RFC:    Tsingou Platform Specification (TMNL-RFC-002)
Status:        DRAFT
Author:        Val (sigint-researcher)
Created:       2026-02-18
Research Base: research-competitive-analysis.md (8 sections, 14 platforms, 20 references)
```

> This section analyzes the competitive landscape of intelligence analysis,
> visualization, and CTI platforms relevant to Tsingou's positioning. It
> establishes Tsingou's differentiated value propositions, identifies capability
> gaps that Tsingou addresses, and defines normative integration boundaries
> with existing platforms per [ADR-012]. The key words "MUST", "MUST NOT",
> "SHOULD", "SHOULD NOT", and "MAY" are to be interpreted as described in
> [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Scope and Applicability](#1-scope-and-applicability)
2. [Market Segmentation](#2-market-segmentation)
3. [Enterprise SIGINT Platforms (Tier 1)](#3-enterprise-sigint-platforms-tier-1)
4. [Commercial Threat Intelligence (Tier 2)](#4-commercial-threat-intelligence-tier-2)
5. [Open Source CTI Platforms (Tier 3)](#5-open-source-cti-platforms-tier-3)
6. [OSINT and Enrichment Tools (Tier 4)](#6-osint-and-enrichment-tools-tier-4)
7. [SDR and RF Analysis (Tier 5)](#7-sdr-and-rf-analysis-tier-5)
8. [Visualization Platforms (Tier 6)](#8-visualization-platforms-tier-6)
9. [Capability Gap Analysis](#9-capability-gap-analysis)
10. [Tsingou Differentiation](#10-tsingou-differentiation)
11. [Integration Boundary Specification](#11-integration-boundary-specification)
12. [Normative Requirements Summary](#12-normative-requirements-summary)
13. [Bibliography](#13-bibliography)

---

## 1. Scope and Applicability

### 1.1 Purpose

This section provides the competitive context that justifies Tsingou's
architectural decisions — particularly [ADR-012] (visualization-focused
platform), [ADR-009] (STIX interop for CTI integration), and [ADR-011]
(SDR/GNU Radio bridge as a unique differentiator). Understanding what
exists informs what Tsingou builds versus what it defers.

### 1.2 Assessment Methodology

Platforms are evaluated across 15 dimensions:

| # | Dimension | Description |
|---|----------|-------------|
| 1 | Link analysis | Entity relationship graph capabilities |
| 2 | Timeline | Temporal event analysis |
| 3 | Geospatial | Map-based visualization and analysis |
| 4 | STIX native | Native STIX 2.1 data model support |
| 5 | Real-time | Sub-second streaming capability |
| 6 | SDR/RF | Spectrum and radio frequency integration |
| 7 | Customizable viz | Configurable visualization beyond defaults |
| 8 | Open source | Free/open source availability |
| 9 | Multi-source ingest | Concurrent multi-source collection |
| 10 | Streaming | Continuous data processing (not batch) |
| 11 | Anomaly detection | Statistical anomaly detection |
| 12 | Data fusion | Multi-source data fusion/correlation |
| 13 | Desktop-first | Native desktop deployment (air-gap capable) |
| 14 | Typed architecture | Type-safe, schema-validated data model |
| 15 | Cost | Acquisition and operational cost |

---

## 2. Market Segmentation

### 2.1 Six-Tier Intelligence Platform Taxonomy

```
┌───────────────────────────────────────────────────────────┐
│  Tier 1: ENTERPRISE SIGINT ($10M-$100M+/yr)               │
│  Palantir Gotham, BAE NORMA, L3Harris, Raytheon DCGS      │
│  Full lifecycle, classified, national-level                │
├───────────────────────────────────────────────────────────┤
│  Tier 2: COMMERCIAL CTI ($100K-$1M/yr)                     │
│  Recorded Future, Mandiant, CrowdStrike Falcon X           │
│  Threat intelligence feeds, IOC management                 │
├───────────────────────────────────────────────────────────┤
│  Tier 3: OPEN SOURCE CTI (Free + support)                  │
│  OpenCTI, MISP, TheHive/Cortex, YETI                      │
│  Community-driven, STIX-native, self-hosted                │
├───────────────────────────────────────────────────────────┤
│  Tier 4: OSINT TOOLS ($0-$50K/yr)                          │
│  Maltego, SpiderFoot, IntelOwl, Shodan                     │
│  Reconnaissance, enrichment, link analysis                 │
├───────────────────────────────────────────────────────────┤
│  Tier 5: SDR/RF (Free-$5K)                                 │
│  GNU Radio, SDR++, SDRangel, URH                           │
│  Signal reception, spectrum analysis, demodulation          │
├───────────────────────────────────────────────────────────┤
│  Tier 6: VISUALIZATION (Free-$10K/yr)                      │
│  Gephi, Cytoscape, ArcGIS, Kepler.gl, D3.js               │
│  Data viz, network graphs, geospatial rendering            │
└───────────────────────────────────────────────────────────┘

          ┌────────────────────────────────┐
          │         TSINGOU                 │
          │   Spans Tier 3-6 uniquely       │
          │                                 │
          │   Open Source CTI    ✓          │
          │   + SDR/RF Bridge   ✓          │
          │   + 4-Layer Viz     ✓          │
          │   + Differential    ✓          │
          │     Dataflow                    │
          │   + Desktop-first   ✓          │
          └────────────────────────────────┘
```

### 2.2 Tsingou's Unique Position

No existing platform spans Tier 3-6. Tsingou's combination of open-source
CTI capability (Tier 3), SDR integration (Tier 5), and advanced visualization
(Tier 6) with streaming differential dataflow is unprecedented.

---

## 3. Enterprise SIGINT Platforms (Tier 1)

### 3.1 Palantir Gotham — Detailed Assessment

| Dimension | Score (1-5) | Assessment |
|----------|------------|------------|
| Link analysis | 5 | Industry-leading graph analysis, optimized graph DB |
| Timeline | 5 | Full temporal analysis suite |
| Geospatial | 5 | Integrated map with military-grade geospatial |
| STIX native | 3 | Partial STIX support, proprietary ontology primary |
| Real-time | 4 | Streaming capabilities but not differential dataflow |
| SDR/RF | 0 | No spectrum analysis capability |
| Customizable viz | 4 | Configurable dashboards and views |
| Open source | 0 | Fully proprietary |
| Multi-source ingest | 5 | Excellent multi-source pipeline (Foundry) |
| Streaming | 4 | Good streaming but batch-oriented at scale |
| Anomaly detection | 4 | Statistical and ML-based detection |
| Data fusion | 5 | Strongest multi-INT fusion capability |
| Desktop-first | 3 | On-premise deployment, not desktop-native |
| Typed architecture | 4 | Ontology-driven typing |
| Cost | 1 | $10M-$100M+ annual contracts |

**Gotham Weaknesses Exploitable by Tsingou:**

1. **No SDR/RF**: Zero spectrum visualization — Tsingou's GNU Radio bridge
   is a capability Gotham does not offer [ADR-011]
2. **No differential dataflow**: Gotham recomputes; Tsingou incrementally
   updates via d2ts [FLOW-ARCH]
3. **Single rendering paradigm**: Traditional web rendering vs. Tsingou's
   4-layer composited surface (WebGL + SVG + Canvas + DOM)
4. **Vendor lock-in**: Proprietary ontology vs. open STIX/Effect.Schema
5. **Cost**: $10M+ vs. open source

### 3.2 BAE Systems NORMA

| Dimension | Score | Notes |
|----------|-------|-------|
| SIGINT collection | 5 | Full TPED chain from antenna to analyst |
| SIGINT analysis | 4 | Established ELINT/COMINT processing |
| Visualization | 3 | Functional but dated UI |
| Integration | 3 | Military C4ISR focus, NATO interoperable |

**Tsingou Relationship**: Complementary. BAE NORMA handles collection and
initial processing; Tsingou could serve as a modern visualization overlay
consuming NORMA's processed output.

### 3.3 Raytheon DCGS

| Dimension | Score | Notes |
|----------|-------|-------|
| Multi-INT | 4 | Designed for all-source analysis |
| UI/UX | 2 | Well-documented usability issues |
| Interoperability | 3 | Inter-variant issues between Army/AF/Navy |
| Deployment | 4 | Theater-level deployable |

**Tsingou Opportunity**: DCGS UI/UX deficiencies are well-known in the
defense community. A modern visualization surface (Tsingou) consuming
DCGS-processed data could address the "last mile" visualization problem.

---

## 4. Commercial Threat Intelligence (Tier 2)

### 4.1 Platform Comparison

| Capability | Recorded Future | Mandiant | CrowdStrike FX | Tsingou |
|-----------|----------------|---------|----------------|---------|
| Collection scale | Massive (web-scale) | Moderate (IR-driven) | Large (endpoint) | Adapter-dependent |
| AI/ML analysis | Extensive | Moderate | Extensive | d2ts + external |
| STIX export | Yes | Yes | Yes | Yes [ADR-009] |
| Real-time streaming | Good | Limited | Good | **Excellent** (d2ts) |
| SDR/RF | No | No | No | **Yes** |
| Visualization | Dashboard | Report-based | Dashboard | **4-layer composited** |
| Open source | No | No | No | **Yes** |
| Cost | $100K-500K/yr | $200K+/yr | $100K+/yr | **Free** |

### 4.2 Integration Role

**Normative Statement TSG.5-1**: Tier 2 commercial platforms SHOULD be
treated as upstream data sources. Their STIX/TAXII feeds and REST APIs
are prime candidates for `HttpSourceAdapter` ingestion.

| Platform | Integration Method | Adapter |
|---------|-------------------|---------|
| Recorded Future | REST API (STIX) | `HttpSourceAdapter` (poll) |
| Mandiant | REST API | `HttpSourceAdapter` (poll) |
| CrowdStrike | Falcon API (STIX) | `HttpSourceAdapter` (poll) |
| VirusTotal | REST API | `HttpSourceAdapter` (poll) |

---

## 5. Open Source CTI Platforms (Tier 3)

### 5.1 Full Comparison Matrix

| Dimension | OpenCTI | MISP | TheHive | Tsingou |
|----------|---------|------|---------|---------|
| **Link analysis** | Good (graph viz) | Basic | Basic | **Good** (R3F 3D) |
| **Timeline** | Good | Basic | Good | **Good** (visx) |
| **Geospatial** | Basic | Basic | None | **Good** (R3F) |
| **STIX native** | **Full** | Partial (translation) | Partial | Export [ADR-009] |
| **Real-time** | Good | Limited | Good (webhooks) | **Excellent** (d2ts) |
| **SDR/RF** | None | None | None | **Yes** |
| **Customizable viz** | Limited | Limited | Limited | **Excellent** (4-layer) |
| **Open source** | Yes (Apache/EE) | Yes (AGPL) | Yes (AGPL) | **Yes** |
| **Multi-source** | Good (80+ connectors) | Good (feeds) | Limited | **Excellent** (8 adapters) |
| **Streaming** | Limited | None | Webhook-based | **Excellent** (d2ts) |
| **Anomaly detection** | None | None | None | **Good** (d2ts operators) |
| **Data fusion** | Good (STIX graph) | Limited | None | **Good** (d2ts join) |
| **Desktop-first** | No (server) | No (server) | No (server) | **Yes** (Tauri) |
| **Typed architecture** | Partial | No | No | **Yes** (Effect.Schema) |
| **Deployment** | 5+ services (Docker) | 1 service | 3+ services | **1 binary** (Tauri) |

### 5.2 OpenCTI Deep Dive

**Architecture Comparison:**

```
OpenCTI                               Tsingou
──────────────                        ──────────────
ElasticSearch (primary DB)            NATS JetStream (persistence)
Redis (cache)                         effect-atom (reactive state)
RabbitMQ (message broker)             NATS (messaging + persistence)
MinIO (file storage)                  Tauri fs scoping
React frontend                        React + R3F + visx + p5
GraphQL API                           Effect.Service + NATS RPC
80+ connectors                        8 adapter types + hot-plug
Server-dependent                      Desktop-first (Tauri)
```

**What OpenCTI Does Better:**
- STIX-native internal model (Tsingou uses BaseSignal internally)
- Larger connector ecosystem (80+ vs 8 adapter types)
- Mature collaboration features (RBAC, multi-user workspaces)
- Established community and sharing network

**What Tsingou Does Better:**
- Real-time streaming via differential dataflow
- SDR/RF integration (unique capability)
- 4-layer composited visualization
- Desktop deployment without server infrastructure
- Typed architecture with Effect-TS
- Hot-plug source management at runtime

### 5.3 MISP Deep Dive

**Sharing Model — Tsingou Integration:**

**Normative Statement TSG.5-2**: Tsingou SHOULD support export to MISP
via the MISP REST API. Export SHOULD map Tsingou analysis outputs to
MISP Events and Attributes.

| Tsingou Output | MISP Mapping | Method |
|---------------|-------------|--------|
| Analysis session | MISP Event | REST POST `/events` |
| IOC (indicator) | MISP Attribute | REST POST `/attributes` |
| Entity correlation | MISP Object | REST POST `/objects` |
| ATT&CK mapping | MISP Galaxy cluster | REST POST `/tags` |
| TLP marking | MISP Tag | Automatic tag assignment |

### 5.4 TheHive — Downstream Consumer

**Normative Statement TSG.5-3**: Tsingou SHOULD support alert generation
to TheHive for incident response workflow. Alerts SHOULD include:

a) Alert title and description from analysis output
b) Observable list from correlated IOCs
c) Severity based on confidence level
d) TLP marking
e) Source reference (Tsingou session ID)

---

## 6. OSINT and Enrichment Tools (Tier 4)

### 6.1 Maltego Comparison

| Dimension | Maltego | Tsingou |
|----------|---------|---------|
| **Primary mode** | Pull (transform-triggered) | Push (adapter-streaming) |
| **Data flow** | Batch (transform → result) | Continuous (d2ts differential) |
| **Real-time** | No | Yes |
| **Graph rendering** | 2D Java canvas | R3F 3D WebGL |
| **SDR/RF** | No | Yes |
| **STIX export** | No | Yes [ADR-009] |
| **Data fusion** | Manual (analyst-driven) | Automated (d2ts join/window) |
| **Enrichment** | Excellent (100+ transforms) | Defer to Cortex/IntelOwl |

**Key Insight**: Maltego and Tsingou serve different analyst workflows.
Maltego excels at OSINT reconnaissance (pull-based discovery); Tsingou
excels at continuous monitoring and streaming analysis (push-based).

### 6.2 Enrichment Ecosystem Integration

**Normative Statement TSG.5-4**: Tsingou SHOULD NOT replicate enrichment
capabilities provided by established tools. Instead, Tsingou SHOULD
integrate with enrichment services:

| Enrichment Need | Defer To | Integration Method |
|----------------|---------|-------------------|
| IOC reputation | VirusTotal, AbuseIPDB, OTX | HTTP API → `HttpSourceAdapter` |
| Domain intelligence | PassiveTotal, DomainTools | HTTP API → `HttpSourceAdapter` |
| IP intelligence | Shodan, Censys, GreyNoise | HTTP API → `HttpSourceAdapter` |
| Malware analysis | Cuckoo, Any.Run | HTTP API or NATS |
| Automated enrichment pipeline | Cortex, IntelOwl | HTTP API → `HttpSourceAdapter` |

---

## 7. SDR and RF Analysis (Tier 5)

### 7.1 SDR Tool Comparison

| Tool | Real-time | Demod | Analysis | Integration | Tsingou Role |
|------|----------|-------|---------|-------------|-------------|
| **GNU Radio** | Yes | Full (300+ blocks) | Signal processing | ZMQ, TCP, file | **Upstream processor** |
| **SDR++** | Yes | Basic | Reception | None | N/A (standalone) |
| **SDRangel** | Yes | Good | Channelizing | TCP/UDP | Potential upstream |
| **URH** | Partial | Protocol | Protocol analysis | File | N/A (analysis tool) |
| **inspectrum** | No | Visual | File-based analysis | File | N/A (offline tool) |

### 7.2 Tsingou SDR Architecture

**Normative Statement TSG.5-5**: Tsingou's SDR integration MUST follow
the architecture defined in [ADR-011]:

```
SDR Hardware                GNU Radio Sidecar            NATS              Tsingou
────────────               ──────────────────           ──────            ────────
RTL-SDR      ─┐
HackRF       ─┤           ┌─────────────────┐
USRP         ─┼──────────▶│  GNU Radio       │
LimeSDR      ─┤           │  Flowgraph       │
BladeRF      ─┘           │                  │
                           │  Decimation      │
                           │  Channelizing    │──────▶ tsingou.signal.sdr.fft.{dev}
                           │  FFT             │──────▶ tsingou.signal.sdr.iq.{dev}
                           │  Demodulation    │──────▶ tsingou.signal.sdr.decoded.{dev}
                           │  PDW Extraction  │──────▶ tsingou.signal.sdr.pdw.{dev}
                           │                  │──────▶ tsingou.signal.sdr.waterfall.{dev}
                           └─────────────────┘
```

**Key Differentiator**: No Tier 1-4 intelligence platform provides this
SDR-to-analysis bridge. Enterprise SIGINT (Tier 1) platforms handle RF
natively but are classified/military-only and cost $10M+. Open-source
CTI (Tier 3) platforms have zero RF capability. Tsingou bridges this gap.

### 7.3 SDR Visualization Mapping

| SDR Data Type | NATS Subject | Rendering Layer | Visualization |
|--------------|-------------|-----------------|---------------|
| FFT spectrum | `.sdr.fft.*` | p5 (z:2 Canvas) | Real-time frequency power plot |
| Waterfall | `.sdr.waterfall.*` | p5 (z:2 Canvas) | Time × frequency × power heatmap |
| IQ samples | `.sdr.iq.*` | p5 (z:2 Canvas) | Constellation diagram, eye diagram |
| Decoded data | `.sdr.decoded.*` | DOM (z:3 React) | Protocol decode display |
| PDW stream | `.sdr.pdw.*` | visx (z:1 SVG) | Parametric scatter plots |

Cross-reference: SDR hardware in TSG.16. GNU Radio bridge in TSG.17.
SigMF codec in TSG.18. Spectrum visualization in TSG.19.

---

## 8. Visualization Platforms (Tier 6)

### 8.1 Network Graph Comparison

| Tool | Technology | 3D | WebGL | Real-time | Max Nodes | Tsingou Comparison |
|------|-----------|-----|-------|----------|-----------|-------------------|
| Gephi | Java/OpenGL | Limited | No | No | 100K+ | Offline analysis tool |
| Cytoscape | Java | No | No | No | 50K | Biological focus |
| Sigma.js | JS/WebGL | No | **Yes** | Yes | 500K+ | 2D only, no compositing |
| KeyLines | JS/Canvas | No | No | Yes | 50K | Commercial, 2D |
| D3.js/visx | JS/SVG | No | No | Yes | 10K | Used in Tsingou z:1 layer |
| R3F/Three.js | JS/WebGL | **Yes** | **Yes** | Yes | 100K+ | Used in Tsingou z:0 layer |
| deck.gl | JS/WebGL | Limited | **Yes** | Yes | 1M+ | Geospatial focus |

**Tsingou Visualization Architecture Advantage:**

No single visualization tool provides all four rendering paradigms. Tsingou
composites them:

```
┌─────────────────────────────────────────────┐
│               Rendering Surface              │
│                                              │
│  z:0  R3F (React Three Fiber)               │
│       └─ WebGL 3D: graphs, maps, topology   │
│                                              │
│  z:1  visx (D3 composable)                  │
│       └─ SVG: timelines, charts, overlays   │
│                                              │
│  z:2  p5 (via @p5-wrapper/react)            │
│       └─ Canvas: spectrum, waterfall, gen.  │
│                                              │
│  z:3  DOM (React + framer-motion)           │
│       └─ HTML: controls, text, annotations  │
│                                              │
└─────────────────────────────────────────────┘
```

This composited approach enables:
- 3D network topology (R3F) with analytical overlays (visx)
- Spectrum waterfall (p5) with measurement annotations (DOM)
- Geospatial map (R3F) with statistical heatmap overlay (visx)
- Any combination of rendering paradigms for any analysis technique

### 8.2 Geospatial Comparison

| Tool | Type | 3D | Real-time | Intelligence Focus | Tsingou Integration |
|------|------|-----|----------|-------------------|-------------------|
| ArcGIS | Enterprise GIS | Yes | Limited | NGA standard | Tile source |
| QGIS | Desktop GIS | Limited | No | General GIS | Data export |
| Kepler.gl | Web geo viz | 3D deck.gl | Yes | Large-scale viz | Design reference |
| Mapbox | Tile service | 3D | Yes | Base maps | Tile source for R3F |
| Leaflet | JS map lib | No | Yes | 2D mapping | Alternative for simple maps |

**Normative Statement TSG.5-6**: Tsingou SHOULD use tile-based map
services (Mapbox, OSM) for base map rendering in the R3F layer rather
than implementing a GIS engine.

---

## 9. Capability Gap Analysis

### 9.1 Cross-Tier Gap Matrix

The following matrix identifies capabilities that NO existing platform
provides, which Tsingou addresses:

| Capability Gap | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 | Tier 6 | Tsingou |
|---------------|--------|--------|--------|--------|--------|--------|---------|
| SDR → intelligence pipeline | Classified | No | No | No | Yes* | No | **Yes** |
| Differential dataflow | No | No | No | No | No | No | **Yes** |
| 4-layer composited rendering | No | No | No | No | No | Partial** | **Yes** |
| Open-source + desktop + SDR + STIX | No | No | No | No | No | No | **Yes** |
| Hot-plug multi-source + streaming | Partial | No | No | No | No | No | **Yes** |
| Effect-TS typed pipeline | No | No | No | No | No | No | **Yes** |

\* Tier 5 tools process RF signals but do not provide intelligence analysis
\** Tier 6 tools use individual rendering paradigms, not composited

### 9.2 Gap Significance Assessment

| Gap | Significance | Why It Matters |
|-----|-------------|---------------|
| SDR → intelligence | **High** | Bridges SIGINT collection tools with analysis platforms |
| Differential dataflow | **High** | Enables sub-second incremental analysis on streaming data |
| 4-layer rendering | **Medium** | Richer analytical visualization than any single layer |
| Desktop + open source + SDR | **High** | Enables classified/air-gapped SIGINT analysis without enterprise contracts |
| Hot-plug streaming | **Medium** | Operational agility during live investigations |
| Typed architecture | **Medium** | Architectural quality, runtime safety, developer experience |

---

## 10. Tsingou Differentiation

### 10.1 Unique Value Propositions

**UVP 1: SDR-to-Analysis Bridge**

Tsingou is the only open-source platform that bridges SDR/RF signal
processing (GNU Radio) to intelligence analysis and visualization.
Enterprise SIGINT platforms (Tier 1) handle RF natively but cost $10M+
and require security clearances. CTI platforms (Tier 3) ignore RF entirely.

**UVP 2: Differential Dataflow**

d2ts provides incremental computation on streaming data — when new signals
arrive, only the affected portion of the analysis graph recomputes. No
other intelligence platform uses this paradigm.

**UVP 3: 4-Layer Composited Rendering**

The composited rendering surface (WebGL + SVG + Canvas + DOM) provides
visualization capabilities that exceed any single-paradigm platform.

**UVP 4: Desktop-First Air-Gap Readiness**

Tauri's single-binary deployment with sidecar daemons enables operation
in classified/air-gapped environments without cloud infrastructure — a
critical requirement for SIGINT work.

**UVP 5: Effect-TS Architectural Foundation**

Typed errors, structured concurrency, Effect.Schema validation, and
service composition provide architectural rigor absent in Python/Java/PHP
CTI tools.

### 10.2 Competitive Threat Assessment

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Palantir adds SDR support | Low | High | Architecture not SDR-friendly; maintain velocity |
| OpenCTI adds streaming | Medium | Medium | d2ts is fundamentally different from bolt-on streaming |
| New competitor bridges SDR + CTI | Medium | High | Effect-TS architecture is high barrier to replicate |
| MISP v3 major modernization | Medium | Low | MISP focus is sharing, not viz |
| Commercial SDR tools add analysis | Low | Medium | Commercial tools optimize for RF, not intelligence |

---

## 11. Integration Boundary Specification

### 11.1 Own vs. Defer Matrix

**Normative Statement TSG.5-7**: Tsingou's integration strategy follows
the own-vs-defer principle established in [ADR-012]:

| Capability | Own/Defer | Defer To | Integration Method |
|-----------|----------|---------|-------------------|
| Signal visualization | **OWN** | — | Core capability |
| Streaming analysis | **OWN** | — | d2ts pipeline |
| Source adapter management | **OWN** | — | AdapterManager service |
| STIX 2.1 export | **OWN** | — | BaseSignal-STIX codec |
| SDR bridge | **OWN** | — | GNU Radio → NATS → adapter |
| Knowledge graph (scale) | **DEFER** | Palantir, Neo4j | STIX export, API push |
| Indicator sharing | **DEFER** | MISP | REST API export |
| Incident response | **DEFER** | TheHive | Alert API |
| Automated enrichment | **DEFER** | Cortex, IntelOwl | HTTP API |
| Full-text search | **DEFER** | Elastic/OpenSearch | API integration |
| Signal collection | **DEFER** | GNU Radio, SDR tools | Sidecar architecture |
| Cryptanalysis | **DEFER** | Specialized tools | Not in scope |
| GIS analysis | **DEFER** | ArcGIS, QGIS | Tile consumption |
| ML model training | **DEFER** | External ML platforms | Model inference via API |

### 11.2 Integration Architecture

**Normative Statement TSG.5-8**: Tsingou MUST support the following
integration patterns:

```
┌──────────────────────────────────────────────────────────────┐
│                     UPSTREAM SOURCES                          │
│                                                               │
│  Tier 2 Feeds    Tier 3 Exports    Tier 4 Results    Tier 5  │
│  (STIX/API)      (STIX/MISP)      (JSON/API)        (NATS)  │
│       │               │                │               │     │
│       ▼               ▼                ▼               ▼     │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              TSINGOU ADAPTERS                        │     │
│  │  HttpAdapter  │  NatsAdapter  │  RssAdapter  │ ...  │     │
│  └──────────────────────┬──────────────────────────────┘     │
│                         │                                     │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              TSINGOU PIPELINE (d2ts)                  │    │
│  │  Ingest → Process → Analyze → Visualize               │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         │                                     │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              DOWNSTREAM EXPORT                        │    │
│  │  STIX/TAXII │ MISP API │ TheHive Alert │ SIEM/syslog │    │
│  └──────────────────────────────────────────────────────┘    │
│                         │                                     │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              DOWNSTREAM CONSUMERS                     │    │
│  │  Palantir │ OpenCTI │ MISP │ TheHive │ Elastic │ SIEM│    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 11.3 Integration Protocol Requirements

| Integration Type | Protocol | Format | Requirement Level |
|-----------------|----------|--------|------------------|
| CTI feed ingestion | HTTPS/TAXII | STIX 2.1 | MUST |
| CTI platform export | HTTPS/TAXII | STIX 2.1 | MUST |
| SDR data ingestion | NATS | Custom (FFT, PDW, IQ) | MUST (if SDR) |
| MISP export | HTTPS REST | MISP format or STIX | SHOULD |
| TheHive alerts | HTTPS REST | TheHive alert JSON | SHOULD |
| SIEM integration | NATS → syslog | CEF, STIX | MAY |
| Enrichment services | HTTPS REST | JSON | SHOULD |

---

## 12. Normative Requirements Summary

| ID | Requirement | Level | Section |
|----|------------|-------|---------|
| TSG.5-1 | Treat Tier 2 platforms as upstream data sources | SHOULD | 4.2 |
| TSG.5-2 | MISP export support | SHOULD | 5.3 |
| TSG.5-3 | TheHive alert generation (5 fields) | SHOULD | 5.4 |
| TSG.5-4 | Defer enrichment to established tools | SHOULD NOT replicate | 6.2 |
| TSG.5-5 | SDR integration per ADR-011 architecture | MUST (if SDR) | 7.2 |
| TSG.5-6 | Tile-based map services for base maps | SHOULD | 8.2 |
| TSG.5-7 | Own-vs-defer integration boundaries | MUST | 11.1 |
| TSG.5-8 | Upstream/downstream integration patterns | MUST | 11.2 |

---

## 13. Bibliography

| Key | Reference |
|-----|-----------|
| [RFC2119] | RFC 2119 — Key words for use in RFCs to Indicate Requirement Levels |
| [RFC8174] | RFC 8174 — Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words |
| [ADR-009] | Tsingou ADR-009: STIX Interop Layer |
| [ADR-011] | Tsingou ADR-011: SDR/GNU Radio Bridge |
| [ADR-012] | Tsingou ADR-012: Visualization-Focused Platform |
| [FLOW-ARCH] | Tsingou Flow Architecture Document |
| [PALANTIR-GOTHAM] | Palantir Technologies — Gotham Platform (public documentation) |
| [BAE-NORMA] | BAE Systems — NORMA SIGINT Solution (public overview) |
| [DCGS] | DoD Distributed Common Ground System overview |
| [OPENCTI] | OpenCTI Platform Documentation, Filigran (2024) |
| [MISP-PROJECT] | MISP Project — misp-project.org (2024) |
| [THEHIVE] | TheHive Project — thehive-project.org (2024) |
| [MALTEGO] | Maltego Technologies — Product Documentation |
| [GNU-RADIO] | GNU Radio Project — gnuradio.org |
| [REC-FUTURE] | Recorded Future — Platform Overview |
| [MANDIANT] | Mandiant (Google) — Advantage Platform |
| [CROWDSTRIKE] | CrowdStrike — Falcon X |
| [TSG.2] | RFC Section TSG.2: SIGINT/OSINT Domain Reference |
| [TSG.3] | RFC Section TSG.3: Intelligence Cycle |
| [TSG.16] | RFC Section TSG.16: SDR Hardware Landscape |
| [TSG.17] | RFC Section TSG.17: GNU Radio Bridge |
| [TSG.19] | RFC Section TSG.19: Spectrum Visualization |

---

*TSG.5 — Competitive Analysis. 8 normative statements.*
*Cross-references: TSG.2 (SIGINT Domain), TSG.3 (Intelligence Cycle),*
*TSG.16/17/19 (SDR), ADR-009/011/012.*
