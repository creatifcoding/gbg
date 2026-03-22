# WBS V2 — Network Extension & Marketplace

**Domain**: Network Extension Layer
**Architect**: network-architect
**Prefix**: NW
**RFC Sections**: S15-S18 (lines 5855-14896)
**Total Estimated SP**: 232 SP across 24 epics (Rev 5: Auto-sort NW-prefixed numbering)

---

## Existing Code Inventory (WBS V1 — 266 SP Complete)

Before scoping new work, here is what already exists and can be extended:

| Area | Path | Reuse Status |
|------|------|--------------|
| ISA-95 Entity Schemas | `src/lib/iiot/schemas/assets/` | EXTEND — add Organization, Capability, etc. |
| ISA-95 Entity Types | `src/lib/iiot/entity/` (16 entities) | EXTEND — add network entity types |
| State Machine Graphs | `src/lib/iiot/machines/graphs/` | EXTEND — add network entity state machines |
| Hierarchy Path | `src/lib/iiot/schemas/hierarchy/path.ts` | REUSE — variable-depth applies directly |
| Entity Contract | `src/lib/iiot/schemas/entity-contract.ts` | REUSE — network entities implement same contract |
| Deployment Mode | `src/lib/iiot/infrastructure/deployment-mode.ts` | EXTEND — add T0-T3 tier model |
| NATS Realtime | `src/lib/iiot/realtime/` | EXTEND — add multi-org subjects, leaf nodes |
| Event Distribution | `src/lib/iiot/realtime/event-distribution.ts` | EXTEND — add cross-org event flow |
| Holonet Bridge | `src/lib/iiot/realtime/holonet-bridge.ts` | EXTEND — add edge reconciliation |
| RPC Groups | `src/lib/iiot/rpc/` (14 groups) | EXTEND — add network RPC groups |
| Layer Composition | `src/lib/iiot/layers/index.ts` | EXTEND — add T0-T3 layer stacks |

---

## Phase 8: Network Entity Types (Sprints 1-3) — 114 SP

### NW-01: Network Entity Schemas & Identifiers — 13 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-01.1.1 | **OrganizationId branded identifier** — `Schema.String.pipe(Schema.brand('OrganizationId'))` with `ORG-` prefix, add to `schemas/identifiers.ts` | 1 |
| :hourglass: | NW-01.1.2 | **Organization schema** — `Schema.TaggedClass` with OrgId, OrgTier (earl/baron/count/duke/sovereign), ISA95Depth, variable-depth hierarchy config, compliance frameworks. States: onboarding -> active -> suspended -> deactivated | 5 |
| :hourglass: | NW-01.1.3 | **Capability schema** — `Schema.TaggedClass` with CapabilityId, process types, material specs, certifications, OR-Set CRDT metadata fields. States: draft -> published -> suspended -> retired | 3 |
| :hourglass: | NW-01.1.4 | **Capacity schema** — `Schema.TaggedClass` with CapacityId, real-time derivation fields (available/total/utilization), G-Counter CRDT metadata, link to equipment state source. States: available -> constrained -> unavailable | 2 |
| :hourglass: | NW-01.1.5 | **Reputation schema** — `Schema.TaggedClass` with ReputationId, G-10 trust score components (SC, CA, UP, PV), fraud signal fields, Sybil resistance tier. Immutable append-only record | 2 |

**Dependencies**: None (greenfield, extends existing schema patterns)
**RFC Sections**: S15.A, S15.D, S15.F, S15.1-S15.7

---

### NW-02: Network Entity State Machines & Lifecycle — 13 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-02.1.1 | **Organization state machine** — `Graph.directed` with states (onboarding, active, suspended, deactivated), transitions with guard conditions, propagation rules U-1/U-2 | 3 |
| :hourglass: | NW-02.1.2 | **Capability state machine** — draft -> published -> suspended -> retired with verification level guards (self-declared, peer-verified, third-party, audit-verified) | 2 |
| :hourglass: | NW-02.1.3 | **Capacity state derivation** — Real-time derivation from EquipmentState aggregate; capacity = f(equipment_state, scheduled_maintenance, shift_calendar). Not a traditional FSM but a computed projection | 3 |
| :hourglass: | NW-02.1.4 | **CrossOrgWorkOrder state machine** — 11 states from RFC S15.5 (draft -> submitted -> accepted -> scheduled -> in_progress -> quality_check -> completed -> invoiced -> settled -> disputed -> cancelled). Federated pair pattern: buyer-side + supplier-side views | 5 |

**Dependencies**: NW-01 (schemas)
**RFC Sections**: S15.B, S15.E, S15.5

---

### NW-03: Network Entity @effect/cluster Integration — 13 SP

> Machine-backed entities get full Entity.make + Machine wiring + observer registration.
> CRUD entities get lightweight entity definitions without Machine.
> **Key**: `Machine.changes` (Stream<State>) drives ALL real-time — observer infrastructure from platform-architect (PL-07 makeEntityObserver factory, PL-08 handler wiring) handles distribution.

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-03.1.1 | **OrganizationEntity** `MACHINE` — `Entity.make` with Organization schema, Machine boot from `makeOrganizationMachine`, message protocol (create, update-tier, suspend, activate), actor.send() delegation. Shard group SG-5 (network/128 shards). **Observer wiring**: register `makeEntityObserver('Organization', machine.changes)` at entity activation (scoped fiber). Following `AlarmEntity.ts` pattern | 3 |
| :hourglass: | NW-03.1.2 | **CapabilityEntity** `MACHINE` — `Entity.make` with Capability schema, Machine boot, OR-Set CRDT merge on entity receive for concurrent peer updates. Message protocol: declare, publish, suspend, retire, update-verification. **Observer wiring**: register `makeEntityObserver('Capability', machine.changes)` | 3 |
| :hourglass: | NW-03.1.3 | **MarketplaceWorkOrderEntity** `MACHINE` — `Entity.make` with MarketplaceWorkOrder schema, Machine boot for 14-state lifecycle, federated pair pattern (buyer-side + supplier-side entity views). **Observer wiring**: register `makeEntityObserver('MarketplaceWorkOrder', machine.changes)` for both buyer and supplier views | 3 |
| :hourglass: | NW-03.1.4 | **Network entity RPC groups** — `OrganizationRpcs`, `CapabilityRpcs`, `CapacityRpcs`, `ReputationRpcs`, `MarketplaceWorkOrderRpcs` following existing RPC group pattern in `src/lib/iiot/rpc/` | 2 |
| :hourglass: | NW-03.1.5 | **Network EntityStateChanged schemas** — `EntityStateChanged` event schemas for Organization, Capability, MarketplaceWorkOrder. Each carries previous state (via `Stream.zipWithPrevious` — NOT `Stream.pairwise` which does not exist), new state, transition action, timestamp. First emission has `Option.none()` for previous — map to "initialized" action | 2 |

