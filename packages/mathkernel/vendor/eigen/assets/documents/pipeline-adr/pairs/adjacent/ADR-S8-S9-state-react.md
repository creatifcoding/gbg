---
id: S8-S9
title: "State → React Integration — Subscription Granularity & Render Optimization"
commitHash: "6656064"
status: draft
date: "2026-01-02"
tier: pair-adjacent
stages:
  - S8
  - S9
---

# ADR-S8-S9: State → React Integration

**ID**: S8-S9
**Commit Hash**: 6656064
**Status**: draft
**Date**: 2026-01-02
**Tier**: pair-adjacent

## Context

### Stages Covered
- S8 (State) — effect-atom reactive state layer with Result types
- S9 (React) — Component subscriptions, rendering, DOM updates

### Problem

Sensor telemetry flows from filtering (S7) into reactive state atoms (S8) and must efficiently propagate to React components (S9) without causing:

1. **Render cascades** — A single sensor update should NOT re-render unrelated sensor displays
2. **Subscription overhead** — 100 sensors × 20Hz = 2000 state updates/sec must not saturate render thread
3. **Stale closures** — Callbacks capturing outdated atom values lead to phantom updates
4. **Memory leaks** — Unsubscribed atom observers accumulate on component unmount
5. **Result pattern verbosity** — Every component must handle 4 states (Initial/Waiting/Success/Failure) correctly
6. **Performance cliffs** — UI remains fluid at 10 sensors but freezes at 100 without virtualization

The S8→S9 boundary is where **reactive data flow meets imperative rendering** — bugs here manifest as frozen UIs, missed updates, or cascading re-renders.

**Core question**: How do React components subscribe to sensor atoms efficiently? What render patterns prevent performance degradation as sensor count scales?

### Constraints

- **Atom-as-State doctrine** — `useAtomValue()` is the ONLY subscription primitive (no useState for cross-component state)
- **Result pattern mandatory** — All async atoms return `Result<T, E>` discriminated union
- **Module-level atoms** — Stable references, never recreated inside render
- **React 18 Concurrent Mode** — Must leverage automatic batching, transitions
- **AG-Grid for virtualization** — Grid views with 100+ sensors require virtual scrolling
- **Typography floor** — Minimum 12px font size (TMNL design system)
- **Memoization discipline** — React.memo only when profiling confirms benefit (avoid premature optimization)

### Assumptions

- effect-atom provides efficient subscription batching (atoms coalesce updates)
- Sensor IDs are stable UUIDs (React keys remain constant)
- Sensor display components are structurally identical (good memoization targets)
- Most deployments have <100 active sensors (fits in viewport without virtualization)
- Individual sensor updates are independent (no cross-sensor synchronization in render)
- Browser tabs remain active (no deferred rendering for backgrounded tabs)

## Decision

### Summary

Implement **subscription granularity as an optimization strategy**: components subscribe to the **narrowest atom scope** that satisfies their data needs. Individual sensor displays use `useAtomValue(sensorAtom(id))` to isolate re-renders. Sensor list/index views subscribe to `sensorListAtom` for discovery but rely on granular subscriptions for individual rendering. Result pattern matching uses a **match helper** to reduce verbosity. Virtualization via AG-Grid activates automatically when sensor count exceeds viewport capacity.

**Key principle**: Subscribe at the lowest granularity that meets component needs. Avoid subscribing to parent collections when children can subscribe directly.

### Technologies

| Technology | Purpose | Reference |
|------------|---------|-----------|
| **useAtomValue** | effect-atom subscription hook | `/src/lib/cursor/components/Cursor.tsx:76-82` |
| **React.memo** | Component memoization (used sparingly) | `/src/lib/dataplane/components/Port/PortNode.tsx:93` |
| **Result.isInitial/isWaiting/isSuccess/isFailure** | Result pattern guards | `/src/components/testbed/FermionTestbed.tsx` |
| **AG-Grid virtual scrolling** | Render optimization for 100+ sensors | `/src/lib/data-grid/` (TMNL ag-grid patterns) |
| **useMemo** | Expensive computation caching | `/src/lib/cursor/components/Cursor.tsx:86` |
| **useCallback** | Callback stabilization | `/src/lib/cursor/components/Cursor.tsx:92-100` |

