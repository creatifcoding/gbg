/**
 * @tmnl/entity — Hook factory (Entity → React hooks)
 *
 * `Entity.createHooks(config)` produces typed React hooks that domain devs use directly.
 * No STX, TanStack DB, or Effect knowledge required.
 *
 * Includes `useStx(key)` for per-item surgical reactivity (lens, focus, setAt, modify)
 * with bidirectional sync back to the collection.
 *
 * Uses explicit-registry `useAtomValue` via useSyncExternalStore —
 * no RegistryContext dependency.
 *
 * @module
 */

import { useSyncExternalStore, useCallback, useMemo } from 'react'
import { Atom, AtomRegistry } from 'effect-v4/unstable/reactivity'
import { stx as stxFactory, type StxInstance } from '@tmnl/stx'
import type { EntityClass, ValidateResult, FieldKind } from './entity.js'
import { createReactive, type ReactiveConfig, type ReactiveEntity } from './reactive.js'

// ─── Store cache for useSyncExternalStore ────────────────────

interface AtomStore<A> {
  subscribe: (cb: () => void) => () => void
  getSnapshot: () => A
}

const storeCache = new WeakMap<AtomRegistry.AtomRegistry, WeakMap<Atom.Atom<any>, AtomStore<any>>>()

function getOrCreateStore<A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>): AtomStore<A> {
  let regMap = storeCache.get(registry)
  if (!regMap) {
    regMap = new WeakMap()
    storeCache.set(registry, regMap)
  }

  let store = regMap.get(atom)
  if (!store) {
    store = {
      subscribe: (cb: () => void) => registry.subscribe(atom, cb),
      getSnapshot: () => registry.get(atom),
    }
    regMap.set(atom, store)
  }
  return store
}

