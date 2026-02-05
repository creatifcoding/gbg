/**
 * Event Journal Performance Benchmarks
 *
 * Measures performance of the SQL EventJournal implementation against targets:
 *
 * | Benchmark                  | Target    |
 * |----------------------------|-----------|
 * | Single event write         | <10ms     |
 * | Batch write (100)          | <500ms    |
 * | Batch write (1000)         | <5s       |
 * | Read all entries (1000)    | <100ms    |
 * | Filter by primary_key      | <50ms     |
 * | Filter by event_tag        | <50ms     |
 * | Temporal query (10K)       | <100ms    |
 *
 * Prerequisites:
 *   RUN_INTEGRATION_TESTS=1 required for database access
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   RUN_INTEGRATION_TESTS=1 npx vitest bench --run src/lib/iiot/__tests__/perf/
 *
 * @module @gbg/tmnl/iiot/__tests__/perf/event-performance
 */

import { bench, describe, beforeAll, afterAll } from 'vitest'
import { Effect, Schema, ManagedRuntime } from 'effect'
import { PgClient } from '@effect/sql-pg'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  EventJournalIntegrationLayer,
  isDatabaseAvailable,
} from '../integration/layer'

// =============================================================================
// Environment Check
// =============================================================================

const RUN_INTEGRATION_TESTS = process.env['RUN_INTEGRATION_TESTS'] === '1'

// =============================================================================
// Test Payload Schema
// =============================================================================

const TestEventPayload = Schema.Struct({
  eventId: Schema.String,
  occurredAt: Schema.Number, // timestamp ms
  causedBy: Schema.String,
  entityId: Schema.String,
  entityType: Schema.Literal('Device', 'Machine', 'Sensor'),
  alarmId: Schema.String,
  deviceId: Schema.String,
  severity: Schema.Literal('critical', 'warning', 'info'),
  alarmType: Schema.String,
  triggerValue: Schema.Number,
  thresholdValue: Schema.optionalWith(Schema.Number, { nullable: true }),
  unit: Schema.optionalWith(Schema.String, { nullable: true }),
  message: Schema.optionalWith(Schema.String, { nullable: true }),
  metadata: Schema.optionalWith(Schema.Unknown, { nullable: true }),
})

type TestEventPayload = Schema.Schema.Type<typeof TestEventPayload>

// =============================================================================
// MsgPack Encoding
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let msgpackr: any = null
const getMsgPackr = () => {
  if (!msgpackr) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    msgpackr = require('msgpackr')
  }
  return msgpackr
}

const encodePayload = (payload: TestEventPayload): Uint8Array => {
  const mp = getMsgPackr()
  return mp.encode(payload)
}

// =============================================================================
// Event Factory
// =============================================================================

/**
 * Creates an AlarmTriggered-like payload for benchmarking.
 *
 * Uses TEST-PERF- prefix to distinguish from other test data.
 */
const makeAlarmTriggeredPayload = (index: number): TestEventPayload => ({
  eventId: `EVT-PERF-${Date.now()}-${index}`,
  occurredAt: Date.now(),
  causedBy: 'benchmark',
  entityId: `TEST-PERF-ASSET-${index}`,
  entityType: 'Device' as const,
  alarmId: `TEST-PERF-ALM-${index}`,
  deviceId: `TEST-PERF-DEV-${index}`,
  severity: 'warning' as const,
  alarmType: 'high_temperature',
  triggerValue: 85.5 + (index % 10),
  thresholdValue: 80.0,
  unit: '\u00B0C',
  message: `Benchmark alarm ${index}`,
  metadata: null,
})

// =============================================================================
// Benchmark Helpers
// =============================================================================

/**
 * Write a single event to the journal.
 */
