/**
 * SQL-Backed EventJournal Layer
 *
 * Uses @effect/sql SqlEventJournal for event persistence.
 * Wire this into entity handlers for production EventLog.
 *
 * Usage:
 * ```ts
 * const ProductionLayer = AssetEntityHandlers.pipe(
 *   Layer.provide(AssetStateSQLLayer),
 *   Layer.provide(AllRepositoriesLive),
 *   Layer.provide(EventLogStackLayer),
 *   Layer.provide(SqliteTestLayer), // or PostgresLayer
 * )
 * ```
 *
 * @module @gbg/tmnl/ams/v2/base/handlers/sql-event-journal
 */

import { Layer } from 'effect'
import * as SqlEventJournal from '@effect/sql/SqlEventJournal'
import * as EventLog from '@effect/experimental/EventLog'
import { AmsEventLogSchema } from '../events/schema'

// ─────────────────────────────────────────────────────────────────────────────
// SqlEventJournal Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SQL-backed EventJournal Layer
 *
 * Creates tables for event storage:
 * - ams_event_journal: event entries
 * - ams_event_remotes: remote sync tracking
 *
 * Requires: SqlClient.SqlClient
 */
export const SqlEventJournalLayer = SqlEventJournal.layer({
  eventLogTable: 'ams_event_journal',
  remotesTable: 'ams_event_remotes',
})

/**
 * Identity Layer
 *
 * Provides a random cryptographic identity for EventLog.
 * In production, this should be persisted (via KeyValueStore).
 * For testing, random identity is sufficient.
 */
export const IdentityLayer = Layer.succeed(EventLog.Identity, EventLog.Identity.makeRandom())

/**
 * EventLog Layer
 *
 * Provides EventLog.EventLog service using our schema.
 * EventLog is the high-level API that handlers use.
 *
 * Requires: EventJournal.EventJournal, Identity
 */
export const EventLogLayer = EventLog.layer(AmsEventLogSchema)

/**
 * Combined EventLog Stack Layer
 *
 * Provides EventJournal, Identity, and EventLog.
 * Use this layer for full event sourcing support.
 *
 * Requires: SqlClient.SqlClient
 *
 * @example
 * ```ts
 * const ProductionLayer = AssetEntityHandlers.pipe(
 *   Layer.provide(EventLogStackLayer),
 *   Layer.provide(SqliteTestLayer),
 * )
 * ```
 */
export const EventLogStackLayer = EventLogLayer.pipe(
  Layer.provide(SqlEventJournalLayer),
  Layer.provide(IdentityLayer)
)
