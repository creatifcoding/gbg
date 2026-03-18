# Formula DSL — Pre-Design Document

> **Status:** Active pre-design · **Phase:** Experiment (EDIN)
> **Owner:** Prime + Val · **Created:** 2026-03-15
> **Last Updated:** 2026-03-15

---

## 1. Vision

Build a **stack-based formula computation engine** for `@tmnl/datagrid` where:

- Formulas are **Effect programs** — async, service-aware, schema-validated
- The core engine is an **RPN stack VM** inspired by Emacs calc
- Arbitrary code runs in a **WASM-sandboxed runtime** (QuickJS or equivalent)
- Agents interact via **three distinct API surfaces**: REPL session, Cell RPC, DataFrame operations
- Humans *can* use it but agents are the primary consumers

The existing `FormulaEngine` (subscription bridge, DAG tracking) was a spike. This is the ground-up replacement.

---

## 2. Aligned Design Decisions

These were established via structured decision questionnaire on 2026-03-15.

### 2.1 Stack-Based RPN Computation

**Why stack-based?**
- **Token efficiency** — `A0 B0 + 2 *` is terser than `=(A0+B0)*2`. Agents produce and consume less context.
- **Streaming compatibility** — Operations can be pushed incrementally. A partial stack is a valid intermediate state.
- **Composability** — Stack operations compose naturally. `DUP ROT SWAP` primitives enable complex data flow without named variables.
- **Emacs calc precedent** — Possibly the best formula DSL ever built. Stack + algebraic dual mode. Symbolic algebra on top of stack ops.

**Key Emacs calc patterns to borrow:**
- [ ] Stack display as primary UI (agents see the stack state)
- [ ] Algebraic entry mode as sugar (parsed into stack ops)
- [ ] Trail (computation history / audit log)
- [ ] Units system (dimensional analysis on cell values)
- [ ] Symbolic mode (variables, simplification, differentiation)
- [ ] Macro/keyboard macro recording → agent macro recording

### 2.2 Agent-Primary Consumers

Agents write formulas. The grid is a **programmable data surface**, not a traditional spreadsheet.

**Implications:**
- No formula bar needed in v1
- DSL can be terse and precise — no "user-friendly" syntax tax
- Error messages target developers/agents, not end users
- The eval tool API is the primary interface
- Human-facing algebraic mode is a future layer, not a blocker

### 2.3 Full WASM Sandbox

Untrusted code execution via WASM-isolated JavaScript runtime.

**Candidates to evaluate:**
- [ ] **QuickJS-WASM** — Mature, small footprint, full ES2020. Used by Figma, val.town.
- [ ] **Duktape-WASM** — Smaller but ES5 only. Good for constrained environments.
- [ ] **javy** (Bytecode Alliance) — Compiles JS to WASM AOT. Faster but less dynamic.
- [ ] **Extism** — Plugin framework on top of WASM. Higher-level API.

**Sandbox requirements:**
- No DOM access
- No network access (no fetch, no WebSocket)
- CPU time limit (configurable timeout)
- Memory limit (configurable cap)
- Deterministic execution (same input → same output, for CRDT consistency)
- Cell API exposed as host functions (read cell, write cell, get range)

### 2.4 Effect Programs as Formulas

Formulas are not strings that evaluate to numbers. They are **Effect programs** that:

- Can access services (SchemaRegistry for type validation, CrdtLayer for conflict resolution)
- Can be async (fetch external data, wait for other computations)
- Use Schema for input/output validation
- Have spans for observability (`Effect.withSpan`)
- Can be interrupted (fiber cancellation on cell invalidation)
- Compose with the existing Effect service stack

**Open question:** How does an Effect program live inside a WASM sandbox? The sandbox runs JS, not Effect. The bridge between them is a critical design boundary.

Possible architecture:
```
Agent → DSL string → Parser → Stack IR → Effect program (host) → WASM for JS eval steps
                                                              → Native for Effect steps
```

### 2.5 Three Agent API Surfaces

These are **three distinct system components** to be designed independently:

#### A. REPL Session
- Stateful interactive computation
- Agent opens a session, pushes values onto the stack, executes ops, inspects results, commits
- Stack state persists across operations within a session
- Trail/history for computation audit
- Named registers for intermediate values

#### B. Cell RPC
- Stateless cell manipulation
- `grid.read("A0")` → `CellValue`
- `grid.write("A0", CellNumber(42))`
- `grid.eval("A0", "B0 C0 + 2 *")` → evaluate and store
- `grid.formula("D0", deps: ["A0","B0"], "swap /")`
- Batch operations: `grid.batch([...ops])`

#### C. DataFrame API
- Column-oriented operations
- `grid.col("C").map(row => row.A * row.B)` — but expressed in DSL or JS
- `grid.range("A0:C99").filter(row => row.B > 0).sort("C", "desc")`
- `grid.col("D").fill("A0 B0 *")` — apply formula to entire column
- Aggregations: `grid.col("A").sum()`, `.mean()`, `.std()`
- Joins: `grid.join(otherGrid, on: "id")`

### 2.6 Ground-Up Replacement

The existing `FormulaEngine` was a proof-of-concept. What it validated:
- ✅ Derived atoms work for reactive formula computation
- ✅ Subscription bridge unifies formula results back into CellCache
- ✅ DAG tracking catches cycles
- ✅ Topo-order recalc works as a fallback path

What carries forward:
- **CellCache** — cell-level atoms via stxFamily. This stays.
- **CellValue schema** — 8 variants. Stays, likely extends.
- **AddressResolver** — A1 notation parsing. Stays.
- **CrdtLayer** — Multi-agent merge. Stays.
- **UndoStack** — Snapshot undo. Stays.
- **SchemaRegistry** — Column validation. Stays.

