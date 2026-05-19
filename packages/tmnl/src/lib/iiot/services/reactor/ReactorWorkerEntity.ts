/**
 * ReactorWorkerEntity — optional owner-key mailbox for Reactor processing.
 *
 * The SQL source-entry claim remains the authority boundary. This entity is a
 * thin Effect Cluster facade that can be introduced later to serialize hot
 * Reactor subjects by stable owner key (`relationship-reactor:<type>:<id>`)
 * without making policy epoch part of physical ownership.
 *
 * @module
 */

import { Effect, Option, Schema } from 'effect'
import { Entity, ClusterSchema } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import * as EventJournal from '@effect/experimental/EventJournal'
import { ReactorOwnerKey, ReactorRun } from '../../schemas/reactor'
import { Reactor } from './Reactor'

// =============================================================================
// RPC schemas
// =============================================================================

export const ReactorWorkerEntityType = 'ReactorWorker' as const
export const ReactorWorkerProcessJournalEntryTag = 'ProcessJournalEntry' as const

export class ReactorWorkerError extends Schema.TaggedError<ReactorWorkerError>()('ReactorWorkerError', {
  ownerKey: ReactorOwnerKey,
  sourceEntryId: Schema.String,
  sourceEvent: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class ReactorWorkerProcessResult extends Schema.TaggedClass<ReactorWorkerProcessResult>()('ReactorWorkerProcessResult', {
  processed: Schema.Boolean,
  run: Schema.optional(ReactorRun),
}) {}
export type ReactorWorkerProcessResult = typeof ReactorWorkerProcessResult.Type

export class ProcessJournalEntryRpc extends Rpc.make(ReactorWorkerProcessJournalEntryTag, {
  payload: Schema.Struct({
    ownerKey: ReactorOwnerKey,
    entry: EventJournal.Entry,
  }),
  success: ReactorWorkerProcessResult,
  error: ReactorWorkerError,
}) {}

// =============================================================================
// Entity definition
// =============================================================================

export const ReactorWorkerEntity = Entity.make(ReactorWorkerEntityType, [
  ProcessJournalEntryRpc,
]).annotate(ClusterSchema.ShardGroup, (ownerKey) => {
  const [, , subjectType] = String(ownerKey).split(':')
  return subjectType === undefined || subjectType.length === 0
    ? 'reactor-default'
    : `reactor-${subjectType}`
})

export type ReactorWorkerEntity = typeof ReactorWorkerEntity

const describeCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

// =============================================================================
// Handler implementation
// =============================================================================

export const ReactorWorkerEntityHandlers = ReactorWorkerEntity.toLayer(
  Effect.gen(function* () {
    const reactor = yield* Reactor

    return {
      ProcessJournalEntry: (envelope) => {
        const { ownerKey, entry } = envelope.payload

        return reactor.reactToJournalEntry(entry).pipe(
          Effect.map((run) => new ReactorWorkerProcessResult({
            processed: Option.isSome(run),
            run: Option.getOrUndefined(run),
          })),
          Effect.catchAll((cause) => Effect.fail(new ReactorWorkerError({
            ownerKey,
            sourceEntryId: entry.idString,
            sourceEvent: entry.event,
            message: describeCause(cause),
            cause,
          }))),
          Effect.withSpan('iiot.reactor.worker.processJournalEntry', {
            attributes: {
              ownerKey,
              sourceEntryId: entry.idString,
              sourceEvent: entry.event,
            },
          }),
        )
      },
    }
  }),
  { maxIdleTime: '5 minutes' },
)
