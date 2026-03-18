/**
 * @tmnl/entity — Entity factory tests
 *
 * Tests the production source files (not inline spike code).
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { Entity } from '../src/entity.js'

// ─── Fixtures ────────────────────────────────────────────────

const Priority = Schema.Literals(['low', 'medium', 'high'] as const)

class Todo extends Entity('Todo')({
  id:        Entity.generated(Schema.Number),
  text:      Schema.NonEmptyString,
  completed: Schema.Boolean,
  priority:  Priority,
  createdAt: Entity.timestamp(),
  updatedAt: Entity.timestamp(),
}, {
  events: {
    Completed:       { completedAt: Schema.Number },
    PriorityChanged: { from: Schema.String, to: Schema.String },
  },
}) {
  get isHighPriority() { return (this as any).priority === 'high' }
  toggle() { return new Todo({ ...this, completed: !(this as any).completed }) }
}

class User extends Entity('User')({
  id:       Entity.generated(Schema.Number),
  name:     Schema.NonEmptyString,
  email:    Schema.String,
  password: Entity.sensitive(Schema.NonEmptyString),
  apiKey:   Entity.sensitive(Schema.String),
}) {}

class Article extends Entity('Article')({
  id:        Entity.generated(Schema.Number),
  title:     Schema.NonEmptyString,
  viewCount: Entity.readonly(Schema.Number),
  score:     Entity.readonly(Schema.Number),
}) {}

class Report extends Entity('Report')({
  id:            Entity.generated(Schema.Number),
  title:         Schema.NonEmptyString,
  wordCount:     Entity.computed(Schema.Number),
  readingTimeMs: Entity.computed(Schema.Number),
}) {}

// ─── Field Wrappers ──────────────────────────────────────────

describe('Entity.generated — excluded from insert', () => {
  it('select includes id', () => {
    expect(Object.keys(Todo.select.fields)).toContain('id')
  })

  it('insert excludes id', () => {
    expect(Object.keys(Todo.insert.fields)).not.toContain('id')
  })

  it('update includes id', () => {
    expect(Object.keys(Todo.update.fields)).toContain('id')
  })

  it('json includes id', () => {
    expect(Object.keys(Todo.json.fields)).toContain('id')
  })
})

describe('Entity.timestamp — optional on insert/update', () => {
  it('select has timestamps', () => {
    const fields = Object.keys(Todo.select.fields)
    expect(fields).toContain('createdAt')
    expect(fields).toContain('updatedAt')
  })

  it('insert has timestamps (optional)', () => {
    const fields = Object.keys(Todo.insert.fields)
    expect(fields).toContain('createdAt')
    expect(fields).toContain('updatedAt')
  })

  it('insert succeeds without timestamps', () => {
    const decoded = Schema.decodeUnknownSync(Todo.insert)({
      text: 'Buy milk', completed: false, priority: 'high',
    })
    expect(decoded.text).toBe('Buy milk')
    expect(decoded).not.toHaveProperty('createdAt')
  })

  it('insert succeeds with timestamps', () => {
    const decoded = Schema.decodeUnknownSync(Todo.insert)({
      text: 'Buy milk', completed: false, priority: 'high', createdAt: 1000,
    })
    expect(decoded.createdAt).toBe(1000)
  })
})

describe('Entity.sensitive — excluded from json', () => {
  it('select includes sensitive fields', () => {
    const fields = Object.keys(User.select.fields)
    expect(fields).toContain('password')
    expect(fields).toContain('apiKey')
  })

  it('insert includes sensitive fields', () => {
    const fields = Object.keys(User.insert.fields)
    expect(fields).toContain('password')
    expect(fields).toContain('apiKey')
  })

  it('json EXCLUDES sensitive fields', () => {
    const fields = Object.keys(User.json.fields)
    expect(fields).not.toContain('password')
    expect(fields).not.toContain('apiKey')
  })

  it('jsonCreate EXCLUDES sensitive fields', () => {
    const fields = Object.keys(User.jsonCreate.fields)
    expect(fields).not.toContain('password')
    expect(fields).not.toContain('apiKey')
  })
})

describe('Entity.readonly — excluded from insert/update', () => {
  it('select includes readonly fields', () => {
    const fields = Object.keys(Article.select.fields)
    expect(fields).toContain('viewCount')
    expect(fields).toContain('score')
  })

  it('insert EXCLUDES readonly fields', () => {
    const fields = Object.keys(Article.insert.fields)
    expect(fields).not.toContain('viewCount')
    expect(fields).not.toContain('score')
  })

  it('update EXCLUDES readonly fields', () => {
    const fields = Object.keys(Article.update.fields)
    expect(fields).not.toContain('viewCount')
    expect(fields).not.toContain('score')
  })

  it('json INCLUDES readonly fields', () => {
    const fields = Object.keys(Article.json.fields)
    expect(fields).toContain('viewCount')
    expect(fields).toContain('score')
  })
})

describe('Entity.computed — select only', () => {
  it('select includes computed fields', () => {
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

  it('json EXCLUDES computed fields', () => {
    const fields = Object.keys(Report.json.fields)
    expect(fields).not.toContain('wordCount')
    expect(fields).not.toContain('readingTimeMs')
  })
})

// ─── Validation ──────────────────────────────────────────────

describe('Validation through variant schemas', () => {
  it('insert rejects empty text', () => {
    expect(() => Schema.decodeUnknownSync(Todo.insert)({
      text: '', completed: false, priority: 'medium',
    })).toThrow()
  })

  it('insert rejects invalid priority', () => {
    expect(() => Schema.decodeUnknownSync(Todo.insert)({
      text: 'Valid', completed: false, priority: 'BOGUS',
    })).toThrow()
  })

  it('insert accepts valid data', () => {
    const result = Schema.decodeUnknownSync(Todo.insert)({
      text: 'Buy milk', completed: false, priority: 'high',
    })
    expect(result.text).toBe('Buy milk')
  })

  it('json roundtrip', () => {
    const original = {
      id: 1, text: 'Test', completed: false,
      priority: 'medium' as const, createdAt: 1000, updatedAt: 2000,
    }
    const encoded = Schema.encodeSync(Todo.json)(original)
    const decoded = Schema.decodeUnknownSync(Todo.json)(encoded)
    expect(decoded).toEqual(original)
  })
})

// ─── Instance Behavior ───────────────────────────────────────

describe('Entity instances', () => {
  it('constructor validates through select schema', () => {
    const todo = new Todo({
      id: 1, text: 'Test', completed: false,
      priority: 'high', createdAt: 1000, updatedAt: 2000,
    })
    expect(todo).toBeInstanceOf(Todo)
    expect(todo.text).toBe('Test')
  })

  it('constructor rejects invalid data', () => {
    expect(() => new Todo({
      id: 1, text: '', completed: false,
      priority: 'high', createdAt: 1000, updatedAt: 2000,
    })).toThrow()
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
})

// ─── Entity IS a Schema ──────────────────────────────────────

describe('Entity class IS a usable Effect Schema', () => {
  it('Schema.isSchema(Entity) is true', () => {
    expect(Schema.isSchema(Todo)).toBe(true)
  })

  it('has .ast property', () => {
    expect((Todo as any).ast).toBeDefined()
  })

  it('has .pipe method', () => {
    expect((Todo as any).pipe).toBeTypeOf('function')
  })

  it('Schema.decodeUnknownSync(Entity) decodes to class instance', () => {
    const decoded = Schema.decodeUnknownSync(Todo as any)({
      id: 1, text: 'Hello', completed: false,
      priority: 'high', createdAt: 1000, updatedAt: 2000,
    })
    expect(decoded).toBeInstanceOf(Todo)
    expect(decoded.text).toBe('Hello')
    expect(decoded.id).toBe(1)
  })

  it('Schema.decodeUnknownSync(Entity) rejects invalid data', () => {
    expect(() => Schema.decodeUnknownSync(Todo as any)({
      id: 1, text: '', completed: false,
      priority: 'high', createdAt: 1000, updatedAt: 2000,
    })).toThrow()
  })

  it('Schema.Array(Entity) creates array schema', () => {
    const TodoArray = Schema.Array(Todo as any)
    expect(Schema.isSchema(TodoArray)).toBe(true)

    const decoded = Schema.decodeUnknownSync(TodoArray)([
      { id: 1, text: 'A', completed: false, priority: 'low', createdAt: 1, updatedAt: 1 },
      { id: 2, text: 'B', completed: true, priority: 'high', createdAt: 2, updatedAt: 2 },
    ])
    expect(decoded).toHaveLength(2)
    expect(decoded[0]).toBeInstanceOf(Todo)
    expect(decoded[1]).toBeInstanceOf(Todo)
  })

  it('Entity can be used as a Schema.Struct field', () => {
    const Wrapper = Schema.Struct({ todo: Todo as any })
    expect(Schema.isSchema(Wrapper)).toBe(true)

    const decoded = Schema.decodeUnknownSync(Wrapper)({
      todo: { id: 1, text: 'Nested', completed: false, priority: 'medium', createdAt: 1, updatedAt: 1 },
    })
    expect(decoded.todo).toBeInstanceOf(Todo)
    expect(decoded.todo.text).toBe('Nested')
  })

  it('Schema.encodeSync(Entity) encodes from instance', () => {
    const todo = new Todo({
      id: 1, text: 'Encode me', completed: false,
      priority: 'medium', createdAt: 1000, updatedAt: 2000,
    })
    const encoded = Schema.encodeSync(Todo as any)(todo)
    expect(encoded).toEqual({
      id: 1, text: 'Encode me', completed: false,
      priority: 'medium', createdAt: 1000, updatedAt: 2000,
    })
  })

  it('variant schemas are ALSO valid schemas', () => {
    expect(Schema.isSchema(Todo.select)).toBe(true)
    expect(Schema.isSchema(Todo.insert)).toBe(true)
    expect(Schema.isSchema(Todo.update)).toBe(true)
    expect(Schema.isSchema(Todo.json)).toBe(true)
    expect(Schema.isSchema(Todo.jsonCreate)).toBe(true)
    expect(Schema.isSchema(Todo.jsonUpdate)).toBe(true)
  })

  it('decoding through Todo vs Todo.select: class instance vs plain object', () => {
    const data = { id: 1, text: 'Test', completed: false, priority: 'low' as const, createdAt: 1, updatedAt: 1 }

    const viaClass = Schema.decodeUnknownSync(Todo as any)(data)
    const viaSelect = Schema.decodeUnknownSync(Todo.select)(data)

    // Class decoding → instance with methods
    expect(viaClass).toBeInstanceOf(Todo)
    expect(viaClass.isHighPriority).toBe(false)

    // Select decoding → plain object (no class, no methods)
    expect(viaSelect).not.toBeInstanceOf(Todo)
    expect(viaSelect.text).toBe('Test')
  })
})

// ─── Validate Helpers ────────────────────────────────────────

describe('Entity.validate — safe validators per variant', () => {
  it('validate property exists on entity', () => {
    expect(Todo.validate).toBeDefined()
    expect(Todo.validate.insert).toBeTypeOf('function')
    expect(Todo.validate.update).toBeTypeOf('function')
    expect(Todo.validate.select).toBeTypeOf('function')
    expect(Todo.validate.json).toBeTypeOf('function')
    expect(Todo.validate.jsonCreate).toBeTypeOf('function')
    expect(Todo.validate.jsonUpdate).toBeTypeOf('function')
  })

  it('validate.insert returns Ok for valid data', () => {
    const result = Todo.validate.insert({ text: 'Buy milk', completed: false, priority: 'high' })
    expect(result._tag).toBe('Success')
    expect(result.success.text).toBe('Buy milk')
  })

  it('validate.insert returns Err for invalid data', () => {
    const result = Todo.validate.insert({ text: '', completed: false, priority: 'high' })
    expect(result._tag).toBe('Failure')
    expect(result.failure.issues.length).toBeGreaterThan(0)
  })

  it('validate.insert returns Err for missing fields', () => {
    const result = Todo.validate.insert({})
    expect(result._tag).toBe('Failure')
  })

  it('validate.select returns Ok for full entity', () => {
    const result = Todo.validate.select({
      id: 1, text: 'Test', completed: false,
      priority: 'medium', createdAt: 1000, updatedAt: 2000,
    })
    expect(result._tag).toBe('Success')
  })

  it('validate.json returns Ok (excludes sensitive)', () => {
    const result = User.validate.json({ id: 1, name: 'Alice', email: 'a@b.com' })
    expect(result._tag).toBe('Success')
    // password/apiKey not required in json variant
  })

  it('validate.insert requires sensitive fields', () => {
    const result = User.validate.insert({
      name: 'Alice', email: 'a@b.com',
      password: 'secret', apiKey: 'key-123',
    })
    expect(result._tag).toBe('Success')
  })

  it('validate.insert rejects missing sensitive field', () => {
    const result = User.validate.insert({
      name: 'Alice', email: 'a@b.com',
      // missing password and apiKey
    })
    expect(result._tag).toBe('Failure')
  })
})

// ─── Codec (Wire Encode/Decode) ──────────────────────────────

describe('Entity.codec — wire encode/decode', () => {
  const sampleTodo = {
    id: 1, text: 'Buy milk', completed: false,
    priority: 'medium' as const, createdAt: 1000, updatedAt: 2000,
  }

  it('codec property exists on entity', () => {
    expect(Todo.codec).toBeDefined()
    expect(Todo.codec.encode).toBeTypeOf('function')
    expect(Todo.codec.decode).toBeTypeOf('function')
    expect(Todo.codec.decodeOrThrow).toBeTypeOf('function')
    expect(Todo.codec.encodeArray).toBeTypeOf('function')
    expect(Todo.codec.decodeArray).toBeTypeOf('function')
  })

  it('encode produces plain object', () => {
    const wire = Todo.codec.encode(sampleTodo)
    expect(wire).toEqual(sampleTodo)
    expect(typeof wire).toBe('object')
  })

  it('encode → decode roundtrip', () => {
    const wire = Todo.codec.encode(sampleTodo)
    const result = Todo.codec.decode(wire)
    expect(result._tag).toBe('Success')
    expect(result.success).toEqual(sampleTodo)
  })

  it('decode returns Err for invalid wire data', () => {
    const result = Todo.codec.decode({ id: 'not-a-number', text: '' })
    expect(result._tag).toBe('Failure')
    expect(result.failure.issues.length).toBeGreaterThan(0)
  })

  it('decodeOrThrow returns value on success', () => {
    const value = Todo.codec.decodeOrThrow(sampleTodo)
    expect(value).toEqual(sampleTodo)
  })

  it('decodeOrThrow throws on failure', () => {
    expect(() => Todo.codec.decodeOrThrow({ bogus: true })).toThrow()
  })

  it('encodeArray encodes multiple items', () => {
    const items = [sampleTodo, { ...sampleTodo, id: 2, text: 'Walk dog' }]
    const wires = Todo.codec.encodeArray(items)
    expect(wires).toHaveLength(2)
    expect(wires[0]).toEqual(sampleTodo)
    expect((wires[1] as any).text).toBe('Walk dog')
  })

  it('decodeArray decodes multiple wire objects', () => {
    const wires = [sampleTodo, { ...sampleTodo, id: 2, text: 'Walk dog' }]
    const result = Todo.codec.decodeArray(wires)
    expect(result._tag).toBe('Success')
    expect(result.success).toHaveLength(2)
  })

  it('decodeArray returns Err if any item invalid', () => {
    const wires = [sampleTodo, { bogus: true }]
    const result = Todo.codec.decodeArray(wires)
    expect(result._tag).toBe('Failure')
  })

  it('User codec excludes sensitive fields from wire', () => {
    const user = { id: 1, name: 'Alice', email: 'a@b.com' }
    // json variant doesn't have password/apiKey, so encoding should work
    const wire = User.codec.encode(user)
    expect(wire).toEqual(user)
    expect((wire as any).password).toBeUndefined()
    expect((wire as any).apiKey).toBeUndefined()
  })
})

// ─── Escape Hatches ──────────────────────────────────────────

describe('Entity.field / Entity.fieldOnly / Entity.fieldExcept', () => {
  it('Entity.field provides direct Field access', () => {
    expect(Entity.field).toBeTypeOf('function')
  })

  it('Entity.fieldOnly provides FieldOnly access', () => {
    expect(Entity.fieldOnly).toBeTypeOf('function')
  })

  it('Entity.fieldExcept provides FieldExcept access', () => {
    expect(Entity.fieldExcept).toBeTypeOf('function')
  })
})
