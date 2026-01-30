# WBS Summary — Updated with EventLog Integration & Fact System

**Generated:** 2026-01-29
**Source Documents:**
- `2026-01-26-v3-service-architecture-wbs.md` (baseline)
- `2026-01-29-eventlog-integration-wbs-final.md` (expansion)
- `2026-01-29-extensible-fact-system-spec.md` (fact system)

---

## Executive Summary (Updated)

| Category | Epics | Story Points |
|----------|-------|--------------|
| **Foundation** (Schemas, Repos, Infrastructure) | 1-6 | 47 |
| **Event Sourcing Boundaries** (Expanded with EventLog + Fact System) | 7-12 | 92 |
| **Entity & Service Layer** | 13-16 | 42 |
| **RPC & HTTP Handlers** | 17-18 | 26 |
| **Stream Processing & Real-time** | 19-20 | 21 |
| **Migration & Integration** | 21-22 | 26 |
| **Documentation & DX** | 23-24 | 16 |
| **Regulatory Compliance** (NEW) | 25 | 13 |
| **Total** | **25 Epics** | **~283 SP** |

**Estimated Duration**: 12-16 sprints (6-8 months)

### Change Summary

| Metric | Baseline | Updated | Delta |
|--------|----------|---------|-------|
| Epics | 24 | 25 | +1 |
| Story Points | 236 | 283 | +47 |
| Sprints | 10-14 | 12-16 | +2 |
| Duration | 5-7 months | 6-8 months | +1 month |

### EventLog Expansion Detail

The ES Boundaries category (Epics 7-12) was expanded from 58 SP to 76 SP based on detailed event catalog analysis, then further expanded to 92 SP with the Extensible Fact System:

| Sub-Epic | Original | EventLog | + Fact System | Notes |
|----------|----------|----------|---------------|-------|
| EL-1: Infrastructure | (included in 7) | 13 SP | 21 SP | Facade, tables, identity layer + FactStore, iiot_facts DDL |
| EL-2: Alarm Migration | (included in 8) | 16 SP | 20 SP | 10 events, temporal queries + FactStore integration |
| EL-3: Work Order | (included in 9) | 21 SP | 21 SP | 46 events, 6 aggregates |
| EL-4: Equipment State | (included in 10) | 13 SP | 17 SP | State machine, OEE + FactStore integration |
| **Subtotal** | 58 SP | 76 SP | 92 SP | +16 SP from Fact System |

New Epic 25 (Regulatory Compliance) adds batch records, quality events, and operator actions for FDA 21 CFR Part 11 and ISO 9001 compliance.

### Extensible Fact System (NEW)

The Fact System adds an extensible metadata layer to domain events:

| Component | Epic | SP Added | Description |
|-----------|------|----------|-------------|
| FactStore Service | 7 | +8 | Service for attaching/querying Facts |
| iiot_facts DDL | 7 | (incl.) | SQL schema with JSONB payload, graph edges |
| FactTypeRegistry | 7 | (incl.) | Runtime fact type registration & validation |
| AlarmService Integration | 8 | +4 | Fact attachment points for Alarm events |
| EquipmentStateService Integration | 10 | +4 | Fact attachment points for Equipment events |
| **Total** | — | **+16 SP** | Extensible metadata for all domain events |

**Key Feature:** Events stay typed (AlarmTriggered, etc.), Facts are the extension point with JSONB payloads and DAG structure.

---

## Critical Path (Updated with Fact System)

