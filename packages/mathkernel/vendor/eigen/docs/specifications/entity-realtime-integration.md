# TMNL-RFC-001: Entity Lifecycle Realtime Integration

```
RFC:            TMNL-RFC-001
Title:          Entity Lifecycle Realtime Integration
Status:         DRAFT
Created:        2026-02-09
Authors:        Val (Vigilant Architecture Layer), Prime
Depends-On:     ADR-004 (Entity System Architecture)
                Phase 5 (Realtime Stack — Epics 19, 20, 27)
Supersedes:     entity-realtime-integration.md v1, v2
Scale-Target:   Metropolitan (100+ sites, 10K+ devices, 100K+ sensors)
```

---

## Abstract

This RFC specifies the integration of entity lifecycle events into the TMNL IIoT realtime streaming infrastructure. The platform currently operates two mature but disconnected subsystems: a **top-down entity system** (12 stateful entities, 103 state-transitioning RPCs, 12 state machines) and a **bottom-up realtime system** (Sparkplug ingestion, alarm detection, EventDistribution, WebSocket streaming). When an entity transitions state — `Site.Commission`, `Machine.MarkFaulted`, `WorkOrder.Approve` — no WebSocket subscriber learns about it. This RFC bridges that gap using the `Machine.changes` observation pattern, introducing zero handler modifications while achieving complete transition coverage.

---

## Table of Contents

