/**
 * @tmnl/entity — Event system tests
 *
 * Tests the production events source file.
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import * as EventGroupMod from 'effect-v4/unstable/eventlog/EventGroup'
import * as EventMod from 'effect-v4/unstable/eventlog/Event'
import { Entity } from '../src/entity.js'
import {
  EventHeader,
  LIFECYCLE_EVENTS,
  buildEntityEvents,
  isLifecycleEvent,
  entityNameFromTag,
  eventNameFromTag,
  filterByEntity,
  filterByEventType,
} from '../src/events.js'

// ─── Fixtures ────────────────────────────────────────────────

class Todo extends Entity('Todo')({
  id:        Entity.generated(Schema.Number),
  text:      Schema.NonEmptyString,
  completed: Schema.Boolean,
  createdAt: Entity.timestamp(),
}, {
  events: {
    Completed:       { completedAt: Schema.Number },
    PriorityChanged: { from: Schema.String, to: Schema.String },
    Assigned:        { userId: Schema.String },
  },
}) {}

class Order extends Entity('Order')({
  id:         Entity.generated(Schema.Number),
  customerId: Schema.String,
  total:      Schema.Number,
  createdAt:  Entity.timestamp(),
}, {
  events: {
    Shipped:   { trackingNumber: Schema.String },
    Delivered: { deliveredAt: Schema.Number },
  },
}) {}

// ─── EventHeader ─────────────────────────────────────────────

describe('EventHeader schema', () => {
  it('is a valid Schema', () => {
    expect(Schema.isSchema(EventHeader)).toBe(true)
  })

  it('has all required fields', () => {
    const fields = Object.keys(EventHeader.fields)
    expect(fields).toEqual(expect.arrayContaining([
      'entityId', 'entityType', 'timestamp', 'correlationId',
    ]))
  })

  it('decodes valid header', () => {
    const header = Schema.decodeUnknownSync(EventHeader)({
      entityId: 'todo-1', entityType: 'Todo',
      timestamp: Date.now(), correlationId: 'corr-abc',
    })
    expect(header.entityId).toBe('todo-1')
    expect(header.entityType).toBe('Todo')
  })

  it('rejects invalid header', () => {
    expect(() => Schema.decodeUnknownSync(EventHeader)({
      entityId: 42,  // should be string
    })).toThrow()
  })
})

// ─── Lifecycle Events ────────────────────────────────────────

describe('Standard lifecycle events', () => {
  it('LIFECYCLE_EVENTS has 8 entries', () => {
    expect(LIFECYCLE_EVENTS).toHaveLength(8)
  })

  it('entity has all 8 lifecycle events', () => {
    const eventKeys = Object.keys((Todo.events as any).events)
    for (const le of LIFECYCLE_EVENTS) {
      expect(eventKeys).toContain(`Todo.${le}`)
    }
  })

  it('each lifecycle event is a valid Event', () => {
    const events = (Todo.events as any).events
    for (const le of LIFECYCLE_EVENTS) {
      expect(EventMod.isEvent(events[`Todo.${le}`])).toBe(true)
    }
  })

  it('lifecycle events have correct tags', () => {
    const events = (Todo.events as any).events
    expect(events['Todo.Created'].tag).toBe('Todo.Created')
    expect(events['Todo.Updated'].tag).toBe('Todo.Updated')
    expect(events['Todo.Deleted'].tag).toBe('Todo.Deleted')
  })

  it('each lifecycle event payload has header + payload', () => {
    const events = (Todo.events as any).events
    for (const le of LIFECYCLE_EVENTS) {
      const payloadFields = Object.keys(events[`Todo.${le}`].payload.fields)
      expect(payloadFields).toContain('header')
      expect(payloadFields).toContain('payload')
    }
  })
})

// ─── Custom Events ───────────────────────────────────────────

describe('Custom domain events', () => {
  it('Todo has 3 custom events', () => {
    const eventKeys = Object.keys((Todo.events as any).events)
    expect(eventKeys).toContain('Todo.Completed')
    expect(eventKeys).toContain('Todo.PriorityChanged')
    expect(eventKeys).toContain('Todo.Assigned')
  })

  it('Order has 2 custom events', () => {
    const eventKeys = Object.keys((Order.events as any).events)
    expect(eventKeys).toContain('Order.Shipped')
    expect(eventKeys).toContain('Order.Delivered')
  })

  it('custom events are valid Event instances', () => {
    expect(EventMod.isEvent((Todo.events as any).events['Todo.Completed'])).toBe(true)
    expect(EventMod.isEvent((Order.events as any).events['Order.Shipped'])).toBe(true)
  })

  it('custom events have envelope (header + payload)', () => {
    const completed = (Todo.events as any).events['Todo.Completed']
    const payloadFields = Object.keys(completed.payload.fields)
    expect(payloadFields).toContain('header')
    expect(payloadFields).toContain('payload')
  })

  it('entity.event() accessor returns single event', () => {
    const completed = Todo.event('Completed')
    expect(EventMod.isEvent(completed)).toBe(true)
    expect(completed!.tag).toBe('Todo.Completed')
  })

  it('entity.event() returns undefined for unknown event', () => {
    expect(Todo.event('NonExistent')).toBeUndefined()
  })

  it('total event count = 8 lifecycle + N custom', () => {
    expect(Object.keys((Todo.events as any).events)).toHaveLength(11) // 8 + 3
    expect(Object.keys((Order.events as any).events)).toHaveLength(10) // 8 + 2
  })
})

// ─── EventGroup ──────────────────────────────────────────────

describe('EventGroup compatibility', () => {
  it('entity.events is an EventGroup', () => {
    expect(EventGroupMod.isEventGroup(Todo.events)).toBe(true)
    expect(EventGroupMod.isEventGroup(Order.events)).toBe(true)
  })
})

// ─── primaryKey Extraction ───────────────────────────────────

describe('primaryKey extraction', () => {
  it('single events use entityId', () => {
    const created = (Todo.events as any).events['Todo.Created']
    const key = created.primaryKey({
      header: { entityId: 'todo-42', entityType: 'Todo', timestamp: 1000, correlationId: 'c-1' },
      payload: { text: 'Test', completed: false },
    })
    expect(key).toBe('todo-42')
  })

  it('bulk events use correlationId', () => {
    const bulk = (Todo.events as any).events['Todo.BulkCreated']
    const key = bulk.primaryKey({
      header: { entityId: 'bulk', entityType: 'Todo', timestamp: 1000, correlationId: 'batch-99' },
      payload: { items: [] },
    })
    expect(key).toBe('batch-99')
  })
})

// ─── Event Utilities ─────────────────────────────────────────

describe('Event utilities', () => {
  describe('isLifecycleEvent', () => {
    it('recognizes lifecycle events', () => {
      expect(isLifecycleEvent('Todo.Created')).toBe(true)
      expect(isLifecycleEvent('Order.Updated')).toBe(true)
      expect(isLifecycleEvent('X.BulkDeleted')).toBe(true)
    })

    it('rejects custom events', () => {
      expect(isLifecycleEvent('Todo.Completed')).toBe(false)
      expect(isLifecycleEvent('Order.Shipped')).toBe(false)
    })
  })

  describe('entityNameFromTag', () => {
    it('extracts entity name', () => {
      expect(entityNameFromTag('Todo.Created')).toBe('Todo')
      expect(entityNameFromTag('Order.Shipped')).toBe('Order')
    })
  })

  describe('eventNameFromTag', () => {
    it('extracts event name', () => {
      expect(eventNameFromTag('Todo.Created')).toBe('Created')
      expect(eventNameFromTag('Order.Shipped')).toBe('Shipped')
    })
  })

  describe('filterByEntity', () => {
    const tags = ['Todo.Created', 'Todo.Updated', 'Order.Created', 'Order.Shipped']

    it('filters to one entity', () => {
      expect(filterByEntity(tags, 'Todo')).toEqual(['Todo.Created', 'Todo.Updated'])
      expect(filterByEntity(tags, 'Order')).toEqual(['Order.Created', 'Order.Shipped'])
    })

    it('returns empty for unknown entity', () => {
      expect(filterByEntity(tags, 'User')).toEqual([])
    })
  })

  describe('filterByEventType', () => {
    const tags = ['Todo.Created', 'Todo.Deleted', 'Order.Created', 'Order.Shipped']

    it('filters across entities by suffix', () => {
      expect(filterByEventType(tags, 'Created')).toEqual(['Todo.Created', 'Order.Created'])
    })

    it('returns only matching suffix', () => {
      expect(filterByEventType(tags, 'Shipped')).toEqual(['Order.Shipped'])
    })
  })
})

// ─── Cross-Entity Queries ────────────────────────────────────

describe('Cross-entity hierarchical matching', () => {
  const allTodoTags = Object.keys((Todo.events as any).events)
  const allOrderTags = Object.keys((Order.events as any).events)
  const allTags = [...allTodoTags, ...allOrderTags]

  it('all entity events are dot-namespaced', () => {
    allTodoTags.forEach(t => expect(t).toMatch(/^Todo\./))
    allOrderTags.forEach(t => expect(t).toMatch(/^Order\./))
  })

  it('find all Created events across entities', () => {
    const created = filterByEventType(allTags, 'Created')
    expect(created).toEqual(['Todo.Created', 'Order.Created'])
  })

  it('separate lifecycle from custom events', () => {
    const lifecycle = allTodoTags.filter(isLifecycleEvent)
    const custom = allTodoTags.filter(t => !isLifecycleEvent(t))
    expect(lifecycle).toHaveLength(8)
    expect(custom).toHaveLength(3)
  })
})
