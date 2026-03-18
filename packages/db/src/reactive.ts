/**
 * @tmnl/db — Reactive bridge
 *
 * Connects an AdaptedCollection to STX atoms.
 * `reactive(registry, adapted)` → atoms for items, byId, count, plus mutation fns.
 *
 * Domain hooks consume these atoms — never TanStack DB or STX internals directly.
 *
 * @since 0.0.1
 */

import { Atom, AtomRegistry } from 'effect-v4/unstable/reactivity'
import type { AdaptedCollection } from './adapter.js'

// ─── Reactive Collection ─────────────────────────────────────

/**
 * A reactive view of an AdaptedCollection.
 *
 * All state is in atoms — React components subscribe to exactly the atoms they need.
 * Mutations are plain functions that write through the adapter (Schema-validated)
 * and then refresh the atoms.
 */
export interface ReactiveCollection<T extends object, TKey extends string | number = string | number> {
  /** All items — atom of T[] */
  readonly items: Atom.Writable<T[], T[]>

  /** Item count — derived atom */
  readonly count: Atom.Atom<number>

  /** Lookup by key — derived atom (Map for O(1) access) */
  readonly byId: Atom.Atom<Map<TKey, T>>

  /** Single item lookup — Atom.family keyed by TKey */
  readonly item: (key: TKey) => Atom.Atom<T | undefined>

  /** Insert — validates through Entity's insert schema, refreshes atoms */
  readonly insert: (data: T) => { _tag: 'Ok'; value: T } | { _tag: 'Err'; issues: readonly string[] }

  /** Update by key — mutates draft, refreshes atoms */
  readonly update: (key: TKey, fn: (draft: T) => void) => void

  /** Delete by key — removes from collection, refreshes atoms */
  readonly remove: (key: TKey) => void

  /** Dispose — unsubscribe from collection changes, stop atom sync */
  readonly dispose: () => void
}

// ─── Factory ─────────────────────────────────────────────────

/**
 * Create a reactive STX bridge over an AdaptedCollection.
 *
 * Sets up:
 * 1. `items` atom — synced from collection on every change
 * 2. `count` atom — derived from items.length
 * 3. `byId` atom — derived Map<TKey, T> for O(1) lookups
 * 4. `item(key)` — family atom for per-key subscriptions
 * 5. Mutation fns that write through the adapter and refresh atoms
 *
 * @param registry - AtomRegistry to create atoms in
 * @param adapted - AdaptedCollection from `tanstackAdapter()`
 * @param getId - Key extractor (same as adapter config)
 *
 * @example
 * ```ts
 * import { reactive } from '@tmnl/db'
 * import { tanstackAdapter } from '@tmnl/db'
 *
 * const adapted = tanstackAdapter(Todo, { getId: t => t.id })
 * const registry = AtomRegistry.make()
 * const rx = reactive(registry, adapted, t => t.id)
 *
 * // Subscribe in React: useAtomValue(registry, rx.items)
 * // Insert: rx.insert({ id: 1, text: 'New', ... })
 * ```
 */
export function reactive<T extends object, TKey extends string | number = string | number>(
  registry: AtomRegistry.AtomRegistry,
  adapted: AdaptedCollection<T, TKey>,
  getId: (item: T) => TKey,
): ReactiveCollection<T, TKey> {
  // ── Core atoms ──
  const itemsAtom = Atom.make<T[]>(adapted.toArray())

  const countAtom = Atom.make((get) => {
    return get(itemsAtom).length
  })

  const byIdAtom = Atom.make((get) => {
    const items = get(itemsAtom)
    const map = new Map<TKey, T>()
    for (const item of items) {
      map.set(getId(item), item)
    }
    return map
  })

  // Family for per-key subscriptions
  const itemFamily = Atom.family((key: TKey) =>
    Atom.make((get) => {
      return get(byIdAtom).get(key)
    }),
  )

  // ── Sync: collection → atoms ──
  // Subscribe to TanStack DB changes (e.g. from external sync/Electric)
  // and refresh the items atom. Mutations also trigger explicit refresh.
  let externalSyncActive = true
  const sub = adapted.subscribeChanges(() => {
    if (externalSyncActive) {
      const fresh = adapted.toArray()
      registry.set(itemsAtom, fresh)
    }
  })

  // ── Mutations ──

  // Helper: pause external sync, do mutation, refresh, resume
  const withMutation = <R>(fn: () => R): R => {
    externalSyncActive = false
    try {
      const result = fn()
      registry.set(itemsAtom, adapted.toArray())
      return result
    } finally {
      externalSyncActive = true
    }
  }

  const insertFn = (data: T) => {
    // Pause external sync BEFORE mutation to prevent double-fire
    // (TanStack DB fires subscribeChanges synchronously during insert)
    externalSyncActive = false
    const result = adapted.insert(data)
    if (result._tag === 'Ok') {
      registry.set(itemsAtom, adapted.toArray())
      externalSyncActive = true
      return { _tag: 'Ok' as const, value: data }
    }
    externalSyncActive = true
    return result
  }

  const updateFn = (key: TKey, fn: (draft: T) => void) => {
    externalSyncActive = false
    adapted.update(key, fn)
    registry.set(itemsAtom, adapted.toArray())
    externalSyncActive = true
  }

  const removeFn = (key: TKey) => {
    externalSyncActive = false
    adapted.delete(key)
    registry.set(itemsAtom, adapted.toArray())
    externalSyncActive = true
  }

  const disposeFn = () => {
    sub.unsubscribe()
  }

  return {
    items: itemsAtom,
    count: countAtom,
    byId: byIdAtom,
    item: itemFamily,
    insert: insertFn,
    update: updateFn,
    remove: removeFn,
    dispose: disposeFn,
  }
}
