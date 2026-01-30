# Epic 25: Regulatory Compliance Event Sourcing (NEW)

**Generated:** 2026-01-29
**Status:** DRAFT
**Parent WBS:** `2026-01-29-eventlog-integration-wbs-final.md`

---

## Summary

**Goal:** Complete audit trail infrastructure for FDA 21 CFR Part 11, ISO 9001, and general operator audit compliance.

| Metric | Value |
|--------|-------|
| **Story Points** | 13 SP |
| **Sprint** | 7 |
| **Dependencies** | Epic EL-1 (Infrastructure), Epic EL-3 (WorkOrder for CAPA linking) |
| **Events** | 13 total |
| **Aggregates** | 3 (BatchRecord, QualityEvent, OperatorAction) |

---

## Domain 1: Batch Records (FDA 21 CFR Part 11)

FDA 21 CFR Part 11 requires electronic records to be:
- **Attributable** (who, what, when)
- **Legible** (readable and permanent)
- **Contemporaneous** (recorded at time of action)
- **Original** (first capture)
- **Accurate** (error-free)

### Event Catalog

| Event | Payload Fields | Purpose |
|-------|---------------|---------|
| `BatchStarted` | batchId, productId, equipmentId, operatorId, plannedQuantity, startedAt, recipeVersion | Initiates batch record |
| `ParameterRecorded` | batchId, parameterId, value, unit, recordedBy, recordedAt, source (manual/auto), bounds | Critical process parameter logging |
| `BatchCompleted` | batchId, actualQuantity, completedAt, operatorId, status (success/partial), deviationCount | Normal batch closure |
| `BatchDeviation` | batchId, deviationId, type (parameter/process/equipment), description, detectedAt, detectedBy, severity, correctionRequired | Non-conformance during batch |

### Identifiers

| Identifier | Format | Purpose |
|------------|--------|---------|
| `BatchId` | `BATCH-{YYYYMMDD}-{SEQ}` | Unique batch identifier |
| `DeviationId` | `DEV-{BatchId}-{SEQ}` | Deviation within batch |
| `ParameterId` | `PARAM-{code}` | Process parameter reference |

---

## Domain 2: Quality Events (ISO 9001)

ISO 9001 requires documented quality management with:
- Nonconformance tracking
- Corrective/Preventive Actions (CAPA)
- Evidence of conformity

### Event Catalog

| Event | Payload Fields | Purpose |
|-------|---------------|---------|
| `InspectionCompleted` | inspectionId, assetId, inspectorId, inspectedAt, result (pass/fail/conditional), checklistId, findings | Quality inspection record |
| `NCROpened` | ncrId, assetId, openedBy, openedAt, description, severity, category, sourceInspectionId | Non-Conformance Report initiation |
| `NCRClosed` | ncrId, closedBy, closedAt, resolution, dispositionCode, linkedCAPAId | NCR resolution |
| `CAPACreated` | capaId, type (corrective/preventive), description, createdBy, createdAt, dueDate, sourceNCRIds, priority | Corrective/Preventive Action |
| `CAPAResolved` | capaId, resolvedBy, resolvedAt, rootCause, actionsTaken, effectivenessVerified, verifiedBy | CAPA closure with verification |

### Identifiers

| Identifier | Format | Purpose |
|------------|--------|---------|
| `InspectionId` | `INS-{YYYYMMDD}-{SEQ}` | Inspection record |
| `NCRId` | `NCR-{YYYYMMDD}-{SEQ}` | Non-Conformance Report |
| `CAPAId` | `CAPA-{YYYYMMDD}-{SEQ}` | Corrective/Preventive Action |

### NCR-CAPA Lifecycle

```
Inspection (fail) ─► NCR Opened ─► Investigation ─► CAPA Created
                                                        │
                         ┌──────────────────────────────┘
                         │
                         ▼
                    CAPA Actions ─► Verification ─► CAPA Resolved
                         │                              │
                         │                              ▼
                         └────────────────────────► NCR Closed
```

---

## Domain 3: Operator Actions (Audit Trail)

