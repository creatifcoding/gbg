# Entity System Spec: Base Classes & Naming Convention

**Spec ID:** `entity-system/01-entity-base-naming`
**Created:** 2026-01-30
**Status:** DRAFT
**Author:** architect-agent

---

## Overview

This specification defines the naming convention, abstract entity contract, and base field composition for all ISA-95 equipment hierarchy entities. It establishes the foundational patterns that all concrete entity classes must follow.

---

## 1. Naming Convention

### 1.1 TaggedClass Postfix Rule

All Effect Schema `TaggedClass` definitions receive the `Schema` postfix to distinguish them from other artifacts:

| Artifact Type | Naming Pattern | Example |
|---------------|----------------|---------|
| Schema (TaggedClass) | `{Entity}Schema` | `EnterpriseSchema`, `PlantSchema`, `LineSchema` |
| Model (Persistence) | `{Entity}Model` | `EnterpriseModel`, `PlantModel`, `LineModel` |
| DDL (SQL) | `{Entity}DDL` | `EnterpriseDDL`, `PlantDDL`, `LineDDL` |
| Type (Inferred) | `{Entity}` | `Enterprise`, `Plant`, `Line` |

### 1.2 Namespace Pattern

Each entity exports a namespace containing all related artifacts:

```typescript
// src/lib/iiot/schemas/enterprise.ts

export const EnterpriseSchema = Schema.TaggedClass<EnterpriseSchema>()('Enterprise', { ... })
export type Enterprise = Schema.Schema.Type<typeof EnterpriseSchema>

export namespace Enterprise {
  export const Schema = EnterpriseSchema
  export type Model = typeof EnterpriseModel.Type
  export const DDL = `CREATE TABLE enterprises (...)`
  export type Type = Enterprise
}
```

### 1.3 Export Strategy

Statics are exported separately for tree-shaking:

```typescript
// Named exports for tree-shaking
export { EnterpriseSchema, EnterpriseModel, EnterpriseDDL }

// Namespace export for convenience
export { Enterprise }

// Type export
export type { Enterprise }
```

### 1.4 Complete Naming Table

| Equipment Level | Schema Class | Model Class | DDL Constant | Type Alias |
|-----------------|--------------|-------------|--------------|------------|
| Enterprise | `EnterpriseSchema` | `EnterpriseModel` | `EnterpriseDDL` | `Enterprise` |
| Site | `SiteSchema` | `SiteModel` | `SiteDDL` | `Site` |
| Area | `AreaSchema` | `AreaModel` | `AreaDDL` | `Area` |
| Plant | `PlantSchema` | `PlantModel` | `PlantDDL` | `Plant` |
| Line | `LineSchema` | `LineModel` | `LineDDL` | `Line` |
| Machine | `MachineSchema` | `MachineModel` | `MachineDDL` | `Machine` |
| Sensor | `SensorSchema` | `SensorModel` | `SensorDDL` | `Sensor` |
| Device | `DeviceSchema` | `DeviceModel` | `DeviceDDL` | `Device` |

---

## 2. Abstract Entity Contract

### 2.1 Purpose

All equipment hierarchy entities must satisfy a common contract for:
- Operational status queries
- Automation level mapping (ISA-95 L0-L4)
- Hierarchy path materialization
- Lifecycle hooks with Effect integration

### 2.2 Abstract Entity Interface

