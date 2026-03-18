# Autoresearch Ideas — Formula DSL Stack VM

## Deferred Optimizations & Enhancements

### JsonPatch Trail (JSONL patches for ops)
- **Effect v4 has `JsonPatch` module** (RFC 6902 subset): `add`, `remove`, `replace` ops
- **`Schema.toDifferJsonPatch(schema)`** creates type-safe differs: `.diff(old, new)` → patch, `.patch(old, patch)` → new
- Trail entries as JSONL: one JSON object per line, each is a `JsonPatchOperation[]` diff from prev state
- Could replace `[...trail, entry]` O(n) copy with append-only JSONL file/stream
- `JsonPointer` for targeting specific stack positions: `/stack/0`, `/registers/acc`
- **Utility package idea**: `@tmnl/jsonl-patch` — small module for JSONL patch streaming, replay, compaction
- Integrates naturally with EventLog (events ARE patches) and PubSub (broadcast patches to observers)

### Graph Module for Cell Dependencies
- `Graph.directed<CellAddress, EdgeData>()` for dependency DAG
- `Graph.topo()` — Kahn's algorithm for recalc order
- `Graph.isAcyclic()` — detect circular references at formula entry time
- `Graph.dfsPostOrder()` — evaluate dependencies bottom-up
- `Graph.mutate()` for incremental updates when formulas change

### Optic for Stack Access
- `Optic.id<VMState>().key("stack").at(0)` — focus on stack top
- `.key("registers").key("acc")` — focus on accumulator register
- `.forEach(item => item.tag("num").key("value"))` — traverse all numeric values in stack
- Compose with TxRef for transactional lens updates

### Cache for Memoized Formulas
- `Cache.make({ capacity: 1000, timeToLive: Duration.seconds(30), lookup: evalFormula })`
- Cache by formula string hash → VMState result
- `cache.invalidate(key)` when dependencies change
- `ScopedCache` for WASM instance pooling

### Metric for Formula Engine Observability  
- `Metric.counter("formula.eval.count")` — how many evals
- `Metric.histogram("formula.eval.latency_ms", MetricBoundaries.exponential(...))` — latency distribution
- `Metric.gauge("formula.cache.size")` — current cache occupancy
- `Metric.trackDuration(latencyHistogram)` aspect on eval pipeline
- `Effect.tagMetrics("formula_type", "ir" | "effect" | "string")` per eval type

### PubSub for Trail Observation
- `PubSub.unbounded<TrailEntry>()` — broadcast trail events
- `Stream.fromPubSub(pubsub)` — subscribers get Stream<TrailEntry>
- `TxPubSub` for transactional publish (publish commits with eval transaction)
- Multiple observers: debug panel, undo stack, CRDT sync, analytics

### EventLog for Append-Only Audit
- `Event.make({ tag: "OpExecuted", payload: Schema.Struct({...}), primaryKey: ... })`
- EventJournal for persistence (memory, IndexedDB, SQL)
- Compaction: snapshot state, compact older events
- Replay: rebuild VM state from event stream

### ServiceMap.Service for VM Engine
- `class StackVM extends ServiceMap.Service<StackVM, { eval: ..., getState: ... }>()(...)` 
- Static `layer` with configurable behaviors (sandbox mode, max steps, etc.)
- `Layer.mergeAll(StackVM.layer, CellCache.layer, DependencyGraph.layer)` for full engine

### Scope/Finalizer for WASM Sandbox
- `Effect.acquireRelease(initQuickJS, cleanupQuickJS)` — lifecycle management
- `Effect.scoped(program)` — auto-cleanup when eval completes
- `Pool` for WASM instance reuse across evaluations
- `Semaphore` for limiting concurrent WASM evaluations

### Schema.TaggedUnion for Opcode Dispatch
- `Schema.TaggedUnion({ PUSH_NUM: { value: Schema.Number }, ... })` — built-in `.match()` method
- Replaces manual `Match.type<Opcode>()` + `Match.tagsExhaustive({...})` pattern
- Cleaner API: `Opcode.match(op, { PUSH_NUM: (o) => ..., ... })`
