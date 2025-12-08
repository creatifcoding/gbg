---
name: effect-patterns
description: Effect-TS pattern reference for TMNL. Invoke when implementing services, schemas, atoms, or Effect-based architecture. Provides canonical file locations and pattern precedents.
model_invoked: true
triggers:
  - "Effect"
  - "Effect-TS"
  - "Schema"
  - "Layer"
  - "service"
  - "atom"
  - "effect-atom"
---

# Effect-TS Patterns for TMNL

## CRITICAL DOCTRINE: Atom-as-State

**NO EFFECT.REF. EVER.**

When React is the consumer via effect-atom, `Atom.make()` is the primary state mechanism—not `Effect.Ref` inside services.

- Service methods mutate Atoms directly (`Atom.set`)
- React subscribes directly to atoms
- This eliminates the Ref→Atom bridge: no polling, no SubscriptionRef, no streams-to-consume-streams

## Canonical Sources

### Effect-TS Core Documentation
- **Submodule**: `../../submodules/effect/` (from packages/tmnl)
- **Website docs**: `../../submodules/website/` (human-authored, battle-tested)
- **Test patterns**: `../../submodules/effect/packages/*/test/*.test.ts`

### effect-atom Documentation
- **Submodule**: `../../submodules/effect-atom/`
- **Test patterns**: `../../submodules/effect-atom/packages/atom/test/*.test.ts`

### TMNL Implementations
- **Slider system**: `src/lib/slider/` (Effect.Service + Atom.runtime)
- **Data Manager**: `src/lib/data-manager/v1/` (canonical service pattern)
- **Layer system**: `src/lib/layers/` (legacy, being migrated)
- **Pattern registry**: `.edin/EFFECT_PATTERNS.md`

## Pattern Lookup Protocol

1. **Check submodules first** - Real code beats documentation
2. **Check TMNL implementations** - Battle-tested patterns in context
3. **Check .edin/EFFECT_PATTERNS.md** - Curated registry
4. **Query deepwiki** - Ask "Effect-TS/effect" for verification

## Core Patterns

### Pattern 1: Effect.Service Declaration

Services are interfaces. Layers provide implementations.

```typescript
import { Context, Effect, Layer } from 'effect'

// 1. Define the service interface
interface MyService {
  readonly doThing: (input: string) => Effect.Effect<Output, MyError>
}

// 2. Create the service tag
class MyService extends Context.Tag('app/MyService')<
  MyService,
  MyService
>() {}

// 3. Create the implementation
const myServiceImpl: MyService = {
  doThing: (input) => Effect.gen(function* () {
    // implementation
    return output
  })
}

// 4. Create the Layer
const MyServiceLive = Layer.succeed(MyService, myServiceImpl)

// 5. Export for composition
export { MyService, MyServiceLive }
```

**Canonical source**: `src/lib/slider/services/SliderBehavior.ts`

### Pattern 2: Atom-as-State (THE State Pattern)

When React consumes Effect services, Atoms ARE the state.

```typescript
import { Atom } from '@effect-rx/rx-react'
import { Effect, Layer } from 'effect'

// State lives in Atoms, NOT Refs
const resultsAtom = Atom.make<SearchResult[]>([])
const statusAtom = Atom.make<'idle' | 'loading' | 'complete'>('idle')

// Service methods mutate Atoms directly
interface SearchService {
  readonly search: (query: string) => Effect.Effect<void>
}

const searchServiceImpl: SearchService = {
  search: (query) => Effect.gen(function* () {
    Atom.set(statusAtom, 'loading')
    Atom.set(resultsAtom, [])

    const results = yield* performSearch(query)

    Atom.set(resultsAtom, results)
    Atom.set(statusAtom, 'complete')
  })
}

// React subscribes directly
function SearchResults() {
  const results = useAtomValue(resultsAtom)
  const status = useAtomValue(statusAtom)
  return <Grid data={results} loading={status === 'loading'} />
}
```

**Canonical source**: `src/lib/data-manager/v1/DataManager.ts`

### Pattern 3: Atom.runtime for Service Composition

Combine service layers with reactive atoms.

```typescript
import { Atom } from '@effect-rx/rx-react'
import { Layer } from 'effect'

// Create runtime from composed layers
export const dataManagerRuntime = Atom.runtime(
  Layer.mergeAll(
    SearchKernel.Live,
    StreamService.Live,
    DataManager.Live
  )
)

// Create operation atoms
export const searchAtom = dataManagerRuntime.fn(
  (query: string) => Effect.gen(function* () {
    const dm = yield* DataManager
    yield* dm.search(query)
  })
)

// React usage
function SearchBox() {
  const doSearch = useAtomCallback(searchAtom)
  return <input onChange={e => doSearch(e.target.value)} />
}
```