```
                              ┌──────────────────────────────────────────────────────────────┐
                              │          UPDATED CRITICAL PATH (+ Fact System)               │
                              └──────────────────────────────────────────────────────────────┘

Epic 1 (Schemas) ──┬──> Epic 2 (Models) ──> Epic 3 (DDL) ──> Epic 4 (Repos)
                   │                                              │
                   │                                              v
                   │                               Epic 7 (ES Infrastructure)
                   │                                     │ EL-1: IIoTEventLog
                   │                                     │ + FactStore, FactTypeRegistry
                   │                                     │ + iiot_facts DDL
                   v                                     v
              Epic 5 (Errors) ───────────────> Epic 8 (Alarm ES Migration)
                                                     │ EL-2: 10 Alarm Events
                                                     │ + FactStore Integration
                                                     │
                              ┌───────────────────────┼───────────────────────┐
                              │                       │                       │
                              v                       v                       v
                    Epic 9 (Work Order)    Epic 10 (Equipment State)   Epic 11 (Non-ES)
                    EL-3: 46 events        EL-4: 6 events
                                           + FactStore Integration
                              │                       │                       │
                              └───────────────────────┼───────────────────────┘
                                                      │
                                                      v
                                            Epic 12 (ES Testing)
                                                      │
                                                      v
                                           ┌─────────────────────┐
                                           │ Epic 25 (NEW)       │
                                           │ Regulatory Compliance│
                                           │ EL-5: 13 events     │
                                           └─────────────────────┘
                                                      │
                                                      v
                                            Epic 13 (Entity Definitions)
                                                      │
                                          ┌───────────┼───────────┐
                                          v           v           v
                                    Epic 14     Epic 15     Epic 16
                                    (State)     (Events)    (Handlers)
                                          │           │           │
                                          └───────────┼───────────┘
                                                      v
                                          ┌───────────┴───────────┐
                                          v                       v
                                    Epic 17 (RPC)           Epic 18 (HTTP)
                                          │                       │
                                          └───────────┬───────────┘
                                                      v
                                          ┌───────────┴───────────┐
                                          v                       v
                                   Epic 19 (Streams)      Epic 20 (WebSocket)
                                          │                       │
                                          └───────────┬───────────┘
                                                      v
                                          ┌───────────┴───────────┐
                                          v                       v
                                   Epic 21 (Migration)    Epic 22 (Layers)
                                          │                       │
                                          └───────────┬───────────┘
                                                      v
                                          ┌───────────┴───────────┐
                                          v                       v
                                   Epic 23 (Docs)         Epic 24 (DX)
```

### Critical Path Length

**Primary Path:** 1 → 2 → 3 → 4 → 7 (+ FactStore) → 8 (+ Fact Integration) → 9 → 12 → 25 → 13 → 14/15/16 → 17/18 → 19/20 → 21/22 → 23/24

**Fact System Dependencies:**
- FactStore service (Epic 7) must complete before Fact integration in Epics 8, 10
- FactTypeRegistry (Epic 7) provides runtime validation for all Fact producers

**Parallel Opportunities:**
- Epic 10 (Equipment State + Fact Integration) can run parallel to Epic 9 (Work Order)
- Epic 11 (Non-ES Validation) can run parallel to Epics 8-10
- Epics 14, 15, 16 can run parallel after Epic 13
- Epics 17, 18 can run parallel
- Epics 19, 20 can run parallel
- Epics 21, 22 can run parallel
- Epics 23, 24 can run parallel

---

## Phase Summaries (Updated)

### Phase 1: Foundation (Sprints 1-2) — 47 SP
No change. Schemas, Models, DDL, Repos, Errors, L1 Services.

### Phase 2: Event Sourcing Boundaries (Sprints 3-7) — 92 SP (+34 from baseline)

| Epic | Description | SP | Sprint |
|------|-------------|----|---------|
| 7 (EL-1) | ES Infrastructure + IIoTEventLog Facade + **FactStore** | 21 | 3-4 |
| 8 (EL-2) | Alarm ES Migration (10 events) + **Fact Integration** | 20 | 4-5 |
| 9 (EL-3) | Work Order Domain (46 events, 6 aggregates) | 21 | 5-6 |
| 10 (EL-4) | Equipment State (6 events, OEE) + **Fact Integration** | 17 | 6 |
| 11 | Non-ES Domain Validation | 3 | 6 |
| 12 | ES Integration & Testing | 13 | 7 |

**Sprint allocation expanded from 3 sprints to 5 sprints (includes Fact System work).**

### Phase 2.5: Regulatory Compliance (Sprint 8) — 13 SP (NEW)

| Epic | Description | SP | Sprint |
|------|-------------|----|---------|
| 25 (EL-5) | Regulatory Compliance Events | 13 | 8 |