**Observer Architecture (from RFC S12):**
```
Machine.changes (Stream<State>)
  -> makeEntityObserver(entityType, changesStream)  <- task NW-03.1.1-NW-03.1.3
    -> EntityStateChanged event                      <- task NW-03.1.5
      -> EventDistribution channel (iiot:entity-changes)  <- platform-architect
        -> Streaming RPCs -> WebSocket clients              <- platform-architect
        -> HolonetBridge -> NATS -> distributed fan-out      <- platform-architect
```
Network-architect entities REGISTER with observer infrastructure. Platform-architect OWNS the infrastructure.

**Entity Classification:**

| Entity | Type | Machine | ES Handler | Reactivity | Observer Wiring |
|--------|------|---------|------------|------------|-----------------|
| Organization | **Machine-backed** | NW-02.1.1 | NW-04.1.1 | NW-04.1.4 | NW-03.1.1 + NW-03.1.5 |
| Capability | **Machine-backed** | NW-02.1.2 | NW-04.1.2 | NW-04.1.4 | NW-03.1.2 + NW-03.1.5 |
| MarketplaceWorkOrder | **Machine-backed** | NW-02.1.4 | NW-04.1.3 | NW-04.1.4 | NW-03.1.3 + NW-03.1.5 |
| Capacity | **CRUD** | N/A (computed projection) | N/A | N/A | N/A |
| Reputation | **CRUD** | N/A (append-only record) | N/A | N/A | N/A |

**Dependencies**: NW-02 (state machines), platform-architect (entity system patterns PL-13 through PL-16, observer infrastructure PL-07 + PL-08)
**RFC Sections**: S12 (Observer Pattern), S15.C, S15.F
**API note**: `Stream.zipWithPrevious` (NOT `Stream.pairwise` — does not exist). First emission yields `Option.none()` for previous state.

---

### NW-04: Network Entity ES Handlers & Reactivity — 10 SP `MACHINE-BACKED`

> Following pattern: `src/lib/iiot/handlers/alarm-handlers.ts`, `alarm-reactivity.ts`
> Applies to Machine-backed entities: Organization, Capability, MarketplaceWorkOrder

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-04.1.1 | **Organization ES handlers** — EventLog command handlers for Organization lifecycle: CreateOrg, UpdateTier, Suspend, Activate, Deactivate. Each handler validates via state machine graph, writes event, updates state. Integrates with EventJournal for audit trail | 3 |
| :hourglass: | NW-04.1.2 | **Capability ES handlers** — EventLog command handlers: DeclareCapability, PublishCapability, SuspendCapability, RetireCapability, UpdateVerificationLevel. OR-Set CRDT merge on concurrent updates from different peers | 3 |
| :hourglass: | NW-04.1.3 | **MarketplaceWorkOrder ES handlers** — EventLog command handlers for 14-state lifecycle: PostRFQ, SubmitBid, AcceptBid, ScheduleWork, StartWork, SubmitQC, CompleteWork, Invoice, SettlePayment, RaiseDispute, CancelOrder. Federated pair pattern: buyer-side + supplier-side handler variants | 3 |
| :hourglass: | NW-04.1.4 | **Network entity reactivity handlers** — `EventLog.groupReactivity` for cache invalidation: org-reactivity (org:active, org:suspended), capability-reactivity (capabilities:published, capabilities:verified), marketplace-reactivity (marketplace:active, marketplace:pending, marketplace:settled) | 1 |

**Dependencies**: NW-02 (state machines), NW-01 (event schemas)
**RFC Sections**: S15.B, S15.E, S18.5
**Pattern Reference**: `src/lib/iiot/handlers/alarm-handlers.ts`, `src/lib/iiot/handlers/alarm-reactivity.ts`

---

### NW-05: Network Entity L2 Services — 8 SP `MACHINE-BACKED`

> Following pattern: `src/lib/iiot/services/l2/AlarmService.ts`, `alarm-temporal.ts`
> Dedicated business logic services for Machine-backed entities

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-05.1.1 | **OrganizationService** — L2 service: create org with tier assignment, manage ISA-95 depth configuration, handle org suspension/reactivation with cascading effects to child entities (capabilities, capacity). Temporal queries (org history, tier changes over time) | 3 |
| :hourglass: | NW-05.1.2 | **CapabilityService** — L2 service: declare + manage capabilities, trigger verification workflow, handle peer attestation collection, manage capability publication lifecycle. Cross-references with CapabilityDiscoveryService (NW-20) for search | 3 |
| :hourglass: | NW-05.1.3 | **MarketplaceWorkOrderService** — L2 service: orchestrate marketplace WO lifecycle, coordinate buyer/supplier views, manage escrow triggers (calls SuiBridgeService), handle SLA monitoring integration with AlarmService for breach events. Temporal queries (order history, settlement analytics) | 2 |

**Dependencies**: NW-04 (ES handlers), NW-08 (repositories)
**RFC Sections**: S15, S18.5-S18.7
**Pattern Reference**: `src/lib/iiot/services/l2/AlarmService.ts`

---

### NW-06: Network Entity Model Derivation — 8 SP

