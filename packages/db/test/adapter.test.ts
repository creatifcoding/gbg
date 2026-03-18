/**
 * @tmnl/db — tanstackAdapter tests
 *
 * Prove that Entity → TanStack DB Collection works with validated mutations,
 * hooks, reads, subscriptions, and lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { Entity } from '@tmnl/entity'
import { tanstackAdapter, type AdaptedCollection } from '../src/adapter.js'

// ─── Fixtures ────────────────────────────────────────────────

class Todo extends Entity('Todo')({
  id:        Entity.generated(Schema.Number),
  text:      Schema.NonEmptyString,
  completed: Schema.Boolean,
  priority:  Schema.Literals(['low', 'medium', 'high'] as const),
  createdAt: Entity.timestamp(),
  updatedAt: Entity.timestamp(),
}, {
  events: { Completed: { completedAt: Schema.Number } },
}) {
  get isHighPriority() { return this.priority === 'high' }
}

class User extends Entity('User')({
  id:       Entity.generated(Schema.Number),
  name:     Schema.NonEmptyString,
  email:    Schema.String,
  password: Entity.sensitive(Schema.NonEmptyString),
  apiKey:   Entity.sensitive(Schema.String),
}) {}

function makeTodo(id: number, text: string, extra?: Partial<{
  completed: boolean; priority: 'low' | 'medium' | 'high'; createdAt: number; updatedAt: number
}>) {
  return {
    id,
    text,
    completed: extra?.completed ?? false,
    priority: extra?.priority ?? 'medium',
    createdAt: extra?.createdAt ?? Date.now(),
    updatedAt: extra?.updatedAt ?? Date.now(),
  }
}

// ─── Adapter Creation ────────────────────────────────────────

describe('tanstackAdapter — creation', () => {
  it('creates adapter from Entity', () => {
    const todos = tanstackAdapter(Todo, { getId: (t: any) => t.id })
    expect(todos.entityTag).toBe('Todo')
    expect(todos.collection).toBeDefined()
    todos.cleanup()
  })

  it('accepts initial data', () => {
    const todos = tanstackAdapter(Todo, {
      getId: (t: any) => t.id,
      initialData: [makeTodo(1, 'First'), makeTodo(2, 'Second')],
    })
    expect(todos.toArray()).toHaveLength(2)
    todos.cleanup()
  })
})

// ─── Reads ───────────────────────────────────────────────────

describe('tanstackAdapter — reads', () => {
  let todos: AdaptedCollection<any, number>

  beforeEach(() => {
    todos = tanstackAdapter(Todo, {
      getId: (t: any) => t.id,
      initialData: [
        makeTodo(1, 'Alpha'),
        makeTodo(2, 'Bravo'),
        makeTodo(3, 'Charlie'),
      ],
    })
  })

  afterEach(() => todos.cleanup())

  it('toArray returns all items', () => {
    expect(todos.toArray()).toHaveLength(3)
  })

  it('get returns item by key', () => {
    const item = todos.get(2)
    expect(item).toBeDefined()
    expect(item.text).toBe('Bravo')
  })

  it('get returns undefined for missing key', () => {
    expect(todos.get(999)).toBeUndefined()
  })

  it('count returns total items', () => {
    expect(todos.count()).toBe(3)
  })
})

// ─── Validated Insert ────────────────────────────────────────

describe('tanstackAdapter — validated insert', () => {
  let todos: AdaptedCollection<any, number>

  beforeEach(() => {
    todos = tanstackAdapter(Todo, { getId: (t: any) => t.id })
  })

  afterEach(() => todos.cleanup())

  it('insert with valid data returns Ok', () => {
    const result = todos.insert(makeTodo(1, 'Test'))
    expect(result._tag).toBe('Success')
    expect(result.success.item.text).toBe('Test')
  })

  it('insert adds item to collection', () => {
    todos.insert(makeTodo(1, 'Added'))
    expect(todos.count()).toBe(1)
    expect(todos.get(1).text).toBe('Added')
  })

  it('insert with invalid data returns Err', () => {
    const result = todos.insert({
      id: 1, text: '', completed: false,
      priority: 'medium', createdAt: 1000, updatedAt: 2000,
    } as any)
    expect(result._tag).toBe('Failure')
    expect(result.failure.issues.length).toBeGreaterThan(0)
  })

  it('invalid insert does NOT add to collection', () => {
    todos.insert({ id: 1, text: '', completed: false, priority: 'BOGUS' } as any)
    expect(todos.count()).toBe(0)
  })

  it('insert returns transaction on success', () => {
    const result = todos.insert(makeTodo(1, 'Has tx'))
    expect(result._tag).toBe('Success')
    expect(result.success.transaction).toBeDefined()
  })
})

// ─── Update ──────────────────────────────────────────────────

describe('tanstackAdapter — update', () => {
  let todos: AdaptedCollection<any, number>

  beforeEach(() => {
    todos = tanstackAdapter(Todo, {
      getId: (t: any) => t.id,
      initialData: [makeTodo(1, 'Original')],
    })
  })

  afterEach(() => todos.cleanup())

  it('update modifies item', () => {
    todos.update(1, (draft: any) => { draft.text = 'Modified' })
    expect(todos.get(1).text).toBe('Modified')
  })

  it('update returns transaction', () => {
    const tx = todos.update(1, (draft: any) => { draft.completed = true })
    expect(tx).toBeDefined()
  })
})

// ─── Delete ──────────────────────────────────────────────────

describe('tanstackAdapter — delete', () => {
  let todos: AdaptedCollection<any, number>

  beforeEach(() => {
    todos = tanstackAdapter(Todo, {
      getId: (t: any) => t.id,
      initialData: [makeTodo(1, 'To delete'), makeTodo(2, 'To keep')],
    })
  })

  afterEach(() => todos.cleanup())

  it('delete removes item', () => {
    todos.delete(1)
    expect(todos.count()).toBe(1)
    expect(todos.get(1)).toBeUndefined()
    expect(todos.get(2)).toBeDefined()
  })

  it('delete returns transaction', () => {
    const tx = todos.delete(1)
    expect(tx).toBeDefined()
  })
})

// ─── Mutation Hooks ──────────────────────────────────────────

describe('tanstackAdapter — mutation hooks', () => {
  it('onInsert fires on successful insert', async () => {
    let hooked: any = null
    const todos = tanstackAdapter(Todo, {
      getId: (t: any) => t.id,
      onInsert: ({ item }) => { hooked = item },
    })
    todos.insert(makeTodo(1, 'Hooked'))
    // hooks fire async, wait a tick
    await new Promise(r => setTimeout(r, 10))
    expect(hooked).toBeDefined()
    expect(hooked.text).toBe('Hooked')
    todos.cleanup()
  })

  it('onInsert does NOT fire on invalid insert', async () => {
    let fired = false
    const todos = tanstackAdapter(Todo, {
      getId: (t: any) => t.id,
      onInsert: () => { fired = true },
    })
    todos.insert({ text: '', completed: false } as any)
    await new Promise(r => setTimeout(r, 10))
    expect(fired).toBe(false)
    todos.cleanup()
  })

  it('onUpdate fires on update', async () => {
    let hooked: any = null
    const todos = tanstackAdapter(Todo, {
      getId: (t: any) => t.id,
      initialData: [makeTodo(1, 'Before')],
      onUpdate: ({ key, item }) => { hooked = { key, text: item.text } },
    })
    todos.update(1, (d: any) => { d.text = 'After' })
    await new Promise(r => setTimeout(r, 10))
    expect(hooked).toBeDefined()
    expect(hooked.key).toBe(1)
    expect(hooked.text).toBe('After')
    todos.cleanup()
  })

  it('onDelete fires on delete', async () => {
    let deletedKey: any = null
    const todos = tanstackAdapter(Todo, {
      getId: (t: any) => t.id,
      initialData: [makeTodo(1, 'Doomed')],
      onDelete: ({ key }) => { deletedKey = key },
    })
    todos.delete(1)
    await new Promise(r => setTimeout(r, 10))
    expect(deletedKey).toBe(1)
    todos.cleanup()
  })
})

// ─── Subscriptions ───────────────────────────────────────────

describe('tanstackAdapter — subscribeChanges', () => {
  it('subscribeChanges fires on insert', async () => {
    const todos = tanstackAdapter(Todo, { getId: (t: any) => t.id })
    const changes: any[] = []
    const sub = todos.subscribeChanges((msgs: any[]) => { changes.push(...msgs) })

    todos.insert(makeTodo(1, 'Observed'))
    await new Promise(r => setTimeout(r, 50))

    expect(changes.length).toBeGreaterThan(0)
    expect(changes[0].type).toBe('insert')

    sub.unsubscribe()
    todos.cleanup()
  })
})

// ─── Lifecycle ───────────────────────────────────────────────

describe('tanstackAdapter — lifecycle', () => {
  it('cleanup disposes collection', () => {
    const todos = tanstackAdapter(Todo, { getId: (t: any) => t.id })
    todos.insert(makeTodo(1, 'Alive'))
    expect(todos.count()).toBe(1)
    todos.cleanup()
    // After cleanup, TanStack DB sets status
    expect(todos.status()).toBe('cleaned-up')
  })
})
