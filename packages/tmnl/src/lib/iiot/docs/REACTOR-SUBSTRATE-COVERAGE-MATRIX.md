# Reactor Substrate Coverage Matrix

Status: **active audit**
Scope: IIoT Reactor substrate only — durable events, relationship topology, propagation policies, entity reaction contracts, source claims, checkpoints.

The Reactor is **not** expected to react to every domain event. It is expected to make every decision explicit:

- **Reactive** — a production `EventObservationSpec` emits signals used by production `RelationshipPropagationPolicy` declarations.
- **Non-reactive** — event remains durable audit/history but intentionally does not route structural consistency pressure.
- **Candidate** — event likely belongs in Reactor, but propagation semantics need a production policy and target contract.

This document prevents silent gaps. If an event or relationship is not reactive, that must be a design decision, not an accident.

---

## 1. Current Production Reactor Surface

| Layer | Production declarations | Current coverage |
| --- | ---: | --- |
| Event observation specs | 1 | `EquipmentStateChangedObservationSpec` |
| Relationship propagation policies | 2 | `TargetsMachineUnavailableBlocksSource`, `RequiresEquipmentUnavailableBlocksSource` |
| Entity reaction contracts | 1 | `work_order.dependency.blocked` |
| Source-entry authority | 1 mechanism | SQL `reactor_source_claims` keyed by `(consumer_id, source_entry_id)` |
| Final replay dedupe | 1 mechanism | `reactor_checkpoints` |
| Optional mailbox serialization | 1 facade | `ReactorWorkerEntity(ownerKey)` |

Current proven production lanes:

```text
EquipmentStateChanged
  -> ReactorObservation(subject = machine, signal equipment.availability)
  -> targets.machine-unavailable.blocks-source
  -> graph: work_order -[:targets]-> machine
  -> WorkOrder dependency.blocked
  -> WorkOrder suspend
  -> source claim complete + checkpoint

EquipmentStateChanged
  -> ReactorObservation(subject = machine, signal equipment.availability)
  -> requires.equipment-unavailable.blocks-source
  -> graph: work_order -[:requires]-> machine
  -> WorkOrder dependency.blocked
  -> WorkOrder suspend
  -> checkpoint/idempotency
```

---

## 2. EventGroup Coverage

### 2.1 StructuralEvents — non-reactive by default

Structural events define and mutate topology/state anchors. They are usually handled by graph sync/model projections, not Reactor propagation.

| Event group | Tags | Reactor status | Rationale |
| --- | ---: | --- | --- |
| StructuralEvents | 34 | Non-reactive by default | Creation/update/decommission events should update graph/model projections. They should only become Reactor signals when a concrete consistency reaction exists, e.g. decommissioned target blocks active work. |

Tags:

```text
EnterpriseCreated, EnterpriseUpdated, EnterpriseDecommissioned,
SiteCreated, SiteUpdated, SiteDecommissioned,
AreaCreated, AreaUpdated, AreaDecommissioned,
PlantCreated, PlantUpdated, PlantRelocated, PlantDecommissioned,
LineCreated, LineUpdated, LineConfigChanged, LineRelocated, LineDecommissioned,
WorkCellCreated, WorkCellUpdated, WorkCellDecommissioned,
MachineCreated, MachineUpdated, MachineConfigChanged, MachineRelocated, MachineDecommissioned,
SensorCreated, SensorUpdated, SensorCalibrated, SensorThresholdChanged, SensorDecommissioned,
DeviceCreated, DeviceUpdated, DeviceDecommissioned
```

Candidate future lane:

```text
MachineDecommissioned / DeviceDecommissioned / SensorDecommissioned
  -> availability unavailable / entity deleted signal
  -> targets|requires affected WorkOrders
  -> WorkOrder dependency.blocked or terminal review hold
```

### 2.2 OperationalEvents placeholder — non-reactive

| Event group | Tags | Reactor status | Rationale |
| --- | ---: | --- | --- |
| OperationalEvents | 1 | Non-reactive | `BaseOperationalEvent` is a placeholder, not a semantic event. |

