# Schema Patterns

## Overview

All domain types in the IIoT v3 architecture are defined using **Effect Schema** — no raw TypeScript interfaces or type aliases for domain models. This provides:

- **Runtime validation** — schemas validate data at system boundaries
- **Encode/decode transformations** — null-to-Option, string-to-DateTime, etc.
- **JSON Schema generation** — `JSONSchema.make()` for API documentation and AI SDK integration
- **EventLog integration** — Schema-backed payloads for event sourcing

## Branded Identifiers

Every entity has a branded identifier that is compile-time distinct. IDs follow a prefix convention:

```typescript
// src/lib/iiot/schemas/assets/site/schema.ts

export const SiteId = Schema.String.pipe(
  Schema.pattern(/^SIT-[a-zA-Z0-9-]+$/),
  Schema.brand('SiteId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/SiteId',
    description: 'Site identifier with SIT- prefix and slug',
  })
)
export type SiteId = typeof SiteId.Type
```

Each ID type has a factory function:

```typescript
export const makeSiteId = (slug: string): SiteId => `SIT-${slug}` as SiteId
```

**ID Prefix Convention:**

| Entity | Prefix | Example |
|--------|--------|---------|
| Enterprise | `ENT-` | `ENT-acme-corp` |
| Site | `SIT-` | `SIT-chicago-main` |
| Area | `ARA-` | `ARA-assembly-zone` |
| Plant | `PLT-` | `PLT-north-wing` |
| Line | `LIN-` | `LIN-bottling-1` |
| WorkCell | `WCL-` | `WCL-station-3` |
| Machine | `MCH-` | `MCH-cnc-mill-01` |
| Device | `DEV-` | `DEV-plc-01` |
| Sensor | `SNS-` | `SNS-temp-probe-1` |

## Schema.TaggedClass Pattern

Domain entities use `Schema.TaggedClass` — a schema class that carries a discriminant `_tag` field and can have instance methods:

```typescript
// src/lib/iiot/schemas/assets/site/schema.ts

export class Site extends Schema.TaggedClass<Site>()('Site', {
  id: SiteId,
  ...BaseAssetFields,                // Spread common fields
  status: SiteStatus,                // Domain-specific override
  enterpriseId: EnterpriseId,        // Required parent FK

  // Site-specific fields
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),
  city: Schema.optionalWith(Schema.String, { as: 'Option' }),
  timezone: Schema.String,
}) {
  // Instance methods — available on decoded instances
  getAutomationLevel(): 3 { return 3 }
  isOperational(): boolean {
    return this.status === 'operational' || this.status === 'seasonal_shutdown'
  }
  isContainer(): true { return true }
  materializePath(): string {
    return this.hierarchyPath.toString()
  }
}
```

Key points:
- The `'Site'` string is the `_tag` discriminant for this schema
- `Schema.optionalWith(..., { as: 'Option' })` makes the field `Option<T>` in the decoded type
- Spread syntax (`...BaseAssetFields`) merges shared fields
- Instance methods are available after decoding

## Schema.Literal for Enums

Status fields and other enumerated values use `Schema.Literal`:

```typescript
// src/lib/iiot/schemas/assets/site/schema.ts

export const SiteStatus = Schema.Literal(
  'planned',
  'under_construction',
  'operational',
  'seasonal_shutdown',
  'closed',
  'decommissioned'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/SiteStatus',
    description: 'Site lifecycle state per ISA-95 site graph',
  })
)
export type SiteStatus = typeof SiteStatus.Type
```

Each asset type has its own domain-specific status enum rather than a shared generic one:

```typescript
// Generic (shared baseline)
export const AssetStatus = Schema.Literal('active', 'inactive', 'maintenance', 'decommissioned')

// Domain-specific (overrides generic in each schema)
export const SiteStatus = Schema.Literal('planned', 'under_construction', 'operational', ...)
export const PlantStatus = Schema.Literal('planned', 'commissioning', 'operational', ...)
```

## Shared Base Fields

Common fields are defined once and spread into entity schemas:

```typescript
// src/lib/iiot/schemas/assets/common/types.ts

export const AssetLocation = Schema.TaggedClass<AssetLocation>()('AssetLocation', {
  latitude: Schema.optionalWith(Schema.Number.pipe(Schema.between(-90, 90)), { as: 'Option' }),
  longitude: Schema.optionalWith(Schema.Number.pipe(Schema.between(-180, 180)), { as: 'Option' }),
  building: Schema.optionalWith(Schema.String, { as: 'Option' }),
  floor: Schema.optionalWith(Schema.String, { as: 'Option' }),
  zone: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

export const AssetMetadata = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})

export const BaseAssetFields = {
  name: Schema.NonEmptyString,
  status: AssetStatus,
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  location: Schema.optionalWith(AssetLocation, { as: 'Option' }),
  metadata: AssetMetadata,
  hierarchyPath: HierarchyPath,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  // Parent ID slots (optional, filled based on hierarchy level)
  enterpriseId: Schema.optionalWith(EnterpriseId, { as: 'Option' }),
  siteId: Schema.optionalWith(SiteId, { as: 'Option' }),
  areaId: Schema.optionalWith(AreaId, { as: 'Option' }),
  plantId: Schema.optionalWith(PlantId, { as: 'Option' }),
  lineId: Schema.optionalWith(LineId, { as: 'Option' }),
  workCellId: Schema.optionalWith(WorkCellId, { as: 'Option' }),
  machineId: Schema.optionalWith(MachineId, { as: 'Option' }),
}
```

