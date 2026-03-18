/**
 * @tmnl/db — Reactive bridge tests
 *
 * Prove that reactive(registry, adapted, getId) produces
 * working atoms synced with the TanStack DB collection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { Atom, AtomRegistry } from 'effect-v4/unstable/reactivity'
import { Entity } from '@tmnl/entity'
import { tanstackAdapter, type AdaptedCollection } from '../src/adapter.js'
import { reactive, type ReactiveCollection } from '../src/reactive.js'

// ─── Fixtures ────────────────────────────────────────────────

class Todo extends Entity('Todo')({
  id:        Entity.generated(Schema.Number),
  text:      Schema.NonEmptyString,
  completed: Schema.Boolean,
  priority:  Schema.Literals(['low', 'medium', 'high'] as const),
  createdAt: Entity.timestamp(),
}) {}

function makeTodo(id: number, text: string, extra?: Partial<{
  completed: boolean; priority: 'low' | 'medium' | 'high'; createdAt: number
}>) {
  return {
    id,
    text,
    completed: extra?.completed ?? false,
    priority: extra?.priority ?? 'medium',
    createdAt: extra?.createdAt ?? Date.now(),
  }
}

// ─── Setup ───────────────────────────────────────────────────

let adapted: AdaptedCollection<any, number>
let registry: AtomRegistry.AtomRegistry
let rx: ReactiveCollection<any, number>

beforeEach(() => {
  adapted = tanstackAdapter(Todo, {
    getId: (t: any) => t.id,
    initialData: [
      makeTodo(1, 'Alpha'),
      makeTodo(2, 'Bravo', { completed: true }),
      makeTodo(3, 'Charlie', { priority: 'high' }),
    ],
  })
  registry = AtomRegistry.make()
  rx = reactive(registry, adapted, (t: any) => t.id)
})

afterEach(() => {
  rx.dispose()
  adapted.cleanup()
})

// ─── items atom ──────────────────────────────────────────────

describe('reactive — items atom', () => {
  it('initial items from collection', () => {
    const items = registry.get(rx.items)
    expect(items).toHaveLength(3)
  })

  it('items contain correct data', () => {
    const items = registry.get(rx.items)
    expect(items[0].text).toBe('Alpha')
    expect(items[1].text).toBe('Bravo')
    expect(items[2].text).toBe('Charlie')
  })
})

// ─── count atom ──────────────────────────────────────────────

describe('reactive — count atom', () => {
  it('count matches initial items', () => {
    const count = registry.get(rx.count)
    expect(count).toBe(3)
  })

  it('count updates after insert', () => {
    rx.insert(makeTodo(4, 'Delta'))
    const count = registry.get(rx.count)
    expect(count).toBe(4)
  })

  it('count updates after remove', () => {
    rx.remove(1)
    const count = registry.get(rx.count)
    expect(count).toBe(2)
  })
})

// ─── byId atom ───────────────────────────────────────────────

describe('reactive — byId atom', () => {
  it('byId is a Map', () => {
    const map = registry.get(rx.byId)
    expect(map).toBeInstanceOf(Map)
    expect(map.size).toBe(3)
  })

  it('byId provides O(1) lookup', () => {
    const map = registry.get(rx.byId)
    expect(map.get(2)!.text).toBe('Bravo')
    expect(map.get(999)).toBeUndefined()
  })
})

// ─── item family ─────────────────────────────────────────────

describe('reactive — item(key) family', () => {
  it('returns atom for existing item', () => {
    const atom = rx.item(1)
    const val = registry.get(atom)
    expect(val).toBeDefined()
    expect(val.text).toBe('Alpha')
  })

  it('returns undefined for missing key', () => {
    const atom = rx.item(999)
    const val = registry.get(atom)
    expect(val).toBeUndefined()
  })

  it('updates when item is modified', () => {
    rx.update(1, (d: any) => { d.text = 'Modified' })
    const val = registry.get(rx.item(1))
    expect(val.text).toBe('Modified')
  })
})

// ─── insert mutation ─────────────────────────────────────────

describe('reactive — insert', () => {
  it('inserts valid data and returns Ok', () => {
    const result = rx.insert(makeTodo(4, 'Delta'))
    expect(result._tag).toBe('Success')
    expect(result.success.text).toBe('Delta')
  })

  it('insert updates items atom', () => {
    rx.insert(makeTodo(4, 'Delta'))
    const items = registry.get(rx.items)
    expect(items).toHaveLength(4)
    expect(items.find((i: any) => i.id === 4)?.text).toBe('Delta')
  })

  it('insert with invalid data returns Err', () => {
    const result = rx.insert({ id: 4, text: '', completed: false, priority: 'medium', createdAt: 1000 } as any)
    expect(result._tag).toBe('Failure')
  })

  it('invalid insert does NOT change atoms', () => {
    rx.insert({ id: 4, text: '', completed: false } as any)
    const items = registry.get(rx.items)
    expect(items).toHaveLength(3)
  })
})

// ─── update mutation ─────────────────────────────────────────

describe('reactive — update', () => {
  it('update modifies item in atoms', () => {
    rx.update(1, (d: any) => { d.text = 'Updated Alpha' })
    const items = registry.get(rx.items)
    expect(items.find((i: any) => i.id === 1)?.text).toBe('Updated Alpha')
  })

  it('update reflects in byId', () => {
    rx.update(2, (d: any) => { d.completed = false })
    const map = registry.get(rx.byId)
    expect(map.get(2)!.completed).toBe(false)
  })
})

// ─── remove mutation ─────────────────────────────────────────

describe('reactive — remove', () => {
  it('remove deletes from atoms', () => {
    rx.remove(2)
    const items = registry.get(rx.items)
    expect(items).toHaveLength(2)
    expect(items.find((i: any) => i.id === 2)).toBeUndefined()
  })

  it('remove reflects in byId', () => {
    rx.remove(1)
    const map = registry.get(rx.byId)
    expect(map.has(1)).toBe(false)
    expect(map.size).toBe(2)
  })

  it('remove reflects in count', () => {
    rx.remove(3)
    expect(registry.get(rx.count)).toBe(2)
  })
})

// ─── atom subscription ───────────────────────────────────────

describe('reactive — atom subscriptions', () => {
  it('subscribing to items fires on mutation', () => {
    const log: number[] = []
    registry.subscribe(rx.items, (items) => {
      log.push(items.length)
    })
    rx.insert(makeTodo(4, 'Four'))
    rx.insert(makeTodo(5, 'Five'))
    rx.remove(1)
    // Each mutation fires exactly once (no double-fire from subscribeChanges)
    expect(log).toEqual([4, 5, 4])
  })

  it('subscribing to count reacts to mutations', () => {
    // Derived atoms propagate — verify count is correct after mutations
    rx.insert(makeTodo(4, 'Four'))
    expect(registry.get(rx.count)).toBe(4)
    rx.remove(2)
    expect(registry.get(rx.count)).toBe(3)
  })
})

// ─── dispose ─────────────────────────────────────────────────

describe('reactive — dispose', () => {
  it('dispose does not throw', () => {
    expect(() => rx.dispose()).not.toThrow()
  })
})