General audit trail requirements for operator accountability.

### Event Catalog

| Event | Payload Fields | Purpose |
|-------|---------------|---------|
| `OperatorLogin` | operatorId, workstationId, loginAt, authMethod, sessionId | Session initiation |
| `ParameterOverride` | operatorId, parameterId, previousValue, newValue, reason, overrideAt, authorizerId, workOrderId | Manual parameter change |
| `ManualAcknowledgment` | operatorId, eventType, eventId, acknowledgedAt, comments, requiresFollowUp | Operator acknowledgment of system event |
| `ShiftHandoff` | outgoingOperatorId, incomingOperatorId, handoffAt, workstationId, notes, openIssues, pendingTasks | Shift transition record |

### Identifiers

| Identifier | Format | Purpose |
|------------|--------|---------|
| `OperatorId` | Linked to user system | Operator reference |
| `WorkstationId` | `WS-{location}-{number}` | Physical workstation |
| `SessionId` | UUID | Login session tracking |

---

## Section 25.1: Batch Record Events

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 25.1.1 | Define `BatchId` branded identifier | `schemas/identifiers.ts` | S | - |
| 25.1.2 | Define `DeviationId` branded identifier | `schemas/identifiers.ts` | S | - |
| 25.1.3 | Define `ParameterId` branded identifier | `schemas/identifiers.ts` | S | - |
| 25.1.4 | Define `BatchStartedPayload` schema | `events/batch-events.ts` | M | 25.1.1, 25.1.3 |
| 25.1.5 | Define `ParameterRecordedPayload` schema | `events/batch-events.ts` | M | 25.1.1, 25.1.3 |
| 25.1.6 | Define `BatchCompletedPayload` schema | `events/batch-events.ts` | M | 25.1.1 |
| 25.1.7 | Define `BatchDeviationPayload` schema | `events/batch-events.ts` | M | 25.1.1, 25.1.2 |
| 25.1.8 | Create `BatchEvents` EventGroup | `events/batch-events.ts` | M | 25.1.4-7 |
| 25.1.9 | Implement `BatchEventHandlers` (EventLog.group) | `handlers/batch-handlers.ts` | L | 25.1.8, EL-1 |
| 25.1.10 | Handler: `BatchStarted` - initialize batch record | `handlers/batch-handlers.ts` | M | 25.1.9 |
| 25.1.11 | Handler: `ParameterRecorded` - append to batch log | `handlers/batch-handlers.ts` | M | 25.1.9 |
| 25.1.12 | Handler: `BatchCompleted` - finalize batch | `handlers/batch-handlers.ts` | M | 25.1.9 |
| 25.1.13 | Handler: `BatchDeviation` - link deviation | `handlers/batch-handlers.ts` | M | 25.1.9 |
| 25.1.14 | `BatchReactivity` cache invalidation bindings | `handlers/reactivity.ts` | S | 25.1.8 |
| 25.1.15 | Unit tests: Batch event schemas | `__tests__/unit/batch-events.test.ts` | M | 25.1.4-8 |
| 25.1.16 | Integration tests: Batch event handlers | `__tests__/integration/batch-handlers.test.ts` | L | 25.1.9-13 |

**Subtotal:** 16 tasks

---

