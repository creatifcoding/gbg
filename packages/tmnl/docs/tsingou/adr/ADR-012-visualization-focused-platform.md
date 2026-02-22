# ADR-012: Tsingou as SIGINT Visualization Platform — Palantir for Knowledge Graph

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user), Val (architect)  
**Evidence**: Questionnaire `tsingou-sigint-scope` — Q7: "lol frankly we'll be leveraging palantir, tsingou is really focused on visualization in the SIGINT domain."

---

## Context

Palantir Gotham's core value proposition is its **dynamic ontology** — a persistent entity/knowledge graph where entities (people, organizations, events, locations, assets) are connected by typed relationships, versioned over time, and queried across sessions. Building a comparable knowledge graph from scratch is a multi-year, multi-team effort.

Tsingou's strength is different: **real-time, multi-layer, multi-source signal visualization** — something Palantir's web-based UI does not do well.

## Decision

**Tsingou is the visualization layer. Palantir (and other KG platforms) handle entity persistence.**

### What Tsingou Does

| Capability | Description | Layer |
|-----------|-------------|-------|
| **Real-time signal rendering** | Live feed visualization across 4 composited layers | R3F + visx + p5 + DOM |
| **Multi-source ingestion** | 8+ adapter types, hot-plug, schema validation | Adapter layer |
| **Incremental computation** | d2ts differential dataflow for joins, windowing, aggregation | Pipeline layer |
| **STIX-native signals** | Every signal is a STIX observed-data object | Schema layer |
| **Analysis techniques** | Link analysis, timeline, geospatial, anomaly, spectrum, POL, ATT&CK | Rendering layer |
| **SDR integration** | GNU Radio bridge + RTL-SDR sidecar for RF analysis | Adapter layer |

### What Tsingou Defers to External Platforms

| Capability | Platform | Integration |
|-----------|----------|-------------|
| **Persistent entity graph** | Palantir Gotham / Foundry | STIX ↔ Ontology mapping |
| **IoC sharing & correlation** | MISP | STIX event import/export |
| **CTI knowledge management** | OpenCTI | Bidirectional STIX connector |
| **Incident response workflow** | TheHive | Push alerts as cases |
| **Automated enrichment** | Cortex | Observable → analyzer → result |
| **Threat modeling framework** | MITRE ATT&CK | ATT&CK ID mapping in STIX |

### Integration Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Tsingou (Visualization)                │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │ R3F      │  │ visx     │  │ p5       │  │ DOM      ││
│  │ 3D graph │  │ timeline │  │ spectrum │  │ alerts   ││
│  │ link viz │  │ heatmap  │  │ waterfall│  │ tables   ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘│
│       │              │              │              │      │
│       └──────────────┴──────────────┴──────────────┘      │
│                          │                                │
│              ┌───────────▼────────────┐                   │
│              │ d2ts Pipeline          │                   │
│              │ (ingest → derived →    │                   │
│              │  output → atoms)       │                   │
│              └───────────┬────────────┘                   │
│                          │                                │
│              ┌───────────▼────────────┐                   │
│              │ STIX-native Signals    │                   │
│              │ (observed-data objects) │                   │
│              └───────────┬────────────┘                   │
└──────────────────────────┼────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │   NATS (Holonet)        │
              │   + TAXII bridge        │
              └────┬───────┬────────┬───┘
                   │       │        │
          ┌────────▼──┐ ┌──▼─────┐ ┌▼──────────┐
          │ Palantir  │ │ OpenCTI│ │ MISP      │
          │ Gotham    │ │        │ │           │
          │ (KG)      │ │ (CTI)  │ │ (IoC)    │
          └───────────┘ └────────┘ └───────────┘
```

### Palantir Integration Specifics

Palantir Gotham exposes a REST API (v2.0):
- `GET /objects/{objectRid}` — Retrieve entity by RID
- `POST /objects/search` — Search entities by properties
- `GET /objects/{objectRid}/links` — Get entity relationships
- `POST /objects` — Create/update entities

Tsingou → Palantir flow:
1. Tsingou d2ts graph produces STIX observed-data with entity references
2. Entity extraction (NER, regex, IP parsing) identifies SDOs
3. SDOs published to NATS subject `tsingou.entity.>` 
4. Palantir connector subscribes, maps STIX SDOs → Gotham objects
5. Analyst queries Gotham for entity context → results flow back to Tsingou rendering

## Consequences

### Positive
- **Focus** — Tsingou does what it's best at (visualization + signal processing)
- **Leverage** — Palantir's billions of dollars in KG development vs. our effort
- **Composable** — STIX-native model makes integration natural
- **Not vendor-locked** — OpenCTI or Neo4j can replace Palantir; interface is STIX

### Negative
- **Dependency** — Full workflow requires Palantir (or equivalent) for entity persistence
- **Latency** — Round-trip to Palantir for entity enrichment adds latency
- **Cost** — Palantir licenses are expensive (though Foundry has more accessible tiers)

### Mitigation
- Design the Palantir integration as an **optional connector** — Tsingou works standalone for signal visualization
- NATS KV provides lightweight entity caching for common lookups
- OpenCTI (free, open-source) can serve as the KG for non-Palantir deployments
