# Research: Reactive ISA-95 for Metropolitan-Scale IIoT

> **Authors:** realtime-philosopher (Val), isa95-architect (Val)
> **Date:** 2026-02-09
> **Status:** Research Complete — Revision 3 (Manufacturing Network Reframe)
> **Purpose:** Theoretical foundation for TMNL-RFC-001 Entity-Realtime Integration

---

## Table of Contents

1. [ISA-95 Limitations for Reactive Systems](#1-isa-95-limitations-for-reactive-systems)
2. [Industry 4.0 Extensions: RAMI 4.0, OPC UA, NOA, AAS, UNS](#2-industry-40-extensions)
3. [Reactive ISA-95 — A New Model](#3-reactive-isa-95--a-new-model)
4. [Academic Research on Reactive Manufacturing](#4-academic-research-on-reactive-manufacturing)
5. [Concrete Design Proposal: Propagation Rules](#5-concrete-design-proposal-propagation-rules)
6. [Event Routing by ISA-95 Level](#6-event-routing-by-isa-95-level)
7. [NATS Subject Hierarchy Mapping](#7-nats-subject-hierarchy-mapping)
8. [Sources](#8-sources)
9. [Manufacturing Network Reframe: Variable-Depth Hierarchy](#9-manufacturing-network-reframe-variable-depth-hierarchy)

---

## 1. ISA-95 Limitations for Reactive Systems

### 1.1 The Hierarchy Assumption

ISA-95 was designed in the 1990s for **batch manufacturing** with **hierarchical reporting**. Its core assumption: data flows **bottom-up** (L0 -> L1 -> L2 -> L3 -> L4) through well-defined boundaries. Each level communicates only with its adjacent neighbors.

This creates three fundamental problems for reactive, streaming systems:

#### Problem 1: No Top-Down Reactive Path (L4 -> L0)

ISA-95 models **information flows**, not **command flows**. When a plant-level emergency shutdown is declared (L3/L4 decision), the propagation to equipment (L1/L2) happens through **separate safety systems** (SIS/ESD) that exist *outside* the ISA-95 model entirely.

In a reactive system, we need:
- **L4 -> L3**: Business rule changes (production schedule shift) propagate to MES
- **L3 -> L2**: Schedule changes propagate to SCADA setpoints
- **L2 -> L1**: Control parameter adjustments reach PLCs
- **Lateral**: Line A starved -> Line B priority increases

ISA-95 has no model for these downward or lateral flows. It models the *data reporting* path, not the *reactive command* path.

> "Under the legacy ISA-95 architecture, not only is integration between IT and OT difficult, but skip-level function integration is not supported, which makes it too rigid to adapt rapidly to evolving opportunities from ICT technology integration."
> -- [ISA95-AGE-I40]

#### Problem 2: IT/OT Convergence Blurs Level 2/3 Boundary

The traditional ISA-95 pyramid assumes discrete levels with clear boundaries. But modern manufacturing increasingly deploys:

- **Edge computing** that operates at "Level 2.5" — faster than MES, smarter than SCADA
- **Cloud-connected PLCs** that skip L2/L3 entirely, reporting directly to L4 analytics
- **Smart sensors** (L0) with embedded analytics that make L2/L3 decisions locally

The 2025 revision [ISA-95-2025] acknowledges this by "reinforcing a common language, shared models, and structured interfaces between enterprise-level systems and shop-floor systems," but it still models information flow at the L3/L4 boundary — not the reactive event mesh that modern systems require.

> "The architecture of tomorrow's manufacturing systems will be fundamentally different from today's."
> -- [ISA95-BEYOND-PYRAMID]

#### Problem 3: No Entity Lifecycle Events

ISA-95 models **information flows between levels**, not **state transitions within levels**. It defines:
- What data crosses the L3/L4 boundary (production schedules, performance reports)
- What activities occur at each level (scheduling, dispatching, tracking)

But it does NOT define:
- What happens when a Machine entity transitions from RUNNING to FAULTED
- How that state change propagates to parent entities (Line, Area, Plant)
- What the cascading effects are on sibling entities
- How state changes compose across the hierarchy

This is the gap our RFC must fill: **entity lifecycle events as first-class citizens in a reactive ISA-95 hierarchy.**

### 1.2 What ISA-95 Gets Right

Despite its limitations, ISA-95 provides essential foundations:

| Contribution | Value for Our RFC |
|---|---|
| **Equipment hierarchy model** [ISA-95-1] | Enterprise > Site > Area > Line > WorkCell > Machine > Device > Sensor — our entity model follows this exactly |
| **Activity model** [ISA-95-1, Part 3] | Defines *what* activities occur, separable from *how* — we can map activities to event handlers |
| **Messaging model** [ISA-95-6] | Defines information exchange patterns between L3/L4 — extendable to all levels |
| **Information exchange profiles** [ISA-95-8] | Framework for standardized integration profiles — our RPC contracts are a modern equivalent |
| **Terminology** [ISA-95-2] | Common language for production, maintenance, quality, inventory operations |

The ISA-95 activity model, notably, already separates *activities* from *implementations*:

> "The ISA-95 activity model defines the specific activities that must occur in a manufacturing organization, but without reference to systems that implement the activities."
> -- [ISA95-BEYOND-PYRAMID]

This separation is exactly what enables our reactive reinterpretation: the activities remain, but the implementation becomes event-driven reactive streams.

---

## 2. Industry 4.0 Extensions: RAMI 4.0, OPC UA, NOA, AAS, UNS {#2-industry-40-extensions}

Several frameworks have emerged to address ISA-95's limitations. Each attacks a different facet of the problem. None fully solves the reactive gap.

### 2.1 RAMI 4.0 (Reference Architecture Model Industrie 4.0)

RAMI 4.0, developed by the German Electrical and Electronic Manufacturers' Association (ZVEI), extends ISA-95 into a three-dimensional model:

| Axis | Dimension | Extension Beyond ISA-95 |
|------|-----------|------------------------|
| **Hierarchy** (vertical) | Product → Field Device → Control → Station → Work Centers → Enterprise → Connected World | Adds **Product** below L0 (smart products as stream sources) and **Connected World** above L4 (inter-enterprise events, supply chain) |
| **Architecture** (horizontal) | Asset → Integration → Communication → Information → Functional → Business | Decomposes each level into six functional layers — **Communication** is where our reactive event mesh lives |
| **Lifecycle** (depth) | Type → Instance, Development → Maintenance/Usage | Adds temporal dimension — entities have lifecycle phases that emit different event signatures |

**What RAMI 4.0 gets right:**
- SOA (Service-Oriented Architecture) as foundational principle — each component provides services through standardized protocols
- Equipment hierarchy extended to include smart products and inter-enterprise scope
- Explicit Communication layer acknowledgment

**Where RAMI 4.0 falls short for reactive systems:**
- The Communication layer is described abstractly — no concrete pub/sub, streaming, or backpressure semantics
- Still fundamentally describes **layers**, not **event flows between layers**
- No formalization of state propagation rules (upward, downward, lateral)
- No delivery SLA differentiation per hierarchy level

Sources: [RAMI-4.0], [RAMI40-EC]

### 2.2 Asset Administration Shell (AAS) — IEC 63278

The Asset Administration Shell is the standardized digital twin for Industry 4.0. Per IEC 63278-1:2023, every physical asset gets a virtual counterpart that:

- Structures data in **submodels** (identification, technical specs, operational status, documentation)
- Can be updated in real-time via OPC UA or HTTP/REST
- Enables "two or more software applications to exchange information in a trusted and secure way"

**Reactive properties of AAS:**
- Submodels can be **observed** for changes — a natural fit for reactive subscriptions
- The AAS specification supports events: "a digital twin connects to an AS, automatically receives data from it, performs computations, and sends instructions back to it"
- Each asset's AAS participates in the hierarchy — Enterprise AAS contains references to Site AASes, which contain Plant AASes, etc.

**Relevance to our design:**
Our `Schema.TaggedClass` entities (Enterprise, Site, Plant, etc.) are effectively AAS instances with reactive stream capabilities. The key difference: AAS is a *representation* standard (what data an asset exposes), while our design adds *behavioral* semantics (how state changes propagate through the hierarchy).

| AAS Concept | Our Equivalent | Gap |
|-------------|---------------|-----|
| Submodel | Entity fields + state graphs | AAS lacks state machine formalization |
| Observation | Stream subscription | AAS observation is pull-based; ours is push-based |
| Administration Shell | Entity + EventDistribution | AAS has no native pub/sub fan-out |
| Digital Twin | Entity + ReactivityBridge | AAS lacks hierarchical propagation rules |

Sources: [AAS-SPEC], [IEC-63278], [AAS-DT-2024]

### 2.3 OPC UA PubSub (IEC 62541-14)

OPC UA PubSub (Part 14 of the OPC UA specification) adds publish-subscribe messaging to the traditional OPC UA client-server model:

- **Transport options:** UDP (multicast), MQTT, AMQP
- **Publisher/Subscriber decoupling:** Publishers don't know subscribers; brokerless or brokered
- **TSN integration:** OPC UA PubSub + Time-Sensitive Networking (IEEE 802.1) for deterministic delivery at field level
- **Data encoding:** UA Binary or JSON, with metadata for self-describing messages

**As a reactive layer on ISA-95:**
OPC UA PubSub operates primarily at L1-L2 (field device to supervisory control). It provides:
- Real-time sensor data distribution (cyclic publisher)
- Event notification (acyclic publisher triggered by state changes)
- Deterministic delivery when combined with TSN

**Limitations for metropolitan-scale reactive systems:**
- Designed for **plant-floor** scope, not metropolitan scale (multi-site)
- No native concept of hierarchical event propagation — it's flat pub/sub
- No built-in backpressure or stream processing semantics
- No concept of event tiers (hot/warm/cold path)
- Topic structure is OPC UA node-based, not ISA-95 hierarchy-based

**Our assessment:** OPC UA PubSub is an excellent **L0-L2 transport** that feeds INTO our reactive hierarchy, but it cannot BE the reactive hierarchy. We consume OPC UA PubSub events through the Sparkplug/MQTT adapter layer and route them into the NATS-based event distribution.

Sources: [UNS-PROSYS], [OPC-UA-14], [OPCUA-TSN-2018]

### 2.4 NAMUR Open Architecture (NOA)

NAMUR Open Architecture, developed by the chemical and pharmaceutical process industry (NAMUR NE 175), takes a fundamentally different approach: instead of replacing ISA-95, it adds a **second communication channel** as a sidecar:

```
Traditional Automation (unchanged)     NOA Sidecar Channel
┌──────────────────────────┐          ┌──────────────────────┐
│  L4: ERP/Business        │          │  IT Applications     │
│  L3: MES/MOM             │          │  Analytics, ML, Cloud│
│  L2: SCADA               │ ←VoR→   │  Monitoring & Optim. │
│  L1: PLC/DCS             │          │  Condition Monitoring│
│  L0: Sensors/Actuators   │──────→   │  Data Aggregation    │
└──────────────────────────┘          └──────────────────────┘
         Core Process                      M+O (Monitoring
         Automation                        & Optimization)
```

**Key NOA concepts:**

1. **Second Channel:** Data flows from L0 sensors to IT applications WITHOUT passing through the automation layers (L1-L3). This bypasses ISA-95's hierarchical bottleneck.

2. **Verification of Request (VoR):** When the IT sidecar wants to send commands BACK to the automation system, it must pass through a security gateway with explicit verification. This addresses the reactive gap (top-down commands) while maintaining safety.

3. **Decoupled lifecycles:** OT equipment (20-30 year lifecycle) evolves independently from IT applications (2-3 year lifecycle). This is critical for brownfield installations.

**Relevance to our design:**
NOA validates our architectural instinct: the reactive event mesh is a **parallel structure** alongside traditional automation, not a replacement for it. Our EventDistribution + HolonetBridge is architecturally equivalent to NOA's second channel:

| NOA Concept | Our Equivalent |
|-------------|---------------|
| Second Channel | EventDistribution (NATS-based) |
| VoR (Verification of Request) | Command subjects with authorization middleware |
| M+O Applications | WebSocket subscribers, dashboards, analytics |
| Data Diode (one-way) | HolonetBridge with configurable ingress/egress |

**Critical insight from NOA:** The reactive layer should be **read-heavy, write-guarded**. Events flow freely upward and laterally, but downward commands (parent-to-child) require explicit authorization barriers.

Sources: [NAMUR-NOA], [NOA-BELDEN], [NOA-OPCUA-2023], [NOA-VS-UNS]

### 2.5 Unified Namespace (UNS)

The Unified Namespace is the most radical departure from ISA-95's pyramid model. UNS replaces the hierarchical data flow with a **centralized event hub**:

**Core principle:** All systems communicate exclusively through a single namespace. Each system needs only one integration point (publish/subscribe to the namespace), not N point-to-point connections.

```
Traditional ISA-95:                    Unified Namespace:

  ERP ←→ MES ←→ SCADA ←→ PLC          ┌───────────────────┐
  (N×N point-to-point)                 │   UNS (MQTT/NATS) │
                                       │   Topic Hierarchy  │
                                       │   ISA-95 Semantic  │
                                       └─┬───┬───┬───┬───┬─┘
                                         │   │   │   │   │
                                        ERP MES SCADA PLC Analytics
                                       (1×N hub-and-spoke)
```

**Key UNS characteristics:**
- **Semantic organization:** Topics mirror ISA-95 hierarchy: `enterprise/site/area/line/machine/sensor`
- **Event-driven:** Publish-subscribe model; changes propagate immediately to all subscribers
- **MQTT as transport:** Most implementations use MQTT 5 with retained messages as state store
- **Single Source of Truth:** UNS IS the current state — no separate databases needed for operational data

**UNS topic structure mirrors ISA-95:**
```
enterprise/
  site-1/
    area-north/
      line-A/
        machine-1/
          sensor-temp/     → {"value": 42.3, "ts": "..."}
          sensor-pressure/ → {"value": 101.2, "ts": "..."}
          state/           → {"status": "running", "oee": 0.87}
        machine-2/
          ...
      line-B/
        ...
    area-south/
      ...
```

**Where UNS aligns with our design:**
- ISA-95 hierarchy encoded in topic structure (we do this in NATS subjects)
- Event-driven, publish-subscribe semantics (our EventDistribution)
- Wildcard subscriptions for level-scoped monitoring (NATS `>` wildcards)
- Single namespace for all operational data

**Where UNS falls short:**
- No formal state machine definitions (our state graphs formalize transitions)
- No propagation rules (child-to-parent, parent-to-child semantics)
- No delivery tier differentiation (hot/warm/cold path)
- MQTT alone lacks JetStream-grade persistence, replay, and consumer groups
- No concept of event sourcing or EventLog integration
- Retained messages as state store is fragile (no history, no audit trail)

**Our assessment:** UNS is the correct *topology* (hub-and-spoke, semantic topics) but lacks the *behavioral semantics* (state machines, propagation rules, delivery tiers) that our reactive ISA-95 model adds. Our NATS subject hierarchy (`iiot.readings.{siteId}.{areaId}.{lineId}.{deviceId}`) is essentially a UNS implemented with NATS instead of MQTT, augmented with formal propagation rules and tiered delivery guarantees.

Sources: [UNS-HIVEMQ], [UNS-CEDALO], [UNS-CIRRUSLINK], [UNS-FLOWFUSE], [UMH]

### 2.6 B2MML V7 Operations Events

B2MML (Business to Manufacturing Markup Language) V7, maintained by MESA International, introduced **Operations Events** as a first-class concept:

> "Operations Events are a new model in ISA-95 that supports event driven architectures. Event driven architectures are often applied to integration of systems made up of loosely coupled software components and services."

The Operations Event model:
- Reduces message complexity by packaging related data with common context
- Defines event classes (types) and event instances (occurrences)
- Supports event subscription and notification patterns
- Uses XML/XSD schemas for event payloads

**Relevance:** B2MML V7 Operations Events validate our event schema approach (`Schema.TaggedClass` for each event type) and confirm that the ISA-95 community itself recognizes the need for event-driven patterns. However, B2MML events are designed for L3/L4 integration (ERP-MES boundary), not the full L0-L4 reactive hierarchy we require.

Sources: [B2MML-V7], [MESA-MODEL]

### 2.7 Synthesis: The Reactive Gap

| Framework | Addresses | Missing for Reactive ISA-95 |
|-----------|-----------|---------------------------|
| **RAMI 4.0** | 3D model, lifecycle dimension, SOA | No event flow semantics, no propagation rules |
| **AAS (IEC 63278)** | Standardized digital twin, submodel observation | Pull-based observation, no hierarchical propagation |
| **OPC UA PubSub** | L0-L2 real-time pub/sub, TSN integration | Plant-floor scope only, flat topics, no backpressure |
| **NOA** | Second channel sidecar, VoR for commands, lifecycle decoupling | Monitoring-only focus, no formalized state machines |
| **UNS** | Hub-and-spoke topology, semantic topics, event-driven | No state machines, no propagation rules, no delivery tiers |
| **B2MML V7** | Operations Events as first-class concept | L3/L4 boundary only, XML-heavy, batch-oriented |

**What none of them provide:**
1. Formal state transition graphs per equipment level
2. Defined upward/downward/lateral propagation rules
3. Tiered delivery guarantees (hot/warm/cold path) mapped to ISA-95 levels
4. Event sourcing with replay semantics for compliance
5. Metropolitan-scale fan-out with backpressure management

**This is our contribution.** The Reactive ISA-95 model fills these gaps by combining:
- ISA-95's equipment hierarchy (the ontology)
- UNS's hub-and-spoke topology (the transport pattern)
- NOA's sidecar philosophy (the deployment model)
- AAS's digital twin concept (the entity model)
- Novel additions: state graphs, propagation rules, delivery tiers, event sourcing

---

## 3. Reactive ISA-95 — A New Model

### 3.1 Core Thesis: Entities as Observable Streams

Traditional ISA-95: Each level is an **information processing layer** that receives batch reports from below and sends aggregated reports above.

Reactive ISA-95: Each entity in the hierarchy is a **reactive stream source** that:
1. **Emits state transitions** as they occur (not on polling cycles)
2. **Derives state from children** (reactive upward propagation)
3. **Receives commands from parents** (reactive downward propagation)
4. **Observes siblings** for lateral effects (reactive lateral propagation)

```
Traditional ISA-95:            Reactive ISA-95:

  L4 ← batch reports           L4 ←→ Stream<SiteAggregate>
  ↑                              ↑↓
  L3 ← periodic updates         L3 ←→ Stream<PlantState | LineState>
  ↑                              ↑↓
  L2 ← polled data              L2 ←→ Stream<MachineState | AlarmEvent>
  ↑                              ↑↓
  L1 ← scan cycles              L1 ←→ Stream<SensorReading | DeviceState>
  ↑                              ↑↓
  L0  sensors                   L0  Stream<RawMeasurement>
```

### 3.2 ISA-95 Levels as Event Routing Domains

Instead of "information flow layers," each ISA-95 level becomes an **event routing domain** with distinct characteristics:

| Level | Traditional Role | Reactive Role | Event Characteristics |
|-------|-----------------|---------------|----------------------|
| **L0-L1** | Physical process + sensing | **Telemetry Domain** | High volume, low latency, fire-and-forget. Thousands of readings/sec per device. |
| **L2** | Supervisory control | **Operational Domain** | Medium volume, sub-second delivery. State transitions, alarms, operator commands. |
| **L3** | Manufacturing operations | **Orchestration Domain** | Lower volume, seconds-to-minutes. Schedules, work orders, quality events, OEE. |
| **L4** | Business systems | **Analytics Domain** | Low volume, minutes-to-hours. KPIs, compliance reports, business decisions. |

Each domain has its own:
- **Delivery SLA** (latency budget)
- **Retention policy** (how long events persist)
- **Backpressure strategy** (what happens when consumers are slow)
- **Ordering guarantee** (causal? total? none?)

### 3.3 Reactive Hierarchy Relationships

In a reactive ISA-95, hierarchy relationships are themselves reactive — parent state is a **live derivation** of child states:

```
SiteHealth = f(PlantHealth[]) = aggregate(children, worst-of)
PlantHealth = f(AreaHealth[]) = aggregate(children, weighted)
AreaHealth = f(LineHealth[]) = aggregate(children, production-weighted)
LineHealth = f(WorkCellHealth[]) = aggregate(children, bottleneck)
WorkCellHealth = f(MachineHealth[]) = aggregate(children, critical-path)
MachineHealth = f(SensorHealth[], EquipmentState, AlarmState)
```

This means: when a single sensor goes offline deep in the hierarchy, the health degradation **propagates upward** in real-time through every parent entity, all the way to the Site level.

### 3.4 The Activity Model as Event Handlers

ISA-95 Part 3 defines eight categories of manufacturing operations:

1. Production Operations Management
2. Maintenance Operations Management
3. Quality Operations Management
4. Inventory Operations Management
5. (+ 4 sub-categories for scheduling, dispatching, execution, data collection)

In a reactive model, each activity category maps to an **event handler group**:

| ISA-95 Activity | Reactive Handler | Events Consumed | Events Produced |
|---|---|---|---|
| Production Scheduling | ScheduleHandler | WorkOrder.Created, Equipment.StateChanged | Schedule.Updated, Dispatch.Commanded |
| Production Dispatching | DispatchHandler | Schedule.Updated, Resource.Available | WorkOrder.Dispatched, Equipment.Reserved |
| Production Execution | ExecutionHandler | WorkOrder.Dispatched, Sensor.Reading | Production.Started, Production.Completed |
| Production Data Collection | DataCollectionHandler | Sensor.Reading, Equipment.StateChanged | OEE.Calculated, Performance.Reported |
| Maintenance Scheduling | MaintenanceHandler | Equipment.FaultDetected, Alarm.Raised | WorkOrder.Created, Equipment.Reserved |
| Quality Testing | QualityHandler | Sample.Collected, Measurement.Taken | Quality.Passed, Quality.Failed, Hold.Created |

---

## 4. Academic Research on Reactive Manufacturing

### 4.1 Event-Driven Manufacturing Process Management

Grieves et al. (Springer, 2012) proposed an **Event-Driven Manufacturing Process Management** approach that adapts Business Process Management to ISA-95 levels 2, 3, and 4. Key contribution:

> "The event-driven architecture is considered as the basis to design a unified modeling methodology which enables near real time event stream processing."

This validates our approach: treating ISA-95 levels as event stream processing domains rather than data reporting layers.

Source: [GRIEVES-EDA-2012]

### 4.2 Event-Driven System Architecture for Smart Manufacturing ("Tweeting Factory")

Bader et al. (Springer, 2022) proposed an event-driven system architecture for smart manufacturing called the "Tweeting Factory." The architecture automates production data acquisition and integration through event-driven patterns, treating manufacturing events as first-class messages that flow through a distributed system.

Source: [BADER-2022]

### 4.3 The Paradigm Shift in Smart Manufacturing System Architecture (NIST)

Lu et al. (NIST, 2016) documented the fundamental architectural shift:

> "Smart manufacturing systems are organized as networks of cooperating manufacturing components specialized for different functions as opposed to the previous organization characterized by rigid, hierarchically-integrated layers of application components."

This is exactly the shift from hierarchical ISA-95 to reactive ISA-95: from layers to **cooperating networks** of reactive entities.

Source: [LU-NIST-2016]

### 4.4 ISA-95 Part 6 (Messaging) and Part 8 (Cloud Integration)

ISA-95 itself has evolved toward event-driven patterns:

- **Part 6** (Messaging Service Model): Defines messaging services for information exchanges across L3/L4 and within L3. Driven by "real-world needs of practitioners."
- **Part 8** (Information Exchange Profiles, 2020): Defines framework for standardized integration profiles, applicable to cloud-based architectures.

The 2025 revision (ANSI/ISA-95.00.01-2025) explicitly acknowledges:
> "The shift to containerized workloads and data-centric architectures... aligns with the increasing need for intelligent, flexible manufacturing systems."

Sources: [ISA-95-1], [ISA-95-2025]

### 4.5 RAMI 4.0 Extension Model

The Reference Architecture Model Industrie 4.0 (RAMI 4.0) extends ISA-95 in three critical ways:

1. **Product level below L0**: Smart products as participants in the event mesh
2. **Connected World above L4**: Inter-enterprise event routing (supply chain events)
3. **Asset Administration Shell**: Digital twin standard — each physical asset has a digital counterpart that participates in the reactive hierarchy

RAMI 4.0 decomposes component architecture into six layers: Business, Functional, Information, Communication, Integration, and Asset. The **Communication layer** is where our reactive event mesh lives.

Sources: [RAMI-4.0], [RAMI40-EC]

### 4.6 MESA Model — Event-Driven MES

MESA defines an MES as a dynamic application "that drives execution of manufacturing operations, and by using current and accurate data, MES guides, triggers and reports plant activities as events." This explicitly frames manufacturing operations as event-driven, not poll-driven.

Source: [MESA-MODEL]

### 4.7 Solace: Modeling Events in Accordance with ISA-95

Solace published a practical approach for mapping ISA-95 to event-driven architecture, proposing topic hierarchies that mirror the equipment hierarchy:

```
ENTERPRISE/SITE/AREA/PROCESSCELL/UNIT
ENTERPRISE/SITE/AREA/PRODUCTIONUNIT
ENTERPRISE/SITE/AREA/PRODUCTIONLINE/WORKCELL
```

Key insight: the ISA-95 equipment hierarchy maps **directly** to event topic hierarchies, providing "semantic context" at each level. Filtering subscriptions by level enables selective event consumption.

Source: [SOLACE-ISA95]

### 4.8 Auto-configurable Holonic Event-Driven Architecture (2017)

Leitao et al. proposed an ontology-based holonic event-driven architecture for smart manufacturing that enables distributed components to "be configured autonomously and collaborate with each other." The holonic approach maps well to ISA-95 hierarchy: each holon (autonomous unit) corresponds to an equipment entity that makes local decisions while participating in a larger organizational structure.

Key insight: self-configuration through ontology aligns with our state graph approach — entities know their valid transitions and can autonomously validate commands before propagating them.

Source: [LEITAO-2017]

### 4.9 MLOps-Enabled Event-Driven Architecture for Steel Production (2025)

Recent work by Perez et al. (arXiv 2025) demonstrates a production-grade event-driven architecture for steel manufacturing that "embeds a digital twin into edge compute infrastructure and leverages a micro-services-based architecture for integrating MLOps pipelines that receive and process sensorial data from PLCs."

This validates our approach of treating the reactive hierarchy as an edge-to-cloud pipeline, with local processing (entity state machines) close to the equipment and aggregated views (OEE, KPIs) computed further up.

Source: [PEREZ-2025]

### 4.10 Rhize: Event-Driven Manufacturing Data Hub

Rhize argues that ISA-95's reputation as "outdated" is actually a misdiagnosis — the problem is data-centric (relational database) implementations, not the standard itself:

> "The data is mostly irrelevant on its own. The events produced by the data are everything."
> "The architecture of an MDH must be event-driven, not data-driven."

Their solution: knowledge graphs + event-driven architecture, where ISA-95 entities become graph nodes and events flow along edges.

Source: [RHIZE-ISA95]

---

## 5. Concrete Design Proposal: Propagation Rules

> **Codebase Grounding**: All entity types referenced below exist as `@effect/cluster` Entity definitions with `@effect/experimental` Machine-backed state graphs. See Appendix A for the complete file-to-rule mapping.

### 5.1 Upward Propagation (Child -> Parent)

When a child entity state changes, the parent's **derived state** updates reactively. Rules:

#### Rule U-1: Equipment State Roll-Up (Worst-Of) {#rule-u1}

```
When Machine.state transitions to FAULTED:
  1. Machine emits EquipmentStateChanged(FAULTED) event           [< 100ms]
  2. Parent WorkCell recomputes health:
     - If Machine is on critical path → WorkCell.health = DEGRADED [< 500ms]
     - If Machine has redundancy → WorkCell.health = OPERATIONAL   [< 500ms]
  3. Parent Line recomputes health from WorkCell states            [< 1s]
  4. Parent Area, Plant, Site cascade upward                       [< 2s total]
```

**Aggregation function:** `worst-of` with criticality weighting
- Critical-path child FAULTED -> parent DEGRADED
- Non-critical child FAULTED -> parent OPERATIONAL (reduced capacity)
- Multiple children FAULTED -> parent CRITICAL if below threshold
- All children STOPPED -> parent STOPPED

> **Codebase**: Machine state graph: `src/lib/iiot/machines/graphs/machine-asset-graph.ts`. Machine entity handler that delegates to Machine: `src/lib/iiot/entity/MachineAssetEntity.ts:211` (`MachineAssetEntityHandlers`). Equipment state transitions tracked by `src/lib/iiot/entity/EquipmentStateEntity.ts` (EVENT SOURCED per ADR-0012). EntityStack composes all 12 handlers at `src/lib/iiot/entity/EntityStack.ts:54-67`.

#### Rule U-2: Alarm Escalation {#rule-u2}

```
When Alarm fires at Device level:
  1. Alarm.Raised event emitted with priority + ISA-18.2 category  [< 100ms]
  2. Parent Machine evaluates: does alarm change equipment state?   [< 500ms]
     - Safety alarm → force EMERGENCY_STOP propagation
     - Process alarm → may trigger FAULTED if unacknowledged
  3. If equipment state changes → trigger Rule U-1                 [cascading]
  4. Alarm propagates to ALL ancestor entities for visibility      [< 1s]
```

**Alarm flood protection:** Per EEMUA 191, alarm propagation is **rate-limited at each level**:
- Max 10 alarms / 10 minutes before flood suppression activates
- First-in-fault tracking: only the root cause alarm escalates; consequential alarms are tagged but suppressed from operator view

> **Codebase**: Alarm entity: `src/lib/iiot/entity/AlarmEntity.ts:163-168` (`AlarmEntity = Entity.make(...)`). ISA-18.2 lifecycle (triggered -> acknowledged -> cleared) enforced by `src/lib/iiot/machines/AlarmMachine.ts`. Alarm state graph: `src/lib/iiot/machines/graphs/alarm-graph.ts`. `AlarmId` branded identifier: `src/lib/iiot/schemas/identifiers.ts:90-91`. Alarm events flow through EventDistribution at `src/lib/iiot/realtime/event-distribution.ts:49-55` (`AlarmEvent` schema).

#### Rule U-3: Sensor Health Propagation {#rule-u3}

```
When Sensor goes OFFLINE:
  1. SensorOffline event emitted                                   [< 500ms]
  2. Parent Device marks sensor-derived metrics as UNCERTAIN        [< 1s]
  3. Parent Machine evaluates: is sensor critical for state determination?
     - Yes → Machine.confidence = LOW, flag for operator review    [< 2s]
     - No → Machine.confidence = PARTIAL                           [< 2s]
  4. OEE calculations flag affected periods as "data quality: degraded"
```

> **Codebase**: Sensor asset entity: `src/lib/iiot/entity/SensorAssetEntity.ts:191-203` (`SensorAssetEntity = Entity.make(...)`). Sensor state graph with `active|calibrating|faulted|offline|needs_calibration|decommissioned` states: `src/lib/iiot/machines/graphs/sensor-graph.ts:59-66`. The `TakeOffline` transition (active/faulted -> offline) is the graph-validated equivalent of "Sensor goes OFFLINE" in U-3. `SensorAssetState` service: `src/lib/iiot/state/SensorAssetState.ts`. Sensor readings distinct from sensor assets: reading entity at `src/lib/iiot/entity/SensorEntity.ts`.

#### Rule U-4: Production Metrics Roll-Up {#rule-u4}

```
When Machine completes production cycle:
  1. ProductionCompleted event with count, quality, duration        [< 1s]
  2. Parent WorkCell updates shift totals                           [< 5s]
  3. Parent Line recalculates OEE                                  [< 30s]
  4. Parent Area/Plant/Site aggregate for dashboard                 [< 2min]
```

### 5.2 Downward Propagation (Parent -> Child)

When a parent entity issues a command or changes operational mode, children react:

#### Rule D-1: Emergency Shutdown (Safety-Critical)

```
When Plant declares EMERGENCY_SHUTDOWN:
  1. Plant emits EmergencyShutdown command event                    [< 100ms]
  2. ALL child Areas receive and propagate                         [< 200ms]
  3. ALL child Lines, WorkCells, Machines receive                  [< 500ms]
  4. Each Machine transitions to EMERGENCY_STOP state              [< 1s]

  NOTE: This is a SOFTWARE-LEVEL propagation for state tracking.
  The ACTUAL safety shutdown happens through SIS/ESD systems (L1)
  with hard-realtime guarantees (< 10ms). Our propagation tracks
  the STATE of the shutdown, not the shutdown itself.
```

**Critical distinction:** We propagate the *awareness* of shutdown, not the *execution*. The physical safety system operates independently at L1. Our reactive hierarchy ensures every entity's STATE reflects the shutdown within seconds, so dashboards, reports, and downstream systems are accurate.

> **Codebase**: Plant entity: `src/lib/iiot/entity/PlantEntity.ts:208-219` (`PlantEntity = Entity.make(...)`) with `EmergencyShutdownRpc` at line 148. Plant state graph: `src/lib/iiot/machines/graphs/plant-graph.ts:42-48` defines `PlantStateNode` with 6 states including `emergency_shutdown`. The `operational -> emergency_shutdown` transition is validated at line 102: `Graph.addEdge(mutable, nodeIndices.operational, nodeIndices.emergency_shutdown, 'EmergencyShutdown')`. Plant handler boots Machine at `PlantEntity.ts:248-249`: `const actor = yield* Machine.boot(plantMachine)`.

#### Rule D-2: Mode Change Propagation

```
When Area switches production mode (e.g., Product A -> Product B):
  1. Area emits ModeChange(ProductB) event                         [< 500ms]
  2. Child Lines evaluate: does mode change affect my configuration?
     - Yes → Line enters CHANGEOVER state                          [< 1s]
     - No → Line continues current mode                            [< 1s]
  3. Affected WorkCells/Machines receive new recipe parameters      [< 5s]
  4. Equipment reserved/released per new production schedule        [< 30s]
```

> **Codebase**: Line entity: `src/lib/iiot/entity/LineEntity.ts:223-237` (`LineEntity = Entity.make(...)`). Line state graph: `src/lib/iiot/machines/graphs/line-graph.ts:50-57` with `LineStateNode` including `changeover` state. The `running -> changeover` transition is `BeginChangeover`: line-graph.ts validates via `Graph.addEdge`. Line handler: `LineEntityHandlers` at LineEntity.ts:275.

#### Rule D-3: Maintenance Window Propagation

```
When Line enters SCHEDULED_MAINTENANCE:
  1. Line emits MaintenanceScheduled with window + affected assets  [< 1s]
  2. Child WorkCells transition to MAINTENANCE mode                [< 2s]
  3. Child Machines transition to MAINTENANCE mode                  [< 5s]
  4. Active work orders on affected equipment are rescheduled       [< 1min]
  5. Parent Area recalculates capacity (excludes line from OEE)    [< 30s]
```

> **Codebase**: Line `maintenance` state: `src/lib/iiot/machines/graphs/line-graph.ts:56`. The `idle|running -> maintenance` transition uses `EnterMaintenance`, and `maintenance -> idle` uses `CompleteMaintenance`. Plant also has `maintenance_shutdown` state: `src/lib/iiot/machines/graphs/plant-graph.ts:47`. Work order rescheduling is managed by `src/lib/iiot/entity/WorkOrderEntity.ts` (EVENT SOURCED — FDA 21 CFR Part 11 lifecycle).

### 5.3 Lateral Propagation (Sibling -> Sibling)

When one entity's state affects peer entities:

#### Rule L-1: Starvation/Blocking Cascade

```
When Line A enters STARVED state (no input material):
  1. Line A emits LineStarved event                                [< 1s]
  2. Parent Area evaluates material flow graph:
     - Is Line B the upstream supplier? → Alert Line B operator    [< 5s]
     - Can material be rerouted from Line C? → Suggest reroute     [< 30s]
  3. Production scheduler receives StarvationEvent                 [< 1min]
     - Adjusts priority: Line B gets priority boost
     - Generates RebalanceCommand for affected lines
```

> **Codebase**: Line `starved` and `blocked` states: `src/lib/iiot/machines/graphs/line-graph.ts:54-55`. Transitions `MarkStarved`/`ClearStarved`/`MarkBlocked`/`ClearBlocked` are all graph-validated. Line RPCs: `MarkStarvedRpc` at `src/lib/iiot/entity/LineEntity.ts:157`, `MarkBlockedRpc` at line 173. Line handler delegates to Machine at `LineEntity.ts:286-287`: `const actor = yield* Machine.boot(lineMachine)`.

#### Rule L-2: Redundancy Failover

```
When Machine A (primary) enters FAULTED:
  1. Machine A emits EquipmentFaulted event                        [< 500ms]
  2. WorkCell evaluates redundancy configuration:
     - Machine B (standby) available? → Activate Machine B         [< 2s]
     - No standby? → Escalate to Line for rebalancing              [< 5s]
  3. Work orders reassigned from Machine A to Machine B            [< 30s]
```

#### Rule L-3: Quality Containment

```
When Machine A produces Quality.Failed result:
  1. QualityFailed event with batch ID, defect type                [< 1s]
  2. Sibling machines consuming same input material are alerted    [< 5s]
  3. Downstream machines receiving Machine A output:
     - Enter HOLD state pending quality review                     [< 10s]
  4. Quality system traces affected batch through all equipment    [< 1min]
```

---

## 6. Event Routing by ISA-95 Level

### 6.1 Event Category Matrix

| Event Category | Source Level | Volume | Latency SLA | Retention | Ordering |
|---|---|---|---|---|---|
| **Sensor Readings** | L0-L1 | 10K-100K msg/sec per plant | p99 < 2s | 24h hot, 90d warm, 7yr cold | Per-device causal |
| **Equipment State Changes** | L1-L2 | 10-100 msg/sec per plant | p99 < 3s | 30d hot, 1yr warm, 7yr cold | Per-entity causal |
| **Alarm Events** | L1-L2 | 1-10 msg/sec per plant (steady), 100+ during upset | p99 < 1s | 90d hot, 7yr cold | Per-device causal, global sequence for audit |
| **Production Events** | L2-L3 | 1-10 msg/sec per plant | p99 < 10s | 90d hot, 7yr cold | Per-work-order causal |
| **Quality Events** | L2-L3 | 0.1-1 msg/sec per plant | p99 < 30s | 7yr (regulatory) | Per-batch total order |
| **Schedule Events** | L3 | 0.01-0.1 msg/sec | p99 < 2min | 30d hot, 1yr cold | Total order within schedule |
| **Work Order Events** | L3 | 0.1-1 msg/sec | p99 < 1min | 90d hot, 7yr cold | Per-work-order total |
| **KPI/OEE Events** | L3-L4 | 0.01-0.1 msg/sec | p99 < 5min | 7yr | Eventually consistent |
| **Business Events** | L4 | 0.001 msg/sec | p99 < 1hr | 7yr+ | Total order within domain |

### 6.2 Delivery Tier Mapping

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: HOT PATH (Soft Realtime)                                │
│  SLA: p50 < 500ms, p99 < 3s, p999 < 10s                        │
│  Events: Sensor readings, equipment state, alarms                │
│  Consumers: Operator HMI, SCADA displays, alarm panels          │
│  Backpressure: Drop oldest (operator needs CURRENT state)        │
│  NATS: Core NATS pub/sub (no persistence needed for hot path)    │
├─────────────────────────────────────────────────────────────────┤
│  TIER 2: WARM PATH (Near-Realtime)                               │
│  SLA: p50 < 5s, p99 < 30s, p999 < 2min                         │
│  Events: Production, quality, work orders, OEE                   │
│  Consumers: MES dashboards, shift supervisor, quality systems    │
│  Backpressure: Buffer and batch (aggregation smooths gaps)       │
│  NATS: JetStream with limits retention                           │
├─────────────────────────────────────────────────────────────────┤
│  TIER 3: COLD PATH (Eventually Consistent)                       │
│  SLA: p50 < 1min, p99 < 1hr                                     │
│  Events: KPIs, business analytics, compliance records            │
│  Consumers: ERP, BI dashboards, regulatory systems               │
│  Backpressure: Never drop, buffer to disk                        │
│  NATS: JetStream with file storage, long retention               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Cross-Tier Event Promotion

Some events start in one tier and get promoted to another:

```
Sensor Reading (Tier 1: hot path, ephemeral)
  ↓ threshold breach detected
Alarm Event (Tier 1: hot path, but ALSO persisted to Tier 3 for audit)
  ↓ alarm changes equipment state
Equipment State Change (Tier 1: hot path + Tier 2: warm for OEE)
  ↓ state change affects production count
Production Event (Tier 2: warm path)
  ↓ shift complete
OEE Aggregate (Tier 3: cold path for reporting)
```

This is NOT a pipeline — events **fork** into multiple tiers simultaneously. A single equipment state change may produce events in all three tiers.

---

## 7. NATS Subject Hierarchy Mapping

### 7.1 Current Codebase Subjects

The platform already defines four IIoT NATS subjects (from `src/lib/iiot/realtime/iiot-subjects.ts`):

```
iiot.readings.{deviceId}       — Sensor telemetry (Tier 1)
iiot.alarms.{deviceId}         — Alarm lifecycle (Tier 1)
iiot.equipment.{equipmentId}   — Equipment state (Tier 1 + 2)
iiot.invalidations.{cacheKey}  — Cache coherence (internal)
```

### 7.2 Proposed Extended Subject Hierarchy

To support reactive ISA-95, the subject hierarchy should encode the **equipment hierarchy** in the topic structure, following the Solace ISA-95 event modeling pattern:

```
# TIER 1: Hot Path Subjects (Core NATS, no persistence)
iiot.readings.{siteId}.{areaId}.{lineId}.{deviceId}
iiot.alarms.{siteId}.{areaId}.{lineId}.{deviceId}
iiot.equipment.{siteId}.{areaId}.{lineId}.{equipmentId}

# TIER 2: Warm Path Subjects (JetStream, limits retention)
iiot.production.{siteId}.{areaId}.{lineId}.{workOrderId}
iiot.quality.{siteId}.{areaId}.{lineId}.{batchId}
iiot.workorder.{siteId}.{areaId}.{workOrderId}
iiot.oee.{siteId}.{areaId}.{lineId}

# TIER 3: Cold Path Subjects (JetStream, file storage, long retention)
iiot.kpi.{siteId}
iiot.compliance.{siteId}.{domain}
iiot.audit.{siteId}.{entityType}.{entityId}

# PROPAGATION Subjects (reactive hierarchy)
iiot.propagation.up.{siteId}.{entityType}.{entityId}
iiot.propagation.down.{siteId}.{entityType}.{entityId}
iiot.propagation.lateral.{siteId}.{areaId}.{entityType}

# COMMAND Subjects (downward reactive)
iiot.command.{siteId}.{areaId}.{lineId}.{equipmentId}
```

### 7.3 Wildcard Subscription Patterns

The hierarchical subject design enables **level-scoped subscriptions**:

```
# Shift supervisor: all alarms in their area
iiot.alarms.site-1.area-north.>

# Plant manager: all equipment state changes across all areas
iiot.equipment.site-1.>

# Operations VP: all KPIs across all sites
iiot.kpi.>

# OEE engine: all production events for a specific line
iiot.production.site-1.area-north.line-A.>

# Maintenance system: all equipment events across entire enterprise
iiot.equipment.>

# Quality system: all quality events for containment tracing
iiot.quality.site-1.>
```

### 7.4 JetStream Stream Configuration

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

### 7.5 Migration Path from Current Subjects

The current flat subjects (`iiot.readings.{deviceId}`) can coexist with the hierarchical subjects during migration:

1. **Phase 1**: Add hierarchical subjects alongside flat ones. Ingestion service publishes to both.
2. **Phase 2**: New consumers subscribe to hierarchical subjects. Old consumers continue on flat.
3. **Phase 3**: Deprecate flat subjects once all consumers migrated.

NATS subject mapping can handle this transparently:
```
# Map flat -> hierarchical using subject transforms
iiot.readings.{deviceId} → iiot.readings.{siteId}.{areaId}.{lineId}.{deviceId}
```

The mapping requires a device-to-hierarchy lookup, which the existing entity model already provides.

---

## 9. Manufacturing Network Reframe: Variable-Depth Hierarchy

> **Added in Revision 3 (2026-02-09)** — Incorporates the critical reframe: TMNL is NOT a single-enterprise IIoT platform. It is a **200K-organization manufacturing network** serving the Atlanta metropolitan area, where a 2-person machinist shop is a first-class participant alongside a 10,000-person aerospace facility.

### 9.1 The Hierarchy Collapse Problem

Sections 1-7 assume a fixed ISA-95 depth: Enterprise > Site > Area > Line > WorkCell > Machine > Sensor (7 levels). This assumption breaks for small manufacturers:

| Organization Type | Employees | Equipment | ISA-95 Levels Used | Hierarchy Reality |
|---|---|---|---|---|
| Aerospace facility | 10,000+ | 500+ machines | All 7 | Full hierarchy |
| Mid-size job shop | 50-200 | 20-50 machines | 4-5 | Site > Area > Machine > Sensor |
| Small CNC shop | 5-15 | 3-10 machines | 2-3 | Site > Machine > Sensor |
| Solo machinist | 1-2 | 1-3 machines | 1-2 | Machine > Sensor (the person IS the enterprise) |
| Mobile welding service | 1-3 | Hand-carried | 1 | Sensor only (location varies) |

**For 80% of the 200K organizations, 3 or more ISA-95 levels are empty.** Requiring them to model Enterprise > Site > Area > Line > WorkCell just to register a CNC machine is hostile UX and architecturally wasteful.

> **Codebase**: The current ISA-95 hierarchy is defined in branded identifiers at `src/lib/iiot/schemas/identifiers.ts:28-38` — `EquipmentLevel = Schema.Literal('enterprise', 'site', 'area', 'plant', 'line', 'workcell', 'machine', 'sensor', 'device')`. Nine branded ID types (EnterpriseId through DeviceId) at lines 46-79. The full 9-level entity set exists: `src/lib/iiot/entity/EnterpriseEntity.ts`, `SiteEntity.ts`, `AreaEntity.ts`, `PlantEntity.ts`, `LineEntity.ts`, `WorkCellEntity.ts`, `MachineAssetEntity.ts`, `DeviceEntity.ts`, `SensorAssetEntity.ts` — all composed in `EntityStack.ts:54-67`. **Variable-depth hierarchy (proposed in 9.2) is NOT yet implemented** — it would require changes to how `EquipmentLevel` and entity registration interact.

### 9.2 Variable-Depth Hierarchy

**Proposal: Depth-Independent Propagation (60% confidence)**

Instead of fixed 7-level hierarchy, treat entity depth as a runtime property:

```
Traditional (fixed depth):
  Enterprise → Site → Area → Line → WorkCell → Machine → Sensor

Variable-depth (runtime):
  Organization → [0..N intermediary levels] → Equipment → [0..N sensors]
```

**Rules:**
1. Every organization has at least ONE equipment entity (the thing that makes things)
2. Intermediate hierarchy levels are optional — created only when the organization has enough complexity to benefit
3. Propagation rules (U-1 through U-4, D-1 through D-3, L-1 through L-3) apply identically regardless of depth — they operate on **parent/child relationships**, not fixed level names
4. A solo machinist's CNC machine IS simultaneously the site, area, line, workcell, and machine
5. The system provides "virtual hierarchy" aliases so that cross-network queries work consistently

**Implementation pattern — Virtual Hierarchy:**

```
# Earl's Precision Machining (2 CNC machines, 1 employee)
org:earls-precision
├── equip:haas-vf2      (CNC mill — is also the "line" and "workcell")
│   ├── sensor:spindle-temp
│   ├── sensor:spindle-vib
│   └── sensor:coolant-flow
└── equip:haas-st20     (CNC lathe)
    ├── sensor:chuck-temp
    └── sensor:tool-wear

# Virtual hierarchy aliases (generated, not user-configured):
# org:earls-precision ALSO matches queries for site:*, area:*, line:*
# equip:haas-vf2 ALSO matches queries for workcell:*, machine:*
```

This means a network-level query like "show me all FAULTED machines across the network" returns Earl's CNC alongside Boeing's welding robots — both are "machines" in the query, despite living at different hierarchy depths.

### 9.3 The Fourth Propagation Direction: Outward

Sections 5.1-5.3 defined three propagation directions:
- **Upward** (child → parent): Sensor fault → Machine degraded → Line impacted
- **Downward** (parent → child): Emergency shutdown → all equipment stops
- **Lateral** (sibling → sibling): Starvation cascade, redundancy failover

The manufacturing network adds a fourth:

- **Outward** (organization → network): Entity state changes become **market signals**

#### Rule O-1: Capacity Advertisement

```
When Machine enters IDLE state and has no queued work orders:
  1. Organization publishes CapacityAvailable event to network    [consent-gated]
     - Machine capabilities (material, tolerance, certifications)
     - Estimated availability window
     - Geographic location (for logistics cost)
  2. Network marketplace matches available capacity with demand    [< 5s]
  3. Interested buyers receive anonymized capability match         [< 10s]
```

#### Rule O-2: Quality Signal

```
When Organization's defect rate drops below threshold:
  1. Organization publishes QualityMilestone to network            [consent-gated]
     - Certification level achieved
     - Process capability metrics (Cpk, Ppk)
     - Material specialization
  2. Network reputation system updates organization profile        [< 30s]
  3. Existing partners receive quality improvement notification    [< 1min]
```

#### Rule O-3: Collaborative Work Order

```
When Work Order exceeds single organization's capacity:
  1. Organization publishes CollaborativeOpportunity to network    [consent-gated]
     - Required capabilities (multi-machine, multi-process)
     - Timeline constraints
     - Quality requirements
  2. Network matches complementary organizations                   [< 30s]
  3. Potential partners receive collaboration invitation            [< 1min]
  4. Cross-org work order established (requires G-8 consistency)   [< 5min]
```

**Consent model**: Outward propagation is ALWAYS opt-in. Organizations choose:
- What events to share (capabilities, quality, availability)
- With whom (public network, trusted partners only, named organizations)
- At what granularity (exact capacity vs. "available" boolean)
- Time-boxed (share availability for next 4 hours only)

### 9.4 Implications for Propagation Rules

The existing rules (U-1 through L-3) need no modification — they operate within an organization's boundary. The variable-depth hierarchy only changes how many levels exist, not how propagation works between levels.

New outward propagation rules (O-1 through O-3) operate at the **network boundary** and have fundamentally different characteristics:

| Property | Intra-Org (U/D/L) | Cross-Org (O) |
|---|---|---|
| Trust model | Implicit (same org) | Explicit (consent-gated) |
| Latency SLA | Milliseconds to seconds | Seconds to minutes |
| Ordering | Causal per-entity | Eventually consistent |
| Data granularity | Full state detail | Anonymized/aggregated |
| Failure mode | Retry with backpressure | Graceful degradation, local-first |
| Persistence | JetStream per-entity | JetStream per-org-pair |

### 9.5 NATS Subject Hierarchy Extension

> **Codebase**: Current NATS subject specs at `src/lib/iiot/realtime/iiot-subjects.ts`. Four subjects: `IIoTReadingsSubject` (pattern: `iiot.readings.{deviceId}`), `IIoTAlarmsSubject` (`iiot.alarms.{deviceId}`), `IIoTEquipmentSubject` (`iiot.equipment.{equipmentId}`), `IIoTInvalidationsSubject` (`iiot.invalidations.{cacheKey}`). These use `createSubjectSpec()` from `src/lib/holonet/subject/schemas.ts`. The `HolonetBridge` at `src/lib/iiot/realtime/holonet-bridge.ts:88-91` bridges local events to/from NATS via `NatsPubSubService`. **The `network.*` and `marketplace.*` subjects proposed below are NOT yet implemented** — they would require new subject specs and a cross-org HolonetBridge extension.

The Section 7 subject hierarchy extends for outward propagation:

```
# Intra-org subjects (unchanged from Section 7)
iiot.readings.{orgId}.{siteId}.{areaId}.{lineId}.{deviceId}
iiot.alarms.{orgId}.{siteId}.{areaId}.{lineId}.{deviceId}
iiot.equipment.{orgId}.{siteId}.{areaId}.{lineId}.{entityId}

# Network subjects (new — outward propagation)
network.capacity.{orgId}.{capabilityClass}
network.quality.{orgId}.{certLevel}
network.collaboration.{orgId}.{workOrderType}

# Marketplace subjects (aggregated views)
marketplace.available.{region}.{capabilityClass}
marketplace.match.{requestId}
marketplace.reputation.{orgId}

# Variable-depth: wildcard subscriptions work regardless of depth
iiot.equipment.{orgId}.>          # All equipment events for an org (any depth)
network.capacity.*.cnc-milling    # All CNC milling capacity across network
```

For organizations with collapsed hierarchy, unused segments are omitted:

```
# Boeing (full hierarchy):
iiot.equipment.boeing.sea-tac.wing-assembly.line-7.wc-3a.robot-42

# Earl's Precision (collapsed — no site/area/line/workcell):
iiot.equipment.earls-precision.haas-vf2

# Both match: iiot.equipment.*.>
```

### 9.6 Edge-First Architecture

> **Codebase**: The EventDistribution service (`src/lib/iiot/realtime/event-distribution.ts:127-130`) is the local event hub. It uses ChannelService broadcast outlets for fan-out (lines 169-199 register 4 channels with maxLag backpressure). The ReactivityBridge (`src/lib/iiot/realtime/reactivity-bridge.ts:82-85`) provides the handler-to-distribution adapter. **Local-first operation is architecturally supported**: EntityStack (`src/lib/iiot/entity/EntityStack.ts:90-93`) composes entity handlers with in-memory state services — no network dependency for intra-org state transitions. Edge-to-cloud bridging happens through HolonetBridge's fire-and-forget NATS publish pattern (holonet-bridge.ts:100-128).

For the manufacturing network, many participants have unreliable internet connectivity. The architecture must be **edge-first, cloud-optional** [OFFLINE-FIRST-IOT]:

1. **Local-first operation**: All intra-org propagation (U/D/L rules) works without internet. Entity state machines, alarm detection, and equipment monitoring run at the edge.
2. **Store-and-forward**: Outward events queue locally when disconnected. NATS leaf node reconnects and drains the queue when connectivity returns.
3. **Conflict resolution**: If two organizations independently modify a shared work order during a partition, CRDT-based merge resolves the conflict on reconnect.
4. **Progressive enhancement**: Connected organizations get real-time marketplace matching. Disconnected organizations get eventual consistency when they come back online.

### 9.7 Academic Context

The shared manufacturing concept [SHARED-MFG-2020] defines the theoretical foundation: manufacturing resources (equipment, labor, knowledge) are shared across organizational boundaries through platform intermediation. Jiang and Li [SHARED-FACTORY-2019] formalize the "shared factory" as a production node in social manufacturing.

The CIRP 2023 keynote [PLATFORM-MFG-CIRP] by Sauer, Tolio, Monostori, and Vancza provides the most comprehensive academic framework for platform-based manufacturing: "a manufacturing paradigm where digital platforms intermediate between manufacturing resource providers and consumers, enabling dynamic capacity sharing and collaborative production."

For federated trust across organizations, IoTFeds [IOTFEDS-2024] proposes decentralized management of IoT platform federations. Decentralized identifiers (DID) [DID-IOT-2025] enable self-sovereign identity for IoT devices — each organization controls its own identity without a central authority.

Sources: [SHARED-MFG-2020], [SHARED-FACTORY-2019], [PLATFORM-MFG-CIRP], [IOTFEDS-2024], [DID-IOT-2025], [OFFLINE-FIRST-IOT], [XOMETRY-PLATFORM]

---

## 8. Bibliography

All references use canonical citation keys. Full URLs and metadata are maintained in the project bibliography:

> **See [`docs/specifications/bibliography.md`](bibliography.md)**

### Citation Keys Used in This Document

#### Standards
[ISA-95-1], [ISA-95-2], [ISA-95-6], [ISA-95-8], [ISA-95-2025], [IEC-63278], [AAS-SPEC], [OPC-UA-14], [NAMUR-NOA], [RAMI-4.0]

#### Frameworks & Models
[B2MML-V7], [MESA-MODEL], [MESA-SMART], [RAMI40-EC]

#### Industry Analysis
[ISA95-AGE-I40], [ISA95-BEYOND-PYRAMID], [ISA95-SMART-MFG], [ISA-95-2025], [RHIZE-ISA95], [SOLACE-ISA95], [NOA-BELDEN], [NOA-VS-UNS], [UNS-HIVEMQ], [UNS-CEDALO], [UNS-CIRRUSLINK], [UNS-FLOWFUSE], [UNS-PROSYS], [UMH]

#### Academic Papers (Smart Manufacturing & EDA)
[GRIEVES-EDA-2012], [BADER-2022], [LU-NIST-2016], [LEITAO-2017], [PEREZ-2025], [NIST-PARADIGM], [EDA-ENERGY-2021], [IIOT-REVIEW-2023], [NOA-OPCUA-2023], [OPCUA-TSN-2018], [AAS-DT-2024], [FAULT-PROP-2025]

#### Technical References
[NATS-SUBJECTS], [NATS-SUBJECTMAP], [JETSTREAM], [SPARKPLUG-B]

#### Manufacturing Network & Federation (Section 9)
[SHARED-MFG-2020], [SHARED-FACTORY-2019], [PLATFORM-MFG-CIRP], [IOTFEDS-2024], [DID-IOT-2025], [OFFLINE-FIRST-IOT], [XOMETRY-PLATFORM]

---

## Appendix A: Codebase Grounding Map

> **Added in Revision 3 (2026-02-09)** — Per Prime directive: every abstract concept in this research document maps to a concrete file in `src/lib/iiot/`.

### A.1 Entity System (14 entities)

All entity paths relative to `src/lib/iiot/entity/`.

| Entity | ISA-95 Level | File | Entity.make() Line | Event Sourced? |
|---|---|---|---|---|
| Enterprise | L4 | `EnterpriseEntity.ts` | Entity.make('Enterprise', [...]) | No |
| Site | L3 | `SiteEntity.ts` | Entity.make('Site', [...]) | No |
| Area | L3/L2 | `AreaEntity.ts` | Entity.make('Area', [...]) | No |
| Plant | L3 | `PlantEntity.ts` | :208 | No |
| Line | L2 | `LineEntity.ts` | :223 | No |
| WorkCell | L2 | `WorkCellEntity.ts` | Entity.make('WorkCell', [...]) | No |
| MachineAsset | L1 | `MachineAssetEntity.ts` | Entity.make('MachineAsset', [...]) | No |
| Device | L1 | `DeviceEntity.ts` | Entity.make('Device', [...]) | No |
| SensorAsset | L0 | `SensorAssetEntity.ts` | :191 | No |
| Alarm | L1-L2 | `AlarmEntity.ts` | :163 | **Yes** (ISA-18.2) |
| WorkOrder | L3 | `WorkOrderEntity.ts` | Entity.make('WorkOrder', [...]) | **Yes** (FDA 21 CFR Part 11) |
| EquipmentState | L1-L2 | `EquipmentStateEntity.ts` | Entity.make('EquipmentState', [...]) | **Yes** (OEE) |
| Asset | L0-L4 | `AssetEntity.ts` | Entity.make('Asset', [...]) | No (query-only) |
| Sensor | L0 | `SensorEntity.ts` | Entity.make('Sensor', [...]) | No (time-series reads) |

All 12 stateful entity handlers are composed in `EntityStack.ts:54-67` via `Layer.mergeAll(...)`.

### A.2 State Graphs (12 ISA-95 validated)

All graph paths relative to `src/lib/iiot/machines/graphs/`.

| Asset Type | File | State Nodes | Transitions | Key Type |
|---|---|---|---|---|
| Enterprise | `enterprise-graph.ts` | EnterpriseStateNode | EnterpriseTransitionAction | Graph.directed |
| Site | `site-graph.ts` | SiteStateNode | SiteTransitionAction | Graph.directed |
| Area | `area-graph.ts` | AreaStateNode | AreaTransitionAction | Graph.directed |
| Plant | `plant-graph.ts` | PlantStateNode (6 states) | PlantTransitionAction (8 actions) | Graph.directed |
| Line | `line-graph.ts` | LineStateNode (7 states) | LineTransitionAction | Graph.directed |
| WorkCell | `workcell-graph.ts` | WorkCellStateNode | WorkCellTransitionAction | Graph.directed |
| MachineAsset | `machine-asset-graph.ts` | MachineAssetStateNode | MachineAssetTransitionAction | Graph.directed |
| Device | `device-graph.ts` | DeviceStateNode | DeviceTransitionAction | Graph.directed |
| Sensor | `sensor-graph.ts` | SensorStateNode (6 states) | SensorTransitionAction | Graph.directed |
| Alarm | `alarm-graph.ts` | AlarmStateNode | AlarmTransitionAction | Graph.directed |
| WorkOrder | (in WorkOrderMachine) | WorkOrderStateNode | WorkOrderTransitionAction | Graph.directed |
| EquipmentState | (in EquipmentStateMachine) | EquipmentStateNode | EquipmentTransitionAction | Graph.directed |

### A.3 Branded Identifiers (ISA-95 Hierarchy)

Defined at `src/lib/iiot/schemas/identifiers.ts`:

| Identifier | Line | ISA-95 Level | Example |
|---|---|---|---|
| `EnterpriseId` | :46 | L4 | Multi-site corporation |
| `SiteId` | :50 | L3 | Physical location |
| `AreaId` | :54 | L3/L2 | Sub-site zone |
| `PlantId` | :58 | L3 | e.g., 'PLANT-A' |
| `LineId` | :62 | L2 | e.g., 'LINE-001' |
| `WorkCellId` | :66 | L2 | e.g., 'WCL-001' |
| `MachineId` | :70 | L1 | e.g., 'MCH-001' |
| `SensorId` | :74 | L0 | e.g., 'SNS-001' |
| `DeviceId` | :78 | L0/L1 | e.g., 'DEV-001' |
| `AlarmId` | :90 | Cross-level | e.g., 'ALM-abc123' |
| `WorkOrderId` | :94 | L3 | e.g., 'WO-2026-00001' |
| `EquipmentLevel` | :28-38 | Enum | 9 values: enterprise through device |

### A.4 Realtime Stack (Event Distribution)

| Service | File | Key Lines | Purpose |
|---|---|---|---|
| EventDistribution | `realtime/event-distribution.ts` | :127-130 (Tag), :163-354 (impl) | Central event hub, 4 ChannelService channels |
| ReactivityBridge | `realtime/reactivity-bridge.ts` | :82-85 (Tag), :47-76 (shape) | Handler-to-distribution adapter (Approach A) |
| HolonetBridge | `realtime/holonet-bridge.ts` | :88-91 (Tag), :97-194 (impl) | NATS bridge, fire-and-forget outbound |
| NATS Subjects | `realtime/iiot-subjects.ts` | :39-136 | 4 subject specs: readings, alarms, equipment, invalidations |

**Event type schemas** (all `Schema.TaggedClass` in `event-distribution.ts`):
- `ReadingEvent` (:41-46) — sensor readings
- `AlarmEvent` (:49-55) — alarm lifecycle
- `EquipmentStateChange` (:58-63) — equipment transitions
- `CacheInvalidation` (:66-70) — cache signals

**Channel IDs** (event-distribution.ts:136-157):
- `iiot:readings` (maxLag: 10,000)
- `iiot:alarms` (maxLag: 1,000)
- `iiot:equipment` (maxLag: 1,000)
- `iiot:invalidations` (maxLag: 1,000)

### A.5 Propagation Rule → Codebase Mapping

| Rule | Entity Involved | File | Key Pattern |
|---|---|---|---|
| U-1 (Equipment Roll-Up) | MachineAsset, WorkCell, Line | `entity/MachineAssetEntity.ts`, `machines/graphs/machine-asset-graph.ts` | Machine.boot → actor.send → graph validation |
| U-2 (Alarm Escalation) | Alarm | `entity/AlarmEntity.ts:163-168`, `machines/graphs/alarm-graph.ts` | ISA-18.2 lifecycle |
| U-3 (Sensor Health) | SensorAsset | `entity/SensorAssetEntity.ts:191-203`, `machines/graphs/sensor-graph.ts:59-66` | TakeOffline transition |
| U-4 (Metrics Roll-Up) | EquipmentState | `entity/EquipmentStateEntity.ts` | OEE tracking (EVENT SOURCED) |
| D-1 (Emergency Shutdown) | Plant | `entity/PlantEntity.ts:208-219`, `machines/graphs/plant-graph.ts:42-48,102` | operational -> emergency_shutdown |
| D-2 (Mode Change) | Line | `entity/LineEntity.ts:223-237`, `machines/graphs/line-graph.ts:50-57` | BeginChangeover, changeover state |
| D-3 (Maintenance Window) | Line, Plant | `machines/graphs/line-graph.ts:56`, `machines/graphs/plant-graph.ts:47` | maintenance/maintenance_shutdown states |
| L-1 (Starvation Cascade) | Line | `entity/LineEntity.ts:157,173`, `machines/graphs/line-graph.ts:54-55` | starved/blocked states |
| L-2 (Redundancy Failover) | MachineAsset | `entity/MachineAssetEntity.ts`, `machines/graphs/machine-asset-graph.ts` | faulted state + failover |
| L-3 (Quality Containment) | MachineAsset, Line | `entity/MachineAssetEntity.ts` | quality events (future extension) |
| O-1 (Capacity Advertisement) | **Not yet implemented** | — | Proposed: network.capacity.{orgId} subjects |
| O-2 (Quality Signal) | **Not yet implemented** | — | Proposed: network.quality.{orgId} subjects |
| O-3 (Collaborative Work Order) | **Not yet implemented** | — | Proposed: network.collaboration.{orgId} subjects |

### A.6 Architecture Pattern: Entity → Machine → Graph

Every ISA-95 entity follows the same composition pattern. Using Plant as canonical example:

```
PlantEntity.ts:208    Entity.make('Plant', [RPCs...])
PlantEntity.ts:237    PlantEntity.toLayer(Effect.gen(function* () {
PlantEntity.ts:242      const state = yield* PlantState        // Port injection
PlantEntity.ts:248      const plantMachine = makePlantMachine({ state, flags })
PlantEntity.ts:249      const actor = yield* Machine.boot(plantMachine)
                        // Handlers delegate to Machine via actor.send()
PlantEntity.ts:376      return PlantEntity.of({ ... })
                     }))

PlantMachine.ts       makePlantMachine() → Machine.make()
                      Uses plantStateGraph for transition validation

plant-graph.ts:84     plantStateGraph = Graph.directed<PlantStateNode, PlantTransitionAction>()
plant-graph.ts:86-91  6 nodes: commissioning, operational, scheduled_shutdown, ...
plant-graph.ts:96-120 9 edges: CompleteCommissioning, ScheduledShutdown, ...

PlantState.ts         State service (port) — in-memory or SQL adapter
EntityStack.ts:61     PlantEntityHandlers composed into EntityHandlersLayer
```

### A.7 Gap Analysis: What Exists vs What Section 9 Proposes

| Concept | Status | What Exists | What's Needed |
|---|---|---|---|
| Fixed 9-level ISA-95 hierarchy | **Implemented** | `identifiers.ts:28-38`, 14 entity files | — |
| Variable-depth hierarchy | **Not implemented** | — | Virtual hierarchy aliases, collapsed EquipmentLevel |
| Intra-org propagation (U/D/L) | **Partially implemented** | Entity + Machine + Graph exist; ReactivityBridge designed but not wired to handlers | Wire bridge.onEquipmentStateChange into entity handlers |
| Outward propagation (O-1/O-2/O-3) | **Not implemented** | — | New network.* NATS subjects, consent-gate service, marketplace protocol |
| Edge-first local operation | **Supported** | EntityTestingStack works in-memory (EntityStack.ts:90-93) | NATS leaf node configuration |
| NATS subject hierarchy | **Partially implemented** | 4 flat subjects (iiot-subjects.ts) | Multi-segment org-aware subjects, network.* subjects |
| EventDistribution | **Implemented** | event-distribution.ts, 4 channels, ChannelService-backed | — |
| HolonetBridge (NATS integration) | **Implemented** | holonet-bridge.ts, fire-and-forget | Cross-org bridging extension |
