# RFC: Framework Extraction

> **Status:** Draft  
> **Author:** Val (Vigilant Architecture Layer)  
> **Date:** 2026-05-08  
> **Predecessor:** ENTITY-RELATIONSHIPS-RFC.md  
> **Target:** Effect V4 (beta), new package in monorepo  

---

## 1. What This Is

The `src/lib/iiot/` package has produced a domain-agnostic architecture for distributed entity lifecycle management. 14 entities, 12 state machines, 139 tests, and a repeating 8-layer stack:

```
Schema → Graph → Machine → Entity → State → Model → Repo → DDL
```

This RFC extracts the architecture into a reusable framework package. The IIoT domain becomes the first consumer, co-evolving with the framework to validate its APIs.

The framework provides:
- Universal entity schema contract (identity, tenancy, audit, concurrency)
- State machine graphs with rich guards
- Effect Cluster entity + RPC patterns  
- Graph relationship layer (provider-injectable)
- Reactor consistency primitive (propagation, causal chains, idempotency)
- Transition tracking with cross-entity traversal
- Composable entity capabilities (traits, not inheritance)

The domain provides:
- Entity schemas (WorkOrder, Machine, Alarm...)
- Status enums and transition graphs
- Propagation descriptors
- Domain-specific RPC payloads
- Seed data

---

## 2. Naming

Working candidates. The name should communicate "structural foundation for entity systems" without domain coupling.

| Name | Metaphor | Feel |
|------|----------|------|
| **armature** | Skeleton inside a sculpture. Domain is the clay, framework is the structure. | Art + engineering. Precise. |
| **lattice** | Interconnected nodes. Mathematical structure. | Graph-native. Clean. |
| **substrate** | Foundation layer on which everything grows. | Biological. Layered. |
| **strata** | Geological layers. The tiered architecture made literal. | Structural. Evocative. |

*Decision needed from Prime.*

For this document, placeholder: `@gbg/lattice` (replace with chosen name).

---

## 3. Technical Foundations

### 3.1 Effect V4 (Direct)

The framework is built on Effect V4 from day one. No V3 compatibility layer.

Key V4 changes that shape the framework:

| V3 | V4 | Framework Impact |
|---|---|---|
| `@effect/cluster` (separate) | `effect` core | Entity, Rpc, Machine import from `effect` |
| `@effect/rpc` (separate) | `effect` core | RPC definitions are core Effect |
| `@effect/experimental` Machine | `effect/unstable/workflow` (likely) | Machine API may evolve during beta |
| `Context.Tag` | `Context.Service` | All service definitions use new pattern |
| `FiberRef` | `Context.Reference` | Propagation depth, concurrency limits |
| `Runtime<R>` | Removed | Runtime patterns change |
| Independent versioning | Unified versioning | One version for everything |

### 3.2 Package Location

`packages/lattice/` in the monorepo, alongside `packages/tmnl/`.

```
packages/
├── lattice/           # Framework package (NEW)
│   ├── src/
│   ├── package.json   # effect@4.x, @effect/sql-pg@4.x
│   └── project.json   # NX config
├── tmnl/              # IIoT domain (EXISTING, becomes consumer)
│   ├── src/lib/iiot/  # Refactored to import from @gbg/lattice
│   └── package.json   # @gbg/lattice as dependency
└── ...
```

---

## 4. Schema / DDL Design (Foundation)

### 4.1 Universal Entity Schema

Every entity in any domain carries this baseline:

```sql
-- Framework-provided base columns (every entity table includes these)
id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id   UUID        NOT NULL,
status      TEXT        NOT NULL,
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by  UUID        NOT NULL,
updated_by  UUID        NOT NULL,
metadata    JSONB       NOT NULL DEFAULT '{}',
version     INTEGER     NOT NULL DEFAULT 1
```

| Column | Purpose | Framework Responsibility |
|--------|---------|------------------------|
| `id` | UUID primary key, framework-generated | Identity |
| `tenant_id` | Row-level multi-tenancy, enforced via RLS | Isolation |
| `status` | Lifecycle state from entity's state graph | Lifecycle |
| `created_at` / `updated_at` | Temporal tracking | Audit |
| `created_by` / `updated_by` | Actor attribution (UUID FK) | Audit |
| `metadata` | Domain-extensible JSONB | Extensibility |
| `version` | Optimistic concurrency control | Concurrency |

