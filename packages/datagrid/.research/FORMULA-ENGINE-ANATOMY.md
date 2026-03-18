# Formula Engine — Comprehensive Anatomy

## 1. What It Is

The formula engine is a **dependency DAG tracker + incremental recalculator**
for cell-level formulas. It does NOT parse formula strings — it receives
pre-parsed dependencies and a compute function, then manages:

- Forward dependency edges (formula → what it reads)
- Reverse dependency edges (cell → what formulas read it)
- Cycle detection (DFS before registration)
- Topological ordering (for cascading recalc)

There are **two services** involved:

```
┌──────────────────────────────┐    ┌─────────────────────────────────┐
│      FormulaEngine           │    │    FormulaConsistency (G4)      │
│                              │    │                                 │
│  • DAG bookkeeping           │    │  • When to recalc               │
│  • Derived atom creation     │    │  • Topo-order traversal         │
│  • Cycle detection           │    │  • Atom.batch wrapping          │
│  • rdeps / fdeps maps        │    │  • State tracking (recalcCount) │
│                              │    │                                 │
│  "What depends on what"      │    │  "Recalc the right things       │
│                              │    │   at the right time"            │
└──────────────────────────────┘    └─────────────────────────────────┘
```

## 2. Internal Data Structures

```
formulas: Map<CellKey, FormulaRegistration>
  │
  │  FormulaRegistration:
  │    addr:  "sheet:2:0"          ← CellKey of the formula cell
  │    src:   "=A0+B0"            ← Human-readable source (display only)
  │    deps:  ["sheet:0:0",        ← CellKeys this formula reads from
  │            "sheet:1:0"]
  │    atom:  Atom<CellValue>      ← The derived atom (auto-recomputes)
  │
  ▼

fdeps: Map<CellKey, Set<CellKey>>        rdeps: Map<CellKey, Set<CellKey>>
  │  (forward: formula → its deps)          │  (reverse: cell → who reads it)
  │                                         │
  │  "sheet:2:0" → {"sheet:0:0",           │  "sheet:0:0" → {"sheet:2:0"}
  │                  "sheet:1:0"}           │  "sheet:1:0" → {"sheet:2:0"}
  │                                         │
  └── "What does C0 read?"                 └── "Who reads from A0?"
```

## 3. Registration Flow

```
                        register(addr, src, deps, compute)
                                      │
                    ┌─────────────────┼──────────────────────┐
                    ▼                 ▼                      ▼
            cellKey(addr)     cellKey(each dep)      removeEdges(key)
            → "sheet:2:0"    → ["sheet:0:0", ...]    (clear old edges
                    │                 │                if re-registering)
                    │                 │
                    ▼                 ▼
              ┌─────────────────────────────────┐
              │  Create derived atom:           │
              │                                 │
              │  Atom.make((get) => {           │
              │    const vals = depAtoms.map(   │
              │      a => get(a)                │  ← get() auto-tracks
              │    )                            │     deps in AtomRegistry
              │    return compute(vals)         │
              │  })                             │
              │                                 │
              │  registry.mount(derived)        │
              └─────────────────────────────────┘
                              │
                              ▼
              ┌─────────────────────────────────┐
              │  addEdges(key, depKeys):         │
              │                                 │
              │  fdeps["sheet:2:0"]             │
              │    = {"sheet:0:0","sheet:1:0"}  │
              │                                 │
              │  rdeps["sheet:0:0"]             │
              │    .add("sheet:2:0")            │
              │  rdeps["sheet:1:0"]             │
              │    .add("sheet:2:0")            │
              └─────────────────────────────────┘
                              │
                              ▼
              formulas.set(key, registration)
              → return FormulaRegistration
```

### Two Registration Paths

```
register(addr, src, deps, compute)     registerAtom(addr, src, deps, atom)
  │                                       │
  │  Creates a NEW derived atom           │  Accepts a PRE-BUILT atom
  │  from compute function.               │  (you own the Atom.make).
  │                                       │
  │  FormulaEngine builds:                │  FormulaEngine just tracks
  │    Atom.make((get) => {               │  the DAG edges — the atom
  │      vals = deps.map(d => get(d))     │  already knows how to
  │      return compute(vals)             │  recompute itself.
  │    })                                 │
  │                                       │
  └── For programmatic formulas           └── For hand-crafted atoms
      (API, paste, user input)                (derived atoms built elsewhere)
```

## 4. Cycle Detection