### 2.3 EquipmentStateEvents — reactive core + candidates

| Event | Status | Current/future signal | Notes |
| --- | --- | --- | --- |
| `EquipmentStateChanged` | **Reactive** | `equipment.availability = unavailable|available` | Current production lane. |
| `MaintenanceModeEntered` | Candidate reactive | `equipment.availability = unavailable` | Should likely reuse the same WorkOrder dependency policy. |
| `MaintenanceModeExited` | Candidate reactive | `equipment.availability = available` | Requires explicit unblock/resume policy before dispatch. |
| `PerformanceDegraded` | Candidate reactive | `equipment.performance = degraded` | Informational or degraded-capacity policy, not current suspend lane. |
| `FaultDetected` | Candidate reactive | `equipment.availability = unavailable` or `equipment.fault = detected` | Should likely block dependent WorkOrders for severe faults. |
| `FaultCleared` | Candidate reactive | `equipment.availability = available` or `equipment.fault = cleared` | Requires explicit unblock/resume policy. |

Current production coverage is **not complete for this group**. Only `EquipmentStateChanged` is wired.

### 2.4 AlarmEvents — candidate reactive

| Event | Status | Candidate signal | Notes |
| --- | --- | --- | --- |
| `AlarmTriggered` | Candidate reactive | `alarm.state = triggered`, `alarm.severity = critical|emergency` | Could block WorkOrders requiring/targeting affected device with `safety_hold`. Needs policy. |
| `AlarmCleared` | Candidate reactive | `alarm.state = cleared` | Requires unblock/resume semantics. |
| `AlarmEscalated` | Candidate reactive | `alarm.severity = emergency` | Could trigger stricter hold/escalation. |
| Other alarm lifecycle events | Non-reactive until policy exists | audit/lifecycle | Acknowledged/shelved/suppressed/config changes are durable but do not imply target mutation by default. |

### 2.5 WorkOrderEvents — mostly non-reactive, dependency candidates

WorkOrder lifecycle events are usually target-owned audit. They should not echo back into Reactor unless modeling inter-WorkOrder dependencies.

| Event subset | Status | Candidate relationship |
| --- | --- | --- |
| `WorkOrderStarted/Completed/Failed/Cancelled/Suspended/Resumed` | Candidate reactive | `depends_on`, `caused_by`, `related_to` |
| `WorkOrderCreated/Submitted/Approved/Rejected/Closed` | Non-reactive by default | audit/projection |

Candidate future lane:

```text
Upstream WorkOrderFailed or WorkOrderSuspended
  -> work_order.execution = blocked|failed
  -> depends_on upstream observed as target
  -> dependent WorkOrder dependency.blocked
```

### 2.6 ContextEvents — graph/projection lane, not Reactor by default

Context events such as `AssetAttached`, `AssetDetached`, `ExternalRefLinked`, and `ChildWorkOrderSpawned` should primarily update graph relationships or projections. They only become Reactor events when they imply downstream consistency pressure.

### 2.7 TaskEvents — candidate reactive

Task events can affect parent WorkOrder execution, but that is usually within the WorkOrder aggregate/machine boundary. Reactor involvement is only appropriate for cross-entity relationships.

Candidate:

```text
TaskBlocked
  -> task.execution = blocked
  -> parent WorkOrder dependency.blocked or WorkOrderMachine internal transition
```

This likely belongs inside WorkOrder/Task aggregate first, not generic Reactor, unless task nodes become graph entities.

### 2.8 ApprovalEvents, BatchEvents, QualityEvents, OperatorEvents — non-reactive by default

These groups are regulatory/audit/process records. They are durable and queryable, but they do not currently declare graph-scoped structural consistency reactions.

Candidate exceptions:

- `ApprovalRejected` could block a WorkOrder awaiting approval.
- `BatchDeviation` / `NCROpened` could cause quality holds.
- `ParameterOverride` may require audit notification, not mutation.

Do not wire these into Reactor without explicit target-owned contracts.