### Patterns

#### 1. Subscription Granularity Strategy

**Rule**: Subscribe to the narrowest atom that provides required data. Granular subscriptions minimize re-renders.

**Individual Sensor Display** (optimal):
```typescript
// GOOD: Granular subscription — only re-renders when THIS sensor changes
const SensorCard = memo(({ id }: { id: SensorId }) => {
  const result = useAtomValue(sensorAtom(id)) // Atom.family pattern

  return (
    <Card>
      {Result.isSuccess(result) && (
        <div>{result.value.temperature}°C</div>
      )}
    </Card>
  )
})
```

**Sensor List View** (coarse, acceptable for index):
```typescript
// ACCEPTABLE: Coarse subscription for sensor discovery/list
const SensorList = () => {
  const sensorIds = useAtomValue(sensorListAtom) // Array of IDs

  return (
    <div>
      {sensorIds.map(id => (
        <SensorCard key={id} id={id} /> // Individual subscriptions inside
      ))}
    </div>
  )
}
```

**Anti-pattern** (re-renders entire grid on any sensor update):
```typescript
// BAD: Subscribes to full map — re-renders ALL sensors when ANY changes
const SensorGrid = () => {
  const allSensors = useAtomValue(sensorsMapAtom) // Map<id, data>

  return allSensors.map(sensor => (
    <div key={sensor.id}>{sensor.temperature}°C</div> // No memoization boundary
  ))
}
```

**Derived Atom Subscriptions** (for aggregations):
```typescript
// GOOD: Subscribe to derived atom for aggregated data
const AverageTemperature = () => {
  const avgTemp = useAtomValue(avgTemperatureAtom) // Computed across all sensors

  return <div>Avg: {avgTemp}°C</div>
}

// Atom definition (from S8)
export const avgTemperatureAtom = Atom.make((get) => {
  const sensors = get(sensorListAtom)
  const temps = sensors
    .map(id => get(sensorAtom(id)))
    .filter(Result.isSuccess)
    .map(r => r.value.temperature)

  return temps.length > 0
    ? temps.reduce((a, b) => a + b, 0) / temps.length
    : null
})
```

**File**: `/src/components/testbed/FermionTestbed.tsx:1741-1871` (SensorCard granular subscription)

#### 2. Render Optimization Patterns

**React.memo for Stable Components**:

Use `React.memo` when profiling confirms unnecessary re-renders. TMNL doctrine: **measure before optimizing**.

```typescript
// Memoize sensor card — only re-renders when id or result changes
const SensorCard = memo(({ id }: { id: SensorId }) => {
  const result = useAtomValue(sensorAtom(id))
  // Component body
}, (prev, next) => {
  // Custom equality: only re-render if id changes (atom value changes handled by useAtomValue)
  return prev.id === next.id
})
```

**Stable Identity for React Keys**:

Sensor IDs are stable UUIDs — use them as React keys to preserve component identity across renders.

```typescript
// GOOD: Stable key (sensorId never changes)
{sensors.map(id => <SensorCard key={id} id={id} />)}

// BAD: Unstable key (index changes on array reorder)
{sensors.map((id, idx) => <SensorCard key={idx} id={id} />)}
```

**Avoid Parent Subscriptions When Child Suffices**:

```typescript
// BAD: Parent subscribes to full list, passes data down
const Dashboard = () => {
  const sensors = useAtomValue(allSensorsAtom) // Re-renders on ANY sensor update
  return sensors.map(s => <SensorCard data={s} />)
}

// GOOD: Parent subscribes to ID list only, children subscribe individually
const Dashboard = () => {
  const sensorIds = useAtomValue(sensorListAtom) // Only re-renders on add/remove
  return sensorIds.map(id => <SensorCard key={id} id={id} />)
}
```

