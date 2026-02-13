import { Effect, HashMap, Layer, Option, Ref } from 'effect'

import {
  HarnessSessionStore,
  HarnessSessionStoreError,
  type HarnessSessionStoreShape,
} from './HarnessSessionStore'
import type {
  HarnessEventEnvelope,
  HarnessReplayCursor,
  HarnessSessionEnvelope,
  HarnessSessionId,
} from './schemas'

const toStoreError = (code: string, message: string) => (cause: unknown) =>
  new HarnessSessionStoreError({
    code,
    message,
    cause: Option.some(cause),
  })

export const HarnessSessionStoreMemoryLive = Layer.effect(
  HarnessSessionStore,
  Effect.gen(function* () {
    const sessionsRef = yield* Ref.make<HashMap.HashMap<string, HarnessSessionEnvelope>>(HashMap.empty())
    const eventsRef = yield* Ref.make<HashMap.HashMap<string, ReadonlyArray<HarnessEventEnvelope>>>(HashMap.empty())
    const cursorRef = yield* Ref.make<HashMap.HashMap<string, HarnessReplayCursor>>(HashMap.empty())

    const upsertSession: HarnessSessionStoreShape['upsertSession'] = (session) =>
      Ref.update(sessionsRef, HashMap.set(session.sessionId, session)).pipe(
        Effect.mapError(toStoreError('upsert-session-failed', 'Failed to upsert harness session')),
      )

    const appendEvent: HarnessSessionStoreShape['appendEvent'] = (envelope) =>
      Ref.update(eventsRef, (eventsMap) => {
        const existing = Option.getOrElse(HashMap.get(eventsMap, envelope.sessionId), () => [] as ReadonlyArray<HarnessEventEnvelope>)
        return HashMap.set(eventsMap, envelope.sessionId, [...existing, envelope])
      }).pipe(
        Effect.mapError(toStoreError('append-event-failed', 'Failed to append harness event')),
      )

    const loadSession: HarnessSessionStoreShape['loadSession'] = (sessionId) =>
      Ref.get(sessionsRef).pipe(
        Effect.map((sessions) => HashMap.get(sessions, sessionId)),
        Effect.mapError(toStoreError('load-session-failed', 'Failed to load harness session')),
      )

    const loadEventsAfter: HarnessSessionStoreShape['loadEventsAfter'] = (sessionId, fromSeq) =>
      Ref.get(eventsRef).pipe(
        Effect.map((eventsMap) => {
          const events = Option.getOrElse(HashMap.get(eventsMap, sessionId), () => [] as ReadonlyArray<HarnessEventEnvelope>)
          return Option.match(fromSeq, {
            onNone: () => [...events],
            onSome: (seq) => events.filter((event) => event.seq > seq),
          })
        }),
        Effect.mapError(toStoreError('load-events-failed', 'Failed to load harness events')),
      )

    const saveCursor: HarnessSessionStoreShape['saveCursor'] = (cursor) =>
      Ref.update(cursorRef, HashMap.set(cursor.sessionId, cursor)).pipe(
        Effect.mapError(toStoreError('save-cursor-failed', 'Failed to save harness replay cursor')),
      )

    const loadCursor: HarnessSessionStoreShape['loadCursor'] = (sessionId) =>
      Ref.get(cursorRef).pipe(
        Effect.map((cursors) => HashMap.get(cursors, sessionId)),
        Effect.mapError(toStoreError('load-cursor-failed', 'Failed to load harness replay cursor')),
      )

    const deleteSession: HarnessSessionStoreShape['deleteSession'] = (sessionId) =>
      Effect.gen(function* () {
        yield* Ref.update(sessionsRef, HashMap.remove(sessionId))
        yield* Ref.update(eventsRef, HashMap.remove(sessionId))
        yield* Ref.update(cursorRef, HashMap.remove(sessionId))
      }).pipe(
        Effect.mapError(toStoreError('delete-session-failed', `Failed to delete harness session ${sessionId}`)),
      )

    return {
      upsertSession,
      appendEvent,
      loadSession,
      loadEventsAfter,
      saveCursor,
      loadCursor,
      deleteSession,
    } satisfies HarnessSessionStoreShape
  }),
)
