# Formula Engine Architecture — Comprehensive Breakdown

## What Exists Today

Two layers, in two separate services, with different execution models.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FormulaEngine                               │
│                   (src/services/formula-engine.ts)                   │
│                                                                     │
│  Responsibility:                                                    │
│    • DAG tracking (who depends on whom)                             │
│    • Cycle detection                                                │
│    • Topological ordering                                           │
│    • Formula registration (derived atom creation)                   │
│                                                                     │
│  Does NOT:                                                          │
│    • Parse formula strings                                          │
│    • Schedule recalc                                                │
│    • Know about transactions                                        │
│    • Know about AG-Grid                                             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      FormulaConsistency                             │
│                (src/services/formula-consistency.ts)                 │
│                                                                     │
│  Responsibility:                                                    │
│    • Post-commit recalc scheduling                                  │
│    • Batch recalc in topo order                                     │
│    • Recalc state tracking (stateAtom)                              │
│                                                                     │
│  Does NOT:                                                          │
│    • Own the DAG                                                    │
│    • Create formulas                                                │
│    • Wire into the transaction pipeline (caller must invoke)        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Internal Data Structures

The FormulaEngine maintains three Maps:

```
formulas: Map<CellKey, FormulaRegistration>
  │
  │  FormulaRegistration = {
  │    addr:  "sheet:2:0"          ← branded CellKey of the formula cell
  │    src:   "=A0+B0"            ← source string (for display/debug)
  │    deps:  ["sheet:0:0",       ← CellKeys this formula reads from
  │            "sheet:1:0"]
  │    atom:  Atom<CellValue>     ← the derived atom that computes the result
  │  }
  │
  ▼

fdeps: Map<CellKey, Set<CellKey>>         ← "forward deps" (formula → what it reads)
  "sheet:2:0" → { "sheet:0:0", "sheet:1:0" }

rdeps: Map<CellKey, Set<CellKey>>         ← "reverse deps" (cell → formulas that read it)
  "sheet:0:0" → { "sheet:2:0", "sheet:3:0" }
  "sheet:1:0" → { "sheet:2:0" }
```

These form a DAG:

```
    DATA CELLS              FORMULA CELLS              FORMULA CELLS
    (writable)              (derived, depth 1)         (derived, depth 2+)
                                                       
  ┌──────────┐            ┌──────────────┐
  │ A0 = 10  │─────┬─────▶│ C0 = A0 + B0 │
  └──────────┘     │      │  (derived)    │
                   │      └──────────────┘
  ┌──────────┐     │
  │ B0 = 20  │─────┘
  └──────────┘
                          
  ┌──────────┐            ┌──────────────┐           ┌──────────────┐
  │ D0 = 5   │───────────▶│ E0 = D0 * 2  │──────────▶│ F0 = E0 + 1  │
  └──────────┘            │  (derived)    │           │  (derived)    │
                          └──────────────┘           └──────────────┘

  fdeps:                  fdeps:                     fdeps:
    (none — data cells     E0 → { D0 }                F0 → { E0 }
     have no fdeps)        
                          rdeps:                     rdeps:
  rdeps:                    D0 → { E0 }               E0 → { F0 }
    A0 → { C0 }
    B0 → { C0 }
    D0 → { E0 }
```

---

## Two Registration Paths

### Path 1: `register()` — FormulaEngine creates the derived atom

```
register(addr, src, deps, compute)
         │      │     │      │
         │      │     │      └─ (depValues: CellValue[]) => CellValue
         │      │     │           Pure function. Gets dep VALUES, returns result.
         │      │     │
         │      │     └─ ColRow[] of cells this formula reads
         │      │
         │      └─ "=A0+B0" (source string, for display)
         │
         └─ ColRow where the formula lives (e.g., C0)

What happens inside:

  1. depAtoms = deps.map(d => config.getCellAtom(d))
     │
     │  getCellAtom reaches into CellCache's stxFamily
     │  Returns the WRITABLE data atom for each dependency.
     │  These are the atoms that transactionalSetBulk writes to.
     │
     ▼
  2. derived = Atom.make((get: Context) => {
       const values = depAtoms.map(a => get(a))
       return compute(values)
     })
     │
     │  This is an Effect v4 DERIVED ATOM.
     │  The `get` function from Atom.Context:
     │    - Reads the current value of each depAtom
     │    - SUBSCRIBES to changes (auto-tracking)
     │    - When any dep changes, this derived atom is invalidated
     │    - On next read, `compute` re-executes with fresh values
     │
     ▼
  3. config.registry.mount(derived)
     │
     │  Mounts the derived atom into the AtomRegistry.
     │  This enables:
     │    - React subscriptions via useAtomValue / useSyncExternalStore
     │    - registry.get(derived) to trigger computation
     │    - registry.subscribe(derived, callback) for change notifications
     │
     ▼
  4. addEdges(key, depKeys)
     │
     │  Updates fdeps and rdeps Maps.
     │  This is the DAG that FormulaConsistency uses for topo ordering.
     │  Note: the derived atom ALSO tracks deps internally via Atom.Context.
     │  So we have DUAL tracking:
     │    - Atom.Context:  reactive auto-recomputation
     │    - fdeps/rdeps:   explicit DAG for topo ordering + cycle detection
```