```
detectCycle(addr: ColRow, deps: ColRow[])

  target = "sheet:2:0"
  depKeys = ["sheet:0:0", "sheet:1:0"]

  Step 1: Temporarily inject edges
    fdeps["sheet:2:0"] = {depKeys}

  Step 2: DFS from each dep, looking for target
    ┌─────────────────────────────────────┐
    │  For each depKey:                   │
    │    dfs(depKey):                     │
    │      if depKey == target → CYCLE!   │
    │      if visited → skip              │
    │      for each fdeps[depKey]:        │
    │        if dfs(next) → CYCLE!        │
    │                                     │
    │  Returns: path[] or null            │
    └─────────────────────────────────────┘

  Step 3: Restore original fdeps

  Example — detecting A0 → B0 → A0:

    fdeps before:
      "sheet:1:0" → {"sheet:0:0"}       B0 reads A0

    Register A0 = f(B0):
      target = "sheet:0:0"
      depKeys = ["sheet:1:0"]
      Temp: fdeps["sheet:0:0"] = {"sheet:1:0"}

      dfs("sheet:1:0"):
        fdeps["sheet:1:0"] = {"sheet:0:0"}
        dfs("sheet:0:0"):
          "sheet:0:0" == target → CYCLE DETECTED
          path = ["sheet:1:0", "sheet:0:0"]

    Return: ["sheet:1:0", "sheet:0:0"]
```

## 5. Topological Ordering (topoOrder)

```
topoOrder(dirty: ColRow[]) → CellKey[]

  Purpose: Given dirty DATA cells, return all affected FORMULA
  cells in an order where no formula is evaluated before
  its dependencies.

  Algorithm: Post-order DFS on reverse dependency graph.

    ┌──────────────────────────────────────────────┐
    │  visit(addr):                                │
    │    if visited → skip                         │
    │    mark visited                              │
    │    for each rdeps[addr]:     ← who reads me? │
    │      visit(dependent)                        │
    │    result.push(addr)         ← post-order    │
    │                                              │
    │  for each dirty cell:                        │
    │    visit(cellKey(dirty))                     │
    │                                              │
    │  return result.reverse()     ← topo order    │
    └──────────────────────────────────────────────┘

  Example:

    Data:  A0, B0
    Formulas:  C0 = A0 + B0
               D0 = C0 * 2    (C0 is also a formula)

    rdeps:
      "A0" → {"C0"}
      "B0" → {"C0"}
      "C0" → {"D0"}

    dirty = [A0]

    visit("A0"):
      visit("C0"):           ← rdeps["A0"]
        visit("D0"):         ← rdeps["C0"]
          no rdeps
          push "D0"
        push "C0"
      push "A0"

    result = ["A0", "C0", "D0"]
    reversed = ["D0", "C0", "A0"]

    Wait — that's REVERSED. Leaves first.
    Actually: post-order + reverse = roots first.

    result (before reverse) = ["D0", "C0", "A0"]
    result.reverse() = ["A0", "C0", "D0"]

    ✓ A0 first (data cell), then C0 (reads A0), then D0 (reads C0)
```

## 6. Reactivity Model — Two Layers

```
┌──────────────────────────────────────────────────────────┐
│                   AtomRegistry Layer                      │
│                                                          │
│  Data atoms (writable):     Formula atoms (derived):     │
│    A0 = Atom.make(num(10))    C0 = Atom.make((get) => { │
│    B0 = Atom.make(num(20))      return get(A0) + get(B0)│
│                                })                        │
│                                                          │
│  When A0.set(50):                                        │
│    AtomRegistry notifies all subscribers of A0           │
│    C0's get(A0) lazily recomputes on next read           │
│                                                          │
│  KEY: Derived atoms are LAZY — they don't recompute      │
│  until someone reads them. They're pull-based.           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              FormulaEngine DAG Layer                      │
│                                                          │
│  Explicit edge tracking for:                             │
│    • Cycle detection (can't do this with lazy atoms)     │
│    • Topo ordering (which formulas to read, in order)    │
│    • Dependency inspection (UI: "show formula deps")     │
│    • Unregistration (clean edge removal)                 │
│                                                          │
│  The DAG does NOT drive recomputation.                   │
│  The AtomRegistry does (lazily).                         │
│  The DAG tells you WHEN and WHAT to force-read.          │
└──────────────────────────────────────────────────────────┘
```

**This is the critical duality:**

```
  AtomRegistry                    FormulaEngine DAG
  ────────────                    ─────────────────
  Owns recomputation              Owns dependency metadata
  Pull-based (lazy)               Explicit edges
  Auto-tracks via get()           Manual addEdges/removeEdges
  No cycle detection              DFS cycle detection
  No ordering guarantees          Topo sort for batch recalc
```

## 7. FormulaConsistency — The Recalc Coordinator

