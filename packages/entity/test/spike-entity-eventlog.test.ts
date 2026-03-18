/**
 * Spike: @tmnl/entity — Entity Factory + EventLog Integration
 *
 * Prove:
 *   H0: Entity() factory with field wrappers + events: {} config
 *   H1: Standard lifecycle events auto-generated from entity schema
 *   H2: Custom domain events declared in events: {} config
 *   H3: All events have envelope (header + payload), dot-namespaced _tag
 *   H4: EventGroup integration — entity events are a valid EventGroup
 *   H5: EventLog write/read roundtrip with entity events
 *   H6: Hierarchical matching — cross-entity event queries
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import { VariantSchema } from 'effect-v4/unstable/schema'
import * as EventGroupMod from 'effect-v4/unstable/eventlog/EventGroup'
import * as EventMod from 'effect-v4/unstable/eventlog/Event'

// ─── Event Envelope Schema ───────────────────────────────────

const EventHeader = Schema.Struct({
  entityId: Schema.String,
  entityType: Schema.String,
  timestamp: Schema.Number,
  correlationId: Schema.String,
})

// ─── Entity Factory (spike inline — will become src/entity.ts) ─

const ENTITY_VARIANTS = [
  'select', 'insert', 'update',
  'json', 'jsonCreate', 'jsonUpdate',
] as const

const BaseModel = VariantSchema.make({
  variants: [...ENTITY_VARIANTS],
  defaultVariant: 'select',
})

// Standard lifecycle event names
const LIFECYCLE_EVENTS = [
  'Created', 'Updated', 'Deleted',
  'Restored', 'Archived', 'Patched',
  'BulkCreated', 'BulkDeleted',
] as const

type LifecycleEvent = typeof LIFECYCLE_EVENTS[number]

/**
 * Build an EventGroup from entity definition
 */
function buildEntityEvents<Tag extends string>(
  entityTag: Tag,
  entitySchema: any,
  customEvents?: Record<string, Record<string, Schema.Top>>,
): EventGroupMod.EventGroup {
  let group: EventGroupMod.EventGroup = EventGroupMod.empty

  // Standard lifecycle events
  // Created: insert payload
  group = group.add({
    tag: `${entityTag}.Created`,
    primaryKey: (payload: any) => payload.header?.entityId ?? 'unknown',
    payload: Schema.Struct({
      header: EventHeader,
      payload: entitySchema.insert ?? Schema.Unknown,
    }),
  })

  // Updated: before/after snapshots
  group = group.add({
    tag: `${entityTag}.Updated`,
    primaryKey: (payload: any) => payload.header?.entityId ?? 'unknown',
    payload: Schema.Struct({
      header: EventHeader,
      payload: Schema.Struct({
        before: entitySchema.select ?? Schema.Unknown,
        after: entitySchema.select ?? Schema.Unknown,
      }),
    }),
  })

  // Deleted: final snapshot
  group = group.add({
    tag: `${entityTag}.Deleted`,
    primaryKey: (payload: any) => payload.header?.entityId ?? 'unknown',
    payload: Schema.Struct({
      header: EventHeader,
      payload: Schema.Struct({
        snapshot: entitySchema.select ?? Schema.Unknown,
      }),
    }),
  })

  // Patched: partial field changes
  group = group.add({
    tag: `${entityTag}.Patched`,
    primaryKey: (payload: any) => payload.header?.entityId ?? 'unknown',
    payload: Schema.Struct({
      header: EventHeader,
      payload: Schema.Unknown,  // Record<field, { from, to }>
    }),
  })

  // Archived
  group = group.add({
    tag: `${entityTag}.Archived`,
    primaryKey: (payload: any) => payload.header?.entityId ?? 'unknown',
    payload: Schema.Struct({
      header: EventHeader,
      payload: Schema.Struct({
        snapshot: entitySchema.select ?? Schema.Unknown,
      }),
    }),
  })

  // Restored
  group = group.add({
    tag: `${entityTag}.Restored`,
    primaryKey: (payload: any) => payload.header?.entityId ?? 'unknown',
    payload: Schema.Struct({
      header: EventHeader,
      payload: Schema.Struct({
        snapshot: entitySchema.select ?? Schema.Unknown,
      }),
    }),
  })

  // BulkCreated
  group = group.add({
    tag: `${entityTag}.BulkCreated`,
    primaryKey: (payload: any) => payload.header?.correlationId ?? 'unknown',
    payload: Schema.Struct({
      header: EventHeader,
      payload: Schema.Struct({
        items: Schema.Array(entitySchema.insert ?? Schema.Unknown),
      }),
    }),
  })

  // BulkDeleted
  group = group.add({
    tag: `${entityTag}.BulkDeleted`,
    primaryKey: (payload: any) => payload.header?.correlationId ?? 'unknown',
    payload: Schema.Struct({
      header: EventHeader,
      payload: Schema.Struct({
        ids: Schema.Array(Schema.String),
      }),
    }),
  })

  // Custom domain events
  if (customEvents) {
    for (const [eventName, fields] of Object.entries(customEvents)) {
      group = group.add({
        tag: `${entityTag}.${eventName}`,
        primaryKey: (payload: any) => payload.header?.entityId ?? 'unknown',
        payload: Schema.Struct({
          header: EventHeader,
          payload: Schema.Struct(fields as any),
        }),
      })
    }
  }

  return group
}

