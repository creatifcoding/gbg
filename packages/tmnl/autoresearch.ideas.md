# Autoresearch Ideas — Formula DSL Stack VM

## ✅ DONE (prune — no longer actionable)

- 25 hypotheses proven, 80 spike tests, 22 Effect v4 modules
- Production services: stack-vm.ts, vm-cell-bridge.ts, dep-graph.ts, formula-engine-v2.ts
- READ_CELL/WRITE_CELL + CellContext, A1 compiler, extractDeps/extractDepsFromIR
- FormulaEngineV2: register/registerInfix/recalcDirty/recalcAll
- Infix shunting-yard parser: precedence, functions, ranges, parens
- READ_RANGE + dynamic aggregates (SUM/MIN/MAX/AVG/COUNT)_DYN
- Unary minus, string literals, & concat operator
- Comparison operators < > in infix
- POWER/COUNT_DYN/ROUND/FLOOR/CEIL opcodes (38 total)
- Flat EXEC dispatch table replacing Match+if-else ladder

## 🔜 NEXT — High-value paths

### Comparison operators: >=, <=, != in infix
- Tokenizer needs 2-char lookahead for >= <= !=
- Maps to GTE/LTE/NEQ opcodes (or compound: NOT+LT for GTE)
- Common spreadsheet need, cheap to add

### Multi-char column support in READ_RANGE
- Currently READ_RANGE only handles single-char cols (A-Z)
- Should support AA1:AZ100 like the compiler already handles for READ_CELL
- Expand range iteration to use column index math

### Nested function calls: =SUM(A1, MAX(B1:B3))
- Currently functions only accept flat args or ranges
- Shunting-yard needs function arg tracking to handle nested calls
- Key for production-grade formulas

### Boolean literals in infix: =IF(TRUE, A1, B1)
- Tokenizer should recognize TRUE/FALSE keywords
- Maps to PUSH_BOOL

### Wire FormulaEngineV2 into production
- Replace FormulaConsistency's dependency on old FormulaEngine
- Wire registerInfix as the primary formula input path
- Connect to CellCache atoms for reactive UI updates

### Error function: =IFERROR(A1/B1, 0)
- Common spreadsheet pattern for error handling
- VM already has isVMError — needs IFERROR opcode
- Pop 2: value, fallback. If value is error, push fallback

## 📌 DEFERRED — Lower priority

### TxHashMap cell state (production)
- Replace Map<string, CellValue> with TxHashMap inside Effect.transaction
- Multi-cell atomic reads/writes for bulk paste, undo
- Blocked on: need production wiring first

### WASM sandbox (Domain B)
- Pool.make for QuickJS-WASM instances
- Deferred until core formula DSL is production-ready

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
