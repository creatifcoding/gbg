/**
 * @tmnl/db — Managed Collection Factory
 *
 * Creates a fully managed collection: TanStack DB collection + STX bridge +
 * mutation methods. Domain devs get a clean API; STX and TanStack DB
 * are invisible implementation details.
 *
 * @example
 * ```ts
 * import { createManagedCollection } from "@tmnl/db"
 *
 * const todos = createManagedCollection({
 *   name: "todos",
 *   getKey: (t) => t.id,
 *   initialData: [{ id: 1, text: "Code", completed: false }],
 * })
 *
 * // Read via STX atoms
 * registry.get(todos.items)        // [{ id: 1, text: "Code", ... }]
 * registry.get(todos.item(1))      // { id: 1, text: "Code", ... }
 *
 * // Derive
 * const count = todos.derive(items => items.length)
 *
 * // Mutate
 * await todos.insert({ id: 2, text: "Ship", completed: false })
 * await todos.update(1, d => { d.completed = true })
 * await todos.remove(1)
 *
 * // Cleanup
 * todos.dispose()
 * ```
 *
 * @module
 */

import {
  createCollection,
  localOnlyCollectionOptions,
  type Collection,
} from "@tanstack/db"
import { AtomRegistry } from "effect-v4/unstable/reactivity"
import { stxCollection } from "@tmnl/stx"
import type { CollectionDef, ManagedCollection } from "./types.js"

/**
 * Create a fully managed local-only collection.
 *
 * Wires TanStack DB Collection → STX bridge automatically.
 * Mutations return promises that resolve when persisted.
 *
 * @param def - Collection definition (name, getKey, initialData)
 * @param registry - Optional AtomRegistry (creates one if not provided)
 * @returns ManagedCollection with atoms + mutation methods
 */
export function createManagedCollection<
  T extends object,
  TKey extends string | number = string | number,
>(
  def: CollectionDef<T, TKey>,
  registry?: AtomRegistry.AtomRegistry,
): ManagedCollection<T, TKey> {
  const reg = registry ?? AtomRegistry.make()

  // ── Create the TanStack DB Collection ──────────────────────
  const collection = createCollection<T, TKey>(
    localOnlyCollectionOptions<T, TKey>({
      getKey: def.getKey,
      initialData: def.initialData ? [...def.initialData] : [],
    }),
  )

  // ── Bridge to STX ──────────────────────────────────────────
  const bridge = stxCollection<T, TKey>(collection as any, reg)

  // ── Mutation methods ───────────────────────────────────────
  async function insert(item: T): Promise<void> {
    const tx = collection.insert(item)
    await tx.isPersisted.promise
  }

  async function update(key: TKey, fn: (draft: T) => void): Promise<void> {
    const tx = collection.update(key, fn as any)
    await tx.isPersisted.promise
  }

  async function remove(key: TKey): Promise<void> {
    const tx = collection.delete(key)
    await tx.isPersisted.promise
  }

  return {
    def,
    bridge,
    registry: reg,
    items: bridge.items,
    item: bridge.item,
    derive: bridge.derive,
    insert,
    update,
    remove,
    dispose: bridge.dispose,
  }
}

/**
 * Wait for a TanStack DB collection to be ready.
 * Useful when using Electric sync (initial sync must complete).
 *
 * For local-only collections, this resolves near-instantly.
 */
export async function awaitReady<T extends object>(
  collection: Collection<T, any>,
): Promise<void> {
  await collection.stateWhenReady()
}
