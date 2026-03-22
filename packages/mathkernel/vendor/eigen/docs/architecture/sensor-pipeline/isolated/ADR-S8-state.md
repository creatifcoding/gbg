---
id: "S8"
title: "State Stage — Atom Architecture & Registry Patterns"
commitHash: "6656064"
status: "draft"
date: "2026-01-02"
tier: "isolated"
stages: ["S8"]
---

# ADR-S8: State Stage — Atom Architecture & Registry Patterns

## Context

### Stages Covered
- S8 (State)

### Problem

Sensor telemetry arriving from S7 (Filtering) must be normalized into reactive state that supports:

1. **Multiple consumers** — React components, derived computations, persistence hooks, debug panels
2. **Derived values** — Rolling averages, min/max over windows, cross-sensor correlations
3. **Graceful error handling** — Network failures, validation errors, service interruptions must be observable
4. **Time-travel debugging** — State snapshots, replay, undo/redo for development
5. **Lifecycle tracking** — Distinguish between "waiting for first data" vs "last value stale" vs "stream failed"
6. **Type safety** — Schema-validated payloads, discriminated unions for state transitions

The state layer is the **boundary between reactive data flow and imperative React** — bugs here manifest as stale UI, missed updates, or race conditions.

### Constraints

- **Atom-as-State doctrine** — effect-atom is the primary state primitive (see `/src/lib/cursor/atoms/index.tsx`)
- **No useState for cross-component state** — Module-level atoms only, never atoms inside render
- **Result pattern mandatory** — All async state uses `Initial | Waiting | Success | Failure` discriminated union
- **Module-level atom definitions** — Stable references, never recreated on re-render
- **Effect.Service integration** — Atoms mutated via `ctx.set()` in Effect operations
- **Registry pattern** — Shared registries prevent context shadowing (see `/src/lib/dataplane/atoms/index.ts`)
- **Schema validation** — Effect Schema for all domain types (runtime validation + type inference)

### Assumptions

- Sensor IDs are stable UUIDs (no dynamic registration/deregistration mid-stream)
- Data rate is 1-100Hz per sensor (suitable for atom updates, not 10kHz DAQ)
- Derived computations are synchronous (<1ms execution time)
- Browser tab remains active (no offline buffering in S8, deferred to persistence)
- Memory usage scales linearly with active sensor count (<10MB for 1000 sensors)
- Window aggregations use fixed-size ring buffers (FIFO, no unbounded arrays)

## Decision

### Summary

Use **Atom.family** for per-sensor state keyed by sensorId, wrapping all async state in **Result<T, E>** discriminated unions. Define atoms at module-level with **Registry.make()** for shared subscriptions. Implement derived atoms for window aggregations (min/max/avg) using synchronous computations. Integrate with Effect runtime via **Atom.runtime()** for service-layer mutations.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| effect-atom | latest | Reactive state primitive | `/src/lib/cursor/atoms/index.tsx` (pattern) |
| @effect/schema | latest | Schema validation, Result types | `/src/lib/dataplane/atoms/index.ts` (usage) |
| Effect.Service | latest | Service layer for async ops | `/src/lib/dataplane/services/DataplaneService` |
| Atom.family | latest | Keyed atom creation (per-sensor) | `/src/lib/dataplane/atoms/index.ts` (family pattern) |
| Registry | latest | Shared state container | `/src/lib/dataplane/atoms/index.ts` (registry) |

### Patterns

- **Atom.family for Sensor Data**:
  ```typescript
  import { Atom } from '@effect-atom/atom'
  import { Schema } from '@effect/schema'

  // Schema-validated sensor reading
  class SensorReading extends Schema.Class<SensorReading>('SensorReading')({
    sensorId: Schema.String.pipe(Schema.brand('SensorId')),
    timestamp: Schema.Number, // Unix epoch ms
    value: Schema.Number,
    unit: Schema.String,
  }) {}

  // Result type for lifecycle states
  type SensorState =
    | { _tag: 'Initial' }  // Never received data
    | { _tag: 'Waiting' }  // Subscribed, awaiting first message
    | { _tag: 'Success'; data: SensorReading }  // Healthy
    | { _tag: 'Failure'; error: TransportError }  // Stream failed

  // Family atom (keyed by sensorId)
  export const sensorAtom = Atom.family((id: string) =>
    Atom.make<SensorState>({ _tag: 'Initial' })
  )
  ```