### Path 2: `registerAtom()` — Caller provides a pre-built atom

```
registerAtom(addr, src, deps, atom)
                              │
                              └─ Caller already created the derived Atom.
                                 FormulaEngine just tracks it in the DAG.
                                 No Atom creation. No compute function.
                                 Used when the caller wants custom Atom logic
                                 (e.g., async formulas, effect-based, etc.)
```

---

## How Recalculation Works (Two Mechanisms)

### Mechanism 1: Atom.Context Auto-Recomputation (Implicit)

```
When a data cell changes:

  registry.set(cellAtom_A0, num(50))     ← CellCache writes to the atom
       │
       │  Atom runtime detects that derived atoms read from cellAtom_A0
       │  via the `get` context used during their last computation.
       │
       ▼
  derived_C0 is INVALIDATED
       │
       │  Next time anyone calls registry.get(derived_C0),
       │  the compute function re-runs:
       │    compute([get(cellAtom_A0), get(cellAtom_B0)])
       │    = compute([num(50), num(20)])
       │    = num(70)
       │
       ▼
  Subscribers of derived_C0 are notified

THIS HAPPENS AUTOMATICALLY. No FormulaConsistency needed.
The atom runtime handles it via dependency tracking.
```

**But there's a catch.**

The auto-recomputation is LAZY. It only happens when someone reads
the derived atom. If no React component is subscribed to C0, and
nobody calls `registry.get(derived_C0)`, the formula doesn't recompute.

For AG-Grid with valueGetters, the read happens when AG-Grid asks
for the cell's display value. But if the cell is scrolled off-screen,
AG-Grid might not ask — and the formula becomes stale.

### Mechanism 2: FormulaConsistency.recalcAffected (Explicit)

```
After transactionalSetBulk commits:

  caller invokes:
    consistency.recalcAffected([addr(0, 0)])   ← "A0 changed"
       │
       ▼
  formulaEngine.topoOrder([addr(0, 0)])
       │
       │  Walks rdeps from A0:
       │    A0 → { C0 }       ← C0 depends on A0
       │    C0 → { }          ← nothing depends on C0 (leaf)
       │
       │  Returns: ["sheet:2:0"]  (C0 in topo order)
       │
       ▼
  Atom.batch(() => {
    for each formulaAddr in topoOrder:
      registry.get(formulaEngine.getFormula(addr).atom)
                    │
                    └─ FORCE-READ the derived atom.
                       This triggers recomputation even if
                       no React subscriber is watching.
  })
       │
       │  Atom.batch means all notifications are coalesced.
       │  React re-renders once, not N times.
       │
       ▼
  stateAtom updated with { recalcCount++, affectedCount, timestamp }
```

---

## The Topo-Order Algorithm

```
topoOrder(dirty: ColRow[]): string[]

  Input:  cells that changed (e.g., A0 after a write)
  Output: formula cell keys in order they should be evaluated

  Algorithm: reverse post-order DFS on rdeps

  function visit(addr):
    if visited has addr: return
    mark addr visited
    for each d in rdeps[addr]:    ← formulas that depend on this cell
      visit(d)
    result.push(addr)

  for each dirty cell:
    visit(cellKey(sheetId, dirty))

  return result.reverse()         ← reverse gives correct eval order

  Example:
    D0 changed.  rdeps: D0 → { E0 },  E0 → { F0 }

    visit(D0):
      visit(E0):
        visit(F0):
          result.push(F0)     ← F0 first (deepest)
        result.push(E0)
      result.push(D0)

    result = [F0, E0, D0]
    reversed = [D0, E0, F0]

    But D0 is a data cell (not a formula), so it's skipped during recalc.
    Actual recalc order: E0, then F0. ✓
```

---

## Cycle Detection

