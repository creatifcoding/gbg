# TMNL-RFC-002: Tsingou — Signal Intelligence Visualization Platform

```
RFC:           002
Title:         Tsingou — Signal Intelligence Visualization Platform Specification
Status:        DRAFT
Date:          2026-02-18
Authors:       Prime (architect), Val (agent coordinator)
Contributors:  sigint-researcher, stix-specialist, arch-reviewer, sdr-analyst,
               dsp-specialist, dataflow-theorist, graph-theorist,
               fusion-mathematician, ew-doctrine-advisor
Category:      Standards Track (Internal)
Supersedes:    N/A
Updates:       TMNL-RFC-001 (IIoT Platform Specification)
```

---

## Abstract

This document specifies the architecture, protocols, and mathematical
foundations of the Tsingou Signal Intelligence Visualization Platform.
Tsingou is a desktop application built on Effect-TS, NATS messaging,
and differential dataflow (d2ts) that ingests, processes, correlates,
and visualizes signals from heterogeneous intelligence sources including
SIGINT, OSINT, HUMINT, and GEOINT feeds.

The platform employs a 4-layer composited rendering architecture (React
Three Fiber, visx, p5.js, DOM) driven by an atom-as-state reactive
model, with STIX 2.1 as the interoperability format and TAXII 2.1 as
the transport protocol. Signal processing leverages differential
dataflow for incremental computation with cross-source joins, temporal
windowing, and anomaly detection.

This specification is organized into 36 normative and informative
sections across 8 parts, plus 6 appendices.

---

## Status of This Memo

This document is a DRAFT specification for internal use within the
TMNL project. It has not been submitted to any standards body. The
key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY",
and "OPTIONAL" in this document are to be interpreted as described
in BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in
ALL CAPITALS, as shown here.

---

## Conventions and Terminology

### Normative Language

This document uses RFC 2119 / RFC 8174 keywords throughout. Sections
marked "(Informative)" use normative language descriptively, not
prescriptively. Sections marked "(Normative)" contain binding
requirements for conforming implementations.

### Citation Format

References use bracketed keys (e.g., `[MCSHERRY2013]`) defined in
Appendix B: Bibliography. Inline code references use monospace font
with file paths relative to `packages/tmnl/`.

### Section Numbering

All sections use the `TSG.N` prefix (Tsingou Section Group). Subsections
use dotted notation (e.g., `TSG.7.3`). Appendices use letter prefixes
(e.g., `Appendix A`).

### Signal Kind Identifiers

Signal kinds are lowercase strings matching the discriminant field of
BaseSignal: `http`, `rss`, `nats`, `websocket`, `file-watch`, `serial`,
`midi`, `osc`, `sdr`. See Appendix C for the full catalog.

---

## Table of Contents

### PART I: DOMAIN & CONTEXT (Informative)

| Section | Title | File | Lines | Status |
|---------|-------|------|-------|--------|
| TSG.1 | Introduction & Vision | `rfc-section-introduction.md` | — | PENDING |
| TSG.2 | SIGINT/OSINT Domain Reference | `rfc-section-sigint-domain.md` | 1,129 | COMPLETE |
| TSG.3 | Intelligence Cycle | `rfc-section-intelligence-cycle.md` | 732 | COMPLETE |
| TSG.4 | Data Fusion Mathematics | `rfc-section-data-fusion-mathematics.md` | 1,607 | COMPLETE |
| TSG.5 | Competitive Analysis | `rfc-section-competitive-analysis.md` | 648 | COMPLETE |

### PART II: ARCHITECTURE (Normative)

| Section | Title | File | Lines | Status |
|---------|-------|------|-------|--------|
| TSG.6 | Architecture Overview | `rfc-section-architecture-overview.md` | 808 | COMPLETE |
| TSG.7 | Signal Pipeline & d2ts | `rfc-section-signal-pipeline.md` | 812 | COMPLETE |
| TSG.8 | BaseSignal Schema | `rfc-section-base-signal-schema.md` | 1,682 | COMPLETE |
| TSG.9 | Source Adapter Contract | `rfc-section-source-adapters.md` | 1,952 | COMPLETE |
| TSG.10 | State Management (Atom-as-State) | `rfc-section-state-management.md` | 834 | COMPLETE |
| TSG.11 | NATS Messaging Fabric | `rfc-section-nats-fabric.md` | — | PENDING |

### PART III: INTEROPERABILITY (Normative)

| Section | Title | File | Lines | Status |
|---------|-------|------|-------|--------|
| TSG.12 | STIX 2.1 Data Model | `rfc-section-stix-data-model.md` | 842 | COMPLETE |
| TSG.13 | BaseSignal ↔ STIX Codec | `rfc-section-stix-codec.md` | 1,003 | COMPLETE |
| TSG.14 | TAXII 2.1 Transport | `rfc-section-taxii-transport.md` | 773 | COMPLETE |
| TSG.15 | CTI Platform Interop | `rfc-section-cti-platform-interop.md` | 954 | COMPLETE |

