# ECS Persistence Architecture Design Record

> Design session: 2026-01-10
> Participants: Val (AI), Prime (Human)
> Status: In Progress

---

## Context

This document captures the iterative design process for the ECS (Canonical Entity System) persistence layer. The ECS module provides platform-level primitives for multi-source entity fusion. This design focuses on how entities and their traits persist to PostgreSQL/PostGIS.

### Prerequisites
- ECS schemas complete (`src/lib/ecs/schemas/`)
- ECS services stubbed (`src/lib/ecs/services/`)
- PostGIS client exists (`src/lib/geoint/persistence/postgis/PostGISClient.ts`)
- Target database schema outlined in GEOINT_EVENT_ARCHITECTURE_DESIGN.md

### Design Goals
1. Programmatic migrations via Effect SQL
2. Repository pattern for entities and traits
3. ECS-optimized schema (core table + trait tables)
4. Integration with existing PostGIS infrastructure

---

## Part 1: Database Schema Strategy

### Q1.1: Schema Namespace
**Q**: Should ECS tables live in the `entity` schema (as designed) or a new `ecs` schema?
**A**: `entity` schema - matches existing design in GEOINT_EVENT_ARCHITECTURE_DESIGN.md, already expected by PostGIS health checks.

### Q1.2: Table Granularity
**Q**: The design shows separate tables per trait (entity.spatial, entity.temporal, etc.). Do you want:
- (A) One table per trait (normalized, ECS-pure)
- (B) Denormalized with common traits in core table
- (C) Hybrid - core traits embedded, optional traits separate

**A**: (A) One table per trait - normalized, ECS-pure architecture. Separate tables for spatial, temporal, kinetic, classified, identifiable traits with FK to core entity table.

### Q1.3: Primary Key Strategy
**Q**: Entity IDs - should they be:
- (A) UUID (postgres gen_random_uuid())
- (B) Prefixed string from EntityIdService (e.g., "flight-a1b2c3d4")
- (C) Both - UUID as PK, prefixed string as indexed column

**A**: (C) Both - UUID as PK for efficient joins, prefixed string (from EntityIdService) as indexed column for human-readable lookups. EntityIdService will need to work with this dual-ID pattern.

### Q1.4: Provenance Storage
**Q**: Provenance/source contributions - how granular?
- (A) JSONB column on entity table (simple, denormalized)
- (B) Separate `entity.provenance` table with FK (normalized)
- (C) Separate `entity.source_contributions` table (fully normalized, one row per source)

**A**: (A) JSONB column on entity table - simple, denormalized. Sources array stored as JSONB on the core entity table.

---

## Part 2: Trait Table Design

### Q2.1: Spatial Trait - PostGIS Types
**Q**: For the spatial trait, which PostGIS geometry types?
- (A) GEOMETRY(Point, 4326) for position only
- (B) GEOMETRY(PointZ, 4326) for 3D position (lon, lat, alt)
- (C) Both Point and separate Geometry column for complex shapes

**A**: (B) GEOMETRY(PointZ, 4326) for 3D position - supports aircraft, drones, and any entity with altitude. Single column approach.

### Q2.2: Temporal Trait - TimescaleDB
**Q**: Should temporal trait table be a TimescaleDB hypertable?
- (A) Yes - enables time-series queries, compression
- (B) No - standard table, temporal queries via index
- (C) Depends on entity type (flights yes, POIs no)

**A**: (C) Per entity type - hypertable for high-frequency entities (flights, tracks), standard PostgreSQL table for low-frequency entities (POIs, static features).

**Design Note**: This implies we may need entity-type-specific temporal tables OR a discriminated hypertable with partitioning by entity_type.

### Q2.3: Optional vs Required Traits
**Q**: How to handle entities missing certain traits?
- (A) NULL FK - trait table row simply doesn't exist
- (B) All trait tables have rows, with nullable columns
- (C) Trait presence tracked in core entity table (has_spatial, has_temporal flags)

**A**: (A) No row exists - if entity lacks spatial data, no row in entity.spatial. Cleanest approach, enforced by FK relationships.

### Q2.4: Trait Versioning
**Q**: Should trait tables track history (old values)?
- (A) No - current state only, history in event stream
- (B) Yes - versioned rows with valid_from/valid_to
- (C) Separate history tables (entity.spatial_history)

