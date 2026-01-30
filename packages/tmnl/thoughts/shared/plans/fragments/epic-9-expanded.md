# Epic 9: Work Order Domain Event Sourcing (Expanded)

**Generated:** 2026-01-29
**Synthesized From:**
- `2026-01-26-v3-service-architecture-wbs.md` (Original Epic 9)
- `2026-01-29-eventlog-integration-wbs-final.md` (Epic EL-3)
- `2026-01-29-work-order-workflow-decomposition.md` (46 Events Reference)

**Goal:** 46 events across 6 aggregates for FDA-compliant work order lifecycle with full audit trail, temporal queries, and compliance support.

**Story Points:** 34 SP (expanded from original 13 SP)
**Sprints:** 4-5

---

## Aggregate Overview

| Aggregate | Events | Purpose | Compliance |
|-----------|--------|---------|------------|
| **WorkOrder** | 11 | Lifecycle state machine | ISA-95 L3, FDA 21 CFR Part 11 |
| **WorkOrderContext** | 10 | Hybrid snapshot + live refs | Audit trail, RCA |
| **TaskInstance** | 9 | Task execution tracking | Process control |
| **ApprovalRequest** | 6 | 4-eyes principle, escalation | FDA, ISO 9001 |
| **L3SyncOperation** | 5 | External system integration | ERP reconciliation |
| **WorkflowDefinition** | 5 | Template versioning | Change control |
| **TOTAL** | **46** | | |

---

## Aggregate: WorkOrder (11 events)

### Event Catalog

| Event | Payload Fields | Purpose |
|-------|----------------|---------|
| `WorkOrderCreated` | workOrderId, workflowDefinitionId, workflowVersion, title, description, priority, createdBy, createdAt, scheduledStart, dueDate | Initial creation from template |
| `WorkOrderSubmitted` | workOrderId, submittedBy, submittedAt | Submitted for approval |
| `WorkOrderApproved` | workOrderId, approvedBy, approvedAt, approvalLevel, comments | Approved (single or 4-eyes) |
| `WorkOrderRejected` | workOrderId, rejectedBy, rejectedAt, reason | Rejected with reason |
| `WorkOrderStarted` | workOrderId, startedBy, startedAt, actualStart | Execution begins |
| `WorkOrderSuspended` | workOrderId, suspendedBy, suspendedAt, reason, expectedResume | Paused execution |
| `WorkOrderResumed` | workOrderId, resumedBy, resumedAt | Resumed from suspension |
| `WorkOrderCompleted` | workOrderId, completedBy, completedAt, actualEnd, outcome, summary | Successful completion |
| `WorkOrderFailed` | workOrderId, failedAt, failureReason, failedTaskId | Failed with reason |
| `WorkOrderCancelled` | workOrderId, cancelledBy, cancelledAt, reason, compensationRequired | Cancelled before completion |
| `WorkOrderClosed` | workOrderId, closedBy, closedAt, finalStatus | Final archived state |

### State Machine

```
created --> submitted --> approved --> started --> completed --> closed
    |            |            |            |            |
    v            v            v            v            v
cancelled    rejected    cancelled    suspended    failed
                                          |            |
                                          v            v
                                       resumed      closed
```

---

## Aggregate: WorkOrderContext (10 events)

### Event Catalog

| Event | Payload Fields | Purpose |
|-------|----------------|---------|
| `ContextCreated` | workOrderId, initialAssets, createdBy, createdAt | Initialize context container |
| `ContextUpdated` | workOrderId, patch, previousVersion, newVersion, updatedBy, updatedAt | Version-tracked mutation |
| `ContextSnapshotted` | workOrderId, snapshotId, version, snapshotAt, reason | Immutable audit checkpoint |
| `AssetAttached` | workOrderId, assetId, assetType, snapshotData, attachedBy, attachedAt | Link machine/equipment |
| `AssetDetached` | workOrderId, assetId, detachedBy, detachedAt, reason | Unlink asset |
| `ResourceAllocated` | workOrderId, resourceId, resourceType, quantity, unit, allocatedBy, allocatedAt | Allocate parts/tools/personnel |
| `ResourceReleased` | workOrderId, resourceId, quantityReleased, releasedBy, releasedAt, reason | Release resources |
| `ExternalRefLinked` | workOrderId, system, externalId, linkedBy, linkedAt | Link ERP/ticket reference |
| `ExternalRefUnlinked` | workOrderId, system, externalId, unlinkedBy, unlinkedAt | Unlink external reference |
| `ChildWorkOrderSpawned` | parentWorkOrderId, childWorkOrderId, reason, spawnedAt | Create nested workflow |