### 4.2 Dual Identity: UUID + Display ID

The framework uses UUID internally for all references, joins, and graph node identification. Domains provide a human-readable `display_id` for operational use:

```sql
-- Domain adds alongside the base:
display_id  TEXT  UNIQUE NOT NULL  -- 'WO-2026-00042', 'MCH-001', etc.
```

The framework never generates or interprets `display_id`. It's a domain concern — sequential with prefix, formatted timestamp, or any scheme the domain chooses.

In Effect Schema terms:

```typescript
// Framework provides:
export const EntityId = Schema.UUID.pipe(Schema.brand('EntityId'))

// Domain extends with display ID:
export const WorkOrderDisplayId = Schema.String.pipe(
  Schema.brand('WorkOrderDisplayId'),
  Schema.pattern(/^WO-\d{4}-\d{5}$/)
)
```

### 4.3 Row-Level Security (Multi-Tenancy)

Every table, every query. PostgreSQL RLS enforces tenant isolation transparently:

```sql
-- Framework DDL for any entity table:
ALTER TABLE schema.entity_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON schema.entity_table
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

The framework's PgClient Layer sets the tenant context on connection:

```typescript
// Framework provides:
const withTenant = (tenantId: TenantId) =>
  sql`SET LOCAL app.current_tenant_id = ${tenantId}`
```

Application code never writes `WHERE tenant_id =`. RLS handles it. Single-tenant deployments use a sentinel tenant ID with a permissive policy.

### 4.4 Optimistic Concurrency Control

The `version` column is checked at the repo level, transparent to Machine procedures:

```typescript
// Framework repo base — every update includes version check:
const update = (entity: BaseEntity) =>
  sql`
    UPDATE ${table}
    SET ${sql.update(changes)}, version = version + 1
    WHERE id = ${entity.id} AND version = ${entity.version}
    RETURNING *
  `.pipe(
    Effect.flatMap((rows) =>
      rows.length === 0
        ? Effect.fail(new ConcurrencyConflictError({ entityId: entity.id, expectedVersion: entity.version }))
        : decodeFirst(Model)(rows)
    )
  )
```

Machine procedures don't know about versioning. The repo handles it. When a conflict is detected, the framework raises `ConcurrencyConflictError`. The domain provides a conflict resolution strategy via a `ConflictResolver` port:

```typescript
export class ConflictResolver extends Context.Service<ConflictResolver>()(
  'lattice/ConflictResolver',
  { /* retry | merge | fail strategies */ }
) {}
```

### 4.5 Unified Transition Table

One table for propagation tracking across all entity types. Solves the polymorphic lookup problem:

```sql
CREATE TABLE lattice.transitions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL,
  entity_type                 TEXT NOT NULL,
  entity_id                   UUID NOT NULL,
  from_status                 TEXT NOT NULL,
  to_status                   TEXT NOT NULL,
  transitioned_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transitioned_by             UUID,
  reason                      TEXT,
  propagation_id              UUID,
  caused_by_propagation_id    UUID REFERENCES lattice.transitions(propagation_id),
  metadata                    JSONB DEFAULT '{}'
);

-- Indexes for causal chain traversal
CREATE INDEX idx_transitions_entity ON lattice.transitions (entity_type, entity_id, transitioned_at DESC);
CREATE INDEX idx_transitions_propagation ON lattice.transitions (propagation_id) WHERE propagation_id IS NOT NULL;
CREATE INDEX idx_transitions_caused_by ON lattice.transitions (caused_by_propagation_id) WHERE caused_by_propagation_id IS NOT NULL;
CREATE INDEX idx_transitions_tenant ON lattice.transitions (tenant_id, transitioned_at DESC);
```

Domain-specific audit detail (approval levels, failure reasons, suspension reasons) goes in per-entity extension tables that FK back to `lattice.transitions.id`.

### 4.6 Graph Node Schema

Graph nodes are lightweight references — `id + entity_type`. Entity data lives in SQL. The graph is topology.

```cypher
// Framework creates nodes as:
CREATE (:entity {id: 'uuid-...', entity_type: 'WorkOrder', tenant_id: 'uuid-...'})

