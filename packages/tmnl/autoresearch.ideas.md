# Autoresearch Ideas — Formula DSL Stack VM

## ✅ COMPLETE — 68 experiments, 328 tests, 70 opcodes

Production: stack-vm.ts (1,700+ LOC) + vm-cell-bridge.ts + dep-graph.ts + formula-engine-v2.ts = ~2,600 LOC
Tests: ~5,000 LOC across 6 files (328 tests), 80 spike tests

Architecture highlights:
- Flat EXEC dispatch table (68 entries, O(1))
- _OP singleton interning (47 parameterless opcodes)
- VMValue interning (bool singletons, num(-1..100) cache)
- runIRBatched: single TxRef read/write per program (was 2N)
- Peephole optimizer: constant folding (binary + unary), dead code elimination
- Infix shunting-yard: nested functions, operator precedence, ranges, booleans
- FUNCTION_CATALOG: 38 entries with autocomplete support
- FormulaEngineV2: register/validate/recalcDirty/recalcAll, named ranges, volatile

## 🔜 NEXT — Remaining high-value work

### Wire FormulaEngineV2 into production
- Replace FormulaConsistency's dependency on old FormulaEngine
- Wire registerInfix as primary formula input path
- Connect to CellCache atoms for reactive UI updates
- #1 remaining task for production readiness

### Error recovery in formulas
- =IFERROR chain: graceful degradation in multi-cell recalc
- Partial recalc: skip errored cells, continue with others
- Error reporting: collect all errors, not just first

### Conditional formatting via formulas
- =IF(A1>100, "red", "green") style rules evaluated by FormulaEngineV2
- Cell renderer reads format from formula result

### Array formulas / ARRAYFORMULA
- =ARRAYFORMULA(A1:A10 * B1:B10)
- Element-wise operations on ranges

## 📌 DEFERRED
- TxHashMap cell state (needs production wiring first)
- WASM sandbox (Domain B, deferred until core is production-ready)
- COUNTIF/SUMIF (needs criteria parsing — complex)

## 📊 v4 API Gotchas (Reference — 14 discoveries)
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
