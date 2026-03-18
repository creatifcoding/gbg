/**
 * @tmnl/entity — Event Ingestion & EventLog Benchmarks
 *
 * Performance of the entity event system:
 * B1: Event payload creation throughput (building event envelopes)
 * B2: Event header creation + validation
 * B3: EventGroup matching / lookup
 * B4: EventLog write throughput (memory journal)
 * B5: EventLog write + handler dispatch
 * B6: Bulk event ingestion (BulkCreated with N items)
 * B7: Event filtering utilities at scale
 * B8: Mixed event workload (create entities + emit events + handle)
 */

import { describe, it, expect } from 'vitest'
import * as Schema from 'effect-v4/Schema'
import * as Effect from 'effect-v4/Effect'
import * as Layer from 'effect-v4/Layer'
import * as Ref from 'effect-v4/Ref'
import * as EventGroup from 'effect-v4/unstable/eventlog/EventGroup'
import * as EventJournal from 'effect-v4/unstable/eventlog/EventJournal'
import * as EventLog from 'effect-v4/unstable/eventlog/EventLog'
import { Entity } from '../src/entity.js'
import {
  EventHeader,
  buildEntityEvents,
  isLifecycleEvent,
  entityNameFromTag,
  eventNameFromTag,
  filterByEntity,
  filterByEventType,
} from '../src/events.js'

// ─── Entity Definitions ──────────────────────────────────────

class Todo extends Entity('Todo')({
  id:        Entity.generated(Schema.Number),
  title:     Schema.NonEmptyString,
  done:      Schema.Boolean,
  priority:  Schema.Number,
  createdAt: Entity.timestamp(),
  updatedAt: Entity.timestamp(),
}, {
  events: {
    Completed:       { completedAt: Schema.Number },
    PriorityChanged: { from: Schema.Number, to: Schema.Number },
    Assigned:        { assignee: Schema.String },
  },
}) {}

class Order extends Entity('Order')({
  id:          Entity.generated(Schema.Number),
  customerName: Schema.NonEmptyString,
  total:       Schema.Number,
  status:      Schema.Literals(['pending', 'confirmed', 'shipped', 'delivered'] as const),
  region:      Schema.Literals(['US', 'EU', 'UK', 'JP'] as const),
  createdAt:   Entity.timestamp(),
  updatedAt:   Entity.timestamp(),
}, {
  events: {
    Shipped:   { trackingId: Schema.String, carrier: Schema.String },
    Refunded:  { amount: Schema.Number, reason: Schema.String },
  },
}) {}

// ─── Helpers ─────────────────────────────────────────────────

function formatRate(ops: number, unit = 'ops/sec'): string {
  if (ops >= 1e9) return `${(ops / 1e9).toFixed(2)}G ${unit}`
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(2)}M ${unit}`
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(1)}K ${unit}`
  return `${ops.toFixed(0)} ${unit}`
}

function makeHeader(i: number): typeof EventHeader.Type {
  return {
    entityId: String(i),
    entityType: 'Todo',
    timestamp: Date.now(),
    correlationId: `corr-${i}`,
  }
}

// ─── B1: Event Payload Creation Throughput ───────────────────

