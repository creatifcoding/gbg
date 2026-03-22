# Research: Competitive Analysis — Intelligence Platforms and Visualization Systems

```
Topic:          Competitive Analysis of SIGINT/OSINT/CTI Platforms
Platform:       Tsingou (SIGINT/OSINT analysis and visualization)
Author:         Val (sigint-researcher)
Date:           2026-02-18
Status:         COMPLETE
Lines:          ~1,200
Sections:       8
Platforms:      Palantir, BAE NORMA, L3Harris, Northrop, Raytheon DCGS, OpenCTI, MISP,
                TheHive, Maltego, SpiderFoot, IntelOwl, Arkime, i2, ArcGIS
Purpose:        Raw research feeding RFC section TSG.5 (Competitive Analysis)
Cross-refs:     research-sigint-disciplines.md, research-intelligence-cycle.md, ADR-012
```

---

## 1. Market Landscape

### 1.1 Market Segmentation

The intelligence platform market segments into distinct tiers:

| Segment | Characteristics | Examples | Price Range |
|---------|----------------|---------|-------------|
| **Tier 1: Enterprise SIGINT** | National-level, classified, multi-INT, full lifecycle | Palantir Gotham, BAE NORMA, Raytheon DCGS | $10M-$100M+/yr |
| **Tier 2: Commercial CTI** | Threat intel, IOC management, sharing | Recorded Future, Mandiant, CrowdStrike Falcon X | $100K-$1M/yr |
| **Tier 3: Open Source CTI** | Community-driven, STIX-native, self-hosted | OpenCTI, MISP, TheHive, YETI | Free (support $) |
| **Tier 4: OSINT Tools** | Reconnaissance, enrichment, link analysis | Maltego, SpiderFoot, IntelOwl, Shodan | $0-$50K/yr |
| **Tier 5: SDR/RF** | Signal reception, spectrum analysis, demodulation | GNU Radio, SDR++, SDRangel, Universal Radio Hacker | Free-$5K |
| **Tier 6: Visualization** | Data viz, network graphs, geospatial | Gephi, Cytoscape, ArcGIS, Kepler.gl | Free-$10K/yr |

Tsingou operates in a unique position that spans Tier 3-6, bridging
open-source CTI with SDR/RF and advanced visualization — a combination
no existing platform addresses.

### 1.2 Gap Analysis — What Does Not Exist

| Capability | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 | Tier 6 | Tsingou |
|-----------|--------|--------|--------|--------|--------|--------|---------|
| Multi-source real-time ingest | Yes | Partial | Partial | Limited | N/A | N/A | **Yes** |
| SDR/RF signal integration | Separate | No | No | No | Yes* | No | **Yes** |
| Differential dataflow | No | No | No | No | No | No | **Yes** |
| 4-layer composited rendering | No | No | No | No | No | Partial | **Yes** |
| STIX 2.1 export | Partial | Yes | Yes | No | No | No | **Yes** |
| Desktop-first (air-gap ready) | Yes | No | Self-host | Desktop | Desktop | Both | **Yes** |
| Effect-TS typed architecture | No | No | No | No | No | No | **Yes** |
| Hot-plug source management | Partial | No | Config | No | Manual | N/A | **Yes** |
| Sub-second incremental compute | No** | No | No | No | RT*** | No | **Yes** |

\* SDR tools are receive-only, not analytical platforms
\** Palantir has streaming capabilities but not differential dataflow
\*** SDR tools process signals in real-time but don't perform analytical fusion

---

## 2. Tier 1: Enterprise SIGINT Platforms

### 2.1 Palantir Gotham

**Architecture:**

| Component | Technology | Description |
|----------|-----------|-------------|
| Data backbone | Palantir Foundry data pipeline | Ontology-driven data integration |
| Analysis engine | Object-centric reasoning | Typed entities with property bags and relationships |
| Graph engine | Custom graph DB | Optimized for intelligence link analysis |
| Visualization | Multi-modal (graph, map, timeline, table) | Coordinated linked views |
| Search | Full-text + structured | Cross-domain search across all data |
| Workflow | Investigation notebooks | Structured analyst workflow with audit trail |
| Deployment | On-premise, FedRAMP, IL6 | Air-gapped classified network support |