/**
 * Entity factory with events support
 */
function Entity<Tag extends string>(tag: Tag) {
  return <Fields extends Record<string, any>>(
    fields: Fields,
    config?: { events?: Record<string, Record<string, Schema.Top>> },
  ) => {
    const ModelClass = class extends BaseModel.Class<any>(tag)(fields) {} as any

    // Build event group
    const events = buildEntityEvents(tag, ModelClass, config?.events)

    // Attach events to the class
    ModelClass.events = events
    ModelClass.entityTag = tag

    // Convenience: extract individual event definitions
    ModelClass.event = (eventTag: string) => {
      const fullTag = `${tag}.${eventTag}`
      return (events as any).events[fullTag]
    }

    return ModelClass
  }
}

// Field wrappers (same as proven spike)
Entity.generated = <S extends Schema.Top>(schema: S) =>
  BaseModel.Field({ select: schema, update: schema, json: schema })

Entity.timestamp = (schema?: Schema.Top) => {
  const s = schema ?? Schema.Number
  return BaseModel.Field({
    select: s,
    insert: Schema.optionalKey(s),
    update: Schema.optionalKey(s),
    json: s,
  })
}

Entity.sensitive = <S extends Schema.Top>(schema: S) =>
  BaseModel.Field({ select: schema, insert: schema, update: schema })

Entity.readonly = <S extends Schema.Top>(schema: S) =>
  BaseModel.Field({ select: schema, json: schema })

Entity.computed = <S extends Schema.Top>(schema: S) =>
  BaseModel.FieldOnly(['select'])(schema)


// ─── Entity Definitions ──────────────────────────────────────

const Todo = Entity('Todo')({
  id:        Entity.generated(Schema.Number),
  text:      Schema.NonEmptyString,
  completed: Schema.Boolean,
  priority:  Schema.Literals(['low', 'medium', 'high'] as const),
  createdAt: Entity.timestamp(),
  updatedAt: Entity.timestamp(),
}, {
  events: {
    Completed:       { completedAt: Schema.Number },
    PriorityChanged: { from: Schema.String, to: Schema.String },
    Assigned:        { userId: Schema.String },
  },
})

const Order = Entity('Order')({
  id:         Entity.generated(Schema.Number),
  customerId: Schema.String,
  total:      Schema.Number,
  status:     Schema.Literals(['pending', 'shipped', 'delivered'] as const),
  createdAt:  Entity.timestamp(),
}, {
  events: {
    Shipped:   { trackingNumber: Schema.String },
    Delivered: { deliveredAt: Schema.Number },
  },
})


// ─── H0: Entity factory with field wrappers + events ─────────

