/**
 * @tmnl/db — EventLog Integration
 *
 * Prove entity events flow through Effect's EventLog system:
 *   H0: EventLog.schema() accepts entity EventGroup
 *   H1: EventLog.layer() boots with entity events
 *   H2: log.write() persists entity lifecycle events (Created, Updated, Deleted)
 *   H3: log.entries reads back what was written
 *   H4: Handlers fire on entity events
 *   H5: Custom domain events write through EventLog
 *   H6: Cross-entity schema (Todo + Order events in one EventLog)
 */

import { describe, it, expect } from 'vitest'
import { Effect, Layer, Ref } from 'effect-v4'
import * as EventLog from 'effect-v4/unstable/eventlog/EventLog'
import * as EventJournal from 'effect-v4/unstable/eventlog/EventJournal'
import * as Schema from 'effect-v4/Schema'
import { Entity } from '@tmnl/entity'

// ─── Entities ────────────────────────────────────────────────

class Todo extends Entity('Todo')({
  id:        Entity.generated(Schema.Number),
  text:      Schema.NonEmptyString,
  completed: Schema.Boolean,
  createdAt: Entity.timestamp(),
}, {
  events: {
    Completed: { completedAt: Schema.Number },
  },
}) {}

class Order extends Entity('Order')({
  id:     Entity.generated(Schema.Number),
  total:  Schema.Number,
  status: Schema.Literals(['pending', 'shipped'] as const),
}, {
  events: {
    Shipped: { trackingNumber: Schema.String },
  },
}) {}

// ─── Helpers ─────────────────────────────────────────────────

function makeHeader(entityId: string, entityType: string, correlationId = 'corr-1') {
  return { entityId, entityType, timestamp: Date.now(), correlationId }
}

/** No-op handler that handles all events (avoids "handler not found" errors) */
function noopHandlerLayer(group: any) {
  return EventLog.group(group, (handlers: any) => {
    // Handle every event with a no-op
    const events = (group as any).events ?? {}
    let result = handlers
    for (const tag of Object.keys(events)) {
      result = result.handle(tag, () => Effect.void)
    }
    return result
  })
}

function makeTodoLogLayer() {
  const schema = EventLog.schema(Todo.events)
  return {
    schema,
    layer: EventLog.layer(schema).pipe(
      Layer.provideMerge(EventJournal.layerMemory),
      Layer.provideMerge(Layer.succeed(EventLog.Identity, EventLog.makeIdentityUnsafe())),
      Layer.provideMerge(noopHandlerLayer(Todo.events)),
    ),
  }
}

const run = <A>(effect: Effect.Effect<A, any, any>, layer: Layer.Layer<any>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layer)))

// ─── H0: EventLog.schema accepts entity EventGroup ──────────

describe('H0: EventLog.schema accepts entity EventGroup', () => {
  it('creates schema from Todo.events', () => {
    const schema = EventLog.schema(Todo.events)
    expect(schema).toBeDefined()
  })

  it('creates schema from Order.events', () => {
    const schema = EventLog.schema(Order.events)
    expect(schema).toBeDefined()
  })
})

// ─── H1: EventLog.layer boots ────────────────────────────────

describe('H1: EventLog.layer boots with entity events', () => {
  it('layer provides EventLog service', async () => {
    const { layer } = makeTodoLogLayer()
    await run(
      Effect.gen(function*() {
        const log = yield* EventLog.EventLog
        expect(log).toBeDefined()
        expect(log.write).toBeDefined()
        expect(log.entries).toBeDefined()
      }),
      layer,
    )
  })
})

// ─── H2: log.write persists entity events ────────────────────

describe('H2: log.write persists entity lifecycle events', () => {
  it('writes Todo.Created', async () => {
    const { schema, layer } = makeTodoLogLayer()
    await run(
      Effect.gen(function*() {
        const log = yield* EventLog.EventLog
        yield* log.write({
          schema,
          event: 'Todo.Created',
          payload: {
            header: makeHeader('todo-1', 'Todo'),
            payload: { text: 'Buy milk', completed: false, createdAt: 1000 },
          },
        })
        const entries = yield* log.entries
        expect(entries.length).toBe(1)
        expect(entries[0].event).toBe('Todo.Created')
      }),
      layer,
    )
  })

  it('writes Todo.Updated', async () => {
    const { schema, layer } = makeTodoLogLayer()
    await run(
      Effect.gen(function*() {
        const log = yield* EventLog.EventLog
        yield* log.write({
          schema,
          event: 'Todo.Updated',
          payload: {
            header: makeHeader('todo-1', 'Todo'),
            payload: {
              before: { id: 1, text: 'Buy milk', completed: false, createdAt: 1000 },
              after: { id: 1, text: 'Buy almond milk', completed: false, createdAt: 1000 },
            },
          },
        })
        const entries = yield* log.entries
        expect(entries.length).toBe(1)
        expect(entries[0].event).toBe('Todo.Updated')
      }),
      layer,
    )
  })

  it('writes Todo.Deleted', async () => {
    const { schema, layer } = makeTodoLogLayer()
    await run(
      Effect.gen(function*() {
        const log = yield* EventLog.EventLog
        yield* log.write({
          schema,
          event: 'Todo.Deleted',
          payload: {
            header: makeHeader('todo-1', 'Todo'),
            payload: { snapshot: { id: 1, text: 'Buy milk', completed: false, createdAt: 1000 } },
          },
        })
        const entries = yield* log.entries
        expect(entries.length).toBe(1)
        expect(entries[0].event).toBe('Todo.Deleted')
      }),
      layer,
    )
  })
})

