/**
 * IIoT SQL Event Journal Implementation
 *
 * Provides a SQL-backed EventJournal implementation for the IIoT domain.
 * Uses the partitioned `iiot.event_journal` table with entity_type partitioning.
 *
 * Key differences from @effect/sql/SqlEventJournal:
 * - Uses partitioned table with entity_type for query optimization
 * - Stores payload as JSONB instead of BYTEA
 * - Includes identity_id for CRDT tracking per-event
 * - Extracts entity_type from event name (e.g., "AlarmTriggered" -> "alarm")
 *
 * @module @gbg/tmnl/iiot/infrastructure/sql-event-journal
 * @see @effect/experimental/EventJournal for interface
 * @see @effect/sql/SqlEventJournal for canonical pattern
 * @see src/lib/iiot/models/_event-journal.ddl.ts for table DDL
 */

import * as EventJournal from '@effect/experimental/EventJournal'
import { SqlClient } from '@effect/sql'
import type { SqlError } from '@effect/sql/SqlError'
import { Effect, Layer, PubSub, Schema, Scope } from 'effect'
import type * as Queue from 'effect/Queue'

import type { EntityType } from '../models/_event-journal.ddl'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for the IIoT SQL Event Journal.
 *
 * @property entryTable - The table name for entries (default: "iiot.event_journal")
 * @property remotesTable - The table name for remotes (default: "iiot.event_remotes")
 * @property identityTable - The table name for identity persistence (default: "iiot.event_journal_identity")
 * @property identityId - The CRDT identity for this EventJournal instance (optional - will be loaded/generated if not provided)
 * @property nodeName - The node name for identity persistence (default: "primary")
 */
export interface IIoTSqlEventJournalConfig {
  readonly entryTable?: string
  readonly remotesTable?: string
  readonly identityTable?: string
  readonly identityId?: Uint8Array
  readonly nodeName?: string
}

// =============================================================================
// Entity Type Extraction
// =============================================================================

/**
 * Entity type mappings from event name prefixes.
 */
const EVENT_PREFIX_TO_ENTITY: Record<string, EntityType> = {
  alarm: 'alarm',
  workorder: 'work_order',
  work_order: 'work_order',
  equipment: 'equipment',
  machine: 'equipment',
  task: 'task',
  approval: 'approval',
}

/**
 * Extracts the entity type from an event name.
 */
const extractEntityType = (eventName: string): EntityType => {
  const lowerName = eventName.toLowerCase()

  for (const [prefix, entityType] of Object.entries(EVENT_PREFIX_TO_ENTITY)) {
    if (lowerName.startsWith(prefix)) {
      return entityType
    }
  }

  for (const [prefix, entityType] of Object.entries(EVENT_PREFIX_TO_ENTITY)) {
    if (lowerName.includes(prefix)) {
      return entityType
    }
  }

  return 'equipment'
}

// =============================================================================
// Utility: UUID operations
// =============================================================================

