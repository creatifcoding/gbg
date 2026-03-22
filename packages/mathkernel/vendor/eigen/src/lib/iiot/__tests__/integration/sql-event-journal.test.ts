/**
 * SQL Event Journal Integration Tests
 *
 * Tests the SQL-backed EventJournal implementation with PostgreSQL.
 * Validates partitioned storage, CRDT sync, and entity type routing.
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *   bun src/lib/iiot/migrations/run-migrations.ts
 *
 * Run:
 *   bun run test:run src/lib/iiot/__tests__/integration/sql-event-journal.test.ts
 *
 * @module @gbg/tmnl/iiot/__tests__/integration/sql-event-journal
 * @see @effect/experimental/EventJournal for interface
 * @see src/lib/iiot/infrastructure/sql-event-journal.ts for implementation
 * @see src/lib/iiot/models/_event-journal.ddl.ts for DDL
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Effect, Schema } from 'effect'
import { PgClient } from '@effect/sql-pg'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  EventJournalIntegrationLayer,
  TestPgClientWithMigrations,
  cleanTestEventJournal,
  isDatabaseAvailable,
} from './layer'
import { makeIIoTSqlEventJournal } from '../../infrastructure/sql-event-journal'

// =============================================================================
// Test Constants
// =============================================================================

const TEST_PRIMARY_KEY_ALARM = 'TEST-ALARM-001'
const TEST_PRIMARY_KEY_WORK_ORDER = 'TEST-WO-001'
const TEST_PRIMARY_KEY_EQUIPMENT = 'TEST-EQUIP-001'

// =============================================================================
// Test Payload Schema
// =============================================================================

const TestEventPayload = Schema.Struct({
  message: Schema.String,
  value: Schema.Number,
  timestamp: Schema.Number,
})

type TestEventPayload = Schema.Schema.Type<typeof TestEventPayload>

// MsgPack encoding for EventJournal payloads
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

const decodePayload = (bytes: Uint8Array): TestEventPayload => {
  const mp = getMsgPackr()
  return mp.decode(bytes) as TestEventPayload
}

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Write an event to the journal and return the entry.
 */