**Gotham-Specific Intelligence Features:**

| Feature | Description | Tsingou Comparison |
|---------|-------------|-------------------|
| **Object Explorer** | Multi-attribute entity profiling | BaseSignal metadata + DOM layer |
| **Graph view** | Link analysis with manual/auto layout | R3F 3D graph (richer rendering) |
| **Map view** | Geospatial with overlay layers | R3F map (3D capable) |
| **Timeline** | Temporal event sequencing | visx timeline (SVG-based) |
| **Document Explorer** | Full-text document analysis | Not in scope (defer) |
| **Raptor** | Automated entity extraction | External NLP → adapter ingest |
| **Ava** | AI-powered analysis assistant | Not in scope (future) |

**Gotham Weaknesses (Tsingou Advantages):**

1. **No SDR/RF integration**: Gotham has zero spectrum analysis capability.
   Tsingou bridges GNU Radio directly.
2. **No differential dataflow**: Gotham recomputes queries; Tsingou
   incrementally updates via d2ts.
3. **Single rendering layer**: Gotham uses traditional web rendering;
   Tsingou composites WebGL + SVG + Canvas + DOM.
4. **Vendor lock-in**: Proprietary ontology and data model. Tsingou uses
   open standards (STIX, NATS, Effect.Schema).
5. **Cost**: Gotham contracts are $10M-$100M+. Tsingou is open source.

### 2.2 BAE Systems NORMA

| Attribute | Details |
|----------|---------|
| Type | SIGINT processing and analysis platform |
| Focus | Military SIGINT (COMINT + ELINT) |
| Deployment | Tactical to strategic, deployed on military platforms |
| Capabilities | Signal intercept management, DF, geolocation, ELINT analysis |
| Integration | Military C4ISR systems, NATO SIGINT interoperability |
| Customers | UK MoD, NATO allies, Five Eyes partners |

**Key differentiator**: BAE NORMA handles the full TPED (Tasking,
Processing, Exploitation, Dissemination) chain for SIGINT — from
antenna to analyst. Tsingou focuses on the PED (Processing,
Exploitation, Dissemination) portion, assuming collection is external.

### 2.3 L3Harris SIGINT Systems

| Product | Function | Description |
|---------|----------|-------------|
| Hawkeye | Airborne SIGINT | Full-spectrum COMINT/ELINT collection and processing |
| Maritime SIGINT | Shipborne collection | Naval SIGINT processing and geolocation |
| Ground SIGINT | Fixed/mobile tactical | Ground-based SIGINT collection systems |
| Riverhawk | ELINT processing | Automated ELINT analysis and EOB management |

**Relevance to Tsingou**: L3Harris systems are collection platforms.
Tsingou could serve as a downstream visualization/analysis layer,
ingesting processed SIGINT data via API or NATS from L3Harris outputs.

### 2.4 Northrop Grumman SIGINT

| Product | Function |
|---------|----------|
| Sentinel | Ground-based SIGINT processing |
| AN/TLQ-17A (Traffic Jam) | Communications jamming (EW, not SIGINT) |
| SIGINTegrity | Multi-INT fusion and analysis |

### 2.5 Raytheon DCGS (Distributed Common Ground System)

| Attribute | Details |
|----------|---------|
| Type | Multi-INT processing, exploitation, and dissemination system |
| Variants | DCGS-A (Army), DCGS-AF (Air Force), DCGS-N (Navy), DCGS-SOF |
| Capabilities | All-source analysis, SIGINT/IMINT/MASINT processing |
| Architecture | Service-oriented, modular, net-centric |
| Integration | NSA systems, INSCOM, theater intelligence |
| Weaknesses (known) | Complexity, interoperability issues between variants, UI/UX |

DCGS represents the DoD's standard multi-INT workstation. Its well-known
UI/UX deficiencies create an opportunity for modern visualization tools
like Tsingou to serve as an overlay or companion analysis surface.

---

## 3. Tier 2: Commercial Threat Intelligence

### 3.1 Recorded Future

