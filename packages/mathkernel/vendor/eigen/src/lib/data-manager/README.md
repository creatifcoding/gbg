# DataManager

Reactive data orchestration for TMNL, built on Effect-TS and effect-atom.

## Quick Start

```tsx
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'
import {
  resultsAtom,
  statusAtom,
  searchOps,
  indexOps
} from '@/lib/data-manager/v1/atoms'

function MySearch() {
  const results = useAtomValue(resultsAtom)
  const status = useAtomValue(statusAtom)
  const search = useAtomSet(searchOps.search)
  const index = useAtomSet(indexOps.index)

  // Index data on mount
  useEffect(() => {
    index({ items: myData, fields: ['title', 'description'] })
  }, [])

  // Search
  const handleSearch = (query: string) => {
    search({ query, limit: 100 })
  }

  return (
    <div>
      <input onChange={e => handleSearch(e.target.value)} />
      <div>Status: {status} | Results: {results.length}</div>
      <ul>
        {results.map(r => <li key={r.item.id}>{r.item.title}</li>)}
      </ul>
    </div>
  )
}
```

## Atoms

### State Atoms

| Atom | Type | Description |
|------|------|-------------|
| `resultsAtom` | `SearchResult[]` | Search results |
| `statusAtom` | `StreamStatus` | idle / streaming / complete / error |
| `statsAtom` | `StreamStats` | { chunks, items, ms } |
| `queryAtom` | `string` | Current query |
| `isIndexingAtom` | `boolean` | Indexing in progress |

### Derived Atoms

| Atom | Type |
|------|------|
| `isSearchingAtom` | `boolean` |
| `hasResultsAtom` | `boolean` |
| `resultCountAtom` | `number` |
| `throughputAtom` | `number` (items/sec) |

### Operations

```typescript
// Search
searchOps.search({ query: "matrix", limit: 50 })

// Switch driver (flex or linear)
searchOps.setDriver("linear")

// Index data
indexOps.index({
  items: movies,
  fields: ['title', 'cast', 'genres']
})
```

## Architecture

DataManager implements a **Materialized Views Pattern**:

```
DataManager (Publisher)
    │
    ├── Atom.set(resultsAtom, [...])
    ├── Atom.set(statusAtom, "streaming")
    └── Atom.set(statsAtom, {...})
            │
            ▼
    ┌───────────────┐
    │ Atoms (Views) │ ◄── Components subscribe
    └───────────────┘
```

- Atoms are module-level singletons
- DataManager owns the publishing contract
- Multiple components share the same view
- Progressive updates for streaming UX

## Drivers

| Driver | Use Case |
|--------|----------|
| `flex` (default) | Fast fuzzy search via FlexSearch |
| `linear` | Simple exact-match iteration |

## Testbed

Visit `/testbed/data-manager` to experiment with the search interface.

## See Also

- `CLAUDE.data-manager.md` - Detailed architecture docs
- `@/lib/search/drivers/` - Search driver implementations