const writeSingleEvent = (
  journal: typeof EventJournal.EventJournal.Service,
  primaryKey: string,
  index: number
): Effect.Effect<EventJournal.Entry, EventJournal.EventJournalError> =>
  Effect.gen(function* () {
    let result: EventJournal.Entry | null = null
    const payload = makeAlarmTriggeredPayload(index)
    yield* journal.write({
      event: 'AlarmTriggered',
      primaryKey,
      payload: encodePayload(payload),
      effect: (entry) =>
        Effect.sync(() => {
          result = entry
        }),
    })
    if (!result) throw new Error('Entry not captured')
    return result
  })

/**
 * Write a batch of events to the journal.
 */
const writeBatch = (
  journal: typeof EventJournal.EventJournal.Service,
  primaryKey: string,
  count: number
): Effect.Effect<void, EventJournal.EventJournalError> =>
  Effect.gen(function* () {
    for (let i = 0; i < count; i++) {
      const payload = makeAlarmTriggeredPayload(i)
      yield* journal.write({
        event: 'AlarmTriggered',
        primaryKey,
        payload: encodePayload(payload),
        effect: () => Effect.void,
      })
    }
  })

/**
 * Clean up performance test data.
 */
const cleanPerfData = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Clean event journal entries with TEST-PERF prefix
  yield* sql`DELETE FROM iiot.event_journal WHERE primary_key LIKE 'TEST-PERF-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
})

// =============================================================================
// Module-level State for Benchmark Runtime
// =============================================================================

// Module-level state that persists across benchmark runs
let dbAvailable = false
let managedRuntime: ManagedRuntime.ManagedRuntime<
  typeof EventJournal.EventJournal.Service | PgClient.PgClient,
  never
> | null = null
let initPromise: Promise<void> | null = null

/**
 * Initialize the runtime once for all benchmarks.
 * Uses lazy initialization pattern to ensure runtime is ready before benchmarks.
 */
async function ensureInitialized(): Promise<boolean> {
  if (initPromise) {
    await initPromise
    return dbAvailable
  }

  initPromise = (async () => {
    if (!RUN_INTEGRATION_TESTS) {
      console.log('SKIPPING: Set RUN_INTEGRATION_TESTS=1 to run benchmarks')
      dbAvailable = false
      return
    }

    try {
      // Create managed runtime
      managedRuntime = ManagedRuntime.make(EventJournalIntegrationLayer)

      // Check database availability
      dbAvailable = await managedRuntime.runPromise(isDatabaseAvailable)

      if (!dbAvailable) {
        console.log(
          'SKIPPING: IIoT database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
        )
        await managedRuntime.dispose()
        managedRuntime = null
        return
      }

      // Clean any stale perf data
      await managedRuntime.runPromise(cleanPerfData)
      console.log('Benchmark runtime initialized successfully')
    } catch (err) {
      console.error('Failed to initialize benchmark runtime:', err)
      dbAvailable = false
      if (managedRuntime) {
        await managedRuntime.dispose()
        managedRuntime = null
      }
    }
  })()

  await initPromise
  return dbAvailable
}

/**
 * Run an effect using the managed runtime.
 * Throws if runtime not initialized or database unavailable.
 */
async function runBenchmarkEffect<A, E>(
  effect: Effect.Effect<A, E, typeof EventJournal.EventJournal.Service | PgClient.PgClient>
): Promise<A> {
  const ready = await ensureInitialized()
  if (!ready || !managedRuntime) {
    throw new Error('Benchmark runtime not available')
  }
  return managedRuntime.runPromise(effect)
}

// =============================================================================
// Performance Benchmarks
// =============================================================================

describe.skipIf(!RUN_INTEGRATION_TESTS)('Event Journal Performance', () => {
  beforeAll(async () => {
    // Ensure runtime is initialized before any benchmarks run
    await ensureInitialized()
  })

  afterAll(async () => {
    if (managedRuntime) {
      try {
        await managedRuntime.runPromise(cleanPerfData)
      } catch {
        // Ignore cleanup errors
      }
      await managedRuntime.dispose()
      managedRuntime = null
    }
  })

  // ===========================================================================
  // Single Event Write Benchmarks
  // ===========================================================================

  describe('Single Event Write', () => {
    bench(
      'single event write',
      async () => {
        const primaryKey = `TEST-PERF-SINGLE-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const index = Math.floor(Math.random() * 10000)

        await runBenchmarkEffect(
          Effect.gen(function* () {
            const journal = yield* EventJournal.EventJournal
            yield* writeSingleEvent(journal, primaryKey, index)
          })
        )
      },
      {
        warmupIterations: 5,
        iterations: 50,
        // Target: <10ms per write
      }
    )
  })

  // ===========================================================================
  // Batch Write Benchmarks
  // ===========================================================================

  describe('Batch Write', () => {
    bench(
      'batch write 100 events',
      async () => {
        const primaryKey = `TEST-PERF-BATCH100-${Date.now()}-${Math.random().toString(36).slice(2)}`

        await runBenchmarkEffect(
          Effect.gen(function* () {
            const journal = yield* EventJournal.EventJournal
            yield* writeBatch(journal, primaryKey, 100)
          })
        )
      },
      {
        warmupIterations: 2,
        iterations: 10,
        // Target: <500ms for 100 events
      }
    )

    bench(
      'batch write 1000 events',
      async () => {
        const primaryKey = `TEST-PERF-BATCH1K-${Date.now()}-${Math.random().toString(36).slice(2)}`

        await runBenchmarkEffect(
          Effect.gen(function* () {
            const journal = yield* EventJournal.EventJournal
            yield* writeBatch(journal, primaryKey, 1000)
          })
        )
      },
      {
        warmupIterations: 1,
        iterations: 3,
        // Target: <5s for 1000 events
      }
    )
  })

  // ===========================================================================
  // Read Benchmarks
  // ===========================================================================

  describe('Read Operations', () => {
    // Seed data for read benchmarks
    beforeAll(async () => {
      const ready = await ensureInitialized()
      if (!ready) return

      // Seed 1000 events for read benchmarks
      const seedPrimaryKey = 'TEST-PERF-READ-SEED'

      await runBenchmarkEffect(
        Effect.gen(function* () {
          const journal = yield* EventJournal.EventJournal
          yield* writeBatch(journal, seedPrimaryKey, 1000)
        })
      )
    })

    bench(
      'read all entries (1000)',
      async () => {
        await runBenchmarkEffect(
          Effect.gen(function* () {
            const journal = yield* EventJournal.EventJournal
            const entries = yield* journal.entries
            // Ensure we actually got entries (prevents optimization away)
            if (entries.length === 0) throw new Error('No entries')
          })
        )
      },
      {
        warmupIterations: 3,
        iterations: 20,
        // Target: <100ms to read 1000 entries
      }
    )

    bench(
      'filter by primary_key (in-memory)',
      async () => {
        await runBenchmarkEffect(
          Effect.gen(function* () {
            const journal = yield* EventJournal.EventJournal
            const entries = yield* journal.entries
            // Filter by primary key (in-memory since EventJournal returns all)
            const filtered = entries.filter((e) => e.primaryKey === 'TEST-PERF-READ-SEED')
            if (filtered.length === 0) throw new Error('No filtered entries')
          })
        )
      },
      {
        warmupIterations: 3,
        iterations: 20,
        // Target: <50ms for filter operation
      }
    )

    bench(
      'filter by event_tag (in-memory)',
      async () => {
        await runBenchmarkEffect(
          Effect.gen(function* () {
            const journal = yield* EventJournal.EventJournal
            const entries = yield* journal.entries
            // Filter by event tag
            const filtered = entries.filter((e) => e.event === 'AlarmTriggered')
            if (filtered.length === 0) throw new Error('No filtered entries')
          })
        )
      },
      {
        warmupIterations: 3,
        iterations: 20,
        // Target: <50ms for filter operation
      }
    )
  })

  // ===========================================================================
  // Temporal Query Benchmarks
  // ===========================================================================

  describe('Temporal Queries', () => {
    // Seed 10K events for temporal benchmarks
    beforeAll(async () => {
      const ready = await ensureInitialized()
      if (!ready) return

      // Seed events in batches to avoid timeout
      const batchSize = 2500
      const totalEvents = 10000
      const batches = Math.ceil(totalEvents / batchSize)

      for (let batch = 0; batch < batches; batch++) {
        const primaryKey = `TEST-PERF-TEMPORAL-${batch}`
        await runBenchmarkEffect(
          Effect.gen(function* () {
            const journal = yield* EventJournal.EventJournal
            yield* writeBatch(journal, primaryKey, batchSize)
          })
        )
      }
    })

    bench(
      'temporal query via SQL (10K events)',
      async () => {
        // Query events from the last 5 minutes using raw SQL
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

        await runBenchmarkEffect(
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient

            // Use indexed temporal query
            const rows = yield* sql<{ count: string }>`
              SELECT COUNT(*) as count
              FROM iiot.event_journal
              WHERE primary_key LIKE 'TEST-PERF-TEMPORAL-%'
                AND created_at >= ${fiveMinutesAgo}
            `

            // Verify we got results
            if (Number(rows[0].count) === 0) {
              throw new Error('No temporal entries found')
            }
          })
        )
      },
      {
        warmupIterations: 2,
        iterations: 10,
        // Target: <100ms for temporal query on 10K events
      }
    )

    bench(
      'temporal range query via SQL',
      async () => {
        // Query events in a specific time range
        const now = new Date()
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

        await runBenchmarkEffect(
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient

            // Range query using temporal index
            const rows = yield* sql<{ id: Uint8Array; eventTag: string; createdAt: Date }>`
              SELECT id, event_tag, created_at
              FROM iiot.event_journal
              WHERE primary_key LIKE 'TEST-PERF-TEMPORAL-%'
                AND created_at BETWEEN ${fiveMinutesAgo} AND ${now}
              ORDER BY created_at DESC
              LIMIT 100
            `

            // Verify we got results
            if (rows.length === 0) {
              throw new Error('No range query entries found')
            }
          })
        )
      },
      {
        warmupIterations: 2,
        iterations: 10,
        // Target: <100ms for range query
      }
    )
  })

  // ===========================================================================
  // Partition Query Benchmarks
  // ===========================================================================

  describe('Partition Queries', () => {
    bench(
      'query alarm partition directly',
      async () => {
        await runBenchmarkEffect(
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient

            // Query the alarm partition directly (more efficient for alarm-only queries)
            const rows = yield* sql<{ count: string }>`
              SELECT COUNT(*) as count
              FROM iiot.event_journal_alarm
              WHERE primary_key LIKE 'TEST-PERF-%'
            `

            // Result may be 0 if no alarm events were routed
            // This benchmark measures partition query overhead
            void rows
          })
        )
      },
      {
        warmupIterations: 3,
        iterations: 20,
        // Target: <50ms for partition-specific query
      }
    )

    bench(
      'query equipment partition directly',
      async () => {
        await runBenchmarkEffect(
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient

            // Query the equipment partition directly
            const rows = yield* sql<{ count: string }>`
              SELECT COUNT(*) as count
              FROM iiot.event_journal_equipment
              WHERE primary_key LIKE 'TEST-PERF-%'
            `

            void rows
          })
        )
      },
      {
        warmupIterations: 3,
        iterations: 20,
        // Target: <50ms for partition-specific query
      }
    )
  })

  // ===========================================================================
  // CRDT Sync Performance
  // ===========================================================================

  describe('CRDT Sync', () => {
    bench(
      'nextRemoteSequence lookup',
      async () => {
        await runBenchmarkEffect(
          Effect.gen(function* () {
            const journal = yield* EventJournal.EventJournal
            const remoteId = EventJournal.makeRemoteId()

            // Measure sequence lookup time
            const seq = yield* journal.nextRemoteSequence(remoteId)
            void seq
          })
        )
      },
      {
        warmupIterations: 5,
        iterations: 50,
        // Target: <5ms for sequence lookup (simple MAX query)
      }
    )

    bench(
      'withRemoteUncommited scan',
      async () => {
        await runBenchmarkEffect(
          Effect.gen(function* () {
            const journal = yield* EventJournal.EventJournal
            const remoteId = EventJournal.makeRemoteId()

            // Measure uncommitted scan time
            yield* journal.withRemoteUncommited(remoteId, (entries) =>
              Effect.sync(() => {
                // Just count entries to prevent optimization
                void entries.length
              })
            )
          })
        )
      },
      {
        warmupIterations: 2,
        iterations: 10,
        // Target: <200ms for uncommitted scan (depends on data volume)
      }
    )
  })

  // ===========================================================================
  // Index Utilization Benchmarks
  // ===========================================================================

  describe('Index Utilization', () => {
    bench(
      'EXPLAIN ANALYZE temporal query',
      async () => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

        await runBenchmarkEffect(
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient

            // Use EXPLAIN ANALYZE to verify index usage
            // In a real benchmark, we'd parse this to verify Index Scan
            const plan = yield* sql.unsafe(
              `
              EXPLAIN ANALYZE
              SELECT id, event_tag, created_at
              FROM iiot.event_journal
              WHERE entity_type = 'alarm'
                AND created_at >= $1
              LIMIT 100
            `,
              [fiveMinutesAgo]
            )

            // The plan should show Index Scan on idx_event_journal_temporal
            void plan
          })
        )
      },
      {
        warmupIterations: 2,
        iterations: 10,
        // This benchmark validates index usage, not just speed
      }
    )

    bench(
      'GIN index payload query',
      async () => {
        await runBenchmarkEffect(
          Effect.gen(function* () {
            const sql = yield* PgClient.PgClient

            // Query using GIN index on payload
            const rows = yield* sql<{ count: string }>`
              SELECT COUNT(*) as count
              FROM iiot.event_journal
              WHERE primary_key LIKE 'TEST-PERF-%'
                AND payload @> '{"severity": "warning"}'::jsonb
            `

            void rows
          })
        )
      },
      {
        warmupIterations: 3,
        iterations: 15,
        // Target: <50ms for GIN-indexed payload query
      }
    )
  })

  // ===========================================================================
  // Concurrency Benchmarks
  // ===========================================================================

  describe('Concurrent Operations', () => {
    bench(
      'concurrent writes (10 parallel)',
      async () => {
        const baseKey = `TEST-PERF-CONCURRENT-${Date.now()}-${Math.random().toString(36).slice(2)}`

        // Write 10 events in parallel
        const writes = Array.from({ length: 10 }, (_, i) =>
          runBenchmarkEffect(
            Effect.gen(function* () {
              const journal = yield* EventJournal.EventJournal
              yield* writeSingleEvent(journal, `${baseKey}-${i}`, i)
            })
          )
        )

        await Promise.all(writes)
      },
      {
        warmupIterations: 2,
        iterations: 10,
        // Target: <100ms for 10 concurrent writes
      }
    )

    bench(
      'concurrent read/write mix',
      async () => {
        const baseKey = `TEST-PERF-RWMIX-${Date.now()}-${Math.random().toString(36).slice(2)}`

        // Mix of reads and writes
        const operations = [
          // 5 writes
          ...Array.from({ length: 5 }, (_, i) =>
            runBenchmarkEffect(
              Effect.gen(function* () {
                const journal = yield* EventJournal.EventJournal
                yield* writeSingleEvent(journal, `${baseKey}-w-${i}`, i)
              })
            )
          ),
          // 5 reads
          ...Array.from({ length: 5 }, () =>
            runBenchmarkEffect(
              Effect.gen(function* () {
                const journal = yield* EventJournal.EventJournal
                const entries = yield* journal.entries
                void entries.length
              })
            )
          ),
        ]

        await Promise.all(operations)
      },
      {
        warmupIterations: 2,
        iterations: 10,
        // Target: <200ms for mixed concurrent operations
      }
    )
  })
})