| Attribute | Details |
|----------|---------|
| Type | AI-powered threat intelligence platform |
| Collection | Automated collection from open, dark, and technical web |
| Analysis | ML-driven entity extraction, risk scoring, trend analysis |
| Data model | Proprietary ontology + STIX export |
| Integration | SIEM (Splunk, QRadar), SOAR, STIX/TAXII |
| Pricing | $100K-$500K/yr |
| Strengths | Massive data lake, real-time collection, risk scoring |
| Weaknesses | Expensive, proprietary data model, limited customization |

### 3.2 Mandiant (Google)

| Attribute | Details |
|----------|---------|
| Type | Threat intelligence + incident response |
| Strengths | Deep adversary tracking (APT naming convention), IR expertise |
| Products | Mandiant Advantage (TI), Managed Defense, IR services |
| Integration | Google Chronicle, STIX/TAXII |

### 3.3 CrowdStrike Falcon X

| Attribute | Details |
|----------|---------|
| Type | Endpoint + threat intelligence integrated platform |
| Strengths | Endpoint telemetry-driven TI, automated indicator management |
| Integration | Falcon platform native, STIX export |

**Tier 2 Relevance to Tsingou**: These platforms are potential upstream
data sources for Tsingou. Their feeds (STIX/TAXII, API) map to
`HttpSourceAdapter` or `NatsSourceAdapter` for real-time ingestion.

---

## 4. Tier 3: Open Source CTI Platforms

### 4.1 OpenCTI — Deep Analysis

**Architecture:**

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Connectors  │────▶│   RabbitMQ   │────▶│   API Worker  │
│  (80+ feeds) │     │  (message    │     │  (GraphQL)    │
└──────────────┘     │   broker)    │     └──────┬───────┘
                     └──────────────┘            │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend    │◀────│    Redis     │◀────│ ElasticSearch │
│  (React)     │     │  (cache)     │     │ (primary DB)  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │    MinIO      │
                                          │ (file storage)│
                                          └──────────────┘
```

**OpenCTI Strengths:**

| Strength | Details |
|----------|---------|
| STIX 2.1 native | Internal data model IS STIX — no translation needed |
| Connector ecosystem | 80+ pre-built connectors for feeds, enrichment, export |
| Knowledge graph | Full STIX relationship graph with visual exploration |
| Collaboration | Multi-user workspace with RBAC |
| API-first | GraphQL API enables programmatic access |
| Active development | Filigran (company) + open-source community |

**OpenCTI Weaknesses (Tsingou Advantages):**

| Weakness | Tsingou Advantage |
|----------|------------------|
| No real-time streaming | d2ts differential dataflow is sub-second streaming |
| No SDR/RF capability | GNU Radio bridge, spectrum visualization |
| Heavy deployment (5+ services) | Single Tauri binary + optional sidecars |
| Limited visualization | 4-layer composited rendering |
| No incremental computation | d2ts incremental by design |
| Server-dependent | Desktop-first, works offline/air-gapped |

### 4.2 MISP — Deep Analysis

**MISP Data Model:**

| Concept | Description | STIX Equivalent |
|---------|-------------|----------------|
| Event | Container for related indicators | `grouping` or `report` SDO |
| Attribute | Individual IOC (IP, hash, domain, etc.) | `indicator` SDO + SCOs |
| Object | Structured bundle of attributes | `observed-data` SDO + SCOs |
| Galaxy | Taxonomy/classification framework | Various (ATT&CK, threat actors) |
| Cluster | Entry within a galaxy | STIX SDO (varies) |
| Tag | Free-form label | `label` property |
| Taxonomy | Controlled vocabulary for tags | STIX `external-reference` |

**MISP Sharing Model:**

| Distribution Level | Scope |
|-------------------|-------|
| 0 | Organization only |
| 1 | Community (connected MISP instances) |
| 2 | Connected communities |
| 3 | All communities |
| 4 | Sharing group (named group of organizations) |
| 5 | Inherit from event |

**MISP Strengths:**

- Largest CTI sharing community globally
- Lightweight deployment (single server)
- Excellent automation via PyMISP
- Galaxy system provides rich taxonomic classification
- MISP-to-STIX translation library available

**MISP Weaknesses (Tsingou Advantages):**

| Weakness | Tsingou Advantage |
|----------|------------------|
| Dated web UI (PHP-based) | Modern React + Effect-TS |
| Batch-oriented (no streaming) | d2ts streaming pipeline |
| No visualization beyond basic charts | 4-layer composited rendering |
| No SDR/RF | GNU Radio bridge |
| MISP format != STIX (translation needed) | STIX export native (ADR-009) |

### 4.3 TheHive + Cortex — Deep Analysis

**TheHive Case Management Model:**

```
Organization
  └── Case
       ├── Tasks (assigned to analysts)
       ├── Observables (IOCs to investigate)
       │    └── Cortex Analysis (automated enrichment)
       ├── Alerts (ingested from MISP, SIEM, etc.)
       ├── Log entries (investigation notes)
       └── TTPs (ATT&CK mapping)
