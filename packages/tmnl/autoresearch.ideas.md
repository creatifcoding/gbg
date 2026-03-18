# Autoresearch Ideas — Formula DSL Stack VM

## ✅ PROVEN (24 hypotheses, 78/78 tests, 22 v4 modules)

### Core VM: H1–H7
### Trail: H8–H10, H20
### Data: H11–H13, H23
### Architecture: H14–H16
### Concurrency: H17–H19
### Observability: H15, H22
### Integration: H21, H24 (full FormulaEngine service)

## 🧩 POST-SPIKE — Production Extraction

### Extract to `packages/datagrid/src/services/stack-vm.ts`
- ServiceMap.Service interface: eval(ir), evalExpr(str), evalEffect(program)
- Layer.effect wiring: Cache + Metric + Semaphore + Span + Timeout
- Config via service: max concurrency, cache size/ttl, eval timeout

### Cell state: TxHashMap<CellAddr, CellValue>
- Multi-cell reads/writes in single Effect.transaction
- TxRef for VM stack, TxQueue for trail — all atomic

### Dependency recalc: Graph + topo order
- Graph.directed for dep DAG, reversed topo for eval order
- isAcyclic check on formula entry
- Semaphore.withPermits for throttled parallel recalc

### WASM sandbox: Pool + Scope + acquireRelease
- Pool.make for QuickJS-WASM instances
- acquireRelease for lifecycle, addFinalizer for cleanup
- timeout for untrusted code safety

### Observability: Metric + Span
- counter(eval_count), histogram(latency), gauge(cache_size)
- withSpan per pipeline stage: compile → validate → execute → trail

## 📊 v4 API Gotchas (Complete — 14 discoveries)
| Wrong | Correct |
|---|---|
| `Schema.Union(A, B, C)` | `Schema.Union([A, B, C])` |
| `Schema.Record({key, value})` | `Schema.Record(key, value)` |
| `TxRef.make()` outside tx | Inside `Effect.transaction()` only |
| `Effect.yieldNow()` | `Effect.yieldNow` (value) |
| `Result.value` | `Result.success` / `.failure` |
| `Optic.at().get()` | `Optic.at().getResult()` (Optional) |
| `Effect.catchAll(f)` | **`Effect.catch(f)`** |
| `Effect.catchAllCause` | `Effect.catchCause` |
| `Effect.fork(e)` | **`Effect.forkChild(e)`** |
| `Graph.topo()` order | Dependents-first; **reverse** for eval |
| `TxQueue.unbounded()` | Requires `Effect.Transaction` |
| `Pool.make()` | Requires `Scope` |
| `TxHashMap.make([tuples])` | **`TxHashMap.make(...spread)`** |
| `Semaphore.make(n)` | Returns `Effect<Semaphore>` (yield*) |