**File**: `/src/lib/dataplane/components/Port/PortNode.tsx:93` (React.memo usage)

#### 3. Result Pattern in JSX

effect-atom wraps async state in `Result<T, E>` discriminated union with 4 states:
- **Initial**: Never subscribed, no data attempted
- **Waiting**: Subscription active, awaiting first message (or refresh)
- **Success**: Latest valid reading available
- **Failure**: Stream error (transport failure, validation failure, timeout)

**Pattern Matching with Type Guards**:

```typescript
const SensorCard = ({ id }: { id: SensorId }) => {
  const result = useAtomValue(sensorAtom(id))

  // Initial: Never attempted fetch
  if (Result.isInitial(result)) {
    return <Skeleton className="h-24 w-full" />
  }

  // Waiting: Fetch in progress
  if (Result.isWaiting(result)) {
    // Show spinner + previous value (optimistic rendering)
    const prevValue = result.previous // Result.Waiting includes previous Success
    return (
      <div className="relative">
        <Spinner className="absolute top-2 right-2" />
        {prevValue && <SensorData data={prevValue} opacity={0.6} />}
      </div>
    )
  }

  // Failure: Stream error
  if (Result.isFailure(result)) {
    return (
      <ErrorBoundary
        error={result.cause}
        onRetry={() => registry.get(sensorOps.fetch(id))}
      />
    )
  }

  // Success: Valid data
  return <SensorData data={result.value} />
}
```

**Helper Function for Reduced Verbosity**:

```typescript
// Define once, reuse across components
function matchResult<T, E, R>(
  result: Result.Result<T, E>,
  handlers: {
    onInitial: () => R
    onWaiting: (prev?: T) => R
    onSuccess: (value: T) => R
    onFailure: (error: E) => R
  }
): R {
  if (Result.isInitial(result)) return handlers.onInitial()
  if (Result.isWaiting(result)) return handlers.onWaiting(result.previous)
  if (Result.isFailure(result)) return handlers.onFailure(result.cause)
  return handlers.onSuccess(result.value)
}

// Usage
const SensorCard = ({ id }: { id: SensorId }) => {
  const result = useAtomValue(sensorAtom(id))

  return matchResult(result, {
    onInitial: () => <Skeleton />,
    onWaiting: (prev) => <div><Spinner />{prev && <Value data={prev} />}</div>,
    onSuccess: (data) => <Value data={data} />,
    onFailure: (err) => <Error error={err} />,
  })
}
```

**File**: `/src/components/testbed/EffectAtomTestbed.tsx:1867-1928` (Result.match pattern)

#### 4. Performance Boundaries

**Virtualization for 100+ Sensors**:

When sensor count exceeds viewport capacity, use AG-Grid's virtual scrolling to render only visible rows.

```typescript
const SensorGridView = () => {
  const sensorIds = useAtomValue(sensorListAtom)

  // AG-Grid renders only ~20 viewport rows, not all 500
  const columnDefs = useMemo(() => [
    {
      field: 'sensorId',
      headerName: 'Sensor',
      cellRenderer: (params) => {
        // Subscribe inside cell renderer (granular)
        const result = useAtomValue(sensorAtom(params.value))
        return Result.isSuccess(result) ? result.value.name : '—'
      },
    },
    {
      field: 'temperature',
      valueGetter: (params) => {
        const result = registry.get(sensorAtom(params.data))
        return Result.isSuccess(result) ? result.value.temperature : null
      },
      valueFormatter: (params) => params.value ? `${params.value}°C` : '—',
    },
  ], [])

  return (
    <AgGridReact
      rowData={sensorIds}
      columnDefs={columnDefs}
      domLayout="autoHeight"
      rowBuffer={10} // Render 10 extra rows above/below viewport
    />
  )
}
```

**Windowed Rendering for Dashboards**:

For dashboard layouts (non-grid), use `react-window` or similar for virtual scrolling.

