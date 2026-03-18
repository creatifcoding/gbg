# Autoresearch Ideas — Formula DSL Stack VM

## ✅ PROVEN (prune — already in spike)
- H2: Schema TaggedStruct unions for opcodes
- H3: Match.tagsExhaustive dispatch
- H8: JSONL patches (Schema.toDifferJsonPatch)
- H9: Schema.TaggedUnion.match()
- H10: PubSub + Stream trail observation
- H11: Optic stack access
- H12: Graph for cell deps (topo sort, cycle detect, mutate)
- H13: Cache memoized formula eval
- H14: ServiceMap.Service for VM engine
- H15: Metric observability (counter, gauge, histogram, snapshot)
- H16: Scope/acquireRelease for sandbox lifecycle

## 🔬 NEXT — Unexplored Effect v4 Modules

### H17: Effect.timeout + fiber cancellation for runaway formulas
- `Effect.timeoutFail(evalProgram, Duration.millis(100))` — kills slow formulas
- `Effect.interruptible` / `Effect.uninterruptible` boundary control
- Proves formula execution can be safely deadline-bounded
- Critical for WASM sandbox: untrusted code MUST be cancellable

### H18: Semaphore for concurrent eval throttling
- `Effect.makeSemaphore(4)` — limit to N concurrent formula evals
- `semaphore.withPermits(1)(evalProgram)` — acquire before eval
- Prevents thread pool exhaustion from bulk formula recalcs
- Pair with Graph topo order for priority scheduling

### H19: Pool for WASM instance reuse
- `Pool.make({ acquire, release, size: 4 })` — WASM instance pool
- `Pool.get(pool)` returns scoped instance, auto-returns on scope close
- Avoids cold-start overhead for repeated sandbox evals
- Builds on H16 (acquireRelease) + H18 (Semaphore)

### H20: Channel for eval pipeline
- `Channel.make<StackIR, VMState>()` — typed input→output pipeline
- Pipeline stages: parse → validate → compile → execute → trail
- `Channel.pipeTo` for composing stages
- Backpressure-aware: slow consumers don't lose events

### H21: TxQueue for append-only trail persistence
- `TxQueue.unbounded<TrailEntry>()` — transactional append
- Commits with eval transaction (TxRef) — trail is consistent with state
- `TxQueue.takeAll` to drain for persistence
- Alternative to PubSub (H10) when durability matters more than broadcast

### H22: Fiber supervision tree for multi-cell recalc
- `Effect.forkChild` for supervised formula fibers
- Parent fiber cancels all children on timeout
- `Fiber.awaitAll([fiber1, fiber2])` — wait for batch
- Supervision tree mirrors dependency graph (H12)

## 🧩 INTEGRATION IDEAS (Post-Spike)

### Extract VM to production service
- Move from test file to `packages/datagrid/src/services/stack-vm.ts`
- Service interface: `eval(ir)`, `evalExpr(str)`, `evalEffect(program)`
- Layer with Cache + Graph + Metric baked in
- Tests move to `packages/datagrid/test/stack-vm.test.ts`

### @tmnl/jsonl-patch utility package
- JSONL streaming: append patch per line, compact on threshold
- Replay: fold patches to reconstruct any state
- `Schema.toDifferJsonPatch` integration for type-safe differs
- Storage adapter: IndexedDB, file, memory

### EventLog for event-sourced formula audit
- `Event.make({ tag: "FormulaEvaluated", payload: ... })`
- EventJournal persistence (memory for dev, SQL for prod)
- Replay + compaction for state reconstruction
- Requires further research on effect-smol unstable/eventlog API

## 📊 v4 API Gotchas (Reference)
- `Schema.Union([array])` not spread
- `Schema.Record(key, value)` positional
- `TxRef.make` inside `Effect.transaction()` only
- `Effect.yieldNow` is a value (no `()`)
- `Result.success` not `.value`; `Result.failure` not `.error`
- `Optic.at()` → Optional (`.getResult()` not `.get()`)
- `Effect.catchAll` → **`Effect.catch`** in v4
- `Effect.catchAllCause` → `Effect.catchCause`
- `Graph.topo()` = dependents-first; reverse for eval order
