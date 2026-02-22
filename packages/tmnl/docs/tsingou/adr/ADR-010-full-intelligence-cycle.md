# ADR-010: Full Intelligence Cycle Coverage — All 6 Phases

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user), Val (architect)  
**Evidence**: Questionnaire `tsingou-sigint-scope` — Q2: All 6 phases selected

---

## Context

The Intelligence Cycle is the foundational operational framework for intelligence work. It consists of 6 phases: Direction, Collection, Processing, Analysis, Dissemination, and Feedback. Most tools cover 1-3 phases — Tsingou covers all 6.

## Decision

**Tsingou owns the full intelligence cycle.** Each phase maps to specific Tsingou subsystems:

### Phase Mapping

| Phase | Tsingou Subsystem | Status |
|-------|-------------------|--------|
| **1. Direction** | Session configuration — define collection requirements, priority sources, focus areas, ATT&CK techniques of interest | Design |
| **2. Collection** | 8 Source Adapters — NATS, HTTP, WS, RSS, FileWatch, Serial, MIDI, OSC + SDR bridge + STIX/TAXII ingestion | **Built** |
| **3. Processing** | d2ts Ingest Graph — schema validation, normalization to STIX observed-data, metadata enrichment, dedup | **Built** (stubs) |
| **4. Analysis** | d2ts Derived Graph — correlation joins, temporal windowing, anomaly detection, pattern-of-life, ATT&CK mapping | **Built** (stubs) |
| **5. Dissemination** | STIX/TAXII export, NATS fan-out, alert atoms, MISP/OpenCTI/TheHive connectors, reporting | Design |
| **6. Feedback** | Analysis accuracy tracking, collection priority adjustment, d2ts graph tuning, session journal | Design |

### Direction Phase Design

```
Session Configuration
├── Collection Requirements
│   ├── Priority sources (ranked adapter list)
│   ├── Focus areas (keywords, entity names, IP ranges)
│   ├── ATT&CK techniques of interest
│   └── Time window (real-time vs. historical replay)
├── Analysis Parameters
│   ├── Anomaly thresholds (z-score, rate limits)
│   ├── Correlation rules (join conditions)
│   ├── Window durations (5s, 30s, 5min, 1hr)
│   └── Entity extraction rules (regex, NER)
└── Dissemination Rules
    ├── Alert conditions (threshold breaches)
    ├── Export targets (TAXII, MISP, file)
    └── Reporting cadence (continuous, periodic, on-demand)
```

### Dissemination Phase Design

```
Output Channels
├── Real-time
│   ├── NATS fan-out (internal subscribers)
│   ├── Atom state (rendering layers)
│   └── Alert notifications (threshold breaches → DOM layer)
├── Structured Export
│   ├── STIX 2.1 bundles (JSON)
│   ├── TAXII server (HTTP API)
│   ├── MISP events (via connector)
│   └── CSV/NDJSON dumps (file export)
└── Integration
    ├── OpenCTI connector (bidirectional STIX)
    ├── TheHive alerts (case creation)
    └── Cortex observables (enrichment requests)
```

### Feedback Phase Design

```
Feedback Loop
├── Analysis Accuracy
│   ├── Confirmed vs. false positive ratio per rule
│   ├── Signal quality scores per source
│   └── Entity resolution accuracy metrics
├── Collection Adjustment
│   ├── Automatic: increase polling frequency on high-yield sources
│   ├── Automatic: pause low-yield adapters
│   └── Manual: analyst adjusts requirements via Direction UI
└── Graph Tuning
    ├── Window duration auto-adjustment based on signal rate
    ├── Anomaly threshold calibration from feedback
    └── Join condition refinement from analyst corrections
```

## Consequences

### Positive
- **Complete workflow** — analyst never leaves Tsingou for any intelligence cycle phase
- **Closed-loop** — feedback adjusts collection and analysis automatically
- **Competitive with Palantir Gotham** on cycle coverage (though Tsingou defers KG to Palantir)

### Negative
- **Massive scope** — 6 phases × multiple subsystems = significant implementation work
- **Direction + Feedback require UI** — these are analyst-facing, not just pipeline
- **Dissemination requires external integration** — TAXII server, MISP connector, etc.

## Implementation Priority

1. Collection + Processing + Analysis (Wave 1 — **done**)
2. Dissemination — STIX export + alert atoms (Wave 2)
3. Direction — Session configuration UI (Wave 3)
4. Feedback — Accuracy tracking + auto-adjustment (Wave 4)