> Following pattern: `src/lib/iiot/models/` — Model.Class derivation from schemas with SQL transforms

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-06.1.1 | **OrganizationModel** — `Model.Class` derived from Organization schema. Model-specific transforms: OrgTier -> enum column, ISA95Depth -> integer, compliance frameworks -> JSONB. List view (OrgListModel), detail view (OrgDetailModel with nested hierarchy summary) | 3 |
| :hourglass: | NW-06.1.2 | **CapabilityModel + CapacityModel** — Model derivations. Capability: process types -> JSONB array, certifications -> JSONB, CRDT metadata -> JSONB. Capacity: derivation fields as numeric columns, equipment state FK | 2 |
| :hourglass: | NW-06.1.3 | **ReputationModel + MarketplaceWorkOrderModel** — Reputation: G-10 components as numeric columns, fraud signals -> JSONB, Sybil tier -> enum. MarketplaceWO: extends existing WorkOrderModel with marketplace fields (bid list -> JSONB, escrow ref, SLA terms -> JSONB) | 3 |

**Dependencies**: NW-01 (schemas)
**RFC Sections**: S15.D, S18.5
**Pattern Reference**: `src/lib/iiot/models/alarms/AlarmModel.ts`

---

### NW-07: Network Entity DDL & Migrations — 5 SP

> Following pattern: `src/lib/iiot/models/*.ddl.ts` — SQL table definitions + migrations

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-07.1.1 | **Organization + Capability DDL** — SQL tables in `commons` schema (cross-org). Organization: org_id PK, tier enum, isa95_depth, compliance JSONB, state enum, created_at, updated_at. Capability: capability_id PK, org_id FK, process_types JSONB, certifications JSONB, verification_level enum, state enum. Indexes on org_id, state, verification_level | 3 |
| :hourglass: | NW-07.1.2 | **Capacity + Reputation + MarketplaceWorkOrder DDL** — Capacity: capacity_id PK, org_id FK, available numeric, total numeric, utilization numeric, equipment_state_source FK. Reputation: append-only table with org_id, score components, timestamp. MarketplaceWorkOrder: extends work_orders table with marketplace columns via migration | 2 |

**Dependencies**: NW-06 (models), NW-19 (schema isolation model for `commons` schema)
**RFC Sections**: S15.D, S17.5
**Pattern Reference**: `src/lib/iiot/models/alarms/AlarmModel.ddl.ts`

---

### NW-08: Network Entity Repositories — 5 SP

> Following pattern: `src/lib/iiot/repos/` — CRUD repos with Effect SQL

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-08.1.1 | **OrganizationRepo** — CRUD + state transitions + hierarchy queries (list orgs by tier, find by compliance framework). Effect SQL with `commons` schema qualification | 2 |
| :hourglass: | NW-08.1.2 | **CapabilityRepo + CapacityRepo** — Capability: CRUD + search by process/material/certification + filter by verification level. Capacity: read-only projection (derived from equipment state) + aggregate queries | 2 |
| :hourglass: | NW-08.1.3 | **ReputationRepo + MarketplaceWorkOrderRepo** — Reputation: append-only insert + aggregate read (latest score per org) + history queries. MarketplaceWO: extends WorkOrderRepo with marketplace-specific queries (by settlement status, by escrow state) | 1 |

**Dependencies**: NW-07 (DDL)
**RFC Sections**: S15.D
**Pattern Reference**: `src/lib/iiot/repos/AlarmRepo.ts`

---

### NW-09: Network Entity Error Schemas — 2 SP

> Following pattern: `src/lib/iiot/errors/` — Domain-specific TaggedError types

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-09.1.1 | **Network entity errors** — `OrganizationNotFoundError`, `InvalidOrgTransitionError`, `OrgSuspendedError`, `CapabilityNotFoundError`, `CapabilityVerificationError`, `CapacityUnavailableError`. Per `Data.TaggedError` pattern | 1 |
| :hourglass: | NW-09.1.2 | **Marketplace errors** — `MarketplaceWorkOrderNotFoundError`, `InvalidMarketplaceTransitionError`, `EscrowCreationError`, `SettlementError`, `SLAViolationError`, `MatchingError`, `ReputationCalculationError`, `InsufficientTrustError` | 1 |

**Dependencies**: NW-01 (schemas for identifier types)
**RFC Sections**: S15, S18
**Pattern Reference**: `src/lib/iiot/errors/alarm.ts`

---

### NW-10: Network Entity HTTP Endpoints — 5 SP

> Following pattern: `src/lib/iiot/http/` — REST API routes wrapping RPC handlers

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-10.1.1 | **Organization + Capability HTTP routes** — REST endpoints: `GET/POST/PATCH /api/v1/organizations`, `GET/POST/PATCH /api/v1/capabilities`, `GET /api/v1/capabilities/search`. Wraps OrganizationRpcs and CapabilityRpcs. OpenAPI spec generation | 3 |
| :hourglass: | NW-10.1.2 | **Marketplace HTTP routes** — REST endpoints: `POST /api/v1/marketplace/rfq` (post RFQ), `GET /api/v1/marketplace/matches` (query matches), `POST /api/v1/marketplace/orders/{id}/accept`, `GET /api/v1/marketplace/reputation/{orgId}`. Wraps marketplace RPC groups | 2 |

**Dependencies**: NW-03 (RPC groups), NW-08 (repositories)
**RFC Sections**: S15, S18
**Pattern Reference**: `src/lib/iiot/http/api.ts`, `src/lib/iiot/http/query-api.ts`
**N/A layers**: Edge-specific entities (T0-T2) do NOT get HTTP endpoints — they communicate via NATS only. HTTP is T3/Cloud only.

---

### NW-11: Marketplace-Specific Streaming RPCs — 5 SP

> **NOT for entity state changes** — Machine-backed entity state transitions are handled automatically by the observer pattern (Machine.changes -> makeEntityObserver -> EventDistribution -> existing Streaming RPCs).
> This epic covers **marketplace-specific data streams** that are NOT entity state changes: capacity projections, cross-org event feeds, reputation aggregates.

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-11.1.1 | **Marketplace data streaming RPCs** — `SubscribeCapacityProjections` (aggregated capacity derived from equipment state — NOT entity state changes but computed projections), `SubscribeReputationAggregates` (periodic G-10 score recalculations across orgs). These are CRUD-derived data feeds, not Machine.changes streams | 3 |
| :hourglass: | NW-11.1.2 | **Cross-org event streaming** — `SubscribeCommonsEvents` (filtered view of manufacturing-commons events per subscriber org). Applies security-architect's data classification redaction (C-0 through C-5) at stream boundary. Rate-limited per security coordination (100 events/org/s, 10x burst) | 2 |

