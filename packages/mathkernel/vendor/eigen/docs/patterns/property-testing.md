# Pattern: Property-Based Testing with Effect Schema

> Derived from `thoughts/shared/handoffs/kraken-property-based-tests/current.md`
> Original date: 2026-01-31

## Overview

Property-based testing uses `Schema.Arbitrary` from Effect to generate random valid instances of domain schemas, then verifies structural properties hold for all generated values. The IIoT test suite has 137 property-based tests.

## Setup

```typescript
import { FastCheck as fc } from 'effect'
import { Arbitrary } from 'effect'
```

**Important**: Import `FastCheck` from `effect` (not `fast-check` directly). Effect v3.19+ bundles fast-check internally. Do NOT add `fast-check` to `package.json` devDependencies separately.

## Property Categories

### 1. Roundtrip (Encode/Decode)

Verify `decode(encode(x)) === x` for all valid instances:

```typescript
it.prop('roundtrip', Arbitrary.make(MySchema))((instance) => {
  const encoded = Schema.encodeSync(MySchema)(instance)
  const decoded = Schema.decodeSync(MySchema)(encoded)
  expect(decoded).toEqual(instance)
})
```

### 2. Idempotent Encoding

Verify `encode(decode(encode(x))) === encode(x)`:

```typescript
it.prop('idempotent', Arbitrary.make(MySchema))((instance) => {
  const encoded1 = Schema.encodeSync(MySchema)(instance)
  const decoded = Schema.decodeSync(MySchema)(encoded1)
  const encoded2 = Schema.encodeSync(MySchema)(decoded)
  expect(encoded2).toEqual(encoded1)
})
```

### 3. Type Invariants

Verify structural properties hold:

```typescript
it.prop('has _tag', Arbitrary.make(MyTaggedSchema))((instance) => {
  expect(instance._tag).toBe('MyTag')
  expect(typeof instance.id).toBe('string')
})
```

### 4. Bounds Checking

Verify constrained values stay in range:

```typescript
it.prop('quality in range', Arbitrary.make(QualityScore))((score) => {
  expect(score).toBeGreaterThanOrEqual(0)
  expect(score).toBeLessThanOrEqual(100)
})
```

### 5. State Machine Consistency

Verify methods produce consistent results:

```typescript
it.prop('OEE consistency', Arbitrary.make(EquipmentState))((state) => {
  if (state.isProductive()) {
    expect(['running']).toContain(state.status)
  }
})
```

## Coverage (IIoT Suite)

| Category | Count | Schemas |
|----------|-------|---------|
| Branded Identifiers | 14 | PlantId, LineId, SensorId, AlarmId, etc. |
| Pattern-Based IDs | 2 | EquipmentStateId, DeviceConfigId |
| Literal/Enum Schemas | 15 | AssetStatus, AlarmSeverity, WorkOrderStatus, etc. |
| Complex Entities | 10+ | Asset, Alarm, SensorReading, WorkOrder, etc. |

## Discovered Issue

Property-based testing discovered that `Asset.getAutomationLevel()` doesn't handle all `EquipmentLevel` values:
- **Handled**: enterprise, site, area, line, machine, sensor
- **Not handled**: plant, workcell, device

Returns `undefined` for unhandled cases.

## See Also

- `src/lib/iiot/__tests__/schemas/property-based.test.ts` -- 137 tests
- Effect docs on `Schema.Arbitrary`
