---
id: S9
title: "React Stage — Subscription, Rendering & DOM Updates"
commitHash: "6656064"
status: draft
date: "2026-01-02"
stages: ["S9"]
tier: isolated
---

# ADR-S9: React Stage — Subscription, Rendering & DOM Updates

## Context

### Problem

High-frequency sensor data streams (potentially 100+ Hz per sensor) must efficiently propagate to UI without causing:
- Excessive re-renders flooding the React reconciler
- Memory leaks from unsubscribed atom observers
- Layout thrash from unbatched DOM updates
- Stale closures capturing outdated sensor state

In a multi-sensor dashboard, inefficient subscription granularity compounds quadratically: 50 sensors × 20 Hz = 1000 state updates/sec. Without optimization, this saturates the render thread and blocks user interaction.

### Constraints

- MUST use `useAtomValue` for atom subscriptions (Atom-as-State doctrine)
- MUST handle Result state machine patterns (Initial/Waiting/Success/Failure)
- MUST support sensor grids with 100+ concurrent data streams
- MUST maintain referential stability for callbacks to prevent cascade re-renders
- MUST clean up subscriptions on unmount to prevent memory leaks

### Assumptions

- React 18+ with Concurrent Features enabled
- effect-atom provides efficient subscription batching
- Sensor display components are numerous but structurally identical (good memoization targets)
- AG-Grid handles virtualization when sensor count exceeds viewport capacity

## Decision

### Summary

Use **granular atom subscriptions** at the sensor level with `React.memo` boundaries, virtualized rendering for large grids, and Result pattern matching for loading/error states. Subscriptions are scoped to individual sensor atoms via `useAtomValue(sensorAtom(id))`, preventing unnecessary re-renders when sibling sensors update.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| useAtomValue | effect-atom | Atom subscription hook | `src/lib/cursor/components/Cursor.tsx:15` |
| React.memo | React 18 | Component memoization | `src/components/testbed/FermionTestbed.tsx:1741` |
| useMemo | React 18 | Expensive computation caching | `src/lib/cursor/components/Cursor.tsx:87` |
| useCallback | React 18 | Callback stabilization | `src/lib/cursor/components/Cursor.tsx:172` |
| AG-Grid | v34 | Virtual scrolling for large datasets | (TMNL ag-grid integration) |

### Patterns

#### 1. Granular Subscription Pattern

Subscribe to the narrowest atom scope needed. Avoid subscribing to parent collections when individual items suffice.

```typescript
// GOOD: Granular subscription (only re-renders when THIS sensor changes)
const SensorDisplay = memo(({ id }: { id: SensorId }) => {
  const data = useAtomValue(sensorAtom(id)) // Atom.family pattern
  return <div>{/* render sensor */}</div>
})

// BAD: Coarse subscription (re-renders ALL sensors when ANY changes)
const SensorGrid = () => {
  const allSensors = useAtomValue(sensorsMapAtom) // Entire map
  return allSensors.map(s => <div>{/* render sensor */}</div>)
}
```

**File**: `src/components/testbed/FermionTestbed.tsx:1741-1871` (SensorCard component)

#### 2. Result Pattern Rendering

Match on Result state machine to render appropriate UI for each lifecycle phase.

```typescript
const SensorCard = ({ id }: { id: SensorId }) => {
  const result = useAtomValue(sensorAtom(id))

  if (Result.isInitial(result)) {
    return <Skeleton />
  }
  if (Result.isWaiting(result)) {
    return <Spinner previous={result.previous} />
  }
  if (Result.isFailure(result)) {
    return <ErrorBoundary error={result.cause} />
  }
  // Result.isSuccess
  return <SensorData data={result.value} />
}
```

**File**: `src/components/testbed/FermionTestbed.tsx:770-816` (ResultStateDisplay)

#### 3. Memoization Strategy

Use `React.memo` for components that receive stable props and render frequently.

```typescript
// Memoize sensor display - only re-renders when id or result changes
const SensorCard = memo(({
  sensor,
  isSelected,
  onSelect,
  onTogglePolling
}: SensorCardProps) => {
  // Component body
}, (prev, next) => {
  // Custom equality check if needed
  return prev.sensor.sensorId === next.sensor.sensorId &&
         prev.isSelected === next.isSelected
})
```

**File**: `src/components/testbed/FermionTestbed.tsx:1741-1871`

#### 4. Callback Stabilization

Use `useCallback` with dependency arrays to prevent new function instances on every render.

```typescript
const handleFetch = useCallback(async (sensorId: string) => {
  await Effect.runPromise(
    sensorFamily.fetch(sensorId).pipe(
      Effect.provideService(Registry.AtomRegistry, registry)
    )
  )
}, [sensorFamily, registry]) // Stable dependencies
```

**File**: `src/lib/cursor/components/Cursor.tsx:172-174`

#### 5. Virtualization for Large Datasets

For sensor grids exceeding 50 items, use AG-Grid's virtual scrolling to only render visible rows.

