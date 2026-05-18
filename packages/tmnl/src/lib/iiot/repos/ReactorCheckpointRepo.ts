/**
 * ReactorCheckpointRepo — replay cursor and delivery dedupe repository.
 *
 * The relationship Reactor processes durable EventJournal entries. This repo
 * records which source entries a named consumer has classified so restart/replay
 * cannot dispatch the same source fact twice.
 *
 * @module
 */

import { Context, DateTime, Effect, Layer, Option, Ref } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import {
  ReactorCheckpointInsert,
  ReactorCheckpointRecord,
  type ReactorConsumerId,
  type ReactorSourceEntryId,
} from '../schemas/reactor'

export type ReactorCheckpointRepoError = SqlError.SqlError

export interface ReactorCheckpointRepository {
  readonly hasProcessed: (input: {
    readonly consumerId: ReactorConsumerId
    readonly sourceEntryId: ReactorSourceEntryId
  }) => Effect.Effect<boolean, ReactorCheckpointRepoError>

  /**
   * Mark a source entry processed. Returns false when the row already existed.
   */
  readonly markProcessed: (
    checkpoint: typeof ReactorCheckpointInsert.Type,
  ) => Effect.Effect<boolean, ReactorCheckpointRepoError>
}

export class ReactorCheckpointRepo extends Context.Tag('iiot/ReactorCheckpointRepo')<
  ReactorCheckpointRepo,
  ReactorCheckpointRepository
>() {}

export const ReactorCheckpointRepoLive = Layer.effect(
  ReactorCheckpointRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const hasProcessed: ReactorCheckpointRepository['hasProcessed'] = ({ consumerId, sourceEntryId }) =>
      Effect.gen(function* () {
        const rows = yield* sql<{ exists: boolean }>`
          SELECT EXISTS (
            SELECT 1
            FROM iiot.reactor_checkpoints
            WHERE consumer_id = ${consumerId}
              AND source_entry_id = ${sourceEntryId}
          ) AS "exists"
        `
        return Boolean(rows[0]?.exists)
      })

    const markProcessed: ReactorCheckpointRepository['markProcessed'] = (checkpoint) =>
      Effect.gen(function* () {
        const rows = yield* sql<{ inserted: number }>`
          INSERT INTO iiot.reactor_checkpoints (
            consumer_id,
            source_entry_id,
            source_event,
            primary_key,
            outcome,
            metadata
          )
          VALUES (
            ${checkpoint.consumerId},
            ${checkpoint.sourceEntryId},
            ${checkpoint.sourceEvent},
            ${checkpoint.primaryKey},
            ${checkpoint.outcome},
            ${checkpoint.metadata}
          )
          ON CONFLICT (consumer_id, source_entry_id) DO NOTHING
          RETURNING 1 AS inserted
        `
        return rows.length > 0
      })

    return ReactorCheckpointRepo.of({
      hasProcessed,
      markProcessed,
    })
  }),
)

export const ReactorCheckpointRepoInMemory = Layer.effect(
  ReactorCheckpointRepo,
  Ref.make(new Map<string, typeof ReactorCheckpointRecord.Type>()).pipe(
    Effect.map((store) => {
      const key = (consumerId: ReactorConsumerId, sourceEntryId: ReactorSourceEntryId) =>
        `${consumerId}:${sourceEntryId}`

      const hasProcessed: ReactorCheckpointRepository['hasProcessed'] = ({ consumerId, sourceEntryId }) =>
        Ref.get(store).pipe(
          Effect.map((map) => map.has(key(consumerId, sourceEntryId))),
        )

      const markProcessed: ReactorCheckpointRepository['markProcessed'] = (checkpoint) =>
        Effect.gen(function* () {
          const checkpointKey = key(checkpoint.consumerId, checkpoint.sourceEntryId)
          const now = yield* DateTime.now

          return yield* Ref.modify(store, (map) => {
            if (map.has(checkpointKey)) return [false, map] as const

            const next = new Map(map)
            next.set(checkpointKey, new ReactorCheckpointRecord({
              consumerId: checkpoint.consumerId,
              sourceEntryId: checkpoint.sourceEntryId,
              sourceEvent: checkpoint.sourceEvent,
              primaryKey: checkpoint.primaryKey,
              outcome: checkpoint.outcome,
              processedAt: now,
              metadata: checkpoint.metadata ?? {},
            }))
            return [true, next] as const
          })
        })

      return ReactorCheckpointRepo.of({
        hasProcessed,
        markProcessed,
      })
    }),
  ),
)

export const markProcessedIfPresent = (checkpoint: typeof ReactorCheckpointInsert.Type) =>
  Effect.serviceOption(ReactorCheckpointRepo).pipe(
    Effect.flatMap(Option.match({
      onNone: () => Effect.succeed(true),
      onSome: (repo) => repo.markProcessed(checkpoint),
    })),
  )