```typescript
// src/lib/iiot/schemas/entity-contract.ts

import { Effect, Schema } from 'effect'
import type { EntityError, ValidationError } from './errors'

/**
 * Abstract contract for all ISA-95 equipment entities.
 * 
 * Concrete entities (EnterpriseSchema, PlantSchema, etc.) must implement
 * all abstract methods. The contract enforces:
 * 
 * 1. Schema introspection (Schema, Model, DDL)
 * 2. Operational queries (isOperational, getAutomationLevel)
 * 3. Hierarchy navigation (materializePath)
 * 4. Lifecycle hooks (onCreate, onUpdate, validate)
 */
export interface EntityContract<
  TSchema extends Schema.Schema.Any,
  TModel,
  TDeps = never
> {
  // ─────────────────────────────────────────────────────────────────────────
  // Schema Introspection (Static)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** The Effect Schema definition */
  readonly Schema: TSchema
  
  /** The persistence Model class */
  readonly Model: TModel
  
  /** DDL for table creation */
  readonly DDL: string

  // ─────────────────────────────────────────────────────────────────────────
  // Operational Methods (Instance)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Check if entity is operational (not in maintenance or decommissioned).
   * Used for filtering active equipment in queries.
   */
  isOperational(): boolean

  /**
   * Get ISA-95 automation level.
   * 
   * | Level | Name | Examples |
   * |-------|------|----------|
   * | 4 | Business Planning | Enterprise (ERP) |
   * | 3 | Manufacturing Ops | Site, Area (MES/MOM) |
   * | 2 | Supervisory Control | Plant, Line (SCADA) |
   * | 1 | Automation Control | Machine (PLC/DCS) |
   * | 0 | Physical Process | Sensor, Device |
   */
  getAutomationLevel(): 0 | 1 | 2 | 3 | 4

  /**
   * Materialize the full hierarchy path from root to this entity.
   * 
   * @example
   * // For a machine: "/enterprises/acme/sites/chicago/areas/assembly/lines/line-1/machines/mch-001"
   * machine.materializePath()
   */
  materializePath(): string

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle Hooks (Effect-Native)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Called after entity creation.
   * Use for: audit logging, event emission, graph edge creation.
   */
  onCreate(): Effect.Effect<void, EntityError, TDeps>

  /**
   * Called after entity update.
   * Use for: audit logging, event emission, cache invalidation.
   */
  onUpdate(): Effect.Effect<void, EntityError, TDeps>

  /**
   * Validate entity state beyond schema constraints.
   * Use for: business rules, cross-field validation, referential integrity.
   * 
   * @note This is called automatically by Schema.decode filters.
   */
  validate(): Effect.Effect<void, ValidationError, never>
}
```

### 2.3 Automation Level Mapping

Each equipment level maps to a specific ISA-95 automation level:

```typescript
// src/lib/iiot/schemas/automation-levels.ts

import { Schema } from 'effect'
import type { EquipmentLevel } from './identifiers'

/**
 * ISA-95 Automation Pyramid Level
 */
export type AutomationLevel = 0 | 1 | 2 | 3 | 4

/**
 * Map equipment level to automation level.
 */
export const getAutomationLevelForEquipment = (kind: EquipmentLevel): AutomationLevel => {
  switch (kind) {
    case 'enterprise': return 4  // L4: Business Planning
    case 'site':       return 3  // L3: Manufacturing Ops (MES)
    case 'area':       return 3  // L3: Manufacturing Ops (MES)
    case 'line':       return 2  // L2: Supervisory Control (SCADA)
    case 'machine':    return 1  // L1: Automation Control (PLC)
    case 'sensor':     return 0  // L0: Physical Process
  }
}

/**
 * Automation level metadata
 */
export const AUTOMATION_LEVELS: Record<AutomationLevel, {
  name: string
  systems: string[]
  tmnlScope: string
}> = {
  4: { name: 'Business Planning', systems: ['ERP', 'BI'], tmnlScope: 'Future integration' },
  3: { name: 'Manufacturing Ops', systems: ['MES', 'MOM'], tmnlScope: 'AMS v3' },
  2: { name: 'Supervisory Control', systems: ['SCADA', 'HMI'], tmnlScope: 'IIoT Services' },
  1: { name: 'Automation Control', systems: ['PLC', 'DCS'], tmnlScope: 'Control Module schemas' },
  0: { name: 'Physical Process', systems: ['Sensors', 'Actuators'], tmnlScope: 'sensor_readings hypertable' },
}
```

---

## 3. Base Asset Fields

### 3.1 Purpose

All equipment entities share common fields. These are extracted into a spreadable object for DRY composition.

### 3.2 BaseAssetFields Definition