---

## 3. Relationship Edge Coverage

| Edge | Allowed source -> target | Production policy status | Current decision |
| --- | --- | --- | --- |
| `targets` | `work_order -> machine|line|workcell|plant|sensor|device` | **Reactive** | Current policy handles `equipment.availability = unavailable` observed on target and sends `dependency.blocked` to source WorkOrder. |
| `requires` | `work_order -> external|machine|device` | **Reactive for machine/equipment unavailability** | Production policy handles `equipment.availability = unavailable` observed on a required machine and sends `dependency.blocked` to source WorkOrder. External/device-specific observation sources remain candidates. |
| `depends_on` | `work_order -> work_order` | Candidate reactive | Needs WorkOrder-to-WorkOrder dependency policy. |
| `caused_by` | `work_order|alarm -> alarm|machine|sensor|device|work_order` | Candidate/informational | Likely causality/audit first; reactive only for explicit escalation/hold semantics. |
| `related_to` | `work_order|alarm|machine|sensor|device -> same set` | Non-reactive by default | Bidirectional association is too broad for automatic mutation. |
| `supervises` | `external -> work_order|alarm` | Candidate reactive | Could route external supervisor outage/escalation. Needs event semantics. |
| `produces` | `work_order -> external` | Non-reactive by default | Output/provenance relationship, not consistency pressure. |
| `contains` | hierarchy nodes | Non-reactive by default | Topology traversal/projection. |
| `monitors` | `sensor -> machine` | Candidate reactive | Sensor alarm/fault can inform machine/device availability, but needs policy. |
| `triggered_by` | `alarm -> sensor|device` | Candidate reactive | Alarm source can project condition to device/sensor. Target mutation policy not yet declared. |

---

## 4. Required Completion Lanes

### Lane A — Current production lane hardening

Must be green before expanding semantics:

1. observation decode tests for `EquipmentStateChanged`;
2. registry tests for `TargetsMachineUnavailableBlocksSource`;
3. graph expansion tests for `targets`, target-observed direction;
4. source-claim E2E for SQL EventJournal -> claim -> dispatch -> checkpoint;
5. worker entity facade test.

Status: mostly implemented; needs explicit coverage-matrix tests.

### Lane B — Extend `requires` dependency blocking beyond machines

Machine/equipment unavailability is now a production `requires` lane. Remaining candidate variants:

```text
Device/external unavailable
  -> work_order -[:requires]-> dependency
  -> WorkOrder dependency.blocked
```

Needs:

- observation source for external/device availability;
- WorkOrder contract reason selection (`equipment_unavailable` vs `external_dependency`);
- integration/E2E tests.

### Lane C — WorkOrder dependency graph

```text
Upstream WorkOrder blocked/failed/cancelled
  -> depends_on
  -> downstream WorkOrder dependency.blocked
```

Needs:

- WorkOrder lifecycle observation spec;
- `depends_on` propagation policy;
- guard against recursive echo loops via causality/idempotency;
- transition semantics owned by WorkOrderMachine.

### Lane D — Alarm/device safety hold

```text
AlarmTriggered critical/emergency on device/sensor
  -> requires|targets|triggered_by/monitors path
  -> WorkOrder safety_hold
```

Needs:

- Alarm observation spec;
- policy design for direct vs derived relationship traversal;
- WorkOrder reaction payload-based suspension reason;
- E2E tests.

---

## 5. Completion Definition

The Reactor substrate is complete when:

1. every production policy is declared in `edge-types.ts` or an adjacent registry module;
2. every production policy is included in `ReactorGenericWorkOrderRegistryLive` or an equivalent production registry layer;
3. every observation spec has payload decode tests;
4. every policy has graph expansion tests;
5. every target contract capability has classify + dispatch tests;
6. every reactive lane has source-claim/checkpoint/idempotency proof;
7. every non-reactive EventGroup is documented with rationale;
8. focused Reactor validation passes.

Until then, the Reactor engine is real, but the Reactor substrate is **not complete**.
