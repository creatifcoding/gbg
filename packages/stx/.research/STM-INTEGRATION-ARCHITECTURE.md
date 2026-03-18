# STX × STM Integration Architecture

**Decision**: Tier 2 — TxRef Shadow Store with A+B sync  
**Date**: 2026-03-13  
**Status**: DESIGN (pre-implementation)

---

## Executive Summary

Introduce transactional guarantees to STX by backing the existing `Atom` reactive layer with `TxRef` from effect-smol's STM system. The Atom surface remains synchronous for React; `Effect.transaction()` provides atomic multi-field / multi-store mutations with automatic rollback. On commit, changes sync to Atom via `Atom.batch()`.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          React Components                            │
│   useAtomValue(store.atom)   useFocus(store, lens)                  │
│           ▲                          ▲                               │
└───────────┼──────────────────────────┼──────────────────────────────┘
            │ (sync reads)             │ (sync reads)
┌───────────┴──────────────────────────┴──────────────────────────────┐
│                    Atom Layer (Reactive Surface)                     │
│                                                                      │
│   Atom.Writable<S>      Focus atoms       Filter/When atoms         │
│        ▲                     ▲                  ▲                    │
│        │ Atom.batch()        │                  │                    │
│        │ (atomic notify)     │                  │                    │
└────────┼─────────────────────┼──────────────────┼───────────────────┘
         │                     │                  │
┌────────┼─────────────────────┼──────────────────┼───────────────────┐
│        │           Transaction Bridge                                │
│        │                                                             │
│   commitToAtom()   ◄──── Effect.transaction() succeeds               │
│   (batch sync)            │                                          │
│                           │ On failure → rollback (journal cleared)  │
│                           │                                          │
│   Optional:               │                                          │
│   TxSubscriptionRef       │                                          │
│   .changes() ──► Stream   │   (cross-store observers)               │
│                           │                                          │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────────┐
│                    TxRef Layer (Transactional Truth)                  │
│                                                                      │
│   TxRef<S>              TxHashMap<K,V>         TxQueue<Event>       │
│   (per-store state)     (family backing)       (event buffer)       │
│                                                                      │
│   All ops require Effect.Transaction in R                            │
│   Conflict detection via version tracking                            │
│   Automatic retry on concurrent modification                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Design Principles

### 1. Atom Stays Synchronous
React consumers never see TxRef. `useAtomValue`, `useFocus`, all hooks remain sync.
TxRef is an implementation detail of the transaction system.

### 2. Default Mode = No TxRef
`stx(initial)` works exactly as today. Zero overhead. No TxRef allocated.
Transactions are opt-in via `stx(initial, { transactional: true })`.

### 3. Transaction Commit = Atom.batch
When `Effect.transaction()` succeeds:
```typescript
Atom.batch(() => {
  for (const [atom, value] of journal) {
    reg.set(atom, value)
  }
})
// Subscribers notified ONCE with all changes
```

### 4. Rollback = Journal Discard
When `Effect.transaction()` fails, the TxRef journal is discarded by Effect internals.
Atom layer never sees intermediate states.

---

## API Design

### Single-Store Transactions

```typescript
import { stx } from "@tmnl/stx"

// Opt-in transactional mode
const store = stx(initialState, { transactional: true })

// Synchronous API still works (implicit single-op transaction)
store.set(newState)
store.setAt(store.lens.user.name, "Bob")

// Explicit transaction — atomic multi-mutation
const result = store.transaction((tx) => {
  tx.setAt(store.lens.user.name, "Alice")
  tx.setAt(store.lens.user.email, "alice@co.com")
  // Subscribers notified ONCE with both changes
})
// Result<void, StxError>

// Effectful transaction — for advanced composition
const effect = store.transactionEffect(
  Effect.gen(function*() {
    const ref = store.txRef! 
    yield* TxRef.update(ref, (s) => ({ ...s, name: "Alice" }))
    // Can compose with other Tx ops
  })
)
// Effect<void, StxError, never>  (Transaction stripped at boundary)
```

### Multi-Store Transactions

```typescript
import { stxTransaction } from "@tmnl/stx"

const store1 = stx(state1, { transactional: true })
const store2 = stx(state2, { transactional: true })

// Atomic cross-store mutation
const result = stxTransaction([store1, store2], (tx) => {
  tx.setAt(store1, store1.lens.balance, balance1 - 100)
  tx.setAt(store2, store2.lens.balance, balance2 + 100)
  // Both or neither
})
// Result<void, StxError>
```

### Change Stream (Optional)

```typescript
// For cross-store observers, event sourcing, etc.
const store = stx(initialState, { 
  transactional: true,
  subscriptionRef: true  // uses TxSubscriptionRef instead of TxRef
})

// Stream of committed changes
const changes: Stream<S> = store.changes()

// Bridge to another atom (e.g., audit log)
const auditAtom = Atom.make(
  store.changes().pipe(
    Stream.scan([] as AuditEntry[], (log, state) => [...log, { state, ts: Date.now() }])
  )
)
```

---

## Internal Architecture

### New File: `src/internal/transaction.ts`

