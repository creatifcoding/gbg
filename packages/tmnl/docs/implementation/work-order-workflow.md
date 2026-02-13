# Work Order + Workflow System Specification

> Comprehensive specification for the WorkOrder + Workflow system, covering schemas, events, delegation, and context management.

**Source:** `thoughts/shared/plans/2026-01-29-work-order-workflow-decomposition.md`
**CAP Alignment:** `thoughts/shared/alignments/2026-01-29-work-order-workflow.md`
**EDIN Phase:** DESIGN
**Last Updated:** 2026-02-09

---

## Overview

The WorkOrder system manages manufacturing execution workflows per ISA-95 Level 3 (MES/MOM). It is built around **WorkOrderContext** -- a hybrid container that bridges audit requirements (immutable snapshots) with operational needs (live entity state).

All work orders are **event-sourced** per ADR-0012, with FDA 21 CFR Part 11 compliance for audit trails.

---

## WorkOrderContext Shape

```
WorkOrderContext
  workOrderId: WorkOrderId          -- Owner work order
  version: ContextVersion           -- Monotonic version for conflict detection
  snapshotAt: DateTime              -- When context was captured
  assets: Map<AssetId, AssetRef>    -- Machine/line refs (live + snapshot)
  resources: Map<ResourceId, Alloc> -- Parts, tools, personnel
  alarms: Option<AlarmId>           -- Triggering alarm if maintenance order
  parentWorkOrder: Option<WOId>     -- Nested workflow parent
  childWorkOrders: Array<WOId>      -- Spawned child workflows
  externalRefs: Map<System, Id>     -- ERP IDs, ticket numbers
  l3Context: L3ContextRef           -- Progressive external integration
```

---

## 4-Layer Delegation Pattern

```
Activity.make()                  -- Workflow orchestration, retry, compensation
    |
    v
RPC Client                       -- Type-safe request/response, serialization
    |
    v
Effect.Service                    -- Domain logic, validation, business rules
    |
    v
Cluster Entity (EventLog)        -- State persistence, event sourcing
```

| Layer | Responsibility | Example |
|-------|---------------|---------|
| **Activity** | Workflow orchestration, retry, compensation | `AllocateResource`, `LockAsset` |
| **RPC Client** | Type-safe request/response | `ResourceRpc.allocate(params)` |
| **Effect.Service** | Domain logic, validation | `ResourceService.allocate()` |
| **Cluster Entity** | State persistence, event sourcing | `ResourceEntity.handle(AllocateCommand)` |

---

## Context Operations

| Operation | Returns | Side Effects | Use Case |
|-----------|---------|--------------|----------|
| `snapshot()` | `ContextSnapshot` | None | Audit, compliance, history |
| `resolve()` | `WorkOrderContext` | None | Live state queries |
| `update()` | `WorkOrderContext` | Emits `ContextUpdated` event | Mid-execution mutations |

---

## Event Schema Catalog

### WorkOrder Events (11 events)

| Event | Trigger |
|-------|---------|
| `WorkOrderCreated` | Work order instantiated from workflow definition |
| `WorkOrderSubmitted` | Submitted for approval |
| `WorkOrderApproved` | Approved (supports multi-level 4-eyes approval) |
| `WorkOrderRejected` | Rejected with reason |
| `WorkOrderStarted` | Execution started |
| `WorkOrderSuspended` | Paused with suspension reason + expected resume |
| `WorkOrderResumed` | Resumed from suspension |
| `WorkOrderCompleted` | Completed successfully with outcome |
| `WorkOrderFailed` | Failed with reason + failed task reference |
| `WorkOrderCancelled` | Cancelled with compensation flag |
| `WorkOrderClosed` | Final archived state |

### WorkOrderContext Events (10 events)

| Event | Trigger |
|-------|---------|
| `ContextCreated` | Initial context with asset list |
| `ContextUpdated` | Version-tracked patch applied |
| `ContextSnapshotted` | Immutable audit snapshot created |
| `AssetAttached` | Asset linked with optional snapshot data |
| `AssetDetached` | Asset unlinked with reason |
| `ResourceAllocated` | Resource assigned (type + quantity + unit) |
| `ResourceReleased` | Resource freed |
| `ExternalRefLinked` | External system reference added |
| `ExternalRefUnlinked` | External reference removed |
| `ChildWorkOrderSpawned` | Child work order created |