```typescript
import { FixedSizeList } from 'react-window'

const SensorDashboard = () => {
  const sensorIds = useAtomValue(sensorListAtom)

  const Row = ({ index, style }) => (
    <div style={style}>
      <SensorCard id={sensorIds[index]} />
    </div>
  )

  return (
    <FixedSizeList
      height={600}
      itemCount={sensorIds.length}
      itemSize={120} // 120px per sensor card
      width="100%"
    >
      {Row}
    </FixedSizeList>
  )
}
```

**Debounced Derived Computations**:

For expensive derived atoms (e.g., statistical computations), debounce updates to prevent cascade recomputations.

```typescript
// Heavy computation (simulate 10ms cost)
export const sensorStatisticsAtom = Atom.make((get) => {
  const sensors = get(sensorListAtom)
  const readings = sensors
    .map(id => get(sensorAtom(id)))
    .filter(Result.isSuccess)
    .map(r => r.value.temperature)

  // Expensive: percentile calculation, histogram binning
  return computeStatistics(readings) // 10ms
})

// Debounce via Effect.Stream (prevents recomputation on every sensor update)
export const debouncedStatisticsAtom = Atom.runtime((get, ctx) =>
  Effect.gen(function* () {
    const stream = yield* ctx.subscribe(sensorStatisticsAtom)
    return yield* stream.pipe(
      Stream.debounce(Duration.millis(500)), // Max 2 updates/sec
      Stream.runCollect
    )
  })
)
```

**File**: `/src/lib/cursor/components/Cursor.tsx:86` (useMemo for expensive computation)

#### 5. Callback Stabilization

**Problem**: New function instances on every render cause child components to re-render (even with React.memo).

**Solution**: `useCallback` with dependency arrays.

```typescript
const SensorCard = ({ id }: { id: SensorId }) => {
  const result = useAtomValue(sensorAtom(id))

  // BAD: New function on every render
  const handleRefresh = () => {
    registry.get(sensorOps.fetch(id))
  }

  // GOOD: Stable function reference (only changes if id changes)
  const handleRefresh = useCallback(() => {
    registry.get(sensorOps.fetch(id))
  }, [id])

  return (
    <Card>
      <Button onClick={handleRefresh}>Refresh</Button>
    </Card>
  )
}
```

**File**: `/src/lib/cursor/components/Cursor.tsx:92-100` (useCallback pattern)

### Interfaces

#### Component Subscription Interface

**Pattern**: `const value = useAtomValue(atom)`

```typescript
// Component subscribes to atom
const SensorCard = ({ id }: { id: SensorId }) => {
  const result: Result<SensorReading, TransportError> = useAtomValue(sensorAtom(id))
  // Component re-renders when atom value changes
}
```

**Subscription lifecycle**:
1. Component mounts → `useAtomValue` subscribes to atom
2. Atom updates (via `ctx.set()` in S8) → React schedules re-render
3. Component unmounts → subscription automatically cleaned up

**File**: `/src/lib/cursor/components/Cursor.tsx:76-82`

#### Result Match Interface

**Pattern**: Type guards for discriminated union

```typescript
type Result<T, E> =
  | { _tag: 'Initial' }
  | { _tag: 'Waiting'; previous?: T }
  | { _tag: 'Success'; value: T }
  | { _tag: 'Failure'; cause: E }

// Usage
if (Result.isSuccess(result)) {
  // TypeScript narrows to { _tag: 'Success'; value: T }
  console.log(result.value.temperature)
}
```

**File**: `/src/lib/editor/hooks/useEditor.ts:115-167` (Result.match pattern)

#### User Interaction → State Interface

**Pattern**: Imperative mutation via registry or runtime atoms

```typescript
// Direct registry mutation (sync)
const handleToggle = () => {
  const current = registry.get(sensorAtom(id))
  registry.set(sensorAtom(id), !current)
}

// Effect runtime mutation (async)
const handleFetch = async () => {
  await registry.get(sensorOps.fetch(id)) // Returns Effect.runPromise
}
```

