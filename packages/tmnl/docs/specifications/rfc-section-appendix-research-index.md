# RFC-001 Appendix D: Research Document Index

```
Section:       Appendix D — Research Document Index
RFC:           001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        failure-runbook-writer (Val)
Created:       2026-02-09
```

---

## D.1 Purpose

This appendix catalogs the research corpus that informed TMNL-RFC-001. Nine
research documents and one bibliography were produced during the research phase,
totaling **8,136 lines** of primary research and **443 lines** of curated
bibliography (225+ entries across 16 categories).

All documents reside in `docs/specifications/` relative to `packages/tmnl/`.

---

## D.2 Research Documents

### D.2.1 Reactive ISA-95 for Metropolitan-Scale IIoT

| Field | Value |
|-------|-------|
| **File** | `research-reactive-isa95.md` |
| **Citation Key** | `[TMNL-REACTIVE-ISA95]` |
| **Authors** | realtime-philosopher (Val), isa95-architect (Val) |
| **Lines** | 1,182 |
| **Status** | Complete -- Revision 3 (Manufacturing Network Reframe) |

**Key topics**: ISA-95 limitations for reactive systems; RAMI 4.0, OPC UA
PubSub, NOA, AAS, and UNS extensions; reactive ISA-95 propagation model;
academic research on reactive manufacturing; event routing SLA by ISA-95
level; NATS subject hierarchy mapping; variable-depth hierarchy for
manufacturing networks.

**Informed RFC sections**: Reactive ISA-95 Hierarchy Specification,
Architectural Principles, Edge-First Architecture, Network Entity Types.

---

### D.2.2 Consistency Models for Metropolitan-Scale IIoT

| Field | Value |
|-------|-------|
| **File** | `research-consistency-models.md` |
| **Citation Key** | `[TMNL-CONSISTENCY]` |
| **Author** | consistency-theorist (Val) |
| **Lines** | 1,291 |
| **Status** | Complete |

**Key topics**: Consistency model taxonomy (linearizable through eventual);
ordering guarantees G-1 through G-7; ISA-95 level-to-consistency mapping;
NATS JetStream ordering mechanics; failure mode analysis; competing platform
consistency models (Kafka, AWS IoT, Azure DT); cross-organization consistency
for 200K-org networks.

**Informed RFC sections**: Two-Domain Consistency Model, Consistency
Guarantees & Implementation Mapping, Failure Modes & Recovery.

---

### D.2.3 Effect-TS Architecture Patterns for 200K-Org Network

| Field | Value |
|-------|-------|
| **File** | `research-effect-architecture.md` |
| **Citation Key** | `[TMNL-EFFECT-ARCH]` |
| **Author** | effect-specialist (Val) |
| **Lines** | 1,588 |
| **Status** | Complete (codebase-grounded) |

**Key topics**: `@effect/cluster` at 200K-org scale; Effect Machine as
organization state; Effect Schema for multi-tenant domain; RPC architecture
for manufacturing network; Stream architecture at 2M events/sec; Layer
composition at scale; testing strategies.

**Informed RFC sections**: Effect-TS Implementation Architecture,
Consistency Guarantees (entity sharding), Failure Modes (cluster failures).

---

### D.2.4 Manufacturing Commons -- Platform Economics

| Field | Value |
|-------|-------|
| **File** | `research-manufacturing-commons.md` |
| **Citation Key** | `[TMNL-MFG-COMMONS]` |
| **Author** | realtime-philosopher (Val) |
| **Lines** | 808 |
| **Status** | Complete -- Revision 2 (codebase-grounded) |

**Key topics**: Manufacturing commons thesis; cloud manufacturing and MaaS
literature; platform economics applied to manufacturing; federated
manufacturing networks; telescoping ISA-95 for variable-scale organizations;
network-level reactive semantics; edge-first architecture for small
manufacturers; two-tier consistency model.

**Informed RFC sections**: Introduction & Vision, Multi-Tenant Manufacturing
Network Architecture, Marketplace Protocol, Network Entity Types.

---

### D.2.5 Industry Leaders -- IIoT Platform Capabilities

| Field | Value |
|-------|-------|
| **File** | `research-industry-leaders.md` |
| **Citation Key** | `[TMNL-INDUSTRY]` |
| **Authors** | industry-analyst (Val), interface-visionary (Val) |
| **Lines** | 756 |
| **Status** | Complete |

**Key topics**: Siemens MindSphere/Industrial Edge; PTC ThingWorx; AVEVA
System Platform/PI System; Rockwell FactoryTalk/Plex; GE Vernova Proficy;
Ignition by Inductive Automation; cloud hyperscalers (AWS, Azure, GCP);
comparative analysis matrix; gap analysis for TMNL differentiation.

**Informed RFC sections**: Competitive Differentiation & Industry Analysis.

---

### D.2.6 Theoretical Foundations for Entity-Realtime Integration

| Field | Value |
|-------|-------|
| **File** | `research-theoretical-foundations.md` |
| **Citation Key** | `[TMNL-THEORY]` |
| **Author** | interface-visionary (Val) |
| **Lines** | 743 |
| **Status** | Complete |

