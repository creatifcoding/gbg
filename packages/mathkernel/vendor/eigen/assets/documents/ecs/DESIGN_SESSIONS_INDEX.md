# ECS Design Sessions Index

> Tracker for iterative design sessions related to the Canonical Entity System

---

## Session Status

| # | Session | Document | Status | Date |
|---|---------|----------|--------|------|
| 1 | Persistence Architecture | `architecture/ECS_PERSISTENCE_ARCHITECTURE.md` | Complete | 2026-01-10 |
| 2 | Repository Architecture | `architecture/ECS_REPOSITORY_ARCHITECTURE.md` | **Complete** | 2026-01-10 |
| 3 | pg_lake Integration | `architecture/ECS_PGLAKE_INTEGRATION.md` | Planned | - |
| 4 | TimescaleDB Strategy | `architecture/ECS_TIMESCALEDB_STRATEGY.md` | Planned | - |
| 5 | Pattern Generalization | `design/ECS_PATTERN_GENERALIZATION.md` | Planned | - |
| 6 | GEOINT Handler Migration | `../geoint/design/HANDLER_MIGRATION.md` | Planned | - |

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ECS Design Session Dependencies                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐                                               │
│  │ 1. Persistence   │ ◄─── COMPLETE                                 │
│  │    Architecture  │                                               │
│  └────────┬─────────┘                                               │
│           │                                                          │
│           ▼                                                          │
│  ┌──────────────────┐     ┌──────────────────┐                      │
│  │ 2. Repository    │────►│ 5. Pattern       │                      │
│  │    Architecture  │     │    Generalization│                      │
│  └────────┬─────────┘     └────────┬─────────┘                      │
│           │                        │                                 │
│           │                        ▼                                 │
│           │               ┌──────────────────┐                      │
│           │               │ 6. GEOINT Handler│                      │
│           │               │    Migration     │                      │
│           │               └──────────────────┘                      │
│           │                                                          │
│           ├───────────────────────┐                                 │
│           ▼                       ▼                                 │
│  ┌──────────────────┐     ┌──────────────────┐                      │
│  │ 3. pg_lake       │     │ 4. TimescaleDB   │                      │
│  │    Integration   │     │    Strategy      │                      │
│  └──────────────────┘     └──────────────────┘                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Session Summaries

### 1. Persistence Architecture (Complete)

**Key Decisions**:
- `entity.*` schema namespace
- One table per trait (normalized ECS)
- UUID PK + prefixed string (EntityIdService)
- JSONB provenance on core table
- PointZ geometry for 3D
- Single transaction for entity+traits
- Write-through to DurableStreams
- Effect-atom caching

**Outputs**: SQL schema, migration strategy

---

### 2. Repository Architecture (Complete)

**Key Decisions**:
- Base+Domain + Separate Trait Repos (Kernel coordinates)
- Strategy/Plugin Pattern for operations
- `EntityRepository<T, E>` generic constraints
- Effect.Stream only for queries
- Manual Context.Tag + interface (domain repos)
- Effect.Service for base trait repos
- Schema-based interfaces (TaggedStruct)
- Configurable per-trait fusion strategies
- RPC → DSL translation via handlers
- Atom.family fetcher uses repository

**Outputs**: Repository interfaces, extension pattern, fusion strategies

---

### 3. pg_lake Integration (Planned)

**Scope**:
- Iceberg table design for entity history
- DuckDB query patterns
- COPY TO automation
- Object storage configuration
- Retention policies

**Prerequisites**: Repository architecture

---

### 4. TimescaleDB Strategy (Planned)

**Scope**:
- Hypertable vs standard table criteria
- Partitioning by entity_type
- Compression policies
- Continuous aggregates for analytics
- Integration with pg_lake

**Prerequisites**: Persistence implementation

---

### 5. Pattern Generalization (Planned)

**Scope**:
- Extract patterns from GEOINT atoms
- AtomRpc.Tag generalization
- Atom.family for entities
- stx pattern (XState + atoms)
- Polymorphic entity handling

**Reference docs**:
- `GEOINT_ATOM_FAMILY_ARCHITECTURE.md`
- `GEOINT_XSTATE_ATOM_ARCHITECTURE.md`

**Prerequisites**: Repository architecture

---

### 6. GEOINT Handler Migration (Planned)

**Scope**:
- Refactor FlightRepository → ECS base
- Refactor PoiRepository → ECS base
- Migrate SearchEntityHandlers
- Wire to cluster via Sharding.send()

**Prerequisites**: Repository architecture, Pattern generalization

---

## Implementation Priority

```
Phase 1: Foundation
├── [x] Persistence Architecture
├── [x] Repository Architecture
└── [x] ECS Migrations  ◄── COMPLETE

Phase 2: Patterns
├── [ ] Pattern Generalization  ◄── NEXT
└── [ ] TimescaleDB Strategy

Phase 3: Integration
├── [ ] GEOINT Handler Migration
└── [ ] pg_lake Integration
```

---

## Implementation Notes

### ECS Migrations (Complete - 2026-01-10)

**Approach**: Effect-native migrations (not using @effect/sql Migrator due to platform dependencies)

**Files Created**:
- `src/lib/ecs/persistence/migrator.ts` - Migration runner + utility functions
- `src/lib/ecs/persistence/index.ts` - Module exports

**Tables Created** (8 migrations):
1. `entity.entities` - Core entity with provenance, confidence, staleness
2. `entity.spatial` - PostGIS PointZ for 3D positions
3. `entity.temporal` - Validity windows, observation timestamps
4. `entity.kinetic` - Heading, speed, vertical rate
5. `entity.classified` - Classification, object type, allegiance
6. `entity.identifiable` - External IDs, callsigns, names
7. `entity.raw_audit` - Provenance audit trail with stream refs
8. `entity._migrations` - Migration tracking table

**Usage**:
```typescript
import { runMigrations, verifySchema, resetDatabase } from '@/lib/ecs/persistence'

// Run pending migrations
await Effect.runPromise(runMigrations.pipe(Effect.provide(PgClientLive)))

// Verify schema integrity
const { valid, missing } = await Effect.runPromise(verifySchema.pipe(...))
```