## Rationale

### Alternatives Considered

1. **Subscribe to parent collection, pass data as props**
   - **Pros**: Simpler mental model (single subscription point), easier to implement
   - **Cons**: Re-renders entire subtree on any sensor update, O(n) component updates for 1 sensor change
   - **Rejected**: Violates granular subscription principle, causes render cascades

2. **Context API for sensor data**
   - **Pros**: Built-in React primitive, familiar API
   - **Cons**: Single context re-renders all consumers, no granular subscriptions, breaks Atom-as-State doctrine
   - **Rejected**: effect-atom provides finer-grained subscriptions than Context

3. **Redux/Zustand for sensor state**
   - **Pros**: Battle-tested, DevTools integration, middleware ecosystem
   - **Cons**: Redundant with effect-atom, adds dependency weight, no Effect runtime integration
   - **Rejected**: effect-atom is canonical state layer per TMNL architecture

4. **Render props for Result pattern**
   - **Pros**: Reduces if/else verbosity, encapsulates loading/error UI
   - **Cons**: Nesting hell for multiple results, harder to debug, less explicit
   - **Rejected**: Type guards + matchResult helper provide sufficient ergonomics

5. **React Suspense for async state**
   - **Pros**: Built-in React feature, automatic loading states
   - **Cons**: effect-atom does NOT use React Suspense (uses Result pattern instead), would require bridging layer
   - **Rejected**: Result pattern is canonical per effect-atom design (see `/src/components/testbed/halflife.json:51-52`)

### Tradeoffs

| Gain | Cost |
|------|------|
| **Granular subscriptions** — Isolated re-renders (only affected sensors update) | Subscription overhead — O(n) subscriptions for n sensors (~100 bytes/subscription) |
| **Result pattern type safety** — Compile-time exhaustiveness checks | Verbosity — Must handle 4 states (Initial/Waiting/Success/Failure) in every consumer |
| **Virtualization** — Handles 1000+ sensors without frame drops | Complexity — AG-Grid integration, cell renderer patterns, virtual scroll edge cases |
| **React.memo optimization** — Prevents unnecessary re-renders | Memory overhead — Memoized components cache previous props (~200 bytes/component) |
| **Stable callbacks** — useCallback prevents cascading child re-renders | Developer overhead — Must maintain dependency arrays, ESLint warnings |
| **Optimistic rendering** — Show stale data during refresh (Waiting state) | UX complexity — Users see "old data + spinner" (must communicate staleness) |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Memory leaks from unsubscribed atoms** — useAtomValue cleanup fails on unmount | Low | High | effect-atom handles cleanup automatically; verify with React DevTools Profiler |
| **Stale closures in callbacks** — Captured atom values outdated | Medium | Medium | useCallback with exhaustive deps, ESLint enforcement (`react-hooks/exhaustive-deps`) |
| **Over-memoization** — React.memo used prematurely without profiling | High | Low | TMNL doctrine: measure first (React DevTools Profiler), optimize only when confirmed |
| **Subscription cascade** — Derived atoms trigger chain of recomputations | Medium | Medium | Debounce expensive derivations, limit dependency depth (max 3 levels) |
| **Virtualization breaks accessibility** — Screen readers can't navigate off-screen sensors | Low | Medium | Ensure AG-Grid ARIA compliance, test with screen readers, provide "Export All" fallback |
| **Result pattern exhaustiveness** — Missing state handler causes runtime error | Low | High | TypeScript exhaustiveness checks (`Match.exhaustive`), unit tests for all 4 states |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `/src/lib/sensors/components/SensorCard.tsx` | create | Memoized sensor display with granular useAtomValue subscription |
| `/src/lib/sensors/components/SensorGrid.tsx` | create | AG-Grid virtualized sensor list (100+ sensors) |
| `/src/lib/sensors/components/SensorDashboard.tsx` | create | Windowed dashboard layout (react-window integration) |
| `/src/lib/sensors/utils/matchResult.ts` | create | Result pattern match helper (reduce verbosity) |
| `/src/lib/sensors/atoms/index.ts` | modify | Export sensorAtom family, sensorListAtom, avgTemperatureAtom |
| `/src/lib/sensors/__tests__/rendering.test.tsx` | create | Unit tests for memoization, subscription isolation |
| `/src/components/testbed/FermionTestbed.tsx` | reference | Existing SensorCard pattern (lines 1741-1871) |