What gets replaced:
- **FormulaEngine** → new stack VM + WASM sandbox
- **FormulaConsistency** → new reactive propagation via stack VM
- **The `register(formula)` API** → new DSL-based formula definition
- **Bridge subscription model** → potentially rethought for stack VM

---

## 3. Architecture Sketch (Draft)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Layer                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐                  │
│  │ REPL     │  │ Cell RPC │  │ DataFrame API │                  │
│  │ Session  │  │          │  │               │                  │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘                  │
│       │              │               │                           │
│       └──────────────┴───────────────┘                           │
│                      │                                           │
│              ┌───────▼────────┐                                  │
│              │   DSL Parser   │  "A0 B0 + 2 *" → StackIR        │
│              └───────┬────────┘                                  │
│                      │                                           │
│              ┌───────▼────────┐                                  │
│              │   Stack VM     │  Executes StackIR opcodes        │
│              │   (Effect)     │  Native: cell refs, math, logic  │
│              └───┬────────┬──┘                                   │
│                  │        │                                       │
│          ┌──────▼──┐  ┌──▼──────────┐                           │
│          │ Native  │  │ WASM Bridge │  For JS eval steps         │
│          │ Ops     │  │ (QuickJS)   │                            │
│          └────┬────┘  └──────┬──────┘                            │
│               │              │                                   │
│               └──────┬───────┘                                   │
│                      │                                           │
│              ┌───────▼────────┐                                  │
│              │  Cell Layer    │  CellCache atoms + CrdtLayer     │
│              │  (unchanged)   │  UndoStack, SchemaRegistry       │
│              └────────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Research Backlog

### Must-research before spiking

- [ ] **Emacs calc internals** — How does the stack VM actually work? What's the IR? How do algebraic-to-RPN transforms happen? What's the Trail implementation?
- [ ] **QuickJS-WASM in browser** — Startup time, memory overhead, API surface for host function injection. Can we share WASM memory with the main thread?
- [ ] **Deterministic JS execution** — For CRDT consistency, can we guarantee that the same formula with the same inputs produces the same output across different WASM instances? (Math.random, Date.now, etc.)
- [ ] **Effect-in-WASM boundary** — Can Effect programs call into WASM and back? What's the FFI cost? Should the VM be an Effect service?
- [ ] **Stack VM design patterns** — Forth, Factor, PostScript. What IR format? Bytecode or AST-walk?
- [ ] **Streaming computation** — Can stack operations be pushed incrementally? How does this interact with cell subscriptions?

### Nice-to-research

- [ ] **Symbolic algebra engines in JS/TS** — math.js, algebrite, sympy via Pyodide
- [ ] **Units systems** — Pint (Python), Emacs calc units, mathjs units. Dimensional analysis on cell values.
- [ ] **Spreadsheet computation engines** — HyperFormula (Handsontable), FormulaParser (hot-formula-parser). What can we steal?
- [ ] **WASI preview 2** — Future-proofing the sandbox with component model

---

## 5. Assumptions to Validate (Spikes)

### Spike F1: Stack VM Proof
**Hypothesis:** A simple stack VM executing RPN opcodes can evaluate cell formulas with performance ≤ 2x overhead vs. direct JS.
**Approach:** Build a minimal stack VM (push, pop, add, sub, mul, div, cell-ref, dup, swap). Benchmark 10K formula evaluations.
**Exit criteria:** < 2x overhead, clean separation between VM and cell layer.

### Spike F2: WASM Sandbox Proof
**Hypothesis:** QuickJS compiled to WASM can execute arbitrary JS with host-injected cell access in < 5ms per eval for simple expressions.
**Approach:** Compile QuickJS to WASM via wasm-pack or pre-built module. Inject `readCell(key)` and `writeCell(key, value)` as host functions. Benchmark startup + eval.
**Exit criteria:** < 5ms per eval, < 10MB memory footprint, host function bridge works.

### Spike F3: Effect ↔ WASM Bridge
**Hypothesis:** An Effect program can dispatch computation to WASM and receive results without blocking the main fiber.
**Approach:** Wrap WASM eval in `Effect.promise()`. Test fiber interruption (cancel mid-computation). Test service access from within Effect wrapper.
**Exit criteria:** Clean Effect integration, fiber interruption works, services accessible.

### Spike F4: REPL Session State
**Hypothesis:** A persistent REPL session (stack + registers + trail) can be implemented as an Effect service with Atom-backed state.
**Approach:** Build a minimal REPL service: push, pop, eval, show-stack, show-trail. State in atoms. Multiple concurrent sessions via service scope.
**Exit criteria:** Concurrent sessions work, state is reactive, trail is append-only.

---

## 6. Glossary

| Term | Definition |
|------|-----------|
| **Stack VM** | Virtual machine executing RPN (Reverse Polish Notation) opcodes. Values pushed/popped from a LIFO stack. |
| **StackIR** | Intermediate representation: array of opcodes produced by the DSL parser. |
| **Trail** | Emacs calc concept: append-only log of all computations for audit/replay. |
| **Host function** | Function injected from the host (JS/Effect) into the WASM guest for controlled I/O. |
| **Cell RPC** | Remote procedure call API for stateless cell operations. |
| **REPL Session** | Stateful interactive session with persistent stack, registers, and trail. |
| **DataFrame API** | Column-oriented bulk operations on grid ranges. |

---

## 7. Change Log

| Date | Change |
|------|--------|
| 2026-03-15 | Initial pre-design document. Aligned model from questionnaire. Architecture sketch, research backlog, 4 spike definitions. |
