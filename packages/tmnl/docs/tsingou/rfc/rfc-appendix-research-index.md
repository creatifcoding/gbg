# Appendix E: Research Document Index

```
Document:     rfc-appendix-research-index.md
Section:      Appendix E
Title:        Research Document Index
Status:       COMPLETE
Author:       Val (arch-reviewer-3)
Created:      2026-02-18
Purpose:      Comprehensive index of all research files supporting TMNL-RFC-002
Location:     docs/tsingou/research/
Total Files:  21
Total Lines:  17,991
```

> This appendix catalogs every research document in `docs/tsingou/research/`. Each
> entry includes the filename, line count, purpose summary, RFC sections it feeds,
> and key findings. Research documents are the raw investigation artifacts that
> informed the normative RFC sections.

---

## Table of Contents

1. [E.1 Overview](#e1-overview)
2. [E.2 Research Document Catalog](#e2-research-document-catalog)
   1. [E.2.1 research-sigint-disciplines.md](#e21-research-sigint-disciplinesmd)
   2. [E.2.2 research-intelligence-cycle.md](#e22-research-intelligence-cyclemd)
   3. [E.2.3 research-ew-doctrine.md](#e23-research-ew-doctrinemd)
   4. [E.2.4 research-competitive-analysis.md](#e24-research-competitive-analysismd)
   5. [E.2.5 research-stix-sdo-catalog.md](#e25-research-stix-sdo-catalogmd)
   6. [E.2.6 research-taxii-protocol.md](#e26-research-taxii-protocolmd)
   7. [E.2.7 research-cti-platforms.md](#e27-research-cti-platformsmd)
   8. [E.2.8 research-sdr-hardware-ecosystem.md](#e28-research-sdr-hardware-ecosystemmd)
   9. [E.2.9 research-gnu-radio-architecture.md](#e29-research-gnu-radio-architecturemd)
   10. [E.2.10 research-protocol-decoders.md](#e210-research-protocol-decodersmd)
   11. [E.2.11 research-spectrum-visualization.md](#e211-research-spectrum-visualizationmd)
   12. [E.2.12 research-dsp-foundations.md](#e212-research-dsp-foundationsmd)
   13. [E.2.13 research-differential-dataflow.md](#e213-research-differential-dataflowmd)
   14. [E.2.14 research-graph-theory.md](#e214-research-graph-theorymd)
   15. [E.2.15 research-data-fusion-math.md](#e215-research-data-fusion-mathmd)
   16. [E.2.16 research-information-theory.md](#e216-research-information-theorymd)
   17. [E.2.17 research-statistical-analysis.md](#e217-research-statistical-analysismd)
   18. [E.2.18 research-geospatial-math.md](#e218-research-geospatial-mathmd)
   19. [E.2.19 research-palantir-integration.md](#e219-research-palantir-integrationmd)
   20. [E.2.20 research-effect-architecture.md](#e220-research-effect-architecturemd)
   21. [E.2.21 research-error-handling.md](#e221-research-error-handlingmd)
3. [E.3 Research-to-RFC Traceability Matrix](#e3-research-to-rfc-traceability-matrix)
4. [E.4 Research Coverage Analysis](#e4-research-coverage-analysis)
5. [E.5 Author Attribution](#e5-author-attribution)
6. [E.6 Research Methodology](#e6-research-methodology)

---

## E.1 Overview

The research corpus comprises 21 documents totaling 17,991 lines. These documents
were authored during the Tsingou RFC development sprint (2026-02-18) by domain
specialists operating under the Val architecture team. Each document serves as
the raw investigation artifact feeding one or more normative RFC sections.

### E.1.1 Corpus Statistics

| Metric | Value |
|--------|-------|
| **Total research files** | 21 |
| **Total lines** | 17,991 |
| **Average lines per file** | 857 |
| **Largest file** | research-stix-sdo-catalog.md (2,320 lines) |
| **Smallest file** | research-palantir-integration.md (323 lines) |
| **Median file size** | 658 lines |
| **RFC sections covered** | 28 of 36 |
| **Unique authors** | 6 specialist personas |

### E.1.2 Size Distribution

```
research-stix-sdo-catalog.md        ████████████████████████  2,320
research-gnu-radio-architecture.md   ███████████████          1,478
research-taxii-protocol.md           █████████████            1,245
research-sigint-disciplines.md       ████████████             1,197
research-dsp-foundations.md          ███████████              1,127
research-geospatial-math.md         ███████████              1,083
research-cti-platforms.md            ███████████              1,056
research-sdr-hardware-ecosystem.md   ██████████               1,019
research-effect-architecture.md      █████████                  891
research-intelligence-cycle.md       █████████                  842
research-graph-theory.md             ███████                    664
research-differential-dataflow.md    ███████                    658
research-protocol-decoders.md        ██████                     633
research-information-theory.md       ██████                     589
research-spectrum-visualization.md   ██████                     553
research-competitive-analysis.md     █████                      527
research-ew-doctrine.md              █████                      507
research-data-fusion-math.md         █████                      470
research-statistical-analysis.md     ████                       428
research-error-handling.md           ████                       381
research-palantir-integration.md     ███                        323
```

---

## E.2 Research Document Catalog

---

### E.2.1 research-sigint-disciplines.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-sigint-disciplines.md` |
| **Lines** | 1,197 |
| **Author** | sigint-researcher (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.2 (SIGINT/OSINT Domain Reference) |
| **Cross-refs** | research-intelligence-cycle.md, research-ew-doctrine.md |

#### Summary

Comprehensive reference on the full spectrum of intelligence disciplines relevant to
Tsingou. Catalogs SIGINT sub-disciplines (COMINT, ELINT, FISINT), CYBINT/DNINT,
MASINT, GEOINT, and OSINT. For each discipline, the document defines:
- Formal definition per Joint Publication standards
- Collection methods and sensor types
- Data formats and signal characteristics
- Tsingou adapter mapping and BaseSignal kind assignments
- Classification and handling requirements

#### Key Findings

1. **SIGINT sub-discipline taxonomy**: COMINT (communications metadata), ELINT (radar
   parameters), and FISINT (telemetry) map to distinct BaseSignal kinds with
   different schema extensions.

2. **OSINT dominance**: Open-source intelligence represents the largest volume of
   signals Tsingou will ingest (RSS, social media, web scraping), requiring
   dedicated rate limiting and deduplication in the source adapter layer.

3. **CYBINT/DNINT convergence**: Cyber intelligence and digital network intelligence
   are converging disciplines; Tsingou maps both through the STIX 2.1 interop layer
   using cyber-observable objects (SCOs).

4. **MASINT gap**: Measurement and Signature Intelligence (radar cross-section,
   acoustic signatures) has limited open-source sensor availability. Tsingou
   supports it as a future extension via the SigMF codec.

5. **Classification sensitivity**: COMINT and ELINT products are classified by
   default per EO 12333. Tsingou operates exclusively on unclassified or
   simulated data for development purposes.

#### Sections

1. SIGINT Overview
2. COMINT — Communications Intelligence
3. ELINT — Electronic Intelligence
4. FISINT — Foreign Instrumentation Signals Intelligence
5. CYBINT/DNINT — Cyber/Digital Network Intelligence
6. MASINT — Measurement and Signature Intelligence
7. GEOINT — Geospatial Intelligence
8. OSINT — Open Source Intelligence
9. Cross-Discipline Integration
10. Tsingou Adapter Mapping

---

### E.2.2 research-intelligence-cycle.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-intelligence-cycle.md` |
| **Lines** | 842 |
| **Author** | sigint-researcher (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.3 (Intelligence Cycle) |
| **Cross-refs** | research-sigint-disciplines.md, research-data-fusion-math.md, ADR-010, ADR-013 |

#### Summary

Research on the six-phase intelligence cycle (Direction, Collection, Processing,
Exploitation, Analysis, Dissemination) and how each phase maps to concrete Tsingou
subsystems. Incorporates the TPED/TCPED operational model, ICD 203 analytic
standards, and structured analytic techniques (ACH, I&W analysis, Diamond Model,
Cyber Kill Chain).

#### Key Findings

1. **Six-phase mapping completeness**: Every intelligence cycle phase maps to at
   least one Tsingou subsystem: Direction (Session Config), Collection (8 Source
   Adapters), Processing (Schema validation + normalization), Exploitation (d2ts
   derived graph), Analysis (8 analysis techniques), Dissemination (STIX export +
   NATS fan-out).

2. **TPED vs TCPED**: Traditional TPED (Tasking, Processing, Exploitation,
   Dissemination) is being replaced by TCPED (adding Collection). Tsingou supports
   the full TCPED model through its adapter-pipeline-bridge architecture.

3. **ICD 203 compliance**: Tsingou implements probability language annotations
   conforming to the Intelligence Community Directive 203 five-tier confidence
   scale (remote, unlikely, roughly even chance, likely, very likely).

4. **Structured Analytic Techniques**: Eight techniques map to Tsingou's analysis
   catalog (ADR-013): temporal analysis, frequency analysis, correlation analysis,
   geospatial analysis, graph/link analysis, anomaly detection, pattern recognition,
   and signal classification.

5. **Automation boundary**: Tsingou automates Collection through Analysis but
   preserves human agency at Direction and Dissemination per Endsley's situation
   awareness model and out-of-the-loop research.

#### Sections

1. Intelligence Cycle — Six Phases
2. TPED/TCPED Operational Model
3. ICD 203 Analytic Standards
4. Structured Analytic Techniques
5. Platform Ecosystem Integration

---

### E.2.3 research-ew-doctrine.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-ew-doctrine.md` |
| **Lines** | 507 |
| **Author** | ew-doctrine-advisor (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.36 (EW/SIGINT Doctrine Alignment) |
| **Cross-refs** | research-sigint-disciplines.md, research-intelligence-cycle.md |

#### Summary

Raw research on professional Electronic Warfare (EW) doctrine and the Electromagnetic
Spectrum Operations (EMSO) community. Covers the Association of Old Crows (AOC),
U.S. Army Cyber Center of Excellence, Joint Publication 3-85, CEMA (Cyber
Electromagnetic Activities), and Multi-Domain Operations.

#### Key Findings

1. **AOC as community anchor**: The Association of Old Crows (AOC) is the premier
   global EW professional body with ~14,000 members across 70+ chapters in 19
   countries. The Journal of Electromagnetic Dominance (JED) is the publication
   of record.

2. **JP 3-85 as doctrinal foundation**: Joint Publication 3-85 (May 2020) defines
   the three pillars of EW: Electronic Attack (EA), Electronic Protection (EP),
   and Electronic Warfare Support (ES). Tsingou implements ES capabilities.

3. **CEMA integration**: FM 3-12 (August 2021) establishes Cyber Electromagnetic
   Activities as the Army's convergence of cyber, EW, and spectrum management.
   CEMA cells at brigade level and above coordinate these activities.

4. **EMBM interest**: DISA awarded Palantir a prototype contract for Electromagnetic
   Battle Management (EMBM), indicating DoD operational interest in software-based
   spectrum monitoring. Tsingou occupies a complementary niche focused on
   visualization rather than C2 (command and control).

5. **EWIRDB modernization**: The Electronic Warfare Integrated Reprogramming
   Database (EWIRDB) is being modernized. Traditional reprogramming cycles of
   3 weeks to 3 months are being compressed. Tsingou's runtime-updateable
   SchemaRegistry (NATS KV) addresses this need.

#### Sections

1. Association of Old Crows (AOC)
2. U.S. Army Cyber Center of Excellence
3. JP 3-85 and EMSO Doctrine
4. CEMA Cell Structure and FM 3-12
5. Multi-Domain Operations Context
6. EMBM and Software-Based Spectrum Monitoring
7. EWIRDB and Reprogramming Cycles
8. Tsingou Doctrine Alignment

---

### E.2.4 research-competitive-analysis.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-competitive-analysis.md` |
| **Lines** | 527 |
| **Author** | sigint-researcher (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.5 (Competitive Analysis) |
| **Cross-refs** | research-sigint-disciplines.md, research-intelligence-cycle.md, ADR-012 |

#### Summary

Market landscape analysis covering defense primes (Palantir, BAE NORMA, L3Harris,
Northrop Grumman, Raytheon), government systems (DCGS), open-source CTI platforms
(OpenCTI, MISP, TheHive), and commercial intelligence tools (Maltego, SpiderFoot,
IntelOwl, Recorded Future, Mandiant, CrowdStrike). For each platform, the document
assesses capabilities, architecture, licensing, and Tsingou's differentiation.

#### Key Findings

1. **Visualization gap**: No existing open-source platform combines real-time
   SDR signal visualization with CTI graph analysis. Tsingou fills this gap
   by bridging the SDR domain (GNU Radio, SigMF) with the CTI domain (STIX,
   TAXII) through a unified 4-layer rendering surface.

2. **Palantir as enterprise benchmark**: Palantir Gotham is the de facto standard
   for defense intelligence analysis. Tsingou's Palantir integration (TSG.33)
   positions it as a complementary visualization frontend rather than a competitor.

3. **Open-source CTI fragmentation**: The CTI platform ecosystem (OpenCTI, MISP,
   TheHive, Cortex) lacks unified real-time signal processing. Each platform
   excels in its niche but requires manual data movement between them. Tsingou's
   NATS fabric automates this integration.

4. **Defense prime lock-in**: BAE NORMA, L3Harris, and Raytheon SIGINT solutions
   are hardware-coupled, classified, and vendor-locked. Tsingou targets the
   unclassified training, R&D, and educational markets where these constraints
   don't apply.

5. **14 platforms analyzed**: The research covers 14 platforms across 4 market
   segments, providing a comprehensive competitive landscape.

#### Sections

1. Market Landscape
2. Defense Primes (Palantir, BAE, L3Harris, Northrop, Raytheon)
3. Government Systems (DCGS)
4. Open-Source CTI Platforms (OpenCTI, MISP, TheHive)
5. Commercial Intelligence Tools (Maltego, Recorded Future, Mandiant, CrowdStrike)
6. SDR-Specific Tools
7. Tsingou Differentiation Matrix
8. Gap Analysis

---

### E.2.5 research-stix-sdo-catalog.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-stix-sdo-catalog.md` |
| **Lines** | 2,320 |
| **Author** | stix-specialist (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.12 (STIX 2.1 Data Model), TSG.13 (BaseSignal-STIX Codec) |
| **Source** | OASIS STIX 2.1 Specification (stix-v2.1-os) |

#### Summary

Complete catalog of every STIX 2.1 object type with full property tables, Tsingou
relevance assessments, and example JSON instances. The largest research document
in the corpus, it serves as the definitive internal reference for STIX 2.1
object semantics.

#### Key Findings

1. **Object taxonomy**: STIX 2.1 defines 18 SDO (STIX Domain Object) types,
   18 SCO (STIX Cyber-observable Object) types, 2 SRO (STIX Relationship Object)
   types, and 2 meta-object types (Bundle, Language Content).

2. **Tsingou relevance tiers**: Objects are classified into three relevance tiers:
   - **Tier 1 (Core)**: indicator, observed-data, sighting, malware, attack-pattern,
     infrastructure, network-traffic, ipv4-addr, ipv6-addr, domain-name
   - **Tier 2 (Extended)**: threat-actor, campaign, vulnerability, identity,
     relationship, artifact, file, url
   - **Tier 3 (Reference)**: All remaining types (supported but not primary)

3. **Custom extensions needed**: Five BaseSignal kinds (sdr, serial, midi, osc,
   adsb) lack native STIX 2.1 SCO equivalents. Custom extensions using the
   `extension-definition` mechanism are required.

4. **UUID v5 mapping**: Deterministic STIX ID generation uses UUID v5 (name-based,
   SHA-1) with a Tsingou-specific namespace UUID, enabling bidirectional mapping
   between BaseSignal IDs and STIX IDs.

5. **Property completeness**: The catalog documents 400+ properties across all
   object types, with explicit mappings to BaseSignal fields where applicable.

#### Sections

1. STIX 2.1 Architecture
2. Common Properties
3. SDO Catalog (18 types)
4. SCO Catalog (18 types)
5. SRO Catalog (2 types)
6. Meta-Object Catalog (2 types)
7. Extension Mechanism
8. Tsingou Custom Extensions
9. Relevance Assessment Matrix

---

### E.2.6 research-taxii-protocol.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-taxii-protocol.md` |
| **Lines** | 1,245 |
| **Author** | stix-specialist (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.14 (TAXII 2.1 Transport) |

#### Summary

Exhaustive reference on the TAXII 2.1 transport protocol. Covers all endpoints
(Discovery, API Root, Collections, Objects, Status, Manifest), request/response
formats, pagination, filtering, content negotiation, authentication, and error
handling.

#### Key Findings

1. **REST-based simplicity**: TAXII 2.1 is a RESTful HTTP protocol (unlike TAXII 1.x
   which used SOAP/XML). This simplifies Tsingou's client implementation using
   Effect's @effect/platform HttpClient.

2. **Collection-centric model**: All STIX data flows through named collections.
   Tsingou maps collections to NATS subjects, enabling seamless bridging between
   TAXII HTTP polling and NATS real-time streaming.

3. **Pagination requirements**: TAXII servers MAY paginate responses using the
   `next` parameter in envelopes. Tsingou's client MUST implement pagination
   to handle large collections.

4. **Authentication flexibility**: TAXII 2.1 supports HTTP Basic, API Key, and
   OAuth 2.0 authentication. Tsingou's adapter supports all three, configured
   per connection.

5. **Polling vs streaming**: TAXII 2.1 is polling-based (no WebSocket support).
   Tsingou bridges this gap by converting TAXII polls into NATS publications
   with configurable polling intervals.

#### Sections

1. Protocol Overview
2. Core Concepts
3. Discovery Endpoint
4. API Root Endpoint
5. Collections Endpoint
6. Objects Endpoint (GET, POST, DELETE)
7. Status Endpoint
8. Manifest Endpoint
9. Pagination and Filtering
10. Content Negotiation
11. Authentication and Authorization
12. Error Handling
13. Tsingou Integration Architecture

---

### E.2.7 research-cti-platforms.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-cti-platforms.md` |
| **Lines** | 1,056 |
| **Author** | stix-specialist (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.15 (CTI Platform Interop) |

#### Summary

Deep-dive into the CTI platform ecosystem with detailed architectural analysis
of MISP, OpenCTI, TheHive 5, and Cortex. Covers data models, API surfaces,
STIX/TAXII compliance levels, and integration patterns for each platform.

#### Key Findings

1. **MISP maturity**: MISP is the most widely deployed CTI platform globally with
   the richest taxonomy system. Its native data model (events, attributes,
   objects, galaxies) differs from STIX but has robust STIX 2.1 export/import.

2. **OpenCTI as STIX-native**: OpenCTI is the most STIX 2.1-native open-source
   platform, using STIX as its internal data model. This makes it Tsingou's
   most natural integration partner.

3. **TheHive for SOAR**: TheHive 5 excels at Security Orchestration, Automation,
   and Response (SOAR). Tsingou integrates with TheHive for alert escalation
   and case management, not for raw intelligence data.

4. **Cortex for enrichment**: Cortex provides automated observable analysis
   (IP reputation, domain WHOIS, file hashing) via analyzers. Tsingou can
   submit observables to Cortex and consume enrichment results.

5. **STIX-Shifter for translation**: IBM's STIX-Shifter provides universal
   query translation between STIX patterns and native platform query languages.
   Tsingou MAY use STIX-Shifter for cross-platform querying.

#### Sections

1. CTI Platform Landscape
2. MISP — Malware Information Sharing Platform
3. OpenCTI — Open Cyber Threat Intelligence
4. TheHive 5 — Security Incident Response Platform
5. Cortex — Analysis Engine
6. Integration Patterns
7. STIX Compliance Comparison Matrix

---

### E.2.8 research-sdr-hardware-ecosystem.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-sdr-hardware-ecosystem.md` |
| **Lines** | 1,019 |
| **Author** | sdr-analyst (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.16 (SDR Hardware Landscape), TSG.18 (SigMF Codec) |

#### Summary

Hardware ecosystem analysis covering RTL-SDR v4, HackRF One, Ettus USRP B-series,
LimeSDR, Airspy, and KerberosSDR. For each device, the document details RF
specifications, API surfaces, IQ sample formats, driver requirements, and
SoapySDR compatibility.

#### Key Findings

1. **RTL-SDR as entry point**: The RTL-SDR v4 ($30 USD) provides 24 MHz - 1766 MHz
   reception with 8-bit resolution. Its librtlsdr C API is the most widely
   supported SDR interface. Tsingou's RTL-SDR sidecar targets this device first.

2. **HackRF for wider bandwidth**: HackRF One ($340 USD) offers 1 MHz - 6 GHz
   half-duplex with 20 MHz bandwidth. Its wider frequency range covers military
   bands inaccessible to RTL-SDR.

3. **USRP for professional use**: Ettus USRP B-series ($1,500+ USD) provides
   12-bit resolution, 56 MHz bandwidth, and full-duplex operation. The UHD
   driver is the professional standard.

4. **SoapySDR as abstraction layer**: SoapySDR provides a vendor-neutral API
   across all SDR hardware through dynamically loaded driver modules. Tsingou's
   sidecar architecture benefits from SoapySDR for device abstraction.

5. **IQ format zoo**: SDR devices output IQ samples in different formats (CU8,
   CS8, CS16, CF32). SigMF standardizes metadata describing these formats.
   Tsingou's BaseSignal schema includes `iqFormat` field for disambiguation.

#### Sections

1. RTL-SDR v4
2. HackRF One
3. Ettus USRP B-series
4. LimeSDR
5. Airspy
6. KerberosSDR (coherent multi-channel)
7. SoapySDR Abstraction Layer
8. IQ Sample Format Reference
9. SigMF Integration

---

### E.2.9 research-gnu-radio-architecture.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-gnu-radio-architecture.md` |
| **Lines** | 1,478 |
| **Author** | sdr-analyst (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.17 (GNU Radio Bridge), TSG.25 (DSP Foundations cross-ref) |

#### Summary

Deep architectural analysis of GNU Radio's flow graph model, block types,
threading model, buffer management, and ZMQ integration points. Covers both
GNU Radio 3.x (production) and GNU Radio 4.0 (emerging).

#### Key Findings

1. **Flow graph as DAG**: GNU Radio processes signals through a directed acyclic
   graph (DAG) of blocks connected by typed stream or message links. Blocks
   execute in separate threads scheduled by the GNU Radio runtime.

2. **ZMQ as bridge protocol**: ZeroMQ (ZMQ) PUB/SUB sockets are the recommended
   method for bridging GNU Radio flow graphs to external processes. Tsingou
   uses ZMQ-to-NATS bridging for sidecar integration.

3. **GNU Radio 4.0 evolution**: GR4 introduces a new scheduler, graph DSL, and
   Rust FFI. Tsingou's bridge architecture is designed to support both GR3 and
   GR4 through the transport-agnostic NATS layer.

4. **Block categories**: GNU Radio blocks fall into 5 categories: Sources,
   Sinks, Synchronous (1:1), Decimators (N:1), and Interpolators (1:N). Each
   category has distinct buffer management characteristics.

5. **GRC for flowgraph design**: GNU Radio Companion (GRC) provides a visual
   flowgraph editor generating Python scripts. Tsingou's session configuration
   can specify pre-built flowgraph templates for common SIGINT tasks.

6. **Performance characteristics**: GNU Radio achieves real-time processing at
   sample rates up to 56 Msps (USRP B210 bandwidth) on modern hardware.
   Buffer sizes and thread affinity are tunable per deployment.

#### Sections

1. GNU Radio Flow Graph Model
2. Block Types and Categories
3. Scheduling and Threading
4. Buffer Management
5. Message Passing
6. ZMQ Integration
7. Python Scripting Model
8. GRC Visual Editor
9. GNU Radio 4.0 Preview
10. Performance Characteristics
11. Tsingou Bridge Architecture

---

### E.2.10 research-protocol-decoders.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-protocol-decoders.md` |
| **Lines** | 633 |
| **Author** | sdr-analyst (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.17 (GNU Radio Bridge — protocol integration subsection) |

#### Summary

Reference catalog of RF protocol decoders relevant to Tsingou's SIGINT
visualization capabilities. Covers ADS-B, AIS, POCSAG, P25, DMR, and ISM-band
protocols (via rtl_433).

#### Key Findings

1. **ADS-B (1090 MHz)**: dump1090-fa provides mature Mode S/ADS-B decoding.
   Output is JSON with ICAO hex codes, altitude, speed, position. Maps to
   Tsingou's `adsb` BaseSignal kind.

2. **AIS (161.975/162.025 MHz)**: Automatic Identification System for maritime
   vessels. Decoded via gr-ais or dedicated receivers. Position reports include
   MMSI, latitude/longitude, course, speed.

3. **POCSAG paging**: Decoded by multimon-ng. Still widely used by emergency
   services. Low data rate, easy to decode with RTL-SDR.

4. **P25 digital voice**: OP25 provides Phase 1 and Phase 2 decoding. Used by
   US public safety. Encrypted channels require key management (not in scope
   for Tsingou's visualization layer).

5. **rtl_433 for ISM bands**: Decodes 400+ protocols in ISM bands (315/433/868/915
   MHz). Weather stations, tire pressure monitors, smart meters. Rich metadata
   output in JSON format.

6. **Common output pattern**: All decoders produce structured data (JSON/CSV)
   that maps naturally to BaseSignal schema fields through per-protocol
   transform functions.

#### Sections

1. ADS-B (Automatic Dependent Surveillance — Broadcast)
2. AIS (Automatic Identification System)
3. POCSAG (Paging)
4. P25 (Project 25 Digital Voice)
5. DMR (Digital Mobile Radio)
6. ISM Band Protocols (rtl_433)
7. Common Integration Patterns

---

### E.2.11 research-spectrum-visualization.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-spectrum-visualization.md` |
| **Lines** | 553 |
| **Author** | sdr-analyst (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.19 (Spectrum Visualization) |

#### Summary

Techniques and rendering algorithms for spectrum visualization: waterfall displays,
real-time spectrum analyzers, persistence displays, and color mapping. Covers
both canvas-based and WebGL-based approaches.

#### Key Findings

1. **Waterfall rendering pipeline**: FFT -> magnitude -> color map -> row shift ->
   canvas blit. Each horizontal row represents one FFT frame; time flows
   downward. Optimal performance requires WebGL texture uploads.

2. **Color map selection**: Viridis (perceptually uniform) is recommended for
   general use. Turbo (Google) provides better contrast for weak signals.
   Plasma and inferno are alternatives for specific use cases.

3. **Canvas vs WebGL**: Canvas 2D is sufficient for up to ~30 fps at 1024 FFT
   bins. WebGL is required for higher update rates or larger FFT sizes. p5.js
   WebGL mode provides the bridge.

4. **Persistence display**: Overlay mode that accumulates power levels over time,
   revealing intermittent signals. Implemented as alpha-blended texture
   accumulation in the p5 layer.

5. **Real-time spectrum view**: Frequency-domain view with peak hold, average
   trace, and instantaneous trace. visx provides the 2D charting primitives.

#### Sections

1. Waterfall Display
2. Color Mapping and Perceptual Uniformity
3. Real-Time Spectrum Analyzer
4. Persistence Display
5. Canvas vs WebGL Performance
6. p5.js Integration
7. visx Integration for 2D Charts

---

### E.2.12 research-dsp-foundations.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-dsp-foundations.md` |
| **Lines** | 1,127 |
| **Author** | dsp-specialist (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.25 (DSP Foundations) |

#### Summary

Mathematical foundations for digital signal processing operations in Tsingou.
Full derivations for FFT, windowing, sampling theory, demodulation, filter design,
spectral estimation, and time-frequency analysis with sufficient rigor to justify
the normative requirements in the RFC section.

#### Key Findings

1. **FFT centrality**: The Cooley-Tukey radix-2 FFT reduces O(N^2) DFT to
   O(N log N). All spectrum visualization in Tsingou depends on FFT-based
   spectral analysis. Bluestein's algorithm handles non-power-of-2 sizes.

2. **Window function selection**: Hann window is the general-purpose default.
   Blackman-Harris provides superior sidelobe suppression (-92 dB) for
   narrowband signal detection at the cost of wider main lobe.

3. **Sampling theorem implications**: Shannon-Nyquist theorem (fs > 2B) is
   inviolable. SDR hardware enforces this at the ADC level. Aliasing artifacts
   in visualization indicate incorrect decimation.

4. **Welch's method for PSD**: Overlapping windowed segments with averaging
   reduces variance in power spectral density estimates. 50% overlap with
   Hann window is the standard configuration.

5. **Time-frequency tradeoff**: Heisenberg-Gabor uncertainty principle limits
   simultaneous time and frequency resolution. Wavelet analysis via Mallat's
   filter bank provides multi-resolution decomposition.

6. **CIC filters for decimation**: Cascaded Integrator-Comb filters provide
   efficient high-ratio decimation without multipliers. Essential for
   wideband SDR downconversion.

#### Sections

1. DFT and FFT
2. Window Functions
3. Sampling Theory
4. Demodulation (AM, FM, IQ)
5. FIR and IIR Filter Design
6. Spectral Estimation
7. Time-Frequency Analysis
8. Noise and SNR
9. Implementation Guidelines

---

### E.2.13 research-differential-dataflow.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-differential-dataflow.md` |
| **Lines** | 658 |
| **Author** | diff-dataflow-theorist (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.26 (Differential Dataflow Theory) |

#### Summary

Mathematical foundations of differential dataflow: lattice theory, partially ordered
sets, the collection trace model, incremental view maintenance, and MVCC semantics.
Covers the research lineage from Naiad (SOSP 2013) through McSherry's CIDR 2013
paper to the TypeScript d2ts implementation.

#### Key Findings

1. **Collection-as-multiset-difference**: Differential dataflow represents
   collections as differences (insertions/deletions) over a partially ordered
   time domain. This enables incremental computation where only changes
   propagate through the dataflow graph.

2. **Lattice requirement**: The time domain must form a lattice (every pair of
   elements has a least upper bound and greatest lower bound). Tsingou uses
   product lattices `(tick, source_seq)` for multi-dimensional versioning.

3. **d2ts as TypeScript implementation**: @electric-sql/d2ts brings differential
   dataflow to TypeScript. Tsingou uses d2ts as its signal pipeline core
   (ADR-001), enabling sub-second incremental updates.

4. **CRDT connection**: Differential dataflow's merge semantics are related to
   Conflict-free Replicated Data Types (CRDTs). Both require commutative,
   associative, idempotent merge operators.

5. **MVCC for version management**: Multi-Version Concurrency Control (MVCC)
   enables concurrent reads at different logical times without blocking writers.
   The d2ts frontier mechanism implements this.

#### Sections

1. Historical Context and Lineage
2. Lattice Theory Foundations
3. Collection Trace Model
4. Incremental View Maintenance
5. Arrangement and Indexing
6. Frontier and Progress Tracking
7. CRDT Connections
8. MVCC Semantics
9. d2ts TypeScript Implementation
10. Tsingou Pipeline Architecture

---

### E.2.14 research-graph-theory.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-graph-theory.md` |
| **Lines** | 664 |
| **Author** | graph-theory-specialist (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.28 (Graph Theory & Link Analysis) |

#### Summary

Graph theory and link analysis algorithms for intelligence visualization. Covers
centrality measures, community detection, spectral methods, temporal networks,
and graph layout algorithms relevant to STIX relationship graphs and communication
network analysis.

#### Key Findings

1. **Betweenness centrality for bottleneck detection**: Brandes' algorithm
   computes betweenness centrality in O(VE) time. High betweenness nodes in
   communication graphs indicate brokers or choke points.

2. **Louvain/Leiden for community detection**: Leiden algorithm (2019) improves
   on Louvain's modularity optimization with guaranteed connectivity within
   communities. Essential for identifying threat actor clusters.

3. **PageRank for influence scoring**: PageRank and HITS provide complementary
   influence measures. PageRank identifies globally important nodes; HITS
   distinguishes hubs (nodes linking to many authorities) from authorities
   (nodes linked by many hubs).

4. **Temporal networks**: Intelligence graphs are inherently temporal. Holme and
   Saramaki's temporal network framework enables time-windowed analysis of
   communication patterns.

5. **Force-directed layout**: ForceAtlas2 (Gephi) and d3-force-3d provide
   graph layout for R3F 3D visualization. Layout quality depends on
   parameterization (gravity, repulsion, edge weight).

6. **STIX graph structure**: STIX 2.1 relationships form a directed property
   graph. Tsingou's d2ts derived graph maintains this structure with
   incremental updates as new STIX objects arrive.

#### Sections

1. Graph Fundamentals
2. Centrality Measures (Degree, Betweenness, Closeness, PageRank, HITS, Katz)
3. Community Detection (Louvain, Leiden, Label Propagation, Spectral)
4. Clique and K-Core Analysis
5. Shortest Paths and Max Flow
6. Graph Layout Algorithms
7. Temporal Network Analysis
8. Intelligence Application Patterns

---

### E.2.15 research-data-fusion-math.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-data-fusion-math.md` |
| **Lines** | 470 |
| **Author** | data-fusion-mathematician (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.4 (Data Fusion Mathematics) |

#### Summary

Data fusion frameworks and mathematical foundations for multi-source intelligence
integration. Covers the JDL model, Dasarathy model, Bayesian inference,
Dempster-Shafer theory, Kalman filtering, PHD filtering, Multiple Hypothesis
Tracking (MHT), fuzzy logic, and the Transferable Belief Model (TBM).

#### Key Findings

1. **JDL model as organizing framework**: The Joint Directors of Laboratories
   (JDL) data fusion model provides five levels: Object Refinement (L1),
   Situation Assessment (L2), Threat Assessment (L3), Process Refinement (L4),
   and User Refinement (L5). Tsingou primarily operates at L1-L2.

2. **Dempster-Shafer for uncertain evidence**: DS theory handles incomplete
   and conflicting evidence better than Bayesian methods when prior
   probabilities are unknown. Critical for source reliability assessment.

3. **Kalman filter for tracking**: The Kalman filter is the optimal linear
   estimator for tracking moving emitters in the geospatial domain. Extended
   Kalman (EKF) and Unscented Kalman (UKF) handle nonlinear dynamics.

4. **PHD for multi-target**: The Probability Hypothesis Density filter handles
   unknown and varying numbers of targets. Relevant for scenarios with
   multiple emitters appearing and disappearing.

5. **Conflict handling**: When combining evidence from contradictory sources,
   standard Dempster's rule can produce counter-intuitive results. Yager's
   rule and Murphy's averaging rule are alternatives for high-conflict
   scenarios.

#### Sections

1. JDL Data Fusion Model
2. Dasarathy Model
3. Bayesian Inference
4. Dempster-Shafer Theory
5. Conflict Management
6. Kalman Filtering Family (KF, EKF, UKF)
7. Particle Filters (Sequential Monte Carlo)
8. PHD Filtering
9. Multiple Hypothesis Tracking (MHT)
10. Fuzzy Logic Fusion
11. Transferable Belief Model (TBM)
12. Tsingou Fusion Architecture

---

### E.2.16 research-information-theory.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-information-theory.md` |
| **Lines** | 589 |
| **Author** | diff-dataflow-theorist (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.29 (Information Theory) |

#### Summary

Information-theoretic foundations for signal intelligence analysis: Shannon entropy,
mutual information, KL divergence, channel capacity, rate-distortion theory, and
applications to secrecy systems and spectral analysis.

#### Key Findings

1. **Shannon entropy as signal complexity metric**: H(X) = -sum(p(x) log p(x))
   quantifies the "surprise" or information content in a signal. High entropy
   indicates encrypted or spread-spectrum signals; low entropy suggests
   structured modulation.

2. **Mutual information for correlation**: I(X;Y) measures statistical dependence
   between two signals. Used for detecting correlated emissions from the same
   source operating on different frequencies.

3. **KL divergence for anomaly detection**: D_KL(P||Q) measures how one
   probability distribution diverges from a reference. Used for detecting
   spectral anomalies (new emitters, changed modulation).

4. **Channel capacity bounds**: Shannon's noisy-channel theorem establishes
   C = B log2(1 + SNR) as the maximum data rate. This bounds the information
   extraction possible from SDR captures at given noise levels.

5. **Renyi and Tsallis entropy**: Generalized entropy measures provide
   parameterizable sensitivity to rare vs. common events. Useful for
   detecting low-probability signal patterns.

#### Sections

1. Historical Context (Shannon 1948-1949)
2. Shannon Entropy and Joint Entropy
3. Mutual Information and Conditional Entropy
4. KL Divergence and Jensen-Shannon Divergence
5. Channel Capacity and Noisy-Channel Theorem
6. Rate-Distortion Theory
7. Secrecy Systems
8. Renyi and Tsallis Entropy
9. Applications to SIGINT

---

### E.2.17 research-statistical-analysis.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-statistical-analysis.md` |
| **Lines** | 428 |
| **Author** | data-fusion-mathematician (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.27 (Statistical Analysis & Anomaly Detection) |

#### Summary

Statistical methods for signal stream analysis and anomaly detection. Covers
online algorithms (Welford's method), control charts (EWMA, CUSUM), outlier
tests (Grubbs, Rosner, Dixon), changepoint detection (BOCPD), time-series
decomposition (STL), and hypothesis testing.

#### Key Findings

1. **Welford's online algorithm**: Computes running mean and variance in a
   single pass with O(1) memory per update. Essential for streaming signal
   statistics where buffering is impractical.

2. **EWMA for trend detection**: Exponentially Weighted Moving Average provides
   smoothed trend tracking with tunable sensitivity (lambda parameter).
   Used for detecting slow drift in signal power levels.

3. **CUSUM for changepoint detection**: Cumulative Sum control charts detect
   abrupt shifts in signal parameters. Page's 1954 algorithm is optimal
   for detecting mean shifts of known magnitude.

4. **BOCPD for regime changes**: Bayesian Online Changepoint Detection
   (Adams-MacKay 2007) detects regime changes without specifying the
   change magnitude in advance. Suitable for detecting new emitters.

5. **Multiple testing correction**: Benjamini-Hochberg FDR control is
   essential when testing anomaly detections across many frequency bins
   simultaneously, preventing false alarm proliferation.

#### Sections

1. Descriptive Statistics for Signal Streams
2. Running Statistics (Online Algorithms)
3. EWMA (Exponentially Weighted Moving Average)
4. CUSUM (Cumulative Sum) Control Charts
5. Grubbs and Rosner Outlier Tests
6. Bayesian Online Changepoint Detection
7. STL Seasonal-Trend Decomposition
8. Spectral Analysis (Welch's Method)
9. Distribution Tests (KS, Anderson-Darling)
10. Correlation Analysis (Pearson, Spearman)
11. Multiple Testing Correction

---

### E.2.18 research-geospatial-math.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-geospatial-math.md` |
| **Lines** | 1,083 |
| **Author** | dsp-specialist (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.30 (Geospatial Mathematics) |

#### Summary

Geospatial mathematics for SIGINT visualization: geodetic foundations (WGS84),
coordinate transformations, distance/bearing calculations, spatial indexing
(H3, S2, R-tree), clustering algorithms (DBSCAN, HDBSCAN), and protocol-specific
geolocation (ADS-B CPR decoding, AIS position reports).

#### Key Findings

1. **WGS84 as reference datum**: All geospatial operations use the WGS84
   reference ellipsoid. Implementations MUST use EPSG:4326 for geographic
   coordinates and support transformation to projected CRS via PROJ.

2. **Vincenty's formula for precision**: Vincenty's inverse formula computes
   ellipsoidal distance to millimeter accuracy. Karney's algorithm provides
   a fallback for the antipodal convergence failure case.

3. **H3 hexagonal indexing**: Uber's H3 system tessellates the globe with
   hexagonal cells at 16 resolution levels. Hexagons have uniform adjacency
   (6 neighbors) making them superior to quadtree grids for density analysis.

4. **DBSCAN for emitter clustering**: Density-based clustering groups spatially
   proximate signals without requiring cluster count specification. HDBSCAN
   extends this to automatically determine optimal cluster density.

5. **ADS-B CPR decoding**: Compact Position Reporting encodes latitude/longitude
   using 17-bit even/odd frame pairs. A reasonableness test (decoded position
   within 180 NM of reference) is REQUIRED to prevent ambiguity errors.

6. **R*-tree for spatial queries**: R*-trees provide O(log N) range and
   nearest-neighbor queries on bounding boxes. Essential for efficient
   "signals within radius" queries in the geospatial rendering layer.

#### Sections

1. Geodetic Foundations (WGS84)
2. Coordinate Reference Systems
3. Distance and Bearing Calculations
4. H3 Hexagonal Spatial Index
5. S2 Geometry
6. R-tree and R*-tree
7. DBSCAN and HDBSCAN Clustering
8. ADS-B CPR Decoding
9. AIS Position Reports
10. Direction Finding Geometry
11. Geofencing

---

### E.2.19 research-palantir-integration.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-palantir-integration.md` |
| **Lines** | 323 |
| **Author** | graph-theory-specialist (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.33 (Palantir Knowledge Graph Integration) |

#### Summary

Palantir platform architecture research covering Gotham vs. Foundry, the Ontology
data model, Object Types, Link Types, Action Types, the OSDK client SDK, and
AIP integration patterns.

#### Key Findings

1. **Gotham for intelligence**: Palantir Gotham is the intelligence/defense
   platform with graph-centric analysis, link charts, and geospatial mapping.
   Foundry is the commercial data operations platform. Tsingou integrates
   with Gotham.

2. **Ontology as data model**: The Palantir Ontology defines objects (entities),
   properties (attributes), links (relationships), and actions (write
   operations). This maps closely to STIX 2.1's SDO/SRO structure.

3. **OSDK for type-safe access**: The Ontology SDK (OSDK) provides TypeScript
   client libraries with full type safety generated from the Ontology schema.
   Tsingou uses @osdk/client for API integration.

4. **Marking-based access control**: Palantir uses classification markings for
   mandatory access control. Tsingou must honor these markings when exchanging
   data with Palantir instances.

5. **AIP for AI integration**: Palantir's AIP (Artificial Intelligence Platform)
   enables LLM-powered reasoning over the Ontology. Tsingou's graph analytics
   can be exported as Ontology objects for AIP reasoning.

#### Sections

1. Palantir Platform Overview (Gotham vs. Foundry)
2. Ontology Architecture
3. Object and Link Types
4. Action Types
5. OSDK Client SDK
6. Marking-Based Access Control
7. AIP Integration Patterns

---

### E.2.20 research-effect-architecture.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-effect-architecture.md` |
| **Lines** | 891 |
| **Author** | dsp-specialist (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.32 (Effect-TS Implementation Architecture) |

#### Summary

Research on Effect-TS algebra foundations, service architecture, layer composition,
fiber runtime, stream processing, and the effect-atom reactive state bridge.
Provides the theoretical and practical grounding for Tsingou's Effect-native
implementation.

#### Key Findings

1. **Effect<A, E, R> as universal type**: The Effect type models success (A),
   failure (E), and dependencies (R) in a single composable value. This
   eliminates the need for separate error handling, DI, and async abstractions.

2. **Service as capability boundary**: Effect.Service<I> defines capability
   interfaces. Layer.succeed/effect/scoped implements them. This separation
   enables test isolation and deployment flexibility.

3. **Fiber-based concurrency**: Effect fibers are lightweight, cooperatively
   scheduled execution units. They support structured concurrency with
   automatic scope management and cancellation propagation.

4. **Stream for backpressured data**: Effect Stream provides typed, backpressured
   data sequences with composable operators (map, filter, merge, flatMap).
   Tsingou's signal pipeline uses Stream for SDR data flow.

5. **effect-atom for React bridge**: effect-atom provides Atom.make() for
   reactive state that bridges Effect services to React components. Atoms
   support derived values, async updates, and scoped lifecycle.

6. **@effect/rpc for API layer**: Effect RPC provides type-safe client/server
   communication with automatic serialization. Tsingou uses RpcGroup for
   the WebSocket API.

#### Sections

1. Effect Algebra Foundations
2. Service and Layer Architecture
3. Scope and Resource Management
4. Fiber Runtime and Concurrency
5. Stream Processing
6. Schema and Data Validation
7. Error Management (Cause, TaggedError)
8. effect-atom Reactive Bridge
9. @effect/rpc and @effect/cluster
10. Runtime Configuration

---

### E.2.21 research-error-handling.md

| Field | Value |
|-------|-------|
| **File** | `docs/tsingou/research/research-error-handling.md` |
| **Lines** | 381 |
| **Author** | data-fusion-mathematician (Val) |
| **Status** | COMPLETE |
| **Created** | 2026-02-18 |
| **Target RFC** | TSG.35 (Error Handling & Tagged Errors) |

#### Summary

Error handling patterns for Effect-TS applications: the Cause type, Data.TaggedError,
Schema.TaggedError, retry schedules, circuit breaker pattern, bulkhead isolation,
and observability integration (OpenTelemetry).

#### Key Findings

1. **Tagged errors for exhaustive matching**: Data.TaggedError and Schema.TaggedError
   provide discriminated union errors with `_tag` fields. TypeScript's type
   system enforces exhaustive handling of all error variants.

2. **Cause for error composition**: Effect.Cause provides a tree-structured
   error model supporting Sequential (then), Parallel (both), Die (unexpected),
   and Interrupt (cancellation) error modes.

3. **Schedule-based retry**: Effect Schedule provides composable retry policies
   (exponential, jittered, capped). Tsingou uses Schedule for adapter
   reconnection and TAXII polling.

4. **Circuit breaker for external services**: Fowler's circuit breaker pattern
   prevents cascading failures when external services (TAXII servers, Palantir
   API) are degraded. States: Closed -> Open -> Half-Open.

5. **Bulkhead isolation**: Each source adapter runs in an isolated fiber scope.
   Adapter failures cannot propagate to the pipeline or other adapters.

6. **OpenTelemetry integration**: All errors produce OpenTelemetry spans with
   error status codes. This enables end-to-end error tracing across the
   distributed sidecar architecture.

#### Sections

1. Effect-TS Error Model Foundations
2. The Cause Type
3. Data.TaggedError
4. Schema.TaggedError
5. Retry with Schedule
6. Circuit Breaker Pattern
7. Bulkhead Isolation
8. Error Metrics and Monitoring
9. OpenTelemetry Integration
10. Tsingou Error Taxonomy

---

## E.3 Research-to-RFC Traceability Matrix

This matrix maps each research document to the RFC sections it directly feeds.
Primary targets are listed first; secondary references follow.

| Research Document | Primary RFC Section(s) | Secondary RFC References |
|-------------------|----------------------|--------------------------|
| research-sigint-disciplines.md | TSG.2 | TSG.1, TSG.3, TSG.5, TSG.36 |
| research-intelligence-cycle.md | TSG.3 | TSG.1, TSG.2, TSG.5, TSG.31 |
| research-ew-doctrine.md | TSG.36 | TSG.2, TSG.3, TSG.16 |
| research-competitive-analysis.md | TSG.5 | TSG.2, TSG.3, TSG.15 |
| research-stix-sdo-catalog.md | TSG.12, TSG.13 | TSG.8, TSG.14, TSG.15 |
| research-taxii-protocol.md | TSG.14 | TSG.12, TSG.15 |
| research-cti-platforms.md | TSG.15 | TSG.12, TSG.14 |
| research-sdr-hardware-ecosystem.md | TSG.16 | TSG.17, TSG.18, TSG.19, TSG.25 |
| research-gnu-radio-architecture.md | TSG.17 | TSG.16, TSG.25, TSG.34 |
| research-protocol-decoders.md | TSG.17 | TSG.8, TSG.16, TSG.30 |
| research-spectrum-visualization.md | TSG.19 | TSG.22, TSG.23, TSG.25 |
| research-dsp-foundations.md | TSG.25 | TSG.17, TSG.19, TSG.27, TSG.29 |
| research-differential-dataflow.md | TSG.26 | TSG.7, TSG.31 |
| research-graph-theory.md | TSG.28 | TSG.21, TSG.33 |
| research-data-fusion-math.md | TSG.4 | TSG.3, TSG.30, TSG.31 |
| research-information-theory.md | TSG.29 | TSG.25, TSG.27, TSG.31 |
| research-statistical-analysis.md | TSG.27 | TSG.25, TSG.29, TSG.31, TSG.35 |
| research-geospatial-math.md | TSG.30 | TSG.21, TSG.28, TSG.34 |
| research-palantir-integration.md | TSG.33 | TSG.12, TSG.28 |
| research-effect-architecture.md | TSG.32 | TSG.9, TSG.10, TSG.11, TSG.35 |
| research-error-handling.md | TSG.35 | TSG.9, TSG.32, TSG.34 |

---

## E.4 Research Coverage Analysis

### E.4.1 RFC Sections WITH Research Backing

The following RFC sections have dedicated research documents:

| RFC Section | Research Document(s) | Coverage |
|-------------|---------------------|----------|
| TSG.2 | research-sigint-disciplines.md | Full |
| TSG.3 | research-intelligence-cycle.md | Full |
| TSG.4 | research-data-fusion-math.md | Full |
| TSG.5 | research-competitive-analysis.md | Full |
| TSG.12 | research-stix-sdo-catalog.md | Full |
| TSG.13 | research-stix-sdo-catalog.md (shared) | Full |
| TSG.14 | research-taxii-protocol.md | Full |
| TSG.15 | research-cti-platforms.md | Full |
| TSG.16 | research-sdr-hardware-ecosystem.md | Full |
| TSG.17 | research-gnu-radio-architecture.md, research-protocol-decoders.md | Full |
| TSG.19 | research-spectrum-visualization.md | Full |
| TSG.25 | research-dsp-foundations.md | Full |
| TSG.26 | research-differential-dataflow.md | Full |
| TSG.27 | research-statistical-analysis.md | Full |
| TSG.28 | research-graph-theory.md | Full |
| TSG.29 | research-information-theory.md | Full |
| TSG.30 | research-geospatial-math.md | Full |
| TSG.32 | research-effect-architecture.md | Full |
| TSG.33 | research-palantir-integration.md | Full |
| TSG.35 | research-error-handling.md | Full |
| TSG.36 | research-ew-doctrine.md | Full |

### E.4.2 RFC Sections WITHOUT Dedicated Research

The following RFC sections do not have dedicated research documents. These sections
were authored directly from existing codebase knowledge, ADRs, or established
documentation:

| RFC Section | Title | Rationale |
|-------------|-------|-----------|
| TSG.1 | Introduction and Vision | Synthesized from ADRs and SPEC.md |
| TSG.6 | Architecture Overview | Synthesized from ADR INDEX and existing architecture docs |
| TSG.7 | Signal Pipeline & d2ts | Derived from ADR-001 and codebase analysis |
| TSG.8 | BaseSignal Schema | Derived from codebase schema definitions |
| TSG.9 | Source Adapter Contract | Derived from ADR-002 and codebase patterns |
| TSG.10 | State Management | Derived from ADR-005 and effect-atom documentation |
| TSG.11 | NATS Messaging Fabric | Derived from ADR-003 and NATS documentation |
| TSG.18 | SigMF Codec | Covered by research-sdr-hardware-ecosystem.md (shared) |
| TSG.20 | Rendering Surface Overview | Synthesized from component architecture |
| TSG.21 | R3F 3D Layer | Derived from R3F documentation and migration guide |
| TSG.22 | visx Data Visualization | Derived from visx documentation |
| TSG.23 | p5 Generative Layer | Derived from p5.js documentation |
| TSG.24 | DOM Control Layer | Derived from component architecture |
| TSG.31 | Analysis Techniques Catalog | Synthesized from ADR-013 and mathematical sections |
| TSG.34 | Deployment Topology | Derived from Tauri and NATS deployment documentation |

---

## E.5 Author Attribution

Research documents were authored by domain specialist personas operating under
the Val architecture team. Each persona brings focused expertise:

| Persona | Documents Authored | Domain Expertise |
|---------|-------------------|------------------|
| **sigint-researcher** | 3 (sigint-disciplines, intelligence-cycle, competitive-analysis) | SIGINT doctrine, intelligence community standards, platform analysis |
| **stix-specialist** | 3 (stix-sdo-catalog, taxii-protocol, cti-platforms) | STIX/TAXII standards, CTI platform interoperability |
| **sdr-analyst** | 4 (sdr-hardware-ecosystem, gnu-radio-architecture, protocol-decoders, spectrum-visualization) | SDR hardware, GNU Radio, RF protocol decoding, spectrum display |
| **dsp-specialist** | 3 (dsp-foundations, geospatial-math, effect-architecture) | Digital signal processing, geospatial algorithms, Effect-TS architecture |
| **diff-dataflow-theorist** | 2 (differential-dataflow, information-theory) | Lattice theory, incremental computation, information theory |
| **data-fusion-mathematician** | 3 (data-fusion-math, statistical-analysis, error-handling) | Bayesian inference, statistical methods, error handling patterns |
| **ew-doctrine-advisor** | 1 (ew-doctrine) | Electronic warfare doctrine, EMSO community, military standards |
| **graph-theory-specialist** | 2 (graph-theory, palantir-integration) | Network analysis, centrality algorithms, Palantir platform |

**Total**: 8 specialist personas authored 21 research documents.

---

## E.6 Research Methodology

### E.6.1 Source Categories

Research documents draw from the following source categories, listed in order of
authority:

1. **Primary standards**: OASIS STIX/TAXII specifications, IETF RFCs, IEEE
   standards, military Joint Publications, NATO STANAGs
2. **Vendor documentation**: Palantir, GNU Radio, NATS, Tauri, Effect-TS,
   SDR hardware datasheets
3. **Academic literature**: Peer-reviewed papers from IEEE, ACM, Springer,
   Wiley, and discipline-specific journals
4. **Government publications**: Joint Publications, Field Manuals, DoD strategy
   documents, ODNI directives
5. **Open-source project documentation**: GitHub READMEs, wiki pages, API
   references for SDR and CTI tools
6. **Industry analysis**: Professional association publications (AOC/JED),
   defense news outlets, conference proceedings

### E.6.2 Quality Assurance

Each research document underwent the following quality process:

1. **Source verification**: All cited references were verified against primary
   sources. No secondary summaries were accepted without primary verification.

2. **Cross-referencing**: Findings were cross-referenced across related research
   documents to ensure consistency (e.g., SIGINT disciplines research aligns
   with intelligence cycle research).

3. **Tsingou relevance assessment**: Every finding includes an explicit mapping
   to Tsingou subsystems, ensuring research is actionable rather than purely
   academic.

4. **RFC author handoff**: Research documents were structured with clear section
   headers, numbered findings, and explicit RFC section targets to facilitate
   handoff to RFC authors.

### E.6.3 Limitations

1. **Classified sources excluded**: All research uses only unclassified and
   publicly available sources. Classified operational details of SIGINT
   platforms and EW systems are not included.

2. **Temporal bounds**: Research was conducted in February 2026. Rapidly
   evolving areas (SDR hardware, CTI platform features) may have changed
   since research was conducted.

3. **Vendor documentation access**: Palantir documentation is partially gated
   behind customer access. Research uses publicly available documentation
   and SDK references.

4. **No empirical testing**: Research documents present theoretical foundations
   and documented capabilities. Empirical performance validation occurs in
   the implementation phase, not the research phase.

---

## E.7 Document Statistics Summary

| # | Document | Lines | Author | Target RFC |
|---|----------|-------|--------|------------|
| 1 | research-stix-sdo-catalog.md | 2,320 | stix-specialist | TSG.12, TSG.13 |
| 2 | research-gnu-radio-architecture.md | 1,478 | sdr-analyst | TSG.17 |
| 3 | research-taxii-protocol.md | 1,245 | stix-specialist | TSG.14 |
| 4 | research-sigint-disciplines.md | 1,197 | sigint-researcher | TSG.2 |
| 5 | research-dsp-foundations.md | 1,127 | dsp-specialist | TSG.25 |
| 6 | research-geospatial-math.md | 1,083 | dsp-specialist | TSG.30 |
| 7 | research-cti-platforms.md | 1,056 | stix-specialist | TSG.15 |
| 8 | research-sdr-hardware-ecosystem.md | 1,019 | sdr-analyst | TSG.16 |
| 9 | research-effect-architecture.md | 891 | dsp-specialist | TSG.32 |
| 10 | research-intelligence-cycle.md | 842 | sigint-researcher | TSG.3 |
| 11 | research-graph-theory.md | 664 | graph-theory-specialist | TSG.28 |
| 12 | research-differential-dataflow.md | 658 | diff-dataflow-theorist | TSG.26 |
| 13 | research-protocol-decoders.md | 633 | sdr-analyst | TSG.17 |
| 14 | research-information-theory.md | 589 | diff-dataflow-theorist | TSG.29 |
| 15 | research-spectrum-visualization.md | 553 | sdr-analyst | TSG.19 |
| 16 | research-competitive-analysis.md | 527 | sigint-researcher | TSG.5 |
| 17 | research-ew-doctrine.md | 507 | ew-doctrine-advisor | TSG.36 |
| 18 | research-data-fusion-math.md | 470 | data-fusion-mathematician | TSG.4 |
| 19 | research-statistical-analysis.md | 428 | data-fusion-mathematician | TSG.27 |
| 20 | research-error-handling.md | 381 | data-fusion-mathematician | TSG.35 |
| 21 | research-palantir-integration.md | 323 | graph-theory-specialist | TSG.33 |
| | **TOTAL** | **17,991** | **8 authors** | **21 RFC sections** |

---

*Appendix E compiled 2026-02-18 by Val (arch-reviewer-3). Research corpus located
at `docs/tsingou/research/`. Line counts verified via `wc -l`.*