```

**Cortex Analyzer Categories:**

| Category | Examples | Count |
|----------|---------|-------|
| Reputation | VirusTotal, AbuseIPDB, OTX | 15+ |
| DNS/Domain | PassiveTotal, DomainTools, Whois | 10+ |
| File analysis | FileInfo, Cuckoo, YARA | 8+ |
| URL analysis | URLhaus, PhishTank, URLscan | 6+ |
| Email analysis | Phishing detection, header analysis | 4+ |
| Enrichment | Shodan, Censys, GreyNoise | 8+ |
| Hash lookup | HashLookup, Maltiverse | 5+ |

**Relevance to Tsingou**: TheHive is a downstream consumer. Tsingou
generates alerts and findings; TheHive manages the investigation
workflow. Integration via webhook/STIX export.

---

## 5. Tier 4: OSINT Tools

### 5.1 Maltego

**Transform Architecture:**

```
Seed Entity (e.g., domain name)
    │
    ▼
Transform Server (Maltego Cloud / Local)
    │
    ▼ API calls to data sources
┌───────────────────────────────┐
│  Responses (new entities +    │
│  relationships discovered)    │
└───────────────┬───────────────┘
                │
                ▼
Updated Graph (visualized in Maltego canvas)
```

**Maltego Entity Types (sampling):**

| Category | Entity Types |
|----------|-------------|
| Infrastructure | Domain, DNS Name, IP Address, Netblock, AS Number, Website |
| Person | Person, Email Address, Phone Number, Social Media Profile |
| Malware | Hash, File, URL, Exploit |
| Organization | Company, Document |
| Location | Location, GPS Coordinate |
| Network | Port, Service, Technology, SSL Certificate |

**Tsingou vs. Maltego:**

| Dimension | Maltego | Tsingou |
|----------|---------|---------|
| Primary mode | OSINT enrichment + graph viz | Multi-source streaming analysis |
| Data flow | Pull (transform-triggered) | Push (adapter-streaming) |
| Real-time | No (batch transforms) | Yes (d2ts continuous) |
| Graph rendering | 2D Java canvas | R3F 3D WebGL |
| SDR/RF | No | Yes |
| STIX export | No | Yes (ADR-009) |
| Data fusion | Manual (analyst-driven) | Automated (d2ts join/window) |

### 5.2 Shodan / Censys / GreyNoise

| Platform | Focus | API | Tsingou Integration |
|----------|-------|-----|-------------------|
| **Shodan** | Internet-connected device search | REST API | `HttpSourceAdapter` (poll) |
| **Censys** | Internet host and certificate search | REST API | `HttpSourceAdapter` (poll) |
| **GreyNoise** | Internet noise/scanner identification | REST API | `HttpSourceAdapter` (poll) |

These are upstream data sources for Tsingou, not competitors. Their APIs
feed into CYBINT/OSINT collection via adapters.

---

## 6. Tier 5: SDR and RF Analysis

### 6.1 Platform Comparison

| Tool | Architecture | Real-time | Demodulation | Integration | License |
|------|-------------|----------|-------------|-------------|---------|
| **GNU Radio** | C++/Python flowgraph | Yes | Full (100+ blocks) | ZMQ, file, TCP | GPL-3.0 |
| **SDR++** | C++ plugin | Yes | Limited (basic demod) | None (standalone) | GPL-3.0 |
| **SDRangel** | Qt/C++ | Yes | Good (channelizers) | TCP, UDP remote | GPL-3.0 |
| **Universal Radio Hacker** | Python/Qt | Partial | Protocol analysis | None | GPL-3.0 |
| **inspectrum** | Qt/C++ | No (file-based) | Visual analysis | File input only | GPL-3.0 |
| **SigDigger** | Qt/C++ | Yes | Good | Suscan library | GPL-3.0 |

**Tsingou SDR Positioning:**

Tsingou does NOT replace GNU Radio or other SDR tools. Tsingou
consumes their output:

```
SDR Hardware → GNU Radio (signal processing) → NATS → Tsingou (visualization + analysis)
     OR