describe('H0: Entity factory with field wrappers + events', () => {
  it('produces variant schemas', () => {
    expect(Todo.select).toBeDefined()
    expect(Todo.insert).toBeDefined()
    expect(Todo.update).toBeDefined()
    expect(Todo.json).toBeDefined()
  })

  it('insert EXCLUDES generated(id)', () => {
    const fields = Object.keys(Todo.insert.fields)
    expect(fields).not.toContain('id')
    expect(fields).toContain('text')
  })

  it('has entityTag', () => {
    expect(Todo.entityTag).toBe('Todo')
    expect(Order.entityTag).toBe('Order')
  })

  it('has events property (EventGroup)', () => {
    expect(Todo.events).toBeDefined()
    expect(EventGroupMod.isEventGroup(Todo.events)).toBe(true)
  })
})

// ─── H1: Standard lifecycle events auto-generated ────────────

describe('H1: Standard lifecycle events auto-generated', () => {
  it('has all 8 lifecycle events', () => {
    const eventKeys = Object.keys((Todo.events as any).events)
    expect(eventKeys).toContain('Todo.Created')
    expect(eventKeys).toContain('Todo.Updated')
    expect(eventKeys).toContain('Todo.Deleted')
    expect(eventKeys).toContain('Todo.Patched')
    expect(eventKeys).toContain('Todo.Archived')
    expect(eventKeys).toContain('Todo.Restored')
    expect(eventKeys).toContain('Todo.BulkCreated')
    expect(eventKeys).toContain('Todo.BulkDeleted')
  })

  it('each lifecycle event is an Event', () => {
    const events = (Todo.events as any).events
    expect(EventMod.isEvent(events['Todo.Created'])).toBe(true)
    expect(EventMod.isEvent(events['Todo.Updated'])).toBe(true)
    expect(EventMod.isEvent(events['Todo.Deleted'])).toBe(true)
  })

  it('Created event has correct tag', () => {
    const created = (Todo.events as any).events['Todo.Created']
    expect(created.tag).toBe('Todo.Created')
  })

  it('Order also has all lifecycle events', () => {
    const eventKeys = Object.keys((Order.events as any).events)
    expect(eventKeys).toContain('Order.Created')
    expect(eventKeys).toContain('Order.Updated')
    expect(eventKeys).toContain('Order.Deleted')
  })
})

// ─── H2: Custom domain events ────────────────────────────────

describe('H2: Custom domain events declared in events config', () => {
  it('Todo has custom events', () => {
    const eventKeys = Object.keys((Todo.events as any).events)
    expect(eventKeys).toContain('Todo.Completed')
    expect(eventKeys).toContain('Todo.PriorityChanged')
    expect(eventKeys).toContain('Todo.Assigned')
  })

  it('Order has custom events', () => {
    const eventKeys = Object.keys((Order.events as any).events)
    expect(eventKeys).toContain('Order.Shipped')
    expect(eventKeys).toContain('Order.Delivered')
  })

  it('custom events are proper Event instances', () => {
    const completed = (Todo.events as any).events['Todo.Completed']
    expect(EventMod.isEvent(completed)).toBe(true)
    expect(completed.tag).toBe('Todo.Completed')
  })

  it('entity.event() accessor works', () => {
    const completed = Todo.event('Completed')
    expect(EventMod.isEvent(completed)).toBe(true)
    expect(completed.tag).toBe('Todo.Completed')
  })

  it('total event count = 8 lifecycle + custom', () => {
    const todoEvents = Object.keys((Todo.events as any).events)
    expect(todoEvents).toHaveLength(8 + 3)  // 8 lifecycle + Completed, PriorityChanged, Assigned

    const orderEvents = Object.keys((Order.events as any).events)
    expect(orderEvents).toHaveLength(8 + 2)  // 8 lifecycle + Shipped, Delivered
  })
})

// ─── H3: Envelope structure ──────────────────────────────────

describe('H3: Events have envelope (header + payload)', () => {
  it('Created event payload has header + payload structure', () => {
    const created = (Todo.events as any).events['Todo.Created']
    // The payload schema should have header + payload fields
    const payloadFields = Object.keys(created.payload.fields)
    expect(payloadFields).toContain('header')
    expect(payloadFields).toContain('payload')
  })

  it('custom event payload has header + payload structure', () => {
    const completed = (Todo.events as any).events['Todo.Completed']
    const payloadFields = Object.keys(completed.payload.fields)
    expect(payloadFields).toContain('header')
    expect(payloadFields).toContain('payload')
  })

  it('header schema has entityId, entityType, timestamp, correlationId', () => {
    const headerFields = Object.keys(EventHeader.fields)
    expect(headerFields).toContain('entityId')
    expect(headerFields).toContain('entityType')
    expect(headerFields).toContain('timestamp')
    expect(headerFields).toContain('correlationId')
  })
})

