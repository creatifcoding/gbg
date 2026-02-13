# RFC-001 Section: Theoretical Foundations and Architectural Principles

```
Section:       Theoretical Foundations and Architectural Principles
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Status:        DRAFT
Author:        Val (interface-visionary)
Created:       2026-02-09
Research Base: research-theoretical-foundations.md (744 lines, 11 sections, 7 frameworks + manufacturing commons extension)
```

> This section establishes the cognitive science, systems theory, and commons governance
> foundations that constrain the entity-realtime architecture. Every architectural
> requirement (P1-P12) traces to peer-reviewed theoretical frameworks. Implementations
> MUST satisfy these principles; deviations require explicit justification against the
> cited theory. The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY"
> are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Cognitive Science Foundations](#1-cognitive-science-foundations)
2. [Systems Theory Foundations](#2-systems-theory-foundations)
3. [Manufacturing Commons Foundations](#3-manufacturing-commons-foundations)
4. [Architectural Principles P1-P8: Intra-Organization](#4-architectural-principles-p1-p8-intra-organization)
5. [Architectural Principles P9-P12: Manufacturing Commons](#5-architectural-principles-p9-p12-manufacturing-commons)
6. [Theory-to-Implementation Mapping](#6-theory-to-implementation-mapping)
7. [Normative Constraints Derived from Theory](#7-normative-constraints-derived-from-theory)
8. [Open Questions](#8-open-questions)

---

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