const uuidStringify = (bytes: Uint8Array): string => {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// =============================================================================
// MsgPack utilities
// =============================================================================

import * as msgpackr from 'msgpackr'

// =============================================================================
// SQL Row Types
// =============================================================================

interface IIoTEntrySqlRow {
  readonly id: Uint8Array
  readonly entity_type: string
  readonly event_tag: string
  readonly primary_key: string
  readonly payload: unknown
  readonly created_at: Date
  readonly identity_id: Uint8Array
}

interface RemoteSqlRow {
  readonly remote_id: Uint8Array
  readonly entry_id: Uint8Array
  readonly sequence: number
}

// =============================================================================
// Transformations
// =============================================================================

const sqlRowToEntry = (row: IIoTEntrySqlRow): EventJournal.Entry => {
  const mp = msgpackr
  const payloadBytes = mp.encode(row.payload)

  return new EventJournal.Entry(
    {
      id: row.id as EventJournal.EntryId,
      event: row.event_tag,
      primaryKey: row.primary_key,
      payload: payloadBytes,
    },
    { disableValidation: true }
  )
}

const decodePayloadToJson = (entry: EventJournal.Entry): unknown => {
  const mp = msgpackr
  return mp.decode(entry.payload)
}

// =============================================================================
// SQL Event Journal Implementation
// =============================================================================

export const makeIIoTSqlEventJournal = (
  config: IIoTSqlEventJournalConfig
): Effect.Effect<
  typeof EventJournal.EventJournal.Service,
  SqlError,
  SqlClient.SqlClient
> =>
  Effect.flatMap(SqlClient.SqlClient, (sql) =>
    Effect.flatMap(PubSub.unbounded<EventJournal.Entry>(), (pubsub) => {
      const entryTable = config.entryTable ?? 'iiot.event_journal'
      const remotesTable = config.remotesTable ?? 'iiot.event_remotes'
      const identityTable = config.identityTable ?? 'iiot.event_journal_identity'
      const nodeName = config.nodeName ?? 'primary'

      // Identity loading/creation effect with race condition handling
      const loadOrCreateIdentity = Effect.gen(function* () {
        // Try to load existing identity
        const existingRows = yield* sql<{ identity_id: Uint8Array }>`
          SELECT identity_id FROM ${sql(identityTable)}
          WHERE node_name = ${nodeName}
        `

        if (existingRows.length > 0 && existingRows[0]) {
          return existingRows[0].identity_id
        }

        // Generate new identity
        const newIdentityId = new Uint8Array(16)
        crypto.getRandomValues(newIdentityId)

        // Persist it (DO NOTHING on conflict to handle race)
        yield* sql`
          INSERT INTO ${sql(identityTable)} (node_name, identity_id)
          VALUES (${nodeName}, ${newIdentityId})
          ON CONFLICT (node_name) DO NOTHING
        `

        // Re-read to get the winner of any race condition
        const persistedRows = yield* sql<{ identity_id: Uint8Array }>`
          SELECT identity_id FROM ${sql(identityTable)}
          WHERE node_name = ${nodeName}
        `

        if (persistedRows.length === 0 || !persistedRows[0]) {
          // This should never happen - we just inserted or another process did
          // Use Effect.die for invariant violation
          return yield* Effect.die(
            new Error(`Identity persistence failed for node ${nodeName}`)
          )
        }

        return persistedRows[0].identity_id
      })

      // If identity is provided, use it directly; otherwise load/create
      const getIdentityId = config.identityId
        ? Effect.succeed(config.identityId)
        : loadOrCreateIdentity

      return Effect.flatMap(getIdentityId, (identityId) => {

      const EntryArraySchema = Schema.Array(
        Schema.Struct({
          id: Schema.Uint8ArrayFromSelf,
          entity_type: Schema.String,
          event_tag: Schema.String,
          primary_key: Schema.String,
          payload: Schema.Unknown,
          created_at: Schema.DateFromSelf,
          identity_id: Schema.Uint8ArrayFromSelf,
        })
      )
      const decodeEntryArray = Schema.decodeUnknown(EntryArraySchema)

      return Effect.succeed(EventJournal.EventJournal.of({
      entries: sql`
        SELECT id, entity_type, event_tag, primary_key, payload, created_at, identity_id
        FROM ${sql(entryTable)}
        ORDER BY created_at ASC
      `.withoutTransform.pipe(
        Effect.flatMap(decodeEntryArray),
        Effect.map((rows) => rows.map(sqlRowToEntry)),
        Effect.mapError((cause) =>
          new EventJournal.EventJournalError({ cause, method: 'entries' })
        )
      ),

      write<A, E, R>({ effect, event, payload, primaryKey }: {
        readonly event: string
        readonly primaryKey: string
        readonly payload: Uint8Array
        readonly effect: (entry: EventJournal.Entry) => Effect.Effect<A, E, R>
      }): Effect.Effect<A, EventJournal.EventJournalError | E, R> {
        return Effect.gen(function* () {
          const entry = new EventJournal.Entry(
            {
              id: EventJournal.makeEntryId(),
              event,
              primaryKey,
              payload,
            },
            { disableValidation: true }
          )

          const entityType = extractEntityType(entry.event)
          const payloadJson = decodePayloadToJson(entry)
          const createdAt = new Date(EventJournal.entryIdMillis(entry.id as EventJournal.EntryId))

          yield* sql.unsafe(`
            INSERT INTO ${entryTable} (id, entity_type, event_tag, primary_key, payload, created_at, identity_id)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
            ON CONFLICT DO NOTHING
          `, [entry.id, entityType, entry.event, entry.primaryKey, JSON.stringify(payloadJson), createdAt, identityId])

          const value = yield* effect(entry)
          yield* pubsub.publish(entry)
          return value
        }).pipe(
          sql.withTransaction,
          Effect.mapError((cause) =>
            cause instanceof EventJournal.EventJournalError
              ? cause
              : new EventJournal.EventJournalError({ cause, method: 'write' })
          )
        ) as Effect.Effect<A, EventJournal.EventJournalError | E, R>
      },

      writeFromRemote: (options) =>
        (Effect.gen(function* () {
          const entries: Array<EventJournal.Entry> = []
          const remotes: Array<RemoteSqlRow> = []

          for (const remoteEntry of options.entries) {
            entries.push(remoteEntry.entry)
            remotes.push({
              remote_id: options.remoteId,
              entry_id: remoteEntry.entry.id,
              sequence: remoteEntry.remoteSequence,
            })
          }

          const existingIds = new Set<string>()
          const existingRows = yield* sql<{ id: Uint8Array }>`
            SELECT id FROM ${sql(entryTable)}
            WHERE ${sql.in('id', entries.map((e) => e.id))}
          `
          for (const row of existingRows) {
            existingIds.add(uuidStringify(row.id))
          }

          for (const entry of entries) {
            const entityType = extractEntityType(entry.event)
            const payloadJson = decodePayloadToJson(entry)
            const createdAt = new Date(EventJournal.entryIdMillis(entry.id as EventJournal.EntryId))

            yield* sql.unsafe(`
              INSERT INTO ${entryTable} (id, entity_type, event_tag, primary_key, payload, created_at, identity_id)
              VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
              ON CONFLICT DO NOTHING
            `, [entry.id, entityType, entry.event, entry.primaryKey, JSON.stringify(payloadJson), createdAt, identityId])
          }

          for (const remote of remotes) {
            yield* sql`
              INSERT INTO ${sql(remotesTable)} (remote_id, entry_id, sequence)
              VALUES (${remote.remote_id}, ${remote.entry_id}, ${remote.sequence})
              ON CONFLICT DO NOTHING
            `.withoutTransform
          }

          const uncommitted = options.entries.filter(
            (e) => !existingIds.has(e.entry.idString)
          )
          const brackets = options.compact
            ? yield* options.compact(uncommitted)
            : ([[uncommitted.map((_) => _.entry), uncommitted] as const])

          for (const [compacted] of brackets) {
            for (let i = 0; i < compacted.length; i++) {
              const entry = compacted[i]
              const conflictRows = yield* sql`
                SELECT id, entity_type, event_tag, primary_key, payload, created_at, identity_id
                FROM ${sql(entryTable)}
                WHERE event_tag = ${entry.event}
                  AND primary_key = ${entry.primaryKey}
                  AND created_at >= ${new Date(entry.createdAtMillis)}
                ORDER BY created_at ASC
              `.withoutTransform.pipe(Effect.flatMap(decodeEntryArray))

              const conflicts = conflictRows.map(sqlRowToEntry)
              yield* options.effect({ entry, conflicts })
            }
          }
        }).pipe(
          sql.withTransaction,
          Effect.mapError((cause) =>
            new EventJournal.EventJournalError({ cause, method: 'writeFromRemote' })
          )
        )) as Effect.Effect<void, EventJournal.EventJournalError>,

      withRemoteUncommited: <A, E, R>(
        remoteId: EventJournal.RemoteId,
        f: (entries: ReadonlyArray<EventJournal.Entry>) => Effect.Effect<A, E, R>
      ): Effect.Effect<A, EventJournal.EventJournalError | E, R> =>
        Effect.gen(function* () {
          const rows = yield* sql`
            SELECT id, entity_type, event_tag, primary_key, payload, created_at, identity_id
            FROM ${sql(entryTable)}
            WHERE id NOT IN (
              SELECT entry_id FROM ${sql(remotesTable)}
              WHERE remote_id = ${remoteId}
            )
            ORDER BY created_at ASC
          `.withoutTransform.pipe(Effect.flatMap(decodeEntryArray))

          const entries = rows.map(sqlRowToEntry)
          return yield* f(entries)
        }).pipe(
          sql.withTransaction,
          Effect.mapError((cause) =>
            cause instanceof EventJournal.EventJournalError
              ? cause
              : new EventJournal.EventJournalError({ cause, method: 'withRemoteUncommited' })
          )
        ) as Effect.Effect<A, EventJournal.EventJournalError | E, R>,

      nextRemoteSequence: (remoteId) =>
        sql<{ max: number | null }>`
          SELECT MAX(sequence) AS max
          FROM ${sql(remotesTable)}
          WHERE remote_id = ${remoteId}
        `.pipe(
          Effect.map((rows) => {
            const max = rows[0]?.max
            return max != null ? Number(max) + 1 : 0
          }),
          Effect.mapError((cause) =>
            new EventJournal.EventJournalError({
              cause,
              method: 'nextRemoteSequence',
            })
          )
        ),

      changes: PubSub.subscribe(pubsub) as Effect.Effect<Queue.Dequeue<EventJournal.Entry>, never, Scope.Scope>,

      destroy: sql`DELETE FROM ${sql(remotesTable)}`.withoutTransform.pipe(
        Effect.flatMap(() => sql`DELETE FROM ${sql(entryTable)}`.withoutTransform),
        Effect.asVoid,
        Effect.mapError((cause) =>
          new EventJournal.EventJournalError({ cause, method: 'destroy' })
        )
      ),
    }))
  })
  }))

// =============================================================================
// Layer Construction
// =============================================================================

export const IIoTSqlEventJournalLayer = (
  config: IIoTSqlEventJournalConfig
): Layer.Layer<EventJournal.EventJournal, SqlError, SqlClient.SqlClient> =>
  Layer.effect(EventJournal.EventJournal, makeIIoTSqlEventJournal(config))

// =============================================================================
// Compaction Strategies
// =============================================================================

/**
 * Simple compaction: deduplicate entries by ID.
 *
 * When the same entry arrives via multiple sync paths, only process it once.
 * This is the minimal compaction strategy - no entity-aware grouping.
 *
 * @example
 * ```ts
 * await journal.writeFromRemote({
 *   remoteId,
 *   entries: remoteEntries,
 *   compact: simpleCompact,  // Dedupe before processing
 *   effect: ({ entry, conflicts }) => handleConflicts(entry, conflicts),
 * })
 * ```
 */
export const simpleCompact = (
  uncommitted: ReadonlyArray<EventJournal.RemoteEntry>
): Effect.Effect<
  readonly (readonly [
    ReadonlyArray<EventJournal.Entry>,
    ReadonlyArray<EventJournal.RemoteEntry>
  ])[]
> => {
  // Dedupe by entry ID, keeping first occurrence
  const seen = new Set<string>()
  const deduped: EventJournal.RemoteEntry[] = []

  for (const re of uncommitted) {
    if (!seen.has(re.entry.idString)) {
      seen.add(re.entry.idString)
      deduped.push(re)
    }
  }

  return Effect.succeed([[deduped.map((r) => r.entry), deduped] as const])
}

// =============================================================================
// Re-exports
// =============================================================================

export { EventJournal }
export type { Entry, EventJournalError, EntryId, RemoteId } from '@effect/experimental/EventJournal'