const writeTestEvent = (
  journal: typeof EventJournal.EventJournal.Service,
  eventTag: string,
  primaryKey: string,
  payload: TestEventPayload
): Effect.Effect<EventJournal.Entry, EventJournal.EventJournalError> =>
  Effect.gen(function* () {
    let result: EventJournal.Entry | null = null
    yield* journal.write({
      event: eventTag,
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
 * Generate a unique test identity for CRDT testing.
 */
const makeUniqueIdentityId = (suffix: number): Uint8Array => {
  const bytes = new Uint8Array(16)
  bytes[15] = suffix
  return bytes
}

// =============================================================================
// SQL Event Journal Integration Tests
// =============================================================================

describe('SQL EventJournal Integration (PostgreSQL)', () => {
  let dbAvailable = false

  beforeAll(async () => {
    try {
      const check = isDatabaseAvailable.pipe(
        Effect.provide(EventJournalIntegrationLayer)
      )
      dbAvailable = await Effect.runPromise(check)
    } catch {
      dbAvailable = false
    }
    if (!dbAvailable) {
      console.log(
        'SKIPPING: IIoT database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
    }
  })

  afterAll(async () => {
    if (!dbAvailable) return

    // Clean up test data
    const cleanup = cleanTestEventJournal.pipe(
      Effect.provide(EventJournalIntegrationLayer)
    )
    await Effect.runPromise(cleanup).catch(() => {
      // Ignore cleanup errors
    })
  })

  // ===========================================================================
  // Basic Write/Read Tests
  // ===========================================================================

  describe('Basic Operations', () => {
    it('should write and read back an alarm event', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        // Clean first
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal

        // Write event
        const payload: TestEventPayload = {
          message: 'Test alarm triggered',
          value: 42,
          timestamp: Date.now(),
        }

        const entry = yield* writeTestEvent(
          journal,
          'AlarmTriggered',
          TEST_PRIMARY_KEY_ALARM,
          payload
        )

        expect(entry.event).toBe('AlarmTriggered')
        expect(entry.primaryKey).toBe(TEST_PRIMARY_KEY_ALARM)

        // Read back
        const entries = yield* journal.entries
        const found = entries.find((e) => e.primaryKey === TEST_PRIMARY_KEY_ALARM)
        expect(found).toBeDefined()
        expect(found?.event).toBe('AlarmTriggered')

        // Decode payload
        const decoded = decodePayload(found!.payload)
        expect(decoded.message).toBe('Test alarm triggered')
        expect(decoded.value).toBe(42)
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should write work order events to work_order partition', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const sql = yield* PgClient.PgClient

        // Write work order event
        const payload: TestEventPayload = {
          message: 'Work order created',
          value: 1,
          timestamp: Date.now(),
        }

        yield* writeTestEvent(
          journal,
          'WorkOrderCreated',
          TEST_PRIMARY_KEY_WORK_ORDER,
          payload
        )

        // Verify it's in the work_order partition
        const rows = yield* sql<{ entityType: string; primaryKey: string }>`
          SELECT entity_type, primary_key
          FROM iiot.event_journal_work_order
          WHERE primary_key = ${TEST_PRIMARY_KEY_WORK_ORDER}
        `

        expect(rows.length).toBe(1)
        expect(rows[0].entityType).toBe('work_order')
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should write equipment events to equipment partition', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const sql = yield* PgClient.PgClient

        // Write equipment state event
        const payload: TestEventPayload = {
          message: 'Equipment state changed',
          value: 2,
          timestamp: Date.now(),
        }

        yield* writeTestEvent(
          journal,
          'EquipmentStateChanged',
          TEST_PRIMARY_KEY_EQUIPMENT,
          payload
        )

        // Verify it's in the equipment partition
        const rows = yield* sql<{ entityType: string; primaryKey: string }>`
          SELECT entity_type, primary_key
          FROM iiot.event_journal_equipment
          WHERE primary_key = ${TEST_PRIMARY_KEY_EQUIPMENT}
        `

        expect(rows.length).toBe(1)
        expect(rows[0].entityType).toBe('equipment')
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // ===========================================================================
  // Filter Tests
  // ===========================================================================

  describe('Filtering', () => {
    it('should filter entries by primary key', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal

        // Write multiple events with different primary keys
        const payload1: TestEventPayload = { message: 'Event 1', value: 1, timestamp: Date.now() }
        const payload2: TestEventPayload = { message: 'Event 2', value: 2, timestamp: Date.now() }
        const payload3: TestEventPayload = { message: 'Event 3', value: 3, timestamp: Date.now() }

        yield* writeTestEvent(journal, 'AlarmTriggered', 'TEST-FILTER-001', payload1)
        yield* writeTestEvent(journal, 'AlarmAcknowledged', 'TEST-FILTER-001', payload2)
        yield* writeTestEvent(journal, 'AlarmTriggered', 'TEST-FILTER-002', payload3)

        // Read all entries
        const allEntries = yield* journal.entries

        // Filter by primary key (in-memory since EventJournal.entries returns all)
        const filtered = allEntries.filter((e) => e.primaryKey === 'TEST-FILTER-001')
        expect(filtered.length).toBe(2)
        expect(filtered.every((e) => e.primaryKey === 'TEST-FILTER-001')).toBe(true)

        // Verify both events for TEST-FILTER-001 are present
        const eventTags = filtered.map((e) => e.event).sort()
        expect(eventTags).toEqual(['AlarmAcknowledged', 'AlarmTriggered'])
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should filter entries by event tag', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal

        // Write multiple event types
        const payload1: TestEventPayload = { message: 'Alarm 1', value: 1, timestamp: Date.now() }
        const payload2: TestEventPayload = { message: 'Alarm 2', value: 2, timestamp: Date.now() }
        const payload3: TestEventPayload = { message: 'WO 1', value: 3, timestamp: Date.now() }

        yield* writeTestEvent(journal, 'AlarmTriggered', 'TEST-TAGGED-001', payload1)
        yield* writeTestEvent(journal, 'AlarmTriggered', 'TEST-TAGGED-002', payload2)
        yield* writeTestEvent(journal, 'WorkOrderCreated', 'TEST-TAGGED-003', payload3)

        // Read and filter
        const allEntries = yield* journal.entries
        const alarmEvents = allEntries.filter(
          (e) => e.event === 'AlarmTriggered' && e.primaryKey.startsWith('TEST-TAGGED')
        )
        expect(alarmEvents.length).toBe(2)
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // ===========================================================================
  // CRDT Sync Tests
  // ===========================================================================

  describe('CRDT Sync', () => {
    it('should track uncommitted entries for remote sync', async () => {
      if (!dbAvailable) return

      // Create two journal instances with different identities
      // IMPORTANT: Both must share the same PgClient to avoid pool closure issues
      const identity1 = makeUniqueIdentityId(100)
      const identity2 = makeUniqueIdentityId(200)

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        // Create journal instances that share the same PgClient from context
        const journal1 = yield* makeIIoTSqlEventJournal({
          identityId: identity1,
          entryTable: 'iiot.event_journal',
          remotesTable: 'iiot.event_remotes',
        })

        const payload: TestEventPayload = {
          message: 'CRDT test event',
          value: 999,
          timestamp: Date.now(),
        }

        yield* journal1.write({
          event: 'AlarmTriggered',
          primaryKey: 'TEST-CRDT-001',
          payload: encodePayload(payload),
          effect: () => Effect.void,
        })

        // Create a remote ID
        const remoteId = EventJournal.makeRemoteId()

        // Create journal2 with different identity, same PgClient
        const journal2 = yield* makeIIoTSqlEventJournal({
          identityId: identity2,
          entryTable: 'iiot.event_journal',
          remotesTable: 'iiot.event_remotes',
        })

        let uncommittedCount = 0
        yield* journal2.withRemoteUncommited(
          remoteId,
          (entries: ReadonlyArray<EventJournal.Entry>) =>
            Effect.sync(() => {
              uncommittedCount = entries.filter((e) => e.primaryKey === 'TEST-CRDT-001').length
            })
        )

        // Should see the entry as uncommitted for this remote
        expect(uncommittedCount).toBeGreaterThanOrEqual(1)
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })

    it('should track next remote sequence', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const remoteId = EventJournal.makeRemoteId()

        // Initial sequence should be 0
        const initialSeq = yield* journal.nextRemoteSequence(remoteId)
        expect(initialSeq).toBe(0)
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // ===========================================================================
  // Partition Routing Tests
  // ===========================================================================

  describe('Partition Routing', () => {
    it('should route alarm events to alarm partition', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const sql = yield* PgClient.PgClient

        const payload: TestEventPayload = { message: 'Alarm', value: 1, timestamp: Date.now() }

        // Test various alarm event names
        yield* writeTestEvent(journal, 'AlarmTriggered', 'TEST-ROUTE-ALARM-1', payload)
        yield* writeTestEvent(journal, 'AlarmAcknowledged', 'TEST-ROUTE-ALARM-2', payload)
        yield* writeTestEvent(journal, 'AlarmCleared', 'TEST-ROUTE-ALARM-3', payload)

        // Verify all in alarm partition
        const rows = yield* sql<{ count: string }>`
          SELECT COUNT(*) as count
          FROM iiot.event_journal_alarm
          WHERE primary_key LIKE 'TEST-ROUTE-ALARM%'
        `

        expect(Number(rows[0].count)).toBe(3)
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should route equipment/machine events to equipment partition', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const sql = yield* PgClient.PgClient

        const payload: TestEventPayload = { message: 'Equipment', value: 2, timestamp: Date.now() }

        // Test equipment and machine event names (both should route to equipment)
        yield* writeTestEvent(journal, 'EquipmentStateChanged', 'TEST-ROUTE-EQUIP-1', payload)
        yield* writeTestEvent(journal, 'MachineStarted', 'TEST-ROUTE-EQUIP-2', payload)
        yield* writeTestEvent(journal, 'MachineIdle', 'TEST-ROUTE-EQUIP-3', payload)

        // Verify all in equipment partition
        const rows = yield* sql<{ count: string }>`
          SELECT COUNT(*) as count
          FROM iiot.event_journal_equipment
          WHERE primary_key LIKE 'TEST-ROUTE-EQUIP%'
        `

        expect(Number(rows[0].count)).toBe(3)
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should route unknown events to equipment partition (default)', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const sql = yield* PgClient.PgClient

        const payload: TestEventPayload = { message: 'Unknown', value: 3, timestamp: Date.now() }

        // Unknown event type should default to equipment
        yield* writeTestEvent(journal, 'SomeUnknownEventType', 'TEST-ROUTE-UNKNOWN-1', payload)

        // Verify in equipment partition (default)
        const rows = yield* sql<{ count: string }>`
          SELECT COUNT(*) as count
          FROM iiot.event_journal_equipment
          WHERE primary_key = 'TEST-ROUTE-UNKNOWN-1'
        `

        expect(Number(rows[0].count)).toBe(1)
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // ===========================================================================
  // Index Tests
  // ===========================================================================

  describe('Index Usage', () => {
    it('should have temporal index for efficient queries', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const sql = yield* PgClient.PgClient

        // Verify index exists
        const indexes = yield* sql<{ indexname: string }>`
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'iiot'
          AND tablename = 'event_journal'
          AND indexname = 'idx_event_journal_temporal'
        `

        expect(indexes.length).toBe(1)
        expect(indexes[0].indexname).toBe('idx_event_journal_temporal')
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })

    it('should have GIN index for payload queries', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const sql = yield* PgClient.PgClient

        // Verify GIN index exists
        const indexes = yield* sql<{ indexname: string }>`
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'iiot'
          AND tablename = 'event_journal'
          AND indexname = 'idx_event_journal_payload_gin'
        `

        expect(indexes.length).toBe(1)
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })
  })

  // ===========================================================================
  // Table Structure Tests
  // ===========================================================================

  describe('Table Structure', () => {
    it('should have all required partitions', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const sql = yield* PgClient.PgClient

        // Check for all expected partitions
        const partitions = yield* sql<{ tablename: string }>`
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'iiot'
          AND tablename LIKE 'event_journal_%'
          ORDER BY tablename
        `

        const partitionNames = partitions.map((p) => p.tablename)

        expect(partitionNames).toContain('event_journal_alarm')
        expect(partitionNames).toContain('event_journal_work_order')
        expect(partitionNames).toContain('event_journal_equipment')
        expect(partitionNames).toContain('event_journal_task')
        expect(partitionNames).toContain('event_journal_approval')
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })

    it('should have remotes tables', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const sql = yield* PgClient.PgClient

        // Check for remotes tables
        const tables = yield* sql<{ tablename: string }>`
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'iiot'
          AND tablename IN ('event_remotes', 'event_remotes_sync')
          ORDER BY tablename
        `

        const tableNames = tables.map((t) => t.tablename)

        expect(tableNames).toContain('event_remotes')
        expect(tableNames).toContain('event_remotes_sync')
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })
  })
})