describe('B1: Event Payload Creation', () => {
  it('10K Created event payloads', () => {
    const N = 10_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      const payload = {
        header: makeHeader(i),
        payload: {
          title: `Task ${i}`,
          done: false,
          priority: i % 5,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      }
      // Consume to prevent dead code elimination
      payload.header.entityId
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B1 Created Payload: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(500_000)
  })

  it('10K Updated event payloads (before/after snapshots)', () => {
    const N = 10_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      const payload = {
        header: makeHeader(i),
        payload: {
          before: { id: i, title: `Task ${i}`, done: false, priority: 1, createdAt: Date.now(), updatedAt: Date.now() },
          after:  { id: i, title: `Task ${i}`, done: true,  priority: 1, createdAt: Date.now(), updatedAt: Date.now() },
        },
      }
      payload.header.entityId
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B1 Updated Payload: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(200_000)
  })

  it('10K custom event payloads (Completed)', () => {
    const N = 10_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      const payload = {
        header: makeHeader(i),
        payload: { completedAt: Date.now() },
      }
      payload.header.entityId
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B1 Custom Payload: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(500_000)
  })
})

// ─── B2: Event Header Validation ─────────────────────────────

describe('B2: Event Header — creation + Schema validation', () => {
  const decodeHeader = Schema.decodeUnknownSync(EventHeader)

  it('10K header validations', () => {
    const N = 10_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      decodeHeader({
        entityId: String(i),
        entityType: 'Todo',
        timestamp: Date.now(),
        correlationId: `corr-${i}`,
      })
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B2 Header Validate: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(100_000)
  })
})

// ─── B3: EventGroup Matching ─────────────────────────────────

describe('B3: EventGroup Structure', () => {
  it('buildEntityEvents for entity with 3 custom events', () => {
    const N = 1_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      buildEntityEvents(`Entity${i}`, { select: Schema.Unknown, insert: Schema.Unknown }, {
        CustomA: { value: Schema.Number },
        CustomB: { name: Schema.String },
        CustomC: { flag: Schema.Boolean },
      })
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 BuildEvents: ${N.toLocaleString()} groups in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(500)
  })

  it('entity.events property access throughput', () => {
    const N = 100_000
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      ;(Todo as any).events
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B3 Events Access: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(10_000_000)
  })
})

// ─── B4: EventLog Write Throughput ───────────────────────────

describe('B4: EventLog Write — memory journal', () => {
  // Build a minimal EventGroup for benchmarking
  const BenchGroup = EventGroup.empty.add({
    tag: 'Bench.Created',
    primaryKey: (payload: any) => payload.id,
    payload: Schema.Struct({
      id: Schema.String,
      value: Schema.Number,
    }),
  })

  const benchSchema = EventLog.schema(BenchGroup)

  it('1K sequential writes', () =>
    Effect.gen(function*() {
      const counter = yield* Ref.make(0)

      return yield* Effect.gen(function*() {
        const log = yield* EventLog.EventLog
        const N = 1_000

        const start = performance.now()
        for (let i = 0; i < N; i++) {
          yield* log.write({
            schema: benchSchema,
            event: 'Bench.Created',
            payload: { id: `item-${i}`, value: i * 10 },
          })
        }
        const elapsed = performance.now() - start
        const rate = (N / elapsed) * 1000

        const entries = yield* log.entries
        expect(entries).toHaveLength(N)

        console.log(`B4 Write 1K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
        expect(rate).toBeGreaterThan(5_000)
      }).pipe(
        Effect.provide(
          EventLog.layer(benchSchema).pipe(
            Layer.provideMerge(EventJournal.layerMemory),
            Layer.provideMerge(Layer.succeed(EventLog.Identity, EventLog.makeIdentityUnsafe())),
            Layer.provideMerge(
              EventLog.group(BenchGroup, (handlers) =>
                handlers.handle('Bench.Created', () => Ref.update(counter, (n) => n + 1)),
              ),
            ),
          ),
        ),
      )
    }).pipe(Effect.runPromise))
})

// ─── B5: EventLog Write + Handler Dispatch ───────────────────

describe('B5: EventLog Write + Handler Dispatch', () => {
  const BenchGroup = EventGroup.empty.add({
    tag: 'Bench.Processed',
    primaryKey: (payload: any) => payload.id,
    payload: Schema.Struct({
      id: Schema.String,
      amount: Schema.Number,
    }),
  })

  const benchSchema = EventLog.schema(BenchGroup)

  it('1K writes with handler invoked on each', () =>
    Effect.gen(function*() {
      const counter = yield* Ref.make(0)
      const N = 1_000

      return yield* Effect.gen(function*() {
        const log = yield* EventLog.EventLog

        const start = performance.now()
        for (let i = 0; i < N; i++) {
          yield* log.write({
            schema: benchSchema,
            event: 'Bench.Processed',
            payload: { id: `proc-${i}`, amount: i * 7.5 },
          })
        }
        const elapsed = performance.now() - start
        const rate = (N / elapsed) * 1000

        const count = yield* Ref.get(counter)
        const entries = yield* log.entries
        expect(entries).toHaveLength(N)
        expect(count).toBe(N)

        console.log(`B5 Write+Handle 1K: ${elapsed.toFixed(1)}ms → ${formatRate(rate)} (${count} handled)`)
        expect(rate).toBeGreaterThan(2_000)
      }).pipe(
        Effect.provide(
          EventLog.layer(benchSchema).pipe(
            Layer.provideMerge(EventJournal.layerMemory),
            Layer.provideMerge(Layer.succeed(EventLog.Identity, EventLog.makeIdentityUnsafe())),
            Layer.provideMerge(
              EventLog.group(BenchGroup, (handlers) =>
                handlers.handle('Bench.Processed', () =>
                  Ref.update(counter, (n) => n + 1),
                ),
              ),
            ),
          ),
        ),
      )
    }).pipe(Effect.runPromise))
})

// ─── B6: Bulk Event Ingestion ────────────────────────────────

describe('B6: Bulk Event Payloads', () => {
  it('BulkCreated with 1K items — payload construction', () => {
    const N = 1_000
    const BATCHES = 100

    const start = performance.now()
    for (let b = 0; b < BATCHES; b++) {
      const items = Array.from({ length: N }, (_, i) => ({
        title: `Task ${b * N + i}`,
        done: false,
        priority: i % 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }))
      const payload = {
        header: {
          entityId: 'bulk',
          entityType: 'Todo',
          timestamp: Date.now(),
          correlationId: `batch-${b}`,
        },
        payload: { items },
      }
      // Consume
      payload.payload.items.length
    }
    const elapsed = performance.now() - start
    const totalItems = N * BATCHES
    const rate = (totalItems / elapsed) * 1000

    console.log(`B6 BulkCreated: ${BATCHES} batches × ${N} items = ${totalItems.toLocaleString()} items in ${elapsed.toFixed(1)}ms → ${formatRate(rate, 'items/sec')}`)
    expect(rate).toBeGreaterThan(500_000)
  })

  it('BulkDeleted with 10K IDs — payload construction', () => {
    const N = 10_000
    const BATCHES = 50

    const start = performance.now()
    for (let b = 0; b < BATCHES; b++) {
      const ids = Array.from({ length: N }, (_, i) => String(b * N + i))
      const payload = {
        header: {
          entityId: 'bulk',
          entityType: 'Todo',
          timestamp: Date.now(),
          correlationId: `delete-batch-${b}`,
        },
        payload: { ids },
      }
      payload.payload.ids.length
    }
    const elapsed = performance.now() - start
    const totalIds = N * BATCHES
    const rate = (totalIds / elapsed) * 1000

    console.log(`B6 BulkDeleted: ${BATCHES} batches × ${N.toLocaleString()} IDs = ${totalIds.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate, 'ids/sec')}`)
    expect(rate).toBeGreaterThan(1_000_000)
  })
})

// ─── B7: Event Filtering at Scale ────────────────────────────

describe('B7: Event Filtering Utilities', () => {
  // Generate a realistic event tag pool
  const entities = ['Todo', 'Order', 'User', 'Invoice', 'Product']
  const lifecycleEvents = ['Created', 'Updated', 'Deleted', 'Restored', 'Archived', 'Patched', 'BulkCreated', 'BulkDeleted']
  const customEvents: Record<string, string[]> = {
    Todo: ['Completed', 'PriorityChanged', 'Assigned'],
    Order: ['Shipped', 'Refunded'],
    User: ['Suspended', 'Verified'],
    Invoice: ['Paid', 'Overdue', 'Voided'],
    Product: ['Restocked', 'Discontinued'],
  }

  const allTags: string[] = []
  for (const entity of entities) {
    for (const event of lifecycleEvents) allTags.push(`${entity}.${event}`)
    for (const event of customEvents[entity]) allTags.push(`${entity}.${event}`)
  }

  // Scale up — simulate 100K event tags (repeated from the pool)
  const tagPool = Array.from({ length: 100_000 }, (_, i) => allTags[i % allTags.length])

  it('isLifecycleEvent — 100K classifications', () => {
    const N = tagPool.length
    const start = performance.now()
    let lifecycleCount = 0
    for (let i = 0; i < N; i++) {
      if (isLifecycleEvent(tagPool[i])) lifecycleCount++
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B7 isLifecycleEvent: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)} (${lifecycleCount.toLocaleString()} lifecycle)`)
    expect(rate).toBeGreaterThan(5_000_000)
  })

  it('entityNameFromTag — 100K extractions', () => {
    const N = tagPool.length
    const start = performance.now()
    for (let i = 0; i < N; i++) {
      entityNameFromTag(tagPool[i])
    }
    const elapsed = performance.now() - start
    const rate = (N / elapsed) * 1000

    console.log(`B7 entityNameFromTag: ${N.toLocaleString()} in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(5_000_000)
  })

  it('filterByEntity — 100K tags filtered', () => {
    const start = performance.now()
    const todoEvents = filterByEntity(tagPool, 'Todo')
    const orderEvents = filterByEntity(tagPool, 'Order')
    const elapsed = performance.now() - start
    const rate = ((tagPool.length * 2) / elapsed) * 1000

    console.log(`B7 filterByEntity: ${(tagPool.length * 2).toLocaleString()} filters in ${elapsed.toFixed(1)}ms → ${formatRate(rate)} (Todo: ${todoEvents.length.toLocaleString()}, Order: ${orderEvents.length.toLocaleString()})`)
    expect(rate).toBeGreaterThan(2_000_000)
  })

  it('filterByEventType — 100K tags cross-entity', () => {
    const start = performance.now()
    const created = filterByEventType(tagPool, 'Created')
    const deleted = filterByEventType(tagPool, 'Deleted')
    const elapsed = performance.now() - start
    const rate = ((tagPool.length * 2) / elapsed) * 1000

    console.log(`B7 filterByEventType: ${(tagPool.length * 2).toLocaleString()} filters in ${elapsed.toFixed(1)}ms → ${formatRate(rate)} (Created: ${created.length.toLocaleString()}, Deleted: ${deleted.length.toLocaleString()})`)
    expect(rate).toBeGreaterThan(2_000_000)
  })
})

// ─── B8: Mixed Event Workload ────────────────────────────────

describe('B8: Mixed — entity creation + event emission + handling', () => {
  it('500 entities: create + build event payload + validate header', () => {
    const decodeHeader = Schema.decodeUnknownSync(EventHeader)
    const N = 500

    const start = performance.now()
    for (let i = 0; i < N; i++) {
      // Create entity
      const todo = new Todo({
        id: i,
        title: `Task ${i}`,
        done: false,
        priority: i % 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      // Build Created event payload
      const header = makeHeader(i)
      const eventPayload = {
        header,
        payload: {
          title: todo.title,
          done: todo.done,
          priority: todo.priority,
          createdAt: todo.createdAt,
          updatedAt: todo.updatedAt,
        },
      }

      // Validate header
      decodeHeader(header)

      // Classify event
      isLifecycleEvent('Todo.Created')
      entityNameFromTag('Todo.Created')

      // Access entity events
      ;(Todo as any).events
    }
    const elapsed = performance.now() - start
    const opsPerTick = 6 // create + build payload + validate + 2 classify + events access
    const totalOps = N * opsPerTick
    const rate = (totalOps / elapsed) * 1000

    console.log(`B8 Mixed: ${N} entities × ${opsPerTick} ops = ${totalOps.toLocaleString()} ops in ${elapsed.toFixed(1)}ms → ${formatRate(rate)}`)
    expect(rate).toBeGreaterThan(50_000)
  })
})
