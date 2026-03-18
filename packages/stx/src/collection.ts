/**
 * @tmnl/stx — Collection → Atom Bridge
 *
 * Wraps a TanStack DB Collection as reactive STX atoms.
 * Auto-mounts, auto-syncs, and provides cleanup.
 *
 * This is the GENERIC bridge — no schema validation.
 * Schema-backed validation lives in @tmnl/db where VariantSchema
 * variants map directly to TanStack DB operations.
 *
 * Critical invariant: smol derived atoms are LAZY — must mount before
 * registry.set() on the source propagates to derived atoms.
 *
 * @module
 */

import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"

// ─── Types ───────────────────────────────────────────────────

/**
 * Minimal Collection interface — compatible with TanStack DB Collection
 * without importing @tanstack/db directly.
 */
export interface CollectionLike<T extends object, TKey extends string | number = string | number> {
  readonly id: string
  values(): IterableIterator<T>
  entries(): IterableIterator<[TKey, T]>
  get(key: TKey): T | undefined
  has(key: TKey): boolean
  readonly size: number
  readonly status: string
  subscribeChanges(
    callback: (changes: Array<ChangeMessageLike<T>>) => void,
    options?: { includeInitialState?: boolean },
  ): { unsubscribe(): void }
}

export interface ChangeMessageLike<T> {
  readonly type: 'insert' | 'update' | 'delete'
  readonly key: string | number
  readonly value: T
}

/**
 * Return type of stxCollection().
 */
export interface StxCollection<T extends object, TKey extends string | number = string | number> {
  /** Atom containing the full array of collection items */
  readonly items: Atom.Writable<Array<T>, Array<T>>

  /** Get the underlying collection reference */
  readonly collection: CollectionLike<T, TKey>

  /** Registry used for this bridge */
  readonly registry: AtomRegistry.AtomRegistry

  /**
   * Create a derived atom from this collection.
   * Auto-mounted — propagation works immediately.
   */
  readonly derive: <R>(fn: (items: Array<T>) => R) => Atom.Atom<R>

  /**
   * Get or create a per-item atom.
   * Uses a family cache — same key returns same atom.
   * Auto-mounted and synced via change routing.
   */
  readonly item: (key: TKey) => Atom.Atom<T | undefined>

  /**
   * Dispose the bridge — unsubscribes from collection, unmounts all atoms.
   */
  readonly dispose: () => void
}

// ─── Factory ─────────────────────────────────────────────────

/**
 * Bridge a TanStack DB Collection into the STX reactive atom system.
 *
 * This is the generic (unvalidated) bridge. For Schema-backed validation
 * with VariantSchema variants, use @tmnl/db's defineCollection().
 *
 * @param collection - TanStack DB Collection (or any CollectionLike)
 * @param registry - Optional AtomRegistry (creates one if not provided)
 */
export function stxCollection<T extends object, TKey extends string | number = string | number>(
  collection: CollectionLike<T, TKey>,
  registry?: AtomRegistry.AtomRegistry,
): StxCollection<T, TKey> {
  const reg = registry ?? AtomRegistry.make()
  const cleanups: Array<() => void> = []

  // ── Items atom: full collection state ──────────────────────
  const itemsAtom = Atom.make<Array<T>>(Array.from(collection.values()))
  cleanups.push(reg.mount(itemsAtom))

  // ── Collection → atom sync ─────────────────────────────────
  const syncSub = collection.subscribeChanges(() => {
    reg.set(itemsAtom, Array.from(collection.values()))
  })
  cleanups.push(() => syncSub.unsubscribe())

  // ── Per-item atom family ───────────────────────────────────
  const itemAtoms = new Map<TKey, Atom.Writable<T | undefined, T | undefined>>()

  function getItemAtom(key: TKey): Atom.Writable<T | undefined, T | undefined> {
    let atom = itemAtoms.get(key)
    if (!atom) {
      atom = Atom.make<T | undefined>(collection.get(key))
      itemAtoms.set(key, atom)
      cleanups.push(reg.mount(atom))
    }
    return atom
  }

  // Route granular change events to per-item atoms.
  // TanStack DB may send empty change arrays for deletes in localOnly mode,
  // so we also reconcile all tracked atoms against the collection state.
  const itemSub = collection.subscribeChanges((changes) => {
    // 1. Route explicit change messages
    for (const change of changes) {
      const key = change.key as TKey
      const existing = itemAtoms.get(key)
      if (existing) {
        if (change.type === 'delete') {
          reg.set(existing, undefined)
        } else {
          reg.set(existing, change.value)
        }
      }
    }

    // 2. Reconcile tracked atoms — catches deletes not in change array
    for (const [key, atom] of itemAtoms) {
      const current = collection.get(key)
      const atomValue = reg.get(atom)
      if (current === undefined && atomValue !== undefined) {
        reg.set(atom, undefined)
      } else if (current !== undefined && current !== atomValue) {
        reg.set(atom, current)
      }
    }
  })
  cleanups.push(() => itemSub.unsubscribe())

  // ── Derive factory ─────────────────────────────────────────
  function derive<R>(fn: (items: Array<T>) => R): Atom.Atom<R> {
    const derived = Atom.make((get: any) => fn(get(itemsAtom)))
    cleanups.push(reg.mount(derived))
    return derived
  }

  // ── Dispose ────────────────────────────────────────────────
  function dispose(): void {
    for (let i = cleanups.length - 1; i >= 0; i--) {
      cleanups[i]()
    }
    cleanups.length = 0
    itemAtoms.clear()
  }

  return {
    items: itemsAtom,
    collection,
    registry: reg,
    derive,
    item: getItemAtom,
    dispose,
  }
}
