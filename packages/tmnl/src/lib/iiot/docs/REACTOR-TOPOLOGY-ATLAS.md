# Reactor Topology Atlas

Status: **generated rolling artifact**
Generated: 2026-05-19T23:46:49.383Z

This atlas is generated from code-adjacent Reactor audit data. It is the working map for durable event coverage, relationship multiplicity, and production/candidate consistency lanes.

Events remain the primitive source of truth. Relationship and Reactor declarations are routing/consistency projections over durable facts.

## Summary

| Metric | Count |
| --- | ---: |
| Event groups | 11 |
| Event tags | 101 |
| Reactive events | 3 |
| Candidate events | 38 |
| Non-reactive events | 60 |
| Relationship edge types | 10 |
| Allowed source/target pairs | 87 |
| Production propagation policies | 2 |

## Production lanes

| Source event | Signals | Policy | Target capability |
| --- | --- | --- | --- |
| EquipmentStateChanged | equipment.availability = unavailable\|available | targets.machine-unavailable.blocks-source | dependency.blocked |
| EquipmentStateChanged | equipment.availability = unavailable\|available | requires.equipment-unavailable.blocks-source | dependency.blocked |
| FaultDetected | equipment.availability = unavailable, equipment.fault = detected | targets.machine-unavailable.blocks-source | dependency.blocked |
| FaultDetected | equipment.availability = unavailable, equipment.fault = detected | requires.equipment-unavailable.blocks-source | dependency.blocked |
| MaintenanceModeEntered | equipment.availability = unavailable | targets.machine-unavailable.blocks-source | dependency.blocked |
| MaintenanceModeEntered | equipment.availability = unavailable | requires.equipment-unavailable.blocks-source | dependency.blocked |

## Relationship multiplicity

| Edge | Status | Direction | Allowed sources | Allowed targets | Pair count | Production policies | Candidate signals | Rationale |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| caused_by | candidate | directed | work_order, alarm | alarm, machine, sensor, device, work_order | 10 | — | alarm.state, work_order.execution | Causal provenance is modeled, but automatic mutation from cause chains needs explicit target contracts. |
| contains | topology | directed | enterprise, site, area, plant, line, workcell | site, area, plant, line, workcell, machine | 36 | — | equipment.lifecycle = decommissioned, site/plant/line availability | Core structural traversal edge. Reactive inheritance/cascade policy is intentionally separate and not yet production. |
| depends_on | candidate | directed | work_order | work_order | 1 | — | work_order.execution = suspended\|failed\|cancelled\|completed\|resumed | WorkOrder-to-WorkOrder dependency propagation is a high-value next lane, guarded by causality/idempotency. |
| monitors | candidate | directed | sensor | machine | 1 | — | sensor.fault, alarm.state | Sensor/device conditions can project to monitored equipment availability, but derivation policy is not declared. |
| produces | reference | directed | work_order | external | 1 | — | quality.hold | Output/provenance edge; normally queryable lineage rather than consistency pressure. |
| related_to | reference | bidirectional | work_order, alarm, machine, sensor, device | work_order, alarm, machine, sensor, device | 25 | — | — | Broad association edge; intentionally non-reactive without a narrower policy. |
| requires | production | directed | work_order | external, machine, device | 3 | requires.equipment-unavailable.blocks-source | equipment.availability, device.availability, external.availability | Production lane for required machine availability; external/device availability remain candidate expansions. |
| supervises | candidate | directed | external | work_order, alarm | 2 | — | approval.state, external.availability | Can route supervisor/approval escalation and external outage semantics once external actor availability exists. |
| targets | production | directed | work_order | machine, line, workcell, plant, sensor, device | 6 | targets.machine-unavailable.blocks-source | equipment.availability, alarm.safety, quality.hold | Production lane: machine availability observed on target routes dependency.blocked to source WorkOrder. |
| triggered_by | candidate | directed | alarm | sensor, device | 2 | — | alarm.state = triggered\|cleared, alarm.severity | Alarm trigger provenance can connect alarm severity to sensor/device and then to impacted WorkOrders. |

## Event coverage

