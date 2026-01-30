/**
 * IIoT EventLog Infrastructure Layer
 *
 * Provides the Effect layers required for EventLog-based event sourcing.
 * Wires together:
 * - EventJournal (persistence backend)
 * - Identity (CRDT identity for distributed sync)
 * - EventLog (the main service)
 *
 * @module @gbg/tmnl/iiot/infrastructure/eventlog-layer
 * @see @effect/experimental/EventLog
 * @see @effect/experimental/EventJournal
 */

import { Layer, Effect } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { SqlClient } from '@effect/sql'
import type { SqlError } from '@effect/sql/SqlError'
import { StructuralEvents, OperationalEvents } from '../schemas/events/groups'
import { IIoTSqlEventJournalLayer, type IIoTSqlEventJournalConfig } from './sql-event-journal'

// =============================================================================
// EventLog Schema
// =============================================================================

/**
 * IIoT EventLog Schema
 *
 * Combines all event groups into a single schema for the EventLog.
 * This schema is used by EventLog.layer to know which events to handle.
 *
 * @example
 * ```typescript
 * import { IIoTEventLogSchema } from './eventlog-layer'
 *
 * // Use with EventLog client
 * const client = yield* EventLog.makeClient(IIoTEventLogSchema)
 * yield* client('StateStarted', payload)
 * ```
 */
export const IIoTEventLogSchema = EventLog.schema(
  StructuralEvents,
  OperationalEvents
)

export type IIoTEventLogSchema = typeof IIoTEventLogSchema

// =============================================================================
// Journal Layer (Memory-based for now)
// =============================================================================

/**
 * IIoT Event Journal Layer — Memory Implementation
 *
 * Provides the EventJournal service using an in-memory store.
 * Suitable for development and testing.
 *
 * @see src/lib/iiot/models/_event-journal.ddl.ts for table definitions
 */
export const IIoTEventJournalMemoryLayer: Layer.Layer<EventJournal.EventJournal> =
  EventJournal.layerMemory

/**
 * IIoT Event Journal Layer — SQL Implementation
 *
 * Provides the EventJournal service using the partitioned SQL tables:
 * - `iiot.event_journal` partitioned by entity_type
 * - `iiot.event_remotes` for remote sync tracking
 *
 * Requires SqlClient.SqlClient to be provided.
 *
 * @param config - Configuration including CRDT identity
 * @returns Layer providing EventJournal
 *
 * @example
 * ```typescript
 * const sqlJournalLayer = IIoTEventJournalSqlLayer({
 *   identityId: identity.id
 * })
 *
 * const stack = IIoTEventLogLayer.pipe(
 *   Layer.provide(sqlJournalLayer),
 *   Layer.provide(IIoTIdentityLayer),
 *   Layer.provide(SqlClientLive)
 * )
 * ```
 */
export const IIoTEventJournalSqlLayer = (
  config: IIoTSqlEventJournalConfig
): Layer.Layer<EventJournal.EventJournal, SqlError, SqlClient.SqlClient> =>
  IIoTSqlEventJournalLayer(config)

/**
 * @deprecated Use IIoTEventJournalMemoryLayer instead
 */
export const IIoTEventJournalLayer: Layer.Layer<EventJournal.EventJournal> =
  IIoTEventJournalMemoryLayer

// =============================================================================
// Identity Layer
// =============================================================================

/**
 * IIoT Identity Layer — Random Identity
 *
 * Provides the EventLog.Identity service with a randomly generated identity.
 * The identity is used for CRDT-compatible distributed event synchronization.
 *
 * For production, consider:
 * - Persisting identity to database
 * - Using EventLog.layerIdentityKvs with a KeyValueStore
 *
 * @example
 * ```typescript
 * // For persistent identity:
 * const IIoTIdentityLayer = EventLog.layerIdentityKvs({
 *   key: 'iiot-eventlog-identity'
 * }).pipe(Layer.provide(KeyValueStore.layer))
 * ```
 */
export const IIoTIdentityLayer: Layer.Layer<EventLog.Identity> = Layer.succeed(
  EventLog.Identity,
  EventLog.Identity.makeRandom()
)

// =============================================================================
// EventLog Layer
// =============================================================================

/**
 * IIoT EventLog Layer
 *
 * The main EventLog service layer. Requires EventJournal and Identity.
 * Use `IIoTEventLogStackLayer` for a pre-wired layer with all dependencies.
 *
 * @example
 * ```typescript
 * // Provide your own journal and identity
 * const layer = IIoTEventLogLayer.pipe(
 *   Layer.provide(MyCustomJournalLayer),
 *   Layer.provide(MyCustomIdentityLayer)
 * )
 * ```
 */
export const IIoTEventLogLayer = EventLog.layer(IIoTEventLogSchema)

// =============================================================================
// Composed Stack Layer
// =============================================================================

/**
 * IIoT EventLog Stack Layer — Complete Layer with All Dependencies (Memory)
 *
 * A fully composed layer that provides:
 * - EventLog service
 * - EventJournal (memory-backed)
 * - Identity (random)
 *
 * Use this for quick setup in development/testing. For production, use
 * IIoTEventLogStackSqlLayer with a SqlClient.
 *
 * @example
 * ```typescript
 * import { IIoTEventLogStackLayer, IIoTEventLogSchema } from './eventlog-layer'
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* EventLog.makeClient(IIoTEventLogSchema)
 *
 *   yield* client('BaseOperationalEvent', {
 *     eventId: makeEventId(),
 *     occurredAt: DateTime.unsafeNow(),
 *     causedBy: 'system',
 *     entityId: 'MCH-001' as AssetId,
 *     entityType: 'Machine',
 *     correlationId: Option.none(),
 *     schemaVersion: 1,
 *   })
 * })
 *
 * await Effect.runPromise(
 *   program.pipe(Effect.provide(IIoTEventLogStackLayer))
 * )
 * ```
 */