### TaskInstance Events (9 events)

| Event | Trigger |
|-------|---------|
| `TaskBecameReady` | Dependencies satisfied |
| `TaskStarted` | Execution started, optionally assigned |
| `TaskProgressUpdated` | Progress 0-100% with notes |
| `TaskBlocked` | Blocked by dependency or issue |
| `TaskUnblocked` | Block cleared |
| `TaskCompleted` | Completed with optional output |
| `TaskFailed` | Failed with retryable flag |
| `TaskSkipped` | Conditionally skipped |
| `TaskCompensated` | Rollback executed |

### Approval Events (6 events)

| Event | Trigger |
|-------|---------|
| `ApprovalRequested` | Approval requested with required count + expiry |
| `ApprovalGranted` | One approver approved (tracks count/required) |
| `ApprovalRejected` | Rejected with reason |
| `ApprovalEscalated` | Timeout escalation with new approver list |
| `ApprovalCompleted` | All required approvals received |
| `ApprovalExpired` | Timed out without decision |

### L3 Sync Events (5 events)

| Event | Trigger |
|-------|---------|
| `L3SyncStarted` | External sync initiated (direction + system) |
| `L3SyncProgress` | Progress update with phase |
| `L3SyncCompleted` | Sync completed with item count + duration |
| `L3SyncFailed` | Sync failed with items processed before failure |
| `ExternalChangeDetected` | External system change detected |

### WorkflowDefinition Events (5 events)

| Event | Trigger |
|-------|---------|
| `DefinitionCreated` | New workflow template created |
| `DefinitionVersioned` | New version published with change list |
| `DefinitionActivated` | Ready for use |
| `DefinitionDeprecated` | No new work orders, migration path |
| `DefinitionArchived` | Fully archived |

### Summary

| Aggregate | Events |
|-----------|--------|
| WorkOrder | 11 |
| WorkOrderContext | 10 |
| TaskInstance | 9 |
| ApprovalRequest | 6 |
| L3SyncOperation | 5 |
| WorkflowDefinition | 5 |
| **Total** | **46** |

---

## Feature Decomposition

### F1: Schema Layer
Define branded identifiers, status enums, WorkflowDefinition, WorkOrder, TaskInstance, ResourceAllocation, TimeConstraints, WorkOrderContext, ContextSnapshot schemas.
**15 tasks** in `schemas/work-orders.ts` and `schemas/identifiers.ts`.

### F2: Activity Library
Reusable Activity patterns for compensation, retry with jitter, timeout with alerting.
**Tasks:** Compensation pattern, retry with jitter, timeout with alerting.

### F3: Workflow Definitions
CRUD for versioned workflow templates with task DAG validation.

### F4: WorkOrder Runtime
Lifecycle management: create, submit, approve, start, suspend, resume, complete, fail, cancel, close.

### F5: Approval Gates
DurableDeferred-based approval with multi-level signoff, timeout escalation, delegation.

### F6: Resource Management
Lock, allocate, release resources with conflict detection and reservation patterns.

### F7: WorkOrderContext Layer
Hybrid snapshot + live ref container with version-tracked updates and audit operations.

### F8: L3 External Integration
ERP sync, external reference management, change detection from external systems.

---

## V-Model Trace

```
REQUIREMENTS (Left Arm)              VALIDATION (Right Arm)
Epic: WorkOrder+Workflow System   <-> System Test: E2E workflow execution
  F1: Schema Layer                <-> Integration: Schema serialization
  F2: Activity Library            <-> Integration: Activity compensation
  F3: Workflow Definitions        <-> Integration: Workflow persistence
  F4: WorkOrder Runtime           <-> Integration: Order lifecycle
  F5: Approval Gates              <-> Integration: DurableDeferred signals
  F6: Resource Management         <-> Integration: Allocation/release
  F7: WorkOrderContext Layer      <-> Integration: Snapshot/resolve tests
  F8: L3 External Integration     <-> Integration: ERP sync, external refs
```