### PART IV: SDR & RF INTEGRATION (Normative)

| Section | Title | File | Lines | Status |
|---------|-------|------|-------|--------|
| TSG.16 | SDR Hardware Landscape | `rfc-section-sdr-hardware.md` | 940 | COMPLETE |
| TSG.17 | GNU Radio Bridge | `rfc-section-gnu-radio-bridge.md` | 753 | COMPLETE |
| TSG.18 | SigMF Codec | `rfc-section-sigmf-codec.md` | 1,334 | COMPLETE |
| TSG.19 | Spectrum Visualization | `rfc-section-spectrum-visualization.md` | 1,454 | COMPLETE |

### PART V: RENDERING & VISUALIZATION (Normative)

| Section | Title | File | Lines | Status |
|---------|-------|------|-------|--------|
| TSG.20 | 4-Layer Rendering Surface | `rfc-section-rendering-surface.md` | 813 | COMPLETE |
| TSG.21 | R3F 3D Scene Layer | `rfc-section-r3f-layer.md` | — | PENDING |
| TSG.22 | visx Data Visualization Layer | `rfc-section-visx-layer.md` | — | PENDING |
| TSG.23 | p5 Generative Layer | `rfc-section-p5-layer.md` | 1,636 | COMPLETE |
| TSG.24 | DOM Control Layer | `rfc-section-dom-layer.md` | 1,517 | COMPLETE |

### PART VI: ANALYSIS & MATHEMATICS (Normative)

| Section | Title | File | Lines | Status |
|---------|-------|------|-------|--------|
| TSG.25 | DSP Foundations | `rfc-section-dsp-foundations.md` | 1,701 | COMPLETE |
| TSG.26 | Differential Dataflow Theory | `rfc-section-differential-dataflow.md` | 1,505 | COMPLETE |
| TSG.27 | Statistical Analysis & Anomaly Detection | `rfc-section-statistical-analysis.md` | 1,624 | COMPLETE |
| TSG.28 | Graph Theory & Link Analysis | `rfc-section-graph-theory.md` | 1,904 | COMPLETE |
| TSG.29 | Information Theory | `rfc-section-information-theory.md` | 1,618 | COMPLETE |
| TSG.30 | Geospatial Mathematics | `rfc-section-geospatial-math.md` | 1,645 | COMPLETE |
| TSG.31 | Analysis Techniques Catalog | `rfc-section-analysis-techniques.md` | 1,872 | COMPLETE |

### PART VII: IMPLEMENTATION (Normative)

| Section | Title | File | Lines | Status |
|---------|-------|------|-------|--------|
| TSG.32 | Effect-TS Implementation Architecture | `rfc-section-effect-architecture.md` | 1,926 | COMPLETE |
| TSG.33 | Palantir Knowledge Graph Integration | `rfc-section-palantir-integration.md` | 1,645 | COMPLETE |
| TSG.34 | Deployment Topology (Tauri + Sidecars) | `rfc-section-deployment-topology.md` | 2,178 | COMPLETE |
| TSG.35 | Error Handling & Tagged Errors | `rfc-section-error-handling.md` | 2,113 | COMPLETE |

### PART VII-B: DOCTRINE ALIGNMENT (Informative)

| Section | Title | File | Lines | Status |
|---------|-------|------|-------|--------|
| TSG.36 | EW/SIGINT Doctrine Alignment | `rfc-section-ew-doctrine.md` | 1,826 | COMPLETE |

### PART VIII: APPENDICES (Informative)

| Appendix | Title | File | Lines | Status |
|----------|-------|------|-------|--------|
| A | ADR Cross-Reference Index | `../adr/INDEX.md` | 278 | COMPLETE |
| B | Bibliography | `bibliography.md` | — | PENDING |
| C | Signal Kind Catalog | `appendix-signal-kinds.md` | — | PENDING |
| D | STIX Mapping Tables | `appendix-stix-mappings.md` | — | PENDING |
| E | Research Document Index | `appendix-research-index.md` | — | PENDING |
| F | Glossary & Acronyms | `appendix-glossary.md` | — | PENDING |

---

## Metrics Summary

### Section Statistics

| Metric | Value |
|--------|-------|
| Total RFC sections | 36 |
| Sections complete | 32 |
| Sections pending | 4 (TSG.1, TSG.11, TSG.21, TSG.22) |
| Total section lines | 43,780 |
| Average lines/section | 1,368 |
| Longest section | TSG.34 Deployment Topology (2,178 lines) |
| Shortest section | TSG.5 Competitive Analysis (648 lines) |

### Research Statistics

| Metric | Value |
|--------|-------|
| Total research files | 21 |
| Total research lines | 17,991 |
| Average lines/file | 857 |
| Longest research | research-stix-sdo-catalog.md (2,320 lines) |

### Combined Output

