/**
 * @tmnl/db — Hook Factory
 *
 * `createEntityHooks(entity, config)` produces typed React hooks:
 *   - useItems()   → T[]
 *   - useItem(key) → T | undefined
 *   - useCount()   → number
 *   - useInsert()  → (data) => Ok | Err
 *   - useUpdate()  → (key, fn) => void
 *   - useRemove()  → (key) => void
 *
 * Domain devs import `const { useTodos, useTodo, ... } = createTodoHooks()`
 * and never touch STX, atoms, or TanStack DB directly.
 *
 * Uses explicit-registry pattern (two-arg useAtomValue) to avoid
 * cross-registry bugs.
 *
 * @since 0.0.1
 */

import { useMemo, useSyncExternalStore, useCallback, useRef } from 'react'
import { Atom, AtomRegistry } from 'effect-v4/unstable/reactivity'
import type { EntityClass } from '@tmnl/entity'
import { tanstackAdapter, type AdaptedCollection, type TanstackAdapterConfig } from './adapter.js'
import { reactive, type ReactiveCollection } from './reactive.js'

// ─── Types ───────────────────────────────────────────────────

export interface EntityHookConfig<T extends object, TKey extends string | number> {
  /** Key extractor — same as adapter config */
  getId: (item: T) => TKey
  /** Initial data for the collection */
  initialData?: T[]
  /** Optional pre-configured registry (default: creates new one) */
  registry?: AtomRegistry.AtomRegistry
}

export interface EntityHooks<T extends object, TKey extends string | number> {
  /** React hook: all items → T[] */
  useItems: () => T[]
  /** React hook: single item by key → T | undefined */
  useItem: (key: TKey) => T | undefined
  /** React hook: item count → number */
  useCount: () => number
  /** React hook: validated insert → (data: T) => Ok | Err */
  useInsert: () => (data: T) => { _tag: 'Ok'; value: T } | { _tag: 'Err'; issues: readonly string[] }
  /** React hook: update by key → (key: TKey, fn: (draft: T) => void) => void */
  useUpdate: () => (key: TKey, fn: (draft: T) => void) => void
  /** React hook: remove by key → (key: TKey) => void */
  useRemove: () => (key: TKey) => void
  /** Access to underlying reactive collection (for advanced use) */
  rx: ReactiveCollection<T, TKey>
  /** Access to underlying adapted collection (for advanced use) */
  adapted: AdaptedCollection<T, TKey>
  /** Atom registry used by hooks */
  registry: AtomRegistry.AtomRegistry
  /** Dispose all subscriptions */
  dispose: () => void
}

// ─── Explicit-registry useAtomValue ──────────────────────────

// WeakMap<AtomRegistry, WeakMap<Atom, Store>> for useSyncExternalStore
const storeCache = new WeakMap<AtomRegistry.AtomRegistry, WeakMap<Atom.Atom<any>, {
  subscribe: (cb: () => void) => () => void
  getSnapshot: () => any
}>>()

function useAtomValue<A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>): A {
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

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

// ─── Factory ─────────────────────────────────────────────────

/**
 * Create typed React hooks for an Entity.
 *
 * One call produces all the hooks a domain dev needs. Zero STX/atom knowledge required.
 *
 * @example
 * ```tsx
 * // In domain module:
 * import { createEntityHooks } from '@tmnl/db'
 * import { Todo } from './entities/todo'
 *
 * export const todoHooks = createEntityHooks(Todo, {
 *   getId: (t) => t.id,
 *   initialData: [
 *     { id: 1, text: 'Buy milk', completed: false, createdAt: Date.now() },
 *   ],
 * })
 *
 * // In React component:
 * function TodoList() {
 *   const items = todoHooks.useItems()
 *   const count = todoHooks.useCount()
 *   const insert = todoHooks.useInsert()
 *
 *   return (
 *     <div>
 *       <h2>Todos ({count})</h2>
 *       {items.map(t => <TodoRow key={t.id} todo={t} />)}
 *       <button onClick={() => insert({ id: 99, text: 'New', ... })}>Add</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function createEntityHooks<T extends object, TKey extends string | number>(
  entity: EntityClass<T>,
  config: EntityHookConfig<T, TKey>,
): EntityHooks<T, TKey> {
  const registry = config.registry ?? AtomRegistry.make()

  const adapted = tanstackAdapter(entity, {
    getId: config.getId,
    initialData: config.initialData,
  })

  const rx = reactive(registry, adapted, config.getId)

  // ── Hooks ──

  const useItems = () => useAtomValue(registry, rx.items)
  const useItem = (key: TKey) => useAtomValue(registry, rx.item(key))
  const useCount = () => useAtomValue(registry, rx.count)

  const useInsert = () => {
    // Stable ref to rx.insert
    return useCallback((data: T) => rx.insert(data), [])
  }

  const useUpdate = () => {
    return useCallback((key: TKey, fn: (draft: T) => void) => rx.update(key, fn), [])
  }

  const useRemove = () => {
    return useCallback((key: TKey) => rx.remove(key), [])
  }

  const dispose = () => {
    rx.dispose()
    adapted.cleanup()
  }

  return {
    useItems,
    useItem,
    useCount,
    useInsert,
    useUpdate,
    useRemove,
    rx,
    adapted,
    registry,
    dispose,
  }
}
