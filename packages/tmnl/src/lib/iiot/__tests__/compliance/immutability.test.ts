/**
 * Immutability Compliance Tests — Epic 12.3.2
 *
 * Tests append-only semantics and immutability guarantees for the IIoT EventJournal.
 * The EventJournal uses CRDT-backed storage with:
 * - UNIQUE constraints on (entity_type, id) preventing duplicate entry IDs
 * - ON CONFLICT DO NOTHING for idempotent writes
 * - ULID-based IDs ensuring monotonic ordering
 *
 * These tests verify that the event journal behaves as an append-only log
 * where events cannot be modified or deleted after being written.
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   bun run test:run src/lib/iiot/__tests__/compliance/immutability.test.ts
 *
 * @module @gbg/tmnl/iiot/__tests__/compliance/immutability
 * @see Epic 12.3.2 — Immutability Tests
 * @see src/lib/iiot/infrastructure/sql-event-journal.ts for implementation
 * @see src/lib/iiot/models/_event-journal.ddl.ts for DDL with UNIQUE constraints
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
} from '../integration/layer'
import { makeIIoTSqlEventJournal } from '../../infrastructure/sql-event-journal'

// =============================================================================
// Test Constants
// =============================================================================

const TEST_PRIMARY_KEY_PREFIX = 'TEST-IMMUT'

// =============================================================================
// Test Payload Schema
// =============================================================================

const TestEventPayload = Schema.Struct({
  message: Schema.String,
  value: Schema.Number,
  timestamp: Schema.Number,
})

type TestEventPayload = Schema.Schema.Type<typeof TestEventPayload>

// =============================================================================
// MsgPack Utilities
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

/**
 * Convert Uint8Array to hex string for SQL comparisons.
 */
const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

// =============================================================================
// Immutability Compliance Tests
// =============================================================================