// ─── H3: log.entries reads back ──────────────────────────────

describe('H3: log.entries reads back written events', () => {
  it('multiple writes read back in order', async () => {
    const { schema, layer } = makeTodoLogLayer()
    await run(
      Effect.gen(function*() {
        const log = yield* EventLog.EventLog

        yield* log.write({
          schema, event: 'Todo.Created',
          payload: {
            header: makeHeader('todo-1', 'Todo'),
            payload: { text: 'First', completed: false, createdAt: 1000 },
          },
        })
        yield* log.write({
          schema, event: 'Todo.Created',
          payload: {
            header: makeHeader('todo-2', 'Todo'),
            payload: { text: 'Second', completed: false, createdAt: 2000 },
          },
        })
        yield* log.write({
          schema, event: 'Todo.Deleted',
          payload: {
            header: makeHeader('todo-1', 'Todo'),
            payload: { snapshot: { id: 1, text: 'First', completed: false, createdAt: 1000 } },
          },
        })

        const entries = yield* log.entries
        expect(entries.length).toBe(3)
        expect(entries[0].event).toBe('Todo.Created')
        expect(entries[1].event).toBe('Todo.Created')
        expect(entries[2].event).toBe('Todo.Deleted')
      }),
      layer,
    )
  })
})

// ─── H4: Handlers fire ──────────────────────────────────────

describe('H4: Handlers fire on entity events', () => {
  it('handler called on Todo.Created', async () => {
    const schema = EventLog.schema(Todo.events)

    await Effect.runPromise(
      Effect.gen(function*() {
        const handled = yield* Ref.make<string[]>([])

        // Custom handler for Created + no-op for all others
        const handlerLayer = EventLog.group(
          Todo.events,
          (handlers: any) => {
            const events = (Todo.events as any).events ?? {}
            let result = handlers
            for (const tag of Object.keys(events)) {
              if (tag === 'Todo.Created') {
                result = result.handle('Todo.Created', ({ payload }: any) =>
                  Ref.update(handled, (arr: string[]) => [...arr, payload.header.entityId]),
                )
              } else {
                result = result.handle(tag, () => Effect.void)
              }
            }
            return result
          },
        )

        const logLayer = EventLog.layer(schema).pipe(
          Layer.provideMerge(EventJournal.layerMemory),
          Layer.provideMerge(Layer.succeed(EventLog.Identity, EventLog.makeIdentityUnsafe())),
          Layer.provideMerge(handlerLayer),
        )

        yield* Effect.gen(function*() {
          const log = yield* EventLog.EventLog
          yield* log.write({
            schema, event: 'Todo.Created',
            payload: {
              header: makeHeader('todo-42', 'Todo'),
              payload: { text: 'Handled!', completed: false, createdAt: 1000 },
            },
          })
          const seen = yield* Ref.get(handled)
          expect(seen).toEqual(['todo-42'])
        }).pipe(Effect.provide(logLayer))
      }),
    )
  })
})

// ─── H5: Custom domain events through EventLog ──────────────

describe('H5: Custom domain events write through EventLog', () => {
  it('writes and reads Todo.Completed', async () => {
    const { schema, layer } = makeTodoLogLayer()
    await run(
      Effect.gen(function*() {
        const log = yield* EventLog.EventLog
        yield* log.write({
          schema, event: 'Todo.Completed',
          payload: {
            header: makeHeader('todo-1', 'Todo'),
            payload: { completedAt: Date.now() },
          },
        })
        const entries = yield* log.entries
        expect(entries.length).toBe(1)
        expect(entries[0].event).toBe('Todo.Completed')
      }),
      layer,
    )
  })
})

// ─── H6: Cross-entity schema ────────────────────────────────

describe('H6: Cross-entity EventLog', () => {
  it('single EventLog with Todo + Order events', async () => {
    // Multiple groups as spread args
    const schema = EventLog.schema(Todo.events, Order.events)

    const layer = EventLog.layer(schema).pipe(
      Layer.provideMerge(EventJournal.layerMemory),
      Layer.provideMerge(Layer.succeed(EventLog.Identity, EventLog.makeIdentityUnsafe())),
      Layer.provideMerge(noopHandlerLayer(Todo.events)),
      Layer.provideMerge(noopHandlerLayer(Order.events)),
    )

    await run(
      Effect.gen(function*() {
        const log = yield* EventLog.EventLog

        yield* log.write({
          schema, event: 'Todo.Created',
          payload: {
            header: makeHeader('todo-1', 'Todo'),
            payload: { text: 'Buy milk', completed: false, createdAt: 1000 },
          },
        })
        yield* log.write({
          schema, event: 'Order.Shipped',
          payload: {
            header: makeHeader('order-1', 'Order'),
            payload: { trackingNumber: 'UPS-12345' },
          },
        })

        const entries = yield* log.entries
        expect(entries.length).toBe(2)
        expect(entries[0].event).toBe('Todo.Created')
        expect(entries[1].event).toBe('Order.Shipped')
      }),
      layer,
    )
  })
})