### Context Operations Pattern

```typescript
// Dual-mode operations
Context.snapshot(workOrderId) --> Immutable ContextSnapshot (audit)
Context.resolve(workOrderId)  --> Live WorkOrderContext (queries)
Context.update(workOrderId, patch) --> Version-tracked mutation
```

---

## Aggregate: TaskInstance (9 events)

### Event Catalog

| Event | Payload Fields | Purpose |
|-------|----------------|---------|
| `TaskBecameReady` | taskInstanceId, workOrderId, taskDefinitionId, becameReadyAt | Dependencies satisfied |
| `TaskStarted` | taskInstanceId, workOrderId, startedBy, startedAt, assignedTo | Execution began |
| `TaskProgressUpdated` | taskInstanceId, workOrderId, progress (0-100), notes, updatedAt | Progress tracking |
| `TaskBlocked` | taskInstanceId, workOrderId, blockedAt, blockingReason, blockedBy | Blocked by issue/dependency |
| `TaskUnblocked` | taskInstanceId, workOrderId, unblockedAt | Block resolved |
| `TaskCompleted` | taskInstanceId, workOrderId, completedBy, completedAt, output | Successful completion |
| `TaskFailed` | taskInstanceId, workOrderId, failedAt, error, retryable | Failed with error |
| `TaskSkipped` | taskInstanceId, workOrderId, skippedBy, skippedAt, reason | Conditionally skipped |
| `TaskCompensated` | taskInstanceId, workOrderId, compensatedAt, compensationResult | Rollback executed |

---

## Aggregate: ApprovalRequest (6 events)

### Event Catalog

| Event | Payload Fields | Purpose |
|-------|----------------|---------|
| `ApprovalRequested` | approvalId, workOrderId, taskInstanceId, approvalType, requiredApprovers, requestedBy, requestedAt, expiresAt | Create approval gate |
| `ApprovalGranted` | approvalId, approvedBy, approvedAt, comments, approvalCount, requiredCount | Single approval received |
| `ApprovalRejected` | approvalId, rejectedBy, rejectedAt, reason | Approval denied |
| `ApprovalEscalated` | approvalId, escalatedAt, escalationLevel, newApprovers, reason | Timeout escalation |
| `ApprovalCompleted` | approvalId, completedAt, finalStatus | All approvals received |
| `ApprovalExpired` | approvalId, expiredAt, escalated | Timeout without decision |

### Approval Types (FDA Compliance)

```typescript
type ApprovalRequirement =
  | 'none'           // Auto-approve
  | 'single'         // One approver
  | 'dual'           // Two approvers (4-eyes principle)
  | 'supervisor'     // Requires supervisor role
  | 'quality'        // Requires QA role
```

---

## Aggregate: L3SyncOperation (5 events)

### Event Catalog

| Event | Payload Fields | Purpose |
|-------|----------------|---------|
| `L3SyncStarted` | syncId, workOrderId, system, direction, startedAt, itemCount | Begin ERP/external sync |
| `L3SyncProgress` | syncId, progress (0-100), itemsProcessed, currentPhase, updatedAt | Sync progress update |
| `L3SyncCompleted` | syncId, workOrderId, system, completedAt, itemsSynced, duration | Successful sync |
| `L3SyncFailed` | syncId, workOrderId, system, failedAt, error, retryable, itemsProcessedBeforeFailure | Sync failure |
| `ExternalChangeDetected` | workOrderId, system, changeType, externalId, detectedAt, payload | External system change notification |

### Sync Direction

```typescript
type SyncDirection = 'push' | 'pull' | 'bidirectional'
type ExternalSystem = 'sap' | 'oracle_ebs' | 'dynamics365' | 'cmms' | 'custom'
```

---

## Aggregate: WorkflowDefinition (5 events)

### Event Catalog

| Event | Payload Fields | Purpose |
|-------|----------------|---------|
| `DefinitionCreated` | definitionId, name, version (semver), createdBy, createdAt | New workflow template |
| `DefinitionVersioned` | definitionId, previousVersion, newVersion, changes, versionedBy, versionedAt | New version published |
| `DefinitionActivated` | definitionId, version, activatedBy, activatedAt | Ready for use |
| `DefinitionDeprecated` | definitionId, version, deprecatedBy, deprecatedAt, reason, migrationPath | No new work orders |
| `DefinitionArchived` | definitionId, archivedBy, archivedAt | Removed from active list |

