# Entity System Specification

> **Canonical Source**: `thoughts/shared/specs/entity-system/`
> **Consolidated**: 2026-02-09
> **Status**: Draft (6 documents)

Complete ISA-95 entity system architecture for TMNL's IIoT domain. Covers entity naming, hierarchy paths, event models, storage architecture, and the full 10-entity catalog.

---

## Document Index

| File | Title | Description |
|------|-------|-------------|
| [00-unified-entity-system-spec.md](00-unified-entity-system-spec.md) | Unified Specification | All 5 sub-specs combined with implementation roadmap and appendices |
| [01-entity-base-naming.md](01-entity-base-naming.md) | Entity Base & Naming | Naming conventions, EntityContract interface, BaseAssetFields |
| [02-hierarchy-path.md](02-hierarchy-path.md) | Hierarchy Path | HierarchyPath data structure, algorithms, ISA-95 validation |
| [03-event-hierarchy.md](03-event-hierarchy.md) | Event Hierarchy | Three-category divergent event model (Structural/Operational/Temporal) |
| [04-storage-architecture.md](04-storage-architecture.md) | Storage Architecture | Dual-store design (EventLog + TimescaleDB), cross-store queries |
| [05-entity-catalog.md](05-entity-catalog.md) | Entity Catalog | Complete 10-entity ISA-95 catalog with field definitions |

---

## ISA-95 Equipment Hierarchy

```
Enterprise (L4)
  Site (L4)
    Area (L3)
      Plant (L3)
        Line (L2)
          WorkCell (L2)
            Machine (L1)
              Device (L0)
              Sensor (L0)
```

---

## Key Concepts

- **EntityContract**: Abstract interface with Schema/Model/DDL introspection
- **BaseAssetFields**: Shared fields spread into every entity schema
- **HierarchyPath**: O(1) depth, O(d) traversal with ISA-95 validation
- **Divergent Events**: Three separate base types (NOT a common root)
- **Dual Store**: EventLog for business events, TimescaleDB for time-series
- **Branded IDs**: `ENT-`, `SIT-`, `ARA-`, `PLT-`, `LIN-`, `WCL-`, `MCH-`, `SNS-`, `DEV-` prefixes