### Dependencies

**No new dependencies required** — leverage existing stack:
- `@effect-atom/atom-react` (useAtomValue, RegistryContext)
- `react` (memo, useMemo, useCallback)
- `ag-grid-react` (already installed for TMNL data grids)
- `react-window` (optional, for windowed dashboards)

### Test Strategy

**Unit Tests** (`@testing-library/react`):

1. **Subscription Granularity**:
   ```typescript
   it('SensorCard only re-renders when its sensor changes', () => {
     const { rerender } = render(<SensorCard id="sensor-1" />)
     const renderCount = captureRenderCount()

     // Update unrelated sensor
     registry.set(sensorAtom('sensor-2'), newReading)
     expect(renderCount).toBe(0) // No re-render

     // Update THIS sensor
     registry.set(sensorAtom('sensor-1'), newReading)
     expect(renderCount).toBe(1) // Re-renders once
   })
   ```

2. **Result Pattern Rendering**:
   ```typescript
   it('renders all 4 Result states correctly', async () => {
     const { getByText, queryByText } = render(<SensorCard id="sensor-1" />)

     // Initial state
     expect(getByText(/skeleton/i)).toBeInTheDocument()

     // Trigger fetch → Waiting state
     act(() => registry.get(sensorOps.fetch('sensor-1')))
     expect(getByText(/loading/i)).toBeInTheDocument()

     // Success state
     await waitFor(() => expect(getByText(/22.5°C/i)).toBeInTheDocument())

     // Trigger error → Failure state
     act(() => registry.set(sensorAtom('sensor-1'), Result.failure(new Error('timeout'))))
     expect(getByText(/error/i)).toBeInTheDocument()
   })
   ```

3. **Memoization Effectiveness**:
   ```typescript
   it('React.memo prevents re-render when props unchanged', () => {
     const { rerender } = render(<SensorCard id="sensor-1" />)
     const renderCount = captureRenderCount()

     // Rerender parent with same props
     rerender(<SensorCard id="sensor-1" />)
     expect(renderCount).toBe(0) // Memoization prevented re-render
   })
   ```

4. **Callback Stability**:
   ```typescript
   it('useCallback prevents function recreation on unrelated renders', () => {
     const handleRefresh = jest.fn()
     const { rerender } = render(<SensorCard id="sensor-1" onRefresh={handleRefresh} />)

     const initialCallback = getCallbackReference()
     rerender(<SensorCard id="sensor-1" onRefresh={handleRefresh} />)
     const afterRerenderCallback = getCallbackReference()

     expect(initialCallback).toBe(afterRerenderCallback) // Same reference
   })
   ```

**Integration Tests** (with Effect runtime):

1. **End-to-End Subscription Flow**:
   ```typescript
   it('sensor update flows from S7 → S8 → S9', async () => {
     const { getByText } = render(<SensorCard id="sensor-1" />)

     // S7: Filtered stream emits reading
     streamEmitter.emit({ sensorId: 'sensor-1', temperature: 23.5 })

     // S8: Atom updated via ctx.set()
     await waitFor(() => {
       const atomValue = registry.get(sensorAtom('sensor-1'))
       expect(Result.isSuccess(atomValue)).toBe(true)
     })

     // S9: Component re-renders with new value
     expect(getByText(/23.5°C/i)).toBeInTheDocument()
   })
   ```

