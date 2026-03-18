/**
 * SPIKE: Collection → Atom Bridge
 *
 * Hypothesis: We can wrap a TanStack DB Collection as an effect-atom Atom,
 * such that:
 *   H1: Collection state is readable as an atom value
 *   H2: Collection mutations (insert/update/delete) trigger atom subscribers
 *   H3: Derived/computed atoms can compose with collection atoms
 *   H4: The bridge works with STX's explicit-registry pattern
 *   H5: Collection change events map to granular atom notifications
 *
 * Approach: Use localOnlyCollectionOptions for in-memory collections,
 * Atom.make() for the reactive bridge, and AtomRegistry for subscriptions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createCollection,
  localOnlyCollectionOptions,
} from '@tanstack/db'
import { Atom, AtomRegistry } from 'effect-v4/unstable/reactivity'

// ─── Test Types ──────────────────────────────────────────────
interface Todo {
  id: number
  text: string
  completed: boolean
  priority: number
}

// ─── Bridge Function: Collection → Atom ──────────────────────
/**
 * Wraps a TanStack DB Collection as a readable Atom.
 * The atom's value is the collection's current state as an array.
 * Mutations to the collection automatically update the atom.
 */
function collectionAtom<T extends object, TKey extends string | number>(
  collection: ReturnType<typeof createCollection<any, any, any>>,
): Atom.Atom<Array<T>> {
  // Create a writable atom seeded with current state
  const atom = Atom.make<Array<T>>(Array.from(collection.values()) as Array<T>)

  return atom
}

/**
 * Syncs a collection's state into an atom via the registry.
 * Returns a cleanup function.
 */
function syncCollectionToAtom<T extends object>(
  registry: AtomRegistry.AtomRegistry,
  collection: any,
  atom: Atom.Atom<Array<T>>,
): () => void {
  // Subscribe to collection changes and push into atom
  const subscription = collection.subscribeChanges(() => {
    const currentState = Array.from(collection.values()) as Array<T>
    registry.set(atom, currentState)
  })

  return () => subscription.unsubscribe()
}

/**
 * Creates a derived atom that computes from a collection atom.
 */
function derivedFromCollection<T extends object, R>(
  source: Atom.Atom<Array<T>>,
  fn: (items: Array<T>) => R,
): Atom.Atom<R> {
  return Atom.make((get) => fn(get(source)))
}

// ─── Tests ───────────────────────────────────────────────────