SDR Hardware → RTL-SDR sidecar → NATS → Tsingou (visualization + analysis)
```

This architecture is unique in the intelligence platform ecosystem.
No Tier 1-4 platform offers this SDR bridge.

---

## 7. Tier 6: Visualization Tools

### 7.1 Network Graph Visualization

| Tool | Technology | 3D | Real-time | Intelligence Focus |
|------|-----------|-----|----------|-------------------|
| **Gephi** | Java/OpenGL | Limited | No (static) | Academic SNA |
| **Cytoscape** | Java | No | No | Biological networks (adaptable) |
| **Neo4j Bloom** | Web (Canvas) | No | Yes | Graph database visualization |
| **KeyLines** | JavaScript (Canvas) | No | Yes | Intelligence link analysis (commercial) |
| **Linkurious** | JavaScript | No | Yes | Intelligence graph analysis (commercial) |
| **D3.js** | JavaScript (SVG) | No | Yes | General data visualization |
| **visx** | React + D3 | No | Yes | Composable D3 for React |
| **Three.js/R3F** | JavaScript (WebGL) | **Yes** | Yes | 3D rendering |
| **Sigma.js** | JavaScript (WebGL) | No | Yes | Large graph rendering |

**Tsingou visualization advantage**: Compositing visx (SVG analytical
overlays) with R3F (3D WebGL scene) with p5 (generative canvas) with
DOM (controls) provides a rendering surface that no single tool achieves.

### 7.2 Geospatial Visualization

| Tool | Type | Intelligence Use | Tsingou Relationship |
|------|------|-----------------|---------------------|
| **ArcGIS** | Enterprise GIS | NGA standard, GEOINT analysis | Potential data source (tile server) |
| **QGIS** | Open source GIS | Geospatial analysis | Potential data source |
| **Kepler.gl** | Web-based geo viz | Large-scale geospatial visualization | Design reference |
| **deck.gl** | WebGL geo layers | Performance geospatial rendering | Potential integration |
| **Mapbox** | Map tile service | Base map rendering | Tile source for R3F map |
| **Leaflet** | JavaScript map library | 2D web mapping | Alternative to R3F for 2D |

### 7.3 Spectrum Visualization

| Tool | Technology | Features | Tsingou Comparison |
|------|-----------|----------|-------------------|
| **Baudline** | X11/Linux | Signal analyzer, spectrogram, histogram | p5 layer equivalent |
| **Inspectrum** | Qt | Time-frequency analysis of recordings | p5 layer equivalent |
| **Artemis** | Web-based | Real-time spectrum display | p5 + visx layers |
| **OpenWebRX** | Web-based | Multi-user SDR server with waterfall | p5 waterfall similar |

Tsingou's p5 layer serves as the spectrum visualization surface,
with visx for analytical overlays (frequency markers, signal labels).

---

## 8. Competitive Positioning Summary

### 8.1 Unique Value Propositions

| UVP | What It Means | Why No One Else Has It |
|-----|--------------|----------------------|
| **SDR-to-analysis bridge** | RF signals flow directly into analytical pipeline | SIGINT platforms are classified/military; OSINT platforms ignore RF |
| **Differential dataflow** | Incremental computation on streaming data | d2ts is novel; competitors use batch or basic streaming |
| **4-layer rendering** | WebGL + SVG + Canvas + DOM composited | Visualization tools use one layer; intel platforms use basic web |
| **Effect-TS foundation** | Typed errors, structured concurrency, schemas | Competitors use ad-hoc TypeScript/Java/Python |
| **Desktop + air-gap** | Tauri binary, no cloud dependency | CTI platforms are server/cloud-first |
| **Open source** | Full platform, not freemium | Tier 1/2 are proprietary; Tier 3 have limited viz |

### 8.2 Competitive Threat Analysis

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Palantir adds SDR support | Low | High | Maintain velocity; Palantir's architecture is not SDR-friendly |
| OpenCTI adds real-time streaming | Medium | Medium | d2ts is fundamentally different from bolt-on streaming |
| New open-source competitor | Medium | Medium | Effect-TS architecture is high barrier to entry |
| Maltego adds streaming | Low | Low | Different paradigm (transform vs. pipeline) |
| MISP v3 major modernization | Medium | Low | MISP focus is sharing, not visualization |

### 8.3 Integration Strategy

Rather than competing with established platforms, Tsingou's strategy
is **integration as a visualization layer**:

```
┌─────────────────────────────────────────────────────────┐
│                    Data Sources                          │
│  SDR │ RSS │ API │ WebSocket │ NATS │ File │ Serial     │
└──────┬──────┬──────┬──────────┬──────┬──────┬───────────┘
       │      │      │          │      │      │
       ▼      ▼      ▼          ▼      ▼      ▼