1. [Terminology](#1-terminology)
2. [Motivation](#2-motivation)
3. [What Realtime Means](#3-what-realtime-means)
4. [Problem Statement](#4-problem-statement)
5. [Requirements](#5-requirements)
6. [Architecture](#6-architecture)
7. [Event Schema](#7-event-schema)
8. [NATS Subject Hierarchy](#8-nats-subject-hierarchy)
9. [EventDistribution Protocol](#9-eventdistribution-protocol)
10. [WebSocket Subscription Protocol](#10-websocket-subscription-protocol)
11. [Entity Observer Pattern](#11-entity-observer-pattern)
12. [Consistency Model](#12-consistency-model)
13. [Metropolitan Deployment](#13-metropolitan-deployment)
14. [Implementation Phases](#14-implementation-phases)
15. [Security Considerations](#15-security-considerations)
16. [Regulatory Compliance](#16-regulatory-compliance)
17. [Open Questions](#17-open-questions)
18. [References](#18-references)

**Appendices**

- [A. Entity Transition Catalog](#appendix-a-entity-transition-catalog)
- [B. File Inventory](#appendix-b-file-inventory)
- [C. Research Documents](#appendix-c-research-documents)
- [D. Revision Log](#appendix-d-revision-log)

---

## 1. Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

| Term | Definition |
|------|-----------|
| **Entity** | A stateful domain object managed by an `@effect/experimental/Machine` actor inside an `@effect/cluster/Entity` shell. |
| **Entity Instance** | A specific activation of an entity type for a given `entityId`. Created lazily on first message, destroyed on idle timeout or shard migration. |
| **State Transition** | A graph-validated movement from one Machine state to another, triggered by an RPC request processed through `actor.send()`. |
| **Observer Fiber** | A scoped fiber forked inside the entity handler factory that consumes `actor.changes` and publishes `EntityStateChanged` events. Lives for the entity instance lifetime. |
| **EventDistribution** | The internal event bus (4 channels → 5 with this RFC) that routes events to local ChannelService outlets and NATS via HolonetBridge. |
| **Cascade** | The implicit effect on child entities when a parent entity transitions (e.g., `Plant.EmergencyShutdown` affects all Lines, Machines, Sensors beneath it). |
| **ISA-95 Level** | Equipment hierarchy classification per IEC 62264. L0 (sensors) through L4 (enterprise), plus ES (event-sourced entities). |
| **UNS** | Unified Namespace — a hierarchical NATS subject scheme following ISA-95 topology for metropolitan-scale event routing. |
| **Machine.changes** | `Stream.concat(Stream.sync(() => currentState), Stream.fromPubSub(pubsub))` — the built-in observation stream on every `@effect/experimental/Machine` actor. Emits full state on every transition. VERIFIED via `Machine.ts:827-829`. |
| **HolonetBridge** | The NATS dual-publish layer that mirrors local ChannelService events to distributed NATS subjects. |

---

## 2. Motivation

### 2.1 The Disconnection

The TMNL IIoT platform has two complete subsystems that share no communication path:

```
ENTITY SYSTEM (top-down, command-driven)           REALTIME SYSTEM (bottom-up, data-driven)
=========================================          =========================================

Enterprise ─┐                                      SparkplugAdapter
Site ────────┤                                          │
Area ─────────┤  12 entity types                        ▼
Plant ─────────┤  12 state machines                  TopicRouter
Line ───────────┤  103 state-transitioning RPCs         │
WorkCell ────────┤  0 realtime events          ◄──      ▼
Machine ──────────┤                                  ReadingProcessor
Device ────────────┤                                    │
Sensor ─────────────┘                                   ▼
                                                     AlarmDetector
Alarm (ES) ─────────┐                                  │
WorkOrder (ES) ──────┤                                  ▼
EquipmentState (ES) ─┘                              EventDistribution
                                                        │
                                                        ▼
                                                    WebSocket Clients
```

When a `Site.Commission` RPC succeeds, or a `WorkOrder.Approve` transitions state, or a `Machine.MarkFaulted` fires — **no WebSocket subscriber learns about it**. The realtime stack carries only ingestion data: sensor readings through threshold-based alarm detection. Entity lifecycle events are invisible to streaming consumers.

### 2.2 Why This Matters

An IIoT platform that cannot stream entity state changes is architecturally incomplete. Operators cannot see:

- A plant entering emergency shutdown (safety-critical, ISA-18.2 requirement)
- A production line going starved (OEE availability impact, immediate)
- A work order being approved (scheduling coordination, minutes-scale)
- A sensor going offline (data quality degradation, immediate)

These events currently require polling or page refresh — unacceptable for a platform targeting metropolitan-scale operations.

### 2.3 Design Constraints

This RFC operates within these non-negotiable constraints:

1. **Zero handler modification**: 103 existing RPC handlers MUST NOT be changed
2. **Holonet is mandatory**: NATS distribution is not optional (per Prime directive)
3. **ChannelService stays**: Local premium bus retained alongside NATS
4. **Feature-flaggable**: Observer fibers MUST be disable-able via feature flags
5. **Backward-compatible**: All existing tests MUST pass without modification (Phase A)

---

## 3. What Realtime Means

Before specifying the solution, we must define what "realtime" means in an IIoT context. This is not a single concept — it is a **temporal spectrum** governed by ISA-95 levels, consumer personas, and event criticality.

### 3.1 The Temporal Spectrum

| Level | ISA-95 | Latency Tolerance | What Changes | Who Cares |
|-------|--------|-------------------|--------------|-----------|
| **L0** | Physical Process | < 100ms | Sensor readings, actuator commands | PLC, DCS |
| **L1** | Automation Control | < 500ms | Equipment state, device connectivity | SCADA, HMI operators |
| **L2** | Supervisory Control | < 2s | Production line state, alarm lifecycle | Floor supervisors, shift leads |
| **L3** | Manufacturing Operations | < 10s | Plant state, site events, work orders | Plant managers, MES |
| **L4** | Business Planning | minutes-hours | Enterprise restructuring, capacity planning | VP Operations, ERP |
| **ES** | Event-Sourced | varies by type | Alarm → immediate; WorkOrder → seconds; EquipmentState → immediate | All levels |

**Key insight**: "Realtime" for a sensor reading (L0, <100ms) is fundamentally different from "realtime" for a site commissioning event (L3, <10s). The system MUST serve both ends of this spectrum through a single unified pipeline with differentiated delivery guarantees.

### 3.2 Consumer Personas

| Persona | ISA Level | Latency Need | Subscription Pattern | Volume Tolerance |
|---------|-----------|-------------|----------------------|-----------------|
| **SCADA Operator** | L0-L1 | < 500ms | Specific machines/sensors on their floor | High (1K+ events/min) |
| **Floor Supervisor** | L2 | < 2s | All equipment on their line | Medium (100 events/min) |
| **Plant Manager** | L3 | < 10s | All events in their plant, filtered by severity | Low-Medium (50 events/min) |
| **Operations Director** | L3-L4 | < 30s | Cross-site aggregates, critical events only | Low (10 events/min) |
| **VP Operations** | L4 | minutes | Enterprise metrics, strategic events | Very low (1 event/hour) |
| **Compliance Officer** | ES | audit-trail | All alarm lifecycle events, work order changes | Batch (end of shift) |
| **Dashboard Widget** | varies | < 5s | Specific entity type + ID | One entity at a time |
| **MQTT Bridge** | L0-L1 | < 200ms | Sparkplug-format edge events | High (mirrors telemetry) |

### 3.3 Event Categories

| Category | Source | Current Channel | New Channel | Latency Target | Volume (Metropolitan) |
|----------|--------|----------------|-------------|----------------|-----------------------|
| **Sensor Telemetry** | SparkplugAdapter → ReadingProcessor | `iiot:readings` | — | < 100ms | ~50M/day |
| **Threshold Alarms** | AlarmDetector | `iiot:alarms` | — | < 500ms | ~25K/day |
| **OEE Transitions** | EquipmentState handler | `iiot:equipment` | — | < 1s | ~5K/day |
| **Cache Signals** | StateService mutations | `iiot:invalidations` | — | < 2s | ~1K/day |
| **Entity Lifecycle** | Machine.changes observer | (none) | **`iiot:entity-changes`** | < 2s | **~43K/day** |

Entity lifecycle events are **3 orders of magnitude** less frequent than sensor telemetry. The architecture SHOULD optimize for **completeness and reliability** over raw throughput.

---

## 4. Problem Statement

### 4.1 System Inventory

| Metric | Count | Source |
|--------|-------|--------|
| Total entities | 12 stateful + 2 query-only | Entity audit |
| State machines | 12 | Graph-validated via Effect.Graph |
| Total states | 75 | Across all graphs |
| State-transitioning RPCs | 103 | RPC inventory |
| Read-only RPCs | 14 | RPC inventory |
| Terminal states | 18 | Various entities |
| Critical transitions (immediate notification) | 22 | ISA-95 classification |
| Feature flags | 5 | `infrastructure/feature-flags.ts` |
| EventDistribution channels | 4 | readings, alarms, equipment, invalidations |
| Streaming RPCs | 4 | RealtimeRpcs |

### 4.2 What Exists Today

| Component | Status | Notes |
|-----------|--------|-------|
| `EventDistribution` (4 channels) | Operational | readings (maxLag 10K), alarms/equipment/invalidations (maxLag 1K) |
| `HolonetBridge` (NATS dual-publish) | Operational | Outbound fire-and-forget + inbound wildcard ingress |
| `ChannelService` (BFO-ontology bus) | Operational | Broadcast outlets, fan-out, backpressure |
| `ReactivityBridge` (4 methods) | **Defined, NOT wired** | Zero entity handlers reference it |
| `_helpers.ts` `maybeEmit*` | **Log-only stubs** | Feature-flagged — `Effect.logInfo()`, no actual publish |
| `RealtimeRpcs` (4 streaming RPCs) | Operational | SubscribeReadings, SubscribeAlarms, SubscribeEquipmentState, SubscribeInvalidations |
| Entity handlers (12 types) | **Zero bridge calls** | `actor.send()` → return result → done. No side-effects to realtime. |
| `Machine.changes` stream | **Available, unused** | Built-in on every Machine actor — emits full state on every transition |

### 4.3 The Gap

The `ReactivityBridge` service was designed during Phase 5 planning for exactly this purpose. It exists with 4 methods that construct EventDistribution events and publish them. But:

1. **No entity handler imports it**
2. **No entity handler's Layer requires it**
3. **EntityHandlersLayer has zero knowledge of realtime**
4. **EntityStack composes handlers with StateServices + FeatureFlags only**

The service is an island — architecturally sound, operationally disconnected.

### 4.4 @effect/cluster Lifecycle Constraints

VERIFIED via `research-cluster-patterns.md` (cluster submodule source analysis):

| What You Want | Available? | Implication |
|---|---|---|
| Stream of entity instance creations | **NO** | Must build ourselves |
| Stream of entity instance destructions | **NO** | Must build ourselves |
| Lifecycle hooks (onCreate, onDestroy) | **NO** | Use `build` Effect + `Scope.addFinalizer` |
| Entity state change observation | **NO** | Entities are opaque to the cluster |
| Active entity count (per-runner) | YES | `Sharding.activeEntityCount` |
| Forked fibers inside entity handlers | **SAFE** | Survive across RPC calls, interrupted on deactivation |

**Conclusion**: Cluster-level observation MUST be built at the handler level. The `Machine.changes` observer pattern is the correct and only viable approach for per-entity state observation.

---

## 5. Requirements

### 5.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| **REQ-F01** | Every entity state transition MUST produce an `EntityStateChanged` event within 2 seconds | MUST |
| **REQ-F02** | Events MUST flow through EventDistribution → ChannelService → WebSocket | MUST |
| **REQ-F03** | Events MUST flow through HolonetBridge → NATS for distributed fan-out | MUST |
| **REQ-F04** | WebSocket clients MUST be able to subscribe with filters: entityType, isaLevel, entityId | MUST |
| **REQ-F05** | Observer fiber failure MUST NOT affect entity handler execution | MUST |
| **REQ-F06** | A feature flag MUST control observer fiber activation | MUST |
| **REQ-F07** | Entity activation (Machine.boot initial state) SHOULD produce an event with `previousState: '_initial'` | SHOULD |
| **REQ-F08** | Events SHOULD carry cascade scope metadata for hierarchy-aware subscribers | SHOULD |
| **REQ-F09** | Read-only RPCs (Get, List) MUST NOT produce events | MUST |

### 5.2 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| **REQ-N01** | Entity handler latency MUST NOT increase by more than 1ms due to observer | < 1ms overhead |
| **REQ-N02** | Observer fiber MUST be interrupted cleanly on entity deactivation | Zero leaked fibers |
| **REQ-N03** | The system MUST handle 100K entity events/day at metropolitan scale | ~1.2 events/sec sustained |
| **REQ-N04** | NATS publish failures MUST NOT block local event delivery | Fire-and-forget |
| **REQ-N05** | All existing tests MUST pass without modification in Phase A | Zero regressions |
| **REQ-N06** | Observer pattern MUST be reusable across all 12 entity types | Single factory function |

### 5.3 Compliance Requirements

| ID | Requirement | Standard |
|----|-------------|----------|
| **REQ-C01** | Alarm lifecycle transitions MUST be auditable with timestamps | ISA-18.2 |
| **REQ-C02** | Entity state change events MUST include actor identity (`changedBy`) when available | FDA 21 CFR Part 11 |
| **REQ-C03** | Events MUST be retained in NATS JetStream for regulatory replay | ISA-95 Part 2 |

---

## 6. Architecture

### 6.1 Approach Analysis

Five architectural approaches were evaluated against the Effect-TS source code and @effect/cluster documentation. Full analysis in `research-architecture-options.md`.

| # | Approach | Handler Changes | Completeness | Complexity | Confidence |
|---|----------|----------------|--------------|------------|------------|
| **A** | **Machine.changes Observer** | 0 (zero) | All state transitions captured | Medium | **45%** |
| B | RpcMiddleware.wrap | 0 (zero) | All RPCs captured, no previousState | Medium | 20% |
| C | Manual Effect.tap per Handler | 103 handlers modified | Complete (explicit) | High (volume) | 5% |
| D | Hybrid: Machine.changes + RpcMiddleware | 0 (zero) | Complete (state + action) | Medium-High | 25% |
| E | EventLog.changes (ES entities only) | 0 (for ES) | ES entities only | Low | 5% |

### 6.2 Selected: Option A — Machine.changes Observer

**VERIFIED** via deepwiki and submodule source (`Machine.ts:827-829`):

```typescript
// @effect/experimental/Machine.ts
changes: Stream.concat(
  Stream.sync(() => currentState),   // Initial state on subscription
  Stream.fromPubSub(pubsub)          // Subsequent transitions
),
```

**VERIFIED** entity lifecycle via deepwiki and `research-cluster-patterns.md`:

- Handler factory (passed to `Entity.toLayer`) executes **once per entity ID** at activation
- Entity scope **persists across RPC calls** — fibers forked in the handler factory survive
- Scope closes on: inactivity timeout (default 10 min), shard migration, runner shutdown
- `Effect.forkScoped` in handler factory = entity-lifetime fiber
- `Effect.addFinalizer` = cleanup hook when entity deactivates
- **Forked observers inside entities are safe** — they live for the entity instance lifetime

**The pattern**: Fork an observer fiber at entity activation time that consumes `actor.changes` and publishes each state transition to EventDistribution. The observer is a **separate concern** from the handler — it observes the Machine's internal PubSub, not the handler's return values.

### 6.3 Why Machine.changes Is Superior

| Dimension | Machine.changes | Manual Effect.tap | RpcMiddleware.wrap |
|-----------|----------------|-------------------|--------------------|
| Handler modifications | **0** | 103 | 0 |
| Missed transitions | **Impossible** | Possible (forgot a handler) | Impossible (but no previousState) |
| Previous state access | **Automatic** (stream window) | Must hardcode or query | Not available (SuccessValue opaque) |
| Maintenance burden | **One observer per entity type** | One tap per RPC x 12 types | One middleware, complex correlation |
| New RPCs auto-captured | **Yes** | No (must add tap) | Yes |
| Error isolation | **Complete** (separate fiber) | Good (Effect.tap) | Good (wrap boundary) |
| Action name | Derived from graph | Explicit | Available via `options.rpc._tag` |

**Trade-off**: `Machine.changes` emits full `Machine.State<M>`, not the RPC action name. We derive the action from the state transition by looking up what graph edge connects `previousState → currentState`. This is unambiguous for our state graphs (each state pair has at most one valid transition).

### 6.4 Data Flow After Integration

```
                    ENTITY SYSTEM                              REALTIME SYSTEM
                    =============                              ===============

RPC Request ---->  Entity Handler                              SparkplugAdapter
                       |                                            |
                       v                                            v
                  Machine.boot()                               TopicRouter
                       |                                            |
                   +---+---+                                        v
                   |       |                                   ReadingProcessor
             actor.send()  actor.changes ---------+                 |
                   |       (Stream<State>)         |                 v
                   v                               |            AlarmDetector
             State Transition                      |                 |
             (graph-validated)                     |                 |
                   |                               v                 |
          +--------+--------+         Entity Observer Fiber          |
          v        v        v         (forkScoped, entity-lifetime)  |
      StateService  ES Log  |                |                       |
      (persist)    (audit)  |                v                       |
                            |       EntityStateChanged               |
                            |                |                       |
                            |                v                       |
                            |       EventDistribution <--------------+
                            |       +---------------------------+
                            |       | iiot:readings              | <-- ReadingProcessor
                            |       | iiot:alarms                | <-- AlarmDetector
                            |       | iiot:equipment             | <-- EquipmentState
                            |       | iiot:invalidations         | <-- Cache signals
                            |       | iiot:entity-changes        | <-- Entity Observer (NEW)
                            |       +----------+----------------+
                            |                  |
                            |          +-------+---------------+
                            |          v       v               v
                            |     ChannelService      HolonetBridge
                            |     (local outlets)     (NATS distributed)
                            |            |
                            |            v
                            |     WebSocket Clients
                            |     (SubscribeReadings, SubscribeAlarms,
                            |      SubscribeEquipmentState,
                            |      SubscribeInvalidations,
                            |      SubscribeEntityChanges)   <-- NEW
                            |
                            +-- ReactivityBridge
                                (retained for ingestion-to-entity bridge)
```

**Key architectural property**: The observer fiber sits alongside `actor.send()`, not inside each handler. It watches `actor.changes` — the Machine's built-in state observation stream — and publishes independently. **Zero handler modifications.**

---

## 7. Event Schema

### 7.1 `EntityStateChanged` — Unified Entity Lifecycle Event

Implementations MUST use the following schema for all entity lifecycle events:

```typescript
class EntityStateChanged extends Schema.TaggedClass<EntityStateChanged>()(
  'EntityStateChanged',
  {
    /** ISA-95 entity type discriminator. REQUIRED. */
    entityType: Schema.Literal(
      'Enterprise', 'Site', 'Area', 'Plant', 'Line',
      'WorkCell', 'Machine', 'Device', 'Sensor',
      'Alarm', 'WorkOrder', 'EquipmentState'
    ),
    /** Entity primary key. REQUIRED. */
    entityId: Schema.String,
    /** The transition action (derived from graph or RPC tag). REQUIRED. */
    action: Schema.String,
    /** State before transition. REQUIRED. '_initial' for entity activation. */
    previousState: Schema.String,
    /** State after transition. REQUIRED. */
    currentState: Schema.String,
    /** ISA-95 level for priority routing. REQUIRED. */
    isaLevel: Schema.Literal('L0', 'L1', 'L2', 'L3', 'L4', 'ES'),
    /** UTC timestamp of the transition. REQUIRED. */
    changedAt: Schema.DateTimeUtc,
    /** Identity of the actor who initiated the change. OPTIONAL (for audit). */
    changedBy: Schema.optional(Schema.String),
    /** Cascade scope — which children might be affected. OPTIONAL. */
    cascadeScope: Schema.optional(Schema.Literal(
      'none', 'direct_children', 'all_descendants'
    )),
    /** Parent entity context for hierarchy-aware subscribers. OPTIONAL. */
    parentEntityId: Schema.optional(Schema.String),
    parentEntityType: Schema.optional(Schema.String),
    /** Origin node for distributed deduplication. OPTIONAL. */
    originNodeId: Schema.optional(Schema.String),
  }
)
```

### 7.2 Schema Design Rationale

1. **One event type, not 12**: The `entityType` discriminator enables subscribers to filter. Separate event types per entity would create 12 channels, 12 PubSub instances, 12 NATS subjects — combinatorial complexity for no benefit.

2. **One new channel (`iiot:entity-changes`), not 12**: Keeps EventDistribution topology simple. Server-side filtering via `entityType`/`isaLevel` is efficient at ~43K events/day.

3. **`originNodeId` for distributed deduplication**: In a multi-node cluster, the same entity might produce events observed by different nodes during shard migration. The `originNodeId` field enables consumers to deduplicate.

4. **`cascadeScope` as metadata, not behavior**: The server MUST NOT walk the hierarchy tree on the hot path. The event carries cascade metadata; the subscribing client (dashboard, SCADA HMI) decides whether to visually cascade or re-query child state.

5. **`previousState` + `currentState`** over `action` alone: State pairs are unambiguous and verifiable against the graph. Action names are human-friendly labels derived from the graph edges.

### 7.3 ISA-95 Level Assignment

Each entity type has a fixed ISA-95 level assignment:

| Entity Type | ISA Level | Rationale |
|-------------|-----------|-----------|
| Enterprise | L4 | Business planning scope |
| Site | L3 | Manufacturing operations |
| Area | L3 | Sub-site zone |
| Plant | L3 | Production facility |
| Line | L2 | Supervisory control |
| WorkCell | L2 | Production unit |
| Machine | L1 | Equipment automation |
| Device | L1 | Connectivity/firmware |
| Sensor | L0 | Physical measurement |
| Alarm | ES | Event-sourced, priority varies |
| WorkOrder | ES | Event-sourced, L3 equivalent |
| EquipmentState | ES | Event-sourced, L1-L2 equivalent |

---

## 8. NATS Subject Hierarchy

### 8.1 Subject Pattern

Following Unified Namespace (UNS) principles from `research-uns-metropolitan.md`:

```
v1.iiot.{enterprise}.{site}.{area}.entity.{entityType}.{entityId}.{action}
```

**Examples:**

```
v1.iiot.GBG.CHI.NORTH.entity.Site.SITE-CHI.Commission
v1.iiot.GBG.CHI.NORTH.entity.Plant.PLANT-A.EmergencyShutdown
v1.iiot.GBG.CHI.NORTH.entity.Machine.MCH-001.MarkFaulted
v1.iiot.GBG.CHI.NORTH.entity.Alarm.ALM-abc123.Acknowledge
v1.iiot.GBG.CHI.NORTH.entity.Line.LINE-001.Start
```

### 8.2 Wildcard Patterns

```
v1.iiot.>                                           — All IIoT events (enterprise-wide)
v1.iiot.GBG.>                                       — All events for enterprise GBG
v1.iiot.GBG.CHI.>                                   — All events at Chicago site
v1.iiot.GBG.CHI.NORTH.entity.>                      — All entity events in North area
v1.iiot.GBG.CHI.NORTH.entity.Machine.>              — All machine events in North area
v1.iiot.GBG.*.*.entity.Machine.>                    — All machine events across all sites
v1.iiot.GBG.CHI.*.entity.{Line,WorkCell,Machine}.>  — Production floor events at Chicago
```

### 8.3 JetStream Configuration

Entity events MUST be retained in a JetStream stream for regulatory replay and reconnection:

```
Stream:           IIOT_ENTITY_EVENTS
Subjects:         v1.iiot.*.*.*.entity.>
Storage:          File
Retention:        Limits
MaxAge:           365 days (regulatory minimum)
MaxBytes:         10 GB (per site leaf node)
Discard:          Old
DenyDelete:       true (audit trail integrity)
DenyPurge:        true (audit trail integrity)
Replicas:         3 (production), 1 (edge leaf nodes)
```

### 8.4 Metropolitan Routing

NATS subject-based filtering enables edge nodes to subscribe to only their relevant entity types:

```
Hub (Enterprise)
  |
  +-- Leaf Node: Chicago
  |     Subscribes: v1.iiot.GBG.CHI.>
  |     Publishes:  v1.iiot.GBG.CHI.>
  |
  +-- Leaf Node: Detroit
  |     Subscribes: v1.iiot.GBG.DET.>
  |     Publishes:  v1.iiot.GBG.DET.>
  |
  +-- Leaf Node: Corporate Dashboard
        Subscribes: v1.iiot.GBG.*.*.entity.*.*.EmergencyShutdown
                    v1.iiot.GBG.*.*.entity.*.*.MarkFaulted
        (Critical events only — minimal bandwidth)
```

---

## 9. EventDistribution Protocol

### 9.1 Fifth Channel

Implementations MUST add a fifth channel to EventDistribution:

| Channel | maxLag | Purpose | Volume |
|---------|--------|---------|--------|
| `iiot:readings` | 10,000 | Sensor telemetry | ~50M/day |
| `iiot:alarms` | 1,000 | Alarm lifecycle | ~25K/day |
| `iiot:equipment` | 1,000 | Equipment OEE transitions | ~5K/day |
| `iiot:invalidations` | 1,000 | Cache signals | ~1K/day |
| **`iiot:entity-changes`** | **2,000** | **Entity lifecycle transitions** | **~43K/day** |

### 9.2 Interface Extension

The following methods MUST be added to `EventDistributionShape`:

```typescript
/** Publish an entity state change event to the entity-changes channel. */
readonly publishEntityChange: (event: EntityStateChanged) => Effect.Effect<void>

/** Subscribe to entity state change events. Returns a stream of EntityStateChanged. */
readonly subscribeEntityChanges: Effect.Effect<Stream.Stream<EntityStateChanged>>
```

### 9.3 Dual-Publish Protocol

Implementations MUST dual-publish to both ChannelService (local) and HolonetBridge (NATS):

```typescript
publishEntityChange: (event) =>
  PubSub.publish(entityChangesInlet, event).pipe(
    Effect.tap(() => bridge.publishEntityChange(event).pipe(Effect.ignoreLogged)),
    Effect.asVoid,
  ),
```

The NATS publish MUST be fire-and-forget (`Effect.ignoreLogged`). Local ChannelService delivery MUST NOT be blocked by NATS failures (REQ-N04).

### 9.4 Remote Ingress

Implementations MUST fork an ingress daemon that subscribes to remote entity change events from NATS and merges them into the local ChannelService PubSub:

```typescript
yield* bridge.remoteEntityChanges.pipe(
  Effect.flatMap(stream =>
    stream.pipe(
      Stream.runForEach(event => PubSub.publish(entityChangesInlet, event)),
      Effect.fork,
    )
  ),
)
```

This enables entity events from other cluster nodes to appear on local WebSocket connections.

---

## 10. WebSocket Subscription Protocol

### 10.1 `SubscribeEntityChanges` RPC

Implementations MUST add a new streaming RPC:

```typescript
export const SubscribeEntityChanges = Rpc.make('Realtime.SubscribeEntityChanges', {
  payload: Schema.Struct({
    /** Filter by entity type(s). OPTIONAL. Omit for all types. */
    entityTypes: Schema.optional(Schema.Array(Schema.Literal(
      'Enterprise', 'Site', 'Area', 'Plant', 'Line',
      'WorkCell', 'Machine', 'Device', 'Sensor',
      'Alarm', 'WorkOrder', 'EquipmentState'
    ))),
    /** Filter by ISA-95 level(s). OPTIONAL. Omit for all levels. */
    isaLevels: Schema.optional(Schema.Array(Schema.Literal(
      'L0', 'L1', 'L2', 'L3', 'L4', 'ES'
    ))),
    /** Filter by specific entity IDs. OPTIONAL. Omit for all entities. */
    entityIds: Schema.optional(Schema.Array(Schema.String)),
    /** Include cascade metadata in events. OPTIONAL. Default: false. */
    includeCascade: Schema.optional(Schema.Boolean),
  }),
  success: EntityStateChanged,
  error: RealtimeError,
  stream: true,
})
```

### 10.2 Server-Side Filtering

The handler MUST apply filters server-side before emitting to the WebSocket stream. Filter evaluation order:

1. `entityTypes` — if provided, event `entityType` MUST be in the set
2. `isaLevels` — if provided, event `isaLevel` MUST be in the set
3. `entityIds` — if provided, event `entityId` MUST be in the set
4. If `includeCascade` is false or omitted, `cascadeScope` and `parentEntityId` fields MAY be stripped

All filters are AND-combined. If no filters are provided, all events are emitted.

### 10.3 Client Subscription Patterns

```typescript
// Dashboard: Subscribe to all L1-L2 changes (production floor)
client.Realtime.SubscribeEntityChanges({
  isaLevels: ['L1', 'L2'],
  includeCascade: true,
})

// SCADA HMI: Subscribe to specific plant's equipment
client.Realtime.SubscribeEntityChanges({
  entityTypes: ['Machine', 'Device', 'Sensor'],
})

// Work Order Panel: Subscribe to WO lifecycle
client.Realtime.SubscribeEntityChanges({
  entityTypes: ['WorkOrder'],
})

// Alarm Panel: Entity-level alarm lifecycle
client.Realtime.SubscribeEntityChanges({
  entityTypes: ['Alarm'],
})

// Single Entity Widget: Subscribe to one specific entity
client.Realtime.SubscribeEntityChanges({
  entityIds: ['MCH-001'],
})
```

---

## 11. Entity Observer Pattern

### 11.1 `makeEntityObserver` — Reusable Factory

Implementations MUST use a single factory function for all 12 entity types:

```typescript
/**
 * Creates a scoped observer fiber that watches Machine.changes
 * and publishes EntityStateChanged events to EventDistribution.
 *
 * Call inside Entity.toLayer's handler factory — the fiber lives
 * for the entity instance's lifetime (survives across RPC calls,
 * interrupted on entity deactivation/shard migration).
 *
 * @param options.actor - The booted Machine actor
 * @param options.entityType - ISA-95 entity type discriminator
 * @param options.entityId - Entity primary key
 * @param options.isaLevel - ISA-95 level for priority routing
 * @param options.transitionMap - State pair -> action name lookup
 * @param options.cascadeScope - Optional cascade metadata
 */
export const makeEntityObserver = <M extends Machine.Machine.Any>(options: {
  readonly actor: Machine.Actor<M>
  readonly entityType: EntityStateChanged['entityType']
  readonly entityId: string
  readonly isaLevel: EntityStateChanged['isaLevel']
  readonly transitionMap: Record<string, Record<string, string>>
  readonly cascadeScope?: EntityStateChanged['cascadeScope']
}) =>
  Effect.gen(function* () {
    const dist = yield* EventDistribution
    const flags = yield* FeatureFlags

    // REQ-F06: Feature flag controls observer activation
    if (!flags.entityRealtimeEnabled) return

    yield* options.actor.changes.pipe(
      Stream.pairwise,  // Emits [prev, curr] pairs
      Stream.map(([prev, curr]) =>
        new EntityStateChanged({
          entityType: options.entityType,
          entityId: options.entityId,
          action: options.transitionMap[prev._tag]?.[curr._tag]
            ?? `${prev._tag}->${curr._tag}`,
          previousState: prev._tag,
          currentState: curr._tag,
          isaLevel: options.isaLevel,
          changedAt: DateTime.unsafeNow(),
          cascadeScope: options.cascadeScope,
        })
      ),
      Stream.runForEach((event) =>
        dist.publishEntityChange(event).pipe(Effect.ignoreLogged)
      ),
      Effect.forkScoped,  // Lives for entity instance lifetime
    )

    // Cleanup logging when entity deactivates
    yield* Effect.addFinalizer(() =>
      Effect.log(`Entity observer shutdown: ${options.entityType}/${options.entityId}`)
    )
  })
```

### 11.2 Action Derivation Strategy

For each entity type, a transition map MUST be derived from the existing graph definitions in `src/lib/iiot/machines/graphs/`:

```typescript
// Example: Site state graph
const SITE_TRANSITION_MAP: Record<string, Record<string, string>> = {
  planned:            { under_construction: 'BeginConstruction' },
  under_construction: { operational: 'Commission' },
  operational: {
    seasonal_shutdown: 'SeasonalShutdown',
    closed: 'Close',
  },
  seasonal_shutdown:  { operational: 'Reopen' },
  closed: {
    operational: 'Reopen',
    decommissioned: 'Decommission',
  },
}
```

These maps SHOULD be auto-generated from the existing graph definitions. Each state pair has at most one valid transition edge, making derivation unambiguous.

### 11.3 Usage in Entity Handler Factory

```typescript
const makeSiteHandlers = Effect.gen(function* () {
  const actor = yield* Machine.boot(siteMachine)

  // Observer fiber — zero handler changes needed
  yield* makeEntityObserver({
    actor,
    entityType: 'Site',
    entityId: /* from entity activation context */,
    isaLevel: 'L3',
    transitionMap: SITE_TRANSITION_MAP,
  })

  return Entity.of({
    'Site.Create': handleCreate,           // Unchanged
    'Site.Commission': handleCommission,   // Unchanged
    'Site.Close': handleClose,             // Unchanged
    // ... all handlers untouched
  })
})
```

### 11.4 Observer Lifecycle

```
Entity Activation (first message for entityId)
  |
  v
Handler Factory executes (Entity.toLayer build effect)
  |
  +-- Machine.boot() -> actor
  |
  +-- makeEntityObserver({ actor, ... })
  |     |
  |     +-- Check featureFlag (REQ-F06)
  |     |     |
  |     |     +-- disabled -> return (no observer)
  |     |     +-- enabled  -> continue
  |     |
  |     +-- actor.changes.pipe(...)
  |     |     |
  |     |     +-- Stream.pairwise -> [prev, curr]
  |     |     +-- Stream.map -> EntityStateChanged
  |     |     +-- Stream.runForEach -> EventDistribution.publishEntityChange
  |     |
  |     +-- Effect.forkScoped (fiber tied to entity scope)
  |     |
  |     +-- Effect.addFinalizer (cleanup logging)
  |
  +-- Return handler functions
  |
  v
Entity Active (observer fiber running, handlers processing RPCs)
  |
  | ... each RPC -> actor.send() -> state transition -> actor.changes emits -> observer publishes
  |
  v
Entity Deactivation (idle timeout, shard migration, or shutdown)
  |
  +-- Entity scope closes
  +-- Observer fiber interrupted
  +-- Finalizer fires: "Entity observer shutdown: Site/SITE-CHI"
  +-- All scoped fibers cleaned up
```

### 11.5 Observer Restart on Shard Migration

Per `research-cluster-patterns.md`, shard migration is NOT atomic:

1. Entity destroyed on old runner (observer fiber interrupted)
2. Shard lock released
3. New runner acquires shard
4. Next message creates fresh entity instance on new runner
5. Handler factory re-executes → observer re-forks

**State is NOT transferred between nodes.** The new observer starts from `Machine.boot()` which emits the initial state via `Stream.sync(() => currentState)`. There MAY be a brief gap between destruction on old node and re-creation on new node. This is acceptable — entity events are not safety-critical telemetry.

---

## 12. Consistency Model

### 12.1 Ordering Guarantees

| Guarantee | Level | Mechanism |
|-----------|-------|-----------|
| **Per-entity ordering** | GUARANTEED | `@effect/cluster` mailbox serialization. One message at a time per entity. |
| **Cross-entity ordering** | NOT GUARANTEED | Different entity instances may be on different runners. |
| **Per-channel ordering** | GUARANTEED | PubSub within a ChannelService channel preserves insertion order. |
| **NATS ordering** | PER-SUBJECT | NATS guarantees per-subject ordering within a JetStream stream. |

### 12.2 Delivery Guarantees

| Path | Guarantee | Failure Mode |
|------|-----------|--------------|
| Observer → PubSub → ChannelService | **At-least-once** | PubSub.publish is synchronous within the fiber |
| Observer → HolonetBridge → NATS | **At-most-once** (fire-and-forget) | NATS publish errors logged and ignored |
| NATS JetStream → Consumer | **At-least-once** (with ack) | JetStream provides redelivery on consumer failure |
| ChannelService → WebSocket | **At-most-once** | WebSocket disconnect = events lost. Client must reconnect and re-subscribe. |

### 12.3 Deduplication

In a multi-node cluster, the same entity might briefly exist on two nodes during shard migration. To prevent duplicate events:

1. Each event SHOULD carry `originNodeId`
2. Consumers SHOULD deduplicate by `(entityType, entityId, previousState, currentState, changedAt)` tuple
3. JetStream `Nats-Msg-Id` header MAY be set to the same tuple hash for server-side dedup

---

## 13. Metropolitan Deployment

### 13.1 Scale Estimates

Based on `research-uns-metropolitan.md`:

| Metric | Per-Site (100 devices) | Metropolitan (100 sites) | Daily Total |
|--------|----------------------|--------------------------|-------------|
| L0-L1 equipment faults | 5-50/day | 500-5,000/day | ~2,500 |
| L2 production state changes | 20-200/day | 2,000-20,000/day | ~10,000 |
| L3-L4 site/plant events | 1-10/day | 100-1,000/day | ~500 |
| ES alarm events | 50-500/day | 5,000-50,000/day | ~25,000 |
| ES work order events | 10-100/day | 1,000-10,000/day | ~5,000 |
| **Total entity events** | **~100-800/day** | **~10K-80K/day** | **~43,000** |
| Sensor readings (comparison) | 100K-1M/day | 10M-100M/day | **~50M** |

### 13.2 Hierarchy Cascade Principle

When a parent entity changes state, child entities MAY be implicitly affected:

```
Plant.EmergencyShutdown
  +-- All Lines under plant: implicit "emergency_stop" event
      +-- All WorkCells on those lines: implicit "emergency_stop"
          +-- All Machines in those cells: implicit "emergency_stop"
              +-- All Devices on those machines: implicit "offline"
                  +-- All Sensors on those devices: implicit "offline"
```

**Design decision**: The event carries `cascadeScope` metadata. The subscribing client decides whether to visually cascade or re-query child state. The server MUST NOT walk the hierarchy tree on the hot path (REQ-N01).

### 13.3 Critical Transitions (Immediate Notification Required)

| Entity | Transition | Action | Why Critical |
|--------|-----------|--------|--------------|
| **Plant** | operational → emergency_shutdown | EmergencyShutdown | Safety event |
| **Line** | idle → running | Start | Production begins |
| **Line** | running → idle | Stop | Production ends |
| **Line** | running → starved | MarkStarved | OEE impact |
| **Line** | running → blocked | MarkBlocked | OEE impact |
| **Machine** | operational → faulted | MarkFaulted | Breakdown |
| **Machine** | faulted → unscheduled_maintenance | EmergencyRepair | Urgent repair |
| **Device** | online → offline | GoOffline | Connectivity loss |
| **Device** | any → faulted | MarkFaulted | Device failure |
| **Sensor** | active → faulted | MarkFaulted | Sensor failure |
| **Area** | active → restricted | Restrict | Access control |
| **EquipmentState** | running → unplanned_downtime | Transition | OEE availability loss |
| **Alarm** | unacknowledged → acknowledged | Acknowledge | Operator response |

---

## 14. Implementation Phases

### Phase A: Foundation (Non-Breaking, Additive)

All existing tests MUST pass without modification (REQ-N05).

| Step | File | Change | Tests |
|------|------|--------|-------|
| A1 | `realtime/event-distribution.ts` | Add `EntityStateChanged` schema + 5th channel | New: channel registration |
| A2 | `realtime/holonet-bridge.ts` | Add `publishEntityChange` + `remoteEntityChanges` | New: NATS roundtrip |
| A3 | `realtime/iiot-subjects.ts` | Add entity subject spec | New: subject validation |
| A4 | `realtime/reactivity-bridge.ts` | Add `onEntityStateChanged` method | New: bridge routing |
| A5 | `rpc/RealtimeRpcs.ts` | Add `SubscribeEntityChanges` RPC | New: schema validation |
| A6 | `realtime/realtime-handlers.ts` | Add handler for SubscribeEntityChanges | New: filter logic |
| A7 | `realtime/websocket-server.ts` | Wire new RPC to handler bridge | New: WS integration |

### Phase B: Entity Observer Wiring (Breaking — Layer Change)

**Breaking change**: `EntityHandlersLayer` gains `EventDistribution` dependency.

| Step | File | Change | Tests |
|------|------|--------|-------|
| B1 | `entity/entity-observer.ts` (new) | `makeEntityObserver` factory | New: observer tests |
| B2 | `machines/graphs/index.ts` | Export transition-to-action maps | New: derivation tests |
| B3 | `entity/SiteEntity.ts` | Add observer fiber in handler factory | Extend: site tests |
| B4-B13 | All 11 other entity files | Same pattern as B3 | Extend: per-entity tests |
| B14 | `entity/EntityStack.ts` | Add `EventDistribution` to Layer deps | Update: test layer |
| B15 | `infrastructure/feature-flags.ts` | Add `entityRealtimeEnabled` flag | Update: flag tests |

### Phase C: Cascade Awareness (Enhancement)

| Step | Change |
|------|--------|
| C1 | Define ISA-95 parent-child relationships per entity type |
| C2 | Add `cascadeScope` to observer fiber based on entity type + transition |
| C3 | Client-side cascade resolution in dashboard components |

### Phase D: Metropolitan Optimization (Enhancement)

| Step | Change |
|------|--------|
| D1 | NATS subject-based filtering for edge node subscriptions |
| D2 | Entity event retention in JetStream for replay on reconnect |
| D3 | Cross-node deduplication via `originNodeId` |

---

## 15. Security Considerations

### 15.1 Authorization

Entity change events MAY contain sensitive operational data. Implementations SHOULD:

1. Apply the same RBAC rules to `SubscribeEntityChanges` as to the underlying entity RPCs
2. Filter events by the subscriber's authorized scope (site, area, entity type)
3. Strip `changedBy` from events when the subscriber lacks audit-trail permissions

### 15.2 Transport Security

1. WebSocket connections MUST use TLS (wss://) in production
2. NATS leaf node connections MUST use TLS with mutual authentication
3. JetStream retention policies MUST NOT be modifiable by leaf nodes (`DenyPurge`, `DenyDelete`)

### 15.3 Event Integrity

1. Events MUST NOT be modifiable after publication to JetStream
2. The `originNodeId` field MUST be set by the publishing node, not by the client
3. `changedAt` MUST be server-generated (not client-supplied)

---

## 16. Regulatory Compliance

### 16.1 ISA-18.2 (Alarm Management)

Alarm lifecycle transitions (`Alarm` entity) MUST be auditable with:
- Timestamp (UTC, millisecond precision)
- Actor identity (`changedBy`)
- Previous and current state
- Entity ID linkable to physical alarm point

### 16.2 FDA 21 CFR Part 11 (Electronic Records)

Where applicable (pharmaceutical manufacturing), entity state change events MUST:
- Include electronic signature metadata (`changedBy`)
- Be retained in tamper-evident storage (JetStream with `DenyDelete`/`DenyPurge`)
- Support reconstruction of complete entity lifecycle from event history

### 16.3 ISA-95 Part 2 (Enterprise-Control Integration)

Entity events following ISA-95 hierarchy MUST:
- Use ISA-95 level assignments as defined in Section 7.3
- Support enterprise-to-sensor hierarchy traversal via parent entity references
- Enable cross-level event correlation via shared `entityId` namespace

---

## 17. Open Questions

### Q1: `Stream.pairwise` Availability

**Status**: LOOP OPEN

`Stream.pairwise` is the ideal API (emits `[A, A]` tuples from sequential elements). If unavailable in the current Effect version, use `Stream.scan` with a 2-element accumulator:

```typescript
Stream.scan(actor.changes, [null, null] as [State | null, State | null], (window, state) => [window[1], state]).pipe(
  Stream.filter(([prev, _curr]) => prev !== null),
)
```

### Q2: `iiot:equipment` Channel Merge

**Decision**: Keep both `iiot:equipment` and `iiot:entity-changes`. The equipment channel serves OEE dashboards with its specific shape. Entity-changes serves hierarchy views with the unified shape. Deprecation is a future optimization.

### Q3: EntityResource for Observer Restart

**Status**: LOOP OPEN

`EntityResource.make` provides resources that survive shard migration restarts (commit af7916a). The observer fiber is interrupted on shard migration — should it use `EntityResource` to auto-restart? Current assessment: **not needed**. The handler factory re-executes on the new node, re-forking the observer naturally.

### Q4: Event Ordering Across Cluster Nodes

**Decision**: Per-entity ordering is guaranteed by mailbox serialization. Cross-entity ordering is NOT guaranteed and NOT needed. Subscribers requiring cross-entity correlation MUST use `changedAt` timestamps, accepting clock skew across nodes.

---

## 18. References

### Internal

| Document | Description |
|----------|-------------|
| `research-cluster-patterns.md` | @effect/cluster lifecycle, EntityResource, shard migration, forked fiber safety |
| `research-architecture-options.md` | 5-option comparison with verified code patterns, trade-off matrix |
| `research-uns-metropolitan.md` | UNS patterns, metropolitan-scale routing, ISA-95 Part 2 |
| `ADR-004` | Entity System Architecture (Machine + Cluster) |
| `architecture/websocket-realtime.md` | WebSocket streaming RPCs, handler bridge |
| `architecture/stream-processing.md` | Ingestion pipeline architecture |
| `patterns/entities.md` | Machine+Entity architecture, handler delegation |

### External

| Standard | Relevance |
|----------|-----------|
| [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) | Requirement level keywords |
| [ISA-95 / IEC 62264](https://www.isa.org/standards-and-publications/isa-standards/isa-95-standard) | Equipment hierarchy, operations event model |
| [ISA-18.2](https://www.isa.org/standards-and-publications/isa-standards/isa-18-2) | Alarm management lifecycle |
| [ISA-88 / IEC 61512](https://www.isa.org/standards-and-publications/isa-standards/isa-88-standard) | Batch process control |
| [Sparkplug B](https://www.eclipse.org/tahu/spec/sparkplug_b_v1.0.pdf) | MQTT payload specification |
| [UMH Data Model](https://umh.docs.umh.app/docs/datamodel/) | Unified Manufacturing Hub reference |
| [FDA 21 CFR Part 11](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11) | Electronic records and signatures |

---

## Appendix A: Entity Transition Catalog

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
| **EquipmentState** | running, idle, planned_downtime, unplanned_downtime, setup, blocked | (none — continuous) | transition (OEE) | ES |

---

## Appendix B: File Inventory

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

## Appendix C: Research Documents

| Document | Status | Description |
|----------|--------|-------------|
| `research-uns-metropolitan.md` | **Complete** | UNS hierarchy, ISA-95 operations event model, platform comparison, volume estimates, NATS subject design |
| `research-architecture-options.md` | **Complete** | 5-option comparison with verified source code patterns, trade-off matrix, implementation effort estimates |
| `research-cluster-patterns.md` | **Complete** | @effect/cluster entity lifecycle, EntityResource, shard migration behavior, forked fiber safety, transport options |

---

## Appendix D: Revision Log

| Date | Version | Author | Change |
|------|---------|--------|--------|
| 2026-02-09 | v1 | Val | Initial draft — problem statement, ISA-95 taxonomy, manual Effect.tap approach |
| 2026-02-09 | v2 | Val | Complete rewrite — Machine.changes observer pattern (verified via deepwiki + submodule source), 5-option architecture comparison, metropolitan-scale volume estimates, makeEntityObserver factory |
| 2026-02-09 | v3 (RFC) | Val | Rewritten as TMNL-RFC-001. Added: RFC 2119 keywords, formal requirements (REQ-F01 through REQ-C03), first-principles "What Realtime Means" analysis (temporal spectrum, personas, event categories), UNS subject hierarchy with metropolitan routing, JetStream retention config, consistency model (ordering + delivery guarantees), observer lifecycle diagram, security considerations, regulatory compliance (ISA-18.2, FDA 21 CFR Part 11, ISA-95 Part 2). Incorporates research from 3 team agents (cluster, UNS, architecture). |

---

*End of TMNL-RFC-001.*
