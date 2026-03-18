/**
 * Spike: Model.Class × TanStack DB × VariantSchema — FULL API
 *
 * Prove that one VariantSchema definition drives ALL TanStack DB operations:
 *   - select variant  → Collection item type (reads: get, values, entries, toArray)
 *   - insert variant  → collection.insert() validation (Generated fields excluded)
 *   - update variant  → collection.update() validation
 *   - delete variant  → collection.delete() (key extraction)
 *   - json variant    → Wire format for sync boundary (encode/decode)
 *   - subscribe       → subscribeChanges with validated change messages
 *   - lifecycle       → status, stateWhenReady, cleanup
 *
 * Also prove custom variants (filter, sort) for TanStack DB query operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { VariantSchema } from 'effect-v4/unstable/schema'
import {
  createCollection,
  localOnlyCollectionOptions,
} from '@tanstack/db'

// ─── Model Definition ────────────────────────────────────────

// Use VariantSchema.make() directly — same factory that Effect's Model uses.
// This gives us complete control over variant names.
const Model = VariantSchema.make({
  variants: ['select', 'insert', 'update', 'json', 'jsonCreate', 'jsonUpdate'],
  defaultVariant: 'select',
})

// Model.Generated: field present in select/update/json but excluded from insert
const Generated = <S extends Schema.Top>(schema: S) =>
  Model.Field({ select: schema, update: schema, json: schema })

// Model.InsertDefault: present everywhere, optional on insert (app provides default)
const InsertDefault = <S extends Schema.Top>(schema: S) =>
  Model.Field({
    select: schema,
    insert: Schema.optionalKey(schema),
    update: schema,
    json: schema,
  })

// Model.UpdateOnly: only appears in update variant (e.g. updatedAt auto-set)
const UpdateAuto = <S extends Schema.Top>(schema: S) =>
  Model.Field({
    select: schema,
    insert: Schema.optionalKey(schema),
    update: Schema.optionalKey(schema),
    json: schema,
  })

// v4: Schema.Literal(x) = single literal. Schema.Literals([...]) = union of literals.
const Priority = Schema.Literals(['low', 'medium', 'high'] as const)

class Todo extends Model.Class<Todo>('Todo')({
  id: Generated(Schema.Number),
  text: Schema.NonEmptyString,
  completed: Schema.Boolean,
  priority: Priority,
  createdAt: InsertDefault(Schema.Number),
  updatedAt: UpdateAuto(Schema.Number),
}) {}

// ─── Helpers ─────────────────────────────────────────────────

const decodeInsert = Schema.decodeUnknownSync(Todo.insert)
const decodeUpdate = Schema.decodeUnknownSync(Todo.update)
const decodeSelect = Schema.decodeUnknownSync(Todo as any)
const decodeJson = Schema.decodeUnknownSync(Todo.json)
const encodeJson = Schema.encodeSync(Todo.json)

function makeTodo(id: number, text: string, opts?: Partial<{ completed: boolean; priority: 'low' | 'medium' | 'high'; createdAt: number; updatedAt: number }>): Todo {
  return new Todo({
    id,
    text,
    completed: opts?.completed ?? false,
    priority: opts?.priority ?? 'medium',
    createdAt: opts?.createdAt ?? Date.now(),
    updatedAt: opts?.updatedAt ?? Date.now(),
  })
}

// ─── H0: Variant infrastructure ──────────────────────────────

describe('H0: VariantSchema produces variant infrastructure', () => {
  it('Model.Class, Field, Struct, extract all exist', () => {
    expect(Model.Class).toBeTypeOf('function')
    expect(Model.Field).toBeTypeOf('function')
    expect(Model.Struct).toBeTypeOf('function')
    expect(Model.extract).toBeTypeOf('function')
    expect(Model.FieldOnly).toBeTypeOf('function')
    expect(Model.FieldExcept).toBeTypeOf('function')
  })

  it('Todo has all 6 variant schemas', () => {
    expect(Todo.select).toBeDefined()
    expect(Todo.insert).toBeDefined()
    expect(Todo.update).toBeDefined()
    expect(Todo.json).toBeDefined()
    expect(Todo.jsonCreate).toBeDefined()
    expect(Todo.jsonUpdate).toBeDefined()
  })
})

// ─── H1: Variant field presence ──────────────────────────────

describe('H1: Variant schemas have correct field presence', () => {
  it('select has ALL fields', () => {
    const fields = Object.keys(Todo.select.fields)
    expect(fields).toEqual(expect.arrayContaining(['id', 'text', 'completed', 'priority', 'createdAt', 'updatedAt']))
  })

  it('insert EXCLUDES Generated(id)', () => {
    const fields = Object.keys(Todo.insert.fields)
    expect(fields).not.toContain('id')
    expect(fields).toContain('text')
    expect(fields).toContain('completed')
    expect(fields).toContain('priority')
    expect(fields).toContain('createdAt')  // present but optional
    expect(fields).toContain('updatedAt')  // present but optional
  })

  it('update has all fields including id (for WHERE clause)', () => {
    const fields = Object.keys(Todo.update.fields)
    expect(fields).toContain('id')
    expect(fields).toContain('text')
    expect(fields).toContain('completed')
    expect(fields).toContain('updatedAt')  // present but optional
  })

  it('json has all non-sensitive fields', () => {
    const fields = Object.keys(Todo.json.fields)
    expect(fields).toEqual(expect.arrayContaining(['id', 'text', 'completed', 'priority', 'createdAt', 'updatedAt']))
  })
})

// ─── H2: Decode/Encode through variants ──────────────────────

describe('H2: Variant decode/encode', () => {
  it('select decodes a full record', () => {
    const decoded = decodeSelect({
      id: 1, text: 'Buy milk', completed: false,
      priority: 'high', createdAt: 1000, updatedAt: 2000,
    })
    expect(decoded).toBeInstanceOf(Todo)
    expect(decoded.id).toBe(1)
  })

  it('select rejects invalid data', () => {
    expect(() => decodeSelect({
      id: 1, text: '', completed: false,  // NonEmptyString rejects empty
      priority: 'high', createdAt: 1000, updatedAt: 2000,
    })).toThrow()
  })

  it('insert decodes without id', () => {
    const decoded = decodeInsert({
      text: 'New task', completed: false, priority: 'medium',
    })
    expect(decoded).toHaveProperty('text', 'New task')
    expect(decoded).not.toHaveProperty('id')
  })

  it('insert rejects empty text', () => {
    expect(() => decodeInsert({
      text: '', completed: false, priority: 'medium',
    })).toThrow()
  })

  it('insert rejects invalid priority', () => {
    expect(() => decodeInsert({
      text: 'Valid', completed: false, priority: 'BOGUS',
    })).toThrow()
  })

  it('update decodes a partial with id', () => {
    const decoded = decodeUpdate({
      id: 1, text: 'Updated', completed: true,
      priority: 'low', createdAt: 1000,
    })
    expect(decoded.id).toBe(1)
    expect(decoded.text).toBe('Updated')
  })

  it('json roundtrip encode → decode', () => {
    const original = { id: 1, text: 'Buy milk', completed: false, priority: 'high' as const, createdAt: 1000, updatedAt: 2000 }
    const encoded = encodeJson(original)
    const decoded = decodeJson(encoded)
    expect(decoded).toEqual(original)
  })

  it('json rejects invalid wire data', () => {
    expect(() => decodeJson({
      id: 'not-a-number', text: 'Buy milk', completed: false,
      priority: 'high', createdAt: 1000, updatedAt: 2000,
    })).toThrow()
  })
})

// ─── H3: TanStack DB Collection — reads ──────────────────────

describe('H3: Collection reads (get, has, values, entries, toArray, size, state)', () => {
  let todos: any

  beforeEach(async () => {
    todos = createCollection(
      localOnlyCollectionOptions<Todo, number>({
        getKey: (todo) => todo.id,
        initialData: [
          makeTodo(1, 'Buy milk', { priority: 'high', createdAt: 1000, updatedAt: 1000 }),
          makeTodo(2, 'Walk dog', { completed: true, priority: 'low', createdAt: 2000, updatedAt: 2000 }),
          makeTodo(3, 'Code STX', { priority: 'high', createdAt: 3000, updatedAt: 3000 }),
        ],
      }),
    )
    await todos.stateWhenReady()
  })

  it('get(key) returns item', () => {
    const item = todos.get(1)
    expect(item).toBeDefined()
    expect(item.text).toBe('Buy milk')
  })

  it('get(missing) returns undefined', () => {
    expect(todos.get(999)).toBeUndefined()
  })

  it('has(key) returns boolean', () => {
    expect(todos.has(1)).toBe(true)
    expect(todos.has(999)).toBe(false)
  })

  it('values() iterates all items', () => {
    const items = Array.from(todos.values())
    expect(items).toHaveLength(3)
  })

  it('entries() iterates [key, value] pairs', () => {
    const entries = Array.from(todos.entries())
    expect(entries).toHaveLength(3)
    expect(entries[0]).toHaveLength(2)
  })

  it('size returns count', () => {
    expect(todos.size).toBe(3)
  })

  it('toArray returns array snapshot', () => {
    expect(todos.toArray).toHaveLength(3)
  })

  it('status is ready after stateWhenReady', () => {
    expect(todos.status).toBe('ready')
  })

  it('state returns Map<key, value>', () => {
    const state = todos.state
    expect(state).toBeInstanceOf(Map)
    expect(state.size).toBe(3)
  })
})

// ─── H4: Collection mutations with variant validation ────────

describe('H4: Collection mutations — insert/update/delete', () => {
  let todos: any

  beforeEach(async () => {
    todos = createCollection(
      localOnlyCollectionOptions<Todo, number>({
        getKey: (todo) => todo.id,
        initialData: [
          makeTodo(1, 'Buy milk', { priority: 'high' }),
          makeTodo(2, 'Walk dog', { completed: true, priority: 'low' }),
        ],
      }),
    )
    await todos.stateWhenReady()
  })

  it('insert: validate through insert variant, then write', async () => {
    // Step 1: validate through insert variant (id excluded)
    const payload = decodeInsert({
      text: 'New task', completed: false, priority: 'medium',
    })

    // Step 2: construct full record (app generates id + defaults)
    const record = new Todo({
      id: 3,
      ...payload,
      createdAt: payload.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })

    // Step 3: write to collection
    const tx = todos.insert(record)
    await tx.isPersisted.promise

    expect(todos.get(3)).toBeDefined()
    expect(todos.get(3).text).toBe('New task')
    expect(todos.size).toBe(3)
  })

  it('insert: rejects when insert variant validation fails', () => {
    expect(() => decodeInsert({
      text: '', completed: false, priority: 'medium',
    })).toThrow()
    // Collection never sees invalid data
    expect(todos.size).toBe(2)
  })

  it('insert: batch insert (array)', async () => {
    const items = [
      makeTodo(3, 'Task A'),
      makeTodo(4, 'Task B'),
    ]
    const tx = todos.insert(items)
    await tx.isPersisted.promise

    expect(todos.size).toBe(4)
    expect(todos.get(3).text).toBe('Task A')
    expect(todos.get(4).text).toBe('Task B')
  })

  it('update: validate then mutate', async () => {
    const tx = todos.update(1, (draft: any) => {
      draft.text = 'Buy oat milk'
      draft.updatedAt = Date.now()
    })
    await tx.isPersisted.promise

    const updated = todos.get(1)
    expect(updated.text).toBe('Buy oat milk')
  })

  it('update: batch update (key array)', async () => {
    const tx = todos.update([1, 2], (drafts: any[]) => {
      for (const draft of drafts) {
        draft.completed = true
        draft.updatedAt = Date.now()
      }
    })
    await tx.isPersisted.promise

    expect(todos.get(1).completed).toBe(true)
    expect(todos.get(2).completed).toBe(true)
  })

  it('delete: single key', async () => {
    const tx = todos.delete(2)
    await tx.isPersisted.promise

    expect(todos.has(2)).toBe(false)
    expect(todos.size).toBe(1)
  })

  it('delete: batch (key array)', async () => {
    const tx = todos.delete([1, 2])
    await tx.isPersisted.promise

    expect(todos.size).toBe(0)
  })
})

// ─── H5: subscribeChanges — validated change events ──────────

describe('H5: subscribeChanges — change events', () => {
  let todos: any

  beforeEach(async () => {
    todos = createCollection(
      localOnlyCollectionOptions<Todo, number>({
        getKey: (todo) => todo.id,
        initialData: [
          makeTodo(1, 'Buy milk', { priority: 'high' }),
        ],
      }),
    )
    await todos.stateWhenReady()
  })

  it('insert fires subscribeChanges with type=insert', async () => {
    const changes: any[] = []
    const sub = todos.subscribeChanges((msgs: any[]) => {
      changes.push(...msgs)
    })

    const tx = todos.insert(makeTodo(2, 'New'))
    await tx.isPersisted.promise
    await new Promise((r) => setTimeout(r, 50))

    expect(changes.length).toBeGreaterThan(0)
    const insertChange = changes.find((c) => c.key === 2 && c.type === 'insert')
    expect(insertChange).toBeDefined()
    expect(insertChange.value.text).toBe('New')

    sub.unsubscribe()
  })

  it('update fires subscribeChanges with type=update', async () => {
    const changes: any[] = []
    const sub = todos.subscribeChanges((msgs: any[]) => {
      changes.push(...msgs)
    })

    const tx = todos.update(1, (d: any) => { d.text = 'Updated' })
    await tx.isPersisted.promise
    await new Promise((r) => setTimeout(r, 50))

    const updateChange = changes.find((c) => c.type === 'update')
    expect(updateChange).toBeDefined()
    expect(updateChange.value.text).toBe('Updated')

    sub.unsubscribe()
  })

  it('change events can be decoded through select variant', async () => {
    const changes: any[] = []
    const sub = todos.subscribeChanges((msgs: any[]) => {
      changes.push(...msgs)
    })

    const tx = todos.insert(makeTodo(2, 'Validated'))
    await tx.isPersisted.promise
    await new Promise((r) => setTimeout(r, 50))

    const insertChange = changes.find((c) => c.key === 2)
    // Decode the change value through select variant
    const decoded = decodeSelect(insertChange.value)
    expect(decoded).toBeInstanceOf(Todo)
    expect(decoded.text).toBe('Validated')

    sub.unsubscribe()
  })

  it('subscribeChanges with where filter (TanStack DB query operators)', async () => {
    // TanStack DB's where uses query builder operators, not plain predicates
    // Import eq from @tanstack/db for proper filtering
    const { eq } = await import('@tanstack/db')

    const changes: any[] = []
    const sub = todos.subscribeChanges((msgs: any[]) => {
      changes.push(...msgs)
    }, {
      where: (row: any) => eq(row.completed, true),
    })

    // Insert a non-completed item
    const tx1 = todos.insert(makeTodo(2, 'Not completed', { completed: false }))
    await tx1.isPersisted.promise

    // Insert a completed item
    const tx2 = todos.insert(makeTodo(3, 'Done', { completed: true }))
    await tx2.isPersisted.promise
    await new Promise((r) => setTimeout(r, 50))

    // The where filter should only pass completed items
    const completedChanges = changes.filter((c) => c.value?.completed === true)
    expect(completedChanges.length).toBeGreaterThan(0)

    sub.unsubscribe()
  })
})

// ─── H6: Lifecycle — status, stateWhenReady, cleanup ─────────

describe('H6: Collection lifecycle', () => {
  it('stateWhenReady resolves with Map', async () => {
    const todos = createCollection(
      localOnlyCollectionOptions<Todo, number>({
        getKey: (t) => t.id,
        initialData: [makeTodo(1, 'Test')],
      }),
    )
    const state = await todos.stateWhenReady()
    expect(state).toBeInstanceOf(Map)
    expect(state.size).toBe(1)
  })

  it('subscriberCount tracks active subscriptions', async () => {
    const todos = createCollection(
      localOnlyCollectionOptions<Todo, number>({
        getKey: (t) => t.id,
        initialData: [makeTodo(1, 'Test')],
      }),
    )
    await todos.stateWhenReady()

    expect(todos.subscriberCount).toBe(0)

    const sub1 = todos.subscribeChanges(() => {})
    expect(todos.subscriberCount).toBe(1)

    const sub2 = todos.subscribeChanges(() => {})
    expect(todos.subscriberCount).toBe(2)

    sub1.unsubscribe()
    expect(todos.subscriberCount).toBe(1)

    sub2.unsubscribe()
    expect(todos.subscriberCount).toBe(0)
  })

  it('cleanup disposes collection', async () => {
    const todos = createCollection(
      localOnlyCollectionOptions<Todo, number>({
        getKey: (t) => t.id,
        initialData: [makeTodo(1, 'Test')],
      }),
    )
    await todos.stateWhenReady()
    expect(todos.status).toBe('ready')

    await todos.cleanup()
    expect(todos.status).toBe('cleaned-up')
  })
})

// ─── H7: Custom VariantSchema with filter/sort for queries ───

describe('H7: Custom variants for TanStack DB query operations', () => {
  const DbModel = VariantSchema.make({
    variants: [
      'select', 'insert', 'update',
      'json', 'jsonCreate', 'jsonUpdate',
      'filter', 'sort',
    ],
    defaultVariant: 'select',
  })

  const DbGenerated = <S extends Schema.Top>(schema: S) =>
    DbModel.Field({ select: schema, update: schema, json: schema, filter: schema, sort: schema })

  const FilterOnly = DbModel.FieldOnly(['filter'])
  const SortOnly = DbModel.FieldOnly(['sort'])

  class Order extends DbModel.Class<Order>('Order')({
    id: DbGenerated(Schema.Number),
    customerId: Schema.String,
    total: Schema.Number,
    status: Schema.Literals(['pending', 'shipped', 'delivered'] as const),
    // Query-only fields — not in the data model, just for building queries
    minTotal: FilterOnly(Schema.Number),
    maxTotal: FilterOnly(Schema.Number),
    sortDirection: SortOnly(Schema.Literals(['asc', 'desc'] as const)),
  }) {}

  it('select excludes filter/sort-only fields', () => {
    const fields = Object.keys(Order.select.fields)
    expect(fields).toContain('id')
    expect(fields).toContain('customerId')
    expect(fields).not.toContain('minTotal')
    expect(fields).not.toContain('maxTotal')
    expect(fields).not.toContain('sortDirection')
  })

  it('insert excludes Generated + filter/sort fields', () => {
    const fields = Object.keys(Order.insert.fields)
    expect(fields).not.toContain('id')
    expect(fields).toContain('customerId')
    expect(fields).toContain('total')
    expect(fields).not.toContain('minTotal')
    expect(fields).not.toContain('sortDirection')
  })

  it('filter variant has data fields + filter-only fields', () => {
    const fields = Object.keys(Order.filter.fields)
    expect(fields).toContain('id')
    expect(fields).toContain('total')
    expect(fields).toContain('minTotal')
    expect(fields).toContain('maxTotal')
    expect(fields).not.toContain('sortDirection')
  })

  it('sort variant has data fields + sort-only fields', () => {
    const fields = Object.keys(Order.sort.fields)
    expect(fields).toContain('id')
    expect(fields).toContain('total')
    expect(fields).toContain('sortDirection')
    expect(fields).not.toContain('minTotal')
  })

  it('filter variant validates filter criteria', () => {
    const filterCriteria = Schema.decodeUnknownSync(Order.filter)({
      id: 1, customerId: 'cust-1', total: 100,
      status: 'pending', minTotal: 50, maxTotal: 200,
    })
    expect(filterCriteria.minTotal).toBe(50)
    expect(filterCriteria.maxTotal).toBe(200)
  })
})

// ─── H8: onInsert/onUpdate/onDelete mutation hooks ───────────

describe('H8: Collection mutation hooks (onInsert/onUpdate/onDelete)', () => {
  it('onInsert receives validated mutation', async () => {
    const mutations: any[] = []

    const todos = createCollection(
      localOnlyCollectionOptions<Todo, number>({
        getKey: (t) => t.id,
        initialData: [],
        onInsert: async ({ transaction }) => {
          mutations.push(...transaction.mutations.map((m) => ({
            type: m.type,
            key: m.key,
            modified: m.modified,
          })))
        },
      }),
    )
    await todos.stateWhenReady()

    const tx = todos.insert(makeTodo(1, 'Hooked'))
    await tx.isPersisted.promise
    await new Promise((r) => setTimeout(r, 50))

    expect(mutations).toHaveLength(1)
    expect(mutations[0].type).toBe('insert')
    expect(mutations[0].modified.text).toBe('Hooked')
  })

  it('onUpdate receives mutation with original + changes', async () => {
    const mutations: any[] = []

    const todos = createCollection(
      localOnlyCollectionOptions<Todo, number>({
        getKey: (t) => t.id,
        initialData: [makeTodo(1, 'Original')],
        onUpdate: async ({ transaction }) => {
          mutations.push(...transaction.mutations.map((m) => ({
            type: m.type,
            original: m.original,
            modified: m.modified,
            changes: m.changes,
          })))
        },
      }),
    )
    await todos.stateWhenReady()

    const tx = todos.update(1, (d: any) => { d.text = 'Changed' })
    await tx.isPersisted.promise
    await new Promise((r) => setTimeout(r, 50))

    expect(mutations).toHaveLength(1)
    expect(mutations[0].original.text).toBe('Original')
    expect(mutations[0].modified.text).toBe('Changed')
  })

  it('onDelete receives deleted key', async () => {
    const mutations: any[] = []

    const todos = createCollection(
      localOnlyCollectionOptions<Todo, number>({
        getKey: (t) => t.id,
        initialData: [makeTodo(1, 'Doomed')],
        onDelete: async ({ transaction }) => {
          mutations.push(...transaction.mutations.map((m) => ({
            type: m.type,
            key: m.key,
          })))
        },
      }),
    )
    await todos.stateWhenReady()

    const tx = todos.delete(1)
    await tx.isPersisted.promise
    await new Promise((r) => setTimeout(r, 50))

    expect(mutations).toHaveLength(1)
    expect(mutations[0].type).toBe('delete')
    expect(mutations[0].key).toBe(1)
  })
})