// Domain can add properties via projection:
SET n.display_id = 'WO-2026-00042'
SET n.status = 'started'  // optional: project status for graph-only queries
```

The framework provides a `GraphProjection` port. Each entity declares what to project into its graph node — from nothing (just id) to full state mirror.

---

## 5. Composable Entity Capabilities

Entities don't inherit from a base class. They compose capabilities via traits:

```typescript
// Framework provides capability mixins:
const WorkOrderSchema = BaseEntitySchema.pipe(
  withLifecycle(WorkOrderStatusGraph),  // adds status + transition tracking
  withAudit(),                          // adds created_by, updated_by
  withTenancy(),                        // adds tenant_id + RLS
  withVersioning(),                     // adds version + OCC
  withHierarchy(),                      // adds hierarchy_path (for structural entities)
  withDisplayId(WorkOrderDisplayId),    // adds display_id with domain format
)
```

This mirrors how Effect Layers compose — you don't inherit a base Layer, you merge capabilities. Each trait adds columns to the DDL, fields to the Model, and behavior to the State service.

### Trait Inventory

| Trait | Adds | Used By |
|-------|------|---------|
| `withLifecycle(graph)` | `status`, transition tracking, graph guards | All entities |
| `withAudit()` | `created_by`, `updated_by`, timestamps | All entities |
| `withTenancy()` | `tenant_id`, RLS policy | All entities |
| `withVersioning()` | `version`, OCC in repo | All entities |
| `withHierarchy()` | `hierarchy_path`, parent FK, containment edges | Structural entities |
| `withDisplayId(format)` | `display_id` with domain-specific format | Most entities |
| `withReactor(config)` | Reactor fiber, propagation descriptors | Entities participating in propagation |
| `withTransitionAudit()` | Per-entity transition detail table | Entities needing domain-specific audit (FDA, etc.) |

---

## 6. What Extracts

### Framework Package (`packages/lattice/`)

```
src/
├── schema/
│   ├── base.ts                  # BaseEntitySchema, EntityId, TenantId
│   ├── traits/                  # withLifecycle, withAudit, withTenancy, etc.
│   └── transition.ts            # Transition schema, PropagationId
├── graph/
│   ├── port.ts                  # GraphPort (injectable — AGE, Neo4j, etc.)
│   ├── node.ts                  # Base graph node schema
│   ├── edge.ts                  # Edge types, metadata envelope, descriptors
│   └── edge-registry.ts         # Edge type registry
├── machine/
│   ├── base.ts                  # Base machine factory pattern
│   ├── guards.ts                # EligibilityResult, rich guard base
│   └── graph-validation.ts      # Graph.directed base utilities
├── entity/
│   ├── base.ts                  # Entity.make pattern, RPC error base schemas
│   └── stack.ts                 # Layer composition helpers
├── state/
│   ├── port.ts                  # StateShape base interface
│   ├── in-memory.ts             # Ref<Map> implementation
│   └── sql-factory.ts           # SQL bridge factory
├── repo/
│   ├── base.ts                  # Base repo with OCC, tenant filtering
│   ├── decode.ts                # decodeOptional, decodeRows, decodeFirst
│   └── transition-repo.ts       # Unified transition table repo
├── reactor/
│   ├── reactor.ts               # Reactor Effect.Service
│   ├── abstract-reactor.ts      # AbstractReactor base class (per-entity config)
│   ├── propagation-envelope.ts  # Structural envelope
│   └── combinators.ts           # withDepthLimit, withAudit, withHITLGate
├── model/
│   ├── common.ts                # CreatedAt, UpdatedAt, OptionalMetadata, Version
│   └── ddl.ts                   # Base DDL generation utilities
├── infrastructure/
│   ├── feature-flags.ts         # Feature flag port
│   ├── tenant-context.ts        # Tenant RLS management
│   └── conflict-resolver.ts     # OCC conflict resolution port
└── testing/
    ├── in-memory-layers.ts      # All-in-memory test layers
    └── test-utilities.ts        # cleanTestData, withCleanDatabase, etc.