```typescript
// src/lib/iiot/schemas/base-fields.ts

import { Schema } from 'effect'
import {
  AssetStatus,
  AssetLocation,
  AssetMetadata,
  HierarchyPath,
  EnterpriseId,
  SiteId,
  AreaId,
  PlantId,
  LineId,
  MachineId,
} from './identifiers'

/**
 * Common fields spread into all equipment TaggedClasses.
 * 
 * Usage:
 * ```typescript
 * export class PlantSchema extends Schema.TaggedClass<PlantSchema>()('Plant', {
 *   id: PlantId,
 *   ...BaseAssetFields,
 *   // Plant-specific fields
 *   capacity: Schema.Number,
 * }) {}
 * ```
 */
export const BaseAssetFields = {
  // ─────────────────────────────────────────────────────────────────────────
  // Core Identity
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Human-readable name (required) */
  name: Schema.NonEmptyString,
  
  /** Operational status */
  status: AssetStatus,
  
  /** Optional description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  // ─────────────────────────────────────────────────────────────────────────
  // Location & Metadata
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Physical location information */
  location: Schema.optionalWith(AssetLocation, { as: 'Option' }),
  
  /** Extensible metadata (JSONB in DB) */
  metadata: Schema.optionalWith(AssetMetadata, { default: () => ({}) }),

  // ─────────────────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Creation timestamp (set by system) */
  createdAt: Schema.DateTimeUtc,
  
  /** Last update timestamp (optional) */
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  // ─────────────────────────────────────────────────────────────────────────
  // Hierarchy (New Fields)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Materialized path for efficient hierarchy queries.
   * Format: "/enterprises/{id}/sites/{id}/areas/{id}/..."
   * 
   * @see HierarchyPath schema with format validation
   */
  hierarchyPath: HierarchyPath,

  /**
   * Parent entity references (optional based on level).
   * 
   * These enable:
   * 1. Type-safe parent lookups
   * 2. Foreign key constraints in DDL
   * 3. Path consistency validation
   */
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  areaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  plantId: Schema.optionalWith(PlantId, { as: 'Option' }),
  lineId: Schema.optionalWith(LineId, { as: 'Option' }),
  machineId: Schema.optionalWith(MachineId, { as: 'Option' }),
} as const
```

### 3.3 HierarchyPath Schema

```typescript
// src/lib/iiot/schemas/hierarchy-path.ts

import { Schema } from 'effect'

/**
 * Materialized hierarchy path pattern.
 * 
 * Valid formats:
 * - "/enterprises/{id}"
 * - "/enterprises/{id}/sites/{id}"
 * - "/enterprises/{id}/sites/{id}/areas/{id}"
 * - etc.
 */
const HIERARCHY_PATH_PATTERN = /^\/enterprises\/[\w-]+(\/sites\/[\w-]+(\/areas\/[\w-]+(\/lines\/[\w-]+(\/machines\/[\w-]+(\/sensors\/[\w-]+)?)?)?)?)?$/

export const HierarchyPath = Schema.String.pipe(
  Schema.pattern(HIERARCHY_PATH_PATTERN),
  Schema.brand('HierarchyPath'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/HierarchyPath',
    description: 'Materialized path in equipment hierarchy',
    examples: [
      '/enterprises/acme',
      '/enterprises/acme/sites/chicago',
      '/enterprises/acme/sites/chicago/areas/assembly/lines/line-1',
    ],
  })
)
export type HierarchyPath = Schema.Schema.Type<typeof HierarchyPath>

/**
 * Parse hierarchy path into components.
 */
export const parseHierarchyPath = (path: HierarchyPath): {
  enterpriseId?: string
  siteId?: string
  areaId?: string
  lineId?: string
  machineId?: string
  sensorId?: string
} => {
  const parts = path.split('/').filter(Boolean)
  const result: Record<string, string> = {}
  
  for (let i = 0; i < parts.length; i += 2) {
    const key = parts[i]
    const value = parts[i + 1]
    if (key && value) {
      // "enterprises" -> "enterpriseId"
      result[`${key.slice(0, -1)}Id`] = value
    }
  }
  
  return result
}
```

---

## 4. Validation: Defense in Depth

### 4.1 Three-Layer Validation

| Layer | Mechanism | Validates | Failure Mode |
|-------|-----------|-----------|--------------|
| Compile-time | TypeScript types | Field presence, basic types | Red squiggles |
| Schema.decode | Effect Schema filters | Path consistency, business rules | `ParseError` |
| DDL | Foreign key constraints | Referential integrity | DB error |

### 4.2 Schema Filter Example

```typescript
// Validate hierarchyPath matches parent ID fields
const validatePathConsistency = Schema.filter(
  (entity: { hierarchyPath: string; enterpriseId?: string; siteId?: string }) => {
    const parsed = parseHierarchyPath(entity.hierarchyPath as HierarchyPath)
    
    // If enterpriseId is set, it must match path
    if (entity.enterpriseId && parsed.enterpriseId !== entity.enterpriseId) {
      return false
    }
    if (entity.siteId && parsed.siteId !== entity.siteId) {
      return false
    }
    
    return true
  },
  { message: () => 'hierarchyPath must match parent ID fields' }
)
```