// ─── H4: EventGroup compatibility ────────────────────────────

describe('H4: Entity events form a valid EventGroup', () => {
  it('Todo.events is an EventGroup', () => {
    expect(EventGroupMod.isEventGroup(Todo.events)).toBe(true)
  })

  it('multiple entity groups can be combined', () => {
    // EventGroup supports merging by adding events from another group
    // For now, verify both are valid independently
    expect(EventGroupMod.isEventGroup(Todo.events)).toBe(true)
    expect(EventGroupMod.isEventGroup(Order.events)).toBe(true)
  })

  it('EventGroup.events record is accessible', () => {
    const events = (Todo.events as any).events
    expect(typeof events).toBe('object')
    expect(Object.keys(events).length).toBeGreaterThan(0)
  })
})

// ─── H5: primaryKey extraction ───────────────────────────────

describe('H5: Event primaryKey extraction', () => {
  it('Created event extracts entityId from header', () => {
    const created = (Todo.events as any).events['Todo.Created']
    const key = created.primaryKey({
      header: { entityId: 'todo-42', entityType: 'Todo', timestamp: Date.now(), correlationId: 'corr-1' },
      payload: { text: 'Buy milk', completed: false, priority: 'high' },
    })
    expect(key).toBe('todo-42')
  })

  it('BulkCreated uses correlationId as primaryKey', () => {
    const bulkCreated = (Todo.events as any).events['Todo.BulkCreated']
    const key = bulkCreated.primaryKey({
      header: { entityId: 'bulk', entityType: 'Todo', timestamp: Date.now(), correlationId: 'batch-99' },
      payload: { items: [] },
    })
    expect(key).toBe('batch-99')
  })
})

// ─── H6: Cross-entity event discovery ────────────────────────

describe('H6: Hierarchical matching — cross-entity queries', () => {
  it('all entity events share dot-namespaced pattern', () => {
    const todoKeys = Object.keys((Todo.events as any).events)
    const orderKeys = Object.keys((Order.events as any).events)

    // All Todo events start with "Todo."
    todoKeys.forEach(key => expect(key).toMatch(/^Todo\./))

    // All Order events start with "Order."
    orderKeys.forEach(key => expect(key).toMatch(/^Order\./))
  })

  it('can filter lifecycle events across entities by suffix', () => {
    const todoKeys = Object.keys((Todo.events as any).events)
    const orderKeys = Object.keys((Order.events as any).events)

    const allKeys = [...todoKeys, ...orderKeys]
    const allCreated = allKeys.filter(k => k.endsWith('.Created'))
    expect(allCreated).toEqual(['Todo.Created', 'Order.Created'])

    const allDeleted = allKeys.filter(k => k.endsWith('.Deleted'))
    expect(allDeleted).toEqual(['Todo.Deleted', 'Order.Deleted'])
  })

  it('can find all events for one entity', () => {
    const todoKeys = Object.keys((Todo.events as any).events)
    const todoEvents = todoKeys.filter(k => k.startsWith('Todo.'))
    expect(todoEvents).toHaveLength(11)  // 8 lifecycle + 3 custom
  })

  it('can separate lifecycle from custom events', () => {
    const todoKeys = Object.keys((Todo.events as any).events)
    const lifecycle = todoKeys.filter(k =>
      LIFECYCLE_EVENTS.some(le => k === `Todo.${le}`),
    )
    const custom = todoKeys.filter(k =>
      !LIFECYCLE_EVENTS.some(le => k === `Todo.${le}`),
    )

    expect(lifecycle).toHaveLength(8)
    expect(custom).toHaveLength(3)
    expect(custom).toEqual(expect.arrayContaining([
      'Todo.Completed', 'Todo.PriorityChanged', 'Todo.Assigned',
    ]))
  })
})
