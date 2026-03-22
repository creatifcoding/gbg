# Conceptual Alignment: IIoT + AMS v3 Convergence

Generated: 2026-01-29
Rounds: 3
Status: **CONFIRMED**

## Current Aligned Model

| Dimension | Value |
|-----------|-------|
| Shape | 3-layer repo: Schema.TaggedClass (domain) → Model.Class (persistence) → makeRepository() + domain extensions |
| Composition | Deployment-configurable layers via Layer.mergeAll: TestLayer → SqlTestLayer → makeTauriLayer → makeClusterLayer |
| API | Effect.Service<>()() with dependencies array; Stream.Stream<T> for queries; repository interfaces with satisfies contracts |
| Scope | ISA-95 equipment hierarchy: Enterprise → Site → Area → Line (Work Center) → Machine (Work Unit) → Sensor/Actuator (Control Module) |
| Real-Time | Tiered latency: Hot (<1s hypertable) / Warm (1-60s continuous aggregates) / Cold (>60s hourly aggregates) |
| Automation | L0-L4 ISA-95 pyramid; AMS=L3 (MES/MOM), IIoT=L2 (SCADA), Sensors=L0 (Physical) |

---

## Detailed Dimensions

### 1. Shape: 3-Layer Repository Pattern

```
Domain Schema (schemas/)     →  Business types, TaggedClass
        ↓
Persistence Model (models/)  →  Model.Class, DB transforms
        ↓
Repository (repos/)          →  makeRepository() + domain operations
```

**Key Pattern:**
```typescript
// Base CRUD from makeRepository
const makeAssetRepositoryBase = Model.makeRepository(AssetModel, { ... })

// Extended interface with domain operations
export interface AssetRepository extends ReturnType<typeof makeAssetRepositoryBase> {
  readonly checkOut: (id, userId) => Effect<AssetModel, Error>
  readonly query: (params) => Effect<readonly AssetModel[], Error>
}

// Implementation combines both
return { ...baseRepo, checkOut, query } satisfies AssetRepository
```

### 2. Composition: Deployment Layers

| Layer | Provides | Use Case |
|-------|----------|----------|
| TestLayer | In-memory state | Fast unit tests |
| SqlTestLayer | SQLite + EventLog | Integration tests |
| makeTauriLayer(sql) | SQLite file persistence | Desktop app |
| makeClusterLayer(pg) | PostgreSQL + TimescaleDB + AGE | Production K8s |

### 3. API: Effect-Native Patterns

- `Effect.Service<>()()` with `dependencies` array for auto-wiring
- `Stream.Stream<T>` for progressive data consumption
- Repository interfaces with `satisfies` for type contracts
- `transformResultNames` for snake_case → camelCase

### 4. Scope: ISA-95 Equipment Hierarchy

```
Enterprise                    # Multi-site corporation
└── Site                      # Physical location
    └── Area                  # Sub-site zone
        └── Work Center       # Production Line
            └── Work Unit     # Machine/Work Cell
                └── Control Module  # Sensor/Actuator
```

**Graph Relationships:**
| Relationship | From | To |
|--------------|------|-----|
| [:contains] | Enterprise | Site |
| [:contains] | Site | Area |
| [:contains] | Area | Line |
| [:contains] | Line | Machine |
| [:monitors] | Sensor | Machine |
| [:controls] | Actuator | Machine |

**Branded Identifiers:**
- EnterpriseId, SiteId, AreaId, LineId, MachineId, DeviceId

### 5. Real-Time: Tiered Latency Model

| Tier | Latency | Source | Use Case |
|------|---------|--------|----------|
| Hot | < 1s | Direct hypertable | Alarms, threshold alerts |
| Warm | 1-60s | readings_1min aggregate | Dashboard gauges |
| Cold | > 60s | readings_1hour aggregate | Historical reports |

**Infrastructure:**
- TimescaleDB hypertables for time-series
- Continuous aggregates for dashboard performance
- Effect Stream for backpressure-aware consumption

### 6. Automation: ISA-95 Pyramid (L0-L4)

| Level | Name | Systems | TMNL Scope |
|-------|------|---------|------------|
| L4 | Business Planning | ERP, BI | Future integration |
| L3 | Manufacturing Ops | MES, MOM | **AMS v3** |
| L2 | Supervisory Control | SCADA, HMI | **IIoT Services** |
| L1 | Automation Control | PLC, DCS | Control Module schemas |
| L0 | Physical Process | Sensors | sensor_readings hypertable |

---

## Alignment History

### Round 1 (2026-01-29)
- Initial synthesis from research documents
- Identified AMS v2 vs IIoT gap
- Proposed 3-layer merge strategy

### Round 2 (2026-01-29)
- **Correction:** Hierarchy reprimanded to ISA-95 standard
- Added: Enterprise → Site → Area levels
- Mapped: Work Center = Line, Work Unit = Machine, Control Module = Sensor

### Round 3 (2026-01-29)
- Added: Real-Time tiered latency model (Hot/Warm/Cold)
- Added: Automation Levels (L0-L4 ISA-95 pyramid)
- **CONFIRMED** by user

---

## Implementation References

### Research Documents
- `thoughts/shared/research/ams-v2-repositories.md` - Repository pattern comparison
- `thoughts/shared/research/ams-v2-layers.md` - Layer composition analysis
- `thoughts/shared/research/iiot-services.md` - IIoT L1/L2/L3 architecture

### Key Files to Modify
- `src/lib/iiot/schemas/` - Add ISA-95 hierarchy schemas
- `src/lib/iiot/models/` - Add Enterprise, Site, Area models
- `docker/iiot-db/init.sql` - Add hierarchy tables and graph nodes
- `src/lib/ams/v2/base/layers/` - Template for v3 layer composition

### Skills Referenced
- `/iiot-isa95-hierarchy` - ISA-95 standard equipment hierarchy
- `/effect-service-authoring` - Effect.Service pattern
- `/effect-schema-mastery` - Schema.TaggedClass patterns
