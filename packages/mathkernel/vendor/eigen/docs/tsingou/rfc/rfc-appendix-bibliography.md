# Appendix B: Bibliography & References

```
Document:     rfc-appendix-bibliography.md
Section:      Appendix B
Title:        Bibliography & References
Status:       COMPLETE
Author:       Val (arch-reviewer-3)
Created:      2026-02-18
Purpose:      Consolidated bibliography for TMNL-RFC-002 (Tsingou System Specification)
Scope:        All references cited across 36 RFC section files
Format:       IETF normative bibliography format per RFC 7322
```

> This appendix collects every reference cited in the Tsingou RFC (TMNL-RFC-002).
> References are deduplicated, categorized, and marked as **Normative** (MUST be
> consulted for conformance) or **Informative** (aids understanding but is not
> required for conformance). Within each category, entries are sorted alphabetically
> by tag.

---

## Table of Contents

1. [B.1 Normative References](#b1-normative-references)
   1. [B.1.1 IETF Standards](#b11-ietf-standards)
   2. [B.1.2 OASIS Standards (STIX/TAXII)](#b12-oasis-standards-stixtaxii)
   3. [B.1.3 IEEE Standards](#b13-ieee-standards)
   4. [B.1.4 W3C Standards](#b14-w3c-standards)
   5. [B.1.5 Signal Metadata Standards](#b15-signal-metadata-standards)
   6. [B.1.6 Military & Intelligence Standards](#b16-military--intelligence-standards)
2. [B.2 Informative References](#b2-informative-references)
   1. [B.2.1 Tsingou Architecture Decision Records](#b21-tsingou-architecture-decision-records)
   2. [B.2.2 Tsingou Internal Documents](#b22-tsingou-internal-documents)
   3. [B.2.3 Tsingou RFC Cross-References](#b23-tsingou-rfc-cross-references)
   4. [B.2.4 Effect-TS Ecosystem](#b24-effect-ts-ecosystem)
   5. [B.2.5 NATS Messaging](#b25-nats-messaging)
   6. [B.2.6 Rendering & Visualization Libraries](#b26-rendering--visualization-libraries)
   7. [B.2.7 SDR & RF Processing](#b27-sdr--rf-processing)
   8. [B.2.8 CTI Platforms & Tools](#b28-cti-platforms--tools)
   9. [B.2.9 Palantir Integration](#b29-palantir-integration)
   10. [B.2.10 Deployment & Infrastructure](#b210-deployment--infrastructure)
   11. [B.2.11 Academic Papers — DSP & Signal Processing](#b211-academic-papers--dsp--signal-processing)
   12. [B.2.12 Academic Papers — Information Theory](#b212-academic-papers--information-theory)
   13. [B.2.13 Academic Papers — Statistical Analysis & Anomaly Detection](#b213-academic-papers--statistical-analysis--anomaly-detection)
   14. [B.2.14 Academic Papers — Graph Theory & Link Analysis](#b214-academic-papers--graph-theory--link-analysis)
   15. [B.2.15 Academic Papers — Data Fusion & Tracking](#b215-academic-papers--data-fusion--tracking)
   16. [B.2.16 Academic Papers — Differential Dataflow & Distributed Systems](#b216-academic-papers--differential-dataflow--distributed-systems)
   17. [B.2.17 Academic Papers — Geospatial Mathematics](#b217-academic-papers--geospatial-mathematics)
   18. [B.2.18 Books](#b218-books)
   19. [B.2.19 EW Doctrine & Military Organizations](#b219-ew-doctrine--military-organizations)
   20. [B.2.20 Human Factors & Cognitive Engineering](#b220-human-factors--cognitive-engineering)
   21. [B.2.21 Software Engineering & Architecture](#b221-software-engineering--architecture)
   22. [B.2.22 Competitive Intelligence Platforms](#b222-competitive-intelligence-platforms)
3. [B.3 Citation Index](#b3-citation-index)

---

## B.1 Normative References

Normative references are **required** for conformance with this specification. Implementations
MUST consult these documents to achieve interoperability and correctness.

### B.1.1 IETF Standards

| Tag | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, DOI 10.17487/RFC2119, March 1997. https://www.rfc-editor.org/info/rfc2119 |
| [RFC4122] | Leach, P., Mealling, M., Salz, R., "A Universally Unique IDentifier (UUID) URN Namespace", RFC 4122, DOI 10.17487/RFC4122, July 2005. https://www.rfc-editor.org/info/rfc4122 |
| [RFC4287] | Nottingham, M., Sayre, R., "The Atom Syndication Format", RFC 4287, DOI 10.17487/RFC4287, December 2005. https://www.rfc-editor.org/info/rfc4287 |
| [RFC6749] | Hardt, D., Ed., "The OAuth 2.0 Authorization Framework", RFC 6749, DOI 10.17487/RFC6749, October 2012. https://www.rfc-editor.org/info/rfc6749 |
| [RFC7617] | Reschke, J., "The 'Basic' HTTP Authentication Scheme", RFC 7617, DOI 10.17487/RFC7617, September 2015. https://www.rfc-editor.org/info/rfc7617 |
| [RFC7946] | Butler, H., Daly, M., Doyle, A., Gillies, S., Hagen, S., Schaub, T., "The GeoJSON Format", RFC 7946, DOI 10.17487/RFC7946, August 2016. https://www.rfc-editor.org/info/rfc7946 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, DOI 10.17487/RFC8174, May 2017. https://www.rfc-editor.org/info/rfc8174 |
| [RFC8446] | Rescorla, E., "The Transport Layer Security (TLS) Protocol Version 1.3", RFC 8446, DOI 10.17487/RFC8446, August 2018. https://www.rfc-editor.org/info/rfc8446 |

**Cited in:** All 36 RFC sections (RFC2119, RFC8174); TSG.12/TSG.13 (RFC4122); TSG.8 (RFC4287); TSG.14 (RFC6749, RFC7617); TSG.18/TSG.30 (RFC7946); TSG.11 (RFC8446).

### B.1.2 OASIS Standards (STIX/TAXII)

| Tag | Reference |
|-----|-----------|
| [STIX21] | OASIS Cyber Threat Intelligence Technical Committee, "STIX Version 2.1", Committee Specification 03, June 2020. https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html |
| [STIX-2.1] | (Alternate tag) OASIS CTI TC, "STIX Version 2.1", OASIS Standard, June 2021. https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html |
| [STIXPATT] | OASIS CTI TC, "STIX Patterning Language", Part 9 of STIX 2.1, June 2020. |
| [TAXII21] | OASIS CTI TC, "TAXII Version 2.1", Committee Specification 01, June 2020. https://docs.oasis-open.org/cti/taxii/v2.1/taxii-v2.1.html |
| [TAXII-2.1] | (Alternate tag) OASIS CTI TC, "TAXII Version 2.1", OASIS Standard, June 2021. |
| [TLP] | CISA/FIRST, "Traffic Light Protocol (TLP) Definitions and Usage", Version 2.0, 2022. |
| [TLP-2.0] | (Alternate tag) Traffic Light Protocol 2.0, FIRST, 2022. |

**Cited in:** TSG.12, TSG.13, TSG.14, TSG.15, TSG.1, TSG.2, TSG.3, TSG.6, TSG.11, TSG.33.

### B.1.3 IEEE Standards

| Tag | Reference |
|-----|-----------|
| [IEEE-754] | IEEE 754-2019, "IEEE Standard for Floating-Point Arithmetic", DOI 10.1109/IEEESTD.2019.8766229, 2019. |
| [IEEE1003] | IEEE Std 1003.1-2017, "POSIX.1-2017 (pax archive format)", 2017. |

**Cited in:** TSG.25 (IEEE-754); TSG.18 (IEEE1003).

### B.1.4 W3C Standards

| Tag | Reference |
|-----|-----------|
| [ARIA12] | W3C, "WAI-ARIA 1.2", W3C Recommendation, December 2023. https://www.w3.org/TR/wai-aria-1.2/ |
| [WAI-ARIA] | W3C, "WAI-ARIA Authoring Practices", https://www.w3.org/WAI/ARIA/apg/ |
| [WCAG21] | W3C, "Web Content Accessibility Guidelines (WCAG) 2.1", W3C Recommendation, June 2018. https://www.w3.org/TR/WCAG21/ |
| [WCAG-2.1] | (Alternate tag) W3C, "Web Content Accessibility Guidelines 2.1". |

**Cited in:** TSG.24 (WCAG21, ARIA12); TSG.22 (WCAG-2.1, WAI-ARIA).

### B.1.5 Signal Metadata Standards

| Tag | Reference |
|-----|-----------|
| [SIGMF] | The SigMF Project, "Signal Metadata Format Specification", v1.2.0, https://github.com/sigmf/SigMF |

**Cited in:** TSG.1, TSG.7, TSG.8, TSG.11, TSG.16, TSG.18, TSG.19, TSG.25, TSG.34, TSG.36.

### B.1.6 Military & Intelligence Standards

| Tag | Reference |
|-----|-----------|
| [ATP2-01.3] | Department of the Army, "ATP 2-01.3: Intelligence Preparation of the Battlespace", March 2019. |
| [ATP-3-12.3] | U.S. Army, "ATP 3-12.3: Electronic Warfare Techniques", Headquarters, Department of the Army. |
| [ICD-203] | Office of the Director of National Intelligence, "Intelligence Community Directive 203 — Analytic Standards", 2015. |
| [JP-2-0] | Joint Chiefs of Staff, "Joint Publication 2-0: Joint Intelligence", 2013, revised 2022. |
| [JP-2-01] | Joint Chiefs of Staff, "Joint Publication 2-01: Joint and National Intelligence Support to Military Operations". |
| [JP-2-01.3] | Joint Chiefs of Staff, "Joint Publication 2-01.3: Signals Intelligence Support to Operations". |
| [JP-3-13.1] | Joint Chiefs of Staff, "JP 3-13.1: Electronic Warfare", Joint Publication. |
| [JP3-85] | Joint Chiefs of Staff, "Joint Publication 3-85: Joint Electromagnetic Spectrum Operations", 22 May 2020. |
| [AFDP3-85] | Department of the Air Force, "AFDP 3-85: Electromagnetic Spectrum Operations", December 2023. |
| [FM3-12] | Department of the Army, "FM 3-12: Cyberspace Operations and Electromagnetic Warfare", August 2021. |
| [FM3-38] | Department of the Army, "FM 3-38: Cyber Electromagnetic Activities", 2014. |
| [EMS-STRAT] | Department of Defense, "Electromagnetic Spectrum Superiority Strategy", October 2020. |
| [NIDC-2022] | Office of the Director of National Intelligence, "National Intelligence Discipline Categories", 2022 revision. |
| [STANAG-2511] | NATO, "Intelligence Procedures", STANAG 2511 (Allied Joint Doctrine for Intelligence Procedures AJP-2.1), Edition B. |
| [ICAO-ADSB] | ICAO, Annex 10, Vol. IV, "Surveillance and Collision Avoidance Systems". |
| [ITU-M1371] | ITU-R M.1371-5, "Technical characteristics for an automatic identification system using time-division multiple access in the VHF maritime mobile frequency band", 2014. |
| [ADMIRALTY] | NATO, "Source/Information Evaluation System (Admiralty System)". |

**Cited in:** TSG.2, TSG.3, TSG.36, TSG.4, TSG.30.

---

## B.2 Informative References

Informative references provide background, context, and implementation guidance. They are
not required for conformance but are recommended for full understanding of the specification.

### B.2.1 Tsingou Architecture Decision Records

| Tag | Reference |
|-----|-----------|
| [ADR-001] | "ADR-001: d2ts as Signal Pipeline Core." `docs/tsingou/adr/ADR-001-d2ts-as-signal-pipeline.md`, 2026. |
| [ADR-002] | "ADR-002: Source Adapter Contract — Effect.Service with Push API." `docs/tsingou/adr/ADR-002-source-adapter-contract.md`, 2026. |
| [ADR-003] | "ADR-003: NATS as Universal Signal Fabric." `docs/tsingou/adr/ADR-003-nats-as-universal-fabric.md`, 2026. |
| [ADR-004] | "ADR-004: @effect/platform for HTTP, WebSocket, FileSystem." `docs/tsingou/adr/ADR-004-effect-platform-adapters.md`, 2026. |
| [ADR-005] | "ADR-005: Atom-as-State Pattern." `docs/tsingou/adr/ADR-005-atom-as-state.md`, 2026. |
| [ADR-006] | "ADR-006: Tagged Errors Everywhere." `docs/tsingou/adr/ADR-006-tagged-errors-everywhere.md`, 2026. |
| [ADR-007] | "ADR-007: Framer Motion for Animation." `docs/tsingou/adr/ADR-007-framer-motion-for-animation.md`, 2026. |
| [ADR-008] | "ADR-008: System Named 'Tsingou'." `docs/tsingou/adr/ADR-008-tsingou-naming-and-identity.md`, 2026. |
| [ADR-009] | "ADR-009: STIX Interoperability Layer." `docs/tsingou/adr/ADR-009-stix-interop-layer.md`, 2026. |
| [ADR-010] | "ADR-010: Full Intelligence Cycle Coverage." `docs/tsingou/adr/ADR-010-full-intelligence-cycle.md`, 2026. |
| [ADR-011] | "ADR-011: SDR Integration via GNU Radio Bridge." `docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md`, 2026. |
| [ADR-012] | "ADR-012: Tsingou as Visualization Platform." `docs/tsingou/adr/ADR-012-visualization-focused-platform.md`, 2026. |
| [ADR-013] | "ADR-013: Eight Analysis Techniques." `docs/tsingou/adr/ADR-013-analysis-techniques.md`, 2026. |
| [ADR005] | (Alternate tag for ADR-005 used in TSG.24.) |

**Cited in:** TSG.1, TSG.2, TSG.3, TSG.6, TSG.7, TSG.9, TSG.10, TSG.11, TSG.13, TSG.16, TSG.18, TSG.19, TSG.20, TSG.21, TSG.22, TSG.24, TSG.25, TSG.26, TSG.29, TSG.31, TSG.32, TSG.33, TSG.36.

### B.2.2 Tsingou Internal Documents

| Tag | Reference |
|-----|-----------|
| [SPEC] | "Tsingou System Specification." `docs/tsingou/SPEC.md`, 2026. |
| [TSINGOU-SPEC] | (Alternate tag) "TSINGOU — System Specification." `docs/tsingou/SPEC.md`, 2026. |
| [FLOW-ARCH] | "Tsingou Flow Architecture Document." `docs/tsingou/FLOW_ARCHITECTURE.md`, 2026. |
| [R3F_MIGRATION] | "R3F Migration Document." `docs/tsingou/R3F_MIGRATION.md`, 2026. |
| [TSINGOU-NAMING] | ADR-008: System Named "Tsingou". Named after Mary Tsingou (1928-2023), Los Alamos National Laboratory. |
| [NWWRLD] | aagentah, "nw_wrld — Event-driven visual sequencer", GPL-3.0, v0.5.0-beta. `submodules/nw_wrld/` |
| [INDEX-6.1] | ADR Index — Consistency Note 6.1. `docs/tsingou/adr/INDEX.md` |
| [INDEX-6.2] | ADR Index — Consistency Note 6.2. `docs/tsingou/adr/INDEX.md` |
| [INDEX-6.6] | ADR Index — Consistency Note 6.6. `docs/tsingou/adr/INDEX.md` |
| [MEMORY-NATS-KV] | Val's persistent memory: "NATS KV keys become NATS subjects — colons INVALID". |
| [04_STATE_PERSISTENCE] | nw_wrld State & Persistence Reference. `docs/tsingou/nw-wrld-reference/04_STATE_PERSISTENCE.md` |
| [ARCHITECTURE_ANALYSIS] | nw_wrld Architecture Analysis. `docs/tsingou/nw-wrld-reference/ARCHITECTURE_ANALYSIS.md` |

**Cited in:** TSG.1, TSG.6, TSG.7, TSG.10, TSG.20, TSG.21, TSG.26.

### B.2.3 Tsingou RFC Cross-References

These are internal cross-references between sections of this specification.

| Tag | Section Title |
|-----|---------------|
| [TSG.2] | SIGINT/OSINT Domain Reference |
| [TSG.3] | Intelligence Cycle |
| [TSG.3.1] | 4-Layer Composited Architecture |
| [TSG.3.2] | R3F Layer (z:0, WebGL 3D) |
| [TSG.3.3] | visx Layer Summary |
| [TSG.3.4] | p5 Layer |
| [TSG.3.4.5] | p5 Color Mapping for SDR |
| [TSG.3.5] | DOM Layer |
| [TSG.3.6] | OutputBridge Routing |
| [TSG.3.6.2] | Selective Subscription |
| [TSG.3.7] | Analysis Technique Mapping |
| [TSG.3.7.3] | Cross-Layer Coordination |
| [TSG.3-R3] | Crash Isolation Requirement |
| [TSG.3-R7] | 12px Text Floor |
| [TSG.4] | Data Fusion Mathematics |
| [TSG.4.1] | Atom-as-State Doctrine |
| [TSG.5] | Competitive Analysis |
| [TSG.6] | Architecture Overview |
| [TSG.7] | Signal Pipeline & d2ts |
| [TSG.8] | BaseSignal Schema |
| [TSG.9] | Source Adapter Contract |
| [TSG.10] | State Management |
| [TSG.11] | NATS Messaging Fabric |
| [TSG.12] | STIX 2.1 Data Model |
| [TSG.13] | BaseSignal-STIX Codec |
| [TSG.14] | TAXII 2.1 Transport |
| [TSG.15] | CTI Platform Interop |
| [TSG.16] | SDR Hardware Landscape |
| [TSG.17] | GNU Radio Bridge |
| [TSG.19] | Spectrum Visualization |
| [TSG.20] | 4-Layer Rendering Surface / Atom-as-State |
| [TSG.21] | R3F 3D Visualization Layer |
| [TSG.22] | visx Data Visualization Layer |
| [TSG.23] | p5 Generative Layer |
| [TSG.24] | DOM Control Layer |
| [TSG.25] | DSP Foundations |
| [TSG.26] | Differential Dataflow Theory |
| [TSG.27] | Statistical Analysis & Anomaly Detection |
| [TSG.28] | Graph Theory & Link Analysis / d2ts Dataflow |
| [TSG.29] | Information Theory |
| [TSG.30] | Geospatial Mathematics / Performance Budget |
| [TSG.31] | Analysis Techniques Catalog |
| [TSG.32] | Effect-TS Implementation Architecture |
| [TSG.34] | Deployment Topology |
| [TSG.35] | Error Handling & Tagged Errors |
| [TSG.36] | EW/SIGINT Doctrine Alignment |

**Cited in:** Cross-references used throughout all sections.

### B.2.4 Effect-TS Ecosystem

| Tag | Reference |
|-----|-----------|
| [EFFECT] | Effect-TS, "Effect: A TypeScript library for building production-grade applications." https://effect.website |
| [EFFECT-ATOM] | Tim Smart, "effect-atom — Reactive State for Effect." https://github.com/tim-smart/effect-atom |
| [EFFECT-CLUSTER] | Effect-TS, "@effect/cluster." https://github.com/Effect-TS/effect/tree/main/packages/cluster |
| [EFFECT-ERRORS] | Effect Documentation, "Expected Errors." https://effect.website/docs/error-management/expected-errors/ |
| [EFFECT-FIBERS] | Effect Documentation, "Fibers." https://effect.website/docs/concurrency/fibers/ |
| [EFFECT-HTTP-CLIENT] | Effect-TS, "@effect/platform HttpClient." https://effect.website/docs/platform/http-client |
| [EFFECT-LAYERS] | Effect Documentation, "Managing Layers." https://effect.website/docs/requirements-management/layers/ |
| [EFFECT-PUBSUB] | Effect Documentation, "PubSub." https://effect.website/docs/concurrency/pubsub/ |
| [EFFECT-QUEUE] | Effect-TS, "Queue — Bounded and Unbounded." https://effect.website/docs/concurrency/queue/ |
| [EFFECT-RPC] | Effect-TS, "@effect/rpc README." https://github.com/Effect-TS/effect/blob/main/packages/rpc/README.md |
| [EFFECT-RUNTIME] | Effect Documentation, "Introduction to Runtime." https://effect.website/docs/runtime/ |
| [EFFECT-SCHEDULE] | Effect-TS, "Schedule — Retry and Repetition." https://effect.website/docs/scheduling |
| [EFFECT-SCHEMA] | Effect-TS, "@effect/schema — Schema validation and transformation." https://effect.website/docs/schema/introduction/ |
| [EFFECT-SCOPE] | Effect-TS, "Scope and Resource Management." https://effect.website/docs/resource-management/scope/ |
| [EFFECT-SERVICE] | Effect-TS, "Effect.Service API." https://effect.website/docs/requirements-management/services/ |
| [EFFECT-SERVICES] | (Alternate tag) Effect Documentation, "Managing Services." |
| [EFFECT-SOCKET] | Effect-TS, "@effect/platform Socket." https://effect.website/docs/platform/socket |
| [EFFECT-STREAM] | Effect Documentation, "Creating Streams." https://effect.website/docs/stream/creating/ |
| [EFFECT-TAGGED-ERROR] | Effect-TS, "Data.TaggedError." https://effect.website/docs/data-types/data-tagged-error |
| [EFFECT-TS-CAUSE] | Effect Documentation, "Error Management — Cause." |
| [EFFECT-TS-ERRORS] | Effect Documentation, "Expected Errors." |
| [EFFECT-TS-SANDBOX] | Effect Documentation, "Sandboxing." |
| [EFFECT-TS-SCHEDULE] | Effect Documentation, "Schedule Examples." |
| [EFFECT-TS-YIELDABLE] | Effect Documentation, "Yieldable Errors." |
| [DATA-TAGGED-ERROR] | Effect Documentation, "Data.TaggedError." |
| [SCHEMA-TAGGED-ERROR] | Effect Documentation, "Schema.TaggedError." |
| [D2TS] | Electric SQL, "@electric-sql/d2ts — Differential dataflow in TypeScript." https://github.com/electric-sql/d2ts |
| [D2TS-REPO] | Electric SQL, "d2ts: Differential Dataflow in TypeScript." https://github.com/electric-sql/d2ts, 2024. |

**Cited in:** TSG.1, TSG.6, TSG.7, TSG.8, TSG.9, TSG.10, TSG.11, TSG.13, TSG.16, TSG.18, TSG.19, TSG.20, TSG.26, TSG.29, TSG.32, TSG.35.

### B.2.5 NATS Messaging

| Tag | Reference |
|-----|-----------|
| [NATS] | NATS.io, "NATS — Cloud Native Messaging System." https://nats.io |
| [NATS-ACCOUNTS] | Synadia, "NATS Multi-Tenancy with Accounts." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/accounts |
| [NATS-CLUSTER] | Synadia, "NATS Clustering." https://docs.nats.io/running-a-nats-service/configuration/clustering |
| [NATS-CORE] | Synadia, "NATS Core — Publish/Subscribe." https://docs.nats.io/nats-concepts/core-nats/pubsub |
| [NATS-EDGE] | Synadia, "Adaptive Edge Architecture." https://nats.io/blog/synadia-adaptive-edge/, 2024. |
| [NATS-JETSTREAM] | Synadia, "NATS JetStream." https://docs.nats.io/nats-concepts/jetstream |
| [NATS-JWT] | Synadia, "NATS JWT Authentication." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/jwt |
| [NATS-KV] | Synadia, "NATS Key/Value Store." https://docs.nats.io/nats-concepts/jetstream/key-value-store |
| [NATS-LEAF] | Synadia, "NATS Leaf Nodes." https://docs.nats.io/running-a-nats-service/configuration/leafnodes |
| [NATS-MACHINEMETRICS] | Synadia, "MachineMetrics: Industrial IoT at the Edge." https://www.synadia.com/customer-stories/machinemetrics, 2024. |
| [NATS-MONITORING] | Synadia, "NATS Monitoring." https://docs.nats.io/running-a-nats-service/configuration/monitoring |
| [NATS-NKEY] | Synadia, "NATS NKey Authentication." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/auth_intro/nkey_auth |
| [NATS-OBJSTORE] | Synadia, "NATS Object Store." https://docs.nats.io/nats-concepts/jetstream/obj_store |
| [NATS-PUBSUB] | Synadia, "NATS Core Publish/Subscribe." https://docs.nats.io/nats-concepts/core-nats/pubsub |
| [NATS-SERVER] | Synadia, "NATS Server." https://github.com/nats-io/nats-server |
| [NATS-SYS] | Synadia, "NATS System Events." https://docs.nats.io/running-a-nats-service/configuration/sys_accounts |
| [NATS-TLS] | Synadia, "NATS TLS Configuration." https://docs.nats.io/running-a-nats-service/configuration/securing_nats/tls |

**Cited in:** TSG.1, TSG.6, TSG.7, TSG.8, TSG.9, TSG.10, TSG.11, TSG.34.

### B.2.6 Rendering & Visualization Libraries

| Tag | Reference |
|-----|-----------|
| [D3-FORCE-3D] | Vasco Asturiano, "d3-force-3d — Force-directed graph layout in 3D." https://github.com/vasturiano/d3-force-3d |
| [D3-SCALE] | Bostock, M., "d3-scale — Scales for visual encoding." https://d3js.org/d3-scale |
| [D3SCALE] | (Alternate tag) d3-scale. https://github.com/d3/d3-scale |
| [DREI] | Poimandres, "@react-three/drei — Useful helpers for React Three Fiber." https://github.com/pmndrs/drei |
| [FRAMER] | Framer, "framer-motion — A production-ready motion library for React." https://www.framer.com/motion |
| [FRAMER-MOTION] | (Alternate tag) Framer, "Framer Motion." https://www.framer.com/motion/ |
| [H3] | Uber Technologies, "H3 — Hexagonal hierarchical geospatial indexing system." https://h3geo.org/ |
| [P5] | Processing Foundation, "p5.js — JavaScript library for creative coding." https://p5js.org |
| [P5-BLEND] | Processing Foundation, "blendMode." https://p5js.org/reference/p5/blendMode/ |
| [P5-FFT] | Processing Foundation, "p5.FFT." https://p5js.org/reference/p5.sound/p5.FFT/ |
| [P5-MODES] | Processing Foundation, "Global and Instance Mode." https://github.com/processing/p5.js/wiki/Global-and-instance-mode |
| [P5-NOISE] | Processing Foundation, "noise." https://p5js.org/reference/p5/noise/ |
| [P5-REACT] | P5-wrapper, "@p5-wrapper/react." https://github.com/P5-wrapper/react |
| [P5-SHADERS] | Processing Foundation, "Introduction to Shaders." https://p5js.org/tutorials/intro-to-shaders/ |
| [P5-SHADER-EXAMPLES] | aferriss, "p5jsShaderExamples." https://github.com/aferriss/p5jsShaderExamples |
| [P5-WEBGL] | Processing Foundation, "Getting Started with WebGL in p5." https://p5js.org/tutorials/optimizing-webgl-sketches/ |
| [P5JS] | Processing Foundation, "p5.js — A JavaScript library for creative coding." https://p5js.org |
| [POSTPROCESSING] | vanruesc, "postprocessing — Post-processing library for Three.js." https://github.com/pmndrs/postprocessing |
| [R3F] | Poimandres, "React Three Fiber — React renderer for Three.js." https://docs.pmnd.rs/react-three-fiber |
| [R3F-PP] | Poimandres, "@react-three/postprocessing — Post-processing for R3F." https://github.com/pmndrs/react-postprocessing |
| [R3F-TEST] | Poimandres, "@react-three/test-renderer — Headless test renderer for R3F." |
| [RADIX] | Radix UI, "Radix Primitives — Unstyled Accessible Components." |
| [REACT-SPRING-THREE] | Poimandres, "@react-spring/three — Spring animations for R3F." https://www.react-spring.dev/ |
| [TANSTACK] | TanStack, "TanStack Virtual — Headless UI Virtualizer." |
| [THREE] | Three.js, "Three.js — JavaScript 3D Library." https://threejs.org/ |
| [TURBO] | Mikhailov, A., "Turbo, An Improved Rainbow Colormap for Visualization", Google AI Blog, 2019. |
| [VIRIDIS] | van der Walt, S. and Smith, N., "mpl colormaps." https://bids.github.io/colormap/ |
| [VISX] | Airbnb, "visx — A collection of expressive, low-level visualization primitives for React." https://airbnb.io/visx |
| [VISX-BRUSH] | Airbnb, "@visx/brush — Brush selection interaction." https://airbnb.io/visx/brush |
| [VISX-HEATMAP] | Airbnb, "@visx/heatmap — Heatmap visualization." https://airbnb.io/visx/heatmaps |
| [VISX-HIERARCHY] | Airbnb, "@visx/hierarchy — Hierarchical visualizations." https://airbnb.io/visx/treemap |
| [VISX-NETWORK] | Airbnb, "@visx/network — Network graph visualization." https://airbnb.io/visx/network |
| [VISX-XYCHART] | Airbnb, "@visx/xychart — Simplified XY chart API." https://airbnb.io/visx/docs/xychart |
| [VISX-ZOOM] | Airbnb, "@visx/zoom — Pan and zoom interaction." https://airbnb.io/visx/zoom |
| [WEBGL2] | Khronos Group, "WebGL 2.0 Specification." https://www.khronos.org/webgl/ |

**Cited in:** TSG.1, TSG.19, TSG.20, TSG.21, TSG.22, TSG.23, TSG.24.

### B.2.7 SDR & RF Processing

| Tag | Reference |
|-----|-----------|
| [DSD] | "Digital Speech Decoder." https://github.com/szechyjs/dsd |
| [DUMP1090] | FlightAware, "dump1090-fa." https://github.com/flightaware/dump1090 |
| [FFTW] | Frigo, M. and Johnson, S.G., "The Design and Implementation of FFTW3", *Proc. IEEE*, vol. 93, no. 2, pp. 216-231, 2005. |
| [GNURADIO] | GNU Radio Project. https://gnuradio.org |
| [GNURADIO4] | GNU Radio 4.0. https://github.com/gnuradio/gnuradio4 |
| [HACKRF] | Great Scott Gadgets, "HackRF." https://github.com/greatscottgadgets/hackrf |
| [INSPECTRUM] | inspectrum SDR signal viewer. https://github.com/miek/inspectrum |
| [LIQUID-DSP] | Gaeddert, J., "liquid-dsp: Software-Defined Radio Digital Signal Processing Library." https://liquidsdr.org |
| [MULTIMON] | "multimon-ng." https://github.com/EliasOenal/multimon-ng |
| [OP25] | "OP25 decoder." https://github.com/boatbod/op25 |
| [OPENWEBRX-WATERFALL] | OpenWebRX, "Waterfall Display Architecture." |
| [CANVAS-WATERFALL] | jledet, "HTML Canvas Waterfall Plot." https://github.com/jledet/waterfall |
| [PYRTLSDR] | pyrtlsdr Contributors, "pyrtlsdr: Python wrapper for librtlsdr." https://github.com/pyrtlsdr/pyrtlsdr |
| [PYSDR] | Dr. Marc Lichtman, "PySDR: A Guide to SDR and DSP using Python." https://pysdr.org |
| [RTL433] | "rtl_433." https://github.com/merbanan/rtl_433 |
| [RTLPOWERFFTW] | AD-Vega, "rtl-power-fftw: Power spectrum for RTLSDR." https://github.com/AD-Vega/rtl-power-fftw |
| [RTLSDR] | steve-m, "librtlsdr." https://github.com/steve-m/librtlsdr |
| [SIGPI] | Joe Cupano, "SIGpi: A SIGINT Go-kit." https://github.com/joecupano/SIGpi |
| [SOAPYSDR] | Pothosware, "SoapySDR." https://github.com/pothosware/SoapySDR |
| [UHD] | Ettus Research, "UHD Manual." https://files.ettus.com/manual/ |
| [URH] | "Universal Radio Hacker." https://github.com/jopohl/urh |
| [ZMQ] | ZeroMQ. https://zeromq.org/ |

**Cited in:** TSG.16, TSG.17, TSG.18, TSG.19, TSG.23, TSG.25, TSG.34.

### B.2.8 CTI Platforms & Tools

| Tag | Reference |
|-----|-----------|
| [CORTEX] | StrangeBee, "Cortex — Observable Analysis Engine." https://thehive-project.org/ |
| [MISP] | CIRCL, "MISP — Malware Information Sharing Platform." https://www.misp-project.org/ |
| [MISP-PROJECT] | MISP Project. misp-project.org, 2024. |
| [MISP-SIGMF] | MISP Project, "SigMF Support Announcement", August 2023. |
| [MITRE-ATTACK] | MITRE Corporation, "ATT&CK: Adversarial Tactics, Techniques, and Common Knowledge." https://attack.mitre.org |
| [ATT&CK] | (Alternate tag) MITRE ATT&CK Framework, Enterprise Matrix v14, 2024. |
| [NGA-GEOINT] | NGA, "Geospatial Intelligence Basic Doctrine", 2018. |
| [OPENCTI] | Filigran, "OpenCTI — Open Cyber Threat Intelligence Platform." https://www.opencti.io/ |
| [STIXSHIFT] | IBM, "STIX-Shifter — Universal Data Source Connector." GitHub. |
| [THEHIVE] | StrangeBee, "TheHive 5 — Security Incident Response Platform." https://thehive-project.org/ |

**Cited in:** TSG.1, TSG.2, TSG.3, TSG.5, TSG.15.

### B.2.9 Palantir Integration

| Tag | Reference |
|-----|-----------|
| [PALANTIR] | Palantir Technologies, "Gotham Platform." https://www.palantir.com/platforms/gotham/ |
| [PALANTIR-ACTIONS] | Palantir, "Action Types Overview." |
| [PALANTIR-AIP] | Palantir, "AIP Overview." |
| [PALANTIR-AGENT-STUDIO] | Palantir, "AIP Agent Studio Overview." |
| [PALANTIR-CBAC] | Palantir, "Classification-Based Access Controls." |
| [PALANTIR-GOTHAM] | Palantir Technologies, "Gotham Platform." |
| [PALANTIR-LINK-TYPES] | Palantir, "Link Types Overview." |
| [PALANTIR-MARKINGS] | Palantir, "Markings." |
| [PALANTIR-OBJECT-PERMISSIONING] | Palantir, "Object Permissioning Overview." |
| [PALANTIR-OBJECT-TYPES] | Palantir, "Object Types Overview." |
| [PALANTIR-ONTOLOGY] | Palantir, "Ontology Overview." |
| [PALANTIR-OSDK] | Palantir, "Ontology SDK Overview." |
| [PALANTIR-OSDK-TS] | Palantir, "Typescript Related OSDK Libraries." |
| [PALANTIR-PROPERTIES] | Palantir, "Property Base Types." |
| [PALANTIR-SUBSCRIPTIONS] | Palantir, "Subscribe to Ontology Changes with TypeScript OSDK." |

**Cited in:** TSG.33, TSG.36.

### B.2.10 Deployment & Infrastructure

| Tag | Reference |
|-----|-----------|
| [TAURI] | Tauri, "Tauri — Build an optimized, secure, and frontend-independent application." https://tauri.app |
| [TAURI-CAPABILITIES] | Tauri Contributors, "Capabilities." https://v2.tauri.app/security/capabilities/ |
| [TAURI-FS] | Tauri Contributors, "File System Plugin." https://v2.tauri.app/plugin/file-system/ |
| [TAURI-SIDECAR] | Tauri Contributors, "Embedding External Binaries." https://v2.tauri.app/develop/sidecar/ |
| [TAURI-V2] | Tauri Contributors, "Tauri v2 Documentation." https://v2.tauri.app/ |
| [JSON-SCHEMA] | JSON Schema, "JSON Schema: A Media Type for Describing JSON Documents." https://json-schema.org |
| [RSS-2.0] | Winer, D., "RSS 2.0 Specification." https://www.rssboard.org/rss-specification |
| [WEBVIEW2-GPU] | Microsoft, "WebView2 GPU Performance." https://github.com/MicrosoftEdge/WebView2Feedback/issues/5072 |
| [WEBKITGTK-248] | WebKitGTK Project, "WebKitGTK 2.48 Highlights." https://webkitgtk.org/2025/04/08/webkitgtk-2.48.html |
| [WEBKITGTK-250] | WebKitGTK Project, "WebKitGTK 2.50 Highlights." https://webkitgtk.org/2025/11/26/webkitgtk-2.50.html |

**Cited in:** TSG.1, TSG.6, TSG.8, TSG.34.

### B.2.11 Academic Papers — DSP & Signal Processing

| Tag | Reference |
|-----|-----------|
| [BLUESTEIN-1970] | Bluestein, L.I., "A linear filtering approach to the computation of discrete Fourier transform", *IEEE Trans. Audio and Electroacoustics*, vol. 18, no. 4, pp. 451-455, 1970. |
| [CARSON-1922] | Carson, J.R., "Notes on the theory of modulation", *Proc. IRE*, vol. 10, no. 1, pp. 57-64, 1922. |
| [COOLEY-TUKEY-1965] | Cooley, J.W. and Tukey, J.W., "An algorithm for the machine calculation of complex Fourier series", *Mathematics of Computation*, vol. 19, no. 90, pp. 297-301, 1965. |
| [GABOR-1946] | Gabor, D., "Theory of communication", *J. IEE*, vol. 93, no. 26, pp. 429-457, 1946. |
| [HARRIS-WINDOWS] | Harris, F.J., "On the use of windows for harmonic analysis with the discrete Fourier transform", *Proc. IEEE*, vol. 66, no. 1, pp. 51-83, 1978. |
| [HOGENAUER-1981] | Hogenauer, E., "An economical class of digital filters for decimation and interpolation", *IEEE Trans. ASSP*, vol. 29, no. 2, pp. 155-162, 1981. |
| [MALLAT-1989] | Mallat, S., "A theory for multiresolution signal decomposition: The wavelet representation", *IEEE Trans. PAMI*, vol. 11, no. 7, pp. 674-693, 1989. |
| [NYQUIST-1928] | Nyquist, H., "Certain topics in telegraph transmission theory", *Trans. AIEE*, vol. 47, no. 2, pp. 617-644, 1928. |
| [OPPENHEIM] | Oppenheim, A.V. and Schafer, R.W., *Discrete-Time Signal Processing*, 3rd ed., Pearson, 2010. |
| [OPPENHEIM-DSP] | (Alternate tag) Oppenheim, A.V. and Schafer, R.W., *Discrete-Time Signal Processing*, 3rd ed., Pearson, 2009. |
| [PARKS-MCCLELLAN] | Parks, T.W. and McClellan, J.H., "Chebyshev approximation for nonrecursive digital filters with linear phase", *IEEE Trans. Circuit Theory*, vol. 19, no. 2, pp. 189-194, 1972. |
| [SHANNON-1949] | Shannon, C.E., "Communication in the presence of noise", *Proc. IRE*, vol. 37, no. 1, pp. 10-21, 1949. |
| [THOMSON-1982] | Thomson, D.J., "Spectrum estimation and harmonic analysis", *Proc. IEEE*, vol. 70, no. 9, pp. 1055-1096, 1982. |
| [WELCH-1967] | Welch, P.D., "The use of fast Fourier transform for the estimation of power spectra", *IEEE Trans. Audio and Electroacoustics*, vol. 15, no. 2, pp. 70-73, 1967. |

**Cited in:** TSG.25, TSG.17, TSG.27.

### B.2.12 Academic Papers — Information Theory

| Tag | Reference |
|-----|-----------|
| [BERGER-1971] | Berger, T., "Rate Distortion Theory: A Mathematical Basis for Data Compression", Prentice-Hall, 1971. |
| [COSTA-2002] | Costa, M., Goldberger, A.L., Peng, C.K., "Multiscale Entropy Analysis of Complex Physiologic Time Series", *Physical Review Letters*, 89(6), 068102, 2002. |
| [HARTLEY-1928] | Hartley, R.V.L., "Transmission of Information", *Bell System Technical Journal*, 7(3), pp. 535-563, 1928. |
| [KRASKOV-2004] | Kraskov, A., Stogbauer, H., Grassberger, P., "Estimating Mutual Information", *Physical Review E*, 69(6), 066138, 2004. |
| [KULLBACK-1951] | Kullback, S. and Leibler, R.A., "On Information and Sufficiency", *Annals of Mathematical Statistics*, 22(1), pp. 79-86, 1951. |
| [LIN-1991] | Lin, J., "Divergence Measures Based on the Shannon Entropy", *IEEE Transactions on Information Theory*, 37(1), pp. 145-151, 1991. |
| [RENYI-1961] | Renyi, A., "On Measures of Entropy and Information", *Proc. 4th Berkeley Symposium on Mathematical Statistics and Probability*, Vol. 1, pp. 547-561, 1961. |
| [SHANNON-1948] | Shannon, C.E., "A Mathematical Theory of Communication", *Bell System Technical Journal*, 27(3-4), pp. 379-423, 623-656, 1948. |
| [TSALLIS-2009] | Tsallis, C., "Introduction to Nonextensive Statistical Mechanics: Approaching a Complex World", Springer, 2009. |

**Cited in:** TSG.29.

### B.2.13 Academic Papers — Statistical Analysis & Anomaly Detection

| Tag | Reference |
|-----|-----------|
| [ADAMS-MACKAY-2007] | Adams, R.P. and MacKay, D.J.C., "Bayesian Online Changepoint Detection", arXiv:0710.3742, 2007. |
| [ANDERSON-DARLING-1952] | Anderson, T.W. and Darling, D.A., "Asymptotic Theory of Certain 'Goodness of Fit' Criteria Based on Stochastic Processes", *Annals of Mathematical Statistics*, 23(2):193-212, 1952. |
| [BENJAMINI-HOCHBERG-1995] | Benjamini, Y. and Hochberg, Y., "Controlling the False Discovery Rate", *JRSS-B*, 57(1):289-300, 1995. |
| [CHAN-1979] | Chan, T.F., Golub, G.H., LeVeque, R.J., "Updating Formulae and a Pairwise Algorithm for Computing Sample Variances", Stanford STAN-CS-79-773, 1979. |
| [CLEVELAND-1990] | Cleveland, R.B. et al., "STL: A Seasonal-Trend Decomposition Procedure Based on Loess", *Journal of Official Statistics*, 6(1):3-73, 1990. |
| [CROSIER-1988] | Crosier, R.B., "Multivariate Generalizations of Cumulative Sum Quality-Control Schemes", *Technometrics*, 30(3):291-303, 1988. |
| [DIXON-1950] | Dixon, W.J., "Analysis of Extreme Values", *Annals of Mathematical Statistics*, 21(4):488-506, 1950. |
| [DUNNING-2021] | Dunning, T. and Ertl, O., "Computing Extremely Accurate Quantiles Using t-Digests", arXiv:1902.04023, 2021. |
| [GRUBBS-1950] | Grubbs, F.E., "Sample Criteria for Testing Outlying Observations", *Annals of Mathematical Statistics*, 21(1):27-58, 1950. |
| [IGLEWICZ-HOAGLIN-1993] | Iglewicz, B. and Hoaglin, D.C., "Volume 16: How to Detect and Handle Outliers", ASQC Quality Press, 1993. |
| [KOLMOGOROV-1933] | Kolmogorov, A.N., "Sulla determinazione empirica di una legge di distribuzione", 1933. |
| [MANN-WHITNEY-1947] | Mann, H.B. and Whitney, D.R., "On a Test of Whether One of Two Random Variables is Stochastically Larger than the Other", 1947. |
| [MOUSTAKIDES-1986] | Moustakides, G.V., "Optimal Stopping Times for Detecting Changes in Distributions", *Annals of Statistics*, 14(4):1379-1387, 1986. |
| [PAGE-1954] | Page, E.S., "Continuous Inspection Schemes", *Biometrika*, 41(1/2):100-115, 1954. |
| [PEARSON-1895] | Pearson, K., "Notes on Regression and Inheritance in the Case of Two Parents", *Proc. Royal Society*, 58:240-242, 1895. |
| [PEBAY-2008] | Pebay, P., "Formulas for Robust, One-Pass Parallel Computation of Covariances", Sandia SAND2008-6212, 2008. |
| [PIGNATIELLO-1990] | Pignatiello, J.J. and Runger, G.C., "Comparisons of Multivariate CUSUM Charts", *JQT*, 22(3):173-186, 1990. |
| [ROBERTS-1959] | Roberts, S.W., "Control Chart Tests Based on Geometric Moving Averages", *Technometrics*, 1(3):239-250, 1959. |
| [ROSNER-1983] | Rosner, B., "Percentage Points for a Generalized ESD Many-Outlier Procedure", *Technometrics*, 25(2):165-172, 1983. |
| [SMIRNOV-1948] | Smirnov, N.V., "Table for Estimating the Goodness of Fit of Empirical Distributions", 1948. |
| [SPEARMAN-1904] | Spearman, C., "The Proof and Measurement of Association between Two Things", 1904. |
| [WALD-1945] | Wald, A., "Sequential Tests of Statistical Hypotheses", *Annals of Mathematical Statistics*, 16(2):117-186, 1945. |
| [WELFORD-1962] | Welford, B.P., "Note on a Method for Calculating Corrected Sums of Squares and Products", *Technometrics*, 4(3):419-420, 1962. |

**Cited in:** TSG.27, TSG.35.

### B.2.14 Academic Papers — Graph Theory & Link Analysis

| Tag | Reference |
|-----|-----------|
| [BATAGELJ-ZAVERSNIK-2003] | Batagelj, V. and Zaversnik, M., "An O(m) Algorithm for Cores Decomposition of Networks", 2003. |
| [BLONDEL-2008] | Blondel, V.D. et al., "Fast unfolding of communities in large networks", 2008. |
| [BOLDI-VIGNA-2014] | Boldi, P. and Vigna, S., "Axioms for Centrality", *Internet Mathematics*, 2014. |
| [BRANDES-2001] | Brandes, U., "A Faster Algorithm for Betweenness Centrality", *Journal of Mathematical Sociology*, 2001. |
| [BRON-KERBOSCH-1973] | Bron, C. and Kerbosch, J., "Algorithm 457: Finding All Cliques of an Undirected Graph", 1973. |
| [CALTAGIRONE-2013] | Caltagirone, S. et al., "The Diamond Model of Intrusion Analysis", 2013. |
| [FIEDLER-1973] | Fiedler, M., "Algebraic connectivity of graphs", *Czechoslovak Mathematical Journal*, 1973. |
| [FORD-FULKERSON-1956] | Ford, L.R. and Fulkerson, D.R., "Maximal Flow through a Network", 1956. |
| [FORTUNATO-2007] | Fortunato, S. and Barthelemy, M., "Resolution limit in community detection", 2007. |
| [FRUCHTERMAN-REINGOLD-1991] | Fruchterman, T.M.J. and Reingold, E.M., "Graph Drawing by Force-Directed Placement", 1991. |
| [HOLME-SARAMAKI-2012] | Holme, P. and Saramaki, J., "Temporal networks", *Physics Reports*, 2012. |
| [HUTCHINS-2011] | Hutchins, E.M. et al., "Intelligence-Driven Computer Network Defense — Cyber Kill Chain", Lockheed Martin, 2011. |
| [JACOMY-2014] | Jacomy, M. et al., "ForceAtlas2, a Continuous Graph Layout Algorithm", 2014. |
| [KATZ-1953] | Katz, L., "A new status index derived from sociometric analysis", 1953. |
| [KLEINBERG-1999] | Kleinberg, J., "Authoritative sources in a hyperlinked environment", 1999. |
| [NEWMAN-GIRVAN-2004] | Newman, M.E.J. and Girvan, M., "Finding and evaluating community structure in networks", 2004. |
| [PAGE-1999] | Page, L. et al., "The PageRank Citation Ranking", Stanford University, 1999. |
| [RAGHAVAN-2007] | Raghavan, U.N. et al., "Near linear time algorithm to detect community structures in large-scale networks", 2007. |
| [SHI-MALIK-2000] | Shi, J. and Malik, J., "Normalized Cuts and Image Segmentation", *IEEE TPAMI*, 2000. |
| [TRAAG-2019] | Traag, V.A. et al., "From Louvain to Leiden", *Scientific Reports*, 2019. |
| [VON-LUXBURG-2007] | von Luxburg, U., "A Tutorial on Spectral Clustering", *Statistics and Computing*, 2007. |

**Cited in:** TSG.2, TSG.28.

### B.2.15 Academic Papers — Data Fusion & Tracking

| Tag | Reference |
|-----|-----------|
| [BAR-SHALOM-1988] | Bar-Shalom, Y. and Fortmann, T.E., *Tracking and Data Association*, Academic Press, 1988. |
| [BAR-SHALOM-2001] | Bar-Shalom, Y., Li, X.-R., Kirubarajan, T., *Estimation with Applications to Tracking and Navigation*, Wiley, 2001. |
| [BERGER-1985] | Berger, J.O., *Statistical Decision Theory and Bayesian Analysis*, 2nd ed., Springer, 1985. |
| [BLASCH-2006] | Blasch, E.P. and Plano, S., "JDL Level 5 Fusion Model", *Proc. SPIE 6235*, 2006. |
| [CASTANEDO-2013] | Castanedo, F., "A Review of Data Fusion Techniques", *Scientific World Journal*, 2013. |
| [DASARATHY-1997] | Dasarathy, B.V., "Sensor Fusion Potential Exploitation", *Proc. IEEE*, 85(1):24-38, 1997. |
| [DEMPSTER-1967] | Dempster, A.P., "Upper and Lower Probabilities Induced by a Multivalued Mapping", 1967. |
| [DENG-2004] | Deng, Y. et al., "Combining Belief Functions Based on Distance of Evidence", 2004. |
| [DOUCET-2001] | Doucet, A. et al., *Sequential Monte Carlo Methods in Practice*, Springer, 2001. |
| [GORDON-1993] | Gordon, N.J. et al., "Novel Approach to Nonlinear/Non-Gaussian Bayesian State Estimation", 1993. |
| [HO-LEE-1964] | Ho, Y.C. and Lee, R.C.K., "A Bayesian Approach to Problems in Stochastic Estimation and Control", 1964. |
| [JULIER-UHLMANN-1997] | Julier, S.J. and Uhlmann, J.K., "A New Extension of the Kalman Filter to Nonlinear Systems", 1997. |
| [JULIER-UHLMANN-CI-1997] | Julier, S.J. and Uhlmann, J.K., "A Non-Divergent Estimation Algorithm in the Presence of Unknown Correlations", 1997. |
| [KALMAN-1960] | Kalman, R.E., "A New Approach to Linear Filtering and Prediction Problems", *J. Basic Engineering*, 82(1):35-45, 1960. |
| [KUHN-1955] | Kuhn, H.W., "The Hungarian Method for the Assignment Problem", 1955. |
| [LLINAS-HALL-1997] | Llinas, J. and Hall, D.L., "An Introduction to Multi-Sensor Data Fusion", *Proc. IEEE*, 1997. |
| [MAHLER-2003] | Mahler, R.P.S., "Multitarget Bayes Filtering via First-Order Multitarget Moments", 2003. |
| [MAHLER-2007] | Mahler, R.P.S., *Statistical Multisource-Multitarget Information Fusion*, Artech House, 2007. |
| [MURPHY-2000] | Murphy, C.K., "Combining Belief Functions When Evidence Conflicts", 2000. |
| [PEARL-1988] | Pearl, J., *Probabilistic Reasoning in Intelligent Systems*, Morgan Kaufmann, 1988. |
| [REID-1979] | Reid, D.B., "An Algorithm for Tracking Multiple Targets", *IEEE Trans. AC*, 24(6):843-854, 1979. |
| [SHAFER-1976] | Shafer, G., *A Mathematical Theory of Evidence*, Princeton University Press, 1976. |
| [SMETS-1990] | Smets, P., "The Combination of Evidence in the Transferable Belief Model", 1990. |
| [SMETS-KENNES-1994] | Smets, P. and Kennes, R., "The Transferable Belief Model", *Artificial Intelligence*, 66(2):191-234, 1994. |
| [SMITH-1962] | Smith, G.L. et al., "Application of Statistical Filter Theory", NASA TR R-135, 1962. |
| [STEINBERG-1999] | Steinberg, A.N. et al., "Revisions to the JDL Data Fusion Model", *Proc. SPIE 3719*, 1999. |
| [TSAMARDINOS-2006] | Tsamardinos, I. et al., "The Max-Min Hill-Climbing Bayesian Network Structure Learning Algorithm", 2006. |
| [WALTZ-LLINAS-1990] | Waltz, E. and Llinas, J., *Multisensor Data Fusion*, Artech House, 1990. |
| [YAGER-1987] | Yager, R.R., "On the Dempster-Shafer Framework and New Combination Rules", 1987. |
| [ZADEH-1965] | Zadeh, L.A., "Fuzzy Sets", *Information and Control*, 8(3):338-353, 1965. |
| [ZADEH-1986] | Zadeh, L.A., "A Simple View of the Dempster-Shafer Theory of Evidence", *AI Magazine*, 7(2):85-90, 1986. |
| [ZHANG-1994] | Zhang, L., "Representation, Independence, and Combination of Evidence in the Dempster-Shafer Theory", 1994. |
| [MAMDANI-1975] | Mamdani, E.H. and Assilian, S., "An Experiment in Linguistic Synthesis with a Fuzzy Logic Controller", 1975. |
| [SUGENO-1985] | Sugeno, M., "An Introductory Survey of Fuzzy Control", *Information Sciences*, 36(1-2):59-83, 1985. |

**Cited in:** TSG.4, TSG.30.

### B.2.16 Academic Papers — Differential Dataflow & Distributed Systems

| Tag | Reference |
|-----|-----------|
| [ABADI-FOSSACS2015] | Abadi, M. et al., "Foundations of Differential Dataflow", *FoSSaCS*, LNCS 9034, pp. 71-83, 2015. |
| [BERNSTEIN-MVCC] | Bernstein, P.A. and Goodman, N., "Multiversion Concurrency Control — Theory and Algorithms", *ACM TODS*, 8(4):465-483, 1983. |
| [BIRKHOFF-1967] | Birkhoff, G., *Lattice Theory*, 3rd ed., AMS Colloquium Publications, Vol. 25, 1967. |
| [DAVEY-PRIESTLEY] | Davey, B.A. and Priestley, H.A., *Introduction to Lattices and Order*, 2nd ed., Cambridge University Press, 2002. |
| [FIDGE-1988] | Fidge, C.J., "Timestamps in Message-Passing Systems That Preserve the Partial Ordering", 1988. |
| [GUPTA-IVM] | Gupta, A. and Mumick, I.S., "Maintenance of Materialized Views: Problems, Techniques, and Applications", *IEEE DE Bulletin*, 18(2):3-18, 1995. |
| [LAMPORT-1978] | Lamport, L., "Time, Clocks, and the Ordering of Events in a Distributed System", *CACM*, 21(7):558-565, 1978. |
| [MATERIALIZE-FORMALISM] | Materialize Inc., "Platform Formalism." https://github.com/MaterializeInc/materialize, 2024. |
| [MATERIALIZE-LIFE] | Materialize Inc., "Understanding Differential Dataflow." https://materialize.com/blog/life-in-differential-dataflow/, 2020. |
| [MATERIALIZE-SCRATCH] | Materialize Inc., "Building Differential Dataflow from Scratch." https://materialize.com/blog/differential-from-scratch/, 2020. |
| [MATTERN-1989] | Mattern, F., "Virtual Time and Global States of Distributed Systems", 1989. |
| [MCSHERRY-CIDR2013] | McSherry, F. et al., "Differential Dataflow", *CIDR*, 2013. |
| [MURRAY-SOSP2013] | Murray, D.G. et al., "Naiad: A Timely Dataflow System", *SOSP*, pp. 439-455, 2013. |
| [ROTA-1964] | Rota, G.-C., "On the Foundations of Combinatorial Theory I", 1964. |
| [SHAPIRO-2011] | Shapiro, M. et al., "Conflict-free Replicated Data Types", *SSS*, LNCS 6976, pp. 386-400, 2011. |

**Cited in:** TSG.26.

### B.2.17 Academic Papers — Geospatial Mathematics

| Tag | Reference |
|-----|-----------|
| [BECKMANN-1990] | Beckmann, N. et al., "The R*-tree: An efficient and robust access method for points and rectangles", *ACM SIGMOD*, pp. 322-331, 1990. |
| [ESTER-1996] | Ester, M. et al., "A density-based algorithm for discovering clusters in large spatial databases with noise", *KDD*, pp. 226-231, 1996. |
| [GUTTMAN-1984] | Guttman, A., "R-trees: A dynamic index structure for spatial searching", *ACM SIGMOD*, pp. 47-57, 1984. |
| [KARNEY-2013] | Karney, C.F.F., "Algorithms for geodesics", *Journal of Geodesy*, 87(1):43-55, 2013. |
| [MCINNES-2017] | McInnes, L. et al., "hdbscan: Hierarchical density based clustering", *JOSS*, 2(11):205, 2017. |
| [NASA-CPR] | NASA Langley Formal Methods, "A Formal Analysis of the Compact Position Reporting Algorithm", 2017. |
| [SNYDER-1987] | Snyder, J.P., "Map Projections — A Working Manual", USGS Professional Paper 1395, 1987. |
| [VINCENTY-1975] | Vincenty, T., "Direct and inverse solutions of geodesics on the ellipsoid", *Survey Review*, 23(176):88-93, 1975. |
| [WGS84] | Department of Defense, "World Geodetic System 1984", NIMA TR 8350.2, 3rd ed., 2000. |

**Cited in:** TSG.30.

### B.2.18 Books

| Tag | Reference |
|-----|-----------|
| [COVER-THOMAS] | Cover, T.M. and Thomas, J.A., *Elements of Information Theory*, 2nd ed., Wiley-Interscience, 2006. |
| [HEUER-1999] | Heuer, R.J., *Psychology of Intelligence Analysis*, CIA Center for the Study of Intelligence, 1999. |
| [HEUER-PHERSON-2010] | Heuer, R.J. and Pherson, R.H., *Structured Analytic Techniques for Intelligence Analysis*, CQ Press, 2010 (3rd ed. 2020). |
| [KNUTH-1997] | Knuth, D.E., *The Art of Computer Programming, Volume 2: Seminumerical Algorithms*, 3rd ed., Addison-Wesley, 1997. |
| [KREBS-2002] | Krebs, V.E., "Mapping Networks of Terrorist Cells", *Connections*, 2002. |
| [DARK-NETWORKS] | Milward, H.B. and Raab, J., "Dark Networks as Organizational Problems", *International Public Management Journal*, 2006. |
| [WASSERMAN-FAUST-1994] | Wasserman, S. and Faust, K., *Social Network Analysis: Methods and Applications*, Cambridge University Press, 1994. |

**Cited in:** TSG.3, TSG.27, TSG.28, TSG.29.

### B.2.19 EW Doctrine & Military Organizations

| Tag | Reference |
|-----|-----------|
| [AOC] | Association of Old Crows, "Mission & History." https://crows.org/mission-and-history/ |
| [ARMY-EWPMT] | U.S. Army, "4ID Soldiers Test New EW Spectrum Management Tool". |
| [ARMY-MDEP] | U.S. Army, "Multi-Domain Effects Platoon: Brigade-Level MDO Solution". |
| [CCOE] | U.S. Army Cyber Center of Excellence. https://cybercoe.army.mil/ |
| [CEMA-2024] | Association of Old Crows, "CEMA 2024 Conference", Aberdeen Proving Ground, April-May 2024. |
| [CRFS-DF] | CRFS, "Radio Direction Finding Techniques and Applications for EW and SIGINT". |
| [DCGS] | DoD, "Distributed Common Ground System Overview". |
| [DEFSCOOP-EWIR] | DefenseScoop, "Army EW Data Pilot for Rapid Reprogramming", May 2024. |
| [DISA-EMBM] | The Defense Post, "DISA Orders EMBM Prototype from Palantir", April 2024. |
| [EMSOPEDIA] | EMSOPEDIA, "Electromagnetic Spectrum Operations". |
| [EWIRDB] | "Electronic Warfare Integrated Reprogramming Database", GlobalSecurity.org. |
| [GLOBALSEC-TPED] | GlobalSecurity.org, "Tasking, Processing, Exploitation & Dissemination". |
| [I2-METHODOLOGY] | i2 Group, "i2 Analyst's Notebook — Discover and deliver actionable intelligence". |
| [JADC2-AFCEA] | AFCEA, "Joint EW, Cyber and Spectrum Operations Need Work". |
| [JEC-STRATCOM] | U.S. Strategic Command, "Joint Electromagnetic Spectrum Operations Center", July 2023. |
| [JED] | "Journal of Electromagnetic Dominance", Association of Old Crows. https://www.jedonline.com/ |
| [MDO-WIKI] | "Multi-Domain Operations", Wikipedia. |
| [SISO-2023] | SISO, "Establishing EOB Requirements for Division Planning", 2023 SIW. |

**Cited in:** TSG.36.

### B.2.20 Human Factors & Cognitive Engineering

| Tag | Reference |
|-----|-----------|
| [CWA-VICENTE] | Vicente, K.J., *Cognitive Work Analysis*, Lawrence Erlbaum Associates, 1999. |
| [ENDSLEY-1995] | Endsley, M.R., "Toward a Theory of Situation Awareness in Dynamic Systems", *Human Factors*, 37(1):32-64, 1995. |
| [ENDSLEY-OOTL] | Endsley, M.R. and Kiris, E.O., "The Out-of-the-Loop Performance Problem", *Human Factors*, 37(2):381-394, 1995. |
| [RASMUSSEN-1983] | Rasmussen, J., "Skills, Rules, and Knowledge; Signals, Signs, and Symbols", *IEEE SMC*, 13(3):257-266, 1983. |
| [RASMUSSEN-1986] | Rasmussen, J., *Information Processing and Human-Machine Interaction*, North-Holland, 1986. |

**Cited in:** TSG.4, TSG.36.

### B.2.21 Software Engineering & Architecture

| Tag | Reference |
|-----|-----------|
| [BULKHEAD-PATTERN] | Microsoft Azure Architecture Center, "Bulkhead Pattern". |
| [BURNS-SIDECARS] | Burns, B. and Oppenheimer, D., "Design Patterns for Container-Based Distributed Systems", USENIX HotCloud, 2016. |
| [FOWLER-CB] | Fowler, M., "CircuitBreaker", martinfowler.com, 2014. |
| [JSONRPC-ERRORS] | JSON-RPC Working Group, "JSON-RPC 2.0 Specification — Error Object". |
| [LTTB] | Steinarsson, S., "Downsampling Time Series for Visual Representation", MSc Thesis, 2013. |
| [NYGARD-2007] | Nygard, M.T., *Release It! Design and Deploy Production-Ready Software*, Pragmatic Bookshelf, 2007. |
| [NYGARD-2018] | Nygard, M.T., *Release It! Second Edition*, Pragmatic Bookshelf, 2018. |
| [OTEL-SPANS] | OpenTelemetry, "Traces — Concepts". |
| [OTEL-STATUS] | OpenTelemetry, "Span Status". |
| [SRE-BOOK] | Beyer, B. et al., *Site Reliability Engineering*, O'Reilly, 2016. |

**Cited in:** TSG.22, TSG.34, TSG.35.

### B.2.22 Competitive Intelligence Platforms

| Tag | Reference |
|-----|-----------|
| [BAE-NORMA] | BAE Systems, "NORMA SIGINT Solution" (public overview). |
| [CROWDSTRIKE] | CrowdStrike, "Falcon X". |
| [GNU-RADIO] | GNU Radio Project. https://gnuradio.org |
| [MALTEGO] | Maltego Technologies, "Product Documentation". |
| [MANDIANT] | Mandiant (Google), "Advantage Platform". |
| [PALANTIR-GOTHAM] | Palantir Technologies, "Gotham Platform" (public documentation). |
| [REC-FUTURE] | Recorded Future, "Platform Overview". |

**Cited in:** TSG.5.

### B.2.23 Geospatial Libraries

| Tag | Reference |
|-----|-----------|
| [EPSG] | IOGP, "EPSG Geodetic Parameter Registry." https://epsg.io |
| [GEOGRAPHICLIB] | Karney, C.F.F., "GeographicLib." https://geographiclib.sourceforge.io |
| [MOVABLE-TYPE] | Veness, C., "Calculate distance, bearing and more between Latitude/Longitude points." https://movable-type.co.uk/scripts/latlong.html |
| [PROJ] | PROJ Contributors, "PROJ Coordinate Transformation Software Library." https://proj.org |
| [S2-GEOMETRY] | Google, "S2 Geometry Library." https://s2geometry.io |
| [TURF] | Mapbox, "Turf.js — Advanced geospatial analysis for browsers and Node.js." https://turfjs.org |
| [UBER-H3] | Uber Engineering, "H3: Uber's Hexagonal Hierarchical Spatial Index." https://h3geo.org |

**Cited in:** TSG.30.

### B.2.24 DSP Reference Resources

| Tag | Reference |
|-----|-----------|
| [DSPRELATED] | Smith III, J.O., "Mathematics of the DFT." https://www.dsprelated.com/freebooks/mdft/ |
| [MIDI-SPEC] | MIDI Manufacturers Association, "MIDI 1.0 Detailed Specification". |
| [OSC-SPEC] | Wright, M. and Freed, A., "Open Sound Control: A New Protocol for Communicating with Sound Synthesizers". |

**Cited in:** TSG.8, TSG.25.

---

## B.3 Citation Index

This index maps each reference tag to the RFC sections that cite it. Tags appearing
in 5 or more sections are marked with a dagger (dagger).

| Tag | Sections Citing |
|-----|----------------|
| [ADR-001] | TSG.1, TSG.6, TSG.7, TSG.26, TSG.29, TSG.31 |
| [ADR-002] | TSG.1, TSG.6, TSG.9, TSG.11 |
| [ADR-003] | TSG.1, TSG.6, TSG.9, TSG.11 |
| [ADR-004] | TSG.1, TSG.6, TSG.7 |
| [ADR-005] | TSG.1, TSG.6, TSG.10, TSG.22, TSG.24, TSG.32 |
| [ADR-006] | TSG.1, TSG.6, TSG.7, TSG.32 |
| [ADR-007] | TSG.1, TSG.6, TSG.20, TSG.21 |
| [ADR-008] | TSG.1, TSG.6, TSG.32 |
| [ADR-009]^dagger | TSG.1, TSG.2, TSG.3, TSG.5, TSG.6, TSG.8, TSG.33 |
| [ADR-010] | TSG.1, TSG.2, TSG.3, TSG.6, TSG.29, TSG.36 |
| [ADR-011]^dagger | TSG.1, TSG.2, TSG.6, TSG.7, TSG.11, TSG.16, TSG.18, TSG.19, TSG.34, TSG.36 |
| [ADR-012] | TSG.1, TSG.2, TSG.5, TSG.6, TSG.20, TSG.21, TSG.22 |
| [ADR-013]^dagger | TSG.1, TSG.2, TSG.3, TSG.5, TSG.6, TSG.20, TSG.21, TSG.22, TSG.29, TSG.31 |
| [EFFECT]^dagger | TSG.1, TSG.6, TSG.7, TSG.10, TSG.11, TSG.13, TSG.16, TSG.18, TSG.19, TSG.32 |
| [EFFECT-ATOM] | TSG.9, TSG.10, TSG.11, TSG.19, TSG.32 |
| [EFFECT-SCHEMA] | TSG.1, TSG.6, TSG.7, TSG.8, TSG.9, TSG.11, TSG.32 |
| [NATS]^dagger | TSG.1, TSG.6, TSG.7, TSG.8, TSG.11, TSG.17 |
| [RFC2119]^dagger | All 36 RFC sections |
| [RFC8174]^dagger | All 36 RFC sections |
| [SIGMF]^dagger | TSG.1, TSG.7, TSG.8, TSG.11, TSG.16, TSG.18, TSG.25, TSG.34, TSG.36 |
| [STIX21] / [STIX-2.1]^dagger | TSG.2, TSG.3, TSG.4, TSG.8, TSG.12, TSG.13, TSG.14, TSG.15, TSG.21, TSG.28, TSG.33 |
| [TAXII21] / [TAXII-2.1] | TSG.3, TSG.14, TSG.15, TSG.33 |

---

## B.4 Statistics

| Metric | Value |
|--------|-------|
| **Total unique reference tags** | ~260 |
| **Normative references** | 37 |
| **Informative references** | ~223 |
| **IETF RFCs** | 8 |
| **OASIS standards** | 7 |
| **IEEE/W3C standards** | 6 |
| **Military/Intel standards** | 17 |
| **Academic papers** | ~110 |
| **Software libraries** | ~60 |
| **ADRs** | 13 |
| **Internal cross-references** | ~40 |
| **Most cited (non-RFC)** | [EFFECT] (10+ sections), [SIGMF] (9 sections), [ADR-011] (10 sections) |

---

*Appendix B compiled 2026-02-18 by Val (arch-reviewer-3). All references extracted
from the 36 RFC section files in `docs/tsingou/rfc/rfc-section-*.md`.*