```

### Domain Package (`packages/tmnl/src/lib/iiot/` — refactored)

```
src/lib/iiot/
├── schemas/
│   ├── identifiers.ts           # Domain IDs (WorkOrderDisplayId, PlantDisplayId...)
│   ├── work-orders.ts           # WorkOrder schema (extends base with domain fields)
│   ├── assets/                  # ISA-95 asset schemas
│   └── events/                  # Domain events
├── machines/
│   └── graphs/                  # Domain-specific state graphs + guard overrides
├── entities/                    # Entity definitions composing framework + domain
├── reactors/                    # Per-entity reactor configs (descriptors)
├── models/                      # Domain Model.Class extensions
├── repos/                       # Domain repo extensions (domain-specific queries)
├── services/                    # Domain services (L1, L2)
│   └── l1/
│       ├── AgeGraphProvider.ts  # AGE implementation of GraphPort
│       └── TimescaleProvider.ts # TimescaleDB implementation
└── seed/                        # Domain seed data
```

---

## 7. Migration Strategy

### Phase 0: Effect V4 Setup
- Create `packages/lattice/` with Effect V4 dependencies
- Configure NX, TypeScript, Vitest
- Verify V4 beta works with `@effect/sql-pg`

### Phase 1: Schema + DDL Foundation
- Implement `BaseEntitySchema` with all universal columns
- Implement composable traits (`withLifecycle`, `withAudit`, `withTenancy`, `withVersioning`)
- Implement `lattice.transitions` unified table DDL
- Write tests proving trait composition produces correct DDL

### Phase 2: State + Repo Layer
- Extract `StateShape` interface as framework port
- Extract `Ref<Map>` in-memory implementation
- Extract SQL factory with OCC + tenant filtering
- Extract decode utilities
- Extract transition repo with propagation ID support

### Phase 3: Machine + Guard Layer
- Extract base machine factory pattern
- Extract `EligibilityResult` and rich guard infrastructure
- Extract `Graph.directed` validation utilities
- Port one entity (WorkOrder) as proof — framework Machine + domain graph

### Phase 4: Entity + RPC Layer
- Extract `Entity.make` + `Rpc.make` + `.toLayer()` pattern
- Extract RPC error base schemas
- Extract Layer composition helpers
- Port WorkOrder Entity to use framework base + domain extension

### Phase 5: Graph + Reactor Layer
- Implement `GraphPort` with AGE provider
- Implement edge creation API, edge registry, metadata envelope
- Implement Reactor service, AbstractReactor, PropagationEnvelope
- Port the `equipment_unavailable` golden path as proof

### Phase 6: IIoT Domain Migration
- Migrate remaining 13 entities to framework base
- Add transition tables to all entities (unified table)
- Add graph nodes for all entities
- Validate all 139 tests pass against framework-backed entities

---

## 8. Co-Evolution Contract

The IIoT domain and the framework develop together. IIoT validates framework APIs. When the framework can't express something IIoT needs, the framework adapts — not the domain.

Rules:
1. **IIoT never works around the framework.** If a pattern requires a workaround, the framework is wrong.
2. **Framework changes must not break IIoT.** The IIoT test suite is the framework's integration test.
3. **Domain-specific code stays in the domain.** If it mentions "WorkOrder", "ISA-95", or "FDA", it doesn't belong in the framework.
4. **Framework code is domain-ignorant.** It knows about entities, transitions, edges, propagation. It doesn't know what a "Machine" is.

---

## 9. Open Questions

1. **Name** — armature, lattice, substrate, strata, or something else?

2. **Effect V4 beta stability** — Machine/Cluster APIs are in `effect/unstable/*`. How do we handle breaking changes during beta? Pin to a specific beta version and upgrade deliberately?

3. **Migration testing** — Do we need a parallel test suite that runs IIoT against both V3 (current) and V4 (framework) during migration?

4. **Graph provider interface** — What operations must `GraphPort` expose? The current `GraphClient` has domain-specific methods (`getPlantHierarchy`). The framework port needs to be generic: `createNode`, `createEdge`, `query`, `healthCheck`.

5. **RLS performance** — Row-level security on every query adds overhead. At what scale does this become a concern? Should we benchmark early?

6. **Trait DDL generation** — Composing traits produces a column set. Does the framework generate DDL from traits, or does the domain author DDL manually and the framework validates alignment?