```
detectCycle(addr, deps): string[] | null

  Before registering a formula, check if adding
  addr → deps edges would create a cycle.

  Algorithm:
    1. Temporarily add the proposed edges to fdeps
    2. DFS from each dep back toward addr
    3. If addr is reachable → cycle found, return the path
    4. Restore fdeps to original state

  Special case: self-reference (addr in deps) → immediate cycle.

  Example:
    Existing: A0 → { B0 }     (A0 depends on B0)
    Proposed: B0 → { A0 }     (B0 depends on A0)

    Temp add B0 → { A0 } to fdeps.
    DFS from A0:
      A0 → fdeps → { B0 }
      B0 → fdeps → { A0 }  ← found target!

    Return: ["A0", "B0", "A0"]  ← cycle path
```

---

## How It Wires Into the Datagrid Service

```
┌─────────────────────────────────────────────────────────────────┐
│                          Datagrid                                │
│                   (src/services/datagrid.ts)                     │
│                                                                  │
│  Builds all service layers, exposes high-level API:              │
│                                                                  │
│  registerFormula(addr, src, deps, compute):                      │
│    1. resolve(addr) → ColRow                                     │
│    2. formulas.detectCycle(cr, depCrs)                            │
│    3. if cycle → throw Error("Circular reference detected")      │
│    4. formulas.register(cr, src, depCrs, compute)                │
│                                                                  │
│  FormulaEngine receives getCellAtom from CellCache:              │
│    getCellAtom: (addr) => cells.getAtom(addr)                    │
│                                                                  │
│  This means formula derived atoms read directly from             │
│  CellCache's stxFamily atoms — the same atoms that              │
│  transactionalSetBulk writes to.                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Does NOT Exist

```
┌─────────────────────────────────────────────────────────────────┐
│                     MISSING PIECES                               │
│                                                                  │
│  1. NO FORMULA PARSER                                            │
│     "=A0+B0" is just a string stored for display.                │
│     The caller must manually provide:                            │
│       - deps: [addr(0,0), addr(1,0)]                             │
│       - compute: (vals) => num(extractNumber(vals[0]) + ...)     │
│     There is no "=SUM(A1:A10)" parser.                           │
│                                                                  │
│  2. NO AUTOMATIC RECALC WIRING                                   │
│     FormulaConsistency.recalcAffected() must be called           │
│     explicitly by the caller after a transaction commits.        │
│     It is NOT wired into transactionalSetBulk or the             │
│     GridBridge pipeline. The caller is responsible.              │
│                                                                  │
│  3. NO FORMULA-TO-FORMULA CHAINING in FormulaConsistency         │
│     topoOrder walks rdeps, but rdeps only tracks                 │
│     data cell → formula edges. If formula F1 depends on          │
│     formula F2, the rdeps won't have that edge because           │
│     F2's output atom is not in rdeps (it was registered          │
│     via registerAtom or created internally). The derived          │
│     atom auto-recomputation handles this implicitly, but         │
│     FormulaConsistency.recalcAffected() may miss it.             │
│                                                                  │
│  4. NO ASYNC FORMULA SUPPORT                                     │
│     compute() is synchronous: (CellValue[]) => CellValue         │
│     No Effect-based or async compute functions.                  │
│     Atom.make with Effect return is possible (see Atom.ts        │
│     overloads) but not wired.                                    │
│                                                                  │
│  5. NO ERROR PROPAGATION                                         │
│     If a formula compute() throws, the exception escapes.        │
│     No CellError posted, no error atom updated.                  │
│     The spike test (S2) had its own try/catch + error() value,   │
│     but the real service doesn't.                                │
│                                                                  │
│  6. NO FORMULA PERSISTENCE                                       │
│     Formulas exist only in memory (the Map). No DB backing.      │
│     Sheet reload = all formulas lost. Caller must re-register.   │
│                                                                  │
│  7. NO DIRTY TRACKING INTEGRATION                                │
│     When transactionalSetBulk commits, nobody automatically      │
│     calls recalcAffected. The bridge (GridBridge) doesn't        │
│     know about FormulaConsistency. There's a gap between         │
│     "atoms updated" and "formulas recalculated".                 │
│                                                                  │
│  8. DUAL DEPENDENCY TRACKING IS REDUNDANT                        │
│     The derived atom tracks deps via Atom.Context (reactive).    │
│     fdeps/rdeps tracks deps via explicit Maps (manual).          │
│     These can drift if someone mutates atoms outside the         │
│     FormulaEngine's awareness.                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: End-to-End Write → Recalc → Display