```typescript
const SensorGridView = () => {
  const sensorIds = useAtomValue(sensorIdsAtom)

  // AG-Grid renders only viewport rows (~20), not all 500
  const columnDefs = useMemo(() => [
    { field: 'sensorId', cellRenderer: SensorCellRenderer },
    { field: 'readings.temperature', valueFormatter: tempFormatter },
    // ...
  ], [])

  return <AgGridReact rowData={sensorIds} columnDefs={columnDefs} />
}
```

### Interfaces

| Interface | From | To | Protocol | Schema |
|-----------|------|----|---------|----|
| Atom Subscription | S8 (State) | S9 (React) | `useAtomValue(atom)` | `Result<SensorData, E>` |
| User Interaction | S9 (React) | S8 (State) | `registry.set(atom, value)` | Imperative mutation |

## Rationale

### Alternatives Considered

| Alternative | Description | Rejection Reason |
|-------------|-------------|-----------------|
| Context API for sensor data | Single context holding all sensors | Re-renders entire tree on any update, O(n) complexity |
| useState per sensor | Local state management | No cross-component sharing, breaks Atom-as-State doctrine |
| Redux/Zustand | External state managers | Redundant with effect-atom, adds dependency weight |
| React Query | Server state library | Overkill for local atom subscriptions |

### Tradeoffs

| Gain | Cost |
|------|------|
| Render isolation via React.memo | Increased memory overhead per memoized component |
| Granular subscriptions minimize re-renders | More subscription instances to track and clean up |
| Virtualization handles 1000+ sensors | Requires AG-Grid dependency and integration complexity |
| Result pattern provides type-safe state handling | Verbose match clauses in render logic |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Memory leaks from unsubscribed atoms | Medium | High | Strict useEffect cleanup pattern, eslint-plugin-react-hooks |
| Stale closures in callbacks | Medium | Medium | useCallback with exhaustive deps, ESLint enforcement |
| Over-memoization causing unnecessary complexity | Low | Low | Measure with React DevTools Profiler before optimizing |
| Virtualization breaks accessibility | Low | Medium | Ensure AG-Grid ARIA compliance, keyboard navigation |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `src/components/sensors/SensorCard.tsx` | create | Memoized sensor display component with useAtomValue subscription |
| `src/components/sensors/SensorGrid.tsx` | create | AG-Grid integration for virtualized sensor list |
| `src/lib/sensors/atoms/index.ts` | modify | Export sensorAtom family and derived selectors |

### Dependencies

- `@effect-atom/atom-react` (useAtomValue, RegistryContext)
- `react` (memo, useMemo, useCallback)
- `ag-grid-react` (AgGridReact, for virtualization)

### Test Strategy

**Unit Tests**: Verify memoization prevents unnecessary re-renders
```typescript
it('SensorCard only re-renders when sensor data changes', () => {
  const { rerender } = render(<SensorCard id="sensor-1" />)
  const renderCount = captureRenderCount()

  // Update unrelated sensor
  registry.set(sensorAtom("sensor-2"), newData)
  expect(renderCount).toBe(0) // No re-render

  // Update THIS sensor
  registry.set(sensorAtom("sensor-1"), newData)
  expect(renderCount).toBe(1) // Re-renders once
})
```

**Integration Tests**: Verify Result pattern rendering
```typescript
it('renders loading state during fetch', async () => {
  const { getByText } = render(<SensorCard id="sensor-1" />)

  // Initial state
  expect(getByText(/skeleton/i)).toBeInTheDocument()

  // Trigger fetch
  await act(() => sensorFamily.fetch("sensor-1"))

  // Waiting state
  expect(getByText(/loading/i)).toBeInTheDocument()

  // Success state
  await waitFor(() => expect(getByText(/22.5°C/i)).toBeInTheDocument())
})
```

**Performance Tests**: Measure render performance under high-frequency updates
```typescript
it('handles 100 sensors at 20Hz without frame drops', async () => {
  const { container } = render(<SensorGrid />)

  // Simulate 100 sensors updating at 20Hz (2000 updates/sec)
  const emitter = new SensorEmitter(100, 50) // 50ms = 20Hz
  emitter.start()

  // Measure FPS over 5 seconds
  const fps = await measureFPS(5000)
  expect(fps).toBeGreaterThan(55) // Target: maintain 60fps
})
```

## Metadata

- **Tier**: isolated
- **Reviewers**: []
- **Related ADRs**:
  - ADR-S8 (State — Atoms & Result pattern)
  - ADR-S8-S9 (State-to-React subscription binding)
- **Supersedes**: -
- **Superseded By**: -

---

**References**:
- TMNL Cursor component: `src/lib/cursor/components/Cursor.tsx`
- TMNL FermionTestbed (IoT sensors): `src/components/testbed/FermionTestbed.tsx`
- React.memo docs: https://react.dev/reference/react/memo
- effect-atom useAtomValue: https://github.com/tim-smart/effect-atom