---

## Section 9.1: Event Schema Definitions

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 9.1.1 | Define WorkOrderId, TaskInstanceId, ApprovalId, SyncId branded identifiers | `schemas/identifiers.ts` | S | Epic 1 |
| 9.1.2 | Define WorkOrderStatus, WorkOrderPriority, WorkOrderOutcome literals | `schemas/work-orders.ts` | S | - |
| 9.1.3 | Define SuspensionReason, WorkOrderFinalStatus literals | `schemas/work-orders.ts` | S | - |
| 9.1.4 | Define WorkOrder domain schema with all fields | `schemas/work-orders.ts` | M | 9.1.1-3 |
| 9.1.5 | Define 11 WorkOrder event schemas | `schemas/events/work-order-events.ts` | L | 9.1.4, Epic 7 |
| 9.1.6 | Create WorkOrderEvents EventGroup | `schemas/events/work-order-events.ts` | M | 9.1.5 |
| 9.1.7 | Define ContextPatch, ContextVersion, SnapshotReason types | `schemas/work-order-context.ts` | M | 9.1.1 |
| 9.1.8 | Define AssetRef, ResourceAllocation, ExternalSystem types | `schemas/work-order-context.ts` | M | 9.1.1 |
| 9.1.9 | Define 10 WorkOrderContext event schemas | `schemas/events/context-events.ts` | L | 9.1.7-8, Epic 7 |
| 9.1.10 | Create WorkOrderContextEvents EventGroup | `schemas/events/context-events.ts` | M | 9.1.9 |
| 9.1.11 | Define TaskStatus, BlockingReason, CompensationResult types | `schemas/task-instance.ts` | M | 9.1.1 |
| 9.1.12 | Define 9 TaskInstance event schemas | `schemas/events/task-events.ts` | M | 9.1.11, Epic 7 |
| 9.1.13 | Create TaskInstanceEvents EventGroup | `schemas/events/task-events.ts` | S | 9.1.12 |
| 9.1.14 | Define ApprovalType, ApprovalFinalStatus types | `schemas/approval.ts` | S | 9.1.1 |
| 9.1.15 | Define 6 ApprovalRequest event schemas | `schemas/events/approval-events.ts` | M | 9.1.14, Epic 7 |
| 9.1.16 | Create ApprovalEvents EventGroup | `schemas/events/approval-events.ts` | S | 9.1.15 |
| 9.1.17 | Define SyncDirection, SyncPhase, ExternalChangeType types | `schemas/l3-sync.ts` | S | 9.1.1 |
| 9.1.18 | Define 5 L3SyncOperation event schemas | `schemas/events/l3-sync-events.ts` | M | 9.1.17, Epic 7 |
| 9.1.19 | Create L3SyncEvents EventGroup | `schemas/events/l3-sync-events.ts` | S | 9.1.18 |
| 9.1.20 | Define SemanticVersion, DefinitionChange types | `schemas/workflow-definition.ts` | S | 9.1.1 |
| 9.1.21 | Define 5 WorkflowDefinition event schemas | `schemas/events/definition-events.ts` | M | 9.1.20, Epic 7 |
| 9.1.22 | Create WorkflowDefinitionEvents EventGroup | `schemas/events/definition-events.ts` | S | 9.1.21 |
| 9.1.23 | Create combined IIoTEventLogSchema (all 6 groups) | `schemas/events/schema.ts` | M | 9.1.6,10,13,16,19,22 |

**Section 9.1 Story Points:** 10 SP

---

