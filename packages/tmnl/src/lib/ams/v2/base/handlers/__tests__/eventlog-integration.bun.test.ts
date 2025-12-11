/**
 * EventLog Integration Tests (Full CQRS Loop)
 *
 * Tests the complete flow:
 * Command → Event emitted → Event persisted → Event can be read
 *
 * Uses SqlEventJournal for persistence.
 *
 * @module @gbg/tmnl/ams/v2/base/handlers/__tests__/eventlog-integration.bun.test
 */

import { describe, test, expect } from 'bun:test'
import { DateTime, Effect, Layer, Option, Scope, Stream } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { AssetState } from '../../services/asset-state'
import { AssetStateSQLLayer } from '../../services/asset-state-sql'
import { AllRepositoriesLive, SiteRepository } from '../../services/repositories'
import { SiteModel } from '../../repositories/asset'
import { SqliteTestLayer } from '../../repositories/sqlite-layer'
import { SqlEventJournalLayer, EventLogStackLayer } from '../sql-event-journal'
import { AssetEventHandlers } from '../event-handlers'
import { AmsEventLogSchema } from '../../events/schema'
import {
  AssetId,
  SiteId,
  IdentityId,
} from '../../../core/schemas/identifiers'
import { AssetStatus } from '../../schemas/asset'

// ─────────────────────────────────────────────────────────────────────────────
// Test Layer Composition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full CQRS Stack Layer:
 * - AssetStateSQLLayer (state)
 * - AllRepositoriesLive (persistence)
 * - EventLogStackLayer (event sourcing)
 * - AssetEventHandlers (event processors)
 * - SqliteTestLayer (database)
 *
 * Layer composition order matters:
 * 1. SqliteTestLayer (base - provides SqlClient)
 * 2. AllRepositoriesLive (needs SqlClient)
 * 3. SqlEventJournalLayer (needs SqlClient)
 * 4. EventLogLayer (needs EventJournal)
 * 5. AssetStateSQLLayer (needs repos)
 * 6. AssetEventHandlers (needs AssetState + EventLog)
 */
const RepositoriesLayer = AllRepositoriesLive.pipe(Layer.provide(SqliteTestLayer))

// EventLogStackLayer provides EventLog, but we also need to expose EventJournal
// for tests that want to inspect the journal directly
const EventLogWithJournalLayer = Layer.mergeAll(
  EventLogStackLayer,
  SqlEventJournalLayer
).pipe(Layer.provide(SqliteTestLayer))

// AssetState layer with repos
const AssetStateLayer = AssetStateSQLLayer.pipe(
  Layer.provide(RepositoriesLayer),
  Layer.provide(SqliteTestLayer)
)

// Event handlers need AssetState and EventLog
const EventHandlersLayer = AssetEventHandlers.pipe(
  Layer.provide(AssetStateLayer),
  Layer.provide(EventLogWithJournalLayer)
)

const TestLayer = Layer.mergeAll(
  AssetStateLayer,
  EventLogWithJournalLayer,
  EventHandlersLayer,
  RepositoriesLayer
)

/**
 * Helper to run Effect in test context
 * Uses Effect.scoped to provide Scope for stream operations
 */
const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.scoped,
      Effect.provide(TestLayer)
    )
  )

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const testSiteId = 'site-cqrs-test' as SiteId
const testUser = 'test-user' as IdentityId

/**
 * Create test site prerequisite
 */