- **Result Pattern** (discriminated union for async state):
  - **Initial**: Never subscribed, no data attempted
  - **Waiting**: Subscription active, awaiting first message
  - **Success**: Latest valid reading available
  - **Failure**: Stream error (transport failure, validation failure, timeout)

  Pattern matching via Effect.Match:
  ```typescript
  import * as Match from 'effect/Match'

  const renderStatus = Match.value(state).pipe(
    Match.tag('Initial', () => 'Not started'),
    Match.tag('Waiting', () => 'Loading...'),
    Match.tag('Success', ({ data }) => `${data.value} ${data.unit}`),
    Match.tag('Failure', ({ error }) => `Error: ${error.message}`),
    Match.exhaustive
  )
  ```

- **Registry Pattern** (module-level singleton):
  ```typescript
  import { Registry } from '@effect-atom/atom'

  // Shared registry (prevents context shadowing)
  export const sensorRegistry = Registry.make()

  // Mount atoms on registry at module load time
  sensorRegistry.mount(dataplaneRuntimeAtom)

  // Sync mutations (direct registry access)
  sensorRegistry.set(sensorAtom('temp-01'), { _tag: 'Waiting' })

  // Effect mutations (via ctx.set in operations)
  const updateSensor = sensorRuntimeAtom.fn<{ id: string; reading: SensorReading }>()((args, ctx) =>
    Effect.gen(function* () {
      ctx.set(sensorAtom(args.id), { _tag: 'Success', data: args.reading })
    })
  )
  ```

- **Derived Atoms** (window aggregations):
  ```typescript
  // Rolling 10-sample window (FIFO ring buffer)
  const sensorWindowAtom = Atom.family((id: string) =>
    Atom.make<SensorReading[]>([])  // Max 10 samples, oldest evicted
  )

  // Derived min/max/avg over window
  const sensorStatsAtom = Atom.family((id: string) =>
    Atom.make((get) => {
      const window = get(sensorWindowAtom(id))
      if (window.length === 0) return null

      const values = window.map(r => r.value)
      return {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        count: values.length,
      }
    })
  )
  ```

- **Cross-Sensor Correlation**:
  ```typescript
  // Derived atom combining multiple sensors
  const temperatureDeltaAtom = Atom.make((get) => {
    const indoor = get(sensorAtom('temp-indoor'))
    const outdoor = get(sensorAtom('temp-outdoor'))

    if (indoor._tag !== 'Success' || outdoor._tag !== 'Success') {
      return null  // Not enough data
    }

    return {
      delta: indoor.data.value - outdoor.data.value,
      timestamp: Math.max(indoor.data.timestamp, outdoor.data.timestamp),
    }
  })
  ```

### Interfaces

| Interface | Protocol | Schema |
|-----------|----------|--------|
| S7→S8 | Effect.Stream | `Stream<SensorReading, FilterError>` → atom updates |
| S8→S9 | React subscription | `useAtomValue(sensorAtom(id))` → UI render |
| S8 (internal) | Derived atoms | Computed aggregations (min/max/avg) |
| S8→Persistence | Atom snapshots | `registry.get(atom)` → SQLite/localStorage |

**State Schema** (Effect Schema):
```typescript
import { Schema } from '@effect/schema'

// Branded sensor ID type
const SensorId = Schema.String.pipe(Schema.brand('SensorId'))

// Sensor reading payload
class SensorReading extends Schema.Class<SensorReading>('SensorReading')({
  sensorId: SensorId,
  timestamp: Schema.Number,
  value: Schema.Number,
  unit: Schema.String,
  quality: Schema.optional(Schema.Literal('good', 'uncertain', 'bad')),
}) {}

// Result type for lifecycle
const SensorState = Schema.Union(
  Schema.Struct({ _tag: Schema.Literal('Initial') }),
  Schema.Struct({ _tag: Schema.Literal('Waiting') }),
  Schema.Struct({ _tag: Schema.Literal('Success'), data: SensorReading }),
  Schema.Struct({ _tag: Schema.Literal('Failure'), error: Schema.Unknown }),
)

// Window aggregation stats
class SensorStats extends Schema.Class<SensorStats>('SensorStats')({
  min: Schema.Number,
  max: Schema.Number,
  avg: Schema.Number,
  count: Schema.Number,
  windowDurationMs: Schema.Number,
}) {}
```