## Section 25.2: Quality Events

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 25.2.1 | Define `InspectionId` branded identifier | `schemas/identifiers.ts` | S | - |
| 25.2.2 | Define `NCRId` branded identifier | `schemas/identifiers.ts` | S | - |
| 25.2.3 | Define `CAPAId` branded identifier | `schemas/identifiers.ts` | S | - |
| 25.2.4 | Define `InspectionResult` literal union | `schemas/quality.ts` | S | - |
| 25.2.5 | Define `CAPAType` literal union (corrective/preventive) | `schemas/quality.ts` | S | - |
| 25.2.6 | Define `DispositionCode` literal union | `schemas/quality.ts` | S | - |
| 25.2.7 | Define `InspectionCompletedPayload` schema | `events/quality-events.ts` | M | 25.2.1, 25.2.4 |
| 25.2.8 | Define `NCROpenedPayload` schema | `events/quality-events.ts` | M | 25.2.2, 25.2.1 |
| 25.2.9 | Define `NCRClosedPayload` schema | `events/quality-events.ts` | M | 25.2.2, 25.2.3, 25.2.6 |
| 25.2.10 | Define `CAPACreatedPayload` schema | `events/quality-events.ts` | M | 25.2.3, 25.2.2, 25.2.5 |
| 25.2.11 | Define `CAPAResolvedPayload` schema | `events/quality-events.ts` | M | 25.2.3 |
| 25.2.12 | Create `QualityEvents` EventGroup | `events/quality-events.ts` | M | 25.2.7-11 |
| 25.2.13 | Implement `QualityEventHandlers` (EventLog.group) | `handlers/quality-handlers.ts` | L | 25.2.12, EL-1 |
| 25.2.14 | Handler: `InspectionCompleted` - record inspection | `handlers/quality-handlers.ts` | M | 25.2.13 |
| 25.2.15 | Handler: `NCROpened` - create NCR, link to inspection | `handlers/quality-handlers.ts` | M | 25.2.13 |
| 25.2.16 | Handler: `NCRClosed` - close NCR, validate CAPA link | `handlers/quality-handlers.ts` | M | 25.2.13 |
| 25.2.17 | Handler: `CAPACreated` - create CAPA, link source NCRs | `handlers/quality-handlers.ts` | M | 25.2.13, EL-3 |
| 25.2.18 | Handler: `CAPAResolved` - close CAPA with verification | `handlers/quality-handlers.ts` | M | 25.2.13 |
| 25.2.19 | `QualityReactivity` cache invalidation bindings | `handlers/reactivity.ts` | S | 25.2.12 |
| 25.2.20 | Temporal query: `getNCRHistory(ncrId)` | `services/l2/QualityService.ts` | M | 25.2.13 |
| 25.2.21 | Temporal query: `getCAPALifecycle(capaId)` | `services/l2/QualityService.ts` | M | 25.2.13 |
| 25.2.22 | Unit tests: Quality event schemas | `__tests__/unit/quality-events.test.ts` | M | 25.2.7-12 |
| 25.2.23 | Integration tests: NCR-CAPA lifecycle | `__tests__/integration/quality-handlers.test.ts` | L | 25.2.13-18 |

**Subtotal:** 23 tasks

---

## Section 25.3: Operator Action Events

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 25.3.1 | Define `WorkstationId` branded identifier | `schemas/identifiers.ts` | S | - |
| 25.3.2 | Define `SessionId` branded identifier (UUID) | `schemas/identifiers.ts` | S | - |
| 25.3.3 | Define `AuthMethod` literal union | `schemas/operator.ts` | S | - |
| 25.3.4 | Define `OperatorLoginPayload` schema | `events/operator-events.ts` | M | 25.3.1, 25.3.2, 25.3.3 |
| 25.3.5 | Define `ParameterOverridePayload` schema | `events/operator-events.ts` | M | 25.1.3 |
| 25.3.6 | Define `ManualAcknowledgmentPayload` schema | `events/operator-events.ts` | M | - |
| 25.3.7 | Define `ShiftHandoffPayload` schema | `events/operator-events.ts` | M | 25.3.1 |
| 25.3.8 | Create `OperatorEvents` EventGroup | `events/operator-events.ts` | M | 25.3.4-7 |
| 25.3.9 | Implement `OperatorEventHandlers` (EventLog.group) | `handlers/operator-handlers.ts` | L | 25.3.8, EL-1 |
| 25.3.10 | Handler: `OperatorLogin` - record session start | `handlers/operator-handlers.ts` | M | 25.3.9 |
| 25.3.11 | Handler: `ParameterOverride` - audit override with authorization | `handlers/operator-handlers.ts` | M | 25.3.9 |
| 25.3.12 | Handler: `ManualAcknowledgment` - audit acknowledgment | `handlers/operator-handlers.ts` | M | 25.3.9 |
| 25.3.13 | Handler: `ShiftHandoff` - record handoff with continuity | `handlers/operator-handlers.ts` | M | 25.3.9 |
| 25.3.14 | `OperatorReactivity` cache invalidation bindings | `handlers/reactivity.ts` | S | 25.3.8 |
| 25.3.15 | Temporal query: `getOperatorActivityLog(operatorId, period)` | `services/l2/AuditService.ts` | M | 25.3.9 |
| 25.3.16 | Temporal query: `getShiftLog(workstationId, date)` | `services/l2/AuditService.ts` | M | 25.3.9 |
| 25.3.17 | Unit tests: Operator event schemas | `__tests__/unit/operator-events.test.ts` | M | 25.3.4-8 |
| 25.3.18 | Integration tests: Operator audit trail | `__tests__/integration/operator-handlers.test.ts` | L | 25.3.9-13 |