## Section 9.2: Event Handlers (Projections)

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 9.2.1 | Create WorkOrderEventHandlers (EventLog.group) | `handlers/work-order-handlers.ts` | L | 9.1.6 |
| 9.2.2 | Handle WorkOrderCreated -> insert projection | `handlers/work-order-handlers.ts` | M | 9.2.1 |
| 9.2.3 | Handle WorkOrderSubmitted -> update status | `handlers/work-order-handlers.ts` | S | 9.2.1 |
| 9.2.4 | Handle WorkOrderApproved -> update status + audit | `handlers/work-order-handlers.ts` | M | 9.2.1 |
| 9.2.5 | Handle WorkOrderRejected -> update + notify | `handlers/work-order-handlers.ts` | M | 9.2.1 |
| 9.2.6 | Handle WorkOrderStarted -> update + start timer | `handlers/work-order-handlers.ts` | M | 9.2.1 |
| 9.2.7 | Handle WorkOrderSuspended -> update + pause timer | `handlers/work-order-handlers.ts` | M | 9.2.1 |
| 9.2.8 | Handle WorkOrderResumed -> update + resume timer | `handlers/work-order-handlers.ts` | S | 9.2.1 |
| 9.2.9 | Handle WorkOrderCompleted -> update + metrics | `handlers/work-order-handlers.ts` | M | 9.2.1 |
| 9.2.10 | Handle WorkOrderFailed -> update + alert | `handlers/work-order-handlers.ts` | M | 9.2.1 |
| 9.2.11 | Handle WorkOrderCancelled -> update + compensation | `handlers/work-order-handlers.ts` | M | 9.2.1 |
| 9.2.12 | Handle WorkOrderClosed -> archive | `handlers/work-order-handlers.ts` | S | 9.2.1 |
| 9.2.13 | Create WorkOrderContextEventHandlers | `handlers/context-handlers.ts` | L | 9.1.10 |
| 9.2.14 | Handle ContextCreated -> insert context | `handlers/context-handlers.ts` | M | 9.2.13 |
| 9.2.15 | Handle ContextUpdated -> versioned update | `handlers/context-handlers.ts` | M | 9.2.13 |
| 9.2.16 | Handle ContextSnapshotted -> create snapshot record | `handlers/context-handlers.ts` | M | 9.2.13 |
| 9.2.17 | Handle AssetAttached/Detached -> update refs | `handlers/context-handlers.ts` | M | 9.2.13 |
| 9.2.18 | Handle ResourceAllocated/Released -> update allocations | `handlers/context-handlers.ts` | M | 9.2.13 |
| 9.2.19 | Handle ExternalRefLinked/Unlinked -> update refs | `handlers/context-handlers.ts` | S | 9.2.13 |
| 9.2.20 | Handle ChildWorkOrderSpawned -> link parent/child | `handlers/context-handlers.ts` | M | 9.2.13 |
| 9.2.21 | Create TaskInstanceEventHandlers | `handlers/task-handlers.ts` | M | 9.1.13 |
| 9.2.22 | Handle all 9 task events | `handlers/task-handlers.ts` | L | 9.2.21 |
| 9.2.23 | Create ApprovalEventHandlers | `handlers/approval-handlers.ts` | M | 9.1.16 |
| 9.2.24 | Handle all 6 approval events | `handlers/approval-handlers.ts` | M | 9.2.23 |
| 9.2.25 | Create L3SyncEventHandlers | `handlers/l3-sync-handlers.ts` | M | 9.1.19 |
| 9.2.26 | Handle all 5 L3 sync events | `handlers/l3-sync-handlers.ts` | M | 9.2.25 |
| 9.2.27 | Create WorkflowDefinitionEventHandlers | `handlers/definition-handlers.ts` | M | 9.1.22 |
| 9.2.28 | Handle all 5 definition events | `handlers/definition-handlers.ts` | M | 9.2.27 |

**Section 9.2 Story Points:** 10 SP

---

