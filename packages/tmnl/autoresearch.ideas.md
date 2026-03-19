# Autoresearch Ideas — Formula DSL Stack VM

## ✅ COMPLETE — 80 experiments, 345 tests, 85 opcodes

Production: 2,939 LOC (stack-vm.ts 2,133 + vm-cell-bridge 154 + dep-graph 314 + formula-engine-v2 338)
Tests: 5,151 LOC across 6 files (345 tests: 177 production + 80 spike + 88 engine/integration)

Architecture highlights:
- Flat EXEC dispatch table (O(1) lookup)
- _OP singleton interning (54 parameterless opcodes)
- VMValue interning (bool singletons, num(-1..100) cache)
- evalProgramDirect: zero-Effect-overhead eval (71x faster, 0.17µs/eval)
- runIRBatched: single TxRef read/write per program (was 2N)
- Peephole optimizer: constant folding (binary + unary), dead code elimination
- decompileIR: IR → readable formula (roundtrip)
- Infix shunting-yard: nested functions, operator precedence, ranges, booleans
- FUNCTION_CATALOG: 54 entries with completeFunctions() autocomplete
- FormulaEngineV2: register/validate/recalcDirty/recalcAll, named ranges, volatile, evalProgramDirect

## 🔜 NEXT — Remaining high-value work

### Wire FormulaEngineV2 into production
- Replace FormulaConsistency's dependency on old FormulaEngine
- Wire registerInfix as primary formula input path  
- Connect to CellCache atoms for reactive UI updates
- #1 remaining task for production readiness

### Conditional formatting via formulas
- =IF(A1>100, "red", "green") style rules evaluated by FormulaEngineV2
- Cell renderer reads format from formula result

### Array formulas / ARRAYFORMULA
- =ARRAYFORMULA(A1:A10 * B1:B10)
- Element-wise operations on ranges

### REPLACE/SEARCH (text functions)
- REPLACE(text, start, len, new_text)
- SEARCH(find, within) — case-insensitive version of FIND

### COUNTIF/SUMIF (conditional aggregation)
- Needs criteria parsing: ">5", "abc*", "<>0"
- Complex but high-value for production spreadsheets

## 📌 DEFERRED
- TxHashMap cell state (needs production wiring first)
- WASM sandbox (Domain B, deferred until core is production-ready)

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