function useAtomValue<A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>): A {
  const store = getOrCreateStore(registry, atom)
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

// ─── Bidirectional StxInstance ────────────────────────────────

/**
 * Create an StxInstance for a single item that writes back to the collection.
 *
 * When you call `instance.setAt(lens.title, 'New')`:
 * 1. The per-item stx atom updates
 * 2. The collection items atom updates (bidirectional)
 *
 * @internal
 */
function createBidirectionalStx<T extends object, TKey extends string | number>(
  item: T,
  key: TKey,
  getId: (item: T) => TKey,
  rx: ReactiveEntity<T, TKey>,
  registry: AtomRegistry.AtomRegistry,
): StxInstance<T> {
  // Create a standard stx instance (Entity-aware — detects fieldMeta automatically)
  const instance = stxFactory<T>(item, registry)

  // Wrap set/setAt/modify to sync back to collection
  const originalSet = instance.set
  const originalSetAt = instance.setAt
  const originalModify = instance.modify

  const syncToCollection = () => {
    const updated = instance.get()
    rx.update(key, updated as any)
  }

  instance.set = (value: T) => {
    originalSet(value)
    syncToCollection()
  }

  ;(instance as any).setAt = <A>(
    l: { replace: (value: A, state: T) => T },
    value: A,
  ) => {
    originalSetAt(l, value)
    syncToCollection()
  }

  ;(instance as any).modify = <A>(
    l: { modify: (fn: (a: A) => A) => (state: T) => T },
    fn: (a: A) => A,
  ) => {
    originalModify(l, fn)
    syncToCollection()
  }

  return instance
}

// ─── Hook Types ──────────────────────────────────────────────

export interface EntityHooksConfig<T extends object, TKey extends string | number = string | number> {
  /** Extract primary key from an item */
  readonly getId: (item: T) => TKey
  /** Optional initial data */
  readonly initialData?: ReadonlyArray<T>
  /** Optional pre-built registry (creates one if not provided) */
  readonly registry?: AtomRegistry.AtomRegistry
}

export interface EntityHooks<T extends object, TKey extends string | number = string | number> {
  /** Read all items */
  readonly useItems: () => T[]
  /** Read single item by key */
  readonly useItem: (key: TKey) => T | undefined
  /** Read count */
  readonly useCount: () => number
  /** Per-item surgical reactivity — StxInstance with bidirectional collection sync */
  readonly useStx: (key: TKey) => StxInstance<T> | undefined
  /** Insert with validation — returns validate result */
  readonly useInsert: () => (data: unknown) => ValidateResult<T>
  /** Update by key with patch */
  readonly useUpdate: () => (key: TKey, patch: Partial<T>) => void
  /** Remove by key */
  readonly useRemove: () => (key: TKey) => void
  /** Collection-level stx store — lens into all items */
  readonly store: StxInstance<T[]>
  /** Field metadata for UI constraint decisions */
  readonly fieldMeta: Record<string, FieldKind>
  /** Underlying reactive entity (escape hatch) */
  readonly rx: ReactiveEntity<T, TKey>
  /** Registry used */
  readonly registry: AtomRegistry.AtomRegistry
  /** Dispose — cleanup */
  readonly dispose: () => void
}

// ─── Factory ─────────────────────────────────────────────────

/**
 * Create React hooks from an Entity class.
 *
 * @example
 * ```ts
 * const todoHooks = Todo.createHooks({ getId: t => t.id, initialData: seeds })
 *
 * function TodoList() {
 *   const items = todoHooks.useItems()
 *   const insert = todoHooks.useInsert()
 *   return <div>{items.map(t => <TodoRow key={t.id} todo={t} />)}</div>
 * }
 *
 * function TodoEditor({ id }: { id: number }) {
 *   const stx = todoHooks.useStx(id)
 *   if (!stx) return null
 *   // Surgical lens access — writes back to collection automatically
 *   stx.setAt(stx.lens.title, 'Updated')
 * }
 * ```
 */
export function createEntityHooks<T extends object, TKey extends string | number = string | number>(
  entityClass: EntityClass,
  config: EntityHooksConfig<T, TKey>,
): EntityHooks<T, TKey> {
  const registry = config.registry ?? AtomRegistry.make()
  const rx = createReactive<T, TKey>(entityClass, registry, {
    getId: config.getId,
    initialData: config.initialData,
  })

  // Collection-level stx store — wraps the items atom
  const collectionStore = stxFactory<T[]>(registry.get(rx.items), registry)

  // Sync collection store when items atom changes
  registry.subscribe(rx.items, () => {
    const fresh = registry.get(rx.items)
    // Only update if reference changed (avoid loops)
    if (fresh !== collectionStore.get()) {
      collectionStore.set(fresh)
    }
  })

  // Per-item stx cache — WeakMap avoids recreating on every render
  const stxCache = new Map<TKey, StxInstance<T>>()

  const useItems = () => useAtomValue(registry, rx.items)
  const useItem = (key: TKey) => useAtomValue(registry, rx.item(key))
  const useCount = () => useAtomValue(registry, rx.count)

  const useStx = (key: TKey): StxInstance<T> | undefined => {
    const item = useAtomValue(registry, rx.item(key))

    return useMemo(() => {
      if (!item) {
        stxCache.delete(key)
        return undefined
      }

      // Check cache — reuse if item reference hasn't changed
      const cached = stxCache.get(key)
      if (cached && cached.get() === item) return cached

      // Create new bidirectional stx instance
      const instance = createBidirectionalStx<T, TKey>(
        item, key, config.getId, rx, registry,
      )
      stxCache.set(key, instance)
      return instance
    }, [item, key])
  }

  const useInsert = () => {
    return useCallback((data: unknown) => rx.insert(data), [])
  }

  const useUpdate = () => {
    return useCallback((key: TKey, patch: Partial<T>) => rx.update(key, patch), [])
  }

  const useRemove = () => {
    return useCallback((key: TKey) => rx.remove(key), [])
  }

  return {
    useItems,
    useItem,
    useCount,
    useStx,
    useInsert,
    useUpdate,
    useRemove,
    store: collectionStore,
    fieldMeta: entityClass.fieldMeta,
    rx,
    registry,
    dispose: rx.dispose,
  }
}
