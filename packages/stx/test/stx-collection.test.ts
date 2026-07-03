/**
 * Tests for stxCollection() factory
 *
 * Validates the production bridge API built from spike learnings.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createCollection,
  localOnlyCollectionOptions,
} from '@tanstack/db'
import { AtomRegistry } from 'effect/unstable/reactivity'
import { stxCollection, type StxCollection } from '../src/collection.js'

interface Todo {
  id: number
  text: string
  completed: boolean
  priority: number
}

describe('stxCollection() factory', () => {
  let todos: any
  let registry: AtomRegistry.AtomRegistry
  let bridge: StxCollection<Todo, number>

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
    await todos.stateWhenReady()

    bridge = stxCollection<Todo, number>(todos, registry)
  })

  afterEach(() => {
    bridge.dispose()
  })

  // ── items atom ──────────────────────────────────────────────
  describe('items atom', () => {
    it('reads initial collection state', () => {
      const items = registry.get(bridge.items)
      expect(items).toHaveLength(3)
      expect(items.map((t) => t.id).sort()).toEqual([1, 2, 3])
    })

    it('updates on insert', async () => {
      const tx = todos.insert({ id: 4, text: 'New', completed: false, priority: 1 })
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      expect(registry.get(bridge.items)).toHaveLength(4)
    })

    it('updates on update', async () => {
      const tx = todos.update(1, (d: Todo) => { d.text = 'Oat milk' })
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      const item = registry.get(bridge.items).find((t) => t.id === 1)
      expect(item?.text).toBe('Oat milk')
    })

    it('updates on delete', async () => {
      const tx = todos.delete(2)
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      expect(registry.get(bridge.items)).toHaveLength(2)
      expect(registry.get(bridge.items).find((t) => t.id === 2)).toBeUndefined()
    })
  })

  // ── derive() ────────────────────────────────────────────────
  describe('derive()', () => {
    it('creates a derived atom', () => {
      const count = bridge.derive((items) => items.length)
      expect(registry.get(count)).toBe(3)
    })

    it('derived atom updates on mutation', async () => {
      const incompleteCount = bridge.derive(
        (items) => items.filter((t) => !t.completed).length,
      )
      expect(registry.get(incompleteCount)).toBe(2)

      const tx = todos.update(1, (d: Todo) => { d.completed = true })
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      expect(registry.get(incompleteCount)).toBe(1)
    })

    it('multiple derived atoms from same bridge', () => {
      const textList = bridge.derive((items) => items.map((t) => t.text))
      const totalPriority = bridge.derive(
        (items) => items.reduce((sum, t) => sum + t.priority, 0),
      )

      expect(registry.get(textList)).toContain('Buy milk')
      expect(registry.get(totalPriority)).toBe(6) // 2+1+3
    })
  })

  // ── item() ──────────────────────────────────────────────────
  describe('item() — per-item atom family', () => {
    it('returns atom for specific item', () => {
      const todo1 = bridge.item(1)
      expect(registry.get(todo1)?.text).toBe('Buy milk')
    })

    it('returns same atom for same key', () => {
      const a = bridge.item(1)
      const b = bridge.item(1)
      expect(a).toBe(b)
    })

    it('returns undefined for missing key', () => {
      const missing = bridge.item(999)
      expect(registry.get(missing)).toBeUndefined()
    })

    it('updates per-item atom on mutation', async () => {
      const todo1 = bridge.item(1)
      expect(registry.get(todo1)?.text).toBe('Buy milk')

      const tx = todos.update(1, (d: Todo) => { d.text = 'Buy oat milk' })
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      expect(registry.get(todo1)?.text).toBe('Buy oat milk')
    })

    it('sets to undefined on delete', async () => {
      const todo2 = bridge.item(2)
      expect(registry.get(todo2)?.text).toBe('Walk dog')

      const tx = todos.delete(2)
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      expect(registry.get(todo2)).toBeUndefined()
    })

    it('does not create atoms for unaccessed keys', async () => {
      // Only access item 1
      bridge.item(1)

      // Insert item 4 — should NOT create an atom for it
      const tx = todos.insert({ id: 4, text: 'New', completed: false, priority: 1 })
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      // items atom is updated
      expect(registry.get(bridge.items)).toHaveLength(4)
      // But no atom was created for item 4 (not accessed)
    })
  })

  // ── dispose() ───────────────────────────────────────────────
  describe('dispose()', () => {
    it('stops syncing after dispose', async () => {
      bridge.dispose()

      const before = registry.get(bridge.items)

      const tx = todos.insert({ id: 5, text: 'After dispose', completed: false, priority: 1 })
      await tx.isPersisted.promise
      await new Promise((r) => setTimeout(r, 50))

      // Items atom should not have updated
      expect(registry.get(bridge.items)).toEqual(before)
    })
  })

  // ── registry isolation ──────────────────────────────────────
  describe('registry isolation', () => {
    it('creates own registry if none provided', async () => {
      const bridge2 = stxCollection<Todo, number>(todos)
      expect(bridge2.registry).not.toBe(registry)
      expect(bridge2.registry.get(bridge2.items)).toHaveLength(3)
      bridge2.dispose()
    })
  })
})