const createTestSite = Effect.gen(function* () {
  const siteRepo = yield* SiteRepository
  yield* siteRepo.insert(
    SiteModel.insert.make({
      id: testSiteId,
      bfoClass: 'site',
      name: 'CQRS Test Site',
      geoFrameJson: Option.none(),
    })
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// EventJournal Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('SqlEventJournal Integration', () => {
  test('EventJournal is provided by SqlEventJournalLayer', async () => {
    await runTest(
      Effect.gen(function* () {
        // Just verify we can yield the EventJournal service
        const journal = yield* EventJournal.EventJournal
        expect(journal).toBeDefined()
        expect(journal.write).toBeDefined()
        expect(journal.entries).toBeDefined()
      })
    )
  })

  test('EventLog is provided by EventLogStackLayer', async () => {
    await runTest(
      Effect.gen(function* () {
        // Verify EventLog service is available
        const eventLog = yield* EventLog.EventLog
        expect(eventLog).toBeDefined()
      })
    )
  })

  test('EventLog.makeClient creates typed client', async () => {
    await runTest(
      Effect.gen(function* () {
        // Create a typed client for AMS events
        const writeEvent = yield* EventLog.makeClient(AmsEventLogSchema)
        expect(writeEvent).toBeDefined()
        expect(typeof writeEvent).toBe('function')
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Full CQRS Loop Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Full CQRS Loop', () => {
  test('event written via EventLog can be read from journal', async () => {
    await runTest(
      Effect.gen(function* () {
        const writeEvent = yield* EventLog.makeClient(AmsEventLogSchema)
        const journal = yield* EventJournal.EventJournal

        // Write an event
        yield* writeEvent('AssetCreated', {
          assetId: 'asset-cqrs-001' as AssetId,
          siteId: testSiteId,
          kind: 'EQUIPMENT' as never,
          label: 'CQRS Test Asset' as never,
          status: 'available' as AssetStatus,
          createdBy: testUser,
          createdAt: DateTime.unsafeNow() as never,
        })

        // Read all entries from journal
        const entries = yield* journal.entries
        expect(entries.length).toBeGreaterThanOrEqual(1)

        // Find our event
        const ourEvent = entries.find(
          (e) => e.event === 'AssetCreated' && e.primaryKey === 'asset-cqrs-001'
        )
        expect(ourEvent).toBeDefined()
        expect(ourEvent?.event).toBe('AssetCreated')
      })
    )
  })

  test('multiple events written accumulate in journal', async () => {
    await runTest(
      Effect.gen(function* () {
        const writeEvent = yield* EventLog.makeClient(AmsEventLogSchema)
        const journal = yield* EventJournal.EventJournal

        // Write multiple events
        yield* writeEvent('AssetCreated', {
          assetId: 'asset-multi-001' as AssetId,
          siteId: testSiteId,
          kind: 'EQUIPMENT' as never,
          label: 'Multi Test Asset 1' as never,
          status: 'available' as AssetStatus,
          createdBy: testUser,
          createdAt: DateTime.unsafeNow() as never,
        })

        yield* writeEvent('AssetCreated', {
          assetId: 'asset-multi-002' as AssetId,
          siteId: testSiteId,
          kind: 'EQUIPMENT' as never,
          label: 'Multi Test Asset 2' as never,
          status: 'available' as AssetStatus,
          createdBy: testUser,
          createdAt: DateTime.unsafeNow() as never,
        })

        // Read all entries from journal
        const entries = yield* journal.entries

        // Find both events
        const event1 = entries.find((e) => e.primaryKey === 'asset-multi-001')
        const event2 = entries.find((e) => e.primaryKey === 'asset-multi-002')

        expect(event1).toBeDefined()
        expect(event2).toBeDefined()
        expect(event1?.event).toBe('AssetCreated')
        expect(event2?.event).toBe('AssetCreated')
      })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// State + EventLog Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('AssetState + EventLog Integration', () => {
  test('AssetState.create persists to SQL while EventLog is available', async () => {
    await runTest(
      Effect.gen(function* () {
        yield* createTestSite
        const state = yield* AssetState

        // Create asset via state (state writes to SQL)
        const asset = yield* state.create({
          siteId: testSiteId,
          kind: 'EQUIPMENT' as never,
          label: 'State+EventLog Test' as never,
          status: 'available' as AssetStatus,
          createdBy: testUser,
        })

        expect(asset.id).toMatch(/^asset-/)
        expect(asset.label).toBe('State+EventLog Test')

        // Verify asset is persisted (findById works)
        const found = yield* state.findById(asset.id)
        expect(found.id).toBe(asset.id)
      })
    )
  })
})