```
                  User writes A0, B0 atomically
                            │
                            ▼
              transactionalSetBulk([A0=50, B0=200])
                            │
                            ▼
                ┌─────────────────────┐
                │  multiStoreTransaction  │
                │  TxRef writes → commit  │
                │  Atom.batch flush       │
                └─────────────────────┘
                            │
                            ▼
              Atoms A0, B0 now hold new values
              (but derived atoms haven't recomputed yet
               — they're lazy, waiting for a read)
                            │
                            ▼
          consistency.recalcAffected([A0, B0])
                            │
                            ▼
              ┌─────────────────────────┐
              │  formulaEngine.topoOrder │
              │  ([A0, B0])             │
              │                         │
              │  → ["C0", "D0", "E0"]   │
              │     (topo-sorted)       │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  Atom.batch(() => {     │
              │    for each formula:    │
              │      registry.get(atom) │  ← FORCE READ
              │  })                     │     triggers lazy
              │                         │     recomputation
              │  Single notification    │
              │  pass for all React     │
              │  subscribers.           │
              └─────────────────────────┘

  WHY Atom.batch?
    Without it, each registry.get() that triggers a
    recomputation would notify React subscribers
    individually. With Atom.batch, ALL formula results
    settle, THEN one notification fires.

  WHY force-read instead of set?
    Derived atoms recompute via their (get) => ... function.
    We can't "set" them — they derive their value.
    But they're lazy: they only recompute when READ.
    So we force-read to trigger the recomputation.
```

## 8. Full Write → Recalc → Render Pipeline

```
  User types "50" in cell A0
        │
        ▼
  AG-Grid cellEditRequest
        │
        ▼
  GridBridge.handleCellEditRequest
        │
        ├── parseEditorValue("50") → num(50)
        ├── SchemaRegistry.coerce(A0, num(50))
        ├── SchemaRegistry.validate(A0, num(50)) → []
        ├── UndoStack.record([{A0, before=10, after=50}])
        │
        ▼
  CellCache.transactionalSetBulk([{A0, num(50)}])
        │
        ├── TxRef.set(A0_ref, num(50))
        ├── Transaction commit
        ├── Atom.batch: A0_atom ← num(50)
        ├── DB persist
        │
        ▼
  FormulaConsistency.recalcAffected([A0])    ← NOT WIRED YET
        │
        ├── topoOrder([A0]) → ["C0", "D0"]
        ├── Atom.batch:
        │     registry.get(C0_atom) → recomputes → num(70)
        │     registry.get(D0_atom) → recomputes → num(140)
        │
        ▼
  AtomRegistry notifies subscribers:
        │
        ├── React: useCellDisplay(A0)  → re-render "50"
        ├── React: useCellDisplay(C0)  → re-render "70"
        ├── React: useCellDisplay(D0)  → re-render "140"
        │
        ├── GridBridge subscriptions:
        │     A0 changed → collector.queueUpdate(A0)
        │     C0 changed → collector.queueUpdate(C0)
        │     D0 changed → collector.queueUpdate(D0)
        │
        ▼
  TransactionCollector.flush()
        │
        ▼
  api.applyTransaction({ update: [{row0: {A0:"50", C0:"70", D0:"140"}}] })
        │
        ▼
  AG-Grid change detection → cell refresh → DOM update
```

## 9. What's Missing / Open Questions

### No String Parser
The engine receives `deps: ColRow[]` and `compute: fn`.
Nobody parses `"=A1+B1"` into deps and a function.
This would need a tokenizer + expression evaluator.

### Formula-to-Formula Dependencies
`register()` creates a derived atom from DATA cell atoms only.
`getCellAtom(dep)` returns the writable data atom, not another
formula's derived atom. So C0 = f(A0, B0) works, but
D0 = f(C0) reads C0's DATA atom (empty), not C0's formula atom.

```
  register(D0, "=C0*2", [C0], compute)
                              │
                              ▼
         getCellAtom(C0) → the WRITABLE data atom at C0
         NOT the derived formula atom created by register(C0, ...)

  This means D0 reads C0's raw data cell, not C0's formula result.
```

To chain formulas, you'd need `registerAtom` which accepts a
pre-built atom, or the engine needs to check if a dep is a
registered formula and return its derived atom instead.

### Recalc Not Wired to Write Path
`FormulaConsistency.recalcAffected()` exists but is never called
automatically after `transactionalSetBulk`. The caller must
explicitly call it. The bridge's `handleCellEditRequest` doesn't
call it either.

### No Formula Cell Persistence
Formula registrations are in-memory Maps. If the page reloads,
all formulas are gone. No serialization of `src` + `deps` to DB.

### No Error Propagation in DAG
If A0 has an error, formulas reading A0 will get the error value
but don't propagate it as a typed error through the DAG.
The compute function receives the raw CellValue (which might be
`{ _tag: "Error", error: "..." }`), and it's up to the function
to handle it or crash.

### Derived Atoms Are Lazy but topoOrder Exists
There's a tension: derived atoms auto-recompute on read (lazy),
but `FormulaConsistency` force-reads them in topo order.
If a subscriber (React, GridBridge) reads a formula atom, it
will recompute regardless of whether `recalcAffected` was called.
The topo order only matters for the Atom.batch optimization
(single notification pass) — correctness is handled by the
lazy recomputation.