```
User types "50" into cell A0 in AG-Grid
    │
    ▼
AG-Grid fires cellEditRequest (readOnlyEdit: true)
    │
    ▼
GridBridge.handleCellEditRequest()
    │
    ├─ parseEditorValue("50") → num(50)
    ├─ SchemaRegistry.coerce() → num(50)
    ├─ SchemaRegistry.validate() → [] (ok)
    ├─ UndoStack.record([{addr: A0, value: num(50)}])
    │
    ▼
CellCache.transactionalSetBulk([{addr: A0, value: num(50)}])
    │
    ├─ Phase 1: Validate
    ├─ Phase 2: multiStoreTransaction
    │     TxRef.set(ref_A0, num(50))
    │     → Atom.batch: atom_A0 set to num(50)
    ├─ Phase 3: Clear errors
    ├─ Phase 4: Persist to DB
    │
    ▼
atom_A0 now holds num(50)
    │
    ├───────────────────────────────────┐
    │ Implicit (Atom auto-recompute)    │ Explicit (FormulaConsistency)
    │                                   │
    │ derived_C0's `get(atom_A0)` is    │ ??? Nobody calls recalcAffected.
    │ invalidated. Next registry.get()  │ THIS IS THE GAP.
    │ will recompute.                   │
    │                                   │
    ▼                                   ▼
atom_A0 subscribers notified          (nothing happens unless caller
    │                                  manually invokes consistency)
    ▼
TransactionCollector.queueUpdate()
    │
    ▼
AG-Grid.applyTransaction({ update: [...] })
    │
    ▼
AG-Grid calls valueGetter for visible cells
    │
    ├─ valueGetter for A0: extractDisplay(datagrid.getCell(A0)) → "50"
    │
    ├─ valueGetter for C0: extractDisplay(datagrid.getCell(C0))
    │     BUT datagrid.getCell reads from CellCache, not from
    │     the derived atom. CellCache has the DATA cell at C0,
    │     not the FORMULA result.
    │     
    │     THE FORMULA RESULT LIVES IN FormulaRegistration.atom,
    │     NOT IN CellCache.
    │
    └─ This means: valueGetter doesn't know about formulas.
       It reads stxFamily atoms. Formula results are in separate
       derived atoms that are NOT in the stxFamily.
```

---

## The Fundamental Tension

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  CellCache.stxFamily         FormulaEngine.formulas          │
│  ════════════════════        ═══════════════════════          │
│  Key: CellKey                Key: CellKey                    │
│  Value: Atom<CellValue>      Value: Atom<CellValue>          │
│                                     (derived)                │
│  Used by:                    Used by:                        │
│    - valueGetter               - useFormula hook             │
│    - transactionalSetBulk      - recalcAffected              │
│    - UndoStack                 - (manual registry.get)       │
│    - GridBridge                                              │
│    - everything                                              │
│                                                              │
│  PROBLEM: Two separate atom universes for the same cell.     │
│           C0-in-CellCache ≠ C0-in-FormulaEngine.            │
│           valueGetter reads from CellCache.                  │
│           Formula result lives in FormulaEngine.             │
│           They're different atoms.                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## How the Spike (S2) Differed

The spike test built a *different* formula engine that sidesteps
the dual-atom problem. In the spike:

```
SpikeFormulaEngine:
  - ONE Map<CellKey, Atom<CellValue>> for ALL cells (data + formula)
  - Formula registration writes result INTO the same atom
  - recalcSingle: evaluates fn, then registry.set(atom, result)
  - No derived atoms — just writable atoms with imperative recalc
  - No auto-recompute — explicit recalcFrom() after every change

This works because there's ONE atom per cell, and formula results
are written directly to it. The tradeoff: no lazy recomputation,
all recalc is imperative and must be triggered by the caller.
```

---

## Summary: What We Have vs What We Need

```
HAVE:
  ✓ DAG tracking (fdeps/rdeps)
  ✓ Cycle detection
  ✓ Topo ordering
  ✓ Derived atom creation (auto-recompute via Atom.Context)
  ✓ Post-commit batch recalc (FormulaConsistency)
  ✓ Formula registration API

NEED:
  ✗ Formula parser ("=SUM(A1:A10)" → deps + compute)
  ✗ Unified atom model (formula result IN CellCache, not separate)
  ✗ Auto-wiring of recalc into transaction pipeline
  ✗ Error propagation (compute throws → CellError)
  ✗ Async formula support (Effect-based compute)
  ✗ Formula persistence (DB-backed, survives reload)
  ✗ Formula-to-formula chaining in explicit recalc
  ✗ valueGetter awareness of formula atoms
```
