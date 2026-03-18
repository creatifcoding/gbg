/**
 * @tmnl/entity — Reactive bridge (Entity → STX atoms)
 *
 * `Entity.reactive(registry, config)` produces a ReactiveEntity —
 * atoms for items, count, byId, per-item family, plus validated mutations.
 *
 * This is a self-contained reactive layer over an in-memory array.
 * For TanStack DB collection sync, use `@tmnl/db` which wraps this.
 *
 * @module
 */

import { Atom, AtomRegistry } from 'effect-v4/unstable/reactivity'
import * as Result from 'effect-v4/Result'
import type { FieldKind, ValidateResult, EntityClass, SchemaError } from './entity.js'

// ─── Types ───────────────────────────────────────────────────

export interface ReactiveConfig<T extends object, TKey extends string | number = string | number> {
  /** Extract primary key from an item */
  readonly getId: (item: T) => TKey
  /** Optional initial data */
  readonly initialData?: ReadonlyArray<T>
}

export interface ReactiveEntity<T extends object, TKey extends string | number = string | number> {
  /** All items atom */
  readonly items: Atom.Writable<T[], T[]>
  /** Derived count atom */
  readonly count: Atom.Atom<number>
  /** Derived Map<Key, Item> for O(1) lookups */
  readonly byId: Atom.Atom<Map<TKey, T>>
  /** Per-key family atom */
  readonly item: (key: TKey) => Atom.Atom<T | undefined>
  /** Validated insert (uses Entity.insert schema) — generated/readonly fields optional */
  readonly insert: (data: unknown) => Result.Result<T, SchemaError>
  /** Update by key (patch object merged) */
  readonly update: (key: TKey, patch: Partial<T>) => void
  /** Remove by key */
  readonly remove: (key: TKey) => void
  /** Field metadata for UI constraint decisions */
  readonly fieldMeta: Record<string, FieldKind>
  /** Entity tag name */
  readonly entityTag: string
  /** Dispose — cleanup subscriptions */
  readonly dispose: () => void
  /** The registry this reactive entity is bound to */
  readonly registry: AtomRegistry.AtomRegistry
}

// ─── Factory ─────────────────────────────────────────────────

/**
 * Create a ReactiveEntity from an EntityClass.
 *
 * @param entityClass - The Entity class (e.g. Todo)
 * @param registry - AtomRegistry to create atoms in
 * @param config - getId function and optional initial data
 */
export function createReactive<T extends object, TKey extends string | number = string | number>(
  entityClass: EntityClass,
  registry: AtomRegistry.AtomRegistry,
  config: ReactiveConfig<T, TKey>,
): ReactiveEntity<T, TKey> {
  const { getId, initialData = [] } = config

  // ── Core atoms ──
  const itemsAtom = Atom.make<T[]>([...initialData] as T[])

  const countAtom = Atom.make((get) => get(itemsAtom).length)

  const byIdAtom = Atom.make((get) => {
    const items = get(itemsAtom)
    const map = new Map<TKey, T>()
    for (const item of items) {
      map.set(getId(item), item)
    }
    return map
  })

  const itemFamily = Atom.family((key: TKey) =>
    Atom.make((get) => get(byIdAtom).get(key)),
  )

  // Mount all atoms
  registry.mount(itemsAtom)
  registry.mount(countAtom)
  registry.mount(byIdAtom)

  // ── Mutations ──

  const insertFn = (data: unknown): Result.Result<T, SchemaError> => {
    // Validate through insert schema (generated fields excluded)
    const result = entityClass.validate.insert(data)
    if (Result.isFailure(result)) return result as Result.Result<T, SchemaError>

    // Create full entity instance via select schema
    // Merge validated insert data with defaults
    const validated = result.success as T
    const current = registry.get(itemsAtom)
    registry.set(itemsAtom, [...current, validated])
    return Result.succeed(validated)
  }

  const updateFn = (key: TKey, patch: Partial<T>) => {
    const current = registry.get(itemsAtom)
    const updated = current.map((item) => {
      if (getId(item) === key) {
        return { ...item, ...patch }
      }
      return item
    })
    registry.set(itemsAtom, updated)
  }

  const removeFn = (key: TKey) => {
    const current = registry.get(itemsAtom)
    registry.set(itemsAtom, current.filter((item) => getId(item) !== key))
  }

  const disposeFn = () => {
    // Future: unsubscribe from external sync
  }

  return {
    items: itemsAtom,
    count: countAtom,
    byId: byIdAtom,
    item: itemFamily,
    insert: insertFn,
    update: updateFn,
    remove: removeFn,
    fieldMeta: entityClass.fieldMeta,
    entityTag: entityClass.entityTag,
    dispose: disposeFn,
    registry,
  }
}