export const IIoTEventLogStackLayer = IIoTEventLogLayer.pipe(
  Layer.provide(IIoTEventJournalMemoryLayer),
  Layer.provide(IIoTIdentityLayer)
)

/**
 * Creates an IIoT EventLog Stack Layer with SQL-backed persistence.
 *
 * A production-ready layer that provides:
 * - EventLog service
 * - EventJournal (SQL-backed with partitioned iiot.event_journal)
 * - Identity (from provided identity or random)
 *
 * Requires SqlClient.SqlClient to be provided.
 *
 * @param options - Optional configuration
 * @returns Layer providing EventLog with SQL persistence
 *
 * @example
 * ```typescript
 * import { makeIIoTEventLogStackSqlLayer, IIoTEventLogSchema } from './eventlog-layer'
 * import { PgClient } from '@effect/sql-pg'
 *
 * const SqlLayer = PgClient.layer({
 *   database: 'mydb',
 *   host: 'localhost',
 * })
 *
 * const EventLogStackLayer = makeIIoTEventLogStackSqlLayer().pipe(
 *   Layer.provide(SqlLayer)
 * )
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* EventLog.makeClient(IIoTEventLogSchema)
 *   yield* client('AlarmTriggered', payload)
 * }).pipe(Effect.provide(EventLogStackLayer))
 * ```
 */
/**
 * Creates an IIoT Event Journal SQL Layer with a specific identity.
 *
 * This is a lower-level factory for when you need to control the identity
 * used for the journal (e.g., persisted identity).
 *
 * @param identity - The EventLog.Identity to use
 * @param options - Optional table name configuration
 * @returns Layer providing EventJournal with SQL persistence
 */
export const makeIIoTEventJournalSqlLayerWithIdentity = (
  identity: typeof EventLog.Identity.Service,
  options?: {
    readonly entryTable?: string
    readonly remotesTable?: string
  }
): Layer.Layer<EventJournal.EventJournal, SqlError, SqlClient.SqlClient> => {
  // Convert publicKey (UUID string) to bytes for storage
  // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx -> 16 bytes
  const identityIdBytes = new Uint8Array(16)
  const hexStr = identity.publicKey.replace(/-/g, '')
  for (let i = 0; i < 16; i++) {
    identityIdBytes[i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16)
  }

  return IIoTEventJournalSqlLayer({
    identityId: identityIdBytes,
    entryTable: options?.entryTable,
    remotesTable: options?.remotesTable,
  })
}

/**
 * Creates an IIoT EventLog Stack Layer with SQL-backed persistence.
 *
 * A production-ready layer that provides:
 * - EventLog service
 * - EventJournal (SQL-backed with partitioned iiot.event_journal)
 * - Identity (random - created at layer construction time)
 *
 * Requires SqlClient.SqlClient to be provided.
 *
 * Note: The identity is created when this function is called, so each call
 * creates a new identity. For persistent identity across restarts, use
 * makeIIoTEventJournalSqlLayerWithIdentity with a persisted identity.
 *
 * @param options - Optional configuration
 * @returns Layer providing EventLog with SQL persistence
 *
 * @example
 * ```typescript
 * import { makeIIoTEventLogStackSqlLayer, IIoTEventLogSchema } from './eventlog-layer'
 * import { PgClient } from '@effect/sql-pg'
 *
 * const SqlLayer = PgClient.layer({
 *   database: 'mydb',
 *   host: 'localhost',
 * })
 *
 * const EventLogStackLayer = makeIIoTEventLogStackSqlLayer().pipe(
 *   Layer.provide(SqlLayer)
 * )
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* EventLog.makeClient(IIoTEventLogSchema)
 *   yield* client('AlarmTriggered', payload)
 * }).pipe(Effect.provide(EventLogStackLayer))
 * ```
 */
export const makeIIoTEventLogStackSqlLayer = (options?: {
  readonly entryTable?: string
  readonly remotesTable?: string
}): Layer.Layer<
  EventLog.EventLog,
  SqlError,
  SqlClient.SqlClient
> => {
  // Create a random identity for this EventLog instance
  // This is created at layer construction time, not at runtime
  const identity = EventLog.Identity.makeRandom()

  // Create the SQL journal layer with the identity
  const journalLayer = makeIIoTEventJournalSqlLayerWithIdentity(identity, options)

  // Create identity layer
  const identityLayer = Layer.succeed(EventLog.Identity, identity)

  // Compose the full EventLog stack
  // Note: We need to type-cast here because the EventLog.layer requires
  // EventHandlers for all events in the schema, but those are optional
  // runtime registrations, not layer dependencies.
  return IIoTEventLogLayer.pipe(
    Layer.provide(journalLayer),
    Layer.provide(identityLayer)
  ) as unknown as Layer.Layer<EventLog.EventLog, SqlError, SqlClient.SqlClient>
}

// =============================================================================
// Re-exports for Convenience
// =============================================================================

export {
  EventLog,
  EventJournal,
}

/**
 * Entry type from EventJournal
 */
export type Entry = EventJournal.Entry

/**
 * EventJournalError type
 */
export type EventJournalError = EventJournal.EventJournalError