**Key topics**: Endsley's Situational Awareness model (SA Levels 1-3);
Ecological Interface Design and abstraction hierarchy; Joint Cognitive
Systems; Information Foraging Theory; Cognitive Work Analysis; CPS theory;
event-driven architecture in safety-critical systems; manufacturing commons
extension (distributed SA, redacted causality, Ostrom's governance).

**Informed RFC sections**: Theoretical Foundations & Architectural Principles,
Introduction & Vision (cognitive framing).

---

### D.2.7 UNS & Metropolitan-Scale Event Distribution

| Field | Value |
|-------|-------|
| **File** | `research-uns-metropolitan.md` |
| **Citation Key** | `[TMNL-UNS]` |
| **Author** | uns-researcher (Val) |
| **Lines** | 733 |
| **Status** | Complete |

**Key topics**: UNS topic hierarchy for entity events; metropolitan-scale
event routing; ISA-95 operations event model; platform comparison (HiveMQ,
EMQX, NATS, Kafka); entity event schema patterns; NATS-specific architecture
recommendations; volume estimates; recommended topic hierarchy for GBG.

**Informed RFC sections**: Multi-Tenant Manufacturing Network Architecture,
Deployment Topology, Edge-First Architecture.

---

### D.2.8 Architecture Options Analysis

| Field | Value |
|-------|-------|
| **File** | `research-architecture-options.md` |
| **Citation Key** | `[TMNL-ARCH-OPT]` |
| **Author** | research agent (Val) |
| **Lines** | 643 |
| **Status** | Complete |

**Key topics**: Entity lifecycle event observation problem statement; five
architecture options compared (Machine.changes, RpcMiddleware.wrap, Manual
Tap, Hybrid, EventLog.changes); trade-off matrix; probability-weighted
recommendation; implementation effort estimates; risk analysis.

**Informed RFC sections**: Effect-TS Implementation Architecture
(entity-realtime integration pattern), Consistency Guarantees (observation
approach selection).

---

### D.2.9 @effect/cluster Distributed Entity Patterns

| Field | Value |
|-------|-------|
| **File** | `research-cluster-patterns.md` |
| **Citation Key** | `[TMNL-CLUSTER]` |
| **Author** | cluster-researcher (Val) |
| **Lines** | 392 |
| **Status** | Complete |

**Key topics**: Entity lifecycle (creation, destruction, migration); shard
management and HashRing; RunnerStorage and advisory locks; entity state
observation patterns; EntityManager mailbox semantics; fencing token
protocol for split-brain prevention.

**Informed RFC sections**: Consistency Guarantees (entity sharding, Y.8),
Failure Modes (FM.5 cluster failures, FM.5.4 split-brain), Effect-TS
Implementation Architecture.

---

## D.3 Bibliography

| Field | Value |
|-------|-------|
| **File** | `bibliography.md` |
| **Lines** | 443 |
| **Entries** | 225+ |
| **Categories** | 16 |

**Categories**: Normative Standards (ISA-95, ISA-18.2, FDA CFR 11, IEC 62443);
Protocols (Sparkplug-B, OPC UA, MQTT 5, AAS); Effect-TS Framework (12 refs);
Cognitive Science & Human Factors (17 refs); Distributed Systems Theory;
Microservices Architecture & Patterns; Domain-Driven Design; Database Theory;
Event-Driven Architecture; Platform Economics & Network Theory; Manufacturing
Network & Federation; Multi-Tenancy & Trust; Cloud Manufacturing & MaaS;
Cyber-Physical Systems; Smart Manufacturing & EDA (academic); Vendor
Documentation -- IIoT Platforms (40 refs); Internal Research Documents.

---

## D.4 Summary Statistics

| Metric | Value |
|--------|-------|
| Research documents | 9 |
| Total research lines | 8,136 |
| Bibliography entries | 225+ |
| Bibliography lines | 443 |
| Unique authors/agents | 7 (realtime-philosopher, isa95-architect, consistency-theorist, effect-specialist, industry-analyst, interface-visionary, uns-researcher) |
| Combined corpus | 8,579 lines |

### Document Size Distribution

```
research-effect-architecture.md    ████████████████████████████ 1,588
research-consistency-models.md     ██████████████████████       1,291
research-reactive-isa95.md         ████████████████████         1,182
research-manufacturing-commons.md  ██████████████               808
research-industry-leaders.md       █████████████                756
research-theoretical-foundations.md ████████████                 743
research-uns-metropolitan.md       ████████████                 733
research-architecture-options.md   ██████████                   643
research-cluster-patterns.md       ██████                       392
bibliography.md                    ███████                      443
```

### Research-to-RFC Traceability

| RFC Section | Primary Research Inputs |
|-------------|----------------------|
| Introduction & Vision | manufacturing-commons, theoretical-foundations |
| Architectural Principles | theoretical-foundations, reactive-isa95 |
| Reactive ISA-95 Hierarchy | reactive-isa95 |
| Multi-Tenant Network Architecture | uns-metropolitan, manufacturing-commons |
| Effect-TS Implementation | effect-architecture, architecture-options, cluster-patterns |
| Competitive Analysis | industry-leaders |
| Two-Domain Consistency | consistency-models |
| Consistency Guarantees | consistency-models, cluster-patterns |
| Security, Trust & Isolation | consistency-models (cross-org) |
| Failure Modes & Recovery | consistency-models, cluster-patterns, effect-architecture |
| Operational Runbooks | (derived from all implementation research) |
| Edge-First Architecture | manufacturing-commons, uns-metropolitan, reactive-isa95 |
| Network Entity Types | manufacturing-commons, reactive-isa95 |
| Deployment Topology | uns-metropolitan, manufacturing-commons |
| Marketplace Protocol | manufacturing-commons |
| Monitoring & Observability | effect-architecture |