Individual schemas override fields they need to specialize:

```typescript
export class Site extends Schema.TaggedClass<Site>()('Site', {
  id: SiteId,
  ...BaseAssetFields,
  status: SiteStatus,                    // Override generic AssetStatus
  enterpriseId: EnterpriseId,            // Override optional -> required
  timezone: Schema.String,               // Site-specific addition
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
```

## Schema.TaggedError for RPC Errors

RPC errors use `Schema.TaggedError` for type-safe, serializable error responses:

```typescript
// src/lib/iiot/entity/AlarmEntity.ts

export class RpcAlarmNotFoundError extends Schema.TaggedError<RpcAlarmNotFoundError>()(
  'RpcAlarmNotFoundError',
  { alarmId: AlarmId }
) {}

export class RpcAlarmTransitionError extends Schema.TaggedError<RpcAlarmTransitionError>()(
  'RpcAlarmTransitionError',
  { alarmId: AlarmId, message: Schema.String }
) {}
```

RPCs reference these errors in their error channel:

```typescript
export class AcknowledgeAlarmRpc extends Rpc.make(AlarmAcknowledgeTag, {
  payload: AcknowledgeAlarmParams,
  primaryKey: ({ alarmId }) => alarmId,
  success: Alarm,
  error: Schema.Union(RpcAlarmNotFoundError, RpcAlarmAlreadyAcknowledgedError),
}) {}
```

## Command Schemas (Create/Update Params)

Each entity defines separate schemas for create and update operations:

```typescript
// Create: required fields + optional overrides
export const CreateSiteParams = Schema.Struct({
  slug: Schema.String.pipe(Schema.pattern(/^[a-zA-Z0-9-]+$/)),
  name: Schema.NonEmptyString,
  enterpriseId: EnterpriseId,
  timezone: Schema.String,
  status: Schema.optionalWith(SiteStatus, { as: 'Option' }),
  address: Schema.optional(Schema.String),
  // ...
})

// Update: all fields optional except ID
export const UpdateSiteParams = Schema.Struct({
  id: SiteId,                                                    // Required: which entity
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  status: Schema.optionalWith(SiteStatus, { as: 'Option' }),
  // ...
})
```

## Event Schemas (for ES Domains)

Event-sourced domains define their events as tagged schemas:

```typescript
export class ReadingEvent extends Schema.TaggedClass<ReadingEvent>()('ReadingEvent', {
  topic: Schema.String,
  value: Schema.Number,
  timestamp: Schema.String,
  deviceId: Schema.String,
}) {}

export class AlarmEvent extends Schema.TaggedClass<AlarmEvent>()('AlarmEvent', {
  alarmId: Schema.String,
  severity: Schema.String,
  deviceId: Schema.String,
  message: Schema.String,
  timestamp: Schema.String,
}) {}
```

## Schema Composition Rules

1. **Always use branded IDs** — `Schema.String.pipe(Schema.brand('XxxId'))` — never plain strings
2. **Optional fields use `Schema.optionalWith(..., { as: 'Option' })`** — decoded as `Option<T>`, not `T | undefined`
3. **Annotations are mandatory** — `identifier` and `description` on all public schemas
4. **Domain-specific status enums** — each asset type overrides the generic `AssetStatus`
5. **Spread `BaseAssetFields`** — don't duplicate common fields
6. **TaggedError for RPC errors** — serializable across the wire
7. **Separate Create/Update params** — never reuse the entity schema for commands

---

## Agent Quick Reference

### Key Imports

```typescript
import { Schema, JSONSchema } from 'effect'
```

### Minimal Example

```typescript
// Branded ID
const SiteId = Schema.String.pipe(
  Schema.pattern(/^SIT-[a-zA-Z0-9-]+$/),
  Schema.brand('SiteId')
)
type SiteId = typeof SiteId.Type

// Status enum
const SiteStatus = Schema.Literal('planned', 'operational', 'closed')

// Entity schema
class Site extends Schema.TaggedClass<Site>()('Site', {
  id: SiteId,
  name: Schema.NonEmptyString,
  status: SiteStatus,
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  isOperational(): boolean { return this.status === 'operational' }
}

// RPC error
class RpcNotFoundError extends Schema.TaggedError<RpcNotFoundError>()(
  'RpcNotFoundError',
  { id: Schema.String }
) {}
```

### Common Pitfalls

- Using plain `string` instead of branded IDs -- loses compile-time type safety between entity IDs
- Using `Schema.optional(T)` instead of `Schema.optionalWith(T, { as: 'Option' })` -- decoded type is `T | undefined` instead of `Option<T>`
- Reusing entity schema for create/update params -- entity has `_tag`, `createdAt`, etc. that don't belong in commands
- Using a shared generic `AssetStatus` -- each asset type has domain-specific lifecycle states
- Forgetting `Schema.annotations()` on public schemas -- breaks JSONSchema generation and documentation
- Duplicating `BaseAssetFields` instead of spreading -- drift between entity schemas over time

### Cross-References

- [entities.md](./entities.md) -- Entity.make() uses these schemas for RPC payload/success/error
- [repositories.md](./repositories.md) -- Model types bridge to these schemas via Layer composition
- [effect-errors.md](./effect-errors.md) -- Schema.TaggedError for typed error handling
- [effect-core.md](./effect-core.md) -- Schema fundamentals and Atom-as-State doctrine
