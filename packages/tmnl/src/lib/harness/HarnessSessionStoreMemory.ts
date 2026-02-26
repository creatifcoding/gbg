import { Context, Effect, HashMap, Layer, Option, Ref } from 'effect'

import {
  HarnessSessionStore,
  HarnessSessionStoreError,
  type HarnessSessionStoreShape,
} from './HarnessSessionStore'
import type {
  HarnessEventEnvelope,
  HarnessReplayCursor,
  HarnessSessionEnvelope,
} from './schemas'
import {
  HarnessSessionStoreExtended,
  type HarnessSessionStoreExtendedShape,
} from './session/SessionStore'
import {
  HarnessSessionMeta,
  type HarnessSessionMetaPatch,
} from './session/schemas'

const toStoreError = (code: string, message: string) => (cause: unknown) =>
  new HarnessSessionStoreError({
    code,
    message,
    cause: Option.some(cause),
  })

const applyPatch = (current: HarnessSessionMeta, patch: HarnessSessionMetaPatch): HarnessSessionMeta => {
  const starred = patch.starred ?? current.starred
  const nextStatus = patch.status ?? current.status
  const status = nextStatus === 'active' && starred ? ('starred' as const) : nextStatus

  return new HarnessSessionMeta({
    sessionId: current.sessionId,
    name: patch.name ?? current.name,
    autoTitle: patch.autoTitle ?? current.autoTitle,
    tags: patch.tags ?? current.tags,
    status,
    starred,
    createdAt: patch.createdAt ?? current.createdAt,
    updatedAt: patch.updatedAt ?? Date.now(),
    messageCount: patch.messageCount ?? current.messageCount,
    tokenUsage: patch.tokenUsage ?? current.tokenUsage,
    modelId: patch.modelId ?? current.modelId,
    provider: patch.provider ?? current.provider,
    previewSnippet: patch.previewSnippet ?? current.previewSnippet,
    nodeId: patch.nodeId ?? current.nodeId,
    role: patch.role ?? current.role,
    agentId: patch.agentId ?? current.agentId,
  })
}

export const HarnessSessionStoreMemoryLive = Layer.effectContext(
  Effect.gen(function* () {
    const sessionsRef = yield* Ref.make<HashMap.HashMap<string, HarnessSessionEnvelope>>(HashMap.empty())
    const eventsRef = yield* Ref.make<HashMap.HashMap<string, ReadonlyArray<HarnessEventEnvelope>>>(HashMap.empty())
    const cursorRef = yield* Ref.make<HashMap.HashMap<string, HarnessReplayCursor>>(HashMap.empty())
    const metaRef = yield* Ref.make<HashMap.HashMap<string, HarnessSessionMeta>>(HashMap.empty())

    const upsertSession: HarnessSessionStoreShape['upsertSession'] = (session) =>
      Effect.gen(function* () {
        yield* Ref.update(sessionsRef, HashMap.set(session.sessionId, session))

        yield* Ref.update(metaRef, (current) => {
          const existing = HashMap.get(current, session.sessionId)
          const prior = Option.getOrUndefined(existing)
          const statusFromEnvelope = session.status === 'active' ? (prior?.status ?? 'active') : 'archived'
          const starred = prior?.starred ?? false
          const status = statusFromEnvelope === 'active' && starred ? 'starred' : statusFromEnvelope

          const meta = new HarnessSessionMeta({
            sessionId: session.sessionId,
            name: prior?.name ?? '',
            autoTitle: prior?.autoTitle ?? '',
            tags: prior?.tags ?? [],
            status,
            starred,
            createdAt: prior?.createdAt ?? session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: prior?.messageCount ?? 0,
            tokenUsage: prior?.tokenUsage ?? { input: 0, output: 0, total: 0 },
            modelId: prior?.modelId ?? '',
            provider: prior?.provider ?? '',
            previewSnippet: prior?.previewSnippet ?? '',
            nodeId: session.nodeId,
            role: session.role,
            agentId: session.agentId,
          })

          return HashMap.set(current, session.sessionId, meta)
        })
      }).pipe(
        Effect.mapError(toStoreError('upsert-session-failed', 'Failed to upsert harness session')),
      )

    const appendEvent: HarnessSessionStoreShape['appendEvent'] = (envelope) =>
      Effect.gen(function* () {
        yield* Ref.update(eventsRef, (eventsMap) => {
          const existing = Option.getOrElse(HashMap.get(eventsMap, envelope.sessionId), () => [] as ReadonlyArray<HarnessEventEnvelope>)
          return HashMap.set(eventsMap, envelope.sessionId, [...existing, envelope])
        })

        yield* Ref.update(metaRef, (current) => {
          const existing = HashMap.get(current, envelope.sessionId)
          if (Option.isNone(existing)) return current

          const meta = existing.value
          return HashMap.set(current, envelope.sessionId, new HarnessSessionMeta({
            sessionId: meta.sessionId,
            name: meta.name,
            autoTitle: meta.autoTitle,
            tags: meta.tags,
            status: meta.status,
            starred: meta.starred,
            createdAt: meta.createdAt,
            updatedAt: envelope.persistedAt,
            messageCount: meta.messageCount + 1,
            tokenUsage: meta.tokenUsage,
            modelId: meta.modelId,
            provider: meta.provider,
            previewSnippet: meta.previewSnippet,
            nodeId: meta.nodeId,
            role: meta.role,
            agentId: meta.agentId,
          }))
        })
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
        yield* Ref.update(metaRef, HashMap.remove(sessionId))
      }).pipe(
        Effect.mapError(toStoreError('delete-session-failed', `Failed to delete harness session ${sessionId}`)),
      )

    const listSessions: HarnessSessionStoreExtendedShape['listSessions'] = () =>
      Ref.get(metaRef).pipe(
        Effect.map((metas) => Array.from(HashMap.values(metas)).sort((a, b) => b.updatedAt - a.updatedAt)),
        Effect.mapError(toStoreError('list-sessions-failed', 'Failed to list harness sessions')),
      )

    const updateMeta: HarnessSessionStoreExtendedShape['updateMeta'] = (sessionId, patch) =>
      Effect.gen(function* () {
        const maybeMeta = yield* Ref.get(metaRef).pipe(
          Effect.map((metas) => HashMap.get(metas, sessionId)),
        )

        if (Option.isNone(maybeMeta)) {
          return yield* Effect.fail(
            new HarnessSessionStoreError({
              code: 'session-not-found',
              message: `Cannot update metadata. Session ${sessionId} does not exist`,
              cause: Option.none(),
            }),
          )
        }

        const nextMeta = applyPatch(maybeMeta.value, patch)
        yield* Ref.update(metaRef, HashMap.set(sessionId, nextMeta))
      }).pipe(
        Effect.mapError(toStoreError('update-meta-failed', `Failed to update session metadata for ${sessionId}`)),
      )

    const extendedStore = {
      upsertSession,
      appendEvent,
      loadSession,
      loadEventsAfter,
      saveCursor,
      loadCursor,
      deleteSession,
      listSessions,
      updateMeta,
    } satisfies HarnessSessionStoreExtendedShape

    const baseStore = {
      upsertSession,
      appendEvent,
      loadSession,
      loadEventsAfter,
      saveCursor,
      loadCursor,
      deleteSession,
    } satisfies HarnessSessionStoreShape

    return Context.empty().pipe(
      Context.add(HarnessSessionStoreExtended, extendedStore),
      Context.add(HarnessSessionStore, baseStore),
    )
  }),
)