**A**: **Requires deeper design** - Current state in transactional tables, history via [pg_lake](https://github.com/Snowflake-Labs/pg_lake) for analytical queries outside transactional scope. This separates OLTP (current state) from OLAP (historical analysis).

**Design Insight**: pg_lake pattern (Snowflake Labs):
- **pg_lake**: PostgreSQL extension integrating Apache Iceberg tables
- Uses DuckDB columnar engine for analytical queries
- Supports Parquet/CSV/JSON in object storage (S3, Azure, GCS)
- Maintains PostgreSQL transactional guarantees

**Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL                              │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │  entity.* tables │     │      pg_lake extension      │   │
│  │  (OLTP - current)│     │  (Iceberg table interface)  │   │
│  └────────┬────────┘     └──────────────┬──────────────┘   │
│           │                              │                  │
│           │ COPY TO                      │ Query            │
│           ▼                              ▼                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              DuckDB (columnar engine)                │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
└──────────────────────────────┼──────────────────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │   Object Storage    │
                    │  (S3/Azure/GCS)     │
                    │  Iceberg/Parquet    │
                    └─────────────────────┘
```

**Use case**: Entity historical tracks, temporal analysis, pattern detection across time windows

---

## Part 3: Repository Pattern

### Q3.1: Repository Granularity
**Q**: Repository structure:
- (A) One EntityRepository that handles all traits
- (B) Separate repository per trait (SpatialRepository, TemporalRepository)
- (C) EntityRepository + TraitRepository base class with specializations

**A**: **Separate design concern** - Repository architecture requires its own design session with requirements gathering. Defer to dedicated document: `ECS_REPOSITORY_ARCHITECTURE.md`

**Key insight**: Base ECS ensures unified handling of any "entity". Domains (like GEOINT) extend this further. This layered approach allows platform-level consistency with domain-specific flexibility.

### Q3.2: Query Interface
**Q**: How should spatial queries be exposed?
- (A) Raw SQL with spatialQuery helpers
- (B) Type-safe query builder (Effect SQL tagged templates)
- (C) Domain-specific methods (findInBBox, findWithinRadius)

**A**: Both - Domain methods for common cases (findInBBox, findWithinRadius), query builder for complex/custom queries. This is essentially refactoring and evolving the entity handler architecture from GEOINT.

**Architectural direction**:
- ECS layer: Generic entity operations, base spatial queries
- Domain layer (GEOINT): Specialized handlers, domain-specific query methods
- Existing GEOINT handlers will be refactored to use ECS primitives

### Q3.3: Transaction Boundary
**Q**: When creating an entity with traits, transaction handling:
- (A) Single transaction wrapping all inserts
- (B) Separate transactions, eventual consistency
- (C) Saga pattern with compensation

**A**: (A) Single transaction - atomic operation wrapping entity creation + all trait inserts. Ensures consistency.

---

## Part 4: Migration Strategy

### Q4.1: Migration Framework
**Q**: Migration approach:
- (A) Version-based (like editor/v3/persistence/migrations.ts)
- (B) Migration files with up/down
- (C) Schema diffing (compare TypeScript schemas to DB)

**A**: (A) Version-based - numbered versions with sequential application. Follows established pattern from editor/v3/persistence/migrations.ts.

### Q4.2: Migration Location
**Q**: Where should migrations live?
- (A) `src/lib/ecs/persistence/migrations.ts`
- (B) `src/lib/ecs/persistence/migrations/` directory
- (C) Shared migration system at platform level

**A**: Migrations directory structure with domain separation:

```
src/lib/ecs/persistence/
├── migrations/
│   ├── index.ts           # Migration runner
│   ├── 001_entity_schema.ts
│   ├── 002_entity_core.ts
│   ├── 003_spatial_trait.ts
│   ├── 004_temporal_trait.ts
│   └── ...

src/lib/geoint/persistence/
├── migrations/
│   ├── 001_flight_tables.ts
│   ├── 002_poi_tables.ts
│   └── ...
```

**Key**: Base ECS migrations for platform primitives, domain migrations (GEOINT) for domain-specific entity extensions.

### Q4.3: PostGIS Extension
**Q**: PostGIS extension initialization:
- (A) Assume already installed (docker-compose handles it)
- (B) Check and create in migration if missing
- (C) Separate bootstrap script

**A**: Hybrid - Assume installed (docker-compose), but migration checks and bootstraps if missing. Defensive approach that works in dev (docker) and production (managed DB).

---

## Part 5: Integration Points

### Q5.1: Existing Repository Coexistence
**Q**: GEOINT already has FlightRepository, PoiRepository, etc. Strategy:
- (A) Replace them with ECS repositories
- (B) Adapter layer - existing repos delegate to ECS
- (C) Parallel operation during migration period

**A**: **Refactor** - Not replace, but evolve. Create a base mechanism that existing repositories can extend/utilize. GEOINT repositories become ECS-aware through refactoring, not wholesale replacement.

**Approach**:
1. Create ECS base repository primitives
2. Refactor FlightRepository, PoiRepository to extend/compose with ECS base
3. Domain-specific logic remains in domain repos, generic entity ops delegated to ECS

### Q5.2: DurableStreams Integration
**Q**: Should persistence layer publish to DurableStreams?
- (A) No - that's the service layer's job
- (B) Yes - repository publishes on write
- (C) Optional via configuration

**A**: (B) Yes, repositories publish by default with opt-out capability. Smart publishing - repositories automatically publish entity events on write, with ability to disable for specific operations (bulk imports, migrations).

**Pattern**: Write-through to DurableStreams ensures event stream consistency with database state.

### Q5.3: Cache Layer
**Q**: Caching strategy for entity reads:
- (A) No cache - always query DB
- (B) In-memory cache with TTL
- (C) Effect-atom integration (entities as atoms)

**A**: (C) Effect-atom integration - entities materialized as atoms. Reactive updates, integrates with existing GEOINT atom patterns.

**Key insight**: Much of this is already built and tested in GEOINT. The work is to:
- Generalize existing patterns
- Encapsulate common behavior
- Make polymorphic (works for any entity type)
- Leverage AtomRpc.Tag and related scaffolding

**Reference patterns**:
- `GEOINT_ATOM_FAMILY_ARCHITECTURE.md` - Atom.family + AtomRpc.Tag
- `GEOINT_XSTATE_ATOM_ARCHITECTURE.md` - stx pattern (XState + atoms)
- Existing GEOINT atoms in `src/lib/geoint/atoms/`

---

## Design Decisions Summary

### Database Schema
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Schema namespace | `entity` | Matches existing design, health checks expect it |
| Table structure | One table per trait | ECS-pure, normalized architecture |
| Primary key | UUID + prefixed string | UUID for joins, string for human lookups |
| Provenance | JSONB on core table | Simple, denormalized, sufficient for initial use |
| Geometry type | PointZ (3D) | Supports altitude for aircraft/drones |
| TimescaleDB | Per entity type | Hypertable for flights, standard for POIs |
| Optional traits | No row exists | Cleanest, FK-enforced |
| History | pg_lake (Iceberg) | OLTP current state, OLAP historical via DuckDB |

### Repository Architecture
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Structure | Separate design session | Requires deeper requirements gathering |
| Query API | Domain methods + builder | Common cases typed, complex queries flexible |
| Transactions | Single transaction | Atomic entity + traits creation |
| Existing repos | Refactor, not replace | Evolve to ECS-aware, preserve domain logic |
| Event publishing | Default on, opt-out | Write-through to DurableStreams |
| Caching | Effect-atom integration | Reactive, leverages existing GEOINT patterns |

### Migration Strategy
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Version-based | Follows editor/v3 pattern |
| Location | migrations/ directory | Base ECS + domain-specific |
| PostGIS | Assume + check/bootstrap | Works in dev and production |

---

## Database Schema (Final)

```sql
-- =============================================================================
-- ECS Core Schema - entity.*
-- =============================================================================

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS entity;

-- Schema version tracking
CREATE TABLE IF NOT EXISTS entity.schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Core Entity Table
-- =============================================================================

CREATE TABLE entity.entities (
  -- Primary key (efficient joins)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Human-readable ID from EntityIdService
  entity_id TEXT NOT NULL UNIQUE,

  -- Entity type discriminator
  entity_type TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Versioning for optimistic locking
  revision INTEGER NOT NULL DEFAULT 1,

  -- Aggregate confidence (0.0 - 1.0)
  confidence FLOAT NOT NULL DEFAULT 0.5,

  -- Staleness tracking
  is_stale BOOLEAN NOT NULL DEFAULT false,
  ttl_seconds INTEGER NOT NULL DEFAULT 300,

  -- Provenance as JSONB
  -- Structure: { sources: SourceContribution[], primarySource: string }
  provenance JSONB NOT NULL DEFAULT '{"sources": [], "primarySource": null}',

  -- Extensible metadata
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_entities_entity_id ON entity.entities(entity_id);
CREATE INDEX idx_entities_entity_type ON entity.entities(entity_type);
CREATE INDEX idx_entities_updated_at ON entity.entities(updated_at);
CREATE INDEX idx_entities_is_stale ON entity.entities(is_stale) WHERE is_stale = true;

-- =============================================================================
-- Spatial Trait Table
-- =============================================================================

CREATE TABLE entity.spatial (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,

  -- 3D position (lon, lat, altitude)
  position GEOMETRY(PointZ, 4326) NOT NULL,

  -- Optional bounding box
  bounds BOX2D,

  -- Optional complex geometry (polygon, linestring, etc.)
  geometry GEOMETRY(Geometry, 4326)
);

CREATE INDEX idx_spatial_position ON entity.spatial USING GIST(position);
CREATE INDEX idx_spatial_geometry ON entity.spatial USING GIST(geometry) WHERE geometry IS NOT NULL;

-- =============================================================================
-- Temporal Trait Table
-- =============================================================================

CREATE TABLE entity.temporal (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,

  -- Validity window
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ,

  -- When this was observed
  observed_at TIMESTAMPTZ NOT NULL,

  -- Timezone hint
  timezone TEXT NOT NULL DEFAULT 'UTC'
);

CREATE INDEX idx_temporal_valid_from ON entity.temporal(valid_from);
CREATE INDEX idx_temporal_observed_at ON entity.temporal(observed_at);

-- =============================================================================
-- Kinetic Trait Table
-- =============================================================================

CREATE TABLE entity.kinetic (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,

  -- Heading in degrees (0-360)
  heading FLOAT NOT NULL,

  -- Speed in m/s
  speed FLOAT NOT NULL,

  -- Vertical rate in m/s (positive = ascending)
  vertical_rate FLOAT NOT NULL DEFAULT 0
);

-- =============================================================================
-- Classified Trait Table
-- =============================================================================

CREATE TABLE entity.classified (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,

  -- Classification: friendly, hostile, neutral, unknown
  classification TEXT NOT NULL DEFAULT 'unknown',

  -- Object type: aircraft, vessel, vehicle, person, structure, etc.
  object_type TEXT NOT NULL,

  -- Allegiance (optional)
  allegiance TEXT
);

CREATE INDEX idx_classified_classification ON entity.classified(classification);
CREATE INDEX idx_classified_object_type ON entity.classified(object_type);

-- =============================================================================
-- Identifiable Trait Table
-- =============================================================================

CREATE TABLE entity.identifiable (
  entity_id UUID PRIMARY KEY REFERENCES entity.entities(id) ON DELETE CASCADE,

  -- External IDs from various sources
  -- Structure: { "icao24": "abc123", "osm_id": "node/123", "mmsi": "123456789" }
  external_ids JSONB NOT NULL DEFAULT '{}',

  -- Callsign (for aircraft, vessels)
  callsign TEXT,

  -- Human-readable name
  name TEXT
);

CREATE INDEX idx_identifiable_external_ids ON entity.identifiable USING GIN(external_ids);
CREATE INDEX idx_identifiable_callsign ON entity.identifiable(callsign) WHERE callsign IS NOT NULL;

-- =============================================================================
-- Raw Audit Table (provenance references)
-- =============================================================================

CREATE TABLE entity.raw_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to entity
  entity_id UUID NOT NULL REFERENCES entity.entities(id) ON DELETE CASCADE,

  -- Source identifier
  source TEXT NOT NULL,

  -- Stream reference for replay
  stream_url TEXT,
  stream_offset TEXT,

  -- Data integrity
  data_hash TEXT NOT NULL,

  -- When ingested
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raw_audit_entity_id ON entity.raw_audit(entity_id);
CREATE INDEX idx_raw_audit_source ON entity.raw_audit(source);
CREATE INDEX idx_raw_audit_ingested_at ON entity.raw_audit(ingested_at);
```

---

## Implementation Plan

### Phase 1: Migrations Infrastructure
1. Create `src/lib/ecs/persistence/` directory structure
2. Implement version-based migration runner
3. Create initial migrations for entity.* tables
4. Test migrations against local PostGIS

### Phase 2: Repository Design Session
- Conduct separate design session for repository architecture
- Document in `ECS_REPOSITORY_ARCHITECTURE.md`
- Define base repository interfaces
- Design trait repository composition

### Phase 3: Implementation
- Implement base ECS repositories
- Refactor GEOINT repositories to use ECS base
- Add DurableStreams write-through
- Integrate with effect-atom patterns

### Phase 4: Testing
- Integration tests with actual PostGIS
- Migration rollback testing
- Performance benchmarks for spatial queries

---

## Related Documents

- `ECS_SERVICE_ARCHITECTURE.md` - Service catalog and dependency graph
- `GEOINT_EVENT_ARCHITECTURE_DESIGN.md` - Event architecture decisions
- `GEOINT_ATOM_FAMILY_ARCHITECTURE.md` - Atom patterns to generalize
- `ECS_REPOSITORY_ARCHITECTURE.md` - (To be created) Repository design

---

## Next Steps

- [x] Complete Q&A rounds (Parts 1-5)
- [x] Finalize database schema design
- [ ] **Implement migrations** - Phase 1 ready to begin
- [ ] Conduct repository design session → `ECS_REPOSITORY_ARCHITECTURE.md`
- [ ] Implement repositories
- [ ] Wire to existing services
- [ ] Design pg_lake integration for historical analytics (Iceberg + DuckDB)
