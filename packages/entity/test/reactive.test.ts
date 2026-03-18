/**
 * Entity.reactive() Integration Test
 *
 * Entity delegates to STX atoms for reactive state over a collection.
 *
 *   H0: Entity.reactive() creates atoms from initial data
 *   H1: items atom reflects all items
 *   H2: count atom derives from items
 *   H3: byId atom provides O(1) lookup
 *   H4: item(key) family atom for per-key subscription
 *   H5: insert validates through Entity.insert schema
 *   H6: insert rejects invalid data
 *   H7: update mutates and refreshes atoms
 *   H8: remove deletes and refreshes atoms
 *   H9: readonly fields info available for UI constraints
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { AtomRegistry } from 'effect-v4/unstable/reactivity'
import { Entity } from '../src/entity.js'

// ─── Test Entity ─────────────────────────────────────────────

class Todo extends Entity('Todo')({
  id:        Entity.generated(Schema.Number),
  text:      Schema.NonEmptyString,
  completed: Schema.Boolean,
  score:     Entity.readonly(Schema.Number),
  createdAt: Entity.timestamp(),
}) {}

const seed = [
  new Todo({ id: 1, text: 'Buy milk', completed: false, score: 10, createdAt: 1000 }),
  new Todo({ id: 2, text: 'Build STX', completed: true, score: 42, createdAt: 2000 }),
]

// ─── H0: Creation ────────────────────────────────────────────

describe('H0: Entity.reactive() creates atoms', () => {
  it('returns a ReactiveEntity with atoms', () => {
    const registry = AtomRegistry.make()
    const rx = Todo.reactive(registry, {
      getId: (t: InstanceType<typeof Todo>) => t.id,
      initialData: seed,
    })
    expect(rx).toBeDefined()
    expect(rx.items).toBeDefined()
    expect(rx.count).toBeDefined()
    expect(rx.byId).toBeDefined()
    expect(rx.item).toBeDefined()
    expect(rx.insert).toBeDefined()
    expect(rx.update).toBeDefined()
    expect(rx.remove).toBeDefined()
    expect(rx.fieldMeta).toEqual(Todo.fieldMeta)
    rx.dispose()
  })
})

// ─── H1-H4: Read atoms ──────────────────────────────────────

describe('H1: items atom', () => {
  it('reflects all items', () => {
    const registry = AtomRegistry.make()
    const rx = Todo.reactive(registry, { getId: (t: any) => t.id, initialData: seed })
    const items = registry.get(rx.items)
    expect(items).toHaveLength(2)
    expect(items[0].text).toBe('Buy milk')
    rx.dispose()
  })
})

describe('H2: count atom', () => {
  it('derives from items', () => {
    const registry = AtomRegistry.make()
    const rx = Todo.reactive(registry, { getId: (t: any) => t.id, initialData: seed })
    expect(registry.get(rx.count)).toBe(2)
    rx.dispose()
  })
})

describe('H3: byId atom', () => {
  it('provides Map lookup', () => {
    const registry = AtomRegistry.make()
    const rx = Todo.reactive(registry, { getId: (t: any) => t.id, initialData: seed })
    const map = registry.get(rx.byId)
    expect(map.get(1)?.text).toBe('Buy milk')
    expect(map.get(2)?.text).toBe('Build STX')
    rx.dispose()
  })
})

describe('H4: item family', () => {
  it('returns atom for specific key', () => {
    const registry = AtomRegistry.make()
    const rx = Todo.reactive(registry, { getId: (t: any) => t.id, initialData: seed })
    const item1Atom = rx.item(1)
    expect(registry.get(item1Atom)?.text).toBe('Buy milk')
    expect(registry.get(rx.item(999))).toBeUndefined()
    rx.dispose()
  })
})

// ─── H5-H6: Validated insert ─────────────────────────────────

describe('H5: insert validates', () => {
  it('accepts valid insert data (no generated fields)', () => {
    const registry = AtomRegistry.make()
    const rx = Todo.reactive(registry, { getId: (t: any) => t.id, initialData: [...seed] })
    // Insert variant excludes `id` (generated) and `score` (readonly)
    const result = rx.insert({ text: 'New task', completed: false })
    expect(result._tag).toBe('Success')
    // Items should have 3
    expect(registry.get(rx.items)).toHaveLength(3)
    rx.dispose()
  })
})

describe('H6: insert rejects invalid', () => {
  it('rejects empty text (NonEmptyString)', () => {
    const registry = AtomRegistry.make()
    const rx = Todo.reactive(registry, { getId: (t: any) => t.id, initialData: [...seed] })
    const result = rx.insert({ text: '', completed: false } as any)
    expect(result._tag).toBe('Failure')
    // Items unchanged
    expect(registry.get(rx.items)).toHaveLength(2)
    rx.dispose()
  })
})

// ─── H7-H8: Mutations ───────────────────────────────────────

describe('H7: update', () => {
  it('mutates and refreshes', () => {
    const registry = AtomRegistry.make()
    const rx = Todo.reactive(registry, { getId: (t: any) => t.id, initialData: [...seed] })
    rx.update(1, { text: 'Updated milk' })
    const updated = registry.get(rx.byId).get(1)
    expect(updated?.text).toBe('Updated milk')
    rx.dispose()
  })
})

describe('H8: remove', () => {
  it('deletes and refreshes', () => {
    const registry = AtomRegistry.make()
    const rx = Todo.reactive(registry, { getId: (t: any) => t.id, initialData: [...seed] })
    rx.remove(1)
    expect(registry.get(rx.items)).toHaveLength(1)
    expect(registry.get(rx.byId).has(1)).toBe(false)
    rx.dispose()
  })
})

// ─── H9: Metadata available ──────────────────────────────────

describe('H9: field metadata for UI', () => {
  it('exposes fieldMeta for UI constraint decisions', () => {
    const registry = AtomRegistry.make()
    const rx = Todo.reactive(registry, { getId: (t: any) => t.id, initialData: seed })
    expect(rx.fieldMeta.id).toBe('generated')
    expect(rx.fieldMeta.text).toBe('data')
    expect(rx.fieldMeta.score).toBe('readonly')
    expect(rx.fieldMeta.createdAt).toBe('timestamp')
    rx.dispose()
  })
})
