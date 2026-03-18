/**
 * Spike: Entity Factory — One Schema Rules All
 *
 * Prove that Entity() wraps VariantSchema + Model.Class with field wrappers,
 * producing variants, validation, codec, and reactive atoms from ONE definition.
 *
 * Consumer API:
 *   class Todo extends Entity('Todo')({
 *     id: Entity.generated(S.Number),
 *     text: S.NonEmptyString,
 *     ...
 *   }) {}
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { VariantSchema } from 'effect-v4/unstable/schema'

// ─── Entity Factory Implementation (spike inline) ────────────

const ENTITY_VARIANTS = [
  'select', 'insert', 'update',
  'json', 'jsonCreate', 'jsonUpdate',
] as const

const BaseModel = VariantSchema.make({
  variants: [...ENTITY_VARIANTS],
  defaultVariant: 'select',
})

/**
 * Entity namespace — field wrappers + Class factory
 */
const Entity = Object.assign(
  // The class factory: Entity('Todo')({ fields... })
  function EntityFactory<Tag extends string>(tag: Tag) {
    // Returns a function that takes fields and produces a Model.Class
    return <Fields extends Record<string, any>>(fields: Fields) => {
      // Build the Model.Class using BaseModel
      return class extends BaseModel.Class<any>(tag)(fields) {} as any
    }
  },
  {
    /**
     * Generated field — present in select/update/json, EXCLUDED from insert.
     * Use for auto-incremented IDs, server-generated UUIDs, etc.
     */
    generated<S extends Schema.Top>(schema: S) {
      return BaseModel.Field({
        select: schema,
        update: schema,
        json: schema,
      })
    },

    /**
     * Timestamp field — present everywhere, optional on insert/update.
     * Defaults to Schema.Number (epoch ms). Auto-set by infrastructure.
     */
    timestamp(schema?: Schema.Top) {
      const s = schema ?? Schema.Number
      return BaseModel.Field({
        select: s,
        insert: Schema.optionalKey(s),
        update: Schema.optionalKey(s),
        json: s,
      })
    },

    /**
     * Sensitive field — present in select but EXCLUDED from all json variants.
     * Use for passwords, tokens, PII that shouldn't cross wire.
     */
    sensitive<S extends Schema.Top>(schema: S) {
      return BaseModel.Field({
        select: schema,
        insert: schema,
        update: schema,
        // Excluded from json, jsonCreate, jsonUpdate by omission
      })
    },

    /**
     * Readonly field — present in select/json, EXCLUDED from insert/update.
     * Use for server-computed values that clients can read but never write.
     */
    readonly<S extends Schema.Top>(schema: S) {
      return BaseModel.Field({
        select: schema,
        json: schema,
        // Excluded from insert, update by omission
      })
    },

    /**
     * Computed field — present in select ONLY.
     * Server-only computed, never serialized, never writable.
     */
    computed<S extends Schema.Top>(schema: S) {
      return BaseModel.FieldOnly(['select'])(schema)
    },
  },
)

// ─── Entity Definition (consumer API) ────────────────────────

class Todo extends Entity('Todo')({
  id:        Entity.generated(Schema.Number),
  text:      Schema.NonEmptyString,
  completed: Schema.Boolean,
  priority:  Schema.Literals(['low', 'medium', 'high'] as const),
  createdAt: Entity.timestamp(),
  updatedAt: Entity.timestamp(),
}) {
  get isHighPriority() { return (this as any).priority === 'high' }
  toggle() { return new Todo({ ...this, completed: !(this as any).completed }) }
}

// ─── Tests ───────────────────────────────────────────────────