## Rationale

### Alternatives Considered

1. **Redux/Zustand for state management**
   - **Pros**: Battle-tested, DevTools integration, middleware ecosystem
   - **Cons**: Imperative dispatch model, no Effect integration, boilerplate overhead
   - **Rejected**: effect-atom provides tighter Effect-TS integration, less boilerplate

2. **useState + Context for sensor state**
   - **Pros**: Built-in React primitive, familiar API
   - **Cons**: Violates Atom-as-State doctrine, causes stale closures, no Effect integration
   - **Rejected**: Cross-component state must use atoms (see CLAUDE.md anti-patterns)

3. **Jotai/Recoil (other atom libraries)**
   - **Pros**: Similar atom API, React-first design
   - **Cons**: No Effect runtime integration, less type-safe, requires separate async state handling
   - **Rejected**: effect-atom provides Effect.gen integration via `runtimeAtom.fn()`

4. **Effect.Ref for state (no atoms)**
   - **Pros**: Native Effect primitive, referential transparency
   - **Cons**: No React subscriptions (must poll or bridge to atoms), verbose update syntax
   - **Rejected**: Atoms ARE the state (not bridges to Effect.Ref) per TMNL doctrine

5. **RxJS Observables for reactive state**
   - **Pros**: Mature reactive library, powerful operators
   - **Cons**: Different mental model from Effect, requires Observable→atom bridge
   - **Rejected**: effect-atom provides sufficient reactivity without RxJS overhead

### Tradeoffs

| Gain | Cost |
|------|------|
| **Atom.family keying** — Efficient per-sensor state isolation | Memory overhead — O(n) atoms for n sensors (~100 bytes/atom) |
| **Result pattern** — Type-safe lifecycle states | Pattern matching overhead — Must handle all 4 states at consumption |
| **Derived atoms** — Automatic recomputation on dependencies | CPU overhead — Recomputes on ANY dependency change (no granular subscriptions) |
| **Registry pattern** — Prevents context shadowing | Manual registry management — Must mount atoms explicitly |
| **Schema validation** — Runtime type safety, EventLog integration | Decode overhead — ~0.5ms per message validation |
| **Synchronous derivations** — No async in atom computations | Limited to <1ms computations — Heavy aggregations need separate service |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Memory leak from unmounted atoms** — Family atoms never GC'd if component unmounts | Medium | Medium | Implement atom cleanup on sensor deregistration, use WeakMap for family storage |
| **Stale derived atoms** — Computed values lag behind state updates | Low | Low | Atoms recompute synchronously on dependency change (no lag risk) |
| **Registry shadowing** — Multiple RegistryProviders cause state splits | High | High | Use shared registry (overlayRegistry pattern), avoid nested providers |
| **Circular dependencies in derived atoms** — Atom A depends on B, B depends on A | Low | High | Lint rule to detect cycles, explicit dependency graph validation |
| **Derivation cascade overhead** — 100 sensors → 100 stats atoms → 100 recomputations | Medium | Medium | Batch updates via Effect.forEach, debounce high-frequency sensors |
| **Result pattern exhaustiveness** — Missing Match.tag() case causes runtime error | Low | Medium | TypeScript exhaustiveness checks, enforce Match.exhaustive |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `/src/lib/sensors/atoms/index.ts` | create | Sensor state atoms (family, derived, registry) |
| `/src/lib/sensors/schemas/sensor.ts` | create | SensorReading, SensorState, SensorStats schemas |
| `/src/lib/sensors/services/SensorStateService.ts` | create | Effect.Service for atom mutations via ctx.set() |
| `/src/lib/sensors/atoms/registry.ts` | create | Shared sensorRegistry singleton |
| `/src/lib/sensors/__tests__/atoms.test.ts` | create | Unit tests for family atoms, derivations, Result states |
| `/src/lib/cursor/atoms/index.tsx` | reference | Pattern for module-level atoms, registry |
| `/src/lib/dataplane/atoms/index.ts` | reference | Registry pattern, family atoms, derived atoms |
| `/src/lib/floating/floating-stx.ts` | reference | XState+Legend-State hybrid (stx pattern) |