**Dependencies**: NW-03 (RPC groups), NW-18 (NATS topology for cross-org subjects), security-architect (SC data classification labels)
**RFC Sections**: S15.E, S18.4, S18.5
**Pattern Reference**: `src/lib/iiot/rpc/RealtimeRpcs.ts`
**Note**: Organization/Capability/MarketplaceWorkOrder state transitions are streamed via the observer infrastructure (platform-architect PL-07 observer factory, PL-08 handler wiring, PL-09 SubscribeEntityChanges RPC), NOT via custom streaming RPCs here.

---

### E2E Stack Coverage Audit

**Machine-backed entities** (Organization, Capability, MarketplaceWorkOrder) — 12-layer stack:

| # | Layer | Epic(s) | Status |
|---|-------|---------|--------|
| 1 | Schema | NW-01 | Covered |
| 2 | Model Derivation | NW-06 | Covered |
| 3 | DDL | NW-07 | Covered |
| 4 | Repository | NW-08 | Covered |
| 5 | Errors | NW-09 | Covered |
| 6 | L2 Service | **NW-05** | **ADDED** (dedicated per-entity L2 services) |
| 7 | **Machine** | NW-02 | Covered (state machine definitions) |
| 8 | **ES Handler** | **NW-04** | **ADDED** (EventLog command handlers + reactivity) |
| 9 | **Entity** | NW-03 (tasks NW-03.1.1-NW-03.1.3) | Expanded (full Machine + Entity.make wiring) |
| 10 | **Observer/Reactivity** | NW-03 tasks NW-03.1.1-NW-03.1.3 (observer wiring) + NW-03.1.5 (EntityStateChanged schemas) + NW-04 task NW-04.1.4 (cache reactivity) | Covered — Machine.changes -> makeEntityObserver -> EventDistribution (platform-architect infra) |
| 11 | RPC Group | NW-03 task NW-03.1.4 | Covered |
| 12 | HTTP Routes | NW-10 | Covered |

**CRUD entities** (Capacity, Reputation) — 8-layer stack:

| # | Layer | Epic(s) | Status |
|---|-------|---------|--------|
| 1 | Schema | NW-01 | Covered |
| 2 | Model Derivation | NW-06 | Covered |
| 3 | DDL | NW-07 | Covered |
| 4 | Repository | NW-08 | Covered |
| 5 | Errors | NW-09 | Covered |
| 6 | L2 Service | NW-20 (CapacitySignaling), NW-22 (Reputation) | Covered |
| 7 | RPC Group | NW-03 task NW-03.1.4 | Covered |
| 8 | HTTP Routes | NW-10 | Covered |
| - | Machine | N/A | Not applicable — CRUD entities |
| - | ES Handler | N/A | Not applicable — CRUD entities |
| - | Entity (cluster) | N/A | Not applicable — CRUD entities |
| - | Observer | N/A | Not applicable — CRUD entities |

**Plus cross-cutting:** Streaming RPCs (NW-11), EventDistribution channel integration, integration tests, barrel exports.

---

### NW-12: Network Entity Tests — Machine-Backed — 15 SP

> Dedicated test tasks for Machine-backed entities (Organization, Capability, MarketplaceWorkOrder).
> Tests at EACH layer of the 12-layer stack + observer wiring tests.
> **PubSub tests use `it()` + `Effect.runPromise`, NOT `it.effect()`.**
> **`Stream.zipWithPrevious`** (NOT `Stream.pairwise` — does not exist). First emission has `Option.none()` for previous.

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-12.1.1 | **Organization tests (13 test files)** — Schema decode/encode roundtrip, Model derivation (computed fields, list/detail views), DDL migration (table exists, constraints), Repo integration (CRUD + state query), Error variants, L2 Service (tier management, cascading suspend), Machine valid transitions (onboarding->active->suspended->deactivated), Machine invalid transitions (rejected paths), ES Handler (command->events->state), Entity.make integration (cluster lifecycle), Reactivity emission, **Observer wiring** (`Machine.changes` emission -> `EntityStateChanged` published to EventDistribution channel, verify `Stream.zipWithPrevious` yields `Option.none()` on first emission -> "initialized" action), RPC roundtrip | 5 |
| :hourglass: | NW-12.1.2 | **Capability tests (13 test files)** — Schema roundtrip (including CRDT metadata fields), Model derivation, DDL migration, Repo integration (CRUD + search by process/material), Error variants, L2 Service (verification workflow, peer attestation), Machine valid transitions (draft->published->suspended->retired), Machine invalid transitions, ES Handler (OR-Set CRDT merge on concurrent updates), Entity.make integration, Reactivity emission, **Observer wiring** (`Machine.changes` -> `EntityStateChanged` with CRDT merge state), RPC roundtrip | 5 |
| :hourglass: | NW-12.1.3 | **MarketplaceWorkOrder tests (15+ test files)** — Schema roundtrip (14-state lifecycle fields), Model derivation (marketplace extensions), DDL migration, Repo integration (marketplace-specific queries), Error variants, L2 Service (buyer/supplier orchestration, escrow trigger), Machine 14-state transitions (all valid paths), Machine invalid transitions (rejected paths for each state), ES Handler (federated pair: buyer-side + supplier-side), Entity.make integration, Reactivity emission, **Observer wiring** (verify both buyer-side and supplier-side `Machine.changes` emit `EntityStateChanged` independently), RPC roundtrip. **PubSub note**: settlement event bridge + observer subscription tests use `it()` + `Effect.runPromise` | 5 |

**Dependencies**: NW-01 through NW-11 (all entity stack layers must exist before tests)
**Pattern Reference**: `src/lib/iiot/__tests__/`, `src/lib/iiot/handlers/__tests__/`
**MEMORY.md notes**:
- PubSub roundtrip tests MUST use plain vitest `it()` + `Effect.runPromise` — `it.effect()` and `it.scoped()` TIMEOUT with PubSub + Stream.fromPubSub + Effect.fork
- `Stream.zipWithPrevious` NOT `Stream.pairwise` (does not exist). First emission: `Option.none()` for previous state -> "initialized" action