describe('Collection → Atom Bridge (Spike)', () => {
  let todos: any
  let registry: AtomRegistry.AtomRegistry

  beforeEach(async () => {
    registry = AtomRegistry.make()

    todos = createCollection(
      localOnlyCollectionOptions<Todo, number>({
        getKey: (todo) => todo.id,
        initialData: [
          { id: 1, text: 'Buy milk', completed: false, priority: 2 },
          { id: 2, text: 'Walk dog', completed: true, priority: 1 },
          { id: 3, text: 'Code STX', completed: false, priority: 3 },
        ],
      }),
    )

    // Wait for collection to be ready
    await todos.stateWhenReady()
  })

  // ─── H1: Collection state is readable as atom value ─────────
  describe('H1: Collection state → atom value', () => {
    it('reads initial collection state via atom', async () => {
      const atom = collectionAtom<Todo, number>(todos)
      const value = registry.get(atom)

      expect(value).toHaveLength(3)
      expect(value.map((t: Todo) => t.id).sort()).toEqual([1, 2, 3])
    })

    it('atom value reflects collection data accurately', async () => {
      const atom = collectionAtom<Todo, number>(todos)
      const value = registry.get(atom)

      const milk = value.find((t: Todo) => t.id === 1)
      expect(milk).toBeDefined()
      expect(milk!.text).toBe('Buy milk')
      expect(milk!.completed).toBe(false)
    })
  })

  // ─── H2: Mutations trigger atom subscribers ─────────────────
  describe('H2: Collection mutations → atom updates', () => {
    it('insert triggers atom subscriber', async () => {
      const atom = collectionAtom<Todo, number>(todos)
      const cleanup = syncCollectionToAtom<Todo>(registry, todos, atom)
      const subscriber = vi.fn()

      registry.subscribe(atom, subscriber)

      // Insert a new todo
      const tx = todos.insert({
        id: 4,
        text: 'New task',
        completed: false,
        priority: 1,
      })
      await tx.isPersisted.promise

      // Give the subscription time to fire
      await new Promise((r) => setTimeout(r, 50))

      expect(subscriber).toHaveBeenCalled()

      const value = registry.get(atom)
      expect(value).toHaveLength(4)
      expect(value.find((t: Todo) => t.id === 4)?.text).toBe('New task')

      cleanup()
    })

    it('update triggers atom subscriber', async () => {
      const atom = collectionAtom<Todo, number>(todos)
      const cleanup = syncCollectionToAtom<Todo>(registry, todos, atom)
      const subscriber = vi.fn()

      registry.subscribe(atom, subscriber)

      // Update a todo
      const tx = todos.update(1, (draft: Todo) => {
        draft.text = 'Buy almond milk'
        draft.completed = true
      })
      await tx.isPersisted.promise

      await new Promise((r) => setTimeout(r, 50))

      expect(subscriber).toHaveBeenCalled()

      const value = registry.get(atom)
      const updated = value.find((t: Todo) => t.id === 1)
      expect(updated?.text).toBe('Buy almond milk')
      expect(updated?.completed).toBe(true)

      cleanup()
    })

    it('delete triggers atom subscriber', async () => {
      const atom = collectionAtom<Todo, number>(todos)
      const cleanup = syncCollectionToAtom<Todo>(registry, todos, atom)
      const subscriber = vi.fn()

      registry.subscribe(atom, subscriber)

      // Delete a todo
      const tx = todos.delete(2)
      await tx.isPersisted.promise

      await new Promise((r) => setTimeout(r, 50))

      expect(subscriber).toHaveBeenCalled()

      const value = registry.get(atom)
      expect(value).toHaveLength(2)
      expect(value.find((t: Todo) => t.id === 2)).toBeUndefined()

      cleanup()
    })
  })

  // ─── H3: Derived atoms compose with collection atoms ────────
  describe('H3: Derived/computed atoms', () => {
    it('derived atom computes from collection atom', async () => {
      const atom = collectionAtom<Todo, number>(todos)

      // Derived: count of incomplete todos
      const incompleteCount = derivedFromCollection<Todo, number>(
        atom,
        (items) => items.filter((t) => !t.completed).length,
      )

      const count = registry.get(incompleteCount)
      expect(count).toBe(2) // items 1 and 3 are incomplete
    })

    it('derived atom updates when collection mutates', async () => {
      const atom = collectionAtom<Todo, number>(todos)
      const cleanup = syncCollectionToAtom<Todo>(registry, todos, atom)

      // Derived: total priority of incomplete todos
      const totalPriority = derivedFromCollection<Todo, number>(
        atom,
        (items) =>
          items
            .filter((t) => !t.completed)
            .reduce((sum, t) => sum + t.priority, 0),
      )

      // Mount the derived atom so it receives propagated updates
      // (smol derived atoms are lazy — they only recompute when subscribed)
      const unmountDerived = registry.mount(totalPriority)

      // Initial: items 1 (priority 2) and 3 (priority 3) = 5
      expect(registry.get(totalPriority)).toBe(5)

      // Complete item 1 → only item 3 remains incomplete
      const tx = todos.update(1, (draft: Todo) => {
        draft.completed = true
      })
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      // Now only item 3 (priority 3)
      expect(registry.get(totalPriority)).toBe(3)

      unmountDerived()
      cleanup()
    })

    it('multiple derived atoms from same collection atom', async () => {
      const atom = collectionAtom<Todo, number>(todos)

      const completedTexts = derivedFromCollection<Todo, string[]>(
        atom,
        (items) => items.filter((t) => t.completed).map((t) => t.text),
      )

      const highPriority = derivedFromCollection<Todo, Todo[]>(
        atom,
        (items) => items.filter((t) => t.priority >= 3),
      )

      expect(registry.get(completedTexts)).toEqual(['Walk dog'])
      expect(registry.get(highPriority)).toHaveLength(1)
      expect(registry.get(highPriority)[0].text).toBe('Code STX')
    })
  })

  // ─── H4: Works with explicit-registry pattern ───────────────
  describe('H4: Explicit registry isolation', () => {
    it('separate registries see independent atom values', async () => {
      const registry2 = AtomRegistry.make()

      const atom = collectionAtom<Todo, number>(todos)

      // Mount the atom in registry1 so set() propagates
      const unmount1 = registry.mount(atom)

      // Both registries read the same initial value
      expect(registry.get(atom)).toHaveLength(3)
      expect(registry2.get(atom)).toHaveLength(3)

      // Sync only to registry1
      const cleanup = syncCollectionToAtom<Todo>(registry, todos, atom)

      const tx = todos.insert({
        id: 5,
        text: 'Registry test',
        completed: false,
        priority: 1,
      })
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      // Registry1 is synced — sees 4 items
      expect(registry.get(atom)).toHaveLength(4)

      // Registry2 is NOT synced — still sees initial value (3)
      expect(registry2.get(atom)).toHaveLength(3)

      unmount1()
      cleanup()
    })
  })

  // ─── H5: Change events map to granular notifications ────────
  describe('H5: Granular change events', () => {
    it('subscribeChanges provides typed change messages', async () => {
      const changes: any[] = []

      const subscription = todos.subscribeChanges((msgs: any[]) => {
        changes.push(...msgs)
      })

      const tx = todos.insert({
        id: 10,
        text: 'Change test',
        completed: false,
        priority: 1,
      })
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      expect(changes.length).toBeGreaterThan(0)

      // Verify change message structure
      const insertChange = changes.find(
        (c) => c.type === 'insert' && c.value?.id === 10,
      )
      expect(insertChange).toBeDefined()

      subscription.unsubscribe()
    })

    it('per-item atom via change routing', async () => {
      // Create a family of atoms, one per todo ID
      const itemAtoms = new Map<number, Atom.Atom<Todo | undefined>>()
      const unmounts: Array<() => void> = []

      function getItemAtom(id: number): Atom.Atom<Todo | undefined> {
        if (!itemAtoms.has(id)) {
          const item = todos.get(id) as Todo | undefined
          const atom = Atom.make<Todo | undefined>(item)
          itemAtoms.set(id, atom)
          // Mount each atom so registry.set() propagates
          unmounts.push(registry.mount(atom))
        }
        return itemAtoms.get(id)!
      }

      // Seed all atoms
      for (const [key, value] of todos.entries()) {
        const atom = getItemAtom(key as number)
        registry.set(atom, value as Todo)
      }

      // Subscribe to route changes to per-item atoms
      const subscription = todos.subscribeChanges((msgs: any[]) => {
        for (const msg of msgs) {
          const id = msg.value?.id ?? msg.key
          if (typeof id === 'number') {
            const atom = getItemAtom(id)
            if (msg.type === 'delete') {
              registry.set(atom, undefined)
            } else {
              registry.set(atom, msg.value as Todo)
            }
          }
        }
      })

      // Verify initial state
      expect(registry.get(getItemAtom(1))?.text).toBe('Buy milk')
      expect(registry.get(getItemAtom(2))?.text).toBe('Walk dog')

      // Update item 1
      const tx = todos.update(1, (draft: Todo) => {
        draft.text = 'Buy oat milk'
      })
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      // Only item 1's atom should have updated
      expect(registry.get(getItemAtom(1))?.text).toBe('Buy oat milk')
      expect(registry.get(getItemAtom(2))?.text).toBe('Walk dog') // unchanged

      subscription.unsubscribe()
      unmounts.forEach((u) => u())
    })
  })
})