describe('Entity Factory — field wrappers', () => {
  it('select has ALL fields', () => {
    const fields = Object.keys(Todo.select.fields)
    expect(fields).toEqual(expect.arrayContaining([
      'id', 'text', 'completed', 'priority', 'createdAt', 'updatedAt',
    ]))
  })

  it('insert EXCLUDES generated(id) and readonly fields', () => {
    const fields = Object.keys(Todo.insert.fields)
    expect(fields).not.toContain('id')
    expect(fields).toContain('text')
    expect(fields).toContain('completed')
    expect(fields).toContain('priority')
    // timestamps are optional on insert
    expect(fields).toContain('createdAt')
    expect(fields).toContain('updatedAt')
  })

  it('update has all data fields (id for WHERE, timestamps optional)', () => {
    const fields = Object.keys(Todo.update.fields)
    expect(fields).toContain('id')
    expect(fields).toContain('text')
    expect(fields).toContain('updatedAt')
  })

  it('json has all non-sensitive fields', () => {
    const fields = Object.keys(Todo.json.fields)
    expect(fields).toContain('id')
    expect(fields).toContain('text')
    expect(fields).not.toContain('password')  // if we had one
  })
})

describe('Entity Factory — sensitive field', () => {
  class User extends Entity('User')({
    id:       Entity.generated(Schema.Number),
    name:     Schema.NonEmptyString,
    email:    Schema.String,
    password: Entity.sensitive(Schema.NonEmptyString),
    apiKey:   Entity.sensitive(Schema.String),
  }) {}

  it('select has sensitive fields', () => {
    const fields = Object.keys(User.select.fields)
    expect(fields).toContain('password')
    expect(fields).toContain('apiKey')
  })

  it('json EXCLUDES sensitive fields', () => {
    const fields = Object.keys(User.json.fields)
    expect(fields).not.toContain('password')
    expect(fields).not.toContain('apiKey')
    expect(fields).toContain('id')
    expect(fields).toContain('name')
    expect(fields).toContain('email')
  })

  it('jsonCreate EXCLUDES sensitive fields', () => {
    const fields = Object.keys(User.jsonCreate.fields)
    expect(fields).not.toContain('password')
    expect(fields).not.toContain('apiKey')
  })

  it('insert INCLUDES sensitive fields (server-side write)', () => {
    const fields = Object.keys(User.insert.fields)
    expect(fields).toContain('password')
    expect(fields).toContain('apiKey')
  })
})

describe('Entity Factory — readonly field', () => {
  class Article extends Entity('Article')({
    id:        Entity.generated(Schema.Number),
    title:     Schema.NonEmptyString,
    viewCount: Entity.readonly(Schema.Number),
    score:     Entity.readonly(Schema.Number),
  }) {}

  it('select has readonly fields', () => {
    const fields = Object.keys(Article.select.fields)
    expect(fields).toContain('viewCount')
    expect(fields).toContain('score')
  })

  it('insert EXCLUDES readonly fields', () => {
    const fields = Object.keys(Article.insert.fields)
    expect(fields).not.toContain('viewCount')
    expect(fields).not.toContain('score')
    expect(fields).toContain('title')
  })

  it('update EXCLUDES readonly fields', () => {
    const fields = Object.keys(Article.update.fields)
    expect(fields).not.toContain('viewCount')
    expect(fields).not.toContain('score')
    expect(fields).toContain('title')
  })

  it('json INCLUDES readonly fields (clients can read)', () => {
    const fields = Object.keys(Article.json.fields)
    expect(fields).toContain('viewCount')
    expect(fields).toContain('score')
  })
})

describe('Entity Factory — computed field', () => {
  class Report extends Entity('Report')({
    id:            Entity.generated(Schema.Number),
    title:         Schema.NonEmptyString,
    wordCount:     Entity.computed(Schema.Number),
    readingTimeMs: Entity.computed(Schema.Number),
  }) {}

  it('select has computed fields', () => {
    const fields = Object.keys(Report.select.fields)
    expect(fields).toContain('wordCount')
    expect(fields).toContain('readingTimeMs')
  })

  it('insert EXCLUDES computed fields', () => {
    const fields = Object.keys(Report.insert.fields)
    expect(fields).not.toContain('wordCount')
    expect(fields).not.toContain('readingTimeMs')
  })

  it('update EXCLUDES computed fields', () => {
    const fields = Object.keys(Report.update.fields)
    expect(fields).not.toContain('wordCount')
    expect(fields).not.toContain('readingTimeMs')
  })

  it('json EXCLUDES computed fields (server-only)', () => {
    const fields = Object.keys(Report.json.fields)
    expect(fields).not.toContain('wordCount')
    expect(fields).not.toContain('readingTimeMs')
  })
})