```typescript
// Transaction journal — tracks mutations before commit
interface TxJournal<S> {
  readonly store: StxInstance<S>
  readonly snapshot: S              // pre-transaction state (for rollback)
  readonly mutations: Array<() => void>  // deferred Atom writes
}

// Transaction context passed to user callback
interface TxContext {
  setAt<S, A>(store: StxInstance<S>, lens: ..., value: A): void
  modify<S, A>(store: StxInstance<S>, lens: ..., fn: (a: A) => A): void
  set<S>(store: StxInstance<S>, value: S): void
}
```

### Modified: `src/stx.ts`

```typescript
export function stx<S>(
  initial: S,
  options?: {
    registry?: AtomRegistry.AtomRegistry
    transactional?: boolean        // NEW: allocate TxRef backing
    subscriptionRef?: boolean      // NEW: use TxSubscriptionRef for changes()
  }
): StxInstance<S> {
  const reg = options?.registry ?? AtomRegistry.make()
  const atom = Atom.make<S>(initial)
  reg.mount(atom)

  // TxRef backing (opt-in)
  let txRef: TxRef.TxRef<S> | undefined
  let txSubRef: TxSubscriptionRef.TxSubscriptionRef<S> | undefined
  
  if (options?.transactional) {
    // TxRef created via makeUnsafe (no Effect.Transaction needed for creation)
    txRef = TxRef.makeUnsafe(initial)
    
    if (options.subscriptionRef) {
      // TxSubscriptionRef wraps TxRef + TxPubSub
      // ... created via Effect.runSync(Effect.transaction(...))
    }
  }

  // ... existing stx logic ...
  
  // NEW: transaction() method
  const transaction = options?.transactional
    ? createTransaction(atom, txRef!, reg, entityMeta)
    : undefined

  return {
    ...existingInstance,
    txRef,
    transaction,
    changes: txSubRef ? () => txSubRef.changes() : undefined,
  }
}
```

### Modified: `src/types.ts`

```typescript
export interface StxInstance<S> {
  // ... existing fields ...

  /** TxRef backing store (present when transactional: true) */
  readonly txRef?: TxRef.TxRef<S>

  /**
   * Execute a transaction — atomic multi-mutation with rollback.
   * Only available when created with `{ transactional: true }`.
   *
   * Returns Result<void, StxError> — failure means rollback occurred.
   */
  readonly transaction?: (
    fn: (tx: StxTxContext<S>) => void
  ) => Result.Result<void, StxError>

  /**
   * Stream of committed state changes.
   * Only available when created with `{ subscriptionRef: true }`.
   */
  readonly changes?: () => Stream.Stream<S>
}

/** Transaction context — mutations are journaled, committed atomically */
export interface StxTxContext<S> {
  /** Set root state within transaction */
  set(value: S): void
  /** Replace at lens path within transaction */
  setAt<A>(lens: { replace: (value: A, state: S) => S }, value: A): void
  /** Modify at lens path within transaction */
  modify<A>(
    lens: { modify: (fn: (a: A) => A) => (state: S) => S },
    fn: (a: A) => A,
  ): void
  /** Read current transactional state (includes uncommitted changes) */
  get(): S
  /** Read at lens path within transaction */
  getAt<A>(lens: { get: (s: S) => A }): A
}
```

---

## Implementation Phases

### Phase 1: Atom.batch Transaction (no TxRef)
Even before TxRef integration, add `store.transaction()` using `Atom.batch()` + journal pattern:
- Journal captures mutations
- `Atom.batch()` applies them atomically
- On validation failure → rollback from snapshot
- This alone delivers 80% of the value

### Phase 2: TxRef Shadow Store
Add `{ transactional: true }` option:
- Allocate TxRef<S> alongside Atom<S>
- `transaction()` uses `Effect.transaction()` internally
- On commit → `Atom.batch()` sync
- Cross-store `stxTransaction()` function

### Phase 3: TxSubscriptionRef + Stream Bridge
Add `{ subscriptionRef: true }` option:
- `changes()` returns Stream of committed values
- Bridgeable to other atoms, event logs, audit trails
- `TxPubSub` integration for fan-out

### Phase 4: Family Integration
Evaluate TxHashMap for family backing:
- `stxFamily(fn, { transactional: true })` → TxHashMap<K, V> instead of Atom.family
- Atomic multi-member operations
- `family.where()` + transactional queries

---

## Test Strategy

### Chaos Load Tests
- 1000 concurrent mutations with validation → verify no partial states leak
- Multi-store transaction with random failures → verify consistent rollback
- Rapid set/get interleaving → verify Atom always reflects committed state

### Race Condition Tests
- Two transactions modifying overlapping fields → verify conflict detection
- Read-during-write → verify snapshot isolation
- Subscription notification ordering → verify causal consistency

### Integration Tests
- Focus atoms see consistent state during transaction
- Filter/When atoms recompute exactly once per transaction
- React hooks render consistent snapshots (no torn reads)
- Stream bridge delivers committed values in order

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Dual state divergence (TxRef ≠ Atom) | Commit sync is single code path; never read TxRef from React |
| Effect runtime overhead in browser | Phase 1 uses no Effect; Phase 2 only for explicit transactions |
| API complexity for consumers | Default mode unchanged; transactional is opt-in |
| TxRef.makeUnsafe correctness | Verify in effect-smol tests; add STX-specific tests |
| Atom.batch() not handling nested batches | Verified: batchState.depth handles nesting correctly |