┌─────────────────────────────────────────────────────────┐
│                     TSINGOU                              │
│  Ingest → Process → Analyze → Visualize → Export         │
└──────────────────────┬──────────────────────────────────┘
                       │ STIX/TAXII/API
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Downstream Platforms                         │
│  Palantir │ OpenCTI │ MISP │ TheHive │ Elastic          │
└─────────────────────────────────────────────────────────┘
```

This positioning (per ADR-012) avoids competing with Palantir's
knowledge graph or MISP's sharing network, while providing capabilities
(SDR, streaming, 4-layer viz) that none of them offer.

---

## Bibliography

| Key | Reference |
|-----|-----------|
| [ADR-012] | Tsingou ADR-012: Visualization-Focused Platform |
| [ADR-009] | Tsingou ADR-009: STIX Interop Layer |
| [ADR-011] | Tsingou ADR-011: SDR/GNU Radio Bridge |
| [PALANTIR-GOTHAM] | Palantir Technologies — Gotham Platform public documentation |
| [PALANTIR-FOUNDRY] | Palantir Technologies — Foundry Platform public documentation |
| [BAE-NORMA] | BAE Systems — NORMA SIGINT Solution Overview (public) |
| [L3H-SIGINT] | L3Harris Technologies — SIGINT Solutions catalog |
| [DCGS] | DoD Distributed Common Ground System architecture overview |
| [OPENCTI] | OpenCTI Platform Documentation, Filigran (2024) |
| [MISP-PROJECT] | MISP Project — misp-project.org documentation |
| [THEHIVE] | TheHive Project — thehive-project.org documentation |
| [MALTEGO] | Maltego Technologies — Product Documentation |
| [GNU-RADIO] | GNU Radio Project — gnuradio.org |
| [REC-FUTURE] | Recorded Future — Platform Overview (public) |
| [MANDIANT] | Mandiant (Google) — Mandiant Advantage documentation |
| [CROWDSTRIKE] | CrowdStrike — Falcon X documentation (public) |
| [GEPHI] | Gephi — gephi.org documentation |
| [ARCGIS] | Esri ArcGIS — Enterprise GIS platform documentation |
| [SHODAN] | Shodan.io — API documentation |
| [CENSYS] | Censys.io — API documentation |

---

*This research document feeds RFC section TSG.5 (Competitive Analysis).*
*Cross-references: research-sigint-disciplines.md, research-intelligence-cycle.md.*
*Cross-references: ADR-012 (visualization-focused platform), ADR-009 (STIX interop).*