## Section 9.3: Models & Repositories

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 9.3.1 | Create WorkOrderModel (projection table) | `models/work-orders/WorkOrderModel.ts` | M | 9.1.4 |
| 9.3.2 | Create WorkOrderModel.ddl.ts | `models/work-orders/WorkOrderModel.ddl.ts` | M | 9.3.1 |
| 9.3.3 | Create WorkOrderContextModel | `models/work-orders/WorkOrderContextModel.ts` | M | 9.1.7 |
| 9.3.4 | Create WorkOrderContextModel.ddl.ts | `models/work-orders/WorkOrderContextModel.ddl.ts` | M | 9.3.3 |
| 9.3.5 | Create ContextSnapshotModel (immutable) | `models/work-orders/ContextSnapshotModel.ts` | M | 9.1.7 |
| 9.3.6 | Create ContextSnapshotModel.ddl.ts | `models/work-orders/ContextSnapshotModel.ddl.ts` | M | 9.3.5 |
| 9.3.7 | Create TaskInstanceModel | `models/work-orders/TaskInstanceModel.ts` | M | 9.1.11 |
| 9.3.8 | Create TaskInstanceModel.ddl.ts | `models/work-orders/TaskInstanceModel.ddl.ts` | M | 9.3.7 |
| 9.3.9 | Create ApprovalRequestModel | `models/work-orders/ApprovalRequestModel.ts` | S | 9.1.14 |
| 9.3.10 | Create ApprovalRequestModel.ddl.ts | `models/work-orders/ApprovalRequestModel.ddl.ts` | S | 9.3.9 |
| 9.3.11 | Create L3SyncOperationModel | `models/work-orders/L3SyncOperationModel.ts` | S | 9.1.17 |
| 9.3.12 | Create L3SyncOperationModel.ddl.ts | `models/work-orders/L3SyncOperationModel.ddl.ts` | S | 9.3.11 |
| 9.3.13 | Create WorkflowDefinitionModel | `models/work-orders/WorkflowDefinitionModel.ts` | M | 9.1.20 |
| 9.3.14 | Create WorkflowDefinitionModel.ddl.ts | `models/work-orders/WorkflowDefinitionModel.ddl.ts` | M | 9.3.13 |
| 9.3.15 | Add migration `0015_work_orders` | `models/_migrations.ts` | M | 9.3.2,4,6,8,10,12,14 |
| 9.3.16 | Create WorkOrderRepo (projection-only, read) | `repos/WorkOrderRepo.ts` | M | 9.3.1 |
| 9.3.17 | Create WorkOrderContextRepo | `repos/WorkOrderContextRepo.ts` | M | 9.3.3 |
| 9.3.18 | Create ContextSnapshotRepo (read-only) | `repos/ContextSnapshotRepo.ts` | S | 9.3.5 |
| 9.3.19 | Create TaskInstanceRepo | `repos/TaskInstanceRepo.ts` | M | 9.3.7 |
| 9.3.20 | Create ApprovalRequestRepo | `repos/ApprovalRequestRepo.ts` | S | 9.3.9 |
| 9.3.21 | Create L3SyncOperationRepo | `repos/L3SyncOperationRepo.ts` | S | 9.3.11 |
| 9.3.22 | Create WorkflowDefinitionRepo | `repos/WorkflowDefinitionRepo.ts` | M | 9.3.13 |

**Section 9.3 Story Points:** 8 SP

---

## Section 9.4: Services & Entities

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 9.4.1 | Create WorkOrderService class | `services/l2/WorkOrderService.ts` | L | 9.2, 9.3 |
| 9.4.2 | Implement createWorkOrder (emit WorkOrderCreated) | `services/l2/WorkOrderService.ts` | M | 9.4.1 |
| 9.4.3 | Implement submitWorkOrder (emit WorkOrderSubmitted) | `services/l2/WorkOrderService.ts` | M | 9.4.1 |
| 9.4.4 | Implement approveWorkOrder (emit WorkOrderApproved) | `services/l2/WorkOrderService.ts` | M | 9.4.1 |
| 9.4.5 | Implement rejectWorkOrder (emit WorkOrderRejected) | `services/l2/WorkOrderService.ts` | M | 9.4.1 |
| 9.4.6 | Implement startWorkOrder (emit WorkOrderStarted) | `services/l2/WorkOrderService.ts` | M | 9.4.1 |
| 9.4.7 | Implement suspendWorkOrder (emit WorkOrderSuspended) | `services/l2/WorkOrderService.ts` | M | 9.4.1 |
| 9.4.8 | Implement resumeWorkOrder (emit WorkOrderResumed) | `services/l2/WorkOrderService.ts` | S | 9.4.1 |
| 9.4.9 | Implement completeWorkOrder (emit WorkOrderCompleted) | `services/l2/WorkOrderService.ts` | M | 9.4.1 |
| 9.4.10 | Implement failWorkOrder (emit WorkOrderFailed) | `services/l2/WorkOrderService.ts` | M | 9.4.1 |
| 9.4.11 | Implement cancelWorkOrder (emit WorkOrderCancelled) | `services/l2/WorkOrderService.ts` | M | 9.4.1 |
| 9.4.12 | Implement closeWorkOrder (emit WorkOrderClosed) | `services/l2/WorkOrderService.ts` | S | 9.4.1 |
| 9.4.13 | Implement query methods (getWorkOrder, listWorkOrders) | `services/l2/WorkOrderService.ts` | M | 9.4.1 |
| 9.4.14 | Implement temporal queries (getWorkOrderAtTime, getHistory) | `services/l2/WorkOrderService.ts` | M | 9.4.1 |
| 9.4.15 | Create WorkOrderContextService | `services/l2/WorkOrderContextService.ts` | L | 9.3.17 |
| 9.4.16 | Implement Context.snapshot() | `services/l2/WorkOrderContextService.ts` | M | 9.4.15 |
| 9.4.17 | Implement Context.resolve() | `services/l2/WorkOrderContextService.ts` | M | 9.4.15 |
| 9.4.18 | Implement Context.update() with version check | `services/l2/WorkOrderContextService.ts` | M | 9.4.15 |
| 9.4.19 | Create ApprovalService (DurableDeferred integration) | `services/l2/ApprovalService.ts` | L | 9.3.20 |
| 9.4.20 | Create L3SyncService | `services/l2/L3SyncService.ts` | M | 9.3.21 |
| 9.4.21 | Create WorkflowDefinitionService | `services/l2/WorkflowDefinitionService.ts` | M | 9.3.22 |
| 9.4.22 | Create WorkOrderEntity definition | `entity/WorkOrderEntity.ts` | M | 9.4.1 |
| 9.4.23 | Create WorkOrder RPC definitions | `rpc/WorkOrderRpcs.ts` | M | 9.4.22 |
| 9.4.24 | Implement entity handlers | `entity/WorkOrderEntity.ts` | L | 9.4.23 |