---

### NW-13: Network Entity Tests — CRUD — 4 SP

> Dedicated test tasks for CRUD entities (Capacity, Reputation).
> Tests at EACH layer of the 8-layer stack.

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-13.1.1 | **Capacity tests (8 test files)** — Schema decode/encode roundtrip (including G-Counter CRDT fields), Model derivation (computed projection), DDL migration, Repo integration (read-only projection + aggregate queries), Error variants, L2 Service (CapacitySignalingService: derivation from equipment state, aggregation rules O-1/O-2/O-3), RPC roundtrip, HTTP endpoint | 2 |
| :hourglass: | NW-13.1.2 | **Reputation tests (8 test files)** — Schema roundtrip (G-10 components, fraud signals), Model derivation, DDL migration, Repo integration (append-only insert + aggregate read + history), Error variants, L2 Service (ReputationService: G-10 computation, decay function, Benford's law fraud detection), RPC roundtrip, HTTP endpoint | 2 |

**Dependencies**: NW-01, NW-06 through NW-09, NW-20, NW-22 (entity stack + L2 services)
**Pattern Reference**: `src/lib/iiot/__tests__/repos/`, `src/lib/iiot/__tests__/schemas/`

---

### NW-14: Cross-Cutting Integration Tests — 8 SP

> Integration tests that span multiple entities and infrastructure layers.
> Not per-entity — these test the interactions between entities, services, and infrastructure.

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-14.1.1 | **NATS multi-org topology integration test** — Verify account-per-org isolation, cross-org export/import rules, manufacturing-commons system account mediation, NetworkEventEnvelope attestation. Requires NATS test container | 3 |
| :hourglass: | NW-14.1.2 | **Marketplace end-to-end flow test** — Full lifecycle: declare capability -> signal capacity -> post RFQ -> match -> accept -> create escrow -> complete work -> settle. Spans NW-20 through NW-23. Tests buyer/supplier federated views | 3 |
| :hourglass: | NW-14.1.3 | **Edge tier layer composition test** — Verify T1/T2/T3 Layer stacks compose correctly, progressive enhancement works, resource budget enforcement triggers backpressure at correct thresholds | 2 |

**Dependencies**: NW-15 through NW-19 (edge/topology), NW-20 through NW-23 (marketplace)
**Pattern Reference**: `src/lib/iiot/__tests__/integration/`, `src/lib/iiot/layers/__tests__/`

---

## Phase 9: Edge-First Architecture (Sprints 5-7) — 42 SP

### NW-15: Edge Tier Model & Layer Composition — 13 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-15.1.1 | **EdgeTier schema** — `Schema.Literal('T0', 'T1', 'T2', 'T3')` replacing/extending current `DeploymentMode`. T0=client-only, T1=minimal SBC, T2=industrial gateway, T3=enterprise server | 2 |
| :hourglass: | NW-15.1.2 | **TierCapabilityMatrix** — Schema defining MUST/SHOULD/MAY capabilities per tier (sensor ingestion, local alarm, historical storage, graph queries, entity sharding, regulatory audit). Configures progressive Layer composition | 3 |
| :hourglass: | NW-15.1.3 | **T1 Layer stack** — Minimal Layer: sensor ingestion + local alarm + NATS leaf. SingleRunner/10 shards, 256MB memory budget, 100-entity limit. No SQL, no graph | 3 |
| :hourglass: | NW-15.1.4 | **T2 Layer stack** — Industrial Layer: T1 + SQLite local + 30-day retention + historical queries. SingleRunner+SQL/150 shards, 1GB memory budget | 3 |
| :hourglass: | NW-15.1.5 | **T3 Layer stack** — Enterprise Layer: Full stack with TimescaleDB + AGE + SocketRunner/1500 shards, regulatory audit, graph traversal | 2 |

**Dependencies**: None (extends existing `deployment-mode.ts`)
**RFC Sections**: S16.1-S16.5, S16.10

---

### NW-16: Edge Sovereignty & Offline-First — 16 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-16.1.1 | **OfflineQueue service** — Effect service managing local JetStream write queue when NATS connection lost. Persistence to local disk. Configurable retention by tier (T1: 1d/100MB, T2: 30d/10GB) | 5 |
| :hourglass: | NW-16.1.2 | **EdgeReconciliation protocol** — Reconnection sequence: (1) sync vector clocks, (2) exchange deltas, (3) resolve conflicts via CRDT merge + LWW for non-CRDT fields, (4) confirm convergence. Effect service with staleness budget (T1: 10min, T2: 30min) | 5 |
| :hourglass: | NW-16.1.3 | **CRDT primitives** — OR-Set (capabilities), G-Counter (capacity), LWW-Register (reputation factors), Bounded Counter (trust scores). Pure functions with Effect Schema serialization | 3 |
| :hourglass: | NW-16.1.4 | **Conflict resolution strategy** — Decision tree: entity-type-aware conflict resolution. Equipment state = last-write-wins by device clock. Alarm state = merge-up (worst severity wins). Work order = saga-based (never auto-merge, flag for human review) | 3 |

**Dependencies**: NW-15 (tier model for retention configs)
**RFC Sections**: S16.1, S16.6-S16.8, S16.11

---

### NW-17: Edge Resource Management & Observability — 13 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-17.1.1 | **Resource budget enforcement** — Per-tier memory/entity/connection limits. Backpressure mechanism: when 80% budget reached, shed lowest-priority subscriptions. Effect service with metrics | 3 |
| :hourglass: | NW-17.1.2 | **Edge observability** — Health metrics (memory, CPU, connection count, queue depth, sync lag). Push to cloud via NATS `telemetry.>` subject. Adaptive sampling: increase detail when anomalies detected | 3 |
| :hourglass: | NW-17.1.3 | **Bandwidth optimization** — Delta compression for readings (send diffs, not full state). Aggregation windows (1s at edge, 5s at hub, 30s at cloud). Priority queuing (alarms > state changes > readings) | 5 |
| :hourglass: | NW-17.1.4 | **NixOS edge image spec** — Declarative Nix configuration for T1/T2 edge devices. Atomic OTA updates with automatic rollback. Health check integration | 2 |

**Dependencies**: NW-15 (tier model), infra-architect (IF NixOS coordination)
**RFC Sections**: S16.9, S16.12-S16.14

---

## Phase 10: Deployment Topology (Sprints 5-6) — 21 SP

### NW-18: NATS Multi-Org Topology — 13 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-18.1.1 | **Three-level NATS topology config** — Supercluster (cloud hub) -> Regional Hub -> Org Leaf Node. NATS account-per-org isolation. Configuration schemas and JetStream stream definitions per level | 5 |
| :hourglass: | NW-18.1.2 | **Cross-org subject namespace** — `commons.capability.>`, `commons.capacity.>`, `commons.workorder.>`, `commons.reputation.>`. NATS account export/import rules. NetworkEventEnvelope with org attestation + signature | 3 |
| :hourglass: | NW-18.1.3 | **Leaf node connection flow** — Effect service managing org leaf node lifecycle: connect, authenticate (JWT), subscribe to relevant subjects, handle reconnection. Account-level isolation with subject mapping | 3 |
| :hourglass: | NW-18.1.4 | **Hub capacity planning** — Monitoring service for hub-level metrics: connection count per hub, message throughput, stream size. Alert when approaching 200-org or bandwidth thresholds | 2 |

**Dependencies**: NW-15 (tier model), existing NATS realtime in `src/lib/iiot/realtime/`
**RFC Sections**: S16.3, S17.1-S17.3

---

### NW-19: Database & Infrastructure Topology — 8 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-19.1.1 | **Schema isolation model** — Per-org PostgreSQL schema (not database) for tenant isolation. Schema naming: `org_{orgId}`. Shared `commons` schema for cross-org data. Migration strategy for onboarding new orgs | 3 |
| :hourglass: | NW-19.1.2 | **Time-series data lifecycle** — TimescaleDB continuous aggregates: raw (7d) -> 1min (30d) -> 1hr (1yr) -> 1d (forever). Compression policies per tier. Regulatory retention overrides (FDA: 7yr, ISO: 3yr) | 3 |
| :hourglass: | NW-19.1.3 | **Disaster recovery configuration** — Tiered DR strategy: T1/T2 edge = local backup + cloud mirror, T3 = streaming replication + PITR, Cloud = NATS supercluster cross-DC + PostgreSQL synchronous standby. RPO/RTO targets per tier | 2 |

**Dependencies**: NW-18 (topology), infra-architect (IF database architecture coordination)
**RFC Sections**: S17.4-S17.8, S17.10-S17.12

---

## Phase 11: Marketplace Protocol (Sprints 6-9) — 55 SP

### NW-20: Capability Discovery & Capacity Signaling — 13 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-20.1.1 | **CapabilityDiscoveryService** — Effect service: declare capabilities, search by process/material/certification, filter by verification level and geographic proximity. Uses full-text search on NATS KV or PostgreSQL | 5 |
| :hourglass: | NW-20.1.2 | **CapacitySignalingService** — Effect service: derive real-time capacity from equipment state + shift calendar + maintenance schedule. Publish to `commons.capacity.{orgId}` with configurable update frequency. Aggregation rules O-1/O-2/O-3 (propagation outward rules: never reveal raw OEE, only aggregate availability) | 5 |
| :hourglass: | NW-20.1.3 | **Verification protocol** — Multi-level capability verification: L0 self-declared, L1 peer-verified (3 peer attestations), L2 third-party audit, L3 continuous monitoring. Schema + state machine for verification lifecycle | 3 |

**Dependencies**: NW-01 (network entity schemas), NW-03 (entity integration)
**RFC Sections**: S18.2-S18.4

---

### NW-21: Marketplace Work Order Lifecycle — 13 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-21.1.1 | **MarketplaceWorkOrder schema** — Extended work order with marketplace fields: RFQ parameters, bid list, selected supplier, escrow reference, SLA terms, settlement status. 14-state lifecycle (RFQ_POSTED through SETTLED) | 5 |
| :hourglass: | NW-21.1.2 | **Order matching engine** — Effect service: receive RFQ, query capabilities, rank by trust score + proximity + price + capacity availability. Configurable matching algorithm (initially sorted-rank, future: Gale-Shapley). Calls `CapacityTokenQuery.validateCapacity` at match time (first validation). **TOCTOU note**: tokens are time-decaying, so escrow creation (NW-23.1.2) must re-validate — see depin-architect coordination below | 5 |
| :hourglass: | NW-21.1.3 | **SLA enforcement service** — Monitor in-progress work orders against SLA terms (delivery time, quality metrics, quantity). Auto-escalate on violation. Integrate with alarm system for SLA breach events | 3 |

**Dependencies**: NW-20 (discovery + signaling), existing WorkOrder entity system
**RFC Sections**: S18.5-S18.7

---

### NW-22: Trust, Reputation & Geographic Optimization — 8 SP

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-22.1.1 | **ReputationService** — Effect service implementing G-10 trust score: SC (settlement completion) * 0.30 + CA (capability accuracy) * 0.20 + UP (uptime performance) * 0.25 + PV (peer verification) * 0.25. Decay function, fraud detection (Benford's law, sudden jumps), Sybil resistance tiers | 5 |
| :hourglass: | NW-22.1.2 | **Geographic optimization** — Proximity matching using lat/lng on Organization entities. Metro-area routing preference. Multi-hop work order support (A->B->C chains) with accumulated trust threshold | 3 |

**Dependencies**: NW-21 (work order lifecycle for settlement data), NW-01 (reputation schema)
**RFC Sections**: S18.8-S18.10

---

### NW-23: Sui Settlement Architecture — 13 SP `FLAG: depin-architect`

> **NOTE**: This epic covers the Effect-TS service layer that bridges to Sui smart contracts.
> The **Move smart contract development** (EscrowVault, CapacityToken, CapabilityNFT, ReputationSBT, NetworkTreasury) is flagged for **depin-architect** coordination. See RFC S18.11.

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-23.1.1 | **SuiBridgeService** — Effect service: connect to Sui RPC, submit transactions, query state. Wallet management (org-per-wallet). PTB (Programmable Transaction Block) composition for multi-hop settlement | 5 |
| :hourglass: | NW-23.1.2 | **EscrowService** — Effect service wrapping EscrowVault contract interactions: create escrow (fund), release on all-party confirm or QC pass, freeze on dispute, resolve/refund. Settlement trigger state machine. **TOCTOU**: Must re-validate `CapacityTokenQuery.validateCapacity` before funding — tokens may have expired between match (NW-21.1.2) and escrow creation. depin-architect's PTB handles Move-side atomicity (validity check + consume in one transaction) | 5 |
| :hourglass: | NW-23.1.3 | **Settlement event integration** — Bridge settlement events from Sui to NATS event system. Settlement confirmation -> work order state transition (INVOICED -> SETTLED). Network fee deduction (1.5-5% tiered) | 3 |

**Dependencies**: NW-21 (work order lifecycle), depin-architect (DP-01 Sui Bridge Core, DP-04 EscrowVault, DP-06 CapacityToken)
**RFC Sections**: S18.11.1-S18.11.9
**Cross-Domain**: depin-architect owns Move smart contract epics (EscrowVault, CapacityToken, CapabilityNFT, ReputationSBT, NetworkTreasury)

**Agreed Interface — CapacityTokenQuery** (depin-architect implements via SuiClientService):
```typescript
interface CapacityTokenQuery {
  readonly getBalance: (supplierId: OrganizationId) => Effect<CapacityBalance, SuiBridgeError>
  readonly validateCapacity: (supplierId: OrganizationId, requiredHours: number) => Effect<boolean, SuiBridgeError>
}
```
- Queries CapacityToken objects owned by supplier, filters by `is_valid()` (Clock-based expiry), sums remaining hours
- Called at match time (NW-21.1.2) and re-validated at escrow creation (NW-23.1.2) due to TOCTOU on time-decaying tokens
- Move-side atomicity: depin-architect's PTB checks validity + consumes tokens in single transaction

**Event Flow — Sui -> NATS** (depin-architect DP-01, bridge subscription):
- Settlement confirmations published to NATS subjects
- My task NW-23.1.3 subscribes and transitions work order state (INVOICED -> SETTLED)

---

### NW-24: Oracle Integration Architecture — 8 SP `FLAG: depin-architect`

> **NOTE**: This epic covers the Effect-TS oracle service layer.
> Smart contract-side oracle integration and **Chainlink/Pyth contract deployment** is flagged for **depin-architect** coordination. See RFC S18.12.

| Status | Task | Description | SP |
|--------|------|-------------|-----|
| :hourglass: | NW-24.1.1 | **OracleService** — Effect service: hybrid Pyth (Sui-native price feeds for SUI/USDC) + Chainlink Functions (EVM bridge for capability/certification verification). Multi-source price aggregation with TWAP, circuit breakers, staleness checks | 5 |
| :hourglass: | NW-24.1.2 | **Custom data streams** — NATS-to-oracle bridge: SmartCapacity (aggregated OEE -> on-chain) and SmartQuality (SPC/MVR bundles -> on-chain via Nautilus TEE attestation). Configurable push frequency | 3 |

**Dependencies**: NW-23 (SuiBridgeService), depin-architect (DP oracle contract integration)
**RFC Sections**: S18.12.1-S18.12.9
**Cross-Domain**: depin-architect owns Chainlink Functions deployment, Pyth price feed integration, Nautilus TEE setup

---

## Summary

### SP by Phase

| Phase | Epics | SP | Sprints |
|-------|-------|----|---------|
| Phase 8: Network Entity Types (full E2E stack + tests) | NW-01 through NW-14 | 114 | 1-6 |
| Phase 9: Edge-First Architecture | NW-15, NW-16, NW-17 | 42 | 6-8 |
| Phase 10: Deployment Topology | NW-18, NW-19 | 21 | 8-9 |
| Phase 11: Marketplace Protocol | NW-20 through NW-24 | 55 | 9-12 |
| **Total** | **24 epics** | **232 SP** | **12 sprints** |

### Epic Index

| Epic | Name | SP | Type |
|------|------|----|------|
| NW-01 | Network Entity Schemas & Identifiers | 13 | Foundation |
| NW-02 | Network Entity State Machines & Lifecycle | 13 | Foundation |
| NW-03 | Network Entity @effect/cluster Integration | 13 | Foundation |
| NW-04 | Network Entity ES Handlers & Reactivity | 10 | Machine-Backed |
| NW-05 | Network Entity L2 Services | 8 | Machine-Backed |
| NW-06 | Network Entity Model Derivation | 8 | E2E Stack |
| NW-07 | Network Entity DDL & Migrations | 5 | E2E Stack |
| NW-08 | Network Entity Repositories | 5 | E2E Stack |
| NW-09 | Network Entity Error Schemas | 2 | E2E Stack |
| NW-10 | Network Entity HTTP Endpoints | 5 | E2E Stack |
| NW-11 | Marketplace-Specific Streaming RPCs | 5 | E2E Stack |
| NW-12 | Network Entity Tests — Machine-Backed | 15 | Testing |
| NW-13 | Network Entity Tests — CRUD | 4 | Testing |
| NW-14 | Cross-Cutting Integration Tests | 8 | Testing |
| NW-15 | Edge Tier Model & Layer Composition | 13 | Edge |
| NW-16 | Edge Sovereignty & Offline-First | 16 | Edge |
| NW-17 | Edge Resource Management & Observability | 13 | Edge |
| NW-18 | NATS Multi-Org Topology | 13 | Topology |
| NW-19 | Database & Infrastructure Topology | 8 | Topology |
| NW-20 | Capability Discovery & Capacity Signaling | 13 | Marketplace |
| NW-21 | Marketplace Work Order Lifecycle | 13 | Marketplace |
| NW-22 | Trust, Reputation & Geographic Optimization | 8 | Marketplace |
| NW-23 | Sui Settlement Architecture | 13 | Marketplace |
| NW-24 | Oracle Integration Architecture | 8 | Marketplace |

### Dependency Map

```
NW-01 (Schemas) -------------------------------------------+
    |                                                      |
    +--> NW-06 (Models) --> NW-07 (DDL)                    |
    |                            |                         |
    |                            v                         |
    +--> NW-09 (Errors)    NW-08 (Repos)                   |
    |                            |                         |
    v                            v                         v
NW-02 (State Machines) --> NW-03 (Entity/Cluster) --> NW-10 (HTTP)
                                 |                         |
                                 v                         v
                           NW-04 (ES Handlers)       NW-11 (Streaming)
                                 |
                                 v
                           NW-05 (L2 Services)

NW-15 (Tier Model) ------> NW-18 (NATS Topology)
    |                               |
    v                               v
NW-16 (Offline/CRDT) ----> NW-19 (DB/Infra Topology)
    |
    v
NW-17 (Resource Mgmt)

NW-20 (Discovery) -------> NW-21 (Work Order Lifecycle)
                                    |
                                    v
                            NW-22 (Trust/Reputation)
                                    |
                                    v
                            NW-23 (Sui Settlement) --> NW-24 (Oracle)
```

### Cross-Domain Dependencies

| This Epic | Depends On | Domain |
|-----------|-----------|--------|
| NW-03 (Cluster Integration) | Entity system patterns (PL-13 through PL-16) | platform-architect |
| NW-03 (Cluster Integration) | Observer infrastructure (PL-07 + PL-08) | platform-architect |
| NW-17 (NixOS edge images) | NixOS infrastructure | infra-architect (IF) |
| NW-18 (NATS topology) | Multi-tenant isolation model | security-architect (SC) |
| NW-19 (DB topology) | Database architecture | infra-architect (IF) |
| NW-23 (Sui Settlement) | Move smart contracts (DP-01 Bridge, DP-04 Escrow, DP-06 CapacityToken) | depin-architect |
| NW-24 (Oracle Integration) | Oracle contract deployment | depin-architect (DP) |

### Flagged Items for depin-architect

1. **S18.11 — Sui Settlement**: Move smart contracts (EscrowVault, CapacityToken, CapabilityNFT, ReputationSBT, NetworkTreasury). Network-architect owns the Effect-TS bridge service (NW-23); depin-architect owns the on-chain contracts
2. **S18.12 — Oracle Integration**: Chainlink Functions deployment, Pyth price feed integration on Sui, Nautilus TEE setup. Network-architect owns the Effect-TS OracleService (NW-24); depin-architect owns the oracle infrastructure

### Old-to-New Epic Mapping

| Old Number | New ID | Name |
|------------|--------|------|
| Epic 29 | NW-01 | Network Entity Schemas & Identifiers |
| Epic 30 | NW-02 | Network Entity State Machines & Lifecycle |
| Epic 31 | NW-03 | Network Entity @effect/cluster Integration |
| Epic 48 | NW-04 | Network Entity ES Handlers & Reactivity |
| Epic 49 | NW-05 | Network Entity L2 Services |
| Epic 42 | NW-06 | Network Entity Model Derivation |
| Epic 43 | NW-07 | Network Entity DDL & Migrations |
| Epic 44 | NW-08 | Network Entity Repositories |
| Epic 45 | NW-09 | Network Entity Error Schemas |
| Epic 46 | NW-10 | Network Entity HTTP Endpoints |
| Epic 47 | NW-11 | Marketplace-Specific Streaming RPCs |
| Epic 50 | NW-12 | Network Entity Tests — Machine-Backed |
| Epic 51 | NW-13 | Network Entity Tests — CRUD |
| Epic 52 | NW-14 | Cross-Cutting Integration Tests |
| Epic 32 | NW-15 | Edge Tier Model & Layer Composition |
| Epic 33 | NW-16 | Edge Sovereignty & Offline-First |
| Epic 34 | NW-17 | Edge Resource Management & Observability |
| Epic 35 | NW-18 | NATS Multi-Org Topology |
| Epic 36 | NW-19 | Database & Infrastructure Topology |
| Epic 37 | NW-20 | Capability Discovery & Capacity Signaling |
| Epic 38 | NW-21 | Marketplace Work Order Lifecycle |
| Epic 39 | NW-22 | Trust, Reputation & Geographic Optimization |
| Epic 40 | NW-23 | Sui Settlement Architecture |
| Epic 41 | NW-24 | Oracle Integration Architecture |

### Open Questions (from RFC S18.13)

1. **Multi-hop escrow coordination** — How to handle PTB composition for A->B->C settlement chains (atomic vs staged)?
2. **Cross-metro marketplace** — Geographic boundary for marketplace visibility (metro only, regional, global)?
3. **IP protection** — How to protect manufacturing IP in capability declarations?
4. **Antitrust considerations** — Marketplace concentration thresholds for dominant suppliers
5. **Insurance/liability** — Who carries liability for marketplace-brokered defective goods?
6. **Gale-Shapley matching** — When to graduate from sorted-rank to stable matching algorithm?

---

*Generated: 2026-02-13 by network-architect*
*Rev 1: E2E stack audit — +30 SP, +6 epics (Layers 2-5, 9-10)*
*Rev 2: Machine/CRUD classification — +21 SP, +2 epics (ES Handlers, L2 Services). 3 Machine-backed, 2 CRUD entities.*
*Rev 3: Dedicated test epics — +25 SP, +3 epics (Machine tests, CRUD tests, cross-cutting integration).*
*Rev 4: Machine.changes observer wiring — +4 SP (NW-03: +2 SP for observer wiring + EntityStateChanged schemas, NW-12: +2 SP for observer tests). Stream.zipWithPrevious noted (NOT Stream.pairwise).*
*Rev 5: Auto-sort — NW-prefixed numbering (NW-01 through NW-24). Fixed epic count from 22 to 24. All internal cross-references updated. Cross-domain references use PL-/DP-/SC-/IF- prefixes.*
*Rev 5.1: Cross-domain reference validation — fixed stale PL-34..PL-37 -> PL-07+PL-08, stale DP-30/DP-32/DP-35 -> DP-01/DP-04/DP-06. All cross-domain refs verified against renumbered domain files.*
*RFC Source: `docs/specifications/rfc-entity-realtime-integration.md` lines 5855-14896*