**Canonical source**: `src/lib/slider/atoms/index.ts`

### Pattern 4: Schema.TaggedStruct for Events

All domain events use discriminated unions with `_tag`.

```typescript
import { Schema } from 'effect'

const SearchStarted = Schema.TaggedStruct('SearchStarted', {
  query: Schema.String,
  timestamp: Schema.DateFromSelf,
})

const SearchCompleted = Schema.TaggedStruct('SearchCompleted', {
  query: Schema.String,
  resultCount: Schema.Number,
  durationMs: Schema.Number,
})

const SearchEvent = Schema.Union(SearchStarted, SearchCompleted)
type SearchEvent = typeof SearchEvent.Type

// Pattern match on _tag
function handle(event: SearchEvent) {
  switch (event._tag) {
    case 'SearchStarted': return startSpinner()
    case 'SearchCompleted': return showResults(event.resultCount)
  }
}
```

**Canonical source**: `src/lib/data-manager/v1/types.ts`

### Pattern 5: Schema.TaggedClass for Entities

Entities with methods use TaggedClass.

```typescript
import { Schema } from 'effect'

class GridColumn extends Schema.TaggedClass<GridColumn>()('GridColumn', {
  field: Schema.String,
  headerName: Schema.String,
  width: Schema.optional(Schema.Number),
  sortable: Schema.optional(Schema.Boolean),
}) {
  get displayWidth() {
    return this.width ?? 150
  }

  withWidth(width: number) {
    return new GridColumn({ ...this, width })
  }
}
```

**Canonical source**: `src/lib/data-grid/types.ts`

### Pattern 6: Effect.withSpan for Observability

Traced operations for DevTools visibility.

```typescript
const search = (query: string) =>
  Effect.gen(function* () {
    yield* Effect.log(`Searching: ${query}`)
    const results = yield* searchKernel.query(query)
    return results
  }).pipe(
    Effect.withSpan('DataManager.search', {
      attributes: { query, timestamp: Date.now() }
    })
  )
```

**Canonical source**: `src/lib/data-manager/v1/DataManager.ts`

### Pattern 7: Layer Composition

Compose layers for dependency injection.

```typescript
// Individual service layers
const IdGeneratorLive = Layer.succeed(IdGenerator, nanoidGenerator)
const FactoryLive = Layer.effect(Factory, makeFactory).pipe(
  Layer.provide(IdGeneratorLive)
)
const ManagerLive = Layer.effect(Manager, makeManager).pipe(
  Layer.provide(FactoryLive)
)

// Compose into single runtime layer
const AppLayer = Layer.mergeAll(
  IdGeneratorLive,
  FactoryLive,
  ManagerLive
)

// Use with Atom.runtime
const appRuntime = Atom.runtime(AppLayer)
```

**Canonical source**: `src/lib/layers/index.ts`

### Pattern 8: Error Handling with Tagged Errors

Domain errors as tagged structs.

```typescript
import { Schema, Data } from 'effect'

class SearchError extends Data.TaggedError('SearchError')<{
  readonly query: string
  readonly cause: unknown
}> {}

class IndexNotReadyError extends Data.TaggedError('IndexNotReadyError')<{
  readonly kernel: string
}> {}

// Usage
const search = (query: string) =>
  Effect.gen(function* () {
    if (!indexed) {
      yield* Effect.fail(new IndexNotReadyError({ kernel: 'flex' }))
    }
    // ...
  })

// Pattern match errors
Effect.catchTags({
  SearchError: (e) => Effect.log(`Search failed: ${e.query}`),
  IndexNotReadyError: (e) => Effect.log(`Index ${e.kernel} not ready`),
})
```

## Filing New Patterns

When you discover or create a new Effect pattern:

1. **Implement in TMNL first** - Working code in `src/lib/`
2. **Add to registry** - Update `.edin/EFFECT_PATTERNS.md`
3. **Update this skill** - Add pattern with canonical source
4. **Create bead** - Track with `bd create --type=task --title="Document X pattern"`

## Anti-Patterns (BANNED)

### Effect.Ref for React State
```typescript
// BANNED - Do not do this
const stateRef = yield* Ref.make<State>(initial)
// ...poll ref, bridge to atom, complexity explosion
```

### Streams-to-Consume-Streams
```typescript
// BANNED - SubscriptionRef → Stream → consume → update atom
// Just use Atom.set directly in service methods
```

### useState for Cross-Component State
```typescript
// BANNED when state crosses boundaries
const [results, setResults] = useState([])
const [status, setStatus] = useState('idle')
// Use Atom.make + service methods instead
```

## Related Ecosystem

- **Agent**: `.claude/agents/effect-specialist.md` (TODO)
- **Command**: `.claude/commands/effect.md` (TODO)
- **Hook**: `.claude/hooks/effect-patterns.json` (TODO)