Includes:
- Batch Records (FDA 21 CFR Part 11)
- Quality Events (ISO 9001)
- Operator Actions (general audit)

### Phase 3: Entity & Service Layer (Sprints 9-10) — 42 SP
No change. Entity Definitions, State Services, Event Handlers, Entity Handlers.
**Sprint numbers shifted by +2 (Fact System integration).**

### Phase 4: RPC & HTTP Layer (Sprints 11-12) — 26 SP
No change. RPC Handler Layer, HTTP API Layer.
**Sprint numbers shifted by +2.**

### Phase 5: Stream Processing & Real-time (Sprints 13-14) — 21 SP
No change. Stream Processing, Real-time Subscriptions.
**Sprint numbers shifted by +2.**

### Phase 6: Migration & Integration (Sprints 15-16) — 26 SP
No change. Migration Path, Layer Composition.
**Sprint numbers shifted by +2.**

### Phase 7: Documentation & DX (Sprint 17) — 16 SP
No change. Documentation, Developer Experience.
**Sprint number shifted by +2.**

---

## Event Catalog Summary

| Domain | Events | Source |
|--------|--------|--------|
| Alarm | 10 | EL-2 |
| WorkOrder Lifecycle | 11 | EL-3 |
| WorkOrderContext | 10 | EL-3 |
| TaskInstance | 9 | EL-3 |
| ApprovalRequest | 6 | EL-3 |
| L3SyncOperation | 5 | EL-3 |
| WorkflowDefinition | 5 | EL-3 |
| Equipment State | 6 | EL-4 |
| Batch Records | 4 | EL-5 |
| Quality Events | 5 | EL-5 |
| Operator Actions | 4 | EL-5 |
| **Total** | **75 events** | |

---

## Risk Mitigations (Integrated)

All pre-mortem mitigations from the EventLog WBS have been incorporated:

| Risk | Mitigation | Task |
|------|------------|------|
| EventLog API instability | Pinned version + `IIoTEventLogFacade` | EL-1.1, EL-1.2 |
| No rollback during migration | Feature flags per domain (`ES_ALARM_ENABLED`) | EL-2.1 |
| Projection inconsistency | Same-transaction writes in handlers | All handlers |
| Team unfamiliar with temporal queries | Spike with Alarm domain first | EL-2.19-21 |

---

## Files Impact

New files to be created (from EventLog WBS + Fact System):

```
src/lib/iiot/
├── events/
│   ├── alarm-events.ts           # 10 Alarm events
│   ├── work-order-events.ts      # 11 WorkOrder lifecycle
│   ├── context-events.ts         # 10 WorkOrderContext
│   ├── task-events.ts            # 9 TaskInstance
│   ├── approval-events.ts        # 6 ApprovalRequest
│   ├── l3-sync-events.ts         # 5 L3SyncOperation
│   ├── definition-events.ts      # 5 WorkflowDefinition
│   ├── equipment-state-events.ts # 6 Equipment state
│   ├── batch-events.ts           # Batch records (FDA)
│   ├── quality-events.ts         # Quality events (ISO)
│   ├── operator-events.ts        # Operator actions
│   └── schema.ts                 # Combined IIoTEventLogSchema
├── facts/                        # NEW: Extensible Fact System
│   ├── Fact.ts                   # Fact Schema (minimal envelope)
│   ├── FactStore.ts              # FactStore Service (attach, extend, query, traverse)
│   ├── FactTypeRegistry.ts       # Runtime factType registration & validation
│   └── iiot_facts.ddl.ts         # SQL schema with JSONB, graph edges
├── handlers/
│   ├── alarm-handlers.ts         # + Fact attachment integration
│   ├── work-order-handlers.ts
│   ├── context-handlers.ts
│   ├── task-handlers.ts
│   ├── approval-handlers.ts
│   ├── equipment-handlers.ts     # + Fact attachment integration
│   ├── compaction.ts
│   └── reactivity.ts
├── services/l1/
│   └── IIoTEventLog.ts           # Facade + layers
└── models/events/
    └── EventJournalModel.ddl.ts  # Table definitions
```

---

**Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>**