**Subtotal:** 18 tasks

---

## Section 25.4: Schema Integration

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 25.4.1 | Add `BatchEvents` to `IIoTEventLogSchema` | `events/schema.ts` | S | 25.1.8 |
| 25.4.2 | Add `QualityEvents` to `IIoTEventLogSchema` | `events/schema.ts` | S | 25.2.12 |
| 25.4.3 | Add `OperatorEvents` to `IIoTEventLogSchema` | `events/schema.ts` | S | 25.3.8 |
| 25.4.4 | Export all regulatory events from barrel | `events/index.ts` | S | 25.4.1-3 |
| 25.4.5 | Export all regulatory handlers from barrel | `handlers/index.ts` | S | 25.1.9, 25.2.13, 25.3.9 |
| 25.4.6 | Add regulatory handlers to `IIoTEventLogStackLayer` | `services/l1/IIoTEventLog.ts` | M | 25.4.4-5 |
| 25.4.7 | Add regulatory reactivity to combined reactivity layer | `handlers/reactivity.ts` | S | 25.1.14, 25.2.19, 25.3.14 |
| 25.4.8 | Feature flag: `ES_REGULATORY_ENABLED` | `config/feature-flags.ts` | S | - |

**Subtotal:** 8 tasks

---

## Section 25.5: Compliance Validation

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 25.5.1 | Validate event journal immutability (no UPDATE/DELETE) | `__tests__/compliance/immutability.test.ts` | M | EL-1 |
| 25.5.2 | Validate batch record traceability end-to-end | `__tests__/compliance/batch-traceability.test.ts` | L | 25.1.16 |
| 25.5.3 | Validate NCR-CAPA lifecycle completeness | `__tests__/compliance/ncr-capa-lifecycle.test.ts` | L | 25.2.23 |
| 25.5.4 | Validate operator audit trail completeness | `__tests__/compliance/operator-audit.test.ts` | M | 25.3.18 |
| 25.5.5 | Validate temporal query accuracy (point-in-time reconstruction) | `__tests__/compliance/temporal-queries.test.ts` | L | 25.2.20-21, 25.3.15-16 |
| 25.5.6 | Generate compliance report schema (FDA audit format) | `reports/compliance-report.ts` | M | 25.5.1-5 |

**Subtotal:** 6 tasks

---

## Task Summary

| Section | Description | Tasks | Size Distribution |
|---------|-------------|-------|-------------------|
| 25.1 | Batch Record Events | 16 | 5S, 7M, 2L |
| 25.2 | Quality Events | 23 | 7S, 11M, 3L |
| 25.3 | Operator Action Events | 18 | 5S, 9M, 2L |
| 25.4 | Schema Integration | 8 | 7S, 1M |
| 25.5 | Compliance Validation | 6 | 0S, 3M, 3L |
| **TOTAL** | | **71** | **24S, 31M, 10L** |

---

## Files to Create