**Section 9.4 Story Points:** 12 SP (adjusted to account for service complexity)

---

## Section 9.5: Testing

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 9.5.1 | Unit test: WorkOrder event schema validation | `__tests__/schemas/work-order-events.test.ts` | M | 9.1.6 |
| 9.5.2 | Unit test: WorkOrderContext event schemas | `__tests__/schemas/context-events.test.ts` | M | 9.1.10 |
| 9.5.3 | Unit test: TaskInstance event schemas | `__tests__/schemas/task-events.test.ts` | S | 9.1.13 |
| 9.5.4 | Unit test: Approval event schemas | `__tests__/schemas/approval-events.test.ts` | S | 9.1.16 |
| 9.5.5 | Integration test: WorkOrder lifecycle (create -> close) | `__tests__/integration/work-order-lifecycle.test.ts` | L | 9.4.1 |
| 9.5.6 | Integration test: Approval workflow (request -> grant -> complete) | `__tests__/integration/approval-workflow.test.ts` | L | 9.4.19 |
| 9.5.7 | Integration test: Context snapshot/resolve consistency | `__tests__/integration/context-snapshot.test.ts` | M | 9.4.15-18 |
| 9.5.8 | Integration test: Task compensation flow | `__tests__/integration/task-compensation.test.ts` | M | 9.2.22 |
| 9.5.9 | Integration test: L3 sync success/failure paths | `__tests__/integration/l3-sync.test.ts` | M | 9.4.20 |
| 9.5.10 | Integration test: Event replay -> consistent state | `__tests__/integration/work-order-replay.test.ts` | L | 9.2 |
| 9.5.11 | Integration test: Entity handlers E2E | `__tests__/entity/work-order-entity.test.ts` | L | 9.4.24 |
| 9.5.12 | Temporal query test: getWorkOrderAtTime | `__tests__/services/work-order-temporal.test.ts` | M | 9.4.14 |
| 9.5.13 | Compliance test: FDA audit trail completeness | `__tests__/compliance/work-order-audit.test.ts` | M | 9.4 |

**Section 9.5 Story Points:** 6 SP

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
|                      EPIC 9 INTERNAL DEPENDENCIES                            |
├─────────────────────────────────────────────────────────────────────────────┤
|                                                                              |
|                     Epic 7 (ES Infrastructure)                               |
|                              |                                               |
|                              v                                               |
|                   9.1 Schema Definitions (10 SP)                             |
|                              |                                               |
|          ┌───────────────────┼───────────────────┐                          |
|          v                   v                   v                          |
|   9.2 Handlers (10 SP)  9.3 Models (8 SP)  9.4 Services (12 SP)             |
|          |                   |                   |                          |
|          └───────────────────┼───────────────────┘                          |
|                              v                                               |
|                      9.5 Testing (6 SP)                                      |
|                                                                              |
└─────────────────────────────────────────────────────────────────────────────┘

