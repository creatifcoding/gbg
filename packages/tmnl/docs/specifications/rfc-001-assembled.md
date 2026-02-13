# RFC-001: Entity Lifecycle Event Distribution for Metropolitan-Scale Manufacturing Commons

```
RFC:           001
Title:         Entity Lifecycle Event Distribution for
               Metropolitan-Scale Manufacturing Commons
Status:        DRAFT
Authors:       TMNL Architecture Team
Created:       2026-02-09
Last Updated:  2026-02-09
Depends On:    ADR-004 (Entity System Architecture)
               Phase 5 (Realtime Stack — Epics 19, 20, 27)
               Holonet Integration Plan
Scale Target:  Metropolitan (200K+ organizations, 100+ sites/org,
               10K+ devices, 100K+ sensors)
```

---

## Abstract

This document specifies the architecture for entity lifecycle event distribution
across a metropolitan-scale manufacturing commons — a federated network of
200,000+ independent manufacturing organizations sharing capacity, intelligence,
and coordination through a common event distribution fabric.

The specification addresses three tightly coupled problems:

1. **Intra-organization entity observation**: A zero-handler-modification observer
   pattern leveraging `Machine.changes` on every `@effect/experimental/Machine`
   actor to capture all state transitions across 12 entity types without touching
   103 existing RPC handlers.

2. **Reactive ISA-95 propagation**: Formal rules for upward (U-1..U-4), downward
   (D-1..D-3), lateral (L-1..L-3), and outward (O-1..O-3) event propagation
   through a telescoping ISA-95 hierarchy that operates identically at 2 levels
   (machine shop) or 8 levels (enterprise supplier).

3. **Manufacturing commons architecture**: Multi-tenant network design where
   entity state transitions serve as market signals — a machine going IDLE is
   both an internal operational event and a network-level capacity advertisement
   — with NATS account-based tenant isolation, saga-eventual cross-org
   consistency, and formal trust and reputation models.

The architecture builds on an existing tested implementation: 15 entity types,
12 state machine graphs, 4-channel event distribution, Sparkplug-B ingestion,
and 4 streaming WebSocket RPCs.

---

## Status of This Memo

This document is a DRAFT specification. It is subject to revision as
implementation experience and architectural review inform the design.
Sections marked "LOOP OPEN" contain unresolved questions that MUST be
resolved before this RFC advances to ACCEPTED status.

---

## Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
document are to be interpreted as described in BCP 14 [RFC2119] [RFC8174]
when, and only when, they appear in ALL CAPITALS, as shown here.

### Definitions

| Term | Definition |
|------|------------|
| **organization** | A participating entity in the manufacturing commons — may be a 2-person machine shop or a Fortune 500 manufacturer |
| **entity** | An ISA-95 hierarchy node with lifecycle state, managed by `@effect/cluster/Entity` with a `@effect/experimental/Machine` actor |
| **entity event** | A `Schema.TaggedClass` event emitted on entity state change |
| **propagation rule** | An ISA-95 hierarchical event forwarding rule (U-*, D-*, L-*, O-*) |
| **manufacturing commons** | The federated 200K-org metropolitan manufacturing ecosystem |
| **telescoping hierarchy** | ISA-95 hierarchy at 1-8 levels per organization |
| **staleness budget** | Maximum acceptable age of cross-org aggregate data (G-8) |
| **saga-eventual consistency** | Cross-org consistency model with compensating transactions |
| **per-entity causal ordering** | Intra-org ordering guarantee (G-1) |
| **edge device** | Physical compute at the manufacturing site boundary |
| **NATS account** | NATS-level isolation boundary per organization |
| **JetStream domain** | Per-device or per-site JetStream persistence scope |
| **Effect entity** | An @effect/cluster Entity with sharded lifecycle |
| **Machine.changes** | A `Stream<Machine.State<M>>` on every Machine actor emitting state transitions |
| **EventDistribution** | Central event bus via ChannelService broadcast outlets |
| **HolonetBridge** | NATS transport bridge for distributed fan-out |

---

## Table of Contents

### Part I: Context (Informative)

- Section 1: Introduction and Vision
- Section 2: Competitive Differentiation and Industry Analysis
- Section 3: Theoretical Foundations and Architectural Principles

### Part II: Architecture (Normative)

- Section 4: Requirements
- Section 5: ISA-95 Event Taxonomy and Propagation Rules
- Section 6: Multi-Tenant Network Architecture
- Section 7: Entity Event Schema
- Section 8: Transport Layer and NATS Subject Hierarchy
- Section 9: Consistency Guarantees and Temporal Semantics

### Part III: Implementation (Normative)

- Section 10: Effect-TS Implementation Architecture
- Section 11: Observer Pattern and Entity Integration
- Section 12: Streaming RPC Extensions
- Section 13: Implementation Phases

### Part IV: Governance (Normative)

- Section 14: Security Architecture
- Section 15: Trust Model
- Section 16: Tenant Isolation
- Section 17: Failure Modes and Recovery
- Section 18: Observability Framework
- Section 19: Monitoring Infrastructure
- Section 20: Operational Runbooks
- Section 21: Migration and Upgrade Strategy
- Section 22: Conformance and Testing Requirements

### Part V: Supplementary (Informative)

- Section 23: Edge-First Architecture
- Section 24: Deployment Topology
- Section 25: Network Entity Types
- Section 26: Marketplace Protocol
- Section 27: Developer Experience
- Section 28: Onboarding Protocol
- Section 29: Reactive ISA-95 Hierarchy Specification
- Section 30: Multi-Tenant Design Patterns
- Appendix A: Research Document Index
- Appendix B: Revision History

---

═══════════════════════════════════════════════════════════════════════════
PART I: CONTEXT (Informative)
═══════════════════════════════════════════════════════════════════════════


# Part I: Context

<!-- Source: rfc-section-introduction.md -->

## 1. Introduction

### 1.1 Scope

This RFC specifies the integration of entity lifecycle events into a
metropolitan-scale IIoT streaming infrastructure designed to serve as a
**manufacturing commons** — a federated network of 200,000+ independent
manufacturing organizations sharing capacity, intelligence, and coordination
through a common event distribution fabric.

The specification covers:

- **Intra-organization event distribution**: How entity state transitions
  (equipment faults, alarm lifecycle, work order progression) propagate through
  an organization's ISA-95 hierarchy and reach WebSocket subscribers in real time.

- **Reactive ISA-95 hierarchy**: A formal propagation model with upward (U-1..U-4),
  downward (D-1..D-3), lateral (L-1..L-3), and outward (O-1..O-3) rules that
  operate identically at any hierarchy depth.

- **Multi-tenant network architecture**: How entity events cross organizational
  boundaries to become market signals, enabling capacity matching, fleet
  intelligence, and collaborative manufacturing at metropolitan scale.

- **Consistency guarantees**: A two-domain model distinguishing intra-organization
  causal ordering from inter-organization saga-eventual consistency, with formal
  guarantees G-1 through G-7.

- **Implementation architecture**: Normative patterns for Effect-TS
  (`@effect/cluster` entity sharding, `@effect/experimental/Machine` state
  observation, `@effect/rpc` streaming subscriptions) and NATS-based event
  transport.

This RFC does NOT specify:

- The marketplace matching algorithm (deferred to a future RFC)
- Billing and payment infrastructure
- Specific edge device firmware or hardware requirements
- Machine learning models for fleet intelligence

### 1.2 Motivation: Beyond Enterprise IIoT

Industrial IoT platforms have historically served a single constituency: the
enterprise. Siemens Insights Hub [SIEMENS-INSIGHTS], PTC ThingWorx [TWX-EVENTS],
AVEVA System Platform [AVEVA-SP], Rockwell FactoryTalk [RA-OPTIX], GE Vernova
Proficy [GEV-PROFICY-2025], and Inductive Automation's Ignition [IGN-PLATFORM]
all assume a deployment model where one organization owns the infrastructure,
controls the data, and manages the equipment hierarchy.

This assumption excludes the vast majority of manufacturers. In the United States,
98% of manufacturing firms have fewer than 500 employees. In the Atlanta
metropolitan area — the target deployment region for this specification — an
estimated 5,000+ machine shops and manufacturing firms operate, most with fewer
than 50 employees. A machinist with a CNC mill and a lathe ("Earl") cannot
justify the integration cost, IT overhead, or subscription pricing of enterprise
IIoT platforms.

Yet Earl's equipment generates the same types of operational data as a Boeing
supplier's: temperature readings, vibration profiles, machine utilization, fault
codes. The data has value — individually for Earl's maintenance planning, and
collectively as part of a metropolitan manufacturing intelligence network.

This RFC specifies the technical architecture for a platform where:

1. **Small manufacturers are first-class participants.** A $50 edge device, a QR
   code scan, and 15 minutes of setup MUST be sufficient to join the network
   (Requirement R-N5).

2. **The ISA-95 hierarchy telescopes.** Earl's shop has 2 levels (Organization >
   Equipment). A Boeing supplier has 8 levels (Enterprise > Site > Area > Plant >
   Line > WorkCell > Machine > Sensor). The propagation rules in Section 5 MUST
   operate identically at any depth.

3. **Entity state changes are market signals.** When Earl's CNC goes IDLE, that
   is both an internal operational event AND a network-level availability signal.
   The architecture MUST support this dual interpretation through event
   transformation at the organization boundary (Section 6).

4. **Data sovereignty is non-negotiable.** Each organization controls what data
   leaves its boundary. Raw sensor readings MUST remain within the organization's
   NATS account unless explicitly exported. Only aggregated signals (available/busy,
   capability status) cross organizational boundaries by default (Section 14).

5. **The network provides value before the marketplace.** Standalone equipment
   monitoring, OEE tracking, and maintenance alerting MUST be useful to Earl as a
   solo participant. Network effects (fleet intelligence, capacity matching) emerge
   as adoption grows, following the "come for the tool, stay for the network"
   strategy [PARKER-PLATFORM].

### 1.3 The Manufacturing Commons Model

Ostrom's work on governing common-pool resources [OSTROM-COMMONS] provides the
governance framework. A manufacturing commons shares the structural properties of
natural commons: a shared resource (manufacturing capacity and intelligence), a
community of appropriators (organizations needing services) and providers
(organizations offering capabilities), and governance challenges (data sovereignty,
quality assurance, fair access).

Ostrom's eight design principles map to architectural requirements:

| Principle | Architectural Requirement |
|---|---|
| 1. Clearly defined boundaries | NATS account isolation per organization [NATS-ACCOUNTS] |
| 2. Proportional equivalence | Reputation and intelligence scale with data contribution |
| 3. Collective-choice arrangements | Network governance includes participant voice |
| 4. Monitoring | Transparent quality metrics via entity event history |
| 5. Graduated sanctions | Reputation scoring, capability verification |
| 6. Conflict resolution | Dispute mechanisms via work order saga state machines |
| 7. Right to organize | Organizations form capability clusters (sub-networks) |
| 8. Nested enterprises | The network is a network of networks, not a monolith |

The data cooperative model [DATA-COOP-2023] provides the intelligence-sharing
pattern: each participant contributes anonymized operational metrics; the
cooperative aggregates these into fleet-level predictions and market intelligence;
no participant can access another's raw data.

### 1.4 Entity State as Market Signal

The central technical insight of this RFC is that entity state transitions have
a dual interpretation depending on the observer's scope:

| State Transition | Intra-Org Meaning | Network Meaning |
|---|---|---|
| Machine: RUNNING -> IDLE | "Job completed" | "Capacity available" |
| Machine: RUNNING -> FAULTED | "Maintenance needed" | "Capability temporarily offline" |
| Machine: IDLE -> RUNNING | "New job started" | "Capacity consumed" |
| All machines IDLE | "Slow day" | "High availability for rush jobs" |
| All machines RUNNING | "Fully loaded" | "No capacity, don't route here" |

The architecture specified in Section 6 provides an **event transformation layer**
at the organization boundary. Internal events use detailed state (fault codes,
sensor readings, transition timestamps). Network events use aggregated signals
(available/busy binary, capability status, quality rating). The transformation is
controlled by each organization's disclosure policy, enforced by NATS account
export rules.

This dual interpretation is what distinguishes the manufacturing commons from both
traditional IIoT platforms (which stop at intra-org events) and existing
Manufacturing-as-a-Service marketplaces [TEDALDI-MAAS-2023] (which have no
real-time entity state at all).

### 1.5 Telescoping ISA-95 Hierarchy

ISA-95 [ISA-95-1] defines a fixed equipment hierarchy for large-scale
manufacturing: Enterprise > Site > Area > Line > WorkCell > Machine > Device >
Sensor. The TMNL codebase implements all 9 levels as distinct entity types
(`src/lib/iiot/schemas/identifiers.ts:28-38`) with branded identifiers and
graph-validated state machines.

For the manufacturing commons, this hierarchy MUST telescope:

**Earl's Machine Works** (2 levels):
```
Organization = Enterprise + Site + Plant (collapsed)
  CNC-1 = Machine + Device (collapsed)
    Spindle Temp = Sensor
```

**Acme Manufacturing** (5 levels):
```
Enterprise
  Site (Atlanta)
    Line (Assembly)
      Machine (Press-1)
        Sensor (Pressure-42)
```

**Boeing Atlanta Supplier** (8 levels):
```
Enterprise
  Site
    Area
      Plant
        Line
          WorkCell
            Machine
              Device
                Sensor
```

The propagation rules specified in Section 5 traverse `contains` edges in the
asset graph. They operate on the parent-child relationship, not on the entity
TYPE at each level. This means the "worst-of" health roll-up algorithm traverses
identically whether it crosses 1 level or 7 levels. The entity type determines
behavior (state graphs, alarm semantics), but the structure is flexible.

The current codebase entity system (`src/lib/iiot/entity/`) provides the full
9-level hierarchy. The telescoping extension requires treating intermediate
levels as optional — an organization with no Area entities simply has shorter
`contains` chains between Enterprise and Machine.

### 1.6 Codebase Foundation

This RFC builds on an existing, tested implementation. The codebase provides:

- **15 entity types** covering the full ISA-95 hierarchy plus event-sourced
  domain aggregates (Alarm, WorkOrder, EquipmentState)
  — `src/lib/iiot/entity/`

- **12 state machine graphs** enforcing valid transitions via
  `Graph.directed` validation
  — `src/lib/iiot/machines/graphs/`

- **4-channel event distribution** (readings, alarms, equipment state,
  cache invalidations) with NATS dual-publish via HolonetBridge
  — `src/lib/iiot/realtime/event-distribution.ts`

- **Sparkplug-B edge ingestion pipeline** for MQTT-based sensor data
  — `src/lib/iiot/adapters/ingestion-service.ts`

- **4 streaming WebSocket RPCs** with per-subscriber filters
  — `src/lib/iiot/rpc/RealtimeRpcs.ts`

- **Schema-driven reactive state** (Fermion atom families) for client-side
  reactivity
  — `src/lib/iiot/fermion/index.ts`

- **ReactivityBridge** connecting entity handlers to the event distribution
  system inline, with no polling
  — `src/lib/iiot/realtime/reactivity-bridge.ts`

The manufacturing commons extends this foundation with: (a) a 5th
EventDistribution channel for entity state changes, (b) network-level entities
above Enterprise, (c) NATS account provisioning per organization, (d) event
transformation at the organization boundary, and (e) network-level streaming
RPCs for capacity and marketplace events.

### 1.7 Document Structure

This RFC is organized in five parts:

**Part I: Context** (Sections 1-3) provides the vision, competitive landscape,
and theoretical foundations. These sections are informative.

**Part II: Architecture** (Sections 4-9) specifies the requirements, ISA-95
event taxonomy, propagation rules, multi-tenant network architecture, entity
event schema, NATS transport layer, and consistency guarantees. These sections
are normative.

**Part III: Implementation** (Sections 10-13) specifies the Effect-TS
implementation architecture, entity observer pattern, streaming RPC extensions,
and implementation phases. These sections are normative.

**Part IV: Governance** (Sections 14-15) addresses security, trust, tenant
isolation, and regulatory compliance. These sections are normative.

**Part V: Appendices** provides the entity transition catalog, architecture
options analysis, codebase file inventory, research document index, and
revision history. These appendices are informative.

---


---

> *The gaps identified in this section motivate the theoretical framework
> that follows. Section 2 maps 10 incumbent platforms against the manufacturing
> commons model. Section 3 provides the cognitive science and systems theory
> foundations that constrain architectural decisions.*

<!-- Source: rfc-section-competitive-analysis.md -->

Every existing IIoT platform is a landlord model — one vendor, one cloud, one tenant hierarchy. TMNL is a commons model — 200K sovereign participants, federated infrastructure, collective intelligence.

---
## 1. The Landlord Problem

Analysis of 10 IIoT platforms — Siemens MindSphere/Insights Hub [SIEMENS-INSIGHTS], PTC ThingWorx [TWX-EVENTS], AVEVA System Platform [AVEVA-SP], AVEVA PI System [AVEVA-PI], Rockwell FactoryTalk/Plex [RA-OPTIX] [RA-PLEX], GE Vernova Proficy [GEV-PROFICY-2025], Ignition [IGN-PLATFORM], AWS IoT TwinMaker/SiteWise [AWS-TWINMAKER] [AWS-SITEWISE], Azure Digital Twins [AZURE-DT], and Google Cloud IoT [GCP-IOT-ARCH] — reveals a single architectural assumption shared by ALL incumbents:

**One vendor. One cloud. One tenant hierarchy.**

Every platform is a landlord. Siemens sells Siemens cloud access. PTC sells ThingWorx licenses. AVEVA sells System Platform seats. AWS sells SiteWise consumption. The platform operator IS the organization using it, or the organization rents space on the vendor's infrastructure.

This is the **landlord model**:

| Property | Landlord Model (All 10 Platforms) |
|----------|-----------------------------------|
| **Data ownership** | Platform/vendor owns or controls data |
| **Trust model** | Trust the vendor |
| **Deployment** | Single enterprise, multi-site |
| **Smallest customer** | Plant with 100+ employees and an IT department |
| **Pricing** | Enterprise license: $50K-$200K+/year |
| **Onboarding** | Weeks-months with systems integrator |
| **Network effects** | Zero — each deployment is an island |
| **Governance** | Vendor sets rules unilaterally |

For a 2-person machine shop in Atlanta — Earl's Precision Machining, with one CNC mill, one lathe, and zero IT staff — every platform above is architecturally, economically, and operationally inaccessible.

**The landlord model cannot serve 200,000 organizations.** It cannot serve 200. It serves one enterprise at a time, behind a sales process, with a systems integrator, at enterprise pricing.

TMNL is not a landlord. It is a **commons**.

---

## 2. The Five Universal Gaps

Beyond the landlord assumption, all 10 platforms share five structural weaknesses. These are not feature gaps that a vendor update will close — they are architectural assumptions baked into decades-old foundations.

### Gap G-1: No Event Sourcing

**Industry state-of-art.** Every platform uses mutable state for entity representation. Historians store time-series sensor data but treat entity state (equipment status, alarm conditions, work order progress) as overwrite-in-place records. AVEVA PI System [AVEVA-PI] compresses historical data and permits deletion. ThingWorx [TWX-EVENTS] stores current property values only. None implement event sourcing as formalized by Fowler [EVENT-SOURCING] or the CQRS pattern [CQRS].

**Consequence.** When a regulator asks "what was the equipment state at 14:32 on March 15?" — no platform can answer from its entity model. The entity-level causal history (what command changed the state, who authorized it, what the preceding state was) is lost.

**TMNL.** Three entity types — Alarm, WorkOrder, EquipmentState — implement append-only event sourcing via `@effect/cluster` [EFFECT-CLUSTER] entity handlers (`src/lib/iiot/entity/AlarmEntity.ts`, `src/lib/iiot/entity/WorkOrderEntity.ts`, `src/lib/iiot/entity/EquipmentStateEntity.ts`). The entity barrel export (`src/lib/iiot/entity/index.ts:8-14`) explicitly classifies which entities are event-sourced and which are mutable. Full temporal queries, replay, and FDA 21 CFR Part 11 [FDA-CFR11] audit trails are architectural primitives.

### Gap G-2: No Reactive Hierarchy Cascade

**Industry state-of-art.** Every platform organizes assets hierarchically per ISA-95 [ISA-95-1], but none automatically propagate state changes up the hierarchy. AVEVA PI AF [AVEVA-PI] supports calculated attributes on a 15-minute scheduled cycle. AWS SiteWise [AWS-SITEWISE] computes metrics on a schedule. Azure Digital Twins [AZURE-DT] requires Azure Functions glue code [AZURE-DT-TWIN2TWIN].

**Consequence.** A plant manager sees a "green" plant while a machine has been faulted for 14 minutes because the rollup hasn't run.

**TMNL.** 12 state machine graphs (`src/lib/iiot/machines/graphs/*.ts`) validate transitions for every ISA-95 asset type. 12 Machine actors (`src/lib/iiot/machines/*.ts`) drive entity state. EntityStack composes all handlers into a single Layer (`src/lib/iiot/entity/EntityStack.ts:54-67`). Cascade target: <100ms per level [TMNL-UNS].

### Gap G-3: No Entity-Level Subscriptions

**Industry state-of-art.** Subscriptions are tag-based (Ignition [IGN-TAGS], Siemens [SIEMENS-INSIGHTS]) or property-based (ThingWorx [TWX-SUBSCRIPTIONS], AWS SiteWise [AWS-SITEWISE-NOTIFY]). No platform offers "subscribe to all state changes for Equipment-X."

**Consequence.** Client applications maintain fragile subscription lists. Adding a sensor requires updating every downstream subscriber.

**TMNL.** Four streaming RPC subscriptions (`src/lib/iiot/rpc/RealtimeRpcs.ts`) deliver entity-scoped event streams over WebSocket (`src/lib/iiot/realtime/websocket-server.ts:131-137`). EventDistribution provides 4 typed ChannelService channels (`src/lib/iiot/realtime/event-distribution.ts:136-157`) with broadcast outlets and configurable backpressure.

### Gap G-4: No Graph-Aware Event Routing

**Industry state-of-art.** Event routing is flat topic-based or entity-scoped. "Give me all events from equipment connected to Line-A" requires manual enumeration.

**Consequence.** Moving a machine from Line-1 to Line-2 requires reconfiguring every consumer.

**TMNL.** NATS subject-based routing mirrors the ISA-95 hierarchy. HolonetBridge (`src/lib/iiot/realtime/holonet-bridge.ts`) dual-publishes to local PubSub AND NATS. Wildcard subscriptions (`entity.site.plant-a.line-1.>`) capture all events from all equipment on a line. NATS leaf nodes [NATS-LEAFNODE] enable metropolitan-scale fan-out.

### Gap G-5: Proprietary Lock-In

**Industry state-of-art.** Siemens requires S7/Profinet [SIEMENS-EDGE]. PTC's AlwaysOn [TWX-ALWAYSON] is proprietary. AVEVA's ArchestrA [AVEVA-SP] is vendor-locked. Even Ignition [IGN-PLATFORM] uses a proprietary Gateway Network.

**Consequence.** Switching costs lock organizations into vendor ecosystems for decades. A 2-person shop cannot afford $50K+/year.

**TMNL.** Built on open protocols: NATS [NATS-PROTO], Sparkplug-B [SPARKPLUG-B] / MQTT [MQTT-5], OPC UA [OPC-UA-14], WebSocket with JSON serialization. 17 RPC groups composed into a single `IIoTRpcs` barrel (`src/lib/iiot/rpc/index.ts:91-112`). The Sparkplug pipeline (`src/lib/iiot/adapters/ingestion-service.ts:297-322`) demonstrates composability as Layer compositions.

---

## 3. The Commons Alternative

### 3.1 Precedents That Didn't Scale

Three initiatives attempted manufacturing collaboration at scale. All fell short:

**Catena-X** [MAAS-CATENAX] — the European automotive supply chain data space. Uslu et al. (2023) describe building MaaS capabilities within the Catena-X ecosystem. Catena-X achieves cross-organization data exchange via standardized data connectors. **Why it didn't become a commons**: Governed by OEMs (BMW, VW), creating asymmetric power. Small suppliers participate on the OEM's terms. No real-time entity state — data exchange is batch-oriented. Limited to automotive.

**Digital Manufacturing Commons (DMC)** [DMC-COMMONS] — Hedberg et al.'s 2016 NIST-initiated proposal for shared manufacturing data. **Why it didn't scale**: Focused on data standards and repositories, not real-time infrastructure. No edge component — requires manual data upload. No network effects without live operational data. Government-funded research project, not a live platform.

**MaaS Platforms** [MAAS-FRAMEWORK] [TEDALDI-MAAS-2023] — Tedaldi and Miragliotta's 2023 study of early Manufacturing-as-a-Service adopters identified six operational platforms. **Why they plateau**: Two archetypes emerge — Marketplace (matchmaking only, no operational visibility) vs. Managed (platform orchestrates, but vendor lock-in). "The matching of trading partners is barely described in the literature" [TEDALDI-MAAS-2023]. Trust is the adoption barrier: small manufacturers resist platforms where data flows to competitors.

**EFPF** [EFPF-2020] — the EU Horizon 2020 European Connected Factory Platform. Federated four existing smart factory platforms through a common "Data Spine." **Why it didn't persist**: Batch-oriented data exchange, not real-time. Project-scoped (ended 2022). Designed for dozens of participants, not 200K. No propagation semantics.

### 3.2 Why TMNL Will Scale Where Others Failed

| Failure Mode | Precedent | TMNL Difference |
|---|---|---|
| **Batch, not real-time** | Catena-X, DMC, EFPF | Entity-level streaming over WebSocket. Equipment state is a LIVE signal, not a document. (`src/lib/iiot/realtime/event-distribution.ts`) |
| **OEM-governed, not federated** | Catena-X | NATS account isolation [NATS-ACCOUNTS] — each org is sovereign. No OEM controls the data plane. |
| **Matchmaking without state** | MaaS platforms | Equipment state = market signal. When CNC-1 goes IDLE, that is a supply signal routed via NATS [NATS-PROTO]. No MaaS platform has this. (`src/lib/iiot/entity/EquipmentStateEntity.ts`) |
| **No edge component** | DMC | NATS leaf nodes [NATS-LEAFNODE] on $50 hardware. Sparkplug-B auto-discovery [SPARKPLUG-B] via `src/lib/iiot/adapters/sparkplug-adapter.ts`. |
| **Project-scoped, not persistent** | EFPF | Commercial platform with standalone value at Phase 1 (monitoring) before network effects. |
| **No trust model** | MaaS platforms | NATS decentralized JWT auth [NATS-DECENTRALIZED] — selective disclosure at protocol level. |
| **Standards without runtime** | DMC | Effect Schema [EFFECT-TS] provides runtime validation. Event sourcing [EVENT-SOURCING] provides audit trails. Not just data formats — live operational infrastructure. |

### 3.3 The Commons Thesis

TMNL is a **manufacturing commons** [OSTROM-COMMONS] — a civic-scale infrastructure where:

- **200,000+ independent organizations** participate, from a 2-person machine shop to large aerospace manufacturers
- **Located in a metropolitan region** (Atlanta, Georgia), forming a regional manufacturing ecosystem
- **Small manufacturers are first-class citizens** — Earl with a CNC mill and a lathe is as architecturally important as Boeing's local supplier
- **The value is in the NETWORK** — collective intelligence, shared capacity, coordinated production

This is not an IIoT platform. It is a **manufacturing network operating system**.

| Dimension | Enterprise IIoT (Incumbents) | Manufacturing Commons (TMNL) |
|-----------|------------------------------|-------------------------------|
| **Deployment model** | Single enterprise, multi-site | Multi-enterprise, federated |
| **Organization count** | 1 (with many plants) | 200,000+ independent orgs |
| **Smallest participant** | Plant (100+ employees) | 1-person machine shop |
| **Data ownership** | Platform/enterprise owns all | Each org owns its data |
| **Trust model** | Centralized (enterprise IT) | Federated (peer trust via NATS JWT) |
| **Value source** | Operational efficiency | Network effects + efficiency |
| **Hierarchy** | Full ISA-95 (7+ levels) | Telescoping (1-8 levels) |
| **Revenue model** | Enterprise license ($50K+/yr) | Tiered ($0-$50/month for small shops) |
| **Onboarding** | Weeks-months (SI engagement) | 15 minutes (self-service) |
| **Network effects** | None | Metcalfe's Law [METCALFE-LAW]: value ~ N^2 |

---

## 4. Network Effects

### 4.1 Metcalfe's Law Applied

Metcalfe's Law [METCALFE-LAW] predicts network value scales with the square of connected participants. For 200K organizations, the network effect is 40 billion potential connections.

| Participants | Network Value Phase | Capability | Network Connections |
|-------------|-------------------|------------|---------------------|
| 1-100 | **Standalone value** | Equipment monitoring, OEE, maintenance prediction | 4,950 |
| 100-1,000 | **Local network** | Peer visibility, capability discovery, community | 499,500 |
| 1,000-10,000 | **Marketplace** | Active capacity matching, supply chain resilience | 49,995,000 |
| 10,000-200,000 | **Manufacturing OS** | Full economic dynamics, collective intelligence | 19,999,900,000 |

**Critical mass estimation**: Atlanta's metro area has approximately 5,000+ machine shops and manufacturers. 10-20% penetration (500-1,000 participants) provides sufficient capability coverage for most common manufacturing operations.

### 4.2 "Come for the Tool, Stay for the Network"

Parker et al.'s platform strategy [PARKER-PLATFORM] identifies this critical pattern: each participant MUST get value at Phase 1 (standalone) before network effects activate.

TMNL delivers standalone value through:
1. **Entity state monitoring** — 12 state machines track equipment lifecycle (`src/lib/iiot/machines/*.ts`)
2. **Reactive hierarchy cascade** — faults propagate up the hierarchy in <100ms, not 15 minutes
3. **Event-sourced audit trails** — FDA 21 CFR Part 11 [FDA-CFR11] compliance from day one
4. **OEE calculation** — EquipmentState entity (`src/lib/iiot/entity/EquipmentStateEntity.ts`) tracks state durations

Earl monitors his CNC machine regardless of who else is on the platform. The tool has value at N=1.

### 4.3 Entity State as Market Signal

This is the key architectural insight that no competitor and no precedent has achieved:

**Equipment state is simultaneously an operational metric AND a market signal.**

When Earl's CNC-1 transitions from `running` to `idle`, three things happen:

1. **Operational**: Earl's dashboard updates (via `SubscribeEquipmentState` streaming RPC)
2. **Hierarchical**: Earl's shop status updates (via reactive cascade through state machine graph)
3. **Economic**: The network learns that 3-axis CNC capacity is available in East Atlanta (via NATS subject export)

This is only possible because:
- Entity state is **typed** (Effect Schema [EFFECT-TS] with branded IDs)
- Entity state is **streamed** (EventDistribution channels at `src/lib/iiot/realtime/event-distribution.ts`)
- Entity state is **distributed** (NATS subjects via HolonetBridge at `src/lib/iiot/realtime/holonet-bridge.ts`)
- Entity state is **scoped** (NATS account isolation [NATS-ACCOUNTS] — Earl controls what is exported)

No existing MaaS platform [TEDALDI-MAAS-2023] has live equipment-state-driven matching because no existing platform has entity-level state streaming.

---

## 5. Platform Economics

### 5.1 Governing the Commons (Ostrom)

Ostrom's eight design principles for governing common-pool resources [OSTROM-COMMONS] map directly to TMNL architecture:

| Ostrom Principle | TMNL Implementation |
|-----------------|---------------------|
| 1. **Defined boundaries** | NATS account isolation [NATS-ACCOUNTS] — each org controls its boundary |
| 2. **Proportional equivalence** | Benefits (jobs, intelligence) scale with contribution (data, availability) |
| 3. **Collective choice** | Network governance includes participant voice via federation protocol |
| 4. **Monitoring** | Entity state + quality metrics are transparent (event-sourced [EVENT-SOURCING]) |
| 5. **Graduated sanctions** | Reputation scoring derived from event-sourced delivery and quality data |
| 6. **Conflict resolution** | WorkOrder entity state machine (`src/lib/iiot/entity/WorkOrderEntity.ts`) models dispute lifecycle |
| 7. **Right to organize** | Sub-networks (capability clusters) via NATS subject hierarchy [NATS-PROTO] |
| 8. **Nested enterprises** | The network is a network of networks — NATS leaf nodes [NATS-LEAFNODE] |

### 5.2 Two-Sided Market Dynamics

Rochet and Tirole's two-sided market theory [TWO-SIDED] applies:

- **Side 1 (Supply)**: Organizations with manufacturing capability and available capacity
- **Side 2 (Demand)**: Organizations needing manufacturing services
- **Platform**: TMNL manufacturing commons

The chicken-and-egg problem is solved by phased value:

| Phase | Value Proposition | Network Required? |
|-------|-------------------|-------------------|
| **Phase 1** | Equipment monitoring, OEE, maintenance prediction | No — standalone value |
| **Phase 2** | Peer visibility — "which shops near me have 5-axis?" | Minimal — local discovery |
| **Phase 3** | Machine state as market signal — IDLE = available capacity | Yes — marketplace activates |

### 5.3 Transaction Cost Reduction

Coase's theory of the firm [COASE-FIRM] and Williamson's transaction cost economics [WILLIAMSON-TCE] explain why small manufacturers currently operate in isolation: finding, vetting, and coordinating with peers costs more than the benefit.

| Transaction Cost | Current State | TMNL Reduction | Mechanism |
|-----------------|--------------|----------------|-----------|
| **Search** | Cold-calling, trade shows | Capability discovery via entity state | NATS subject hierarchy + search RPCs |
| **Verification** | Manual quality audit | Transparent quality metrics | Event-sourced quality data [EVENT-SOURCING] |
| **Coordination** | Phone calls, email | Automated work order routing | WorkOrder entity state machine |
| **Enforcement** | Legal contracts | Escrow semantics, reputation | Event-sourced audit trail [FDA-CFR11] |
| **Information** | Unknown capacity/availability | Real-time equipment state | EquipmentState streaming [EFFECT-CLUSTER] |

When transaction costs drop below a threshold, new forms of collaboration emerge: ad hoc job sharing, overflow routing, capability pooling [SHAPIRO-VARIAN].

### 5.4 Information Asymmetry and Selective Disclosure

Earl's dilemma [SHAPIRO-VARIAN]: if he publishes "CNC-1: IDLE, 4 hours available," competitors see his utilization. If he withholds, the network cannot route jobs to him.

**Resolution through NATS account-level selective disclosure** [NATS-ACCOUNTS]:

| Data Category | Visibility | Rationale |
|---|---|---|
| Capability list (what I can make) | Network-wide | Required for matching |
| Availability (binary: IDLE/BUSY) | Network-wide | Market signal without exposure |
| Utilization rate | Private | Competitive intelligence |
| Specific job details | Bilateral only | Trade secret protection |
| Quality history | Anonymized aggregate | Trust without exposure |
| Pricing | Bilateral or posted | Market dynamics |

This is enforced architecturally through NATS account export/import rules — not policy, not UI toggles, but protocol-level isolation that cannot be bypassed by the platform operator.

---

## 6. Onboarding SLA: 15 Minutes to First Data

### 6.1 The Incumbent Onboarding Problem

| Platform | Typical Onboarding | Minimum Cost | Requires |
|----------|-------------------|-------------|----------|
| Siemens [SIEMENS-INSIGHTS] | 4-12 weeks | $100K+ (SI engagement) | MindConnect hardware + cloud subscription |
| PTC ThingWorx [TWX-ALWAYSON] | 2-8 weeks | $50K+ (license + SI) | Kepware license + ThingWorx server |
| AVEVA [AVEVA-SP] | 6-16 weeks | $200K+ | System Platform license + historian |
| Rockwell [RA-PLEX] | 4-12 weeks | $100K+ | FactoryTalk license + PLC integration |
| GE Proficy [GEV-PROFICY-2025] | 4-8 weeks | $75K+ | Historian + APM modules |
| Ignition [IGN-PLATFORM] | 1-4 weeks | $5K+ (gateway license) | Ignition gateway + module licenses |
| AWS SiteWise [AWS-SITEWISE] | 1-4 weeks | Variable (consumption) | AWS account + SiteWise model setup |
| Azure DT [AZURE-DT] | 2-8 weeks | Variable (consumption) | Azure account + DTDL modeling |

For Earl, every platform above is economically irrational. The cheapest (Ignition at ~$5K/year) exceeds what he would spend on monitoring all his equipment in a lifetime.

### 6.2 The 15-Minute Commitment

TMNL MUST achieve the following SLA for the smallest participant class:

```
T+0:00  — Earl opens signup page on his phone
T+1:00  — Account created (NATS account provisioned, JWT issued [NATS-DECENTRALIZED])
T+3:00  — Edge agent downloaded to Earl's workshop computer (or $50 Raspberry Pi)
T+5:00  — Sparkplug-B auto-discovery detects CNC-1 (NBIRTH/DBIRTH via MQTT [SPARKPLUG-B])
T+8:00  — First sensor readings flowing (spindle temp, vibration)
T+10:00 — Equipment entity created in Earl's hierarchy (Organization > Machine)
T+12:00 — Dashboard shows live data on Earl's phone
T+15:00 — Earl sees his first OEE score
```

### 6.3 Architecture Enabling This SLA

| Onboarding Step | Enabling Architecture | File |
|----------------|----------------------|------|
| Account provisioning | NATS JWT-based decentralized auth [NATS-DECENTRALIZED] | Extension needed: provisioning service |
| Edge agent | Self-contained binary with NATS leaf node [NATS-LEAFNODE] | Extension needed: edge runtime packaging |
| Auto-discovery | Sparkplug-B NBIRTH/DBIRTH [SPARKPLUG-B] + AliasRegistry | `src/lib/iiot/adapters/sparkplug-adapter.ts` |
| First readings | SparkplugPipelineLayer processes immediately | `src/lib/iiot/adapters/ingestion-service.ts:297-322` |
| Entity creation | Telescoping hierarchy (Organization > Machine) | `src/lib/iiot/schemas/assets/machine/schema.ts` |
| Live dashboard | WebSocket streaming via RealtimeRpcs | `src/lib/iiot/realtime/websocket-server.ts:131-137` |
| OEE calculation | EquipmentState entity tracks state durations | `src/lib/iiot/entity/EquipmentStateEntity.ts` |

### 6.4 Telescoping Hierarchy

Earl's hierarchy at onboarding:

```
Organization: "Earl's Precision Machining"    (= Enterprise + Site + Plant)
  Machine: "CNC-1"                            (= Machine + Device)
    Sensor: "Spindle Temp"                    (= Sensor)
    Sensor: "Vibration"                       (= Sensor)
  Machine: "Lathe-1"                          (= Machine + Device)
    Sensor: "Bearing Temp"                    (= Sensor)
```

All 9 ISA-95 levels exist in the schema (`src/lib/iiot/schemas/assets/*/schema.ts`), but intermediate levels are optional. Earl uses 3 levels. Boeing's supplier uses 7. The telescoping hierarchy extends in-place without migration.

---

## 7. Feature Comparison Matrix

### 7.1 Architecture Pattern Matrix

| Platform | Pattern | Entity Model | Real-Time Primitive | Event Sourcing | Hierarchy Cascade |
|----------|---------|-------------|---------------------|----------------|-------------------|
| Siemens [SIEMENS-INSIGHTS] | Hybrid edge+cloud | Asset types | MindConnect events | No | No (custom logic) |
| ThingWorx [TWX-EVENTS] | Push (AlwaysOn WS) | Thing model | DataChangeEvent | No | No (imperative) |
| AVEVA PI [AVEVA-PI] | Poll + historian | AF elements | Event Pipe | No (mutable) | Partial (15 min) |
| AVEVA SP [AVEVA-SP] | SCADA poll + alarm | ArchestrA objects | Alarm events | No | No |
| Rockwell [RA-OPTIX] | Tag polling + cloud | OPC UA info model | Tag change | No | No |
| GE Proficy [GEV-PROFICY-2025] | Historian + Kafka | APM asset model | Kafka events | No | No |
| Ignition [IGN-PLATFORM] | Tag pub/sub + Sparkplug-B | Tags + UDTs | Tag change events | No | No |
| AWS TwinMaker [AWS-TWINMAKER] | Entity-component + MQTT | Entity-component | Property notification | No | Partial (scheduled) |
| Azure DT [AZURE-DT] | Twin graph + event route | DTDL twins | Twin change events | No | No (Functions glue) |
| Google Cloud [GCP-IOT-ARCH] | Pub/Sub + Dataflow | None (partner) | Pub/Sub messages | No | No |
| **TMNL** | **Entity + Machine + Stream** | **12 typed entities** | **ChannelService broadcast** | **Yes (3 types)** | **Yes (<100ms)** |

### 7.2 Subscription Model Comparison

| Platform | Granularity | Wildcard | Push/Pull | Entity-Scoped |
|----------|-------------|----------|-----------|---------------|
| Siemens [SIEMENS-INSIGHTS] | Per-data-point | No | Push (edge), Pull (cloud) | No |
| ThingWorx [TWX-SUBSCRIPTIONS] | Per-property | No | Push (AlwaysOn) | No |
| AVEVA PI [AVEVA-PI] | Per-tag, per-AF-element | Limited | Pull + Push (Event Pipe) | No |
| Rockwell [RA-OPTIX] | Per-tag | No | Pull (scan rate) | No |
| GE Proficy [GEV-CIMPLICITY] | Per-tag, per-alarm-area | No | Pull + Push (Kafka) | No |
| Ignition [IGN-TAGS] | Per-tag, per-folder | Folder-level | Push (tag change) | No |
| AWS SiteWise [AWS-SITEWISE-NOTIFY] | Per-property | No | Push (MQTT) | No |
| Azure DT [AZURE-DT-ROUTING] | Per-twin, per-event-type | Filter expressions | Push (Event Grid) | Partial |
| **TMNL** | **Per-entity, per-channel** | **NATS hierarchy wildcards** | **Push (WebSocket stream)** | **Yes** |

### 7.3 End-to-End Latency Comparison

| Platform | Edge-Local | Edge-to-Cloud | Cloud Query | UI Update |
|----------|-----------|---------------|-------------|-----------|
| **TMNL** | <10ms | <500ms | <200ms | <500ms |
| Ignition [IGN-PLATFORM] | <10ms | <500ms (Sparkplug) | N/A (local) | <500ms |
| AVEVA (on-prem) [AVEVA-SP] | <10ms | <1s | ~200ms | ~500ms-1s |
| ThingWorx [TWX-ALWAYSON] | <10ms | <1s | ~200ms | 1-5s |
| Azure DT [AZURE-DT-PERF] | N/A | Seconds | **10-25s** | Seconds |
| Siemens (cloud) [SIEMENS-EDGE] | <10ms | Seconds-minutes | ~500ms | Seconds |
| Rockwell [RA-OPTIX] | <10ms | Seconds | ~500ms | Multi-second |
| AWS TwinMaker [AWS-TWINMAKER] | <10ms | <1s | ~500ms | ~30-90s |

### 7.4 What TMNL Does That No Incumbent Can

| Capability | TMNL | Nearest Competitor | Gap |
|-----------|------|-------------------|-----|
| Event-sourced entities [EVENT-SOURCING] | 3 entity types, append-only | None — all use mutable state | **Structural** |
| Reactive hierarchy cascade | 12 state machines, <100ms | AVEVA PI AF: 15 min schedule | **10,000x faster** |
| Entity-level subscriptions | 4 streaming RPC channels | Azure DT: per-twin event routes | **Scoped + typed** |
| Graph-aware wildcard routing | NATS subject hierarchy [NATS-PROTO] | None — all require enumeration | **Structural** |
| Open protocol stack | NATS + Sparkplug-B + OPC UA + WS | Ignition: most open, proprietary GAN | **Full openness** |
| Type-safe entity model | Effect Schema [EFFECT-TS] + branded IDs | None — untyped tags | **Compile-time safety** |
| Composable service layers | Effect Layer system, testable | None — monolithic servers | **Structural** |
| Manufacturing network (200K orgs) | Federated NATS accounts [NATS-ACCOUNTS] | **None** — all single enterprise | **Category-creating** |
| 4 temporal tiers | T1-T4 with distinct guarantees | None — single latency class | **Architectural** |

---

## 8. Four Temporal Tiers

No competitor distinguishes temporal requirements by scope. Every platform treats "real-time" as a single latency class. TMNL defines four distinct temporal tiers, each with different latency budgets, consistency models, and delivery guarantees.

### 8.1 The Tier Model

| Tier | Scope | Latency Budget | Consistency | Delivery | Example |
|------|-------|---------------|-------------|----------|---------|
| **T1: Intra-Equipment** | Sensor to Machine entity | <100ms | Strong (single entity) | At-least-once | Vibration spike triggers Machine fault transition |
| **T2: Intra-Organization** | Machine to Plant cascade | <1s | Causal (hierarchy order) | At-least-once | Machine fault propagates to Line, Plant status degradation |
| **T3: Inter-Organization** | Org to network event | <60s | Eventual (cross-account) | Best-effort | Earl's CNC-1 goes IDLE, availability signal reaches marketplace |
| **T4: Network Analytics** | Aggregated fleet intelligence | Minutes | Eventual (aggregated) | Periodic | "Average 3-axis CNC utilization in East Atlanta this week" |

### 8.2 Why Four Tiers Matter

**T1 (Intra-Equipment, <100ms)**: This is the safety-critical tier. A vibration spike on a CNC spindle MUST reach the Machine entity's state machine before the next cutting cycle. The Sparkplug-B adapter (`src/lib/iiot/adapters/sparkplug-adapter.ts`) ingests readings. The ReadingProcessor in `SparkplugPipelineLayer` (`src/lib/iiot/adapters/ingestion-service.ts:297-322`) processes them. The AlarmDetector evaluates thresholds. All within the same Effect runtime — no network hops, no serialization overhead.

**T2 (Intra-Organization, <1s)**: This is the operational awareness tier. When a Machine faults, the Line status MUST degrade within 1 second so the operator sees the correct plant status. The 12 state machine graphs (`src/lib/iiot/machines/graphs/*.ts`) validate transitions. EventDistribution (`src/lib/iiot/realtime/event-distribution.ts`) routes the event through ChannelService broadcast outlets. Hierarchy cascade propagates parent entity updates.

**T3 (Inter-Organization, <60s)**: This is the market signal tier. When Earl's equipment goes idle, the network learns within 60 seconds that 3-axis CNC capacity is available. The HolonetBridge (`src/lib/iiot/realtime/holonet-bridge.ts`) publishes to NATS. The event crosses NATS account boundaries via explicit export rules [NATS-ACCOUNTS]. Eventual consistency is acceptable — this is economic information, not safety data.

**T4 (Network Analytics, minutes)**: This is the collective intelligence tier. Aggregated, anonymized fleet data produces insights: maintenance predictions from similar equipment, quality benchmarks, demand forecasting. This data flows through NATS JetStream [JETSTREAM] consumers with batch processing semantics.

### 8.3 Tier-to-Architecture Mapping

| Tier | Transport | Consistency Primitive | Backpressure |
|------|-----------|----------------------|--------------|
| **T1** | In-process Effect runtime | Entity mailbox serialization [EFFECT-CLUSTER] | ChannelService maxLag: 10,000 (readings) |
| **T2** | Local PubSub + ChannelService | Causal ordering via entity scope | ChannelService maxLag: 1,000 (alarms/equipment) |
| **T3** | NATS cross-account export [NATS-ACCOUNTS] | Eventual (NATS at-least-once) | NATS flow control |
| **T4** | NATS JetStream [JETSTREAM] consumers | Eventual (batch windows) | Consumer ack/nak |

### 8.4 Competitor Comparison

| Platform | T1 Equivalent | T2 Equivalent | T3 Equivalent | T4 Equivalent |
|----------|--------------|--------------|--------------|--------------|
| Siemens [SIEMENS-EDGE] | Edge app (local) | Not supported | Cloud API (seconds-minutes) | Cloud analytics |
| ThingWorx [TWX-ALWAYSON] | AlwaysOn (local) | Not supported | Not supported | ThingWorx Analytics |
| AVEVA PI [AVEVA-PI] | Event Pipe (local) | AF calc (15 min!) | PI-to-PI replication | PI Vision reports |
| Ignition [IGN-PLATFORM] | Tag change (local) | Not supported | Gateway Network (proprietary) | Reporting module |
| Azure DT [AZURE-DT] | Not supported | Functions chain (seconds) | Not supported | Time Series Insights |
| **TMNL** | **<100ms (in-process)** | **<1s (ChannelService)** | **<60s (NATS cross-account)** | **Minutes (JetStream)** |

No competitor provides all four tiers. Most provide T1 (local edge) and T4 (analytics) but completely miss T2 (hierarchy cascade) and T3 (cross-org signals).

---

## 9. Why Effect Cluster + NATS, Not Docker/K8s Microservices

### 9.1 Three Structural Mismatches

The conventional approach — Docker containers orchestrated by Kubernetes — fails structurally for entity-centric IIoT:

#### Mismatch 1: Entity Affinity vs Stateless Pods

IIoT entities are **stateful**: a Machine entity accumulates transitions, maintains a state machine actor, and MUST process commands in order. `@effect/cluster` [EFFECT-CLUSTER] provides native entity affinity via consistent hash sharding. All messages to entity `MCH-001` route to the same runner. No distributed locks. No partition key gymnastics.

**Codebase evidence**: 12 Machine actors (`src/lib/iiot/machines/*.ts`) run inside `@effect/cluster` entities (`src/lib/iiot/entity/EntityStack.ts`).

#### Mismatch 2: Event Fan-Out vs Service Mesh Overhead

Propagating a Machine fault to Line, Plant, Site, and Enterprise aggregates requires traversing a service mesh — each hop adds 1-5ms of sidecar proxy latency. NATS [NATS-PROTO] provides zero-hop fan-out via subject wildcards.

**Codebase evidence**: HolonetBridge (`src/lib/iiot/realtime/holonet-bridge.ts`) dual-publishes to local PubSub AND NATS.

#### Mismatch 3: Edge Deployment vs Container Orchestration

Earl does not have a Kubernetes cluster. He has a $50 Raspberry Pi. NATS leaf nodes [NATS-LEAFNODE] connect over a single TCP connection. The Sparkplug-B adapter (`src/lib/iiot/adapters/sparkplug-adapter.ts`) auto-discovers devices via BIRTH messages.

### 9.2 Comparison Table

| Dimension | Docker/K8s Microservices | Effect Cluster + NATS |
|-----------|-------------------------|----------------------|
| **Entity affinity** | External (distributed locks, partition keys) | Native (consistent hash sharding) [EFFECT-CLUSTER] |
| **State machine execution** | Application-level, no framework | `@effect/experimental/Machine` with validated transitions |
| **Event fan-out** | Service mesh hop per subscriber (1-5ms each) | NATS subject wildcards, zero-hop [NATS-PROTO] |
| **Hierarchy cascade** | N service-to-service calls per level | Single NATS publish with wildcard matching |
| **Edge deployment** | Container runtime + orchestrator (2GB+ RAM) | Single binary + NATS leaf node (<50MB RAM) |
| **Auto-discovery** | Service registry (Consul, etcd) | Sparkplug-B BIRTH messages [SPARKPLUG-B] |
| **Backpressure** | Per-service circuit breakers | ChannelService maxLag per channel |
| **Testing** | Integration test hell (Docker Compose) | `TestRunner.layer` + `Entity.makeTestClient` in-process |
| **Multi-tenancy** | Namespace isolation (coarse) | NATS account isolation (per-org) [NATS-ACCOUNTS] |
| **Operational complexity** | High (K8s + Istio + Prometheus + Grafana) | Low (NATS cluster + Effect runtime) |
| **Cost at 200K orgs** | $$$$ (K8s control plane per region) | $$ (NATS superclusters + Effect runners) |

### 9.3 The Composition Argument

Effect's Layer system [EFFECT-TS] provides isolation, testability, and composability at the TYPE boundary — not the NETWORK boundary:

- **Isolation**: Each service is a `Context.Tag` with a typed interface
- **Testability**: `Layer.provide(TestLayer)` swaps implementations without Docker. EntityStack (`src/lib/iiot/entity/EntityStack.ts`) provides `EntityTestingStack` alongside `EntityProductionHandlersWithEvents`
- **Composability**: 12 entities, 17 RPC groups, 4 event channels compose into a single Layer tree
- **Deployment flexibility**: Same Layer tree runs as monolith (dev), distributed cluster (prod), or edge agent (Earl's shop)

Network boundaries add latency, failure modes, and operational complexity. Type boundaries add compile-time safety.

---

## 10. Codebase Grounding

Every claim maps to implemented (or scaffolded) code.

### 10.1 Event Sourcing — Implemented

| Component | File | Status |
|-----------|------|--------|
| AlarmEntity (ISA 18.2 lifecycle) | `src/lib/iiot/entity/AlarmEntity.ts` | Implemented |
| WorkOrderEntity (draft -> completed) | `src/lib/iiot/entity/WorkOrderEntity.ts` | Implemented |
| EquipmentStateEntity (OEE tracking) | `src/lib/iiot/entity/EquipmentStateEntity.ts` | Implemented |
| ES boundary classification | `src/lib/iiot/entity/index.ts:8-14` | Documented |

### 10.2 Reactive Hierarchy — Implemented

| Component | File | Status |
|-----------|------|--------|
| 12 state machine graphs | `src/lib/iiot/machines/graphs/*.ts` | Implemented |
| 12 Machine actors | `src/lib/iiot/machines/*.ts` | Implemented |
| 9 ISA-95 asset schemas | `src/lib/iiot/schemas/assets/*/schema.ts` | Implemented |
| EntityStack layer composition | `src/lib/iiot/entity/EntityStack.ts:54-67` | Implemented |

### 10.3 Entity-Level Subscriptions — Implemented

| Component | File | Status |
|-----------|------|--------|
| 4 streaming RPCs | `src/lib/iiot/rpc/RealtimeRpcs.ts` | Implemented |
| WebSocket server at /ws/iiot | `src/lib/iiot/realtime/websocket-server.ts:131-137` | Implemented |
| EventDistribution (4 channels) | `src/lib/iiot/realtime/event-distribution.ts:136-157` | Implemented |

### 10.4 Graph-Aware Event Routing — Implemented

| Component | File | Status |
|-----------|------|--------|
| HolonetBridge (NATS dual-publish) | `src/lib/iiot/realtime/holonet-bridge.ts` | Implemented |
| Remote ingress daemons | `src/lib/iiot/realtime/event-distribution.ts:249-263` | Implemented |
| SparkplugPipelineLayer | `src/lib/iiot/adapters/ingestion-service.ts:297-322` | Implemented |
| Sparkplug-B auto-discovery | `src/lib/iiot/adapters/sparkplug-adapter.ts` | Implemented |

### 10.5 Manufacturing Network Extensions — Not Yet Implemented

| Capability | Extension Needed |
|-----------|------------------|
| Organization-as-entity | New OrganizationEntity with capabilities, availability, reputation |
| Capacity marketplace RPCs | Marketplace RPCs + availability signal channels |
| Federated identity provisioning | NATS decentralized JWT auth [NATS-DECENTRALIZED] service |
| Cross-org cascade | Inter-org propagation rules in reactive ISA-95 model |
| Edge runtime packaging | Self-contained binary with NATS leaf node for $50 devices |
| Telescoping hierarchy enforcement | Variable-depth ISA-95 with level-skipping semantics |

---

## 11. Risks and Mitigations

### 11.1 Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Maturity gap** — Decades of field deployment vs new platform | High | Phased rollout: standalone value first, network effects second |
| **Protocol coverage** — Kepware [TWX-KEPWARE] supports 150+ drivers | Medium | Sparkplug-B [SPARKPLUG-B] + OPC UA [OPC-UA-14] cover 80% of protocols |
| **Historian scale** — PI [AVEVA-PI] handles millions of tags | Medium | NATS JetStream [JETSTREAM] + PostgreSQL; evaluate TimescaleDB |
| **Operator familiarity** — SCADA operators know tag paradigms | Medium | Map entity subscriptions to operator mental models [ENDSLEY-1995] |
| **Compliance** — PI/CIMPLICITY are FDA-certified [FDA-CFR11] | Medium | Event sourcing provides audit trail; certification is process |

### 11.2 Market Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Chicken-and-egg** | High | Standalone value at Phase 1 before network effects |
| **Incumbent response** | Low | Structural gaps require architectural rewrites, not features |
| **Small shop adoption** | Medium | 15-minute onboarding + free tier eliminates barriers |
| **Data sovereignty fears** | Medium | NATS account isolation [NATS-ACCOUNTS] — architectural, not policy |

---

## 12. References

All citations use keys from `docs/specifications/bibliography.md`.

### Standards and Protocols

- [ISA-95-1], [ISA-95-2] — Enterprise-control system integration
- [ISA-18.2] — Alarm management lifecycle
- [OPC-UA-14] — OPC UA PubSub
- [SPARKPLUG-B] — Eclipse Sparkplug-B v3.0
- [MQTT-5] — MQTT v5.0
- [NATS-PROTO], [JETSTREAM], [NATS-LEAFNODE], [NATS-ACCOUNTS], [NATS-DECENTRALIZED] — NATS protocols
- [KAFKA] — Apache Kafka
- [FDA-CFR11] — Electronic records / signatures

### Platforms and Vendor Documentation

- [SIEMENS-INSIGHTS], [SIEMENS-EDGE] — Siemens
- [TWX-EVENTS], [TWX-SUBSCRIPTIONS], [TWX-ALWAYSON], [TWX-KEPWARE] — PTC ThingWorx
- [AVEVA-SP], [AVEVA-PI] — AVEVA
- [RA-OPTIX], [RA-PLEX] — Rockwell Automation
- [GEV-CIMPLICITY], [GEV-PROFICY-2025], [GEV-APM] — GE Vernova
- [IGN-PLATFORM], [IGN-TAGS], [IGN-SPARKPLUG] — Ignition
- [AWS-TWINMAKER], [AWS-SITEWISE], [AWS-SITEWISE-NOTIFY] — AWS
- [AZURE-DT], [AZURE-DT-ROUTING], [AZURE-DT-TWIN2TWIN], [AZURE-DT-PERF] — Azure
- [GCP-IOT-ARCH] — Google Cloud

### Platform Economics and Manufacturing Networks

- [OSTROM-COMMONS] — Governing the Commons
- [PARKER-PLATFORM] — Platform Revolution
- [METCALFE-LAW] — Metcalfe's Law of network value
- [TWO-SIDED] — Rochet & Tirole, two-sided markets
- [COASE-FIRM] — Coase, theory of the firm
- [WILLIAMSON-TCE] — Williamson, transaction cost economics
- [SHAPIRO-VARIAN] — Shapiro & Varian, information rules
- [DMC-COMMONS] — Digital Manufacturing Commons
- [MAAS-CATENAX] — Catena-X MaaS ecosystem
- [MAAS-FRAMEWORK] — MaaS integrated framework
- [TEDALDI-MAAS-2023] — MaaS early adopter study
- [EFPF-2020] — European Connected Factory Platform
- [NATS-ADAPTIVE-EDGE] — NATS Adaptive Edge Architecture

### TMNL Internal Research

- [TMNL-INDUSTRY] — Industry leaders competitive analysis
- [TMNL-UNS] — Unified Namespace design

### Effect-TS Framework

- [EFFECT-TS] — Effect-TS ecosystem
- [EFFECT-CLUSTER] — @effect/cluster distributed entities
- [EFFECT-ENTITY] — @effect/cluster Entity API

### Theory

- [EVENT-SOURCING] — Fowler, event sourcing pattern
- [CQRS] — Command Query Responsibility Segregation
- [ENDSLEY-1995] — Endsley, situation awareness theory

---

<!-- Source: rfc-section-theoretical-foundations.md -->
## 1. Cognitive Science Foundations

### 1.1 Situation Awareness (SA) Model

The subscription tier design MUST be justified by Endsley's three-level SA model [ENDSLEY-1995]:

| SA Level | Cognitive Function | Subscription Tier | Delivery Requirement |
|----------|-------------------|-------------------|---------------------|
| **Level 1: Perception** | Raw data intake | Sensor telemetry, equipment state events | High fidelity, low latency |
| **Level 2: Comprehension** | Pattern recognition, status aggregation | Hierarchy-aggregated status, causal chain metadata | Configural display, relational context |
| **Level 3: Projection** | Trend extrapolation, anticipation | Temporal queries, event replay, computed forecasts | Temporal completeness, deterministic replay |

Implementations MUST deliver data at each SA level. Failure to support Level 2 comprehension (status aggregation with causal context) degrades operator performance to the point where Level 1 data volume becomes cognitively overwhelming [ENDSLEY-2012].

The out-of-the-loop problem [ENDSLEY-OOTL] constrains automation design: automated aggregation layers MUST NOT replace the operator's comprehension process entirely. The system SHOULD compute and present aggregated state, but MUST preserve the operator's ability to drill into raw causal data.

### 1.2 Ecological Interface Design (EID)

Rasmussen's Abstraction Hierarchy (AH) [RASMUSSEN-AH] is structurally isomorphic with the ISA-95 equipment hierarchy [ISA-95-1]:

| AH Level | ISA-95 Level | Information Content |
|----------|-------------|---------------------|
| Functional purpose | Enterprise objectives | Revenue, utilization, compliance |
| Abstract function | Site/Plant operations | Throughput, OEE, quality metrics |
| Generalized function | Line/WorkCell processes | Status, cycle time, yield |
| Physical function | Machine/Device operation | Operating parameters, fault codes |
| Physical form | Sensor/Actuator signals | Raw telemetry values |

This isomorphism is NOT coincidental — it reflects the same decomposition of complex systems into means-ends hierarchies [EID-VICENTE]. The subscription model MUST mirror this hierarchy exactly. Implementations MUST NOT flatten, approximate, or add levels beyond those in the ISA-95 hierarchy within an organization's equipment scope.

The Skills-Rules-Knowledge (SRK) framework [RASMUSSEN-1983] requires the interface to support three cognitive modes:

- **Skill-based** (direct perception-action): Status indicators, alarm sounds — no conscious reasoning required
- **Rule-based** (pattern matching): Alarm patterns mapped to known procedures — "if X then do Y"
- **Knowledge-based** (first principles reasoning): Novel situations requiring analysis of underlying system relationships

The Decision Ladder [RASMUSSEN-1986] MUST be traversable at any entry point. Expert operators use shunts (skipping intermediate steps) and leaps (jumping from data to action). The system MUST NOT enforce sequential navigation workflows [CWA-VICENTE].

### 1.3 Information Foraging Theory (IFT)

Operators navigate the entity hierarchy following information scent [PIROLLI-CARD]. The optimal foraging model [PIROLLI-1999] predicts that operators will abandon low-scent navigation paths.

Each entity MUST expose computed summary metadata that serves as information scent for parent entities:

| Scent Signal | Entity Level | Purpose |
|-------------|-------------|---------|
| `worstChildStatus` | Line, Plant, Site | Directs attention to degraded subtrees |
| `activeAlarmCount` | All hierarchy levels | Quantifies urgency without drill-down |
| `trendDirection` | Machine, Sensor | Enables projection without historical query |
| `lastUpdateTimestamp` | All levels | Freshness indicator — stale = suspicious |

This metadata MUST be part of the subscription payload, not a separate query. The Marginal Value Theorem [PIROLLI-2007] predicts that if operators must issue additional queries to assess information value, they will under-explore the hierarchy.

### 1.4 Joint Cognitive Systems (JCS) and Resilience Engineering

The operator-system pair forms a Joint Cognitive System [HOLLNAGEL-JCS]. The four cornerstones of resilience [WOODS-RESILIENCE] map to system capabilities:

| Cornerstone | System Capability |
|-------------|------------------|
| **Respond** (to the actual) | Real-time entity state delivery with bounded latency |
| **Monitor** (the critical) | Subscription filtering by severity, entity type, hierarchy level |
| **Anticipate** (the potential) | Trend analysis, temporal projection queries |
| **Learn** (from the factual) | Event sourcing, deterministic replay, shift handoff |

The Law of Stretched Systems [WOODS-STRETCHED] predicts that new capability will be consumed as expanded operator scope. Implementations MUST include structural overload resistance (P8) — not just data delivery.

Woods' four concepts for resilience [WOODS-FOUR] require graceful extensibility: when automated aggregations fail, the system MUST fall back to raw entity streams rather than displaying "everything is fine" summaries.

### 1.5 Cognitive Work Analysis (CWA)

CWA's five-dimension framework [CWA-VICENTE] requires a **formative** (not normative) design approach. The system MUST support how operators *could* navigate the information space, not prescribe how they *should*.

The Work Domain Analysis dimension confirms the AH-ISA-95 isomorphism. The Decision Ladder analysis (Control Task Analysis) validates the shunt/leap pattern support requirement. The Strategies Analysis dimension requires that the system support multiple cognitive strategies simultaneously.

The Efficiency-Thoroughness Trade-Off (ETTO) principle [HOLLNAGEL-ETTO] predicts that under time pressure, operators will sacrifice thoroughness for speed. The system MUST provide fast approximate signals (information scent) alongside thorough detailed data.

---

## 2. Systems Theory Foundations

### 2.1 Cyber-Physical Systems (CPS) Temporal Semantics

Entity events occur in physical time but are observed in distributed logical time [LEE-CPS]. Implementations MUST handle the timestamp-ordering problem:

- Sensor reading captured at `t_physical`
- Entity state change emitted at `t_emit > t_physical`
- Subscriber receives at `t_receive > t_emit`
- Display renders at `t_display > t_receive`

The end-to-end latency `t_display - t_physical` MUST be bounded per subscription tier. The Precision-Timed Internet of Things (PTIDES) model [LEE-ICII] provides the theoretical basis for per-stream latency budgets:

| Subscription Tier | Latency Budget (`t_display - t_physical`) | Source |
|---|---|---|
| Safety-critical alarms | < 100ms | STAMP hazard analysis [LEVESON-STAMP] |
| Equipment state changes | < 500ms | SA Level 1 perception threshold [ENDSLEY-1995] |
| Hierarchy aggregations | < 2s | SA Level 2 comprehension cycle [ENDSLEY-2012] |
| Temporal queries / replay | < 5s | SA Level 3 projection tolerance |
| Network-level signals (cross-org) | < 300s | Market dynamics, not safety-critical |

Multiform time [LEE-MULTITIME] applies to the manufacturing commons where each organization has its own temporal frame of reference (shift schedules, maintenance windows, production cycles).

### 2.2 STAMP Safety Analysis

Leveson's Systems-Theoretic Accident Model and Processes (STAMP) [LEVESON-STAMP] reframes safety as a control problem. Entity-realtime integration IS a safety control loop: sensors detect physical state, entities compute control decisions, operators take corrective action.

STPA (Systems-Theoretic Process Analysis) identifies four hazardous control actions:

| STPA Hazard | Entity-Realtime Failure | Required Mitigation |
|---|---|---|
| **Control action not provided** | Entity state event not delivered (message loss) | At-least-once delivery + consumer acknowledgment |
| **Unsafe control action** | Incorrect entity state delivered (data corruption) | Schema validation at serialization boundary [EFFECT-SCHEMA] |
| **Control action at wrong time** | Event arrives after SLA (latency violation) | Per-stream latency monitoring + timeout escalation |
| **Control action stopped / persisted** | Silent subscription drop / stale display | Heartbeat protocol + freshness indicators |

Implementations MUST define mitigation strategies for all four STPA hazard categories. "Best effort" delivery MUST NOT be used for safety-critical alarm streams.

### 2.3 Alarm Management: EEMUA 191 + ISA-18.2 + STAMP

Alarm management is the intersection of all three systems-theoretic frameworks. The alarm lifecycle is simultaneously:
- A **STAMP control action** (alarm → operator → corrective action)
- An **ISA-18.2 state machine** (unacknowledged → acknowledged → cleared, with shelved/suppressed/out-of-service branches)
- An **EEMUA 191 performance target** (< 10 alarms per operator per 10-minute period under steady state)

The codebase implements the full ISA-18.2 alarm lifecycle as 10 event types extending `BaseOperationalEvent` (`src/lib/iiot/schemas/events/operational/alarm-events.ts`):

| Event | ISA-18.2 State Transition | STAMP Control Action |
|-------|--------------------------|---------------------|
| `AlarmTriggered` (line 56) | → unacknowledged | Control action provided: condition detected |
| `AlarmAcknowledged` (line 102) | unacknowledged → acknowledged | Operator confirms awareness |
| `AlarmCleared` (line 130) | acknowledged → cleared | Condition resolved |
| `AlarmEscalated` (line 161) | unacknowledged → escalated | Control action at wrong time: no response |
| `AlarmShelved` (line 196) | any → shelved | Temporary suppression (ISA-18.2: max 24h) |
| `AlarmUnshelved` (line 227) | shelved → previous state | Shelve period ended |
| `AlarmSuppressed` (line 256) | any → suppressed | Design suppression (maintenance) |
| `AlarmOutOfService` (line 287) | any → out_of_service | Maintenance mode |
| `AlarmReturnedToService` (line 321) | out_of_service → unacknowledged/cleared | Return to active monitoring |
| `AlarmConfigChanged` (line 352) | (config change, not state) | Threshold/severity modification |

**Normative requirements derived from alarm theory**:

1. The complete alarm lifecycle (triggered → acknowledged → cleared) MUST be recorded as an ordered sequence in EventLog with `deny_delete: true` [ISA-18.2].
2. Alarm shelving SHOULD enforce a maximum duration (RECOMMENDED: 24 hours per ISA-18.2). `AlarmShelved.shelvedUntil` (alarm-events.ts:209) carries the expiry timestamp.
3. Every alarm suppression MUST carry `reason` and `suppressedBy` fields (alarm-events.ts:268-269) for STAMP audit trail compliance.
4. Alarm escalation MUST track `elapsedSeconds` since triggering (alarm-events.ts:177) — this provides the EEMUA 191 response time metric.
5. Alarm events MUST carry `AlarmSeverity` (from `src/lib/iiot/schemas/alarms.ts`) for EEMUA 191 prioritization. STAMP requires that severity classification determines delivery tier latency (< 100ms for critical).

### 2.4 Three-Category Event Architecture

Event sourcing serves the cognitive requirement, but not all events have the same storage semantics. The event base classes (`src/lib/iiot/schemas/events/base.ts`) define three divergent categories:

| Category | Base Class | Storage | Query Pattern | P4 Role |
|----------|-----------|---------|---------------|---------|
| **Structural** (line 51) | `BaseStructuralEvent` | EventLog (JSONB) | Replay from origin | System "shape" — what exists, where |
| **Operational** (line 118) | `BaseOperationalEvent` | EventLog (JSONB) | Replay + time-travel | System "behavior" — state changes, alarms |
| **Temporal** (line 199) | `BaseTemporalEvent` | TimescaleDB | Time-bucketed aggregation | Measurements — NOT event sourced |

This three-category split is theoretically grounded:
- **Structural** events satisfy P4 temporal completeness for configuration replay and STAMP audit of "what was the hierarchy structure when this alarm occurred?"
- **Operational** events satisfy P4 for state change replay and P2 causal chain (each carries `causedBy` at line 61 and `correlationId` at line 79).
- **Temporal** events satisfy SA Level 1 perception with high-frequency measurement delivery. They include OPC-UA quality codes (`OpcQuality` at line 157) for data trustworthiness attestation.

`BaseStructuralEvent` uniquely carries `hierarchyPath: Schema.Array(AssetId)` (line 76) — the full ISA-95 path from root to entity at event time. This enables single-query child lookup and audit trail: "this entity was under this parent when this event occurred."

### 2.5 Event Sourcing as Cognitive Requirement

Event sourcing is not merely a technical architecture choice — it is a cognitive requirement derived from three independent theoretical sources:

1. **SA Level 3 (Projection)** [ENDSLEY-1995]: Operators project future state from past trends. This requires temporal query capability: "what was the state at time T?"
2. **Resilience Engineering (Learn cornerstone)** [WOODS-RESILIENCE]: Learning from incidents requires deterministic replay of event sequences.
3. **STAMP (Audit trail)** [LEVESON-STAMP]: Safety investigation requires a complete, immutable record of all state changes.

The event store MUST support temporal queries and deterministic replay. Given the same event sequence, implementations MUST produce the same projected state.

---

## 3. Manufacturing Commons Foundations

### 3.1 The Persona Spectrum

The system serves a metropolitan manufacturing commons of ~200,000 organizations spanning the full cognitive task spectrum [research-theoretical-foundations.md, Section 9.1]:

| Persona | Organization | ISA-95 Depth | Interface | Cognitive Context |
|---------|-------------|-------------|-----------|-------------------|
| **Earl** | 2-person machine shop | 1 level | Phone/tablet | Machinist-first, monitoring secondary |
| **Maria** | 15-person contract manufacturer | 3-4 levels | Desktop + monitors | Dedicated production manager |
| **Boeing** | 500+ employees | 7 levels | Control room | Dedicated operators, shift teams |

Implementations MUST serve all three personas without requiring Earl to configure ISA-95 hierarchies or Boeing to simplify to a phone interface.

### 3.2 Three Realtime Regimes

SA operates at three distinct scales in the manufacturing commons, each with different latency requirements and social structures:

| Regime | Latency | SA Model | Social Structure | Cognitive Task |
|--------|---------|----------|-----------------|----------------|
| **Equipment realtime** | 1-100ms | Individual SA Level 1 [ENDSLEY-1995] | Single operator | Physical safety, process control |
| **Shop realtime** | 1-60s | Individual SA Level 2 | Organization | Job status, machine health, planning |
| **Network realtime** | 1-300s | Distributed SA [DISTRIBUTED-SA] | Inter-organization | Capacity matching, supply chain resilience |

Implementations MUST support all three regimes. A subscription model that only addresses equipment realtime fails the 200K-org use case. A model that only addresses network realtime fails the safety-critical use case.

### 3.3 Distributed Situation Awareness (DSA)

Stanton et al. [DISTRIBUTED-SA] extend SA from individual cognition to **distributed situation awareness**: awareness as an emergent property of a sociotechnical system, not the sum of individual awarenesses.

In the manufacturing commons:
- Each organization holds a **partial, overlapping** view of the network
- No single participant has complete SA — completeness is a system property
- The platform IS a cognitive artifact in the DSA framework, actively mediating between agents

The subscription model MUST serve both individual SA (Earl watching his machines) and collective SA (the network monitoring aggregate capacity). Endsley's team SA model [ENDSLEY-TEAM-SA] provides the bridge: shared mental models within teams, compatible mental models across organizations.

### 3.4 Abstraction Hierarchy Extension Above Enterprise

The AH-ISA-95 isomorphism (Section 1.2) remains valid within an organization. The manufacturing commons adds hierarchy levels above Enterprise:

```
Manufacturing Commons     (collective KPIs: regional capacity, utilization, resilience)
  Regional Network         (aggregate capabilities, availability by capability type)
    Organization           (reputation, capacity, availability, capability set)
      [ISA-95 levels]      (variable depth: 1 level for Earl, 7 for Boeing)
        Equipment           (machines, sensors — traditional IIoT domain)
```

This produces two distinct navigation zones:

| Zone | Navigation Model | Information Scent | Causal Visibility | Cognitive Agent |
|------|-----------------|-------------------|-------------------|-----------------|
| **Intra-org** | EID Abstraction Hierarchy traversal | Equipment status propagation | Full causal chains | The operator |
| **Inter-org** | Capability/availability discovery | Capacity signals, reputation | Redacted (see P11) | The platform as cognitive artifact |

### 3.5 Ostrom's Commons Governance

Elinor Ostrom's eight design principles for commons governance [OSTROM-COMMONS] ground the manufacturing network's governance architecture:

| Principle | Application | System Requirement |
|-----------|------------|-------------------|
| Clearly defined boundaries | Each org's data sovereignty boundary | MUST enforce tenant isolation |
| Proportional benefits/costs | More sharing = better network matching | SHOULD incentivize availability data sharing |
| Collective-choice arrangements | Capability taxonomies, quality standards | MUST support governance decisions |
| Monitoring | Availability claims vs actual performance | MUST track fulfillment rates |
| Graduated sanctions | Misrepresentation loses network priority | SHOULD implement reputation degradation |
| Conflict resolution | Order rerouting disputes, quality disputes | MUST provide dispute resolution interface |
| Rights to organize | Small shops have equal governance voice | MUST NOT be pay-to-play |
| Nested enterprises | Regional networks within national commons | MUST support multi-level governance |

The entity-realtime system is governance infrastructure: availability events are commitments, machine state changes affect reputation, and the subscription model mediates commons governance by making behavior observable.

### 3.6 Information Foraging on Mobile Devices

For small-shop owners using phones, the cost of between-patch navigation MUST approach zero [PIROLLI-CARD]. Research on smartphone cognitive effects [WARD-SMARTPHONE-COG] confirms that mobile users process information less deeply and are less vigilant.

The platform MUST compensate by delivering pre-digested, actionable information to phone users. The phone notification IS the information patch — not a pointer to a dashboard that requires further navigation.

---

## 4. Architectural Principles P1-P8: Intra-Organization

These eight principles are derived from the cross-theory convergence of SA, EID, JCS, IFT, CWA, CPS, and STAMP. They are normative for intra-organization concerns.

### P1: Hierarchy-Aware Subscriptions (SA + EID + CWA)

Implementations MUST support subscription at any ISA-95 level with configurable depth and abstraction. Higher levels MUST deliver comprehension-ready (Level 2) aggregations. Lower levels MUST deliver perception-ready (Level 1) raw data.

> **Implementation**: `SubscribeReadings` accepts optional `deviceId` and `plantId` for level-specific filtering (`src/lib/iiot/rpc/RealtimeRpcs.ts:107-121`). `SubscribeEquipmentState` accepts `entityType` from 6 ISA-95 levels (`RealtimeRpcs.ts:149-161`). The `EquipmentLevel` enum (`src/lib/iiot/schemas/identifiers.ts:28-38`) defines all 9 hierarchy levels.

### P2: Causal Chain Preservation (EID + STAMP + CPS)

Events MUST carry causality metadata. When Machine-001 FAULTS causing Line-007 to DEGRADE, the Line-007 event MUST reference Machine-001 as the causal antecedent. This enables configural displays [EID-VICENTE] and incident investigation [LEVESON-STAMP].

> **Implementation**: `EquipmentStateChange` carries `entityType`, `entityId`, `previousState`, `currentState`, `changedBy` (`RealtimeRpcs.ts:70-80`). `AlarmEvent` carries `deviceId` linking to causal equipment (`RealtimeRpcs.ts:50-62`). State transitions are validated by `Graph.directed` state machines (e.g., `src/lib/iiot/machines/graphs/plant-graph.ts:84-123` — 6 states, 9 transitions, validated via `Graph.hasEdge`).

### P3: Information Scent Propagation (IFT + SA)

Each entity MUST expose computed summary metadata (`worstChildStatus`, `activeAlarmCount`, `trendDirection`, `lastUpdateTimestamp`) as part of the subscription payload. This metadata MUST NOT require separate queries.

> **Implementation**: 12 entity handlers (`src/lib/iiot/entity/EntityStack.ts:54-67`) produce state change events at every ISA-95 level. `ReactivityBridge` (`src/lib/iiot/realtime/reactivity-bridge.ts:82-85`) publishes these events inline to `EventDistribution`, making state transitions available as subscription payloads without separate queries.

### P4: Temporal Completeness for Projection (SA + Event Sourcing + STAMP)

The event store MUST support temporal queries ("state at time T") and deterministic replay. This satisfies SA Level 3 projection [ENDSLEY-1995], the Learn cornerstone [WOODS-RESILIENCE], and the STAMP audit trail requirement [LEVESON-STAMP].

> **Implementation**: `EventId` and `FactId` branded identifiers (`src/lib/iiot/schemas/identifiers.ts:140-146`) anchor immutable journal entries. `SensorEntityRpcs` provide GetLatest, GetAggregated, GetStats temporal query endpoints. JetStream streams with `deny_delete: true` ensure immutability per STAMP audit requirements.

### P5: Bounded-Latency Delivery (CPS + SA + STAMP)

Each subscription tier MUST have a defined latency SLA:

| Tier | SLA | Theoretical Basis |
|------|-----|-------------------|
| Critical alarms | < 100ms | STAMP hazard classification |
| Entity state changes | < 500ms | SA Level 1 perception |
| Hierarchy aggregations | < 2s | SA Level 2 comprehension |

Violation of these SLAs MUST be a monitorable failure condition, not a silent degradation.

> **Implementation**: `EventDistribution` registers 4 ChannelService channels with distinct `maxLag` bounds: readings at 10,000 (`event-distribution.ts:173`), alarms/equipment/invalidations at 1,000 (`event-distribution.ts:181,189,197`). `DistributionMetrics` (`event-distribution.ts:77-91`) track per-channel publish counts for monitoring.

### P6: Graceful Extensibility Under Load (JCS + SA + Woods)

When automated aggregations fail, the system MUST fall back to raw entity streams. When event rates exceed capacity, the system MUST shed load intelligently (reduce update frequency, aggregate more aggressively) rather than failing entirely. Full automation blackout MUST never leave the operator without data [WOODS-FOUR].

> **Implementation**: The dual-write architecture publishes to local PubSub AND NATS simultaneously (`event-distribution.ts:280-326`). If NATS fails, local PubSub → ChannelService → outlet streams remain operational. `HolonetBridge` uses `Effect.ignoreLogged` (`holonet-bridge.ts:100-128`) — NATS errors are logged but never block local delivery. Four independent channels ensure a failure in one event type does not cascade to others.

### P7: Unconstrained Navigation (CWA + IFT)

The subscription model MUST NOT enforce navigation paths. Operators MUST be able to compose arbitrary entity combinations, subscribe to cross-hierarchy groups, and restructure their information space in real-time. The Decision Ladder MUST be traversable at any entry point [CWA-VICENTE].

> **Implementation**: 17 RPC groups composed into `IIoTRpcs` (`src/lib/iiot/rpc/index.ts:91-112`). Clients select any combination of streaming + query RPCs: 4 realtime streaming endpoints (`RealtimeRpcs.ts:183-188`) plus 13 entity-derived RPC groups covering all ISA-95 levels. No navigation path is enforced — clients compose freely.

### P8: Overload Resistance (Law of Stretched Systems + SA)

Implementations MUST include configurable subscription capacity limits per operator session, SA degradation warnings when monitoring channels exceed cognitive capacity, and workload indicators visible to supervisors [WOODS-STRETCHED].

> **Implementation**: Channel `maxLag` bounds provide partial overload protection. `SubscribeReadings` accepts `throttleMs` (`RealtimeRpcs.ts:114-116`) for client-configurable emission rate limiting. Full `maxSubscriptions` per session not yet implemented.

---

## 5. Architectural Principles P9-P12: Manufacturing Commons

These four principles extend P1-P8 to the 200K-org manufacturing commons context. They are normative for inter-organization concerns.

### P9: Variable-Depth Hierarchy (CWA Formative + EID)

The system MUST support ISA-95 hierarchies from 1 level (Earl) to 7+ levels (Boeing) without requiring administrative configuration for simple cases. Equipment registration SHOULD infer hierarchy from relationships. The subscription model MUST degenerate gracefully: for a flat hierarchy, "subscribe to shop" MUST equal "subscribe to machine."

> **Implementation**: `EquipmentLevel` (`src/lib/iiot/schemas/identifiers.ts:28-38`) defines 9 levels: enterprise, site, area, plant, line, workcell, machine, sensor, device. Each level has a branded ID type (lines 46-79). All filter fields on streaming RPCs are `Schema.optional` — omitting `plantId` on `SubscribeReadings` returns all readings, gracefully degenerating for flat hierarchies. `SubscribeEquipmentState` accepts any of 6 entity types (`RealtimeRpcs.ts:152-154`).

### P10: Distributed SA Mediation (DSA + JCS)

The platform MUST mediate between individual SA (each org's view of their equipment) and collective SA (the network's view of aggregate capacity). Events crossing org boundaries MUST be delivered as abstract signals, not raw data. The platform MUST compute collective awareness that no single participant possesses [DISTRIBUTED-SA].

> **Implementation**: `HolonetBridge` (`src/lib/iiot/realtime/holonet-bridge.ts:88-91`) provides bidirectional NATS bridge for cross-node events. Outbound: fire-and-forget publish to NATS subjects (lines 102-128). Inbound: wildcard subscriptions to `iiot.readings.*`, `iiot.alarms.*`, `iiot.equipment.*`, `iiot.invalidations.*` (lines 136-182). `EventDistribution` remote ingress daemons (lines 249-263) inject remote events into local ChannelService channels. NATS account-based isolation ensures org boundaries (specified in `rfc-section-security-trust.md:38-137`).

### P11: Sovereignty-Preserving Causality (STAMP + Ostrom)

Causal chains MUST be fully preserved within org boundaries but MUST be redacted to authorized abstractions when crossing boundaries. "Supplier experienced disruption" is a valid cross-org causal signal. "Supplier's spindle motor drew 47A" MUST NOT cross org boundaries without explicit trust authorization. The redaction boundary MUST be configurable per trust relationship.

> **Implementation**: Schema-level redaction via `Schema.omit` and `Schema.pick` is specified in the security RFC (`rfc-section-security-trust.md:193-209`). NATS export rules specify target accounts and subject restrictions (security RFC lines 109-117). Cross-org event schemas are explicit subsets of internal schemas. Implementation requires auth middleware integration (planned).

### P12: Commons Governance Observability (Ostrom + Resilience Engineering)

The platform MUST make participant behavior observable for commons governance. Availability commitments, fulfillment rates, quality metrics, and response times are governance data — not just operational data. The subscription model MUST serve double duty: operational awareness for participants AND governance monitoring for the commons [OSTROM-COMMONS].

> **Implementation**: The 4-channel `EventDistribution` architecture (`event-distribution.ts:136-157`) is extensible to governance channels. `DistributionMetrics` (`event-distribution.ts:77-91`) already tracks per-channel publish counts — the same pattern extends to governance metrics. Trust score computation is specified as a singleton service in `@effect/cluster` (security RFC `rfc-section-security-trust.md:273-279`). Entity types for governance observability planned.

---

## 6. Theory-to-Implementation Mapping

### 6.1 Intra-Organization Mapping

| Principle | Implementation Mechanism | Codebase Reference | Evidence |
|-----------|------------------------|-------------------|----------|
| P1: Hierarchy subscriptions | `SubscribeReadings` with optional `deviceId` / `plantId` filtering; `SubscribeEquipmentState` with optional `entityType` / `plantId` | `src/lib/iiot/rpc/RealtimeRpcs.ts:107-161` | SubscribeReadings accepts `deviceId`, `plantId`, `throttleMs` (lines 108-117). SubscribeEquipmentState accepts `entityType` (6 ISA-95 levels) and `plantId` (lines 149-161). Clients compose arbitrary filter combinations per CWA formative principle. |
| P2: Causal chain | Equipment state transitions carry `previousState` / `currentState` with entity identity; alarm events carry `deviceId` linking to causal equipment | `src/lib/iiot/rpc/RealtimeRpcs.ts:70-80` (EquipmentStateChange schema), `src/lib/iiot/realtime/reactivity-bridge.ts:106-114` (bridge publishes state transitions) | EquipmentStateChange at line 70 carries `entityType`, `entityId`, `previousState`, `currentState`, `changedBy`. ReactivityBridge.onEquipmentStateChange (line 106) constructs and publishes these events inline after handler writes to EventLog. |
| P3: Information scent | Entity handlers at each ISA-95 level produce state change events that propagate up the hierarchy | `src/lib/iiot/entity/EntityStack.ts:54-67` (Layer.mergeAll of 12 entity handlers covering all ISA-95 levels), `src/lib/iiot/machines/graphs/plant-graph.ts:84-123` (formalized state machine with 6 states, 9 transitions) | EntityHandlersLayer (line 54) merges 12 handler layers from Enterprise down to SensorAsset. Plant state graph validates transitions via `Graph.hasEdge` (line 154), ensuring only valid state signals propagate. |
| P4: Temporal completeness | JetStream event storage + temporal query RPCs | `src/lib/iiot/rpc/SensorEntityRpcs.ts` (GetLatest, GetAggregated, GetStats RPCs), `src/lib/iiot/schemas/identifiers.ts:140-146` (EventId, FactId branded types for immutable journal entries) | EventId (line 140) and FactId (line 144) are branded identifiers for immutable event journal entries. SensorEntityRpcs provide temporal query endpoints. |
| P5: Bounded latency | Per-channel `maxLag` bounds in ChannelService registration; 4 separate channels with distinct backpressure characteristics | `src/lib/iiot/realtime/event-distribution.ts:169-199` (channel registration with maxLag), `src/lib/streams/constructs/ChannelService.ts` (broadcast outlet with bounded lag) | Readings channel uses `maxLag: 10_000` (line 173) for high-throughput tolerance. Alarms/equipment/invalidations use `maxLag: 1_000` (lines 181, 189, 197) for tighter latency bounds. ChannelService broadcast outlets enforce these bounds. |
| P6: Graceful extensibility | 4 independent ChannelService channels: `iiot:readings`, `iiot:alarms`, `iiot:equipment`, `iiot:invalidations` — each with PubSub inlet, broadcast outlet, and NATS bridge | `src/lib/iiot/realtime/event-distribution.ts:136-157` (channel definitions), `src/lib/iiot/realtime/event-distribution.ts:210-243` (PubSub inlet → ChannelService wiring), `src/lib/iiot/realtime/event-distribution.ts:249-263` (NATS remote ingress daemons) | Raw event streams flow through PubSub inlets (lines 210-213) into ChannelService channels. If computed aggregation fails, raw streams remain available via outlet subscriptions (lines 330-348). NATS ingress daemons (lines 249-263) ensure cross-node events feed into the same channels. |
| P7: Unconstrained navigation | 17 RPC groups composed into single `IIoTRpcs` group; clients select arbitrary combinations of streaming + query RPCs | `src/lib/iiot/rpc/index.ts:91-112` (IIoTRpcs = RpcGroup.make of 17 groups), `src/lib/iiot/rpc/RealtimeRpcs.ts:183-188` (RealtimeRpcs group with 4 streaming endpoints) | IIoTRpcs composes all 17 groups (lines 91-112): SensorRpcs, AssetRpcs, AlarmRpcs, WorkOrderRpcs, EquipmentStateRpcs, PlantRpcs, LineRpcs, WorkCellRpcs, MachineAssetRpcs, DeviceRpcs, SensorAssetRpcs, EnterpriseRpcs, SiteRpcs, AreaRpcs, AssetEntityRpcs, SensorEntityRpcs, and RealtimeRpcs. Clients compose any combination without enforced navigation path. |
| P8: Overload resistance | `maxSubscriptions` per session + event rate monitoring | (planned — not yet implemented; `maxLag` channel bounds provide partial protection) |

### 6.2 Manufacturing Commons Mapping

| Principle | Implementation Mechanism | Codebase Reference | Status |
|-----------|------------------------|-------------------|--------|
| P9: Variable-depth hierarchy | 9-level `EquipmentLevel` enum; branded IDs for each level; all levels optional in composition | `src/lib/iiot/schemas/identifiers.ts:28-38` (EquipmentLevel: enterprise, site, area, plant, line, workcell, machine, sensor, device), `src/lib/iiot/schemas/identifiers.ts:46-79` (9 branded ID types: EnterpriseId through DeviceId) | Schemas exist. EquipmentLevel (line 28) defines the full 9-level ISA-95 hierarchy. Each level has a branded ID type (lines 46-79). SubscribeEquipmentState (RealtimeRpcs.ts:152-154) accepts `entityType` from 6 of these levels, demonstrating variable-depth filtering. Hierarchy inference from equipment relationships planned. |
| P10: DSA mediation | Cross-node event distribution via HolonetBridge; outbound fire-and-forget publish to NATS subjects; inbound wildcard subscriptions yield typed Streams | `src/lib/iiot/realtime/holonet-bridge.ts:97-128` (outbound: fire-and-forget publish with `Effect.ignoreLogged`), `src/lib/iiot/realtime/holonet-bridge.ts:136-182` (inbound: NATS wildcard subscriptions for 4 event types), `src/lib/iiot/realtime/event-distribution.ts:249-263` (remote ingress: NATS → local PubSub → ChannelService) | Implemented. HolonetBridge (line 88) provides bidirectional NATS bridge. Outbound uses `Effect.ignoreLogged` (lines 102-128) — events are never blocked by cross-node failures. Inbound subscribes to `iiot.readings.*`, `iiot.alarms.*`, `iiot.equipment.*`, `iiot.invalidations.*` wildcards (lines 136-182). EventDistribution ingress daemons (lines 249-263) inject remote events into local channels. |
| P11: Sovereignty-preserving causality | Trust-boundary event redaction in cross-org event handlers | Planned — NATS account-based isolation is specified in `rfc-section-security-trust.md:38-137`. Schema-level redaction via `Schema.omit` specified in Section Z.6.1 (security RFC). Requires auth middleware integration. |
| P12: Commons governance | Governance event channel + fulfillment tracking entities | Planned — entity types not yet defined. The 4-channel EventDistribution architecture (event-distribution.ts:136-157) is extensible to governance channels.

### 6.3 Codebase Architecture Evidence

The following codebase structures provide structural evidence for the theoretical principles:

**ISA-95 Hierarchy as Navigation Structure (P1, P9, EID)**

The branded identifier hierarchy in `src/lib/iiot/schemas/identifiers.ts` mirrors the ISA-95 / Abstraction Hierarchy isomorphism:

```
EnterpriseId → SiteId → AreaId → PlantId → LineId → WorkCellId → MachineId → SensorId/DeviceId
```

Each level has a corresponding entity handler in `src/lib/iiot/entity/` (12 handlers composed via `EntityStack.ts:54-67`), RPC group in `src/lib/iiot/rpc/` (17 groups composed via `rpc/index.ts:91-112`), and state machine graph in `src/lib/iiot/machines/graphs/` (12 directed graphs for transition validation).

**Formalized State Transitions (P2, STAMP)**

State machines use `Graph.directed` (Effect Graph module) with explicit state nodes and typed transition edges. Example from `src/lib/iiot/machines/graphs/plant-graph.ts`:
- 6 states: commissioning, operational, scheduled_shutdown, emergency_shutdown, maintenance_shutdown, decommissioned (lines 86-91)
- 9 transitions with named actions (lines 96-120)
- Terminal state: `decommissioned` — no outgoing edges (line 122)
- Transition validation via `Graph.hasEdge` (line 154)
- Neighbor queries via `Graph.neighborsDirected` (line 191)

This pattern is replicated across all 12 graph files in `src/lib/iiot/machines/graphs/`, providing STAMP-compliant control structure validation for the entire ISA-95 hierarchy.

**Handler-Level Integration (P2, P3, JCS)**

The `ReactivityBridge` service (`src/lib/iiot/realtime/reactivity-bridge.ts:82-85`) implements Approach A: handler-level integration. Entity handlers call the bridge inline after writing to EventLog (example at lines 14-27). This preserves causal ordering — the event is published to EventDistribution in the same Effect pipeline as the state change, ensuring the subscriber sees state transitions in causal order.

**Event Distribution as Cognitive Infrastructure (P5, P6)**

The `EventDistribution` service (`src/lib/iiot/realtime/event-distribution.ts:127-130`) implements the four-cornerstone resilience model:
- **Respond**: Real-time event delivery via 4 ChannelService channels (lines 169-199)
- **Monitor**: `DistributionMetrics` tracking per-channel publish counts (lines 77-91, 267)
- **Anticipate**: Trend analysis enabled by temporal event sequences
- **Learn**: Event streams feed into JetStream for deterministic replay

The dual-write architecture (local PubSub + NATS via HolonetBridge) at lines 280-326 ensures that a NATS failure never blocks local event delivery — satisfying the "graceful extensibility" requirement (P6, Woods' Four).

---

## 7. Normative Constraints Derived from Theory

### 7.1 MUST Constraints

The following constraints are derived from multiple independent theoretical frameworks and MUST be satisfied:

1. **The ISA-95 hierarchy IS the navigation structure** (EID + CWA). Implementations MUST NOT add, remove, or reorder hierarchy levels within an organization's equipment scope. *Evidence: `EquipmentLevel` enum at `identifiers.ts:28-38` defines exactly the 9 ISA-95 levels. 12 entity handlers in `EntityStack.ts:54-67` map 1:1 to hierarchy levels.*

2. **Status cascade propagation MUST be automatic and sub-second** (SA Level 2 + EID). Without worst-child-status propagation, operators cannot achieve comprehension. *Evidence: `ReactivityBridge` at `reactivity-bridge.ts:91-134` publishes state changes inline during handler execution. `EventDistribution` channels use broadcast outlets with bounded lag (`event-distribution.ts:169-199`).*

3. **Event sourcing MUST support temporal queries and deterministic replay** (SA Level 3 + Resilience Engineering + STAMP). The event store is a cognitive requirement, not just a technical one. *Evidence: `EventId` and `FactId` branded types at `identifiers.ts:140-146` anchor immutable journal entries. State machines (`plant-graph.ts:84-123`) ensure only valid transitions are recorded.*

4. **Latency SLAs MUST be formally defined and monitorable per subscription tier** (CPS + STAMP). "Best effort" delivery is architecturally unacceptable for safety-critical streams. *Evidence: `DistributionMetrics` at `event-distribution.ts:77-91` track per-channel publish counts. Channel `maxLag` bounds (`event-distribution.ts:173,181,189,197`) enforce bounded delivery.*

5. **The subscription model MUST support all three realtime regimes** — equipment, shop, and network — simultaneously (SA + DSA + manufacturing commons). *Evidence: Equipment regime served by `SubscribeReadings` (device-level, `RealtimeRpcs.ts:107-121`). Shop regime by `SubscribeEquipmentState` (plant-level, `RealtimeRpcs.ts:149-161`). Network regime by `HolonetBridge` NATS wildcards (`holonet-bridge.ts:136-182`).*

6. **Cross-org events MUST be redacted at trust boundaries** (STAMP + Ostrom). Raw equipment data MUST NOT cross org boundaries without explicit authorization. *Evidence: NATS account-based isolation specified in `rfc-section-security-trust.md:38-137`. Schema-level redaction via `Schema.omit` specified at security RFC lines 193-209.*

### 7.2 MUST NOT Constraints

1. **Implementations MUST NOT build fully automated comprehension layers** that replace operator judgment (SA out-of-the-loop problem [ENDSLEY-OOTL]).

2. **Implementations MUST NOT enforce navigation workflows** (CWA formative principle [CWA-VICENTE]). The subscription model MUST be composable and operator-driven.

3. **Implementations MUST NOT hide causality behind aggregate status** (EID configural display [EID-VICENTE]). "Line DEGRADED" without visible connection to the causing machine state destroys situational awareness.

4. **Implementations MUST NOT treat all subscriptions equally** (CPS QoS + STAMP hazard classification). Safety-critical alarm streams have different reliability and latency requirements than trend queries.

5. **Implementations MUST NOT require small shops to configure ISA-95 hierarchies** (CWA formative principle + P9). Equipment registration SHOULD infer hierarchy from relationships.

### 7.3 SHOULD Constraints

1. Implementations SHOULD provide shortcut paths for expert operators (SRK + Decision Ladder shunts/leaps).

2. Implementations SHOULD surface cognitive load indicators visible to supervisors (P8 + Law of Stretched Systems).

3. Implementations SHOULD deliver pre-digested, actionable information to mobile users rather than raw event streams (IFT + smartphone cognitive effects [WARD-SMARTPHONE-COG]).

4. Implementations SHOULD incentivize availability data sharing through better network matching (Ostrom proportional benefits/costs).

---

## 8. Open Questions

### 8.1 Unresolved Theoretical Tensions

1. **P2 vs P11**: Causal chain preservation (P2) conflicts with sovereignty-preserving causality (P11) at org boundaries. The redaction mechanism must preserve enough causal information for cross-org SA Level 2 comprehension while protecting proprietary operational details. The granularity of redaction is an open design question.

2. **P6 vs P8**: Graceful extensibility (P6, raw fallback) increases cognitive load, which P8 (overload resistance) is designed to prevent. The system must balance between "never leave the operator without data" and "do not overwhelm the operator with data."

3. **P9 variable-depth hierarchy**: How does the subscription model degenerate for Earl's 1-level hierarchy without special-casing? Can the same RPC endpoints serve both "subscribe to machine" and "subscribe to 7-level enterprise hierarchy" without client-side complexity?

4. **Ostrom Principle 3 (collective-choice)**: Who governs capability taxonomies and quality standards? The platform provides the infrastructure, but governance processes are social, not technical.

### 8.2 Empirical Validation Required

1. **SA Level latency budgets**: The 100ms / 500ms / 2s SLAs are derived from theory but have not been validated in the manufacturing commons context. User testing SHOULD validate these thresholds.

2. **Information scent effectiveness**: The proposed scent signals (`worstChildStatus`, `activeAlarmCount`, etc.) are theoretically grounded but untested. A/B testing SHOULD compare alternative scent compositions.

3. **Phone UX for Earl**: The "notification IS the information patch" hypothesis needs empirical validation. Does push-based information delivery actually improve SA for intermittent-attention users?

---

## Bibliography

All citations use keys from the canonical bibliography (`docs/specifications/bibliography.md`).

### Primary Sources

| Key | Relevance |
|-----|-----------|
| `[ENDSLEY-1995]` | SA Level 1/2/3 model — foundation for subscription tier design |
| `[ENDSLEY-2012]` | 50 SA design principles — validation criteria for interface patterns |
| `[ENDSLEY-OOTL]` | Out-of-the-loop performance problem — automation design constraint |
| `[EID-VICENTE]` | Abstraction Hierarchy + SRK — theoretical basis for ISA-95 navigation |
| `[CWA-VICENTE]` | Five-dimension CWA framework — formative design approach |
| `[RASMUSSEN-1983]` | SRK framework — operator behavior classification |
| `[RASMUSSEN-AH]` | Abstraction Hierarchy — structural isomorphism with ISA-95 |
| `[RASMUSSEN-1986]` | Decision Ladder — cognitive process model for operator decision-making |
| `[HOLLNAGEL-JCS]` | Joint Cognitive Systems — human-machine collaboration model |
| `[HOLLNAGEL-ETTO]` | ETTO principle — efficiency-thoroughness trade-off in design |
| `[WOODS-RESILIENCE]` | Four cornerstones of resilience — respond, monitor, anticipate, learn |
| `[WOODS-STRETCHED]` | Law of Stretched Systems — capability consumed as expanded scope |
| `[WOODS-FOUR]` | Four concepts for resilience — graceful extensibility requirement |
| `[PIROLLI-CARD]` | Information Foraging Theory — navigation and scent model |
| `[PIROLLI-1999]` | Extended IFT — patch model and scent formalization |
| `[PIROLLI-2007]` | ACT-IF computational model — Marginal Value Theorem |
| `[LEE-CPS]` | CPS temporal semantics — timing uncertainty in distributed systems |
| `[LEE-ICII]` | PTIDES — deterministic timing for Industrial IoT |
| `[LEE-MULTITIME]` | Multiform time — temporal semantics for distributed CPS |
| `[LEVESON-STAMP]` | STAMP accident model — safety as control problem |
| `[DISTRIBUTED-SA]` | Distributed Situation Awareness — network-level cognition model |
| `[ENDSLEY-TEAM-SA]` | Team SA — shared and compatible mental models |
| `[OSTROM-COMMONS]` | Commons governance — 8 design principles for collective action |
| `[WARD-SMARTPHONE-COG]` | Smartphone cognitive effects — mobile attention constraints |

### Supporting Sources

| Key | Relevance |
|-----|-----------|
| `[ISA-95-1]` | Equipment hierarchy standard |
| `[ISA-18.2]` | Alarm management standard |
| `[FDA-CFR11]` | Regulatory requirement for audit trail |
| `[RFC2119]` | Requirement level keywords |
| `[RFC8174]` | Requirement level keyword clarification |
| `[EFFECT-SCHEMA]` | Runtime schema validation |
| `[EFFECT-CLUSTER]` | Entity distribution infrastructure |

---

<!-- INTEGRATION NOTES
- This section provides the theoretical justification for ALL architectural decisions in RFC-001
- Principles P1-P8 constrain intra-org design (Sections 4-8 of the main RFC)
- Principles P9-P12 constrain inter-org design (Sections 9-11 of the main RFC)
- Cross-references: rfc-section-effect-architecture.md (P1-P8 implementation), rfc-section-multi-tenant-network.md (P9-P12 implementation), rfc-section-consistency-guarantees.md (P4/P5 consistency model)
- Dependencies: None — this section is foundational; other sections depend on it
- Replaces/Extends: Intended to be RFC-001 Section 3 (Theoretical Foundations) based on the main RFC structure

CODEBASE GROUNDING (2026-02-09):
  All 12 principles (P1-P12) and 6 MUST constraints now cite specific codebase files with line numbers.
  Key implementation files referenced:
  - src/lib/iiot/rpc/RealtimeRpcs.ts (4 streaming RPCs, ISA-18.2 alarm lifecycle)
  - src/lib/iiot/rpc/index.ts (17 RPC groups composed into IIoTRpcs)
  - src/lib/iiot/schemas/identifiers.ts (9-level EquipmentLevel, 19 branded IDs)
  - src/lib/iiot/entity/EntityStack.ts (12 entity handlers via Layer.mergeAll)
  - src/lib/iiot/realtime/event-distribution.ts (4-channel ChannelService hub)
  - src/lib/iiot/realtime/reactivity-bridge.ts (handler-level integration adapter)
  - src/lib/iiot/realtime/holonet-bridge.ts (NATS bidirectional bridge)
  - src/lib/iiot/machines/graphs/plant-graph.ts (Graph.directed state machine)
  - rfc-section-security-trust.md (NATS account isolation, Schema.omit redaction)
  Section 6.3 provides narrative evidence linking codebase patterns to theoretical principles.
-->

<!-- Source: rfc-section-architectural-principles.md -->
## 1. Overview

### 1.1 Principle Derivation

All twelve architectural principles are derived from cross-theory convergence across
seven peer-reviewed frameworks. No principle relies on a single theoretical source.

| Principle | Primary Theory | Supporting Theories |
|-----------|---------------|-------------------|
| P1 | Endsley SA [ENDSLEY-1995] | EID [EID-VICENTE], CWA [CWA-VICENTE] |
| P2 | EID [EID-VICENTE] | STAMP [LEVESON-STAMP], CPS [LEE-CPS] |
| P3 | IFT [PIROLLI-CARD] | SA Level 2 [ENDSLEY-1995] |
| P4 | SA Level 3 [ENDSLEY-1995] | Resilience [WOODS-RESILIENCE], STAMP |
| P5 | CPS [LEE-CPS] | SA [ENDSLEY-1995], STAMP [LEVESON-STAMP] |
| P6 | JCS [HOLLNAGEL-JCS] | Woods Four [WOODS-FOUR], SA |
| P7 | CWA [CWA-VICENTE] | IFT [PIROLLI-CARD], Decision Ladder [RASMUSSEN-1986] |
| P8 | Law of Stretched Systems [WOODS-STRETCHED] | SA, ETTO [HOLLNAGEL-ETTO] |
| P9 | CWA Formative [CWA-VICENTE] | EID [EID-VICENTE] |
| P10 | DSA [DISTRIBUTED-SA] | JCS [HOLLNAGEL-JCS], Team SA [ENDSLEY-TEAM-SA] |
| P11 | STAMP [LEVESON-STAMP] | Ostrom [OSTROM-COMMONS] |
| P12 | Ostrom [OSTROM-COMMONS] | Resilience [WOODS-RESILIENCE] |

### 1.2 Scope

- **P1-P8**: Intra-organization principles. Constrain entity-realtime integration within
  a single organization's equipment hierarchy. Implementations claiming intra-org
  conformance MUST satisfy all eight.
- **P9-P12**: Manufacturing commons principles. Constrain cross-organization behavior
  for the 200K-org metropolitan network. Implementations claiming network-level
  conformance MUST satisfy P1-P12.

---

## 2. Intra-Organization Principles P1-P8

### P1: Hierarchy-Aware Subscriptions

**Statement**: The subscription model MUST support subscription at any ISA-95
equipment level with configurable depth and abstraction. Higher levels MUST deliver
comprehension-ready (SA Level 2) aggregations. Lower levels MUST deliver
perception-ready (SA Level 1) raw data.

**Justification**: Endsley's SA model [ENDSLEY-1995] defines three levels of
situational awareness. Level 1 (Perception) requires raw data intake. Level 2
(Comprehension) requires aggregated status. The Abstraction Hierarchy from EID
[EID-VICENTE] is structurally isomorphic with the ISA-95 hierarchy [ISA-95-1] —
each hierarchy level maps to a cognitive abstraction level. CWA's formative design
principle [CWA-VICENTE] requires that the system support all levels simultaneously,
not prescribe which level the operator uses.

**Implementation**: The `SubscribeReadings` RPC accepts optional `deviceId` and
`plantId` filters for level-specific subscription (`src/lib/iiot/rpc/RealtimeRpcs.ts:107-121`).
`SubscribeEquipmentState` accepts `entityType` from 6 ISA-95 levels: Plant, Line,
WorkCell, Machine, Device, Sensor (`RealtimeRpcs.ts:149-161`). The `EquipmentLevel`
enum defines all 9 hierarchy levels (`src/lib/iiot/schemas/identifiers.ts:28-38`).
All filter parameters are `Schema.optional` — omitting them returns all events,
gracefully degenerating for flat hierarchies.

**Verification**:

1. Subscribe with `deviceId` set. Assert: only events for that device are received.
2. Subscribe with `plantId` set. Assert: events from all devices in that plant are received.
3. Subscribe with no filters. Assert: all events are received.
4. Subscribe with `entityType: 'Plant'`. Assert: only plant-level state changes.
5. Subscribe with `entityType: 'Sensor'`. Assert: only sensor-level state changes.
6. Assert: subscription with filters at any ISA-95 level succeeds without error.

---

### P2: Causal Chain Preservation

**Statement**: Events MUST carry causality metadata. When a lower-level entity
causes a higher-level state change (e.g., Machine-001 FAULTS causing Line-007 to
DEGRADE), the higher-level event MUST reference the lower-level entity as the
causal antecedent. Causal chains MUST be traversable in both directions.

**Justification**: EID [EID-VICENTE] requires configural displays — visualizations
where relationships between elements are directly perceivable, not inferred.
STAMP [LEVESON-STAMP] frames safety as a control problem: without explicit
causality, incident investigation cannot trace the chain of events that led to a
hazardous state. CPS temporal semantics [LEE-CPS] require that physical causality
(sensor → machine → line) be preserved through the distributed event pipeline.

**Implementation**: `EquipmentStateChange` carries `entityType`, `entityId`,
`previousState`, `currentState`, and `changedBy` fields
(`src/lib/iiot/rpc/RealtimeRpcs.ts:70-80`). `AlarmEvent` carries `deviceId`
linking to the causal equipment (`RealtimeRpcs.ts:50-62`). State transitions are
validated by `Graph.directed` state machines — e.g., `plantStateGraph` with 6
states and 9 named transitions, validated via `Graph.hasEdge`
(`src/lib/iiot/machines/graphs/plant-graph.ts:84-154`). The `ReactivityBridge`
publishes state change events inline during handler execution, preserving causal
ordering within the Effect pipeline
(`src/lib/iiot/realtime/reactivity-bridge.ts:91-134`).

**Verification**:

1. Trigger a Machine fault. Assert: the Machine's `EquipmentStateChange` event carries
   `previousState: 'running'`, `currentState: 'faulted'`.
2. Verify the Line's subsequent state change event references the Machine's `entityId`
   in causal metadata.
3. Assert: invalid state transitions (e.g., `commissioning → decommissioned` in
   plant-graph) are rejected by `isValidStateTransition`
   (`plant-graph.ts:146-155`).
4. Assert: `getTransitionAction` returns the named action for valid transitions.

---

### P3: Information Scent Propagation

**Statement**: Each entity MUST expose computed summary metadata that serves as
information scent for parent entities. This metadata MUST include at minimum:
`worstChildStatus`, `activeAlarmCount`, `trendDirection`, `lastUpdateTimestamp`.
Scent metadata MUST be part of the subscription payload, not a separate query.

**Justification**: Information Foraging Theory [PIROLLI-CARD] predicts that
operators navigate entity hierarchies following information scent — cues that
indicate the value of pursuing a path. The Marginal Value Theorem [PIROLLI-2007]
predicts that if operators must issue additional queries to assess information
value, they will under-explore the hierarchy. SA Level 2 (Comprehension)
[ENDSLEY-1995] requires pattern recognition and status aggregation — achievable
only if summary metadata is immediately available.

**Implementation**: 12 entity handlers cover all ISA-95 levels
(`src/lib/iiot/entity/EntityStack.ts:54-67`): Alarm, WorkOrder, EquipmentState,
Enterprise, Site, Area, Plant, Line, WorkCell, MachineAsset, Device, SensorAsset.
Each handler produces state change events. The `ReactivityBridge`
(`src/lib/iiot/realtime/reactivity-bridge.ts:82-85`) publishes these events
inline to `EventDistribution`, making state transitions available as subscription
payloads without separate queries.

**Verification**:

1. Subscribe at Plant level. Assert: plant status events include worst-child-status
   derived from Line states.
2. Trigger an alarm on a Machine. Assert: parent Line's scent metadata updates
   `activeAlarmCount` without requiring a separate query.
3. Assert: subscription payloads at every hierarchy level contain scent fields.
4. Measure: time between child entity state change and parent scent update. Assert < 2s.

---

### P4: Temporal Completeness for Projection

**Statement**: The event store MUST support temporal queries ("what was the state
at time T?") and deterministic replay. Given the same event sequence,
implementations MUST produce the same projected state. The event store MUST NOT
allow retroactive modification of recorded events.

**Justification**: SA Level 3 (Projection) [ENDSLEY-1995] requires operators to
extrapolate future state from past trends — impossible without temporal query
capability. The Learn cornerstone of resilience engineering [WOODS-RESILIENCE]
requires deterministic replay for incident analysis. STAMP [LEVESON-STAMP]
requires an immutable audit trail for safety investigation.

**Implementation**: `EventId` and `FactId` branded identifiers
(`src/lib/iiot/schemas/identifiers.ts:140-146`) anchor immutable journal entries.
`SensorEntityRpcs` provide GetLatest, GetAggregated, GetStats temporal query
endpoints. JetStream streams configured with `deny_delete: true` and
`deny_purge: true` ensure immutability per STAMP audit requirements (see
`rfc-section-security-trust.md:289-294`).

**Verification**:

1. Write a sequence of events. Replay from sequence number 0. Assert: same projected
   state as original execution.
2. Attempt to delete a recorded event. Assert: operation is rejected.
3. Issue a temporal query for state at `T-1h`. Assert: the returned state is
   consistent with events up to that timestamp.
4. Write events with out-of-order timestamps. Assert: replay uses sequence numbers
   (logical ordering), not physical timestamps.

---

### P5: Bounded-Latency Delivery

**Statement**: Each subscription tier MUST have a defined latency SLA. Violation
MUST be a monitorable failure condition, not a silent degradation.

| Tier | SLA (`t_display - t_physical`) | Theoretical Basis |
|------|-------------------------------|-------------------|
| Safety-critical alarms | < 100ms | STAMP hazard analysis [LEVESON-STAMP] |
| Equipment state changes | < 500ms | SA Level 1 perception [ENDSLEY-1995] |
| Hierarchy aggregations | < 2s | SA Level 2 comprehension [ENDSLEY-2012] |
| Temporal queries / replay | < 5s | SA Level 3 projection tolerance |
| Network-level signals | < 300s | Market dynamics, not safety-critical |

**Justification**: CPS temporal semantics [LEE-CPS] establish that the end-to-end
latency `t_display - t_physical` must be bounded per subscription tier. STAMP
[LEVESON-STAMP] classifies unbounded latency as a hazardous control action ("control
action at wrong time"). SA Level 1 perception [ENDSLEY-1995] degrades when data
arrival exceeds the operator's cognitive update cycle (~500ms for status indicators).

**Implementation**: `EventDistribution` registers 4 ChannelService channels with
distinct `maxLag` bounds: `iiot:readings` at 10,000
(`src/lib/iiot/realtime/event-distribution.ts:170-175`), `iiot:alarms` at 1,000
(lines 177-183), `iiot:equipment` at 1,000 (lines 185-191), `iiot:invalidations`
at 1,000 (lines 193-199). `DistributionMetrics`
(`event-distribution.ts:77-91`) track per-channel publish counts for monitoring.
`SubscribeReadings` accepts `throttleMs` for client-configurable emission rate
(`RealtimeRpcs.ts:114-116`).

**Verification**:

1. Publish a reading event. Measure `t_display - t_physical`. Assert: < 500ms under
   normal load.
2. Flood the readings channel beyond `maxLag: 10_000`. Assert: backpressure is applied
   (oldest events dropped, not newest).
3. Assert: `DistributionMetrics.readingsPublished` increments with each publish.
4. Configure `throttleMs: 1000`. Assert: client receives at most 1 event per second.
5. Stop publishing for 30s. Assert: subscriber connection remains active (heartbeat,
   no silent drop).

---

### P6: Graceful Extensibility Under Load

**Statement**: When automated aggregations fail, the system MUST fall back to raw
entity streams rather than displaying "everything is fine" summaries. When event
rates exceed capacity, the system MUST shed load intelligently — reduce update
frequency, aggregate more aggressively — rather than failing entirely. Full
automation blackout MUST never leave the operator without data.

**Justification**: The four cornerstones of resilience [WOODS-FOUR] require
graceful extensibility: the ability to extend performance at the boundary of
competence. The JCS model [HOLLNAGEL-JCS] frames the operator-system pair as a
joint cognitive system — when the automated partner fails, the human partner must
not be left blind. The Law of Stretched Systems [WOODS-STRETCHED] predicts that
new capability will be consumed as expanded operator scope, so the system must
remain functional even when stretched beyond design capacity.

**Implementation**: The dual-write architecture publishes to local PubSub AND NATS
simultaneously (`event-distribution.ts:280-326`). If NATS fails, local PubSub →
ChannelService → outlet streams remain operational. `HolonetBridge` uses
`Effect.ignoreLogged` for outbound NATS publishes
(`src/lib/iiot/realtime/holonet-bridge.ts:100-128`) — NATS errors are logged but
never block local delivery. Four independent channels (`event-distribution.ts:136-157`)
ensure a failure in one event type does not cascade to others.

**Verification**:

1. Kill the NATS connection. Assert: local event delivery continues via ChannelService.
2. Assert: `HolonetBridge` publishes log entries for NATS failures but does not throw.
3. Overload the alarm channel. Assert: reading channel is unaffected.
4. Kill the ChannelService process. Assert: PubSub inlets still accept publishes
   (events buffered for recovery).
5. Restore ChannelService. Assert: buffered events are drained to outlets.

---

### P7: Unconstrained Navigation

**Statement**: The subscription model MUST NOT enforce navigation paths. Operators
MUST be able to compose arbitrary entity combinations, subscribe to cross-hierarchy
groups, and restructure their information space in real-time. The Decision Ladder
[RASMUSSEN-1986] MUST be traversable at any entry point — expert operators use
shunts (skipping intermediate steps) and leaps (jumping from data to action).

**Justification**: CWA [CWA-VICENTE] requires a formative (not normative) design
approach: the system MUST support how operators *could* navigate the information
space, not prescribe how they *should*. Information Foraging Theory [PIROLLI-CARD]
models operators as foragers who abandon low-scent paths — enforced navigation
creates artificial barriers. The Decision Ladder [RASMUSSEN-1986] must be
traversable at any entry point for expert performance.

**Implementation**: 17 RPC groups are composed into a single `IIoTRpcs` group
(`src/lib/iiot/rpc/index.ts:91-112`): SensorRpcs, AssetRpcs, AlarmRpcs,
WorkOrderRpcs, EquipmentStateRpcs, PlantRpcs, LineRpcs, WorkCellRpcs,
MachineAssetRpcs, DeviceRpcs, SensorAssetRpcs, EnterpriseRpcs, SiteRpcs,
AreaRpcs, AssetEntityRpcs, SensorEntityRpcs, and RealtimeRpcs. Clients select any
combination of streaming + query RPCs. No navigation path is enforced.

**Verification**:

1. Subscribe to readings for a specific device AND alarms for a different plant
   simultaneously. Assert: both subscriptions deliver independently.
2. Start with a Line-level view. Jump directly to a Sensor-level subscription without
   navigating through Machine. Assert: no intermediate step required.
3. Compose a subscription set that mixes streaming RPCs (SubscribeReadings) with
   query RPCs (Plant.Get). Assert: both work in the same client session.
4. Change subscription filters at runtime (add a new `deviceId`). Assert: new
   filter takes effect without reconnection.

---

### P8: Overload Resistance

**Statement**: Implementations MUST include configurable subscription capacity
limits per operator session, SA degradation warnings when monitoring channels
exceed cognitive capacity, and workload indicators visible to supervisors.

**Justification**: The Law of Stretched Systems [WOODS-STRETCHED] predicts that
operators will expand their monitoring scope to consume all available capacity.
Without structural overload resistance, the system enables rather than prevents
cognitive overload. SA research [ENDSLEY-1995] shows that monitoring more than 5-7
independent data channels simultaneously degrades comprehension (Level 2) and
projection (Level 3). The ETTO principle [HOLLNAGEL-ETTO] predicts that under
time pressure, operators will sacrifice thoroughness for speed — the system must
compensate by pre-filtering.

**Implementation**: Channel `maxLag` bounds provide partial overload protection by
enforcing backpressure when event rates exceed capacity
(`event-distribution.ts:169-199`). `SubscribeReadings` accepts `throttleMs`
(`RealtimeRpcs.ts:114-116`) for client-configurable emission rate limiting. Full
`maxSubscriptions` per session is not yet implemented.

**Verification**:

1. Configure `throttleMs: 5000`. Assert: client receives at most 1 event per 5s.
2. Open 100 concurrent subscriptions. Assert: the system applies a configurable cap
   and rejects the 101st with a meaningful error.
3. Monitor a supervisor dashboard. Assert: it displays active subscription count per
   operator session.
4. Exceed subscription capacity. Assert: a `RATE_LIMITED` error is returned
   (`RealtimeError.code: 'RATE_LIMITED'`, `RealtimeRpcs.ts:35-39`).

---

## 3. Manufacturing Commons Principles P9-P12

### P9: Variable-Depth Hierarchy

**Statement**: The system MUST support ISA-95 hierarchies from 1 level (Earl's
2-person machine shop) to 7+ levels (Boeing's 500-employee facility) without
requiring administrative configuration for simple cases. Equipment registration
SHOULD infer hierarchy from relationships. For a flat hierarchy, "subscribe to
shop" MUST equal "subscribe to machine."

**Justification**: CWA's formative design principle [CWA-VICENTE] requires that
the system support the full range of organizational complexity without imposing
artificial structure. EID [EID-VICENTE] extends this: the Abstraction Hierarchy
must map to the actual organizational structure, not a theoretical ideal. The
persona spectrum (research-theoretical-foundations.md, Section 9.1) demonstrates
that Earl, Maria, and Boeing have fundamentally different hierarchy depths.

**Implementation**: `EquipmentLevel` defines 9 levels: enterprise, site, area,
plant, line, workcell, machine, sensor, device
(`src/lib/iiot/schemas/identifiers.ts:28-38`). Each level has a branded ID type
(lines 46-79). All subscription filter parameters are `Schema.optional` — omitting
hierarchy filters returns all events, gracefully degenerating for flat hierarchies.
`SubscribeEquipmentState` accepts any of 6 entity types
(`RealtimeRpcs.ts:152-154`), enabling variable-depth filtering.

**Verification**:

1. Register a single machine (no plant, no line). Subscribe with no hierarchy filters.
   Assert: events for that machine are received.
2. Register a full 7-level hierarchy. Subscribe at Plant level. Assert: events from all
   descendant entities are received.
3. Register a 3-level hierarchy (Plant → Line → Machine). Subscribe at "all equipment."
   Assert: same behavior as subscribing to the single Plant.
4. Assert: no configuration step is required between equipment registration and
   subscription activation.

---

### P10: Distributed SA Mediation

**Statement**: The platform MUST mediate between individual SA (each org's view of
their equipment) and collective SA (the network's view of aggregate capacity).
Events crossing organization boundaries MUST be delivered as abstract signals, not
raw data. The platform MUST compute collective awareness that no single participant
possesses.

**Justification**: Distributed Situation Awareness [DISTRIBUTED-SA] extends SA
from individual cognition to network-level awareness: awareness as an emergent
property of a sociotechnical system, not the sum of individual awarenesses. The
JCS model [HOLLNAGEL-JCS] frames the platform itself as a cognitive artifact that
actively mediates between agents. Endsley's Team SA model [ENDSLEY-TEAM-SA]
provides the bridge: shared mental models within teams, compatible mental models
across organizations.

**Implementation**: `HolonetBridge`
(`src/lib/iiot/realtime/holonet-bridge.ts:88-91`) provides bidirectional NATS
bridge for cross-node events. Outbound: fire-and-forget publish to NATS subjects
(lines 102-128). Inbound: wildcard subscriptions to `iiot.readings.*`,
`iiot.alarms.*`, `iiot.equipment.*`, `iiot.invalidations.*` (lines 136-182).
`EventDistribution` remote ingress daemons (lines 249-263) inject remote events
into local ChannelService channels. NATS account-based isolation ensures org
boundaries (specified in `rfc-section-security-trust.md:38-137`).

**Verification**:

1. Publish an event in Org A. Assert: it arrives at Org B only via the
   `manufacturing-commons` system account, never directly.
2. Assert: raw sensor readings (`iiot.readings.*`) do NOT cross org boundaries
   by default.
3. Configure an explicit export. Assert: only exported subjects are visible to the
   importing account.
4. Revoke an export. Assert: the importing account stops receiving events within 60s.
5. Assert: the platform aggregates capacity data from multiple orgs into a collective
   view that no single org can see individually.

---

### P11: Sovereignty-Preserving Causality

**Statement**: Causal chains MUST be fully preserved within organization boundaries
but MUST be redacted to authorized abstractions when crossing boundaries. "Supplier
experienced disruption" is a valid cross-org causal signal. "Supplier's spindle
motor drew 47A" MUST NOT cross org boundaries without explicit trust authorization.
The redaction boundary MUST be configurable per trust relationship.

**Justification**: STAMP [LEVESON-STAMP] requires causal chain preservation for
safety investigation — but only within the investigation scope. Ostrom's commons
governance [OSTROM-COMMONS] requires clearly defined boundaries (Principle 1) and
graduated sanctions (Principle 5), both of which require observable behavior
without exposing proprietary operations. The IDS Reference Architecture Model
[IDS-RAM] and data sovereignty principles [IDS-SOVEREIGNTY] provide the formal
framework for data exchange with sovereignty preservation.

**Implementation**: Schema-level redaction via `Schema.omit` and `Schema.pick` is
specified in the security RFC (`rfc-section-security-trust.md:193-209`). NATS
export rules specify target accounts and subject restrictions (security RFC lines
109-117). Cross-org event schemas are defined as explicit subsets of internal
schemas — the redaction is applied at the export boundary, not at the subscriber
side. Full implementation requires auth middleware integration (planned).

**Verification**:

1. Trigger an alarm in Org A. Assert: Org A sees full causal chain (Machine → Line →
   Plant) with all fields.
2. Assert: the `manufacturing-commons` account sees only the redacted schema (omitting
   `operatorId`, `currentJobId` per security RFC Section Z.6.1).
3. Configure a trust relationship between Org A and Org B with extended field access.
   Assert: Org B sees the extended fields.
4. Revoke the trust relationship. Assert: Org B reverts to the redacted schema.
5. Assert: redaction is applied at the export boundary (verified via NATS export
   configuration audit).

---

### P12: Commons Governance Observability

**Statement**: The platform MUST make participant behavior observable for commons
governance. Availability commitments, fulfillment rates, quality metrics, and
response times are governance data — not just operational data. The subscription
model MUST serve double duty: operational awareness for participants AND governance
monitoring for the commons.

**Justification**: Ostrom's eight design principles [OSTROM-COMMONS] require
monitoring (Principle 4) and graduated sanctions (Principle 5) — both impossible
without behavioral observability. Resilience Engineering [WOODS-RESILIENCE]
requires the Learn cornerstone — the commons must learn from participant behavior
patterns to improve governance. The manufacturing commons is governance
infrastructure: availability events are commitments, machine state changes affect
reputation, and the subscription model mediates governance by making behavior
observable.

**Implementation**: The 4-channel `EventDistribution` architecture
(`event-distribution.ts:136-157`) is extensible to governance channels.
`DistributionMetrics` (`event-distribution.ts:77-91`) already track per-channel
publish counts — the same pattern extends to governance metrics. Trust score
computation is specified as a singleton service in `@effect/cluster` (security RFC
`rfc-section-security-trust.md:273-279`). Entity types for governance observability
are planned but not yet defined.

**Verification**:

1. Org A commits to machine availability. Org A takes machine offline. Assert: the
   availability deviation is recorded as a governance event.
2. Query fulfillment rates for Org A. Assert: the platform returns the ratio of
   commitments honored to commitments made.
3. Assert: trust scores are published as `ReputationUpdated` events to the
   `manufacturing-commons` account.
4. Assert: trust scores are informational — they do NOT gate event delivery (per G-8).
5. Assert: governance data is retained for the auditable period specified by platform
   policy.

---

## 4. Principle Interaction Matrix

Principles are not independent. The following matrix identifies interactions where
satisfying one principle creates tension or synergy with another.

### 4.1 Tensions (Require Design Trade-offs)

| Principle A | Principle B | Tension | Resolution Strategy |
|-------------|-------------|---------|-------------------|
| P2 (Causal chain) | P11 (Sovereignty) | Full causality crosses org boundaries, sovereignty requires redaction | Redact at export boundary; preserve within org; cross-org receives abstract causal signal |
| P6 (Graceful extensibility) | P8 (Overload resistance) | Raw fallback increases cognitive load; overload resistance requires limiting data | Fallback to raw streams but apply P8 throttling; degrade resolution, not coverage |
| P5 (Bounded latency) | P9 (Variable depth) | Deeper hierarchies increase aggregation latency | Per-level latency budgets; shallower hierarchies get faster aggregation automatically |
| P7 (Unconstrained navigation) | P8 (Overload resistance) | Unconstrained composition can exceed cognitive capacity | Soft limits with warnings; hard limits only when server resources are exhausted |

### 4.2 Synergies (Mutually Reinforcing)

| Principle A | Principle B | Synergy |
|-------------|-------------|---------|
| P1 (Hierarchy subscriptions) | P3 (Information scent) | Hierarchy-aware subscriptions deliver scent at each level |
| P2 (Causal chain) | P4 (Temporal completeness) | Causal metadata enables deterministic replay of incident sequences |
| P5 (Bounded latency) | P6 (Graceful extensibility) | Bounded channels with independent failure domains enable partial degradation |
| P9 (Variable depth) | P10 (DSA mediation) | Variable-depth subscriptions compose with cross-org abstract signals |
| P11 (Sovereignty) | P12 (Governance) | Redacted signals are the governance data — behavior is observable without exposing internals |

---

## 5. Conformance Levels

### 5.1 Level 1: Single-Organization (P1-P8)

An implementation MUST satisfy P1-P8 to claim single-organization conformance.
This level supports:
- ISA-95 hierarchy navigation
- Real-time entity state subscriptions
- Event sourcing with temporal queries
- Bounded-latency delivery
- Graceful degradation under load

### 5.2 Level 2: Manufacturing Commons (P1-P12)

An implementation MUST satisfy P1-P12 to claim manufacturing commons conformance.
This level adds:
- Variable-depth hierarchy support (1-7+ levels)
- Cross-org event mediation via NATS account isolation
- Sovereignty-preserving causal redaction
- Commons governance observability

### 5.3 Partial Conformance

Implementations MAY claim partial conformance by specifying which principles are
satisfied. The minimum viable set for useful deployment is:

| Use Case | Minimum Principles |
|----------|-------------------|
| Single machine monitoring | P1, P5 |
| Small shop (Earl) | P1, P3, P5, P9 |
| Contract manufacturer (Maria) | P1-P6, P9 |
| Enterprise (Boeing) | P1-P8 |
| Manufacturing commons | P1-P12 |

---



═══════════════════════════════════════════════════════════════════════════
PART II: ARCHITECTURE (Normative)
═══════════════════════════════════════════════════════════════════════════

# Part II: Architecture

<!-- Source: rfc-entity-realtime-integration.md Sections 4-5 -->

---

> *The propagation rules defined above extend beyond a single organization
> via the outward rules O-1 through O-3. The following section specifies how
> the manufacturing commons architecture enables this cross-organizational
> event flow.*

<!-- Source: rfc-section-multi-tenant-network.md -->

## Y. Multi-Tenant Manufacturing Network Architecture

### Y.1 Scope

This section specifies the multi-tenant architecture that enables 200,000+
organizations — from solo machinists to large aerospace manufacturers — to
operate on a shared metropolitan manufacturing network with sovereign data
boundaries and federated event distribution.

This section covers the **operational architecture** (tenant isolation, edge
autonomy, reconciliation, shard assignment). For consistency guarantees, see
Section X (Two-Domain Consistency Model). For security and trust, see Section Z.

### Y.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### Y.3 Tenant Model

#### Y.3.1 One Organization = One NATS Account

Each organization in the manufacturing network maps to exactly one NATS Account
[NATS-ACCOUNTS]. The account is the **trust boundary, namespace boundary, and
resource limit boundary** for all of that organization's data.

Requirements:

1. **Subject isolation**: An organization's NATS subjects (e.g.,
   `iiot.entity.>`, `alarms.>`) MUST NOT be accessible from any other
   organization's account unless explicitly exported.

2. **JetStream domain isolation**: Each organization's edge device MUST operate
   its own JetStream domain, providing offline persistence independent of the
   cloud cluster. The domain name MUST be unique per organization.

3. **Resource limits**: Each account MUST have configurable limits for:
   - Maximum number of JetStream streams
   - Maximum total storage (bytes)
   - Maximum number of connections
   - Maximum message size

4. **Account provisioning**: Accounts are provisioned via signed JWTs from the
   platform operator's signing key [NATS-DECENTRALIZED]. The JWT encodes:
   - Organization ID
   - Account public key (NKey)
   - Resource limits
   - Authorized subject imports/exports
   - Expiration date (MUST be set; indefinite accounts are prohibited)

#### Y.3.2 Edge Device Architecture

Each organization connects to the network through one or more edge devices. The
minimum viable edge configuration:

```
┌─────────────────────────────────────┐
│  Edge Device ($50 SBC or existing)  │
│                                     │
│  ┌────────────┐  ┌───────────────┐  │
│  │ NATS Server│  │ TMNL Agent    │  │
│  │ + JetStream│  │ (sensor poll, │  │
│  │ (local     │  │  alarm detect,│  │
│  │  domain)   │  │  state mgmt)  │  │
│  └──────┬─────┘  └───────┬───────┘  │
│         │                │          │
│         └───── NATS ─────┘          │
│                │                    │
└────────────────┼────────────────────┘
                 │ Leaf Node connection
                 │ (TLS, JWT auth)
                 ▼
         Cloud NATS Cluster
```

Requirements:

1. **Self-contained operation**: The edge device MUST provide full L0-L2
   functionality (sensor polling, alarm detection, equipment state tracking)
   without cloud connectivity.

2. **Leaf node connection**: The edge device connects to the cloud NATS cluster
   as a leaf node [NATS-LEAFNODE]. The leaf node connection:
   - MUST use TLS for all communications
   - MUST authenticate via the organization's account JWT
   - MUST be bound to the organization's account (no cross-account access)
   - SHOULD reconnect automatically with exponential backoff

3. **Local persistence**: JetStream on the edge device MUST persist all events
   locally with tiered minimum retention: T1 devices: 1-day minimum. T2
   devices: 7-day minimum. T3 devices: 30-day minimum. This ensures that
   events generated during extended offline periods are not lost, with
   retention scaled to device storage capacity.

4. **Minimal configuration**: Edge device setup MUST require no more than:
   - Power + network cable
   - QR code scan (encodes JWT, cloud NATS URL, organization ID)
   - Sensor auto-discovery via protocol probing (Modbus, OPC-UA, MQTT)

### Y.4 Edge Autonomy Guarantee

When the edge device loses connectivity to the cloud NATS cluster, the
organization's operations MUST continue without degradation at ISA-95 levels
L0 through L2.

#### Y.4.1 Autonomous Operations During Partition

| Capability | Offline Behavior | Requirement Level |
|-----------|-----------------|-------------------|
| Sensor data collection (L0) | Continues normally; data persists to local JetStream | MUST |
| Alarm detection and notification (L1-L2) | Local alarm rules continue to fire; alerts display on local HMI | MUST |
| Equipment state tracking (L1) | State machine transitions continue; states persisted locally | MUST |
| Work order management (L3) | Read existing work orders; create new ones in local queue | SHOULD |
| Cross-org marketplace (Domain 2) | Unavailable; last-known capacity displayed with staleness indicator | MAY |
| Network aggregates | Frozen at last-known values; staleness indicator shown | MAY |

#### Y.4.2 Partition Detection

The edge device MUST detect cloud connectivity loss within 30 seconds using
NATS leaf node health monitoring. Upon detection:

1. Set local `partitioned = true` flag
2. Continue all local operations
3. Buffer outbound events to local JetStream (already happening by design)
4. Display partition indicator on local HMI (if applicable)
5. Begin exponential backoff reconnection attempts (initial: 1s, max: 60s)

#### Y.4.3 Partition Duration Limits

The system MUST support the following partition durations without data loss:

| Partition Duration | Behavior |
|-------------------|----------|
| < 5 minutes | Transparent reconnection; buffered events delivered within G-8 staleness window |
| 5 minutes - 24 hours | Reconnection triggers bulk event replay; staleness alerts emitted for cross-org subscribers |
| 24 hours - 7 days | Reconnection triggers full replay of local JetStream retention window; sequence gaps logged |
| > 7 days | Events beyond retention window are lost; system emits `DataLossWarning`; org MUST be re-synchronized |

### Y.5 Reconciliation After Partition Healing

When the edge device reconnects to the cloud NATS cluster after a partition:

#### Y.5.1 Protocol

1. **Leaf node reconnection**: NATS leaf node re-establishes TLS connection to
   the cloud cluster. Account JWT is re-validated.

2. **JetStream domain synchronization**: The edge device's JetStream domain
   mirrors its streams to the corresponding cloud-side streams. Mirroring is
   sequential per stream — events are delivered in the order they were produced
   locally, preserving G-1 (per-entity sequential ordering).

3. **Deduplication**: Two layers prevent duplicate processing:
   - **Transport-level**: NATS JetStream `Nats-Msg-Id` deduplication with a
     configurable window [NATS-DEDUP-INF]. For reconnecting edge devices, the
     message ID MUST be content-addressed: `hash(orgId, entityType, entityId,
     sequenceNumber)` to handle dedup windows shorter than the partition
     duration.
   - **Application-level**: @effect/cluster `requestId` deduplication in
     MessageStorage [EFFECT-CLUSTER]. If a message was already processed before
     the partition, the cached reply is returned without re-execution.

4. **Burst absorption**: The cloud cluster MUST absorb the burst of late events
   without dropping messages or exceeding backpressure limits. The edge device
   SHOULD rate-limit its outbound replay to avoid overwhelming the cloud
   (RECOMMENDED: 1000 events/second maximum during replay).

5. **Cross-org staleness resolution**: After all buffered events are delivered,
   the organization's CRDT entries (capacity, capabilities) are refreshed. Any
   `OrgStale` advisories for this organization are cleared.

6. **Convergence**: Within 60 seconds of partition healing (per G-8), all
   cross-org subscribers MUST have received the organization's buffered events.

#### Y.5.2 Reconciliation Sequence Diagram

```
Edge Device                    Cloud NATS Cluster             Cross-Org Subscribers
    │                               │                               │
    │  [OFFLINE for T hours]        │                               │
    │  [Buffered N events locally]  │  [Emitted OrgStale(orgId)]   │
    │                               │                    ───────────►
    │                               │                               │
    ├──── Leaf node reconnect ─────►│                               │
    │     (TLS + JWT auth)          │                               │
    │                               │                               │
    ├──── Mirror sync: stream 1 ───►│                               │
    │     (events 1..K, ordered)    │                               │
    │                               ├── Dedup + persist ──────────►│
    │                               │   (content-addressed IDs)     │
    ├──── Mirror sync: stream 2 ───►│                               │
    │     (events 1..M, ordered)    │                               │
    │                               ├── Dedup + persist ──────────►│
    │                               │                               │
    ├──── CRDT refresh ────────────►│                               │
    │     (capacity, capabilities)  │                               │
    │                               ├── Clear OrgStale(orgId) ────►│
    │                               │                               │
    │  [ONLINE — normal operation]  │  [Convergence within 60s]    │
```

### Y.6 Shard Assignment for Heterogeneous Organizations

The cloud cluster manages organization entities via @effect/cluster
[EFFECT-CLUSTER] with consistent hashing [EFFECT-HASHRING]. The key challenge:
organization sizes span 5 orders of magnitude (2 machines to 200,000+ machines).

#### Y.6.1 HashRing Operates at Runner Level

**Critical distinction**: The HashRing distributes **shards** across **runners**
(cloud nodes), NOT organizations across runners. An organization's entities are
distributed across shards based on `entityId` hash. A large organization's
entities naturally spread across many shards and therefore many runners.

```
Organization "AeroDynamics" (10,000 entities)
  → Entities hash to ~300 different shards
  → Shards assigned to ~15 different runners
  → Load is naturally distributed

Organization "Earl's Machine Shop" (4 entities)
  → Entities hash to 2-4 shards
  → Shards may all land on 1-2 runners
  → Minimal resource footprint
```

#### Y.6.2 Runner Tiers

Runners are organized into tiers with different weights in the HashRing:

| Tier | Hardware | Weight | Shard Count | Use Case |
|------|----------|--------|-------------|----------|
| Tier 1 | 64GB, 16 cores | 3 | ~900 shards | Co-located with NATS superclusters |
| Tier 2 | 32GB, 8 cores | 1 | ~300 shards | Regional deployments |
| Tier 3 | 16GB, 4 cores | 0.5 | ~150 shards | On-premise at large sites |

Weight formula:
```
runner_weight = (available_memory_GB / 32) * (cpu_cores / 8) * locality_bonus
```
Where `locality_bonus = 1.5` for runners co-located with NATS superclusters.

#### Y.6.3 Shard Group Separation

Different entity types SHOULD be assigned to different shard groups to isolate
resource contention:

| Shard Group | Entity Types | Rationale |
|-------------|-------------|-----------|
| `org-identity` | Organization | Low churn, heavy state, cross-org eventual consistency |
| `marketplace` | Listing, Template, SharedAsset | Cross-org, eventual consistency |
| `asset-hierarchy` | Enterprise, Site, Area, Plant, Line, WorkCell, Machine | Low-throughput, consistency-critical |
| `equipment` | Machine, Device, Sensor | High-throughput, latency-sensitive |
| `operational` | Alarm, WorkOrder, EquipmentState | Medium-throughput, ordering-critical |

Each shard group has its own `shardsPerGroup` configuration (default: 300
[EFFECT-CLUSTER]). The `telemetry` group MAY use more shards for finer-grained
distribution.

#### Y.6.4 Hot Shard Mitigation

If a single organization generates disproportionate load (e.g., a factory with
1000 sensors publishing at 10 Hz = 10,000 events/second):

1. **Detection**: Monitor per-shard event throughput. Alert if any shard exceeds
   2x the mean throughput for its shard group.
2. **Mitigation**: Increase the weight of the runner hosting the hot shard, or
   add runners to the tier, triggering HashRing rebalancing.
3. **Shard splitting**: NOT natively supported by @effect/cluster. If needed,
   increase `shardsPerGroup` for the affected shard group and rebalance.

### Y.7 Organization Lifecycle

#### Y.7.1 Onboarding

Onboarding a new organization to the network MUST complete in under 15 minutes:

1. **Account creation** (< 1 minute): Platform operator generates signed JWT
   with organization ID, NKey, and default resource limits.
2. **Edge device provisioning** (< 5 minutes): QR code scan loads JWT and
   cloud NATS URL. Edge device connects as leaf node.
3. **Sensor discovery** (< 5 minutes): TMNL agent probes connected devices via
   Modbus RTU/TCP, OPC-UA, or MQTT. Discovered sensors are auto-registered as
   entities in the organization's namespace.
4. **Marketplace opt-in** (< 1 minute): Organization configures which subjects
   to export to the manufacturing commons (default: `capacity.available`).

#### Y.7.2 Offboarding

When an organization leaves the network:

1. **Export revocation**: All cross-account exports are revoked. Per G-9 (Data
   Sovereignty), revocation MUST take effect within 60 seconds.
2. **CRDT cleanup**: The organization's entries in network KV buckets are deleted.
   OR-Set remove operations propagate to all replicas.
3. **Account deactivation**: JWT is revoked via NATS revocation list. Edge
   device connections are terminated.
4. **Data retention**: The organization's cloud-side JetStream streams are
   retained for the regulatory retention period (configurable, default: 7
   years per [FDA-CFR11]) before deletion.

#### Y.7.3 Organization Growth

As an organization grows, the system automatically adapts:

| Growth Event | System Response |
|-------------|----------------|
| Added 10th machine | Alarm management (L2) features activate |
| Added 50th machine | Work order management (L3) features activate |
| Added 2nd site | Cross-site analytics (L4) activate |
| Entity count > 1000 | Account resource limits auto-increased (operator approval required) |
| Event throughput > 10K/s | Dedicated shard group assignment (operator intervention) |

### Y.8 Cross-Organization Communication

#### Y.8.1 Manufacturing Commons System Account

A dedicated NATS system account (`manufacturing-commons`) aggregates cross-org
data. Organizations interact with it through explicit subject imports and
exports:

**Exported subjects** (org -> commons):
- `capacity.{orgId}.available` — machine availability count
- `capability.{orgId}.declared` — manufacturing capabilities
- `status.{orgId}.heartbeat` — organization online status

**Imported subjects** (commons -> org):
- `network.capacity.summary` — aggregate network capacity
- `network.marketplace.orders.>` — open work orders (filtered by capability match)

#### Y.8.2 Subject Routing Rules

1. **Intra-org subjects** (`iiot.{orgId}.>`) MUST NOT leave the organization's
   account. These are sovereign data.
2. **Cross-org subjects** (`capacity.>`, `capability.>`, `status.>`) flow
   through the manufacturing commons system account.
3. **Marketplace subjects** (`marketplace.orders.>`, `marketplace.bids.>`)
   flow through the requesting organization's account, with targeted exports
   to bidding organizations.

### Y.9 Monitoring and Observability

#### Y.9.1 Per-Organization Health

The platform MUST monitor the following per-organization metrics:

| Metric | Alert Threshold | Rationale |
|--------|----------------|-----------|
| Edge device connectivity | Offline > 2 minutes | Triggers `OrgStale` advisory |
| Event throughput | < 1 event/minute (if sensors configured) | Sensor failure detection |
| JetStream storage usage | > 80% of account limit | Prevents data loss |
| Clock skew (origin vs network) | > 5 seconds | Triggers `ClockSkewDetected` |
| Consumer lag | > 1000 messages behind | Processing bottleneck |

#### Y.9.2 Network-Level Health

| Metric | Computation | Alert Threshold |
|--------|------------|----------------|
| Active organizations | Count of accounts with heartbeat < 120s | Drop > 5% in 5 minutes |
| G-8 staleness compliance | Sample 1% of cross-org events per minute | > 1% exceeding 60s |
| Marketplace throughput | Orders posted per hour | Drop > 50% vs 7-day average |
| CRDT convergence time | Time from org KV update to aggregate recalculation | > 30 seconds (50th percentile) |

### Y.10 Codebase Implementation Reference

This section maps the multi-tenant architecture to the existing TMNL
implementation, identifying current artifacts and extension points.

#### Y.10.1 Tenant Isolation — NATS Infrastructure

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| NATS subject specifications | `src/lib/iiot/realtime/iiot-subjects.ts` | 4 subject specs with parametric placeholders: `iiot.readings.{deviceId}`, `iiot.alarms.{deviceId}`, `iiot.equipment.{equipmentId}`, `iiot.invalidations.{cacheKey}` |
| NATS PubSub service | `src/lib/holonet/nats/pubsub.ts` | `NatsPubSubService` — NATS pub/sub abstraction layer |
| HolonetBridge | `src/lib/iiot/realtime/holonet-bridge.ts` | 4 outbound publish methods (fire-and-forget to NATS), 4 inbound scoped Streams |
| Subject spec factory | `src/lib/holonet/subject/schemas.ts` | `createSubjectSpec()` — defines subject patterns with parameter types |

**Extension point**: Current subjects are flat (`iiot.readings.{deviceId}`).
Multi-tenant operation requires org-scoped subjects
(`iiot.{orgId}.readings.{deviceId}`). The `createSubjectSpec` function supports
this pattern — add `orgId` as a leading parameter.

#### Y.10.2 Edge Device — Local Processing Stack

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Sensor reading ingestion | `src/lib/iiot/adapters/ingestion-service.ts:297-322` | `SparkplugPipelineLayer` — full pipeline from Sparkplug-B protocol to entity state |
| Alarm detection | Included in SparkplugPipelineLayer | `AlarmDetector` service triggered by threshold breaches |
| Topic routing | Included in SparkplugPipelineLayer | `TopicRouter` — routes Sparkplug topics to entity handlers |
| Reading processing | Included in SparkplugPipelineLayer | `ReadingProcessor` — transforms raw readings into entity events |

**Current state**: The SparkplugPipelineLayer implements the L0-L2 capabilities
required for edge autonomy. It currently assumes cloud-connected operation but
all processing is local — the pipeline writes to local EventDistribution first,
then publishes to NATS asynchronously.

#### Y.10.3 Entity State Management

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| 12 entity handler layers | `src/lib/iiot/entity/EntityStack.ts:54-67` | Merged via `Layer.mergeAll` — full ISA-95 entity hierarchy |
| Individual entity handlers | `src/lib/iiot/entity/{Area,Device,Enterprise,Line,MachineAsset,Plant,Sensor,Site,WorkCell}Entity.ts` | Plus `AlarmEntity.ts`, `EquipmentStateEntity.ts`, `WorkOrderEntity.ts` |
| State machines | `src/lib/iiot/machines/{Area,Device,Enterprise,Line,MachineAsset,Plant,SensorAsset,Site,WorkCell}Machine.ts` | 12 XState-style state machines |
| State graphs | `src/lib/iiot/machines/graphs/{area,device,enterprise,line,machine-asset,plant,sensor,site,workcell,alarm-state,work-order,equipment-state}-graph.ts` | 12 state transition graphs defining valid state progressions |
| State services | `src/lib/iiot/state/index.ts` | 12 state services with in-memory and SQL implementations |

**Extension point**: For multi-tenant operation, entity handlers need an
`orgId` context. Options:
1. Thread `orgId` through the `ReactivityBridge` (minimal change)
2. Add `orgId` to each entity schema (ISA-95 identifier scoping)
3. Use Effect `Context` to provide `orgId` per-request (cleanest)

#### Y.10.4 Event Distribution — Local + Remote Fan-Out

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| EventDistribution service | `src/lib/iiot/realtime/event-distribution.ts` | Routes events to 4 channels with defined backpressure limits |
| Channel definitions | `src/lib/iiot/realtime/event-distribution.ts:136-157` | `iiot:readings` (maxLag 10K), `iiot:alarms` (maxLag 1K), `iiot:equipment` (maxLag 1K), `iiot:invalidations` (maxLag 1K) |
| Dual-publish path | `src/lib/iiot/realtime/event-distribution.ts:280-326` | Local PubSub + HolonetBridge NATS — events go both local and remote |
| ChannelService broadcast | `src/lib/streams/constructs/ChannelService.ts` | Broadcast outlets for fan-out to multiple subscriber streams |
| ReactivityBridge | `src/lib/iiot/realtime/reactivity-bridge.ts` | Handler-level integration: entity handlers call bridge inline after state change |

**Current state**: The dual-publish path (local PubSub + NATS) is already the
architecture needed for edge autonomy. Local consumers continue receiving events
from ChannelService even when NATS connectivity is lost.

#### Y.10.5 Real-Time Subscriptions — WebSocket Layer

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| WebSocket server | `src/lib/iiot/realtime/websocket-server.ts` | Mounts at `/ws/iiot` via `RpcServer.layerProtocolWebsocketRouter` |
| Streaming RPCs | `src/lib/iiot/rpc/RealtimeRpcs.ts` | 4 streaming RPCs with `stream: true`: `SubscribeReadings`, `SubscribeAlarms`, `SubscribeEquipmentState`, `SubscribeInvalidations` |
| RPC handlers | `src/lib/iiot/realtime/websocket-server.ts` | `RealtimeRpcHandlersBridge` uses `Stream.unwrap` to bridge service effects to RPC streams |
| JSON serialization | `src/lib/iiot/realtime/websocket-server.ts` | `RpcSerialization.layerJson` for browser compatibility |

**Extension point**: For multi-tenant WebSocket, each connection must be
authenticated to an organization's account. The WebSocket handshake should
validate a JWT and scope the subscription to the organization's event namespace.

#### Y.10.6 ISA-95 Hierarchy — Adaptive Depth

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Branded identifiers | `src/lib/iiot/schemas/identifiers.ts` | `EnterpriseId`, `SiteId`, `AreaId`, `PlantId`, `LineId`, `WorkCellId`, `MachineId`, `SensorId`, `DeviceId` |
| Equipment level enum | `src/lib/iiot/schemas/identifiers.ts` → `EquipmentLevel` | Schema.Literal with 9 levels — full ISA-95 depth |
| Asset schemas | `src/lib/iiot/schemas/assets/{enterprise,site,area,plant,line,workcell,machine,sensor,device}/schema.ts` | Full schema definitions for each hierarchy level |

**Current state**: The full ISA-95 hierarchy is modeled. Adaptive depth (where
smaller organizations use fewer levels) requires conditional activation of
entity handlers and state machines based on the organization's complexity tier.
The `EntityStack.ts` merge-all approach supports this — omit layers for unused
hierarchy levels.

#### Y.10.7 Shard Assignment — Effect Cluster

| Requirement | Current State | Notes |
|-------------|--------------|-------|
| @effect/cluster integration | Not yet implemented | HashRing and shard allocation are architecture-plan items; the EntityStack currently runs in-process |
| Shard group separation | Entity types already separated | 12 distinct entity handler layers in EntityStack — each could be assigned to a different shard group |
| Runner tier weighting | Not yet implemented | Requires @effect/cluster deployment with weighted runners |

**Extension point**: The `EntityStack.ts` architecture (separate entity layers
merged) maps directly to @effect/cluster shard groups. Each entity type layer
can be deployed as a separate shard group with its own runner allocation.

#### Y.10.8 Monitoring Infrastructure

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Channel backpressure limits | `src/lib/iiot/realtime/event-distribution.ts:136-157` | `maxLag` per channel provides the substrate for consumer lag monitoring |
| Streaming diagnostics | `src/lib/streams/constructs/ChannelService.ts` | ChannelService can expose per-outlet lag metrics |

**Extension point**: Comprehensive monitoring (per-org health, G-8 staleness,
marketplace throughput) requires a dedicated metrics service. The ChannelService
maxLag values provide natural alert thresholds.

---

## Open Questions

1. **Account JWT rotation**: When an organization's JWT expires, how is renewal
   coordinated with the edge device? The edge device may be offline when the JWT
   expires, preventing reconnection until the operator intervenes.

2. **Multi-edge organizations**: Large organizations may have multiple edge
   devices (one per site). How are their JetStream domains coordinated? Mirror
   chains (edge -> site hub -> cloud) introduce additional reconciliation
   complexity.

3. **Network partitions between cloud NATS nodes**: If the cloud cluster itself
   partitions (e.g., Atlanta data center A loses connectivity to data center B),
   how do cross-org events from organizations connected to different partitions
   maintain G-8 bounded staleness?

4. **Rate limiting fairness**: How should the cloud cluster fairly allocate
   inbound event processing bandwidth across 200K organizations during peak
   load? Per-account rate limits may penalize organizations with legitimate
   high-throughput needs.

---


---

<!-- Source: rfc-entity-realtime-integration.md Section 7 -->

---

<!-- Source: rfc-entity-realtime-integration.md Section 8 -->

---

<!-- Source: rfc-section-two-domain-consistency.md + rfc-section-consistency-guarantees.md -->

## X. Consistency Guarantees and Ordering Semantics

### X.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### X.2 Two-Domain Temporal Model

The metropolitan manufacturing network operates in **two distinct temporal domains**
with fundamentally different consistency requirements. This bifurcation is the
governing architectural principle for all ordering and consistency decisions.

#### X.2.1 Domain 1: Intra-Organization (Sovereign)

Domain 1 encompasses all entity events within a single organization's boundary.
The organization controls all devices, clocks, and trust relationships.

Properties:

- **Scope**: One organization's entities (machines, sensors, alarms, work orders)
- **Trust model**: Fully trusted — the organization owns all edge devices
- **Clock authority**: Edge device's local clock is authoritative for ordering
- **Offline behavior**: MUST operate indefinitely without cloud connectivity
- **ISA-95 depth**: Adaptive (see X.5)
- **Applicable guarantees**: G-1 through G-7

#### X.2.2 Domain 2: Cross-Organization (Federated)

Domain 2 encompasses events that cross organization boundaries — network-level
aggregates, marketplace signals, and shared status information.

Properties:

- **Scope**: Network-level aggregates, marketplace events, cross-org status
- **Trust model**: Untrusted — other organizations' clocks and data integrity
  cannot be verified
- **Clock authority**: Network-assigned timestamp (cloud NATS cluster) is
  authoritative for ordering
- **Offline behavior**: MUST degrade gracefully — offline organizations disappear
  from network views but resume participation upon reconnection
- **ISA-95 depth**: Flattened — the organization is the atomic unit
- **Applicable guarantees**: G-8

### X.3 Intra-Organization Ordering Guarantees (G-1 through G-7)

The following guarantees apply within Domain 1 (a single organization). They are
enforced by the local NATS JetStream instance on the organization's edge device
and by @effect/cluster [EFFECT-CLUSTER] entity management on cloud nodes.

#### G-1: Per-Entity Sequential Ordering

For any single entity instance `e`, all state transition events MUST be observed
in the order they were produced. If transition `T1` occurs before `T2` on entity
`e`, then every consumer of `e`'s event stream MUST observe `T1` before `T2`.

**Implementation**: JetStream stream per entity type with subject filter
`iiot.{orgId}.entity.{entityType}.{entityId}`. Per-subject ordering within a
stream is guaranteed by JetStream [JETSTREAM].

**Verification**: Monotonically increasing sequence numbers per entity. Any gap
or reordering MUST be flagged as a `SequenceViolation` error.

#### G-2: Per-Entity Causal Ordering

For any single entity instance `e`, if event `A` causally precedes event `B`
(i.e., `B` was produced as a direct consequence of processing `A`), then `A`
MUST be observed before `B` by all consumers.

**Implementation**: Subsumed by G-1 — sequential ordering on a single entity
inherently preserves causality within that entity.

#### G-3: Cross-Entity Causal Ordering (Same Organization)

If a state transition on entity `A` causally triggers a state transition on
entity `B` within the same organization (e.g., `Machine.MarkFaulted` causes
`Line.MarkDegraded`), then the machine fault event SHOULD be observable before
the line degradation event.

**Implementation**: Causal metadata (`causedBy` field referencing source entity
and sequence number) in the `EntityStateChanged` event schema. Consumers that
require causal ordering MUST use the `causedBy` chain to reconstruct order.

**Note**: This is SHOULD, not MUST. Strict cross-entity causal ordering across
separate JetStream subjects would require a total ordering protocol. The causal
metadata enables consumers to reconstruct order when needed without imposing
global coordination.

#### G-4: Session Consistency

Within a single client session (e.g., one WebSocket connection), the client
MUST observe:

- **Read-your-writes**: Any state change initiated by the client is visible in
  subsequent reads within the same session.
- **Monotonic reads**: The client never observes an older state after having
  observed a newer state for the same entity.
- **Monotonic writes**: Commands issued by the client are applied in the order
  they were sent.

**Implementation**: WebSocket connections maintain per-client subscription state.
The RPC handler tracks the last-seen sequence number per entity per session and
filters duplicates.

#### G-5: Bounded Staleness (Intra-Organization)

For events within the same organization, staleness bounds are ISA-95 level
dependent:

| ISA-95 Level | Maximum Staleness | Rationale |
|--------------|-------------------|-----------|
| L0 (Physical Process) | 100ms | Sensor control loops |
| L1 (Basic Control) | 250ms | Safety interlock ordering |
| L2 (Supervisory Control) | 1 second | Alarm management [ISA-18.2] |
| L3 (Manufacturing Operations) | 5 seconds | Work order management |
| L4 (Business Planning) | 30 seconds | Cross-site analytics |

**Implementation**: Staleness monitoring via timestamp comparison. Events
exceeding their level's staleness threshold MUST emit an
`EventLatencyExceeded` alert.

#### G-6: Partition Tolerance (Edge-Cloud)

When the edge device loses connectivity to the cloud NATS cluster:

1. The edge JetStream domain MUST continue accepting and persisting events
   locally.
2. Intra-organization guarantees G-1 through G-5 MUST continue to be enforced
   locally.
3. Upon reconnection, buffered events MUST be delivered to the cloud cluster
   preserving per-entity sequential ordering (G-1).
4. The cloud cluster MUST NOT reject events based on wall-clock time gaps.

**Implementation**: JetStream domain mirroring. The edge domain is the primary;
the cloud domain is a mirror that catches up on reconnection.

#### G-7: Idempotent Processing

Every entity event MUST carry a deterministic message ID (content-addressed:
`hash(orgId, entityType, entityId, sequenceNumber)`). Consumers MUST deduplicate
based on this ID. JetStream deduplication [NATS-DEDUP-INF] provides the first
line of defense; application-level deduplication provides the second.

### X.4 Cross-Organization Ordering Guarantee (G-8)

G-8 governs Domain 2 — events that cross organization boundaries.

> **G-8 (Cross-Organization Eventual Consistency)**: Events crossing
> organization boundaries MUST be eventually consistent with bounded staleness
> of 60 seconds. Cross-organization events MUST carry network-authoritative
> timestamps. Cross-organization causal ordering is NOT REQUIRED.

#### X.4.1 Formal Properties

1. **Bounded Staleness**: For any event `e` published by Organization A at time
   `t_publish`, all subscribers in Organizations B, C, ... MUST observe `e` by
   time `t_publish + 60s`, assuming network connectivity between the publishing
   edge device and the cloud NATS cluster.

2. **Network-Authoritative Timestamp**: The authoritative ordering timestamp for
   cross-organization events is assigned by the cloud NATS cluster upon message
   ingestion (`networkTimestamp`), NOT by the originating edge device
   (`originTimestamp`).

3. **No Cross-Organization Causality**: If Organization A publishes event `e1`
   and Organization B publishes event `e2`, and `e1` happened-before `e2` in
   wall-clock time, the system provides NO guarantee that observers see `e1`
   before `e2`. Consumers requiring cross-org ordering MUST implement
   application-level ordering using `networkTimestamp`.

4. **Partition Recovery**: When an organization's edge device reconnects after a
   network partition, buffered events are delivered with their original
   `originTimestamp` but receive a new `networkTimestamp` reflecting actual cloud
   ingestion time. The `originTimestamp` is preserved for audit purposes.

#### X.4.2 Rationale

Cross-organization causal ordering would require a global coordination protocol
(vector clocks or centralized sequencer across 200,000+ participants). This is:

- **Impractical**: Vector clock size grows linearly with participant count
- **Unnecessary**: Cross-org events represent marketplace-level decisions
  (capacity availability, work order bidding) where sub-second ordering
  precision has no operational value
- **Contradictory**: Global coordination violates the edge-first, offline-capable
  architecture that Domain 1 requires

The 60-second bounded staleness is a design choice balancing:
- **Freshness**: Capacity availability data older than 60 seconds has
  diminishing value for work order routing
- **Cost**: Tighter bounds require more aggressive synchronization
- **Failure tolerance**: 60 seconds provides ample buffer for transient network
  issues without triggering false staleness alerts

### X.5 Adaptive ISA-95 Depth

The ISA-95 hierarchy (Enterprise -> Site -> Area -> Line -> Work Cell -> Machine
-> Sensor) assumes a large, structured organization. The metropolitan
manufacturing network MUST support **adaptive hierarchy depth**:

| Organization Profile | Example | ISA-95 Levels | Guarantees | Latency Budget |
|---------------------|---------|---------------|------------|----------------|
| Solo machinist (2 machines) | Earl's Machine Shop | L0 + L1 | G-1, G-2 only | 30s acceptable |
| Small shop (5-20 machines) | Precision Parts Co. | L0 + L1 + L2 | G-1 through G-4 | 5s acceptable |
| Medium factory (50-200 machines) | MetroFab Industries | L0 through L3 | G-1 through G-6 | 1s target |
| Large facility (1000+ machines) | Boeing Everett | L0 through L4 | G-1 through G-7 | <1s required |
| All organizations (cross-org) | The network itself | N/A (org is unit) | G-8 | 60s bounded |

The **network itself serves as the enterprise level** of ISA-95. Individual
organizations map to sites (or areas, depending on size). This inversion —
where the metropolitan network is the enterprise, not any single company —
is a fundamental architectural distinction from single-enterprise IIoT platforms.

**Requirement**: The system MUST auto-detect organization complexity from the
entity count and topology, and MUST NOT impose higher-level consistency overhead
on organizations that do not require it.

#### X.5.1 Dynamic Latency Budgets

Latency budgets are **organization-complexity-dependent**, not fixed system-wide:

- **Earl's Machine Shop** (2 machines, L0+L1): Earl tolerates 30-second staleness
  on his dashboard because he's standing next to the machines. Session consistency
  (G-2) is sufficient — he sees his own writes. The system MUST NOT impose
  G-3 through G-7 overhead on Earl's 2-entity edge device.

- **Boeing Everett** (10,000+ machines, L0-L4): Boeing demands sub-second
  propagation for alarm cascades across production lines. G-1 through G-7 are
  all active, with ISA-18.2 compliance requiring L2 alarm latency under 1 second.
  Cross-entity causal ordering (G-3) is critical — a welding robot fault MUST
  propagate to the line status before the shift supervisor's dashboard refreshes.

**Implementation**: The edge device's configuration is generated at provisioning
time based on declared entity count. The consistency tier determines which
guarantees are active and their associated latency budgets. Organizations MAY
upgrade their consistency tier as they grow.

### X.6 Clock Model

#### X.6.1 Two-Timestamp Envelope

Every event that crosses organization boundaries MUST carry two timestamps:

```
EventEnvelope {
  originTimestamp:  ISO-8601    // Edge device clock (informational)
  networkTimestamp: ISO-8601    // Cloud NATS cluster (authoritative)
  orgId:           string      // Publishing organization
  entityType:      string      // Entity type tag
  entityId:        string      // Entity instance ID
  sequenceNumber:  uint64      // Per-entity monotonic sequence
  payload:         object      // Event-specific data
}
```

#### X.6.2 Timestamp Authority Rules

| Context | Authoritative Timestamp | Rationale |
|---------|------------------------|-----------|
| Intra-org ordering (G-1 - G-7) | `originTimestamp` + `sequenceNumber` | Edge device is trusted within its own org |
| Cross-org ordering (G-8) | `networkTimestamp` | Edge clocks are heterogeneous and untrusted |
| Regulatory audit [FDA-CFR11] | Both preserved | `originTimestamp` = time of event; `networkTimestamp` = time of record |
| Staleness calculation | `networkTimestamp` vs `now()` | Measures actual delivery latency, not clock skew |

#### X.6.3 Clock Quality Heterogeneity

The system MUST tolerate edge devices with clock skew up to 5 seconds without
degrading intra-organization guarantees. Organizations with clock skew exceeding
5 seconds SHOULD receive a `ClockSkewDetected` advisory.

For cross-organization ordering, clock quality is irrelevant — the
`networkTimestamp` assigned by the cloud cluster is the sole ordering authority.

### X.7 Multi-Tenant Isolation via NATS Accounts

Each organization maps to a NATS Account [NATS-ACCOUNTS] with an isolated
JetStream domain:

1. **Subject namespace isolation**: Each organization's subjects are invisible to
   other organizations by default. Subject `iiot.entity.>` in Organization A is
   completely separate from `iiot.entity.>` in Organization B.

2. **JetStream domain isolation**: Each edge device runs its own JetStream
   domain, providing offline persistence independent of the cloud cluster. Domain
   mirroring handles reconnection synchronization.

3. **Opt-in cross-account sharing**: Organizations that wish to participate in
   the manufacturing commons MUST explicitly export subjects (e.g.,
   `capacity.available`) into a shared system account. This export is auditable
   and revocable via JWT updates [NATS-JWT].

4. **Decentralized authentication**: Organization accounts are provisioned via
   signed JWTs [NATS-DECENTRALIZED]. No centralized authentication database.
   Edge devices carry their account JWT and can connect to any NATS server in
   the cluster.

**Ordering guarantee boundary**: JetStream provides per-subject sequential
ordering within an account's domain. G-1 (Per-Entity Sequential) is enforced
within each organization's account. Across accounts, only G-8 (eventual
consistency with bounded staleness) applies.

### X.8 Manufacturing Commons Events

The cross-organization domain introduces events not present in single-enterprise
IIoT. These represent the **manufacturing commons** — a shared, event-sourced
view of the network's collective state.

| Event | Publisher | Ordering Requirement | G-8 Applies |
|-------|-----------|---------------------|-------------|
| `OrgJoined` | Platform operator | Eventual | Yes |
| `CapabilityDeclared` | Organization (opt-in) | Eventual | Yes |
| `CapacityAvailable` | Organization (automated) | Bounded staleness (60s) | Yes |
| `WorkOrderPosted` | Requesting organization | Bounded staleness (60s) | Yes |
| `BidSubmitted` | Bidding organization | Per-org sequential | Yes (within org) |
| `WorkOrderAccepted` | Requesting organization | Causal (MUST follow bid) | Special case |
| `JobCompleted` | Executing organization | Eventual | Yes |
| `ReputationUpdated` | Platform (computed) | Eventual | Yes |

**Special case — `WorkOrderAccepted`**: This event requires causal consistency
with respect to `BidSubmitted`. This is achievable without global coordination
because both events route through the requesting organization's NATS account,
preserving per-subject ordering within that account.

#### X.8.1 Network-Level Replay (G-6 Extension)

The manufacturing commons is itself an event-sourced system. The complete
network state at any point in time can be reconstructed by replaying commons
events from the shared JetStream stream. This extends G-6 (Partition Tolerance)
to the network level:

- **Replay guarantee**: A new network observer (e.g., a analytics service joining
  the cloud cluster) MUST be able to reconstruct the current network state by
  replaying all commons events from stream offset 0.
- **Idempotent projection**: Commons event handlers MUST be idempotent — replaying
  the same `CapacityAvailable` event twice produces the same aggregate state.
- **Snapshot optimization**: For networks with extended history, periodic snapshots
  of the commons state MAY be stored in NATS KV to accelerate replay. Snapshots
  are advisory — the event stream remains the authoritative source.

**Implementation**: The manufacturing commons stream is a JetStream stream in the
`manufacturing-commons` system account. Subject pattern:
`commons.{eventType}.{orgId}`. Replay uses JetStream's `DeliverAll` consumer
policy. This mirrors the dual-publish pattern in EventDistribution
(`src/lib/iiot/realtime/event-distribution.ts:280-326`) — local projection for
reads, persistent stream for replay.

### X.9 Network-Level Aggregates (CRDT-Based)

Certain network-wide metrics are computed from individually-owned, per-organization
values. These aggregates use Conflict-free Replicated Data Types [CRDT-SHAPIRO]
to converge without ordering:

| Aggregate | CRDT Type | Substrate | Merge Operation |
|-----------|-----------|-----------|-----------------|
| Total available machines | G-Counter | NATS KV: `network.capacity` | Commutative increment per org |
| Jobs completed (monthly) | G-Counter | NATS KV: `network.stats` | Commutative increment per org |
| Capability registry | OR-Set | NATS KV: `network.capabilities` | Commutative add/remove per org |
| Per-org utilization | LWW-Register | NATS KV: `network.utilization` | Last-writer-wins per org key |
| Reputation scores | Bounded Counter | NATS KV: `network.reputation` | Commutative increment (capped 0-100) |

All merge operations are **commutative** — the order in which updates from
different organizations arrive does not affect the final aggregate value
[CRDT-SHAPIRO]. This is the fundamental property that makes network-level
aggregates partition-tolerant without coordination.

**Implementation**: Each organization updates only its own key in the shared NATS
KV bucket [NATS-KV]. Network views are computed by aggregating all keys. This is
conflict-free by construction — no two organizations write to the same key.

**Reputation scores**: Computed from `JobCompleted` and `ReputationUpdated`
events. Each organization's reputation is a bounded counter (0-100) stored at
`network.reputation.{orgId}`. The score increments on successful job completion
and decrements on disputes/timeouts. The bounded counter CRDT prevents scores
from exceeding the 0-100 range regardless of concurrent update ordering.

**Staleness**: CRDT aggregates inherit G-8's 60-second bounded staleness. The
aggregate view MAY be up to 60 seconds behind any individual organization's
actual state. This is acceptable for marketplace-level decisions.

### X.10 PACELC Position

The system's consistency-availability-latency position varies by data path,
following the PACELC framework [PACELC]:

| Data Path | If Partition | Else (Normal) | Position |
|-----------|-------------|---------------|----------|
| Intra-org readings (L0-L1) | Consistency (edge continues) | Consistency | PC/EC |
| Intra-org alarms (L2) | Consistency (local alerting) | Consistency | PC/EC |
| Intra-org work orders (L3) | Consistency (session) | Consistency | PC/EC |
| Cross-org capacity | Availability (stale OK) | Latency (60s OK) | PA/EL |
| Cross-org marketplace bids | Availability | Latency | PA/EL |
| Cross-org bid acceptance | Consistency (causal) | Consistency | PC/EC |
| Network aggregates (CRDTs) | Availability | Latency | PA/EL |

**Summary**: Intra-organization data paths are PC/EC (consistency is
non-negotiable for safety and regulatory compliance). Cross-organization data
paths are PA/EL (availability and low latency are preferred over strict
consistency).

#### X.10.1 Latency Sensitivity by Consumer

Even without partitions, the "Else Latency" tradeoff varies by consumer. The
same data path has different latency tolerance depending on the consuming
organization's complexity:

| Consumer Profile | Acceptable Staleness | Rationale |
|-----------------|---------------------|-----------|
| Earl (2 machines, L0+L1) | 30 seconds | Standing next to machines; HMI is supplementary |
| Small shop (L0-L2) | 5 seconds | Alarm response time is human-scale |
| Boeing (L0-L4) | < 1 second | Automated interlock cascades require real-time propagation |
| Network dashboard (cross-org) | 60 seconds | Marketplace decisions are not time-critical |

The system SHOULD expose per-subscription latency configuration, allowing
consumers to declare their staleness tolerance. This enables the EventDistribution
layer (`src/lib/iiot/realtime/event-distribution.ts`) to optimize delivery — Earl's
subscription can be batched, while Boeing's subscription requires immediate
push.

### X.11 Failure Modes

#### X.11.1 Edge Device Offline (Intra-Org)

- G-1 through G-5 continue to be enforced on the local JetStream domain.
- G-6 specifies the reconciliation protocol upon reconnection.
- Cloud consumers of this organization's events observe a gap until reconnection.

#### X.11.2 Edge Device Offline (Cross-Org)

- The organization disappears from network capacity aggregates.
- CRDT entries for this organization become stale.
- The system SHOULD emit an `OrgStale` event after the organization has been
  unreachable for longer than its CRDT entry's TTL (RECOMMENDED: 5 minutes).
- Upon reconnection, the organization's CRDT entries are refreshed and the
  `OrgStale` advisory is cleared.

#### X.11.3 Cloud NATS Cluster Partition

- Raft consensus may temporarily be unavailable.
- `networkTimestamp` assignment may have a brief gap.
- G-8 bounded staleness MAY be exceeded during the partition.
- Upon partition healing, Raft consensus resumes and `networkTimestamp`
  assignment continues. No data loss occurs because edge devices buffer locally.

#### X.11.4 Clock Drift > 5 Seconds

- Intra-org ordering (G-1 through G-5) degrades for time-based comparisons but
  sequence-number-based ordering remains valid.
- Cross-org ordering (G-8) is unaffected — `networkTimestamp` is authoritative.
- A `ClockSkewDetected` advisory SHOULD be emitted.

#### X.11.5 Malicious Organization

- G-8 consistency is maintained — the system orders events correctly regardless
  of content truthfulness.
- Data integrity (capacity, capability claims) is a trust layer concern, not a
  consistency layer concern.
- Anomaly detection is out of scope for this specification but is RECOMMENDED
  as a complementary mechanism. Reputation scoring is specified in X.9 as a
  CRDT-based network aggregate (Bounded Counter).

### X.12 Codebase Implementation Reference

This section maps each normative requirement to the existing TMNL implementation,
identifying both current artifacts and extension points required for the
metropolitan network architecture.

#### X.12.1 G-1 / G-2: Per-Entity Sequential and Causal Ordering

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Entity handler orchestration | `src/lib/iiot/entity/EntityStack.ts:54-67` | 12 entity handler layers merged via `Layer.mergeAll` |
| Per-entity state machines | `src/lib/iiot/machines/graphs/{plant,line,workcell,machine-asset,device,sensor,enterprise,site,area}-graph.ts` | 12 state transition graphs enforce valid state progressions |
| Branded entity identifiers | `src/lib/iiot/schemas/identifiers.ts` | `PlantId`, `LineId`, `MachineId`, `SensorId`, `DeviceId`, etc. — branded strings ensuring type-safe entity references |
| Equipment hierarchy (ISA-95) | `src/lib/iiot/schemas/identifiers.ts` → `EquipmentLevel` | Schema.Literal with 9 ISA-95 levels |

**Extension point**: Per-entity sequence numbers are not yet implemented. G-1
enforcement requires adding a monotonic `sequenceNumber` field to the
`EntityStateChanged` event schema and tracking it per entity instance.

#### X.12.2 G-3: Cross-Entity Causal Ordering

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Alarm → Machine causality | `src/lib/iiot/machines/graphs/alarm-state-graph.ts` | Alarm state transitions reference originating sensor/machine |
| Equipment state propagation | `src/lib/iiot/machines/graphs/equipment-state-graph.ts` | Equipment state changes propagate up the ISA-95 hierarchy |

**Extension point**: The `causedBy` metadata field for cross-entity causal chains
is specified but not yet implemented in the event envelope schema.

#### X.12.3 G-4: Session Consistency

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| WebSocket transport | `src/lib/iiot/realtime/websocket-server.ts:1-60` | Mounts at `/ws/iiot` via `RpcServer.layerProtocolWebsocketRouter` |
| Streaming RPC definitions | `src/lib/iiot/rpc/RealtimeRpcs.ts` | 4 streaming RPCs: `SubscribeReadings`, `SubscribeAlarms`, `SubscribeEquipmentState`, `SubscribeInvalidations` |
| JSON serialization | `src/lib/iiot/realtime/websocket-server.ts` | `RpcSerialization.layerJson` for browser compatibility |

**Current state**: Session consistency is implicit — each WebSocket connection
receives its own subscription stream. Per-entity last-seen-sequence tracking is
an extension point.

#### X.12.4 G-5: Bounded Staleness (Intra-Org)

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| EventDistribution channels | `src/lib/iiot/realtime/event-distribution.ts:136-157` | 4 channels with defined maxLag: `iiot:readings` (10,000), `iiot:alarms` (1,000), `iiot:equipment` (1,000), `iiot:invalidations` (1,000) |
| ReactivityBridge inline publish | `src/lib/iiot/realtime/reactivity-bridge.ts` | Handler-level integration: entity handlers call bridge inline after state change |
| NATS subject specs | `src/lib/iiot/realtime/iiot-subjects.ts` | 4 subjects: `iiot.readings.{deviceId}`, `iiot.alarms.{deviceId}`, `iiot.equipment.{equipmentId}`, `iiot.invalidations.{cacheKey}` |

**Extension point**: Staleness monitoring (comparing `originTimestamp` to current
time) is not yet implemented. Requires an `EventLatencyExceeded` alert type.

#### X.12.5 G-6: Partition Tolerance

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Dual-publish (local PubSub + NATS) | `src/lib/iiot/realtime/event-distribution.ts:280-326` | Events are published to both local ChannelService and HolonetBridge |
| NATS bridge service | `src/lib/iiot/realtime/holonet-bridge.ts` | HolonetBridge: 4 outbound publish (fire-and-forget), 4 inbound scoped Streams |
| NATS PubSub transport | `src/lib/holonet/nats/pubsub.ts` | `NatsPubSubService` — underlying NATS pub/sub abstraction |

**Current state**: Dual-publish ensures local consumers continue receiving events
even when NATS connectivity is lost. JetStream domain mirroring for edge-cloud
reconciliation is specified but not yet configured.

#### X.12.6 G-7: Idempotent Processing

**Extension point**: Content-addressed message IDs
(`hash(orgId, entityType, entityId, sequenceNumber)`) are specified but not yet
implemented. Currently, NATS JetStream's native message deduplication is the
primary defense.

#### X.12.7 G-8: Cross-Organization Eventual Consistency

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Subject specs supporting wildcards | `src/lib/iiot/realtime/iiot-subjects.ts` | Subject patterns use parametric placeholders (`{deviceId}`) suitable for per-org namespacing |
| ChannelService broadcast | `src/lib/streams/constructs/ChannelService.ts` | Broadcast outlets enable fan-out to multiple subscriber streams |

**Extension point**: G-8 requires new infrastructure:
- `OrganizationId` branded type (extend `src/lib/iiot/schemas/identifiers.ts`)
- Account-aware HolonetBridge (extend `src/lib/iiot/realtime/holonet-bridge.ts`
  with per-account subject prefixing)
- Network-authoritative timestamp assignment (cloud NATS cluster configuration)
- Manufacturing commons subject exports (new NATS account configuration)

#### X.12.8 Two-Timestamp Envelope

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| Sensor reading schema | `src/lib/iiot/schemas/assets/sensor/schema.ts` | Current reading schema includes `timestamp` — needs bifurcation into `originTimestamp` + `networkTimestamp` |
| Alarm event schema | `src/lib/iiot/rpc/RealtimeRpcs.ts` | `AlarmEvent` carries `triggeredAt` — maps to `originTimestamp` |

**Extension point**: The two-timestamp envelope requires modifying all event
schemas to carry both `originTimestamp` and `networkTimestamp`. The `networkTimestamp`
is assigned at cloud ingestion, not at edge publication.

#### X.12.9 State Services (Consistency Substrate)

| Requirement | Implementation File | Notes |
|-------------|-------------------|-------|
| 12 state services | `src/lib/iiot/state/index.ts` | `PlantState`, `LineState`, `WorkCellState`, `MachineState`, `SensorAssetState`, `DeviceState`, `SiteState`, `AreaState`, `EnterpriseState`, `AlarmState`, `WorkOrderState`, `EquipmentStateService` |
| In-memory implementations | `src/lib/iiot/state/index.ts` → `AllStateServicesInMemory` | Used for testing; production uses SQL-backed implementations |
| Ingestion pipeline | `src/lib/iiot/adapters/ingestion-service.ts:297-322` | `SparkplugPipelineLayer` composes: SparkplugAdapterLive → TopicRouter → ReadingProcessor → AlarmDetector → IngestionService |

**Note**: State services are currently single-instance. For multi-tenant operation,
each organization's state would be isolated either via separate service instances
per account or via per-org partitioning within shared services.

---

## Open Questions

1. **Deduplication window for extended offline**: NATS JetStream default dedup
   window is 2 minutes [NATS-DEDUP-INF]. For organizations offline for days,
   message IDs MUST be content-addressed (`hash(orgId, entityType, entityId,
   sequenceNumber)`) rather than time-windowed. This requires validation.

2. **CRDT garbage collection**: OR-Set entries for capabilities of defunct
   organizations accumulate indefinitely. A tombstone GC protocol is needed.

3. **Cross-org causal chains spanning 3+ organizations**: The current design
   handles requester-bidder causality via single-account routing. If a work
   order chain spans requester -> bidder -> subcontractor, an additional
   coordination mechanism may be needed.

4. **Monitoring G-8 at 200K-account scale**: Exhaustive monitoring of bounded
   staleness across all accounts is impractical. Sampling-based monitoring
   strategies need specification.

---


---

### Implementation Mapping: Consistency Guarantees


## Purpose

This section maps the normative ordering guarantees (G-1 through G-10, G-12) from
`rfc-section-two-domain-consistency.md` to their concrete implementations in the
TMNL codebase. It specifies which modules enforce which guarantees, identifies
consumer group constraints, and defines the recovery sequences for each failure mode.

Where the companion section says "MUST" or "SHOULD", this section says **how**.

---

## Y. Implementation Mapping

### Y.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

File paths are relative to `packages/tmnl/` and use the `src/` prefix.

### Y.2 Guarantee-to-Codebase Mapping Table

| Guarantee | Requirement Level | Primary Implementation | Secondary Implementation | Verification |
|-----------|------------------|----------------------|-------------------------|-------------|
| **G-1** Per-Entity Sequential | MUST | NATS JetStream per-subject ordering via `iiot-subjects.ts` subject specs | `@effect/cluster` entity-to-shard mapping | Monotonic sequence number check in consumer |
| **G-2** Per-Entity Causal | MUST | Subsumed by G-1 (single entity = single subject = sequential) | N/A | Same as G-1 |
| **G-3** Cross-Entity Causal | SHOULD | `causedBy` metadata in event schema (application-level) | Lamport clock in `EntityStateChanged` event | Consumer-side causal reconstruction |
| **G-4** Session Consistency | MUST | WebSocket connection state in `websocket-server.ts` | Per-client sequence tracking in `realtime-handlers.ts` | Client-side monotonic read assertion |
| **G-5** Bounded Staleness | MUST (L0-L2) | `EventDistribution` channel maxLag configuration | Staleness monitoring via metrics in `event-distribution.ts:267` | `EventLatencyExceeded` alert emission |
| **G-6** Partition Tolerance | MUST | NATS JetStream domain mirroring (edge → cloud) via `holonet-bridge.ts` | Local PubSub continues via `ChannelService` | Reconnection sync validation |
| **G-7** Idempotent Processing | MUST | JetStream dedup (`Nats-Msg-Id` header) via `iiot-subjects.ts` | Application-level dedup in entity handlers | Duplicate counter in metrics |
| **G-8** Cross-Org Eventual | MUST | NATS Accounts + system account imports | Cloud NATS cluster `networkTimestamp` assignment | 60s staleness monitoring |
| **G-9** Data Sovereignty | MUST | NATS Account isolation (default deny) + JWT exports | Audit log of export/import relationships | Export revocation propagation test |
| **G-10** Signal Trustworthiness | SHOULD | Attestation envelope in cross-org events | Trust score computation (singleton service) | Weighted aggregate validation |
| **G-12** Commons Governance | SHOULD | Singleton services in `@effect/cluster` | `manufacturing-commons` NATS system account | `OrgStale` / `NetworkCapacitySummary` emission |

### Y.2.1 Consistency Model per ISA-95 Level

Each ISA-95 automation level requires a different consistency model based on its
temporal requirements and failure tolerance:

| ISA-95 Level | Consistency Model | Guarantee | Justification | Latency Budget |
|-------------|-------------------|-----------|--------------|----------------|
| **L0** (Sensor/Actuator) | Sequential per-entity | G-1 MUST | Sensor state transitions are strictly ordered. A temperature reading of 35C MUST follow 34C, never reorder. | < 100ms |
| **L1** (PLC/DCS) | Sequential per-entity | G-1 MUST | Control module events (alarm trigger, threshold breach) are ordered per device. | < 500ms |
| **L2** (SCADA/HMI) | Causal | G-2, G-3 SHOULD | Operator sees machine fault BEFORE line degradation. Cross-entity causality matters for situational awareness. | < 1s |
| **L3** (MES/MOM) | Session + Bounded Staleness | G-4 MUST, G-5 MUST | Production manager's dashboard converges within SLA. All events in a session are monotonically ordered. Staleness bounded to `maxLag` per channel. | < 5s |
| **L4** (ERP/BI) | Eventual | G-8 SHOULD | Executive KPIs and cross-org aggregates tolerate minutes of lag. Consistency eventually converges. | < 60s |

**Implementation mapping**:

- **L0-L1**: Per-subject FIFO ordering in NATS JetStream [JETSTREAM] via
  `src/lib/iiot/realtime/iiot-subjects.ts` subject specs. One subject per entity
  instance ensures sequential ordering without application-level logic.
- **L2**: Causal ordering via `causedBy` metadata in event schemas + Machine
  state graph validation in `src/lib/iiot/machines/AlarmMachine.ts` and
  `src/lib/iiot/machines/EquipmentStateMachine.ts`. The Machine rejects
  transitions that violate the causal graph.
- **L3**: Session consistency via per-WebSocket ChannelService broadcast outlets
  in `src/lib/iiot/realtime/event-distribution.ts`. Bounded staleness via
  `maxLag` configuration (readings: 10K, alarms/equipment/invalidations: 1K).
- **L4**: Eventual consistency across org boundaries via NATS Account exports
  and imports through the `manufacturing-commons` system account.
  `networkTimestamp` assignment at cloud ingestion provides a cross-org ordering
  basis.

### Y.3 Per-Subject Ordering: The Foundation of G-1

G-1 (Per-Entity Sequential Ordering) is the most critical guarantee. It relies on
NATS JetStream's per-subject FIFO ordering, with subjects defined in:

**File**: `src/lib/iiot/realtime/iiot-subjects.ts`

```
Subject Pattern                          Entity Scope
─────────────────────────────────────────────────────────
iiot.readings.{deviceId}                 One sensor device
iiot.alarms.{deviceId}                   One alarming device
iiot.equipment.{equipmentId}             One equipment instance
iiot.invalidations.{cacheKey}            One cache entry
```

Each `createSubjectSpec` call (lines 39, 61, 83, 105) creates a subject with:
- `resolve()` — produces a concrete subject for one entity instance
- `wildcardPattern()` — produces `iiot.{type}.*` for subscription
- `streamMapping: { _tag: 'domain' }` — maps to a JetStream domain stream

**G-1 enforcement**: Because each entity instance maps to exactly one NATS subject,
and JetStream guarantees per-subject FIFO ordering [JETSTREAM], all events for a
single entity are delivered in production order. No application-level sequencing is
required for G-1 — NATS provides it natively.

**Consumer constraint**: To preserve G-1 at the consumer level, entity state
processors MUST use a **single consumer per entity type** (not consumer groups with
round-robin delivery). Consumer groups that distribute messages across consumers
would break per-entity ordering unless messages are routed by entity ID.

### Y.4 EventDistribution: The G-4 and G-5 Enforcement Layer

**File**: `src/lib/iiot/realtime/event-distribution.ts`

EventDistribution is the central event hub. It enforces:

**G-4 (Session Consistency)** via ChannelService broadcast outlets:
- Each WebSocket subscriber gets its own outlet stream (line 330-348)
- The outlet stream is scoped to the WebSocket connection's `Scope`
- Broadcast outlets ensure all subscribers see the same events in the same order
- `ChannelService.getOutletStream` (line 271-275) creates per-subscriber streams

**G-5 (Bounded Staleness)** via channel maxLag configuration:
- Readings channel: `maxLag: 10_000` (line 173) — drops events if subscriber is
  10,000 messages behind, preventing unbounded staleness
- Alarms/equipment/invalidations: `maxLag: 1_000` (lines 181, 189, 197) — tighter
  bound for safety-critical and operational events

**Metrics** (line 267): `Ref.make<DistributionMetrics>` tracks per-channel publish
counts and active subscriber counts for staleness monitoring.

**Channel architecture**:

```
PubSub.unbounded → connectStream → ChannelService inlet → broadcast outlet → subscriber Stream
     (inlet)         (line 217)       (4 channels)         (per-client)      (to WebSocket)
```

4 channels registered at lines 169-199:
- `iiot:readings` — high-throughput sensor data (10K maxLag)
- `iiot:alarms` — alarm lifecycle events (1K maxLag)
- `iiot:equipment` — equipment state transitions (1K maxLag)
- `iiot:invalidations` — cache coherence signals (1K maxLag)

### Y.5 HolonetBridge: The G-6 and G-8 Transport Layer

**File**: `src/lib/iiot/realtime/holonet-bridge.ts`

The HolonetBridge provides the NATS transport layer that enables:

**G-6 (Partition Tolerance)**:
- Outbound publishing is fire-and-forget (`Effect.ignoreLogged`, lines 102-128)
- If the edge NATS connection is down, the local `PubSub.unbounded` in
  EventDistribution continues to buffer events
- On reconnection, the bridge's subscription (`remoteReadings`, etc.) resumes from
  the last acknowledged NATS message, replaying buffered events

**G-8 (Cross-Org Eventual Consistency)**:
- Each publish call resolves the entity-specific NATS subject via `IIoTSubjects`
  (e.g., `IIoTReadingsSubject.resolve({ deviceId })` at line 104)
- In the cross-org architecture, these subjects are within the org's NATS account
- Cross-account exports make selected subjects visible to the `manufacturing-commons`
  system account
- The `networkTimestamp` is assigned by the cloud NATS cluster on message ingestion

**Dual-write pattern** (EventDistribution lines 280-326):
```
publishReading(event) →
  1. PubSub.publish(readingsInlet, event)     // Local distribution (G-1, G-4, G-5)
  2. bridge.publishReading(event)             // NATS distribution (G-6, G-8)
  3. Ref.update(metrics, ...)                 // Metrics tracking
```

### Y.6 ReactivityBridge: The Handler Integration Point

**File**: `src/lib/iiot/realtime/reactivity-bridge.ts`

The ReactivityBridge is the adapter between entity event handlers and
EventDistribution. It is the point where domain events enter the distribution system.

**Architecture Decision**: Approach A (handler-level integration) was chosen over
Approach B (polling) and Approach C (event log tailing). See
`thoughts/shared/plans/phase5-websocket-architecture.md` Section 5.

**Rationale**:
- Lower latency than polling — events enter distribution immediately
- No additional fiber for polling loop
- Each entity handler calls the bridge inline after writing to EventLog

**Pattern** (lines 91-135):

```typescript
// Inside entity handler:
yield* EventLog.write(event)
yield* bridge.onAlarmEvent({
  eventType: 'triggered',
  alarmId: event.alarmId,
  ...
})
```

The bridge constructs the EventDistribution event type and publishes it. This is
where the domain event schema (entity handler types) maps to the distribution event
schema (EventDistribution types defined at lines 41-70 of `event-distribution.ts`).

### Y.7 WebSocket Server: The G-4 Delivery Layer

**File**: `src/lib/iiot/realtime/websocket-server.ts`

The WebSocket server provides the transport that delivers events to browser clients:

- **Mount point**: `/ws/iiot` on the HttpRouter
- **Serialization**: `RpcSerialization.layerJson` for browser compatibility
- **Transport**: `RpcServer.layerProtocolWebsocketRouter`
- **RPC Group**: `RealtimeRpcs` (4 streaming RPCs)

**G-4 (Session Consistency)** enforcement:
- Each WebSocket connection maintains its own subscription scope
- The `RealtimeRpcHandlers` service (in `realtime-handlers.ts`) creates per-request
  filtered and throttled streams
- Filters are applied per-request (deviceId, severity, entityType, patterns)
- The WebSocket connection scope ensures cleanup when the client disconnects

**Stream composition chain**:

```
EventDistribution.subscribeReadings
  → Stream.filter(deviceId match)
  → Stream.throttle(intervalMs)        // Readings only
  → Stream.map(DistEvent → RpcEvent)   // Type mapping
  → RpcServer (WebSocket transport)
  → Browser client
```

### Y.8 Consumer Group Ordering Constraints

For entity state processing (not real-time display), consumers MUST observe strict
per-entity ordering. This imposes constraints on consumer group topology:

| Consumer Type | Ordering Requirement | Consumer Group Constraint |
|---------------|---------------------|--------------------------|
| Entity state processor | Per-entity sequential (G-1) | Single consumer, OR partitioned by entityId |
| Alarm state manager | Per-device causal (G-2) | Single consumer per alarm entity |
| Real-time display | Session (G-4) | Per-WebSocket, no sharing |
| Analytics aggregator | Eventual | Consumer group OK (ordering relaxed) |
| Audit trail writer | Per-entity sequential (G-1) | Single consumer, append-only |
| Cross-org aggregator | Eventual (G-8) | Consumer group OK |

**Implementation**: `@effect/cluster` entity sharding naturally enforces single-consumer
semantics for entity state processing. Each entity instance is managed by exactly one
`EntityManager` on one runner node [EFFECT-CLUSTER]. Messages for that entity are routed
to the correct runner via `HashRing`, ensuring per-entity sequential processing without
explicit consumer group configuration.

#### Y.8.1 The AckWait Redelivery Interleaving Trap

When using JetStream push consumers with `AckWait` (the timeout after which
unacknowledged messages are redelivered), a subtle ordering violation can occur:

```
Timeline:
  t=0  Consumer receives msg-1 (starts processing)
  t=1  Consumer receives msg-2 (starts processing)
  t=2  AckWait expires for msg-1 → JetStream redelivers msg-1
  t=3  Consumer receives msg-1 (redelivery) while processing msg-2
  t=4  Consumer processes msg-1 AFTER msg-2 → ORDER VIOLATED
```

This trap breaks G-1 if the consumer processes redelivered messages interleaved
with newer messages for the same entity.

**Normative requirement**: Entity state processors MUST use one of:

1. **Single consumer with ordered delivery** (`deliver_policy: all`,
   `max_ack_pending: 1`): Only one message in-flight at a time. Simplest but
   lowest throughput.
2. **`@effect/cluster` EntityManager** (RECOMMENDED): Messages for each entity
   are routed to exactly one shard on one runner node. The entity processes
   messages sequentially via its mailbox. Redelivery is handled at the entity
   level, not the consumer level.
3. **Pull consumers with explicit flow control**: Consumer pulls one message at a
   time per entity, acknowledges before pulling the next.

Option 2 is the RECOMMENDED approach in TMNL. The `EntityManager` pattern
(implemented in `src/lib/iiot/entity/EntityStack.ts`, lines 54-67) provides
natural per-entity sequential processing without JetStream consumer group
configuration.

### Y.9 Failure Mode Recovery Sequences

#### Y.9.1 Observer Crash (WebSocket Client Disconnects)

**Detection**: WebSocket close event / TCP keepalive failure
**Impact**: One subscriber loses its stream
**Recovery sequence**:

1. WebSocket scope finalizer fires → subscriber outlet stream is closed
2. ChannelService outlet is deallocated (broadcast outlet reference count drops)
3. Client reconnects → new WebSocket connection → new scope → new outlet allocated
4. Client re-subscribes to desired event streams
5. **Gap**: Events between disconnect and reconnect are lost for this client
6. **Mitigation**: Client MAY request replay from a known sequence number (future: G-6 replay API)

**G-4 status**: Maintained — new session starts fresh. No stale state carried over.

#### Y.9.2 NATS Connection Loss (Edge ↔ Cloud)

**Detection**: NATS client reconnection callback / heartbeat failure
**Impact**: `HolonetBridge` outbound publishes are silently dropped; inbound remote streams pause
**Recovery sequence**:

1. `Effect.ignoreLogged` in HolonetBridge (line 107) absorbs publish failures
2. Local EventDistribution continues operating via PubSub.unbounded
3. Intra-org guarantees (G-1 through G-5) are maintained locally
4. On NATS reconnection, bridge subscriptions resume from last acknowledged message
5. Buffered events on the NATS server are delivered to bridge inbound streams
6. EventDistribution ingress daemons (lines 249-263) inject recovered events into local channels

**G-6 status**: Maintained — local operation continues; sync on reconnection.

#### Y.9.3 Entity Shard Migration

**Detection**: `@effect/cluster` `HashRing` recomputation
**Impact**: Entity instance destroyed on old node, recreated on new node
**Recovery sequence** (per `research-cluster-patterns.md` Section 1.2):

1. `EntityManager.interruptShard(shardId)` on old node
2. Entity's `Scope` finalizer fires → all forked fibers interrupted
3. ReactivityBridge operations for this entity are interrupted
4. Shard lock released in `RunnerStorage`
5. New node acquires shard lock
6. First message to entity ID triggers lazy recreation on new node
7. Entity `build` effect runs → new ReactivityBridge connection established
8. Forked observers (PubSub subscribers, Machine actors) are re-created in new scope

**G-1 status**: Maintained — JetStream subject ordering is transport-level, not entity-level.
**G-4 status**: WebSocket clients continue receiving from EventDistribution outlets (unaffected by entity migration — EventDistribution is a separate service).

#### Y.9.4 Split-Brain (Cloud NATS Cluster)

**Detection**: Raft consensus failure / leader election timeout
**Impact**: Multiple Raft leaders temporarily → conflicting write acknowledgments
**Recovery sequence**:

1. JetStream Raft detects split and elects new leader within minority partition
2. Minority partition rejects writes (quorum not met)
3. Majority partition continues serving reads and writes
4. On partition heal, Raft reconciles state
5. Any events written to minority partition during split are lost (they were not committed to quorum)
6. `Nats-Msg-Id` dedup prevents duplicate delivery of events that were in-flight during split

**G-1 status**: Maintained within majority partition. Events in minority partition MUST be retried by publishers.
**G-7 status**: `Nats-Msg-Id` dedup handles duplicate attempts across split boundary.

#### Y.9.5 Clock Skew > 5 Seconds (Intra-Org)

**Detection**: `originTimestamp` vs `networkTimestamp` delta exceeds threshold
**Impact**: Time-based staleness calculations (G-5) become unreliable
**Recovery sequence**:

1. HolonetBridge detects delta on message ingestion (cloud-side)
2. `ClockSkewDetected` advisory emitted as an alarm event via EventDistribution
3. Intra-org sequence-number-based ordering (G-1) is unaffected
4. Cross-org ordering (G-8) is unaffected — uses `networkTimestamp`
5. Operator notification for manual clock correction on edge device

**G-1 status**: Unaffected — sequence numbers, not timestamps, provide ordering.
**G-5 status**: Degraded — staleness calculations using `originTimestamp` are unreliable until clock is corrected. System SHOULD fall back to sequence-number gap detection for staleness monitoring.

### Y.10 Codebase File Reference

| File | Guarantees Enforced | Lines of Interest |
|------|--------------------|--------------------|
| `src/lib/iiot/realtime/iiot-subjects.ts` | G-1 (per-subject ordering), G-7 (dedup via subject) | 39-112 (subject specs) |
| `src/lib/iiot/realtime/event-distribution.ts` | G-4 (broadcast outlets), G-5 (maxLag), G-6 (dual-write) | 169-199 (channels), 280-326 (publish), 330-348 (subscribe) |
| `src/lib/iiot/realtime/holonet-bridge.ts` | G-6 (NATS transport), G-8 (cross-org via NATS accounts) | 102-128 (outbound), 136-182 (inbound) |
| `src/lib/iiot/realtime/reactivity-bridge.ts` | Entry point for G-1 chain | 91-135 (handler-to-distribution mapping) |
| `src/lib/iiot/realtime/websocket-server.ts` | G-4 (session delivery) | 1-30 (architecture), mount at `/ws/iiot` |
| `src/lib/iiot/realtime/realtime-handlers.ts` | G-4 (filtering/throttle), G-5 (delivery tier) | 47-52 (severity ordering) |
| `src/lib/iiot/realtime/layers.ts` | Layer composition for all guarantees | Full file |
| `src/lib/streams/constructs/ChannelService.ts` | G-4 (broadcast), G-5 (maxLag backpressure) | Channel registration, outlet allocation |
| `src/lib/iiot/entity/EntityStack.ts` | G-1 (single-consumer via EntityManager), G-7 (idempotent handlers) | 54-67 (`EntityHandlersLayer = Layer.mergeAll(...)`, 12 entities) |
| `src/lib/iiot/entity/AlarmEntity.ts` | G-1 (per-entity ordering), G-7 (idempotent via Machine) | ISA-18.2 lifecycle, Machine state graph validation |
| `src/lib/iiot/entity/WorkOrderEntity.ts` | G-1 (per-entity ordering), G-7 (idempotent via Machine) | FDA 21 CFR Part 11 compliant, dual-write audit trail |
| `src/lib/iiot/entity/EquipmentStateEntity.ts` | G-1 (per-entity ordering), G-7 (idempotent via Machine) | ISA-95/OEE state transitions, Machine graph validation |
| `src/lib/iiot/entity/_helpers.ts` | G-7 (non-blocking event emission) | Feature-flag controlled, `Effect.catchAll` absorbs failures |
| `src/lib/iiot/state/StateShape.ts` | G-7 (idempotent writes) | `set()` is upsert by contract; write methods are "idempotent where possible" (line 10) |
| `src/lib/iiot/state/index.ts` | Layer composition for state services | `AllStateServicesInMemory` (lines 132-147): 12 state services composed via `Layer.mergeAll` |

#### Y.10.1 Entity Handler Idempotency (G-7)

Entity handlers in `src/lib/iiot/entity/` enforce G-7 (Idempotent Processing)
through three mechanisms:

1. **Machine state graph validation**: Each entity uses `@effect/experimental`
   Machine with a state graph that rejects invalid transitions. If a duplicate
   message attempts the same transition, the Machine rejects it at the graph
   level (transition already taken). This is implemented in:
   - `src/lib/iiot/machines/AlarmMachine.ts` — ISA-18.2 alarm state graph
   - `src/lib/iiot/machines/EquipmentStateMachine.ts` — ISA-95/OEE state graph
   - `src/lib/iiot/machines/WorkOrderMachine.ts` — FDA 21 CFR Part 11 workflow

2. **State service upsert semantics**: State services in `src/lib/iiot/state/`
   define `set()` as upsert (per `StateShape.ts` line 10: "Write methods are
   idempotent where possible"). Applying the same state twice produces the same
   result.

3. **Non-blocking event emission**: The `_helpers.ts` event emission helpers
   (lines 28-42, 55-69) use `Effect.catchAll` to absorb failures. Even if a
   duplicate event emission fails, the parent operation succeeds. This prevents
   redelivery from causing cascading failures.

#### Y.10.2 State Service Swappability

**Directory**: `src/lib/iiot/state/`

State services provide a swappable persistence layer (line 4 of `index.ts`:
"Each domain aggregate has a state service with two implementations"):

| Implementation | Purpose | Consistency Guarantee |
|---------------|---------|----------------------|
| `*InMemory` (Map-backed) | Unit/integration tests | Sequential within process (G-1 trivially satisfied) |
| `make*Sql()` (Repository-backed) | Production | Depends on database isolation level; G-1 enforced by entity sharding |

12 state services are composed via `AllStateServicesInMemory` (line 132-147):
AlarmState, WorkOrderState, EquipmentStateService, MachineState, AreaState,
SensorAssetState, PlantState, EnterpriseState, SiteState, WorkCellState,
LineState, DeviceState.

The in-memory / SQL swap ensures that consistency guarantees tested in-memory
transfer to production. The `@effect/cluster` EntityManager provides the
single-consumer constraint (Y.8) regardless of which state service
implementation is used.

### Y.11 Testing Strategy

| Guarantee | Test Type | Test Location |
|-----------|-----------|---------------|
| G-1 | Unit: sequence number monotonicity | `src/lib/iiot/realtime/__tests__/event-distribution.test.ts` |
| G-4 | Integration: WebSocket session ordering | `src/lib/iiot/realtime/__tests__/websocket-integration.test.ts` |
| G-5 | Unit: maxLag configuration verification | `src/lib/iiot/realtime/__tests__/event-distribution.test.ts` |
| G-6 | Integration: bridge disconnect/reconnect | `src/lib/iiot/realtime/__tests__/holonet-bridge.test.ts` |
| G-7 | Unit: dedup via `Nats-Msg-Id` | `src/lib/iiot/realtime/__tests__/event-distribution-distributed.test.ts` |
| G-8 | Integration: cross-account event delivery | Future: metropolitan-scale integration tests |
| G-9 | Integration: account isolation verification | Future: NATS account provisioning tests |
| G-10 | Unit: attestation envelope validation | Future: trust score model tests |

---



═══════════════════════════════════════════════════════════════════════════
PART III: IMPLEMENTATION (Normative)
═══════════════════════════════════════════════════════════════════════════

# Part III: Implementation

<!-- Source: rfc-section-effect-architecture.md -->
## 1. Entity Distribution and Capacity Planning

### 1.1 Entity Cardinality Model

The target deployment is a metropolitan manufacturing network of 200K organizations,
each with variable equipment depth following the ISA-95 hierarchy [ISA-95-1].

Implementations MUST plan for the following entity cardinality:

| Entity Type | Multiplier per Org | Total at 200K Orgs | Shard Group |
|---|---|---|---|
| Organization | 1 | 200,000 | `orgs` |
| Site/Plant | ~2 | 400,000 | `assets` |
| Line/WorkCell | ~5 | 1,000,000 | `assets` |
| Machine/Device | ~10 | 2,000,000 | `equipment` |
| Sensor | ~50 | 10,000,000 | `telemetry` |
| Alarm (active) | ~2 | 400,000 | `events` |
| WorkOrder (active) | ~1 | 200,000 | `events` |
| **Total** | | **~14,200,000** | |

The default `shardsPerGroup` is 300 [EFFECT-CLUSTER]. At 14.2M entities across
5 shard groups, this yields ~2.84M entities per group and ~9,400 entities per shard.

Entity instances are lazy-activated: created on first message, reaped after
`maxIdleTime` (default: 1 minute) [EFFECT-CLUSTER]. At any given moment, only
1--5% of entities are active in a manufacturing network where most sensors report
periodically. This means ~140K--710K concurrently active entity instances across
the cluster, not 14.2M.

**Codebase proof**: The current system manages 12 entity types composed via
`Layer.mergeAll` at `lib/iiot/entity/EntityStack.ts:54-67` [EFFECT-LAYER]. The
`EntityHandlersLayer` merges all handler layers into a single composable layer.
Adding Organization, Capability, and Marketplace entity types requires appending
to this same `Layer.mergeAll` call.

### 1.2 Shard Group Configuration

Implementations MUST use `ClusterSchema.ShardGroup` annotations [EFFECT-CLUSTER]
to separate entity types into domain-aligned shard groups. Different entity types
MUST NOT compete for the same shard space.

| Shard Group | Entity Types | Recommended Shards | Entities/Shard | Rationale |
|---|---|---|---|---|
| `org-identity` | Organization | 300 (default) | ~667 | Low churn, heavy state |
| `marketplace` | Listing, Template, SharedAsset | 300 (default) | ~1,000 | Cross-org, eventual consistency |
| `asset-hierarchy` | Site, Plant, Area, Line, WorkCell | 1,000 | ~1,400 | ISA-95 hierarchy, moderate churn |
| `equipment` | Machine, Device | 1,500 | ~1,333 | Equipment state machines, high churn |
| `telemetry` | Sensor | 3,000 | ~3,333 | Highest cardinality |
| `operational` | Alarm, WorkOrder, EquipmentState | 500 | ~1,200 | Event-sourced, bounded active count |

```typescript
// Shard group annotation pattern [EFFECT-CLUSTER]
const OrgEntity = Entity.make("Organization", OrgRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "org-identity")

const SensorEntity = Entity.make("Sensor", SensorRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "telemetry")
```

**LOOP OPEN (LO-1)**: The current `shardsPerGroup` configuration is global, not
per-group. To achieve the recommended per-group shard counts, implementations
SHOULD either: (a) deploy independent cluster instances per shard group,
(b) contribute a per-group shard count patch to `@effect/cluster`, or
(c) accept the 300-shard default and rely on entity-level distribution within
shards. **Recommendation**: Option (c) for MVP/Growth milestones, option (a) for
Metro scale.

### 1.3 Runner Topology

Implementations MUST select runner transport based on deployment profile:

| Profile | Runner Type | Protocol | When to Use |
|---|---|---|---|
| **Production cluster** | `SocketRunner` | TCP binary | Runner-to-runner backbone. REQUIRED for high-throughput shard groups. |
| **Edge gateway** | `HttpRunner.layerWebsocket` | WebSocket | On-premise nodes behind corporate firewalls. |
| **API gateway** | `HttpRunner.layerHttp` | HTTP POST | External clients. Does NOT support streaming. |
| **Development** | `SingleRunner` | In-process + SQL | Full durability without network overhead. |
| **Testing** | `TestRunner` | In-memory | Unit tests. No persistence, no network. |

Verified via `SocketRunner.ts`, `HttpRunner.ts`, `SingleRunner.ts`, `TestRunner.ts`
[EFFECT-CLUSTER].

The runner weight formula SHOULD be:

```
runner_weight = (available_memory_GB / 32) * (cpu_cores / 8) * locality_bonus
```

Where `locality_bonus = 1.5` for runners co-located with NATS superclusters.

### 1.4 EntityResource for Connection Pooling

Implementations MUST use `EntityResource.make` [EFFECT-CLUSTER] for per-organization
NATS connections. EntityResource provides reference-counted resources that survive
entity restarts during shard movements.

```typescript
const OrgNatsResource = EntityResource.make({
  acquire: Effect.gen(function* () {
    const orgId = yield* EntityAddress.entityId
    const connection = yield* NatsClient.connect({
      servers: (yield* NatsConfig).servers,
      user: `org-${orgId}`,
      pass: yield* OrgCredentialStore.getToken(orgId),
    })
    return connection
  }),
  idleTimeToLive: Duration.minutes(30),
})
```

Estimated peak NATS connections per Tier 2 runner (32GB):
- Runner control: 1
- Shard groups (5): 5
- Active org entities (~500 per runner): 500
- **Total: ~506 per runner**
- At 20 Tier 2 runners: **~10,120 total** — within NATS supercluster capacity [NATS-PROTO].

### 1.5 Node Discovery

Discovery uses `RunnerStorage` polling at 3-second intervals [EFFECT-CLUSTER].
At 50--80 runners this is acceptable. Implementations MUST use PostgreSQL-backed
`SqlRunnerStorage` (not SQLite) for production durability.

---

## 2. Machine-in-Entity Composition

### 2.1 Normative Pattern

Every stateful entity type MUST be implemented as a `@effect/experimental/Machine`
[EFFECT-MACHINE] booted inside a `@effect/cluster/Entity` [EFFECT-ENTITY] scope.
This composition is the normative architecture for organization and asset lifecycle
state management.

The pattern:

1. **Entity registration**: `Entity.make(name, rpcGroup)` — lazy activation on first message
2. **Machine boot**: `Machine.boot(definition, input)` inside `Entity.toLayerMailbox` build effect
3. **Observer fork**: `Machine.changes` piped to EventDistribution via `Effect.forkScoped`
4. **Mailbox handler**: Route incoming RPCs to Machine procedures via `Match.value`

**Codebase proof**: All 9 ISA-95 asset types use this pattern. The canonical
reference is `PlantMachine.ts` (634 lines) at `lib/iiot/machines/PlantMachine.ts`:

- `Machine.make` + `Machine.procedures.make(initialState)` at line 44
- Chained procedures via `.add<TaggedRequest>()()` through line 634
- Graph-validated transitions from `lib/iiot/machines/graphs/plant-graph.ts:84-123`
  using `Graph.directed<PlantStateNode, PlantTransitionAction>()`
- Transition validation via `Graph.hasEdge()` at `plant-graph.ts:146-155`

All 9 machine definitions follow this structure:
`PlantMachine.ts`, `LineMachine.ts`, `WorkCellMachine.ts`, `MachineAssetMachine.ts`,
`DeviceMachine.ts`, `SensorAssetMachine.ts`, `EnterpriseMachine.ts`, `SiteMachine.ts`,
`AreaMachine.ts` — each with a corresponding state graph at `lib/iiot/machines/graphs/`.

### 2.2 Organization State Machine

The proposed Organization entity MUST follow the PlantMachine pattern:

| State | Description | Transitions From | Transitions To |
|---|---|---|---|
| `Onboarding` | Initial setup, provisioning resources | (creation) | `Active`, `Deactivated` |
| `Active` | Normal operation, full access | `Onboarding` | `Suspended`, `Deactivated` |
| `Suspended` | Temporarily disabled (payment, compliance) | `Active` | `Active` (resume), `Deactivated` |
| `Deactivated` | Terminal state, data retention countdown | `Onboarding`, `Active`, `Suspended` | (none) |

The state graph MUST be implemented as `lib/iiot/machines/graphs/org-graph.ts`
following the `plant-graph.ts` pattern, using `Graph.directed()`, `Graph.addNode()`,
`Graph.addEdge()`, and `Graph.hasEdge()` for O(1) transition validation.

### 2.3 Machine.changes as Observation Source

`Machine.changes` emits a `Stream<State>` [EFFECT-MACHINE] starting with the
initial state, then all subsequent transitions. This is the zero-handler-modification
observation mechanism specified in RFC-001.

Key properties:
1. Emits initial state immediately — implementations MUST filter with `Stream.zipWithPrevious`
2. Only fires on actual change — referential inequality check internal to Machine
3. PubSub is unbounded — no backpressure risk within Machine internals
4. Stream completes when Machine scope closes — automatic cleanup on entity reap
5. Safe to fork inside entity — fiber tied to entity scope [EFFECT-ENTITY]

**Codebase proof**: The current ReactivityBridge at `lib/iiot/realtime/reactivity-bridge.ts:91-135`
is the downstream consumer. The _helpers.ts pattern at `lib/iiot/entity/_helpers.ts:28-42`
(`maybeEmitWorkOrder`, `maybeEmitAlarm`, etc.) is the precursor — feature-flag controlled
event emission that this observer pattern supersedes.

### 2.4 State Recovery on Shard Migration

Entity state does NOT survive shard migration [EFFECT-CLUSTER]. Implementations
MUST provide state recovery via one of:

- `Machine.makeSerializable` + `Machine.snapshot/restore` with NATS KV storage
- `ClusterSchema.Persisted` annotation for durable message replay
- External state service (SQL-backed, as in `lib/iiot/state/PlantState.ts:293-393`)

**LOOP OPEN (LO-2)**: The interaction between `Machine.makeSerializable` and
NATS KV for snapshot storage has not been verified in production. The current
codebase uses SQL-backed state services (`makePlantStateSql(repo)` factory at
`lib/iiot/state/PlantState.ts:293-393`). **Recommendation**: Continue SQL-backed
state for MVP. Evaluate Machine.snapshot + NATS KV for Growth milestone.

---

## 3. Schema and Type System

### 3.1 Branded Identifiers

All domain identifiers MUST use `Schema.brand` [EFFECT-SCHEMA] with
`Schema.pattern` validation. This prevents cross-entity ID assignment at both
compile time and runtime.

**Codebase proof**: `lib/iiot/schemas/identifiers.ts` defines 20 branded types:

- **ISA-95 hierarchy** (lines 46--79): `EnterpriseId`, `SiteId`, `AreaId`,
  `PlantId`, `LineId`, `WorkCellId`, `MachineId`, `SensorId`, `DeviceId`
- **Domain** (lines 89--131): `AlarmId`, `WorkOrderId`, `TaskInstanceId`,
  `TaskDefinitionId`, `ApprovalId`, `SyncId`, `WorkflowDefinitionId`, etc.
- **Event sourcing** (lines 141--146): `EventId`, `FactId`
- **Equipment level enum** (lines 28--38): `Schema.Literal('enterprise', 'site',
  'area', 'plant', 'line', 'workcell', 'machine', 'sensor', 'device')`

New identifiers for the 200K-org scale MUST follow this pattern:

```typescript
export const OrgId = Schema.String.pipe(
  Schema.pattern(/^org_[a-zA-Z0-9]{20}$/),
  Schema.brand('OrgId'),
)

export const CapabilityId = Schema.String.pipe(
  Schema.pattern(/^cap_[a-zA-Z0-9]{20}$/),
  Schema.brand('CapabilityId'),
)

export const ReputationScore = Schema.Number.pipe(
  Schema.between(0, 100),
  Schema.brand('ReputationScore'),
)
```

### 3.2 Entity Schema Pattern

All entity types MUST use `Schema.TaggedClass` [EFFECT-SCHEMA] with instance
methods for domain logic. This pattern enables runtime validation, JSON Schema
generation via `JSONSchema.make`, and compile-time type inference.

**Codebase proof**: The canonical Plant entity at `lib/iiot/schemas/assets/plant/schema.ts`:

- Pattern-validated ID: `PlantId` at line 28 with `Schema.pattern(/^PLT-[a-zA-Z0-9-]+$/)`
- Status literal: `PlantStatus` at line 54 — ISA-95 lifecycle states
- TaggedClass: `Plant extends Schema.TaggedClass<Plant>()('Plant', {...})` at line 99
  with instance methods (`getAutomationLevel()`, `isOperational()`, `isContainer()`)
- Create params: `CreatePlantParams = Schema.Struct({...})` at line 163
- Optional fields: `Schema.optionalWith(T, { as: 'Option' })` throughout

New Organization, Capability, and WorkOrder schemas MUST follow this pattern,
placed at `lib/iiot/schemas/assets/organization/schema.ts`, etc.

### 3.3 Cross-Organization Data Transformation

When Organization A shares data with Organization B (marketplace listing,
capability profile), implementations MUST use `Schema.transform` [EFFECT-SCHEMA]
to redact sensitive fields. The transform provides bidirectional encode/decode
with type safety.

```typescript
export const OrganizationToPublicView = Schema.transform(
  Organization,
  OrganizationPublicView,
  {
    decode: (org) => ({ ...org, displayName: org.name, capabilityCount: org.capabilities.length }),
    encode: (pub) => ({ ...pub, name: pub.displayName, tier: 'starter', capabilities: [], metadata: {} }),
  }
)
```

---

## 4. RPC Architecture and Tenant Isolation

### 4.1 Per-Domain RpcGroup Composition

Implementations MUST organize RPCs into one `RpcGroup` per bounded context
[EFFECT-RPCGROUP], composed into a single top-level group for server mounting.

**Codebase proof**: The existing `IIoTRpcs` at `lib/iiot/rpc/index.ts:91-112`
composes 17 `RpcGroup` definitions by spreading `group.requests.values()` into a
single `RpcGroup.make()` call. This pattern extends to include `OrgRpcs`,
`MarketplaceRpcs`, and `TelemetryRpcs`.

New RPC groups for the 200K-org scale:

| Group | Domain | Key RPCs | Stream RPCs |
|---|---|---|---|
| `OrgRpcs` | Organization management | Create, Get, Activate, Suspend, UpdateTier | -- |
| `MarketplaceRpcs` | Cross-org work orders | PostWorkOrder, SearchCapabilities, AcceptMatch | StreamListings |
| `TelemetryRpcs` | Sensor data (extended) | GetLatest, GetAggregated | StreamReadings, StreamAlarms |

### 4.2 Stream RPCs

`stream: true` RPCs return `Stream<A>` from handlers [EFFECT-RPCSERVER]. The
`RpcServer` sends `FromServer.Chunk` messages for each emitted value.

Implementations MUST use the `Stream.unwrap` bridge pattern when handler methods
return `Effect<Stream<A>>`:

```typescript
// Pattern from lib/iiot/realtime/websocket-server.ts:68-92
const HandlerBridge = {
  [SubscribeReadings._tag]: (request) =>
    Stream.unwrap(handlers.subscribeReadings(request)),
}
```

**Codebase proof**: The existing handler implementations at `lib/iiot/realtime/realtime-handlers.ts`
apply per-request filters (deviceId, severity at lines 86--192, glob patterns at
lines 254--285) and optional throttle (`Stream.throttle` at lines 129--135).

### 4.3 Tenant Isolation Middleware

Implementations MUST apply tenant isolation via `RpcMiddleware.Tag` with
`wrap: true` [EFFECT-RPCMIDDLEWARE]. The middleware:

1. Extracts organization ID from JWT in `authorization` header
2. Verifies the token via `AuthService`
3. Provides `TenantContext` to the handler via `Effect.provideService`
4. The `TenantContext` propagates through the Effect graph via fiber-local storage [EFFECT-FIBERREF]

```typescript
class TenantIsolation extends RpcMiddleware.Tag<TenantIsolation>()(
  'TenantIsolation',
  { wrap: true }
) {}
```

All RPC groups MUST have `TenantIsolation` applied:

```typescript
const SecureOrgRpcs = OrgRpcs.middleware(TenantIsolation)
const SecureEquipmentRpcs = EquipmentRpcs.middleware(TenantIsolation)
const SecureMarketplaceRpcs = MarketplaceRpcs.middleware(TenantIsolation)
```

Key design decisions:
- JWT-based extraction — no database lookup per RPC call
- FiberRef-scoped context — propagates automatically through Effect graph
- Group-level application — all RPCs in a group inherit isolation
- Marketplace RPCs SHOULD use a separate authorization middleware requiring
  consent from both participating organizations

### 4.4 Serialization

The WebSocket transport MUST use `RpcSerialization.layerJson` [EFFECT-RPCSERVER]
for browser compatibility.

**Codebase proof**: The existing WebSocket server at `lib/iiot/realtime/websocket-server.ts:131-137`:

```typescript
export const IIoTRealtimeWsServer = pipe(
  RealtimeRpcServerCore,
  Layer.provideMerge(RpcServer.layerProtocolWebsocketRouter({ path: '/ws/iiot' })),
  Layer.provide(RpcSerialization.layerJson),
)
```

Runner-to-runner communication MAY use `RpcSerialization.layerMsgpack` for
binary efficiency where browser compatibility is not required.

---

## 5. Stream Architecture and Backpressure

### 5.1 EventDistribution Channel Topology

The EventDistribution service MUST use ChannelService with broadcast outlets
for local event distribution [EFFECT-PUBSUB, EFFECT-STREAM].

**Codebase proof**: `lib/iiot/realtime/event-distribution.ts` (377 lines) implements
the current 4-channel hub:
- Channel registration at lines 169--199 via `ChannelBuilder.create()`
- PubSub.unbounded inlets at lines 210--213
- PubSub-to-channel wiring at lines 217--243 via `channels.connectStream()`
- Dual-write publish at lines 280--326 (local PubSub + HolonetBridge)
- Remote ingress daemons at lines 249--263 (NATS -> local PubSub)

For the 200K-org scale, implementations MUST expand to 7 channels:

| Channel | MaxLag | Peak Throughput | Content |
|---|---|---|---|
| `iiot:readings` | 10,000 | ~1.5M events/sec | Sensor telemetry (L0) |
| `iiot:alarms` | 1,000 | ~50K events/sec | ISA-18.2 alarm lifecycle |
| `iiot:equipment` | 1,000 | ~100K events/sec | Equipment state changes (L1--L2) |
| `iiot:entity-changes` | 5,000 | ~200K events/sec | ISA-95 entity state transitions |
| `iiot:marketplace` | 1,000 | ~10K events/sec | WorkOrder matching, listings |
| `iiot:org-lifecycle` | 500 | ~1K events/sec | Organization onboarding/suspension |
| `iiot:invalidations` | 1,000 | ~100K events/sec | Cache invalidation signals |

**Total peak: ~2M events/sec** across all channels.

### 5.2 Backpressure Strategy

Each channel MUST use an appropriate PubSub strategy [EFFECT-PUBSUB] based on
event criticality and idempotency:

| Channel | Strategy | Rationale |
|---|---|---|
| `iiot:readings` | `PubSub.sliding(10000)` | Telemetry is latest-value-wins. Dropping old readings is acceptable. |
| `iiot:alarms` | `PubSub.bounded(1000)` | Alarms MUST NOT be lost. Backpressure to producer is correct [ISA-18.2]. |
| `iiot:equipment` | `PubSub.bounded(1000)` | Equipment state changes are critical for OEE calculation. |
| `iiot:entity-changes` | `PubSub.dropping(5000)` | Entity changes can be replayed from EventLog. Drop under pressure. |
| `iiot:marketplace` | `PubSub.bounded(1000)` | Marketplace events are business-critical. |
| `iiot:org-lifecycle` | `PubSub.bounded(500)` | Low volume, high importance. |
| `iiot:invalidations` | `PubSub.sliding(1000)` | Cache invalidations are idempotent. Latest wins. |

### 5.3 Per-Organization Stream Isolation

For multi-tenant stream isolation, implementations SHOULD use `Stream.groupByKey`
[EFFECT-STREAM] to partition events by organization:

```typescript
const perOrgStreams = unifiedEntityStream.pipe(
  Stream.groupByKey(
    (event) => event.orgId,
    { bufferSize: 256 }
  ),
  GroupBy.evaluate((orgId, orgStream) =>
    orgStream.pipe(
      Stream.throttle({ units: 100, duration: Duration.seconds(1), strategy: 'shape' }),
      Stream.tap((event) => publishToOrgNats(orgId, event)),
    )
  ),
)
```

**Scaling concern**: With 200K orgs, `Stream.groupByKey` creates up to 200K
internal queues. At `bufferSize: 256` and ~100 bytes per event, peak memory is
~5GB. However, only 10--20% of orgs are active at any time (20--40K orgs),
reducing actual memory to ~1GB. Distributed across 20+ runners: ~50MB per runner.

**LOOP OPEN (LO-3)**: `Stream.groupByKey` at 200K orgs has not been load-tested.
Active-org-only filtering mitigates the theoretical worst case. **Recommendation**:
Implement active-org filtering at the groupBy input, benchmarked during Growth
milestone.

### 5.4 HolonetBridge for Cross-Node Fan-Out

**Codebase proof**: The HolonetBridge at `lib/iiot/realtime/holonet-bridge.ts`
(212 lines) bridges local EventDistribution to NATS:

- **Outbound** (lines 102--128): Fire-and-forget with `Effect.ignoreLogged` — errors
  logged but never block the caller
- **Inbound** (lines 136--182): Wildcard subscriptions yielding typed streams

NATS subjects at `lib/iiot/realtime/iiot-subjects.ts:39-112` use `createSubjectSpec()`
with parameterized patterns: `iiot.readings.{deviceId}`, `iiot.alarms.{deviceId}`,
`iiot.equipment.{equipmentId}`, `iiot.invalidations.{cacheKey}`.

For the 200K-org scale, additional subjects MUST be added:
- `iiot.org-lifecycle.{orgId}` — organization state transitions
- `iiot.marketplace.{region}` — marketplace events by region

---

## 6. Layer Composition Architecture

### 6.1 Five-Tier Service Graph

Implementations MUST organize services into 5 tiers with explicit dependency chains:

```
Tier 5: Cluster Layer        ← Entity registration, runner setup, sharding
    │  depends on
Tier 4: RPC & Transport      ← Handler layers, serialization, WebSocket
    │  depends on
Tier 3: Event & Stream       ← EventDistribution, ChannelService, HolonetBridge
    │  depends on
Tier 2: Domain Services      ← Org, Equipment, Sensor, Alarm, WorkOrder, Marketplace
    │  depends on
Tier 1: Infrastructure       ← NATS, PostgreSQL, TimescaleDB, Redis, Auth
```

Same-tier services MUST be composed with `Layer.mergeAll` [EFFECT-LAYER] for
concurrent initialization. Cross-tier dependencies MUST use `Layer.provide` for
sequential initialization.

**Codebase proof**: This pattern already exists at multiple levels:

- **Entity tier** (`lib/iiot/entity/EntityStack.ts:54-67`): `Layer.mergeAll` of 12
  handler layers
- **Testing tier** (`lib/iiot/entity/EntityStack.ts:90-93`): `EntityHandlersLayer.pipe(
  Layer.provideMerge(AllStateServicesInMemory), Layer.provideMerge(IIoTFeatureFlagsDisabledLayer))`
- **Pipeline tier** (`lib/iiot/adapters/ingestion-service.ts:297-322`):
  `SparkplugPipelineLayer` composing TopicRouter, AlarmDetector, ReadingProcessor,
  SparkplugAdapter, IngestionService
- **Realtime tier** (`lib/iiot/realtime/websocket-server.ts:112-137`):
  `RealtimeRpcServerCore` -> `RpcServer.layerProtocolWebsocketRouter` -> `RpcSerialization.layerJson`

### 6.2 Tier Specification

```typescript
// --- Tier 1: Infrastructure (no dependencies) ---
const InfraLayer = Layer.mergeAll(
  NatsClientLive,
  PostgresPoolLive,
  TimescaleDBLive,
  RedisClientLive,
  AuthServiceLive,
)

// --- Tier 2: Domain Services (depend on infra) ---
const DomainLayer = Layer.mergeAll(
  OrgServiceLive,
  EquipmentServiceLive,
  SensorServiceLive,
  AlarmServiceLive,
  WorkOrderServiceLive,
  MarketplaceServiceLive,
  ReputationServiceLive,
).pipe(Layer.provide(InfraLayer))

// --- Tier 3: Event & Stream Services (depend on infra + domain) ---
const StreamLayer = Layer.mergeAll(
  EventDistributionLive,
  ChannelServiceLive,
  HolonetBridgeLive,
  ReactivityBridgeLive,
).pipe(Layer.provide(Layer.merge(InfraLayer, DomainLayer)))

// --- Tier 4: RPC & Transport (depend on all lower tiers) ---
const RpcLayer = Layer.mergeAll(
  OrgRpcHandlersLive,
  EquipmentRpcHandlersLive,
  MarketplaceRpcHandlersLive,
  TelemetryRpcHandlersLive,
  TenantIsolationLive,
  RpcSerialization.layerJson,
  WebSocketServerLive,
).pipe(Layer.provide(Layer.mergeAll(InfraLayer, DomainLayer, StreamLayer)))

// --- Tier 5: Cluster (entity registration, runner setup) ---
const ClusterLayer = Layer.mergeAll(
  OrgEntityLayer,
  EquipmentEntityLayer,
  SensorEntityLayer,
  AlarmEntityLayer,
  WorkOrderEntityLayer,
  Sharding.layer,
  SocketRunner.layer({ port: 9000 }),
  SqlRunnerStorage.layer,
  SqlMessageStorage.layer,
).pipe(Layer.provide(Layer.mergeAll(InfraLayer, DomainLayer, StreamLayer, RpcLayer)))

export const ApplicationLayer = ClusterLayer
```

### 6.3 Memoization and Isolation

| Resource | Strategy | Rationale |
|---|---|---|
| NATS connection pool | `Layer.memoize` | Shared across all tenants; multiplexed via NATS accounts |
| PostgreSQL pool | `Layer.memoize` | Shared pool; tenant isolation via row-level security |
| Redis cache | `Layer.memoize` | Shared with key-prefix tenant isolation |
| Per-org crypto keys | `Layer.fresh` | MUST be per-tenant; key material isolation [IEC-62443] |
| Audit logger | `Layer.fresh` | Per-tenant audit trail; separate streams [FDA-CFR11] |
| Rate limiter | `Layer.fresh` | Per-tenant rate limits; noisy-neighbor prevention |

### 6.4 State Service Pattern

Each entity type MUST have a state service following the `PlantState` pattern
at `lib/iiot/state/PlantState.ts`:

- **Interface** (lines 65--86): `create`, `get`, `set`, `list`, `delete`, `exists`, `count`
- **Context.Tag** (lines 103--106): `PlantState extends Context.Tag('iiot/PlantState')`
- **In-memory** (lines 120--281): `Ref.make(new Map())` for testing
- **SQL-backed** (lines 293--393): `makePlantStateSql(repo)` factory for production

This dual-implementation pattern enables testing with `Layer.mergeAll(AllStateServicesInMemory)`
while deploying with SQL-backed layers in production.

### 6.5 Runtime Bootstrap Sequence

At 50--80 runners, the bootstrap sequence MUST be staggered to avoid thundering
herd on shard rebalancing:

```
T=0s    Runner starts, builds ApplicationLayer
T=0.5s  Layer.memoize acquires shared resources (NATS, Postgres, Redis)
T=1s    Sharding.layer registers runner in RunnerStorage
T=1.5s  HashRing recomputation assigns shards to this runner
T=2s    Entity.toLayer registers entity types (lazy instances)
T=3s    First RunnerStorage poll by other runners discovers new node
T=6s    Shard rebalancing begins (some shards migrate from existing runners)
T=15s   Shard migration complete (entityTerminationTimeout on old runners)
T=16s   Runner fully operational, serving entity RPCs
```

---

## 7. Testing Architecture

### 7.1 Cluster Testing

Tests MUST use `TestRunner.layer` [EFFECT-CLUSTER] for in-memory cluster testing.
This provides `MessageStorage`, `RunnerStorage`, `RunnerHealth`, and `Runners`
without network or persistence overhead.

```typescript
const TestClusterLayer = Layer.mergeAll(
  OrgEntityLayer,
  EquipmentEntityLayer,
  TestRunner.layer,
  Sharding.layer,
  ShardingConfig.layer({ shardsPerGroup: 10 }),
)
```

### 7.2 Handler Testing

Tests MUST use `Entity.makeTestClient` [EFFECT-ENTITY] for isolated handler
testing without full cluster infrastructure.

**Codebase proof**: The `EntityTestingStack` at `lib/iiot/entity/EntityStack.ts:90-93`
provides the test composition: `EntityHandlersLayer.pipe(Layer.provideMerge(AllStateServicesInMemory),
Layer.provideMerge(IIoTFeatureFlagsDisabledLayer))`.

### 7.3 PubSub Stream Testing

Tests involving `PubSub + Stream.fromPubSub + Effect.fork` MUST use plain vitest
`it()` + `Effect.runPromise`, NOT `it.effect()` or `it.scoped()` from `@effect/vitest`.

**Codebase proof**: The EventDistribution tests at `lib/iiot/realtime/__tests__/event-distribution.test.ts`
document this constraint. Fiber scheduling in the `it.effect()` wrapper conflicts
with forked PubSub subscribers, causing timeouts [EFFECT-VITEST].

### 7.4 Property-Based Testing

Schema-backed types MUST have roundtrip property tests using `it.prop` with
`Arbitrary.make(schema)` [EFFECT-VITEST, EFFECT-SCHEMA]. At minimum:

- Encode/decode roundtrip identity for all entity schemas
- Branded ID format compliance
- State transition monotonicity (no backwards transitions)

### 7.5 Load Testing

Shard distribution tests MUST verify that entities spread evenly across shards.
No shard SHOULD have more than 2x the average entity count across a sample of
10,000 entity IDs. This validates the HashRing distribution [EFFECT-HASHRING].

---

## 8. Open Questions and Recommendations

### 8.1 Resolved

| ID | Question | Resolution |
|---|---|---|
| LO-1 | Per-group `shardsPerGroup` | Accept 300 default for MVP/Growth. Deploy independent clusters per shard group at Metro scale. |
| LO-2 | Machine.snapshot + NATS KV | Continue SQL-backed state for MVP. Evaluate Machine.snapshot at Growth milestone. |
| LO-3 | Stream.groupByKey at 200K orgs | Implement active-org filtering at groupBy input. Benchmark at Growth milestone. |

### 8.2 Remaining Open

| ID | Question | Status | Impact | Recommendation |
|---|---|---|---|---|
| LO-4 | NATS as custom `RpcClientProtocol` transport | OPEN | MEDIUM | The `RpcClientProtocol` extension point at `Runners.ts:620-623` allows custom transports. A NATS transport would avoid HTTP/Socket for runner-to-runner. **Recommendation**: Defer — SocketRunner is sufficient through Metro scale. |
| LO-5 | `@effect/experimental/LayerMap` for dynamic per-tenant service resolution | OPEN | MEDIUM | LayerMap is experimental and may change. **Recommendation**: Use `FiberRef`-based tenant context (Section 4.3) for tenant isolation. Evaluate LayerMap when it stabilizes. |

### 8.3 Scaling Milestones

| Milestone | Orgs | Entities | Runners | Shards | Key Architecture Change |
|---|---|---|---|---|---|
| **MVP** | 100 | ~100K | 3 (SingleRunner) | 300/group | Monolithic, local PubSub |
| **Growth** | 5K | ~5M | 10 (SocketRunner) | 300/group | Cluster + NATS accounts |
| **Scale** | 50K | ~50M | 30 (SocketRunner) | 1,000/group | Shard groups, per-tier runners |
| **Metro** | 200K | ~200M | 50--80 (mixed) | 3,000/group (telemetry) | Full metropolitan, edge nodes |

### 8.4 Risk Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| 14.2M entity shard hotspots | HIGH | Shard groups separate telemetry from orgs; HashRing distributes within groups [EFFECT-HASHRING] |
| Shard rebalancing thundering herd | MEDIUM | Staggered runner startup; `entityTerminationTimeout` prevents cascade [EFFECT-CLUSTER] |
| NATS connection exhaustion | LOW | EntityResource with 30min idle TTL; per-org not per-entity connections |
| Stream memory pressure | MEDIUM | Active-org-only groupBy; sliding PubSub for telemetry; bounded for critical [EFFECT-PUBSUB] |
| Cross-org data leakage | HIGH | TenantIsolation middleware; FiberRef-scoped context; NATS account isolation [IEC-62443] |
| Entity state loss on migration | MEDIUM | SQL-backed state services; Persisted annotation for critical messages [EFFECT-CLUSTER] |

---

## Appendix: Codebase File Reference Map

| File | Key Lines | Pattern | Section |
|---|---|---|---|
| `lib/iiot/entity/EntityStack.ts` | 54--67 | `Layer.mergeAll` of 12 handler layers | 1.1, 6.1 |
| `lib/iiot/entity/EntityStack.ts` | 90--93 | `EntityTestingStack` composition | 6.1, 7.2 |
| `lib/iiot/entity/_helpers.ts` | 28--42 | `maybeEmitWorkOrder` feature-flag emission | 2.3 |
| `lib/iiot/entity/_helpers.ts` | 140--166 | `emitIfEnabled` domain-switched emission | 2.3 |
| `lib/iiot/schemas/identifiers.ts` | 28--38 | `EquipmentLevel = Schema.Literal(...)` | 3.1 |
| `lib/iiot/schemas/identifiers.ts` | 46--131 | 21 branded identifier types | 3.1 |
| `lib/iiot/schemas/assets/plant/schema.ts` | 28--35 | `PlantId` pattern + brand | 3.1, 3.2 |
| `lib/iiot/schemas/assets/plant/schema.ts` | 99--150 | `Plant extends Schema.TaggedClass` | 3.2 |
| `lib/iiot/machines/PlantMachine.ts` | 44--634 | `Machine.make` + chained procedures | 2.1 |
| `lib/iiot/machines/graphs/plant-graph.ts` | 84--123 | `Graph.directed` with 6 states, 9 edges | 2.1, 2.2 |
| `lib/iiot/machines/graphs/plant-graph.ts` | 146--155 | `Graph.hasEdge()` transition validation | 2.1 |
| `lib/iiot/rpc/index.ts` | 91--112 | `IIoTRpcs` composing 17 RPC groups | 4.1 |
| `lib/iiot/rpc/RealtimeRpcs.ts` | full | 4 streaming RPCs (`stream: true`) | 4.2 |
| `lib/iiot/realtime/event-distribution.ts` | 169--199 | 4 channel registrations | 5.1 |
| `lib/iiot/realtime/event-distribution.ts` | 210--243 | PubSub inlets + connectStream | 5.1 |
| `lib/iiot/realtime/event-distribution.ts` | 249--263 | Remote ingress daemons | 5.1, 5.4 |
| `lib/iiot/realtime/event-distribution.ts` | 280--326 | Dual-write publish | 5.1 |
| `lib/iiot/realtime/holonet-bridge.ts` | 102--128 | Fire-and-forget NATS publish | 5.4 |
| `lib/iiot/realtime/holonet-bridge.ts` | 136--182 | Wildcard NATS subscriptions | 5.4 |
| `lib/iiot/realtime/iiot-subjects.ts` | 39--112 | 4 NATS subject specs | 5.4 |
| `lib/iiot/realtime/realtime-handlers.ts` | 86--192 | Filter/throttle handlers | 4.2 |
| `lib/iiot/realtime/reactivity-bridge.ts` | 91--135 | Handler-to-EventDistribution adapter | 2.3, 6.1 |
| `lib/iiot/realtime/websocket-server.ts` | 68--92 | `Stream.unwrap` bridge | 4.2 |
| `lib/iiot/realtime/websocket-server.ts` | 131--137 | WebSocket server layer | 4.4 |
| `lib/iiot/state/PlantState.ts` | 65--86 | State service shape interface | 6.4 |
| `lib/iiot/state/PlantState.ts` | 103--106 | `Context.Tag` service definition | 6.4 |
| `lib/iiot/state/PlantState.ts` | 120--281 | In-memory implementation | 6.4, 7.2 |
| `lib/iiot/state/PlantState.ts` | 293--393 | SQL-backed implementation | 2.4, 6.4 |
| `lib/iiot/adapters/ingestion-service.ts` | 297--322 | `SparkplugPipelineLayer` | 6.1 |
| `lib/streams/constructs/ChannelService.ts` | full | BFO-ontology event bus | 5.1 |

---

## Normative References

- [RFC2119], [RFC8174] — Requirement level key words
- [ISA-95-1] — Equipment hierarchy model
- [ISA-18.2] — Alarm management (backpressure requirements)
- [IEC-62443] — Network and system security (tenant isolation)
- [FDA-CFR11] — Electronic records (audit trail requirements)
- [NATS-PROTO] — NATS protocol (connection capacity)

## Informative References

- [EFFECT-TS] — Effect-TS core library
- [EFFECT-CLUSTER] — Distributed entity management
- [EFFECT-ENTITY] — Cluster entity lifecycle
- [EFFECT-MACHINE] — State machine with actor semantics
- [EFFECT-SCHEMA] — Runtime validation
- [EFFECT-STREAM] — Pull-based reactive streams
- [EFFECT-PUBSUB] — Broadcast primitives
- [EFFECT-LAYER] — Dependency injection
- [EFFECT-RPCGROUP] — RPC composition
- [EFFECT-RPCMIDDLEWARE] — RPC cross-cutting concerns
- [EFFECT-RPCSERVER] — RPC server transport
- [EFFECT-FIBERREF] — Fiber-local storage
- [EFFECT-HASHRING] — Consistent hashing
- [EFFECT-VITEST] — Testing utilities
- [EFFECT-LAYERMAP] — Dynamic per-key layer resolution

---

*Section drafted 2026-02-09 by Val (effect-specialist). Based on research-effect-architecture.md (1589 lines) and 20+ codebase source files.*

---

<!-- Source: rfc-entity-realtime-integration.md Sections 10-11 (Observer + Streaming RPC) -->

---

<!-- Source: rfc-entity-realtime-integration.md Section 12 -->


═══════════════════════════════════════════════════════════════════════════
PART IV: GOVERNANCE (Normative)
═══════════════════════════════════════════════════════════════════════════

# Part IV: Governance

<!-- Source: rfc-section-security-architecture.md -->
## S.1 Scope

This section addresses the security architecture for the TMNL metropolitan
manufacturing network. It covers:

- **Threat landscape** specific to multi-tenant manufacturing networks
- **Authentication** for edge devices, human operators, cloud services, and
  cross-organization interactions
- **Authorization** at NATS subject, RPC, and entity levels
- **Cryptographic primitives** for transport, storage, and identity
- **Network security boundaries** leveraging NATS account isolation
- **Regulatory compliance** mappings for IEC 62443, NIST CSF, FDA 21 CFR Part 11,
  and ISA-18.2

This section does NOT cover:

- Trust scoring and reputation (see `rfc-section-trust-model.md`)
- Tenant data isolation mechanics (see `rfc-section-tenant-isolation.md`)
- Application-level access control patterns within the UI

**Companion sections**:

- `rfc-section-trust-model.md` -- G-10 trust score, anti-fraud, trust lifecycle
- `rfc-section-tenant-isolation.md` -- NATS account isolation, data partitioning,
  compute isolation, audit
- `rfc-section-two-domain-consistency.md` -- Normative ordering guarantees (G-1
  through G-8)
- `rfc-section-edge-architecture.md` -- Edge-first deployment topology

---

## S.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

---

## S.3 Threat Model

### S.3.1 Metropolitan Manufacturing Network Threat Landscape

The metropolitan manufacturing network presents a threat model distinct from
single-enterprise IIoT deployments. The network interconnects 200,000+
organizations ranging from 2-person machine shops to 500-employee aerospace
facilities. This heterogeneity produces an unusually wide attack surface:

1. **Diverse security postures**: A 2-person shop running an unpatched $50 edge
   device shares network infrastructure with a defense contractor running
   hardened, audited systems.
2. **Competitive co-habitation**: Direct competitors share the same platform,
   creating incentives for industrial espionage that do not exist in
   single-enterprise deployments.
3. **Physical-digital convergence**: Compromised edge devices can affect
   physical manufacturing processes, not just data integrity.
4. **Regulatory heterogeneity**: Organizations span FDA-regulated pharmaceutical
   manufacturing, ITAR-controlled defense work, and unregulated custom
   fabrication. A single platform serves all.

### S.3.2 Threat Actors

| Actor | Motivation | Capability | Likelihood |
|-------|-----------|------------|------------|
| **Compromised org** | Industrial espionage, competitive intelligence | Valid account credentials; can publish/subscribe within own account; may attempt lateral movement via cross-org exports | High |
| **Malicious insider** | Sabotage, data theft, competitive advantage | Valid operator or admin credentials; knowledge of internal subject patterns and entity IDs | Medium |
| **Supply chain attacker** | Firmware backdoors, persistent access | Ability to inject malicious firmware into edge devices; may compromise device attestation chain | Medium |
| **Nation-state actor** | Strategic industrial intelligence, IP theft | Advanced persistent threat; may target platform infrastructure directly; capable of cryptographic attacks on weak primitives | Low (high impact) |
| **Network attacker** | Data interception, session hijacking | Passive eavesdropping or active MITM on network segments between edge and hub | Low (TLS mitigated) |
| **Malicious platform operator** | Access to all org data, surveillance | Infrastructure-level access; can read NATS traffic if not encrypted per-org | Critical if unmitigated |

### S.3.3 Attack Surfaces

| Surface | Entry Point | Threat | Mitigation Reference |
|---------|-------------|--------|---------------------|
| **Edge devices** | MQTT/Sparkplug ingestion, device firmware | Compromised readings, clock manipulation, DoS | S.4.3, S.6.4, S.7.5 |
| **NATS messaging** | Account credentials, subject subscriptions | Cross-org data leakage, message injection | S.4.1, S.5.1, S.7.1 |
| **API endpoints** | WebSocket `/ws/iiot`, HTTP RPCs | Unauthorized entity access, session hijacking | S.4.4, S.5.2, S.6.1 |
| **Cross-org events** | Export/import configuration, marketplace subjects | Data sovereignty violation, false capacity injection | S.5.4, S.7.1 |
| **Platform infrastructure** | Operator keys, NATS cluster nodes, storage | Complete data access, system-wide compromise | S.4.1, S.6.2, S.7.3 |
| **@effect/cluster** | Runner-to-runner communication, shard migration | Entity state corruption, unauthorized shard access | S.4.5, S.6.3 |

### S.3.4 Threat Matrix

The following matrix maps threat actors to attack surfaces with risk ratings
(Likelihood x Impact):

| | Edge Devices | NATS Messaging | API Endpoints | Cross-Org Events | Platform Infra | Cluster |
|---|---|---|---|---|---|---|
| **Compromised org** | Low | **High** | Medium | **High** | Low | Low |
| **Malicious insider** | Medium | **High** | **High** | Medium | Low | Medium |
| **Supply chain** | **High** | Low | Low | Low | Low | Low |
| **Nation-state** | Medium | Medium | Medium | Medium | **Critical** | Medium |
| **Network attacker** | Low | Low | Low | Low | Low | Low |
| **Platform operator** | Low | **Critical** | Medium | **Critical** | **Critical** | **Critical** |

**Key insight**: The platform operator is the highest-risk single point of
compromise. The architecture MUST ensure that operator infrastructure access does
NOT grant access to org data (S.7.2).

---

## S.4 Authentication Architecture

### S.4.1 NATS Decentralized JWT Authentication

Authentication uses NATS' decentralized JWT model [NATS-DECENTRALIZED], which
eliminates the need for a central authentication database:

```
Operator Key (platform root of trust)
  |
  +-- Account Key: earl-machine-shop
  |     +-- User Key: earl-edge-001 (CNC machine gateway)
  |     +-- User Key: earl-edge-002 (secondary gateway)
  |     +-- User Key: earl-operator-01 (human operator)
  |
  +-- Account Key: precision-machining-inc
  |     +-- User Key: pm-edge-001 (factory server)
  |     +-- User Key: pm-cloud-001 (cloud analytics)
  |
  +-- Account Key: manufacturing-commons (system)
        +-- User Key: commons-aggregator
        +-- User Key: commons-monitor
```

**Architecture properties**:

1. **No central auth database**: The NATS server validates the JWT signature
   chain (user -> account -> operator) without querying a central database.
   This means authentication is available even during partial network partitions.
2. **Offline-capable**: The JWT is self-contained. An edge device with a valid
   JWT can authenticate to any NATS server even if the provisioning service is
   unavailable.
3. **Revocation**: JWTs can be revoked via a revocation list published to the
   NATS cluster [NATS-JWT]. Revoked JWTs are rejected on next connection
   attempt.

**Requirements**:

1. The operator key MUST be stored in an HSM or equivalent hardware vault. It
   signs account JWTs but MUST NEVER be transmitted to edge devices or stored
   on internet-accessible systems.
2. Account keys MAY be self-managed by the organization (decentralized model)
   or managed by the platform operator (centralized model). Self-managed keys
   SHOULD be preferred for organizations with security staff.
3. User keys (edge device credentials) MUST be revocable via JWT revocation
   list without requiring device physical access.
4. Account JWTs MUST specify resource limits (see `rfc-section-tenant-isolation.md`
   Section TI.4 for limit specifications).

### S.4.2 Per-Org Account Provisioning

Organizations are provisioned via operator-signed JWTs [NATS-JWT]:

1. A new organization requests onboarding through the platform API.
2. The platform generates an NKey pair (Ed25519) for the organization's account.
3. The operator key signs an account JWT binding the NKey to the org identity.
4. The account JWT is delivered to the organization's administrator via a
   secure channel (TLS-encrypted API response, never email).
5. The organization uses the account key to sign user JWTs for its devices
   and operators.

**Account JWT claims MUST include**:

```json
{
  "name": "earl-machine-shop",
  "sub": "<account NKey public key>",
  "nats": {
    "limits": {
      "conn": 100,
      "data": 10485760,
      "payload": 1048576,
      "subs": 1000
    },
    "exports": [],
    "imports": [],
    "default_permissions": {
      "pub": { "deny": ["$SYS.>"] },
      "sub": { "deny": ["$SYS.>"] }
    }
  }
}
```

### S.4.3 Edge Device Authentication

Edge devices MUST authenticate with credentials that satisfy these requirements:

1. **Unique per device**: Credentials MUST NOT be shared across devices within
   an org. A device credential for `edge-001` MUST NOT authenticate as
   `edge-002`.
2. **Subject-scoped**: The device JWT MUST include subject permissions that
   restrict the device to its own readings: `publish: iiot.readings.{deviceId}`,
   `publish: iiot.alarms.{deviceId}`.
3. **Rotatable**: Credentials MUST be rotatable without device physical access.
   The org's account key re-signs a new user JWT with the same NKey.
4. **Time-bounded**: Device JWTs MUST expire with a configurable TTL
   (RECOMMENDED: 90 days for edge devices).
5. **mTLS for transport**: Edge devices connecting to hub NATS servers MUST use
   mutual TLS (mTLS). The device presents its client certificate; the hub
   presents its server certificate.

**Sparkplug B devices**: Devices connecting via MQTT/Sparkplug B [SPARKPLUG-B]
authenticate at the MQTT broker level. The Sparkplug adapter
(`lib/iiot/adapters/sparkplug-adapter.ts`) validates that the MQTT client
ID matches the expected device identity before accepting metrics.

### S.4.4 Human Authentication

Human operators access the platform via WebSocket connections to `/ws/iiot` or
HTTP API endpoints. Authentication follows an OIDC/OAuth2 -> NATS JWT bridge:

1. The operator authenticates via OIDC (e.g., Azure AD, Okta, Keycloak)
   through the organization's identity provider [OAUTH2].
2. The platform's auth service validates the OIDC token and issues a
   short-lived NATS user JWT scoped to the operator's role (S.5.1).
3. The NATS user JWT has a TTL of RECOMMENDED 24 hours for human operators
   (shorter than edge devices to reflect higher-risk interactive sessions).
4. The operator's role (admin, supervisor, operator, viewer) is encoded in the
   JWT's subject permissions.

**Requirements**:

1. Human operator JWTs MUST carry the operator's identity for FDA 21 CFR Part
   11 audit trail compliance (S.8.1).
2. Session tokens MUST be invalidated on logout.
3. Multi-factor authentication (MFA) SHOULD be required for admin and
   supervisor roles.

### S.4.5 Service-to-Service Authentication within @effect/cluster

Within an organization's cloud infrastructure, `@effect/cluster` [EFFECT-CLUSTER]
runner nodes communicate via the Effect RPC transport. These inter-service
connections use SPIFFE [SPIFFE] identities for mutual authentication:

```
SPIFFE ID format:
  spiffe://org-{orgId}.manufacturing-commons/service/{serviceName}

Examples:
  spiffe://org-earl-machine-shop.manufacturing-commons/service/entity-runner
  spiffe://org-earl-machine-shop.manufacturing-commons/service/api-gateway
  spiffe://org-earl-machine-shop.manufacturing-commons/service/analytics-worker
  spiffe://platform.manufacturing-commons/service/commons-aggregator
```

**Requirements**:

1. Each `@effect/cluster` runner node MUST present a SPIFFE identity when
   communicating with other runner nodes within the same org.
2. SPIFFE identities MUST be scoped to the organization's trust domain. A
   service in `org-earl-machine-shop` MUST NOT present an identity in the
   `org-precision-machining-inc` trust domain.
3. The SPIFFE Workload API SHOULD be used for automatic credential rotation.
   Short-lived X.509-SVIDs (RECOMMENDED: 1-hour TTL) eliminate the need for
   manual certificate management.
4. Platform-level services (commons-aggregator, trust-score-computer) MUST use
   the `platform.manufacturing-commons` trust domain, separate from any org
   trust domain.

**Relationship to NATS authentication**: SPIFFE provides service-to-service
identity within an org's cloud infrastructure. NATS JWTs (S.4.1) provide
device-to-cluster identity for edge devices. Both operate independently:

| Identity System | Scope | Use Case | TTL |
|----------------|-------|----------|-----|
| NATS JWT (S.4.1) | Edge device -> NATS cluster | Device authentication, subject permissions | 90 days |
| OIDC/OAuth2 (S.4.4) | Human -> Platform API | Operator authentication, role mapping | 24 hours |
| SPIFFE X.509-SVID (S.4.5) | Service -> Service (cloud) | Runner-to-runner mTLS, API gateway auth | 1 hour |
| Operator Key (S.4.2) | Platform -> Account | Account provisioning, JWT signing | Long-lived (HSM) |

---

## S.5 Authorization Model

### S.5.1 NATS Subject-Based Authorization

Within an organization's NATS account, role-based access control is enforced via
user JWT subject permissions [NATS-JWT]:

| Role | Publish Permissions | Subscribe Permissions | Notes |
|------|--------------------|-----------------------|-------|
| **Edge Device** | `iiot.readings.{deviceId}`, `iiot.alarms.{deviceId}` | `iiot.commands.{deviceId}` | Scoped to own device ID |
| **Operator** | `iiot.commands.*`, `iiot.overrides.*` | `iiot.readings.*`, `iiot.alarms.*`, `iiot.equipment.*` | Can issue commands; FDA audit required |
| **Supervisor** | `workorders.*`, `iiot.overrides.*` | `iiot.*` (full internal visibility) | Work order lifecycle management |
| **Analytics** | (none -- read-only) | `iiot.readings.*`, `iiot.equipment.*` | Read-only access for BI/analytics |
| **Admin** | `$SYS.>` (system subjects) | `$SYS.>`, `iiot.*` | NATS system administration |

**Requirements**:

1. Edge devices MUST be restricted to publishing only their own device's
   subjects. A device credential for `edge-001` MUST NOT be able to publish
   to `iiot.readings.edge-002`.
2. The Operator role MUST have command actions recorded as `OperatorEvents`
   (`lib/iiot/schemas/events/regulatory/operator-events.ts`).
3. Role assignments are encoded in the user JWT's `pub.allow` and `sub.allow`
   fields [NATS-JWT].
4. Role escalation (e.g., operator -> admin) MUST require re-authentication
   and a new JWT issuance.

### S.5.2 RPC-Level Authorization via Effect Middleware

Beyond NATS subject-level authorization, the RPC layer enforces
application-level access control via Effect middleware [EFFECT-RPCMIDDLEWARE]:

```typescript
// Conceptual middleware -- authorization check before entity access
const AuthorizationMiddleware = RpcMiddleware.make((req) =>
  Effect.gen(function* () {
    const session = yield* SessionContext
    const entityOrgId = yield* extractOrgId(req)

    // Verify the requesting session belongs to the entity's org
    if (session.orgId !== entityOrgId) {
      return yield* Effect.fail(new UnauthorizedError({
        message: `Org ${session.orgId} cannot access entities in org ${entityOrgId}`,
        code: 'CROSS_ORG_ACCESS_DENIED',
      }))
    }

    // Verify the role has permission for this operation
    if (!hasPermission(session.role, req.method)) {
      return yield* Effect.fail(new ForbiddenError({
        message: `Role ${session.role} lacks permission for ${req.method}`,
        code: 'INSUFFICIENT_ROLE',
      }))
    }

    return yield* RpcMiddleware.next
  })
)
```

**Requirements**:

1. Every RPC handler MUST validate that the requesting session's `orgId`
   matches the target entity's `orgId`. Cross-org entity access is forbidden
   by default.
2. RPC authorization MUST be enforced in middleware, not in individual handlers.
   This ensures no handler can accidentally bypass authorization.
3. Authorization failures MUST be logged with the session identity, target
   entity, and attempted operation.

### S.5.3 Entity-Level Authorization

Entity handlers within `@effect/cluster` enforce entity-level access control:

1. Entity shard keys include `orgId` as a prefix, ensuring entities are
   routed to the correct org's shard.
2. The entity handler verifies `orgId` in the request context before
   processing any command.
3. No entity can be migrated across org boundaries. Shard rebalancing
   MUST preserve org affinity.

### S.5.4 Cross-Org Authorization

Cross-organization interactions use signed authorization tokens:

1. When Org A requests a transaction with Org B (e.g., work order placement),
   Org A MUST present a signed authorization token to the
   `manufacturing-commons` system account.
2. The authorization token MUST include:

   ```typescript
   const CrossOrgAuthToken = Schema.Struct({
     requestingOrgId: Schema.String,
     targetOrgId: Schema.String,
     transactionType: Schema.Literal(
       'work-order', 'capability-inquiry', 'quality-report'
     ),
     scope: Schema.Array(Schema.String),      // Subjects granted access to
     issuedAt: Schema.DateTimeUtc,
     expiresAt: Schema.DateTimeUtc,            // RECOMMENDED: 24-hour max TTL
     signature: Schema.String,                 // Signed by requesting org's account key
   })
   ```

3. The target org MUST validate the token signature against the requesting
   org's public key (available via NATS account resolution).
4. Cross-org tokens MUST be single-use or time-bounded. Long-lived cross-org
   access grants are PROHIBITED.

### S.5.5 Role Hierarchy

The platform defines a role hierarchy that applies within each organization:

```
admin
  +-- supervisor
        +-- operator
              +-- viewer
                    +-- device
```

**Hierarchy rules**:

1. Higher roles inherit all permissions of lower roles.
2. The `device` role is the most constrained -- publish/subscribe only to
   own device subjects.
3. The `admin` role grants NATS system subject access (`$SYS.>`) in addition
   to all IIoT subjects.
4. Cross-org interactions require `supervisor` or `admin` role. `operator`
   and `viewer` roles MUST NOT initiate cross-org transactions.

### S.5.6 Authorization Flow Summary

```
+----------------------------------------------------------+
|                     AUTHORIZATION FLOW                     |
+----------------------------------------------------------+
|                                                            |
|  INTRA-ORG (S.5.1):                                      |
|  Device -> [JWT pub/sub perms] -> NATS account subjects   |
|  Operator -> [JWT role perms] -> commands, overrides       |
|                                                            |
|  RPC LAYER (S.5.2):                                       |
|  Session -> [Effect middleware] -> orgId + role check      |
|  Middleware -> [pass/reject] -> entity handler             |
|                                                            |
|  CROSS-ORG (S.5.4):                                       |
|  Org A -> [signed token] -> manufacturing-commons          |
|  manufacturing-commons -> [validate sig] -> route to Org B |
|  Org B -> [validate + accept/reject] -> bilateral channel  |
|                                                            |
+----------------------------------------------------------+
```

---

## S.6 Cryptographic Requirements

### S.6.1 Transport Layer Security

1. All connections between edge devices and hub NATS servers MUST use TLS 1.3
   as the minimum version. TLS 1.2 MAY be supported for legacy edge devices
   during a transition period not exceeding 12 months from platform launch.
2. All inter-node communication (runner <-> runner, edge <-> cloud) MUST use
   TLS 1.3 [ZERO-TRUST].
3. WebSocket connections to `/ws/iiot` MUST use WSS (WebSocket Secure) with
   TLS 1.3.
4. HTTP API endpoints MUST enforce HTTPS with HSTS headers
   (`Strict-Transport-Security: max-age=31536000; includeSubDomains`).

**Cipher suites** (TLS 1.3, in preference order):

| Suite | Key Exchange | Symmetric | Hash |
|-------|-------------|-----------|------|
| TLS_AES_256_GCM_SHA384 | X25519 | AES-256-GCM | SHA-384 |
| TLS_CHACHA20_POLY1305_SHA256 | X25519 | ChaCha20-Poly1305 | SHA-256 |
| TLS_AES_128_GCM_SHA256 | X25519 | AES-128-GCM | SHA-256 |

### S.6.2 Identity Cryptography

1. NATS NKeys MUST use Ed25519 for signing [NATS-ACCOUNTS]. Ed25519 provides
   128-bit security with compact 32-byte public keys suitable for
   resource-constrained edge devices.
2. SPIFFE X.509-SVIDs MUST use ECDSA P-256 or Ed25519 for key pairs.
3. JWT signatures in the NATS chain (operator -> account -> user) MUST use
   Ed25519.

### S.6.3 Data at Rest Encryption

1. JetStream data at rest MUST be encrypted with AES-256-GCM.
2. NATS KV buckets containing entity state MUST be encrypted with AES-256-GCM.
3. Encryption keys MUST be per-organization. The platform operator MUST NOT
   have access to org-level encryption keys in the default configuration.
4. Key management SHOULD use a KMS (e.g., HashiCorp Vault, AWS KMS, Azure Key
   Vault) with automatic key rotation on a 90-day cycle.

### S.6.4 Edge Device Cryptography

Edge devices span a wide capability range. Minimum cryptographic requirements
are tiered:

| Edge Tier | TLS | Key Type | Attestation | Example Device |
|-----------|-----|----------|-------------|----------------|
| **Tier 1** ($50 SBC) | TLS 1.3 (software) | Ed25519 NKey | None | Raspberry Pi, Orange Pi |
| **Tier 2** (Industrial gateway) | TLS 1.3 (hardware accel) | Ed25519 NKey | Optional TPM | Advantech, Moxa |
| **Tier 3** (Hardened edge server) | TLS 1.3 + mTLS | Ed25519 + X.509 | TPM 2.0 required | Dell Edge, HPE Edgeline |
| **Tier 4** (Full edge cluster) | TLS 1.3 + mTLS | SPIFFE SVIDs | TPM 2.0 + Secure Boot | Kubernetes-on-edge |

### S.6.5 Key Rotation Policies

| Key Type | Rotation Period | Mechanism |
|----------|----------------|-----------|
| Operator key | Manual (HSM-backed) | Ceremony-based rotation with multi-party authorization |
| Account key | Annual | Org-initiated re-keying; new account JWT signed by operator |
| Device JWT | 90 days (RECOMMENDED) | Automatic re-signing by account key |
| SPIFFE SVID | 1 hour | Automatic via SPIFFE Workload API |
| JetStream encryption key | 90 days | KMS-managed automatic rotation |
| TLS server certificates | 90 days | ACME/Let's Encrypt or internal CA |

### S.6.6 mTLS for Edge-to-Hub Connections

Mutual TLS ensures both parties authenticate:

1. **Hub presents**: Server certificate signed by platform CA.
2. **Edge presents**: Client certificate derived from device NKey or
   org-issued X.509 certificate.
3. **Verification**: Hub verifies client certificate against org's trust
   anchor. Edge verifies hub certificate against platform root CA.
4. **Fallback**: For Tier 1 devices without client certificate capability,
   NATS JWT-only authentication is acceptable. The connection MUST still
   use TLS 1.3 for transport encryption.

---

## S.7 Network Security

### S.7.1 NATS Account Isolation as Network Boundary

NATS account isolation [NATS-ACCOUNTS] is the primary network security
boundary. Each organization's account is a hermetically sealed messaging
namespace:

1. Subjects within an account are INVISIBLE to all other accounts by default.
2. Cross-account communication REQUIRES explicit export/import configuration
   (see `rfc-section-tenant-isolation.md` Section TI.4).
3. Account limits enforce per-org resource quotas, preventing any single org
   from consuming disproportionate cluster resources.

This architectural choice means that even if an attacker compromises one org's
credentials, they gain ZERO visibility into other orgs' data.

### S.7.2 Platform Operator Isolation

The platform operator presents the highest-risk threat vector (S.3.4). The
architecture MUST enforce:

1. The platform operator MUST NOT have read access to org account data by
   default. Platform monitoring MUST use aggregated metrics from NATS system
   subjects (`$SYS.>`), not raw event streams.
2. Operator keys and account keys are cryptographically separate. Possessing
   the operator key allows creating/revoking accounts but does NOT grant
   message-level access within those accounts.
3. Per-org encryption at rest (S.6.3) ensures that even infrastructure-level
   access to storage does not reveal plaintext event data.
4. Platform-level access to org data MUST require an explicit, time-bounded
   grant from the org admin, logged with full audit trail.

### S.7.3 Hub-to-Hub Encryption

In multi-hub deployments (regional or global distribution):

1. Hub-to-hub route connections MUST use TLS 1.3.
2. Route authentication MUST use operator-level NKeys, not account-level keys.
3. NATS gateway connections between superclusters MUST use mTLS with
   certificates signed by the platform CA.

### S.7.4 Leaf Node Connection Security

Edge devices connecting as NATS leaf nodes [NATS-LEAFNODE]:

1. Leaf node connections MUST use TLS 1.3.
2. Leaf node credentials MUST be scoped to the org's account.
3. Leaf node subject mappings MUST NOT expose hub-level system subjects
   to the edge device.
4. The leaf node's JetStream domain MUST be isolated to the org's namespace
   (see `rfc-section-tenant-isolation.md` Section TI.6).

### S.7.5 Rate Limiting and DDoS Protection

To prevent network abuse and ensure fair resource allocation:

1. **Per-org rate limits** MUST be enforced at the NATS account level:
   - `max_data`: Maximum bytes per second (RECOMMENDED: 10 MB/s for small
     orgs, 100 MB/s for enterprise)
   - `max_payload`: Maximum single message size (RECOMMENDED: 1 MB)
   - `max_subscriptions`: Maximum concurrent subscriptions (RECOMMENDED: 1000)
   - `max_connections`: Maximum concurrent connections (RECOMMENDED: 100)

2. **Cross-org rate limits** MUST be enforced on the `manufacturing-commons`
   system account's import configuration:
   - Maximum events per org per second on shared subjects (RECOMMENDED: 100/s)
   - Burst allowance for initial connection (RECOMMENDED: 10x sustained rate
     for 30 seconds)

3. **DDoS protection at hub ingress**:
   - Connection rate limiting per source IP (RECOMMENDED: 10 connections/s)
   - JWT validation before resource allocation (unauthenticated connections
     MUST be rejected within 5 seconds)
   - Slow-loris protection: connection timeout of 30 seconds for TLS handshake

4. Rate limit violations MUST be logged with the violating org ID, subject
   pattern, and violation type.
5. Sustained rate limit violations (>10 minutes) SHOULD trigger automated
   capacity reduction for the violating org's account until the org contacts
   support.

### S.7.6 Zero Trust Boundaries

The metropolitan network applies Zero Trust principles [ZERO-TRUST] at
organization boundaries:

| Boundary | Trust Level | Verification |
|----------|-------------|-------------|
| **Within an org (edge <-> edge)** | High -- same operator, same account | NATS account credential |
| **Within an org (edge <-> cloud)** | High -- TLS + account credential | Mutual TLS + JWT |
| **Cross-org (account <-> account)** | Zero -- untrusted | Export/import only; no direct message path |
| **Platform <-> org** | Limited -- platform operates infrastructure | Operator key != account key; data access requires explicit grant |

**Zero Trust requirements**:

1. Cross-organization messages MUST transit through the `manufacturing-commons`
   system account, never directly between org accounts.
2. The platform operator MUST NOT have read access to org account data by
   default (S.7.2).
3. All inter-node communication MUST use TLS 1.3 (S.6.1).
4. Every request MUST be authenticated and authorized regardless of network
   origin. Internal network position does NOT confer trust.

---

## S.8 Security Compliance

### S.8.1 IEC 62443 (Industrial Cybersecurity) Mapping

IEC 62443 [IEC-62443] defines security levels (SL) for industrial automation
and control systems. The TMNL platform maps to IEC 62443 as follows:

| IEC 62443 Requirement | SL-1 (Basic) | SL-2 (Standard) | SL-3 (Enhanced) | TMNL Implementation |
|-----------------------|--------------|-----------------|-----------------|---------------------|
| FR 1: Identification & Auth | Username/password | Role-based + MFA | Certificate-based mTLS | NATS JWT (all tiers) + mTLS (Tier 3-4) |
| FR 2: Use Control | Basic RBAC | Granular RBAC | Attribute-based AC | Subject-level RBAC (S.5.1) + RPC middleware (S.5.2) |
| FR 3: System Integrity | Checksum validation | Signed firmware | TPM attestation | Device attestation (S.4.3, Tier 3-4 only) |
| FR 4: Data Confidentiality | TLS for transport | TLS + encrypt at rest | Per-org encryption keys | TLS 1.3 (S.6.1) + AES-256-GCM at rest (S.6.3) |
| FR 5: Restricted Data Flow | Network segmentation | Zone-based isolation | App-level filtering | NATS account isolation (S.7.1) + subject perms (S.5.1) |
| FR 6: Timely Response | Event logging | Real-time alerting | Automated response | EventLog audit trail + rate limit auto-enforcement (S.7.5) |
| FR 7: Resource Availability | Basic redundancy | N+1 redundancy | Geographic redundancy | NATS cluster + JetStream replication |

**Target**: The platform SHOULD achieve SL-2 for all organizations and SL-3
for organizations that deploy Tier 3-4 edge devices with TPM attestation.

### S.8.2 NIST Cybersecurity Framework Alignment

| NIST CSF Function | TMNL Implementation |
|-------------------|---------------------|
| **Identify** | Asset inventory via entity registry; ISA-95 hierarchy maps all devices and sensors |
| **Protect** | NATS account isolation, TLS 1.3, RBAC, subject-scoped permissions |
| **Detect** | Rate limit violation logging, clock anomaly detection (S.8.5), trust score monitoring |
| **Respond** | Automated account capacity reduction, JWT revocation, export revocation within 60s |
| **Recover** | JetStream replication, edge-first data sovereignty, offline-capable operation |

### S.8.3 SOC 2 Type II Requirements

For organizations requiring SOC 2 Type II compliance:

1. **Access control**: Per-org RBAC with JWT-based authentication provides
   auditable access control.
2. **Audit logging**: All entity state changes, operator actions, and
   cross-org interactions are logged via EventLog.
3. **Data encryption**: TLS 1.3 in transit, AES-256-GCM at rest.
4. **Availability**: NATS cluster redundancy with JetStream replication.
5. **Change management**: Entity state changes are event-sourced with
   immutable audit trails.

### S.8.4 FDA 21 CFR Part 11 Compliance

For organizations in regulated industries (pharmaceutical, food, medical
devices) [FDA-CFR11]:

1. **Electronic signatures** (Section 11.50-11.70): State change events MUST
   carry operator identity when the change was initiated by a human operator.
   Implemented via `OperatorEvents`
   (`lib/iiot/schemas/events/regulatory/operator-events.ts`).
2. **Audit trail immutability** (Section 11.10(e)): Entity event streams in
   JetStream MUST be configured with `deny_delete: true` and
   `deny_purge: true` to prevent retroactive modification.
3. **Timestamp integrity** (Section 11.10(a)): Both `originTimestamp` and
   `networkTimestamp` MUST be preserved for all regulatory events. Neither
   MAY be modified after initial recording.
4. **Access controls** (Section 11.10(d)): Limited system access to
   authorized individuals enforced via NATS JWT RBAC (S.5.1).

### S.8.5 ISA-18.2 Alarm Records

For alarm events subject to ISA-18.2 [ISA-18.2]:

1. The complete alarm lifecycle (triggered -> acknowledged -> cleared) MUST be
   recorded as an ordered sequence.
2. Alarm sequence ordering MUST be provably correct (G-1 enforcement via
   JetStream per-subject ordering).
3. Alarm records MUST be retained for the period specified by the
   organization's regulatory requirements (configurable stream `max_age`).
4. The `AlarmState` literal type (`lib/iiot/schemas/alarms.ts`) encodes the
   full ISA-18.2 lifecycle: `unacknowledged`, `acknowledged`, `shelved`,
   `suppressed`, `cleared`, `out_of_service`.

### S.8.6 ITAR Handling for Defense Manufacturers

Organizations subject to International Traffic in Arms Regulations (ITAR):

1. ITAR-controlled data MUST NOT leave the organization's NATS account under
   any circumstances. All cross-org exports MUST be disabled for ITAR accounts.
2. The edge JetStream domain provides ITAR data residency by default -- data
   remains on the edge device within the organization's physical facility.
3. Cloud mirroring for ITAR accounts MUST target US-only cloud regions with
   ITAR-compliant hosting (FedRAMP Moderate or higher).
4. ITAR accounts SHOULD be flagged in the account JWT metadata to enable
   automated export prevention at the NATS account level.

### S.8.7 Edge Device Trust Boundaries

#### S.8.7.1 Untrusted Timestamps

Edge device clocks are untrusted for cross-org purposes (per Section X.6 of
`rfc-section-two-domain-consistency.md`). Additional protections:

1. Events with `originTimestamp` more than 24 hours in the future or past
   relative to `networkTimestamp` SHOULD be flagged as `SuspiciousTimestamp`.
2. Events with monotonically decreasing `originTimestamp` for the same entity
   SHOULD be flagged as `ClockRegression`.
3. Flagged events MUST still be delivered (G-8) but SHOULD carry a warning
   annotation for consumers.

#### S.8.7.2 Device Attestation (Future)

For enhanced security, edge devices MAY support device attestation:

1. TPM-based attestation of software integrity.
2. Signed boot measurements included in connection JWT.
3. Periodic re-attestation during long-lived connections.

This is RECOMMENDED for large facilities (Tier 3-4) but NOT REQUIRED for small
shops (Earl's $50 Tier 1 edge device will not have a TPM).

---

## S.9 Codebase Grounding

File paths are relative to `packages/tmnl/`.

### S.9.1 Authentication & Transport Layer

**File**: `src/lib/iiot/realtime/holonet-bridge.ts`

The HolonetBridge (service tag at line 88) is the NATS transport layer through
which all inter-node and edge-cloud communication flows. Outbound publishes
(lines 102-128) use `NatsPubSubService.publish()` with `Effect.ignoreLogged` for
fire-and-forget semantics. Inbound subscriptions (lines 136-182) use scoped
streams. In the multi-tenant architecture, the HolonetBridge operates within the
org's NATS account, making all its publishes and subscriptions account-scoped.
This is the enforcement point for S.4.1 (NATS JWT auth) and S.7.1 (account
isolation).

**File**: `src/lib/iiot/realtime/websocket-server.ts`

The WebSocket server at `/ws/iiot` provides the per-session delivery channel.
In the multi-tenant context, WebSocket connections are authenticated per S.4.4
and scoped to the org's NATS account. The `RpcSerialization.layerJson` ensures
browser-compatible serialization.

**File**: `src/lib/iiot/realtime/layers.ts`

The Layer composition for runner-to-runner communication. This is where SPIFFE
X.509-SVIDs (S.4.5) would be provided as the mTLS certificate source for
`@effect/cluster` inter-node communication.

### S.9.2 Authorization Enforcement Points

**File**: `src/lib/iiot/realtime/iiot-subjects.ts`

Four subject specs (lines 39, 61, 83, 105) define the `iiot.{type}.{entityId}`
pattern. These subjects form the authorization namespace that NATS JWT
permissions (S.5.1) control. Each `createSubjectSpec` produces `resolve()` for
concrete subjects and `wildcardPattern()` for subscriptions.

**File**: `src/lib/iiot/entity/EntityStack.ts`

`EntityHandlersLayer = Layer.mergeAll(...)` (lines 54-67) composes all 12 entity
handlers. Each entity handler in this stack is the boundary where:
- FDA 21 CFR Part 11 audit trail requirements (S.8.4) are enforced
- Entity-level authorization (S.5.3) verifies orgId before processing
- EventLog writes create immutable audit records

### S.9.3 Regulatory Event Schemas

**File**: `src/lib/iiot/schemas/events/regulatory/operator-events.ts`

Five FDA 21 CFR Part 11 operator audit events: `OperatorLogin`, `OperatorLogout`,
`ParameterOverride`, `ManualAcknowledgment`, `ShiftHandoff`. Each event carries
branded identifiers and an `AuthMethod` literal (`'badge' | 'password' | 'biometric'`).
These satisfy S.8.4 item 1 (electronic signatures carry operator identity).

**File**: `src/lib/iiot/schemas/events/regulatory/quality-events.ts`

Five ISO 9001 quality events: `InspectionCompleted`, `NCROpened`, `NCRClosed`,
`CAPACreated`, `CAPAResolved`. The NCR-CAPA linking creates an auditable
corrective action chain.

**File**: `src/lib/iiot/schemas/events/regulatory/batch-events.ts`

Four FDA 21 CFR Part 11 batch record events: `BatchStarted`, `ParameterRecorded`,
`BatchCompleted`, `BatchDeviation`. Each carries `electronicSignature` and
`auditTrailId` for complete batch traceability.

**File**: `src/lib/iiot/infrastructure/eventlog-layer.ts`

The EventLog layer (lines 46-50) composes the complete audit schema:
`IIoTEventLogSchema = EventLog.schema(StructuralEvents, OperationalEvents, AlarmEvents)`.
All entity handlers write through this EventLog, producing the immutable,
append-only audit trail required by S.8.4 and S.8.5.

### S.9.4 Edge Device Ingestion

**File**: `src/lib/iiot/adapters/sparkplug-adapter.ts`

The Sparkplug B protocol adapter provides the ingestion trust boundary for edge
devices. The `AliasRegistry` resolves metric name/alias mappings from device
BIRTH messages. This adapter is the first point where edge device data enters
the platform -- the enforcement point for S.8.7.1 (untrusted timestamps),
S.8.7.2 (device attestation), and S.4.3 (device identity validation).

### S.9.5 Alarm Lifecycle Security

**File**: `src/lib/iiot/schemas/alarms.ts`

The `AlarmState` literal type (lines 32-45) encodes the full ISA-18.2 alarm
lifecycle. This Schema-based definition provides compile-time safety and runtime
validation for alarm state transitions (S.8.5).

**File**: `src/lib/iiot/entity/AlarmEntity.ts`

Implements ISA-18.2 compliant alarm lifecycle management using `@effect/cluster`
Entity + `@effect/experimental` Machine. Events are recorded via EventLog,
providing the immutable audit trail required by S.8.5.

**File**: `src/lib/iiot/machines/AlarmMachine.ts`

The state machine definition (`makeAlarmMachine`) enforces valid ISA-18.2
transitions. Invalid transitions are rejected at the Machine level.

### S.9.6 Summary: Security Concept to File Mapping

| Security Concept | Implementation File | Status |
|-----------------|---------------------|--------|
| NATS JWT auth (S.4.1) | `src/lib/iiot/realtime/holonet-bridge.ts` | Implemented |
| WebSocket auth (S.4.4) | `src/lib/iiot/realtime/websocket-server.ts` | Implemented |
| SPIFFE mTLS (S.4.5) | `src/lib/iiot/realtime/layers.ts` | Integration point ready |
| Subject permissions (S.5.1) | `src/lib/iiot/realtime/iiot-subjects.ts` | Implemented |
| Entity authorization (S.5.3) | `src/lib/iiot/entity/EntityStack.ts` | Implemented |
| FDA audit trail (S.8.4) | `src/lib/iiot/schemas/events/regulatory/*.ts` | Implemented |
| EventLog immutability (S.8.4) | `src/lib/iiot/infrastructure/eventlog-layer.ts` | Implemented |
| ISA-18.2 lifecycle (S.8.5) | `src/lib/iiot/schemas/alarms.ts` | Implemented |
| Alarm audit trail (S.8.5) | `src/lib/iiot/entity/AlarmEntity.ts` | Implemented |
| Edge device trust (S.8.7) | `src/lib/iiot/adapters/sparkplug-adapter.ts` | Implemented |
| Schema redaction (S.5.4) | `src/lib/iiot/schemas/assets/*.ts` | Schema ready; export boundary not deployed |

---


---

<!-- Source: rfc-section-trust-model.md -->
## T.1 Scope

This section covers:

- Organization identity lifecycle (provisioning through deactivation)
- Trust establishment between unknown organizations
- Reputation computation from anonymized transaction data
- Signal attestation for cross-org events (G-10 implementation)
- Edge device trust boundaries (untrusted clocks, attestation)
- Data sharing categories and consent protocols
- Data classification framework (public, bilateral, private, regulatory)
- Trust degradation, suspension, and revocation procedures

This section does NOT cover:

- NATS account provisioning mechanics (see Security Architecture, S.4)
- Cryptographic algorithms and key management (see Security Architecture, S.6)
- Network-level security boundaries (see Security Architecture, S.7)
- Tenant isolation enforcement (see Tenant Isolation section)

---

## T.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

---

## T.3 Organization Identity Verification

### T.3.1 Identity Provisioning Lifecycle

Every organization in the manufacturing commons MUST pass through a defined
identity lifecycle:

```
UNVERIFIED → PROVISIONED → ACTIVE → [SUSPENDED] → [DEACTIVATED]
```

| State | Meaning | Capabilities |
|-------|---------|-------------|
| `UNVERIFIED` | Registration submitted, identity not yet verified | None — cannot connect |
| `PROVISIONED` | NATS account created, JWT issued, awaiting first connection | Local NATS only |
| `ACTIVE` | Connected, identity verified, participating in network | Full capabilities per tier |
| `SUSPENDED` | Temporarily restricted (trust violation, billing, dispute) | Local-only, no cross-org |
| `DEACTIVATED` | Permanently removed from network | None — JWT revoked |

### T.3.2 Verification Requirements

Organization identity verification MUST include:

1. **Legal entity verification**: The organization MUST provide a verifiable
   business identity (EIN/TIN for US entities, equivalent for international).
   Self-attestation alone is insufficient.
2. **Point of contact**: At least one verified human identity (name, email,
   phone) MUST be associated with the organization's NATS account.
3. **Capability attestation**: Declared manufacturing capabilities (CNC milling,
   welding, inspection, etc.) SHOULD be backed by at least one of:
   - Industry certification (AS9100, ISO 9001, ITAR registration)
   - Customer reference (verifiable transaction with another network org)
   - Physical inspection (for high-value capabilities like titanium machining)
4. **Edge device registration**: Each edge device MUST be associated with the
   organization and issued a unique user JWT.

### T.3.3 Tiered Verification

The verification depth SHOULD scale with the organization's stated tier:

| Tier | Verification Depth | Rationale |
|------|-------------------|-----------|
| T0 | Email + legal entity | Minimal — observer only |
| T1 | Legal entity + single capability | Entry-level participation |
| T2 | Legal entity + certifications + capability proof | Active marketplace |
| T3 | Full verification + ITAR/export control check | Enterprise integration |

### T.3.4 Identity Schema

```typescript
const OrganizationIdentity = Schema.Struct({
  orgId: Schema.String.pipe(Schema.brand('OrgId')),
  legalName: Schema.NonEmptyString,
  jurisdiction: Schema.String,
  taxId: Schema.optional(Schema.String),
  verificationLevel: Schema.Literal('basic', 'standard', 'enterprise'),
  verifiedAt: Schema.DateTimeUtc,
  verifiedBy: Schema.Literal('self-attestation', 'document-review', 'third-party-audit'),
  contacts: Schema.Array(Schema.Struct({
    name: Schema.NonEmptyString,
    email: Schema.String,
    role: Schema.Literal('admin', 'technical', 'billing'),
  })),
  certifications: Schema.Array(Schema.Struct({
    standard: Schema.String,       // 'AS9100', 'ISO 9001', 'ITAR'
    issuedBy: Schema.String,
    validUntil: Schema.DateTimeUtc,
    scope: Schema.optional(Schema.String),
  })),
})
```

---

## T.4 Trust Establishment Protocol

### T.4.1 Zero-Trust Default

All organizations start with zero trust. The network provides:

- **No implicit trust**: Being on the network confers no trust. An organization
  MUST earn trust through verifiable behavior.
- **No transitive trust**: If Org A trusts Org B, and Org B trusts Org C, Org A
  does NOT automatically trust Org C. Trust is bilateral.
- **No inherited trust**: Certifications and reputation are organization-scoped.
  A subsidiary or acquisition starts with fresh trust metrics.

### T.4.2 Trust Establishment Sequence

When two organizations interact for the first time:

```
Step 1: Discovery
  └─ Org A discovers Org B via capability search (marketplace)
  └─ Org B's public profile: capabilities, certifications, trust score

Step 2: Inquiry
  └─ Org A sends CrossOrgAuthToken to manufacturing-commons
  └─ Token type: 'capability-inquiry'
  └─ Token scope: Org B's public capability subjects only
  └─ Org B's account receives the inquiry notification

Step 3: Bilateral Channel Setup
  └─ If Org B accepts:
       Org B creates private NATS export to Org A's account
       Org A creates corresponding import
       Bilateral channel established for work order subjects
  └─ If Org B declines:
       No further communication possible
       Decline event logged (anonymized) for network analytics

Step 4: Transaction
  └─ Work order placed via bilateral channel (Z.11.3)
  └─ Both orgs retain independent event copies
  └─ manufacturing-commons receives aggregate metadata only

Step 5: Settlement
  └─ Work order completed, quality assessed
  └─ Both orgs submit anonymized transaction feedback
  └─ Reputation scores updated (T.5)
```

### T.4.3 Trust Tiers

Organizations accumulate trust through successful interactions:

| Trust Tier | Criteria | Network Privileges |
|-----------|----------|-------------------|
| `NEWCOMER` | 0-2 completed transactions | Basic marketplace visibility |
| `ESTABLISHED` | 3-9 transactions, >80% on-time | Enhanced marketplace ranking |
| `TRUSTED` | 10+ transactions, >90% quality rating | Featured in capability search |
| `PREFERRED` | 50+ transactions, >95% quality, AS9100/ISO cert | Priority marketplace matching |

Trust tiers are informational. They MUST NOT gate event delivery (G-8 requires
unconditional delivery). Consumers MAY use trust tiers to weight marketplace
results and filter capability searches.

---

## T.5 Reputation-Based Trust Scoring

### T.5.1 Trust Score Computation

The platform MUST compute per-organization trust scores from anonymized
transaction data. The trust score is a composite metric:

| Factor | Weight | Measurement | Window |
|--------|--------|-------------|--------|
| **Signal consistency** | 30% | Correlation between declared capacity and actual job completions | Rolling 90 days |
| **Clock accuracy** | 20% | Moving average of |originTimestamp - networkTimestamp| | Rolling 30 days |
| **Uptime reliability** | 25% | Online hours / total hours | Rolling 30 days |
| **Peer validation** | 25% | Weighted feedback from transacting organizations | Rolling 180 days |

### T.5.2 Score Calculation

```
TrustScore(org) =
  0.30 * SignalConsistency(org, 90d) +
  0.20 * ClockAccuracy(org, 30d) +
  0.25 * UptimeReliability(org, 30d) +
  0.25 * PeerValidation(org, 180d)

Where:
  SignalConsistency = completed_jobs / declared_capacity_signals
                      (capped at 1.0, penalized below 0.5)

  ClockAccuracy = 1.0 - min(1.0, avg_drift_ms / 60000)
                  (perfect = 0ms drift, 0.0 = ≥60s systematic drift)

  UptimeReliability = online_seconds / (30 * 24 * 3600)
                      (excludes scheduled maintenance windows)

  PeerValidation = Σ(feedback_score * reviewer_weight) / Σ(reviewer_weight)
                   (reviewer_weight = reviewer's own trust score)
```

### T.5.3 Score Properties

1. **Range**: Trust scores MUST be normalized to [0.0, 1.0].
2. **Default**: New organizations start at 0.5 (neutral).
3. **Inertia**: Scores SHOULD change slowly. A single bad transaction MUST NOT
   drop a score by more than 0.05 per computation cycle.
4. **Recovery**: Suspended organizations that resume normal operation MUST be
   able to recover their trust score within 90 days of consistent good behavior.
5. **Privacy**: Trust scores are published to `manufacturing-commons` as
   `reputation.{orgId}`. The underlying factors (individual transaction
   details) MUST NOT be derivable from the published score.

### T.5.4 K-Anonymity Requirement

Reputation scores MUST NOT be published until the organization has completed at
least 10 transactions with at least 3 distinct counterparties. This prevents:

- Single-transaction manipulation (sock puppet attack)
- Counterparty identification from score changes
- Low-volume statistical inference

### T.5.5 Trust Score Service Architecture

Trust scores are computed by a singleton entity in `@effect/cluster`:

```typescript
const TrustScoreService = Entity.make("TrustScoreComputer", TrustScoreRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "network")

// Singleton: exactly one instance processes all trust computations
// Runs on the cloud tier, not on any org's edge device
```

The singleton pattern ensures:
- Atomic score computation (no split-brain score disagreements)
- Access to all anonymized transaction metadata
- No single org can influence its own score computation

### T.5.6 Trust Score Schema

```typescript
const TrustScore = Schema.Struct({
  orgId: Schema.String.pipe(Schema.brand('OrgId')),
  score: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0.0),
    Schema.lessThanOrEqualTo(1.0),
  ),
  tier: Schema.Literal('newcomer', 'established', 'trusted', 'preferred'),
  components: Schema.Struct({
    signalConsistency: Schema.Number,
    clockAccuracy: Schema.Number,
    uptimeReliability: Schema.Number,
    peerValidation: Schema.Number,
  }),
  computedAt: Schema.DateTimeUtc,
  transactionCount: Schema.Number,
  distinctCounterparties: Schema.Number,
  publishable: Schema.Boolean,  // false until k-anonymity threshold met
})

const ReputationUpdated = Schema.TaggedStruct('ReputationUpdated', {
  orgId: Schema.String.pipe(Schema.brand('OrgId')),
  previousScore: Schema.Number,
  newScore: Schema.Number,
  previousTier: Schema.Literal('newcomer', 'established', 'trusted', 'preferred'),
  newTier: Schema.Literal('newcomer', 'established', 'trusted', 'preferred'),
  timestamp: Schema.DateTimeUtc,
})
```

---

## T.6 Signal Trustworthiness & Attestation

### T.6.1 Attestation Envelope

Cross-organization events MUST include attestation metadata (G-10
implementation):

```typescript
const AttestationEnvelope = Schema.Struct({
  // Timing attestation
  originTimestamp: Schema.DateTimeUtc,
  networkTimestamp: Schema.DateTimeUtc,
  clockDrift: Schema.optional(Schema.Number), // ms, computed at hub

  // Source attestation
  orgId: Schema.String,
  entityId: Schema.String,
  sequenceNumber: Schema.Number,

  // Quality attestation
  clockQuality: Schema.optional(
    Schema.Literal('ntp-consumer', 'ntp-enterprise', 'ptp-gps', 'unknown')
  ),
  dataSource: Schema.optional(
    Schema.Literal('sensor-direct', 'manual-entry', 'derived-calculation', 'third-party')
  ),
  certifications: Schema.optional(Schema.Array(Schema.String)),
  softwareVersion: Schema.optional(Schema.String),

  // Signature
  signature: Schema.optional(Schema.String), // Ed25519 signature by org account key
})
```

### T.6.2 Attestation Requirements

1. **REQUIRED fields**: `originTimestamp`, `networkTimestamp`, `orgId`,
   `entityId`, `sequenceNumber`. Every cross-org event MUST include these.
2. **RECOMMENDED fields**: `clockQuality`, `dataSource`. These enable consumers
   to weight signals by quality.
3. **OPTIONAL fields**: `certifications`, `softwareVersion`, `signature`. These
   provide additional provenance for high-stakes transactions.
4. The `signature` field, when present, MUST be an Ed25519 signature of the
   event payload using the organization's account key. Consumers MAY verify
   signatures for high-value events.

### T.6.3 Clock Quality Assessment

Edge device clock quality is assessed continuously:

| Quality Level | Detection | Impact on Trust Score |
|---------------|-----------|----------------------|
| `ptp-gps` | Drift < 1ms from hub | clockAccuracy = 1.0 |
| `ntp-enterprise` | Drift < 100ms from hub | clockAccuracy = 0.95+ |
| `ntp-consumer` | Drift < 1s from hub | clockAccuracy = 0.85+ |
| `unknown` | Drift > 1s or inconsistent | clockAccuracy penalized |

The hub MUST compute `clockDrift` for every cross-org event by comparing
`originTimestamp` with `networkTimestamp` at hub ingestion. This measurement
feeds into the trust score's ClockAccuracy component (T.5.2).

### T.6.4 Suspicious Signal Detection

The manufacturing-commons system SHOULD detect anomalous signals:

1. **Capacity inflation**: Organization declares high capacity but completes
   few jobs. SignalConsistency component drops.
2. **Clock manipulation**: Systematic `originTimestamp` bias (always slightly
   in the future to appear more responsive). Detectable via drift trend
   analysis.
3. **Sybil attack**: Multiple organizations controlled by the same entity,
   providing mutual peer validation. Detectable via transaction graph
   analysis (same billing address, same IP ranges, correlated uptime
   patterns).
4. **Replay attack**: Old cross-org events replayed to inflate activity
   metrics. Prevented by `sequenceNumber` monotonicity check.

Detected anomalies MUST be logged. Sustained anomalies (>7 days) SHOULD
trigger trust score review and potential suspension.

---

## T.7 Edge Device Trust Boundaries

### T.7.1 Untrusted Timestamps (Intra-Org Trusted, Cross-Org Untrusted)

Edge device clocks occupy a dual trust position:

- **Within an organization**: `originTimestamp` is the authoritative event
  time. The edge device is the source of truth for its own sensor data.
  Per-entity sequential ordering (G-1) uses `originTimestamp`.
- **Across organizations**: `originTimestamp` is UNTRUSTED. Cross-org consumers
  SHOULD use `networkTimestamp` (hub-assigned) for ordering. The
  `originTimestamp` is retained for provenance but MUST NOT be used for
  cross-org temporal ordering.

### T.7.2 Timestamp Anomaly Handling

| Anomaly | Detection | Action |
|---------|-----------|--------|
| Future timestamp (>24h ahead) | `originTimestamp - networkTimestamp > 24h` | Flag `SuspiciousTimestamp`, deliver with warning |
| Past timestamp (>24h behind) | `networkTimestamp - originTimestamp > 24h` | Flag `SuspiciousTimestamp`, deliver with warning |
| Clock regression | `originTimestamp[n] < originTimestamp[n-1]` for same entity | Flag `ClockRegression`, deliver with warning |
| Systematic bias | Moving average drift > 5s over 1h window | Flag `SystematicClockBias`, reduce clockAccuracy score |

**Critical property**: Flagged events MUST still be delivered (G-8 requires
unconditional delivery). Flags are advisory for consumers and feed into trust
score computation.

### T.7.3 Device Attestation (Tier-Dependent)

Edge devices MAY support hardware attestation:

| Tier | Attestation | Mechanism |
|------|------------|-----------|
| T0 | None | Browser/mobile — no hardware trust anchor |
| T1 | Software-only | Application-level health check |
| T2 | Optional TPM | TPM 2.0 boot attestation if hardware supports |
| T3 | REQUIRED TPM | TPM 2.0 + signed boot chain + periodic re-attestation |

**T3 device attestation sequence**:
1. On boot: TPM measures software stack, produces signed attestation quote
2. Attestation quote included in NATS connection JWT as custom claim
3. Hub validates attestation quote against known-good reference values
4. Re-attestation every 24 hours (or on software update)
5. Failed attestation: device enters `SUSPENDED` state until remediated

**T1/T2 devices**: The absence of hardware attestation is explicitly acceptable.
The platform MUST NOT require TPM for participation. Earl's $50 edge device
participates without attestation — his trust score may reflect lower
clockAccuracy and reliability, but his data is still delivered.

---

## T.8 Cross-Org Data Sharing Model

### T.8.1 Four Data Categories

Data in the manufacturing commons falls into four categories with distinct
sharing rules:

| Category | Visibility | NATS Mechanism | Redaction |
|----------|-----------|----------------|-----------|
| **Public** | All orgs | Export to `manufacturing-commons` | None (self-declared) |
| **Bilateral** | Two orgs | Private export between accounts | Schema.omit sensitive fields |
| **Private** | Org only | No export | N/A |
| **Regulatory** | Org + regulator | Audit export with access control | Regulator-specific scope |

### T.8.2 Public Data: Capability Declarations

```typescript
const CapabilityDeclaration = Schema.Struct({
  orgId: Schema.String,
  capabilities: Schema.Array(Schema.Struct({
    type: Schema.Literal(
      'cnc-milling', 'cnc-turning', 'welding', 'assembly',
      'inspection', 'heat-treatment', 'surface-finishing',
      'additive-manufacturing', '3d-printing', 'casting',
    ),
    materials: Schema.Array(Schema.String),
    tolerance: Schema.optional(Schema.String),
    certifications: Schema.Array(Schema.String),
    maxPartSize: Schema.optional(Schema.String),
  })),
  capacity: Schema.Struct({
    available: Schema.Boolean,
    leadTimeDays: Schema.optional(Schema.Number),
  }),
  updatedAt: Schema.DateTimeUtc,
})
```

**Requirements**:
1. Published to `commons.capabilities.{orgId}` in the system account.
2. Fully public within the network — any org MAY subscribe.
3. MUST NOT include pricing, utilization rates, or order backlog.
4. Organizations MAY withdraw declarations at any time (empty publication).
5. Stale declarations (no update in 7 days) SHOULD be marked `potentially-stale`
   in capability search results.

### T.8.3 Private Data: Raw Telemetry

Raw sensor readings are the most sensitive operational data:

1. `iiot.readings.*` subjects MUST remain within the organization's NATS account.
2. Raw readings MUST NOT be exported to any account, including
   `manufacturing-commons`.
3. Derived metrics (OEE, utilization) MAY be shared if:
   - Organization explicitly configures the export
   - Metrics are aggregated to at minimum 15-minute windows
   - Real-time readings never cross org boundaries

### T.8.4 Bilateral Data: Work Order Details

When organizations transact:

1. Work order details are visible only to requesting org and executing org.
2. The `manufacturing-commons` account sees aggregate metadata only ("Org A
   placed order with Org B" — no contents).
3. Both parties retain independent copies in their JetStream domains.
4. Bilateral channels use private NATS exports:
   ```
   Account: earl-machine-shop
     Export: workorders.{orderId} → precision-machining-inc (private)
   Account: precision-machining-inc
     Import: earl-machine-shop:workorders.{orderId}
   ```

### T.8.5 Regulatory Data: Audit Trails

For regulated industries:

1. Audit trail data MUST be retained per regulatory requirements (FDA 21 CFR
   Part 11, ISA-18.2, ISO 9001).
2. Regulatory exports SHOULD use dedicated NATS subjects: `audit.{standard}.>`
3. Access MUST be restricted to the organization and authorized auditors.
4. Export to auditors MUST use time-bounded, scope-limited authorization
   tokens (24-hour max TTL, specific stream subjects only).

---

## T.9 Consent and Selective Disclosure

### T.9.1 Consent Protocol

All cross-org data sharing MUST be based on explicit, revocable consent:

```
┌────────────────────────────────────────────────────────────┐
│                     CONSENT PROTOCOL                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. DECLARE: Org specifies what it's willing to share      │
│     └─ Capability declarations (public)                    │
│     └─ Derived metrics (opt-in, aggregated)                │
│     └─ Reputation participation (opt-in)                   │
│                                                            │
│  2. ACCEPT: Org explicitly accepts incoming relationships  │
│     └─ Work order from Org X (bilateral, time-bounded)     │
│     └─ Capability inquiry from Org Y (read-only, scoped)   │
│                                                            │
│  3. REVOKE: Org withdraws consent at any time              │
│     └─ NATS export removed within 60 seconds               │
│     └─ Cached data at consumer side: consumer's problem    │
│     └─ Audit log records revocation event                  │
│                                                            │
│  4. AUDIT: All consent changes are logged                  │
│     └─ ConsentGranted event: who, what, when, scope        │
│     └─ ConsentRevoked event: who, what, when, reason       │
│     └─ ConsentExpired event: automatic TTL expiry          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### T.9.2 Consent Schema

```typescript
const ConsentGrant = Schema.TaggedStruct('ConsentGrant', {
  grantId: Schema.String.pipe(Schema.brand('ConsentGrantId')),
  grantorOrgId: Schema.String,     // org sharing data
  granteeOrgId: Schema.String,     // org receiving data
  scope: Schema.Struct({
    subjects: Schema.Array(Schema.String),  // NATS subject patterns
    dataCategory: Schema.Literal('public', 'bilateral', 'regulatory'),
    fields: Schema.optional(Schema.Array(Schema.String)),  // if field-level consent
  }),
  grantedAt: Schema.DateTimeUtc,
  expiresAt: Schema.optional(Schema.DateTimeUtc),
  revocable: Schema.Boolean,       // always true for bilateral
  autoRenew: Schema.Boolean,       // if true, extends on expiry
})

const ConsentRevocation = Schema.TaggedStruct('ConsentRevocation', {
  grantId: Schema.String.pipe(Schema.brand('ConsentGrantId')),
  revokedAt: Schema.DateTimeUtc,
  reason: Schema.optional(Schema.Literal(
    'manual', 'dispute', 'contract-end', 'trust-violation', 'regulatory',
  )),
  effectiveWithin: Schema.Number,  // seconds until export removed (max 60)
})
```

### T.9.3 Selective Disclosure via Schema Projection

Organizations control field-level disclosure using Effect Schema projections:

```typescript
// Internal machine status (full detail)
const MachineStatusInternal = Schema.Struct({
  machineId: Schema.String,
  state: Schema.Literal('running', 'idle', 'faulted'),
  operatorId: Schema.String,      // PRIVATE: employee identity
  currentJobId: Schema.String,    // PRIVATE: customer order
  utilization: Schema.Number,     // SHAREABLE: aggregate metric
  cycleTime: Schema.Number,       // SHAREABLE: performance metric
  faultCode: Schema.optional(Schema.String),  // BILATERAL: shared with customer
})

// Public disclosure: capability signals only
const MachineStatusPublic = MachineStatusInternal.pipe(
  Schema.pick('machineId', 'state', 'utilization', 'cycleTime'),
)

// Bilateral disclosure: includes fault info for active customer
const MachineStatusBilateral = MachineStatusInternal.pipe(
  Schema.omit('operatorId'),
)
```

The redaction boundary MUST be applied at the NATS export point (before
publishing to the manufacturing-commons account), not at the subscriber side.

---

## T.10 Data Classification Framework

### T.10.1 Classification Levels

All data within the platform MUST be classified according to the following
levels:

| Level | Label | Description | Examples |
|-------|-------|-------------|----------|
| C-0 | **PUBLIC** | Freely shareable across network | Capability declarations, org profile |
| C-1 | **NETWORK** | Visible to authenticated network members | Trust scores, aggregate metrics |
| C-2 | **BILATERAL** | Shared between two specific orgs | Work order details, quality reports |
| C-3 | **PRIVATE** | Organization internal only | Raw telemetry, employee data, costs |
| C-4 | **REGULATORY** | Subject to regulatory retention and access | FDA audit trails, ISA-18.2 records |
| C-5 | **RESTRICTED** | Export-controlled (ITAR, EAR) | Defense-related manufacturing data |

### T.10.2 Classification Enforcement

| Level | NATS Export | JetStream Retention | Access Control |
|-------|-----------|--------------------|--------------------|
| C-0 | Public export to system account | 90 days | Any authenticated org |
| C-1 | Public export to system account | 90 days | Any authenticated org |
| C-2 | Private export between accounts | Per-contract duration | Two named accounts |
| C-3 | No export | Org-defined | Org account only |
| C-4 | Audit export (time-bounded token) | Regulatory minimum (7 years) | Org + authorized auditor |
| C-5 | No export (air-gapped if required) | Regulatory minimum | Org + cleared personnel |

### T.10.3 Default Classifications

When data classification is not explicitly specified:

1. Sensor readings: C-3 (PRIVATE) by default
2. Entity state events: C-3 (PRIVATE) by default
3. Alarm events: C-4 (REGULATORY) if ISA-18.2 applies, else C-3
4. Work order events: C-2 (BILATERAL) if cross-org, else C-3
5. Capability declarations: C-0 (PUBLIC) by definition
6. Reputation scores: C-1 (NETWORK) by definition

### T.10.4 ITAR-Specific Requirements (C-5)

Organizations subject to ITAR MUST:

1. Run T3-tier infrastructure with air-gapped or government-approved cloud
   hosting (FedRAMP High or equivalent).
2. Disable all cross-org exports except to approved bilateral partners.
3. Use FIPS 140-3 validated cryptographic modules for all data at rest and in
   transit.
4. Maintain separate JetStream domains for ITAR and non-ITAR data.
5. Implement additional access logging per ITAR Part 122.

---

## T.11 Trust Degradation and Revocation

### T.11.1 Degradation Triggers

Trust scores degrade naturally through the weighted computation (T.5.2). In
addition, specific events trigger accelerated degradation:

| Event | Impact | Duration |
|-------|--------|----------|
| Failed work order delivery | -0.03 per incident | Recovers over 90 days |
| Consistent clock drift > 5s | -0.01 per computation cycle | Recovers when drift corrected |
| Extended offline (>48h) | UptimeReliability drops naturally | Recovers proportionally |
| Rate limit violation (sustained) | -0.05 immediate penalty | Recovers after 30 days clean |
| Sybil detection (confirmed) | Score set to 0.0, SUSPENDED | Requires manual review |
| Fraudulent capability declaration | Score set to 0.0, SUSPENDED | Requires manual review |

### T.11.2 Suspension Protocol

When an organization is suspended:

1. NATS account transitions to restricted mode:
   - All cross-org exports disabled
   - Intra-org subjects remain operational (local data continues)
   - manufacturing-commons imports paused
2. Active bilateral channels are frozen (no new messages, existing retained)
3. Trust score is frozen at suspension value
4. Suspension event published to `manufacturing-commons` (orgId, reason, timestamp)
5. Open work orders with suspended org enter escalation state
6. Suspension review initiated within 72 hours

### T.11.3 Revocation (Permanent Removal)

Revocation is the permanent removal of an organization from the network:

1. NATS account JWT placed on revocation list
2. All user JWTs for the account become invalid
3. JetStream data on the organization's edge devices is NOT deleted
   (organization retains its own data per sovereignty principle E-1)
4. Cloud-mirrored JetStream data is retained for regulatory period, then purged
5. Trust score removed from public reputation data
6. Marketplace listings deactivated
7. Revocation event published to manufacturing-commons

### T.11.4 Appeal Process

Suspended organizations MAY appeal through a defined process:

1. Submit appeal with evidence (within 30 days of suspension)
2. Independent review (not the same reviewer who initiated suspension)
3. Decision within 14 days of appeal submission
4. If reinstated: account restrictions lifted, trust score begins recovery
   from the suspension value (not from 0.0)

---

## T.12 Codebase Grounding

File paths are relative to `packages/tmnl/src/`.

### T.12.1 Attestation Envelope Integration Point

**File**: `lib/iiot/realtime/reactivity-bridge.ts`

The ReactivityBridge (lines 91-135) is the handler-level adapter connecting
entity state changes to EventDistribution. This is the integration point where
the `AttestationEnvelope` (T.6.1) would be attached to cross-org events. The
bridge has access to entity context (orgId, entityId, timestamps) needed for
envelope construction.

### T.12.2 Cross-Org Event Transport

**File**: `lib/iiot/realtime/holonet-bridge.ts`

The HolonetBridge (service tag at line 88) is the NATS transport layer for all
inter-node communication. Outbound publishes (lines 102-128) use
`NatsPubSubService.publish()`. In the multi-tenant architecture, the
HolonetBridge operates within the org's NATS account. The cross-org data
sharing model (T.8) is enforced by NATS account export/import configuration —
the HolonetBridge simply publishes to org-scoped subjects, and NATS handles
the cross-account routing per Z.3.3.

### T.12.3 Schema Redaction Infrastructure

**Directory**: `lib/iiot/schemas/assets/`

Nine asset schemas (area, device, enterprise, line, machine, plant, sensor,
site, workcell) each use `Schema.Struct` with branded identifiers. These are
the internal representations from which cross-org export schemas (T.9.3)
are derived via `Schema.omit` / `Schema.pick` at the export boundary.

### T.12.4 Trust Score Entity (Planned)

The TrustScoreService (T.5.5) would be implemented as a singleton entity in
`@effect/cluster`, similar to the existing entity patterns in
`lib/iiot/entity/EntityStack.ts` (lines 54-67). The entity would:
- Subscribe to anonymized transaction metadata on `manufacturing-commons`
- Compute trust scores per the formula in T.5.2
- Publish `ReputationUpdated` events to `commons.reputation.{orgId}`
- Store score history in NATS KV bucket `NETWORK_REPUTATION`

### T.12.5 Summary: Trust Concept to File Mapping

| Trust Concept | Implementation File | Status |
|---------------|---------------------|--------|
| Attestation envelope (T.6) | `lib/iiot/realtime/reactivity-bridge.ts` | Bridge ready; envelope not yet deployed |
| Cross-org transport (T.8) | `lib/iiot/realtime/holonet-bridge.ts` | Implemented |
| Schema redaction (T.9.3) | `lib/iiot/schemas/assets/*.ts` | Schema ready; projections not yet deployed |
| Subject isolation (T.8) | `lib/iiot/realtime/iiot-subjects.ts` | Implemented |
| Entity patterns (T.5.5) | `lib/iiot/entity/EntityStack.ts` | Pattern exists; TrustScoreEntity planned |
| NATS KV (T.5.5) | `lib/holonet/nats/kv.ts` | Implemented |

---

## T.13 References

### Normative

- [RFC2119] -- Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [NATS-ACCOUNTS] -- Synadia. "NATS Account-Based Security."
- [NATS-JWT] -- Synadia. "In-Depth JWT Guide for NATS."
- [EFFECT-CLUSTER] -- Effect Contributors. "@effect/cluster."

### Trust & Identity Standards

- [ZERO-TRUST] -- Rose, S., et al. "Zero Trust Architecture." NIST SP 800-207, 2020.
- [SPIFFE] -- CNCF. "Secure Production Identity Framework for Everyone (SPIFFE)."
- [IDS-SOVEREIGNTY] -- International Data Spaces Association. "Data Sovereignty in IDS."

### Regulatory

- [FDA-CFR11] -- U.S. FDA, 21 CFR Part 11. Electronic Records; Electronic Signatures.
- [ISA-18.2] -- ANSI/ISA-18.2-2016. Management of Alarm Systems.
- [IEC-62443] -- IEC 62443. Industrial Communication Networks - IT Security.
- [ITAR-PART122] -- U.S. Department of State, ITAR Part 122. Registration and Licensing.

### Companion Sections

- `rfc-section-security-architecture.md` -- Authentication, authorization, cryptography
- `rfc-section-tenant-isolation.md` -- NATS account isolation, FiberRef scoping
- `rfc-section-two-domain-consistency.md` -- G-9 (Data Sovereignty), G-10 (Signal Trust)
- `rfc-section-competitive-analysis.md` -- Industry comparison of trust models

---

*End of RFC-001 Section: Trust Model*

---

<!-- Source: rfc-section-tenant-isolation.md -->
## TI.1 Scope

This section covers:

- NATS account-based namespace isolation (the primary isolation boundary)
- JetStream domain isolation for event persistence
- @effect/cluster shard isolation for compute resources
- Data-at-rest encryption and key separation
- Controlled cross-organization data sharing model
- Audit trail isolation and immutability guarantees
- Edge device isolation and trust boundaries
- Isolation verification and chaos engineering tests
- Regulatory isolation profiles (ITAR, FDA 21 CFR Part 11, ISO 13485)

This section does NOT cover:

- Authentication mechanisms (see `rfc-section-security-architecture.md`, S.4)
- Authorization models (see `rfc-section-security-architecture.md`, S.5)
- Trust scoring (see `rfc-section-trust-model.md`)
- Network-level security (see `rfc-section-security-architecture.md`, S.7)

---

## TI.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

Requirement identifiers use the prefix **ISO-** (Isolation) to avoid confusion
with ISO standards, which are cited as [ISO-9001], [ISO-13485], etc.

---

## TI.3 Isolation Architecture Overview

### TI.3.1 Five-Layer Isolation Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    ISOLATION LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: NATS Account (Messaging Namespace)                    │
│  ├── Each org = one NATS account                                │
│  ├── Subjects fully isolated between accounts                   │
│  └── Cross-account: explicit export/import only                 │
│                                                                 │
│  Layer 2: JetStream Domain (Event Persistence)                  │
│  ├── Each edge = own JetStream domain                           │
│  ├── Cloud persistence = per-account streams                    │
│  └── Mirror between edge and cloud = same account only          │
│                                                                 │
│  Layer 3: @effect/cluster Shard (Compute)                       │
│  ├── Entity shards carry orgId                                  │
│  ├── Entity handlers verify orgId on every request              │
│  └── Cross-org entity access = forbidden by default             │
│                                                                 │
│  Layer 4: Data at Rest (Storage Encryption)                     │
│  ├── Per-org encryption keys                                    │
│  ├── JetStream encryption = per-stream                          │
│  └── Key rotation without service interruption                  │
│                                                                 │
│  Layer 5: Cross-Org Sharing (Controlled Leakage)                │
│  ├── manufacturing-commons system account                       │
│  ├── Explicit export/import configuration                       │
│  └── Schema-level redaction at export boundary                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### TI.3.2 Isolation Invariant

**ISO-01**: At no point in the event lifecycle — from edge device publication
through NATS transport, JetStream persistence, entity handler processing,
WebSocket delivery, and cross-org export — SHALL an organization's data be
accessible to another organization unless BOTH of the following conditions
are met:

1. The originating organization has configured an explicit export for the
   specific subject pattern.
2. The receiving organization (or the `manufacturing-commons` system account)
   has configured an explicit import for that subject pattern.

This is the **bilateral consent invariant**. Neither unilateral export nor
unilateral import is sufficient. Both parties must opt in.

---

## TI.4 NATS Account Isolation

### TI.4.1 One Organization, One Account

**ISO-02**: Each organization in the metropolitan manufacturing network MUST
map to exactly one dedicated NATS account [NATS-ACCOUNTS]. This is the
primary isolation boundary.

```
NATS Cluster
  ├── Account: earl-machine-shop
  │     Subject namespace: iiot.readings.*, iiot.alarms.*, iiot.equipment.*, ...
  │     ← INVISIBLE to all other accounts
  │
  ├── Account: precision-machining-inc
  │     Subject namespace: iiot.readings.*, iiot.alarms.*, iiot.equipment.*, ...
  │     ← Completely separate namespace, no collision
  │
  ├── Account: aero-dynamics-corp
  │     Subject namespace: iiot.readings.*, iiot.alarms.*, iiot.equipment.*, ...
  │     ← Fully isolated
  │
  └── Account: manufacturing-commons (system)
        Subject namespace: capabilities.*, reputation.*, marketplace.*
        ← System account for cross-org aggregation
```

**ISO-03**: The NATS server MUST enforce account isolation at the protocol
level. Application code MUST NOT be relied upon for inter-account isolation.
A bug in application code MUST NOT result in cross-account data leakage.

**ISO-04**: The `manufacturing-commons` system account is the ONLY account
that MAY receive data from multiple organizations. It MUST NOT contain raw
sensor data — only aggregated, anonymized, or explicitly exported data.

### TI.4.2 Subject Namespace Within an Account

Within an account, subjects follow the IIoT namespace pattern defined in the
codebase subject specifications:

```
iiot.readings.{deviceId}       -- sensor readings
iiot.alarms.{deviceId}         -- alarm state changes
iiot.equipment.{equipmentId}   -- equipment state transitions
iiot.invalidations.{cacheKey}  -- cache invalidation signals
```

**ISO-05**: Subject names within an account are fully isolated from other
accounts. Two organizations MAY use identical subject names without collision
or confusion. The NATS account boundary is the namespace separator.

**ISO-06**: Wildcards (`*`, `>`) in subscriptions are scoped to the account.
A subscription to `iiot.readings.>` in Account A receives ONLY Account A's
readings. The NATS server guarantees this at the protocol level.

### TI.4.3 Cross-Account Export/Import

Cross-account data sharing uses the NATS export/import mechanism:

```
Account: earl-machine-shop
  Export: capacity.available → manufacturing-commons (public export)
  Export: status.machine.* → manufacturing-commons (public export)
  ← Earl opts in to sharing capacity and machine status

Account: manufacturing-commons (system)
  Import: earl-machine-shop:capacity.available
  Import: precision-machining-inc:capacity.available
  ← Aggregates capacity from participating orgs
```

**ISO-07**: Exports MUST specify the target account. An export to `*`
(any account) is PROHIBITED except for the `manufacturing-commons` system
account.

**ISO-08**: Exports MUST NOT include raw sensor data (`iiot.readings.*`) by
default. Only aggregate, status, or capability subjects SHOULD be exportable.
An organization that explicitly configures raw reading export MUST receive a
warning that this action shares proprietary process data.

**ISO-09**: Export configuration changes MUST be logged with:

- Timestamp
- Operator identity (the account holder who made the change)
- Subject pattern being exported
- Target account
- Authorization reference (why this export was approved)

**ISO-10**: Export revocation MUST take effect within 60 seconds (one G-8
bounded staleness window per `rfc-section-two-domain-consistency.md`).

### TI.4.4 Bilateral Work Order Channels

When two organizations transact directly (work orders), a bilateral private
channel is established:

```
Account: earl-machine-shop
  Export: workorders.{orderId} → precision-machining-inc (private export)

Account: precision-machining-inc
  Import: earl-machine-shop:workorders.{orderId}
```

**ISO-11**: Bilateral exports MUST be:

1. **Scoped**: Limited to the specific work order subject, not a wildcard.
2. **Temporary**: Automatically expire when the work order reaches a terminal
   state (completed, cancelled, rejected).
3. **Bilateral**: Both parties must configure their side independently
   (export and import).
4. **Invisible to third parties**: No other account, including
   `manufacturing-commons`, can see the bilateral channel's content.

**ISO-12**: The `manufacturing-commons` account MUST NOT have access to work
order details. It receives only aggregate metadata: "Org A placed an order
with Org B." This preserves competitive confidentiality.

### TI.4.5 Account Resource Limits

NATS accounts enforce resource isolation through JWT claims:

| Resource | Purpose | Default Limit | Configurable |
|----------|---------|---------------|:------------:|
| `max_connections` | Prevent connection flooding | 100 | Yes |
| `max_payload` | Prevent oversized message attacks | 1 MB | Yes |
| `max_data` | Prevent bandwidth abuse | 10 MB/s | Yes |
| `max_subscriptions` | Prevent subscription sprawl | 10,000 | Yes |
| `max_leaf_nodes` | Limit edge device connections | 10 | Yes |
| `max_exports` | Limit cross-org exposure surface | 50 subjects | Yes |
| `max_imports` | Limit inbound cross-org data | 50 subjects | Yes |

**ISO-13**: Account resource limits MUST be enforced by the NATS server, not
by application code. A malfunctioning or compromised edge device MUST NOT be
able to exhaust cluster resources beyond its account's allocation.

---

## TI.5 JetStream Domain Isolation

### TI.5.1 Per-Edge JetStream Domains

Each edge device runs its own JetStream domain for local event persistence:

```
Earl's $50 edge device:
  JetStream Domain: earl-shop-edge-001
  Streams:
    iiot-readings  (subjects: iiot.readings.>)
    iiot-alarms    (subjects: iiot.alarms.>)
    iiot-equipment (subjects: iiot.equipment.>)
  Storage: Local filesystem (SQLite or file-backed)
  Retention: 7 days or 1 GB, whichever comes first
  ← Persists events locally during offline periods
  ← Mirrors to cloud domain on reconnection
```

**ISO-14**: JetStream domains MUST be scoped to the organization's NATS
account. An edge device in Account A MUST NOT be able to create streams in
Account B's domain.

**ISO-15**: Domain mirroring between edge and cloud MUST:

1. Use TLS-encrypted connections (per
   `rfc-section-security-architecture.md`, S.6.1).
2. Preserve per-subject ordering (G-1) regardless of reconnection timing.
3. Target ONLY the cloud streams within the same organization's account.
4. NEVER mirror to another organization's domain.

### TI.5.2 Cloud JetStream Isolation

In the cloud cluster, each organization's streams are isolated within their
NATS account:

```
Cloud NATS Cluster
  Account: earl-machine-shop
    Stream: iiot-readings (mirror of edge domain)
    Stream: iiot-alarms (mirror of edge domain)
    Stream: iiot-equipment (mirror of edge domain)
    Stream: entity-events (EventLog persistence)
    ← All streams within this account are invisible to other accounts

  Account: precision-machining-inc
    Stream: iiot-readings
    Stream: iiot-alarms
    Stream: iiot-equipment
    Stream: entity-events
    ← Completely separate streams, separate storage
```

**ISO-16**: JetStream stream names MAY be identical across accounts. The
NATS account provides the isolation — `iiot-readings` in Account A and
`iiot-readings` in Account B are entirely separate streams with separate
storage, separate consumers, and separate retention policies.

### TI.5.3 Stream Configuration Isolation

**ISO-17**: Each organization MUST be able to configure stream properties
independently:

| Property | Per-Org Configurable | Default | Regulatory Override |
|----------|:-------------------:|---------|:-------------------:|
| `max_age` | Yes | 90 days | FDA: 7 years minimum |
| `max_bytes` | Yes | 10 GB | N/A |
| `max_msgs` | Yes | 10M | N/A |
| `deny_delete` | Yes | false | FDA: MUST be true |
| `deny_purge` | Yes | false | FDA: MUST be true |
| `replicas` | Yes | 1 (edge), 3 (cloud) | ITAR: 3 minimum |
| `placement` | Yes | auto | ITAR: US-only |

**ISO-18**: Regulatory organizations (FDA, ITAR) MUST have stream properties
enforced by policy. The account provisioning service MUST apply the
organization's regulatory profile (TI.12) during stream creation. An
organization subject to FDA 21 CFR Part 11 MUST NOT be able to set
`deny_delete: false` on entity event streams.

---

## TI.6 Compute Isolation (@effect/cluster)

### TI.6.1 Entity Shard Isolation

`@effect/cluster` [EFFECT-CLUSTER] distributes entities across runner nodes
using consistent hashing. Each entity carries an `orgId` as part of its
identity.

**ISO-19**: Entity handlers MUST verify that
`request.authContext.orgId === entity.orgId` before processing any state
mutation. This check is the compute-layer isolation boundary.

**ISO-20**: The orgId verification MUST be enforced in the entity handler
layer (`EntityStack.ts`), not in individual handlers. This ensures uniform
enforcement across all 12 entity types (Alarm, WorkOrder, EquipmentState,
Enterprise, Site, Area, Plant, Line, WorkCell, MachineAsset, Device,
SensorAsset).

### TI.6.2 Shard Colocation

**ISO-21**: Entities from different organizations MAY be colocated on the
same runner node (shared infrastructure model). The isolation boundary is
the entity handler's orgId check (ISO-19), not physical node separation.

**ISO-22**: For organizations requiring physical compute isolation (ITAR
classification per TI.12.2), the shard allocator MUST support dedicated
runner node pools:

```
Runner Pool: default
  ├── Runner-1: earl-machine-shop entities, precision-machining-inc entities
  ├── Runner-2: small-shop-xyz entities, local-fabricators entities
  └── Runner-3: mixed org entities (standard isolation)

Runner Pool: itar-classified
  ├── Runner-4: aero-dynamics-corp entities ONLY
  └── Runner-5: defense-mfg-inc entities ONLY
  ← No co-tenancy with non-ITAR organizations
```

### TI.6.3 Entity Event Isolation

**ISO-23**: Entity events produced by `@effect/experimental/EventLog` MUST
be persisted in JetStream streams scoped to the entity's organization
account. An entity event from Org A MUST NOT be written to a stream
accessible by Org B.

**ISO-24**: The EventLog persistence layer MUST derive the target stream
from the entity's orgId, not from the runner node's configuration. This
ensures that entity migration (shard rebalancing) does not change the
stream where events are persisted.

### TI.6.4 Cross-Org Entity Access

**ISO-25**: Direct cross-org entity access is PROHIBITED. An RPC request
from Org A's user to read Org B's entity MUST be rejected at the entity
handler layer (ISO-19). There is no "admin" override for cross-org entity
access.

**ISO-26**: Cross-org interactions occur exclusively through the marketplace
protocol (`rfc-section-marketplace-protocol.md`), which uses NATS
export/import subjects — not direct entity access. The marketplace protocol
creates events in the `manufacturing-commons` system account, which are then
imported by the relevant organizations.

---

## TI.7 Data at Rest Isolation

### TI.7.1 Encryption Key Separation

**ISO-27**: Each organization MUST have dedicated encryption keys for data at
rest. Key material MUST NOT be shared across organizations.

```
Key Management Service
  ├── earl-machine-shop
  │     ├── stream-encryption-key (AES-256-GCM)
  │     └── kv-encryption-key (AES-256-GCM)
  │
  ├── precision-machining-inc
  │     ├── stream-encryption-key (AES-256-GCM)
  │     └── kv-encryption-key (AES-256-GCM)
  │
  └── manufacturing-commons (system)
        ├── stream-encryption-key (AES-256-GCM)
        └── kv-encryption-key (AES-256-GCM)
```

**ISO-28**: NATS JetStream's per-stream encryption SHOULD be used for cloud
persistence. The encryption key for a stream MUST be derived from the
organization's master key, not from a shared platform key.

### TI.7.2 Edge Device Data at Rest

**ISO-29**: Edge device local storage (JetStream file backend) SHOULD be
encrypted at rest. The encryption requirements scale with device capability:

| Device Tier | Encryption Requirement | Key Storage |
|------------|----------------------|-------------|
| Tier 1 ($50) | RECOMMENDED (filesystem encryption if available) | Filesystem |
| Tier 2 ($500) | REQUIRED (OS-level full-disk encryption) | Encrypted keystore |
| Tier 3 ($2K) | REQUIRED (application-level stream encryption) | TPM-backed |
| Tier 4 ($5K+) | REQUIRED (FIPS 140-2 Level 2+ encryption) | HSM |

**ISO-30**: For Tier 1 devices where encryption adds unacceptable
performance overhead, the data-at-rest isolation relies on:

1. Physical isolation (the device is on the organization's premises).
2. OS-level file permissions (0600 on JetStream data directory).
3. Automatic data expiry (stream `max_age` ensures old data is purged).

### TI.7.3 Key Rotation

**ISO-31**: Organization encryption keys MUST be rotatable without service
interruption. Key rotation uses a versioned key scheme:

1. New key version is generated and distributed to all stream replicas.
2. New writes use the new key version.
3. Old data is re-encrypted on background (RECOMMENDED: within 7 days).
4. Old key version is retired after all data has been re-encrypted.

**ISO-32**: Key rotation for one organization MUST NOT affect any other
organization's data access. This is a corollary of ISO-27 (key separation).

---

## TI.8 Cross-Organization Data Sharing

### TI.8.1 Data Classification

All data in the platform falls into one of four sharing categories:

| Category | Visibility | NATS Mechanism | Redaction Required |
|----------|------------|----------------|:------------------:|
| **Private** | Org-only | No export | N/A |
| **Public** | All orgs via commons | Public export to `manufacturing-commons` | No (self-declared) |
| **Bilateral** | Two orgs only | Private export between accounts | Yes |
| **Anonymized** | All orgs via commons | System account publish | Yes (k-anonymity) |

### TI.8.2 Private Data (Default)

**ISO-33**: All data is private by default. Raw sensor readings, entity
state, alarm history, work order details, and operator actions are private
unless explicitly exported.

The following data categories MUST remain private:

| Data Type | Subject Pattern | Exportable |
|-----------|----------------|:----------:|
| Raw sensor readings | `iiot.readings.*` | NEVER |
| Operator actions | `iiot.equipment.*.commands.>` | NEVER |
| Entity event log | `entity-events.>` | NEVER |
| Internal alarm history | `iiot.alarms.*` | NEVER (aggregate only) |

**ISO-34**: The prohibition on raw reading export (ISO-33) is absolute. Even
if an organization attempts to configure an export for `iiot.readings.>`,
the platform provisioning service MUST reject the configuration and log the
attempt.

### TI.8.3 Public Data (Opt-In)

Organizations MAY publish the following to the `manufacturing-commons`
system account:

```typescript
// Capability declaration (public, self-declared)
const CapabilityDeclaration = Schema.Struct({
  orgId: Schema.String,
  capabilities: Schema.Array(Schema.Struct({
    type: Schema.Literal(
      'cnc-milling', 'cnc-turning', 'welding', 'assembly',
      'inspection', 'surface-treatment', 'additive',
    ),
    materials: Schema.Array(Schema.String),
    tolerance: Schema.optional(Schema.String),
    certifications: Schema.Array(Schema.String),
  })),
  updatedAt: Schema.DateTimeUtc,
})
```

**ISO-35**: Public capability declarations MUST NOT include:

1. Pricing information
2. Current utilization percentages
3. Customer identity or order details
4. Any data that could reveal competitive intelligence

Public declarations are discoverable by all network participants.

### TI.8.4 Bilateral Data (Transactional)

When two organizations engage in a transaction, bilateral data sharing is
scoped to the transaction:

**ISO-36**: Bilateral sharing MUST follow this lifecycle:

1. **Initiation**: Org A creates a work order referencing Org B. The
   platform creates a bilateral subject `workorders.{orderId}` with
   private exports between the two accounts.
2. **Active**: Both orgs can publish and subscribe to the bilateral
   subject. Updates flow in both directions.
3. **Completion**: When the work order reaches a terminal state, the
   bilateral export is revoked automatically.
4. **Retention**: Both orgs retain their own copies of the bilateral
   event stream in their respective JetStream domains (per ISO-23).

### TI.8.5 Anonymized Data (Platform-Computed)

The platform publishes anonymized aggregate data:

**ISO-37**: Anonymized data MUST satisfy:

1. **k-anonymity (k=10)**: No aggregate can be computed from fewer than 10
   organizations. A "CNC utilization in Atlanta" metric requires at least
   10 CNC-capable organizations in the Atlanta region before publication.
2. **Temporal aggregation**: Minimum 15-minute windows. No real-time
   per-second anonymized data crosses org boundaries.
3. **Differential privacy** (RECOMMENDED): Add calibrated noise to
   aggregates when the contributing population is small (10-50 orgs).

### TI.8.6 Schema-Level Redaction

When data crosses organizational boundaries, the Effect Schema system
provides compile-time safe field redaction:

```typescript
// Internal schema (full detail, org-private)
const MachineStatus = Schema.Struct({
  machineId: Schema.String,
  state: Schema.Literal('running', 'idle', 'faulted'),
  operatorId: Schema.String,        // SENSITIVE: employee identity
  currentJobId: Schema.String,      // SENSITIVE: customer order info
  utilization: Schema.Number,       // Shareable (aggregate)
  cycleTime: Schema.Number,         // Shareable (aggregate)
})

// Cross-org export schema (redacted)
const MachineStatusPublic = MachineStatus.pipe(
  Schema.omit('operatorId', 'currentJobId'),
)
// Result: { machineId, state, utilization, cycleTime }
```

**ISO-38**: Cross-org event schemas MUST be defined as explicit subsets of
internal schemas using `Schema.omit` or `Schema.pick`.

**ISO-39**: Schema redaction MUST be applied at the export boundary — before
publishing to the `manufacturing-commons` account, not at the subscriber
side. The subscriber never sees the unredacted fields.

**ISO-40**: The redaction boundary MUST be auditable. Logs MUST record which
fields were redacted, for which export, at what time.

---

## TI.9 Audit Trail Isolation

### TI.9.1 Per-Org Audit Immutability

**ISO-41**: Each organization's audit trail (EventLog events in JetStream)
MUST be independently immutable. Immutability is enforced by JetStream
stream configuration:

```
Stream: entity-events (per-org)
  deny_delete: true    -- events cannot be deleted
  deny_purge: true     -- stream cannot be purged
  max_age: 7y          -- retain for regulatory minimum
  sealed: false        -- new events can be appended
```

**ISO-42**: The immutability configuration MUST be set at stream creation
and MUST NOT be modifiable by the organization's account holder after
creation. Only the platform operator (via operator key) can modify stream
security properties, and such modifications MUST be logged.

### TI.9.2 Cross-Org Audit (Bilateral Transactions)

When two organizations transact, audit trails exist in three places:

```
Work Order WO-12345:
  ├── Earl's account: entity-events stream contains
  │   WO-12345 events from Earl's perspective
  │
  ├── Precision Machining's account: entity-events stream
  │   contains WO-12345 events from PM's perspective
  │
  └── manufacturing-commons: marketplace-audit stream
      contains WO-12345 metadata (parties, dates, terminal
      state) but NOT work order details
```

**ISO-43**: Both the requesting org and the executing org MUST retain
independent copies of bilateral transaction events in their respective
JetStream domains. These copies are authoritative for each party.

**ISO-44**: The `manufacturing-commons` audit MUST contain ONLY transaction
metadata (parties involved, timestamps, terminal state). It MUST NOT
contain work order specifications, pricing, or any business-sensitive
details.

**ISO-45**: Discrepancies between the two party copies SHOULD be detectable
via hash comparison of event sequences. The platform MAY provide a
reconciliation service that compares hashes without revealing event content.

### TI.9.3 FDA 21 CFR Part 11 Audit Isolation

For organizations subject to FDA 21 CFR Part 11 [FDA-CFR11]:

**ISO-46**: Electronic signature events (`OperatorLogin`, `OperatorLogout`,
`ParameterOverride`, `ManualAcknowledgment`, `ShiftHandoff`) MUST carry
operator identity and authentication method. These events are part of the
org's private audit trail and MUST NOT be shared cross-org.

**ISO-47**: Batch record events (`BatchStarted`, `ParameterRecorded`,
`BatchCompleted`, `BatchDeviation`) MUST include an `electronicSignature`
field and an `auditTrailId` correlation identifier. The complete batch
record MUST be reconstructible from the org's entity-events stream.

### TI.9.4 ISA-18.2 Alarm Audit Isolation

For alarm events subject to ISA-18.2 [ISA-18.2]:

**ISO-48**: The complete alarm lifecycle (triggered -> acknowledged ->
cleared) MUST be recorded as an ordered sequence within the org's
account. Alarm ordering MUST be provably correct (G-1 enforcement via
JetStream per-subject ordering).

**ISO-49**: Alarm audit records MUST NOT cross org boundaries. An
organization's alarm history is proprietary operational data. The
`manufacturing-commons` account MAY receive anonymized alarm rate
metrics (e.g., "average alarms per day for CNC machines in this region")
but MUST NOT receive individual alarm events.

---

## TI.10 Edge Device Isolation

### TI.10.1 Device-Level Subject Isolation

**ISO-50**: Each edge device MUST be restricted to publishing on subjects
that include its device identifier. Device `earl-edge-001` MUST be able to
publish to `iiot.readings.earl-edge-001.>` but MUST NOT be able to publish
to `iiot.readings.earl-edge-002.>`.

This is enforced by the NATS user JWT's `pub.allow` claims (per
`rfc-section-security-architecture.md`, S.4.1.2).

### TI.10.2 Edge-to-Edge Isolation

**ISO-51**: Edge devices within the SAME organization MAY communicate via
shared subjects within the account (e.g., `iiot.readings.>` subscriptions
see all devices). This is intra-org communication and is considered trusted.

**ISO-52**: Edge devices in DIFFERENT organizations MUST NOT have any
communication path. NATS account isolation (TI.4) ensures that Device A
in Org X cannot subscribe to any subject in Org Y's namespace.

### TI.10.3 Compromised Device Containment

**ISO-53**: A compromised edge device MUST be containable:

1. **Immediate**: Revoke the device's user JWT. The NATS cluster terminates
   the connection within 60 seconds.
2. **Scope**: The compromised device can only have published to subjects
   matching its `pub.allow` claims. Damage is limited to the device's own
   subject namespace within its org's account.
3. **Forensic**: All messages published by the device are in the org's
   JetStream streams with timestamps. The audit trail is intact.
4. **Recovery**: Issue a new JWT for a replacement device. The org's NATS
   account, streams, and entity state are unaffected.

---

## TI.11 Isolation Verification

### TI.11.1 Automated Isolation Testing

**ISO-54**: The platform MUST include automated isolation verification tests
that run continuously (RECOMMENDED: hourly):

| Test | Verification | Expected Result |
|------|-------------|-----------------|
| **Cross-account subscribe** | Attempt to subscribe to Org B's subjects from Org A's credentials | Connection rejected or zero messages |
| **Cross-account publish** | Attempt to publish to Org B's subjects from Org A's credentials | Publish rejected |
| **Stream visibility** | List JetStream streams with Org A's credentials | Only Org A's streams visible |
| **Entity access** | Send RPC to Org B's entity with Org A's auth context | Request rejected at handler layer |
| **Export boundary** | Publish raw reading to exported subject | Verify redacted schema at import side |
| **Rate limit** | Exceed Org A's `max_data` | Subsequent publishes rejected, connection maintained |

### TI.11.2 Chaos Engineering for Isolation

**ISO-55**: The platform SHOULD conduct periodic chaos engineering
experiments targeting isolation boundaries:

1. **Configuration mutation**: Temporarily misconfigure an export to include
   raw readings. Verify the provisioning service rejects it (ISO-34).
2. **JWT forgery**: Present a modified JWT claiming Account B's identity.
   Verify the NATS server rejects the invalid signature.
3. **Shard migration**: Migrate entities between runner nodes during active
   traffic. Verify no cross-org data leakage during migration.
4. **Key exposure**: Simulate a leaked device NKey. Verify revocation
   contains the blast radius.

### TI.11.3 Isolation Metrics

**ISO-56**: The platform MUST track the following isolation health metrics:

| Metric | Alert Threshold | Response |
|--------|----------------|----------|
| Cross-account access attempts | > 0 per hour | Investigate immediately |
| Export configuration changes | Any change | Log and notify account holder |
| Device JWT revocations | Trend increase | Review device fleet health |
| Stream configuration mutations | Any change to deny_delete/deny_purge | Escalate to platform security |

---

## TI.12 Regulatory Isolation Profiles

### TI.12.1 Profile Definitions

**ISO-57**: The platform MUST support regulatory isolation profiles that
automatically configure isolation properties based on an organization's
regulatory requirements:

| Profile | Regulations | Additional Isolation Requirements |
|---------|-------------|----------------------------------|
| **Standard** | None specific | Default isolation (TI.4-TI.10) |
| **FDA** | 21 CFR Part 11 | `deny_delete: true`, `deny_purge: true`, 7-year retention, electronic signatures on state changes |
| **Aerospace** | AS9100, NADCAP | Enhanced audit trail, certification-verified trust floor |
| **Defense** | ITAR, EAR | Dedicated runner pool, US-only data residency, no cross-org exports without ITAR officer approval |
| **Medical** | ISO 13485, EU MDR | Traceability to individual device serial numbers, UDI integration |
| **Food** | FSMA, HACCP | Critical control point monitoring, automated deviation alerting |

### TI.12.2 ITAR Isolation (Defense)

**ISO-58**: Organizations with ITAR classification MUST receive enhanced
isolation:

1. **Dedicated NATS cluster**: ITAR organizations MUST be provisioned on
   NATS servers physically located within the United States. No gateway
   routes to international servers.
2. **Dedicated runner pool**: Entity shards for ITAR organizations MUST run
   on dedicated runner nodes (ISO-22) that do not host non-ITAR entities.
3. **Export prohibition**: Cross-org exports MUST be disabled by default.
   Each export requires explicit ITAR officer approval with a documented
   technology assessment.
4. **Audit enhancement**: All access to ITAR organization data (including
   platform operational access for maintenance) MUST be logged with
   individual operator identity.

### TI.12.3 FDA Isolation (Pharmaceutical/Medical)

**ISO-59**: Organizations with FDA 21 CFR Part 11 classification MUST
receive:

1. **Immutable streams**: `deny_delete: true` and `deny_purge: true` on all
   entity event streams (ISO-18).
2. **7-year retention**: `max_age` set to 7 years minimum on entity event
   streams.
3. **Electronic signatures**: All human-initiated state changes MUST include
   operator identity, authentication method, and timestamp
   (`OperatorEvents` schema).
4. **Batch traceability**: Batch events MUST include `auditTrailId` for
   end-to-end batch record reconstruction (ISO-47).

### TI.12.4 Profile Application

**ISO-60**: Regulatory profiles MUST be applied at account provisioning time.
The provisioning service:

1. Accepts the organization's declared regulatory requirements.
2. Validates against known certification registries (where possible).
3. Applies the corresponding profile to all account, stream, and shard
   configurations.
4. Prevents downgrade of regulatory requirements without platform
   operator approval.

---

## TI.13 Codebase Grounding

File paths are relative to `packages/tmnl/`.

### TI.13.1 NATS Account Boundary (TI.4)

**File**: `src/lib/iiot/realtime/iiot-subjects.ts`

Four subject specs (lines 39, 61, 83, 105) define the
`iiot.{type}.{entityId}` pattern. Within a NATS account, these subjects
form the namespace that account isolation protects. The `createSubjectSpec`
function produces `resolve()` for concrete subjects and
`wildcardPattern()` for subscriptions — both scoped to the calling
account's namespace.

**File**: `src/lib/iiot/realtime/holonet-bridge.ts`

The HolonetBridge (service tag at line 88) operates within an org's NATS
account. All publishes (lines 102-128) and subscriptions (lines 136-182)
are account-scoped. The bridge is the Layer 1 isolation boundary in code —
it publishes to the org's subjects, not to a global namespace.

### TI.13.2 Entity orgId Verification (TI.6)

**File**: `src/lib/iiot/entity/EntityStack.ts`

`EntityHandlersLayer = Layer.mergeAll(...)` (lines 54-67) composes all 12
entity handlers. This is the enforcement point for ISO-19 (orgId
verification on every request). The handler stack is where a cross-org
entity access attempt would be rejected.

### TI.13.3 EventLog Audit Trail (TI.9)

**File**: `src/lib/iiot/infrastructure/eventlog-layer.ts`

The EventLog layer (lines 46-50) composes:
`IIoTEventLogSchema = EventLog.schema(StructuralEvents, OperationalEvents, AlarmEvents)`.
This wires `@effect/experimental/EventLog` with the EventJournal
persistence service. All entity handlers write through this EventLog,
producing the immutable audit trail that TI.9 requires.

### TI.13.4 Regulatory Event Schemas (TI.9.3, TI.9.4)

**File**: `src/lib/iiot/schemas/events/regulatory/operator-events.ts`

Five FDA 21 CFR Part 11 operator audit events: `OperatorLogin`,
`OperatorLogout`, `ParameterOverride`, `ManualAcknowledgment`,
`ShiftHandoff`. These events carry branded identifiers and authentication
method, satisfying ISO-46.

**File**: `src/lib/iiot/schemas/events/regulatory/quality-events.ts`

Five ISO 9001 quality events: `InspectionCompleted`, `NCROpened`,
`NCRClosed`, `CAPACreated`, `CAPAResolved`. The NCR-CAPA linking pattern
creates an auditable corrective action chain.

**File**: `src/lib/iiot/schemas/events/regulatory/batch-events.ts`

Four FDA 21 CFR Part 11 batch record events: `BatchStarted`,
`ParameterRecorded`, `BatchCompleted`, `BatchDeviation`. Each carries
`electronicSignature` and `auditTrailId` fields, satisfying ISO-47.

### TI.13.5 Schema Redaction Infrastructure (TI.8.6)

**Directory**: `src/lib/iiot/schemas/assets/`

Nine asset schemas use `Schema.Struct` extensively. The `Schema.omit` and
`Schema.pick` transformations used in TI.8.6 are standard Effect Schema
operations. The schemas are the internal representations from which
cross-org export schemas are derived at the export boundary.

**File**: `src/lib/iiot/schemas/identifiers.ts`

Branded identifiers (`EnterpriseId`, `SiteId`, `AreaId`, `PlantId`,
`LineId`, `MachineId`, `SensorId`, `DeviceId` — lines 28-39) provide
type-safe entity references. In a multi-tenant context, these branded
types ensure cross-org event payloads reference entities within the
correct org namespace.

### TI.13.6 Edge Device Ingestion Boundary (TI.10)

**File**: `src/lib/iiot/adapters/sparkplug-adapter.ts`

The Sparkplug B protocol adapter is the first point where edge device data
enters the platform. The adapter receives MQTT-transported Sparkplug B
payloads via `@selfcharters/sparkplug-client`. This is the enforcement
point for TI.10.1 (device-level subject isolation) — the adapter publishes
to subjects that include the device identifier.

### TI.13.7 Event Distribution (TI.4.2 scope)

**File**: `src/lib/iiot/realtime/event-distribution.ts`

EventDistribution manages the 4-channel broadcast system (lines 169-199).
This service operates within the org's local runtime. Cross-org events
would be published from EventDistribution to the HolonetBridge, which
publishes to the org's NATS account. The `manufacturing-commons` system
account imports selected subjects per TI.4.3.

### TI.13.8 Summary: Isolation Concept to File Mapping

| Isolation Concept | Implementation File | Requirement | Status |
|------------------|---------------------|-------------|--------|
| NATS account namespace (TI.4) | `src/lib/iiot/realtime/iiot-subjects.ts` | ISO-02, ISO-05 | Implemented |
| NATS transport boundary (TI.4) | `src/lib/iiot/realtime/holonet-bridge.ts` | ISO-03, ISO-06 | Implemented |
| Entity orgId check (TI.6) | `src/lib/iiot/entity/EntityStack.ts` | ISO-19, ISO-20 | Designed |
| EventLog audit (TI.9) | `src/lib/iiot/infrastructure/eventlog-layer.ts` | ISO-41, ISO-42 | Implemented |
| Operator events (TI.9.3) | `src/lib/iiot/schemas/events/regulatory/operator-events.ts` | ISO-46 | Implemented |
| Quality events (TI.9.3) | `src/lib/iiot/schemas/events/regulatory/quality-events.ts` | ISO-48 | Implemented |
| Batch events (TI.9.3) | `src/lib/iiot/schemas/events/regulatory/batch-events.ts` | ISO-47 | Implemented |
| Schema redaction (TI.8.6) | `src/lib/iiot/schemas/assets/*.ts` | ISO-38, ISO-39 | Schema ready; omit not yet deployed |
| Branded identifiers (TI.8) | `src/lib/iiot/schemas/identifiers.ts` | ISO-38 | Implemented |
| Edge ingestion (TI.10) | `src/lib/iiot/adapters/sparkplug-adapter.ts` | ISO-50 | Implemented |
| Event distribution (TI.4) | `src/lib/iiot/realtime/event-distribution.ts` | ISO-04 | Implemented |

---

## TI.14 Open Questions

### TI.14.1 Account Provisioning at Scale

At 200,000 organizations, the NATS account provisioning system must handle:

- Bulk account creation (onboarding campaigns)
- Automated export/import configuration for marketplace opt-in
- Account deprovisioning (organization leaves the network)

The provisioning service architecture is not yet specified. It should be an
`@effect/cluster` singleton with a queue-based workflow.

### TI.14.2 Cross-Region Isolation

When the platform expands to multiple metropolitan regions, isolation must
extend across region boundaries:

- Can an organization in Atlanta export data to a system account in Chicago?
- How does JetStream domain mirroring work across regions?
- Does ITAR isolation apply per-region or per-cluster?

### TI.14.3 Encryption Key Management at Scale

With 200,000 per-org encryption keys:

- Key management service must be highly available (HSM cluster or cloud KMS).
- Key rotation across 200K organizations requires a background process with
  rate limiting to avoid overwhelming the KMS.
- Key escrow for law enforcement requests (if required by jurisdiction) needs
  careful design to avoid undermining the isolation model.

### TI.14.4 Shared Compute Cost Model

ISO-21 allows entity colocation. This implies shared compute costs. The
billing model for shared vs. dedicated runner pools needs to balance:

- Cost efficiency (shared is cheaper)
- Isolation guarantees (dedicated is stronger)
- Regulatory compliance (some orgs MUST use dedicated)

---


---

<!-- Source: rfc-section-failure-modes.md -->

## FM.1 Scope

This section classifies the failure modes that a metropolitan-scale IIoT event
distribution system MUST tolerate when serving 200K+ organizations across
federated NATS infrastructure, `@effect/cluster` entity sharding, and
heterogeneous edge devices. It specifies detection mechanisms, automatic
recovery sequences, operator escalation criteria, and chaos engineering
validation for each failure class.

This section is normative for failure detection and recovery requirements.
Implementations MAY choose alternative recovery strategies provided they meet
the Recovery SLOs defined in FM.8.4.

**Companion sections**:

- `rfc-section-consistency-guarantees.md` -- Guarantee-to-codebase mapping (Y.9
  failure sequences are expanded here)
- `rfc-section-two-domain-consistency.md` -- Normative ordering guarantees G-1
  through G-10
- `rfc-section-security-trust.md` -- Trust and tenant isolation failures

---

## FM.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119] and [RFC8174].

File paths are relative to `packages/tmnl/` and use the `src/` prefix.

Failure severities follow the incident response levels defined in RB.5 of the
companion Operational Runbooks section:

| Severity | Label    | Impact                                     |
|----------|----------|--------------------------------------------|
| **P1**   | Critical | Total event distribution failure            |
| **P2**   | High     | Single hub or cluster failure               |
| **P3**   | Medium   | Individual org or device connectivity issue  |
| **P4**   | Low      | Non-critical feature degradation            |

---

## FM.3 Failure Classification

### FM.3.1 Taxonomy

Failures are classified along two axes: **duration** (transient vs persistent)
and **trustworthiness** (honest vs Byzantine).

| Class | Duration | Trust | Examples |
|-------|----------|-------|----------|
| **Transient** | Seconds to minutes | Honest | Network blip, temporary overload, GC pause, DNS timeout |
| **Persistent** | Minutes to hours+ | Honest | Hardware failure, disk corruption, prolonged partition |
| **Byzantine** | Indeterminate | Malicious or faulty | Compromised edge device, malicious org, firmware bug producing invalid data |
| **Cascading** | Progressive | Honest | Backpressure propagation, resource exhaustion chain, thundering herd on reconnect |

### FM.3.2 Failure Domains

Each failure domain corresponds to a bounded failure zone:

```
                     ┌─────────────────────────────────────────────┐
                     │              CLOUD CLUSTER                  │
                     │  ┌─────────┐  ┌─────────┐  ┌────────────┐ │
                     │  │ NATS    │  │ @effect/ │  │ Database   │ │
                     │  │ Cluster │  │ cluster  │  │ (Postgres) │ │
                     │  │ (Raft)  │  │ Runners  │  │            │ │
                     │  └────┬────┘  └────┬─────┘  └─────┬──────┘ │
                     │       │            │              │        │
                     └───────┼────────────┼──────────────┼────────┘
                             │            │              │
              ┌──────────────┼────────────┼──────────────┘
              │              │            │
    ┌─────────┴───────┐  ┌──┴──────────┐
    │  HUB A          │  │  HUB B      │   ... (N hubs)
    │  ┌────────────┐ │  │  ┌────────┐ │
    │  │ NATS Leaf  │ │  │  │ NATS   │ │
    │  │ Node       │ │  │  │ Leaf   │ │
    │  └─────┬──────┘ │  │  └───┬────┘ │
    │        │        │  │      │      │
    │  ┌─────┴──────┐ │  │      │      │
    │  │ Edge       │ │  │      │      │
    │  │ Devices    │ │  │      │      │
    │  └────────────┘ │  │      │      │
    └─────────────────┘  └──────┘──────┘
```

| Domain | Blast Radius | Isolation Mechanism |
|--------|-------------|---------------------|
| Edge device | Single device, single org | Device scope finalizer |
| Hub NATS leaf | All orgs on that hub | NATS leaf node reconnection |
| Cloud NATS cluster | All hubs, all orgs | Raft consensus failover |
| `@effect/cluster` runner | Entities on that runner | Shard migration via HashRing [EFFECT-HASHRING] |
| Database (Postgres) | All persistent state | Connection pool + circuit breaker |
| Cross-org boundary | Multi-org operations | NATS Account isolation [NATS-ACCOUNTS] |

### FM.3.3 Failure Propagation Model

Failures propagate along dependency edges. The system MUST implement **bulkhead
isolation** [REACTIVE-MANIFESTO] to prevent cascading:

```
Edge Device Failure
  └─► Sparkplug disconnect
       └─► SparkplugAdapter detects (healthRef update)
            ├─► Local: EventDistribution continues (PubSub.unbounded)
            └─► Remote: HolonetBridge absorbs (Effect.ignoreLogged)

NATS Cluster Failure
  └─► Raft leader election timeout
       └─► Minority partition rejects writes
            ├─► Publishers buffer locally (JetStream client buffer)
            └─► Consumers pause (no new messages)
                 └─► EventDistribution outlets continue (local PubSub)

@effect/cluster Runner Crash
  └─► Shard orphaned
       └─► HashRing rebalance
            └─► New runner acquires shard lock
                 └─► Entity re-created on first message
                      └─► ReactivityBridge reconnected
```

---

## FM.4 NATS Infrastructure Failures

### FM.4.1 Hub Server Crash

**Classification**: Persistent (until restart) | P2

**Detection**:
- NATS cluster Raft heartbeat timeout (default 2s)
- `nats server report connections` shows server offline
- Client-side `StatusChangedEvent` callback fires

**Impact**:
- JetStream consumers on the crashed server lose their push subscriptions
- Messages in-flight to that server's consumers are unacknowledged
- Raft group may lose quorum if crash takes cluster below majority

**Recovery sequence**:

1. Raft elects new leader within remaining servers (< 5s typical)
2. JetStream consumers detect disconnection, reconnect to surviving servers
3. Unacknowledged messages are redelivered after `AckWait` expires
4. Consumer resumes from last acknowledged sequence number
5. `Nats-Msg-Id` dedup [NATS-DEDUP-INF] prevents duplicate processing

**Codebase grounding**:
- `src/lib/iiot/realtime/holonet-bridge.ts` lines 102-128: outbound publishes
  use `Effect.ignoreLogged` to absorb connection failures during crash
- `src/lib/iiot/adapters/sparkplug-adapter.ts` line 461: `Effect.retry(defaultRetrySchedule)`
  with exponential backoff (1s base, 10 retries max)

**G-1 impact**: Maintained -- JetStream per-subject ordering survives leader
failover. Messages may be redelivered but not reordered [JETSTREAM].

### FM.4.2 JetStream Storage Full

**Classification**: Persistent (until resolved) | P2

**Detection**:
- `nats server report jetstream` shows storage utilization > 90%
- Publish attempts receive `-ERR 'maximum bytes exceeded'`
- HolonetBridge publish failures spike in metrics

**Impact**:
- New messages cannot be stored in affected streams
- Depending on stream `discard` policy:
  - `DiscardOld`: oldest messages are evicted (data loss for old events)
  - `DiscardNew`: new publishes are rejected (data loss for new events)
- Backpressure propagates to publishers

**Recovery sequence**:

1. Alert fires on storage utilization threshold (> 85%)
2. Stream retention policy evicts expired messages automatically
3. If automatic eviction insufficient:
   a. Operator reviews stream configuration (`max_msgs`, `max_bytes`, `max_age`)
   b. Operator purges historical data beyond retention window
   c. Operator adds storage to NATS server
4. Publishers retry buffered messages once storage available

**Normative requirement**: Streams MUST configure `max_age` retention to
prevent unbounded growth. RECOMMENDED values:

| Stream | `max_age` | `max_bytes` | `discard` |
|--------|-----------|-------------|-----------|
| iiot-readings | 24h | 10 GB per hub | DiscardOld |
| iiot-alarms | 30d | 2 GB per hub | DiscardNew |
| iiot-equipment | 30d | 2 GB per hub | DiscardNew |
| iiot-invalidations | 1h | 500 MB per hub | DiscardOld |

**Rationale**: Alarm and equipment state events use `DiscardNew` because
losing historical alarm data violates [ISA-18.2] record-keeping requirements.
Reading data uses `DiscardOld` because the most recent sensor value is always
more operationally relevant than historical values for real-time display.

### FM.4.3 Cross-Hub Network Partition

**Classification**: Transient to Persistent | P2

**Detection**:
- NATS leaf node `stale connection` events
- Cross-hub subscription delivery stops
- `networkTimestamp` delta exceeds threshold (> 60s)

**Impact**:
- Partitioned hub operates autonomously (local events continue)
- Cross-hub event delivery pauses
- Cross-org consistency (G-8) temporarily violated
- Intra-org guarantees (G-1 through G-5) are maintained within each partition

**Recovery sequence**:

```
 Hub A (partitioned)              Cloud NATS              Hub B (connected)
 ────────────────────             ──────────              ─────────────────
 Local events continue            Detects stale           Normal operation
 HolonetBridge buffers            leaf conn               continues
       │                                │
       ▼                                │
 Partition heals ──────────────────────►│
       │                                │
       ▼                                ▼
 Leaf reconnects                  Buffered messages
 Resume from last ack            delivered in order
       │                                │
       ▼                                ▼
 G-1 maintained                  G-8 convergence
 (local ordering                 (cross-org events
  never broken)                   arrive, ordered
                                  by networkTimestamp)
```

1. Hub A's NATS leaf node detects disconnection
2. Local `PubSub.unbounded` in EventDistribution continues buffering events
3. HolonetBridge outbound publishes fail silently (`Effect.ignoreLogged`,
   `holonet-bridge.ts` line 107)
4. On partition heal, leaf node reconnects to cloud cluster
5. JetStream consumer resumes from last acknowledged sequence
6. Buffered events flow through, ordered by per-subject sequence numbers
7. `networkTimestamp` is assigned on cloud ingestion, providing cross-org
   ordering basis for late-arriving events

**G-6 status**: Maintained -- hub autonomy is the design intent [NATS-ADAPTIVE-EDGE].

### FM.4.4 Subject Space Exhaustion

**Classification**: Persistent | P3

**Detection**:
- NATS server `$SYS.SERVER.*.STATSZ` reports subject count near limits
- New subject creation fails with permission error
- Entity event publishing returns error for new entity IDs

**Impact**:
- New entities cannot be created (their subjects cannot be provisioned)
- Existing entities continue operating normally
- Primarily affects high-growth orgs onboarding many devices

**Recovery**:
1. Monitor subject count per NATS account (org)
2. Implement subject space quotas in NATS account JWTs [NATS-JWT]
3. Clean up subjects for decommissioned entities
4. Tier subject limits by org subscription level

---

## FM.5 @effect/cluster Failures

### FM.5.1 Runner Crash

**Classification**: Transient (auto-recovery) | P2

**Detection**:
- `RunnerStorage` heartbeat expires (configurable, default 10s)
- `HashRing` [EFFECT-HASHRING] detects runner removal
- Shard assignment table updated

**Impact**:
- All entities on the crashed runner are interrupted
- In-flight entity operations fail
- Entity state is preserved in the state service (database or in-memory)

**Recovery sequence**:

```
Runner A (crashed)          RunnerStorage           Runner B (healthy)
──────────────────          ──────────────          ──────────────────
 Entity instances
 interrupted               Heartbeat expires
       │                        │
       ▼                        ▼
 Scope finalizers          Shard lock released
 fire (cleanup)                 │
                                ▼
                           HashRing rebalance ──────► Shard lock acquired
                                                          │
                                                          ▼
                                                    First message arrives
                                                          │
                                                          ▼
                                                    Entity.build() runs
                                                    State loaded from DB
                                                    ReactivityBridge reconnects
                                                    Machine state restored
```

1. Crashed runner's `Scope` finalizers fire on surviving infrastructure
2. `RunnerStorage` detects heartbeat expiry, marks runner as dead
3. `HashRing` [EFFECT-HASHRING] recalculates shard assignments
4. Healthy runner(s) acquire orphaned shard locks via advisory locks
5. Entity instances are lazily re-created on first incoming message
6. `Entity.build()` runs: state loaded from database, Machine restored from
   persisted state, ReactivityBridge connection established
7. Forked observers (PubSub subscribers) re-created in new `Scope`

**Codebase grounding**:
- `src/lib/iiot/entity/EntityStack.ts` lines 54-67: `EntityHandlersLayer`
  composes all 12 entity types via `Layer.mergeAll`
- `src/lib/iiot/http/server.ts` line 70: request flow through
  `Sharding -> EntityManager -> Mailbox -> Entity behavior`

**G-1 status**: Maintained -- JetStream subject ordering is transport-level.
Entity recreation does not reorder events.

### FM.5.2 Shard Rebalancing During Scale Events

**Classification**: Transient | P3

**Detection**:
- Runner pool size change (scale-up or scale-down)
- `HashRing` rebalance triggered
- Entity migration events logged

**Impact**:
- Subset of entities are migrated between runners
- Brief interruption during entity `Scope` teardown and `build()` on new runner
- In-flight operations for migrating entities may fail and be retried

**Recovery sequence**:

1. New runner joins pool / existing runner drains
2. `HashRing` [EFFECT-HASHRING] recalculates consistent hash assignments
3. Affected shards: old runner receives interrupt signal
4. Entity `Scope` finalizers fire (ReactivityBridge disconnected, Machine stopped)
5. Shard lock transferred to new runner via `RunnerStorage`
6. Entities lazily re-created on next message delivery
7. Entity state intact in persistent store (no data loss)

**Normative requirement**: The system SHOULD implement **graceful drain** for
planned scale-down events. The draining runner MUST complete in-flight entity
operations before releasing shard locks.

### FM.5.3 Entity State Corruption

**Classification**: Persistent | P2

**Detection**:
- Machine state graph rejects a transition that should be valid
- State service read returns inconsistent data
- Entity handler throws `InvalidStateTransition` error

**Impact**:
- Affected entity instance cannot process new events
- Other entities on the same runner are unaffected (entity isolation)

**Recovery sequence**:

1. Detect corruption via Machine graph validation
   (`src/lib/iiot/machines/AlarmMachine.ts`, `EquipmentStateMachine.ts`)
2. Interrupt corrupt entity instance
3. Rebuild entity state from event journal:
   a. Read all events for entity ID from JetStream (full replay)
   b. Apply events sequentially through Machine state graph
   c. Validate reconstructed state against integrity invariants
4. If rebuild succeeds: entity resumes normal operation
5. If rebuild fails: entity enters quarantine (stops processing, alerts operator)

**Normative requirement**: Entity handlers MUST be idempotent (G-7) to support
replay-based state reconstruction. This is enforced by Machine state graph
validation and state service upsert semantics
(`src/lib/iiot/state/StateShape.ts` line 10).

### FM.5.4 Split-Brain: Dual Shard Ownership

**Classification**: Byzantine | P1

**Detection**:
- Two runners claim the same shard ID in `RunnerStorage`
- Fencing token mismatch on entity state writes
- Concurrent state mutations detected in audit log

**Impact**:
- Conflicting writes to the same entity from two runners
- Data consistency violations (two versions of entity state)

**Recovery sequence**:

1. `RunnerStorage` advisory locks [EFFECT-CLUSTER] detect concurrent claims
2. Fencing token comparison: runner with **older** token MUST yield
3. Yielding runner interrupts its entity instances for the contested shard
4. Winning runner continues with its state
5. Reconciliation: compare event journal sequence numbers to determine
   which runner's state is authoritative
6. Advisory: emit `SplitBrainDetected` event for operator review

**Normative requirement**: `RunnerStorage` MUST use database advisory locks
(PostgreSQL `pg_advisory_lock`) with fencing tokens to prevent dual ownership.
The fencing token MUST be checked on every state write operation.

---

## FM.6 Edge Device Failures

### FM.6.1 Power Loss

**Classification**: Transient | P3

**Detection**:
- Sparkplug `NDEATH` message published by MQTT broker (Last Will and Testament)
- Device heartbeat stops (configurable timeout, default 65s -- see
  `sparkplug-adapter.ts` line 367: `keepalive: 65`)

**Impact**:
- Device stops publishing sensor readings
- Alarms for the device cannot be generated
- Other devices in the same org are unaffected

**Recovery sequence**:

1. MQTT broker publishes `NDEATH` for the disconnected edge node
2. SparkplugAdapter detects death certificate:
   - `healthRef` updated (`connected: false`) at
     `sparkplug-adapter.ts` line 416
   - State registry marks device as offline
3. Device restarts, publishes `NBIRTH` with current metric aliases
4. SparkplugAdapter alias registry updated from `NBIRTH` payload
5. Device resumes publishing `DDATA` messages
6. Buffered readings (if device has local storage) are replayed

**Sparkplug recovery flow** [SPARKPLUG-B]:

```
Device (power cycle)     MQTT Broker          SparkplugAdapter
────────────────────     ───────────          ─────────────────
 Power lost
       │
       ▼
                         LWT fires:
                         NDEATH published ──► processMessage detects
                                              NDEATH → mark offline
                                                    │
 Power restored                                     │
       │                                            │
       ▼                                            │
 NBIRTH published ──────► Delivered ───────────────► processMessage:
                                                     alias registry
                                                     rebuilt from NBIRTH
       │                                                    │
       ▼                                                    ▼
 DDATA resumes ──────────► Delivered ───────────────► IngestedReading
                                                     emitted to pipeline
```

### FM.6.2 Network Disconnection (Intermittent)

**Classification**: Transient | P3

**Detection**:
- MQTT keepalive failure (65s timeout)
- SparkplugAdapter retry schedule activates
  (`defaultRetrySchedule`: exponential backoff, 1s base, 10 retries)

**Impact**:
- Sensor readings not delivered during disconnection
- Local device may buffer readings (device-specific capability)
- EventDistribution continues for other devices

**Recovery sequence**:

1. MQTT client detects TCP connection loss
2. Automatic reconnection via `reconnectPeriod: 1000`
   (`sparkplug-adapter.ts` line 367)
3. SparkplugAdapter retry fires: `Effect.retry(defaultRetrySchedule)`
   (`sparkplug-adapter.ts` line 461)
4. On successful reconnect, MQTT subscriptions re-established
5. Device publishes `NBIRTH` (alias registry rebuilt)
6. Buffered device readings flow through pipeline

**Retry schedule** (from `sparkplug-adapter.ts` lines 383-386):
```
Attempt  Delay
1        1s
2        2s
3        4s
4        8s
5        16s
6        32s
7        64s
8        128s
9        256s
10       512s (max, ~8.5 min)
```

### FM.6.3 Storage Full on Edge Device

**Classification**: Persistent | P4

**Detection**:
- Device reports storage metrics via Sparkplug `NBIRTH`/`NDATA`
- Write failures in device-local buffer

**Impact**:
- Device cannot buffer readings during disconnection
- Historical data may be lost during the storage-full period
- Real-time readings continue flowing if network is available

**Recovery**:
1. Device-side eviction policy: RECOMMENDED oldest-data-first
2. Alert operator via `StorageCapacityWarning` event when > 80% full
3. Operator actions: increase storage, adjust retention, reduce sampling rate
4. Device resumes buffering once storage freed

### FM.6.4 Firmware Corruption

**Classification**: Persistent (until reflash) | P3

**Detection**:
- Device publishes malformed Sparkplug payloads
- `processMessage` in SparkplugAdapter fails to decode metrics
- CRC/hash mismatch on device boot self-check

**Impact**:
- Device produces invalid or garbage readings
- Pipeline drops invalid messages (Schema validation in ReadingProcessor)
- Potential false alarms if partial data passes validation

**Recovery**:
1. SparkplugAdapter drops malformed messages with logged warning
2. `IngestionError` with `code: 'PROTOCOL_ERROR'` emitted
   (`sparkplug-adapter.ts` line 480)
3. Operator receives alert on sustained protocol errors from single device
4. Device firmware rollback via watchdog timer (device-specific)
5. If watchdog fails: manual reflash via OTA or physical access

---

## FM.7 Cross-Org Failure Scenarios

### FM.7.1 Org Goes Offline During Active Work Order

**Classification**: Transient | P3

**Context**: An organization has an active work order (e.g., shared equipment
maintenance) that spans two orgs. Org A goes offline mid-workflow.

**Impact**:
- Work order entity in `@effect/cluster` continues running on cloud runner
- Org B can still read work order state via cross-org RPC
- Org A's local operators lose real-time visibility
- Work order state transitions from Org A's operators are queued (not lost)

**Recovery sequence**:

1. Work order entity detects Org A offline via heartbeat
2. Workflow Saga [MSVC-SAGA] enters **compensation-pending** state
   (`src/lib/iiot/workflow/AlarmLifecycleWorkflow.ts` line 18:
   `Activity.make() wraps entity calls with retry semantics`)
3. Pending transitions buffered in JetStream (Org A's account)
4. On Org A reconnection:
   a. Buffered messages delivered to work order entity
   b. Entity Machine validates transition sequence
   c. Saga resumes from last committed step

**FDA 21 CFR Part 11 compliance** [FDA-CFR11]: Work order state transitions
MUST be audit-logged regardless of org connectivity state. The cloud-side
entity handler writes to the audit trail even when the originating org is
offline.

### FM.7.2 Trust Score Manipulation Attempt

**Classification**: Byzantine | P2

**Detection**:
- Anomalous trust score change rate (> 2 sigma from historical norm)
- Cross-org attestation envelope validation failure
- Trust score audit log review flags inconsistency

**Impact**:
- Manipulated trust scores could grant unearned marketplace privileges
- Cross-org data sharing decisions based on fraudulent trust

**Recovery**:
1. Trust score computation service freezes score for flagged org
2. All cross-org exports from flagged org are suspended [NATS-ACCOUNTS]
3. Attestation envelopes from flagged org require manual verification
4. Operator investigation via audit trail
5. If confirmed: org account revoked, trust score reset to zero

**Codebase grounding**: Trust score is a singleton service in
`@effect/cluster` [EFFECT-CLUSTER]. Score freezing is an atomic operation
on the entity state.

### FM.7.3 Marketplace Listing Fraud

**Classification**: Byzantine | P3

**Detection**:
- Equipment capability claims not corroborated by telemetry
- Peer org reports discrepancy between listed and actual capabilities
- Automated capability verification via historical sensor data

**Impact**:
- Orgs may contract for capabilities that don't exist
- Manufacturing commons integrity degraded

**Recovery**:
1. Listing suspended pending verification
2. Historical telemetry audit for claimed equipment
3. If fraud confirmed: listing removed, org trust score penalty
4. Affected counterparties notified
5. Manufacturing commons governance event emitted (G-12)

### FM.7.4 Data Sovereignty Violation Attempt

**Classification**: Byzantine | P1

**Detection**:
- NATS Account export attempted to unauthorized region
- JWT token with geographic restrictions violated
- Audit log shows data flow to disallowed jurisdiction

**Impact**:
- Potential regulatory violation (GDPR, CCPA, etc.)
- Org data exposed to unauthorized parties

**Recovery**:
1. NATS Account revocation: immediate export revocation [NATS-JWT]
2. All active subscriptions from unauthorized consumers terminated
3. Incident logged with full audit trail
4. Regulatory notification procedure activated (per org's jurisdiction)
5. Post-incident: review and tighten Account JWT geographic constraints

**G-9 enforcement**: NATS Account isolation provides the first line of
defense. The system MUST validate geographic constraints at the Account
JWT level before any cross-org data sharing is permitted.

---

## FM.8 Recovery Procedures

### FM.8.1 Automatic Recovery (No Human Intervention)

These failures recover without operator involvement:

| Failure | Recovery Mechanism | Max Recovery Time |
|---------|--------------------|-------------------|
| Transient network blip | MQTT `reconnectPeriod: 1000` | < 5s |
| Single NATS server crash | Raft leader election | < 10s |
| JetStream consumer disconnect | Auto-reconnect + resume | < 30s |
| `@effect/cluster` runner crash | HashRing rebalance | < 60s |
| Edge device power cycle | Sparkplug NBIRTH rebirth | < 120s |
| Clock skew < 5s | NTP correction | < 300s |

**Implementation pattern**: All automatic recovery uses the Effect retry
combinator with bounded schedules:

```
Effect.retry(Schedule.compose(
  Schedule.exponential('1 second'),   // Exponential backoff
  Schedule.recurs(10),                // Bounded retry count
))
```

Ref: `src/lib/iiot/adapters/sparkplug-adapter.ts` lines 383-386.

### FM.8.2 Semi-Automatic Recovery (Alert + Confirm)

These failures require operator awareness but minimal intervention:

| Failure | Alert Trigger | Operator Action |
|---------|--------------|-----------------|
| JetStream storage > 85% | Metrics threshold | Confirm purge or expand storage |
| Entity state corruption | Machine graph rejection | Confirm replay from event journal |
| Trust score anomaly | Statistical deviation | Review and confirm freeze/unfreeze |
| Sustained protocol errors | Error rate threshold | Confirm device firmware update |

### FM.8.3 Manual Recovery (Operator Intervention Required)

These failures require hands-on operator work:

| Failure | Operator Procedure | Estimated Duration |
|---------|--------------------|--------------------|
| Split-brain resolution | Compare fencing tokens, select winner | 15-30 min |
| Data sovereignty violation | Revoke accounts, notify regulators | 1-4 hours |
| Full hub NATS cluster loss | Restore from JetStream snapshot | 30-60 min |
| Database corruption | Restore from backup, replay events | 1-2 hours |
| Edge firmware corruption (no OTA) | Physical device access | Site-dependent |

### FM.8.4 Recovery SLOs by Failure Class

| Failure Class | Detection SLO | Recovery SLO | Data Loss SLO |
|---------------|---------------|--------------|---------------|
| Transient | < 10s | < 60s | Zero (buffered) |
| Persistent (infrastructure) | < 60s | < 15 min | < 60s of data |
| Persistent (device) | < 120s | < 30 min | Device buffer window |
| Byzantine (single org) | < 300s | < 1 hour | Zero (audit trail) |
| Byzantine (cross-org) | < 600s | < 4 hours | Zero (revocation) |
| Cascading | < 30s (first symptom) | < 5 min (bulkhead) | Per upstream failure |

---

## FM.9 Chaos Engineering

### FM.9.1 Recommended Failure Injection Tests

The following chaos engineering tests SHOULD be run against staging
environments. They MUST NOT be run against production without explicit
authorization and a rollback plan.

#### FM.9.1.1 NATS Server Kill/Restart

**Objective**: Validate Raft failover and consumer recovery.

**Procedure**:
1. Identify the current Raft leader: `nats server report jetstream`
2. Kill the leader process (SIGKILL, not SIGTERM -- test unclean shutdown)
3. Observe: new leader elected within 5s
4. Verify: all JetStream consumers reconnect and resume
5. Verify: no message reordering (G-1 maintained)
6. Restart killed server
7. Verify: server rejoins cluster, catches up

**Success criteria**:
- Leader election < 5s
- Zero message loss for acknowledged messages
- Zero reordering on any subject
- All consumers resume within 30s

#### FM.9.1.2 Network Partition Simulation Between Hubs

**Objective**: Validate hub autonomy and eventual reconciliation.

**Procedure**:
1. Select two hubs with active cross-hub subscriptions
2. Inject network partition (iptables, tc netem, or NATS testing framework)
3. Observe: both hubs continue local event delivery
4. Generate events on both sides during partition
5. Remove partition
6. Verify: cross-hub events delivered in order (by `networkTimestamp`)
7. Verify: no duplicate events (G-7 dedup)

**Success criteria**:
- Local event delivery uninterrupted during partition
- Cross-hub events converge within 60s of partition heal
- Zero duplicates after reconciliation

#### FM.9.1.3 Entity Shard Migration Under Load

**Objective**: Validate entity state preservation during rebalancing.

**Procedure**:
1. Generate sustained load: 1000 events/sec across 100 entities
2. Add a new `@effect/cluster` runner node
3. Observe: `HashRing` rebalance migrates subset of entities
4. Verify: no events lost during migration
5. Verify: entity state consistent after migration (compare pre/post)
6. Remove the added runner
7. Verify: entities migrate back, state preserved

**Success criteria**:
- Zero event loss during migration
- Entity state bitwise identical pre/post migration
- Migration completes within 60s
- No G-1 ordering violations

#### FM.9.1.4 Edge Disconnect/Reconnect Cycles

**Objective**: Validate Sparkplug rebirth protocol and pipeline resilience.

**Procedure**:
1. Connect 50 simulated edge devices via SparkplugAdapter
2. Disconnect all devices simultaneously (thundering herd)
3. Wait for `NDEATH` certificates
4. Reconnect all devices within 5s window
5. Verify: all `NBIRTH` processed, alias registries rebuilt
6. Verify: reading pipeline resumes for all devices
7. Verify: SparkplugAdapter `healthRef` reflects correct state

**Success criteria**:
- All 50 devices reconnect within 30s
- Alias registry correctly rebuilt for each device
- No stale aliases from previous connections
- Pipeline throughput returns to baseline within 60s

#### FM.9.1.5 Database Failover

**Objective**: Validate state service resilience during Postgres failover.

**Procedure**:
1. Run sustained entity operations (create, update, read)
2. Trigger Postgres primary failover to replica
3. Observe: connection pool detects failure, reconnects
4. Verify: entity operations resume after brief pause
5. Verify: no state corruption or partial writes

**Success criteria**:
- Failover detected within 10s
- Operations resume within 30s
- Zero state corruption
- All in-flight transactions either committed or rolled back cleanly

#### FM.9.1.6 Cascading Backpressure Test

**Objective**: Validate bulkhead isolation under sustained overload.

**Procedure**:
1. Generate 10x normal reading volume on one org's devices
2. Observe: EventDistribution `maxLag` triggers for that org's channels
   (`event-distribution.ts` line 173: readings `maxLag: 10_000`)
3. Verify: other orgs' channels unaffected
4. Verify: alarm/equipment channels (lower `maxLag: 1_000`) drop excess
   readings before affecting safety-critical event streams
5. Reduce load to normal
6. Verify: all channels recover, metrics return to baseline

**Success criteria**:
- Overloaded org's readings drop as expected (maxLag behavior)
- Other orgs' latency increase < 10%
- Alarm/equipment channels maintain < 1s delivery latency
- Full recovery within 30s of load reduction

---

## FM.10 Codebase Grounding

### FM.10.1 Key Files for Failure Handling

| File | Failure Domain | Error Handling Pattern | Lines of Interest |
|------|---------------|----------------------|-------------------|
| `src/lib/iiot/realtime/event-distribution.ts` | Channel backpressure, subscriber isolation | `maxLag` per channel, broadcast outlet scoping | 169-199 (channels), 267 (metrics), 330-348 (subscribe) |
| `src/lib/iiot/adapters/sparkplug-adapter.ts` | Edge device connectivity | `Effect.retry(defaultRetrySchedule)`, `Stream.catchAll`, reconnection | 383-386 (retry schedule), 461 (retry), 471-484 (catchAll) |
| `src/lib/iiot/adapters/sparkplug-publisher.ts` | Edge publishing failures | `reconnectPeriod: 1000`, keepalive: 65 | 106 (MQTT config) |
| `src/lib/streams/constructs/ChannelService.ts` | Stream backpressure | `maximumLag`, broadcast outlet lifecycle | Channel registration, outlet allocation |
| `src/lib/iiot/entity/_helpers.ts` | Non-blocking event emission | `Effect.catchAll` absorbs failures | 28-42 (WorkOrder), 55-69 (Alarm), 82-95 (Equipment) |
| `src/lib/iiot/entity/EntityStack.ts` | Entity composition, shard management | `Layer.mergeAll` for 12 entity types | 54-67 (EntityHandlersLayer) |
| `src/lib/iiot/realtime/holonet-bridge.ts` | NATS transport, partition tolerance | `Effect.ignoreLogged` for publish failures | 102-128 (outbound) |
| `src/lib/iiot/workflow/AlarmLifecycleWorkflow.ts` | Workflow retry, compensation | `Activity.retry`, `tapError` for observability | 201-236 (error handling pipeline) |
| `src/lib/iiot/services/l1/IIoTPgClient.ts` | Database connectivity | `Effect.catchAll` for graceful degradation | 133-206 (multiple catchAll) |
| `src/lib/iiot/services/l1/TimeSeriesClient.ts` | Time-series query failures | `Effect.catchAll` per query method | 171-476 (8 catchAll handlers) |
| `src/lib/iiot/services/l1/GraphClient.ts` | Graph query failures | `Effect.catchAll` for topology queries | 178, 553 |
| `src/lib/iiot/errors/alarm.ts` | Domain error taxonomy | Tagged error types for `Effect.catchTags` | 94 (exhaustive handling) |
| `src/lib/iiot/errors/work-order.ts` | Domain error taxonomy | Tagged error types for `Effect.catchTags` | 87 (exhaustive handling) |
| `src/lib/iiot/errors/equipment-state.ts` | Domain error taxonomy | Tagged error types for `Effect.catchTags` | 147 (exhaustive handling) |
| `src/lib/iiot/adapters/ingestion.ts` | Ingestion error classification | `retryable` boolean in IngestionError schema | 70 |

### FM.10.2 Error Handling Patterns in the Codebase

The codebase uses three primary error handling patterns:

**Pattern 1: Non-Blocking Emission** (`_helpers.ts`)
```
Effect.catchAll((err) =>
  Effect.logWarning(`Event emission failed (non-blocking): ${String(err)}`)
)
```
Used by: entity event emission helpers. Failures never propagate to parent
operation. Ensures G-7 idempotency -- a failed emission does not cause
redelivery of the parent command.

**Pattern 2: Retry with Exponential Backoff** (`sparkplug-adapter.ts`)
```
Effect.retry(Schedule.compose(
  Schedule.exponential('1 second'),
  Schedule.recurs(10),
))
```
Used by: SparkplugAdapter connection and subscription. Bounded retry prevents
infinite reconnection loops. Exposed on adapter shape for testing introspection.

**Pattern 3: Stream Error Recovery** (`sparkplug-adapter.ts`)
```
Stream.catchAll((err) =>
  Stream.fail(new IngestionError({ ..., retryable: true }))
)
```
Used by: per-group Sparkplug streams after merge. Converts heterogeneous
errors into typed `IngestionError` with `retryable` classification for
upstream decision-making.

---


---

<!-- Source: rfc-section-observability-framework.md -->

## OBS.1 Scope

This section defines the NORMATIVE requirements for observing the entity lifecycle
event distribution infrastructure specified in RFC-001. The observability framework
provides three signal types:

1. **Traces** -- Distributed traces that follow an event from edge device ingestion
   through entity processing, state machine transitions, event distribution, and
   WebSocket delivery to subscribers.
2. **Metrics** -- Time-series data capturing throughput, latency, error rates, and
   capacity utilization with dimensional labels for drill-down.
3. **Logs** -- Structured, correlated log records that attach to trace context for
   post-hoc investigation.

The observability framework operates across three sovereignty domains:

- **Sovereign observability** (per-organization) -- An organization's traces and
  metrics for their own entities. MUST be observable on the local edge device even
  during cloud partition.
- **Platform observability** (aggregated) -- Anonymized metrics across all
  organizations for capacity planning and SLA verification.
- **Infrastructure observability** (internal) -- NATS cluster, @effect/cluster
  runner, and database telemetry. Not exposed to tenant organizations.

### OBS.1.1 Relationship to Other Sections

| Section | Relationship |
|---------|-------------|
| Monitoring Infrastructure | Complementary -- monitoring detects, observability explains |
| Consistency Guarantees | Observability verifies G-1 through G-8 compliance |
| Effect-TS Implementation Architecture | Effect.withSpan, Metric.*, Tracer.* form the native substrate |
| Security, Trust & Tenant Isolation | Trace context MUST NOT leak across org boundaries |
| Edge-First Architecture | Edge devices run local OTLP collectors |

---

## OBS.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in [RFC2119] and [RFC8174].

### OBS.2.1 Terminology

| Term | Definition |
|------|-----------|
| **Span** | A unit of work within a distributed trace, with start time, end time, status, and attributes |
| **Trace** | A directed acyclic graph of spans representing a complete operation across services |
| **Trace context** | The W3C Trace Context headers (traceparent, tracestate) propagated across process boundaries |
| **OTLP** | OpenTelemetry Protocol -- the wire format for exporting traces, metrics, and logs |
| **Collector** | An OpenTelemetry Collector instance that receives, processes, and exports telemetry |
| **Sampling** | The decision to record or drop a trace, made at the head (creation) or tail (completion) |
| **Exemplar** | A trace ID attached to a metric data point, linking metrics to traces |
| **Cardinality** | The number of unique label combinations for a metric; high cardinality degrades storage and query performance |

---

## OBS.3 OpenTelemetry Integration Architecture

### OBS.3.1 Signal Pipeline

The platform MUST use OpenTelemetry [OTEL] as the observability wire format.
Effect-TS provides native integration via `@effect/opentelemetry` [EFFECT-TS].

```
Edge Device                    Cloud Cluster                  Backends
+-----------------+           +-------------------+           +------------------+
| Effect Runtime  |           | Effect Runtime    |           | Trace Storage    |
| + @effect/otel  |           | + @effect/otel    |           | (Jaeger/Tempo)   |
|                 |           |                   |           |                  |
| Effect.withSpan |    OTLP   | Effect.withSpan   |    OTLP   | Metric Storage   |
| Metric.*        |---------->| Metric.*          |---------->| (Prometheus/     |
| Tracer.*        |  (gRPC/   | Tracer.*          |  (gRPC)   |  Mimir/VictoriaM)|
|                 |   HTTP)   |                   |           |                  |
| Local Collector |           | Central Collector |           | Log Storage      |
| (mini-OTLP)    |           | (full OTLP)       |           | (Loki/ClickHouse)|
+-----------------+           +-------------------+           +------------------+
       |                              |
       | Buffered during              | Real-time export
       | partition (local disk)       |
```

### OBS.3.2 Effect-TS Native Integration

The codebase already uses `Effect.withSpan` extensively (137 occurrences across
28 files per `lib/instrumentation/ARCHITECTURE.md` audit). The observability
framework extends this existing pattern rather than replacing it.

**Existing patterns (VERIFIED in codebase)**:

| Pattern | File | Description |
|---------|------|-------------|
| `Effect.withSpan` | 137 occurrences in 28 files | Native span creation in Effect runtime |
| `Metric.histogram` | `lib/geoint/api/tracing.ts:63-66` | Exponential histogram with boundaries |
| `Metric.counter` | `lib/geoint/api/tracing.ts:71,76` | Request and error counters |
| `Metric.gauge` | `lib/holonet/durable-streams/metrics/tracing.ts:106-111` | Active connection gauges |
| `Metric.tagged` | `lib/geoint/api/tracing.ts:84-89` | Dimensional labeling |
| `withApiTracing` HOF | `lib/geoint/api/tracing.ts:152-181` | Higher-order tracing wrapper |
| `withDsTracing` HOF | `lib/holonet/durable-streams/metrics/tracing.ts:277-299` | Stream operation tracing |
| `ApiMetricsService` | `lib/geoint/api/metrics-export.ts:145-148` | Periodic snapshot collection |
| `snapshotToPrometheus` | `lib/geoint/api/metrics-export.ts:328-359` | Prometheus exposition format |
| `InstrumentationService` | `lib/instrumentation/v1/services/InstrumentationService.ts` | Span capture with NATS persistence |

**Extension for IIoT**: The `withApiTracing` pattern at `lib/geoint/api/tracing.ts`
MUST be extended to create `withEntityTracing` and `withPipelineTracing`
higher-order functions for IIoT entity and pipeline operations.

### OBS.3.3 @effect/opentelemetry Layer Composition

Implementations MUST provide an OpenTelemetry layer that bridges Effect's native
tracing to OTLP export:

```typescript
// Normative: OpenTelemetry bridge layer
import { NodeSdk } from '@effect/opentelemetry'

const OTelLayer = NodeSdk.layer(() => ({
  resource: {
    serviceName: 'tmnl-iiot',
    serviceVersion: version,
    'deployment.environment': environment,
    'tmnl.node.role': nodeRole,         // 'edge' | 'hub' | 'runner'
    'tmnl.org.id': orgId,              // Organization context
  },
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({ url: otlpEndpoint })
  ),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: otlpEndpoint }),
    exportIntervalMillis: 15000,        // 15s for production
  }),
}))
```

**Codebase reference**: The instrumentation architecture at
`lib/instrumentation/ARCHITECTURE.md:268-289` defines the production OTel layer
pattern with `NodeSdk.layer`, `BatchSpanProcessor`, and `OTLPTraceExporter`.

---

## OBS.4 Distributed Tracing

### OBS.4.1 Trace Scopes

Implementations MUST create traces for the following operation categories. Each
trace captures a complete unit of work from initiation to terminal state.

#### OBS.4.1.1 Entity State Transition Trace

Captures a single entity state transition from event receipt to state machine
completion and downstream propagation.

| Attribute | Type | Description |
|-----------|------|-------------|
| `tmnl.trace.type` | string | `entity.state_transition` |
| `tmnl.org.id` | string | Organization identifier |
| `tmnl.entity.type` | string | ISA-95 entity type (Site, Plant, Area, ...) |
| `tmnl.entity.id` | string | Entity identifier |
| `tmnl.state.from` | string | Previous state |
| `tmnl.state.to` | string | New state |
| `tmnl.isa95.level` | number | ISA-95 hierarchy level (0-4) |

**Span tree**:

```
entity.state_transition (root span)
+-- entity.event_received            // Event enters entity handler
|   +-- entity.schema_validation     // Schema.decodeUnknown
+-- entity.state_machine             // XState/Effect Machine transition
|   +-- entity.guard_evaluation      // State machine guard check
|   +-- entity.effect_execution      // Side effect of transition
+-- entity.event_persistence         // EventLog write (JetStream)
+-- entity.propagation               // ISA-95 hierarchy propagation
|   +-- entity.parent_notification   // Upward: child -> parent
|   +-- entity.child_notification    // Downward: parent -> children
+-- entity.event_distribution        // ChannelService + HolonetBridge
    +-- channel.local_publish        // PubSub.publish to local outlet
    +-- holonet.nats_publish         // NATS publish via HolonetBridge
```

**Codebase reference**: Entity handlers at `lib/iiot/entity/EntityStack.ts:54-67`
define the 12 entity handler layers where tracing middleware MUST be injected.
State machines at `lib/iiot/machines/` (SiteMachine.ts, PlantMachine.ts, etc.)
govern transitions. EventDistribution at
`lib/iiot/realtime/event-distribution.ts:280-326` handles dual-publish.

#### OBS.4.1.2 Ingestion Pipeline Trace

Captures the full path from Sparkplug-B message receipt to entity handler dispatch.

| Attribute | Type | Description |
|-----------|------|-------------|
| `tmnl.trace.type` | string | `pipeline.ingestion` |
| `tmnl.sparkplug.topic` | string | Full MQTT topic |
| `tmnl.sparkplug.message_type` | string | BIRTH, DATA, DEATH, STATE |
| `tmnl.sparkplug.group_id` | string | Sparkplug group identifier |
| `tmnl.sparkplug.node_id` | string | Sparkplug node identifier |

**Span tree**:

```
pipeline.ingestion (root span)
+-- sparkplug.message_received       // MQTT message arrives
+-- sparkplug.topic_parse            // TopicRouter extracts metadata
+-- sparkplug.payload_decode         // Protobuf decode
+-- reading_processor.process        // ReadingProcessor transforms
|   +-- reading_processor.validate   // Schema validation
|   +-- reading_processor.enrich     // Add entity context
+-- alarm_detector.evaluate          // AlarmDetector threshold check
|   +-- alarm_detector.trigger       // If threshold exceeded
+-- entity.dispatch                  // Route to entity handler
```

**Codebase reference**: `SparkplugPipelineLayer` at
`lib/iiot/adapters/ingestion-service.ts:297-322` composes
SparkplugAdapterLive + TopicRouter + ReadingProcessor + AlarmDetector.

#### OBS.4.1.3 WebSocket Subscription Trace

Captures a subscriber session from connection through event delivery.

| Attribute | Type | Description |
|-----------|------|-------------|
| `tmnl.trace.type` | string | `subscription.websocket` |
| `tmnl.session.id` | string | WebSocket session identifier |
| `tmnl.subscription.channel` | string | readings, alarms, equipment, invalidations |
| `tmnl.subscription.filter` | string | Entity filter expression |

**Span tree**:

```
subscription.websocket (root span, long-lived)
+-- ws.connection_established        // WebSocket upgrade
+-- ws.authentication                // JWT/NATS credential validation
+-- rpc.subscribe_request            // RPC request decoded
+-- channel.outlet_attached          // ChannelService outlet subscription
+-- event.delivery[0..N]             // Individual event deliveries
    +-- event.serialize              // Schema.encode to JSON
    +-- event.transport              // WebSocket frame send
```

**Codebase reference**: WebSocket server at `lib/iiot/realtime/websocket-server.ts`.
Streaming RPCs at `lib/iiot/rpc/RealtimeRpcs.ts` define the 4 subscription
endpoints: `Realtime.SubscribeReadings`, `Realtime.SubscribeAlarms`,
`Realtime.SubscribeEquipmentState`, `Realtime.SubscribeInvalidations`.

#### OBS.4.1.4 Cross-Organization Saga Trace

Captures a marketplace work order saga across organizational boundaries.

| Attribute | Type | Description |
|-----------|------|-------------|
| `tmnl.trace.type` | string | `saga.work_order` |
| `tmnl.saga.id` | string | Saga correlation identifier |
| `tmnl.saga.requesting_org` | string | Organization that posted the work order |
| `tmnl.saga.executing_org` | string | Organization executing the job |
| `tmnl.saga.status` | string | Current saga step |

**CRITICAL**: Cross-org traces MUST be **privacy-preserving**. The requesting
organization MUST NOT see the executing organization's internal entity traces,
and vice versa. The saga trace captures only the cross-boundary events:

```
saga.work_order (root span)
+-- saga.work_order_posted           // Requesting org posts WO
+-- saga.capability_match            // Network matches capabilities
+-- saga.bid_submitted               // Executing org submits bid
+-- saga.work_order_accepted         // Requesting org accepts bid
+-- saga.job_started                 // Executing org starts work
+-- saga.job_completed               // Executing org completes work
+-- saga.quality_verified            // Requesting org verifies quality
```

Each span in the saga trace records only the **network-level event**, not the
internal entity state transitions within either organization.

#### OBS.4.1.5 Reconciliation Trace

Captures the partition recovery and event reconciliation process when an edge
device reconnects after being offline.

| Attribute | Type | Description |
|-----------|------|-------------|
| `tmnl.trace.type` | string | `reconciliation` |
| `tmnl.org.id` | string | Organization identifier |
| `tmnl.partition.duration_s` | number | Seconds device was offline |
| `tmnl.partition.buffered_events` | number | Events buffered during partition |

**Span tree**:

```
reconciliation (root span)
+-- partition.detected               // Heartbeat timeout exceeded
+-- partition.edge_buffer_replay     // Edge replays buffered events
|   +-- replay.batch[0..N]          // Batched replay (1000 events/batch)
+-- partition.sequence_audit         // Verify no sequence gaps
+-- partition.state_convergence      // Confirm entity states match
+-- partition.advisory_cleared       // OrgStale advisory removed
```

### OBS.4.2 Trace Context Propagation

#### OBS.4.2.1 Intra-Organization Propagation

Within a single organization, trace context MUST be propagated using W3C Trace
Context headers [W3C-TRACE-CONTEXT]:

| Boundary | Propagation Method |
|----------|-------------------|
| Effect fiber to fiber | Automatic via Effect runtime (parent-child spans) |
| NATS publish/subscribe | `traceparent` header in NATS message headers |
| JetStream producer/consumer | `traceparent` header in JetStream message metadata |
| WebSocket frames | `traceparent` field in JSON payload envelope |
| HTTP requests | `traceparent` and `tracestate` HTTP headers |

**Codebase reference**: NATS connection at `lib/holonet/nats/hub.ts`. Message
headers MUST include trace context for all IIoT subject publications defined at
`lib/iiot/realtime/iiot-subjects.ts`.

#### OBS.4.2.2 Cross-Organization Propagation

Trace context MUST NOT propagate across organization boundaries without explicit
consent. When an event crosses an org boundary (via the anti-corruption layer):

1. The originating org's trace is **terminated** at the anti-corruption layer.
2. A **new trace** is created on the receiving side with a `tmnl.saga.id`
   correlation attribute linking it to the originating event.
3. The originating org's internal span IDs, trace IDs, and entity identifiers
   MUST NOT appear in the receiving org's trace.

This ensures that tracing does not become a vector for cross-tenant information
leakage [NATS-ACCOUNTS].

### OBS.4.3 Sampling Strategy

At 200K organizations producing millions of events per second, full trace
capture is economically infeasible. Implementations MUST implement a tiered
sampling strategy:

| Tier | Scope | Sample Rate | Rationale |
|------|-------|-------------|-----------|
| **Always** | G-1 through G-7 violations | 100% | Every consistency violation is traced |
| **Always** | Cross-org saga events | 100% | Economic transactions require full audit trail |
| **Always** | Reconciliation events | 100% | Partition recovery must be fully observable |
| **Always** | Error/failure spans | 100% | All errors are captured regardless of head sampling |
| **High** | Alarm events (ISA-18.2) | 50% | Regulatory traceability requires high coverage |
| **Medium** | Entity state transitions | 10% | Sufficient for latency profiling |
| **Low** | Sensor readings (telemetry) | 1% | High volume; statistical sampling suffices |
| **Tail** | Long-latency operations | 100% of P99+ | Tail-based sampling captures outliers |

**Implementation**: Head-based sampling decisions MUST be made at the trace root
(ingestion point). Tail-based sampling SHOULD be implemented at the collector
level, where the complete trace can be evaluated before export.

**Edge device consideration**: Edge devices with constrained resources (Tier 1:
1-10 machines) MAY reduce sampling rates by 50% during high-load periods. The
sampling decision MUST be recorded as a span attribute so that metric aggregations
can compensate for under-sampling.

---

## OBS.5 Consistency Guarantee Verification

The observability framework MUST provide continuous verification of the eight
formal consistency guarantees defined in the Two-Domain Consistency Model section.

### OBS.5.1 G-1: Per-Entity Sequential Ordering

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g1.violations` (Counter) |
| **Detection** | Sequence number gap detection: if `seq(N+1) - seq(N) != 1`, increment counter |
| **Trace annotation** | Every violation creates a `guarantee.g1.violation` span with the entity ID, expected sequence, and actual sequence |
| **Alert threshold** | > 0 violations per 5-minute window (any violation is critical) |
| **Verification query** | `SELECT COUNT(*) FROM spans WHERE name = 'guarantee.g1.violation' AND time > now() - 5m` |
| **Codebase ref** | Entity handlers in `lib/iiot/entity/EntityStack.ts:54-67` -- each handler layer MUST inject sequence validation middleware |

### OBS.5.2 G-2: Per-Entity Causal Ordering

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g2.violations` (Counter) |
| **Detection** | For events with `causedBy` metadata: verify that the referenced event has already been processed |
| **Trace annotation** | `guarantee.g2.violation` span with causal chain details |
| **Alert threshold** | > 0 violations per 5-minute window |
| **Note** | Causal ordering is subsumed by G-1 for single-entity events. Cross-entity causal validation requires checking the `causedBy` chain across entity handlers |

### OBS.5.3 G-3: Cross-Entity Causal Ordering (Same Org)

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g3.delay_ms` (Histogram, labels: `parent_type`, `child_type`) |
| **Detection** | Compare timestamps of causally-linked events across entities (e.g., Machine FAULT -> Line DEGRADE) |
| **Trace annotation** | `entity.propagation` span duration captures G-3 delay |
| **Alert threshold** | Delay exceeding ISA-95 level staleness budget |
| **Note** | G-3 is SHOULD, not MUST -- violations are advisory, not critical |

### OBS.5.4 G-4: Session Consistency

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g4.violations` (Counter, labels: `session_id`) |
| **Detection** | Client sends write command, then read -- if read returns stale state, increment counter |
| **Trace annotation** | `guarantee.g4.violation` span linking the write span to the stale read span |
| **Alert threshold** | > 0 per session |
| **Codebase ref** | WebSocket server (`lib/iiot/realtime/websocket-server.ts`) tracks per-session last-written sequence. Streaming RPCs (`lib/iiot/rpc/RealtimeRpcs.ts`) deliver events in sequence order. |

### OBS.5.5 G-5: Bounded Staleness (Intra-Org)

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g5.latency_ms` (Histogram, labels: `isa95_level`, `channel`) |
| **Detection** | End-to-end: `deliveryTimestamp - originTimestamp` for each event. Bucket by ISA-95 level. |
| **Trace annotation** | Every event delivery span includes `tmnl.delivery.latency_ms` attribute |
| **Exemplars** | Histogram data points MUST include exemplars linking to the trace of the slowest delivery in each bucket |

**Alert thresholds per ISA-95 level**:

| ISA-95 Level | Max Staleness | Alert if P99 exceeds |
|--------------|---------------|---------------------|
| L0 (Physical Process) | 100ms | 150ms |
| L1 (Basic Control) | 250ms | 400ms |
| L2 (Supervisory Control) | 1 second | 2 seconds |
| L3 (Manufacturing Operations) | 5 seconds | 10 seconds |
| L4 (Business Planning) | 30 seconds | 60 seconds |

**Codebase reference**: Channel definitions at
`lib/iiot/realtime/event-distribution.ts:136-157` -- `iiot:readings` (maxLag
10,000), `iiot:alarms` (maxLag 1,000), `iiot:equipment` (maxLag 1,000),
`iiot:invalidations` (maxLag 1,000). Each channel's maxLag provides the
backpressure boundary; the G-5 histogram provides the staleness boundary.

### OBS.5.6 G-6: Partition Tolerance

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g6.partition_duration_s` (Histogram) |
| **Metric** | `tmnl.guarantee.g6.replay_gap_count` (Counter) |
| **Detection** | Edge device reports `partitioned: true` in heartbeat. Duration measured from first `partitioned: true` to first `partitioned: false`. Replay gaps detected by sequence continuity audit. |
| **Trace annotation** | `reconciliation` trace (see OBS.4.1.5) captures the full partition recovery |
| **Alert thresholds** | Partition > 5 min: Warning. Partition > 24 hours: Critical. Replay gap > 0: Critical (data loss). |
| **Codebase ref** | HolonetBridge (`lib/iiot/realtime/holonet-bridge.ts`) manages the NATS connection. Partition detection triggers dual-publish fallback. |

### OBS.5.7 G-7: Idempotent Processing

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g7.dedup_count` (Counter) |
| **Metric** | `tmnl.guarantee.g7.dedup_cache_hit_rate` (Gauge) |
| **Detection** | Track content-addressed message IDs (`hash(orgId, entityType, entityId, sequenceNumber)`). Count how often a previously-seen ID is re-delivered. |
| **Trace annotation** | Deduplicated events create a `guarantee.g7.dedup` span with the original delivery trace ID |
| **Alert threshold** | Dedup rate > 1% of total volume (indicates replay storm or misconfiguration) |
| **Note** | Some dedup is expected during partition healing (G-6 reconnection). Dedup rate SHOULD normalize within 60s. |

### OBS.5.8 G-8: Cross-Organization Bounded Staleness

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g8.staleness_ms` (Histogram, labels: `signal_type`) |
| **Detection** | For events crossing org boundaries: `now() - networkTimestamp` at the receiving subscriber. Sample 1% of cross-org events. |
| **Trace annotation** | Cross-org saga spans include `tmnl.network.staleness_ms` attribute |
| **Alert thresholds** | P99 > 60 seconds: Warning. P99 > 120 seconds: Critical. |
| **CRDT convergence** | `tmnl.guarantee.g8.crdt_convergence_ms` (Histogram) -- time from org KV update to aggregate recalculation. Target: < 30s (P50). |

### OBS.5.9 Guarantee Dashboard

Implementations MUST provide a real-time dashboard displaying all eight
guarantees with the following visualization:

```
+---------------------------------------------------------------+
|  Consistency Guarantee Health                                   |
+---------------------------------------------------------------+
|                                                                 |
|  G-1  Per-Entity Sequential    [===GREEN===]  0 violations     |
|  G-2  Per-Entity Causal        [===GREEN===]  0 violations     |
|  G-3  Cross-Entity Causal      [==YELLOW===]  P99: 450ms       |
|  G-4  Session Consistency      [===GREEN===]  0 violations     |
|  G-5  Bounded Staleness        [===GREEN===]  P99: 32ms (L1)   |
|  G-6  Partition Tolerance       [===GREEN===]  0 active parts  |
|  G-7  Idempotent Processing    [===GREEN===]  0.02% dedup      |
|  G-8  Cross-Org Staleness      [===GREEN===]  P99: 8.2s        |
|                                                                 |
|  Time range: [Last 5m] [Last 1h] [Last 24h] [Custom]          |
+---------------------------------------------------------------+
```

---

## OBS.6 Metric Architecture

### OBS.6.1 Metric Naming Convention

The codebase establishes a `domain.subsystem.metric_name` convention. Existing
examples (VERIFIED):

```
geoint.api.latency_ms              -- lib/geoint/api/tracing.ts:64
geoint.api.requests                -- lib/geoint/api/tracing.ts:71
geoint.api.errors                  -- lib/geoint/api/tracing.ts:76
durable_streams.operation.latency_ms  -- lib/holonet/durable-streams/metrics/tracing.ts:69
durable_streams.operations         -- lib/holonet/durable-streams/metrics/tracing.ts:76
durable_streams.messages.published -- lib/holonet/durable-streams/metrics/tracing.ts:86
durable_streams.sse.active_connections -- lib/holonet/durable-streams/metrics/tracing.ts:106
```

IIoT metrics MUST follow this convention:

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `iiot.entity.event_delivery_latency_ms` | Histogram | `orgId`, `entityType`, `isa95Level` | End-to-end entity event delivery latency |
| `iiot.entity.events_delivered` | Counter | `orgId`, `entityType`, `channel` | Total entity events delivered |
| `iiot.entity.active_count` | Gauge | `shardGroup`, `shardId` | Active entities per shard |
| `iiot.entity.state_transitions` | Counter | `entityType`, `fromState`, `toState` | State machine transition count |
| `iiot.pipeline.readings_per_second` | Gauge | `orgId`, `deviceId` | Ingestion throughput |
| `iiot.pipeline.dead_letter_depth` | Gauge | `channel` | DLQ depth per channel |
| `iiot.pipeline.decode_errors` | Counter | `orgId`, `errorType` | Schema decode failures |
| `iiot.alarm.unacknowledged_count` | Gauge | `orgId`, `priority` | Unacked alarms per org per priority |
| `iiot.alarm.time_to_ack_ms` | Histogram | `orgId`, `priority` | Time from alarm trigger to acknowledgment |
| `iiot.edge.connected_devices` | Gauge | `hubId` | Connected device count per hub |
| `iiot.edge.last_seen_age_seconds` | Histogram | `orgId` | Device freshness distribution |
| `iiot.cluster.shard_entity_count` | Gauge | `shardGroup`, `shardId`, `runnerId` | Entities per shard |
| `iiot.cluster.shard_throughput` | Gauge | `shardGroup`, `shardId` | Messages per second per shard |
| `iiot.nats.subject_throughput` | Counter | `subject_pattern` | Per-subject message rate |
| `iiot.nats.jetstream_storage_pct` | Gauge | `cluster` | JetStream storage utilization |
| `iiot.guarantee.violations` | Counter | `guarantee` (G-1..G-8) | Guarantee violation count |
| `iiot.ws.active_connections` | Gauge | `hubId` | WebSocket subscriber count |
| `iiot.ws.delivery_latency_ms` | Histogram | `channel` | WebSocket frame delivery latency |
| `iiot.holonet.publish_latency_ms` | Histogram | `channel` | NATS publish latency |
| `iiot.holonet.publish_errors` | Counter | `channel`, `errorType` | NATS publish failures |
| `iiot.reconciliation.duration_ms` | Histogram | `orgId` | Partition recovery duration |
| `iiot.reconciliation.events_replayed` | Counter | `orgId` | Events replayed during recovery |

### OBS.6.2 Cardinality Management

At 200K organizations, naive use of `orgId` as a metric label creates 200K
time series per metric. Implementations MUST manage cardinality:

| Strategy | Application |
|----------|-------------|
| **Sovereign metrics** | Per-org metrics (`orgId` label) are stored on the org's own edge device. Cloud aggregation uses **pre-aggregated** rollups, not raw org-level series. |
| **Exemplar-based drill-down** | Instead of per-org latency histograms in the cloud, use a single histogram with exemplars linking to traces from specific orgs. |
| **Topk aggregation** | Cloud dashboards show "top 10 slowest orgs" rather than all 200K. |
| **Label allowlists** | `orgId` label is permitted ONLY on sovereign metrics (stored on edge). Platform metrics use `shard_group`, `hub_id`, and `channel` labels. |

### OBS.6.3 Metric Export Formats

Implementations MUST support two export formats:

1. **OTLP** (primary) -- Native OpenTelemetry metric export to backends
   (Prometheus, Mimir, VictoriaMetrics).
2. **Prometheus exposition** (compatibility) -- HTTP `/metrics` endpoint for
   scraping. Extends the existing `snapshotToPrometheus` pattern at
   `lib/geoint/api/metrics-export.ts:328-359`.

### OBS.6.4 Higher-Order Tracing Extension

Extending the `withApiTracing` pattern at `lib/geoint/api/tracing.ts:152-181`,
implementations MUST provide:

```typescript
// Normative: IIoT entity handler tracing (extends existing HOF pattern)
export const withEntityTracing = (
  entityType: string,
  operation: string
) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    yield* Metric.increment(
      Metric.tagged(entityEventCounter, 'entity_type', entityType)
    )
    const result = yield* effect.pipe(
      Effect.withSpan(`iiot.${entityType}.${operation}`, {
        attributes: {
          'tmnl.entity.type': entityType,
          'tmnl.operation': operation,
        },
      }),
      Effect.tapBoth({
        onSuccess: () =>
          Metric.update(
            Metric.tagged(entityLatencyHistogram, 'entity_type', entityType),
            Date.now() - startTime
          ),
        onFailure: () =>
          Metric.increment(
            Metric.tagged(entityErrorCounter, 'entity_type', entityType)
          ),
      })
    )
    return result
  })
```

Similarly, `withPipelineTracing` wraps ingestion pipeline stages:

```typescript
export const withPipelineTracing = (
  stage: string
) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.withSpan(`iiot.pipeline.${stage}`, {
      attributes: { 'tmnl.pipeline.stage': stage },
    }),
    Effect.tap(() =>
      Metric.increment(Metric.tagged(pipelineStageCounter, 'stage', stage))
    )
  )
```

---

## OBS.7 Structured Logging

### OBS.7.1 Log Correlation

Implementations MUST correlate log records with trace context. Every log entry
produced within an Effect span MUST include the active `traceId` and `spanId`:

```json
{
  "timestamp": "2026-02-09T14:30:00.123Z",
  "level": "INFO",
  "message": "Entity state transition completed",
  "traceId": "abc123def456",
  "spanId": "789ghi012",
  "attributes": {
    "tmnl.org.id": "org-earl",
    "tmnl.entity.type": "Machine",
    "tmnl.entity.id": "MCH-001",
    "tmnl.state.from": "IDLE",
    "tmnl.state.to": "RUNNING"
  }
}
```

Effect-TS `Effect.log` automatically captures the current span context when used
within an `Effect.withSpan` scope. This MUST be the primary logging mechanism.

### OBS.7.2 Log Severity Mapping

| Effect Log Level | OpenTelemetry Severity | Use Case |
|-----------------|----------------------|----------|
| `Effect.logTrace` | TRACE | Fiber scheduling, internal state |
| `Effect.logDebug` | DEBUG | Entity handler entry/exit, schema validation details |
| `Effect.log` (default) | INFO | State transitions, successful operations |
| `Effect.logWarning` | WARN | Degraded performance, threshold approach, retries |
| `Effect.logError` | ERROR | Processing failures, consistency violations |
| `Effect.logFatal` | FATAL | Unrecoverable errors, safety system failures |

### OBS.7.3 Sovereignty-Aware Log Routing

Logs MUST respect the same sovereignty boundaries as metrics and traces:

| Log Source | Destination | Retention |
|-----------|-------------|-----------|
| Entity event processing (per-org) | Organization's edge device log store | 90 days minimum; 7 years for regulatory [FDA-CFR11] |
| Platform operations | Central log aggregation (Loki/ClickHouse) | 1 year |
| Infrastructure | Central log aggregation | 30 days |
| Cross-org saga events | Both orgs (redacted) + platform audit log | 7 years |

---

## OBS.8 Edge Device Observability

### OBS.8.1 Resource-Constrained Collection

Edge devices (especially Tier 1: 1-10 machines on Raspberry Pi-class hardware)
have limited CPU, memory, and storage for observability data. Implementations
MUST adapt collection to available resources:

| Resource | Tier 1 (1-10 machines) | Tier 2 (11-100 machines) | Tier 3 (101+ machines) |
|----------|----------------------|------------------------|----------------------|
| OTLP export buffer | 1,000 spans | 10,000 spans | 100,000 spans |
| Metric retention | 1 hour | 4 hours | 24 hours |
| Log retention | 24 hours | 7 days | 30 days |
| Sampling rate adjustment | Reduce to 0.5% for telemetry | Standard 1% | Standard 1% |

### OBS.8.2 Offline Observability

During network partition, the edge device MUST:

1. **Continue local collection** -- All traces, metrics, and logs are captured to
   local storage (JetStream on the embedded NATS instance).
2. **Buffer for upload** -- OTLP export is buffered to local disk. Buffer size
   MUST NOT exceed 10% of available storage.
3. **Flush on reconnection** -- When connectivity is restored, buffered telemetry
   is uploaded to the central collector in chronological order.
4. **Local dashboard** -- An operator at the edge device MUST be able to view
   recent traces and metrics via a local HTTP endpoint, even without cloud
   connectivity.

### OBS.8.3 Edge-to-Cloud Telemetry Transport

| Transport | Use Case | Protocol |
|-----------|----------|----------|
| NATS message | Real-time metric samples | NATS publish to `tmnl.telemetry.{orgId}.>` |
| OTLP/gRPC | Trace and log export (primary) | gRPC to central collector |
| OTLP/HTTP | Trace and log export (fallback) | HTTP POST to central collector |
| Local file | Partition buffer | Protobuf-encoded OTLP batches on disk |

---

## OBS.9 Alerting Integration

### OBS.9.1 Metric-Based Alerts

The observability framework feeds into the alerting pipeline defined in the
Monitoring Infrastructure section. Alert rules are expressed as metric queries:

| Alert | Metric Query | Severity |
|-------|-------------|----------|
| G-1 violation | `rate(tmnl.guarantee.violations{guarantee="G-1"}[5m]) > 0` | CRITICAL |
| G-5 P99 breach (L1) | `histogram_quantile(0.99, tmnl.guarantee.g5.latency_ms{isa95_level="1"}) > 400` | HIGH |
| G-8 staleness | `histogram_quantile(0.99, tmnl.guarantee.g8.staleness_ms) > 60000` | WARNING |
| Pipeline DLQ growth | `rate(iiot.pipeline.dead_letter_depth[5m]) > 10` | HIGH |
| Entity error spike | `rate(iiot.entity.events_delivered{status="error"}[5m]) > 0.05 * rate(iiot.entity.events_delivered[5m])` | MEDIUM |

### OBS.9.2 Trace-Based Alerts

In addition to metric-based alerts, implementations SHOULD support trace-based
alerting for conditions that are difficult to express as metric queries:

| Condition | Detection | Severity |
|-----------|-----------|----------|
| Trace duration > 10x P50 | Tail-based sampling flags outlier traces | WARNING |
| Span error rate > 5% for specific entity type | Span-level error analysis | HIGH |
| Missing expected span in trace | Trace completeness check (expected span tree vs actual) | CRITICAL |
| Cross-org saga stalled > 1 hour | Saga trace timeout detection | HIGH |

---

## OBS.10 Codebase Implementation Reference

### OBS.10.1 Existing Observability Patterns

| Pattern | Location | Description |
|---------|----------|-------------|
| `Effect.withSpan` | 137 occurrences / 28 files | Native span creation |
| `Metric.histogram` | `lib/geoint/api/tracing.ts:63-66` | Exponential histogram |
| `Metric.counter` | `lib/geoint/api/tracing.ts:71,76` | Request/error counters |
| `Metric.gauge` | `lib/holonet/durable-streams/metrics/tracing.ts:106-111` | Connection gauges |
| `Metric.tagged` | `lib/geoint/api/tracing.ts:84-89` | Dimensional labeling |
| `withApiTracing` | `lib/geoint/api/tracing.ts:152-181` | HOF for API call tracing |
| `withDsTracing` | `lib/holonet/durable-streams/metrics/tracing.ts:277-299` | HOF for stream op tracing |
| `withSSETracking` | `lib/holonet/durable-streams/metrics/tracing.ts:311-318` | SSE connection lifecycle |
| `withSubscriptionTracking` | `lib/holonet/durable-streams/metrics/tracing.ts:330-337` | Subscription lifecycle |
| `ApiMetricsService` | `lib/geoint/api/metrics-export.ts:145-148` | Periodic metric snapshots |
| `snapshotToPrometheus` | `lib/geoint/api/metrics-export.ts:328-359` | Prometheus exposition |
| `InstrumentationService` | `lib/instrumentation/v1/services/InstrumentationService.ts` | Span capture + NATS persistence |
| OTel architecture | `lib/instrumentation/ARCHITECTURE.md` | @effect/opentelemetry design |

### OBS.10.2 Extension Points

| Extension | Base Pattern | New File |
|-----------|-------------|----------|
| `withEntityTracing` HOF | `withApiTracing` | `lib/iiot/observability/entity-tracing.ts` |
| `withPipelineTracing` HOF | `withDsTracing` | `lib/iiot/observability/pipeline-tracing.ts` |
| IIoT metric definitions | `lib/geoint/api/tracing.ts` | `lib/iiot/observability/metrics.ts` |
| Guarantee monitor service | `ApiMetricsService` | `lib/iiot/observability/guarantee-monitor.ts` |
| OTLP export layer | `lib/instrumentation/ARCHITECTURE.md` | `lib/iiot/observability/otel-layer.ts` |
| Edge OTLP collector | N/A (new) | `lib/iiot/observability/edge-collector.ts` |

### OBS.10.3 IIoT Observability Service

Implementations SHOULD model the IIoT observability system as an Effect service:

```typescript
// Normative: IIoTObservabilityService pattern
class IIoTObservabilityService extends Effect.Service<IIoTObservabilityService>()(
  'iiot/ObservabilityService',
  {
    effect: Effect.gen(function* () {
      const guaranteeMonitor = yield* GuaranteeMonitorService
      const metrics = yield* IIoTMetrics

      const checkGuarantees = Effect.gen(function* () {
        const [g1, g4, g5, g7, g8] = yield* Effect.all([
          guaranteeMonitor.checkG1(),
          guaranteeMonitor.checkG4(),
          guaranteeMonitor.checkG5(),
          guaranteeMonitor.checkG7(),
          guaranteeMonitor.checkG8(),
        ], { concurrency: 'unbounded' })

        return { g1, g4, g5, g7, g8 }
      })

      const getMetricsSummary = metrics.summarize()

      return { checkGuarantees, getMetricsSummary } as const
    }),
  }
) {}
```

---

## OBS.11 References

### Normative

- [RFC2119] -- Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [RFC8174] -- Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words."
- [OTEL] -- OpenTelemetry Project. "OpenTelemetry Specification." https://opentelemetry.io/docs/specs/otel/
- [W3C-TRACE-CONTEXT] -- W3C. "Trace Context." https://www.w3.org/TR/trace-context/
- [ISA-18.2] -- ANSI/ISA-18.2-2016. Management of Alarm Systems.
- [FDA-CFR11] -- U.S. FDA, 21 CFR Part 11. Electronic Records.

### NATS / JetStream

- [NATS-ACCOUNTS] -- Synadia. "NATS Account-Based Security."
- [JETSTREAM] -- Synadia. "NATS JetStream."

### Effect-TS

- [EFFECT-TS] -- Effect-TS Framework. https://effect.website
- [EFFECT-CLUSTER] -- @effect/cluster entity sharding.

### Internal

- [TMNL-MONITORING] -- Section: Monitoring Infrastructure.
- [TMNL-CONSISTENCY] -- Section: Two-Domain Consistency Model.
- [TMNL-SECURITY] -- Section: Tenant Isolation.

---

## Revision Log

| Date | Change |
|------|--------|
| 2026-02-09 | Initial draft -- 11 sections covering OTel integration, distributed tracing, consistency verification, metric architecture, structured logging, edge observability, and codebase grounding |

---

<!-- Source: rfc-section-monitoring-infrastructure.md -->

## MON.1 Scope

This section defines the NORMATIVE requirements for monitoring the entity lifecycle
event distribution infrastructure specified in RFC-001. The monitoring system
operates at four distinct granularities:

1. **Platform-level monitoring** — NATS cluster health, @effect/cluster runner
   health, JetStream storage utilization, and hub-to-hub connectivity.
2. **Per-organization monitoring** — Data freshness, alarm backlog depth,
   entity shard distribution, and tenant-scoped SLO enforcement.
3. **Edge device monitoring** — Connectivity status, battery levels, storage
   utilization, and last-seen timestamps for Sparkplug-B devices.
4. **Event pipeline monitoring** — Per-channel throughput, dead letter queue
   depth, backpressure signals, and end-to-end latency percentiles.

This section does NOT specify:

- Customer-facing IIoT alarm management (see ISA-18.2 compliance, separate section)
- Business intelligence dashboards or analytics
- Cost metering or billing instrumentation

### MON.1.1 Relationship to Other Sections

| Section | Relationship |
|---------|-------------|
| Observability Framework | Complementary — monitoring detects, observability explains |
| Effect-TS Implementation Architecture | Monitoring wraps `Metric.*` and `Effect.withSpan` patterns |
| Edge-First Architecture | Edge health checks defined here, edge deployment topology elsewhere |
| Security, Trust & Tenant Isolation | Alert routing respects tenant boundaries |
| Consistency Guarantees | SLOs derived from consistency guarantees G-1 through G-7 |

---

## MON.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in [RFC2119] and [RFC8174].

### MON.2.1 Terminology

| Term | Definition |
|------|-----------|
| **Platform alert** | An alert generated by the monitoring system about platform health, distinct from IIoT alarms (which are operational events within a tenant's equipment) |
| **Health check** | A periodic probe that asserts a component is functioning within specification |
| **SLO** | Service Level Objective — a measurable target for system behavior |
| **SLI** | Service Level Indicator — the metric that an SLO is measured against |
| **Error budget** | The allowed failure margin before an SLO is violated (100% - SLO target) |
| **Burn rate** | The rate at which the error budget is being consumed |
| **Data freshness** | The elapsed time since the most recent event was received for a given entity or tenant |

---

## MON.3 Health Check Hierarchy

Implementations MUST provide a hierarchical health check system that covers
infrastructure, platform services, per-tenant health, and edge device connectivity.

### MON.3.1 Infrastructure Health

#### MON.3.1.1 NATS Cluster Health

The NATS cluster forms the backbone of all event distribution [NATS-PROTO].
Health checks MUST include:

| Check | Method | Interval | Failure Threshold |
|-------|--------|----------|-------------------|
| Raft consensus leader | `$SYS.REQ.SERVER.PING` meta-request | 5s | Leader absent > 15s |
| JetStream stream lag | Per-stream consumer lag via `$JS.API.CONSUMER.INFO` | 10s | Lag > 10,000 messages |
| JetStream storage utilization | Cluster-wide storage via `$JS.API.INFO` | 30s | > 80% disk utilization |
| Route mesh connectivity | `routez` monitoring endpoint per server | 10s | Any route disconnected > 30s |
| Leaf node connectivity | `leafz` monitoring endpoint | 10s | Hub leaf node disconnected > 60s |

**Codebase reference**: The NATS connection layer at `lib/holonet/nats/hub.ts` and
connection tests at `lib/holonet/nats/__tests__/connection.test.ts` establish the
baseline connectivity patterns that health checks extend.

```
Probe: NATS Raft Consensus
  ┌──────────┐     $SYS.REQ.SERVER.PING      ┌──────────┐
  │ Monitor  │ ──────────────────────────────► │ NATS Hub │
  │ Service  │ ◄────────────────────────────── │  (Raft)  │
  └──────────┘     response: leader_id         └──────────┘
       │
       ▼
  leader_id == known_leader?
  ├─ YES → healthy
  └─ NO  → leader_changed (warn) or no_leader (critical)
```

#### MON.3.1.2 @effect/cluster Runner Health

The distributed entity system relies on `@effect/cluster` for shard management
[EFFECT-CLUSTER]. Implementations MUST monitor:

| Check | Description | Interval | Alert Condition |
|-------|-------------|----------|-----------------|
| Shard assignment coverage | All shard groups have all 300 shards assigned | 15s | Any unassigned shard > 60s |
| Runner heartbeat | Each runner reports alive to the shard manager | 5s | Runner silent > 15s |
| Entity activation count | Active entities per runner | 10s | > 50,000 per runner (capacity warning) |
| Rebalance in progress | Shard migration between runners | event-driven | Rebalance duration > 5 minutes |

**Codebase reference**: Entity definitions at `lib/iiot/entity/` (SiteEntity.ts,
PlantEntity.ts, AreaEntity.ts, LineEntity.ts, WorkCellEntity.ts, MachineAssetEntity.ts,
DeviceEntity.ts, SensorAssetEntity.ts) define the entity types whose shard
distribution MUST be monitored.

#### MON.3.1.3 Database Health

| Check | Description | Interval | Alert Condition |
|-------|-------------|----------|-----------------|
| PostgreSQL connectivity | Connection pool active/idle/waiting | 5s | Waiting connections > pool_size * 0.8 |
| Replication lag | Streaming replication delay | 10s | Lag > 30s |
| Connection count per tenant | Per-org connection tracking | 30s | Single tenant > 10% of pool |
| Query latency P99 | Slow query tracking | 10s | P99 > 500ms |

### MON.3.2 Edge Device Health

Edge devices connect via Sparkplug-B over MQTT, bridged to NATS through the
ingestion pipeline [SPARKPLUG-B].

| Check | Description | Source | Alert Condition |
|-------|-------------|--------|-----------------|
| Last DATA message | Timestamp of most recent `DDATA`/`NDATA` | Sparkplug topic | > 5x expected reporting interval |
| DEATH certificate | `DDEATH`/`NDEATH` received | Sparkplug topic | DEATH without subsequent BIRTH > 5 minutes |
| BIRTH certificate freshness | Most recent `DBIRTH`/`NBIRTH` | Sparkplug topic | No BIRTH in > 24 hours |
| Edge battery level | Battery metric from device profile | Sparkplug metric | < 20% battery (warn), < 5% (critical) |
| Edge storage utilization | Local buffer storage | Sparkplug metric | > 80% store-and-forward buffer |

**Codebase reference**: The Sparkplug adapter at `lib/iiot/adapters/sparkplug-adapter.ts`
and ingestion service at `lib/iiot/adapters/ingestion-service.ts` parse BIRTH, DATA,
and DEATH certificates. The `SparkplugPipelineLayer` at
`lib/iiot/adapters/ingestion-service.ts:297-322` composes the full ingestion chain.

```
Edge Health State Machine:

  BIRTH received           DATA received              DEATH received
  ┌───────────┐            ┌───────────┐              ┌───────────┐
  │  ONLINE   │ ─────────► │  ACTIVE   │ ───────────► │  OFFLINE  │
  └───────────┘  periodic  └───────────┘   DEATH msg  └───────────┘
       ▲         data          │                           │
       │                       │ no DATA for               │ no BIRTH for
       │                       │ 5x interval               │ > 5 minutes
       │                       ▼                           │
       │                  ┌───────────┐                    │
       └──── BIRTH ────── │   STALE   │ ◄─────────────────┘
                          └───────────┘
                               │ no DATA for > 30 minutes
                               ▼
                          ┌───────────┐
                          │   LOST    │ → Critical alert
                          └───────────┘
```

### MON.3.3 Per-Organization Health

Each tenant organization has an independent health profile. Implementations
MUST track per-org health without cross-tenant information leakage.

| Indicator | SLI | Healthy | Degraded | Unhealthy |
|-----------|-----|---------|----------|-----------|
| Data freshness | Time since last event | < 2x reporting interval | 2x-5x interval | > 5x interval |
| Alarm backlog | Unacknowledged alarms count | < 10 | 10-50 | > 50 |
| Entity staleness | % of entities with stale data | < 5% | 5-20% | > 20% |
| Event delivery rate | Events delivered / events expected | > 99% | 95-99% | < 95% |

### MON.3.4 HTTP Health Endpoint

Implementations MUST expose an HTTP health endpoint for orchestrator liveness
and readiness probes.

**Codebase reference**: The existing health check at `lib/iiot/http/health.ts`
provides a minimal liveness probe:

```typescript
// Current: lib/iiot/http/health.ts
export const healthCheck = Effect.sync(() =>
  HttpServerResponse.json({ status: 'ok', timestamp: Date.now() })
)
```

Implementations SHOULD extend this to a structured health response:

```typescript
// Normative health response schema
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": 1707436800000,
  "checks": {
    "nats": { "status": "healthy", "latency_ms": 2 },
    "cluster": { "status": "healthy", "active_shards": 300, "runners": 5 },
    "database": { "status": "healthy", "pool_active": 12, "pool_idle": 38 },
    "jetstream": { "status": "degraded", "storage_pct": 82 }
  },
  "version": "1.0.0"
}
```

The overall status MUST be the worst status among all checks. If any check is
"unhealthy", the overall status MUST be "unhealthy". If any check is "degraded"
and none are "unhealthy", the overall status MUST be "degraded".

---

## MON.4 SLO Definitions

### MON.4.1 Event Delivery SLOs by ISA-95 Level

SLOs are defined per ISA-95 level to reflect the differing urgency of events
at each hierarchy level [ISA-95-1]. These SLOs apply to intra-organization
event delivery (the "causal domain" from the consistency guarantees).

| ISA-95 Level | Entity Types | P50 Latency | P95 Latency | P99 Latency | Availability |
|--------------|-------------|-------------|-------------|-------------|--------------|
| Level 4 (Enterprise) | Enterprise, cross-org signals | < 500ms | < 2s | < 5s | 99.9% |
| Level 3 (Site/Plant) | Site, Plant | < 200ms | < 500ms | < 1s | 99.95% |
| Level 2 (Area/Line) | Area, Line, WorkCell | < 100ms | < 250ms | < 500ms | 99.95% |
| Level 1 (Control) | Machine, Device, Sensor | < 50ms | < 100ms | < 250ms | 99.99% |
| Level 0 (Process) | Sensor readings (telemetry) | < 20ms | < 50ms | < 100ms | 99.9% |

**Measurement**: Latency is measured from the instant an entity handler emits a
state change event to the instant the event is delivered to the subscriber's
WebSocket connection (or NATS consumer acknowledgment, for headless subscribers).

### MON.4.2 Alarm Acknowledgment SLOs

Per ISA-18.2 [ISA-18.2], alarm management systems MUST track time-to-acknowledge.
These are SLOs for the platform's delivery capability, not the operator's response time.

| Alarm Priority | Delivery SLO (platform) | Operator Ack SLO (guidance) | Escalation Trigger |
|----------------|------------------------|-----------------------------|--------------------|
| Critical (1) | < 100ms to all subscribers | < 5 minutes | Unacked > 2 min |
| High (2) | < 250ms to all subscribers | < 15 minutes | Unacked > 10 min |
| Medium (3) | < 500ms to all subscribers | < 60 minutes | Unacked > 30 min |
| Low (4) | < 1s to all subscribers | < 4 hours | Unacked > 2 hours |

**Codebase reference**: Alarm events are defined at
`lib/iiot/schemas/events/operational/alarm-events.ts`, and the alarm lifecycle
workflow at `lib/iiot/workflow/AlarmLifecycleWorkflow.ts` governs transitions.
ISA-18.2 compliance tests at `lib/iiot/__tests__/compliance/isa-18-2-compliance.test.ts`
validate alarm state machine correctness.

### MON.4.3 Cross-Organization Event Propagation SLOs

Events that cross tenant boundaries (the "saga-eventual domain" from
consistency guarantees) have different SLOs reflecting the inherent latency
of anti-corruption layers and redaction [ANTI-CORRUPTION].

| Signal Type | P50 Latency | P99 Latency | Bounded Staleness |
|-------------|-------------|-------------|-------------------|
| Capacity availability | < 5s | < 30s | 60s |
| Fleet intelligence (aggregate) | < 30s | < 120s | 300s |
| Market signals | < 10s | < 60s | 120s |
| Cross-org alarm correlation | < 2s | < 10s | 30s |

### MON.4.4 System Availability SLOs

| Component | Target | Measurement Window | Error Budget (monthly) |
|-----------|--------|-------------------|----------------------|
| Hub cluster (NATS + services) | 99.95% | 30 days | 21.9 minutes |
| Entity processing pipeline | 99.95% | 30 days | 21.9 minutes |
| WebSocket delivery | 99.9% | 30 days | 43.8 minutes |
| Edge connectivity (per device) | 99.0% | 30 days | 7.3 hours |
| Cross-org event propagation | 99.5% | 30 days | 3.65 hours |

### MON.4.5 SLO Burn Rate Alerting

Implementations MUST compute burn rate as the ratio of current error rate to
the error rate that would exactly exhaust the error budget over the SLO window.

| Alert Severity | Burn Rate | Budget Consumed In | Response |
|----------------|-----------|-------------------|----------|
| Page (critical) | > 14.4x | < 2 hours | Immediate on-call page |
| Ticket (high) | > 6x | < 5 hours | Ticket created, 4-hour response |
| Warning | > 3x | < 10 hours | Dashboard warning, next-shift review |
| Watch | > 1x | < 30 days | Trend tracking, capacity planning |

---

## MON.5 Alerting Pipeline

### MON.5.1 Alert Taxonomy

Platform alerts MUST NOT be confused with IIoT alarms (ISA-18.2 events within
tenant equipment). The following taxonomy applies:

| Category | Examples | Audience |
|----------|----------|----------|
| Infrastructure | NATS cluster degraded, disk full, runner crash | Platform SRE team |
| Pipeline | JetStream consumer lag, dead letter queue overflow | Platform SRE + on-call |
| Tenant health | Org data gap > 5x interval, alarm backlog spike | Platform SRE (not tenant) |
| Security | Auth failure burst, unusual API pattern, cert expiry | Security team |
| Capacity | Shard imbalance, connection limit approaching, storage growth | Platform engineering |

### MON.5.2 Alert Severity Levels

| Level | Name | Response Time | Notification Channel | Auto-Escalation |
|-------|------|--------------|---------------------|-----------------|
| P1 | Critical | < 15 minutes | PagerDuty + SMS + Slack | 30 min to manager |
| P2 | High | < 1 hour | PagerDuty + Slack | 2 hours to team lead |
| P3 | Medium | < 4 hours | Slack (#alerts) | 8 hours to ticket |
| P4 | Low | Next business day | Slack (#monitoring) | 48 hours to ticket |
| P5 | Info | No response required | Dashboard only | None |

### MON.5.3 Alert Routing

```
Event Source → Alert Router → Severity Classification → Channel Dispatch
                    │
                    ├─ Infrastructure alerts → Platform SRE rotation
                    ├─ Pipeline alerts ──────→ Data engineering rotation
                    ├─ Tenant health ────────→ Customer success + SRE
                    ├─ Security alerts ──────→ Security team
                    └─ Capacity alerts ──────→ Platform engineering
```

Implementations MUST support:

- **Alert deduplication**: Identical alerts within a 5-minute window MUST be
  grouped into a single notification with occurrence count.
- **Alert correlation**: Alerts sharing a root cause (e.g., NATS cluster
  failure causing both connectivity and delivery alerts) SHOULD be correlated
  into an incident.
- **Alert suppression during maintenance**: A maintenance window API MUST
  suppress non-critical alerts for specified components.

### MON.5.4 Alert Suppression Protocol

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Maintenance Window Protocol                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Operator creates maintenance window:                             │
│     POST /api/v1/maintenance-windows                                 │
│     { "components": ["nats-hub-2"], "start": T, "end": T+2h }       │
│                                                                      │
│  2. Alert router checks active windows before dispatching:           │
│     - P1 (Critical): ALWAYS dispatched, even during maintenance      │
│     - P2-P3: Suppressed for specified components                     │
│     - P4-P5: Suppressed and logged                                   │
│                                                                      │
│  3. Post-maintenance reconciliation:                                 │
│     - All suppressed alerts reviewed                                 │
│     - Persistent conditions re-evaluated                             │
│     - Stale alerts auto-resolved                                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## MON.6 Capacity Monitoring

### MON.6.1 NATS Subject Throughput

Implementations MUST track message throughput per NATS subject pattern,
corresponding to the four IIoT event channels defined in the event distribution
architecture.

**Codebase reference**: Subject definitions at `lib/iiot/realtime/iiot-subjects.ts`
define the four channel patterns:

| Channel Subject | Expected Throughput (per hub) | Alert: Sustained Above | Alert: Drop to Zero |
|----------------|------------------------------|----------------------|---------------------|
| `iiot.readings.*` | 10K-500K msg/s | 750K msg/s (capacity) | > 60s (data gap) |
| `iiot.alarms.*` | 100-5K msg/s | 10K msg/s (alarm storm) | N/A (sparse) |
| `iiot.equipment.*` | 500-10K msg/s | 20K msg/s (capacity) | > 300s (suspicious) |
| `iiot.invalidations.*` | 50-1K msg/s | 5K msg/s (invalidation storm) | N/A (sparse) |

### MON.6.2 JetStream Storage Utilization

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|-------------------|-------------------|--------|
| Total stream storage | 70% of allocated | 85% of allocated | Purge old messages, expand storage |
| Per-stream message count | > 10M messages | > 50M messages | Review retention policy |
| Consumer pending ack count | > 10K pending | > 50K pending | Scale consumers, investigate backpressure |
| Consumer redelivery rate | > 5% redeliveries | > 15% redeliveries | Investigate processing failures |

### MON.6.3 Entity Shard Distribution

Shard balance directly affects latency fairness across tenants. Implementations
MUST monitor shard distribution and trigger rebalancing when imbalance exceeds
thresholds.

| Metric | Computation | Alert Threshold |
|--------|-------------|-----------------|
| Shard count per runner | Count of shards assigned to each runner | Max/min ratio > 1.5 |
| Entity count per shard | Active entities in each shard | Max/avg ratio > 3.0 |
| Messages processed per shard per second | Throughput per shard | Coefficient of variation > 0.5 |
| Shard migration duration | Time for shard handoff between runners | > 30 seconds per shard |

### MON.6.4 Connection Tracking

| Metric | Per-Hub Capacity | Alert Threshold |
|--------|-----------------|-----------------|
| WebSocket connections (subscribers) | 50K concurrent | > 40K (80% capacity) |
| NATS client connections | 10K concurrent | > 8K (80% capacity) |
| Sparkplug device connections | 100K concurrent | > 80K (80% capacity) |
| Leaf node connections | 500 concurrent | > 400 (80% capacity) |

### MON.6.5 Capacity Projection

Implementations SHOULD maintain a 90-day rolling forecast of capacity utilization
based on:

- Linear extrapolation of connection growth rate
- Seasonal patterns (shift changes, maintenance windows)
- Tenant onboarding pipeline (expected new organizations)

When the projection indicates capacity exhaustion within 30 days at current
growth rate, a P3 alert MUST be generated for capacity planning.

### MON.6.6 NATS Monitoring Subject Taxonomy

The platform MUST expose monitoring data via NATS subjects for real-time
consumption. This table consolidates all monitoring-relevant subjects across
infrastructure, tenant health, and platform telemetry.

| Subject Pattern | Publisher | Content | Consumers |
|----------------|-----------|---------|-----------|
| `$SYS.REQ.SERVER.PING` | NATS server | Server liveness | Platform monitoring (MON.3.1.1) |
| `$SYS.REQ.SERVER.INFO` | NATS server | Server configuration | Capacity planning (MON.6.5) |
| `$JS.API.CONSUMER.INFO.{stream}.{consumer}` | JetStream | Consumer lag, pending count | SLO monitoring (MON.4) |
| `$JS.API.STREAM.INFO.{stream}` | JetStream | Stream size, message count | Storage forecasting (MON.6.2) |
| `tmnl.health.{orgId}.{deviceId}` | Edge device | Heartbeat + system metrics | Hub health monitoring (MON.3.2) |
| `tmnl.metrics.{orgId}.events` | Edge device | Event rate counters | Throughput monitoring (MON.6.1) |
| `tmnl.platform.shard.{shardGroup}.{shardId}` | Cloud runner | Shard entity count, throughput | Cluster health (MON.6.3) |
| `tmnl.platform.guarantee.{gN}` | Monitoring service | G-1 through G-8 compliance | SLA dashboards (MON.4, OBS.5) |

**Sovereignty requirement**: Subjects under `tmnl.health.{orgId}.*` and
`tmnl.metrics.{orgId}.*` MUST be scoped to the organization's NATS account
[NATS-ACCOUNTS]. The platform monitoring service accesses them via explicit
cross-account import, which the organization MAY revoke.

**Codebase reference**: The four IIoT event subjects at
`lib/iiot/realtime/iiot-subjects.ts` define the application-level channels.
Monitoring subjects listed above are an extension of this pattern for
platform-level telemetry.

---

## MON.7 Anomaly Detection

### MON.7.1 Statistical Anomaly Detection on Event Rates

Implementations MUST detect anomalies in event rate patterns. The detection
algorithm SHOULD use a combination of:

1. **Moving average deviation**: Current rate vs. 1-hour moving average.
   Alert if deviation > 3 standard deviations.
2. **Seasonal comparison**: Current rate vs. same time yesterday / same time
   last week. Alert if deviation > 2 standard deviations after seasonal
   adjustment.
3. **Sudden change detection**: Rate of change exceeds historical norms.
   Alert on > 10x increase or > 90% decrease within a 5-minute window.

| Anomaly Type | Detection Method | Severity | Example |
|-------------|-----------------|----------|---------|
| Traffic spike | Rate > 3 sigma above mean | P3 | DDoS, sensor misconfiguration |
| Traffic cliff | Rate drops > 90% in 5 min | P2 | Network partition, device failure |
| Gradual drift | 7-day trend diverging from 30-day baseline | P4 | Capacity growth, device degradation |
| Periodic absence | Expected periodic signal missing | P3 | Batch process stopped, shift change anomaly |

### MON.7.2 Dead Letter Queue Monitoring

Events that cannot be processed after retry exhaustion are routed to dead letter
queues (DLQ). Implementations MUST monitor DLQ depth and composition.

| Metric | Interval | Warning | Critical |
|--------|----------|---------|----------|
| DLQ depth (total messages) | 30s | > 100 messages | > 1,000 messages |
| DLQ growth rate | 1 min | > 10 msg/min sustained | > 100 msg/min sustained |
| DLQ age (oldest message) | 5 min | > 1 hour | > 4 hours |
| DLQ composition | 5 min | Single error type > 80% | N/A (informational) |

When DLQ depth exceeds critical threshold, implementations MUST:
1. Generate a P2 alert with DLQ composition breakdown
2. Pause ingestion for affected entity types if DLQ growth is unbounded
3. Log the first 10 DLQ entries with full event payloads for debugging

### MON.7.3 Clock Skew Detection

Distributed systems are sensitive to clock skew [LAMPORT-1978]. Implementations
MUST detect and alert on clock skew between:

| Node Pair | Acceptable Skew | Alert Threshold | Impact |
|-----------|----------------|-----------------|--------|
| NATS cluster nodes | < 50ms | > 100ms | Raft consensus instability |
| Hub to hub | < 200ms | > 500ms | Cross-hub event ordering drift |
| Edge to hub | < 2s | > 5s | Telemetry timestamp inaccuracy |
| Database replicas | < 10ms | > 50ms | Replication conflict risk |

Detection method: Implementations SHOULD embed sender timestamps in event headers
and compute drift on receipt. NTP synchronization MUST be enforced on all
infrastructure nodes. Edge devices SHOULD use Sparkplug-B timestamp fields for
drift estimation.

### MON.7.4 Per-Organization Anomaly Detection

Individual tenant organizations may exhibit anomalous patterns that require
platform intervention without exposing cross-tenant data.

| Anomaly | Detection | Response |
|---------|-----------|----------|
| Sudden traffic spike (single org) | Rate > 10x 1-hour average | Investigate: DDoS vs. legitimate burst |
| Data gap (single org) | No events for > 5x expected interval | Check edge connectivity, alert customer success |
| Alarm flood (single org) | > 100 alarms/min (ISA-18.2 flood threshold) | Enable alarm shelving, notify operator [ISA-18.2] |
| Schema violation burst | > 10 schema decode failures/min from one org | Quarantine org events, investigate firmware version |

---

## MON.8 Codebase Grounding

### MON.8.1 Existing Monitoring Patterns

The codebase already implements Effect-native metrics and health check patterns
that the monitoring infrastructure builds upon.

| Pattern | Location | Description |
|---------|----------|-------------|
| HTTP health endpoint | `lib/iiot/http/health.ts` | Minimal liveness probe returning `{ status, timestamp }` |
| Effect Metric counters | `lib/geoint/api/tracing.ts` | `Metric.counter`, `Metric.histogram` with tagged dimensions |
| Prometheus exposition | `lib/geoint/api/metrics-export.ts` | `snapshotToPrometheus()` converts Effect metrics to Prometheus format |
| Periodic metric snapshots | `lib/geoint/api/metrics-export.ts` | `ApiMetricsService` with `Schedule.spaced` periodic collection |
| Durable streams metrics | `lib/holonet/durable-streams/metrics/tracing.ts` | Histogram, counter, gauge for stream operations |
| Connection tracking | `lib/holonet/durable-streams/metrics/tracing.ts` | `activeSSEConnectionsGauge`, `activeSubscriptionsGauge` |
| Higher-order tracing | `lib/geoint/api/tracing.ts` | `withApiTracing()` HOF wraps effects with span + metrics |
| InstrumentationService | `lib/instrumentation/v1/services/InstrumentationService.ts` | Effect.Service for span capture with NATS persistence |
| OpenTelemetry bridge | `lib/instrumentation/ARCHITECTURE.md` | @effect/opentelemetry integration design |
| Ingestion pipeline | `lib/iiot/adapters/ingestion-service.ts` | `SparkplugPipelineLayer` composing adapter + router + processor |
| NATS connection | `lib/holonet/nats/hub.ts` | NATS hub connection with reconnection handling |
| Event channels | `lib/iiot/realtime/iiot-subjects.ts` | 4 IIoT NATS subject specs (readings, alarms, equipment, invalidations) |

### MON.8.2 Metric Naming Convention

Existing codebase patterns establish a `domain.subsystem.metric_name` convention:

```
geoint.api.latency_ms           — Geoint API latency histogram
geoint.api.requests             — Geoint API request counter
geoint.api.errors               — Geoint API error counter
durable_streams.operation.latency_ms  — Stream operation latency
durable_streams.operations      — Stream operation counter
durable_streams.messages.published    — Message throughput counter
```

IIoT monitoring metrics MUST follow this convention:

```
iiot.entity.event_delivery_latency_ms    — Entity event delivery histogram
iiot.entity.events_delivered              — Entity event delivery counter
iiot.entity.active_count                 — Active entity gauge per shard group
iiot.pipeline.readings_per_second        — Ingestion throughput gauge
iiot.pipeline.dead_letter_depth          — DLQ depth gauge
iiot.alarm.unacknowledged_count          — Unacked alarm gauge per org
iiot.edge.connected_devices              — Connected device gauge per hub
iiot.edge.last_seen_age_seconds          — Device freshness histogram
iiot.cluster.shard_entity_count          — Entities per shard gauge
iiot.cluster.shard_messages_per_second   — Throughput per shard gauge
iiot.nats.subject_throughput             — Per-subject message rate
iiot.nats.jetstream_storage_pct          — JetStream storage utilization
```

### MON.8.3 Extending the Effect Metric Pattern

The existing `withApiTracing` higher-order function at `lib/geoint/api/tracing.ts`
establishes the pattern for wrapping effects with metrics. IIoT entity handlers
MUST follow this same pattern:

```typescript
// Normative: IIoT entity handler tracing (extends existing pattern)
export const withEntityTracing = (
  entityType: string,
  operation: string
) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.tap(() =>
      Metric.increment(
        Metric.tagged(entityEventCounter, 'entity_type', entityType)
      )
    ),
    Effect.withSpan(`iiot.${entityType}.${operation}`, {
      attributes: { 'iiot.entity_type': entityType, 'iiot.operation': operation },
    }),
    Effect.tapBoth({
      onSuccess: () =>
        Metric.update(
          Metric.tagged(entityLatencyHistogram, 'entity_type', entityType),
          Date.now() - startTime
        ),
      onFailure: (error) =>
        Metric.increment(
          Metric.tagged(entityErrorCounter, 'entity_type', entityType)
        ),
    })
  )
```

### MON.8.4 Health Check as Effect Service

Implementations SHOULD model the health check system as an Effect service that
composes individual check probes:

```typescript
// Normative: HealthCheckService pattern
class HealthCheckService extends Effect.Service<HealthCheckService>()(
  'iiot/HealthCheckService',
  {
    effect: Effect.gen(function* () {
      const nats = yield* NatsConnection
      const cluster = yield* ClusterHealth
      const db = yield* DatabaseHealth

      const check = Effect.gen(function* () {
        const [natsHealth, clusterHealth, dbHealth] = yield* Effect.all([
          nats.ping().pipe(Effect.timeout(Duration.seconds(2))),
          cluster.shardCoverage(),
          db.poolStatus(),
        ], { concurrency: 'unbounded' })

        return {
          status: worstOf(natsHealth.status, clusterHealth.status, dbHealth.status),
          checks: { nats: natsHealth, cluster: clusterHealth, database: dbHealth },
          timestamp: Date.now(),
        }
      })

      return { check } as const
    }),
  }
) {}
```

---

## MON.9 Open Questions

1. **Monitoring overhead at scale**: At 200K organizations, even 1% sampling of
   cross-org events is 2,000 event evaluations per minute. Is this sufficient
   for G-8 compliance detection, or does sampling miss edge cases?

2. **Sovereign metric export consent**: When should the platform be allowed to
   access an organization's sovereign metrics without explicit export? Emergency
   response to safety-critical SLA violations may require immediate access.

3. **Self-healing audit trail**: Self-healing events (auto-restart, stream
   recreation) should be logged immutably for regulatory compliance. Should
   they flow through the same EventLog as entity events, or through a
   separate operations log?

4. **NATS `$SYS` subject access**: NATS system subjects require system account
   access. How is this access controlled in the multi-tenant architecture?
   Platform monitoring needs `$SYS` access but organizations MUST NOT have it.

5. **Runbook automation scope**: Which runbook steps should be fully automated
   vs requiring human approval? Auto-healing edge devices is low-risk;
   auto-scaling cloud infrastructure has cost implications.

---

## MON.10 References

### Normative

- [RFC2119] — Requirement level keywords
- [ISA-18.2] — Alarm management system requirements
- [ISA-95-1] — ISA-95 entity hierarchy and level definitions
- [NATS-PROTO] — NATS protocol (monitoring subjects `$SYS.*`)
- [JETSTREAM] — JetStream stream and consumer management
- [EFFECT-CLUSTER] — @effect/cluster entity sharding and runner management
- [SPARKPLUG-B] — Eclipse Sparkplug specification (BIRTH/DATA/DEATH)
- [NATS-ACCOUNTS] — Synadia. "NATS Account-Based Security."

### Informative

- [LAMPORT-1978] — Clock synchronization and event ordering
- [ANTI-CORRUPTION] — Anti-corruption layer pattern for cross-boundary events
- [EFFECT-TS] — Effect-TS framework (Metric, Effect.withSpan)
- [KLEPPMANN] — Distributed systems monitoring and failure modes
- [REACTIVE-MANIFESTO] — Resilience and elasticity principles
- [TWELVE-FACTOR] — Telemetry and logging best practices

---

## Revision Log

| Date | Change |
|------|--------|
| 2026-02-09 | Initial draft — 8 sections covering health hierarchy, SLOs, alerting, capacity, anomaly detection, and codebase grounding |
| 2026-02-09 | Added MON.6.6 NATS Monitoring Subject Taxonomy (migrated from superseded rfc-section-observability.md 18.2.3) and MON.9 Open Questions (migrated from same) |

---

<!-- Source: rfc-section-operational-runbooks.md -->

## RB.1 Scope

This section defines the operational procedures for deploying, maintaining, and
operating the TMNL metropolitan-scale IIoT event distribution system. It covers
the full operational lifecycle from initial org onboarding (Day-1) through
steady-state operations (Day-2), incident response, maintenance windows,
capacity planning, backup/recovery, and compliance operations.

Each runbook procedure specifies:
- **Prerequisites**: What must be true before starting
- **Steps**: Numbered, imperative, copy-pasteable commands where applicable
- **Verification**: How to confirm the procedure succeeded
- **Rollback**: How to undo if something goes wrong

This section is informative for general procedures and normative where
marked with [RFC2119] keywords.

---

## RB.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119] and [RFC8174].

File paths are relative to `packages/tmnl/` and use the `src/` prefix.

**Command notation**:
- `$` prefix: shell commands run by operator
- `nats>` prefix: NATS CLI commands
- `psql>` prefix: PostgreSQL commands
- `[PLACEHOLDER]` values MUST be substituted with environment-specific values

---

## RB.3 Day-1 Operations

### RB.3.1 New Organization Onboarding

**Prerequisites**:
- Cloud NATS cluster operational
- `@effect/cluster` runner pool healthy
- PostgreSQL database accessible
- Organization details: name, geographic region, subscription tier

**Procedure**:

1. **Create NATS Account for the organization**

   Generate an operator-signed JWT [NATS-JWT] with appropriate limits:

   ```
   $ nsc add account --name [ORG_ID]
   $ nsc edit account --name [ORG_ID] \
       --js-mem-storage [TIER_MEM_LIMIT] \
       --js-disk-storage [TIER_DISK_LIMIT] \
       --js-streams [TIER_STREAM_LIMIT] \
       --js-consumer [TIER_CONSUMER_LIMIT]
   ```

   Account limits by subscription tier:

   | Tier | Memory | Disk | Streams | Consumers |
   |------|--------|------|---------|-----------|
   | Starter | 256 MB | 1 GB | 10 | 50 |
   | Professional | 1 GB | 10 GB | 50 | 500 |
   | Enterprise | 8 GB | 100 GB | 500 | 5000 |

2. **Create JetStream streams for the organization**

   Four streams per org (see `rfc-section-consistency-guarantees.md` Y.4):

   ```
   $ nats stream add iiot-readings-[ORG_ID] \
       --subjects "iiot.readings.>" \
       --storage file \
       --retention limits \
       --max-age 24h \
       --max-bytes [TIER_DISK_LIMIT] \
       --discard old \
       --replicas 3

   $ nats stream add iiot-alarms-[ORG_ID] \
       --subjects "iiot.alarms.>" \
       --storage file \
       --retention limits \
       --max-age 720h \
       --max-bytes 2G \
       --discard new \
       --replicas 3

   $ nats stream add iiot-equipment-[ORG_ID] \
       --subjects "iiot.equipment.>" \
       --storage file \
       --retention limits \
       --max-age 720h \
       --max-bytes 2G \
       --discard new \
       --replicas 3

   $ nats stream add iiot-invalidations-[ORG_ID] \
       --subjects "iiot.invalidations.>" \
       --storage file \
       --retention limits \
       --max-age 1h \
       --max-bytes 500M \
       --discard old \
       --replicas 3
   ```

3. **Provision database schema**

   Create org-scoped tables in PostgreSQL:

   ```
   psql> CREATE SCHEMA IF NOT EXISTS org_[ORG_ID];
   psql> SET search_path TO org_[ORG_ID];
   -- Run migration scripts for entity state tables
   -- (12 state services: Alarm, WorkOrder, EquipmentState, Machine,
   --  Area, SensorAsset, Plant, Enterprise, Site, WorkCell, Line, Device)
   ```

   Ref: `src/lib/iiot/state/index.ts` lines 132-147 lists all 12 state
   services composed via `AllStateServicesInMemory` (production uses SQL
   equivalents).

4. **Create user credentials**

   Generate user JWTs with appropriate permissions:

   ```
   $ nsc add user --account [ORG_ID] --name [USER_ID] \
       --allow-pub "iiot.readings.[ORG_ID].>" \
       --allow-pub "iiot.alarms.[ORG_ID].>" \
       --allow-sub "iiot.*.>"
   ```

5. **Register organization in `@effect/cluster`**

   The first entity message for the org will trigger lazy entity creation.
   No explicit registration step needed -- the `EntityManager` pattern
   (`src/lib/iiot/entity/EntityStack.ts` lines 54-67) creates entities on
   first message via `Entity.build()`.

**Verification**:

```
$ nats account info [ORG_ID]
$ nats stream ls --account [ORG_ID]
$ nats sub "iiot.readings.[ORG_ID].test" --account [ORG_ID] &
$ nats pub "iiot.readings.[ORG_ID].test" "hello" --account [ORG_ID]
# Expect: message received on subscriber
```

**Rollback**:

```
$ nsc delete account --name [ORG_ID]
psql> DROP SCHEMA org_[ORG_ID] CASCADE;
```

### RB.3.2 Edge Device Provisioning

**Prerequisites**:
- Organization onboarded (RB.3.1)
- Device hardware prepared with Sparkplug-B firmware [SPARKPLUG-B]
- MQTT broker credentials available

**Procedure**:

1. **Generate device credentials**

   ```
   $ nsc add user --account [ORG_ID] --name device-[DEVICE_ID] \
       --allow-pub "spBv1.0/[GROUP_ID]/+/[EDGE_NODE_ID]/+" \
       --allow-sub "spBv1.0/[GROUP_ID]/NCMD/[EDGE_NODE_ID]/+"
   ```

2. **Configure device firmware**

   Device configuration parameters (mapped to `sparkplug-adapter.ts` line 367):

   | Parameter | Value | Source |
   |-----------|-------|--------|
   | `serverUrl` | `mqtt://[HUB_BROKER]:1883` | Hub-specific |
   | `groupId` | `[GROUP_ID]` | ISA-95 area mapping |
   | `edgeNodeId` | `[EDGE_NODE_ID]` | Unique per device |
   | `keepalive` | `65` | Match adapter config |
   | `reconnectPeriod` | `1000` | Match adapter config |
   | `connectTimeout` | `30000` | Match adapter config |
   | `cleanSession` | `true` | Sparkplug requirement |

3. **Register device in asset hierarchy**

   Create the device entity in the ISA-95 hierarchy:
   - Enterprise > Site > Area > Line > WorkCell > Device
   - Each level maps to state services in `src/lib/iiot/state/`

4. **Verify device birth sequence**

   ```
   $ nats sub "spBv1.0/[GROUP_ID]/NBIRTH/[EDGE_NODE_ID]/+" --timeout 120s
   # Power on device
   # Expect: NBIRTH message with metric definitions
   ```

**Verification**:
- NBIRTH received within 120s of power-on
- SparkplugAdapter alias registry populated for new device
- `IngestionHealth.connected` reflects `true` (via `healthRef`)
- First DDATA message flows through pipeline to EventDistribution

### RB.3.3 Initial Health Verification

After onboarding an org and provisioning devices, run the full health check:

**Procedure**:

1. **NATS connectivity**
   ```
   $ nats server check connection --server [NATS_URL]
   $ nats server check jetstream --server [NATS_URL]
   $ nats stream info iiot-readings-[ORG_ID]
   ```

2. **Event pipeline end-to-end**
   ```
   # Publish a test reading via device or simulator
   # Verify arrival in EventDistribution channel:
   #   iiot:readings channel (maxLag 10,000)
   # Verify arrival in WebSocket subscriber (if connected):
   #   /ws/iiot endpoint
   ```

3. **Entity cluster health**
   ```
   # Verify EntityManager can create entities for the org:
   # Send a test command to a device entity
   # Verify entity state created in state service
   ```

4. **Database connectivity**
   ```
   psql> SELECT 1;
   psql> SELECT count(*) FROM org_[ORG_ID].devices;
   ```

---

## RB.4 Day-2 Operations

### RB.4.1 Adding New Production Lines / Machines

**Prerequisites**:
- Organization onboarded and operational
- ISA-95 hierarchy defined for new equipment

**Procedure**:

1. Identify the parent in the ISA-95 hierarchy
   (Enterprise > Site > Area > Line > WorkCell > Machine > Device)
2. Create entity state records for each new level:
   - Line entity via `LineState` (`src/lib/iiot/state/LineState.ts`)
   - Machine entity via `MachineState` (`src/lib/iiot/state/MachineState.ts`)
   - Device entities via `DeviceState` (`src/lib/iiot/state/DeviceState.ts`)
3. Provision edge devices per RB.3.2
4. Verify event flow from new devices to EventDistribution channels

**No NATS reconfiguration needed**: New device subjects are created
automatically within the org's existing wildcard subscription
(`iiot.readings.>` covers all device IDs).

### RB.4.2 Scaling Entity Capacity

**Trigger**: Entity processing latency exceeds SLO, or runner CPU > 80%.

**Procedure**:

1. **Add `@effect/cluster` runner nodes**

   ```
   # Deploy additional runner instances
   # Runners auto-register with RunnerStorage on startup
   # HashRing rebalances automatically
   ```

2. **Monitor shard migration**

   Watch for entity migration events during `HashRing` [EFFECT-HASHRING]
   rebalance:
   - Entity `Scope` teardown on old runners
   - Entity `build()` on new runners
   - Verify no event loss during migration (see FM.9.1.3)

3. **Verify capacity improvement**
   - Entity processing latency returns below SLO
   - Runner CPU utilization below 70% across pool
   - No entity state corruption post-migration

**Scaling guidance**:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Runner CPU | > 80% sustained 5 min | Add runner |
| Entity mailbox depth | > 100 messages | Add runner |
| Entity processing latency p99 | > 500ms | Add runner |
| Runner count | < 3 | Minimum for fault tolerance |

### RB.4.3 NATS Cluster Scaling

**Trigger**: JetStream storage > 75%, or message throughput approaching
server limits.

**Procedure**:

1. **Add NATS server to cluster**

   ```
   # Deploy new NATS server with cluster config
   $ nats-server -c /etc/nats/nats-server.conf
   # Server auto-joins cluster via configured routes
   ```

2. **Verify cluster membership**

   ```
   $ nats server report connections
   $ nats server report jetstream
   ```

3. **Rebalance JetStream streams** (if needed)

   ```
   # Move stream replicas to include new server
   $ nats stream edit [STREAM] --replicas 3
   ```

**Scaling guidance**:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Storage utilization | > 75% | Add server or expand disk |
| CPU utilization | > 70% sustained | Add server |
| Message throughput | > 80% of server capacity | Add server |
| Raft leader elections | > 1 per hour (unexpected) | Investigate network |

### RB.4.4 @effect/cluster Runner Pool Scaling

**Trigger**: Runner pool needs adjustment for capacity or cost optimization.

**Scale-up procedure**:

1. Deploy new runner instance(s)
2. Runners register with `RunnerStorage` automatically
3. `HashRing` rebalance assigns shards to new runners
4. Monitor entity migration (FM.5.2)
5. Verify: entity processing latency improved

**Scale-down procedure** (REQUIRES graceful drain):

1. Mark runner for drain (stop accepting new shard assignments)
2. Wait for in-flight entity operations to complete
3. Runner releases shard locks in `RunnerStorage`
4. `HashRing` reassigns released shards to remaining runners
5. Terminate drained runner
6. Verify: all entities accessible, no orphaned shards

**Normative requirement**: Scale-down MUST use graceful drain. Abrupt
termination causes entity interruption and potential in-flight operation
failure (see FM.5.1).

---

## RB.5 Incident Response

### RB.5.1 Severity Definitions

| Severity | Label | Definition | Response Time | Resolution Target |
|----------|-------|------------|---------------|-------------------|
| **P1** | Critical | Total event distribution failure. No events flowing for multiple orgs. | < 5 min | < 30 min |
| **P2** | High | Single hub failure, degraded delivery, or entity cluster partial failure. | < 15 min | < 1 hour |
| **P3** | Medium | Individual org connectivity issues, single device failures. | < 1 hour | < 4 hours |
| **P4** | Low | Non-critical feature degradation, cosmetic issues, documentation bugs. | < 4 hours | < 24 hours |

### RB.5.2 P1 Runbook: Total Event Distribution Failure

**Symptoms**:
- All EventDistribution channels report zero throughput
- WebSocket subscribers receive no events
- Multiple orgs report service unavailability

**Diagnosis**:

```
Step 1: Check NATS cluster health
  $ nats server check connection
  $ nats server report jetstream
  → If NATS down: proceed to Step 2a
  → If NATS healthy: proceed to Step 2b

Step 2a: NATS cluster recovery
  $ nats server report connections
  # Identify failed servers
  # Restart failed NATS servers
  $ systemctl restart nats-server
  # Verify Raft consensus restored
  $ nats server report jetstream --json | jq '.cluster.leader'
  → Proceed to Step 3

Step 2b: Check @effect/cluster runners
  # Check runner heartbeats in RunnerStorage
  psql> SELECT runner_id, last_heartbeat
        FROM runner_storage
        WHERE last_heartbeat > NOW() - INTERVAL '30 seconds';
  → If no runners alive: restart runner pool
  → If runners alive: proceed to Step 2c

Step 2c: Check EventDistribution service
  # Check if EventDistribution channels are registered
  # Look for channel registration at event-distribution.ts lines 169-199
  # Verify PubSub.unbounded inlets are operational
  # Check ChannelService broadcast outlets
  → If channels missing: restart EventDistribution layer
  → If channels present: check downstream (WebSocket server)

Step 3: Verify recovery
  # Publish test event
  $ nats pub iiot.readings.[TEST_ORG].test-device '{"test": true}'
  # Verify arrival in EventDistribution
  # Verify WebSocket delivery
  # Monitor for 5 minutes to confirm stability
```

**Escalation**: If not resolved within 30 minutes, escalate to on-call
infrastructure lead.

### RB.5.3 P2 Runbook: Single Hub Failure

**Symptoms**:
- One hub's devices report disconnection
- Other hubs operating normally
- Cross-hub event delivery delayed

**Diagnosis**:

```
Step 1: Identify the failed hub
  $ nats server report connections
  # Look for leaf node with zero or degraded connections

Step 2: Check hub NATS leaf node
  $ ssh [HUB_HOST] systemctl status nats-server
  → If down: restart
  → If up: check network connectivity to cloud cluster

Step 3: Check network path
  $ ssh [HUB_HOST] nats server check connection --server [CLOUD_NATS_URL]
  → If unreachable: network partition (see FM.4.3)
  → If reachable: check leaf node configuration

Step 4: Verify hub recovery
  # Monitor leaf node reconnection
  $ nats server report connections --filter [HUB_HOST]
  # Verify device NBIRTH messages resume
  # Monitor cross-hub event delivery convergence
```

### RB.5.4 P3 Runbook: Individual Org Connectivity

**Symptoms**:
- Single org reports service degradation
- Other orgs unaffected
- Org-specific metrics show anomalies

**Diagnosis**:

```
Step 1: Check org's NATS account
  $ nats account info [ORG_ID]
  # Verify: not suspended, within limits

Step 2: Check org's JetStream streams
  $ nats stream info iiot-readings-[ORG_ID]
  $ nats stream info iiot-alarms-[ORG_ID]
  # Verify: streams not full, consumers active

Step 3: Check org's device connectivity
  # Query SparkplugAdapter healthRef for org's devices
  # Check for sustained NDEATH certificates without rebirth

Step 4: Check org's entity instances
  # Verify entity state accessible
  psql> SELECT count(*) FROM org_[ORG_ID].devices WHERE status = 'active';
```

### RB.5.5 P4 Runbook: Non-Critical Degradation

**Symptoms**:
- Feature works but with degraded performance or cosmetic issues
- No data loss, no safety impact

**Response**:
1. Log issue in tracking system
2. Assess root cause at next business day
3. Schedule fix in next maintenance window if applicable
4. Monitor for escalation to higher severity

---

## RB.6 Maintenance Windows

### RB.6.1 NATS Server Rolling Upgrade

**Prerequisites**:
- New NATS server version tested in staging
- Cluster has 3+ servers (Raft requires majority)
- Maintenance window communicated to affected orgs

**Procedure**:

```
# Upgrade one server at a time, never more than minority at once

Step 1: Identify servers and current leader
  $ nats server report jetstream --json | jq '.cluster'

Step 2: Upgrade non-leader server first
  $ ssh [NON_LEADER_HOST]
  $ systemctl stop nats-server
  $ [Install new version]
  $ systemctl start nats-server
  # Verify: server rejoins cluster
  $ nats server check connection --server [NON_LEADER_HOST]:4222

Step 3: Wait for Raft sync
  # Verify server has caught up with Raft log
  $ nats server report jetstream
  # Wait until all streams report full replica count

Step 4: Repeat for remaining non-leader servers

Step 5: Upgrade leader (triggers leader election)
  # Leader step-down triggers clean election
  $ nats server request leader-stepdown
  # Wait for new leader elected
  $ nats server report jetstream --json | jq '.cluster.leader'
  # Upgrade old leader (now follower)
  $ ssh [OLD_LEADER_HOST]
  $ systemctl stop nats-server
  $ [Install new version]
  $ systemctl start nats-server

Step 6: Verify cluster health post-upgrade
  $ nats server check jetstream
  $ nats server report connections
```

**Rollback**: If upgraded server fails to rejoin, restore previous binary
and restart. Raft consensus maintains data integrity during rollback.

### RB.6.2 @effect/cluster Version Upgrade

**Prerequisites**:
- New version tested in staging with entity migration tests
- Runner pool has headroom for rolling restart

**Procedure**:

1. Deploy new runner version alongside existing pool
2. Drain old runners one at a time (RB.4.4 scale-down procedure)
3. Monitor entity migration during each drain
4. Verify: entity state preserved across version boundary
5. Remove all old runners once new pool is stable

**Rollback**: Deploy old version runners, drain new runners.

### RB.6.3 Database Migration

**Prerequisites**:
- Migration scripts tested in staging
- Database backup taken (RB.8.1)
- Maintenance window communicated

**Procedure**:

```
Step 1: Take pre-migration backup
  $ pg_dump -h [DB_HOST] -U [DB_USER] -d [DB_NAME] \
      -F custom -f backup-pre-migration-$(date +%Y%m%d).dump

Step 2: Apply migration in transaction
  psql> BEGIN;
  psql> -- Run migration script
  psql> -- Verify: schema changes applied
  psql> COMMIT;
  -- OR: ROLLBACK if verification fails

Step 3: Verify entity state services
  # Run state service integration tests against migrated schema
  # Verify: all 12 state services can read/write
  # Ref: src/lib/iiot/state/index.ts lines 132-147

Step 4: Monitor for errors
  # Watch application logs for SQL errors
  # Monitor entity handler success rate
```

**Rollback**: `pg_restore` from pre-migration backup.

### RB.6.4 Edge Device Firmware Update Rollout

**Prerequisites**:
- New firmware tested on pilot devices
- OTA update mechanism available
- Rollback firmware version available

**Procedure**:

1. **Canary rollout** (5% of devices)
   - Push firmware to canary group
   - Monitor for 24 hours: NBIRTH/DDATA/NDEATH patterns
   - Verify: no increase in protocol errors, no alias registry corruption

2. **Progressive rollout** (25% -> 50% -> 100%)
   - Each stage: push firmware, monitor 4 hours minimum
   - Gate criteria: error rate < baseline + 1%
   - Abort if: sustained protocol errors or device offline rate > 5%

3. **Verification per device**:
   - NBIRTH received post-update with new firmware version in metrics
   - DDATA messages maintain expected schema
   - SparkplugAdapter alias registry consistent

**Rollback**: OTA push of previous firmware version to affected devices.

---

## RB.7 Capacity Planning

### RB.7.1 When to Add Hub Servers

Monitor these metrics and act when thresholds are exceeded:

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Leaf node connections | > 80% capacity | > 95% | Add hub NATS leaf node |
| Hub-to-cloud bandwidth | > 70% link | > 90% | Upgrade link or add hub |
| Device count per hub | > 5,000 | > 8,000 | Split hub or add capacity |
| Message throughput | > 100K msg/s per hub | > 150K msg/s | Add hub |

**Planning formula**:
```
Required hubs = ceil(total_devices / 5000)
Required bandwidth = total_devices * avg_msg_size * avg_msg_rate * 1.5 (headroom)
```

### RB.7.2 When to Add @effect/cluster Runners

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Runner CPU average | > 70% | > 85% | Add runner |
| Entity mailbox depth p99 | > 50 msgs | > 100 msgs | Add runner |
| Entity processing latency p99 | > 200ms | > 500ms | Add runner |
| Active entities per runner | > 10,000 | > 20,000 | Add runner |

**Planning formula**:
```
Required runners = ceil(total_entities / 10000)
Minimum runners = 3 (fault tolerance)
Target runners = max(required, minimum) * 1.3 (30% headroom)
```

### RB.7.3 Storage Growth Projections

**JetStream storage per org**:

| Event Type | Avg Size | Rate | Daily Volume | 30d Volume |
|------------|----------|------|-------------|------------|
| Readings | 200 bytes | 10/s per device | 172 MB / 100 devices | 5.2 GB |
| Alarms | 500 bytes | 0.1/s per device | 4.3 MB / 100 devices | 129 MB |
| Equipment state | 300 bytes | 0.01/s per device | 0.26 MB / 100 devices | 7.8 MB |
| Invalidations | 100 bytes | 1/s per org | 8.6 MB / org | 259 MB |

**Aggregate planning for 200K orgs** (assuming 100 devices avg per org):

```
Daily readings:  200K orgs * 172 MB = 34.4 TB
30d readings:    200K orgs * 5.2 GB = 1.04 PB
30d alarms:      200K orgs * 129 MB = 25.8 TB
```

**Mitigation**: Stream `max_age` retention prevents unbounded growth.
Readings at 24h retention = 34.4 TB total (manageable across cluster).

### RB.7.4 Network Bandwidth Planning

**Per-hub bandwidth estimation**:

```
Inbound (devices -> hub):
  5000 devices * 10 msg/s * 200 bytes = 10 MB/s = 80 Mbps

Outbound (hub -> cloud):
  Same volume forwarded to cloud cluster
  10 MB/s * 1.2 (protocol overhead) = 96 Mbps

Hub-to-hub (cross-org, if applicable):
  Typically < 10% of total = 10 Mbps
```

**Recommended hub link**: 1 Gbps dedicated for IIoT traffic (10x headroom).

---

## RB.8 Backup and Recovery

### RB.8.1 Database Backup Strategy

**Frequency**:

| Backup Type | Frequency | Retention | Method |
|-------------|-----------|-----------|--------|
| Full backup | Daily | 30 days | `pg_dump` or streaming replica |
| Incremental WAL | Continuous | 7 days | WAL archiving to object storage |
| Pre-migration snapshot | Before each migration | Until migration verified | `pg_dump -F custom` |

**Procedure** (daily full backup):

```
$ pg_dump -h [DB_HOST] -U [DB_USER] -d [DB_NAME] \
    -F custom -Z 5 \
    -f /backups/tmnl-$(date +%Y%m%d-%H%M%S).dump

# Verify backup integrity
$ pg_restore --list /backups/tmnl-[TIMESTAMP].dump | head -20

# Upload to object storage
$ aws s3 cp /backups/tmnl-[TIMESTAMP].dump \
    s3://[BACKUP_BUCKET]/postgres/tmnl-[TIMESTAMP].dump
```

### RB.8.2 JetStream Snapshot Procedures

**Frequency**: Daily for critical streams (alarms, equipment state).

**Procedure**:

```
# Snapshot specific stream
$ nats stream backup iiot-alarms-[ORG_ID] /backups/jetstream/[ORG_ID]/alarms/

# Verify snapshot
$ nats stream restore --dry-run /backups/jetstream/[ORG_ID]/alarms/

# For bulk backup across all orgs:
$ for org in $(nats stream ls --json | jq -r '.[].name'); do
    nats stream backup $org /backups/jetstream/$org/
  done
```

**Retention**: 7 days for stream snapshots. Older snapshots archived to
object storage.

### RB.8.3 Entity State Backup via NATS KV Snapshots

If NATS KV is used for entity state caching:

```
# List KV buckets
$ nats kv ls

# Backup specific bucket
$ nats kv dump [BUCKET_NAME] > /backups/kv/[BUCKET_NAME]-$(date +%Y%m%d).json

# Restore from backup
$ nats kv restore [BUCKET_NAME] < /backups/kv/[BUCKET_NAME]-[DATE].json
```

**Note**: NATS KV keys use dot (`.`) separators, not colons.
Example: `host.abc-123` not `host:abc-123` [NATS-SUBJECTS].

### RB.8.4 Disaster Recovery: Full Metro Rebuild

**Scenario**: Complete loss of cloud NATS cluster and database.

**Prerequisites**:
- Database backup available (RB.8.1)
- JetStream snapshots available (RB.8.2)
- Infrastructure automation scripts (Nix flakes, container images)

**Procedure**:

```
Phase 1: Infrastructure (target: 30 min)
─────────────────────────────────────────
1. Provision new NATS cluster (3+ servers)
   $ nix develop .#tmnl-core
   # Deploy NATS servers via container orchestration
   # Ref: nix/modules/core.nix (nats-server in devShells)

2. Verify NATS cluster health
   $ nats server check connection
   $ nats server check jetstream

Phase 2: Data Restoration (target: 1 hour)
──────────────────────────────────────────
3. Restore database from latest backup
   $ pg_restore -h [NEW_DB_HOST] -U [DB_USER] -d [DB_NAME] \
       /backups/tmnl-[LATEST].dump

4. Restore JetStream streams from snapshots
   $ for stream_dir in /backups/jetstream/*/; do
       nats stream restore $stream_dir
     done

5. Restore NATS account JWTs
   $ nsc push --all

Phase 3: Service Recovery (target: 30 min)
──────────────────────────────────────────
6. Deploy @effect/cluster runner pool
   # Runners connect to new NATS cluster
   # EntityManager re-creates entities on first message

7. Deploy WebSocket server layer
   # Mount at /ws/iiot
   # Ref: src/lib/iiot/realtime/websocket-server.ts

8. Deploy EventDistribution
   # 4 channels re-registered
   # Ref: src/lib/iiot/realtime/event-distribution.ts lines 169-199

Phase 4: Verification (target: 30 min)
──────────────────────────────────────
9. Run health verification (RB.3.3)
10. Verify org accounts accessible
11. Verify device connections resuming
12. Monitor event flow for 15 min stability
```

**RTO (Recovery Time Objective)**: 2.5 hours
**RPO (Recovery Point Objective)**: Last backup (daily) + WAL replay (continuous)

---

## RB.9 Compliance Operations

### RB.9.1 Audit Log Review Procedures

**Frequency**: Monthly for routine review; on-demand for incidents.

**What to review**:

| Audit Category | Source | Review Frequency |
|---------------|--------|------------------|
| Entity state changes | Event journal (JetStream) | Monthly |
| Cross-org data sharing | NATS Account export logs | Monthly |
| User authentication | NATS JWT issuance logs | Monthly |
| Work order lifecycle | WorkOrderEntity audit trail [FDA-CFR11] | Per work order completion |
| Alarm acknowledgments | AlarmEntity state transitions [ISA-18.2] | Weekly |
| Trust score changes | Trust service event log | Monthly |

**Procedure**:

```
Step 1: Extract audit events for review period
  $ nats stream view iiot-alarms-[ORG_ID] \
      --start-time [START] --end-time [END] \
      --count 1000

Step 2: Verify alarm lifecycle compliance (ISA-18.2)
  # Every alarm MUST follow: Triggered → Acknowledged → Cleared
  # Check for: unacknowledged alarms older than SLA
  # Check for: cleared alarms without acknowledgment (violation)
  # Ref: src/lib/iiot/machines/AlarmMachine.ts (ISA-18.2 state graph)

Step 3: Verify work order compliance (FDA 21 CFR Part 11)
  # Every work order state transition MUST have:
  # - Operator identity (electronic signature)
  # - Timestamp
  # - Reason for change
  # Ref: src/lib/iiot/entity/WorkOrderEntity.ts (dual-write audit trail)

Step 4: Generate compliance report
  # Aggregate findings into standard report format
  # Flag violations for remediation
```

### RB.9.2 Data Retention Enforcement

**Normative requirement**: Data retention MUST comply with the org's
jurisdictional requirements. The system provides configurable retention
at the JetStream stream level.

| Data Type | Minimum Retention | Maximum Retention | Enforcement |
|-----------|-------------------|-------------------|-------------|
| Sensor readings | Per org policy | 7 years (FDA) | Stream `max_age` |
| Alarm events | 1 year [ISA-18.2] | 7 years [FDA-CFR11] | Stream `max_age` |
| Work order records | 2 years | Indefinite [FDA-CFR11] | Database retention policy |
| Equipment state | 1 year | 5 years | Stream `max_age` |
| Audit logs | 3 years | 7 years | Immutable append-only store |

**Procedure**:

```
# Review current retention settings
$ nats stream info iiot-alarms-[ORG_ID] --json | jq '.config.max_age'

# Update retention for compliance
$ nats stream edit iiot-alarms-[ORG_ID] --max-age 8760h  # 1 year

# Verify purge is not running on compliance-protected streams
$ nats stream info iiot-alarms-[ORG_ID] --json | jq '.state'
```

### RB.9.3 Right to Erasure Execution

**Trigger**: Org requests data deletion under GDPR Article 17 or equivalent.

**Procedure**:

```
Step 1: Identify all data for the requesting org
  - NATS Account: [ORG_ID]
  - JetStream streams: iiot-*-[ORG_ID]
  - Database schema: org_[ORG_ID]
  - Entity state in @effect/cluster
  - Cross-org references (exports, marketplace listings)

Step 2: Revoke cross-org data sharing
  $ nsc edit account [ORG_ID] --rm-export "iiot.*.>"
  # Wait for export revocation propagation

Step 3: Purge JetStream streams
  $ nats stream purge iiot-readings-[ORG_ID] --force
  $ nats stream purge iiot-alarms-[ORG_ID] --force
  $ nats stream purge iiot-equipment-[ORG_ID] --force
  $ nats stream purge iiot-invalidations-[ORG_ID] --force

Step 4: Delete database records
  psql> DROP SCHEMA org_[ORG_ID] CASCADE;

Step 5: Delete NATS account
  $ nsc delete account --name [ORG_ID]

Step 6: Verify deletion
  $ nats account info [ORG_ID]
  # Expect: account not found
  psql> SELECT schema_name FROM information_schema.schemata
        WHERE schema_name = 'org_[ORG_ID]';
  # Expect: no rows

Step 7: Generate erasure certificate
  # Document: what was deleted, when, by whom
  # Retain certificate for compliance records (exempt from erasure)
```

**Exceptions**: Audit logs related to cross-org interactions MAY be retained
in anonymized form for regulatory compliance, even after org erasure. The
org's identifying information MUST be replaced with a one-way hash.

### RB.9.4 Regulatory Report Generation

**FDA 21 CFR Part 11 reports**:

```
# Work order audit trail for specific work order
psql> SELECT * FROM org_[ORG_ID].work_order_audit
      WHERE work_order_id = [WO_ID]
      ORDER BY timestamp ASC;

# Electronic signature verification
psql> SELECT wo.id, wo.state, audit.operator_id, audit.signature_hash,
             audit.timestamp, audit.reason
      FROM org_[ORG_ID].work_orders wo
      JOIN org_[ORG_ID].work_order_audit audit ON wo.id = audit.work_order_id
      WHERE wo.completed_at BETWEEN [START] AND [END];
```

**ISA-18.2 alarm management reports**:

```
# Alarm rate analysis (alarms per hour)
$ nats stream info iiot-alarms-[ORG_ID] --json \
    | jq '.state.messages / (.state.last_ts - .state.first_ts) * 3600'

# Unacknowledged alarm duration analysis
# (requires application-level query against AlarmState)
psql> SELECT alarm_id, triggered_at,
             COALESCE(acknowledged_at, NOW()) - triggered_at AS time_to_ack
      FROM org_[ORG_ID].alarms
      WHERE triggered_at > NOW() - INTERVAL '30 days'
      ORDER BY time_to_ack DESC;
```

---

## RB.10 Codebase Grounding

### RB.10.1 Key Files for Operational Procedures

| File | Operational Domain | Relevant Procedures |
|------|--------------------|---------------------|
| `src/lib/iiot/realtime/event-distribution.ts` | Event channels | RB.3.3 health check, RB.5.2 P1 diagnosis, RB.8.4 DR restoration |
| `src/lib/iiot/realtime/holonet-bridge.ts` | NATS transport | RB.5.3 hub failure, RB.6.1 NATS upgrade verification |
| `src/lib/iiot/realtime/websocket-server.ts` | WebSocket delivery | RB.3.3 health check, RB.8.4 DR restoration |
| `src/lib/iiot/adapters/sparkplug-adapter.ts` | Edge device connectivity | RB.3.2 device provisioning, RB.6.4 firmware update |
| `src/lib/iiot/adapters/ingestion-service.ts` | Ingestion pipeline | RB.3.3 health check (`healthCheck` method) |
| `src/lib/iiot/entity/EntityStack.ts` | Entity composition | RB.3.1 org onboarding (lazy entity creation) |
| `src/lib/iiot/state/index.ts` | State services | RB.3.1 database provisioning (12 state services) |
| `src/lib/iiot/entity/AlarmEntity.ts` | Alarm lifecycle | RB.9.1 audit review (ISA-18.2 compliance) |
| `src/lib/iiot/entity/WorkOrderEntity.ts` | Work order lifecycle | RB.9.1 audit review (FDA 21 CFR Part 11) |
| `src/lib/iiot/machines/AlarmMachine.ts` | Alarm state graph | RB.9.1 alarm lifecycle compliance |
| `src/lib/iiot/workflow/AlarmLifecycleWorkflow.ts` | Workflow retry | RB.5.2 P1 diagnosis (Activity retry) |
| `nix/modules/core.nix` | Dev environment | RB.8.4 infrastructure provisioning (nats-server) |
| `src/lib/streams/constructs/ChannelService.ts` | Channel management | RB.5.2 P1 diagnosis (channel health) |

### RB.10.2 Infrastructure Configuration Files

| File / Module | Purpose | Relevant Procedures |
|---------------|---------|---------------------|
| `nix/modules/core.nix` | Core dev shell (includes `nats-server`) | RB.8.4 Phase 1 |
| `nix/modules/tauri.nix` | Tauri dev shell | N/A (desktop app) |
| `nix/modules/rust.nix` | Rust toolchain (includes `nats-server`) | RB.8.4 Phase 1 |
| `nix/default.nix` | Flake module composition | All infrastructure procedures |

### RB.10.3 Monitoring Endpoints

The following services expose health and metrics information referenced
by operational procedures:

| Service | Health Check | Metrics | Codebase Reference |
|---------|-------------|---------|-------------------|
| IngestionService | `healthCheck` method | `IngestionHealth` struct | `src/lib/iiot/adapters/ingestion-service.ts` line 92 |
| SparkplugAdapter | `healthRef` (Ref-backed) | `connected`, `errorCount` | `src/lib/iiot/adapters/sparkplug-adapter.ts` line 416 |
| EventDistribution | `Ref<DistributionMetrics>` | Per-channel publish counts, subscriber counts | `src/lib/iiot/realtime/event-distribution.ts` line 267 |
| NATS cluster | `nats server check` CLI | `$SYS.SERVER.*.STATSZ` | External (NATS server) |
| PostgreSQL | `SELECT 1` health probe | `pg_stat_activity` | External (database) |

---


---

<!-- Source: rfc-section-migration-upgrade.md -->

## MIG.1 Scope

This section specifies migration and upgrade procedures for organizations
joining the TMNL manufacturing commons or evolving their deployment. It covers
brownfield integration with existing industrial systems, tier promotion paths,
schema evolution, zero-downtime edge agent upgrades, and rollback procedures.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this section are to be
interpreted as described in [RFC-2119].

**Cross-references**:
- Section 15 (Edge-First Architecture) defines the four-tier capability model
  and brownfield integration phases [15.6]
- Section 16 (Deployment Topology) defines NATS topology and cluster profiles
- Section DX (Developer Experience) defines SDK and CLI tooling
- Section FM (Failure Modes) defines recovery procedures referenced by rollback

---

## MIG.2 Conventions

| Term | Definition |
|------|-----------|
| **Brownfield** | Existing industrial installation with SCADA, PLC, or historian infrastructure |
| **Greenfield** | New installation without legacy systems |
| **Tier promotion** | Upgrading edge deployment from lower to higher capability tier (T0-T3) |
| **Schema version** | Integer version embedded in event payloads (`schemaVersion` field) |
| **Rolling upgrade** | Replacing edge agent instances one at a time with zero aggregate downtime |
| **Strangler fig** | Incremental replacement pattern: observe, augment, replace [FOWLER-POEAA] |

---

## MIG.3 Brownfield Integration

### MIG.3.1 The Strangler Fig Pattern

Organizations with existing SCADA, MES, or historian infrastructure MUST be
able to adopt the platform incrementally without disrupting production. The
platform implements the strangler fig pattern [FOWLER-POEAA] in three phases:

```
Phase 1: OBSERVE         Phase 2: AUGMENT          Phase 3: REPLACE
(read-only, 1-2 weeks)   (side-by-side, 2-8 weeks) (controlled cutover)

Existing SCADA            Existing SCADA             PLCs/Sensors
  (unchanged)               (still primary)              │
      │                         │                         ▼
      ▼                         ▼                    Sparkplug Adapter
Sparkplug Adapter         Sparkplug Adapter              │
      │                         │                         ▼
      ▼                         ▼                    NATS + Entity System
   NATS                  NATS + Entity System          (primary)
      │                    (shadow mode)                  │
      ▼                         │                         ▼
T0 Dashboard              T0/T2 Dashboard             Operators
(read-only overlay)       (analytics + alarms)
```

**Phase constraints**:

- Phase 1 MUST NOT require changes to existing PLC/SCADA configuration. The
  `SparkplugAdapterLive` (`lib/iiot/adapters/sparkplug-adapter.ts:406-495`)
  passively subscribes to existing MQTT topics as a read-only consumer.
- Phase 2 MUST NOT interfere with existing control loops. Entity processing
  operates in observation mode only.
- Phase 3 cutover is organization-controlled. The platform MUST NOT require
  organizations to decommission legacy systems. Organizations MAY remain in
  Phase 2 indefinitely (dual-system operation).

### MIG.3.2 Protocol Adapter Matrix

Implementations MUST provide protocol adapters conforming to the
`IngestionAdapter` interface (`lib/iiot/adapters/ingestion.ts:25-36`). Each
adapter normalizes protocol-specific telemetry into `IngestedReading` instances:

| Existing Protocol | Adapter | Min Tier | Integration Method |
|-------------------|---------|----------|-------------------|
| Sparkplug B (MQTT) | `SparkplugAdapterLive` | T1 | Direct MQTT subscription [SPARKPLUG-B] |
| OPC UA | `OpcUaAdapter` (planned) | T2 | UA client Browse + MonitoredItems [OPC-UA-14] |
| Modbus TCP/RTU | `ModbusAdapter` (planned) | T2 | Polling with configurable interval |
| BACnet/IP | `BacnetAdapter` (planned) | T2 | BACnet subscription |
| Proprietary PLC | Custom adapter | T2 | Organization-specific development |
| CSV/Historian export | `FileAdapter` (planned) | T1 | File watch + batch import |

All adapters MUST implement the `IngestionAdapter` service interface:

```typescript
// lib/iiot/adapters/ingestion.ts — protocol-agnostic interface
interface IngestionAdapterShape {
  readonly protocol: string
  readonly subscribe: Effect<Stream<IngestedReading, IngestionError>>
  readonly healthCheck: Effect<IngestionHealth, IngestionError>
}
```

### MIG.3.3 Sparkplug-B Migration from Existing MQTT Brokers

Organizations with existing MQTT brokers SHOULD migrate to Sparkplug-B
semantics for automatic device discovery. The migration path:

1. **Assess**: Identify existing MQTT topic structure and payload format.
2. **Bridge**: Deploy T1 edge agent with `SparkplugAdapterConfig`
   (`lib/iiot/adapters/sparkplug-adapter.ts:56-68`) pointing to the existing
   MQTT broker URL.
3. **Discover**: The adapter subscribes to `spBv1.0/{groupId}/#` topics.
   NBIRTH/DBIRTH messages register device aliases via `makeAliasRegistry`
   (`lib/iiot/adapters/sparkplug-adapter.ts:79-111`).
4. **Validate**: Confirm DDATA messages flow through `processMessage`
   (`lib/iiot/adapters/sparkplug-adapter.ts:228-344`) and produce
   `IngestedReading` instances.
5. **Consolidate**: Once validated, configure additional `groupIds` to
   cover all Sparkplug groups on the broker.

For non-Sparkplug MQTT installations, organizations MUST either:
- Deploy a Sparkplug-compliant edge node (e.g., Eclipse Tahu, Cirrus Link)
  that bridges raw MQTT to Sparkplug-B format, OR
- Implement a custom `IngestionAdapter` that normalizes their MQTT topic
  structure to `IngestedReading`.

### MIG.3.4 OPC UA Brownfield Integration

Organizations with OPC UA servers [OPC-UA-14] follow an analogous pattern:

1. **Discover**: The OPC UA adapter browses the server address space via
   mDNS or configured endpoint URL.
2. **Map**: OPC UA node IDs map to TMNL entity IDs:
   ```
   OPC UA:  ns=2;s=PLC1.Motor1.Temperature
   TMNL:    Sensor { deviceId: "PLC1-Motor1-Temperature" }
   ```
3. **Subscribe**: MonitoredItem subscriptions provide continuous data change
   notifications, normalized to `IngestedReading`.
4. **Coexist**: The OPC UA server continues serving existing HMI/SCADA
   clients. The adapter adds a parallel data consumer without displacement.

### MIG.3.5 Modbus and Proprietary Protocol Integration

For Modbus TCP/RTU and proprietary PLC protocols, the adapter MUST:

- Poll at configurable intervals (RECOMMENDED: 1-10 seconds for process data)
- Map register addresses to `IngestedReading` topics via configuration
- Handle register data type conversion (INT16, FLOAT32, etc.)
- Report connection health via `healthCheck`

The polling adapter template follows the same `IngestionAdapter` interface,
ensuring uniform pipeline integration through `IngestionServiceLive`
(`lib/iiot/adapters/ingestion-service.ts:184-188`).

---

## MIG.4 Tier Promotion Paths

### MIG.4.1 Promotion Overview

Edge deployments progress through capability tiers as organizations scale.
Each promotion adds Layer composition capabilities without requiring a full
redeployment [EFFECT-LAYER]:

```
T0 ──► T1 ──► T2 ──► T3
 │       │       │       │
 │       │       │       └── + HolonetBridgeLive, HttpApiLayer
 │       │       └────────── + SingleRunner, EntityHandlers, EventDistribution, WebSocket
 │       └────────────────── + SparkplugPipelineLayer (ingestion + alarm detection)
 └────────────────────────── Browser-only (WebSocket consumer)
```

### MIG.4.2 T0 to T1: Adding Protocol Bridge

**Prerequisites**: Physical hardware (Raspberry Pi 4/5 or equivalent SBC,
$50-200) and network access to MQTT broker or OPC UA server.

**Procedure**:

1. Flash edge agent image to microSD/eMMC (Nix-based: `nix/default.nix`
   imports `nix/modules/sparkplug.nix` for Sparkplug tooling).
2. Configure `SparkplugAdapterConfig` with broker URL and group IDs.
3. Connect to network. The agent boots with the T1 Layer stack:
   ```
   SparkplugAdapterLive + ReadingProcessorLive + AlarmDetectorLive
   = SparkplugPipelineLayer (lib/iiot/adapters/ingestion-service.ts:297-322)
   ```
4. Verify readings via `nats sub "iiot.readings.>"` from the NATS CLI
   (`nix/modules/core.nix` provides `natscli` in the dev shell).

**Data migration**: None required. T0 has no local state.

**Rollback**: Power off the T1 device. T0 browser clients continue functioning
against any remaining T2/T3/cloud endpoints.

### MIG.4.3 T1 to T2: Adding Entity Processing

**Prerequisites**: Hardware upgrade to industrial gateway ($500-2,000) with
4+ GB RAM and persistent storage.

**Procedure**:

1. Deploy T2 image with expanded Layer stack:
   ```
   SparkplugPipelineLayer
   + SingleRunner.layer       ← local entity processing
   + EntityHandlersLayer      ← asset entity state machines
   + EventDistributionLayer   ← 4-channel event broadcast
   + WebSocketServerLayer     ← local WebSocket for T0 clients
   ```
2. Initialize JetStream domain for local event persistence.
3. Replay any buffered readings from T1's NATS leaf node into the entity
   system. The T1 node SHOULD have been configured with JetStream retention
   to buffer readings during the transition window.
4. Validate entity state convergence: compare entity state snapshots before
   and after promotion.

**Data migration**:

- **JetStream streams**: T1 MAY have a local JetStream domain with buffered
  readings. These MUST be replayed into T2's entity system before the T1
  buffer is decommissioned.
- **NATS KV state**: Host application state from `makeStateRegistryKV`
  (`lib/iiot/adapters/sparkplug-adapter.ts:191-207`) persists in the
  `iiot-state` KV bucket. This MUST be migrated to the T2's KV store.
- **Entity snapshots**: Not applicable (T1 has no entity state).

**Rollback**: Revert Layer stack to T1 configuration. Entity state is lost
but readings continue flowing.

### MIG.4.4 T2 to T3: Adding Cluster and Federation

**Prerequisites**: Rack server or VM cluster ($5,000-50,000+) with 16+ GB
RAM and multi-core CPU.

**Procedure**:

1. Deploy T3 image with full Layer stack including cluster:
   ```
   SparkplugPipelineLayer
   + SocketRunner.layer({ host: "0.0.0.0", port: 34437 })  ← cluster runner
   + EntityHandlersLayer
   + EventDistributionLayer
   + WebSocketServerLayer
   + HolonetBridgeLive     ← cross-org federation
   + HttpApiLayer           ← REST API for integrations
   ```
2. Migrate entity shards from `SingleRunner` to `SocketRunner`. The
   `@effect/cluster` HashRing [EFFECT-HASHRING] handles shard rebalancing.
3. Configure NATS super-cluster leaf node connection to the metropolitan hub.
4. Enable HolonetBridge for cross-org event federation.

**Data migration**:

- **Entity state**: @effect/cluster performs automatic shard migration via
  HashRing. Entity state is preserved during runner transition (see FM.9.1.3
  chaos engineering scenario: zero event loss during migration).
- **JetStream streams**: T2's JetStream domain is promoted to a full
  super-cluster participant. Existing stream data is retained.

**Rollback**: Revert to `SingleRunner.layer`. Cluster shards collapse back
to local processing. Federation connections are dropped gracefully.

---

## MIG.5 Schema Evolution and Backward Compatibility

### MIG.5.1 Event Schema Versioning

All event payloads MUST include a `schemaVersion` integer field. The current
codebase uses `schemaVersion: 1` throughout the event system
(`lib/iiot/services/l2/alarm-event-emitter.ts:122,181,229`).

**Version contract**:

- Consumers MUST accept events with `schemaVersion <= currentVersion`.
- Producers MUST emit events at the latest `schemaVersion`.
- Schema changes MUST be backward-compatible within a major version:
  new fields MAY be added; existing fields MUST NOT be removed or renamed.

### MIG.5.2 Effect Schema Transformation Pipeline

Schema evolution leverages Effect Schema's transformation capabilities
[EFFECT-SCHEMA]. For version migrations:

```typescript
// Version 1 → Version 2 transformation
const AlarmEventV1 = Schema.Struct({
  _tag: Schema.Literal("AlarmEvent"),
  schemaVersion: Schema.Literal(1),
  alarmId: Schema.String,
  severity: Schema.Literal("low", "medium", "high", "critical"),
  // ...
})

const AlarmEventV2 = Schema.Struct({
  _tag: Schema.Literal("AlarmEvent"),
  schemaVersion: Schema.Literal(2),
  alarmId: Schema.String,
  severity: Schema.Literal("low", "medium", "high", "critical"),
  priority: Schema.optional(Schema.Number),  // NEW in v2
  // ...
})

// Decoder accepts both versions
const AlarmEventAny = Schema.Union(AlarmEventV1, AlarmEventV2)
```

### MIG.5.3 JetStream Stream Migration

When schema versions change, JetStream streams containing historical events
MUST remain readable. Implementations MUST follow these rules:

- **Additive changes** (new optional fields): No stream migration required.
  Existing events decode correctly with the new schema (missing fields default
  to `undefined`).
- **Structural changes** (field renames, type changes): Deploy a stream
  transformer that reads from the old stream and writes to a new stream with
  transformed payloads. The old stream MUST be retained for the configured
  retention period.
- **Breaking changes**: MUST NOT be performed on production streams without
  a major version bump. Breaking changes require a new stream name
  (e.g., `iiot-events-v2`) and a parallel consumer migration period.

### MIG.5.4 NATS KV Schema Migration

KV buckets (e.g., `iiot-state` used by `makeStateRegistryKV`) follow the
same versioning discipline:

- KV entries SHOULD include a version field in the stored schema
  (`HostStateEntry` at `lib/iiot/adapters/sparkplug-adapter.ts:172-175`).
- Migrations are performed by reading all keys, transforming values, and
  writing back. NATS KV revision numbers provide optimistic concurrency
  control during migration.

---

## MIG.6 Zero-Downtime Edge Agent Upgrades

### MIG.6.1 Rolling Upgrade Pattern

Edge agents MUST support zero-downtime upgrades. The platform uses a
rolling upgrade strategy:

```
Time ──────────────────────────────────────────────────►

Agent v1.2 ████████████████████████░░░░░░░░░░░░  (draining)
                                    ▲
                                    │ health check passes
                                    │
Agent v1.3 ░░░░░░░░░░░░░░░░░░░░░░░░████████████  (receiving)

NATS subscription: continuous — leaf node handles reconnect
JetStream: no data loss — consumer ack-wait covers the gap
```

**Procedure for T1 (single-instance)**:

1. Deploy new agent binary alongside the running instance.
2. Start new instance on a different port. Wait for health check to pass.
3. Redirect NATS leaf node connection to new instance.
4. Drain old instance: stop accepting new subscriptions, flush pending acks.
5. Terminate old instance after drain completes.

**Procedure for T2/T3 (entity processing)**:

1. For `SingleRunner` (T2): Stop entity processing, upgrade agent, restart.
   Entity state is persisted in JetStream; entities resume from last
   checkpoint on restart.
2. For `SocketRunner` (T3): Perform rolling upgrade across cluster nodes.
   @effect/cluster rebalances shards as nodes leave and rejoin
   [EFFECT-HASHRING]. At least one node MUST remain available throughout.

### MIG.6.2 Nix-Based Reproducible Deployments

Edge agent builds SHOULD use Nix for reproducible, atomic deployments. The
project's Nix configuration (`nix/default.nix`) composes modules for each
deployment concern:

| Module | Purpose |
|--------|---------|
| `nix/modules/core.nix` | Base tooling: git, natscli, nats-server, ripgrep |
| `nix/modules/sparkplug.nix` | Sparkplug adapter scripts and test tooling |
| `nix/modules/tauri.nix` | Desktop application build (T0/T2 with UI) |
| `nix/modules/embedded.nix` | Embedded/constrained device toolchains |
| `nix/modules/tests.nix` | Test suite configuration |

Nix provides atomic profile switching: the new version is built in isolation,
then a single `nix-env --switch-generation` atomically activates it. Rollback
is `nix-env --rollback` -- instant, no rebuild required.

### MIG.6.3 Canary Deployment for Multi-Org Updates

Platform-wide updates (affecting the NATS super-cluster or shared
infrastructure) MUST use canary deployment:

1. **Canary ring** (1% of organizations): Deploy update to a small subset.
   Monitor for 24 hours.
2. **Early adopter ring** (10%): Expand deployment. Monitor for 48 hours.
3. **General availability** (100%): Roll out to all organizations.

Each ring MUST meet the following gate criteria before promoting:
- Zero increase in error rate (compared to baseline)
- All SLOs within budget (see Section MON)
- No entity state corruption detected (see Section OBS)

---

## MIG.7 Rollback Procedures

### MIG.7.1 Edge Agent Rollback

| Tier | Rollback Method | Data Impact |
|------|----------------|-------------|
| T0 | Browser cache clear + reload | None (stateless) |
| T1 | Nix generation rollback or binary swap | Buffered readings may replay |
| T2 | Nix rollback + entity checkpoint restore | Entities resume from last checkpoint |
| T3 | Rolling cluster rollback (node-by-node) | Shard rebalancing via HashRing |

### MIG.7.2 Rollback Decision Criteria

Operators MUST initiate rollback when ANY of the following conditions persist
for more than 15 minutes after deployment:

- Error rate exceeds 2x the pre-deployment baseline
- Entity state divergence detected between replicas
- JetStream consumer lag exceeds 60 seconds (G-1 violation)
- Health check failure rate exceeds 5% of monitored endpoints

### MIG.7.3 Schema Rollback

Schema version rollback is constrained:

- **Additive changes** (v1 -> v2 added optional fields): Rollback is safe.
  v1 consumers ignore unknown fields.
- **Non-additive changes**: Rollback requires the v1 consumer to handle v2
  events gracefully. Implementations MUST test forward compatibility before
  deploying schema changes.
- **JetStream streams**: Historical events at the newer schema version remain
  in the stream. Rolled-back consumers MUST use `Schema.Union` to decode
  both versions (see MIG.5.2).

### MIG.7.4 Tier Demotion

Tier demotion (e.g., T3 -> T2) is the inverse of promotion:

1. Disable higher-tier Layer components (HolonetBridge, HttpApi).
2. Collapse cluster runner to single runner.
3. Disconnect NATS super-cluster leaf node (operate locally).

Demotion MUST preserve local entity state and JetStream streams. Cross-org
federation state is lost but can be re-established on re-promotion.

---

## MIG.8 Codebase Grounding

| Concept | Implementation | File Reference |
|---------|---------------|----------------|
| Protocol adapter interface | `IngestionAdapter` service + `IngestedReading` schema | `lib/iiot/adapters/ingestion.ts:25-36` |
| Sparkplug adapter | `SparkplugAdapterLive`, `SparkplugAdapterKVLive` | `lib/iiot/adapters/sparkplug-adapter.ts:406-595` |
| Sparkplug config | `SparkplugAdapterConfig` schema | `lib/iiot/adapters/sparkplug-adapter.ts:56-68` |
| Alias registry | `makeAliasRegistry` (metric alias resolution) | `lib/iiot/adapters/sparkplug-adapter.ts:79-111` |
| KV state registry | `makeStateRegistryKV` (NATS KV persistence) | `lib/iiot/adapters/sparkplug-adapter.ts:191-207` |
| Pipeline orchestrator | `IngestionServiceLive` | `lib/iiot/adapters/ingestion-service.ts:184-188` |
| Sparkplug pipeline | `SparkplugPipelineLayer` (full adapter stack) | `lib/iiot/adapters/ingestion-service.ts:297-322` |
| Dev pipeline | `IngestionPipelineDevLayer` (mock adapter) | `lib/iiot/adapters/ingestion-service.ts:244-269` |
| Schema versioning | `schemaVersion: 1` in event payloads | `lib/iiot/services/l2/alarm-event-emitter.ts:122` |
| Nix modules | Core, sparkplug, tauri, embedded, tests | `nix/default.nix`, `nix/modules/*.nix` |
| Retry schedule | Exponential backoff for reconnection | `lib/iiot/adapters/sparkplug-adapter.ts:383-386` |
| Message processing | `processMessage` (all Sparkplug message types) | `lib/iiot/adapters/sparkplug-adapter.ts:228-344` |

---

## MIG.9 References

| Key | Reference |
|-----|-----------|
| [RFC-2119] | Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels." BCP 14, RFC 2119, 1997. |
| [SPARKPLUG-B] | Eclipse Foundation. "Eclipse Sparkplug Specification v3.0.0." 2023. |
| [OPC-UA-14] | OPC Foundation. "OPC Unified Architecture -- Part 14: PubSub." IEC 62541-14:2020. |
| [EFFECT-LAYER] | Effect Contributors. "effect/Layer -- Dependency Injection with Memoization and Scoping." |
| [EFFECT-SCHEMA] | Effect Contributors. "effect/Schema -- Runtime Validation with Type-Level Inference." |
| [EFFECT-HASHRING] | Effect Contributors. "effect/HashRing -- Consistent Hashing Implementation." |
| [FOWLER-POEAA] | Fowler, M. *Patterns of Enterprise Application Architecture.* Addison-Wesley, 2002. |
| [ISA-95-1] | ANSI/ISA-95.00.01-2010 (IEC 62264-1). "Enterprise-Control System Integration -- Part 1." |

---

<!-- Source: rfc-section-conformance-testing.md -->

## CT.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this section are to be
interpreted as described in [RFC2119] and [RFC8174].

---

## CT.2 Conformance Levels

This RFC defines three conformance levels. Each level subsumes the requirements
of the preceding level.

### CT.2.1 Level 1: Single-Organization Conformance

An implementation MUST satisfy architectural principles P1 through P8 (see
Section 3) and ordering guarantees G-1 through G-7 (see Section X.3) to claim
single-organization conformance. This level supports:

- ISA-95 hierarchy navigation at depths 1 through 9
- Real-time entity state subscriptions via WebSocket [EFFECT-RPCSERVER]
- Event sourcing with temporal queries for alarm, equipment state, and work
  order entities [EVENT-SOURCING]
- Bounded-latency delivery per the SLO table in MON.4.1
- Edge-cloud partition tolerance (G-6) with local continuity
- Idempotent event processing (G-7) via content-addressed message IDs

**Required features** (all MUST):

| Feature | Verification |
|---------|-------------|
| Per-entity sequential ordering (G-1) | Monotonic sequence numbers per entity stream |
| Session consistency (G-4) | Read-your-writes within a single WebSocket connection |
| Bounded staleness (G-5) | Latency within ISA-95 level thresholds (L0: 100ms, L1: 250ms, L2: 1s) |
| Edge partition tolerance (G-6) | Events buffered locally during 24h partition, replayed on reconnection |
| Idempotent processing (G-7) | Duplicate message IDs rejected without side effects |
| ISA-18.2 alarm lifecycle | 6 alarm states, valid transitions, shelve duration limits [EEMUA-191] |
| Effect Schema validation | All entity events decode without error through Schema.decodeUnknown |

**Optional features** (MAY):

| Feature | Note |
|---------|------|
| Cross-entity causal ordering (G-3) | Requires `causedBy` metadata; SHOULD for full SA support |
| Variable-depth hierarchy (> 5 levels) | Required only for enterprise deployments |
| Benchmark suite execution | RECOMMENDED for production deployments |

### CT.2.2 Level 2: Manufacturing Commons Conformance

An implementation MUST satisfy principles P1 through P12 and guarantees G-1
through G-8 to claim manufacturing commons conformance. This level adds:

| Feature | Verification |
|---------|-------------|
| Cross-org eventual consistency (G-8) | Bounded staleness of 60 seconds across tenant boundaries |
| NATS account isolation [NATS-ACCOUNTS] | Zero subject namespace leakage between organizations |
| Anti-corruption layer [ANTI-CORRUPTION] | Redacted signals pass schema validation; no raw entity state crosses boundary |
| Variable-depth ISA-95 hierarchy (P9) | Telescoping from 3 to 9 levels without entity ID changes |
| Data sovereignty mediation (P10) | Export rules enforced per NATS account; cross-org signals carry `networkTimestamp` |
| Commons governance observability (P12) | Aggregate metrics available without exposing per-org internals |

### CT.2.3 Partial Conformance

Implementations MAY claim partial conformance by declaring which principles and
guarantees are satisfied. The minimum viable sets are:

| Deployment Scenario | Required Principles | Required Guarantees |
|--------------------|--------------------|-------------------|
| Single machine monitoring | P1, P5 | G-1, G-5 |
| Small shop (Earl persona) | P1, P3, P5, P9 | G-1, G-4, G-5, G-7 |
| Contract manufacturer (Maria persona) | P1-P6, P9 | G-1 through G-7 |
| Enterprise (Boeing persona) | P1-P8 | G-1 through G-7 |
| Manufacturing commons | P1-P12 | G-1 through G-8 |

Partial conformance claims MUST enumerate satisfied requirements explicitly.
An implementation MUST NOT claim a conformance level if any MUST requirement
at that level is unmet.

---

## CT.3 Test Suite Requirements

Implementations MUST provide a test suite organized into five tiers. Each tier
targets a distinct failure class and MUST be executable independently.

### CT.3.1 Tier 1: Unit Tests (Schema & Pure Logic)

Unit tests validate Effect Schema decode/encode roundtrips, state machine
transition logic, and pure functions with no external dependencies.

**Requirements**:
- Every `Schema.TaggedStruct` and `Schema.TaggedClass` in the entity domain
  MUST have a decode/encode roundtrip test [EFFECT-SCHEMA]
- Every state machine transition function MUST have exhaustive valid/invalid
  transition tests
- ISA-95 hierarchy validation (`isValidParentChild`) MUST be tested for all
  9 entity types

**Codebase reference**: Unit tests at
`src/lib/iiot/__tests__/schemas/*.test.ts` and
`src/lib/iiot/__tests__/schemas/area.test.ts` through `site.test.ts`
demonstrate the current schema validation pattern.

**Framework**: Vitest with `@effect/vitest` [EFFECT-VITEST]. Configuration at
`vitest.config.ts` (lines 10-48): `happy-dom` environment, `pool: "forks"`,
`singleFork: true` for sequential integration execution.

### CT.3.2 Tier 2: Property-Based Tests (Invariants)

Property-based tests use fast-check generators to explore the state space of
ISA-95 hierarchies, state machine transitions, and event schemas.

**Requirements**:
- Hierarchy invariants MUST be validated: valid parent-child relationships
  across all 9 entity types, path depth bounds (1-9 segments), and segment
  uniqueness within a path
- State machine invariants MUST hold: reachability (every state reachable
  from initial via valid transitions), no dead states (every non-terminal
  state has at least one outbound transition), and determinism (each
  state + event pair yields exactly one next state)
- OEE calculation invariants MUST hold: `0 <= OEE <= 1`,
  `OEE = Availability * Performance * Quality`, and monotonic degradation
  under fault injection
- Schema roundtrip invariants MUST hold: `decode(encode(x)) === x` for
  all entity event types under arbitrary valid inputs

**Codebase reference**: Property-based tests at
`src/lib/iiot/__tests__/schemas/property-based/hierarchy.test.ts`,
`entity-methods.test.ts`, `oee-calculations.test.ts`,
`state-machines.test.ts`, `temporal.test.ts`, and
`json-schema.test.ts`. Graph property tests at
`src/lib/iiot/__tests__/schemas/property-based/asset-state-graphs-*.test.ts`
and machine property tests at
`src/lib/iiot/__tests__/machines/property/*.property.test.ts`.

### CT.3.3 Tier 3: Integration Tests (Service Composition)

Integration tests validate Effect Layer composition, database interactions,
and JetStream stream configuration.

**Requirements**:
- EventJournal append/read roundtrip MUST work for all event-sourced
  entities (alarms, equipment state, work orders)
- Repository operations (CRUD) MUST work against the IIoT database
  (PostgreSQL + Apache AGE graph + TimescaleDB hypertables)
- State machine integration tests MUST validate full lifecycle:
  create entity -> transition states -> query history -> verify audit trail
- IngestionService pipeline (SparkplugPipelineLayer) MUST process a
  Sparkplug-B DDATA payload end-to-end: decode protobuf -> route by topic
  -> process reading -> detect alarm threshold -> persist

**Codebase reference**: Integration tests at
`src/lib/iiot/__tests__/integration/sql-event-journal.test.ts`,
`work-order-es.test.ts`, `equipment-state-es.test.ts`,
`graph.test.ts`, `time-series.test.ts`, `hybrid.test.ts`.
Machine integration tests at
`src/lib/iiot/__tests__/integration/machines/*.integration.test.ts`.

**Infrastructure**: Integration tests require Docker infrastructure:
```
docker compose -f docker/docker-compose.iiot.yml up -d
```

### CT.3.4 Tier 4: Compliance Tests (Standards Conformance)

Compliance tests validate adherence to external standards referenced by this
RFC.

**Requirements**:

| Standard | Test Scope | Pass Criteria |
|----------|-----------|---------------|
| ISA-18.2 [EEMUA-191] | Alarm state machine: 6 states, valid transitions, shelve max 24h, suppression requires reason | All transitions match ISA-18.2 state diagram |
| ISA-95 [ISA-95-1] | Hierarchy depth 1-9, parent-child validation, entity type enumeration | All 9 entity types validated; no orphan or cyclic references |
| Sparkplug-B [SPARKPLUG-B] | NBIRTH/DBIRTH/DDATA/DDEATH decode, alias resolution, metric type mapping | 100% of Sparkplug-B message types decoded without error |
| RFC 2119 [RFC2119] | Every MUST requirement in Sections X, Y, Z testable by at least one test case | No untested MUST requirement |

**Codebase reference**: Compliance tests at
`src/lib/iiot/__tests__/compliance/isa-18-2-compliance.test.ts` and
`immutability.test.ts`.

### CT.3.5 Tier 5: End-to-End Tests (System Behavior)

End-to-end tests validate cross-cutting behavior across the full system stack:
edge device, NATS cluster, entity processing pipeline, and WebSocket delivery.

**Requirements**:
- **Onboarding flow**: Organization creation -> NATS account provisioning ->
  edge device bootstrap -> first Sparkplug-B NBIRTH -> first OEE score.
  MUST complete within the 15-minute SLA (Section O)
- **Partition tolerance**: Edge device operates for 24 hours without cloud
  connectivity. On reconnection, all buffered events MUST replay in
  per-entity sequential order (G-1) with zero data loss
- **Multi-tenant isolation**: Events published by Organization A MUST NOT
  be observable by Organization B. Verified by subscribing to wildcard
  subjects across account boundaries
- **Alarm lifecycle**: Sensor threshold breach -> alarm raised -> operator
  acknowledged -> alarm cleared. Full lifecycle MUST complete within
  alarm delivery SLO (Critical: < 100ms platform delivery)

**Infrastructure**: E2E tests require the full Docker Compose stack plus
at least two NATS accounts for multi-tenant isolation verification.

---

## CT.4 Performance Benchmarks

Implementations claiming conformance MUST meet the following performance
thresholds under sustained load. Benchmarks MUST be executed on hardware
representative of the target deployment (see Section D for deployment topology).

### CT.4.1 Event Throughput

| Channel | Minimum Sustained Rate | Test Duration | Measurement |
|---------|----------------------|---------------|-------------|
| `iiot:readings` (L0 telemetry) | 1,000 events/sec per org | 5 minutes | Events published and acknowledged by JetStream |
| `iiot:alarms` (L1-L2 lifecycle) | 100 events/sec per org | 5 minutes | Zero dropped alarm events (bounded backpressure) |
| `iiot:equipment` (L1-L2 state) | 200 events/sec per org | 5 minutes | All state transitions persisted |
| `iiot:entity-changes` (L3 transitions) | 500 events/sec per org | 5 minutes | EventJournal append confirmed |
| Aggregate (hub cluster) | 2M events/sec total | 5 minutes | Across all channels, all organizations |

**Codebase reference**: Channel throughput targets defined in
`rfc-section-effect-architecture.md` (lines 420-432). Throughput spike test
pattern at `src/lib/iiot/__tests__/spikes/sparkplug-throughput-spike.test.ts`.

**Benchmark configuration**: Vitest benchmark mode (`vitest.config.ts` lines
44-48, `include: ["src/**/*.bench.{ts,tsx}"]`).

### CT.4.2 Event Delivery Latency

Latency is measured from event production (entity handler emit) to subscriber
delivery (WebSocket message or NATS consumer ack).

| ISA-95 Level | P50 | P95 | P99 | Measurement Window |
|--------------|-----|-----|-----|--------------------|
| L0 (Physical Process) | < 20ms | < 50ms | < 100ms | 10,000 events |
| L1 (Basic Control) | < 50ms | < 100ms | < 250ms | 10,000 events |
| L2 (Supervisory Control) | < 100ms | < 250ms | < 500ms | 10,000 events |
| L3 (Manufacturing Ops) | < 200ms | < 500ms | < 1s | 10,000 events |
| L4 (Enterprise) | < 500ms | < 2s | < 5s | 10,000 events |

**Source**: SLO definitions from MON.4.1 (monitoring infrastructure section).

### CT.4.3 Entity Scale

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| Concurrent active entities per org | >= 1,000 | Entity handlers responding within L2 latency SLO |
| Total entities per hub cluster | >= 100,000 | Shard assignment stable, no hot spots > 2x mean |
| Hierarchy depth | 9 levels | Navigation queries < 50ms P95 |
| Concurrent WebSocket subscribers | >= 500 per org | Event fan-out within latency SLOs |

### CT.4.4 Edge Device Performance

| Metric | Threshold | Hardware Baseline |
|--------|-----------|------------------|
| Sensor ingestion rate | >= 100 sensors at 1 Hz | Raspberry Pi 4 (4 GB) or equivalent |
| Local JetStream persistence | >= 100 events/sec sustained | 32 GB SD card or eMMC |
| Sparkplug-B decode latency | < 5ms per DDATA message | ARM Cortex-A72 @ 1.5 GHz |
| Offline buffer capacity | >= 24 hours at 100 events/sec | ~800 MB JetStream storage |

---

## CT.5 Interoperability Testing

### CT.5.1 Sparkplug-B Interoperability [SPARKPLUG-B]

Implementations MUST pass the following Sparkplug-B interoperability tests:

| Test Case | Input | Expected Behavior |
|-----------|-------|-------------------|
| NBIRTH decode | Valid NBIRTH protobuf with 50 metrics | All metrics registered in AliasRegistry; entity created |
| DBIRTH decode | Valid DBIRTH with metric aliases | Aliases resolved to metric names via AliasRegistry |
| DDATA with aliases | DDATA using numeric aliases (not names) | Alias resolution succeeds; reading values correct |
| DDEATH handling | DDEATH from previously birthed node | Node state set to OFFLINE; `StateRegistryKV` updated |
| STATE topic | `STATE/scada_host_id` with online=true/false | Host availability updated in state registry |
| Rebirth sequence | DBIRTH after DDEATH (same node) | AliasRegistry cleared and rebuilt; no stale aliases |
| Unknown alias | DDATA with alias not in current NBIRTH | Metric skipped with warning; no crash |
| Protobuf v3 | Sparkplug-B payload encoded with protobuf3 | Decode succeeds; metric types mapped correctly |

**Codebase reference**: AliasRegistry at
`src/lib/iiot/adapters/sparkplug-adapter.ts` (lines 79-111). Sparkplug
integration spikes at `src/lib/iiot/__tests__/spikes/sparkplug-*.test.ts`.

### CT.5.2 OPC UA Interoperability [OPC-UA-14]

Implementations claiming OPC UA support MUST pass:

| Test Case | Expected Behavior |
|-----------|-------------------|
| Browse address space | ISA-95 hierarchy navigable via OPC UA BrowseService |
| Read current value | Entity state readable as OPC UA Variable nodes |
| Subscribe to changes | MonitoredItems deliver entity state changes within L2 latency SLO |
| Historical access | HistoryRead returns event-sourced entity history |

**Note**: OPC UA adapter is currently a stub
(`src/lib/iiot/adapters/opcua-adapter-stub.ts`). These tests become REQUIRED
when the adapter reaches production readiness.

### CT.5.3 MQTT 5.0 Interoperability [MQTT-5]

Implementations MUST support MQTT 5.0 as the transport for Sparkplug-B and
MAY support it for direct telemetry ingestion:

| Test Case | Expected Behavior |
|-----------|-------------------|
| QoS 1 delivery | At-least-once delivery confirmed via PUBACK |
| Retained messages | NBIRTH retained; late-joining subscribers receive last birth certificate |
| Topic alias | MQTT 5.0 topic aliases reduce per-message overhead |
| Shared subscriptions | `$share/group/topic` distributes load across adapter instances |

### CT.5.4 NATS Interoperability [NATS-PROTO]

For direct NATS integration (developer-facing, lowest latency):

| Test Case | Expected Behavior |
|-----------|-------------------|
| Subject mapping | Entity events published to `iiot.{orgId}.entity.{type}.{id}` |
| JetStream consumer | Pull consumer with explicit ack receives all events in order (G-1) |
| KV watch | NATS KV watch on entity key delivers state changes in real time |
| Account isolation | Subscriber in Account B receives zero messages from Account A subjects |
| Leaf node sync | Edge leaf node reconnect replays buffered messages preserving order |

---

## CT.6 Certification Process

### CT.6.1 Third-Party Integration Certification

Organizations developing adapters, connectors, or extensions for the TMNL
manufacturing commons MUST undergo the following certification process:

**Step 1: Self-Assessment**
- Execute the conformance test suite (CT.3) against the integration
- Document which conformance level (CT.2) is claimed
- Record all test results with timestamps and environment details

**Step 2: Interoperability Verification**
- Deploy the integration in a staging environment with at least two
  existing certified organizations
- Execute cross-org event delivery tests (G-8 verification)
- Verify zero namespace leakage across NATS accounts

**Step 3: Performance Validation**
- Execute the benchmark suite (CT.4) under sustained load
- Provide P50/P95/P99 latency measurements for all applicable ISA-95 levels
- Demonstrate edge device performance within thresholds (CT.4.4) if
  the integration includes edge components

**Step 4: Certification Grant**
- Submit self-assessment, interoperability results, and performance
  data to the commons governance body
- Certification is granted per conformance level and is valid for
  12 months or until a breaking schema change, whichever comes first
- Certified integrations are listed in the commons registry

### CT.6.2 Recertification Triggers

An integration MUST be recertified when:

| Trigger | Reason |
|---------|--------|
| Schema version change | New entity event schemas may break decode/encode roundtrips |
| NATS protocol upgrade | Leafnode or JetStream behavior changes may affect G-1, G-6 |
| Sparkplug-B spec update | Metric type or alias semantics may change |
| 12-month expiry | Periodic validation against evolving commons requirements |

---

## CT.7 Schema Evolution Regression Testing

### CT.7.1 Forward Compatibility

When an entity event schema evolves (new optional fields, new event types),
existing consumers MUST continue to function without modification.

**Test procedure**:
1. Produce events using the new schema version (v(n+1))
2. Consume events using a consumer compiled against the previous schema (v(n))
3. Verify: consumer decodes all events without error; unknown fields are
   ignored; no data corruption in known fields

**Implementation**: Effect Schema's `Schema.optionalWith` for new fields ensures
forward compatibility. The `_tag` discriminant on `TaggedStruct` MUST remain
stable across versions [EFFECT-SCHEMA].

### CT.7.2 Backward Compatibility

When a consumer is upgraded to a new schema version, it MUST correctly process
events persisted under the previous schema.

**Test procedure**:
1. Persist 1,000 events using schema v(n)
2. Upgrade consumer to schema v(n+1)
3. Replay all persisted events through the upgraded consumer
4. Verify: all events decode successfully; entity state reconstructed
   identically to pre-upgrade state

### CT.7.3 Schema Registry Validation

Implementations SHOULD maintain a schema registry that:
- Records all schema versions with their Effect Schema definitions
- Validates that new versions are backward-compatible (no removed required
  fields, no type narrowing of existing fields)
- Generates JSON Schema artifacts via `JSONSchema.make()` for external
  consumers [EFFECT-SCHEMA]

### CT.7.4 Regression Test Matrix

For each schema evolution, the following test matrix MUST be executed:

| Test | v(n) Producer -> v(n) Consumer | v(n+1) Producer -> v(n) Consumer | v(n) Producer -> v(n+1) Consumer | v(n+1) Producer -> v(n+1) Consumer |
|------|-------------------------------|----------------------------------|----------------------------------|-------------------------------------|
| Decode success | MUST pass | MUST pass | MUST pass | MUST pass |
| Encode roundtrip | MUST pass | N/A (consumer only) | N/A (consumer only) | MUST pass |
| Entity state integrity | MUST pass | MUST pass (known fields only) | MUST pass | MUST pass |
| Event ordering (G-1) | MUST pass | MUST pass | MUST pass | MUST pass |

---

## CT.8 Coverage Requirements

### CT.8.1 Code Coverage Thresholds

Implementations SHOULD meet the following coverage thresholds for production
deployments:

| Metric | Threshold | Scope |
|--------|-----------|-------|
| Line coverage | >= 85% | Entity domain (`src/lib/iiot/`) |
| Function coverage | >= 85% | Entity domain |
| Branch coverage | >= 80% | Entity domain |
| Statement coverage | >= 85% | Entity domain |

**Codebase reference**: Coverage configuration at `vitest.config.ts` (lines
26-43), using v8 provider with `["text", "json", "html"]` reporters.

### CT.8.2 Requirement Traceability

Every MUST and MUST NOT requirement in this RFC SHOULD be traceable to at
least one test case. Implementations SHOULD maintain a traceability matrix
mapping RFC requirement identifiers (G-1 through G-8, P1 through P12, MON.*,
CT.*) to specific test file paths.

---



═══════════════════════════════════════════════════════════════════════════
PART V: SUPPLEMENTARY (Informative)
═══════════════════════════════════════════════════════════════════════════

# Part V: Supplementary Sections

<!-- Source: rfc-section-edge-architecture-v2.md -->
## 15.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

---

## 15.2 Design Philosophy: Edge-First, Cloud-Optional

### 15.2.1 The Sovereignty Principle

The metropolitan manufacturing network serves 200,000+ organizations ranging from
a 2-person machine shop with unreliable internet to a 500-employee aerospace
facility with redundant fiber. The architecture MUST NOT assume cloud
connectivity for any manufacturing operation.

This principle is not a preference — it is a hard constraint derived from the
manufacturing commons thesis [research-manufacturing-commons.md Section 7].
Small manufacturers are first-class citizens. A machinist with a $50 Raspberry
Pi, a CNC mill, and a lathe is as architecturally important as a large factory
with a $50,000 edge server. If the platform requires cloud for basic operations,
it excludes the very participants who make the network valuable.

### 15.2.2 Sovereignty Rules

Three rules govern the relationship between edge devices and cloud services.
These are non-negotiable architectural invariants.

**Edge Sovereignty Rule (E-1)**: An organization's edge device is the
authoritative source of truth for that organization's entity state, sensor
readings, alarm lifecycle, and work order history. The cloud cluster is a
mirror, not a primary. If the edge device and the cloud disagree on entity
state, the edge device is correct.

**Rationale**: Entity actors run on the edge device inside @effect/cluster.
The Machine state graph, the alarm ISA-18.2 lifecycle, and the work order
FDA 21 CFR Part 11 audit trail all execute locally. The cloud never processes
entity RPCs — it only receives event notifications via NATS leaf node mirroring.

**Cloud Enhancement Rule (E-2)**: Cloud services MUST only provide capabilities
that are inherently cross-organizational or require resources beyond edge
capacity:

| Cloud-Provided (E-2 allowed) | Edge-Provided (E-2 prohibited in cloud) |
|------------------------------|----------------------------------------|
| Cross-org marketplace aggregation | Entity state management |
| Network-level analytics | Alarm acknowledgment routing |
| Capability matching + reputation | Operator authentication |
| Long-term archival (beyond edge SSD) | Sensor data collection |
| Disaster recovery backup | Work order lifecycle |
| CRDT aggregate computation | Local dashboard rendering |

**Offline Continuity Rule (E-3)**: When the edge device loses cloud
connectivity, ALL intra-organization operations MUST continue without
degradation. The following table defines the expected behavior:

| Operation | Offline Behavior | Acceptable Degradation |
|-----------|-----------------|----------------------|
| Sensor reading ingestion | MUST continue normally | None |
| Alarm detection and routing | MUST continue normally | None |
| Entity state transitions | MUST continue normally | None |
| Work order lifecycle | MUST continue normally | None |
| Operator dashboard (T0 local) | MUST continue normally | None |
| Operator dashboard (T0 remote) | MUST degrade gracefully | Remote T0 devices lose access |
| Cross-org marketplace | MUST degrade gracefully | Org disappears from network views |
| Network capacity aggregates | MUST degrade gracefully | Stale data for this org (>5 min TTL) |
| Cloud analytics pipeline | MUST queue locally | Delayed until reconnection |
| JetStream domain mirror | MUST pause and resume | Events buffer locally |

### 15.2.3 The "Earl Test"

Every architectural decision MUST pass the "Earl Test": can Earl, a 63-year-old
machinist with a 2-person shop, one CNC mill, one lathe, and a $50 Raspberry Pi
on intermittent DSL, use this feature without calling IT support?

If the answer is no, one of three things MUST change:

1. The feature is cloud-only and is excluded from Earl's tier (acceptable)
2. The feature's edge implementation is simplified for low-resource tiers
3. The feature is redesigned to work within Earl's constraints

The Earl Test is not hypothetical. The manufacturing commons thesis identifies
that 80%+ of the 200K target organizations are small shops with 1-20 employees
[research-manufacturing-commons.md Section 1.1]. The platform's network value
scales with participant count, not participant size.

### 15.2.4 Implications for Protocol Selection

Edge-first architecture constrains protocol and transport choices:

| Constraint | Implication |
|-----------|------------|
| $50 hardware minimum | NATS server must run in <128 MB RAM |
| Intermittent internet | NATS leaf node (auto-reconnect, buffered delivery) |
| No IT department | JWT-based auth (no LDAP, no Active Directory) |
| Local-first operation | JetStream domain per-org (not cloud-hosted) |
| Sparkplug-B compatibility | MQTT broker bridge at edge (not cloud) |
| WebSocket for operators | T0 devices connect to local T1/T2/T3, not cloud |

**Codebase proof**: The existing NATS connection layer at
`lib/holonet/nats/connection.ts:40-60` [NatsConnectionService] uses
`Effect.acquireRelease` for scoped lifecycle management. This pattern supports
both persistent cloud connections (T2/T3) and intermittent connections (T1) via
NATS leaf node reconnection semantics.

---

## 15.3 Four-Tier Edge Capability Model

### 15.3.1 Tier Overview

Implementations MUST classify edge deployments into one of four capability tiers.
Each tier defines the MUST/SHOULD/MAY capabilities available to the organization.

| Tier | Name | Hardware | Cost | Role |
|------|------|----------|------|------|
| T0 | Client Device | Smartphone, tablet, laptop | $0 (existing) | Read-only consumer |
| T1 | Minimal Edge | $50-200 SBC (RPi, Orange Pi) | $50-200 | Protocol bridge, buffer |
| T2 | Industrial Gateway | Edge gateway, mini-PC | $500-2,000 | Full local processing |
| T3 | Edge Server | Rack server, VM cluster | $5,000-50,000+ | Multi-node cluster, ML |

### 15.3.2 Tier 0 (T0): Client Device — Read-Only Access

```
Hardware:    Smartphone, tablet, laptop browser
CPU:         Any (browser-based)
RAM:         N/A (browser tab)
Storage:     N/A (no local persistence required)
Connectivity: WiFi/cellular to T1/T2/T3 or cloud
Role:        Consumer of entity state, not producer
```

**MUST capabilities**:
- Display real-time entity state via WebSocket subscription to nearest
  T1/T2/T3 or cloud endpoint
- Acknowledge alarms via RPC call routed through WebSocket
- View sensor reading dashboards (read-only)
- Authenticate via NATS JWT (user-level, scoped to read operations)

**SHOULD capabilities**:
- Receive push notifications for critical alarms (ISA-95 L1-L2)
- Cache last-known entity state for offline viewing (Service Worker)
- Display historical trends from JetStream replay (when connected)
- Support progressive web app (PWA) installation for quick access

**MUST NOT capabilities**:
- Run @effect/cluster runners (no local entity processing)
- Persist events locally (no JetStream domain)
- Bridge Sparkplug-B or OPC-UA protocols
- Publish sensor readings or entity state changes

**Transport**: WebSocket to nearest available endpoint. The existing WebSocket
server at `lib/iiot/realtime/websocket-server.ts:68-137` serves T0 clients via
`RpcServer.layerProtocolWebsocketRouter`.

**Security model**: T0 devices authenticate with short-lived JWTs (1-hour
lifetime) obtained via OAuth2 token exchange. The JWT scopes the user to
read-only subjects within their organization's NATS account.

### 15.3.3 Tier 1 (T1): Minimal Edge — Sparkplug Bridge + Telemetry Buffer

```
Hardware:    $50-200 SBC (Raspberry Pi 4/5, Orange Pi 5, Radxa ROCK 5B)
CPU:         4-core ARM, 1.5-2.4 GHz
RAM:         2-8 GB (RECOMMENDED: 4 GB)
Storage:     32-128 GB microSD or eMMC
Connectivity: Ethernet/WiFi, intermittent internet acceptable
Role:        Protocol bridge, local telemetry buffer, NATS leaf node
```

**MUST capabilities**:
- Run Sparkplug-B adapter bridging local MQTT to NATS
  (`lib/iiot/adapters/sparkplug-adapter.ts:406-407` [SparkplugAdapterLive])
- Buffer sensor readings locally during cloud disconnection
- Run NATS server in leaf node mode (single-process, embedded)
- Persist events to local JetStream domain (file storage, 1-day retention)
- Authenticate to hub via signed JWT [NATS-DECENTRALIZED]
- Enforce intra-organization ordering guarantees G-1 and G-2
  [rfc-section-two-domain-consistency.md Section X.3]
- Start automatically on boot with no manual intervention
- Survive ungraceful power loss without data corruption
  (JetStream file storage with write-ahead log)

**SHOULD capabilities**:
- Run alarm detection logic locally (threshold-based, no ML)
  (`lib/iiot/adapters/ingestion-service.ts:297-322` [SparkplugPipelineLayer])
- Serve T0 clients on local network via WebSocket
- Buffer cross-org events for cloud delivery on reconnection
- Support report-by-exception filtering to reduce telemetry volume by 80-90%
  [research-uns-metropolitan.md Section 7.1]
- Provide mDNS discovery for T0 devices on local network
  (`_iiot-edge._tcp.local`)

**MAY capabilities**:
- Run @effect/cluster SingleRunner with minimal entity set (up to 50 entities)
- Execute simple state machines for equipment monitoring
- Cache NATS KV state for offline dashboard rendering
- Bridge OPC-UA DA endpoints via protocol adapter

**MUST NOT capabilities**:
- Run multi-node cluster (insufficient resources)
- Persist events beyond 1-day retention (storage constraints)
- Execute ML inference models (insufficient CPU/RAM)
- Run PostgreSQL or other relational database

**Failure mode**: If the T1 device loses power, it MUST recover to operational
state within 60 seconds of power restoration. NATS leaf node reconnects
automatically. JetStream replays from the last checkpoint.

### 15.3.4 Tier 2 (T2): Industrial Edge Gateway — Full Local Processing

```
Hardware:    Industrial edge gateway or mini-PC
Examples:    Dell Edge Gateway 5200, Siemens IPC127E, Intel NUC,
             Advantech UNO-2484G, Lenovo ThinkEdge SE50
CPU:         4-8 core x86/ARM, 2-3 GHz
RAM:         8-16 GB (RECOMMENDED: 8 GB)
Storage:     256 GB - 1 TB SSD (RECOMMENDED: 512 GB)
Connectivity: Dual Ethernet, WiFi, optional cellular failover
Role:        Full local entity processing, 30-day retention
```

**MUST capabilities**:
- Run @effect/cluster SingleRunner with SQL-backed RunnerStorage
  (`@effect/cluster/SingleRunner` — in-process, no network transport)
- Process all 12 entity types locally with full state machine validation
  (`lib/iiot/entity/EntityStack.ts:54-67` [EntityHandlersLayer])
- Persist events to local JetStream domain (file storage, 30-day retention)
- Run complete SparkplugPipelineLayer with TopicRouter, ReadingProcessor,
  AlarmDetector, and IngestionService
  (`lib/iiot/adapters/ingestion-service.ts:297-322`)
- Enforce intra-organization ordering guarantees G-1 through G-6
- Serve T0 clients via WebSocket on local network
- Operate indefinitely without cloud connectivity (E-3)
- Recover from ungraceful shutdown within 120 seconds
- Support NATS KV for entity current state
  (`lib/iiot/state/` — SiteState, DeviceState, PlantState, etc.)

**SHOULD capabilities**:
- Run EventDistribution with 4+ channels
  (`lib/iiot/realtime/event-distribution.ts` — ChannelService-based hub)
- Mirror local JetStream streams to cloud domain on reconnection
- Run entity observer fibers for real-time entity-change events
  (makeEntityObserver pattern per RFC Section 10)
- Run OPC-UA adapter alongside Sparkplug-B adapter
- Expose HTTP API for local MES/SCADA integration
- Support automatic firmware updates (signed binary packages)
- Provide SNMP or Prometheus metrics endpoint for facility monitoring

**MAY capabilities**:
- Run 2-node local cluster (SingleRunner + SocketRunner) for HA
- Execute lightweight ML inference for anomaly detection (TFLite, ONNX)
- Bridge to legacy SCADA historians via OPC-DA/HDA adapters
- Run scheduled backup of SQLite/JetStream to network storage

### 15.3.5 Tier 3 (T3): Edge Server — Enterprise-Grade Local Cluster

```
Hardware:    Rack-mount server, industrial PC cluster, or VM cluster
Examples:    Dell PowerEdge R660xs, HPE ProLiant DL360,
             Lenovo ThinkSystem SR630 V3, Kubernetes on-prem
CPU:         16-64 cores, 2.5-4 GHz
RAM:         32-256 GB (RECOMMENDED: 64 GB)
Storage:     2-20 TB NVMe/SSD (RAID 10 RECOMMENDED)
Connectivity: Redundant GbE/10GbE, dedicated internet circuit
Role:        Multi-runner cluster, full JetStream, ML inference,
             1-year+ regulatory retention
```

**MUST capabilities**:
- Run @effect/cluster with SocketRunner transport (multi-node)
  (`@effect/cluster/SocketRunner` — binary TCP, production-grade)
- Support 5 shard groups (`orgs`, `assets`, `equipment`, `telemetry`, `events`)
  with 300 shards per group (default `shardsPerGroup`)
- Process 5,000+ entities with full state machine validation
- Persist events to local JetStream domain (file storage, 1-year retention)
- Run 3-replica JetStream cluster for local high availability
- Enforce all intra-organization ordering guarantees G-1 through G-7
- Serve 50+ concurrent T0 clients via WebSocket
- Run HolonetBridge for NATS-distributed event delivery
  (`lib/iiot/realtime/holonet-bridge.ts`)
- Support rolling upgrades without service interruption
- Maintain entity lifecycle audit trail with regulatory retention
  (ISA-18.2 alarm records: 7 years; FDA 21 CFR Part 11 work orders: 7 years)

**SHOULD capabilities**:
- Run HttpRunner or WebSocket transport for inter-runner communication
  (`@effect/cluster/HttpRunner.layerHttp`, `HttpRunner.layerWebsocket`)
- Support horizontal scaling by adding runner nodes
- Run ML inference models for predictive maintenance
- Support JetStream domain mirroring to cloud (continuous, not batch)
- Run full EventDistribution with 7+ channels for metropolitan-scale routing
- Integrate with enterprise MES, ERP, and SCADA systems via HTTP API
- Run durable workflow engine (`@effect/cluster/ClusterWorkflowEngine`)
  for complex multi-step manufacturing processes
- Provide Kubernetes operator for automated cluster management

**MAY capabilities**:
- Run dedicated JetStream servers (separate from NATS core servers)
- Operate as a regional hub for multiple T1/T2 sites within the same org
- Deploy with GPU accelerator for real-time vision inspection
- Provide REST-to-NATS API gateway for legacy system integration

### 15.3.6 Tier Capability Summary Matrix

| Capability | T0 | T1 | T2 | T3 |
|---|---|---|---|---|
| Read entity state | MUST | MUST | MUST | MUST |
| Write entity state | -- | MAY | MUST | MUST |
| Sparkplug-B bridge | -- | MUST | MUST | MUST |
| Local NATS server | -- | MUST | MUST | MUST |
| JetStream persistence | -- | MUST (1d) | MUST (30d) | MUST (1yr) |
| @effect/cluster | -- | MAY (Single) | MUST (Single+SQL) | MUST (Socket) |
| Entity processing | -- | MAY (50) | MUST (500) | MUST (5000+) |
| Alarm detection | -- | SHOULD | MUST | MUST |
| EventDistribution | -- | -- | SHOULD | MUST |
| HolonetBridge | -- | -- | SHOULD | MUST |
| WebSocket server | -- | SHOULD | MUST | MUST |
| ML inference | -- | -- | MAY | SHOULD |
| Offline operation | -- | MUST | MUST | MUST |
| Cloud mirror | -- | SHOULD | SHOULD | MUST |
| Multi-node cluster | -- | -- | MAY (2) | MUST (3+) |
| HTTP API | -- | -- | SHOULD | MUST |
| Regulatory retention | -- | -- | SHOULD | MUST |
| HA (redundancy) | -- | -- | MAY | SHOULD |

---

## 15.4 Resource Constraints per Tier

### 15.4.1 Memory Budget

Each tier MUST operate within defined memory constraints. Implementations MUST
configure JetStream, @effect/cluster, and application services to respect these
budgets. Exceeding the memory budget on constrained hardware causes OOM kills,
which violates E-3 (offline continuity).

| Component | T1 (1 GB avail) | T2 (4 GB avail) | T3 (32 GB avail) |
|-----------|-----------------|-----------------|-------------------|
| OS + Bun runtime | 256 MB | 512 MB | 2 GB |
| NATS server | 128 MB | 512 MB | 4 GB |
| JetStream page cache | 64 MB | 1 GB | 8 GB |
| @effect/cluster | 64 MB | 512 MB | 4 GB |
| Entity state (in-memory) | 32 MB | 256 MB | 2 GB |
| Application services | 128 MB | 512 MB | 4 GB |
| Sparkplug adapter | 64 MB | 256 MB | 1 GB |
| WebSocket connections | 16 MB | 256 MB | 4 GB |
| Headroom (15-25%) | 248 MB | 696 MB | 3 GB |
| **Total** | **1 GB** | **4 GB** | **32 GB** |

**T1 memory discipline**: At 1 GB total, every byte matters. The NATS server
MUST be configured with `max_payload: 64KB` (vs default 1 MB) and
`max_connections: 20` (vs default 65K). JetStream page cache MUST be limited
to 64 MB via `jetstream { max_memory: 64MB }`.

### 15.4.2 Entity Limits

Entity limits MUST be enforced by @effect/cluster's `maxIdleTime` reaping and
application-level entity activation guards:

| Constraint | T1 | T2 | T3 |
|-----------|---|---|---|
| Max concurrent entities | 50 | 500 | 5,000+ |
| Max entity types registered | 5 | 12 | 12+ |
| Shard groups | 1 | 3 | 5 |
| Shards total | 10 | 150 | 1,500 |
| maxIdleTime | 5 min | 2 min | 1 min (default) |
| entityTerminationTimeout | 5 sec | 10 sec | 15 sec (default) |
| RunnerStorage refresh | 10 sec | 5 sec | 3 sec (default) |

**T1 entity selection**: At T1, only 5 of the 12 entity types SHOULD be
registered. The recommended subset is: Machine, Device, Sensor, Alarm,
EquipmentState. These cover the core monitoring loop. Site, Area, Plant, Line,
WorkCell, Enterprise, and WorkOrder can be deferred to T2.

### 15.4.3 Storage Budget

| Metric | T1 (32-128 GB) | T2 (256 GB-1 TB) | T3 (2-20 TB) |
|--------|----------------|-------------------|---------------|
| JetStream telemetry | 1 GB / 1 day | 50 GB / 30 days | 500 GB / 1 year |
| JetStream entity events | 100 MB / 30 days | 5 GB / 1 year | 50 GB / 7 years |
| SQLite/PostgreSQL | 50 MB | 2 GB | 50 GB |
| NATS KV state | 10 MB | 100 MB | 1 GB |
| Application logs | 100 MB | 1 GB | 10 GB |
| OS + runtime | 4 GB | 8 GB | 20 GB |
| **Total used** | **~5.3 GB** | **~67 GB** | **~631 GB** |
| **Headroom** | ~27-123 GB | ~189-933 GB | ~1.4-19.4 TB |

### 15.4.4 Stream Backpressure per Tier

Backpressure strategy MUST vary by tier to respect memory constraints. The
backpressure type determines behavior when the subscriber falls behind the
publisher:

| Channel | Backpressure | T1 maxLag | T2 maxLag | T3 maxLag |
|---------|-------------|-----------|-----------|-----------|
| readings | `PubSub.sliding` | 100 | 10,000 | 10,000 |
| alarms | `PubSub.bounded` | 50 | 1,000 | 1,000 |
| equipment | `PubSub.dropping` | 50 | 1,000 | 1,000 |
| entity-changes | `PubSub.dropping` | 50 | 2,000 | 2,000 |
| invalidations | `PubSub.dropping` | 50 | 1,000 | 1,000 |

**Strategy rationale**:

- **Sliding** (readings): Operator needs the latest value. Old readings are
  stale by definition. Drop the oldest, keep the newest.
- **Bounded** (alarms): ISA-18.2 [ISA-18.2] mandates no alarm loss. Bounded
  exerts backpressure on the publisher rather than dropping. If the alarm
  subscriber is too slow, the publisher blocks — this is correct because
  alarm processing is safety-critical.
- **Dropping** (entity-changes, equipment, invalidations): These events are
  replayable from JetStream or reconstructable from entity state. Dropping
  is acceptable because the subscriber can catch up from the durable store.

---

## 15.5 Security at the Edge

### 15.5.1 Transport Security

All NATS connections at every tier MUST use TLS 1.3
[rfc-section-security-trust.md Section Z.5]:

| Connection | TLS Requirement | Certificate Source |
|-----------|----------------|-------------------|
| T0 → local T1/T2/T3 | MUST (TLS 1.3) | Self-signed org CA |
| T1/T2/T3 → Regional Hub | MUST (TLS 1.3) | Platform CA |
| Hub → Supercluster | MUST (mutual TLS 1.3) | Platform CA |
| T0 → Cloud (direct) | MUST (TLS 1.3) | Public CA (Let's Encrypt) |

**Certificate auto-provisioning**: Edge devices SHOULD receive TLS certificates
during initial enrollment. The enrollment protocol:

1. Device boots with a one-time provisioning token (QR code or USB)
2. Device connects to provisioning endpoint (HTTPS)
3. Provisioning service validates token and issues:
   - NATS account JWT (signed by operator key)
   - NATS user JWT (signed by account key)
   - TLS certificate (signed by platform CA)
4. Device stores credentials in encrypted local storage
5. Subsequent boots use stored credentials (no provisioning service needed)

T1 devices with no display SHOULD support headless provisioning via:
- USB drive containing provisioning token
- Bluetooth Low Energy (BLE) pairing with operator's phone
- mDNS auto-discovery on local network with browser-based setup

### 15.5.2 JWT Authentication at Edge Tiers

Edge devices authenticate using NATS' decentralized JWT model
[NATS-DECENTRALIZED]:

| Context | JWT Lifetime | Rotation Method | Offline Duration |
|---------|-------------|----------------|-----------------|
| T1 edge device | 90 days | Auto-refresh on hub connection | Up to 90 days |
| T2 edge device | 90 days | Auto-refresh on hub connection | Up to 90 days |
| T3 edge device | 30 days | ACME-style continuous rotation | Up to 30 days |
| Cloud service | 24 hours | Automatic rotation | N/A (always connected) |
| T0 browser | 1 hour | OAuth2 token exchange | None (requires connection) |

**Offline JWT handling**: When the edge device is offline, its JWT remains valid
until expiry. T1/T2 devices MUST have JWTs with 90-day lifetime to cover
seasonal connectivity gaps (e.g., Earl's shop closes for holidays). T3 devices
with reliable connectivity use shorter lifetimes for tighter security.

**JWT revocation**: NATS supports JWT revocation via a revocation list published
to the cluster [NATS-JWT]. When a device is compromised:
1. Operator signs a revocation entry for the user JWT
2. Revocation list is published to the NATS cluster
3. All connected servers reject the revoked JWT on next connection attempt
4. Already-connected sessions are terminated within the server's check interval

### 15.5.3 Secure Boot and Binary Integrity

**T2+ devices** SHOULD implement signed binary verification:

1. Edge agent binaries MUST be signed with a platform code-signing key
2. On boot, the device SHOULD verify the binary signature before execution
3. Binary updates MUST be delivered via a signed manifest with SHA-256 checksums
4. Update manifests MUST specify minimum compatible firmware version

**T3 devices** with secure boot capability SHOULD enable UEFI Secure Boot with
platform-enrolled keys. The boot chain:

```
UEFI Firmware → Secure Boot shim → Platform boot key → Edge agent binary
```

### 15.5.4 Air-Gapped Operation (T3 Only)

For T3 deployments in classified or restricted environments (defense, nuclear,
critical infrastructure):

1. NATS server MUST operate in standalone mode (no leaf node connection)
2. Certificate rotation MUST be performed via USB media or local management console
3. Configuration updates MUST be applied via signed configuration packages
4. No cloud connectivity MUST be required for any operation (E-3 absolute)
5. Cross-org marketplace participation is not available (by definition)
6. All data remains on-premises — no mirror, no backup to cloud
7. Audit logs MUST be exportable to external media for regulatory review

### 15.5.5 Data-at-Rest Encryption

**T2+ devices** SHOULD encrypt JetStream data at rest:

| Tier | Encryption | Key Management |
|------|-----------|---------------|
| T1 | NOT RECOMMENDED (CPU cost) | N/A |
| T2 | SHOULD (LUKS/dm-crypt) | Auto-unlock via TPM 2.0 or passphrase |
| T3 | MUST (LUKS/dm-crypt or SED) | TPM 2.0 with sealed keys |

T1 devices lack the CPU budget for full-disk encryption. Physical security
(locked cabinet, tamper-evident enclosure) is the primary protection at T1.

---

## 15.6 Brownfield Integration

### 15.6.1 The Strangler Fig Pattern

For organizations with existing SCADA, PLC, or historian infrastructure, the
platform MUST support incremental adoption. The strangler fig pattern allows
the platform to wrap existing infrastructure without requiring replacement:

```
Phase 1: OBSERVE (Read-Only, 1-2 weeks)
════════════════════════════════════════

Existing SCADA/Historian ──► Sparkplug Adapter ──► NATS (readings only)
  (unchanged)                (passive subscriber)       │
                                                        ▼
                              T0 Dashboard ◄──── WebSocket
                              (read-only overlay on existing data)

Effort: Deploy T1/T2 device, configure Sparkplug adapter
Risk:   Zero — existing systems untouched
Value:  Immediate visibility into equipment telemetry
```

```
Phase 2: AUGMENT (Side-by-Side, 2-8 weeks)
═══════════════════════════════════════════

Existing SCADA ─────────────► Sparkplug Adapter ──► NATS ──► Entity System
  (still primary for control)                                  (shadow mode)
                                                               │
Operators use BOTH:                                           │
  - Legacy SCADA for control                                  │
  - T0/T2 dashboard for analytics + alarms ◄─────────────────┘

Effort: Enable entity processing on T2, configure alarm thresholds
Risk:   Low — entity system is read-only shadow, does not control equipment
Value:  ISA-18.2 alarm management, entity state tracking, OEE computation
```

```
Phase 3: REPLACE (Controlled Cutover, 4-12 weeks)
══════════════════════════════════════════════════

PLCs/Sensors ──► Sparkplug Adapter ──► NATS ──► Entity System ──► Operators
                                                (primary)
                 Legacy SCADA
                 (decommissioned or demoted to backup HMI)

Effort: Redirect operator workflows to new dashboard
Risk:   Medium — requires operator training and validation period
Value:  Full platform capabilities, marketplace participation
```

### 15.6.2 Key Constraints

- Phase 1 MUST NOT require any changes to existing PLC/SCADA configuration.
  The Sparkplug adapter passively subscribes to existing MQTT topics.
- Phase 2 MUST NOT interfere with existing control loops. Entity processing
  is read-only observation, not actuation.
- Phase 3 cutover is organization-controlled, not platform-enforced. The
  platform MUST NOT require organizations to decommission legacy systems.
- Organizations MAY remain in Phase 2 indefinitely (dual-system operation).

**Codebase proof**: The SparkplugAdapter at
`lib/iiot/adapters/sparkplug-adapter.ts:56-68` [SparkplugAdapterConfig]
accepts arbitrary `brokerUrl` and `groupIds`, enabling connection to existing
MQTT brokers without infrastructure changes. The adapter operates as a passive
consumer of existing Sparkplug telemetry — it does not publish commands or
modify device configuration.

### 15.6.3 Protocol Adapter Matrix

| Existing Protocol | Adapter | Edge Tier | Integration Path |
|------------------|---------|-----------|-----------------|
| Sparkplug B (MQTT) | SparkplugAdapterLive | T1+ | Direct MQTT subscription |
| OPC-UA | OpcUaAdapter (future) | T2+ | OPC-UA client subscription |
| Modbus TCP/RTU | ModbusAdapter (future) | T2+ | Polling with configurable interval |
| BACnet (building automation) | BacnetAdapter (future) | T2+ | BACnet/IP subscription |
| Proprietary PLC protocols | Custom adapter template | T2+ | Organization-specific development |

The SparkplugAdapter is the only adapter currently implemented. Additional
adapters follow the same `IngestionAdapter` service interface
(`lib/iiot/adapters/ingestion-service.ts:177`) and compose into the
pipeline via `Layer.provide`.

### 15.6.4 Data Mapping for Legacy Systems

Legacy systems often use non-standard naming conventions. The platform MUST
support configurable data mapping:

1. **Topic mapping**: Map legacy MQTT topics to ISA-95 entity hierarchy
   (e.g., `factory/cnc-1/temp` → `iiot.readings.SITE-EARL.TMP-001`)
2. **Unit conversion**: Convert legacy units to SI
   (e.g., Fahrenheit → Celsius, PSI → Bar)
3. **Threshold mapping**: Map existing alarm setpoints to entity alarm
   definitions
4. **Identity mapping**: Map legacy device IDs to platform entity IDs

Mapping configuration SHOULD be specified in a declarative JSON/YAML document
per organization, deployed alongside the SparkplugAdapter configuration.

---

## 15.7 Edge Observability

### 15.7.1 Health Metrics per Tier

Edge devices MUST expose health metrics for monitoring by the organization and
optionally by the platform (with consent):

| Metric | T1 | T2 | T3 | Collection |
|--------|---|---|---|-----------|
| NATS connection state | MUST | MUST | MUST | NATS stats endpoint |
| JetStream lag (msgs behind) | MUST | MUST | MUST | JetStream API |
| Entity count (active) | -- | MUST | MUST | Sharding.activeEntityCount |
| Memory usage (RSS) | SHOULD | MUST | MUST | /proc or OS API |
| CPU usage (%) | SHOULD | MUST | MUST | /proc or OS API |
| Disk usage (%) | SHOULD | MUST | MUST | Filesystem stats |
| Leaf node connection uptime | MUST | MUST | MUST | NATS stats |
| Last cloud sync timestamp | SHOULD | MUST | MUST | JetStream mirror lag |
| Sparkplug message rate | SHOULD | MUST | MUST | Adapter metrics |
| WebSocket client count | -- | SHOULD | MUST | Server stats |

### 15.7.2 Alerting at the Edge

Edge devices SHOULD generate local alerts for conditions that indicate
degradation:

| Condition | Severity | Action |
|-----------|---------|--------|
| JetStream disk > 90% | Critical | Reduce retention, alert operator |
| NATS memory > 85% | Warning | Log, increase reaping frequency |
| Leaf node disconnected > 1 hour | Warning | Local dashboard banner |
| Leaf node disconnected > 24 hours | Critical | Local audible/visual alert |
| Entity activation failure | Error | Log + retry with backoff |
| Sparkplug adapter disconnect | Warning | Reconnect with backoff |

### 15.7.3 Remote Monitoring (Opt-In)

Organizations MAY opt in to remote monitoring by the platform. This requires
exporting health metrics to the `manufacturing-commons` system account:

```
Export: health.{orgId}.metrics → manufacturing-commons
  Frequency: Every 60 seconds
  Payload: { cpu, memory, disk, natsState, entityCount, lastSync }
```

Remote monitoring MUST be opt-in (not default). Organizations that do not export
health metrics are invisible to platform monitoring — their edge devices operate
as black boxes. This is by design (data sovereignty, E-1).

---

## 15.8 Bandwidth Management

### 15.8.1 Event Priority Model

Edge-to-cloud bandwidth is a scarce resource, particularly for T1 devices on
intermittent DSL or cellular. Implementations MUST prioritize event transmission
based on the following priority classes:

| Priority | Event Type | Example | Preemption |
|----------|-----------|---------|-----------|
| P0 (Critical) | Safety alarms | Emergency stop, gas leak | MUST preempt all other traffic |
| P1 (High) | Alarm lifecycle | Alarm raised, acknowledged | MUST preempt P2-P3 |
| P2 (Normal) | Entity state changes | Machine state transition | MUST preempt P3 |
| P3 (Low) | Telemetry readings | Temperature, vibration | Lowest priority |
| P4 (Bulk) | Audit/analytics | Historical replay, aggregates | Best-effort only |

**Implementation**: NATS JetStream consumers on the leaf node outbound connection
SHOULD use separate delivery subjects per priority class. The NATS leaf node
protocol handles multiplexing, but application-level ordering within the leaf
node outbound buffer MUST respect priority ordering.

```
Leaf Node Outbound Buffer:

  Priority Queue:
    P0 ──────► [Emergency alarm]       ← Sent first
    P1 ──────► [Alarm ack, Alarm clear]
    P2 ──────► [Machine.Running]
    P3 ──────► [temp=72.3, temp=72.4]  ← Sent last
    P4 ──────► [audit log batch]       ← Only when idle
```

### 15.8.2 Report-by-Exception (RBE)

For T1 devices on constrained connections, report-by-exception SHOULD reduce
telemetry volume by 80-90% [research-uns-metropolitan.md Section 7.1]:

**RBE algorithm**: A reading is transmitted only if:
1. The value differs from the last transmitted value by more than a configured
   deadband (absolute or percentage), OR
2. A maximum reporting interval has elapsed (heartbeat), OR
3. The source quality changes (e.g., sensor goes offline)

```
Sensor: Temperature (setpoint: 72.0 F)
Deadband: 0.5 F absolute
Heartbeat: 60 seconds

72.0 → TRANSMIT (initial)
72.1 → suppress (within deadband)
72.3 → suppress (within deadband)
72.6 → TRANSMIT (exceeds deadband: |72.6 - 72.0| > 0.5)
72.7 → suppress
72.8 → suppress
... 60 seconds ...
72.8 → TRANSMIT (heartbeat interval)
```

**Sparkplug-B compatibility**: The Sparkplug-B specification [SPARKPLUG-B]
natively supports report-by-exception via the `is_historical` and `is_transient`
metric properties. The SparkplugAdapter at
`lib/iiot/adapters/sparkplug-adapter.ts:299-300` already processes DDATA messages
which contain only changed metrics — Sparkplug-B is inherently RBE at the
protocol level.

**Effect Schema for deadband configuration**:

```typescript
const DeadbandConfig = Schema.Struct({
  absolute: Schema.optional(Schema.Number),    // e.g., 0.5 degrees
  percentage: Schema.optional(Schema.Number),  // e.g., 1% of range
  heartbeatMs: Schema.Number,                  // e.g., 60000 ms
})
```

### 15.8.3 Delta Encoding for Sensor Readings

When transmitting sensor reading batches to the cloud mirror, implementations
SHOULD use delta encoding to reduce payload size:

```
Full encoding (baseline):
  [72.0, 72.1, 72.3, 72.6, 72.8, 73.1, 73.0, 72.9]
  Size: 8 × 8 bytes = 64 bytes (float64)

Delta encoding (after baseline):
  Baseline: 72.0
  Deltas:   [+0.1, +0.2, +0.3, +0.2, +0.3, -0.1, -0.1]
  Size: 8 bytes + 7 × 2 bytes = 22 bytes (baseline + int16 deltas)
  Compression ratio: 66% reduction
```

**When to use delta encoding**:
- T1 → Hub: SHOULD use delta encoding (bandwidth-constrained)
- T2 → Hub: MAY use delta encoding (moderate bandwidth)
- T3 → Hub: MAY use delta encoding (optional, bandwidth is less constrained)
- Intra-org (local NATS): MUST NOT use delta encoding (adds latency, no benefit)

### 15.8.4 Compression

NATS does not natively compress messages. For large payloads (batch readings,
audit logs), implementations MAY apply application-level compression:

| Payload Type | Compression | Rationale |
|-------------|------------|-----------|
| Single reading | MUST NOT compress | Overhead > savings for <100 bytes |
| Batch readings (50+) | SHOULD compress | 60-80% reduction on numeric arrays |
| Entity events | SHOULD NOT compress | Small payloads, latency-sensitive |
| Alarm events | MUST NOT compress | P0/P1 priority, latency-critical |
| Audit log batches | SHOULD compress | Large payloads, bulk priority |
| JetStream mirror | MAY compress | JetStream handles transport |

**Compression algorithm**: `lz4` is RECOMMENDED for edge devices due to its
low CPU overhead and fast decompression. `zstd` MAY be used on T2+ devices
for better compression ratios at the cost of higher CPU.

### 15.8.5 Bandwidth Budget per Tier

| Metric | T1 (DSL/Cellular) | T2 (Ethernet) | T3 (Dedicated) |
|--------|-------------------|---------------|----------------|
| Uplink available | 1-10 Mbps | 50-100 Mbps | 100 Mbps-1 Gbps |
| Platform allocation | 0.5-2 Mbps | 10-50 Mbps | Unlimited |
| Readings/sec (raw) | 5-50 | 50-500 | 500-5,000 |
| Readings/sec (RBE) | 1-10 | 10-100 | 100-1,000 |
| Cross-org overhead | <10 KB/min | <100 KB/min | <1 MB/min |
| Peak burst | 1 MB/sec | 10 MB/sec | 100 MB/sec |

---

## 15.9 Progressive Enhancement via Layer Composition

### 15.9.1 Same Codebase, Different Tiers

The platform MUST use a single codebase that scales from T1 to T3 via
Effect Layer composition [EFFECT-LAYER]. Tier-appropriate behavior is achieved
by providing different Layer stacks, not by maintaining separate codebases.

```
Single codebase: packages/tmnl/src/lib/iiot/

  T1 Layer Stack:
    SparkplugAdapterLive
    + ReadingProcessorLive
    + AlarmDetectorLive
    + IngestionServiceLive
    (= SparkplugPipelineLayer)

  T2 Layer Stack:
    SparkplugPipelineLayer
    + SingleRunner.layer
    + EntityHandlersLayer          ← Added at T2
    + EventDistributionLayer       ← Added at T2
    + WebSocketServerLayer         ← Added at T2

  T3 Layer Stack:
    SparkplugPipelineLayer
    + SocketRunner.layer            ← Upgraded at T3
    + EntityHandlersLayer
    + EventDistributionLayer
    + WebSocketServerLayer
    + HolonetBridgeLive            ← Added at T3
    + HttpApiLayer                 ← Added at T3
```

### 15.9.2 Tier Detection at Boot

The edge agent MUST detect its tier at boot and compose the appropriate Layer
stack. Tier detection is based on available resources:

```typescript
const detectTier = Effect.gen(function* () {
  const ram = yield* getAvailableRAM
  const cpuCores = yield* getCpuCoreCount
  const hasClusterDB = yield* fileExists("/data/cluster.db")

  if (ram < 2_000_000_000) return "T1" as const        // < 2 GB
  if (ram < 16_000_000_000 && cpuCores <= 8)
    return "T2" as const                                // < 16 GB, <= 8 cores
  return "T3" as const                                  // >= 16 GB or > 8 cores
})

const buildApplicationLayer = (tier: "T1" | "T2" | "T3") => {
  const base = SparkplugPipelineLayer({ sparkplug: config })

  switch (tier) {
    case "T1":
      return base

    case "T2":
      return base.pipe(
        Layer.provideMerge(SingleRunner.layer),
        Layer.provideMerge(EntityHandlersLayer),
        Layer.provideMerge(EventDistributionLayer),
        Layer.provideMerge(WebSocketServerLayer),
      )

    case "T3":
      return base.pipe(
        Layer.provideMerge(SocketRunner.layer({ host: "0.0.0.0", port: 34437 })),
        Layer.provideMerge(EntityHandlersLayer),
        Layer.provideMerge(EventDistributionLayer),
        Layer.provideMerge(WebSocketServerLayer),
        Layer.provideMerge(HolonetBridgeLive),
        Layer.provideMerge(HttpApiLayer),
      )
  }
}
```

### 15.9.3 Configuration-Driven Layer Selection

Alternatively, the tier MAY be explicitly configured in the edge device's
configuration file:

```json
{
  "tier": "T2",
  "nats": {
    "leafNode": {
      "hubUrl": "nats://hub-east.network.io:7422",
      "credentials": "/etc/tmnl/nats.creds"
    },
    "jetstream": {
      "maxAge": "30d",
      "maxBytes": "50GB"
    }
  },
  "cluster": {
    "runner": "SingleRunner",
    "shardGroups": ["assets", "equipment", "events"],
    "shardsPerGroup": 50,
    "storage": { "type": "sqlite", "path": "/data/cluster.db" }
  },
  "sparkplug": {
    "brokerUrl": "mqtt://localhost:1883",
    "groupIds": ["factory-floor"]
  },
  "websocket": {
    "port": 8080,
    "maxConnections": 20
  }
}
```

Explicit configuration SHOULD override auto-detection. This allows operators to
downgrade tier behavior on capable hardware (e.g., running T2 profile on T3
hardware to conserve resources for other applications).

### 15.9.4 Edge-to-Cloud Data Flow

The data flow from edge sensor to cloud mirror traverses 4 stages. Each stage
is tier-independent — the same Effect services are used, with different Layer
configurations:

```
Stage 1: INGEST (T1+)
════════════════════════
  PLC/Sensor ──► MQTT Broker ──► SparkplugAdapter ──► IngestedReading
  (hardware)     (local)          (Effect service)     (Schema type)

  Reference: lib/iiot/adapters/sparkplug-adapter.ts
  Transport: Local MQTT (TCP, no encryption needed for loopback)

Stage 2: PROCESS (T1 partial, T2+ full)
════════════════════════════════════════
  IngestedReading ──► TopicRouter ──► ReadingProcessor ──► AlarmDetector
                      (route by     (batch by time      (threshold check)
                       device)       + count)
                                         │
                                         ▼
                                    ProcessedBatch { readings, violations }

  Reference: lib/iiot/adapters/ingestion-service.ts
  T1: Basic pipeline (route + batch)
  T2+: Full pipeline (route + batch + alarm detection + entity creation)

Stage 3: DISTRIBUTE (T2+)
═════════════════════════
  ProcessedBatch ──► EventDistribution ──┬──► iiot:readings (maxLag 10K)
                     (ChannelService)    ├──► iiot:alarms (maxLag 1K)
                                         ├──► iiot:equipment (maxLag 1K)
                                         └──► iiot:invalidations (maxLag 1K)

  Reference: lib/iiot/realtime/event-distribution.ts
  Fan-out: ChannelService broadcast outlets
  Cross-node: HolonetBridge dual-writes to NATS (T3)

Stage 4: MIRROR (T1+ when connected)
══════════════════════════════════════
  Local JetStream domain ──► Leaf Node ──► Hub JetStream ──► Supercluster
  (per-entity ordered)       (outbound     (aggregated      (global
                              buffer)       mirror)          mirror)

  Transport: NATS leaf node protocol (TLS 1.3)
  Ordering: Per-entity sequential (G-1, G-6)
  Priority: P0 alarms preempt P3 telemetry in outbound buffer
```

---

## 15.10 Codebase Reference Map

| File | Purpose | Relevant Section |
|---|---|---|
| `lib/holonet/nats/connection.ts:40-60` | NatsConnectionService (scoped lifecycle) | 15.2.4 |
| `lib/iiot/adapters/sparkplug-adapter.ts:56-68` | SparkplugAdapterConfig (broker config) | 15.3.3, 15.6.2 |
| `lib/iiot/adapters/sparkplug-adapter.ts:299-300` | DDATA processing (inherent RBE) | 15.8.2 |
| `lib/iiot/adapters/sparkplug-adapter.ts:406-407` | SparkplugAdapterLive (Layer factory) | 15.3.3 |
| `lib/iiot/adapters/ingestion-service.ts:177` | IngestionAdapter service interface | 15.6.3 |
| `lib/iiot/adapters/ingestion-service.ts:297-322` | SparkplugPipelineLayer (full pipeline) | 15.3.3, 15.9.1 |
| `lib/iiot/realtime/event-distribution.ts` | EventDistribution (4-channel hub) | 15.3.4, 15.9.4 |
| `lib/iiot/realtime/holonet-bridge.ts` | HolonetBridge (NATS distributed) | 15.3.5, 15.9.1 |
| `lib/iiot/realtime/websocket-server.ts:68-137` | WebSocket server (T0 clients) | 15.3.2 |
| `lib/iiot/entity/EntityStack.ts:54-67` | EntityHandlersLayer (12 entity types) | 15.3.4, 15.9.1 |
| `lib/iiot/state/` | State services (NATS KV-backed) | 15.3.4 |

---

## 15.11 References

### Normative

- [RFC2119] — Bradner, S. "Key words for use in RFCs."
- [ISA-18.2] — ANSI/ISA-18.2-2016. Management of Alarm Systems.
- [FDA-CFR11] — U.S. FDA, 21 CFR Part 11. Electronic Records.
- [NATS-DECENTRALIZED] — Synadia. "NATS Decentralized JWT Authentication."
- [NATS-JWT] — Synadia. "In-Depth JWT Guide for NATS."

### Informative

- [TMNL-SECURITY] — "Security, Trust & Tenant Isolation." `rfc-section-security-trust.md`
- [TMNL-CONSISTENCY] — "Two-Domain Consistency Model." `rfc-section-two-domain-consistency.md`
- [research-uns-metropolitan.md] — UNS patterns, metropolitan routing
- [research-manufacturing-commons.md] — Platform economics, small manufacturer focus

---

*End of RFC-001 Section 15: Edge-First Architecture*

---

<!-- Source: rfc-section-deployment-topology.md -->
## 16.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

---

## 16.2 NATS Topology for 200K Organizations

### 16.2.1 Three-Level Hub-and-Spoke Architecture

The NATS deployment for 200,000 organizations MUST use a three-level
hub-and-spoke topology based on NATS leaf nodes [NATS-LEAFNODE]:

```
                    ┌─────────────────────────────┐
                    │      NATS Supercluster       │
                    │    (3-5 geographic DCs)       │
                    │                               │
                    │  ┌──────────────────────────┐ │
                    │  │ Gateway mesh:            │ │
                    │  │   DC-East ←──→ DC-West   │ │
                    │  │   DC-East ←──→ DC-South  │ │
                    │  │   DC-West ←──→ DC-South  │ │
                    │  └──────────────────────────┘ │
                    │                               │
                    │  System account:              │
                    │    manufacturing-commons       │
                    │    (marketplace, CRDTs,        │
                    │     network aggregates)        │
                    └────┬──────────┬──────────┬────┘
                         │          │          │
          ┌──────────────┘          │          └──────────────┐
          │                         │                         │
   ┌──────┴───────┐          ┌──────┴───────┐          ┌──────┴───────┐
   │  Hub: East    │          │  Hub: West    │          │  Hub: South   │
   │  (Atlanta)    │          │  (Dallas)     │          │  (Miami)      │
   │  3-node NATS  │          │  3-node NATS  │          │  3-node NATS  │
   │  cluster      │          │  cluster      │          │  cluster      │
   └──────┬───────┘          └──────┬───────┘          └──────┬───────┘
          │                         │                         │
    ┌─────┼─────┐             ┌─────┼─────┐             ┌─────┼─────┐
    │     │     │             │     │     │             │     │     │
   Leaf  Leaf  Leaf          Leaf  Leaf  Leaf          Leaf  Leaf  Leaf
   (T1)  (T2)  (T3)         (T1)  (T2)  (T3)         (T1)  (T2)  (T3)
   Earl  MfgCo BigAero      ...   ...   ...           ...   ...   ...
```

**Level 1 — Supercluster**: 3-5 geographically distributed data centers
connected via NATS gateway mesh [NATS-GATEWAY]. Hosts the `manufacturing-commons`
system account for cross-organization events, CRDT aggregates (G-Counter,
OR-Set, LWW-Register per [rfc-section-two-domain-consistency.md Section X.9]),
and marketplace data. Gateway routes are configured to propagate system account
subjects across all DCs.

**Level 2 — Regional Hub**: 3-node NATS clusters serving a metropolitan area
or geographic region. Each hub handles 10,000-50,000 organization leaf nodes.
Hub clusters run JetStream for cross-org stream aggregation and NATS KV for
network-level state. Hubs connect to the supercluster via gateway protocol.

**Level 3 — Organization Leaf Node**: Each organization's edge device
(T1/T2/T3) runs a NATS leaf node that connects to its nearest regional hub.
The leaf node provides local NATS pub/sub and JetStream within the
organization's account. Leaf nodes are transparent to the application layer —
services publish and subscribe to subjects as if connected to the hub directly.

### 16.2.2 NATS Account-per-Organization

Each organization MUST map to a dedicated NATS Account [NATS-ACCOUNTS] as
specified in [rfc-section-security-trust.md Section Z.3]. This is the primary
isolation and routing boundary.

```
Operator Key (platform root of trust, HSM-stored)
  │
  ├── Account: earl-machine-shop
  │     ├── User: earl-edge-001 (CNC gateway, T1)
  │     │     Permissions:
  │     │       Publish: iiot.readings.>, iiot.entity.>
  │     │       Subscribe: iiot.>, commons.notifications.earl-machine-shop.>
  │     └── User: earl-phone-001 (operator T0 device)
  │           Permissions:
  │             Publish: iiot.rpc.>
  │             Subscribe: iiot.entity.>, iiot.alarms.>
  │
  ├── Account: precision-machining-inc
  │     ├── User: pm-edge-001 (factory gateway, T2)
  │     ├── User: pm-edge-002 (secondary line, T2)
  │     └── User: pm-cloud-001 (cloud analytics)
  │
  ├── Account: aero-dynamics-corp
  │     ├── User: ad-edge-001 (plant-1 server, T3)
  │     ├── User: ad-edge-002 (plant-2 server, T3)
  │     └── User: ad-cloud-001 (analytics cluster)
  │
  └── Account: manufacturing-commons (system)
        ├── User: commons-aggregator
        └── User: commons-monitor
```

**Subject namespace isolation**: Within an account, subjects are invisible to
other accounts. `iiot.readings.*` in Earl's account is separate from
`iiot.readings.*` in Precision Machining's account. No collision, no leakage.

**Intra-org subjects do NOT include orgId**: Because accounts provide implicit
isolation, subjects within an account MUST NOT include the orgId prefix:

```
# WITHIN an org account (intra-org):
iiot.entity.{entityType}.{entityId}
iiot.readings.{siteId}.{deviceId}
iiot.alarms.{siteId}.{deviceId}

# ACROSS accounts (system account, cross-org):
commons.capacity.{orgId}
commons.marketplace.workorder.{workOrderId}
commons.reputation.{orgId}
```

This resolves the NATS subject inconsistency identified in
[review-effect-specialist-diff.md Section I-2]: intra-org subjects use the
two-domain consistency format (no orgId), cross-org subjects use explicit orgId.

### 16.2.3 Leaf Node Connection Protocol

The leaf node connection sequence for an edge device:

```
Step 1: Boot
  └─ Load NATS config + JWT from encrypted local storage
  └─ Validate JWT expiry (if expired: enter degraded mode, local-only)

Step 2: Start Local NATS
  └─ Start embedded NATS server in leaf node mode
  └─ Start local JetStream domain ({orgId}-edge-{deviceId})
  └─ Local pub/sub available immediately (no hub needed)

Step 3: Connect to Hub (async, non-blocking)
  └─ TLS 1.3 handshake to hub (nats://hub-east.network.io:7422)
  └─ JWT authentication (account + user)
  └─ Leaf node auto-subscribes to system imports:
       commons.notifications.{orgId}.>
  └─ Leaf node auto-exports per account config:
       capacity.available → manufacturing-commons
       health.{orgId}.metrics → manufacturing-commons (opt-in)

Step 4: Start Application Services
  └─ SparkplugAdapterLive (MQTT → NATS bridge)
  └─ ReadingProcessor + AlarmDetector
  └─ @effect/cluster SingleRunner (T2+) or SocketRunner (T3)
  └─ WebSocket server for T0 clients

Step 5: Normal Operation
  └─ Intra-org traffic stays local (leaf node ↔ local NATS)
  └─ Cross-org traffic routes: leaf → hub → supercluster
  └─ JetStream mirrors to cloud domain (continuous)
```

**Critical property**: Steps 1-2 and 4 do NOT depend on Step 3. If the hub is
unreachable, the edge device enters fully operational local mode. Step 3
completes asynchronously when connectivity is restored.

### 16.2.4 Hub Capacity Planning

Each regional hub cluster MUST be sized for its expected leaf node count:

| Hub Size | Nodes | Leaf Nodes | Accounts | Cross-Org Events/sec | JetStream |
|----------|-------|-----------|----------|---------------------|-----------|
| Small | 3 | 1,000-5,000 | 1,000-5,000 | ~50-250 | 500 GB |
| Medium | 5 | 5,000-20,000 | 5,000-20,000 | ~250-1,000 | 2 TB |
| Large | 7 | 20,000-50,000 | 20,000-50,000 | ~1,000-2,500 | 5 TB |
| XLarge | 9 | 50,000-100,000 | 50,000-100,000 | ~2,500-5,000 | 10 TB |

At 200K organizations with 3-5 hubs, each hub serves 40K-67K leaf nodes
(Large to XLarge configuration).

**Hub resource requirements** (per node in a 7-node Large cluster):

| Resource | Value | Rationale |
|----------|-------|-----------|
| CPU | 16 cores | NATS is CPU-bound for message routing |
| RAM | 64 GB | JetStream page cache + connection state |
| Storage | 2 TB NVMe | JetStream file storage |
| Network | 10 GbE | Leaf node fan-in + gateway traffic |

### 16.2.5 JetStream Stream Configuration per Level

**Leaf Node (per-org) Streams**:

```
# Telemetry — high volume, short retention
Stream:     ORG_TELEMETRY
Subjects:   iiot.readings.>
MaxAge:     Tier-dependent (T1: 1d, T2: 30d, T3: 1yr)
MaxBytes:   Tier-dependent (T1: 1GB, T2: 50GB, T3: 500GB)
Storage:    File
Replicas:   1 (T1/T2), 3 (T3 cluster)
Discard:    Old (drop oldest when MaxBytes reached)

# Entity Events — regulatory retention
Stream:     ORG_ENTITY_EVENTS
Subjects:   iiot.entity.>
MaxAge:     Tier-dependent (T1: 30d, T2: 1yr, T3: 7yr)
MaxBytes:   Tier-dependent (T1: 100MB, T2: 5GB, T3: 50GB)
Storage:    File
Replicas:   1 (T1/T2), 3 (T3 cluster)
DenyPurge:  true (T2+, regulatory compliance)
DenyDelete: true (T2+, regulatory compliance)

# Alarms — ISA-18.2 retention
Stream:     ORG_ALARMS
Subjects:   iiot.alarms.>
MaxAge:     Tier-dependent (T1: 30d, T2: 1yr, T3: 7yr)
MaxBytes:   Tier-dependent (T1: 50MB, T2: 2GB, T3: 20GB)
Storage:    File
DenyPurge:  true (all tiers — alarm records are always regulatory)
DenyDelete: true
```

**Hub (regional) Streams**:

```
# Cross-org marketplace events
Stream:     COMMONS_MARKETPLACE
Subjects:   commons.marketplace.>
MaxAge:     90 days
MaxBytes:   100 GB
Storage:    File
Replicas:   3

# Organization health metrics (opt-in)
Stream:     COMMONS_HEALTH
Subjects:   commons.health.>
MaxAge:     30 days
MaxBytes:   50 GB
Storage:    File
Replicas:   3

# KV: Network capacity (CRDT substrate)
Bucket:     NETWORK_CAPACITY
Key Pattern: capacity.{orgId}
History:    5
TTL:        5 minutes (stale org detection)

# KV: Capability registry (CRDT substrate)
Bucket:     NETWORK_CAPABILITIES
Key Pattern: capabilities.{orgId}
History:    3
TTL:        1 hour
```

**Supercluster Streams**:

```
# Global marketplace mirror (aggregated from all hubs)
Stream:     GLOBAL_MARKETPLACE
Subjects:   commons.marketplace.>
MaxAge:     1 year
Storage:    File
Replicas:   5 (across DCs)
Sources:    Mirrored from all hub COMMONS_MARKETPLACE streams

# Global health (aggregated, for platform operations)
Stream:     GLOBAL_HEALTH
Subjects:   commons.health.>
MaxAge:     90 days
Storage:    File
Replicas:   3
```

---

## 16.3 @effect/cluster Deployment Profiles

### 16.3.1 Profile Matrix

Each edge tier maps to a specific @effect/cluster deployment profile. These
profiles are verified against the transport options documented in
[research-cluster-patterns.md Section 5].

| Tier | Runner Module | Transport | RunnerStorage | Health Check |
|------|-------------|-----------|--------------|-------------|
| T0 | None (client-only) | WebSocket (RpcClient) | N/A | N/A |
| T1 | SingleRunner (optional) | In-process | SQLite (local) | Local only |
| T2 | SingleRunner + SQL | In-process | SQLite or PostgreSQL | Local + hub |
| T3 | SocketRunner cluster | TCP Socket binary | PostgreSQL | Full cluster |
| Cloud | HttpRunner cluster | HTTP + WebSocket | PostgreSQL | Full cluster |

### 16.3.2 T0 Profile: Client-Only (No Cluster)

T0 devices connect as WebSocket RPC clients. No cluster Layer is needed:

```typescript
// T0: Browser or mobile app
import { RpcClient } from "@effect/rpc"

const client = yield* RpcClient.make(IIoTRpcs, {
  transport: RpcClientProtocolWebsocket({
    url: "wss://edge-gateway.local/ws/iiot"
    // OR: "wss://cloud.mfg-network.io/ws/iiot"
  })
})

// Read-only operations
const stream = yield* client.Realtime.SubscribeEntityChanges({
  entityTypes: ['Machine', 'Alarm'],
  isaLevels: ['L1', 'L2'],
})

// Alarm acknowledgment (write via RPC)
yield* client.Alarm.Acknowledge({
  alarmId: 'ALM-001',
  operatorId: 'earl',
})
```

### 16.3.3 T1 Profile: Minimal SingleRunner

T1 devices MAY run SingleRunner for basic entity processing:

```typescript
// T1: Raspberry Pi with SQLite
import { SingleRunner } from "@effect/cluster"
import { SqliteClient } from "@effect/sql-sqlite-bun"

const T1ClusterLayer = Layer.mergeAll(
  SingleRunner.layer,
  SqliteClient.layer({ filename: "/data/cluster.db" }),
  ShardingConfig.layer({
    shardsPerGroup: 10,
    maxIdleTime: Duration.minutes(5),  // Aggressive reaping for low RAM
    entityTerminationTimeout: Duration.seconds(5),
  }),
)

// Register only essential entity types (5 of 12)
const T1EntityLayer = Layer.mergeAll(
  MachineEntity.toLayer(makeMachineHandlers),
  DeviceEntity.toLayer(makeDeviceHandlers),
  SensorEntity.toLayer(makeSensorHandlers),
  AlarmEntity.toLayer(makeAlarmHandlers),
  EquipmentStateEntity.toLayer(makeEquipmentStateHandlers),
)
```

**Shard math**: 1 shard group x 10 shards = 10 total shards. With max 50
entities, ~5 entities/shard. SingleRunner processes all shards in-process —
no network transport.

### 16.3.4 T2 Profile: Full SingleRunner with Entity Stack

T2 devices MUST run SingleRunner with the complete entity processing stack:

```typescript
// T2: Industrial gateway with SQLite/PostgreSQL
const T2ClusterLayer = Layer.mergeAll(
  SingleRunner.layer,
  SqliteClient.layer({ filename: "/data/cluster.db" }),
  ShardingConfig.layer({
    shardsPerGroup: 50,
    maxIdleTime: Duration.minutes(2),
    entityTerminationTimeout: Duration.seconds(10),
  }),
)

// Full entity processing — all 12 types
const T2ApplicationLayer = T2ClusterLayer.pipe(
  Layer.provideMerge(EntityHandlersLayer),   // 12 entity types
  Layer.provideMerge(EventDistributionLayer), // 4+ channels
  Layer.provideMerge(SparkplugPipelineLayer({ sparkplug: config })),
  Layer.provideMerge(WebSocketServerLayer),   // T0 client serving
)
```

**Shard math**: 3 shard groups x 50 shards = 150 total shards. With max 500
entities, ~3.3 entities/shard.

**Shard group selection**: T2 uses 3 of the 5 shard groups:
- `asset-hierarchy` (Site, Plant, Area, Line, WorkCell) — moderate churn
- `equipment` (Machine, Device, Sensor) — high churn
- `operational` (Alarm, WorkOrder, EquipmentState) — event-sourced

The `org-identity` group is omitted (single org, no need). The `telemetry` group is
omitted (sensor readings handled by ingestion pipeline, not entity actors).

### 16.3.5 T3 Profile: Multi-Runner SocketRunner Cluster

T3 deployments MUST use SocketRunner for multi-node distribution:

```typescript
// T3: Multi-node cluster with PostgreSQL
import { SocketRunner } from "@effect/cluster"

const T3ClusterLayer = Layer.mergeAll(
  SocketRunner.layer({ host: "0.0.0.0", port: 34437 }),
  PgClient.layer({
    host: "cluster-db.local",
    database: "cluster",
    pool: { min: 5, max: 20 },
  }),
  ShardingConfig.layer({
    shardsPerGroup: 300,
    maxIdleTime: Duration.minutes(1),
    entityTerminationTimeout: Duration.seconds(15),
    runnerRefreshInterval: Duration.seconds(3),
  }),
)

// 5 shard groups with ClusterSchema annotations
const SensorEntity = Entity.make("Sensor", SensorRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "telemetry")

const MachineEntity = Entity.make("Machine", MachineRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "equipment")

const AlarmEntity = Entity.make("Alarm", AlarmRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "operational")

const SiteEntity = Entity.make("Site", SiteRpcGroup)
  .annotate(ClusterSchema.ShardGroup, "asset-hierarchy")
```

**Runner topology**: T3 deployments SHOULD run 3+ runner nodes. The runner
`weight` parameter controls shard proportionality
[research-cluster-patterns.md Section 5.4]:

```
Runner 1 (primary):    weight=2 → ~60% of shards (900 of 1,500)
Runner 2 (secondary):  weight=1 → ~20% of shards (300 of 1,500)
Runner 3 (secondary):  weight=1 → ~20% of shards (300 of 1,500)
```

When a runner joins or leaves, `HashRing` recomputes shard assignments.
Shard migration causes a ~15-second silence window per affected entity
[research-cluster-patterns.md Section 1.3].

### 16.3.6 Cloud Profile: HttpRunner Cluster

Cloud deployments serving organizations without local edge processing use
HttpRunner:

```typescript
// Cloud: HTTP-based inter-runner communication
import { HttpRunner } from "@effect/cluster"

const CloudClusterLayer = Layer.mergeAll(
  HttpRunner.layerHttp,
  PgClient.layer({
    host: "cluster-db.internal",
    database: "cluster",
    pool: { min: 10, max: 50 },
  }),
  ShardingConfig.layer({
    shardsPerGroup: 300,
    entityTerminationTimeout: Duration.seconds(15),
  }),
)
```

Cloud clusters MUST also expose the WebSocket server for T0 clients and
the HTTP API for MES/ERP integration.

---

## 16.4 Edge-Cloud Reconciliation Protocol

### 16.4.1 Offline Operation Model

When an edge device loses cloud connectivity, the system enters a two-phase
model:

```
PHASE 1: ONLINE (Normal)
═════════════════════════
  Events ──► Local NATS ──► Leaf Node ──► Hub ──► Supercluster
  JetStream mirror: continuous
  Cross-org exports: real-time
  CRDT updates: live

PHASE 2: OFFLINE
════════════════
  Events ──► Local NATS ──► Local JetStream (persisted)
  Leaf Node: disconnected (outbound buffer accumulates)
  Cross-org exports: queued in leaf outbound buffer
  CRDT updates: stale (org entry ages toward TTL)

PHASE 3: RECONNECTING
═════════════════════
  Leaf Node: re-establishes TLS + JWT auth
  Subscriptions: auto-restored
  Outbound buffer: drained (queued messages delivered to hub)
  JetStream mirror: catches up (per-entity ordered)
  CRDT updates: refreshed (org entry updated, OrgStale cleared)
```

### 16.4.2 Reconnection Sequence (Detailed)

Upon detecting connectivity restoration, the following sequence executes:

**Step 1 — Transport reconnection** (automatic, NATS library):
- Leaf node protocol re-establishes TLS 1.3 handshake
- JWT re-validated by hub server
- If JWT expired: connection rejected → device operates in degraded local mode
  until new JWT provisioned

**Step 2 — Subscription restoration** (automatic, NATS library):
- All imported subjects re-subscribed
- All exported subjects re-advertised
- Queued outbound messages begin draining

**Step 3 — JetStream domain sync** (automatic, JetStream mirror):
- Local domain begins streaming queued messages to cloud mirror
- Messages delivered in per-entity sequential order (G-1 preserved)
- Cloud domain receives events with original `originTimestamp` plus new
  `networkTimestamp` reflecting actual ingestion time
- Mirror lag metric tracks catchup progress

**Step 4 — Cross-org event delivery** (automatic, via export):
- Capacity updates, marketplace events delivered from outbound buffer
- Events that aged beyond the 60-second G-8 staleness window are still
  delivered but carry stale `originTimestamp`
- Consumers SHOULD use `networkTimestamp` for cross-org ordering

**Step 5 — Stale org advisory clearance**:
- If org was offline > 5 minutes (CRDT TTL), hub emitted `OrgStale` advisory
- On reconnection: CRDT entry refreshed, `OrgStale` advisory cleared
- Network aggregates converge to include the org's current values

**Step 6 — Sequence gap detection** (application layer):
- Cloud domain compares expected vs received sequence numbers per entity
- Gaps indicate events lost during offline (JetStream overflow on edge)
- `SequenceGapDetected` event logged with gap range
- No automatic gap filling — edge JetStream is authoritative (E-1)

### 16.4.3 Conflict Resolution Rules

| Data Type | Authority | Mechanism |
|-----------|----------|-----------|
| Sensor readings | Edge (`originTimestamp`) | Physical measurement at edge |
| Entity state | Edge (sequence number) | Entity actor runs on edge |
| Alarm lifecycle | Edge (ISA-18.2 timestamp) | Safety-critical, local authority |
| Work order state | Edge (sequence number) | Local processing authority |
| Cross-org capacity | Cloud (`networkTimestamp`) | Network view = cloud authority |
| Marketplace events | Cloud (`networkTimestamp`) | Marketplace is cloud service |
| Network aggregates | Cloud (CRDT merge) | CRDTs converge without conflict |

**No split-brain**: Entity actors run exclusively on the edge device. The cloud
receives event notifications, not entity RPCs. There is no cloud-side entity
state to conflict with. Split-brain is architecturally impossible for
intra-org data. This is a direct consequence of E-1 (Edge Sovereignty).

---

## 16.5 Upgrade and Migration Paths

### 16.5.1 T1 to T2 Upgrade

**When**: Organization outgrows T1 (>50 entities, needs entity processing,
requires 30-day retention, wants full alarm management).

**Phase 1 — Hardware Migration** (1 day):
1. Provision T2 hardware alongside existing T1 (parallel operation)
2. Configure T2 with same NATS account credentials (same JWT)
3. Stop services on T1
4. Start NATS leaf node on T2 (same account, different user JWT)
5. Migrate Sparkplug adapter configuration from T1 to T2
6. T1 decommissioned or repurposed as backup

**Phase 2 — Capability Activation** (1-2 days):
1. Enable @effect/cluster SingleRunner with SQLite
2. Deploy EntityHandlersLayer with 3 shard groups (`asset-hierarchy`, `equipment`, `operational`)
3. Enable EventDistribution with 4 channels
4. Expand JetStream retention: MaxAge → 30 days, MaxBytes → 50 GB
5. Enable WebSocket server for T0 clients

**Phase 3 — Validation** (1 week):
1. Verify entity state processing (all 12 types)
2. Verify alarm detection and lifecycle management
3. Verify T0 dashboard connectivity
4. Verify cloud mirror (if connected)

**Data migration**: JetStream streams from T1 are NOT migrated. Entity state
is reconstructed from current NATS KV values or from first incoming messages.
Historical data older than T1 retention (1 day) is lost — acceptable for
small deployments transitioning to longer retention.

### 16.5.2 T2 to T3 Upgrade

**When**: Organization outgrows T2 (>500 entities, needs HA, requires 1-year
retention, wants ML inference).

**Phase 1 — Infrastructure** (1-2 weeks):
1. Deploy T3 server hardware or VM cluster (3+ nodes)
2. Install PostgreSQL for RunnerStorage (replaces SQLite)
3. Deploy 3-node NATS cluster (replaces single-node NATS)
4. Configure JetStream with 3 replicas
5. Migrate NATS leaf node config to cluster mode

**Phase 2 — Cluster Migration** (2-3 days):
1. Deploy @effect/cluster SocketRunner on first T3 node
2. Configure 5 shard groups (`org-identity`, `marketplace`, `asset-hierarchy`, `equipment`, `operational`) with `ClusterSchema.ShardGroup` annotations
3. Start runner on node 1 — all shards assigned to this runner
4. Start runner on node 2 — HashRing rebalances ~33% of shards
5. Start runner on node 3 — HashRing rebalances to ~33% each
6. Verify entity processing continues during rebalance

**Phase 3 — Data Migration** (1-3 days):
1. JetStream streams migrated via NATS stream export/import
2. RunnerStorage migrated from SQLite to PostgreSQL via dump/restore
3. Retention extended: Entity events → 7 years, telemetry → 1 year
4. DenyPurge and DenyDelete enabled for regulatory streams

### 16.5.3 Growth Timeline

Typical organization growth path:

| Stage | Duration | Tier | Entities | Monthly Cost |
|-------|---------|------|----------|-------------|
| Pilot | Month 1-3 | T1 | 5-20 | $5-15 (hardware amortized) |
| Adoption | Month 3-12 | T1/T2 | 20-100 | $50-150 |
| Production | Year 1-3 | T2 | 100-500 | $150-500 |
| Enterprise | Year 3+ | T3 | 500-5,000+ | $500-5,000+ |

The platform MUST NOT require organizations to start at T2 or T3. The T1
entry point at $50-200 hardware cost is essential for manufacturing commons
participation (the Earl Test).

---

## 16.6 Multi-Site Expansion

### 16.6.1 Single-Account Multi-Site Pattern

Organizations with multiple physical sites SHOULD deploy one edge device per
site, all sharing the same NATS account:

```
Organization: Aero Dynamics Corp (Account: aero-dynamics-corp)

  Plant 1 (T3 server) ── Leaf Node ──┐
                                      ├──► Hub East ──► Supercluster
  Plant 2 (T2 gateway) ── Leaf Node ──┤
                                      │
  Plant 3 (T1 RPi)    ── Leaf Node ──┘

Shared account subjects:
  iiot.entity.Machine.MCH-001    (Plant 1)
  iiot.entity.Machine.MCH-050    (Plant 2)
  iiot.readings.P1.*             (Plant 1 telemetry)
  iiot.readings.P2.*             (Plant 2 telemetry)
  iiot.readings.P3.*             (Plant 3 telemetry)
```

### 16.6.2 Cross-Site Visibility

Within a single account, all leaf nodes receive each other's subjects
(after hub routing). This enables:

- **Corporate dashboard**: T0 device subscribes to `iiot.entity.>` across
  all sites
- **Cross-site alarm aggregation**: Subscribe to `iiot.alarms.>` for
  enterprise-wide alarm management
- **OEE comparison**: Subscribe to OEE events from all production lines

### 16.6.3 Cross-Site Entity Distribution

For organizations with T3 at one site and T2/T1 at others, entity processing
can be centralized:

```
Pattern: Hub-and-Spoke Entity Processing

  Plant 1 (T3) ── Runs @effect/cluster for ALL sites
    ├── Processes entities for Plant 1 (local)
    ├── Processes entities for Plant 2 (via NATS subjects)
    └── Processes entities for Plant 3 (via NATS subjects)

  Plant 2 (T2) ── Runs ingestion only, no entity cluster
    └── SparkplugAdapter → publishes to shared account subjects

  Plant 3 (T1) ── Runs ingestion only
    └── SparkplugAdapter → publishes to shared account subjects
```

**Trade-off**: Centralizing entity processing at one T3 site means Plants 2
and 3 lose entity processing during Plant 1's downtime. For HA-critical
organizations, each site SHOULD run its own entity cluster.

### 16.6.4 Hierarchical Site Subjects

Multi-site organizations SHOULD use site-scoped subjects for efficient
filtering:

```
# Site-scoped subject pattern
iiot.readings.{siteId}.{areaId}.{deviceId}
iiot.entity.{siteId}.{entityType}.{entityId}
iiot.alarms.{siteId}.{areaId}.{deviceId}

# Wildcard subscriptions
iiot.readings.PLANT-1.>          ← All telemetry from Plant 1
iiot.entity.PLANT-2.Machine.*    ← All machine events from Plant 2
iiot.alarms.>                    ← All alarms across all sites
```

---

## 16.7 Capacity Planning

### 16.7.1 Network-Wide Estimates

| Metric | Per-Org Average | 200K Orgs Total |
|--------|----------------|-----------------|
| Active entities | ~71 | ~14.2M |
| Concurrent entities (1-5%) | ~1-4 | ~140K-710K |
| Sensor readings/sec | ~5-50 | ~1M-10M |
| Entity events/day | ~43 | ~8.6M |
| Cross-org events/day | ~0.5 | ~100K |
| JetStream per-org | ~2 GB | ~400 TB (cloud mirrors) |
| WebSocket connections/org | ~2-5 | ~400K-1M |

### 16.7.2 Scaling Triggers

| Trigger | Current | Action |
|---------|---------|--------|
| Hub leaf nodes > 50K | Large hub | Deploy additional hub, rebalance |
| Entity events/sec > 1K/hub | Large hub | Scale JetStream nodes |
| Supercluster latency > 100ms | 3 DCs | Add DC in affected region |
| WebSocket connections > 100K/hub | Cloud tier | Add WebSocket server nodes |
| RunnerStorage queries > 10K/sec | PostgreSQL | Read replicas |

---

## 16.8 Database Architecture

The manufacturing commons relies on a dual-engine PostgreSQL deployment that serves
both time-series telemetry and graph-structured asset relationships from a single
database instance per organization. This section specifies the storage engine
selection, schema isolation model, data lifecycle policies, and per-tier deployment
profiles for the TMNL data layer.

### 16.8.1 Dual-Engine Design

The TMNL database image extends TimescaleDB HA (PostgreSQL 16, TimescaleDB 2.17)
with two critical extensions:

```
┌─────────────────────────────────────────────────────┐
│                PostgreSQL 16                        │
│                                                     │
│  ┌─────────────────┐   ┌─────────────────────────┐  │
│  │   TimescaleDB    │   │     Apache AGE 1.5      │  │
│  │                  │   │                         │  │
│  │ - Hypertables    │   │ - iiot_graph            │  │
│  │ - Continuous     │   │ - Cypher queries        │  │
│  │   aggregates     │   │ - Asset hierarchy       │  │
│  │ - Compression    │   │ - Event causality       │  │
│  │ - Retention      │   │ - [:contains]           │  │
│  │   policies       │   │ - [:monitors]           │  │
│  └─────────────────┘   └─────────────────────────┘  │
│                                                     │
│  ┌─────────────────┐   ┌─────────────────────────┐  │
│  │    pg_lake       │   │  pg_stat_statements     │  │
│  │  (optional)      │   │  btree_gist             │  │
│  │ DuckDB/Iceberg   │   │  Query monitoring       │  │
│  └─────────────────┘   └─────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Time-series engine (TimescaleDB)**. Implementations MUST use TimescaleDB
hypertables for all sensor reading storage. Raw sensor data is chunked by 7-day
intervals with 4-way hash partitioning on `device_id` for high-cardinality
workloads [KLEPPMANN, Ch. 6]. Continuous aggregates at 1-minute, 1-hour, and
1-day granularity provide pre-computed roll-ups without scan overhead.

**Graph engine (Apache AGE)**. Implementations MUST use Apache AGE for the
ISA-95 asset hierarchy and event causality chains. The graph `iiot_graph`
stores plant, line, machine, and sensor nodes connected by `[:contains]` and
`[:monitors]` relationships [ISA-95-1]. Cypher queries enable recursive
traversal: "find all sensors on machines in Plant A" without N+1 joins.

**Analytics engine (pg_lake, OPTIONAL)**. When available, pg_lake enables
Iceberg table format access via DuckDB, allowing cold analytical queries against
S3/MinIO-stored historical data without loading into hot storage.

### 16.8.2 Schema Isolation Model

The manufacturing commons supports 200,000+ organizations. The database
architecture uses a **single-schema, account-scoped** model rather than
schema-per-tenant:

```
Approach: Single schema with account scoping
─────────────────────────────────────────────

  iiot.sensor_readings
  ┌──────────────────────────────────────────────┐
  │ time     │ device_id     │ value  │ quality  │
  ├──────────┼───────────────┼────────┼──────────┤
  │ 12:00:01 │ TMP-001       │ 24.3   │ 100      │  ← Org A
  │ 12:00:01 │ TMP-001       │ 31.2   │ 100      │  ← Org B (different NATS account)
  └──────────┴───────────────┴────────┴──────────┘

  Isolation enforcement:
  ┌───────────────────────────────────────────────┐
  │ L1: NATS account-per-org        (network)     │
  │ L2: JetStream domain-per-org    (stream)      │
  │ L3: PostgreSQL per-org instance (T2+) or      │
  │     embedded SQLite (T1)         (storage)     │
  │ L4: RLS policies on cloud-tier  (query)       │
  └───────────────────────────────────────────────┘
```

**T0 (Phone) and T1 (SBC)**. No local PostgreSQL instance. Sensor data is
buffered in NATS JetStream (T1) or device memory (T0) and mirrored to the
cloud-tier database upon connectivity. T1 devices MAY use embedded SQLite for
local retention when JetStream storage is insufficient.

**T2 (Gateway) and T3 (Server)**. Each organization runs its own PostgreSQL
instance with TimescaleDB. The `iiot` schema namespace is private to that org.
No cross-org queries are possible at the database level — isolation is
structural, not policy-based.

**Cloud tier (Hub)**. Hub databases serve organizations that lack edge
PostgreSQL (T0/T1 orgs). Cloud instances MUST use PostgreSQL Row-Level Security
(RLS) policies scoped to `org_id` for any shared-database deployments.
Implementations SHOULD prefer per-org database instances where
operationally feasible.

### 16.8.3 Time-Series Data Lifecycle

Sensor readings follow a tiered lifecycle from hot to cold storage:

```
INGEST (real-time)                    AGGREGATE            COMPRESS        ARCHIVE
─────────────────                     ─────────            ────────        ───────
sensor_readings                       readings_1min        (compressed)    pg_lake
(hypertable)                          readings_1hour       chunks          Iceberg
                                      readings_1day

 ┌────────┐  7-day    ┌──────────┐  1-min    ┌──────────┐  30-day   ┌──────────┐
 │  RAW   │──chunks──▶│ 1-MIN    │──refresh─▶│ 1-HOUR   │──compress▶│ ARCHIVE  │
 │ data   │           │ cagg     │           │ cagg     │           │ (cold)   │
 └────────┘           └──────────┘           └──────────┘           └──────────┘
      │                     │                     │
      │ 2yr retention       │ 1yr retention       │ 5yr retention
      ▼                     ▼                     ▼
   [DROP]               [DROP]                 [DROP]

 readings_1day: RETAINED FOREVER (no drop policy)
```

| Data Layer | Chunk Interval | Compression | Retention | Tier Availability |
|------------|---------------|-------------|-----------|-------------------|
| `sensor_readings` | 7 days | After 30 days (segmentby=device_id) | 2 years | T2, T3, Cloud |
| `readings_1min` | Auto | After 90 days | 1 year | T2, T3, Cloud |
| `readings_1hour` | Auto | None | 5 years | T3, Cloud |
| `readings_1day` | Auto | None | Forever | Cloud |
| Iceberg (pg_lake) | N/A | Columnar | 7+ years [FDA-CFR11] | Cloud |

**Regulatory compliance**. For organizations subject to FDA 21 CFR Part 11 or
equivalent GxP regulations, the 1-day aggregate layer MUST be retained for a
minimum of 7 years. Implementations MUST support immutable audit trails via
the EventJournal (append-only event log) for regulatory inspection
[FDA-CFR11].

### 16.8.4 Graph Database Schema

The Apache AGE graph models the ISA-95 equipment hierarchy as a property graph:

```
Node Labels                      Edge Labels
──────────                       ───────────
:enterprise                      [:contains]    — Hierarchical ownership
:site                            [:monitors]    — Sensor→Machine observation
:area                            [:triggered_by] — Alarm→Sensor causality
:plant                           [:caused]      — Alarm→Alarm cascade chain
:line
:machine
:sensor
```

**Hierarchy traversal**. Cypher queries on `iiot_graph` enable efficient
multi-hop traversal for operations like "find all sensors in alarm state
within Plant A":

```sql
SELECT * FROM cypher('iiot_graph', $$
    MATCH (p:plant {id: 'PLANT-A'})-[:contains*]->(asset)
    RETURN labels(asset)[0] AS type, asset.id AS id, asset.name AS name
$$) AS (type agtype, id agtype, name agtype);
```

**Per-tier graph deployment**:

| Tier | Graph Engine | Scope |
|------|-------------|-------|
| T0 | None | No local graph — uses cloud mirror |
| T1 | NATS KV flat keys | `host.{id}` keys for asset registry, no traversal |
| T2 | Apache AGE (local PG) | Full ISA-95 graph, org-scoped |
| T3 | Apache AGE (local PG) | Full graph + cross-org references via marketplace |
| Cloud | Apache AGE (hub PG) | Supergraph for network-wide analytics |

### 16.8.5 Per-Tier Database Profiles

| Characteristic | T1 (SBC) | T2 (Gateway) | T3 (Server) | Cloud (Hub) |
|----------------|----------|-------------|------------|------------|
| **Engine** | SQLite / NATS KV | PostgreSQL 16 + TS + AGE | PostgreSQL 16 + TS + AGE + pg_lake | PostgreSQL 16 + TS + AGE + pg_lake |
| **RAM budget** | 64-128 MB | 512 MB-2 GB | 4-16 GB | 32-128 GB |
| **Disk budget** | 2-8 GB (SD card) | 50-200 GB (SSD) | 500 GB-4 TB (NVMe) | 10+ TB (EBS/NVMe) |
| **Max sensors** | 1-10 | 10-200 | 200-5,000 | 50,000+ (per hub) |
| **Raw retention** | 1 day (NATS buffer) | 30 days | 2 years | 2 years + cold archive |
| **Cagg layers** | None | 1-min only | 1-min, 1-hour | 1-min, 1-hour, 1-day |
| **Graph** | NATS KV flat | AGE local | AGE local | AGE hub supergraph |
| **Backup** | NATS mirror to cloud | pg_basebackup to NFS/S3 | Streaming replication + pg_basebackup | Multi-AZ replication |

### 16.8.6 Schema Migration Strategy

All schema DDL is managed by Effect SQL Migrator [EFFECT-TS], NOT by
Docker init scripts. The migration registry at
`lib/iiot/models/_migrations.ts` defines the ordered migration sequence:

```
Migration Order:
  1. _infrastructure.ddl.ts    — Extensions, schema, graph creation
  2. _functions.ddl.ts         — Helper functions (generate_ulid, etc.)
  3. _graph-seed.ddl.ts        — Seed asset hierarchy nodes + edges
  4. assets/*.ddl.ts           — Asset relational tables
  5. readings/*.ddl.ts         — Hypertables + continuous aggregates
  6. alarms/*.ddl.ts           — Alarm context tables
  7. equipment-state/*.ddl.ts  — Equipment state tracking
  8. work-orders/*.ddl.ts      — Work order lifecycle
  9. _event-journal.ddl.ts     — Append-only event journal
```

Implementations MUST run migrations via `PgMigrator.layer` from `@effect/sql-pg`.
Init.sql is intentionally minimal — it only verifies user context. This
separation ensures identical schema across all PostgreSQL tiers (T2, T3, Cloud)
regardless of how the database instance is provisioned.

---

## 16.9 CDN and API Gateway

The manufacturing commons requires a multi-layer ingress architecture that
handles both traditional HTTP/REST traffic and persistent WebSocket connections
for realtime event streams. This section specifies the gateway topology,
connection management, and geographic load balancing for the Atlanta
metropolitan deployment.

### 16.9.1 Gateway Architecture

```
                     ┌──────────────────────────────┐
                     │        Cloudflare CDN         │
                     │   (static assets, WAF, DDoS)  │
                     └──────────────┬───────────────┘
                                    │
                     ┌──────────────▼───────────────┐
                     │     Geographic DNS (Route 53)  │
                     │  atl-east.tmnl.io              │
                     │  atl-west.tmnl.io              │
                     │  atl-central.tmnl.io           │
                     └──────────────┬───────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
     ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
     │  L7 Gateway      │  │  L7 Gateway      │  │  L7 Gateway      │
     │  (Envoy/Traefik) │  │  (Envoy/Traefik) │  │  (Envoy/Traefik) │
     │  ATL-EAST        │  │  ATL-WEST        │  │  ATL-CENTRAL     │
     └───────┬──────────┘  └────────┬─────────┘  └────────┬─────────┘
             │                      │                      │
      ┌──────┴──────┐       ┌──────┴──────┐       ┌──────┴──────┐
      │ HTTP  │ WS  │       │ HTTP  │ WS  │       │ HTTP  │ WS  │
      │ pool  │ pool│       │ pool  │ pool│       │ pool  │ pool│
      └───────┴─────┘       └──────┴──────┘       └──────┴──────┘
```

**Layer decomposition**:

| Layer | Technology | Responsibility |
|-------|-----------|---------------|
| L1: Edge CDN | Cloudflare | Static assets, WAF, DDoS mitigation, TLS termination |
| L2: DNS routing | Route 53 (weighted) | Geographic proximity, health-based failover |
| L3: L7 gateway | Envoy or Traefik | Path routing, rate limiting, auth token validation |
| L4: Protocol split | Gateway config | HTTP → REST pool; Upgrade → WebSocket pool |
| L5: Service mesh | NATS (internal) | Service-to-service communication bypasses gateway |

### 16.9.2 WebSocket Connection Management

WebSocket connections for realtime IIoT data delivery MUST be handled
differently from stateless HTTP requests:

**Connection lifecycle**:

```
Client                    Gateway                   WS Server
  │                         │                         │
  │─── HTTPS GET /ws/iiot ─▶│                         │
  │    Upgrade: websocket   │                         │
  │    Auth: Bearer <JWT>   │                         │
  │                         │── Validate JWT ────────▶│
  │                         │   (NATS account check)  │
  │                         │                         │
  │                         │── Upgrade ─────────────▶│
  │◀── 101 Switching ───────│                         │
  │                         │                         │
  │◀═══ Binary frames ═════════════════════════════▶│
  │    (msgpack/JSON RPC)   │  (L7 passthrough)      │
  │                         │                         │
  │─── Ping/Pong ──────────▶│── Ping/Pong ──────────▶│
  │    (30s interval)       │                         │
  │                         │                         │
```

**Gateway requirements**:

- Gateway MUST NOT buffer WebSocket frames — stream-through only
- Gateway MUST support HTTP/1.1 Upgrade and HTTP/2 CONNECT for WS
- Gateway MUST forward `X-Forwarded-For` and `X-Real-IP` headers
- Gateway SHOULD set idle timeout to 300s (5 minutes) for WS connections
- Gateway MUST support sticky sessions (session affinity) per WebSocket
  connection to the same upstream server

**Connection limits per gateway node**:

| Resource | Limit | Rationale |
|----------|-------|-----------|
| Max concurrent WS connections | 50,000 | Kernel socket limit per process |
| Max WS connections per org | 100 | Fair-share across 200K orgs |
| WS frame max size | 1 MB | Prevents memory exhaustion |
| WS idle timeout | 300s | Reclaim stale connections |
| Rate limit (frames/sec/conn) | 100 | Prevents runaway clients |

### 16.9.3 Geographic Load Balancing (Atlanta Metro)

The Atlanta metropolitan area deployment spans three availability zones
to minimize latency for manufacturing organizations distributed across
the metro region:

```
                  ATL Metro (200K+ organizations)
    ┌──────────────────────────────────────────────────┐
    │                                                  │
    │   ┌──────────────┐                               │
    │   │  ATL-EAST    │  Midtown/Downtown             │
    │   │  (Zone A)    │  3× hub servers               │
    │   │              │  PostgreSQL primary            │
    │   └──────────────┘                               │
    │                                                  │
    │   ┌──────────────┐      ┌──────────────┐         │
    │   │  ATL-WEST    │      │  ATL-CENTRAL │         │
    │   │  (Zone B)    │      │  (Zone C)    │         │
    │   │  Marietta    │      │  Decatur     │         │
    │   │  3× hub      │      │  3× hub      │         │
    │   │  PG replica  │      │  PG replica  │         │
    │   └──────────────┘      └──────────────┘         │
    │                                                  │
    │   Round-trip latency between zones: < 5ms        │
    └──────────────────────────────────────────────────┘
```

**Routing policy**:

- DNS weighted routing: 40% ATL-EAST, 30% ATL-WEST, 30% ATL-CENTRAL
- Health check failover: If a zone fails health checks for 30s, traffic
  redistributes to remaining zones within 60s
- WebSocket connections MUST NOT be rebalanced mid-session — only new
  connections follow updated routing weights

### 16.9.4 CDN Configuration

Static assets (UI bundles, documentation, firmware images) MUST be served
through CDN edge nodes. Dynamic API traffic MUST bypass CDN and route
directly to L7 gateways.

| Asset Type | Cache TTL | CDN Edge | Purge Strategy |
|------------|----------|----------|---------------|
| UI bundles (JS/CSS) | 1 year | Yes | Content-hash in filename |
| Firmware images | 30 days | Yes | Version-tagged path |
| API responses | No cache | Bypass | N/A |
| WebSocket | No cache | Bypass | N/A |
| Documentation | 1 hour | Yes | On-deploy purge |

**WAF rules**. The CDN WAF MUST block:
- Requests exceeding 10 MB body size (except firmware upload endpoints)
- Known vulnerability scanning patterns (SQLi, XSS, path traversal)
- IP addresses exceeding 1,000 requests/minute to API endpoints
- Non-TLS connections (HTTP MUST redirect to HTTPS)

---

## 16.10 Disaster Recovery

The manufacturing commons implements a tiered disaster recovery strategy
aligned with the edge-first sovereignty principle: edge devices MUST continue
operating during any cloud or hub failure. Recovery targets differ by data
class and organizational tier.

### 16.10.1 Recovery Targets by Data Class

| Data Class | RPO | RTO | Justification |
|------------|-----|-----|--------------|
| Sensor readings (hot) | 0 (edge-local) | 0 (edge-local) | Edge sovereignty — no cloud dependency |
| Sensor readings (cloud mirror) | 5 minutes | 30 minutes | Async mirror via NATS JetStream |
| Entity state (edge) | 0 | 0 | @effect/cluster local persistence |
| Entity state (cloud mirror) | 1 minute | 15 minutes | JetStream R3 replication |
| Alarm events | 0 (edge) / 30s (cloud) | 0 / 5 minutes | Safety-critical data, dual-write |
| Asset hierarchy (graph) | 1 hour | 4 hours | Infrequent changes, pg_basebackup |
| Event journal (audit) | 0 (append-only) | 1 hour | Regulatory — never lose, slow restore OK |
| Cross-org marketplace data | 15 minutes | 1 hour | Eventually consistent by design |
| Configuration / credentials | Real-time | 15 minutes | NATS KV with R3 replication |

**RPO = 0 at the edge** is structural, not aspirational. Because the edge device
is the sovereign authority for its organization's data, a cloud outage does NOT
cause data loss — the data never left the edge. Cloud mirrors exist for
analytics, not for authority [TMNL-EDGE, Section 15.2].

### 16.10.2 NATS Supercluster Cross-DC Replication

The NATS supercluster provides the primary replication mechanism for all
event data across the three Atlanta metro zones:

```
         ┌─────────────────────────────────────────────┐
         │            NATS Supercluster                 │
         │                                             │
         │  ATL-EAST ◄──── gateway ────► ATL-WEST     │
         │     │                            │          │
         │     └──── gateway ──── gateway ──┘          │
         │                  │                          │
         │             ATL-CENTRAL                     │
         │                                             │
         │  JetStream R3: Every stream replicated      │
         │  across all 3 zones                         │
         └─────────────────────────────────────────────┘
```

**Replication guarantees**:

- JetStream streams MUST use `R3` (3 replicas, one per zone) for all
  organization data at the hub tier
- NATS gateway protocol synchronizes subject interest across zones
  with sub-second propagation [NATS-GATEWAY]
- Raft consensus within each JetStream cluster ensures leader
  election completes within 2 seconds of node failure [RAFT]
- Leaf node connections from edge devices reconnect automatically
  to the nearest healthy hub (NATS client retry with backoff)

### 16.10.3 PostgreSQL Disaster Recovery

**Hub-tier PostgreSQL** (cloud databases serving T0/T1 orgs and analytics):

```
                   ATL-EAST (Primary)
                   ┌───────────────────┐
                   │  PostgreSQL 16    │
                   │  TimescaleDB HA   │
                   │  Write primary    │
                   └────────┬──────────┘
                            │ Streaming replication
               ┌────────────┼────────────┐
               │                         │
    ATL-WEST (Replica)        ATL-CENTRAL (Replica)
    ┌───────────────────┐     ┌───────────────────┐
    │  Hot standby       │     │  Hot standby       │
    │  Read replica      │     │  Read replica      │
    │  Async (< 1s lag)  │     │  Async (< 1s lag)  │
    └───────────────────┘     └───────────────────┘
```

| Component | Strategy | RPO | RTO | Mechanism |
|-----------|----------|-----|-----|-----------|
| PG primary | Multi-AZ standby | < 1 minute | 5 minutes | Streaming replication + auto-failover |
| PG replicas | 2 read replicas | N/A (reads) | 2 minutes | Hot standby in separate zones |
| TimescaleDB hypertables | Continuous backup | 5 minutes | 30 minutes | pgBackRest to S3 + WAL archiving |
| Apache AGE graph | Included in PG backup | Same as PG | Same as PG | Replicated with base tables |
| pg_lake / Iceberg | Object storage native | 0 (S3) | 0 (S3) | S3 cross-region replication |

**Edge-tier PostgreSQL** (T2/T3 org-local databases):

Edge PostgreSQL instances are NOT replicated to the cloud by default. They
are the source of truth. Recovery strategy:

- T2: `pg_basebackup` to local NFS or USB storage, nightly
- T3: Streaming replication to a local standby + `pg_basebackup` to S3
- Both tiers: NATS JetStream mirrors critical event data to cloud,
  providing a secondary recovery path for event-sourced entities

### 16.10.4 Failure Scenarios and Response

| Scenario | Impact | Detection | Response | Recovery Time |
|----------|--------|-----------|----------|--------------|
| Single hub node failure | Reduced capacity | NATS health check (2s) | Raft leader election, traffic redistribution | 2-5 seconds |
| Single AZ failure | 1/3 hub capacity lost | DNS health check (30s) | Traffic routes to remaining zones | 30-60 seconds |
| All hub failure (metro-wide) | Cloud services unavailable | Edge detects NATS disconnect | Edge continues locally; cloud recovers from backup | 30 min (cloud) / 0 (edge) |
| Edge device failure (T2/T3) | Single org offline | Org detects locally | Replace hardware, restore from backup | 1-4 hours |
| Edge device failure (T1) | Single org offline | Org detects locally | Replace SBC, NATS re-mirrors from cloud | 15-30 minutes |
| Database corruption (hub) | Analytics degraded | Checksum monitoring | Point-in-time recovery from WAL archive | 30-60 minutes |
| Database corruption (edge) | Single org read-only | PG checksum alerts | Restore from pg_basebackup + replay events from JetStream | 1-4 hours |
| NATS partition (edge ↔ hub) | No cloud sync | Leaf node heartbeat timeout | Edge buffers locally; reconciliation on reconnect | 0 (edge) / variable (sync) |

### 16.10.5 Backup Schedule

| Data | Frequency | Destination | Retention |
|------|-----------|-------------|-----------|
| Hub PG full backup | Daily 02:00 UTC | S3 (cross-region) | 30 days |
| Hub PG WAL archive | Continuous | S3 (same region) | 7 days |
| Hub NATS snapshots | Every 6 hours | S3 | 7 days |
| Edge T3 PG backup | Daily (org-configured) | Local NFS + optional S3 | 14 days |
| Edge T2 PG backup | Weekly (org-configured) | Local USB / NFS | 4 weeks |
| Edge T1 NATS KV | Continuous mirror to hub | Hub JetStream | Per org retention |
| Event journal | Append-only, never deleted | PG + JetStream mirror | 7+ years [FDA-CFR11] |

### 16.10.6 Cost Projections by Organization Size

Disaster recovery infrastructure cost scales with organizational complexity
and regulatory requirements:

| Org Profile | Tier | Monthly DR Cost | Components |
|-------------|------|----------------|------------|
| Solo machinist (1-5 sensors) | T1 | $0-5 | NATS cloud mirror (included in platform fee) |
| Small shop (5-50 sensors) | T2 | $15-40 | Local backup + cloud mirror |
| Mid-size manufacturer (50-500 sensors) | T2/T3 | $80-250 | PG standby + S3 backup + cloud mirror |
| Large facility (500-5,000 sensors) | T3 | $400-1,200 | Streaming replication + S3 + pg_lake archive |
| Enterprise (5,000+ sensors) | T3+Cloud | $2,000-8,000 | Multi-site replication + cold archive + compliance |

**Platform-included DR**. All organizations on the manufacturing commons
receive NATS JetStream cloud mirroring at no additional cost. This ensures
basic event recovery (RPO ≤ 5 minutes) for every participant regardless of
tier. Enhanced DR (streaming replication, point-in-time recovery, compliance
archival) is available as a tiered add-on.

---

## 16.11 Codebase Reference Map

| File | Purpose | Section |
|---|---|---|
| `lib/holonet/nats/connection.ts:40-60` | NatsConnectionService | 16.2.3 |
| `lib/iiot/adapters/sparkplug-adapter.ts:406-407` | SparkplugAdapterLive | 16.3.3 |
| `lib/iiot/adapters/ingestion-service.ts:297-322` | SparkplugPipelineLayer | 16.3.4 |
| `lib/iiot/entity/EntityStack.ts:54-67` | EntityHandlersLayer | 16.3.4 |
| `lib/iiot/realtime/event-distribution.ts` | EventDistribution | 16.3.4 |
| `lib/iiot/realtime/holonet-bridge.ts` | HolonetBridge | 16.3.5 |
| `lib/iiot/realtime/websocket-server.ts:68-137` | WebSocket server | 16.3.2, 16.3.6 |
| `lib/iiot/models/_infrastructure.ddl.ts` | Extension + schema + graph DDL | 16.8.1 |
| `lib/iiot/models/readings/SensorReadingModel.ddl.ts` | Hypertable + caggs | 16.8.3 |
| `lib/iiot/models/_graph-seed.ddl.ts` | Graph node + edge seed | 16.8.4 |
| `lib/iiot/models/_migrations.ts` | Migration registry | 16.8.6 |
| `docker/iiot-db/Dockerfile` | TimescaleDB + AGE + pg_lake image | 16.8.1 |
| `docker/docker-compose.iiot.yml` | IIoT database stack | 16.8.1 |

---

## 16.12 References

### Normative

- [RFC2119] — Bradner, S. "Key words for use in RFCs."
- [NATS-LEAFNODE] — Synadia. "NATS Leaf Nodes."
- [NATS-GATEWAY] — Synadia. "NATS Gateways (Supercluster)."
- [NATS-ACCOUNTS] — Synadia. "NATS Account-Based Security."
- [NATS-DECENTRALIZED] — Synadia. "NATS Decentralized JWT Authentication."
- [JETSTREAM] — Synadia. "NATS JetStream."
- [EFFECT-CLUSTER] — Effect Contributors. "@effect/cluster."

### Normative (Database & Recovery)

- [KLEPPMANN] — Kleppmann, M. *Designing Data-Intensive Applications.* O'Reilly, 2017.
- [FDA-CFR11] — U.S. FDA, 21 CFR Part 11. "Electronic Records; Electronic Signatures."
- [ISA-95-1] — ANSI/ISA-95.00.01-2010. "Enterprise-Control System Integration — Part 1."
- [RAFT] — Ongaro, D. and Ousterhout, J. "In Search of an Understandable Consensus Algorithm." USENIX ATC 2014.
- [NATS-GATEWAY] — Synadia. "NATS Gateways (Supercluster)."
- [EFFECT-TS] — Effect Contributors. "Effect-TS: Functional Effect System for TypeScript."

### Informative

- [TMNL-EDGE] — "Edge-First Architecture." `rfc-section-edge-architecture-v2.md`
- [TMNL-CONSISTENCY] — "Two-Domain Consistency Model." `rfc-section-two-domain-consistency.md`
- [TMNL-SECURITY] — "Security, Trust & Tenant Isolation." `rfc-section-security-trust.md`
- [research-cluster-patterns.md] — @effect/cluster transport options and shard algorithm
- [research-uns-metropolitan.md] — NATS-specific architecture recommendations
- [research-effect-architecture.md] — Effect-TS scaling architecture

---

*End of RFC-001 Section 16: Deployment Topology*

---

<!-- Source: rfc-section-network-entity-types.md -->

## N.1 Scope

This section defines the **network-level entity types** that exist beyond the ISA-95 equipment hierarchy. While the Reactive ISA-95 section specifies intra-organizational entities (Enterprise through Sensor), this section specifies entities that operate at the **manufacturing commons** level — constructs that coordinate BETWEEN organizations in a metropolitan-scale network serving 200K+ organizations [TMNL-MFG-COMMONS].

Network entities are the architectural primitives that transform a collection of isolated ISA-95 hierarchies into a federated manufacturing marketplace. They enable cross-organizational discovery, capacity sharing, work order routing, trust computation, and regulatory compliance verification [PARKER-PLATFORM], [OSTROM-COMMONS].

Each network entity type is specified with:

1. Effect Schema definition (runtime-validated, JSON-serializable) [EFFECT-SCHEMA]
2. Lifecycle state machine (Graph.directed validation) [EFFECT-MACHINE]
3. @effect/cluster Entity composition [EFFECT-ENTITY]
4. CRDT strategy for cross-node convergence [CRDT-SHAPIRO]
5. Shard group assignment and partition strategy [EFFECT-CLUSTER]

### N.1.1 Relationship to Other Sections

| Section | Relationship |
|---------|-------------|
| Reactive ISA-95 Hierarchy | Network entities reference intra-org entities by branded ID |
| Two-Domain Consistency | Network entities follow cross-org consistency model (eventual, 30s SLA) |
| Security, Trust & Tenant Isolation | Network entity access controlled by NATS account-scoped JWTs |
| Marketplace Protocol | Marketplace operations compose network entity state |
| Edge-First Architecture | Edge nodes maintain local projections of network entity state |

---

## N.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC2119] and [RFC8174].

### N.2.1 Notation

- **Entity schemas** use Effect Schema notation [EFFECT-SCHEMA] with `Schema.TaggedClass` for entities with methods and `Schema.TaggedStruct` for pure data
- **State machines** are specified as ASCII diagrams with corresponding `Graph.directed` definitions
- **Branded identifiers** follow the pattern `PREFIX-{slug}` with `Schema.brand()`, consistent with existing codebase identifiers (e.g., `ENT-acme-corp`, `SIT-chicago`)
- **CRDT specifications** reference Shapiro et al. taxonomy [CRDT-SHAPIRO]: OR-Set, LWW-Register, G-Counter, PN-Counter

---

## N.3 Entity Classification

### N.3.1 Taxonomy

Entities in the TMNL platform fall into three categories:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ENTITY CLASSIFICATION                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  INTRA-ORG ENTITIES          NETWORK ENTITIES       HYBRID ENTITIES │
│  (ISA-95 Equipment)          (Manufacturing Commons) (Cross-visible)│
│                                                                     │
│  Enterprise ─────────────── Organization ──────── Capability        │
│  Site                        Capacity              Reputation       │
│  Area                        WorkOrder (Cross-Org)                  │
│  Plant                       Compliance                             │
│  Line                        Marketplace Listing                    │
│  WorkCell                                                           │
│  Machine                                                            │
│  Device                                                             │
│  Sensor                                                             │
│                                                                     │
│  Alarm (ES)                                                         │
│  EquipmentState (ES)                                                │
│  WorkOrder (Intra-Org, ES)                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### N.3.2 Intra-Org Entities

Covered in the Reactive ISA-95 Hierarchy section. These entities are STRICTLY tenant-isolated — no cross-org visibility. Implemented as @effect/cluster entities with Machine-backed handlers and Graph.directed state validation.

**Codebase grounding:**
- Entity definitions: `src/lib/iiot/entity/*.ts` (16 files)
- Schema definitions: `src/lib/iiot/schemas/assets/*/schema.ts` (9 asset schemas)
- State machines: `src/lib/iiot/machines/*.ts` (13 machines)
- State graphs: `src/lib/iiot/machines/graphs/*.ts` (12 directed graphs)
- RPC definitions: `src/lib/iiot/rpc/*.ts` (19 RPC group files)

### N.3.3 Network Entities

Operate at the manufacturing commons level. These entities are visible across organization boundaries, subject to access control policies defined by NATS account-scoped JWTs [NATS-ACCOUNTS], [NATS-DECENTRALIZED].

Network entities MUST:
- Use cross-org consistent identifiers (globally unique, not org-scoped)
- Support eventual consistency with bounded staleness (30 second SLA) [TMNL-CONSISTENCY]
- Implement CRDT-based convergence for multi-region deployment
- Emit events on the `commons.>` NATS subject namespace

### N.3.4 Hybrid Entities

Org-owned but network-visible. The organization controls the authoritative state, but a redacted projection is published to the commons for discovery purposes. Hybrid entities implement the **Redacted Causality** pattern — the network sees WHAT changed but not internal operational details [TMNL-THEORY].

---

## N.4 Organization Entity

### N.4.1 Overview

The Organization entity represents a participant in the manufacturing commons. It maps 1:1 to an ISA-95 Enterprise entity [ISA-95-1] within the org's internal hierarchy, but exposes a network-facing profile with marketplace metadata, tier information, and variable-depth ISA-95 configuration.

### N.4.2 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/OrganizationEntity.ts

const OrgId = Schema.String.pipe(
  Schema.pattern(/^ORG-[a-zA-Z0-9-]+$/),
  Schema.brand('OrgId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/OrgId',
    description: 'Organization identifier with ORG- prefix',
  })
)
type OrgId = typeof OrgId.Type

const OrgTier = Schema.Literal('free', 'pro', 'enterprise')
type OrgTier = typeof OrgTier.Type

const ISA95Depth = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
  Schema.lessThanOrEqualTo(9),
  Schema.annotations({
    description: 'ISA-95 hierarchy depth: 1 (solo machinist) to 9 (full enterprise)',
  })
)

const OrgStatus = Schema.Literal(
  'onboarding',
  'active',
  'suspended',
  'deactivated'
)
type OrgStatus = typeof OrgStatus.Type

class Organization extends Schema.TaggedClass<Organization>()(
  'Organization',
  {
    id: OrgId,
    name: Schema.NonEmptyString,
    status: OrgStatus,
    tier: OrgTier,
    isa95Depth: ISA95Depth,

    /** Maps to internal EnterpriseId for bridge operations */
    internalEnterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),

    /** Primary industry classification */
    industry: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Geographic region for shard assignment */
    region: Schema.NonEmptyString,

    /** NATS account ID for tenant isolation */
    natsAccountId: Schema.NonEmptyString,

    /** Onboarding completion percentage (0-100) */
    onboardingProgress: Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(100)
    ),

    /** Timestamp of initial registration */
    registeredAt: Schema.DateTimeUtc,

    /** Timestamp of last activity */
    lastActiveAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

    /** Extensible metadata */
    metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  }
) {
  isOperational(): boolean {
    return this.status === 'active'
  }

  canPublishToCommons(): boolean {
    return this.status === 'active' && this.tier !== 'free'
  }
}
```

**Codebase alignment:** This schema follows the pattern established by `Enterprise` in `src/lib/iiot/schemas/assets/enterprise/schema.ts:96-150`, using `Schema.TaggedClass` with branded identifiers, `Schema.optionalWith` for optional fields, and instance methods for domain logic.

### N.4.3 Variable-Depth ISA-95

Organizations MUST declare their ISA-95 hierarchy depth at registration. This controls which asset entity types are available within their tenant scope:

| Depth | Available Levels | Persona |
|-------|-----------------|---------|
| 1 | Machine + Sensor | Solo machinist, garage shop |
| 2 | Line + Machine + Sensor | Small job shop (5-10 people) |
| 3 | Plant + Line + Machine + Sensor | Single-plant manufacturer |
| 4 | Site + Plant + Line + Machine + Sensor | Multi-building campus |
| 5 | Area + Site + Plant + Line + Machine + Sensor | Regional division |
| 6-9 | Full hierarchy with Enterprise | Multi-site corporation |

The `isa95Depth` field determines:
1. Which entity types are instantiated in @effect/cluster
2. Which state machines are booted (only machines for present levels)
3. Which RPC groups are registered (only RPCs for present entity types)
4. How hierarchy paths are materialized (shorter paths for shallow orgs)

### N.4.4 Lifecycle State Machine

```
                        Register
                           │
                           ▼
                    ┌──────────────┐
                    │  onboarding  │
                    └──────┬───────┘
                           │ CompleteOnboarding
                           ▼
        Suspend     ┌──────────────┐     Deactivate
      ┌────────────│    active     │────────────────┐
      │             └──────┬───────┘                │
      ▼                    │                        ▼
┌──────────────┐           │              ┌──────────────┐
│  suspended   │           │              │ deactivated  │ (terminal)
└──────┬───────┘           │              └──────────────┘
       │ Reinstate         │ Deactivate
       └───────────────────┘
```

**Graph definition** (proposed `src/lib/iiot/machines/graphs/organization-graph.ts`):

```typescript
const organizationStateGraph = Graph.directed<OrgStateNode, OrgTransitionAction>(
  (mutable) => {
    const onboarding = Graph.addNode(mutable, 'onboarding')
    const active     = Graph.addNode(mutable, 'active')
    const suspended  = Graph.addNode(mutable, 'suspended')
    const deactivated = Graph.addNode(mutable, 'deactivated')

    Graph.addEdge(mutable, onboarding, active, 'CompleteOnboarding')
    Graph.addEdge(mutable, active, suspended, 'Suspend')
    Graph.addEdge(mutable, active, deactivated, 'Deactivate')
    Graph.addEdge(mutable, suspended, active, 'Reinstate')
    Graph.addEdge(mutable, suspended, deactivated, 'Deactivate')
  }
)
```

This follows the identical pattern used by `enterpriseStateGraph` in `src/lib/iiot/machines/graphs/enterprise-graph.ts:71-92`.

### N.4.5 Entity Composition

The Organization entity MUST be composed as an @effect/cluster Entity [EFFECT-ENTITY] with Machine-backed handlers, following the architecture pattern established throughout the codebase:

```typescript
// Pattern from src/lib/iiot/entity/EnterpriseEntity.ts:168-175
const OrganizationEntity = Entity.make('Organization', [
  CreateOrganizationRpc,
  GetOrganizationRpc,
  CompleteOnboardingRpc,
  SuspendOrganizationRpc,
  ReinstateOrganizationRpc,
  DeactivateOrganizationRpc,
  UpdateProfileRpc,
])
```

### N.4.6 Network Events

Organization lifecycle transitions MUST emit events on the commons namespace:

| Event | NATS Subject | Consumers |
|-------|-------------|-----------|
| `OrganizationRegistered` | `commons.org.{orgId}.registered` | Directory, Analytics |
| `OrganizationActivated` | `commons.org.{orgId}.activated` | Marketplace, Directory |
| `OrganizationSuspended` | `commons.org.{orgId}.suspended` | Marketplace (delist), Counterparties |
| `OrganizationDeactivated` | `commons.org.{orgId}.deactivated` | All network services |

---

## N.5 Capability Entity

### N.5.1 Overview

The Capability entity declares WHAT an organization can do — materials it processes, manufacturing processes it performs, and certifications it holds. Capabilities are **hybrid entities**: owned by the organization but published to the commons for discovery by potential counterparties [MAAS-FRAMEWORK], [XOMETRY-PLATFORM].

### N.5.2 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/CapabilityEntity.ts

const CapabilityId = Schema.String.pipe(
  Schema.pattern(/^CAP-[a-zA-Z0-9-]+$/),
  Schema.brand('CapabilityId'),
)
type CapabilityId = typeof CapabilityId.Type

const ProcessType = Schema.Literal(
  'cnc_milling', 'cnc_turning', 'cnc_grinding',
  'injection_molding', 'blow_molding', 'thermoforming',
  'sheet_metal_cutting', 'sheet_metal_bending', 'sheet_metal_welding',
  'casting', 'forging', 'extrusion',
  'additive_fdm', 'additive_sla', 'additive_sls', 'additive_dmls',
  'assembly', 'finishing', 'inspection', 'testing',
  'heat_treatment', 'surface_treatment', 'packaging',
  'other'
)
type ProcessType = typeof ProcessType.Type

const MaterialType = Schema.Literal(
  'aluminum', 'steel', 'stainless_steel', 'titanium', 'copper', 'brass',
  'abs', 'nylon', 'polycarbonate', 'peek', 'pla', 'petg',
  'carbon_fiber', 'fiberglass', 'kevlar',
  'wood', 'ceramic', 'glass',
  'other'
)
type MaterialType = typeof MaterialType.Type

const CertificationType = Schema.Literal(
  'iso_9001', 'iso_14001', 'iso_45001',
  'as9100', 'as9110', 'as9120',
  'iatf_16949',
  'iso_13485',
  'nadcap',
  'itar',
  'fda_21_cfr_part_11', 'fda_21_cfr_part_820',
  'ul_listed',
  'ce_marked',
  'other'
)
type CertificationType = typeof CertificationType.Type

const CapabilityVisibility = Schema.Literal('private', 'published')
type CapabilityVisibility = typeof CapabilityVisibility.Type

class Capability extends Schema.TaggedClass<Capability>()(
  'Capability',
  {
    id: CapabilityId,
    orgId: OrgId,
    visibility: CapabilityVisibility,

    /** Manufacturing processes this org can perform */
    processTypes: Schema.Array(ProcessType),

    /** Materials this org can work with */
    materialTypes: Schema.Array(MaterialType),

    /** Active certifications */
    certifications: Schema.Array(Schema.Struct({
      type: CertificationType,
      issuedBy: Schema.String,
      validUntil: Schema.DateTimeUtc,
      certificateNumber: Schema.optionalWith(Schema.String, { as: 'Option' }),
    })),

    /** Tolerance ranges per process (e.g., CNC milling: +/- 0.005mm) */
    tolerances: Schema.Record({ key: Schema.String, value: Schema.String }),

    /** Maximum part dimensions per process */
    maxDimensions: Schema.optionalWith(
      Schema.Struct({
        lengthMm: Schema.Number,
        widthMm: Schema.Number,
        heightMm: Schema.Number,
      }),
      { as: 'Option' }
    ),

    /** Free-text description of specialty capabilities */
    specialtyDescription: Schema.optionalWith(Schema.String, { as: 'Option' }),

    createdAt: Schema.DateTimeUtc,
    updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  }
)
```

### N.5.3 CRDT Strategy: OR-Set for Capability Aggregation

Capabilities across the network are aggregated using an **OR-Set CRDT** [CRDT-SHAPIRO] for the material and process type collections. This ensures:

- **Convergence**: All network nodes eventually agree on the full capability set
- **Conflict-free merges**: Adding a capability on one node never conflicts with additions on another
- **Availability**: Capability queries remain available during network partitions [CAP-BREWER]

```
OR-Set Operations:
  add(processType) → Adds element with unique tag
  remove(processType) → Removes all tags for element
  merge(remote) → Union of all tagged elements

Network Convergence:
  Node A adds 'cnc_milling' ──┐
                               ├── merge → {cnc_milling, additive_sla}
  Node B adds 'additive_sla' ─┘
```

### N.5.4 Searchable Material-Process Matrix

The platform MUST maintain a materialized view indexing capabilities for marketplace search:

```
Search Query: "Who can CNC-mill titanium with AS9100 certification?"

Index Structure:
  processType:cnc_milling → [ORG-001, ORG-042, ORG-187, ...]
  materialType:titanium   → [ORG-042, ORG-187, ORG-301, ...]
  certification:as9100    → [ORG-042, ORG-301, ...]

  Intersection: [ORG-042] → result set
```

This index is maintained as a NATS KV store [NATS-KV] with subject-based partitioning per capability dimension.

### N.5.5 Published vs. Private Capabilities

Implementations MUST enforce visibility control:

| Visibility | Who Can See | NATS Subject |
|------------|------------|--------------|
| `private` | Only the owning organization | `org.{orgId}.capabilities.>` |
| `published` | All active organizations | `commons.capabilities.{capId}` |

When visibility transitions from `private` to `published`, a `CapabilityPublished` event MUST be emitted on the commons namespace. When transitioning back to `private`, a `CapabilityRetracted` event MUST be emitted.

---

## N.6 Capacity Entity

### N.6.1 Overview

The Capacity entity declares AVAILABLE machine-hours, lead times, and pricing tiers for published capabilities. While Capability declares what an organization CAN do, Capacity declares what it can do RIGHT NOW — available time slots, current queue depth, and dynamic pricing [MAAS-PRICING], [SHARED-MFG-2020].

### N.6.2 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/CapacityEntity.ts

const CapacityId = Schema.String.pipe(
  Schema.pattern(/^CPT-[a-zA-Z0-9-]+$/),
  Schema.brand('CapacityId'),
)
type CapacityId = typeof CapacityId.Type

const PriceTier = Schema.Literal('standard', 'rush', 'premium')
type PriceTier = typeof PriceTier.Type

const CapacityStatus = Schema.Literal(
  'available',
  'limited',
  'reserved',
  'unavailable'
)
type CapacityStatus = typeof CapacityStatus.Type

class Capacity extends Schema.TaggedClass<Capacity>()(
  'Capacity',
  {
    id: CapacityId,
    orgId: OrgId,
    capabilityId: CapabilityId,

    /** Reference to internal machine (bridged via org's ISA-95 hierarchy) */
    machineRef: Schema.optionalWith(Schema.String, { as: 'Option' }),

    status: CapacityStatus,

    /** Available hours in the next scheduling window */
    availableHoursWeekly: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),

    /** Current queue depth (number of pending work orders) */
    queueDepth: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),

    /** Estimated lead time in business days */
    leadTimeDays: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),

    /** Price range per hour (currency-agnostic, marketplace handles conversion) */
    priceRange: Schema.Struct({
      minPerHour: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
      maxPerHour: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
      currency: Schema.String,
      tier: PriceTier,
    }),

    /** Process types this capacity slot covers */
    processTypes: Schema.Array(ProcessType),

    /** Time window for this capacity offer */
    validFrom: Schema.DateTimeUtc,
    validUntil: Schema.DateTimeUtc,

    updatedAt: Schema.DateTimeUtc,
  }
)
```

### N.6.3 Real-Time Capacity Derivation from Equipment State

Capacity entities MUST be updated in response to EquipmentState transitions within the owning organization. This creates a reactive bridge between intra-org state (EquipmentState entity, event-sourced per `src/lib/iiot/entity/EquipmentStateEntity.ts`) and network-visible capacity:

```
Internal Event Flow:
  EquipmentState.running  ──→  Capacity consumed (availableHours decreases)
  EquipmentState.idle     ──→  Capacity available (availableHours increases)
  EquipmentState.faulted  ──→  Capacity unavailable (status → 'unavailable')
  EquipmentState.setup    ──→  Capacity limited (status → 'limited')
```

This bridge follows the **Redacted Causality** pattern [TMNL-THEORY]: the network observes that capacity changed, but does not see the internal equipment state details that caused the change.

### N.6.4 Marketplace Integration

Published capacity listings feed into the marketplace matching engine:

```
Capacity Publishing Flow:

  1. Org updates internal EquipmentState (via Machine-backed entity handler)
  2. ReactivityBridge detects state change
  3. Capacity projection updated in org's local state
  4. If capability is published: CapacityUpdated event → commons.capacity.{cptId}
  5. Marketplace index updated (NATS KV materialized view)
  6. Searching orgs see updated availability in real-time
```

### N.6.5 Capacity Status Transitions

```
                    ┌────────────────────┐
          Reserve   │                    │  Release
      ┌────────────│    available       │────────────┐
      │             │                    │            │
      ▼             └─────────┬──────────┘            │
┌──────────┐                  │                       │
│ reserved │                  │ Constrain             │
└──────────┘                  ▼                       │
                    ┌────────────────────┐            │
                    │     limited        │────────────┘
                    └─────────┬──────────┘  Restore
                              │
                              │ Exhaust / Fault
                              ▼
                    ┌────────────────────┐
                    │   unavailable      │
                    └────────────────────┘
                              │
                              │ Restore
                              ▼
                         (available)
```

---

## N.7 Work Order Entity (Cross-Org)

### N.7.1 Overview

The existing intra-org WorkOrder entity (`src/lib/iiot/entity/WorkOrderEntity.ts`) manages FDA 21 CFR Part 11 compliant work order lifecycle WITHIN a single organization. The **Cross-Org Work Order** extends this concept to work orders that span organizational boundaries — when one organization needs another's manufacturing capacity [MAAS-CATENAX], [ISA-95-5].

### N.7.2 Relationship to Intra-Org WorkOrder

The cross-org work order does NOT replace the intra-org entity. Instead, it creates a **federated work order pair**:

```
┌─────────────────────┐         ┌─────────────────────┐
│ Requesting Org      │         │ Fulfilling Org       │
│                     │         │                      │
│  CrossOrgWorkOrder  │◄───────►│  CrossOrgWorkOrder   │
│  (requester view)   │  NATS   │  (fulfiller view)    │
│         │           │  events │          │            │
│         ▼           │         │          ▼            │
│  Intra-Org WorkOrder│         │  Intra-Org WorkOrder │
│  (internal tracking)│         │  (production exec.)  │
│                     │         │                      │
└─────────────────────┘         └─────────────────────┘
```

### N.7.3 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/CrossOrgWorkOrderEntity.ts

const CrossOrgWorkOrderId = Schema.String.pipe(
  Schema.pattern(/^XWO-[a-zA-Z0-9-]+$/),
  Schema.brand('CrossOrgWorkOrderId'),
)
type CrossOrgWorkOrderId = typeof CrossOrgWorkOrderId.Type

const CrossOrgWorkOrderStatus = Schema.Literal(
  'draft',
  'submitted',
  'accepted',
  'in_progress',
  'quality_check',
  'complete',
  'settled',
  'disputed',
  'cancelled'
)
type CrossOrgWorkOrderStatus = typeof CrossOrgWorkOrderStatus.Type

class CrossOrgWorkOrder extends Schema.TaggedClass<CrossOrgWorkOrder>()(
  'CrossOrgWorkOrder',
  {
    id: CrossOrgWorkOrderId,

    /** Organization requesting the work */
    requestingOrgId: OrgId,

    /** Organization fulfilling the work (set on acceptance) */
    fulfillingOrgId: Schema.optionalWith(OrgId, { as: 'Option' }),

    status: CrossOrgWorkOrderStatus,

    /** Reference to capability being requested */
    capabilityRef: CapabilityId,

    /** Line items for the work order */
    items: Schema.Array(Schema.Struct({
      description: Schema.NonEmptyString,
      quantity: Schema.Number.pipe(Schema.positive()),
      unit: Schema.String,
      processType: ProcessType,
      materialType: MaterialType,
      toleranceSpec: Schema.optionalWith(Schema.String, { as: 'Option' }),
    })),

    /** Agreed pricing (set during negotiation/acceptance) */
    agreedPrice: Schema.optionalWith(
      Schema.Struct({
        amount: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
        currency: Schema.String,
      }),
      { as: 'Option' }
    ),

    /** Delivery requirements */
    deliveryDeadline: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

    /** Quality requirements and acceptance criteria */
    qualityCriteria: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Escrow reference for payment settlement */
    escrowRef: Schema.optionalWith(Schema.String, { as: 'Option' }),

    /** Internal work order IDs on each side (bridged) */
    requesterInternalWoId: Schema.optionalWith(Schema.String, { as: 'Option' }),
    fulfillerInternalWoId: Schema.optionalWith(Schema.String, { as: 'Option' }),

    createdAt: Schema.DateTimeUtc,
    updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  }
)
```

### N.7.4 Cross-Org Work Order Lifecycle

```
                    ┌──────────┐
         Create     │  draft   │
                    └────┬─────┘
                         │ Submit
                         ▼
                    ┌──────────┐   Reject    ┌───────────┐
                    │ submitted│─────────────►│ cancelled │ (terminal)
                    └────┬─────┘              └───────────┘
                         │ Accept                   ▲
                         ▼                          │
                    ┌──────────┐                    │ Cancel (either party)
                    │ accepted │────────────────────┤
                    └────┬─────┘                    │
                         │ BeginWork                │
                         ▼                          │
                    ┌──────────────┐                │
                    │ in_progress  │────────────────┤
                    └────┬─────────┘                │
                         │ SubmitForQC              │
                         ▼                          │
                    ┌──────────────────┐            │
                    │ quality_check    │────────────┘
                    └────┬──────┬──────┘
                         │      │ Dispute
                         │      ▼
                         │ ┌──────────┐
                         │ │ disputed │──► Resolve ──► complete
                         │ └──────────┘
                         │ Approve
                         ▼
                    ┌──────────┐
                    │ complete │
                    └────┬─────┘
                         │ Settle
                         ▼
                    ┌──────────┐
                    │ settled  │ (terminal)
                    └──────────┘
```

**State count:** 9 states, consistent with the intra-org WorkOrder which has 12 states (`src/lib/iiot/machines/graphs/work-order-graph.ts`). The cross-org variant has fewer states because internal execution detail (suspend, resume, fail) is managed by the fulfiller's intra-org WorkOrder entity.

### N.7.5 Cross-Org Event Distribution

Status transitions on cross-org work orders MUST be visible to both parties:

| Transition | Publisher | NATS Subject | Subscriber(s) |
|-----------|-----------|--------------|---------------|
| Submitted | Requester | `commons.xwo.{xwoId}.submitted` | Potential fulfillers |
| Accepted | Fulfiller | `commons.xwo.{xwoId}.accepted` | Requester |
| InProgress | Fulfiller | `commons.xwo.{xwoId}.in_progress` | Requester |
| QualityCheck | Fulfiller | `commons.xwo.{xwoId}.qc` | Requester |
| Complete | Both verify | `commons.xwo.{xwoId}.complete` | Settlement service |
| Disputed | Either party | `commons.xwo.{xwoId}.disputed` | Both + Arbitration |
| Settled | Settlement svc | `commons.xwo.{xwoId}.settled` | Both parties |

Events MUST be persisted in JetStream [JETSTREAM] with per-subject retention for audit compliance [FDA-CFR11].

### N.7.6 Saga Coordination

Cross-org work orders implement a **choreography-based saga** [SAGA-GARCIA], [MSVC-SAGA] with compensating transactions:

| Step | Action | Compensation |
|------|--------|-------------|
| 1 | Reserve fulfiller capacity | Release capacity |
| 2 | Create escrow hold | Release escrow |
| 3 | Create fulfiller internal WO | Cancel internal WO |
| 4 | Begin production | Halt production, return materials |
| 5 | Complete QC | Return to production |
| 6 | Settle payment | Initiate dispute resolution |

Each step emits a domain event. Failures trigger compensating events in reverse order. The saga state is reconstructed from the event log — there is no centralized saga coordinator [MSVC-EVENTSRC].

---

## N.8 Reputation Entity

### N.8.1 Overview

The Reputation entity computes and maintains an event-sourced trust score for each organization in the manufacturing commons. Reputation is CRITICAL for marketplace function — it determines listing visibility, matching priority, and eligibility for high-value work orders [PARKER-PLATFORM].

### N.8.2 G-10 Trust Score Model

The trust score is composed of four factors, each ranging from 0.0 to 1.0:

| Factor | Weight | Derivation | Update Frequency |
|--------|--------|-----------|-----------------|
| **Signal Consistency** (SC) | 0.30 | Ratio of valid to total sensor readings over 30-day window | Hourly |
| **Clock Accuracy** (CA) | 0.20 | Mean clock drift across org's edge nodes vs. NTP reference | Daily |
| **Uptime** (UP) | 0.25 | Percentage of time org's published machines are in operational state | Hourly |
| **Peer Validation** (PV) | 0.25 | Weighted count of positive cross-org work order completions | Per settlement |

```
G-10 Trust Score = (SC × 0.30) + (CA × 0.20) + (UP × 0.25) + (PV × 0.25)
```

### N.8.3 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/ReputationEntity.ts

const ReputationId = Schema.String.pipe(
  Schema.pattern(/^REP-[a-zA-Z0-9-]+$/),
  Schema.brand('ReputationId'),
)
type ReputationId = typeof ReputationId.Type

const TrustFactor = Schema.Struct({
  value: Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(0),
    Schema.lessThanOrEqualTo(1)
  ),
  sampleCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  lastUpdated: Schema.DateTimeUtc,
})

class Reputation extends Schema.TaggedClass<Reputation>()(
  'Reputation',
  {
    id: ReputationId,
    orgId: OrgId,

    /** Signal Consistency factor (0.0 - 1.0) */
    signalConsistency: TrustFactor,

    /** Clock Accuracy factor (0.0 - 1.0) */
    clockAccuracy: TrustFactor,

    /** Uptime factor (0.0 - 1.0) */
    uptime: TrustFactor,

    /** Peer Validation factor (0.0 - 1.0) */
    peerValidation: TrustFactor,

    /** Computed composite score (0.0 - 1.0) */
    compositeScore: Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(1)
    ),

    /** Number of completed cross-org work orders (total) */
    completedWorkOrders: Schema.Number.pipe(
      Schema.int(), Schema.greaterThanOrEqualTo(0)
    ),

    /** Number of disputed work orders (total) */
    disputedWorkOrders: Schema.Number.pipe(
      Schema.int(), Schema.greaterThanOrEqualTo(0)
    ),

    /** Timestamp of last score recomputation */
    lastComputedAt: Schema.DateTimeUtc,

    /** Score history (last 90 days, daily snapshots) */
    scoreHistory: Schema.Array(Schema.Struct({
      date: Schema.DateTimeUtc,
      score: Schema.Number,
    })),
  }
) {
  computeScore(): number {
    return (
      this.signalConsistency.value * 0.30 +
      this.clockAccuracy.value * 0.20 +
      this.uptime.value * 0.25 +
      this.peerValidation.value * 0.25
    )
  }

  isHighTrust(): boolean {
    return this.compositeScore >= 0.85
  }

  isSuspicious(): boolean {
    // Anomaly: score jumped more than 0.3 in a single day
    if (this.scoreHistory.length < 2) return false
    const latest = this.scoreHistory[this.scoreHistory.length - 1]
    const previous = this.scoreHistory[this.scoreHistory.length - 2]
    return Math.abs(latest.score - previous.score) > 0.3
  }
}
```

### N.8.4 CRDT Strategy

Reputation uses a combination of CRDTs [CRDT-SHAPIRO]:

| Factor | CRDT Type | Rationale |
|--------|----------|-----------|
| Signal Consistency | **LWW-Register** | Single authoritative value, updated by monitoring service |
| Clock Accuracy | **LWW-Register** | Single authoritative value, updated by NTP comparison service |
| Uptime | **LWW-Register** | Single authoritative value, computed from equipment state stream |
| Peer Validation | **G-Counter** | Monotonically increasing count of positive validations |

The composite score is derived from CRDT state — it is NOT itself a CRDT. Each node computes the composite independently from the converged factor values.

### N.8.5 Fraud Detection

The system MUST monitor for anomalous reputation changes that may indicate gaming:

| Anomaly | Detection Rule | Response |
|---------|---------------|----------|
| Score spike | Score increases > 0.3 in 24h | Flag for manual review |
| Signal flooding | > 10x normal reading rate | Quarantine readings, freeze SC factor |
| Peer collusion | Same 3 orgs repeatedly validate each other | Weight reduction for circular validations |
| Clock manipulation | Sudden clock correction > 5s | Freeze CA factor, audit edge nodes |

Anomaly detection events MUST be emitted on `commons.reputation.{orgId}.anomaly` for platform operations monitoring.

---

## N.9 Compliance Entity

### N.9.1 Overview

The Compliance entity manages regulatory certification state for organizations participating in the manufacturing commons. It provides shared infrastructure for verifying that counterparties meet the regulatory requirements for specific work order types [FDA-CFR11], [IEC-62443].

### N.9.2 Schema Definition

```typescript
// Proposed: src/lib/iiot/entity/ComplianceEntity.ts

const ComplianceId = Schema.String.pipe(
  Schema.pattern(/^CMP-[a-zA-Z0-9-]+$/),
  Schema.brand('ComplianceId'),
)
type ComplianceId = typeof ComplianceId.Type

const ComplianceStatus = Schema.Literal(
  'valid',
  'expiring_soon',   // Within 90 days of expiration
  'expired',
  'revoked',
  'under_audit'
)
type ComplianceStatus = typeof ComplianceStatus.Type

const RegulatoryFramework = Schema.Literal(
  'iso_9001',
  'iso_14001',
  'iso_45001',
  'as9100',          // Aerospace
  'iatf_16949',      // Automotive
  'iso_13485',       // Medical devices
  'fda_21_cfr_11',   // Electronic records (pharma)
  'fda_21_cfr_820',  // Quality system regulation (medical)
  'itar',            // International Traffic in Arms
  'ear',             // Export Administration Regulations
  'reach',           // EU chemicals regulation
  'rohs',            // EU hazardous substances
  'nadcap',          // Aerospace special processes
  'iec_62443'        // Industrial cybersecurity
)
type RegulatoryFramework = typeof RegulatoryFramework.Type

class Compliance extends Schema.TaggedClass<Compliance>()(
  'Compliance',
  {
    id: ComplianceId,
    orgId: OrgId,
    framework: RegulatoryFramework,
    status: ComplianceStatus,

    /** Certificate number from certifying body */
    certificateNumber: Schema.NonEmptyString,

    /** Name of the certifying body */
    certifyingBody: Schema.NonEmptyString,

    /** Scope of certification (which processes/facilities) */
    scope: Schema.String,

    /** Date certification was issued */
    issuedAt: Schema.DateTimeUtc,

    /** Date certification expires */
    expiresAt: Schema.DateTimeUtc,

    /** Date of last audit */
    lastAuditDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

    /** Next scheduled audit date */
    nextAuditDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

    /** Audit trail: all verification events for this certification */
    auditLog: Schema.Array(Schema.Struct({
      timestamp: Schema.DateTimeUtc,
      action: Schema.Literal(
        'issued', 'renewed', 'scope_changed',
        'audit_scheduled', 'audit_completed', 'audit_failed',
        'expiry_warning', 'expired', 'revoked', 'reinstated'
      ),
      actor: Schema.String,
      notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
    })),
  }
) {
  isValid(): boolean {
    return this.status === 'valid' || this.status === 'expiring_soon'
  }

  daysUntilExpiry(): number {
    const now = Date.now()
    const expiry = Number(this.expiresAt.epochMillis)
    return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
  }
}
```

### N.9.3 Cross-Org Compliance Verification

Before a cross-org work order can transition from `submitted` to `accepted`, the platform MUST verify that the fulfilling organization holds valid certifications required by the work order's compliance profile:

```
Verification Flow:

  1. Cross-Org WorkOrder submitted with required frameworks: [as9100, itar]
  2. Platform queries fulfiller's Compliance entities
  3. For each required framework:
     a. Compliance entity exists? ────── NO → REJECT
     b. Status == 'valid' or 'expiring_soon'? ── NO → REJECT
     c. Scope covers requested processes? ─────── NO → REJECT
  4. All checks pass → WorkOrder eligible for acceptance
```

### N.9.4 FDA 21 CFR Part 11 Requirements

For pharmaceutical participants, the compliance infrastructure MUST satisfy [FDA-CFR11]:

| Requirement | Implementation |
|-------------|---------------|
| **Audit trail** (11.10(e)) | All compliance events persisted in JetStream with append-only guarantee |
| **Electronic signatures** (11.50) | Compliance verification actions signed with org's NATS credential |
| **Record protection** (11.10(c)) | Compliance events stored in dedicated JetStream stream with no-delete policy |
| **Authority checks** (11.10(g)) | Only authorized org representatives can modify compliance state |
| **Operational checks** (11.10(f)) | System prevents work order acceptance when compliance is invalid |

The existing intra-org WorkOrder entity already implements FDA 21 CFR Part 11 compliance through its state machine graph and dual-write audit trail (see `src/lib/iiot/entity/WorkOrderEntity.ts:10-11`). The cross-org compliance entity extends this to network-level verification.

### N.9.5 Compliance Lifecycle

```
                         Issue
                           │
                           ▼
                    ┌──────────────┐
                    │    valid     │◄────── Reinstate
                    └──────┬───────┘
                           │ 90 days before expiry
                           ▼
                    ┌──────────────────┐
                    │ expiring_soon    │──── Renew ──► valid
                    └──────┬───────────┘
                           │ Expiry date passes
                           ▼
                    ┌──────────────┐
                    │   expired    │──── Reinstate ──► valid
                    └──────────────┘

        (From any non-revoked state)
                           │ Revoke
                           ▼
                    ┌──────────────┐
                    │   revoked    │ (terminal unless appealed)
                    └──────────────┘

        (From valid or expiring_soon)
                           │ BeginAudit
                           ▼
                    ┌──────────────┐
                    │ under_audit  │──── CompleteAudit ──► valid
                    └──────────────┘──── FailAudit ──► expired
```

---

## N.10 Entity Cardinality at Scale

### N.10.1 Projected Entity Counts

Entity counts projected at 200K organizations, based on industry distribution analysis [TEDALDI-MAAS-2023], [XOMETRY-PLATFORM]:

| Entity Type | Estimated Count | Per-Org Average | Growth Rate |
|------------|----------------|-----------------|-------------|
| **Organization** | 200,000 | 1 | +2K/month |
| **Capability** | 800,000 | 4 | +8K/month |
| **Capacity** | 2,000,000 | 10 | +20K/month |
| **CrossOrgWorkOrder** | 500,000 active | 2.5 active | +50K/month |
| **Reputation** | 200,000 | 1 | Matches org growth |
| **Compliance** | 600,000 | 3 | +6K/month |
| **Enterprise** (intra-org) | 200,000 | 1 | Matches org growth |
| **Site** (intra-org) | 400,000 | 2 | +4K/month |
| **Plant** (intra-org) | 600,000 | 3 | +6K/month |
| **Line** (intra-org) | 2,000,000 | 10 | +20K/month |
| **Machine** (intra-org) | 8,000,000 | 40 | +80K/month |
| **Sensor** (intra-org) | 40,000,000 | 200 | +400K/month |
| **Alarm** (intra-org) | ~100K active | Bursty | Varies |
| **EquipmentState** (intra-org) | 8,000,000 | 40 | Matches machine count |
| **WorkOrder** (intra-org) | ~2M active | ~10 active | +200K/month |

**Total entity count at 200K orgs: ~54M entities**

### N.10.2 Shard Group Assignment

@effect/cluster [EFFECT-CLUSTER] distributes entities across shard groups using consistent hashing [EFFECT-HASHRING]. Entity types are assigned to shard groups based on access pattern affinity and load characteristics:

| Shard Group | Entity Types | Partition Key | Estimated Shards |
|------------|-------------|---------------|-----------------|
| `org-identity` | Organization, Reputation, Compliance | `orgId` | 256 |
| `marketplace` | Capability, Capacity, CrossOrgWorkOrder | `orgId` (creator) | 512 |
| `asset-hierarchy` | Enterprise, Site, Area, Plant, Line, WorkCell | `enterpriseId` | 1024 |
| `equipment` | Machine, Device, Sensor | `machineId` | 2048 |
| `operational` | Alarm, EquipmentState, WorkOrder (intra) | `machineId` | 2048 |

### N.10.3 Partition Strategy

**Intra-org entities** are partitioned by `enterpriseId` (for hierarchy entities) or `machineId` (for equipment-level entities). This ensures that all entities within a single org's hierarchy are co-located on the same shard group, enabling efficient hierarchy traversal without cross-shard queries.

**Network entities** are partitioned by `orgId` (the creating organization). This ensures that an organization's marketplace profile (capabilities, capacity, compliance) is co-located for efficient profile queries.

**Cross-org work orders** are partitioned by the `requestingOrgId`. When the fulfilling org queries their work orders, a secondary index keyed by `fulfillingOrgId` provides O(1) lookup via NATS KV [NATS-KV].

### N.10.4 Memory and Compute Requirements

| Shard Group | Avg Entity Size | Total Memory | Compute (vCPU) |
|------------|----------------|-------------|----------------|
| `org-identity` | 2 KB | ~2 GB | 4 |
| `marketplace` | 4 KB | ~13 GB | 16 |
| `asset-hierarchy` | 1 KB | ~3.2 GB | 8 |
| `equipment` | 0.5 KB | ~24 GB | 32 |
| `operational` | 1.5 KB | ~15 GB | 32 |
| **Total** | — | **~57 GB** | **92 vCPU** |

These are hot-path memory estimates. Cold entities (inactive orgs, historical work orders) are evicted from memory and reconstructed from event log on access. @effect/cluster's entity mailbox [EFFECT-ENTITY] handles the rehydration transparently.

### N.10.5 Event Throughput by Entity Type

| Entity Type | Events/sec (steady) | Events/sec (peak) | JetStream Stream |
|------------|--------------------|--------------------|-----------------|
| Sensor readings | 800,000 | 2,000,000 | `iiot.readings.>` |
| Equipment state | 50,000 | 200,000 | `iiot.equipment.>` |
| Alarms | 5,000 | 50,000 | `iiot.alarms.>` |
| Intra-org WO transitions | 1,000 | 10,000 | `iiot.workorders.>` |
| Capacity updates | 10,000 | 50,000 | `commons.capacity.>` |
| Cross-org WO transitions | 500 | 5,000 | `commons.xwo.>` |
| Reputation updates | 100 | 1,000 | `commons.reputation.>` |
| Compliance events | 10 | 100 | `commons.compliance.>` |
| **Total** | **~866,610** | **~2,316,100** | — |

---

## N.11 Codebase Grounding

### N.11.1 Existing Entity Definitions

The following files implement the intra-org entity types referenced throughout this section:

| File | Entity | Pattern |
|------|--------|---------|
| `src/lib/iiot/entity/EnterpriseEntity.ts` | Enterprise | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/SiteEntity.ts` | Site | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/AreaEntity.ts` | Area | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/PlantEntity.ts` | Plant | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/LineEntity.ts` | Line | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/WorkCellEntity.ts` | WorkCell | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/MachineAssetEntity.ts` | Machine | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/DeviceEntity.ts` | Device | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/SensorAssetEntity.ts` | Sensor | Entity.make + Machine.boot + actor.send |
| `src/lib/iiot/entity/AlarmEntity.ts` | Alarm | Entity.make + Machine.boot (EVENT SOURCED) |
| `src/lib/iiot/entity/WorkOrderEntity.ts` | WorkOrder | Entity.make + Machine.boot (EVENT SOURCED, FDA 21 CFR 11) |
| `src/lib/iiot/entity/EquipmentStateEntity.ts` | EquipmentState | Entity.make + Machine.boot (EVENT SOURCED) |
| `src/lib/iiot/entity/AssetEntity.ts` | Asset (generic) | Entity.make (hierarchy queries) |
| `src/lib/iiot/entity/SensorEntity.ts` | Sensor (readings) | Entity.make (time-series queries) |
| `src/lib/iiot/entity/EntityStack.ts` | Layer composition | EntityHandlersLayer, EntityTestingStack |
| `src/lib/iiot/entity/_helpers.ts` | Event emission | maybeEmitWorkOrder, maybeEmitAlarm, maybeEmitEquipment |
| `src/lib/iiot/entity/index.ts` | Barrel export | Re-exports with collision avoidance |

### N.11.2 Schema Definitions

| File | Schema | Key Types |
|------|--------|-----------|
| `src/lib/iiot/schemas/assets/enterprise/schema.ts` | Enterprise | EnterpriseId (branded), EnterpriseStatus, Schema.TaggedClass |
| `src/lib/iiot/schemas/assets/site/schema.ts` | Site | SiteId (branded), SiteStatus |
| `src/lib/iiot/schemas/assets/area/schema.ts` | Area | AreaId (branded), AreaStatus |
| `src/lib/iiot/schemas/assets/plant/schema.ts` | Plant | PlantId (branded), PlantStatus |
| `src/lib/iiot/schemas/assets/line/schema.ts` | Line | LineId (branded), LineStatus |
| `src/lib/iiot/schemas/assets/workcell/schema.ts` | WorkCell | WorkCellId (branded), WorkCellStatus |
| `src/lib/iiot/schemas/assets/machine/schema.ts` | Machine | MachineId (branded), MachineStatus |
| `src/lib/iiot/schemas/assets/device/schema.ts` | Device | DeviceId (branded), DeviceStatus |
| `src/lib/iiot/schemas/assets/sensor/schema.ts` | Sensor | SensorId (branded), SensorType, MeasurementUnit |

### N.11.3 State Machine Graphs

| File | Graph | States | Transitions |
|------|-------|--------|------------|
| `src/lib/iiot/machines/graphs/enterprise-graph.ts` | Enterprise lifecycle | 4 | 5 |
| `src/lib/iiot/machines/graphs/site-graph.ts` | Site lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/area-graph.ts` | Area lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/plant-graph.ts` | Plant lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/line-graph.ts` | Line lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/workcell-graph.ts` | WorkCell lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/machine-asset-graph.ts` | Machine lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/device-graph.ts` | Device lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/sensor-graph.ts` | Sensor lifecycle | Variable | Variable |
| `src/lib/iiot/machines/graphs/alarm-state-graph.ts` | Alarm ISA-18.2 | Variable | Variable |
| `src/lib/iiot/machines/graphs/work-order-graph.ts` | WorkOrder FDA lifecycle | 12 | Complex |
| `src/lib/iiot/machines/graphs/equipment-state-graph.ts` | Equipment OEE | Variable | Variable |

### N.11.4 RPC Groups

| File | RPC Group | Transport |
|------|-----------|-----------|
| `src/lib/iiot/rpc/EnterpriseRpcs.ts` | EnterpriseEntityRpcs | EntityProxy.toRpcGroup |
| `src/lib/iiot/rpc/WorkOrderRpcs.ts` | WorkOrderEntityRpcs | EntityProxy.toRpcGroup |
| `src/lib/iiot/rpc/EquipmentStateRpcs.ts` | EquipmentStateEntityRpcs | EntityProxy.toRpcGroup |
| `src/lib/iiot/rpc/RealtimeRpcs.ts` | RealtimeRpcs | WebSocket streaming |
| `src/lib/iiot/rpc/index.ts` | IIoTRpcs (combined) | All 17 groups merged |

### N.11.5 Network Entity Implementation Path

Network entities described in this section (Organization, Capability, Capacity, CrossOrgWorkOrder, Reputation, Compliance) are **specified but not yet implemented**. They SHOULD follow the established patterns:

1. **Schema**: `src/lib/iiot/schemas/network/{entity}/schema.ts` — Effect Schema TaggedClass with branded ID
2. **Graph**: `src/lib/iiot/machines/graphs/{entity}-graph.ts` — Graph.directed state machine
3. **Machine**: `src/lib/iiot/machines/{Entity}Machine.ts` — Machine with Internal* request classes
4. **Entity**: `src/lib/iiot/entity/{Entity}Entity.ts` — Entity.make + toLayer + Machine.boot
5. **RPC**: `src/lib/iiot/rpc/{Entity}Rpcs.ts` — EntityProxy.toRpcGroup
6. **State**: `src/lib/iiot/state/{Entity}State.ts` — Service interface with in-memory and SQL adapters

The `EntityStack.ts` composition layer (`src/lib/iiot/entity/EntityStack.ts:54-67`) MUST be extended to include network entity handlers when they are implemented.

---

## N.12 Cross-References

| Topic | Reference |
|-------|-----------|
| ISA-95 equipment hierarchy | Reactive ISA-95 Hierarchy section |
| Intra-org consistency model | Two-Domain Consistency section, Domain 1 |
| Cross-org consistency model | Two-Domain Consistency section, Domain 2 |
| NATS subject hierarchy | Edge-First Architecture section |
| Tenant isolation | Security, Trust & Tenant Isolation section |
| Marketplace protocol | Marketplace Protocol section |
| Effect-TS patterns | Effect-TS Implementation Architecture section |
| Event distribution | Entity-Realtime Integration section |

---

## N.13 Open Questions

The following design decisions are deferred to implementation phase:

1. **Capacity pricing model**: Should capacity pricing be market-driven (bid/ask) or posted-price? The schema supports both but marketplace matching logic differs significantly [MARKET-MICROSTRUCTURE].

2. **Reputation bootstrapping**: How do new organizations (with no history) receive initial reputation scores? Options include vouching by existing high-trust orgs, certification-based floor scores, or a probationary period with restricted marketplace access.

3. **Compliance certificate verification**: Should the platform verify certificates with certifying bodies via API integration, or trust self-reported compliance with audit trail? The answer likely differs by framework (ISO self-reported, ITAR mandates verification).

4. **Cross-org work order dispute resolution**: What is the arbitration mechanism when a cross-org work order enters the `disputed` state? Options range from platform-mediated resolution to third-party arbitration services [OSTROM-COMMONS].

5. **CRDT garbage collection**: OR-Set tombstones for removed capabilities accumulate over time. What is the compaction strategy? Options include periodic snapshot compaction or tombstone TTL with causal consistency guarantees [CRDT-SHAPIRO].

---

*This section is part of TMNL-RFC-001: Entity Lifecycle Event Distribution for Metropolitan-Scale IIoT.*

---

<!-- Source: rfc-section-marketplace-protocol.md -->

## M. Marketplace Protocol

### M.1 Scope

This section specifies the **Marketplace Protocol** for the metropolitan
manufacturing commons -- the event-driven mechanism by which 200,000+
organizations discover capabilities, signal capacity, negotiate work orders,
settle payments, and build trust within the Atlanta manufacturing network.

The marketplace is not a bolt-on feature. It is the economic engine that
justifies network participation. Earl's 2-person machine shop joins because
the marketplace connects him to Boeing's overflow CNC work. Boeing joins
because the marketplace provides elastic manufacturing capacity without
capital expenditure.

This section covers:
- Capability discovery and search
- Real-time capacity signaling derived from equipment state events
- Work order lifecycle from RFQ to settlement
- Pricing, escrow, and settlement protocol
- Trust, reputation, and Sybil resistance
- Geographic optimization for Atlanta metro routing
- Privacy-preserving marketplace participation

For cross-organization consistency guarantees, see Section X (Two-Domain
Consistency Model). For tenant isolation and NATS account architecture, see
Section Y (Multi-Tenant Manufacturing Network Architecture). For trust
infrastructure, see Section Z (Security, Trust & Tenant Isolation).

### M.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### M.3 Marketplace Vision

#### M.3.1 The Manufacturing Commons as Two-Sided Market

The manufacturing commons operates as a two-sided marketplace [TWO-SIDED]
[PARKER-PLATFORM] where the same organization can simultaneously act as both
a capacity provider and a capacity consumer:

| Role | Description | Example |
|------|-------------|---------|
| **Capacity Provider** | Organization with idle machines offering manufacturing services | Earl has a 5-axis CNC idle on Thursdays |
| **Capacity Consumer** | Organization with overflow work seeking external fulfillment | Boeing needs 200 aluminum brackets by Friday |
| **Both** | Most organizations occupy both roles at different times | Precision Parts Co. fills Earl's lathe work and outsources its own heat treating |

This dual-role model distinguishes the manufacturing commons from traditional
job shops or contract manufacturing platforms [XOMETRY-PLATFORM] where roles
are fixed. In our model, every participant is both buyer and seller, creating
a denser network with stronger [METCALFE-LAW] effects.

#### M.3.2 Real-Time State as Market Signal

The fundamental innovation: **entity state events ARE market signals**. When a
machine transitions from `RUNNING` to `IDLE`, that is simultaneously:

1. An **operational event** (the machine finished its job)
2. A **capacity signal** (the machine is now available for marketplace work)
3. A **pricing input** (more idle machines = lower spot prices in the region)

No existing Manufacturing-as-a-Service (MaaS) platform [TEDALDI-MAAS-2023]
provides this real-time linkage between operational state and marketplace
availability. Xometry [XOMETRY-PLATFORM] relies on manual capacity
declaration; EFPF [EFPF-2020] exchanges batch documents. Our platform derives
marketplace signals directly from the entity lifecycle event stream.

#### M.3.3 "Uber for CNC" with ISA-95 Compliance

The marketplace metaphor is deliberately accessible: match available machines
to needed work in real time, with quality verification. But unlike ride-sharing,
manufacturing carries regulatory weight:

- **Quality certificates**: AS9100 (aerospace), ISO 13485 (medical),
  IATF 16949 (automotive) -- capabilities MUST be verified, not self-declared
- **Material traceability**: 21 CFR Part 11 [FDA-CFR11] compliance for regulated
  industries requires full audit trails
- **Process validation**: A CNC mill can cut aluminum, but IS it validated for
  aerospace-grade aluminum? Process-material combinations matter
- **ISA-95 compliance**: Work orders MUST integrate with existing MES/ERP systems
  at the executing organization via [ISA-95-5] transaction models

The marketplace protocol addresses these requirements through verified
capability claims, event-sourced audit trails, and ISA-95-aligned work order
transactions.

### M.4 Capability Discovery Protocol

#### M.4.1 Capability Declaration

Organizations that opt into the marketplace MUST publish their capabilities
to the manufacturing commons. A capability declaration consists of:

```
CapabilityDeclaration {
  orgId:            OrganizationId      // Publishing org
  capabilityId:     CapabilityId        // Unique per org
  category:         CapabilityCategory  // 'machining' | 'fabrication' | 'finishing' | ...
  processes:        Process[]           // CNC milling, turning, grinding, etc.
  materials:        Material[]          // Aluminum, steel, titanium, etc.
  tolerances:       ToleranceSpec       // +/- 0.001", surface finish Ra
  maxPartSize:      Dimensions          // Work envelope
  certifications:   Certification[]     // AS9100, ISO 13485, etc.
  verifiedAt:       ISO-8601 | null     // Last third-party verification date
  automatedSignal:  boolean             // True if capacity derived from equipment state
  declaredAt:       ISO-8601            // Declaration timestamp
}
```

**NATS subject**: `commons.capability.{orgId}.declared`

**Storage**: CRDT-based capability index using OR-Set [CRDT-SHAPIRO] stored in
NATS KV bucket `network.capabilities`. Each organization writes only to its own
key prefix (`network.capabilities.{orgId}.*`), ensuring conflict-free updates.

#### M.4.2 Capability Categories

The marketplace defines a structured taxonomy of manufacturing capabilities
aligned with ISA-95 activity models [ISA-95-1]:

| Category | Subcategories | ISA-95 Mapping |
|----------|---------------|----------------|
| Machining | CNC milling (3/4/5-axis), turning, drilling, boring, EDM | Production capability |
| Fabrication | Sheet metal, welding (MIG/TIG/laser), bending, punching | Production capability |
| Finishing | Anodizing, powder coating, plating, heat treating, deburring | Quality operations |
| Additive | FDM, SLA, SLS, DMLS, binder jetting | Production capability |
| Inspection | CMM, optical, X-ray, ultrasonic | Quality operations |
| Assembly | Mechanical, electronic, clean-room | Production capability |
| Raw Material | Stock cutting, material supply, bar stock | Material management |

Organizations MUST declare capabilities at the subcategory level. The
category-level grouping is used for search optimization.

#### M.4.3 Capability Search Protocol

Search follows a structured RPC-based query pattern. The marketplace exposes
a `Marketplace.SearchCapabilities` RPC:

```
SearchCapabilitiesRequest {
  processes:        Process[]           // Required processes
  materials:        Material[]          // Required materials
  certifications:   Certification[]     // Required certs (AND logic)
  minTolerance:     ToleranceSpec?      // Minimum precision
  maxDistance:       DistanceKm?         // Proximity filter (from org's location)
  minReputation:    number?             // Minimum G-10 trust score (0-100)
  onlyVerified:     boolean             // Only third-party verified capabilities
  onlyAvailable:    boolean             // Cross-reference with live capacity
}

SearchCapabilitiesResponse {
  results: CapabilityMatch[]
  totalMatches: number
  searchLatency: DurationMs
}

CapabilityMatch {
  orgId:            OrganizationId
  capability:       CapabilityDeclaration
  currentCapacity:  CapacitySignal?     // Live capacity if available
  distance:         DistanceKm
  reputation:       number              // G-10 score
  estimatedLeadTime: DurationDays?      // Based on current backlog
}
```

**Search semantics**: "I need 5-axis CNC in aluminum, AS9100 certified, within
50 miles" translates to:

```
{
  processes: ["cnc_milling_5axis"],
  materials: ["aluminum_6061", "aluminum_7075"],
  certifications: ["AS9100"],
  maxDistance: 80,  // km (~50 miles)
  onlyAvailable: true
}
```

**Implementation**: The CRDT-based OR-Set capability index supports full-scan
queries across all organizations. For the Atlanta metro network (200K+ orgs),
the index is expected to contain ~500K capability entries. Queries SHOULD
complete within 500ms (P95) using NATS KV range scans with in-memory
filtering.

#### M.4.4 Verified vs. Self-Declared Capabilities

Trust in the marketplace hinges on capability verification:

| Verification Level | Indicator | Trust Weight |
|--------------------|-----------|-------------|
| **Self-declared** | Org claims capability, no external verification | Low (0.3x weight in search ranking) |
| **Peer-attested** | Another org confirms capability from prior transaction | Medium (0.6x weight) |
| **Third-party audited** | Independent auditor confirms (AS9100 registrar, etc.) | High (1.0x weight) |
| **Platform-verified** | Platform's own verification process (sample job, documentation review) | High (1.0x weight) |

Organizations with third-party or platform verification MUST have their
`verifiedAt` timestamp updated within the past 12 months to maintain
"verified" status. Expired verifications automatically downgrade to
"self-declared."

### M.5 Capacity Signaling Protocol

#### M.5.1 Capacity Derived from Equipment State

Capacity signals are derived automatically from equipment state transitions
processed by the EventDistribution service
(`src/lib/iiot/realtime/event-distribution.ts`). The signal derivation:

```
Equipment State Event              Capacity Signal
─────────────────────              ───────────────
Machine.GoIdle       ──────────►   CapacityAvailable(machineId, capabilities)
Machine.Resume       ──────────►   CapacityConsumed(machineId)
Machine.MarkFaulted  ──────────►   CapacityUnavailable(machineId, reason: "faulted")
Machine.ScheduleRepair ────────►   CapacityUnavailable(machineId, reason: "maintenance")
Line.MarkStarved     ──────────►   CapacityDegraded(lineId, utilization: reduced)
Plant.EmergencyShutdown ───────►   CapacityUnavailable(plantId, reason: "emergency")
```

**NATS subject**: `commons.capacity.{orgId}`

#### M.5.2 Aggregation Rules

Capacity is aggregated at multiple levels following the ISA-95 hierarchy:

| Level | Aggregation | Signal Subject |
|-------|-------------|----------------|
| Machine | Direct: machine IDLE = 1 unit available | `commons.capacity.{orgId}.machine.{machineId}` |
| Line | Sum of idle machines on line | `commons.capacity.{orgId}.line.{lineId}` |
| Organization | Sum of all idle machines across all sites | `commons.capacity.{orgId}` |
| Network | Sum of all org-level capacities (G-Counter CRDT) | `network.capacity.summary` |

The network-level aggregate uses a G-Counter CRDT [CRDT-SHAPIRO] stored in
NATS KV bucket `network.capacity`. Each organization updates only its own
counter value. The aggregate is computed by summing all keys -- conflict-free
by construction. See Section X.9 for CRDT specification.

#### M.5.3 Outward Propagation Rules

Capacity signals propagate outward from the organization to the network
following three rules:

**O-1 (Opt-In Gating)**: Capacity signals MUST NOT leave the organization's
NATS account unless the organization has explicitly enabled marketplace
participation. The export configuration in the organization's account JWT
[NATS-JWT] controls this gate.

**O-2 (Aggregation Privacy)**: Organizations MAY choose to publish only
aggregate capacity (org-level count of idle machines) rather than per-machine
signals. This prevents competitors from inferring production schedules. The
aggregation level is configurable: `machine` (full detail), `line`
(line-level), or `org` (aggregate only).

**O-3 (Staleness Bound)**: Capacity signals MUST be refreshed within the G-8
bounded staleness window (60 seconds) as specified in Section X.4. Stale
capacity entries older than 120 seconds SHOULD be flagged as `possibly_stale`
in search results.

#### M.5.4 Capacity Signal Schema

```
CapacitySignal {
  _tag:             'CapacitySignal'
  orgId:            OrganizationId
  timestamp:        ISO-8601
  totalMachines:    number            // Total registered machines
  idleMachines:     number            // Currently idle
  faultedMachines:  number            // Currently faulted
  utilization:      number            // 0.0 - 1.0
  capabilities:     CapabilityId[]    // What idle machines can do
  aggregationLevel: 'machine' | 'line' | 'org'
}
```

### M.6 Work Order Lifecycle

#### M.6.1 State Machine

Marketplace work orders follow a structured lifecycle that extends the
existing WorkOrderEntity (`src/lib/iiot/entity/WorkOrderEntity.ts`) with
cross-organization states:

```
                    ┌──────────────┐
                    │  RFQ_POSTED  │
                    └──────┬───────┘
                           │ Bids received
                    ┌──────▼───────┐
                    │   QUOTING    │◄──── Multiple orgs submit quotes
                    └──────┬───────┘
                           │ Requester selects
                    ┌──────▼───────┐
                    │   ACCEPTED   │ ──── Quote accepted, escrow funded
                    └──────┬───────┘
                           │ Fulfiller begins
                    ┌──────▼───────┐
                    │ IN_PROGRESS  │ ──── Mapped to internal WO at fulfiller
                    └──────┬───────┘
                           │ Production complete
                    ┌──────▼───────┐
                    │  QC_PENDING  │ ──── Quality check at fulfiller
                    └──────┬───────┘
                     ┌─────┴──────┐
               ┌─────▼─────┐ ┌───▼────┐
               │ QC_PASSED  │ │QC_FAIL │
               └─────┬──────┘ └───┬────┘
                     │            │ Rework or dispute
               ┌─────▼─────┐ ┌───▼──────────┐
               │  SHIPPED   │ │  REWORK      │ ──► Back to IN_PROGRESS
               └─────┬──────┘ └──────────────┘
                     │
               ┌─────▼──────────┐
               │ RECEIVER_CHECK │ ──── Requester inspects delivery
               └─────┬──────────┘
                ┌────┴─────┐
          ┌─────▼────┐ ┌───▼──────┐
          │ COMPLETE  │ │ DISPUTED │
          └─────┬─────┘ └───┬──────┘
                │           │ Resolution
          ┌─────▼─────┐ ┌──▼───────┐
          │ SETTLED   │ │ RESOLVED │──► SETTLED or REFUNDED
          └───────────┘ └──────────┘
```

#### M.6.2 State Transition Events

Each transition emits an event to the marketplace commons:

| Transition | Publisher | NATS Subject | G-8 Applies |
|------------|-----------|-------------|-------------|
| `RfqPosted` | Requester | `commons.marketplace.rfq.{rfqId}` | Yes (60s bound) |
| `QuoteSubmitted` | Bidder | `commons.marketplace.quote.{rfqId}.{bidderId}` | Yes |
| `QuoteAccepted` | Requester | `commons.marketplace.accept.{rfqId}` | Causal (MUST follow quote) |
| `EscrowFunded` | Platform | `commons.marketplace.escrow.{orderId}` | Yes |
| `WorkStarted` | Fulfiller | `commons.marketplace.progress.{orderId}` | Yes |
| `QcCompleted` | Fulfiller | `commons.marketplace.qc.{orderId}` | Yes |
| `Shipped` | Fulfiller | `commons.marketplace.ship.{orderId}` | Yes |
| `ReceiverConfirmed` | Requester | `commons.marketplace.confirm.{orderId}` | Yes |
| `Settled` | Platform | `commons.marketplace.settle.{orderId}` | Yes |
| `Disputed` | Either party | `commons.marketplace.dispute.{orderId}` | Yes |
| `DisputeResolved` | Platform | `commons.marketplace.resolve.{orderId}` | Yes |

**Causal ordering note**: `QuoteAccepted` MUST be causally ordered with
respect to `QuoteSubmitted`. This is achievable without global coordination
because both events route through the requester's NATS account, preserving
per-subject ordering (see Section X.8 special case for `WorkOrderAccepted`).

#### M.6.3 Cross-Organization Visibility

The marketplace work order creates a shared view between requester and
fulfiller while preserving data sovereignty:

| Data | Requester Sees | Fulfiller Sees | Network Sees |
|------|----------------|----------------|-------------|
| Work order details | Full | Full | Anonymized summary |
| Production progress | Status only | Full internal WO state | Status only |
| Machine assignment | No | Yes (internal) | No |
| Quality results | Pass/fail + cert | Full QC data | Pass/fail only |
| Pricing | Agreed price | Agreed price | Aggregate stats |
| Audit trail | Own actions | Own actions | Event count |

**Implementation**: Cross-org visibility is controlled by NATS account
subject exports (see Section Y.8). The requester's account imports only
the subject patterns listed in the "Requester Sees" column. The fulfiller's
internal subjects remain within their account boundary.

#### M.6.4 SLA Enforcement

Marketplace work orders carry service level agreements with automatic
escalation:

| SLA Metric | Threshold | Escalation Action |
|------------|-----------|-------------------|
| Quote response time | 24 hours after RFQ | Auto-notify requester of non-responsive bidders |
| Acceptance confirmation | 4 hours after selection | Auto-cancel if unfunded |
| Work start deadline | Per quote lead time | Auto-escalation to platform ops |
| QC completion | 48 hours after production | Auto-flag for review |
| Shipping confirmation | Per quote terms | Partial refund trigger |
| Receiver confirmation | 72 hours after delivery | Auto-confirm (silent acceptance) |

SLA monitoring is event-driven: each state transition resets a timer. If the
timer expires without the expected next transition, the platform emits an
`SlaBreached` event and triggers the escalation action.

#### M.6.5 Dispute Resolution Protocol

When either party raises a dispute:

```
Requester or Fulfiller
        │
        ▼
┌───────────────┐
│ DISPUTE_FILED │ ──── Both parties notified
└───────┬───────┘
        │ 48h window
┌───────▼───────┐
│ EVIDENCE      │ ──── Both parties submit documentation
│ SUBMISSION    │      (photos, measurements, certificates)
└───────┬───────┘
        │
┌───────▼───────────┐
│ MEDIATION         │ ──── Platform mediator reviews evidence
│ (platform-assisted│      Attempts mutual resolution
│  or automated)    │
└───────┬───────────┘
   ┌────┴────┐
   ▼         ▼
RESOLVED   ARBITRATION ──► Final binding decision
   │         │
   ▼         ▼
SETTLED    SETTLED (with penalty allocation)
```

**Dispute evidence** is stored as encrypted payloads in the requester's
NATS account, shared with the platform mediator via time-limited subject
exports. Evidence is NOT visible to the broader network.

### M.7 Pricing and Settlement

#### M.7.1 Dynamic Pricing Inputs

Marketplace pricing is influenced by real-time signals, not fixed rate cards:

| Signal | Effect on Price | Source |
|--------|----------------|--------|
| Machine availability in region | More idle = lower spot price | Capacity signals (M.5) |
| Urgency (lead time requested) | Shorter lead time = premium | RFQ parameters |
| Complexity (tolerances, certifications) | Tighter = higher | Capability matching |
| Requester reputation | Higher trust = better terms | G-10 score |
| Fulfiller reputation | Higher trust = premium pricing | G-10 score |
| Material costs | Pass-through | External feed |
| Historical transaction prices | Anchor | Platform analytics |

The platform SHOULD provide pricing guidance (suggested range) based on
recent comparable transactions. Actual pricing is negotiated between parties.

#### M.7.2 Escrow Protocol

All marketplace transactions above a configurable threshold (RECOMMENDED:
$100 USD) MUST use the event-sourced escrow ledger:

```
1. QuoteAccepted
   ├── Platform creates EscrowRecord(orderId, amount, requester, fulfiller)
   └── Event: EscrowCreated

2. Requester funds escrow
   ├── Payment confirmed via payment processor webhook
   └── Event: EscrowFunded(orderId, amount, paymentRef)

3. Work completed + QC passed + Receiver confirmed
   ├── Platform releases escrow to fulfiller
   ├── Platform deducts network fee
   └── Event: EscrowReleased(orderId, fulfillerAmount, feeAmount)

4. Dispute filed
   ├── Escrow frozen until resolution
   └── Event: EscrowFrozen(orderId, reason)

5. Dispute resolved
   ├── Escrow allocated per resolution (full release, partial refund, full refund)
   └── Event: EscrowSettled(orderId, allocation)
```

**Event sourcing**: The escrow ledger is event-sourced [EVENT-SOURCING]. The
current balance of any escrow account can be reconstructed by replaying its
events. This provides a complete audit trail for regulatory compliance
[FDA-CFR11] and dispute resolution.

#### M.7.3 Settlement Triggers

Settlement occurs automatically when all conditions are met:

| Trigger | Condition | Action |
|---------|-----------|--------|
| Happy path | QC passed + Receiver confirmed | Release to fulfiller minus fee |
| Silent acceptance | 72h after delivery, no dispute filed | Release to fulfiller minus fee |
| Quality failure | QC failed, no rework agreed | Full refund to requester |
| Partial delivery | Partial quantity received and confirmed | Pro-rata settlement |
| Dispute resolution | Mediator/arbitrator decision | Per decision allocation |

#### M.7.4 Network Fee Structure

The platform charges a network fee on settled transactions:

| Transaction Value | Fee Rate | Rationale |
|-------------------|----------|-----------|
| $0 - $500 | 5% | Cover payment processing + platform costs |
| $500 - $5,000 | 3% | Standard marketplace rate |
| $5,000 - $50,000 | 2% | Volume discount |
| $50,000+ | 1.5% | Enterprise tier |

The fee is deducted from the escrow at settlement. Organizations MAY
negotiate custom rates at the enterprise tier.

**Transparency**: Fee calculations MUST be visible to both parties before
the transaction is finalized. The platform MUST NOT charge hidden fees.

### M.8 Trust and Reputation in the Marketplace

#### M.8.1 G-10 Trust Score

The G-10 Trust Score extends the network's guarantee framework (G-1 through
G-9) with a marketplace-specific reputation metric. G-10 is a bounded counter
CRDT [CRDT-SHAPIRO] stored at `network.reputation.{orgId}` (see Section X.9).

**Score computation**:

```
G-10 Score = base_score
  + (successful_completions * 2)
  - (disputes_lost * 5)
  - (sla_breaches * 3)
  + (verification_bonus)
  + (tenure_bonus)
  , clamped to [0, 100]
```

| Component | Value | Rationale |
|-----------|-------|-----------|
| Base score (new org) | 30 | Neutral starting point |
| Successful completion | +2 per transaction | Proven reliability |
| Dispute lost | -5 per dispute | Strong deterrent |
| SLA breach | -3 per breach | Timeliness matters |
| Third-party verification | +10 (one-time) | Certified capability |
| Tenure bonus | +1 per 6 months (max +10) | Long-term participants |

#### M.8.2 Verified Capability Claims

Capability verification is the marketplace's trust foundation:

1. **Self-declaration** (onboarding): Organization declares capabilities
   during marketplace opt-in. Score weight: 0.3x in search ranking.

2. **Transaction attestation** (organic): After successful marketplace
   completion, the requester MAY attest to the fulfiller's capability.
   Attestations accumulate and increase search ranking weight to 0.6x.

3. **Third-party audit** (formal): Independent auditors (AS9100 registrars,
   ISO certification bodies) submit digitally signed verification records.
   Score weight: 1.0x. Verification MUST be renewed annually.

4. **Platform spot-check** (random): The platform MAY commission sample jobs
   to verify declared capabilities. Organizations that fail spot-checks
   receive a `CapabilityDowngraded` event and search ranking penalty.

#### M.8.3 Sybil Resistance

New organizations start with limited marketplace access to prevent gaming:

| Marketplace Tier | Requirements | Capabilities |
|------------------|-------------|-------------|
| **Newcomer** | Account created, edge device connected | Can browse, post RFQs (max 3/week), bid on jobs (max 3/week) |
| **Established** | 5+ successful transactions, G-10 >= 40, 30+ days tenure | Unlimited RFQs and bids, eligible for escrow-free small jobs |
| **Trusted** | 20+ transactions, G-10 >= 60, 90+ days, verified capabilities | Priority in search results, higher bid limits, escrow-free up to $1000 |
| **Verified** | 50+ transactions, G-10 >= 75, third-party audit complete | Featured in search, eligible for enterprise contracts, reduced fees |

**Tier progression** is event-sourced. Each transaction, verification, and
time-based milestone emits an event. Tier calculations are idempotent
projections of the event stream.

#### M.8.4 Transaction History as Reputation Input

Every marketplace transaction contributes to reputation through three channels:

1. **Completion rate**: % of accepted work orders completed successfully
2. **On-time rate**: % of work orders completed within quoted lead time
3. **Quality rate**: % of work orders passing QC on first attempt

These rates are published as CRDT aggregates (LWW-Register per metric per
org) at `network.reputation.{orgId}.metrics`. Historical rates are computed
over a rolling 12-month window.

### M.9 Geographic Optimization

#### M.9.1 Proximity-Based Matching

The Atlanta metropolitan manufacturing network is geographically bounded.
Proximity is a first-class search parameter because logistics cost scales
with distance:

```
SearchCapabilitiesRequest.maxDistance = 80 km  // ~50 miles

Matching algorithm:
1. Filter capabilities by process/material/certification
2. Compute haversine distance from requester to each match
3. Rank by: capability_fit * 0.5 + proximity * 0.3 + reputation * 0.2
4. Return top N matches
```

**Organization location** is declared at onboarding (lat/lng of primary
facility). Multi-site organizations declare location per site. Location is
stored in NATS KV at `network.locations.{orgId}`.

#### M.9.2 Metro Routing Optimization

For the Atlanta metro region, the marketplace SHOULD optimize routing to
minimize total logistics time:

| Route Pattern | Example | Optimization |
|---------------|---------|-------------|
| Direct | Requester -> Fulfiller | Single hop, minimize distance |
| Multi-hop | Requester -> Machining (Org B) -> Finishing (Org C) -> Requester | Minimize total path distance |
| Co-located | Both orgs in same industrial park | Priority match (logistics ~= 0) |

#### M.9.3 Multi-Hop Work Orders

Complex parts may require multiple manufacturing processes that no single
organization provides. The marketplace supports multi-hop work orders:

```
Multi-Hop Work Order Sequence:

Requester (Boeing) posts RFQ:
  "Need 200 aluminum brackets: CNC machining + anodizing + inspection"

Platform decomposes into sub-orders:
  Sub-1: CNC machining (5-axis, aluminum 6061) → Earl's Machine Shop
  Sub-2: Anodizing (Type III, hard coat)       → Metro Surface Finishing
  Sub-3: CMM inspection (AS9100 certified)     → Precision QC Services

Routing:
  Boeing → Earl's (machining) → Metro Surface (anodizing)
        → Precision QC (inspection) → Boeing

Each sub-order is an independent marketplace work order with:
  - Its own escrow
  - Its own SLA
  - Chain-linked delivery: Sub-2 starts when Sub-1 ships
```

**Event distribution for multi-hop**: Each sub-order emits standard work order
events. The parent work order aggregates sub-order states:

- Parent = `IN_PROGRESS` while any sub-order is active
- Parent = `QC_PENDING` when final sub-order reaches QC
- Parent = `COMPLETE` when all sub-orders are settled

The parent work order MUST maintain causal links to all sub-orders via
`causedBy` metadata (see Section X.3, G-3).

#### M.9.4 Logistics Integration Events

The marketplace emits logistics events to coordinate physical transport
between organizations in multi-hop and direct work orders:

| Event | Description | NATS Subject |
|-------|-------------|-------------|
| `PickupScheduled` | Parts ready for transport at source org | `commons.logistics.{orderId}.pickup` |
| `InTransit` | Parts en route between orgs | `commons.logistics.{orderId}.transit` |
| `Delivered` | Parts arrived at destination org | `commons.logistics.{orderId}.delivered` |

Logistics events are informational (not transactional). They provide
visibility into the physical supply chain but do NOT trigger settlement.
Only the work order state machine controls financial flows.

### M.10 Privacy-Preserving Marketplace

#### M.10.1 Data Sovereignty Principles

Organizations control what the marketplace can see. This is not optional --
it is architecturally enforced via NATS account subject exports [NATS-ACCOUNTS]:

| Data Category | Default Visibility | Org Can Override |
|---------------|-------------------|-----------------|
| Capability declarations | Visible to marketplace searchers | Can restrict to specific industries |
| Capacity signals | Aggregated (org-level count) | Can expose per-machine detail (opt-in) |
| Work order details | Visible to counterparty + platform only | Cannot broaden (privacy floor) |
| Machine identity | Hidden (only org sees) | Can expose for trusted partners |
| Production schedule | Hidden | Hidden (never exportable) |
| Pricing history | Aggregated in network analytics | Individual transactions are private |

#### M.10.2 Capacity Signal Aggregation

The default privacy mode for capacity signals is **org-level aggregation**:

```
Default (privacy-preserving):
  Network sees: "Earl's Machine Shop has 2 idle machines (CNC capability)"
  Network does NOT see: "Earl's Haas VF-2 (serial #12345) is idle"

Opt-in detailed mode:
  Network sees: "Earl's Machine Shop: VF-2 (5-axis CNC, aluminum) idle,
                 SL-20 (lathe, steel/aluminum) idle"
```

Organizations SHOULD use org-level aggregation unless they specifically
want machine-level visibility for competitive advantage (e.g., advertising
a rare 5-axis capability).

#### M.10.3 Encrypted Work Order Details

Work order details between counterparties MUST be encrypted in transit and
at rest within the NATS messaging layer:

1. **In transit**: NATS TLS encryption protects all messages on the wire
2. **Subject-level isolation**: Work order subjects are scoped to the
   requester's account. The fulfiller accesses them via targeted subject
   imports that the requester grants per-order.
3. **Audit trail access**: The platform mediator can access work order
   details only during active disputes, via time-limited subject exports.

The network (other organizations) sees only: `"Organization A posted a
marketplace work order"` with anonymized metadata (category, approximate
value range, required capabilities). Counterparty identities are not
disclosed to the network.

#### M.10.4 Right to Revoke

Per Section Y.7.2 (Organization Offboarding), organizations MUST be able to
revoke all marketplace exports within 60 seconds. This means:

1. Capability declarations are removed from the OR-Set CRDT
2. Capacity signals stop propagating
3. Active work orders continue to completion (contractual obligation) but
   no new marketplace interactions are possible
4. Historical transaction records are retained for the regulatory retention
   period but are not visible in marketplace search

### M.11 Codebase Grounding

This section maps marketplace protocol concepts to existing TMNL codebase
patterns, identifying current artifacts and extension points.

#### M.11.1 Entity Schemas and Identifiers

| Marketplace Concept | Existing Codebase Artifact | Extension Needed |
|---------------------|---------------------------|-----------------|
| OrganizationId | Not yet defined | Add to `src/lib/iiot/schemas/identifiers.ts` as branded type |
| CapabilityId | Not yet defined | New branded type in identifiers.ts |
| Work order entity | `src/lib/iiot/entity/WorkOrderEntity.ts` | Extend with cross-org states (RFQ, QUOTING, ACCEPTED, etc.) |
| Work order state machine | `src/lib/iiot/machines/graphs/work-order-graph.ts` | Add marketplace states to transition graph |
| Equipment level enum | `src/lib/iiot/schemas/identifiers.ts:28-38` `EquipmentLevel` | Already includes all 9 ISA-95 levels needed |
| Machine state transitions | `src/lib/iiot/machines/MachineAssetMachine.ts` | GoIdle, Resume, MarkFaulted already emit transitions |

#### M.11.2 Event Distribution Infrastructure

| Marketplace Concept | Existing Codebase Artifact | Extension Needed |
|---------------------|---------------------------|-----------------|
| Capacity signal derivation | `src/lib/iiot/realtime/event-distribution.ts:136-157` | Add 5th channel: `iiot:marketplace` for capacity signals |
| Cross-org event delivery | `src/lib/iiot/realtime/holonet-bridge.ts` | Add account-aware subject routing for cross-org |
| NATS subject patterns | `src/lib/iiot/realtime/iiot-subjects.ts` | Add `commons.*` subject specs for marketplace |
| Broadcast outlets | `src/lib/streams/constructs/ChannelService.ts` | Already supports fan-out; no change needed |
| Dual-publish (local + NATS) | `src/lib/iiot/realtime/event-distribution.ts:280-326` | Pattern reusable for marketplace events |

#### M.11.3 RPC Definitions

| Marketplace RPC | Existing Pattern | Extension Needed |
|-----------------|-----------------|-----------------|
| `Marketplace.SearchCapabilities` | Follows `Rpc.make()` pattern from `src/lib/iiot/rpc/RealtimeRpcs.ts` | New RPC group: `MarketplaceRpcs` |
| `Marketplace.PostRfq` | Follows `EntityProxy.toRpcGroup()` from `src/lib/iiot/rpc/WorkOrderRpcs.ts` | Extend WorkOrderEntity or create MarketplaceEntity |
| `Marketplace.SubmitQuote` | Similar to entity RPCs | New marketplace-specific RPC |
| `Marketplace.AcceptQuote` | Similar to entity RPCs | New marketplace-specific RPC |
| `Marketplace.SubscribeCapacity` | Follows `stream: true` pattern from `RealtimeRpcs.ts:107-121` | New streaming RPC for live capacity |
| `Marketplace.SubscribeOrderStatus` | Follows `stream: true` pattern | New streaming RPC for work order status |

The existing RPC infrastructure (`src/lib/iiot/rpc/index.ts`) composes
groups via `RpcGroup.make()`. A new `MarketplaceRpcs` group would be added
to `IIoTRpcs` using the same composition pattern.

#### M.11.4 CRDT Storage

| CRDT Aggregate | KV Bucket | CRDT Type | Existing Pattern |
|----------------|-----------|-----------|-----------------|
| Capability registry | `network.capabilities` | OR-Set | Defined in Section X.9 |
| Capacity counters | `network.capacity` | G-Counter | Defined in Section X.9 |
| Reputation scores | `network.reputation` | Bounded Counter | Defined in Section X.9 |
| Organization locations | `network.locations` | LWW-Register | New; same KV pattern |
| Metric rates | `network.reputation.{orgId}.metrics` | LWW-Register | New; same KV pattern |

All CRDT operations use the existing NATS KV infrastructure. Per Section X.9,
each organization writes only its own key prefix, ensuring conflict-free
updates without coordination.

#### M.11.5 State Machine Extension

The marketplace work order state machine extends the existing work order
state graph (`src/lib/iiot/machines/graphs/work-order-graph.ts`):

```
Existing WorkOrder states:
  draft → submitted → approved → in_progress → completed → closed
  (with: rejected, suspended, failed, cancelled branches)

Marketplace extension (new states, same graph pattern):
  rfq_posted → quoting → accepted → escrow_funded
    → in_progress → qc_pending → qc_passed → shipped
    → receiver_check → complete → settled

Mapping between internal and marketplace states:
  Marketplace "in_progress" maps to internal WorkOrder "in_progress"
  Marketplace "qc_pending" maps to internal WorkOrder "completed" + QC phase
  This mapping preserves the fulfiller's internal WO lifecycle
```

The existing `EntityProxy.toRpcGroup()` pattern from
`src/lib/iiot/rpc/WorkOrderRpcs.ts:25` generates RPCs automatically from
entity definitions. A `MarketplaceOrderEntity` would follow the same pattern,
generating cross-org RPCs from the marketplace state machine.

---

## Open Questions

1. **Multi-hop escrow coordination**: When a multi-hop work order spans 3+
   organizations, how are escrow funds allocated across sub-orders? If Sub-1
   succeeds but Sub-2 fails, the requester has paid for machining but received
   no finished parts. A sub-order escrow chain with conditional release
   triggers needs specification.

2. **Cross-metro marketplace**: The current design scopes to Atlanta metro.
   If a second metropolitan network (e.g., Detroit) joins, how do cross-metro
   marketplace queries work? Federated capability search across NATS
   superclusters needs additional specification.

3. **Intellectual property protection**: Some RFQs include CAD files or
   proprietary specifications. The marketplace needs a secure file transfer
   mechanism that protects IP after the work order is complete (e.g.,
   time-limited access, watermarking).

4. **Antitrust considerations**: If the marketplace achieves dominant market
   share in a metro region, the pricing guidance and fee structure may face
   regulatory scrutiny. Platform neutrality guarantees need legal review.

5. **Insurance and liability**: When a marketplace work order produces
   defective parts that cause downstream harm, liability allocation between
   requester, fulfiller, and platform needs contractual specification.

6. **Gale-Shapley for stable matching**: The current search-and-bid model
   allows requester choice. For automated matching (e.g., recurring orders),
   a stable matching algorithm [ZHANG-GS-CMfg-2015] could optimize
   network-wide allocation. This is deferred to a future RFC section.

---


---

<!-- Source: rfc-section-developer-experience.md -->
## DX.1 Scope

This section defines normative requirements for the developer-facing surface
of the TMNL manufacturing commons. The DX specification covers:

1. **SDK architecture** — TypeScript client library (`@tmnl/sdk`) exposing both
   Effect-native and Promise-based APIs for consuming entity lifecycle events,
   executing RPCs, and subscribing to real-time streams.

2. **API surface** — The full RPC inventory derived from `IIoTRpcs`
   (`lib/iiot/rpc/index.ts`), including 16 RPC groups spanning entity
   lifecycle, hierarchy queries, time-series telemetry, and streaming
   subscriptions.

3. **Client libraries** — Language-specific bindings (TypeScript primary,
   Python and Rust secondary) providing idiomatic access to the platform's
   RPC and streaming APIs.

4. **CLI tools** — Terminal-based operations for device registration,
   monitoring, alarm management, and diagnostic testing.

5. **Documentation** — Persona-targeted guides, auto-generated API reference,
   interactive playground, and example applications.

6. **Error handling** — Structured error taxonomy with machine-readable codes,
   Effect Cause traces, and suggested remediation steps.

7. **Testing support** — Mock services, entity test harnesses, event replay,
   and per-developer sandbox environments.

This section does NOT specify:

- Internal service implementation (covered in Effect Architecture section)
- Wire protocol details (covered in Edge Architecture section)
- Deployment topology (covered in Deployment section)
- Security authentication flows (covered in Security & Trust section)

---

## DX.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in [RFC2119] and [RFC8174].

Additional conventions:

| Convention | Meaning |
|---|---|
| `Effect<A, E, R>` | Effect-TS computation with success `A`, error `E`, requirements `R` |
| `Stream<A, E, R>` | Effect-TS pull-based stream emitting `A` values |
| `Schema.TaggedClass` | Effect Schema class with `_tag` discriminator |
| `Schema.TaggedError` | Effect Schema error with `_tag` discriminator |
| `RpcGroup.make(...)` | Composition of multiple RPCs into a named group |
| `EntityProxy.toRpcGroup(E)` | Auto-generation of entity lifecycle RPCs |

---

## DX.3 Developer Personas

The TMNL platform serves four distinct developer personas, each with different
technical depth, tooling needs, and interaction patterns. SDK design decisions
MUST consider all four personas as primary consumers.

### DX.3.1 Non-Developer Operator ("Earl")

**Profile**: Owner of a 2-person machine shop. NOT a software developer.
Needs to register equipment, view dashboards, acknowledge alarms, and
manage work orders — all via web interface. Zero code required.

**Interaction surface**:
- Web dashboard (React, pre-built components)
- Alarm acknowledgment via single button press
- Work order submission via form wizard
- Device registration via guided onboarding flow

**DX requirements**:
- Platform MUST provide a zero-code path for all core operations
- Web dashboard MUST NOT require Effect-TS knowledge
- Error messages MUST be written in plain language, not technical jargon
- Onboarding MUST complete in under 15 minutes for a single-device setup

**Relevant RPCs consumed (via dashboard, not directly)**:

| Operation | RPC | Source |
|---|---|---|
| View sensor readings | `SensorReading.GetLatest` | `lib/iiot/rpc/SensorRpcs.ts:26` |
| Acknowledge alarm | `Alarm.Acknowledge` | `lib/iiot/entity/AlarmEntity.ts` |
| View plant hierarchy | `PlantHierarchy.Get` | `lib/iiot/rpc/AssetRpcs.ts:55` |
| Submit work order | `WorkOrder.Create` | `lib/iiot/entity/WorkOrderEntity.ts` |

### DX.3.2 Integration Developer

**Profile**: Mid-level developer integrating TMNL into existing MES/ERP
systems. Comfortable with REST/WebSocket APIs and JavaScript. May use
Effect-TS but does not require it. Builds custom dashboards, alerting
pipelines, and data export workflows.

**Interaction surface**:
- `@tmnl/client` — Promise-based TypeScript client
- REST API via HTTP endpoints
- WebSocket subscriptions for real-time data
- CLI for device management and diagnostics

**DX requirements**:
- SDK MUST provide a Promise-based API that does not require Effect-TS
- WebSocket client MUST handle reconnection automatically
- All RPC payloads and responses MUST have corresponding JSON Schema
  documentation auto-generated from Effect Schema definitions [EFFECT-SCHEMA]
- API reference MUST include runnable code examples

### DX.3.3 Platform Developer

**Profile**: Senior Effect-TS engineer building custom entity types,
extending the RPC surface, or implementing complex stream processing
pipelines. Works with `@effect/cluster`, `@effect/rpc`, and raw
`Stream<A, E, R>` composition.

**Interaction surface**:
- `@tmnl/sdk` — Full Effect-native API (`Effect<A, E, R>`)
- Direct `@effect/rpc` client with type-safe RPC invocation
- `Stream` API for composing real-time pipelines
- Entity definition toolkit for custom entity types
- Layer composition for service dependency management

**DX requirements**:
- SDK MUST expose the full `Effect<A, E, R>` type including error channel
- Stream subscriptions MUST preserve backpressure semantics [EFFECT-STREAM]
- Entity definition MUST follow the `Schema.TaggedClass` + `Machine` +
  `Entity` composition pattern established in existing entities
- Layer composition MUST be documented with dependency graph visualization

### DX.3.4 Hardware Developer

**Profile**: Firmware engineer programming edge devices (PLC, gateway, sensor
module) to publish data to TMNL. Works in C/Rust, speaks MQTT/Sparkplug-B,
and does NOT use TypeScript.

**Interaction surface**:
- MQTT/Sparkplug-B protocol for telemetry publishing [SPARKPLUG-B]
- `tmnl-rs` Rust client for edge device integration
- HTTP REST fallback for simple device registration
- CLI for device provisioning and certificate management

**DX requirements**:
- Edge devices MUST be able to publish readings using standard Sparkplug-B
  payloads without custom protocol extensions
- Device registration MUST support both CLI-driven and API-driven workflows
- TLS certificates MUST be provisionable via CLI (`tmnl devices provision`)
- Firmware SDK documentation MUST include memory and CPU overhead estimates

---

## DX.4 SDK Architecture

### DX.4.1 Package Structure

Implementations MUST provide the following npm packages:

| Package | Description | Primary Persona |
|---|---|---|
| `@tmnl/sdk` | Full Effect-native SDK — `Effect<A, E, R>` API | Platform developer |
| `@tmnl/client` | Promise-based wrapper — `async/await` API | Integration developer |
| `@tmnl/testing` | Mock services, test harnesses, event replay | All developers |
| `@tmnl/types` | Shared TypeScript types and Schema definitions | All developers |

### DX.4.2 Effect-Native API (`@tmnl/sdk`)

The primary SDK MUST expose RPCs as typed Effect computations. The client
MUST be constructed from the `IIoTRpcs` group definition
(`lib/iiot/rpc/index.ts:91-112`).

**Normative example — creating an RPC client**:

```typescript
import { RpcClient } from '@effect/rpc'
import { RpcSerialization } from '@effect/rpc'
import { IIoTRpcs } from '@tmnl/sdk'
import { Effect, Layer } from 'effect'

// Create typed RPC client from IIoTRpcs group
const client = RpcClient.make(IIoTRpcs)

// Request-response RPC
const getPlant = client.Plant.Get({
  plantId: 'PLT-chicago-main' as PlantId,
}).pipe(
  Effect.provide(RpcSerialization.layerJson),
  Effect.provide(WebSocketTransportLive),
)

// Streaming RPC — returns Stream<SensorReading, RealtimeError>
const readings = client.Realtime.SubscribeReadings({
  deviceId: 'DEV-temp-01' as DeviceId,
  throttleMs: 1000,
})
```

**Codebase proof**: The `IIoTRpcs` group is defined at `lib/iiot/rpc/index.ts:91-112`
by composing all 16 RPC sub-groups via `RpcGroup.make()` with spread of
`requests.values()`. This single group definition is the canonical source
for the SDK's type-safe client surface.

### DX.4.3 Promise-Based Wrapper (`@tmnl/client`)

For integration developers who do not use Effect-TS, the client library
MUST provide a Promise-based API that wraps the Effect computation with
`Effect.runPromise`.

**Normative example — Promise wrapper**:

```typescript
import { TmnlClient } from '@tmnl/client'

const client = new TmnlClient({
  endpoint: 'wss://api.tmnl.io/ws/iiot',
  token: process.env.TMNL_API_TOKEN,
})

// Request-response — returns Promise<Plant>
const plant = await client.plants.get('PLT-chicago-main')

// Streaming — returns AsyncIterable<SensorReading>
for await (const reading of client.realtime.subscribeReadings({
  deviceId: 'DEV-temp-01',
})) {
  console.log(`${reading.metricName}: ${reading.value} ${reading.unit}`)
}

// Alarm acknowledgment — returns Promise<void>
await client.alarms.acknowledge('ALM-001', {
  acknowledgedBy: 'earl@machineshop.com',
})
```

The Promise wrapper MUST:

1. **Preserve error typing** — Errors from `Schema.TaggedError` MUST be
   converted to structured JavaScript Error subclasses with `code`, `_tag`,
   and `details` properties.

2. **Handle WebSocket lifecycle** — Connection, reconnection, and subscription
   management MUST be automatic with configurable retry parameters.

3. **Convert Streams to AsyncIterables** — All `stream: true` RPCs
   MUST be exposed as `AsyncIterable<T>` using `Stream.toAsyncIterable`
   [EFFECT-STREAM].

4. **Provide JSON Schema for payloads** — Every RPC payload MUST have a
   JSON Schema generated via `JSONSchema.make()` [EFFECT-SCHEMA] for
   validation and documentation.

### DX.4.4 WebSocket Client with Auto-Reconnect

The SDK WebSocket transport MUST implement the following reconnection protocol:

| Parameter | Default | Description |
|---|---|---|
| `initialDelayMs` | 1000 | First reconnect delay |
| `maxDelayMs` | 30000 | Maximum backoff ceiling |
| `backoffMultiplier` | 2.0 | Exponential backoff factor |
| `maxRetries` | Infinity | Unlimited by default |
| `jitterFactor` | 0.2 | Random jitter (0-20% of delay) |

On reconnection, the client MUST:

1. Re-establish WebSocket connection to `wss://{host}/ws/iiot`
2. Re-subscribe to all active stream subscriptions
3. Emit a `reconnected` event to application code
4. NOT replay missed events (subscriptions are stateless;
   use `SensorReading.Query` with time range for gap-fill)

**Codebase grounding**: The reconnection model aligns with the stateless
subscription design documented in Phase 5 architecture plans. Clients manage
reconnect and re-subscribe; the server does not track session state.

### DX.4.5 Stream API for Real-Time Entity Events

The SDK MUST expose four real-time subscription streams, corresponding to
the `RealtimeRpcs` group (`lib/iiot/rpc/RealtimeRpcs.ts:183-188`):

| Stream RPC | Success Type | Filter Parameters | Source |
|---|---|---|---|
| `Realtime.SubscribeReadings` | `SensorReading` | `deviceId?`, `plantId?`, `throttleMs?` | `RealtimeRpcs.ts:107` |
| `Realtime.SubscribeAlarms` | `AlarmEvent` | `deviceId?`, `minSeverity?`, `onlyUnacknowledged?` | `RealtimeRpcs.ts:129` |
| `Realtime.SubscribeEquipmentState` | `EquipmentStateChange` | `entityType?`, `plantId?` | `RealtimeRpcs.ts:149` |
| `Realtime.SubscribeInvalidations` | `CacheInvalidation` | `patterns` | `RealtimeRpcs.ts:169` |

All stream RPCs use `stream: true` in their `Rpc.make()` definition,
which causes the RPC server to emit events as an `Effect.Stream`
rather than a single response [EFFECT-RPCGROUP].

---

## DX.5 API Surface

### DX.5.1 RPC Group Inventory

The complete API surface is defined by `IIoTRpcs` (`lib/iiot/rpc/index.ts`),
which composes 16 RPC sub-groups. Implementations MUST expose all groups
through the SDK client.

#### Stateless Query RPCs

| Group | Operations | Style | Source |
|---|---|---|---|
| `SensorRpcs` | `GetLatest`, `Query` (stream), `QueryAggregated` (stream), `Subscribe` (stream) | Request/Stream | `lib/iiot/rpc/SensorRpcs.ts` |
| `AssetRpcs` | `ListPlants` (stream), `GetPlant`, `GetPlantHierarchy`, `ListLinesForPlant` (stream), `ListMachinesForLine` (stream), `GetMachineWithSensors`, `ListSensorsForMachine` (stream), `GetSensorHierarchy` | Request/Stream | `lib/iiot/rpc/AssetRpcs.ts` |

#### Entity-Derived RPCs (via `EntityProxy.toRpcGroup`)

Each entity automatically generates `${Entity}.${Operation}` and
`${Entity}.${Operation}Discard` (fire-and-forget) RPCs via
`EntityProxy.toRpcGroup()` [EFFECT-ENTITY].

| Group | Entity Operations | Source |
|---|---|---|
| `AlarmRpcs` | `Create`, `Get`, `Acknowledge`, `Clear` + `Query` (stream), `GetContext`, `GetStats` | `lib/iiot/rpc/AlarmRpcs.ts` |
| `WorkOrderRpcs` | `Create`, `Get`, `Submit`, `Approve`, `Reject`, `Start`, `Suspend`, `Resume`, `Complete`, `Fail`, `Cancel`, `Close` | `lib/iiot/rpc/WorkOrderRpcs.ts` |
| `EquipmentStateRpcs` | `GetCurrent`, `GetHistory`, `Transition`, `UpdateReason`, `GetOee`, `GetDurations` | `lib/iiot/rpc/EquipmentStateRpcs.ts` |
| `PlantRpcs` | `Create`, `Get`, `CompleteCommissioning`, `ScheduledShutdown`, `Restart`, `EmergencyShutdown` | `lib/iiot/rpc/PlantRpcs.ts` |
| `LineRpcs` | `Create`, `Get`, `Start`, `Stop`, `BeginChangeover`, `CompleteChangeover`, `MarkStarved` | `lib/iiot/rpc/LineRpcs.ts` |
| `WorkCellRpcs` | `Create`, `Get`, `BeginSetup`, `CompleteSetup`, `Stop`, `MarkBlocked`, `ClearBlocked` | `lib/iiot/rpc/WorkCellRpcs.ts` |
| `MachineAssetRpcs` | `Create`, `Get`, `Activate`, `GoIdle`, `Resume`, `MarkFaulted`, `ScheduleRepair` | `lib/iiot/rpc/MachineAssetRpcs.ts` |
| `DeviceRpcs` | `Create`, `Get`, `GoOnline`, `GoOffline`, `MarkFaulted`, `ClearFault` | `lib/iiot/rpc/DeviceRpcs.ts` |
| `SensorAssetRpcs` | `Create`, `Get`, `StartCalibration`, `CompleteCalibration`, `FailCalibration` | `lib/iiot/rpc/SensorAssetRpcs.ts` |
| `EnterpriseRpcs` | `Create`, `Get`, `Restructure`, `CompleteRestructuring`, `Merge`, `Dissolve` | `lib/iiot/rpc/EnterpriseRpcs.ts` |
| `SiteRpcs` | `Create`, `Get`, `BeginConstruction`, `Commission`, `SeasonalShutdown`, `Reopen`, `Close`, `Decommission` | `lib/iiot/rpc/SiteRpcs.ts` |
| `AreaRpcs` | `Create`, `Get`, `Restrict`, `ClearRestriction`, `EnterMaintenance`, `ExitMaintenance` | `lib/iiot/rpc/AreaRpcs.ts` |
| `AssetEntityRpcs` | `Get`, `GetChildren`, `GetHierarchy`, `Update` | `lib/iiot/rpc/AssetEntityRpcs.ts` |
| `SensorEntityRpcs` | `GetState`, `GetLatest`, `GetAggregated`, `GetStats` | `lib/iiot/rpc/SensorEntityRpcs.ts` |

#### Realtime Streaming RPCs

| Group | Operations | Source |
|---|---|---|
| `RealtimeRpcs` | `SubscribeReadings`, `SubscribeAlarms`, `SubscribeEquipmentState`, `SubscribeInvalidations` | `lib/iiot/rpc/RealtimeRpcs.ts` |

### DX.5.2 Schema-First API Design

All RPC inputs and outputs are defined via Effect Schema [EFFECT-SCHEMA].
This ensures:

1. **Runtime validation** — Every incoming RPC payload is validated against
   its Schema before handler execution. Invalid payloads produce a structured
   `ParseError` with path information.

2. **Type inference** — TypeScript types are inferred from Schema definitions,
   eliminating type drift between runtime validation and compile-time types.

3. **JSON Schema generation** — Every Schema produces a JSON Schema via
   `JSONSchema.make()`, used for OpenAPI documentation and client-side
   validation.

4. **Encode/decode transformations** — Schemas handle serialization concerns
   (e.g., `DateTimeUtc` to ISO string, `Option` to nullable) transparently.

**Normative example — Schema-driven RPC definition**:

```typescript
// From lib/iiot/rpc/SensorRpcs.ts:26-32
export const GetLatest = Rpc.make(SensorReadingGetLatestTag, {
  payload: Schema.Struct({
    deviceId: DeviceId,          // Branded string: /^DEV-[a-zA-Z0-9-]+$/
  }),
  success: Schema.OptionFromNullOr(SensorReading),
  error: RpcQueryError,          // Schema.TaggedError with _tag discriminator
})
```

**Normative example — Entity Schema with branded identifiers**:

```typescript
// From lib/iiot/schemas/assets/sensor/schema.ts:30-37
export const SensorId = Schema.String.pipe(
  Schema.pattern(/^SNS-[a-zA-Z0-9-]+$/),
  Schema.brand('SensorId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/SensorId',
    description: 'Sensor identifier with SNS- prefix',
  })
)
```

### DX.5.3 Error Schema Taxonomy

All RPC errors MUST use `Schema.TaggedError` from `lib/iiot/rpc/errors.ts`.
Error types are organized by domain:

| Error Class | Tag | Domain | Source |
|---|---|---|---|
| `RpcQueryError` | `RpcQueryError` | Generic query failure | `errors.ts:18` |
| `RpcGraphError` | `RpcGraphError` | Hierarchy graph failure | `errors.ts:24` |
| `RpcDeviceNotFoundError` | `RpcDeviceNotFoundError` | Sensor/device lookup | `errors.ts:33` |
| `RpcPlantNotFoundError` | `RpcPlantNotFoundError` | Plant lookup | `errors.ts:62` |
| `RpcMachineNotFoundError` | `RpcMachineNotFoundError` | Machine lookup | `errors.ts:54` |
| `RpcAlarmNotFoundError` | `RpcAlarmNotFoundError` | Alarm lookup | `errors.ts:79` |
| `RpcAlarmAlreadyAcknowledgedError` | `RpcAlarmAlreadyAcknowledgedError` | Alarm state conflict | `errors.ts:87` |
| `RpcAlarmAlreadyClearedError` | `RpcAlarmAlreadyClearedError` | Alarm state conflict | `errors.ts:95` |
| `RpcHierarchyError` | `RpcHierarchyError` | ISA-95 hierarchy failure | `errors.ts:70` |
| `RealtimeError` | `RealtimeError` | Subscription failure | `RealtimeRpcs.ts:31` |

---

## DX.6 Client Libraries

### DX.6.1 TypeScript/JavaScript (Primary): `@tmnl/client`

**Status**: Primary client. MUST be maintained in lockstep with `IIoTRpcs`.

**Architecture**:
- Generated from `IIoTRpcs` type definition
- Promise-based API wrapping Effect computations
- WebSocket transport with auto-reconnect (DX.4.4)
- AsyncIterable for all streaming RPCs
- Tree-shakeable — unused RPC groups are excluded by bundler

**Installation**:

```bash
bun add @tmnl/client
# or
npm install @tmnl/client
```

**Configuration**:

```typescript
import { TmnlClient } from '@tmnl/client'

const client = new TmnlClient({
  // Required
  endpoint: 'wss://api.tmnl.io/ws/iiot',
  token: '<api-token>',

  // Optional
  reconnect: {
    enabled: true,           // default: true
    maxRetries: Infinity,    // default: Infinity
    initialDelayMs: 1000,    // default: 1000
    maxDelayMs: 30000,       // default: 30000
  },
  serialization: 'json',    // default: 'json', future: 'msgpack'
  timeout: 30000,            // default: 30000ms per request
})
```

### DX.6.2 Python: `tmnl-py`

**Status**: Secondary client. RECOMMENDED for data science and ML integration.

**Architecture**:
- HTTP REST transport (WebSocket OPTIONAL)
- `asyncio`-native with `async/await` API
- Pydantic models generated from JSON Schema
- pandas DataFrame integration for time-series queries

**Example**:

```python
from tmnl import TmnlClient

client = TmnlClient(
    endpoint="https://api.tmnl.io",
    token=os.environ["TMNL_API_TOKEN"],
)

# Get sensor readings as DataFrame
readings = await client.sensors.query(
    device_id="DEV-temp-01",
    since=datetime(2026, 1, 1),
    until=datetime(2026, 2, 1),
)
df = readings.to_dataframe()  # pandas DataFrame
```

### DX.6.3 Rust: `tmnl-rs`

**Status**: Secondary client. RECOMMENDED for edge device firmware.

**Architecture**:
- MQTT/Sparkplug-B transport for telemetry publishing [SPARKPLUG-B]
- HTTP REST transport for device registration and management
- `no_std`-compatible core for embedded targets
- `tokio` async runtime for gateway applications

**Example**:

```rust
use tmnl::DeviceClient;

let client = DeviceClient::new(
    "mqtt://broker.tmnl.io:1883",
    &device_cert,
)?;

// Publish sensor reading via Sparkplug-B
client.publish_reading(Reading {
    device_id: "DEV-temp-01",
    metric_name: "motor_temperature",
    value: 72.5,
    unit: "celsius",
    timestamp: Utc::now(),
}).await?;
```

### DX.6.4 HTTP REST Fallback

For any language without a dedicated client library, the platform MUST
expose all request-response RPCs via HTTP REST endpoints.

| HTTP Method | Path Pattern | Corresponding RPC |
|---|---|---|
| `GET` | `/api/v1/plants` | `Plant.List` |
| `GET` | `/api/v1/plants/{plantId}` | `Plant.Get` |
| `GET` | `/api/v1/plants/{plantId}/hierarchy` | `PlantHierarchy.Get` |
| `POST` | `/api/v1/alarms/{alarmId}/acknowledge` | `Alarm.Acknowledge` |
| `GET` | `/api/v1/sensors/{deviceId}/latest` | `SensorReading.GetLatest` |
| `GET` | `/api/v1/sensors/{deviceId}/readings` | `SensorReading.Query` |
| `POST` | `/api/v1/work-orders` | `WorkOrder.Create` |

Streaming RPCs (e.g., `Realtime.SubscribeReadings`) are NOT available via
REST. Clients MUST use WebSocket for streaming subscriptions.

---

## DX.7 CLI Tools

### DX.7.1 `tmnl` CLI

The `tmnl` command-line tool MUST provide terminal-based access to platform
operations. It targets integration developers and hardware developers who
prefer terminal workflows over web dashboards.

**Installation**:

```bash
# Via npm/bun
bun add -g @tmnl/cli

# Via Nix
nix profile install github:gbg/tmnl#cli
```

### DX.7.2 Command Reference

#### Organization and Connection

```bash
# Initialize a new org connection (interactive wizard)
tmnl init

# Show current connection status
tmnl status

# List organizations the current token can access
tmnl orgs list
```

#### Device Management

```bash
# List registered devices
tmnl devices list

# Register a new device
tmnl devices register --name "Motor Temp Sensor" \
  --type temperature --unit celsius \
  --machine MCH-motor-01

# Provision TLS certificates for a device
tmnl devices provision DEV-temp-01 --output ./certs/

# Show device details and current state
tmnl devices show DEV-temp-01
```

#### Real-Time Monitoring

```bash
# Tail live sensor readings (streams to stdout)
tmnl stream readings --device DEV-temp-01

# Tail readings for all devices in a plant
tmnl stream readings --plant PLT-chicago-main

# Stream equipment state changes
tmnl stream equipment --entity-type Machine

# Stream alarm events, filtered by severity
tmnl stream alarms --min-severity critical
```

#### Alarm Management

```bash
# List active alarms
tmnl alarms list --status active

# Acknowledge an alarm
tmnl alarms ack ALM-001 --by "earl@machineshop.com"

# View alarm context (readings around trigger time)
tmnl alarms context ALM-001 --window 5m
```

#### Work Order Management

```bash
# List work orders by status
tmnl work-orders list --status in_progress

# Create a new work order
tmnl work-orders create --title "Replace motor bearing" \
  --machine MCH-motor-01 --priority high

# Advance work order state
tmnl work-orders submit WO-001
tmnl work-orders approve WO-001 --by "supervisor@plant.com"
tmnl work-orders start WO-001
tmnl work-orders complete WO-001
```

#### Diagnostics

```bash
# Test connection to platform
tmnl diagnostics connection-test

# Check device connectivity
tmnl diagnostics device-health DEV-temp-01

# Validate Sparkplug-B topic structure
tmnl diagnostics sparkplug-validate --namespace spBv1.0/MyOrg
```

### DX.7.3 Output Formats

The CLI MUST support multiple output formats:

| Flag | Format | Use Case |
|---|---|---|
| (default) | Human-readable table | Interactive terminal |
| `--json` | JSON | Script integration |
| `--csv` | CSV | Spreadsheet export |
| `--jsonl` | JSON Lines | Stream processing |

---

## DX.8 Documentation Strategy

### DX.8.1 Getting Started Guide

Implementations MUST provide a "zero to first data" guide that completes
in under 15 minutes. The guide MUST cover:

1. **Install CLI** (2 minutes): `bun add -g @tmnl/cli`
2. **Initialize connection** (1 minute): `tmnl init` (interactive wizard)
3. **Register a device** (2 minutes): `tmnl devices register ...`
4. **Publish a reading** (3 minutes): curl or Sparkplug-B example
5. **View live data** (2 minutes): `tmnl stream readings --device DEV-001`
6. **Acknowledge an alarm** (1 minute): `tmnl alarms ack ALM-001`

The guide MUST include copy-pasteable commands and expected output.

### DX.8.2 API Reference (Auto-Generated)

The API reference MUST be auto-generated from Effect Schema definitions.
For each RPC:

- **Request Schema**: JSON Schema with property descriptions, types, and
  constraints (patterns, ranges, enums)
- **Response Schema**: JSON Schema for success type
- **Error Schema**: JSON Schema for each error variant with `_tag`
  discriminator
- **Code example**: TypeScript (`@tmnl/client`) and curl

**Generation pipeline**:

```
Effect Schema → JSONSchema.make() → OpenAPI 3.1 Spec → Rendered docs
```

**Codebase proof**: Every schema in `lib/iiot/schemas/` uses
`Schema.annotations()` with `identifier` and `description` fields
(e.g., `lib/iiot/schemas/assets/sensor/schema.ts:33-36`). These
annotations propagate to the generated JSON Schema.

### DX.8.3 Tutorials by Persona

| Persona | Tutorial | Content |
|---|---|---|
| Operator (Earl) | "Your First Dashboard" | Web wizard, alarm ack, work order form |
| Integration Dev | "Connect Your MES" | REST API, WebSocket subscriptions, error handling |
| Integration Dev | "Build an Alerting Bot" | Subscribe to alarms, send Slack/email notifications |
| Platform Dev | "Custom Entity Type" | Schema.TaggedClass, Machine graph, Entity definition |
| Platform Dev | "Stream Processing Pipeline" | Stream.filter, Stream.aggregate, backpressure |
| Hardware Dev | "Sparkplug-B Device" | MQTT publish, topic structure, certificate setup |
| Hardware Dev | "Edge Gateway" | Rust client, batch publish, offline buffering |

### DX.8.4 Interactive Playground

The platform MUST provide a browser-based playground for testing WebSocket
subscriptions and RPC calls without writing code. The playground MUST:

1. Authenticate via browser session token
2. Provide a WebSocket test panel with subscription builder
3. Show real-time event stream with JSON syntax highlighting
4. Allow sending RPC requests with form-based payload editor
5. Display request/response timing and error details

### DX.8.5 Example Applications

The documentation MUST include complete, runnable example applications:

| Example | Language | Concepts |
|---|---|---|
| `examples/dashboard` | TypeScript + React | `@tmnl/client`, WebSocket subscription, live charts |
| `examples/alerting-bot` | TypeScript | `@tmnl/sdk`, `Stream.filter`, Slack webhook |
| `examples/capacity-monitor` | Python | `tmnl-py`, pandas, equipment state aggregation |
| `examples/edge-gateway` | Rust | `tmnl-rs`, Sparkplug-B publish, offline buffer |
| `examples/oee-calculator` | TypeScript | `@tmnl/sdk`, `EquipmentState.GetOee`, time-series |

---

## DX.9 Error Messages and Diagnostics

### DX.9.1 Structured Error Model

All platform errors MUST follow the structured error model:

```typescript
interface TmnlError {
  /** Machine-readable error code (TMNL-E-001 through TMNL-E-999) */
  code: string

  /** Error tag from Schema.TaggedError */
  _tag: string

  /** Human-readable message suitable for operator display */
  message: string

  /** Suggested remediation steps (1-3 sentences) */
  suggestion?: string

  /** Structured details (varies by error type) */
  details?: Record<string, unknown>

  /** Effect Cause trace (platform developers only, opt-in) */
  cause?: string
}
```

### DX.9.2 Error Code Registry

Error codes MUST follow the format `TMNL-E-{category}{number}`:

| Range | Category | Examples |
|---|---|---|
| `TMNL-E-1xx` | Authentication & Authorization | `TMNL-E-101`: Token expired, `TMNL-E-102`: Insufficient permissions |
| `TMNL-E-2xx` | Entity Not Found | `TMNL-E-201`: Device not found, `TMNL-E-202`: Alarm not found |
| `TMNL-E-3xx` | Validation | `TMNL-E-301`: Invalid payload, `TMNL-E-302`: Schema validation failed |
| `TMNL-E-4xx` | State Transition | `TMNL-E-401`: Invalid transition, `TMNL-E-402`: Alarm already acknowledged |
| `TMNL-E-5xx` | Subscription | `TMNL-E-501`: Subscription failed, `TMNL-E-502`: Rate limited |
| `TMNL-E-6xx` | Infrastructure | `TMNL-E-601`: Database unavailable, `TMNL-E-602`: Broker disconnected |
| `TMNL-E-7xx` | Hierarchy | `TMNL-E-701`: Hierarchy cycle detected, `TMNL-E-702`: Orphaned entity |
| `TMNL-E-8xx` | Work Order | `TMNL-E-801`: Approval required, `TMNL-E-802`: Compliance violation |
| `TMNL-E-9xx` | Reserved | Future expansion |

### DX.9.3 Error Message Quality Standards

Every error message MUST include:

1. **What happened** — Factual description of the failure
2. **Why it happened** — Root cause or context
3. **What to do** — Actionable next step

**Normative examples**:

```
TMNL-E-201: Device 'DEV-temp-01' not found.
  The device may not be registered or may belong to a different organization.
  Suggestion: Run `tmnl devices list` to see available devices, or
  `tmnl devices register` to add a new device.

TMNL-E-402: Alarm 'ALM-001' has already been acknowledged.
  Alarm was acknowledged by earl@machineshop.com at 2026-02-09T14:30:00Z.
  Suggestion: Use `tmnl alarms list --status acknowledged` to see acknowledged alarms.

TMNL-E-301: Invalid payload for WorkOrder.Create.
  Field 'priority' must be one of: 'low', 'medium', 'high', 'critical'.
  Received: 'urgent'.
  Suggestion: Check the API reference for valid WorkOrder.Create parameters.
```

### DX.9.4 Diagnostic Endpoint

Implementations MUST expose a diagnostic endpoint for connection testing:

```
POST /diagnostics/connection-test
Content-Type: application/json

{
  "checks": ["websocket", "database", "broker", "auth"]
}
```

Response:

```json
{
  "status": "partial",
  "checks": {
    "websocket": { "status": "ok", "latencyMs": 12 },
    "database": { "status": "ok", "latencyMs": 3 },
    "broker": { "status": "degraded", "latencyMs": 450, "message": "High latency to NATS cluster" },
    "auth": { "status": "ok", "latencyMs": 8 }
  },
  "timestamp": "2026-02-09T14:30:00Z"
}
```

---

## DX.10 Testing Support

### DX.10.1 `@tmnl/testing` Package

The testing package MUST provide mock implementations of all platform
services for integration testing without requiring a running backend.

**Architecture**:

```typescript
import { TestRunner, MockEntities, EventReplay } from '@tmnl/testing'
```

### DX.10.2 Mock Services

Mock services MUST replicate the behavior of the full entity lifecycle
including state machine validation.

**Normative example — testing alarm acknowledgment**:

```typescript
import { TestRunner } from '@tmnl/testing'
import { Effect } from 'effect'
import { AlarmEntity } from '@tmnl/sdk'

const runner = TestRunner.make({
  entities: [AlarmEntity],
  // Uses in-memory storage, no database required
})

// Create and acknowledge an alarm
const test = Effect.gen(function* () {
  const alarm = yield* runner.send(AlarmEntity, 'ALM-001', {
    _tag: 'Create',
    deviceId: 'DEV-temp-01',
    severity: 'critical',
    message: 'Motor temperature exceeded threshold',
  })

  yield* runner.send(AlarmEntity, 'ALM-001', {
    _tag: 'Acknowledge',
    acknowledgedBy: 'operator@plant.com',
  })

  const state = yield* runner.getState(AlarmEntity, 'ALM-001')
  expect(state.status).toBe('acknowledged')
})
```

**Codebase proof**: The test harness pattern mirrors `EntityTestingStack`
at `lib/iiot/entity/EntityStack.ts`, which provides `EntityHandlersLayer`
and `EntityProductionHandlersWithEvents` for composable test layers [EFFECT-LAYER].

### DX.10.3 Entity Test Harness

For platform developers creating custom entity types, the testing package
MUST provide a harness that validates:

1. **State machine transitions** — Every transition defined in the Machine
   graph is reachable and tested
2. **Invalid transition rejection** — Illegal state transitions produce
   appropriate errors
3. **Event sourcing** — Events are recorded and state is reconstructable
   from the event log
4. **Concurrent access** — Multiple simultaneous commands to the same
   entity are serialized correctly

### DX.10.4 Recorded Event Replay

The testing package MUST support replaying recorded production events
for regression testing:

```typescript
import { EventReplay } from '@tmnl/testing'

const replay = EventReplay.fromFile('./fixtures/alarm-cascade-2026-02-01.jsonl')

// Replay events at 10x speed
await replay.run({
  speed: 10,
  onEvent: (event) => {
    // Verify system behavior for each replayed event
  },
})
```

### DX.10.5 Sandbox Environment

Each developer MUST have access to an isolated sandbox environment:

| Feature | Sandbox Behavior |
|---|---|
| Data isolation | Separate NATS account per developer [NATS-ACCOUNTS] |
| Entity state | Ephemeral — reset on sandbox restart |
| Rate limits | Relaxed (10x production limits) |
| Retention | 24-hour data retention |
| Monitoring | Full observability (traces, metrics, logs) |

---

## DX.11 Codebase Grounding

This section maps DX concepts to existing implementations in the codebase.

### DX.11.1 RPC Definitions

| File | Role | Line Count |
|---|---|---|
| `lib/iiot/rpc/index.ts` | Barrel export, `IIoTRpcs` composition | 116 lines |
| `lib/iiot/rpc/SensorRpcs.ts` | Time-series query RPCs | 99 lines |
| `lib/iiot/rpc/AssetRpcs.ts` | ISA-95 hierarchy RPCs | 144 lines |
| `lib/iiot/rpc/AlarmRpcs.ts` | Alarm lifecycle + query RPCs | 154 lines |
| `lib/iiot/rpc/WorkOrderRpcs.ts` | Work order lifecycle RPCs | 36 lines |
| `lib/iiot/rpc/EquipmentStateRpcs.ts` | OEE tracking RPCs | ~50 lines |
| `lib/iiot/rpc/RealtimeRpcs.ts` | WebSocket streaming subscriptions | 192 lines |
| `lib/iiot/rpc/errors.ts` | Error schema taxonomy | 129 lines |
| `lib/iiot/rpc/PlantRpcs.ts` | Plant entity lifecycle | ~40 lines |
| `lib/iiot/rpc/LineRpcs.ts` | Line entity lifecycle | ~40 lines |
| `lib/iiot/rpc/WorkCellRpcs.ts` | WorkCell entity lifecycle | ~40 lines |
| `lib/iiot/rpc/MachineAssetRpcs.ts` | Machine entity lifecycle | ~40 lines |
| `lib/iiot/rpc/DeviceRpcs.ts` | Device entity lifecycle | ~40 lines |
| `lib/iiot/rpc/SensorAssetRpcs.ts` | Sensor asset lifecycle | ~40 lines |
| `lib/iiot/rpc/EnterpriseRpcs.ts` | Enterprise entity lifecycle | ~40 lines |
| `lib/iiot/rpc/SiteRpcs.ts` | Site entity lifecycle | ~40 lines |
| `lib/iiot/rpc/AreaRpcs.ts` | Area entity lifecycle | ~40 lines |

### DX.11.2 Entity Definitions

| File | Entity | Event Sourced | Source |
|---|---|---|---|
| `lib/iiot/entity/AlarmEntity.ts` | Alarm | YES — ISA-18.2 | `entity/index.ts:24-33` |
| `lib/iiot/entity/WorkOrderEntity.ts` | WorkOrder | YES — FDA 21 CFR Part 11 | `entity/index.ts:75-108` |
| `lib/iiot/entity/EquipmentStateEntity.ts` | EquipmentState | YES — OEE | `entity/index.ts:110-133` |
| `lib/iiot/entity/AssetEntity.ts` | Asset | NO — hierarchy queries | `entity/index.ts:35-53` |
| `lib/iiot/entity/SensorEntity.ts` | Sensor | NO — time-series reads | `entity/index.ts:55-73` |
| `lib/iiot/entity/EntityStack.ts` | Layer composition | N/A | `entity/index.ts:156-160` |

ISA-95 asset entities (Enterprise, Site, Area, Plant, Line, WorkCell, Machine,
Device, SensorAsset) are defined in individual files under `lib/iiot/entity/`
and composed in `EntityStack.EntityHandlersLayer` (`entity/index.ts:152-153`).

### DX.11.3 Schema Definitions

| Directory | Content | Example |
|---|---|---|
| `lib/iiot/schemas/assets/sensor/` | Sensor schema with `SensorId`, `SensorType`, `MeasurementUnit` | `schema.ts:203` — `Schema.TaggedClass<Sensor>()` |
| `lib/iiot/schemas/assets/device/` | Device schema with `DeviceId`, `DeviceStatus` | |
| `lib/iiot/schemas/assets/machine/` | Machine schema with `MachineId`, `MachineStatus` | |
| `lib/iiot/schemas/assets/plant/` | Plant schema with `PlantId`, `PlantStatus` | |
| `lib/iiot/schemas/assets/line/` | Line schema with `LineId`, `LineStatus` | |
| `lib/iiot/schemas/assets/workcell/` | WorkCell schema with `WorkCellId` | |
| `lib/iiot/schemas/assets/area/` | Area schema with `AreaId` | |
| `lib/iiot/schemas/assets/site/` | Site schema with `SiteId` | |
| `lib/iiot/schemas/assets/enterprise/` | Enterprise schema with `EnterpriseId` | |
| `lib/iiot/schemas/alarms/` | Alarm severity, lifecycle schemas | |
| `lib/iiot/schemas/readings/` | `SensorReading`, `AggregatedReading`, `TimeBucket` | |
| `lib/iiot/schemas/identifiers.ts` | Branded identifier types (`DeviceId`, `PlantId`, etc.) | |

### DX.11.4 Key Patterns for SDK Generation

The following codebase patterns are the foundation for SDK generation:

1. **RPC Group composition** (`lib/iiot/rpc/index.ts:91-112`):
   `IIoTRpcs = RpcGroup.make(...)` composing all sub-groups. The SDK client
   type is derived directly from this group definition.

2. **EntityProxy.toRpcGroup** (`lib/iiot/rpc/AlarmRpcs.ts:45`):
   Auto-generates entity lifecycle RPCs. The SDK MUST expose these with
   the same `${Entity}.${Operation}` naming convention.

3. **Schema.TaggedError** (`lib/iiot/rpc/errors.ts`):
   All RPC errors use tagged errors. The SDK MUST preserve `_tag`
   discriminators for pattern matching in client code.

4. **Stream RPCs** (`lib/iiot/rpc/RealtimeRpcs.ts:107-177`):
   All realtime RPCs use `stream: true`. The SDK MUST expose these as
   `Stream<A, E>` (Effect-native) or `AsyncIterable<A>` (Promise wrapper).

5. **Branded identifiers** (`lib/iiot/schemas/identifiers.ts`):
   All entity IDs use `Schema.brand()`. The SDK MUST preserve brand
   constraints in TypeScript types to prevent ID type confusion.

---


---

<!-- Source: rfc-section-onboarding-protocol.md -->
## 1. The 15-Minute SLA

### 1.1 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### 1.2 The Incumbent Onboarding Problem

Every IIoT platform in Section 7 (Competitive Differentiation) operates on a
model where onboarding requires weeks of professional services, five- to
six-figure capital expenditure, and specialized hardware [SIEMENS-INSIGHTS]
[TWX-ALWAYSON] [AVEVA-SP]. This creates a **participation floor** that excludes
99%+ of manufacturing organizations globally.

| Platform | Typical Onboarding | Minimum Cost | Requires |
|----------|-------------------|-------------|----------|
| Siemens MindSphere [SIEMENS-INSIGHTS] | 4-12 weeks | $100K+ (SI engagement) | MindConnect hardware + cloud subscription |
| PTC ThingWorx [TWX-ALWAYSON] | 2-8 weeks | $50K+ (license + SI) | Kepware license + ThingWorx server |
| AVEVA System Platform [AVEVA-SP] | 6-16 weeks | $200K+ | System Platform license + historian |
| Rockwell FactoryTalk [RA-PLEX] | 4-12 weeks | $100K+ | FactoryTalk license + PLC integration |
| GE Proficy [GEV-PROFICY-2025] | 4-8 weeks | $75K+ | Historian + APM modules |
| Ignition [IGN-PLATFORM] | 1-4 weeks | $5K+ (gateway license) | Ignition gateway + modules |
| AWS IoT SiteWise [AWS-SITEWISE] | 1-4 weeks | Variable (consumption) | AWS account + SiteWise model setup |
| Azure Digital Twins [AZURE-DT] | 2-8 weeks | Variable (consumption) | Azure account + DTDL modeling |

For Earl — a solo machinist with 3 machines and no IT staff — every platform
above is economically irrational. The cheapest option (Ignition at ~$5K/year)
exceeds what Earl would spend on monitoring all his equipment in a lifetime.

### 1.3 SLA Definition

**Onboarding SLA (O-1)**: The TMNL platform MUST enable the smallest participant
class (single-operator machine shop, no IT staff, consumer-grade internet) to
complete the following sequence in 15 minutes or less, measured from first
interaction with the signup page to first OEE score displayed:

1. Account creation
2. Edge agent installation
3. Device auto-discovery
4. First sensor readings ingested
5. Entity hierarchy created
6. Live dashboard rendered
7. First OEE score calculated

**Measurement**: The 15-minute window is measured by wall clock time from the
moment the user initiates signup (T+0:00) to the moment the OEE score is
rendered in the web dashboard. Network latency, download time, and device
discovery are included in this budget.

**Verification**: The platform SHOULD provide automated onboarding smoke tests
that verify the O-1 SLA against reference hardware (Raspberry Pi 4, 2GB RAM,
100 Mbps broadband) on each release.

### 1.4 Economic Rationale

The 15-minute SLA is not a marketing aspiration — it is a structural requirement
for the commons model [SHAPIRO-VARIAN] [DMC-COMMONS]. A manufacturing network
achieves value through network effects: each additional participant increases the
pool of available capacity, the accuracy of demand forecasts, and the coverage of
quality benchmarks. If onboarding requires weeks and thousands of dollars, the
network never reaches critical mass.

Formally: **network value V ~ n(n-1)/2** (Metcalfe's Law), where n is the number
of active participants. Every participant that bounces during a 4-week onboarding
process reduces V quadratically. The 15-minute SLA is the minimum viable
participation threshold to sustain network growth [MAAS-FRAMEWORK].

---

## 2. Onboarding Timeline Specification

### 2.1 The 15-Minute Timeline

The canonical onboarding sequence for the Sparkplug-B integration pattern (the
primary and fastest path):

```
T+0:00  — User opens signup page (web or mobile)
          ├── Name, email, organization name
          └── Single-click "Create Account"

T+1:00  — Account provisioned
          ├── NATS account created (operator-signed JWT) [NATS-DECENTRALIZED]
          ├── Organization entity initialized in cluster
          ├── Edge agent download URL generated
          └── QR code rendered (encodes: JWT, cloud NATS URL, org ID)

T+3:00  — Edge agent installed on workshop computer (or $50 SBC)
          ├── Single binary download (no Docker, no container runtime)
          ├── QR code scan configures agent (mobile camera → agent config)
          ├── NATS leaf node connection established [NATS-LEAFNODE]
          └── Agent health check: cloud connectivity confirmed

T+5:00  — Sparkplug-B auto-discovery detects equipment
          ├── Agent probes local network for MQTT brokers
          ├── Subscribes to spBv1.0/# (all Sparkplug namespaces)
          ├── NBIRTH messages register edge nodes (AliasRegistry) [SPARKPLUG-B]
          ├── DBIRTH messages register devices and metrics
          └── User sees "3 devices found" in onboarding wizard

T+8:00  — First sensor readings flowing
          ├── DDATA messages arrive with metric values
          ├── AliasRegistry resolves metric aliases to names
          ├── TopicRouter maps Sparkplug topics to device IDs
          ├── ReadingProcessor batches and validates readings
          └── IngestedReading instances emitted to pipeline

T+10:00 — Entity hierarchy created
          ├── Telescoping hierarchy: Organization > Machine > Sensor
          ├── Machine entities created from DBIRTH device metadata
          ├── Sensor entities created from DBIRTH metric metadata
          ├── State machines initialized (UNKNOWN → IDLE)
          └── Entity events begin flowing to ChannelService

T+12:00 — Live dashboard rendered
          ├── WebSocket connection established (RealtimeRpcs)
          ├── Subscription to equipment state stream
          ├── Subscription to readings stream (filtered by org)
          ├── Real-time sensor values rendering on dashboard
          └── Machine status indicators live (IDLE/RUNNING/FAULT)

T+15:00 — First OEE score displayed
          ├── EquipmentState entity has accumulated 15 min of state durations
          ├── OEE = Availability * Performance * Quality
          ├── Availability: time in RUNNING / total time (derived from state transitions)
          ├── Performance: actual output vs expected (from DDATA cycle counts if available)
          ├── Quality: good parts / total parts (from DDATA quality metrics if available)
          └── Dashboard shows "OEE: XX%" with 15-minute rolling window
```

### 2.2 Time Budget Allocation

| Phase | Duration | Budget | Critical Path |
|-------|----------|--------|---------------|
| Account provisioning | T+0:00 to T+1:00 | 1 min | JWT signing + NATS account creation |
| Agent installation | T+1:00 to T+3:00 | 2 min | Binary download + QR config |
| Device discovery | T+3:00 to T+5:00 | 2 min | Network probe + Sparkplug BIRTH |
| First readings | T+5:00 to T+8:00 | 3 min | DDATA processing pipeline |
| Entity creation | T+8:00 to T+10:00 | 2 min | Hierarchy scaffolding |
| Dashboard live | T+10:00 to T+12:00 | 2 min | WebSocket + stream subscription |
| OEE calculation | T+12:00 to T+15:00 | 3 min | State accumulation window |
| **Total** | **T+0:00 to T+15:00** | **15 min** | |

### 2.3 Slack Analysis

The OEE calculation at T+15:00 is the binding constraint. It requires at least
5 minutes of equipment state data to produce a meaningful score. The earlier
phases have slack:

- Account provisioning (1 min budget): NATS JWT signing is <100ms. Actual time
  dominated by user typing — budget generous.
- Agent installation (2 min budget): Binary download at 100 Mbps for a ~50MB
  agent takes <5s. Budget dominated by QR scan UX flow.
- Device discovery (2 min budget): Sparkplug BIRTH messages arrive within seconds
  of MQTT connection. Budget dominated by network probe if no MQTT broker
  pre-configured.

The binding constraint is **state accumulation time**: EquipmentState entities
need actual operational data to compute OEE. The 3-minute window from T+12 to
T+15 is the minimum for a rolling OEE with any statistical meaning.

---

## 3. Integration Patterns

TMNL supports four device integration patterns. Each provides a path to the
15-minute SLA, though with different protocol-specific timelines.

### 3.1 Pattern A: Sparkplug-B (Primary, Fastest)

**Target**: Organizations with Sparkplug-B-capable equipment or MQTT brokers.
This is the zero-configuration path.

**How it works**:

1. The TMNL edge agent subscribes to Sparkplug-B topics on the local MQTT broker
2. NBIRTH messages declare edge nodes; DBIRTH messages declare devices and metrics
3. The `AliasRegistry` (`lib/iiot/adapters/sparkplug-adapter.ts:79-111`) maps
   metric aliases to human-readable names from BIRTH payloads
4. DDATA messages flow continuously with metric values
5. The `SparkplugPipelineLayer` (`lib/iiot/adapters/ingestion-service.ts:297-322`)
   processes readings through TopicRouter, ReadingProcessor, and AlarmDetector

**Time to first data**: <5 minutes (limited by MQTT broker discovery)

**Required user action**: Connect edge agent to network. No manual device
configuration.

**Auto-discovery flow** (detailed in Section 5):
```
MQTT Broker ──NBIRTH──► AliasRegistry.registerBirth()
             ──DBIRTH──► Device entity creation + metric registration
             ──DDATA───► ReadingProcessor.process() → IngestedReading
             ──STATE───► StateRegistry.registerState() (host HA tracking)
```

### 3.2 Pattern B: OPC UA (Enterprise, Structured)

**Target**: Organizations with OPC UA servers (common in PLC-based automation).

**How it works**:

1. The edge agent runs an OPC UA client that discovers endpoints via mDNS or
   configured server URL [OPC-UA-14]
2. The OPC UA Browse service enumerates the address space (nodes, variables,
   references)
3. The agent maps OPC UA node IDs to TMNL sensor entities via namespace-based
   naming conventions
4. Subscriptions to MonitoredItems provide continuous data change notifications
5. Readings are normalized to the `IngestedReading` schema and enter the same
   pipeline as Sparkplug-B data

**Time to first data**: 5-10 minutes (OPC UA Browse + subscription setup)

**Required user action**: Provide OPC UA server URL (or enable mDNS). May need
to configure security policy (Anonymous, Username, Certificate).

**Mapping rule**: OPC UA node IDs map to TMNL entity IDs:
```
OPC UA:   ns=2;s=PLC1.Motor1.Temperature
TMNL:     Sensor { deviceId: "PLC1-Motor1-Temperature", machineId: "PLC1-Motor1" }
```

### 3.3 Pattern C: REST/HTTP (Cloud-Native, Pull-Based)

**Target**: Organizations with cloud-hosted data or REST APIs (e.g., existing
SCADA systems with web APIs, cloud historian exports).

**How it works**:

1. The edge agent polls configured REST endpoints at a configurable interval
2. Response payloads are parsed via user-defined JSON path mappings
3. Readings are normalized to `IngestedReading` and enter the pipeline
4. The polling interval maps to the T1 temporal tier budget (<100ms local)

**Time to first data**: 3-8 minutes (depends on API configuration complexity)

**Required user action**: Provide API URL, authentication credentials, JSON path
mapping for sensor values. More configuration than Sparkplug-B but no local
hardware changes.

**Configuration schema** (conceptual):
```typescript
Schema.Struct({
  url: Schema.String,                    // REST endpoint URL
  method: Schema.Literal('GET', 'POST'), // HTTP method
  pollIntervalMs: Schema.Number,         // Polling interval in milliseconds
  auth: Schema.optional(Schema.Union(
    Schema.Struct({ type: Schema.Literal('bearer'), token: Schema.String }),
    Schema.Struct({ type: Schema.Literal('basic'), username: Schema.String, password: Schema.String }),
  )),
  mappings: Schema.Array(Schema.Struct({
    jsonPath: Schema.String,             // JSONPath to sensor value
    deviceId: Schema.String,             // Target TMNL device ID
    metricName: Schema.String,           // Metric name (temperature, vibration, etc.)
    unit: Schema.String,                 // Unit of measurement
  })),
})
```

### 3.4 Pattern D: NATS Direct (Platform-Native, Lowest Latency)

**Target**: Custom integrations, inter-system bridges, or organizations building
directly on the TMNL platform.

**How it works**:

1. The client publishes directly to NATS subjects following the TMNL topic schema
2. Messages use the `IngestedReading` schema encoded as JSON or MessagePack
3. No adapter layer — readings enter the pipeline directly
4. Lowest possible latency (single NATS publish to subscriber)

**Time to first data**: <3 minutes (no device discovery needed)

**Required user action**: Write code using NATS client SDK. Requires developer
skill. The SDK provides typed helpers for constructing valid readings.

**Topic pattern**:
```
iiot.readings.{orgId}.{deviceId}.{metricName}
```

### 3.5 Pattern Selection Matrix

| Criterion | Sparkplug-B (A) | OPC UA (B) | REST (C) | NATS Direct (D) |
|-----------|----------------|-----------|---------|-----------------|
| **Setup time** | <5 min | 5-10 min | 3-8 min | <3 min |
| **Configuration** | Zero (auto-discovery) | Server URL + security | URL + auth + mappings | Code (SDK) |
| **User skill required** | None | Basic IT | API familiarity | Developer |
| **Equipment requirement** | MQTT broker | OPC UA server | REST API | NATS client |
| **Discovery** | Automatic (BIRTH) | Automatic (Browse) | Manual (JSON paths) | Manual (topics) |
| **Bidirectional** | Yes (DCMD) | Yes (Write) | Limited (POST) | Yes (request/reply) |
| **Offline support** | Yes (local MQTT) | Yes (local OPC UA) | Depends on API | Yes (edge NATS) |
| **Recommended for** | Most organizations | PLC-heavy factories | Cloud integrations | Custom/advanced |

---

## 4. Edge Agent Bootstrap Sequence

### 4.1 Agent Architecture

The TMNL edge agent is a single self-contained binary that runs on the
organization's local network. It requires no container runtime, no JVM, no
external dependencies.

**Minimum hardware**: ARM64 or x86_64, 512MB RAM, 1GB disk (agent + local
JetStream storage). Reference platform: Raspberry Pi 4 (2GB, $50) or any
existing workshop computer.

**Binary composition**:

```
tmnl-agent (single binary, ~50MB)
├── Embedded NATS server + JetStream (local domain)
├── Protocol adapters (Sparkplug-B, OPC UA, REST, NATS)
├── Effect runtime (entity processing, alarm detection)
├── Local web server (onboarding wizard + dashboard)
└── Configuration store (NATS KV, bucket: agent-config)
```

### 4.2 Bootstrap Flow

The bootstrap flow is designed to minimize user decisions. The agent MUST boot
to a functional state with a single credential input (QR code or JWT file).

```
Step 1: Agent binary downloaded and executed
        ├── Agent starts embedded NATS server (local domain)
        ├── Agent serves onboarding wizard at http://localhost:8080
        └── Agent enters BOOTSTRAP state

Step 2: Credential provisioning (one of):
        ├── (a) QR code scan: mobile camera → agent web page
        │       QR encodes: { jwt: "...", cloudUrl: "nats://...", orgId: "..." }
        ├── (b) JWT file: user places .jwt file in agent config directory
        └── (c) Manual entry: user types cloud URL + paste JWT in wizard UI

Step 3: Cloud connection
        ├── Agent configures leaf node with JWT credentials [NATS-LEAFNODE]
        ├── TLS connection to cloud NATS cluster established
        ├── Leaf node routes configured per account export/import rules [NATS-ACCOUNTS]
        ├── Agent reports ONLINE to cloud (STATE topic heartbeat) [SPARKPLUG-B]
        └── Agent transitions BOOTSTRAP → CONNECTED state

Step 4: Protocol discovery
        ├── Agent probes local network for MQTT brokers (mDNS + port scan)
        ├── Agent probes for OPC UA servers (mDNS discovery endpoint)
        ├── If MQTT found: subscribe to spBv1.0/# (Sparkplug-B auto-discovery)
        ├── If OPC UA found: browse server address space
        ├── If neither found: prompt user for manual configuration
        └── Agent transitions CONNECTED → DISCOVERING state

Step 5: Device registration
        ├── Discovered devices presented in onboarding wizard
        ├── User confirms device names and assignments (or accepts defaults)
        ├── Entity hierarchy created (Organization > Machine > Sensor)
        ├── Pipeline starts: readings → processing → entity state updates
        └── Agent transitions DISCOVERING → OPERATIONAL state

Step 6: Live data
        ├── Dashboard shows real-time sensor values
        ├── Equipment state indicators live (IDLE/RUNNING/FAULT)
        ├── Alarm thresholds configured (defaults from equipment type or manual)
        └── OEE score appears after sufficient state accumulation
```

### 4.3 Agent State Machine

The edge agent operates as a state machine with the following states and
transitions:

```
             ┌────────────┐
             │  BOOTSTRAP  │──── credential provisioned ────►┌─────────────┐
             └────────────┘                                  │  CONNECTED   │
                    ▲                                        └──────┬──────┘
                    │                                               │
            cloud lost + no                             protocol discovery
            local config                                   complete
                    │                                               │
                    │                                               ▼
             ┌──────┴─────┐                                ┌──────────────┐
             │  DEGRADED   │◄───── cloud connectivity ─────│ DISCOVERING  │
             └──────┬─────┘       lost                     └──────┬───────┘
                    │                                              │
                    │                                        devices found +
            cloud restored                                  user confirmed
                    │                                              │
                    ▼                                              ▼
             ┌─────────────┐                               ┌──────────────┐
             │ RECONNECTING │───── sync complete ─────────►│ OPERATIONAL  │
             └─────────────┘                               └──────────────┘
                                                                  │
                                                            cloud lost
                                                                  │
                                                                  ▼
                                                           ┌──────────────┐
                                                           │  AUTONOMOUS  │
                                                           └──────────────┘
                                                                  │
                                                            cloud restored
                                                                  │
                                                                  ▼
                                                           ┌──────────────┐
                                                           │ RECONNECTING │
                                                           └──────────────┘
```

| State | Behavior | UI Indicator |
|-------|----------|-------------|
| BOOTSTRAP | Awaiting credentials. No data processing. | Setup wizard |
| CONNECTED | Cloud link active. No devices discovered yet. | "Scanning..." |
| DISCOVERING | Probing local network for equipment. | Device list populating |
| OPERATIONAL | Full operation. Cloud + local data flowing. | Green status |
| AUTONOMOUS | Cloud link lost. Local operations continue per E-3. | Yellow "Offline" |
| RECONNECTING | Cloud link restored. Reconciliation in progress per X.7. | Blue "Syncing" |
| DEGRADED | Partial failure (e.g., adapter error, local NATS issue). | Orange warning |

### 4.4 Offline-First Guarantee

Per Edge Sovereignty Rule E-1 (see Edge-First Architecture section), the agent
MUST function fully in AUTONOMOUS state. Specifically:

- Sensor readings: buffered in local JetStream (7-day minimum retention)
- Alarm detection: runs locally via AlarmDetector in SparkplugPipelineLayer
- Entity state transitions: processed locally by Effect runtime
- Operator dashboard: served from local web server at http://localhost:8080
- Work order lifecycle: managed locally, synced on reconnection

The only capabilities degraded during AUTONOMOUS operation:
- Cross-organization marketplace visibility (T3 events)
- Network-level analytics (T4 events)
- Long-term archival beyond local storage capacity
- Remote access from outside the organization's network

---

## 5. Sparkplug-B Auto-Discovery Flow

### 5.1 Protocol Overview

Sparkplug-B [SPARKPLUG-B] defines a session lifecycle that enables zero-config
device discovery. The TMNL edge agent exploits this by subscribing to all
Sparkplug namespaces and building the entity hierarchy automatically from BIRTH
messages.

### 5.2 BIRTH Message Processing

The `SparkplugAdapter` (`lib/iiot/adapters/sparkplug-adapter.ts`) processes three
types of BIRTH messages:

**NBIRTH (Node Birth)**:
- Topic: `spBv1.0/{groupId}/NBIRTH/{edgeNodeId}`
- Announces an edge node (e.g., a PLC gateway)
- Carries all metrics the node itself reports
- The `AliasRegistry.registerBirth()` method (`sparkplug-adapter.ts:84-96`) maps
  numeric aliases to human-readable metric names

**DBIRTH (Device Birth)**:
- Topic: `spBv1.0/{groupId}/DBIRTH/{edgeNodeId}/{deviceId}`
- Announces a device under an edge node (e.g., a specific machine)
- Carries all metrics the device reports (temperature, vibration, speed, etc.)
- Each metric includes: name, alias (numeric shorthand), datatype, and optionally
  engineering units and description

**STATE (Host Application State)**:
- Topic: `spBv1.0/STATE/{hostAppId}`
- Announces host application ONLINE/OFFLINE status (SCADA primary/standby)
- The `parseStateTopic()` function (`sparkplug-adapter.ts:125-132`) extracts the
  host application ID
- The `StateRegistry` or `StateRegistryKV` tracks HA state transitions

### 5.3 From BIRTH to Entity Hierarchy

The onboarding wizard translates Sparkplug-B BIRTH metadata into the TMNL
entity hierarchy:

```
Sparkplug-B BIRTH Messages          TMNL Entity Hierarchy
─────────────────────────           ──────────────────────

NBIRTH: groupId="workshop"          Organization: "Earl's Precision Machining"
        edgeNodeId="plc-gateway"         │
                                         │
DBIRTH: deviceId="cnc-1"           ──────┼──► Machine: "CNC-1"
        metrics: [                       │        │
          { name: "SpindleTemp",         │        ├── Sensor: "SpindleTemp" (celsius)
            alias: 0,                    │        └── Sensor: "Vibration" (mm/s)
            datatype: Float },           │
          { name: "Vibration",           │
            alias: 1,                    │
            datatype: Float }            │
        ]                                │
                                         │
DBIRTH: deviceId="lathe-1"        ───────┼──► Machine: "Lathe-1"
        metrics: [                       │        │
          { name: "BearingTemp",         │        └── Sensor: "BearingTemp" (celsius)
            alias: 0,                    │
            datatype: Float }            │
        ]                                │
```

**Mapping rules**:

| Sparkplug-B Field | TMNL Entity Field | Notes |
|-------------------|-------------------|-------|
| `groupId` | Organization context | Groups devices under one org |
| `edgeNodeId` | Edge agent reference | The gateway device |
| `deviceId` | `Machine.id` | Prefixed with org context |
| `metric.name` | `Sensor.type` / `Sensor.deviceId` | Human-readable metric name |
| `metric.datatype` | Inferred unit/type | Mapped via engineering units if present |
| `metric.alias` | Internal (AliasRegistry) | Used for DDATA decoding efficiency |

### 5.4 Alias Registry Lifecycle

The `AliasRegistry` (`sparkplug-adapter.ts:79-111`) maintains metric alias
mappings that are essential for high-throughput data processing:

1. **On NBIRTH/DBIRTH**: `registerBirth(nodeKey, metrics)` builds alias→name
   HashMap for the edge node
2. **On DDATA**: `resolveAlias(nodeKey, alias)` converts numeric alias to metric
   name. This avoids transmitting full metric names in every DDATA message
   (Sparkplug-B optimization for bandwidth)
3. **On NDEATH**: `clearNode(nodeKey)` removes all alias mappings for the dead
   node. Next NBIRTH will re-register

The registry is keyed by `${groupId}:${edgeNodeId}` (the `NodeKey` type at
`sparkplug-adapter.ts:74`). This ensures alias scoping per edge node — two
different PLCs can use alias `0` for different metrics without collision.

---

## 6. Progressive Complexity Model

### 6.1 Design Principle

The platform MUST NOT require organizations to understand ISA-95 hierarchy,
effect-atom state management, or NATS subject semantics during onboarding. These
concepts are introduced progressively as the organization's needs grow.

**Progressive Disclosure Rule (O-2)**: The platform MUST present the minimum
viable interface at each complexity tier. Advanced features MUST be accessible
but not required.

### 6.2 Three Complexity Tiers

#### Tier 1: Earl (Solo Operator, 1-5 Machines)

**ISA-95 depth**: 3 levels (Organization > Machine > Sensor)

**What Earl sees**:
- "My Machines" list with live status (IDLE/RUNNING/FAULT)
- Sensor readings as simple line charts
- Alarms as push notifications to phone
- OEE score per machine (single number)

**What is hidden**:
- ISA-95 hierarchy levels (Site, Area, Line, WorkCell)
- NATS subjects and JetStream consumers
- Entity event sourcing and replay
- Cross-org marketplace features

**Onboarding time**: 15 minutes (target SLA)

**Monthly cost**: $0-10 (freemium tier, consumption-based)

#### Tier 2: Mid-Market (10-100 Machines, 1-3 Facilities)

**ISA-95 depth**: 5-6 levels (Enterprise > Site > Area > Line > Machine > Sensor)

**What is revealed at this tier**:
- Multi-site views with hierarchy navigation
- Production line status rollups (cascade from machine states)
- Alarm routing rules (by area, by shift, by severity)
- Work order management integrated with equipment state
- Quality metrics and defect tracking
- Multi-user access with role-based permissions

**Additional integration patterns**: OPC UA auto-discovery, REST API bridges

**Onboarding time**: 30-60 minutes (more devices, more configuration)

**Monthly cost**: $50-500 (based on device count and storage)

#### Tier 3: Enterprise (100+ Machines, Multiple Facilities, Supply Chain)

**ISA-95 depth**: 7-9 levels (full ISA-95 + extensions)

**What is revealed at this tier**:
- Cross-organization marketplace participation
- Capacity sharing and job routing
- Supply chain visibility (selective disclosure per Section 5.4 of
  Competitive Differentiation)
- Fleet-level analytics (T4 events)
- Custom entity types and extended schemas
- API access (NATS Direct pattern) for custom integrations
- Audit trails and regulatory compliance features

**Additional integration patterns**: NATS Direct, custom adapters, ERP bridges

**Onboarding time**: 1-5 days (enterprise integration, SSO, compliance review)

**Monthly cost**: Custom (based on entity count, storage, API calls)

### 6.3 Tier Transition Rules

| Transition | Trigger | User Action Required |
|------------|---------|---------------------|
| Tier 1 → Tier 2 | User adds second facility OR exceeds 10 machines | Hierarchy restructuring wizard |
| Tier 2 → Tier 3 | User enables marketplace OR exceeds 100 machines | Account upgrade + compliance review |
| Tier N → Tier N-1 | Voluntary downgrade | Entity consolidation wizard |

**Non-Breaking Rule (O-3)**: Tier transitions MUST NOT require data migration,
re-onboarding, or service interruption. The telescoping hierarchy (Section 7)
ensures that intermediate ISA-95 levels can be inserted into an existing
hierarchy without modifying existing entity IDs or breaking event history.

---

## 7. Telescoping Hierarchy at Onboarding

### 7.1 The Problem

ISA-95 defines 9 hierarchy levels (Enterprise > Site > Area > Plant > Line >
WorkCell > Machine > Device > Sensor). Requiring Earl to model all 9 levels
during onboarding would violate the 15-minute SLA and confuse a user who just
wants to see his CNC temperature.

### 7.2 The Solution: Collapsed Levels

The TMNL schema supports **all 9 levels** (`lib/iiot/schemas/assets/*/schema.ts`)
but only **requires 3** at onboarding:

```
FULL ISA-95 (9 levels)          EARL'S ONBOARDING (3 levels)
──────────────────────          ──────────────────────────────

Enterprise ─────────┐           Organization ──────────────────
  Site ─────────────┤             (= Enterprise + Site + Plant)
    Area ───────────┤                     │
      Plant ────────┤                     │
        Line ───────┤             Machine ────────────────────
          WorkCell ──┤              (= Machine + Device)
            Machine ─┤                    │
              Device ┤             Sensor ─────────────────────
                Sensor              (= Sensor)
```

At onboarding, the system creates:
- One Organization entity (collapsing Enterprise + Site + Area + Plant)
- One Machine entity per discovered device (collapsing Machine + Device)
- One Sensor entity per discovered metric (1:1 mapping)

### 7.3 Hierarchy Expansion

When Earl grows from 3 machines to 30 across two workshops, Tier 2 features
unlock and the hierarchy **telescopes** without breaking existing entities:

```
BEFORE (Tier 1):                    AFTER (Tier 2):

Organization: "Earl's"              Enterprise: "Earl's Precision Machining"
  Machine: "CNC-1"                    Site: "Main Workshop"
    Sensor: "SpindleTemp"                Machine: "CNC-1"          ← same entity ID
    Sensor: "Vibration"                    Sensor: "SpindleTemp"   ← same entity ID
  Machine: "Lathe-1"                       Sensor: "Vibration"     ← same entity ID
    Sensor: "BearingTemp"              Machine: "Lathe-1"          ← same entity ID
                                         Sensor: "BearingTemp"    ← same entity ID
                                    Site: "New Workshop"
                                       Machine: "CNC-2"           ← new entity
                                         Sensor: "SpindleTemp"    ← new entity
```

**Expansion rule**: When intermediate levels are inserted, existing entities
retain their IDs, event history, and state machine positions. The new parent-
child relationships are established by updating the `parentId` field — the
entity's event log records the hierarchy change as an `EntityUpdated` event,
preserving full audit trail.

### 7.4 Codebase Support

All 9 ISA-95 asset schemas exist in the codebase:

| ISA-95 Level | Schema File | Entity File |
|-------------|-------------|-------------|
| Enterprise | `lib/iiot/schemas/assets/enterprise/schema.ts` | `lib/iiot/entity/EnterpriseEntity.ts` |
| Site | `lib/iiot/schemas/assets/site/schema.ts` | `lib/iiot/entity/SiteEntity.ts` |
| Area | `lib/iiot/schemas/assets/area/schema.ts` | `lib/iiot/entity/AreaEntity.ts` |
| Plant | `lib/iiot/schemas/assets/plant/schema.ts` | `lib/iiot/entity/PlantEntity.ts` |
| Line | `lib/iiot/schemas/assets/line/schema.ts` | `lib/iiot/entity/LineEntity.ts` |
| WorkCell | `lib/iiot/schemas/assets/workcell/schema.ts` | `lib/iiot/entity/WorkCellEntity.ts` |
| Machine | `lib/iiot/schemas/assets/machine/schema.ts` | `lib/iiot/entity/MachineAssetEntity.ts` |
| Device | `lib/iiot/schemas/assets/device/schema.ts` | `lib/iiot/entity/DeviceEntity.ts` |
| Sensor | `lib/iiot/schemas/assets/sensor/schema.ts` | `lib/iiot/entity/SensorAssetEntity.ts` |

The `EntityStack` (`lib/iiot/entity/EntityStack.ts`) composes all entity handler
layers via `Layer.mergeAll`. This means all 9 levels are always available in the
runtime — the telescoping behavior is a UX-level abstraction, not a runtime
limitation.

---

## 8. First-Run Experience Specification

### 8.1 Onboarding Wizard Flow

The onboarding wizard runs as a local web application served by the edge agent.
It guides the user through 5 screens:

**Screen 1: Welcome & Credential Input**
```
┌─────────────────────────────────────────────┐
│  Welcome to TMNL                            │
│                                             │
│  Scan the QR code from your signup email    │
│  to connect this device to your account.    │
│                                             │
│  [QR Scanner]    [Or enter manually ▼]      │
│                                             │
│  Status: Waiting for credentials...         │
└─────────────────────────────────────────────┘
```

**Screen 2: Connection Status**
```
┌─────────────────────────────────────────────┐
│  Connecting...                              │
│                                             │
│  ✓ Credentials accepted                     │
│  ✓ Cloud connection established             │
│  ○ Scanning for equipment...                │
│                                             │
│  [Cancel]                                   │
└─────────────────────────────────────────────┘
```

**Screen 3: Device Discovery**
```
┌─────────────────────────────────────────────┐
│  Equipment Found                            │
│                                             │
│  ✓ CNC-1 (3 sensors: SpindleTemp,          │
│           Vibration, SpindleSpeed)          │
│  ✓ Lathe-1 (1 sensor: BearingTemp)         │
│  ✓ Mill-1 (2 sensors: TableTemp, Load)     │
│                                             │
│  [Edit Names]    [Accept & Continue ►]      │
└─────────────────────────────────────────────┘
```

**Screen 4: Data Flowing**
```
┌─────────────────────────────────────────────┐
│  Live Data                                  │
│                                             │
│  CNC-1                                      │
│    SpindleTemp: 24.3°C  ████░░░░  (OK)     │
│    Vibration:   0.8mm/s ██░░░░░░  (OK)     │
│    SpindleSpeed: 0 RPM              (IDLE)  │
│                                             │
│  Lathe-1                                    │
│    BearingTemp: 22.1°C  ███░░░░░  (OK)     │
│                                             │
│  [Configure Alarms]    [Go to Dashboard ►]  │
└─────────────────────────────────────────────┘
```

**Screen 5: Dashboard Handoff**
```
┌─────────────────────────────────────────────┐
│  You're live!                               │
│                                             │
│  Your dashboard is ready at:                │
│  http://localhost:8080/dashboard             │
│                                             │
│  Or scan this QR code on your phone:        │
│  [QR Code → dashboard URL]                  │
│                                             │
│  OEE will appear after ~5 minutes of data.  │
│                                             │
│  [Open Dashboard ►]                         │
└─────────────────────────────────────────────┘
```

### 8.2 Wizard Design Principles

| Principle | Implementation |
|-----------|----------------|
| **No jargon** | "Equipment" not "ISA-95 Level 3 entities". "Sensors" not "Control Modules". |
| **Defaults over choices** | Auto-discovered device names are pre-filled. Alarm thresholds use equipment-type defaults. |
| **Show, don't configure** | Screen 4 shows live data before any configuration. User sees value before investing effort. |
| **Mobile-first** | All screens work on a phone browser (agent serves responsive web). QR codes for zero-typing setup. |
| **Reversible** | Every auto-generated name and threshold can be changed later. No onboarding decision is permanent. |

### 8.3 Default Alarm Configuration

During onboarding, the system applies default alarm thresholds based on
sensor type. These are conservative defaults that avoid false positives:

| Sensor Type | Default Threshold High | Default Threshold Critical | Source |
|-------------|----------------------|--------------------------|--------|
| Temperature (general) | 60°C / 140°F | 80°C / 176°F | Industry norms |
| Vibration (mm/s) | 4.5 mm/s | 7.1 mm/s | ISO 10816-3 |
| Humidity (%) | 70% | 85% | General guidance |
| Pressure (bar) | Equipment-specific | Equipment-specific | No safe default |
| Speed (RPM) | Equipment-specific | Equipment-specific | No safe default |
| Current (A) | Nameplate * 1.15 | Nameplate * 1.25 | NEC 430.6 |

The user MAY override any default during or after onboarding. Equipment-specific
thresholds (pressure, speed) require user input — the wizard prompts for these
only if the sensor type is detected.

---

## 9. Protocol-Specific Onboarding Timelines

### 9.1 Sparkplug-B Path (Reference Implementation)

| Step | Time | Action | System Component |
|------|------|--------|------------------|
| 1 | T+0:00 | User clicks "Create Account" | Signup service |
| 2 | T+0:15 | NATS JWT signed, account created | Provisioning service |
| 3 | T+0:30 | QR code displayed with credentials | Web frontend |
| 4 | T+1:00 | Agent binary downloaded (50MB @ 100Mbps) | CDN |
| 5 | T+1:30 | Agent started, QR scanned | Edge agent |
| 6 | T+2:00 | NATS leaf node connected to cloud | Edge NATS [NATS-LEAFNODE] |
| 7 | T+2:30 | MQTT broker discovered on local network | mDNS probe |
| 8 | T+3:00 | Sparkplug-B subscription active | SparkplugAdapter |
| 9 | T+3:30 | NBIRTH received, edge node registered | AliasRegistry |
| 10 | T+4:00 | DBIRTH received, devices + metrics discovered | Entity creation |
| 11 | T+5:00 | Onboarding wizard shows discovered devices | Local web UI |
| 12 | T+5:30 | User accepts defaults, pipeline starts | SparkplugPipelineLayer |
| 13 | T+6:00 | First DDATA processed, readings flowing | ReadingProcessor |
| 14 | T+7:00 | Entity state machines processing transitions | Machine actors |
| 15 | T+8:00 | WebSocket stream established | RealtimeRpcs |
| 16 | T+9:00 | Dashboard rendering live sensor data | Web frontend |
| 17 | T+14:00 | 5 minutes of state data accumulated | EquipmentState entity |
| 18 | T+15:00 | First OEE score calculated and displayed | Dashboard |

### 9.2 OPC UA Path

| Step | Time | Action | Delta from Sparkplug-B |
|------|------|--------|----------------------|
| 1-6 | T+0:00 to T+2:00 | Same as Sparkplug-B | None |
| 7 | T+2:30 | OPC UA server discovered (mDNS) or URL entered | +0 to +2 min (user input) |
| 8 | T+3:00 | Security policy negotiated (may require user input) | +0 to +3 min |
| 9 | T+4:00 | OPC UA Browse enumerates address space | +0.5 min (browse traversal) |
| 10 | T+5:00 | Nodes mapped to TMNL entities | Same |
| 11-18 | T+5:00 to T+18:00 | Same as Sparkplug-B steps 11-18 | +3 min total |

**Total**: 15-18 minutes. Exceeds SLA only if security policy requires
manual certificate exchange.

### 9.3 REST Path

| Step | Time | Action | Delta from Sparkplug-B |
|------|------|--------|----------------------|
| 1-6 | T+0:00 to T+2:00 | Same as Sparkplug-B | None |
| 7 | T+3:00 | User enters REST API URL + credentials | +2 min (manual) |
| 8 | T+5:00 | User configures JSON path mappings | +3 min (manual) |
| 9 | T+6:00 | Test request validates configuration | +0.5 min |
| 10-18 | T+6:00 to T+20:00 | Same pipeline flow as Sparkplug-B | +5 min total |

**Total**: 18-20 minutes. Exceeds 15-minute SLA due to manual configuration.
Acceptable for this pattern's target audience (cloud integrations).

### 9.4 NATS Direct Path

| Step | Time | Action | Delta from Sparkplug-B |
|------|------|--------|----------------------|
| 1-3 | T+0:00 to T+1:00 | Account provisioned, credentials received | Same |
| 4 | T+1:00 | Developer writes NATS publish code using SDK | Variable (developer skill) |
| 5 | T+2:00 | First reading published to NATS subject | Fastest raw path |
| 6 | T+2:30 | Entity created from reading metadata | -7.5 min (no discovery) |
| 7-18 | T+3:00 to T+10:00 | Pipeline + dashboard + OEE | -5 min total |

**Total**: <10 minutes (for developers). Fastest path but requires code.

---

## 10. Failure Modes During Onboarding

### 10.1 Common Failure Scenarios

| Failure | Detection | User Impact | Recovery |
|---------|-----------|-------------|----------|
| **No MQTT broker found** | mDNS + port scan timeout (30s) | Wizard shows "No equipment found" | Manual broker URL entry, or switch to OPC UA/REST pattern |
| **MQTT broker found but no Sparkplug** | Connected but no BIRTH messages (60s) | "Broker connected, waiting for devices..." | Verify Sparkplug-B firmware on PLCs. Offer MQTT raw topic fallback. |
| **JWT expired or invalid** | NATS connection refused | "Could not connect to cloud" | Re-scan QR code. Contact support for new JWT. |
| **Cloud unreachable** | TCP timeout on leaf node connection | Agent enters AUTONOMOUS mode | All local features work. Cloud features resume on reconnection. |
| **Slow internet** | Download taking > 2 minutes | Progress bar on agent download | Resume-capable download. Offer USB sideload alternative. |
| **Port conflict** | Agent port 8080 already in use | "Could not start wizard" | Auto-select alternative port. Show URL in terminal output. |
| **Insufficient disk** | JetStream storage init fails | "Not enough storage" | Minimum 1GB required. Offer reduced retention (1 day vs 7 day). |
| **Device discovery partial** | Some devices respond, others don't | Some machines missing from wizard | "Add manually" button in wizard. Retry discovery. |

### 10.2 Onboarding Timeout Handling

If the user does not complete onboarding within 30 minutes (2x the SLA), the
agent SHOULD:

1. Save current progress to NATS KV (`agent-config` bucket)
2. Display a "Resume Later" option with a QR code for the progress URL
3. Enter OPERATIONAL state with whatever devices were already discovered
4. Allow the user to add remaining devices later via the settings UI

The system MUST NOT discard discovered devices or readings if onboarding is
abandoned mid-flow. Any data collected during the aborted onboarding MUST be
preserved and available when the user returns.

### 10.3 Degraded Onboarding Mode

If the edge agent cannot reach the cloud during initial setup (e.g., air-gapped
network), a degraded onboarding mode MUST be available:

1. Agent starts with local-only configuration (no cloud JWT required)
2. Device discovery and entity creation work locally
3. Dashboard serves from local web server
4. Cloud connection can be configured later

This mode enables the user to see immediate value from the platform even before
cloud connectivity is established, honoring the E-1 sovereignty principle.

---

## 11. Codebase Grounding

Every claim in this section maps to implemented (or scaffolded) code.

### 11.1 Sparkplug-B Integration

| Claim | File | Line/Range | Status |
|-------|------|-----------|--------|
| SparkplugAdapterConfig schema | `lib/iiot/adapters/sparkplug-adapter.ts` | 56-67 | Implemented |
| AliasRegistry (alias→name mapping) | `lib/iiot/adapters/sparkplug-adapter.ts` | 79-111 | Implemented |
| STATE topic parsing | `lib/iiot/adapters/sparkplug-adapter.ts` | 125-132 | Implemented |
| StateRegistry (ONLINE/OFFLINE tracking) | `lib/iiot/adapters/sparkplug-adapter.ts` | 144-162 | Implemented |
| StateRegistryKV (NATS KV persistence) | `lib/iiot/adapters/sparkplug-adapter.ts` | 191-216 | Implemented |
| SparkplugPipelineLayer composition | `lib/iiot/adapters/ingestion-service.ts` | 297-322 | Implemented |

### 11.2 Entity Hierarchy

| Claim | File | Status |
|-------|------|--------|
| Enterprise schema | `lib/iiot/schemas/assets/enterprise/schema.ts` | Implemented |
| Site schema | `lib/iiot/schemas/assets/site/schema.ts` | Implemented |
| Area schema | `lib/iiot/schemas/assets/area/schema.ts` | Implemented |
| Plant schema | `lib/iiot/schemas/assets/plant/schema.ts` | Implemented |
| Line schema | `lib/iiot/schemas/assets/line/schema.ts` | Implemented |
| WorkCell schema | `lib/iiot/schemas/assets/workcell/schema.ts` | Implemented |
| Machine schema | `lib/iiot/schemas/assets/machine/schema.ts` | Implemented |
| Device schema | `lib/iiot/schemas/assets/device/schema.ts` | Implemented |
| Sensor schema | `lib/iiot/schemas/assets/sensor/schema.ts` | Implemented |
| EntityStack (Layer.mergeAll of all entities) | `lib/iiot/entity/EntityStack.ts` | Implemented |

### 11.3 Real-Time Pipeline

| Claim | File | Status |
|-------|------|--------|
| EquipmentState entity (OEE source) | `lib/iiot/entity/EquipmentStateEntity.ts` | Implemented |
| WebSocket streaming (RealtimeRpcs) | `lib/iiot/realtime/websocket-server.ts` | Implemented |
| ChannelService broadcast outlets | `lib/streams/constructs/ChannelService.ts` | Implemented |
| Event distribution | `lib/iiot/realtime/event-distribution.ts` | Implemented |

### 11.4 Scaffolded / Extension Needed

| Component | Purpose | Status |
|-----------|---------|--------|
| Account provisioning service | NATS JWT signing + account creation | Not yet implemented |
| Edge agent binary packaging | Single binary with embedded NATS | Not yet implemented |
| Onboarding wizard web UI | 5-screen first-run experience | Not yet implemented |
| QR code credential exchange | Encode JWT + cloud URL into QR | Not yet implemented |
| OPC UA adapter | OPC UA Browse + MonitoredItem subscriptions | Not yet implemented |
| REST polling adapter | Configurable HTTP polling with JSON path | Not yet implemented |
| OEE calculator | Derive OEE from EquipmentState durations | Not yet implemented |

---

## 12. Security Considerations During Onboarding

### 12.1 Credential Lifecycle

The QR code displayed during signup contains sensitive material (JWT + cloud URL).
The following security requirements apply:

1. **QR code expiration**: The QR code MUST expire within 1 hour of generation.
   After expiration, a new QR code MUST be requested through the web dashboard.

2. **Single-use credentials**: The initial bootstrap JWT SHOULD be single-use.
   After the edge agent successfully connects, the bootstrap JWT is exchanged for
   a long-lived device credential (per Z.3.1 account provisioning hierarchy).

3. **QR code display security**: The signup page MUST NOT cache or persist the
   QR code in browser storage. The QR code SHOULD be generated server-side and
   transmitted over TLS.

4. **Credential revocation**: If the user suspects the QR code was intercepted,
   they MUST be able to revoke the bootstrap credential immediately via the web
   dashboard. Revocation MUST propagate within 60 seconds (per Z.3.3 export
   revocation SLA).

### 12.2 Network Probing Safety

The edge agent's protocol discovery phase (Step 4 in the bootstrap flow) performs
network probing. The following constraints apply:

1. **Scope limitation**: Network probing MUST be limited to the local subnet
   (same /24 or /16 as the agent's IP address). The agent MUST NOT probe
   addresses outside its local network.

2. **Rate limiting**: Port scanning MUST NOT exceed 10 probes per second to avoid
   triggering network intrusion detection systems.

3. **Protocol-only probes**: Probes MUST only attempt application-layer protocol
   detection (MQTT CONNECT, OPC UA Hello). The agent MUST NOT perform OS
   fingerprinting or vulnerability scanning.

4. **User consent**: The onboarding wizard MUST display a notice before network
   probing begins: "This device will scan your local network for compatible
   equipment. No data will be sent outside your network."

### 12.3 First-Data Integrity

The first sensor readings ingested during onboarding establish the baseline for
alarm thresholds and OEE calculations. The following requirements protect this
critical phase:

1. **Timestamp validation**: The edge agent MUST validate that incoming reading
   timestamps are within a reasonable window (default: +/- 5 minutes from agent
   clock). Readings with timestamps outside this window MUST be logged but
   excluded from OEE calculations until clock synchronization is confirmed.

2. **Value range validation**: Readings with values outside the sensor type's
   physical range (e.g., temperature < -273.15°C) MUST be discarded with a
   warning in the agent log.

3. **Identity verification**: Device IDs from Sparkplug-B BIRTH messages MUST be
   unique within the organization's namespace. Duplicate device IDs from different
   edge nodes MUST be disambiguated by prefixing with the edge node ID.

---


---

<!-- Source: rfc-section-reactive-isa95.md -->

## Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [BCP 14] [RFC 2119] [RFC 8174]
when, and only when, they appear in ALL CAPITALS, as shown here.

---

## 5. ISA-95 Event Taxonomy and Propagation Rules

This section defines the normative event taxonomy, propagation rules, delivery
model, and NATS subject hierarchy for the Reactive ISA-95 system. It is the
core behavioral specification of RFC-001.

The canonical entity composition pattern referenced throughout this section is:

```
Entity.make('Type', [RPCs...]) -> Entity.toLayer(Effect.gen(function* () {
  const state = yield* TypeState                     // Port injection
  const machine = makeTypeMachine({ state, flags })  // Machine definition
  const actor = yield* Machine.boot(machine)         // Actor boot
  // Handlers delegate to Machine via actor.send()
  return Entity.of({ ... })
}))
```

Each Machine uses a `Graph.directed<StateNode, TransitionAction>` for
state transition validation. See Appendix A (Entity Transition Catalog) for
the complete state/transition inventory per entity type.

### 5.1 Classification by Automation Level

Not all entity transitions carry equal realtime significance. ISA-95
[ISA-95-1] defines a natural hierarchy of urgency and scope.
Implementations MUST classify entity events according to the following
taxonomy:

**Table 5-1: ISA-95 Event Classification**

| ISA-95 Level | Entity Types | Realtime Priority | Typical Frequency |
|---|---|---|---|
| **L4 -- Business** | Enterprise | Low -- minutes acceptable | Rare (quarterly) |
| **L3 -- Operations** | Site, Area, Plant | Medium to High | Infrequent to uncommon |
| **L2 -- Production** | Line, WorkCell | **High** -- immediate | Frequent (hourly) |
| **L1 -- Equipment** | Machine, Device | **Critical** -- immediate | Frequent (per-minute) |
| **L0 -- Sensing** | Sensor | **Critical** -- immediate | Frequent (per-minute) |
| **ES -- Event-Sourced** | Alarm, WorkOrder, EquipmentState | Critical to Medium | High-frequency |

> **Codebase**: The `EquipmentLevel` enum defining all 9 hierarchy levels
> is at `src/lib/iiot/schemas/identifiers.ts:28-38`
> (`Schema.Literal('enterprise','site','area','plant','line','workcell','machine','sensor','device')`).
> Branded ID types for each level: lines 46-79 (EnterpriseId through DeviceId).
> All 12 stateful entity handlers are composed via `Layer.mergeAll` in
> `src/lib/iiot/entity/EntityStack.ts:54-67`.

### 5.2 Latency Requirements by Level

Implementations SHOULD meet the following latency targets measured from state
transition completion to event availability at the WebSocket client:

**Table 5-2: Latency Requirements**

| ISA-95 Level | Target Latency | Justification |
|---|---|---|
| L0-L1 (Critical) | < 500ms | Operator safety response time [ENDSLEY-1995] |
| L2 (High) | < 1s | Production floor visibility (SA Level 2 -- comprehension) |
| L3 (Medium-High) | < 5s | Operations management awareness (SA Level 1 -- perception) |
| L4 (Low) | < 30s | Business analytics refresh |
| ES-Alarm (Critical) | < 500ms | ISA-18.2 alarm management response [ISA-18.2] |
| ES-WorkOrder (Medium) | < 5s | Workflow progression |
| ES-Equipment (Critical) | < 500ms | OEE real-time tracking [MESA-MODEL] |

The total cascade time from leaf entity (L0) to root entity (L4) MUST NOT
exceed 5 seconds under normal operating load.

### 5.3 Metropolitan-Scale Volume Estimates

**Table 5-3: Entity Event Volume Projections**

| Event Category | Per-Site (100 devices) | Metropolitan (100 sites) | Daily Total |
|---|---|---|---|
| L0-L1 equipment transitions | 5-50/day | 500-5,000/day | ~2,500 |
| L2 production state changes | 20-200/day | 2,000-20,000/day | ~10,000 |
| L3-L4 site/plant events | 1-10/day | 100-1,000/day | ~500 |
| ES alarm events | 50-500/day | 5,000-50,000/day | ~25,000 |
| ES work order events | 10-100/day | 1,000-10,000/day | ~5,000 |
| **Total entity events** | **~100-800/day** | **~10K-80K/day** | **~43,000** |
| Sensor readings (comparison) | 100K-1M/day | 10M-100M/day | **~50M** |

Entity events represent approximately 0.08% of total event volume.
Implementations SHOULD optimize for completeness and reliability over raw
throughput. Backpressure on the entity event channel is NOT expected under
normal operating conditions.

### 5.4 Hierarchy Cascade Metadata

When a parent entity changes state, child entities MAY be implicitly affected:

```text
Plant.EmergencyShutdown
  |-- Lines: implicit emergency_stop
      |-- WorkCells: implicit emergency_stop
          |-- Machines: implicit emergency_stop
              |-- Devices: implicit offline
                  |-- Sensors: implicit offline
```

The server MUST NOT walk the hierarchy tree on the hot path. Instead, the
`EntityStateChanged` event MUST carry a `cascadeScope` field (see Section 7
for the event schema). Subscribing clients SHOULD use this metadata to decide
whether to visually cascade status or re-query child entity state.

**Table 5-4: Cascade Scope Values**

| cascadeScope | Meaning | Client Behavior |
|---|---|---|
| `none` | No children affected | No action |
| `direct_children` | Immediate children may be affected | Re-query one level down |
| `all_descendants` | Entire subtree may be affected | Re-query or cascade visually |

### 5.5 Critical Transitions

The following transitions MUST produce events with immediate delivery priority
(Tier 1, hot path). Implementations SHOULD prioritize these over non-critical
transitions if resource contention occurs:

**Table 5-5: Safety-Critical and OEE-Critical Transitions**

| Entity | Transition | Action | Criticality | Source File |
|---|---|---|---|---|
| **Plant** | operational -> emergency_shutdown | EmergencyShutdown | Safety | `machines/graphs/plant-graph.ts:102` |
| **Line** | idle -> running | Start | Production start | `machines/graphs/line-graph.ts` |
| **Line** | running -> starved | MarkStarved | OEE impact | `entity/LineEntity.ts:157` |
| **Line** | running -> blocked | MarkBlocked | OEE impact | `entity/LineEntity.ts:173` |
| **Machine** | operational -> faulted | MarkFaulted | Breakdown | `machines/graphs/machine-asset-graph.ts` |
| **Machine** | faulted -> unscheduled_maintenance | EmergencyRepair | Urgent repair | `machines/graphs/machine-asset-graph.ts` |
| **Device** | online -> offline | GoOffline | Connectivity loss | `machines/graphs/device-graph.ts` |
| **Sensor** | active -> faulted | MarkFaulted | Sensor failure | `machines/graphs/sensor-graph.ts:59-66` |
| **EquipmentState** | running -> unplanned_downtime | Transition | OEE availability | `entity/EquipmentStateEntity.ts` |
| **Alarm** | unacknowledged -> acknowledged | Acknowledge | Operator response | `entity/AlarmEntity.ts:163-168` |

All file paths are relative to `src/lib/iiot/`.

---

### 5.6 The Reactive Gap -- What Existing Frameworks Lack

Existing IIoT frameworks address partial aspects of reactive manufacturing but
none provides the full behavioral specification this platform requires.
Implementations MUST understand these gaps to avoid regressing to patterns
that existing standards already proved insufficient.

**Table 5-6: Framework Gap Analysis**

| Framework | What It Provides | What It Lacks for Reactive ISA-95 |
|---|---|---|
| **ISA-95** [ISA-95-1] | Equipment hierarchy, activity model, L3/L4 messaging | No top-down reactive path, no entity lifecycle events, no lateral propagation |
| **RAMI 4.0** [RAMI-4.0] | 3D model (hierarchy + architecture + lifecycle), SOA foundation | No event flow semantics, no propagation rules, no delivery SLAs |
| **AAS** [IEC-63278] | Standardized digital twin, submodel observation via AAS Registry | Pull-based observation only, no hierarchical propagation |
| **OPC UA PubSub** [OPC-UA-14] | L0-L2 real-time pub/sub, TSN integration for determinism | Plant-floor scope only, flat topics, no backpressure management |
| **NOA** [NAMUR-NOA] | Sidecar monitoring channel, VoR for command validation, lifecycle decoupling | Monitoring-only focus, no formalized state machines, no propagation rules |
| **UNS** [UNS-HIVEMQ] | Hub-and-spoke topology, semantic topic hierarchy, event-driven architecture | No state machines, no propagation rules, no delivery tiers |
| **B2MML V7** [B2MML-V7] | Operations Events as first-class concept in XML exchange | L3/L4 boundary only, XML-heavy, batch-oriented |

> "Under the legacy ISA-95 architecture, not only is integration between IT
> and OT difficult, but skip-level function integration is not supported,
> which makes it too rigid to adapt rapidly to evolving opportunities from
> ICT technology integration." [ISA95-AGE-I40]

**What none of them provide** -- and what this specification defines:

1. **Formal state transition graphs** per equipment level with graph-validated
   transitions via `Graph.directed<StateNode, TransitionAction>` (Section 5.5,
   Appendix A)
2. **Upward, downward, lateral, and outward propagation rules** with
   RFC 2119 conformance requirements (Section 5.7)
3. **Tiered delivery guarantees** mapped to ISA-95 automation levels with
   quantified SLAs (Section 5.8)
4. **Event sourcing with replay semantics** for compliance-grade audit trails
   (Section 9)
5. **Metropolitan-scale fan-out** with backpressure management via
   ChannelService broadcast outlets (Section 8)

The Reactive ISA-95 model fills these gaps by combining:

- **ISA-95's equipment hierarchy** [ISA-95-1] -- the ontology
- **UNS's hub-and-spoke topology** [UNS-HIVEMQ] -- the transport pattern
- **NOA's sidecar philosophy** [NAMUR-NOA] -- the deployment model (our
  EventDistribution + HolonetBridge is architecturally equivalent to NOA's
  second channel)
- **AAS's digital twin concept** [IEC-63278] -- the entity model (our
  `Schema.TaggedClass` entities serve as reactive AAS instances)
- **Novel additions**: state graphs, propagation rules, delivery tiers,
  event sourcing, outward propagation for manufacturing network participation

---

### 5.7 Propagation Rules

Entity state changes propagate through the ISA-95 hierarchy in four
directions: **upward** (child to parent), **downward** (parent to child),
**lateral** (sibling to sibling), and **outward** (organization to network).

Conformance requirements:

- Implementations MUST support upward propagation (Section 5.7.1).
- Implementations MUST support downward propagation for safety-critical
  transitions (Rule D-1). Implementations SHOULD support D-2, D-3.
- Implementations SHOULD support lateral propagation (Section 5.7.3).
- Implementations MAY support outward propagation for manufacturing network
  participation (Section 5.7.5).

#### 5.7.1 Upward Propagation (Child -> Parent)

When a child entity state changes, the parent's derived state updates
reactively.

##### Rule U-1: Equipment State Roll-Up (Worst-Of)

Implementations MUST propagate equipment state changes upward through the
hierarchy. The aggregation function SHOULD use worst-of semantics with
criticality weighting:

**Table 5-7: Equipment State Roll-Up SLA**

| Condition | Parent State | Timing |
|---|---|---|
| Critical-path child FAULTED | Parent DEGRADED | MUST complete within 500ms |
| Non-critical child FAULTED | Parent OPERATIONAL (reduced capacity) | SHOULD complete within 1s |
| Multiple children FAULTED below threshold | Parent CRITICAL | MUST complete within 1s |
| All children STOPPED | Parent STOPPED | MUST complete within 2s |

```text
PSEUDOCODE: Worst-Of Aggregation

FOR EACH child IN parent.children:
  IF child.state == FAULTED AND child.criticality == CRITICAL:
    parent.derivedState = DEGRADED
  ELSE IF child.state == FAULTED AND child.criticality == NON_CRITICAL:
    parent.derivedState = OPERATIONAL_REDUCED
  IF count(FAULTED children) > threshold:
    parent.derivedState = CRITICAL
  IF all(children.state == STOPPED):
    parent.derivedState = STOPPED
EMIT EntityStateChanged(parent, derivedState)
```

The total cascade time from leaf entity (L0) to root entity (L4) MUST NOT
exceed 5 seconds under normal operating load.

> **Codebase**: Machine state graph: `src/lib/iiot/machines/graphs/machine-asset-graph.ts`.
> Machine entity handler: `src/lib/iiot/entity/MachineAssetEntity.ts` (delegates to
> Machine via `actor.send()`). Equipment state tracked by
> `src/lib/iiot/entity/EquipmentStateEntity.ts` (EVENT SOURCED per ADR-0012).
> EntityStack composes all 12 handlers at `src/lib/iiot/entity/EntityStack.ts:54-67`.

##### Rule U-2: Alarm Escalation

Alarm events MUST propagate to all ancestor entities for visibility.
Implementations MUST rate-limit alarm propagation per EEMUA 191 [EEMUA-191]:

- Maximum 10 alarms per 10-minute window per entity before flood suppression
  activates
- First-in-fault tracking: only the root cause alarm SHOULD escalate;
  consequential alarms MUST be tagged but MAY be suppressed from operator view

If an alarm changes equipment state (e.g., safety alarm forces
EMERGENCY_STOP), Rule U-1 MUST be triggered as a cascade.

```text
PSEUDOCODE: Alarm Escalation

ON AlarmEvent(deviceId, severity, category):
  alarm = AlarmEntity.create(alarmId, deviceId, severity, category)
  FOR EACH ancestor IN hierarchy.ancestors(deviceId):
    IF floodCount(ancestor, window=10min) >= 10:
      SUPPRESS(alarm, reason="flood")
    ELSE:
      EMIT AlarmEscalated(ancestor, alarm)
  IF alarm.changesEquipmentState:
    TRIGGER Rule_U1(alarm.equipmentId, EMERGENCY_STOP)
```

> **Codebase**: Alarm entity: `src/lib/iiot/entity/AlarmEntity.ts:163-168`
> (`AlarmEntity = Entity.make('Alarm', [CreateAlarmRpc, GetAlarmRpc, AcknowledgeAlarmRpc, ClearAlarmRpc])`).
> ISA-18.2 lifecycle enforced by `src/lib/iiot/machines/AlarmMachine.ts`.
> Alarm state graph: `src/lib/iiot/machines/graphs/alarm-graph.ts`.
> `AlarmId` branded identifier: `src/lib/iiot/schemas/identifiers.ts:90-91`.
> Alarm events flow through EventDistribution: `src/lib/iiot/realtime/event-distribution.ts:49-55`
> (`AlarmEvent` schema).

##### Rule U-3: Sensor Health Propagation

When a sensor transitions to OFFLINE state, the parent device MUST mark
sensor-derived metrics as UNCERTAIN. The parent machine MUST evaluate whether
the sensor is critical for state determination:

| Sensor Classification | Parent Machine Behavior | Timing |
|---|---|---|
| Critical sensor offline | `machine.confidence = LOW`, MUST flag for operator review | < 2s |
| Non-critical sensor offline | `machine.confidence = PARTIAL` | < 5s |

> **Codebase**: Sensor asset entity: `src/lib/iiot/entity/SensorAssetEntity.ts:191-203`
> (`SensorAssetEntity = Entity.make('SensorAsset', [...])`). Sensor state graph with
> `active|calibrating|faulted|offline|needs_calibration|decommissioned` states:
> `src/lib/iiot/machines/graphs/sensor-graph.ts:59-66`. The `TakeOffline`
> transition (active/faulted -> offline) is the graph-validated equivalent of
> "Sensor goes OFFLINE." Sensor readings (time-series) are handled by the separate
> `SensorEntity` at `src/lib/iiot/entity/SensorEntity.ts`.

##### Rule U-4: Production Metrics Roll-Up

Production completion events MUST propagate through the hierarchy for OEE
calculation [MESA-MODEL]. Timing constraints relax at each level:

**Table 5-8: OEE Metric Propagation SLA**

| Aggregation Level | Metric Update SLA |
|---|---|
| WorkCell shift totals | < 5s |
| Line OEE recalculation | < 30s |
| Area/Plant/Site dashboard | < 2min |

> **Codebase**: OEE tracking is managed by `src/lib/iiot/entity/EquipmentStateEntity.ts`
> (EVENT SOURCED) with `GetOeeRpc` and `GetDurationsRpc` for real-time queries.
> Equipment state transitions flow to EventDistribution via the `EquipmentStateChange`
> schema at `src/lib/iiot/realtime/event-distribution.ts:58-63`.

#### 5.7.2 Downward Propagation (Parent -> Child)

When a parent entity issues a command or changes operational mode, children
react. Downward propagation MUST be guarded -- the reactive layer propagates
the *awareness* of state change, not the *execution* of physical commands.

> **CRITICAL DISTINCTION**: Downward propagation is SOFTWARE-LEVEL tracking.
> Physical safety shutdowns are executed through SIS/ESD systems at L1 with
> hard-realtime guarantees (< 10ms). This specification tracks the STATE of
> the shutdown, not the shutdown itself.

##### Rule D-1: Emergency Shutdown (Safety-Critical)

When a Plant declares EMERGENCY_SHUTDOWN, the event MUST reach all descendant
entities within 1 second for state tracking. Each descendant Machine MUST
transition to EMERGENCY_STOP state.

**Table 5-9: Emergency Shutdown Cascade Timeline**

| Step | Target | Timing |
|---|---|---|
| Plant emits EmergencyShutdown event | EventDistribution | < 100ms |
| All child Areas receive and propagate | Area entities | < 200ms |
| All child Lines, WorkCells, Machines receive | L2-L1 entities | < 500ms |
| Each Machine transitions to EMERGENCY_STOP | Machine state | < 1s |

> **Codebase**: Plant entity: `src/lib/iiot/entity/PlantEntity.ts:208-219`
> (`PlantEntity = Entity.make('Plant', [...])`), with `EmergencyShutdownRpc`
> at line 148. Plant state graph: `src/lib/iiot/machines/graphs/plant-graph.ts:42-48`
> defines `PlantStateNode` with 6 states including `emergency_shutdown`. The
> `operational -> emergency_shutdown` transition is validated at line 102:
> `Graph.addEdge(mutable, nodeIndices.operational, nodeIndices.emergency_shutdown, 'EmergencyShutdown')`.
> Plant handler boots Machine at `PlantEntity.ts:248-249`:
> `const actor = yield* Machine.boot(plantMachine)`.

##### Rule D-2: Mode Change Propagation

When an Area switches production mode (e.g., Product A to Product B), child
Lines MUST evaluate within 1 second whether the mode change affects their
configuration. Affected Lines MUST enter CHANGEOVER state.

| Step | Target | Timing |
|---|---|---|
| Area emits ModeChange event | EventDistribution | < 500ms |
| Affected Lines enter CHANGEOVER state | Line entities | < 1s |
| Equipment reservation changes complete | WorkCell/Machine | < 30s |

> **Codebase**: Line entity: `src/lib/iiot/entity/LineEntity.ts:223-237`
> (`LineEntity = Entity.make('Line', [...])`). Line state graph:
> `src/lib/iiot/machines/graphs/line-graph.ts:50-57` defines `LineStateNode`
> including `changeover` state. The `running -> changeover` transition uses
> `BeginChangeover` action.

##### Rule D-3: Maintenance Window Propagation

When a Line enters SCHEDULED_MAINTENANCE, child WorkCells and Machines MUST
transition to MAINTENANCE mode within 5 seconds. Active work orders on
affected equipment SHOULD be rescheduled within 1 minute.

| Step | Target | Timing |
|---|---|---|
| Line emits MaintenanceScheduled event | EventDistribution | < 1s |
| Child WorkCells transition to MAINTENANCE | WorkCell entities | < 2s |
| Child Machines transition to MAINTENANCE | Machine entities | < 5s |
| Active work orders rescheduled | WorkOrder entities | < 1min |
| Parent Area recalculates capacity | Area dashboard | < 30s |

> **Codebase**: Line `maintenance` state: `src/lib/iiot/machines/graphs/line-graph.ts:56`.
> The `idle|running -> maintenance` transition uses `EnterMaintenance`, and
> `maintenance -> idle` uses `CompleteMaintenance`. Plant also has `maintenance_shutdown`
> state: `src/lib/iiot/machines/graphs/plant-graph.ts:47`. Work order rescheduling
> managed by `src/lib/iiot/entity/WorkOrderEntity.ts` (EVENT SOURCED -- FDA 21 CFR
> Part 11 lifecycle).

#### 5.7.3 Lateral Propagation (Sibling -> Sibling)

Lateral propagation occurs when one entity's state affects peer entities at
the same hierarchy level. Lateral propagation is RECOMMENDED but NOT REQUIRED
for initial implementations.

##### Rule L-1: Starvation/Blocking Cascade

When a Line enters STARVED state, the parent Area SHOULD evaluate its material
flow graph to identify upstream/downstream dependencies and generate
rebalancing suggestions within 30 seconds.

```text
PSEUDOCODE: Starvation Cascade

ON LineStateChanged(lineId, newState=STARVED):
  area = hierarchy.parent(lineId)
  FOR EACH siblingLine IN area.children WHERE siblingLine != lineId:
    IF materialFlow.isUpstream(siblingLine, lineId):
      EMIT Alert(siblingLine.operator, "downstream starved")
    IF materialFlow.canReroute(siblingLine, lineId):
      EMIT Suggestion(area.scheduler, "reroute via siblingLine")
  EMIT StarvationEvent(area.scheduler, priority=HIGH)
```

> **Codebase**: Line `starved` and `blocked` states:
> `src/lib/iiot/machines/graphs/line-graph.ts:54-55`. Transitions
> `MarkStarved`/`ClearStarved`/`MarkBlocked`/`ClearBlocked` are all
> graph-validated. Line RPCs: `MarkStarvedRpc` at
> `src/lib/iiot/entity/LineEntity.ts:157`, `MarkBlockedRpc` at line 173.
> Line handler boots Machine at `LineEntity.ts:286-287`.

##### Rule L-2: Redundancy Failover

When a primary Machine enters FAULTED, the parent WorkCell SHOULD evaluate
redundancy configuration and activate standby equipment within 2 seconds if
available. If no standby exists, the WorkCell SHOULD escalate to the parent
Line for rebalancing within 5 seconds.

> **Codebase**: `WorkCellEntity` exists at `src/lib/iiot/entity/WorkCellEntity.ts`.
> `MachineAssetEntity` at `src/lib/iiot/entity/MachineAssetEntity.ts`. Redundancy
> configuration and automatic failover logic are NOT yet implemented -- this rule
> defines future behavior.

##### Rule L-3: Quality Containment

When a Machine produces a quality failure result, sibling machines consuming
the same input material MUST be alerted within 5 seconds. Downstream machines
receiving the failed machine's output SHOULD enter HOLD state within 10
seconds pending quality review.

> **Codebase**: `MachineAssetEntity` at `src/lib/iiot/entity/MachineAssetEntity.ts`
> handles machine state. Quality events and containment logic are NOT yet
> implemented -- this rule defines future behavior for traceability and batch
> containment.

#### 5.7.4 Propagation Rule Summary

**Table 5-10: Propagation Rule Codebase Mapping**

All paths relative to `src/lib/iiot/`. Each entity follows the pattern:
`Entity.make()` -> `Entity.toLayer()` -> `Machine.boot()` -> `actor.send()`
with `Graph.directed` state validation.

| Rule | Direction | Entity | Handler File | Graph File | Key Lines | Status |
|---|---|---|---|---|---|---|
| U-1 | Upward | MachineAsset | `entity/MachineAssetEntity.ts` | `machines/graphs/machine-asset-graph.ts` | actor.send delegation | Defined |
| U-2 | Upward | Alarm | `entity/AlarmEntity.ts` | `machines/graphs/alarm-graph.ts` | :163-168 (Entity.make) | Defined |
| U-3 | Upward | SensorAsset | `entity/SensorAssetEntity.ts` | `machines/graphs/sensor-graph.ts` | :191-203, graph:59-66 | Defined |
| U-4 | Upward | EquipmentState | `entity/EquipmentStateEntity.ts` | (in EquipmentStateMachine) | GetOeeRpc, GetDurationsRpc | Defined |
| D-1 | Downward | Plant | `entity/PlantEntity.ts` | `machines/graphs/plant-graph.ts` | :208-219, graph:102 | Defined |
| D-2 | Downward | Line | `entity/LineEntity.ts` | `machines/graphs/line-graph.ts` | :223-237, graph:50-57 | Defined |
| D-3 | Downward | Line, Plant | `entity/LineEntity.ts`, `entity/WorkOrderEntity.ts` | `machines/graphs/line-graph.ts:56`, `plant-graph.ts:47` | maintenance states | Defined |
| L-1 | Lateral | Line | `entity/LineEntity.ts` | `machines/graphs/line-graph.ts` | :157 (MarkStarved), :173 (MarkBlocked) | Defined |
| L-2 | Lateral | MachineAsset | `entity/MachineAssetEntity.ts` | `machines/graphs/machine-asset-graph.ts` | faulted state | Future |
| L-3 | Lateral | MachineAsset | `entity/MachineAssetEntity.ts` | `machines/graphs/machine-asset-graph.ts` | quality events | Future |
| O-1 | Outward | (network) | Not yet implemented | -- | -- | Future |
| O-2 | Outward | (network) | Not yet implemented | -- | -- | Future |
| O-3 | Outward | (network) | Not yet implemented | -- | -- | Future |

**Realtime stack** (event flow from entity to subscriber):

| Component | File | Key Lines | Purpose |
|---|---|---|---|
| EventDistribution | `realtime/event-distribution.ts` | :127-130 (Tag), :136-157 (channels) | Central event hub, 4 ChannelService channels |
| ReactivityBridge | `realtime/reactivity-bridge.ts` | :82-85 (Tag), :47-76 (shape) | Handler-to-distribution adapter |
| HolonetBridge | `realtime/holonet-bridge.ts` | :88-91 (Tag), :97-194 (impl) | NATS bridge, fire-and-forget outbound |
| NATS Subjects | `realtime/iiot-subjects.ts` | :39-136 | 4 subject specs: readings, alarms, equipment, invalidations |
| EntityStack | `entity/EntityStack.ts` | :54-67 | Layer.mergeAll of 12 entity handlers |
| Identifiers | `schemas/identifiers.ts` | :28-38, :46-79 | EquipmentLevel enum, branded IDs |

#### 5.7.5 Outward Propagation (Organization -> Network)

> **NOTE**: This subsection applies only to manufacturing network deployments
> where multiple organizations participate in a shared platform. Single-tenant
> deployments MAY ignore this section entirely.

Outward propagation extends the event model beyond organizational boundaries.
Entity state changes that are relevant to the manufacturing network (capacity
availability, quality milestones, collaboration opportunities) MAY be published
to network-level subjects with explicit consent from the organization.

##### Rule O-1: Capacity Advertisement

When equipment enters IDLE state and has no queued work orders, the
organization MAY publish a `CapacityAvailable` event to the network. The
event MUST be anonymized to the organization's configured granularity level.

| Step | Target | Timing |
|---|---|---|
| Equipment enters IDLE with empty queue | Local detection | Immediate |
| Organization publishes CapacityAvailable | Network (consent-gated) | < 2s |
| Network marketplace matches capacity with demand | Marketplace service | < 5s |
| Interested buyers receive anonymized capability match | Buyer notification | < 10s |

##### Rule O-2: Quality Signal

When an organization's process metrics cross a certification threshold, the
organization MAY publish a `QualityMilestone` event. Reputation system updates
SHOULD complete within 30 seconds.

##### Rule O-3: Collaborative Work Order

When a work order exceeds a single organization's capacity, the organization
MAY publish a `CollaborativeOpportunity` event. Network matching of
complementary organizations SHOULD complete within 30 seconds. Cross-org
work order establishment requires total ordering guarantees (see G-8 in
the consistency model, Section 9).

##### Consent Model

Outward propagation MUST be opt-in. Organizations MUST control:

1. **What** events are shared (capabilities, quality, availability)
2. **With whom** (public network, trusted partners only, named organizations)
3. **At what granularity** (exact capacity vs. boolean "available/unavailable")
4. **Time-boxed visibility** (e.g., share availability for next 4 hours only)

All outward events MUST transit through a consent-gate service before reaching
network subjects. The consent-gate MUST be a separate service boundary with
its own audit log.

##### Variable-Depth Hierarchy

For organizations with collapsed ISA-95 hierarchy (e.g., a 2-person machine
shop where one equipment entity IS the entire operation), outward propagation
rules apply identically. The propagation rules operate on parent/child
relationships, not fixed level names.

**Table 5-11: Variable-Depth Examples**

| Organization Type | ISA-95 Levels Used | Equipment Equivalent |
|---|---|---|
| Aerospace facility (10,000+ employees) | All 7+ levels | Full hierarchy |
| Mid-size job shop (50-200 employees) | 4-5 levels | Site > Area > Machine > Sensor |
| Small CNC shop (5-15 employees) | 2-3 levels | Site > Machine > Sensor |
| Solo machinist (1-2 employees) | 1-2 levels | Machine > Sensor |

A network-level query such as "show all FAULTED machines" MUST return
results from organizations at any hierarchy depth. Virtual hierarchy aliases
provide this mapping (see Section 6 for multi-tenant architecture).

> **Codebase**: The current ISA-95 hierarchy uses a fixed 9-value
> `EquipmentLevel` enum at `src/lib/iiot/schemas/identifiers.ts:28-38`.
> Variable-depth hierarchy and outward propagation rules (O-1/O-2/O-3) are
> NOT yet implemented. They require: new `network.*` NATS subject specs,
> a consent-gate service, and virtual hierarchy aliases. The existing NATS
> subjects at `src/lib/iiot/realtime/iiot-subjects.ts` use flat
> `iiot.{channel}.{deviceId}` patterns (4 channels).

---

### 5.8 Three-Tier Delivery Model

Entity events and sensor telemetry MUST be classified into three delivery tiers
with distinct SLAs. The tier classification follows from the ISA-95 level
taxonomy (Section 5.1) and maps to concrete NATS transport mechanisms.

#### 5.8.1 Tier 1: Hot Path (Soft Realtime)

```text
SLA:           p50 < 500ms, p99 < 3s, p999 < 10s
Events:        Sensor readings, equipment state changes, alarm lifecycle
Consumers:     Operator HMI, SCADA displays, alarm panels
Backpressure:  Drop oldest (operator needs CURRENT state)
Transport:     Core NATS pub/sub (no persistence on hot path)
```

Implementations MUST deliver Tier 1 events with drop-oldest backpressure.
Operators need the current state, not queued history. Events older than the
current state are stale and SHOULD be discarded under contention.

#### 5.8.2 Tier 2: Warm Path (Near-Realtime)

```text
SLA:           p50 < 5s, p99 < 30s, p999 < 2min
Events:        Production events, quality events, work orders, OEE metrics
Consumers:     MES dashboards, shift supervisors, quality systems
Backpressure:  Buffer and batch (aggregation smooths gaps)
Transport:     NATS JetStream with limits retention
```

Implementations SHOULD buffer Tier 2 events during consumer slowness.
Aggregation at the consumer level smooths delivery gaps. Events MUST NOT
be dropped.

#### 5.8.3 Tier 3: Cold Path (Eventually Consistent)

```text
SLA:           p50 < 1min, p99 < 1hr
Events:        KPIs, business analytics, compliance records, audit trail
Consumers:     ERP, BI dashboards, regulatory systems
Backpressure:  Never drop, buffer to disk
Transport:     NATS JetStream with file storage, long retention
```

Implementations MUST NOT drop Tier 3 events. These events serve compliance
and audit requirements. Regulatory mandates (FDA 21 CFR Part 11 [FDA-CFR11],
ISA-18.2 [ISA-18.2]) require 7-year minimum retention for quality and alarm
records.

#### 5.8.4 Cross-Tier Event Promotion

Some events start in one tier and get promoted to another. Implementations
MUST support simultaneous delivery to multiple tiers:

```text
Sensor Reading (Tier 1: hot path, ephemeral)
  | threshold breach detected
  v
Alarm Event (Tier 1: hot path, ALSO persisted to Tier 3 for audit)
  | alarm changes equipment state
  v
Equipment State Change (Tier 1: hot path + Tier 2: warm for OEE)
  | state change affects production count
  v
Production Event (Tier 2: warm path)
  | shift complete
  v
OEE Aggregate (Tier 3: cold path for reporting)
```

Events MUST fork into multiple tiers simultaneously. A single equipment state
change MAY produce events in all three tiers. Tier promotion is NOT a
pipeline -- it is parallel publication.

**Table 5-12: Delivery Tier Summary**

| Property | Tier 1 (Hot) | Tier 2 (Warm) | Tier 3 (Cold) |
|---|---|---|---|
| Latency SLA | p99 < 3s | p99 < 30s | p99 < 1hr |
| Backpressure | Drop oldest | Buffer and batch | Never drop |
| Transport | Core NATS | JetStream (limits) | JetStream (file) |
| Retention | None (ephemeral) | 30-90 days | 7+ years |
| Ordering | Per-entity causal | Per-entity causal | Total order within domain |
| Consumers | Operator HMI | MES dashboards | ERP, compliance |

---

### 5.9 Extended NATS Subject Hierarchy

The current NATS subjects (Section 8) support basic event routing. The full
Reactive ISA-95 model requires a hierarchical subject structure encoding the
equipment hierarchy for level-scoped subscriptions. This is a RECOMMENDED
extension for metropolitan-scale deployments.

#### 5.9.1 Current Subjects

The platform currently defines four IIoT NATS subjects:

```text
iiot.readings.{deviceId}        -- Sensor telemetry (Tier 1)
iiot.alarms.{deviceId}          -- Alarm lifecycle (Tier 1)
iiot.equipment.{equipmentId}    -- Equipment state (Tier 1 + 2)
iiot.invalidations.{cacheKey}   -- Cache coherence (internal)
```

> **Codebase**: `src/lib/iiot/realtime/iiot-subjects.ts:39-136` defines these
> four subject specs using `createSubjectSpec()`.
> `HolonetBridge` at `src/lib/iiot/realtime/holonet-bridge.ts:88-91` bridges
> local events to/from NATS via `NatsPubSubService`.

#### 5.9.2 Proposed Hierarchical Subjects

```text
# TIER 1: Hot Path (Core NATS, no persistence)
iiot.readings.{siteId}.{areaId}.{lineId}.{deviceId}
iiot.alarms.{siteId}.{areaId}.{lineId}.{deviceId}
iiot.equipment.{siteId}.{areaId}.{lineId}.{equipmentId}

# TIER 2: Warm Path (JetStream, limits retention)
iiot.production.{siteId}.{areaId}.{lineId}.{workOrderId}
iiot.quality.{siteId}.{areaId}.{lineId}.{batchId}
iiot.workorder.{siteId}.{areaId}.{workOrderId}
iiot.oee.{siteId}.{areaId}.{lineId}

# TIER 3: Cold Path (JetStream, file storage)
iiot.kpi.{siteId}
iiot.compliance.{siteId}.{domain}
iiot.audit.{siteId}.{entityType}.{entityId}

# PROPAGATION (reactive hierarchy events)
iiot.propagation.up.{siteId}.{entityType}.{entityId}
iiot.propagation.down.{siteId}.{entityType}.{entityId}
iiot.propagation.lateral.{siteId}.{areaId}.{entityType}

# COMMANDS (downward reactive, VoR-guarded per NOA [NAMUR-NOA])
iiot.command.{siteId}.{areaId}.{lineId}.{equipmentId}

# NETWORK (outward propagation, manufacturing network)
network.capacity.{orgId}.{capabilityClass}
network.quality.{orgId}.{certLevel}
network.collaboration.{orgId}.{workOrderType}

# MARKETPLACE (aggregated views)
marketplace.available.{region}.{capabilityClass}
marketplace.match.{requestId}
marketplace.reputation.{orgId}
```

#### 5.9.3 Level-Scoped Subscription Patterns

The hierarchical subject design enables role-based subscriptions following
the Solace ISA-95 event modeling pattern [SOLACE-ISA95]:

```text
# Shift supervisor: all alarms in their area
iiot.alarms.site-1.area-north.>

# Plant manager: all equipment state changes across all areas
iiot.equipment.site-1.>

# Operations VP: all KPIs across all sites
iiot.kpi.>

# OEE engine: all production events for a specific line
iiot.production.site-1.area-north.line-A.>

# Maintenance system: all equipment events across enterprise
iiot.equipment.>
```

#### 5.9.4 JetStream Stream Configuration

**Table 5-13: JetStream Stream Configuration**

| Stream Name | Subjects | Retention | Max Age | Max Bytes | Storage |
|---|---|---|---|---|---|
| `IIOT_READINGS` | `iiot.readings.>` | Limits | 24h | 10GB | Memory |
| `IIOT_ALARMS` | `iiot.alarms.>` | Limits | 90d | 5GB | File |
| `IIOT_EQUIPMENT` | `iiot.equipment.>` | Limits | 30d | 2GB | File |
| `IIOT_PRODUCTION` | `iiot.production.>` | Limits | 90d | 5GB | File |
| `IIOT_QUALITY` | `iiot.quality.>` | Limits | 7y | 50GB | File |
| `IIOT_AUDIT` | `iiot.audit.>` | Limits | 7y | 100GB | File |
| `IIOT_COMMANDS` | `iiot.command.>` | WorkQueue | 24h | 1GB | File |
| `IIOT_PROPAGATION` | `iiot.propagation.>` | Interest | 1h | 512MB | Memory |

#### 5.9.5 Migration Path

The current flat subjects (`iiot.readings.{deviceId}`) MUST coexist with
hierarchical subjects during migration. NATS subject mapping [NATS-SUBJECTMAP]
transforms flat subjects to hierarchical using the device-to-hierarchy lookup
from the entity model.

Migration sequence:

1. **Phase 1**: Add hierarchical subjects alongside flat ones. Ingestion
   service publishes to both.
2. **Phase 2**: New consumers subscribe to hierarchical subjects. Existing
   consumers continue on flat subjects.
3. **Phase 3**: Deprecate flat subjects once all consumers are migrated.

---

### 5.10 Event Category Volume and Retention Matrix

**Table 5-14: Complete Event Category Matrix**

| Event Category | Source Level | Volume/Plant | Latency SLA | Retention | Tier |
|---|---|---|---|---|---|
| Sensor Readings | L0-L1 | 10K-100K/sec | p99 < 2s | 24h/90d/7yr | 1 |
| Equipment State | L1-L2 | 10-100/sec | p99 < 3s | 30d/1yr/7yr | 1+2 |
| Alarm Events | L1-L2 | 1-100/sec | p99 < 1s | 90d/7yr | 1+3 |
| Production Events | L2-L3 | 1-10/sec | p99 < 10s | 90d/7yr | 2 |
| Quality Events | L2-L3 | 0.1-1/sec | p99 < 30s | 7yr (regulatory) | 2+3 |
| Schedule Events | L3 | 0.01-0.1/sec | p99 < 2min | 30d/1yr | 2 |
| Work Order Events | L3 | 0.1-1/sec | p99 < 1min | 90d/7yr | 2+3 |
| KPI/OEE Events | L3-L4 | 0.01-0.1/sec | p99 < 5min | 7yr | 3 |
| Business Events | L4 | 0.001/sec | p99 < 1hr | 7yr+ | 3 |

---

## Normative References Used in This Section

| Citation Key | Reference |
|---|---|
| [ISA-95-1] | ANSI/ISA-95.00.01: Enterprise-Control System Integration, Part 1 |
| [ISA-18.2] | ANSI/ISA-18.2: Alarm Management for the Process Industries |
| [RAMI-4.0] | DIN SPEC 91345: Reference Architecture Model Industrie 4.0 |
| [IEC-63278] | IEC 63278: Asset Administration Shell for Industrial Applications |
| [OPC-UA-14] | OPC UA Part 14: PubSub |
| [NAMUR-NOA] | NAMUR Open Architecture (NOA) |
| [UNS-HIVEMQ] | HiveMQ Unified Namespace Architecture Guide |
| [B2MML-V7] | Business to Manufacturing Markup Language, Version 7 |
| [EEMUA-191] | EEMUA Publication 191: Alarm Systems -- A Guide to Design |
| [SOLACE-ISA95] | Solace: ISA-95 Event-Driven Architecture Patterns |
| [NATS-SUBJECTMAP] | NATS Subject Mapping and Transforms Documentation |
| [MESA-MODEL] | MESA International Smart Manufacturing / MOM Model |
| [ENDSLEY-1995] | Endsley, M.R. (1995): Toward a Theory of Situation Awareness |
| [FDA-CFR11] | FDA 21 CFR Part 11: Electronic Records; Electronic Signatures |
| [ISA95-AGE-I40] | ISA-95 in the Age of Industry 4.0 -- Integration Challenges |

---

## Informative References Used in This Section

| Citation Key | Reference |
|---|---|
| [ISA95-BEYOND-PYRAMID] | Beyond the ISA-95 Automation Pyramid |
| [RHIZE-ISA95] | Rhize: Event-Driven Manufacturing Data Hub |
| [JETSTREAM] | NATS JetStream Documentation |
| [SPARKPLUG-B] | Eclipse Sparkplug B Specification |

---

## Appendix: Section Integration Notes

### Target Position

This section maps to **Section 5** in the final RFC-001 assembly plan
(`rfc-assembly-plan.md`, Section Map).

### Dependencies

- **Requires** Section 4 (Requirements) for FR-* and NFR-* references
- **Referenced by** Sections 6 (Multi-Tenant), 7 (Event Schema), 8 (Transport),
  9 (Consistency), 10 (Effect-TS), 11 (Observer)

### Cross-References to Resolve During Assembly

| Reference in This Section | Target |
|---|---|
| "See Section 7 for the event schema" | Section 7: Entity Event Schema |
| "See Section 8" (transport) | Section 8: Transport Layer & NATS Subject Hierarchy |
| "See Section 9" (consistency model) | Section 9: Consistency Guarantees & Temporal Semantics |
| "See Section 6 for multi-tenant architecture" | Section 6: Multi-Tenant Network Architecture |
| "See G-8 in the consistency model" | Section 9 (two-domain consistency) |
| "See Appendix A" (Entity Transition Catalog) | Appendix A |

### Source Traceability

| Subsection | Primary Source | Research Source |
|---|---|---|
| 5.1 Classification | `rfc-entity-realtime-integration.md` Section 5.1 | `research-reactive-isa95.md` Section 6.1 |
| 5.2 Latency | `rfc-entity-realtime-integration.md` Section 5.2 | `research-reactive-isa95.md` Section 6.2 |
| 5.3 Volume | `rfc-entity-realtime-integration.md` Section 5.3 | `research-reactive-isa95.md` Section 6.1 |
| 5.4 Cascade | `rfc-entity-realtime-integration.md` Section 5.4 | N/A (new for RFC) |
| 5.5 Critical | `rfc-entity-realtime-integration.md` Section 5.5 | `research-reactive-isa95.md` Section 5 |
| 5.6 Reactive Gap | `rfc-entity-realtime-integration.md` Section 5.6 | `research-reactive-isa95.md` Sections 1-3 |
| 5.7 Propagation | `rfc-entity-realtime-integration.md` Section 5.7 | `research-reactive-isa95.md` Section 5 |
| 5.7.5 Outward | `rfc-entity-realtime-integration.md` Section 5.7.5 | `research-reactive-isa95.md` Section 9 |
| 5.8 Three-Tier | `rfc-entity-realtime-integration.md` Section 5.8 | `research-reactive-isa95.md` Section 6.2 |
| 5.9 NATS Subjects | `rfc-entity-realtime-integration.md` Section 5.9 | `research-reactive-isa95.md` Section 7 |
| 5.10 Volume Matrix | `rfc-entity-realtime-integration.md` Section 5.10 | `research-reactive-isa95.md` Section 6.1 |

---


═══════════════════════════════════════════════════════════════════════════
APPENDICES
═══════════════════════════════════════════════════════════════════════════

## Appendix A: Research Document Index

<!-- Source: rfc-section-appendix-research-index.md -->

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

---

## Appendix B: Entity Transition Catalog


### A.1 ISA-95 Asset Entities (9 types)

| Entity | States | Terminal | Key Transitions | ISA Level |
|--------|--------|---------|-----------------|-----------|
| **Enterprise** | active, restructuring, merged, dissolved | merged, dissolved | restructure, merge, dissolve | L4 |
| **Site** | planned, under_construction, operational, seasonal_shutdown, closed, decommissioned | decommissioned | commission, seasonal_shutdown, decommission | L3 |
| **Area** | active, restricted, maintenance, inactive, decommissioned | decommissioned | restrict, enter_maintenance, deactivate | L3 |
| **Plant** | commissioning, operational, scheduled_shutdown, emergency_shutdown, maintenance_shutdown, decommissioned | decommissioned | emergency_shutdown, restart, maintenance_shutdown | L3 |
| **Line** | idle, running, changeover, starved, blocked, maintenance, decommissioned | decommissioned | start, stop, changeover, starved, blocked | L2 |
| **WorkCell** | idle, setup, active, blocked, faulted, maintenance, decommissioned | decommissioned | begin_setup, complete_setup, blocked, faulted | L2 |
| **Machine** | commissioned, operational, idle, faulted, scheduled_maintenance, unscheduled_maintenance, retired, decommissioned | retired, decommissioned | activate, faulted, emergency_repair | L1 |
| **Device** | provisioned, online, offline, faulted, firmware_update, decommissioned | decommissioned | go_online, go_offline, faulted, firmware_update | L1 |
| **Sensor** | active, calibrating, flagged_for_calibration, faulted, offline, decommissioned | decommissioned | start_calibration, faulted, take_offline | L0 |

### A.2 Event-Sourced Entities (3 types)

| Entity | States | Terminal | Key Transitions | ISA Level |
|--------|--------|---------|-----------------|-----------|
| **Alarm** | unacknowledged, acknowledged, shelved, suppressed, cleared, out_of_service | cleared, out_of_service | acknowledge, clear, shelve, suppress | ES |
| **WorkOrder** | created, submitted, approved, rejected, started, suspended, resumed, completed, failed, cancelled, closed | rejected, cancelled, closed | submit, approve, start, complete, close | ES |
| **EquipmentState** | running, idle, planned_downtime, unplanned_downtime, setup, blocked | (none — continuous) | transition (OEE tracking) | ES |


---


---

## Appendix C: Architecture Options Analysis


### B.1 Option A: Machine.changes Stream (SELECTED)

- **Mechanism**: Fork observer fiber at entity activation that subscribes to `actor.changes`
- **Handler changes**: 0
- **Completeness**: All state transitions captured (initial + subsequent)
- **previousState**: Automatic via `Stream.pairwise`
- **Trade-off**: Action name derived from state transition (not RPC tag)
- **Source**: VERIFIED `Machine.ts:827-830`, `Machine.ts:594-600`

### B.2 Option B: RpcMiddleware.wrap

- **Mechanism**: Intercept all RPCs via middleware, emit events post-handler
- **Handler changes**: 0
- **Limitation**: `SuccessValue` is OPAQUE — cannot extract state from result at runtime
- **Source**: VERIFIED via deepwiki — `RpcMiddleware.wrap` gives `options.next` but result is `SuccessValue<any>`

### B.3 Option C: Manual Effect.tap per Handler

- **Mechanism**: Add `Effect.tap(() => bridge.onXxx())` to each handler
- **Handler changes**: 103
- **Completeness**: Depends on every handler being modified
- **Risk**: Missed handlers = missed events

### B.4 Option D: Hybrid (A + B)

- **Mechanism**: Combine Machine.changes (state facts) + RpcMiddleware (action names)
- **Handler changes**: 0
- **Completeness**: State transitions + RPC action names
- **Complexity**: Correlation between two event sources

### B.5 Option E: EventLog.changes

- **Mechanism**: Subscribe to EventLog's `changes` PubSub for ES entities
- **Handler changes**: 0 (for ES entities only)
- **Limitation**: Only works for Alarm, WorkOrder, EquipmentState
- **MAY supplement Option A for ES entities


---


---

## Appendix D: Codebase File Inventory


| File | Action | Phase |
|------|--------|-------|
| `realtime/event-distribution.ts` | Add EntityStateChanged + 5th channel | A |
| `realtime/holonet-bridge.ts` | Add entity change methods | A |
| `realtime/iiot-subjects.ts` | Add entity subject spec | A |
| `realtime/reactivity-bridge.ts` | Add `onEntityStateChanged` | A |
| `rpc/RealtimeRpcs.ts` | Add SubscribeEntityChanges | A |
| `realtime/realtime-handlers.ts` | Add handler for SubscribeEntityChanges | A |
| `realtime/websocket-server.ts` | Wire new RPC to handler bridge | A |
| `entity/entity-observer.ts` | **NEW** — `makeEntityObserver` factory | B |
| `machines/graphs/index.ts` | Export transition-to-action maps | B |
| `entity/SiteEntity.ts` | Add observer in handler factory | B |
| `entity/AreaEntity.ts` | Add observer in handler factory | B |
| `entity/PlantEntity.ts` | Add observer in handler factory | B |
| `entity/LineEntity.ts` | Add observer in handler factory | B |
| `entity/WorkCellEntity.ts` | Add observer in handler factory | B |
| `entity/MachineAssetEntity.ts` | Add observer in handler factory | B |
| `entity/DeviceEntity.ts` | Add observer in handler factory | B |
| `entity/SensorAssetEntity.ts` | Add observer in handler factory | B |
| `entity/EnterpriseEntity.ts` | Add observer in handler factory | B |
| `entity/AlarmEntity.ts` | Add observer in handler factory | B |
| `entity/WorkOrderEntity.ts` | Add observer in handler factory | B |
| `entity/EquipmentStateEntity.ts` | Add observer in handler factory | B |
| `entity/EntityStack.ts` | Add EventDistribution to Layer | B |
| `infrastructure/feature-flags.ts` | Add `entityRealtimeEnabled` | B |

---

## Appendix E: Revision History

| Date | Version | Author | Change |
|------|---------|--------|--------|
| 2026-02-09 | v1 | Val | Initial draft — problem statement, ISA-95 taxonomy, manual Effect.tap approach |
| 2026-02-09 | v2 | Val | Complete rewrite — Machine.changes observer (verified), 5-option comparison, metropolitan volumes |
| 2026-02-09 | RFC-001 | Val | RFC format rewrite — formal sections, RFC 2119 conventions, temporal semantics, normative references |
| 2026-02-09 | RFC-001r1 | Val (isa95-architect) | Added Sections 5.6-5.10: Reactive Gap analysis, formal propagation rules (U-1 through U-4, D-1 through D-3, L-1 through L-3), three-tier delivery model, extended NATS subject hierarchy, event volume matrix. Updated normative/informative references to use canonical bibliography keys. |
| 2026-02-09 | RFC-001r2 | Val (isa95-architect) | Manufacturing network reframe: Added Section 5.7.5 (Outward Propagation rules O-1 through O-3 for cross-org capacity, quality, collaboration). Updated 5.7 intro from three to four propagation directions. Added variable-depth hierarchy and consent-gate model. Added manufacturing network informative references. |
| 2026-02-09 | RFC-001r3 | Val (isa95-architect) | Codebase grounding: Enhanced Section 5.7.4 codebase mapping table with precise file paths and line numbers for all 14 entities, 12 state graphs, branded identifiers, and realtime stack services. Added codebase grounding block to Section 5.7.5 identifying implemented vs not-yet-implemented components. |

---

| 2026-02-09 | RFC-001r4 | Val (isa95-architect) | Full RFC assembly: merged 28 section files (22,456 lines) into monolithic document. 26 sections organized in 7 parts. Applied cross-reference review findings (F-1 through F-16). Standardized placeholder section numbers (X., Y., Z., N., M., FM., RB., S.) to final numbers. |


---

# REFERENCES

---

## 15. Normative References

| Reference | Title |
|-----------|-------|
| [RFC 2119] | Key words for use in RFCs to Indicate Requirement Levels |
| [RFC 8174] | Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words |
| [ISA-95-1] | ANSI/ISA-95.00.01 (IEC 62264-1), Enterprise-Control System Integration Part 1: Models and Terminology |
| [ISA-95-2] | ANSI/ISA-95.00.02, Enterprise-Control System Integration Part 2: Object Model Attributes |
| [ISA-95-6] | ANSI/ISA-95.00.06, Enterprise-Control System Integration Part 6: Messaging Service Model |
| [ISA-95-8] | ANSI/ISA-95.00.08, Enterprise-Control System Integration Part 8: Information Exchange Profiles |
| [ISA-95-2025] | ANSI/ISA-95.00.01-2025, Enterprise-Control System Integration (2025 revision) |
| [ISA-18.2] | Management of Alarm Systems for the Process Industries |
| [EEMUA 191] | Alarm Systems: A Guide to Design, Management and Procurement |
| [Effect-TS] | Effect-TS framework, `@effect/experimental/Machine`, `@effect/cluster/Entity` |

---

---

## 16. Informative References

All citation keys reference the canonical bibliography at `docs/specifications/bibliography.md`.

| Reference | Title |
|-----------|-------|
| [Sparkplug B 3.0.0] | Eclipse Sparkplug B Specification v3.0.0 |
| [OPC UA Part 9] | OPC UA Alarms and Conditions |
| [OPC-UA-14] | IEC 62541-14:2020, OPC UA PubSub |
| [RAMI-4.0] | DIN SPEC 91345, Reference Architecture Model Industrie 4.0 |
| [RAMI40-EC] | EC Futurium RAMI 4.0 Introduction |
| [IEC-63278] | IEC 63278-1:2023, Asset Administration Shell |
| [AAS-SPEC] | IDTA-01001-3-0, AAS Specification Part 1: Metamodel |
| [NAMUR-NOA] | NAMUR NE 175, NAMUR Open Architecture |
| [B2MML-V7] | MESA B2MML V7, Operations Events |
| [UNS-HIVEMQ] | HiveMQ: UNS Essentials for IIoT |
| [SOLACE-ISA95] | Solace: Modeling Events in Accordance with ISA-95 |
| [NATS-SUBJECTS] | NATS Subject-Based Messaging specification |
| [NATS-SUBJECTMAP] | NATS Subject Mapping and Transforms |
| [ADR-004] | Entity System Architecture (Machine + Cluster) — TMNL Decision Record |
| [research-reactive-isa95.md] | Reactive ISA-95 for Metropolitan-Scale IIoT — full research document |
| [research-architecture-options.md] | 5-option architecture comparison with source verification |
| [research-cluster-patterns.md] | @effect/cluster lifecycle, EntityResource, shard migration analysis |
| [research-uns-metropolitan.md] | UNS patterns, metropolitan routing, Sparkplug gap analysis |
| [research-consistency-models.md] | NATS JetStream consistency guarantees and failure modes |
| [SHARED-MFG-2020] | Yu et al.: Shared manufacturing in the sharing economy |
| [PLATFORM-MFG-CIRP] | Sauer et al.: Platform-based manufacturing (CIRP 2023) |
| [IOTFEDS-2024] | Ioannidis et al.: Decentralized Management of IoT Platform Federations |
| [OFFLINE-FIRST-IOT] | Ley et al.: Offline-First IoT Architectural Patterns |
| [XOMETRY-PLATFORM] | Xometry: Manufacturing on Demand Network |

---

---

All citation keys reference the canonical bibliography at `docs/specifications/bibliography.md`.

---

*End of RFC-001*

---

## End of RFC-001

*This document was assembled from 28 independently authored section files
by 8 specialist agents, coordinated through the TMNL WBS orchestration system.*
