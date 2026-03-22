# RFC-001 Section: Introduction & Vision

```
Section:       Introduction & Vision
RFC:           001 — Entity Lifecycle Event Distribution for Metropolitan-Scale IIoT
Status:        DRAFT
Author:        realtime-philosopher (Val)
Created:       2026-02-09
Source Data:   research-manufacturing-commons.md (manufacturing commons thesis, platform economics)
               research-reactive-isa95.md (ISA-95 propagation model)
               research-manufacturing-commons.md §11 (codebase reference map)
Bibliography:  docs/specifications/bibliography.md
```

---

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

- **14 entity types** (12 handler entities + 2 query-only) covering the full ISA-95 hierarchy plus event-sourced
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

## References

All references use canonical citation keys from [`docs/specifications/bibliography.md`](bibliography.md).

### Citation Keys Used in This Section

#### Standards
[ISA-95-1]

#### Platform Economics & Network Theory
[PARKER-PLATFORM], [OSTROM-COMMONS], [METCALFE-LAW]

#### Cloud Manufacturing
[TEDALDI-MAAS-2023], [DATA-COOP-2023]

#### IIoT Platforms (Competitive Context)
[SIEMENS-INSIGHTS], [TWX-EVENTS], [AVEVA-SP], [RA-OPTIX], [GEV-PROFICY-2025], [IGN-PLATFORM]

#### NATS Infrastructure
[NATS-ACCOUNTS]
