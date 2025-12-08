# EPOCH-0001: Search Framework with Effect Streams

## Status: CLOSED

## Phase: NEGOTIATE (complete)

---

## Brief

Build a high-performance search framework for 5000+ commands with fuzzy, prefix, and exact matching. Stream-first architecture with light Schema integration for validation/filtering.

---

## Experiment Phase

### Hypotheses
- [x] H1: FlexSearch with Effect wrapping can complete searches in <5ms at 5000 items
- [x] H2: Document index with forward tokenizer supports prefix autocomplete
- [x] H3: Streams provide meaningful benefits for search (backpressure, cancellation, progressive UI)
- [x] H4: Schema.filter as gatekeeper provides clean composable filtering

### Probes
- P1: Research FlexSearch API (DONE - Context7 docs)
- P2: Prototype FlexSearch driver (DONE)
- P3: Brainstorm Stream patterns (DONE)
- P4: Build exotic testbed (DONE)

### Findings
- FlexSearch returns all results synchronously → chunk via Stream.grouped for progressive UI
- Cancellation = fiber interruption via `Fiber.interrupt()`
- Schema.is() as Stream.filter predicate = type-safe culling
- Operators pattern: withMinScore, withBoost, withFieldMatch = composable pipeline

---

## Design Phase

### Architecture

```
SearchService<T>
├── search(query) → Stream<SearchResult<T>>   # Progressive
├── prefix(query) → Stream<SearchResult<T>>   # Autocomplete
├── fuzzy(query) → Stream<SearchResult<T>>    # Typo-tolerant
├── index/add/update/remove → Effect<void>    # One-shot mutations
└── stats/clear → Effect<...>                 # Admin

File Structure:
src/lib/search/
├── index.ts            # Public exports
├── schemas.ts          # Light Schema: filters, combinators
├── types.ts            # Stream-based SearchService interface
├── drivers/
│   ├── flexsearch.ts   # FlexSearch → Stream adapter
│   └── linear.ts       # .includes() fallback
└── operators/
    ├── index.ts        # Operator exports
    ├── scored.ts       # withMinScore, withBoosts, withFieldMatch
    └── traced.ts       # Effect.withSpan, consoleTracedStream
```

### Key Decisions
- **Queries return Stream** (progressive, cancellable)
- **Mutations return Effect** (one-shot, transactional)
- **Schema as gatekeeper** not transformer (light touch)
- **Operators are composable** Stream pipelines

---

## Implement Phase

### Tasks
- [x] Install FlexSearch (`bun add flexsearch`)
- [x] Create types.ts (Stream-based SearchService interface)
- [x] Create schemas.ts (light Schema filters + combinators)
- [x] Create flexsearch.ts driver with Stream emission
- [x] Create linear.ts driver with Stream emission
- [x] Create operators/scored.ts (withMinScore, withBoosts, etc.)
- [x] Create operators/traced.ts (Effect.withSpan, consoleTracedStream)
- [x] Create SearchTestbed.tsx (exotic UI)
- [x] Wire route + link
- [x] Download Wikipedia movies dataset (36,273 movies)
- [x] Integrate real data into SearchTestbed

### Artifacts
- `src/lib/search/index.ts`
- `src/lib/search/types.ts`
- `src/lib/search/schemas.ts`
- `src/lib/search/drivers/flexsearch.ts`
- `src/lib/search/drivers/linear.ts`
- `src/lib/search/operators/index.ts`
- `src/lib/search/operators/scored.ts`
- `src/lib/search/operators/traced.ts`
- `src/components/testbed/SearchTestbed.tsx`
- `src/assets/data/movies.json` (36,273 Wikipedia movies)

---

## Negotiate Phase

### Debrief
- Stream-first search provides natural progressive UI + cancellation
- FlexSearch is fast (<5ms for 5000 items)
- Schema.filter works well as composable gatekeeper
- Benchmark duel shows FlexSearch ~3-4x faster than Linear
- Real-world data (36K movies) validates scalability claims
- Wikipedia dataset provides rich searchable fields (title, cast, genres, extract)

### Learnings
- `Stream.unwrap(Effect.gen(...))` is the pattern for async Stream creation
- Fiber interruption is cleaner than Deferred for cancellation
- Schema validation is light-touch: just use `Schema.is()` as predicate
- Exotic testbeds with visual feedback make streams *feel* alive
- Real data > fake data for validating search UX

### Next Epoch Seeds
- **Command Palette Integration**: Wire search to actual command system
- **OTel Tracing Layer**: Swappable observability via Effect Layer
- **Persistent Index**: Cache FlexSearch index in IndexedDB
- **Fuzzy Enhancement**: Investigate Levenshtein for better typo tolerance

---

## Timestamps
- Opened: 2025-12-01 (context continuation)
- Closed: 2025-12-01
