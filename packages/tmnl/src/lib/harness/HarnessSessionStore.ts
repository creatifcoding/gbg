import { Context, Effect, Option, Schema } from 'effect'

import type {
  HarnessEvent,
  HarnessEventEnvelope,
  HarnessReplayCursor,
  HarnessSeq,
  HarnessSessionEnvelope,
  HarnessSessionId,
} from './schemas'

export class HarnessSessionStoreError extends Schema.TaggedError<HarnessSessionStoreError>()(
  'HarnessSessionStoreError',
  {
    code: Schema.String,
    message: Schema.String,
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  },
) {}

export interface HarnessSessionStoreShape {
  readonly upsertSession: (session: HarnessSessionEnvelope) => Effect.Effect<void, HarnessSessionStoreError>
  readonly appendEvent: (envelope: HarnessEventEnvelope) => Effect.Effect<void, HarnessSessionStoreError>
  readonly loadSession: (
    sessionId: HarnessSessionId,
  ) => Effect.Effect<Option.Option<HarnessSessionEnvelope>, HarnessSessionStoreError>
  readonly loadEventsAfter: (
    sessionId: HarnessSessionId,
    fromSeq: Option.Option<HarnessSeq>,
  ) => Effect.Effect<ReadonlyArray<HarnessEventEnvelope>, HarnessSessionStoreError>
  readonly saveCursor: (cursor: HarnessReplayCursor) => Effect.Effect<void, HarnessSessionStoreError>
  readonly loadCursor: (
    sessionId: HarnessSessionId,
  ) => Effect.Effect<Option.Option<HarnessReplayCursor>, HarnessSessionStoreError>
  readonly deleteSession: (sessionId: HarnessSessionId) => Effect.Effect<void, HarnessSessionStoreError>
}

export const HarnessSessionStore = Context.GenericTag<HarnessSessionStoreShape>('tmnl/harness/HarnessSessionStore')

export const deriveHeadSeq = (events: ReadonlyArray<HarnessEventEnvelope>): HarnessSeq =>
  events.length === 0 ? (0 as HarnessSeq) : events[events.length - 1].seq

export const toReplayEvents = (events: ReadonlyArray<HarnessEventEnvelope>): ReadonlyArray<HarnessEvent> =>
  events.map((entry) => entry.event)
