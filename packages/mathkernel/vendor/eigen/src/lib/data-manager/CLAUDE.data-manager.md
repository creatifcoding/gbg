# DataManager Architecture

## Overview

DataManager is TMNL's data orchestration layer, built on Effect-TS and effect-atom. It implements a **Materialized Views Pattern** where:

- **Atoms** are the published views (module-level singletons)
- **DataManager** is the sole publisher (owns the contract)
- **Components** are subscribers (consume via `useAtomValue`)

This is NOT "atoms inside a service" - the atoms are external declarations, but DataManager owns the responsibility to update them.

## Core Concepts

### Materialized Views Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DataManager Service                          │
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│  │ SearchKernel│     │ IndexKernel │     │ Future...   │          │
│  │ (FlexSearch)│     │ (batching)  │     │             │          │
│  └──────┬──────┘     └──────┬──────┘     └─────────────┘          │
│         │                   │                                       │
│         └─────────┬─────────┘                                       │
│                   │                                                 │
│                   ▼                                                 │
│         ┌─────────────────┐                                        │
│         │  Atom.set()     │  ◄── Publisher                         │
│         └────────┬────────┘                                        │
└──────────────────┼──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Materialized View Atoms (Module-Level)                 │
│                                                                     │
│  resultsAtom ─────────────────────────────────────► Component A    │
│  statusAtom  ─────────────────────────────────────► Component B    │
│  statsAtom   ─────────────────────────────────────► Component C    │
│                                                                     │
│  (Multiple components can share the same view = same subscription) │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Pattern?

1. **Single Source of Truth**: Atoms ARE the state. No Effect.Ref ↔ Atom sync issues.

2. **Decoupled Publishing**: DataManager doesn't need to know who subscribes. It just publishes.

3. **Shared Views**: Multiple components subscribe to the same atom = same data, no duplication.

4. **Progressive Updates**: Search streams update atoms incrementally, React re-renders progressively.

5. **Effect Composition**: Operations are Effect programs with full tracing, error handling, and interruption.

## File Structure

```
src/lib/data-manager/
├── v1/
│   ├── atoms/
│   │   └── index.ts          # Materialized view atoms + operation atoms
│   ├── kernels/
│   │   ├── index.ts          # Kernel exports
│   │   ├── SearchKernel.ts   # FlexSearch/Linear driver wrapper
│   │   └── types.ts          # Kernel-specific types
│   ├── DataManager.ts        # Core service (may be simplified)
│   └── types.ts              # Shared types
└── CLAUDE.data-manager.md    # This file
```

## Atoms Reference

### Materialized Views (Read-Only)

| Atom | Type | Description |
|------|------|-------------|
| `resultsAtom` | `SearchResult<unknown>[]` | Progressive search results |
| `statusAtom` | `StreamStatus` | idle \| streaming \| complete \| error |
| `statsAtom` | `StreamStats` | chunks, items, ms |
| `driversAtom` | `DriverState` | flex/linear availability |
| `isIndexingAtom` | `boolean` | Index operation in progress |
| `queryAtom` | `string` | Current search query |

### Derived Atoms (Computed)

| Atom | Type | Derivation |
|------|------|------------|
| `isSearchingAtom` | `boolean` | `status === "streaming"` |
| `hasResultsAtom` | `boolean` | `results.length > 0` |
| `resultCountAtom` | `number` | `results.length` |
| `throughputAtom` | `number` | `(items / ms) * 1000` |

### Operation Atoms (Mutations)

```typescript
// Search
searchOps.search({ query: "matrix", limit: 100 })

// Set driver
searchOps.setDriver("linear")

// Index
indexOps.index({ items: movies, fields: ["title", "cast"] })
```

## Usage Patterns

### Basic Component Subscription

```tsx
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'
import { resultsAtom, statusAtom, searchOps } from '@/lib/data-manager/v1/atoms'

function SearchResults() {
  const results = useAtomValue(resultsAtom)
  const status = useAtomValue(statusAtom)
  const doSearch = useAtomSet(searchOps.search)

  const handleSearch = () => {
    doSearch({ query: "matrix", limit: 50 })
  }

  return (
    <div>
      <button onClick={handleSearch}>Search</button>
      <div>Status: {status}</div>
      <ul>
        {results.map(r => (
          <li key={r.item.id}>{r.item.title} ({r.score})</li>
        ))}
      </ul>
    </div>
  )
}
```

### Derived State

```tsx
import { useAtomValue } from '@effect-atom/atom-react'
import { isSearchingAtom, throughputAtom } from '@/lib/data-manager/v1/atoms'

function SearchMetrics() {
  const isSearching = useAtomValue(isSearchingAtom)
  const throughput = useAtomValue(throughputAtom)

  return (
    <div>
      {isSearching ? 'Searching...' : 'Idle'}
      {throughput > 0 && `${throughput.toFixed(0)} items/sec`}
    </div>
  )
}
```

### Multiple Subscribers (Shared View)

```tsx
// ComponentA.tsx
const results = useAtomValue(resultsAtom)  // ← Same atom

// ComponentB.tsx
const results = useAtomValue(resultsAtom)  // ← Same view, no duplication

// Both components see the same data, update together
```

## SearchKernel

The SearchKernel wraps FlexSearch and Linear search drivers with a unified interface.

### Capabilities