| Group | Tag | Status | Signals | Observation specs | Production policies | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| AlarmEvents | AlarmAcknowledged | non_reactive | — | — | — | Alarm lifecycle is durable audit until severity/device safety-hold semantics are explicitly declared. |
| AlarmEvents | AlarmCleared | candidate | alarm.state = cleared | — | — | Alarm clearing can retract safety pressure, but unblock/resume semantics must be target-owned first. |
| AlarmEvents | AlarmConfigChanged | non_reactive | — | — | — | Alarm lifecycle is durable audit until severity/device safety-hold semantics are explicitly declared. |
| AlarmEvents | AlarmEscalated | candidate | alarm.severity = escalated | — | — | Escalation can strengthen safety-hold pressure for related WorkOrders once severity policy exists. |
| AlarmEvents | AlarmOutOfService | non_reactive | — | — | — | Alarm lifecycle is durable audit until severity/device safety-hold semantics are explicitly declared. |
| AlarmEvents | AlarmReturnedToService | non_reactive | — | — | — | Alarm lifecycle is durable audit until severity/device safety-hold semantics are explicitly declared. |
| AlarmEvents | AlarmShelved | non_reactive | — | — | — | Alarm lifecycle is durable audit until severity/device safety-hold semantics are explicitly declared. |
| AlarmEvents | AlarmSuppressed | non_reactive | — | — | — | Alarm lifecycle is durable audit until severity/device safety-hold semantics are explicitly declared. |
| AlarmEvents | AlarmTriggered | candidate | alarm.state = triggered, alarm.severity = critical\|emergency | — | — | Critical/emergency alarms can become WorkOrder safety holds once alarm-to-asset traversal and target contract are declared. |
| AlarmEvents | AlarmUnshelved | non_reactive | — | — | — | Alarm lifecycle is durable audit until severity/device safety-hold semantics are explicitly declared. |
| ApprovalEvents | ApprovalCompleted | non_reactive | — | — | — | Approval events are compliance workflow audit unless a target-owned approval hold contract is declared. |
| ApprovalEvents | ApprovalEscalated | candidate | approval.state = escalated | — | — | Escalation can notify/supervise related WorkOrders or alarms; no mutation policy yet. |
| ApprovalEvents | ApprovalExpired | candidate | approval.state = expired | — | — | Expired approvals can hold dependent execution once approval dependencies are graph-modeled. |
| ApprovalEvents | ApprovalGranted | non_reactive | — | — | — | Approval events are compliance workflow audit unless a target-owned approval hold contract is declared. |
| ApprovalEvents | ApprovalRejected | candidate | approval.state = rejected | — | — | Can produce approval-hold/rejection pressure for a WorkOrder once approval target links are modeled. |
| ApprovalEvents | ApprovalRequested | non_reactive | — | — | — | Approval events are compliance workflow audit unless a target-owned approval hold contract is declared. |
| BatchEvents | BatchCompleted | non_reactive | — | — | — | Batch events are regulatory production records unless quality-hold relationships are declared. |
| BatchEvents | BatchDeviation | candidate | batch.deviation = detected | — | — | Deviation can produce quality/safety hold pressure over produced/related assets once policy exists. |
| BatchEvents | BatchStarted | non_reactive | — | — | — | Batch events are regulatory production records unless quality-hold relationships are declared. |
| BatchEvents | ParameterRecorded | non_reactive | — | — | — | Batch events are regulatory production records unless quality-hold relationships are declared. |
| ContextEvents | AssetAttached | candidate | context.asset = attached | — | — | Can materialize targets/related_to graph edges from context, but should be projection-first rather than Reactor dispatch. |
| ContextEvents | AssetDetached | candidate | context.asset = detached | — | — | Can close graph edges temporally; dispatch only if detachment implies active dependency loss. |
| ContextEvents | ChildWorkOrderSpawned | candidate | context.child_work_order = spawned | — | — | Can materialize depends_on/caused_by edges between parent and child WorkOrders. |
| ContextEvents | ContextCreated | non_reactive | — | — | — | Context events mostly maintain relationship/projection state rather than dispatching structural consistency pressure. |
| ContextEvents | ContextSnapshotted | non_reactive | — | — | — | Context events mostly maintain relationship/projection state rather than dispatching structural consistency pressure. |
| ContextEvents | ContextUpdated | non_reactive | — | — | — | Context events mostly maintain relationship/projection state rather than dispatching structural consistency pressure. |
| ContextEvents | ExternalRefLinked | candidate | context.external_ref = linked | — | — | Can materialize external requires/produces relationships; no target mutation policy yet. |
| ContextEvents | ExternalRefUnlinked | candidate | context.external_ref = unlinked | — | — | Can close external relationships; dispatch only if dependency availability changes. |
| ContextEvents | ResourceAllocated | non_reactive | — | — | — | Context events mostly maintain relationship/projection state rather than dispatching structural consistency pressure. |
| ContextEvents | ResourceReleased | non_reactive | — | — | — | Context events mostly maintain relationship/projection state rather than dispatching structural consistency pressure. |
| EquipmentStateEvents | EquipmentStateChanged | reactive | equipment.availability = unavailable\|available | equipment-state-changed-observation | targets.machine-unavailable.blocks-source, requires.equipment-unavailable.blocks-source | Production observation emits equipment.availability; unavailable routes over targets/requires to WorkOrder dependency.blocked. |
| EquipmentStateEvents | FaultCleared | candidate | equipment.availability = available, equipment.fault = cleared | — | — | Fault clearing can retract availability pressure, but unblock/resume policy is not declared. |
| EquipmentStateEvents | FaultDetected | reactive | equipment.availability = unavailable, equipment.fault = detected | fault-detected-observation | targets.machine-unavailable.blocks-source, requires.equipment-unavailable.blocks-source | Production observation asserts equipment.availability = unavailable and reuses WorkOrder dependency blocking. |
| EquipmentStateEvents | MaintenanceModeEntered | reactive | equipment.availability = unavailable | maintenance-mode-entered-observation | targets.machine-unavailable.blocks-source, requires.equipment-unavailable.blocks-source | Production observation asserts equipment.availability = unavailable and reuses WorkOrder dependency blocking. |
| EquipmentStateEvents | MaintenanceModeExited | candidate | equipment.availability = available | — | — | Available/unblock pressure needs explicit target-owned resume or release semantics before dispatch. |
| EquipmentStateEvents | PerformanceDegraded | candidate | equipment.performance = degraded | — | — | Performance degradation may require degraded-capacity planning rather than suspension; policy is not declared. |
| OperationalEvents | BaseOperationalEvent | non_reactive | — | — | — | BaseOperationalEvent is a placeholder envelope, not a semantic source event. |
| OperatorEvents | ManualAcknowledgment | non_reactive | — | — | — | Operator events are compliance/audit records; they do not imply graph-scoped mutation by default. |
| OperatorEvents | OperatorLogin | non_reactive | — | — | — | Operator events are compliance/audit records; they do not imply graph-scoped mutation by default. |
| OperatorEvents | OperatorLogout | non_reactive | — | — | — | Operator events are compliance/audit records; they do not imply graph-scoped mutation by default. |
| OperatorEvents | ParameterOverride | non_reactive | — | — | — | Operator events are compliance/audit records; they do not imply graph-scoped mutation by default. |
| OperatorEvents | ShiftHandoff | non_reactive | — | — | — | Operator events are compliance/audit records; they do not imply graph-scoped mutation by default. |
| QualityEvents | CAPACreated | candidate | quality.capa = created | — | — | CAPA creation can relate quality remediation to affected WorkOrders/assets; mutation semantics are not declared. |
| QualityEvents | CAPAResolved | candidate | quality.capa = resolved | — | — | CAPA resolution can release quality pressure once target-owned release semantics exist. |
| QualityEvents | InspectionCompleted | candidate | quality.inspection = completed | — | — | Failed inspection can trigger quality hold, but result-to-target relationship policy is not declared. |
| QualityEvents | NCRClosed | candidate | quality.ncr = closed | — | — | Closed NCR can release quality pressure only after target-owned release semantics exist. |
| QualityEvents | NCROpened | candidate | quality.ncr = opened | — | — | Open non-conformance can hold related WorkOrders/batches once quality graph edges exist. |
| StructuralEvents | AreaCreated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | AreaDecommissioned | candidate | structural.lifecycle = decommissioned | — | — | Area shutdown can cascade through contains hierarchy and impact active WorkOrders once inheritance policy exists. |
| StructuralEvents | AreaUpdated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | DeviceCreated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | DeviceDecommissioned | candidate | device.lifecycle = decommissioned, device.availability = unavailable | — | — | Device removal can invalidate required/targeted dependencies, but device availability observation is not declared yet. |
| StructuralEvents | DeviceUpdated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | EnterpriseCreated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | EnterpriseDecommissioned | candidate | structural.lifecycle = decommissioned | — | — | Enterprise shutdown can cascade through contains hierarchy, but terminal inheritance policy is not production yet. |
| StructuralEvents | EnterpriseUpdated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | LineConfigChanged | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | LineCreated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | LineDecommissioned | candidate | structural.lifecycle = decommissioned, equipment.availability = unavailable | — | — | Line decommissioning can affect contained machines and targeted WorkOrders once cascade policy is declared. |
| StructuralEvents | LineRelocated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | LineUpdated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | MachineConfigChanged | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | MachineCreated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | MachineDecommissioned | candidate | equipment.lifecycle = decommissioned, equipment.availability = unavailable | — | — | Machine deletion/unavailability can block targets/requires WorkOrders, but terminal-review semantics are not declared yet. |
| StructuralEvents | MachineRelocated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | MachineUpdated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | PlantCreated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | PlantDecommissioned | candidate | structural.lifecycle = decommissioned, equipment.availability = unavailable | — | — | Plant decommissioning is a natural contains-cascade source, but child lifecycle and WorkOrder impact policy are not production yet. |
| StructuralEvents | PlantRelocated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | PlantUpdated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | SensorCalibrated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | SensorCreated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | SensorDecommissioned | candidate | sensor.lifecycle = decommissioned | — | — | Sensor removal can affect monitored equipment or alarm validity, but no production policy exists yet. |
| StructuralEvents | SensorThresholdChanged | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | SensorUpdated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | SiteCreated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | SiteDecommissioned | candidate | structural.lifecycle = decommissioned | — | — | Site shutdown can cascade through contains hierarchy and impact active WorkOrders once inheritance policy exists. |
| StructuralEvents | SiteUpdated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | WorkCellCreated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| StructuralEvents | WorkCellDecommissioned | candidate | structural.lifecycle = decommissioned, equipment.availability = unavailable | — | — | WorkCell decommissioning can affect contained machines and targeted WorkOrders once cascade policy is declared. |
| StructuralEvents | WorkCellUpdated | non_reactive | — | — | — | Structural lifecycle/configuration events update SQL/graph projections; Reactor only acts when a concrete consistency reaction exists. |
| TaskEvents | TaskBecameReady | non_reactive | — | — | — | Task lifecycle belongs inside the WorkOrder/Task aggregate until task nodes become graph entities. |
| TaskEvents | TaskBlocked | candidate | task.execution = blocked | — | — | Could block parent WorkOrder if task nodes become graph entities; currently likely aggregate-internal. |
| TaskEvents | TaskCompensated | non_reactive | — | — | — | Task lifecycle belongs inside the WorkOrder/Task aggregate until task nodes become graph entities. |
| TaskEvents | TaskCompleted | non_reactive | — | — | — | Task lifecycle belongs inside the WorkOrder/Task aggregate until task nodes become graph entities. |
| TaskEvents | TaskFailed | candidate | task.execution = failed | — | — | Could fail/block parent WorkOrder if task-to-WorkOrder graph edges are promoted. |
| TaskEvents | TaskProgressUpdated | non_reactive | — | — | — | Task lifecycle belongs inside the WorkOrder/Task aggregate until task nodes become graph entities. |
| TaskEvents | TaskSkipped | non_reactive | — | — | — | Task lifecycle belongs inside the WorkOrder/Task aggregate until task nodes become graph entities. |
| TaskEvents | TaskStarted | non_reactive | — | — | — | Task lifecycle belongs inside the WorkOrder/Task aggregate until task nodes become graph entities. |
| TaskEvents | TaskUnblocked | candidate | task.execution = unblocked | — | — | Could release parent WorkOrder task pressure, but aggregate ownership must be defined. |
| WorkOrderEvents | WorkOrderApproved | non_reactive | — | — | — | WorkOrder lifecycle events are target-owned audit unless cross-WorkOrder dependency propagation is declared. |
| WorkOrderEvents | WorkOrderCancelled | candidate | work_order.execution = cancelled | — | — | Cancellation can block or replan downstream WorkOrders over depends_on once target reaction semantics exist. |
| WorkOrderEvents | WorkOrderClosed | non_reactive | — | — | — | WorkOrder lifecycle events are target-owned audit unless cross-WorkOrder dependency propagation is declared. |
| WorkOrderEvents | WorkOrderCompleted | candidate | work_order.execution = completed | — | — | Completion can satisfy downstream depends_on prerequisites once dependency fulfillment semantics are declared. |
| WorkOrderEvents | WorkOrderCreated | non_reactive | — | — | — | WorkOrder lifecycle events are target-owned audit unless cross-WorkOrder dependency propagation is declared. |
| WorkOrderEvents | WorkOrderFailed | candidate | work_order.execution = failed | — | — | Failure can block or fail downstream WorkOrders over depends_on once target reaction semantics exist. |
| WorkOrderEvents | WorkOrderRejected | non_reactive | — | — | — | WorkOrder lifecycle events are target-owned audit unless cross-WorkOrder dependency propagation is declared. |
| WorkOrderEvents | WorkOrderResumed | candidate | work_order.execution = resumed | — | — | A resumed upstream WorkOrder can release downstream pressure only after target-owned resume semantics exist. |
| WorkOrderEvents | WorkOrderStarted | candidate | work_order.execution = started | — | — | WorkOrder execution can affect dependent WorkOrders over depends_on, but echo-loop and ownership rules must be declared. |
| WorkOrderEvents | WorkOrderSubmitted | non_reactive | — | — | — | WorkOrder lifecycle events are target-owned audit unless cross-WorkOrder dependency propagation is declared. |
| WorkOrderEvents | WorkOrderSuspended | candidate | work_order.execution = suspended | — | — | A suspended upstream WorkOrder can block downstream WorkOrders over depends_on once causality/idempotency policy exists. |