### Dependencies

```json
{
  "@effect-atom/atom": "latest",     // Already installed
  "@effect-atom/atom-react": "latest", // Already installed
  "@effect/schema": "latest",        // Already installed
  "effect": "latest"                 // Already installed
}
```

**No new dependencies required** — leverage existing stack.

### Test Strategy

**Unit Tests** (`@effect/vitest`):
1. **Atom.family creation**:
   - Create atoms for 3 sensors → assert unique references
   - Update atom 1 → assert atoms 2/3 unchanged
   - Test family keying (same ID returns same atom reference)

2. **Result pattern transitions**:
   - Initial → Waiting → Success → assert state progression
   - Success → Failure → assert error captured
   - Test Match.exhaustive on all 4 states

3. **Derived atoms**:
   - Mock window with [1, 2, 3] → assert stats { min: 1, max: 3, avg: 2 }
   - Update window → assert stats recomputed
   - Empty window → assert null stats

4. **Registry pattern**:
   - Create registry → mount atoms → assert `registry.get()` works
   - Update via `registry.set()` → assert React subscribers notified
   - Test isolation (two registries don't share state)

5. **Cross-sensor correlation**:
   - Mock two sensor atoms → assert delta computed
   - One sensor in Failure state → assert correlation returns null
   - Test timestamp selection (latest of both sensors)

**Integration Tests** (with Effect runtime):
1. **Service-layer mutations**:
   - Call `sensorOps.updateSensor()` → assert atom updated
   - Call from Effect.gen → assert ctx.set() propagates
   - Test error handling (invalid schema → Failure state)

2. **React subscription**:
   - `useAtomValue(sensorAtom(id))` → update atom → assert re-render
   - Test registry context provider (RegistryContext)
   - Verify no stale closures (useState anti-pattern)

3. **Window aggregations**:
   - Stream 100 sensor readings → assert FIFO eviction (max 10 samples)
   - Verify derived stats atom updates on each new reading
   - Test memory stability (no unbounded growth)

4. **Registry shadowing prevention**:
   - Nest two RegistryProviders → assert mutations visible in both
   - Use shared overlayRegistry → assert no state split

**Manual Tests** (Browser DevTools):
- React DevTools: Inspect atom values, verify re-render counts
- effect-atom DevTools (if available): Visualize dependency graph
- Chrome Performance: Profile derivation cascade (100 sensors)

## Metadata

### Related ADRs
- **ADR-S7-S8** (Filtering-State integration) — Dead-band filtered streams feed atom updates
- **ADR-S8-S9** (State-React integration) — useAtomValue subscription, memo optimization
- **ADR-S5-S8** (Storage-State synergy) — Atom snapshots persisted to SQLite
- **ADR-S4-S8** (Schema contract synergy) — Effect Schema used in both ingestion and state layers
- **ADR-S3-S8-S9** (Error handling triplet) — Result types flow from transport → state → UI

### Open Questions
1. **Atom cleanup strategy** — Should family atoms be GC'd on sensor deregistration? (WeakMap vs manual cleanup)
2. **Window size configuration** — Fixed 10 samples or dynamic based on data rate?
3. **Derived atom memoization** — Should expensive computations (>1ms) be debounced?
4. **Registry per-domain** — One global registry or separate registries per subsystem (sensors, dataplane, overlays)?
5. **Time-travel debugging** — Should atom snapshots be automatically persisted for replay?
6. **Offline buffering** — Should S8 queue updates when S9 (React) is suspended?

### References
- effect-atom docs: `../../submodules/effect-atom/packages/atom/README.md`
- Atom-as-State doctrine: `/CLAUDE.md` (Core Disciplines section)
- Registry pattern: `/src/lib/dataplane/atoms/index.ts` (lines 59-104)
- Result pattern: `/src/lib/editor-ai/hooks/useReconciler.ts` (Result<T, E> usage)
- Family atoms: `/src/lib/dataplane/atoms/index.ts` (lines 168-176, 574-586)
- Cursor atoms (reference): `/src/lib/cursor/atoms/index.tsx`