- **FlexSearch Driver**: Fast, fuzzy, in-memory indexing (default)
- **Linear Driver**: Simple iteration, exact match (fallback)
- **Hot Path Execution**: `executeHot()` skips tracing for performance
- **Worker Dispatch**: `executeInWorker()` for CPU-heavy operations (planned)

### Index Configuration

```typescript
yield* kernel.index(items, {
  fields: ['title', 'cast', 'genres'],  // Fields to index
  getId: (item) => String(item.id),     // ID extractor
})
```

## Types

```typescript
// Search result with score
interface SearchResult<T> {
  item: T
  score: number
  matches?: { field: string; indices: [number, number][] }[]
}

// Stream status
type StreamStatus = 'idle' | 'streaming' | 'complete' | 'cancelled' | 'error'

// Stream statistics
interface StreamStats {
  chunks: number
  items: number
  ms: number
}

// Search query
interface SearchQuery {
  query: string
  limit?: number
  chunkSize?: number
}
```

## Testing

The testbed at `/testbed/data-manager` validates:

- **H1**: effect-atom state flows to AG-Grid rowData
- **H2**: Progressive stream updates trigger grid re-renders
- **H3**: Service-scoped atoms eliminate useState for data
- **H4**: Throughput atom provides real-time metrics
- **H5**: Driver switching (flex/linear) is seamless

## Design Decisions

### Why Module-Level Atoms?

Atoms declared at module level are singletons. This ensures:
- All components share the same subscription
- No atom recreation on re-render
- Predictable identity for derived atoms

### Why Atom.set() Inside Effects?

`Atom.set()` is synchronous and side-effectful. Inside an Effect:
- It's a controlled side effect
- The Effect context provides error boundaries
- Tracing captures the operation context

### Why Not Effect.Ref?

Effect.Ref is great for service-internal state, but:
- Doesn't integrate with React's subscription model
- Requires bridging code to sync with atoms
- Adds complexity without benefit for UI state

## ⚠️ Antipatterns Discovered

### DM-001: Atom.runtime(Layer) + Stateful Services

**Severity**: Critical | **Status**: Fixed

**Problem**: `Atom.runtime(Layer)` with services that use `Effect.Ref` internally creates **fresh state per operation**.

```typescript
// ❌ ANTIPATTERN: Layer-per-operation isolation
const runtimeAtom = Atom.runtime(SearchKernel.Default)
const searchOps = {
  search: runtimeAtom.fn<Query>()((query, ctx) =>
    Effect.gen(function*() {
      const kernel = yield* SearchKernel // ← Fresh instance!
      return yield* kernel.search(query) // ← Empty driver!
    })
  )
}
```

**Failure Scenario**:
1. `doIndex()` → Creates Kernel#1, indexes 10k movies into Kernel#1.flexDriver
2. `doSearch()` → Creates Kernel#2 with EMPTY flexDriver (Ref.make() = fresh)
3. Search returns 0 results because Kernel#2 was never indexed

**Fix**: Use **direct driver pattern** with React state:

```typescript
// ✅ CORRECT: Direct driver pattern
const [driver, setDriver] = useState<SearchServiceImpl | null>(null)

useEffect(() => {
  const init = async () => {
    const flex = await Effect.runPromise(createFlexSearchDriver())
    await Effect.runPromise(flex.index(items, config))
    setDriver(flex) // ← Persists across operations
  }
  init()
}, [])

// Use Effect.runFork for streaming with Fiber cancellation
const handleSearch = () => {
  const fiber = Effect.runFork(
    Stream.runForEach(driver.search(query), (result) =>
      Effect.sync(() => setResults(prev => [...prev, result]))
    )
  )
}
```

**Reference**: See `SearchTestbed.tsx` for the proven pattern. See `DataManagerTestbed.tsx` for full documentation including `DamageReportPanel` component.

### DM-002: Hypothesis Tracking: Function Call vs Outcome

**Severity**: Warning | **Status**: Fixed

**Problem**: Hypotheses marked "passed" despite grid showing 0 rows. Tracked "function was called" not "outcome achieved".

```typescript
// ❌ ANTIPATTERN: Track function call
useEffect(() => {
  if (gridData) {  // ← gridData exists (even if empty [])
    updateHypothesis('H1', 'passed')  // ← FALSE POSITIVE
  }
}, [gridData])

// ✅ CORRECT: Verify actual outcome
useEffect(() => {
  if (gridData.length > 0) {  // ← Actually has results
    updateHypothesis('H1', 'passed', `${gridData.length} rows in grid`)
  }
}, [gridData, updateHypothesis])
```

**Fix Checklist**:
- H1: `gridData.length > 0` (not "setGridData was called")
- H2: `progressiveUpdateCount > 1` (not "setState in stream callback")
- H4: `throughput > 0 && stats.items > 0` (actual metrics)
- H5: Run search after driver switch and verify results

## Future Work

1. **IndexKernel**: Batch indexing with progress tracking
2. **CacheKernel**: LRU caching of search results
3. **Worker Dispatch**: True off-thread execution for heavy ops
4. **Multiple Views**: Named views for different query contexts
5. **Persistence**: Optional persistence of indexed data

## Related

- `CLAUDE.md` - Main project instructions
- `/testbed/data-manager` - Interactive testbed
- `effect-atom` - Reactive state library
- `FlexSearch` - Full-text search engine