---

## 5. Concrete Entity Example: PlantSchema

### 5.1 Full Implementation

```typescript
// src/lib/iiot/schemas/plant.ts

import { Effect, Schema, Option } from 'effect'
import { BaseAssetFields } from './base-fields'
import { PlantId, SiteId, EnterpriseId, HierarchyPath, parseHierarchyPath } from './identifiers'
import { AssetStatus } from './status'
import { getAutomationLevelForEquipment, type AutomationLevel } from './automation-levels'
import type { EntityContract } from './entity-contract'
import type { EntityError, ValidationError } from './errors'

// ─────────────────────────────────────────────────────────────────────────────
// Schema Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plant Schema (ISA-95 Site level, simplified as "Plant")
 * 
 * Represents a physical manufacturing facility.
 * Maps to ISA-95 "Site" in full hierarchy.
 */
export class PlantSchema extends Schema.TaggedClass<PlantSchema>()('Plant', {
  /** Unique plant identifier */
  id: PlantId,
  
  /** Spread common fields */
  ...BaseAssetFields,
  
  // ─────────────────────────────────────────────────────────────────────────
  // Plant-Specific Fields
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Maximum production capacity (units/hour) */
  capacity: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { as: 'Option' }),
  
  /** Shift schedule type */
  shiftSchedule: Schema.optionalWith(
    Schema.Literal('single', 'double', 'triple', 'continuous'),
    { as: 'Option' }
  ),
  
  /** Required: Parent site (for full ISA-95) or enterprise (simplified) */
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  enterpriseId: EnterpriseId, // Required - every plant belongs to an enterprise
}) {
  // ─────────────────────────────────────────────────────────────────────────
  // EntityContract Implementation
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Check if plant is operational (active or inactive, not maintenance/decommissioned)
   */
  isOperational(): boolean {
    return this.status !== 'maintenance' && this.status !== 'decommissioned'
  }
  
  /**
   * Plant maps to L2/L3 depending on context.
   * Default to L3 (Manufacturing Ops scope).
   */
  getAutomationLevel(): AutomationLevel {
    return 3 // L3: Manufacturing Operations (MES/MOM scope)
  }
  
  /**
   * Build hierarchy path from root.
   */
  materializePath(): string {
    return `/enterprises/${this.enterpriseId}/plants/${this.id}`
  }
  
  /**
   * Lifecycle: onCreate hook
   */
  onCreate(): Effect.Effect<void, EntityError, never> {
    return Effect.gen(function* () {
      // TODO: Emit Plant.Created event
      // TODO: Create [:contains] edge in graph: Enterprise -> Plant
      yield* Effect.log(`Plant created: ${this.id}`)
    })
  }
  
  /**
   * Lifecycle: onUpdate hook
   */
  onUpdate(): Effect.Effect<void, EntityError, never> {
    return Effect.gen(function* () {
      // TODO: Emit Plant.Updated event
      // TODO: Invalidate caches
      yield* Effect.log(`Plant updated: ${this.id}`)
    })
  }
  
  /**
   * Business rule validation beyond schema constraints.
   */
  validate(): Effect.Effect<void, ValidationError, never> {
    return Effect.gen(function* () {
      // Validate path consistency
      const parsed = parseHierarchyPath(this.hierarchyPath)
      
      if (parsed.enterpriseId !== this.enterpriseId) {
        yield* Effect.fail({
          _tag: 'ValidationError',
          message: `hierarchyPath enterprise "${parsed.enterpriseId}" does not match enterpriseId "${this.enterpriseId}"`,
          field: 'hierarchyPath',
        })
      }
      
      if (Option.isSome(this.siteId) && parsed.siteId !== Option.getOrNull(this.siteId)) {
        yield* Effect.fail({
          _tag: 'ValidationError',
          message: `hierarchyPath site does not match siteId`,
          field: 'hierarchyPath',
        })
      }
    })
  }
}

/** Inferred Plant type */
export type Plant = Schema.Schema.Type<typeof PlantSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Namespace Export
// ─────────────────────────────────────────────────────────────────────────────

export namespace Plant {
  export const Schema = PlantSchema
  export type Type = Plant
  
  // Model will be defined in models/plant.ts
  // export const Model = PlantModel
  
  export const DDL = `
    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
      description TEXT,
      location JSONB,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ,
      hierarchy_path TEXT NOT NULL,
      enterprise_id TEXT NOT NULL REFERENCES enterprises(id),
      site_id TEXT REFERENCES sites(id),
      capacity NUMERIC,
      shift_schedule TEXT CHECK (shift_schedule IN ('single', 'double', 'triple', 'continuous'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_plants_enterprise ON plants(enterprise_id);
    CREATE INDEX IF NOT EXISTS idx_plants_hierarchy ON plants USING GIST (hierarchy_path gist_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_plants_status ON plants(status);
  ` as const
}
```

---

## 6. Export Pattern

### 6.1 Barrel Export (index.ts)

```typescript
// src/lib/iiot/schemas/index.ts

// ─────────────────────────────────────────────────────────────────────────────
// Base & Contracts
// ─────────────────────────────────────────────────────────────────────────────
export { BaseAssetFields } from './base-fields'
export type { EntityContract } from './entity-contract'
export { getAutomationLevelForEquipment, AUTOMATION_LEVELS } from './automation-levels'
export type { AutomationLevel } from './automation-levels'
export { HierarchyPath, parseHierarchyPath } from './hierarchy-path'

// ─────────────────────────────────────────────────────────────────────────────
// Identifiers
// ─────────────────────────────────────────────────────────────────────────────
export {
  EnterpriseId,
  SiteId,
  AreaId,
  PlantId,
  LineId,
  MachineId,
  DeviceId,
  AssetId,
  EquipmentLevel,
} from './identifiers'
export type {
  EnterpriseId,
  SiteId,
  AreaId,
  PlantId,
  LineId,
  MachineId,
  DeviceId,
  AssetId,
  EquipmentLevel,
} from './identifiers'

// ─────────────────────────────────────────────────────────────────────────────
// Entity Schemas (Named exports for tree-shaking)
// ─────────────────────────────────────────────────────────────────────────────
export { EnterpriseSchema, Enterprise } from './enterprise'
export { SiteSchema, Site } from './site'
export { AreaSchema, Area } from './area'
export { PlantSchema, Plant } from './plant'
export { LineSchema, Line } from './line'
export { MachineSchema, Machine } from './machine'
export { SensorSchema, Sensor } from './sensor'
export { DeviceSchema, Device } from './device'

// ─────────────────────────────────────────────────────────────────────────────
// Types (Re-export for convenience)
// ─────────────────────────────────────────────────────────────────────────────
export type { Enterprise } from './enterprise'
export type { Site } from './site'
export type { Area } from './area'
export type { Plant } from './plant'
export type { Line } from './line'
export type { Machine } from './machine'
export type { Sensor } from './sensor'
export type { Device } from './device'
```

---

## 7. Implementation Checklist

- [ ] Create `src/lib/iiot/schemas/entity-contract.ts`
- [ ] Create `src/lib/iiot/schemas/automation-levels.ts`
- [ ] Create `src/lib/iiot/schemas/base-fields.ts`
- [ ] Create `src/lib/iiot/schemas/hierarchy-path.ts`
- [ ] Refactor `assets.ts` to use new patterns
- [ ] Create individual entity files: `enterprise.ts`, `site.ts`, `area.ts`, `plant.ts`, `line.ts`, `machine.ts`, `sensor.ts`
- [ ] Update `index.ts` barrel exports
- [ ] Add tests for HierarchyPath parsing and validation

---

## 8. Open Questions

1. **Plant vs Site naming**: Should we use ISA-95 "Site" terminology or keep "Plant" for familiarity?
   - **Decision**: Support both. `PlantSchema` is alias for simplified hierarchy; `SiteSchema` for full ISA-95.

2. **Optional vs Required parent IDs**: Should `enterpriseId` always be required even for Enterprise entity?
   - **Decision**: Required for all non-root entities. Enterprise has no parent.

3. **Lifecycle hook dependencies**: What services should lifecycle hooks require?
   - **Decision**: Define in next spec (entity-system/02-lifecycle-hooks.md).

---

## References

- **Alignment**: `thoughts/shared/alignments/2026-01-29-iiot-ams-v3-convergence.md`
- **Prior Art**: `src/lib/iiot/schemas/assets.ts` (polymorphic Asset approach)
- **ISA-95 Standard**: IEC 62264 Equipment Hierarchy
- **Effect Schema**: `@effect/schema` TaggedClass patterns