```
src/lib/iiot/
├── schemas/
│   ├── identifiers.ts          # Add: BatchId, DeviationId, InspectionId, NCRId, CAPAId, WorkstationId, SessionId
│   ├── quality.ts              # NEW: InspectionResult, CAPAType, DispositionCode
│   └── operator.ts             # NEW: AuthMethod
├── events/
│   ├── batch-events.ts         # NEW: 4 events + BatchEvents group
│   ├── quality-events.ts       # NEW: 5 events + QualityEvents group
│   ├── operator-events.ts      # NEW: 4 events + OperatorEvents group
│   └── schema.ts               # UPDATE: Add regulatory groups
├── handlers/
│   ├── batch-handlers.ts       # NEW: BatchEventHandlers
│   ├── quality-handlers.ts     # NEW: QualityEventHandlers
│   ├── operator-handlers.ts    # NEW: OperatorEventHandlers
│   └── reactivity.ts           # UPDATE: Add regulatory reactivity
├── services/
│   └── l2/
│       ├── QualityService.ts   # NEW: NCR/CAPA temporal queries
│       └── AuditService.ts     # NEW: Operator audit queries
├── reports/
│   └── compliance-report.ts    # NEW: FDA audit report schema
├── config/
│   └── feature-flags.ts        # UPDATE: ES_REGULATORY_ENABLED
└── __tests__/
    ├── unit/
    │   ├── batch-events.test.ts
    │   ├── quality-events.test.ts
    │   └── operator-events.test.ts
    ├── integration/
    │   ├── batch-handlers.test.ts
    │   ├── quality-handlers.test.ts
    │   └── operator-handlers.test.ts
    └── compliance/
        ├── immutability.test.ts
        ├── batch-traceability.test.ts
        ├── ncr-capa-lifecycle.test.ts
        ├── operator-audit.test.ts
        └── temporal-queries.test.ts
```

---

## Acceptance Criteria

- [ ] **Immutability**: Events in journal cannot be UPDATE/DELETE (enforced at DB level)
- [ ] **Batch Traceability**: Any batch can be reconstructed from events at any point in time
- [ ] **NCR-CAPA Lifecycle**: Complete chain from Inspection -> NCR -> CAPA -> Resolution
- [ ] **Operator Accountability**: All operator actions attributable with timestamp
- [ ] **Temporal Queries**: Point-in-time state reconstruction working for all aggregates
- [ ] **Feature Flag**: `ES_REGULATORY_ENABLED` controls rollout
- [ ] **Test Coverage**: >90% for handlers, 100% for compliance validation

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EPIC 25 INTERNAL DEPENDENCIES                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         EL-1: Infrastructure                                 │
│                                │                                             │
│         ┌──────────────────────┼──────────────────────┐                     │
│         │                      │                      │                     │
│         ▼                      ▼                      ▼                     │
│    25.1: Batch           25.2: Quality          25.3: Operator              │
│    (16 tasks)            (23 tasks)             (18 tasks)                  │
│         │                      │                      │                     │
│         │    ┌─────────────────┘                      │                     │
│         │    │  (CAPA links to NCR)                   │                     │
│         │    │                                        │                     │
│         └────┼────────────────────────────────────────┘                     │
│              │                                                               │
│              ▼                                                               │
│         25.4: Schema Integration (8 tasks)                                  │
│              │                                                               │
│              ▼                                                               │
│         25.5: Compliance Validation (6 tasks)                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

External Dependencies:
- EL-1 (Infrastructure): Required for EventLog.group, SqlEventJournal
- EL-3 (WorkOrder): Optional link for CAPA -> WorkOrder association
```

---

## Risk Mitigations

| Risk | Mitigation | Task Reference |
|------|------------|----------------|
| FDA audit fails on mutability | DB-level constraints + immutability test | 25.5.1 |
| NCR-CAPA chain breaks | Lifecycle integration test | 25.5.3 |
| Operator can bypass audit | All mutations via EventLog only | 25.3.9-13 |
| Batch deviations lost | DevIds linked to BatchId, no orphans | 25.1.7, 25.1.13 |
| Point-in-time wrong | Temporal query validation suite | 25.5.5 |

---

**Status:** Ready for Prime approval

**Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>**