describe('Entity Factory — validation helpers', () => {
  const decodeInsert = Schema.decodeUnknownSync(Todo.insert)
  const decodeUpdate = Schema.decodeUnknownSync(Todo.update)
  const encodeJson = Schema.encodeSync(Todo.json)
  const decodeJson = Schema.decodeUnknownSync(Todo.json)

  it('insert validates (rejects empty text)', () => {
    expect(() => decodeInsert({
      text: '', completed: false, priority: 'medium',
    })).toThrow()
  })

  it('insert validates (accepts valid)', () => {
    const result = decodeInsert({
      text: 'Buy milk', completed: false, priority: 'high',
    })
    expect(result.text).toBe('Buy milk')
    expect(result).not.toHaveProperty('id')
  })

  it('update validates with id', () => {
    const result = decodeUpdate({
      id: 1, text: 'Updated', completed: true, priority: 'low', createdAt: 1000,
    })
    expect(result.id).toBe(1)
    expect(result.text).toBe('Updated')
  })

  it('json roundtrip encode → decode', () => {
    const original = {
      id: 1, text: 'Test', completed: false,
      priority: 'medium' as const, createdAt: 1000, updatedAt: 2000,
    }
    const encoded = encodeJson(original)
    const decoded = decodeJson(encoded)
    expect(decoded).toEqual(original)
  })
})

describe('Entity Factory — instance behavior', () => {
  it('constructor validates through select schema', () => {
    const todo = new Todo({
      id: 1, text: 'Test', completed: false,
      priority: 'high', createdAt: 1000, updatedAt: 2000,
    })
    expect(todo).toBeInstanceOf(Todo)
    expect(todo.text).toBe('Test')
  })

  it('custom methods work', () => {
    const todo = new Todo({
      id: 1, text: 'Test', completed: false,
      priority: 'high', createdAt: 1000, updatedAt: 2000,
    })
    expect(todo.isHighPriority).toBe(true)

    const toggled = todo.toggle()
    expect(toggled.completed).toBe(true)
    expect(toggled).toBeInstanceOf(Todo)
  })

  it('constructor rejects invalid data', () => {
    expect(() => new Todo({
      id: 1, text: '', completed: false,  // empty text
      priority: 'high', createdAt: 1000, updatedAt: 2000,
    })).toThrow()
  })
})

describe('Entity Factory — TanStack DB integration', () => {
  it('Entity instances work as TanStack DB collection items', async () => {
    const { createCollection, localOnlyCollectionOptions } = await import('@tanstack/db')

    const todos = createCollection(
      localOnlyCollectionOptions<InstanceType<typeof Todo>, number>({
        getKey: (t: any) => t.id,
        initialData: [
          new Todo({ id: 1, text: 'Buy milk', completed: false, priority: 'high', createdAt: 1000, updatedAt: 1000 }),
          new Todo({ id: 2, text: 'Walk dog', completed: true, priority: 'low', createdAt: 2000, updatedAt: 2000 }),
        ],
      }),
    )
    await todos.stateWhenReady()

    expect(todos.size).toBe(2)
    expect(todos.get(1)?.text).toBe('Buy milk')

    // Insert with validation through insert variant
    const payload = Schema.decodeUnknownSync(Todo.insert)({
      text: 'New task', completed: false, priority: 'medium',
    })
    const record = new Todo({
      id: 3, ...payload,
      createdAt: payload.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
    const tx = todos.insert(record)
    await tx.isPersisted.promise

    expect(todos.size).toBe(3)
    expect(todos.get(3)?.text).toBe('New task')

    await todos.cleanup()
  })
})
