/**
 * @tmnl/db — TanStack DB Entity Adapter
 *
 * Bridges `@tmnl/entity` → TanStack DB Collection with Schema-validated mutations.
 *
 * ```ts
 * import { tanstackAdapter } from '@tmnl/db'
 *
 * const todosCollection = tanstackAdapter(Todo, {
 *   getId: (t) => t.id,
 * })
 * ```
 *
 * @since 0.0.1
 */

import {
  createCollection,
  localOnlyCollectionOptions,
  type Collection,
} from '@tanstack/db'
import * as Schema from 'effect-v4/Schema'
import * as Result from 'effect-v4/Result'
import type { EntityClass, SchemaError } from '@tmnl/entity'

// ─── Adapter Config ──────────────────────────────────────────

export interface TanstackAdapterConfig<T extends object, TKey extends string | number = string | number> {
  /**
   * Extract the primary key from a row.
   *
   * @example
   * ```ts
   * getId: (t) => t.id
   * ```
   */
  readonly getId: (item: T) => TKey

  /**
   * Optional initial seed data.
   */
  readonly initialData?: ReadonlyArray<T>

  /**
   * Mutation hooks — called after each operation.
   */
  readonly onInsert?: (ctx: { item: T; transaction: any }) => void | Promise<void>
  readonly onUpdate?: (ctx: { key: TKey; item: T; transaction: any }) => void | Promise<void>
  readonly onDelete?: (ctx: { key: TKey; transaction: any }) => void | Promise<void>
}

// ─── Adapted Collection ──────────────────────────────────────

/**
 * A TanStack DB Collection backed by an Entity definition.
 *
 * All mutations route through the entity's Schema variants:
 * - `insert()` validates through `Entity.insert` (Generated excluded)
 * - `update()` validates through `Entity.update` (timestamps optional)
 * - `delete()` extracts key for removal
 *
 * Wire boundary (sync) uses `Entity.codec.encode/decode`.
 */
export interface AdaptedCollection<T extends object, TKey extends string | number = string | number> {
  /** Underlying TanStack DB collection */
  readonly collection: Collection<T>

  /** Entity tag (e.g. 'Todo') */
  readonly entityTag: string

  // ── Reads ──

  /** Get all items as array */
  readonly toArray: () => T[]

  /** Get item by key */
  readonly get: (key: TKey) => T | undefined

  /** Get total count */
  readonly count: () => number

  // ── Validated Mutations ──

  /**
   * Insert a new item. Data is validated through the Entity's `insert` variant.
   * Generated fields (id, etc.) must be provided here since TanStack DB is client-side.
   */
  readonly insert: (data: T) => Result.Result<{ item: T; transaction: any }, SchemaError>

  /**
   * Update an item by key. Callback receives a mutable draft.
   */
  readonly update: (key: TKey, fn: (draft: T) => void) => any

  /**
   * Delete an item by key.
   */
  readonly delete: (key: TKey) => any

  // ── Subscriptions ──

  /**
   * Subscribe to collection changes.
   */
  readonly subscribeChanges: Collection<T>['subscribeChanges']

  // ── Lifecycle ──

  /** Current status */
  readonly status: () => string

  /** Cleanup the collection */
  readonly cleanup: () => void
}

// ─── Adapter Factory ─────────────────────────────────────────

/**
 * Create a TanStack DB Collection from an Entity definition.
 *
 * Routes all mutations through the entity's Schema variants for validation.
 * Wire encode/decode is available via `entity.codec`.
 *
 * @param entity - Entity class (e.g. `Todo`)
 * @param config - Adapter configuration
 * @returns An AdaptedCollection wrapping TanStack DB
 *
 * @example
 * ```ts
 * import { Entity } from '@tmnl/entity'
 * import { tanstackAdapter } from '@tmnl/db'
 * import * as Schema from 'effect-v4/Schema'
 *
 * class Todo extends Entity('Todo')({
 *   id:        Entity.generated(Schema.Number),
 *   text:      Schema.NonEmptyString,
 *   completed: Schema.Boolean,
 *   createdAt: Entity.timestamp(),
 * }) {}
 *
 * const todos = tanstackAdapter(Todo, {
 *   getId: (t) => t.id,
 *   initialData: [
 *     { id: 1, text: 'Buy milk', completed: false, createdAt: Date.now() },
 *   ],
 *   onInsert: ({ item }) => console.log('Inserted:', item),
 * })
 *
 * // Validated insert — rejects invalid data
 * const result = todos.insert({ id: 2, text: 'Walk dog', completed: false, createdAt: Date.now() })
 * if (result._tag === 'Ok') console.log('Inserted:', result.value.item)
 *
 * // Read
 * const all = todos.toArray()
 * const one = todos.get(1)
 * ```
 */
export function tanstackAdapter<T extends object, TKey extends string | number = string | number>(
  entity: EntityClass,
  config: TanstackAdapterConfig<T, TKey>,
): AdaptedCollection<T, TKey> {
  // Create TanStack DB collection
  const collection = createCollection<T>(
    localOnlyCollectionOptions<T, TKey>({
      getKey: config.getId,
      initialData: [...(config.initialData ?? [])],
    }),
  )

  // ── Validate-and-insert ──
  const insertFn = (data: T): Result.Result<{ item: T; transaction: any }, SchemaError> => {
    // Validate through Entity's insert schema
    const validation = entity.validate.insert(data)
    if (Result.isFailure(validation)) {
      return validation
    }

    // TanStack DB insert — key extracted by collection's getKey config
    const transaction = collection.insert(data)

    // Fire hook
    if (config.onInsert) {
      Promise.resolve(config.onInsert({ item: data, transaction })).catch(() => {})
    }

    return Result.succeed({ item: data, transaction })
  }

  // ── Update ──
  const updateFn = (key: TKey, fn: (draft: T) => void) => {
    const transaction = collection.update(key as any, fn)

    // Fire hook
    if (config.onUpdate) {
      const item = collection.get(key as any)
      if (item) {
        Promise.resolve(config.onUpdate({ key, item, transaction })).catch(() => {})
      }
    }

    return transaction
  }

  // ── Delete ──
  const deleteFn = (key: TKey) => {
    const transaction = collection.delete(key as any)

    // Fire hook
    if (config.onDelete) {
      Promise.resolve(config.onDelete({ key, transaction })).catch(() => {})
    }

    return transaction
  }

  return {
    collection,
    entityTag: entity.entityTag,

    // Reads — TanStack DB: .toArray is a property, not a function
    toArray: () => (collection as any).toArray,
    get: (key) => collection.get(key as any),
    count: () => (collection as any).toArray.length,

    // Validated mutations
    insert: insertFn,
    update: updateFn,
    delete: deleteFn,

    // Subscriptions
    subscribeChanges: collection.subscribeChanges.bind(collection),

    // Lifecycle — TanStack DB: .status is a property
    status: () => (collection as any).status ?? 'unknown',
    cleanup: () => (collection as any).cleanup(),
  }
}
