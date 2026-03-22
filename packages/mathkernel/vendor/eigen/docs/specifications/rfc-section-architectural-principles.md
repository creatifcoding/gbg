# RFC-001 Section: Architectural Principles

```
Section:       Architectural Principles
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (interface-visionary)
Created:       2026-02-09
Derived From:  rfc-section-theoretical-foundations.md (Sections 4-5)
               research-theoretical-foundations.md (Sections 3-9)
```

> This section defines the twelve architectural principles (P1-P12) that govern the
> entity-realtime integration. Each principle is structured as: Statement (normative
> requirement), Justification (theoretical basis), Implementation (codebase pattern),
> Verification (how conformance is tested). The key words "MUST", "MUST NOT", "SHOULD",
> "SHOULD NOT", and "MAY" are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Overview](#1-overview)
2. [Intra-Organization Principles P1-P8](#2-intra-organization-principles-p1-p8)
3. [Manufacturing Commons Principles P9-P12](#3-manufacturing-commons-principles-p9-p12)
4. [Principle Interaction Matrix](#4-principle-interaction-matrix)
5. [Conformance Levels](#5-conformance-levels)

---

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

## References

All citations use keys from the canonical bibliography (`docs/specifications/bibliography.md`).

### Cognitive Science

- [ENDSLEY-1995] — SA Level 1/2/3 model
- [ENDSLEY-2012] — 50 SA design principles
- [ENDSLEY-OOTL] — Out-of-the-loop performance problem
- [ENDSLEY-TEAM-SA] — Team SA: shared and compatible mental models
- [EID-VICENTE] — Abstraction Hierarchy + SRK
- [CWA-VICENTE] — Five-dimension CWA framework
- [RASMUSSEN-1983] — SRK framework
- [RASMUSSEN-1986] — Decision Ladder
- [HOLLNAGEL-JCS] — Joint Cognitive Systems
- [HOLLNAGEL-ETTO] — ETTO principle
- [PIROLLI-CARD] — Information Foraging Theory
- [PIROLLI-1999] — Extended IFT
- [PIROLLI-2007] — ACT-IF / Marginal Value Theorem
- [WARD-SMARTPHONE-COG] — Smartphone cognitive effects

### Systems Theory

- [LEE-CPS] — CPS temporal semantics
- [LEVESON-STAMP] — STAMP accident model
- [WOODS-RESILIENCE] — Four cornerstones of resilience
- [WOODS-STRETCHED] — Law of Stretched Systems
- [WOODS-FOUR] — Four concepts for resilience

### Manufacturing Commons

- [DISTRIBUTED-SA] — Distributed Situation Awareness
- [OSTROM-COMMONS] — Commons governance: 8 design principles
- [IDS-RAM] — IDS Reference Architecture Model 4.0
- [IDS-SOVEREIGNTY] — Data Sovereignty in IDS

### Standards

- [ISA-95-1] — Equipment hierarchy standard
- [RFC2119] — Requirement level keywords
- [RFC8174] — Requirement level keyword clarification
- [EFFECT-SCHEMA] — Runtime schema validation

### Codebase References

| File | Relevance |
|------|-----------|
| `src/lib/iiot/rpc/RealtimeRpcs.ts` | P1 (subscriptions), P2 (causal schemas), P5 (throttle), P8 (rate limit) |
| `src/lib/iiot/rpc/index.ts` | P7 (17 RPC groups, unconstrained composition) |
| `src/lib/iiot/schemas/identifiers.ts` | P1/P9 (EquipmentLevel, branded IDs), P4 (EventId, FactId) |
| `src/lib/iiot/entity/EntityStack.ts` | P3 (12 entity handlers, all ISA-95 levels) |
| `src/lib/iiot/realtime/event-distribution.ts` | P5 (maxLag), P6 (4 channels, dual-write), P12 (extensible) |
| `src/lib/iiot/realtime/reactivity-bridge.ts` | P2/P3 (handler-level event publishing) |
| `src/lib/iiot/realtime/holonet-bridge.ts` | P6 (fire-and-forget NATS), P10 (cross-node bridge) |
| `src/lib/iiot/machines/graphs/plant-graph.ts` | P2 (Graph.directed state transitions, STAMP validation) |
| `rfc-section-security-trust.md` | P10 (NATS accounts), P11 (Schema.omit redaction) |

---

<!-- INTEGRATION NOTES
- This section is a normative standalone reference for all 12 architectural principles
- Split from rfc-section-theoretical-foundations.md which retains the cognitive science and
  systems theory foundations (Sections 1-3)
- Each principle follows the four-part structure: Statement, Justification, Implementation, Verification
- The verification criteria serve as acceptance tests for conformance claims
- Cross-references: rfc-section-theoretical-foundations.md (theory basis),
  rfc-section-effect-architecture.md (Effect-TS implementation details),
  rfc-section-security-trust.md (P10/P11 security requirements)
- Intended as RFC-001 Section 3b or Section 4 (Architectural Principles) in the final assembly

CODEBASE GROUNDING (2026-02-09):
  All 12 principles cite specific codebase files with line numbers per team-lead directive.
  Key files: RealtimeRpcs.ts, identifiers.ts, EntityStack.ts, event-distribution.ts,
  reactivity-bridge.ts, holonet-bridge.ts, plant-graph.ts, rpc/index.ts
-->