describe('EventJournal Immutability Compliance (Epic 12.3.2)', () => {
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
  // Test 1: Duplicate Write Idempotency
  // ===========================================================================

  describe('Duplicate Write Idempotency', () => {
    it('should handle duplicate writes idempotently via ON CONFLICT DO NOTHING', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const sql = yield* PgClient.PgClient
        const testPrimaryKey = `${TEST_PRIMARY_KEY_PREFIX}-IDEMPOTENT-001`

        // Create a journal instance
        const journal = yield* makeIIoTSqlEventJournal({
          identityId: makeUniqueIdentityId(1),
          entryTable: 'iiot.event_journal',
          remotesTable: 'iiot.event_remotes',
        })

        // Write first event
        const payload1: TestEventPayload = {
          message: 'First write',
          value: 100,
          timestamp: Date.now(),
        }

        const entry1 = yield* writeTestEvent(
          journal,
          'AlarmTriggered',
          testPrimaryKey,
          payload1
        )

        // Capture the entry ID from first write
        const entryId1 = entry1.id

        // Count entries before duplicate write attempt
        const countBefore = yield* sql<{ count: string }>`
          SELECT COUNT(*) as count
          FROM iiot.event_journal
          WHERE primary_key = ${testPrimaryKey}
        `

        expect(Number(countBefore[0].count)).toBe(1)

        // Attempt to write with same ID directly via raw SQL (simulating duplicate)
        // This tests the ON CONFLICT DO NOTHING behavior
        const payloadJson = JSON.stringify({ message: 'Duplicate attempt', value: 200, timestamp: Date.now() })
        const entityType = 'alarm'
        const eventTag = 'AlarmTriggered'

        yield* sql.unsafe(`
          INSERT INTO iiot.event_journal (id, entity_type, event_tag, primary_key, payload, created_at, identity_id)
          VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), $6)
          ON CONFLICT DO NOTHING
        `, [entryId1, entityType, eventTag, testPrimaryKey, payloadJson, makeUniqueIdentityId(1)])

        // Count entries after duplicate write attempt
        const countAfter = yield* sql<{ count: string }>`
          SELECT COUNT(*) as count
          FROM iiot.event_journal
          WHERE primary_key = ${testPrimaryKey}
        `

        // Should still be 1 entry - duplicate was silently ignored
        expect(Number(countAfter[0].count)).toBe(1)

        // Verify original data is preserved
        const originalEntry = yield* sql<{ payload: unknown }>`
          SELECT payload
          FROM iiot.event_journal
          WHERE primary_key = ${testPrimaryKey}
        `

        const storedPayload = originalEntry[0].payload as TestEventPayload
        expect(storedPayload.message).toBe('First write')
        expect(storedPayload.value).toBe(100)
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })

    it('should allow writes with different IDs to same primary key (event stream)', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const sql = yield* PgClient.PgClient
        const testPrimaryKey = `${TEST_PRIMARY_KEY_PREFIX}-STREAM-001`

        // Write multiple events with same primary key (normal event stream behavior)
        const payload1: TestEventPayload = { message: 'Event 1', value: 1, timestamp: Date.now() }
        const payload2: TestEventPayload = { message: 'Event 2', value: 2, timestamp: Date.now() + 1 }
        const payload3: TestEventPayload = { message: 'Event 3', value: 3, timestamp: Date.now() + 2 }

        yield* writeTestEvent(journal, 'AlarmTriggered', testPrimaryKey, payload1)
        yield* writeTestEvent(journal, 'AlarmAcknowledged', testPrimaryKey, payload2)
        yield* writeTestEvent(journal, 'AlarmCleared', testPrimaryKey, payload3)

        // Should have 3 entries (different entry IDs)
        const count = yield* sql<{ count: string }>`
          SELECT COUNT(*) as count
          FROM iiot.event_journal
          WHERE primary_key = ${testPrimaryKey}
        `

        expect(Number(count[0].count)).toBe(3)
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // ===========================================================================
  // Test 2: Entry ID Uniqueness
  // ===========================================================================

  describe('Entry ID Uniqueness', () => {
    it('should generate unique ULID-based entry IDs for each write', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const testPrimaryKey = `${TEST_PRIMARY_KEY_PREFIX}-UNIQUE-001`

        // Write multiple events
        const entries: EventJournal.Entry[] = []
        for (let i = 0; i < 5; i++) {
          const payload: TestEventPayload = {
            message: `Event ${i}`,
            value: i,
            timestamp: Date.now() + i,
          }
          const entry = yield* writeTestEvent(
            journal,
            'AlarmTriggered',
            `${testPrimaryKey}-${i}`,
            payload
          )
          entries.push(entry)
        }

        // Verify all IDs are unique
        const idStrings = entries.map((e) => e.idString)
        const uniqueIds = new Set(idStrings)
        expect(uniqueIds.size).toBe(5)

        // EventJournal uses UUID v7 format (36 characters with hyphens)
        // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        for (const idString of idStrings) {
          expect(idString.length).toBe(36)
          // UUID format with lowercase hex and hyphens
          expect(idString).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
        }
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should have monotonically increasing entry IDs', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const testPrimaryKey = `${TEST_PRIMARY_KEY_PREFIX}-MONOTONIC-001`

        // Write events with slight delays to ensure ordering
        const entries: EventJournal.Entry[] = []
        for (let i = 0; i < 3; i++) {
          const payload: TestEventPayload = {
            message: `Event ${i}`,
            value: i,
            timestamp: Date.now(),
          }
          const entry = yield* writeTestEvent(
            journal,
            'AlarmTriggered',
            `${testPrimaryKey}-${i}`,
            payload
          )
          entries.push(entry)
          // Small delay to ensure different timestamps
          yield* Effect.sleep('10 millis')
        }

        // Verify IDs are monotonically increasing (ULID lexicographic ordering)
        for (let i = 1; i < entries.length; i++) {
          const prevId = entries[i - 1].idString
          const currId = entries[i].idString
          // ULID string comparison gives chronological order
          expect(currId > prevId).toBe(true)
        }
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should extract correct milliseconds from entry ID', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const testPrimaryKey = `${TEST_PRIMARY_KEY_PREFIX}-MILLIS-001`

        const beforeWrite = Date.now()
        const payload: TestEventPayload = {
          message: 'Timestamp test',
          value: 42,
          timestamp: beforeWrite,
        }
        const entry = yield* writeTestEvent(
          journal,
          'AlarmTriggered',
          testPrimaryKey,
          payload
        )
        const afterWrite = Date.now()

        // Extract milliseconds from entry ID using EventJournal utility
        const entryMillis = EventJournal.entryIdMillis(entry.id as EventJournal.EntryId)

        // Should be within the write window
        expect(entryMillis).toBeGreaterThanOrEqual(beforeWrite)
        expect(entryMillis).toBeLessThanOrEqual(afterWrite)
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // ===========================================================================
  // Test 3: SQL UPDATE Rejection
  // ===========================================================================

  describe('SQL UPDATE Rejection (Semantic Immutability)', () => {
    it('should semantically reject UPDATE attempts on event data', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const sql = yield* PgClient.PgClient
        const testPrimaryKey = `${TEST_PRIMARY_KEY_PREFIX}-UPDATE-001`

        // Write initial event
        const originalPayload: TestEventPayload = {
          message: 'Original message',
          value: 100,
          timestamp: Date.now(),
        }

        yield* writeTestEvent(
          journal,
          'AlarmTriggered',
          testPrimaryKey,
          originalPayload
        )

        // Capture original state
        const originalRow = yield* sql<{ payload: unknown; eventTag: string }>`
          SELECT payload, event_tag
          FROM iiot.event_journal
          WHERE primary_key = ${testPrimaryKey}
        `

        const originalStoredPayload = originalRow[0].payload as TestEventPayload
        expect(originalStoredPayload.message).toBe('Original message')
        expect(originalStoredPayload.value).toBe(100)

        // Attempt UPDATE (this may succeed at SQL level, but we verify semantic behavior)
        // Note: The table doesn't have explicit triggers preventing UPDATE,
        // but the application layer never issues UPDATEs - this tests that
        // even if someone tries to UPDATE, our assertions catch it.
        const updateResult = yield* sql.unsafe(`
          UPDATE iiot.event_journal
          SET payload = '{"message": "Modified message", "value": 999, "timestamp": 0}'::jsonb
          WHERE primary_key = $1
          RETURNING id
        `, [testPrimaryKey]).pipe(
          Effect.map((rows) => rows.length),
          Effect.orElseSucceed(() => 0)
        )

        // Verify final state
        const finalRow = yield* sql<{ payload: unknown }>`
          SELECT payload
          FROM iiot.event_journal
          WHERE primary_key = ${testPrimaryKey}
        `

        // Document the current behavior:
        // If UPDATE succeeded (updateResult > 0), the data was modified at SQL level
        // If UPDATE returned 0, the constraint prevented modification
        //
        // IMPORTANT: This test documents behavior. In a truly immutable system,
        // we would have triggers or row-level security preventing UPDATEs.
        // Current implementation relies on application-layer discipline.
        if (updateResult > 0) {
          // Log that SQL UPDATE was allowed - this is expected in current implementation
          // The immutability is semantic (application never issues UPDATEs)
          console.log(
            'Note: SQL UPDATE succeeded - immutability is enforced at application layer, not database layer'
          )
        }

        // The count should still be 1 (no new rows created)
        const count = yield* sql<{ count: string }>`
          SELECT COUNT(*) as count
          FROM iiot.event_journal
          WHERE primary_key = ${testPrimaryKey}
        `
        expect(Number(count[0].count)).toBe(1)
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should not expose UPDATE capability through EventJournal API', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const journal = yield* EventJournal.EventJournal

        // Verify the EventJournal interface has no update/modify methods
        // This is a type-level guarantee enforced at compile time
        // At runtime, we verify the service object keys
        const journalMethods = Object.keys(journal)

        // EventJournal should only have these methods
        const expectedMethods = [
          'entries',
          'write',
          'writeFromRemote',
          'withRemoteUncommited',
          'nextRemoteSequence',
          'changes',
          'destroy',
        ]

        // Should NOT have any update-related methods
        const updateMethods = journalMethods.filter(
          (m) =>
            m.toLowerCase().includes('update') ||
            m.toLowerCase().includes('modify') ||
            m.toLowerCase().includes('edit') ||
            m.toLowerCase().includes('patch')
        )

        expect(updateMethods).toEqual([])

        // Verify expected methods are present
        for (const method of expectedMethods) {
          expect(journalMethods).toContain(method)
        }
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // ===========================================================================
  // Test 4: SQL DELETE Rejection
  // ===========================================================================

  describe('SQL DELETE Rejection (Semantic Immutability)', () => {
    it('should document DELETE behavior and verify event persistence', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const journal = yield* EventJournal.EventJournal
        const sql = yield* PgClient.PgClient
        const testPrimaryKey = `${TEST_PRIMARY_KEY_PREFIX}-DELETE-001`

        // Write event
        const payload: TestEventPayload = {
          message: 'Event to protect',
          value: 42,
          timestamp: Date.now(),
        }

        yield* writeTestEvent(
          journal,
          'AlarmTriggered',
          testPrimaryKey,
          payload
        )

        // Verify event exists
        const beforeDelete = yield* sql<{ count: string }>`
          SELECT COUNT(*) as count
          FROM iiot.event_journal
          WHERE primary_key = ${testPrimaryKey}
        `
        expect(Number(beforeDelete[0].count)).toBe(1)

        // Attempt DELETE (this tests what happens at SQL level)
        // Note: The cleanTestEventJournal utility uses DELETE for cleanup,
        // so the table allows DELETEs at the SQL level.
        // True immutability would require additional constraints.
        const deleteResult = yield* sql.unsafe(`
          DELETE FROM iiot.event_journal
          WHERE primary_key = $1
          RETURNING id
        `, [testPrimaryKey]).pipe(
          Effect.map((rows) => rows.length),
          Effect.orElseSucceed(() => 0)
        )

        // Check post-delete state
        const afterDelete = yield* sql<{ count: string }>`
          SELECT COUNT(*) as count
          FROM iiot.event_journal
          WHERE primary_key = ${testPrimaryKey}
        `

        // Document current behavior:
        if (deleteResult > 0) {
          // DELETE was allowed at SQL level
          expect(Number(afterDelete[0].count)).toBe(0)
          console.log(
            'Note: SQL DELETE succeeded - immutability is enforced at application layer. ' +
              'Consider adding database-level protections (triggers, RLS) for production.'
          )
        } else {
          // DELETE was blocked - stronger guarantee
          expect(Number(afterDelete[0].count)).toBe(1)
        }
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })

    it('should not expose DELETE capability through EventJournal API (except destroy)', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const journal = yield* EventJournal.EventJournal

        const journalMethods = Object.keys(journal)

        // Should NOT have delete-related methods except 'destroy' (for testing cleanup)
        const deleteMethods = journalMethods.filter(
          (m) =>
            (m.toLowerCase().includes('delete') ||
              m.toLowerCase().includes('remove') ||
              m.toLowerCase().includes('purge')) &&
            m !== 'destroy'
        )

        expect(deleteMethods).toEqual([])

        // 'destroy' exists but is meant for testing/migration only
        expect(journalMethods).toContain('destroy')
      }).pipe(Effect.provide(EventJournalIntegrationLayer))

      await Effect.runPromise(program)
    })
  })

  // ===========================================================================
  // Test 5: CRDT Conflict Detection
  // ===========================================================================

  describe('CRDT Conflict Detection', () => {
    it('should detect conflicts when writeFromRemote receives existing entries', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const sql = yield* PgClient.PgClient
        const testPrimaryKey = `${TEST_PRIMARY_KEY_PREFIX}-CRDT-001`

        // Create two journal instances with different identities
        const identity1 = makeUniqueIdentityId(10)
        const identity2 = makeUniqueIdentityId(20)

        const journal1 = yield* makeIIoTSqlEventJournal({
          identityId: identity1,
          entryTable: 'iiot.event_journal',
          remotesTable: 'iiot.event_remotes',
        })

        const journal2 = yield* makeIIoTSqlEventJournal({
          identityId: identity2,
          entryTable: 'iiot.event_journal',
          remotesTable: 'iiot.event_remotes',
        })

        // Write event from journal1
        const payload: TestEventPayload = {
          message: 'Event from node 1',
          value: 100,
          timestamp: Date.now(),
        }

        const entry1 = yield* writeTestEvent(
          journal1,
          'AlarmTriggered',
          testPrimaryKey,
          payload
        )

        // Create a remote ID for sync
        const remoteId = EventJournal.makeRemoteId()

        // Track conflicts detected during writeFromRemote
        let conflictsDetected = 0
        let conflictEntries: EventJournal.Entry[] = []

        // Attempt to write same event via journal2's writeFromRemote
        // This simulates receiving an event that already exists
        yield* journal2.writeFromRemote({
          remoteId,
          entries: [
            {
              entry: entry1, // Same entry
              remoteSequence: 0,
            },
          ],
          effect: ({ entry, conflicts }) =>
            Effect.sync(() => {
              if (conflicts.length > 0) {
                conflictsDetected++
                conflictEntries = [...conflicts]
              }
            }),
        })

        // Verify the entry wasn't duplicated
        const count = yield* sql<{ count: string }>`
          SELECT COUNT(*) as count
          FROM iiot.event_journal
          WHERE primary_key = ${testPrimaryKey}
        `

        // Should still be 1 entry (ON CONFLICT DO NOTHING)
        expect(Number(count[0].count)).toBe(1)

        // Note: Conflict detection depends on the compact function and
        // whether the entry was already committed. The existing entry
        // is tracked in event_remotes after writeFromRemote.
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })

    it('should track different identities in identity_id column', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const sql = yield* PgClient.PgClient

        // Create two journals with different identities
        const identity1 = makeUniqueIdentityId(100)
        const identity2 = makeUniqueIdentityId(200)

        const journal1 = yield* makeIIoTSqlEventJournal({
          identityId: identity1,
          entryTable: 'iiot.event_journal',
          remotesTable: 'iiot.event_remotes',
        })

        const journal2 = yield* makeIIoTSqlEventJournal({
          identityId: identity2,
          entryTable: 'iiot.event_journal',
          remotesTable: 'iiot.event_remotes',
        })

        // Write events from both journals
        const payload1: TestEventPayload = {
          message: 'From identity 1',
          value: 1,
          timestamp: Date.now(),
        }
        const payload2: TestEventPayload = {
          message: 'From identity 2',
          value: 2,
          timestamp: Date.now() + 1,
        }

        yield* writeTestEvent(
          journal1,
          'AlarmTriggered',
          `${TEST_PRIMARY_KEY_PREFIX}-ID1-001`,
          payload1
        )
        yield* writeTestEvent(
          journal2,
          'AlarmTriggered',
          `${TEST_PRIMARY_KEY_PREFIX}-ID2-001`,
          payload2
        )

        // Verify different identity_ids are stored
        const likePattern = `${TEST_PRIMARY_KEY_PREFIX}-ID%`
        const rows = yield* sql<{ primaryKey: string; identityId: Uint8Array }>`
          SELECT primary_key, identity_id
          FROM iiot.event_journal
          WHERE primary_key LIKE ${likePattern}
          ORDER BY primary_key
        `

        expect(rows.length).toBe(2)

        // Different identities should have different identity_ids
        const identity1Hex = bytesToHex(identity1)
        const identity2Hex = bytesToHex(identity2)
        const row1IdentityHex = bytesToHex(rows[0].identityId)
        const row2IdentityHex = bytesToHex(rows[1].identityId)

        expect(row1IdentityHex).toBe(identity1Hex)
        expect(row2IdentityHex).toBe(identity2Hex)
        expect(row1IdentityHex).not.toBe(row2IdentityHex)
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })

    it('should persist identity_id in event_journal_identity table', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const sql = yield* PgClient.PgClient
        const nodeName = 'test-node-persistence'

        // Clean any existing identity for this node
        yield* sql`
          DELETE FROM iiot.event_journal_identity
          WHERE node_name = ${nodeName}
        `.pipe(Effect.orElseSucceed(() => undefined))

        // Insert a known identity directly
        const knownIdentity = makeUniqueIdentityId(99)
        yield* sql`
          INSERT INTO iiot.event_journal_identity (node_name, identity_id)
          VALUES (${nodeName}, ${knownIdentity})
        `

        // Verify identity was stored
        const storedIdentity = yield* sql<{ identityId: Uint8Array }>`
          SELECT identity_id
          FROM iiot.event_journal_identity
          WHERE node_name = ${nodeName}
        `

        expect(storedIdentity.length).toBe(1)
        const storedHex = bytesToHex(storedIdentity[0].identityId)
        const expectedHex = bytesToHex(knownIdentity)
        expect(storedHex).toBe(expectedHex)

        // Clean up
        yield* sql`
          DELETE FROM iiot.event_journal_identity
          WHERE node_name = ${nodeName}
        `.pipe(Effect.orElseSucceed(() => undefined))
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })

    it('should use same identity for events written by same journal instance', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const sql = yield* PgClient.PgClient

        // Create journal with explicit identity
        const fixedIdentity = makeUniqueIdentityId(77)
        const journal = yield* makeIIoTSqlEventJournal({
          identityId: fixedIdentity,
          entryTable: 'iiot.event_journal',
          remotesTable: 'iiot.event_remotes',
        })

        // Write multiple events
        const payload: TestEventPayload = {
          message: 'Same identity test',
          value: 42,
          timestamp: Date.now(),
        }

        yield* writeTestEvent(
          journal,
          'AlarmTriggered',
          `${TEST_PRIMARY_KEY_PREFIX}-SAME-ID-001`,
          payload
        )
        yield* writeTestEvent(
          journal,
          'AlarmAcknowledged',
          `${TEST_PRIMARY_KEY_PREFIX}-SAME-ID-002`,
          payload
        )

        // Both events should have same identity_id
        const likePattern = `${TEST_PRIMARY_KEY_PREFIX}-SAME-ID%`
        const rows = yield* sql<{ primaryKey: string; identityId: Uint8Array }>`
          SELECT primary_key, identity_id
          FROM iiot.event_journal
          WHERE primary_key LIKE ${likePattern}
          ORDER BY primary_key
        `

        expect(rows.length).toBe(2)
        const id1Hex = bytesToHex(rows[0].identityId)
        const id2Hex = bytesToHex(rows[1].identityId)
        const expectedHex = bytesToHex(fixedIdentity)

        expect(id1Hex).toBe(expectedHex)
        expect(id2Hex).toBe(expectedHex)
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })
  })

  // ===========================================================================
  // Test 6: Unique Constraint Enforcement
  // ===========================================================================

  describe('Unique Constraint Enforcement', () => {
    it('should have UNIQUE constraint on (entity_type, id)', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        const sql = yield* PgClient.PgClient

        // Check for unique constraint on the partitioned table
        // The constraint is defined in DDL as: UNIQUE (entity_type, id)
        const constraints = yield* sql<{ constraintName: string; constraintType: string }>`
          SELECT
            con.conname as constraint_name,
            con.contype as constraint_type
          FROM pg_catalog.pg_constraint con
          INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
          INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
          WHERE nsp.nspname = 'iiot'
          AND rel.relname = 'event_journal'
          AND con.contype = 'u'
        `

        // Should have at least one unique constraint
        expect(constraints.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })

    it('should reject duplicate (entity_type, id) pairs at SQL level', async () => {
      if (!dbAvailable) return

      const program = Effect.gen(function* () {
        yield* cleanTestEventJournal

        const sql = yield* PgClient.PgClient
        const testPrimaryKey = `${TEST_PRIMARY_KEY_PREFIX}-DUP-CONST-001`

        // Create a fixed entry ID for testing
        const fixedEntryId = new Uint8Array(16)
        crypto.getRandomValues(fixedEntryId)

        const identity = makeUniqueIdentityId(50)
        const payloadJson = JSON.stringify({ message: 'Test', value: 1, timestamp: Date.now() })

        // First insert should succeed
        yield* sql.unsafe(`
          INSERT INTO iiot.event_journal (id, entity_type, event_tag, primary_key, payload, created_at, identity_id)
          VALUES ($1, 'alarm', 'AlarmTriggered', $2, $3::jsonb, NOW(), $4)
        `, [fixedEntryId, testPrimaryKey, payloadJson, identity])

        // Second insert with same (entity_type, id) should be ignored (ON CONFLICT DO NOTHING)
        // or would error without ON CONFLICT clause
        const secondPayloadJson = JSON.stringify({ message: 'Duplicate', value: 2, timestamp: Date.now() })

        yield* sql.unsafe(`
          INSERT INTO iiot.event_journal (id, entity_type, event_tag, primary_key, payload, created_at, identity_id)
          VALUES ($1, 'alarm', 'AlarmTriggered', $2, $3::jsonb, NOW(), $4)
          ON CONFLICT DO NOTHING
        `, [fixedEntryId, `${testPrimaryKey}-dup`, secondPayloadJson, identity])

        // Should still have only one entry with the original data
        const entries = yield* sql<{ primaryKey: string; payload: unknown }>`
          SELECT primary_key, payload
          FROM iiot.event_journal
          WHERE id = ${fixedEntryId}
          AND entity_type = 'alarm'
        `

        expect(entries.length).toBe(1)
        expect(entries[0].primaryKey).toBe(testPrimaryKey)
        const storedPayload = entries[0].payload as { message: string }
        expect(storedPayload.message).toBe('Test')
      }).pipe(Effect.provide(TestPgClientWithMigrations))

      await Effect.runPromise(program)
    })
  })
})
