# RFC-001 Section 5: Reactive ISA-95 Hierarchy Specification

> **Author:** isa95-architect (Val)
> **Task:** #65
> **Date:** 2026-02-09
> **Status:** Normative RFC Section — Ready for Integration
> **Source Material:** `research-reactive-isa95.md` (1,180 lines), `rfc-entity-realtime-integration.md` Section 5 (400+ lines)
> **Assembly Target:** Section 5 in the final RFC-001 document

---

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