2. **Virtualization Performance**:
   ```typescript
   it('AG-Grid handles 500 sensors without frame drops', async () => {
     const sensorIds = Array.from({ length: 500 }, (_, i) => `sensor-${i}`)
     const { container } = render(<SensorGrid />)

     // Measure FPS while scrolling
     const fps = await measureFPSDuringScroll(container, 5000)
     expect(fps).toBeGreaterThan(55) // Target: maintain 60fps
   })
   ```

**Performance Tests** (React DevTools Profiler):

1. **Render Count Audit**:
   - Update 1 sensor → assert ≤ 2 component renders (SensorCard + parent list)
   - Update 10 sensors → assert ≤ 20 renders (granular isolation)
   - Verify: No sibling sensors re-render

2. **Subscription Overhead**:
   - 100 sensors subscribed → measure memory delta
   - Target: <1MB overhead (10KB per sensor)
   - Verify: No memory leaks after 1000 mount/unmount cycles

3. **Derivation Cascade**:
   - Update 1 sensor → assert avgTemperatureAtom recomputes ONCE
   - Update 10 sensors in batch → assert single recomputation (batching works)

## Metadata

### Related ADRs
- **ADR-S8** (State) — Atom architecture, Result pattern, Registry pattern
- **ADR-S9** (React) — Component patterns, rendering strategy
- **ADR-S7-S8** (Filtering-State integration) — Dead-band filtered streams feed atom updates
- **ADR-S6-S7** (Client-Filtering integration) — Hybrid server/client filtering coordination
- **ADR-S3-S8-S9** (Error handling triplet) — Result types flow transport → state → UI

### Open Questions

1. **Atom cleanup strategy** — Should family atoms be GC'd on sensor deregistration? (WeakMap vs manual cleanup)
2. **Subscription batching** — Does effect-atom coalesce updates automatically, or must we batch via Effect.forEach?
3. **Result.Waiting.previous semantics** — Should components ALWAYS show stale data during refresh, or opt-in?
4. **Virtualization threshold** — At what sensor count should AG-Grid auto-activate? (50? 100?)
5. **Derived atom debouncing** — Should expensive derivations (>1ms) be automatically debounced?
6. **Performance monitoring** — Should TMNL include React DevTools Profiler instrumentation in production?

### References

1. **effect-atom useAtomValue**
   Submodule: `../../submodules/effect-atom/packages/atom-react/src/index.ts`

2. **TMNL Cursor Component** (useAtomValue pattern)
   File: `/src/lib/cursor/components/Cursor.tsx` (lines 76-82)

3. **TMNL FermionTestbed** (SensorCard granular subscription)
   File: `/src/components/testbed/FermionTestbed.tsx` (lines 1741-1871)

4. **TMNL PortNode** (React.memo usage)
   File: `/src/lib/dataplane/components/Port/PortNode.tsx` (line 93)

5. **Result Pattern Documentation**
   Submodule: `../../submodules/effect-atom/packages/atom/README.md` (Result section)

6. **TMNL Atom-as-State Doctrine**
   File: `/CLAUDE.md` (Core Disciplines → Atom-as-State Doctrine)

7. **React.memo Documentation**
   https://react.dev/reference/react/memo

8. **AG-Grid Virtual Scrolling**
   https://www.ag-grid.com/react-data-grid/row-virtualisation/

### Glossary

- **Granular Subscription**: Subscribing to the narrowest atom scope (e.g., single sensor vs entire collection)
- **Result Pattern**: effect-atom discriminated union for async state (Initial/Waiting/Success/Failure)
- **Subscription Cascade**: Ripple effect where one atom update triggers multiple derived atom recomputations
- **Render Isolation**: Property where updating atom A does NOT re-render components subscribed to atom B
- **Optimistic Rendering**: Displaying stale Success data while Waiting for fresh data (Result.Waiting.previous)
- **Virtualization**: Rendering only visible rows/items to reduce DOM node count (AG-Grid, react-window)
- **Stable Identity**: React key that remains constant across renders (enables component reuse)

---

**Author**: Val (TMNL Architectural Conscience)
**Reviewed**: Pending
**Approved**: Pending