| Category | Files | Lines |
|----------|-------|-------|
| RFC sections (complete) | 32 | 43,780 |
| Research files | 21 | 17,991 |
| ADR Index | 1 | 278 |
| Assembly manifest | 1 | 170 |
| **Subtotal (on disk)** | **55** | **62,219** |
| Pending sections (4) | 4 | ~6,000 est. |
| Pending appendices (5) | 5 | ~3,500 est. |
| This document | 1 | ~400 |
| **Estimated final** | **65** | **~72,000** |

### Agent Contribution Matrix

| Agent | Sections Written | Total Lines | Research Lines |
|-------|-----------------|-------------|----------------|
| arch-reviewer | TSG.6, TSG.7, TSG.8, TSG.10, TSG.20, INDEX | 5,227 | — |
| fusion-mathematician | TSG.4, TSG.23, TSG.27, TSG.35 | 6,980 | 849 |
| dsp-specialist | TSG.25, TSG.30, TSG.32 | 5,272 | 2,018 |
| dataflow-theorist | TSG.26, TSG.29, TSG.31 | 4,995 | 1,247 |
| graph-theorist | TSG.9, TSG.28, TSG.33 | 5,501 | 987 |
| ew-doctrine-advisor | TSG.34, TSG.36 | 4,004 | 507 |
| stix-specialist | TSG.12, TSG.13, TSG.14, TSG.15, TSG.24 | 5,089 | 4,621 |
| sigint-researcher | TSG.2, TSG.3, TSG.5 | 2,509 | 2,566 |
| sdr-analyst | TSG.16, TSG.17, TSG.18, TSG.19 | 4,481 | 4,196 |

---

## Assembly Instructions

### Step 1: Complete Pending Sections

The following sections are currently being written and must be completed
before final assembly:

1. **TSG.1: Introduction & Vision** — arch-reviewer
2. **TSG.11: NATS Messaging Fabric** — arch-reviewer
3. **TSG.21: R3F 3D Scene Layer** — dataflow-theorist
4. **TSG.22: visx Data Visualization Layer** — graph-theorist

### Step 2: Complete Appendices

1. **Appendix B: Bibliography** — ew-doctrine-advisor
2. **Appendix C: Signal Kind Catalog** — dsp-specialist
3. **Appendix D: STIX Mapping Tables** — sigint-researcher
4. **Appendix E: Research Document Index** — ew-doctrine-advisor
5. **Appendix F: Glossary & Acronyms** — dsp-specialist

### Step 3: Cross-Reference Validation

After all sections are complete:

1. Verify all `[KEY]` citations resolve to entries in Appendix B
2. Verify all `TSG.N` cross-references point to existing sections
3. Verify all normative requirements have unique identifiers
4. Verify terminology consistency against Appendix F
5. Verify signal kind references against Appendix C

### Step 4: Final Assembly

Concatenate all section files in TOC order into a single assembled
document: `TMNL-RFC-002-assembled.md`. Insert this front matter as
the document header. Generate final line counts.

---

## Architectural Decision Records

This RFC is grounded in 13 ADRs documented in `docs/tsingou/adr/`:

| ADR | Title | RFC Sections |
|-----|-------|-------------|
| ADR-001 | d2ts as Signal Pipeline Core | TSG.7, TSG.26 |
| ADR-002 | BaseSignal as Internal Format | TSG.8, TSG.12 |
| ADR-003 | 4-Layer Rendering Architecture | TSG.20-24 |
| ADR-004 | NATS as Universal Messaging Fabric | TSG.11, TSG.14 |
| ADR-005 | Atom-as-State Doctrine | TSG.10, TSG.32 |
| ADR-006 | Tagged Error Taxonomy | TSG.35 |
| ADR-007 | Source Adapter Hot-Plug Contract | TSG.9 |
| ADR-008 | Effect-TS Service Architecture | TSG.32 |
| ADR-009 | STIX 2.1 Interoperability Layer | TSG.12-15 |
| ADR-010 | Full Intelligence Cycle Support | TSG.2, TSG.3 |
| ADR-011 | SDR/GNU Radio Bridge Architecture | TSG.16-19 |
| ADR-012 | Entity System & RPC Architecture | TSG.32, TSG.33 |
| ADR-013 | Analysis Technique Selection | TSG.25-31 |

Full ADR cross-reference index: `docs/tsingou/adr/INDEX.md` (Appendix A).

---

## References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate
  Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in
  RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [RFC-001] TMNL-RFC-001: IIoT Platform Specification, 2026.
- [MCSHERRY2013] McSherry, F., Murray, D.G., Isaacs, R., Isard, M.,
  "Differential Dataflow", CIDR 2013.
- [STIX21] OASIS, "STIX Version 2.1", OASIS Standard, June 2021.
- [TAXII21] OASIS, "TAXII Version 2.1", OASIS Standard, June 2021.

See Appendix B for the complete bibliography.

---

*End of TMNL-RFC-002 Front Matter*