External Dependencies:
- Epic 1 (Schemas) -> 9.1.1 (identifiers)
- Epic 7 (ES Infrastructure) -> 9.1.5+ (EventGroup pattern)
- Epic 4 (Repositories) -> 9.3.16+ (decode utilities)
```

---

## Acceptance Criteria

### Event Completeness
- [ ] All 46 events defined with Effect Schema
- [ ] All 6 EventGroups created
- [ ] Combined IIoTEventLogSchema includes all groups

### Handler Coverage
- [ ] Each event has a projection handler
- [ ] Same-transaction writes (event + projection)
- [ ] Reactivity bindings for cache invalidation

### Context Operations
- [ ] `Context.snapshot()` creates immutable audit record
- [ ] `Context.resolve()` returns live entity state
- [ ] `Context.update()` enforces version conflict detection

### Temporal Queries
- [ ] `getWorkOrderAtTime(id, timestamp)` reconstructs state
- [ ] `getHistory(id)` returns full event history
- [ ] Replay produces consistent state

### Compliance
- [ ] FDA 21 CFR Part 11 audit trail
- [ ] 4-eyes approval principle supported
- [ ] All state changes traceable to user + timestamp

---

## Files to Create

```
src/lib/iiot/
├── schemas/
|   ├── identifiers.ts          # +WorkOrderId, TaskInstanceId, ApprovalId, SyncId
|   ├── work-orders.ts          # WorkOrder, WorkOrderStatus, etc.
|   ├── work-order-context.ts   # Context, ContextPatch, ContextVersion
|   ├── task-instance.ts        # TaskStatus, BlockingReason
|   ├── approval.ts             # ApprovalType, ApprovalFinalStatus
|   ├── l3-sync.ts              # SyncDirection, SyncPhase
|   ├── workflow-definition.ts  # SemanticVersion, DefinitionChange
|   └── events/
|       ├── work-order-events.ts    # 11 WorkOrder events
|       ├── context-events.ts       # 10 Context events
|       ├── task-events.ts          # 9 TaskInstance events
|       ├── approval-events.ts      # 6 Approval events
|       ├── l3-sync-events.ts       # 5 L3Sync events
|       ├── definition-events.ts    # 5 Definition events
|       └── schema.ts               # Combined IIoTEventLogSchema
├── handlers/
|   ├── work-order-handlers.ts
|   ├── context-handlers.ts
|   ├── task-handlers.ts
|   ├── approval-handlers.ts
|   ├── l3-sync-handlers.ts
|   └── definition-handlers.ts
├── models/
|   └── work-orders/
|       ├── WorkOrderModel.ts
|       ├── WorkOrderModel.ddl.ts
|       ├── WorkOrderContextModel.ts
|       ├── WorkOrderContextModel.ddl.ts
|       ├── ContextSnapshotModel.ts
|       ├── ContextSnapshotModel.ddl.ts
|       ├── TaskInstanceModel.ts
|       ├── TaskInstanceModel.ddl.ts
|       ├── ApprovalRequestModel.ts
|       ├── ApprovalRequestModel.ddl.ts
|       ├── L3SyncOperationModel.ts
|       ├── L3SyncOperationModel.ddl.ts
|       ├── WorkflowDefinitionModel.ts
|       └── WorkflowDefinitionModel.ddl.ts
├── repos/
|   ├── WorkOrderRepo.ts
|   ├── WorkOrderContextRepo.ts
|   ├── ContextSnapshotRepo.ts
|   ├── TaskInstanceRepo.ts
|   ├── ApprovalRequestRepo.ts
|   ├── L3SyncOperationRepo.ts
|   └── WorkflowDefinitionRepo.ts
├── services/
|   └── l2/
|       ├── WorkOrderService.ts
|       ├── WorkOrderContextService.ts
|       ├── ApprovalService.ts
|       ├── L3SyncService.ts
|       └── WorkflowDefinitionService.ts
├── entity/
|   └── WorkOrderEntity.ts
└── rpc/
    └── WorkOrderRpcs.ts
```

---

## Story Point Summary

| Section | Story Points |
|---------|--------------|
| 9.1 Schema Definitions | 10 SP |
| 9.2 Event Handlers | 10 SP |
| 9.3 Models & Repositories | 8 SP |
| 9.4 Services & Entities | 12 SP (adjusted) |
| 9.5 Testing | 6 SP |
| **TOTAL** | **34 SP** |

**Original Epic 9 Estimate:** 13 SP
**Expanded Estimate:** 34 SP (+21 SP for 46 events across 6 aggregates)

---

**Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>**
