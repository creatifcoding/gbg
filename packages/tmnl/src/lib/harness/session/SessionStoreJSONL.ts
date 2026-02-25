import { FileSystem } from '@effect/platform'
import { Effect, Layer, Option, Schema } from 'effect'

import type { HarnessSessionStoreShape } from '../HarnessSessionStore'
import {
  HarnessSessionStore,
  HarnessSessionStoreError,
} from '../HarnessSessionStore'
import {
  HarnessEventEnvelope,
  HarnessReplayCursor,
  HarnessRole,
  HarnessSessionEnvelope,
  HarnessSessionId,
  type HarnessSeq,
  type HarnessSessionId as HarnessSessionIdType,
  type HarnessSessionStatus,
} from '../schemas'
import {
  HarnessSessionStoreExtended,
  type HarnessSessionStoreExtendedShape,
} from './SessionStore'
import {
  HarnessSessionMeta,
  type HarnessSessionMetaPatch,
  type SessionStatus,
} from './schemas'

const SESSION_FILE_EXTENSION = '.jsonl'
const SESSION_STORE_DIRECTORY = '~/.tmnl/harness-sessions/'

type JsonRecord = Record<string, unknown>

const splitJsonLines = (content: string): ReadonlyArray<string> =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

const withTrailingNewline = (lines: ReadonlyArray<string>): string =>
  lines.length === 0 ? '' : `${lines.join('\n')}\n`

const normalizeSessionId = (sessionId: HarnessSessionIdType | string): string =>
  String(sessionId)

const resolveStoreDirectory = (): string => {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  if (SESSION_STORE_DIRECTORY.startsWith('~/') && home.length > 0) {
    return `${home}/${SESSION_STORE_DIRECTORY.slice(2)}`.replace(/\/+$|\\+$/g, '')
  }
  return SESSION_STORE_DIRECTORY.replace(/\/+$|\\+$/g, '')
}

const toStoreError = (code: string, message: string) => (cause: unknown): HarnessSessionStoreError =>
  cause instanceof HarnessSessionStoreError
    ? cause
    : new HarnessSessionStoreError({
        code,
        message,
        cause: Option.some(cause),
      })

const ensureRecord = (input: unknown, code: string, message: string): Effect.Effect<JsonRecord, HarnessSessionStoreError> =>
  typeof input === 'object' && input !== null
    ? Effect.succeed(input as JsonRecord)
    : Effect.fail(
        new HarnessSessionStoreError({
          code,
          message,
          cause: Option.some(input),
        }),
      )

const toEnvelopeStatus = (status: SessionStatus): HarnessSessionStatus =>
  status === 'archived' ? 'closed' : 'active'

const metaLine = (meta: HarnessSessionMeta): string =>
  JSON.stringify({
    type: 'session_meta',
    sessionId: meta.sessionId,
    name: meta.name,
    autoTitle: meta.autoTitle,
    tags: meta.tags,
    status: meta.status,
    starred: meta.starred,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    messageCount: meta.messageCount,
    tokenUsage: meta.tokenUsage,
    modelId: meta.modelId,
    provider: meta.provider,
    previewSnippet: meta.previewSnippet,
    nodeId: meta.nodeId,
    role: meta.role,
    agentId: meta.agentId,
  })

const eventLine = (envelope: HarnessEventEnvelope): string =>
  JSON.stringify({
    type: 'event',
    sessionId: envelope.sessionId,
    seq: envelope.seq,
    event: envelope.event,
    persistedAt: envelope.persistedAt,
  })

const cursorLine = (cursor: HarnessReplayCursor): string =>
  JSON.stringify({
    type: 'cursor',
    sessionId: cursor.sessionId,
    lastAppliedSeq: cursor.lastAppliedSeq,
    updatedAt: cursor.updatedAt,
  })

export const HarnessSessionStoreJSONLLive = Layer.effect(
  HarnessSessionStoreExtended,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const storeDirectory = resolveStoreDirectory()

    const sessionPath = (sessionId: HarnessSessionIdType | string): string =>
      `${storeDirectory}/${normalizeSessionId(sessionId)}${SESSION_FILE_EXTENSION}`

    const parseJsonLine = (
      line: string,
      code: string,
      message: string,
    ): Effect.Effect<JsonRecord, HarnessSessionStoreError> =>
      Effect.try({
        try: () => JSON.parse(line) as unknown,
        catch: (cause) =>
          new HarnessSessionStoreError({
            code,
            message,
            cause: Option.some(cause),
          }),
      }).pipe(Effect.flatMap((parsed) => ensureRecord(parsed, code, message)))

    const readLines = (
      path: string,
      code: string,
      message: string,
    ): Effect.Effect<ReadonlyArray<string>, HarnessSessionStoreError> =>
      fs.readFileString(path).pipe(
        Effect.map(splitJsonLines),
        Effect.mapError(toStoreError(code, message)),
      )

    const decodeMeta = (
      line: string,
      code: string,
      message: string,
    ): Effect.Effect<HarnessSessionMeta, HarnessSessionStoreError> =>
      Effect.gen(function* () {
        const parsed = yield* parseJsonLine(line, code, message)
        if (parsed.type !== 'session_meta') {
          return yield* Effect.fail(
            new HarnessSessionStoreError({
              code,
              message,
              cause: Option.some(parsed),
            }),
          )
        }

        const { type: _type, ...payload } = parsed
        return yield* Schema.decodeUnknown(HarnessSessionMeta)(payload).pipe(
          Effect.mapError(toStoreError(code, message)),
        )
      })

    const decodeEvent = (
      line: string,
      code: string,
      message: string,
    ): Effect.Effect<Option.Option<HarnessEventEnvelope>, HarnessSessionStoreError> =>
      Effect.gen(function* () {
        const parsed = yield* parseJsonLine(line, code, message)
        if (parsed.type !== 'event') {
          return Option.none()
        }

        const { type: _type, ...payload } = parsed
        const envelope = yield* Schema.decodeUnknown(HarnessEventEnvelope)(payload).pipe(
          Effect.mapError(toStoreError(code, message)),
        )
        return Option.some(envelope)
      })

    const decodeCursor = (
      line: string,
      code: string,
      message: string,
    ): Effect.Effect<Option.Option<HarnessReplayCursor>, HarnessSessionStoreError> =>
      Effect.gen(function* () {
        const parsed = yield* parseJsonLine(line, code, message)
        if (parsed.type !== 'cursor') {
          return Option.none()
        }

        const { type: _type, ...payload } = parsed
        const cursor = yield* Schema.decodeUnknown(HarnessReplayCursor)(payload).pipe(
          Effect.mapError(toStoreError(code, message)),
        )
        return Option.some(cursor)
      })

    const readMetaFromFile = (
      path: string,
      sessionId: string,
    ): Effect.Effect<HarnessSessionMeta, HarnessSessionStoreError> =>
      Effect.gen(function* () {
        const lines = yield* readLines(
          path,
          'read-session-meta-failed',
          `Failed to read session metadata for ${sessionId}`,
        )

        if (lines.length === 0) {
          return yield* Effect.fail(
            new HarnessSessionStoreError({
              code: 'invalid-session-file',
              message: `Session file for ${sessionId} does not contain a metadata header`,
              cause: Option.none(),
            }),
          )
        }

        return yield* decodeMeta(
          lines[0],
          'decode-session-meta-failed',
          `Failed to decode session metadata for ${sessionId}`,
        )
      })

    const readEventEntries = (
      path: string,
      sessionId: string,
    ): Effect.Effect<ReadonlyArray<HarnessEventEnvelope>, HarnessSessionStoreError> =>
      Effect.gen(function* () {
        const lines = yield* readLines(
          path,
          'read-events-failed',
          `Failed to read events for session ${sessionId}`,
        )

        if (lines.length <= 1) {
          return [] as ReadonlyArray<HarnessEventEnvelope>
        }

        const decoded = yield* Effect.forEach(
          lines.slice(1),
          (line) =>
            decodeEvent(
              line,
              'decode-event-failed',
              `Failed to decode event entry for session ${sessionId}`,
            ),
          { concurrency: 1 },
        )

        return decoded.flatMap((entry) => (Option.isSome(entry) ? [entry.value] : []))
      })

    const readCursorEntries = (
      path: string,
      sessionId: string,
    ): Effect.Effect<ReadonlyArray<HarnessReplayCursor>, HarnessSessionStoreError> =>
      Effect.gen(function* () {
        const lines = yield* readLines(
          path,
          'read-cursor-failed',
          `Failed to read cursor entries for session ${sessionId}`,
        )

        if (lines.length <= 1) {
          return [] as ReadonlyArray<HarnessReplayCursor>
        }

        const decoded = yield* Effect.forEach(
          lines.slice(1),
          (line) =>
            decodeCursor(
              line,
              'decode-cursor-failed',
              `Failed to decode cursor entry for session ${sessionId}`,
            ),
          { concurrency: 1 },
        )

        return decoded.flatMap((entry) => (Option.isSome(entry) ? [entry.value] : []))
      })

    const mergeMetaFromEnvelope = (
      envelope: HarnessSessionEnvelope,
      existing: Option.Option<HarnessSessionMeta>,
    ): HarnessSessionMeta => {
      const prior = Option.getOrUndefined(existing)
      const statusFromEnvelope =
        envelope.status === 'active' ? (prior?.status ?? 'active') : 'archived'
      const starred = prior?.starred ?? false
      const status = statusFromEnvelope === 'active' && starred ? 'starred' : statusFromEnvelope

      return new HarnessSessionMeta({
        sessionId: normalizeSessionId(envelope.sessionId),
        name: prior?.name ?? '',
        autoTitle: prior?.autoTitle ?? '',
        tags: prior?.tags ?? [],
        status,
        starred,
        createdAt: prior?.createdAt ?? envelope.createdAt,
        updatedAt: envelope.updatedAt,
        messageCount: prior?.messageCount ?? 0,
        tokenUsage: prior?.tokenUsage ?? { input: 0, output: 0, total: 0 },
        modelId: prior?.modelId ?? '',
        provider: prior?.provider ?? '',
        previewSnippet: prior?.previewSnippet ?? '',
        nodeId: envelope.nodeId,
        role: envelope.role,
        agentId: envelope.agentId,
      })
    }

    const applyPatch = (
      current: HarnessSessionMeta,
      partial: HarnessSessionMetaPatch,
    ): HarnessSessionMeta => {
      const patchStatus = partial.status
      const patchStarred = partial.starred
      const starred = patchStarred ?? current.starred
      const statusCandidate = patchStatus ?? current.status
      const status =
        statusCandidate === 'active' && starred ? ('starred' as const) : statusCandidate

      return new HarnessSessionMeta({
        sessionId: current.sessionId,
        name: partial.name ?? current.name,
        autoTitle: partial.autoTitle ?? current.autoTitle,
        tags: partial.tags ?? current.tags,
        status,
        starred,
        createdAt: partial.createdAt ?? current.createdAt,
        updatedAt: partial.updatedAt ?? Date.now(),
        messageCount: partial.messageCount ?? current.messageCount,
        tokenUsage: partial.tokenUsage ?? current.tokenUsage,
        modelId: partial.modelId ?? current.modelId,
        provider: partial.provider ?? current.provider,
        previewSnippet: partial.previewSnippet ?? current.previewSnippet,
        nodeId: partial.nodeId ?? current.nodeId,
        role: partial.role ?? current.role,
        agentId: partial.agentId ?? current.agentId,
      })
    }

    const upsertSession: HarnessSessionStoreShape['upsertSession'] = (session) =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(storeDirectory, { recursive: true }).pipe(
          Effect.mapError(
            toStoreError('ensure-session-store-dir-failed', 'Failed to initialize session store directory'),
          ),
        )

        const path = sessionPath(session.sessionId)
        const exists = yield* fs.exists(path).pipe(
          Effect.mapError(toStoreError('session-exists-check-failed', 'Failed to check session file existence')),
        )

        const lines = exists
          ? yield* readLines(
              path,
              'read-session-file-failed',
              `Failed to read session file for ${normalizeSessionId(session.sessionId)}`,
            )
          : ([] as ReadonlyArray<string>)

        const existingMeta =
          lines.length > 0
            ? Option.some(
                yield* decodeMeta(
                  lines[0],
                  'decode-session-header-failed',
                  `Failed to decode existing session header for ${normalizeSessionId(session.sessionId)}`,
                ),
              )
            : Option.none<HarnessSessionMeta>()

        const nextMeta = mergeMetaFromEnvelope(session, existingMeta)
        const nextLines = [metaLine(nextMeta), ...lines.slice(1)]

        yield* fs.writeFileString(path, withTrailingNewline(nextLines)).pipe(
          Effect.mapError(
            toStoreError('upsert-session-failed', `Failed to upsert session ${normalizeSessionId(session.sessionId)}`),
          ),
        )
      })

    const appendEvent: HarnessSessionStoreShape['appendEvent'] = (envelope) =>
      Effect.gen(function* () {
        const path = sessionPath(envelope.sessionId)
        const exists = yield* fs.exists(path).pipe(
          Effect.mapError(toStoreError('session-exists-check-failed', 'Failed to check session file existence')),
        )

        if (!exists) {
          return yield* Effect.fail(
            new HarnessSessionStoreError({
              code: 'session-not-found',
              message: `Cannot append event. Session ${normalizeSessionId(envelope.sessionId)} does not exist`,
              cause: Option.none(),
            }),
          )
        }

        yield* fs.writeFileString(path, `${eventLine(envelope)}\n`, { flag: 'a' }).pipe(
          Effect.mapError(
            toStoreError('append-event-failed', `Failed to append event for ${normalizeSessionId(envelope.sessionId)}`),
          ),
        )

        const currentMeta = yield* readMetaFromFile(path, normalizeSessionId(envelope.sessionId))
        const nextMeta = new HarnessSessionMeta({
          sessionId: currentMeta.sessionId,
          name: currentMeta.name,
          autoTitle: currentMeta.autoTitle,
          tags: currentMeta.tags,
          status: currentMeta.status,
          starred: currentMeta.starred,
          createdAt: currentMeta.createdAt,
          updatedAt: envelope.persistedAt,
          messageCount: currentMeta.messageCount + 1,
          tokenUsage: currentMeta.tokenUsage,
          modelId: currentMeta.modelId,
          provider: currentMeta.provider,
          previewSnippet: currentMeta.previewSnippet,
          nodeId: currentMeta.nodeId,
          role: currentMeta.role,
          agentId: currentMeta.agentId,
        })

        const lines = yield* readLines(
          path,
          'read-session-file-failed',
          `Failed to read session file for ${normalizeSessionId(envelope.sessionId)}`,
        )

        const nextLines = [metaLine(nextMeta), ...lines.slice(1)]

        yield* fs.writeFileString(path, withTrailingNewline(nextLines)).pipe(
          Effect.mapError(
            toStoreError('update-meta-after-event-failed', 'Failed to update metadata after appending event'),
          ),
        )
      })

    const loadSession: HarnessSessionStoreShape['loadSession'] = (sessionId) =>
      Effect.gen(function* () {
        const id = normalizeSessionId(sessionId)
        const path = sessionPath(sessionId)
        const exists = yield* fs.exists(path).pipe(
          Effect.mapError(toStoreError('session-exists-check-failed', 'Failed to check session file existence')),
        )

        if (!exists) {
          return Option.none<HarnessSessionEnvelope>()
        }

        const meta = yield* readMetaFromFile(path, id)
        const events = yield* readEventEntries(path, id)

        const sessionIdDecoded = yield* Schema.decodeUnknown(HarnessSessionId)(meta.sessionId).pipe(
          Effect.mapError(toStoreError('decode-session-id-failed', `Invalid session id in metadata for ${id}`)),
        )

        const roleDecoded = yield* Schema.decodeUnknown(HarnessRole)(meta.role).pipe(
          Effect.mapError(toStoreError('decode-session-role-failed', `Invalid role in metadata for ${id}`)),
        )

        const headSeq =
          events.length === 0
            ? (0 as HarnessSeq)
            : events[events.length - 1].seq

        return Option.some(
          new HarnessSessionEnvelope({
            sessionId: sessionIdDecoded,
            nodeId: meta.nodeId,
            role: roleDecoded,
            agentId: meta.agentId,
            backend: 'pi-ai',
            headSeq,
            status: toEnvelopeStatus(meta.status),
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt,
          }),
        )
      })

    const loadEventsAfter: HarnessSessionStoreShape['loadEventsAfter'] = (sessionId, fromSeq) =>
      Effect.gen(function* () {
        const id = normalizeSessionId(sessionId)
        const path = sessionPath(sessionId)
        const exists = yield* fs.exists(path).pipe(
          Effect.mapError(toStoreError('session-exists-check-failed', 'Failed to check session file existence')),
        )

        if (!exists) {
          return [] as ReadonlyArray<HarnessEventEnvelope>
        }

        const events = yield* readEventEntries(path, id)
        return Option.match(fromSeq, {
          onNone: () => events,
          onSome: (seq) => events.filter((entry) => entry.seq > seq),
        })
      })

    const saveCursor: HarnessSessionStoreShape['saveCursor'] = (cursor) =>
      Effect.gen(function* () {
        const path = sessionPath(cursor.sessionId)
        const exists = yield* fs.exists(path).pipe(
          Effect.mapError(toStoreError('session-exists-check-failed', 'Failed to check session file existence')),
        )

        if (!exists) {
          return yield* Effect.fail(
            new HarnessSessionStoreError({
              code: 'session-not-found',
              message: `Cannot save cursor. Session ${normalizeSessionId(cursor.sessionId)} does not exist`,
              cause: Option.none(),
            }),
          )
        }

        yield* fs.writeFileString(path, `${cursorLine(cursor)}\n`, { flag: 'a' }).pipe(
          Effect.mapError(
            toStoreError('save-cursor-failed', `Failed to append cursor for ${normalizeSessionId(cursor.sessionId)}`),
          ),
        )
      })

    const loadCursor: HarnessSessionStoreShape['loadCursor'] = (sessionId) =>
      Effect.gen(function* () {
        const id = normalizeSessionId(sessionId)
        const path = sessionPath(sessionId)
        const exists = yield* fs.exists(path).pipe(
          Effect.mapError(toStoreError('session-exists-check-failed', 'Failed to check session file existence')),
        )

        if (!exists) {
          return Option.none<HarnessReplayCursor>()
        }

        const cursors = yield* readCursorEntries(path, id)
        if (cursors.length === 0) {
          return Option.none<HarnessReplayCursor>()
        }

        return Option.some(cursors[cursors.length - 1])
      })

    const deleteSession: HarnessSessionStoreShape['deleteSession'] = (sessionId) =>
      fs.remove(sessionPath(sessionId), { force: true }).pipe(
        Effect.mapError(
          toStoreError('delete-session-failed', `Failed to delete session ${normalizeSessionId(sessionId)}`),
        ),
      )

    const listSessions: HarnessSessionStoreExtendedShape['listSessions'] = () =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(storeDirectory, { recursive: true }).pipe(
          Effect.mapError(
            toStoreError('ensure-session-store-dir-failed', 'Failed to initialize session store directory'),
          ),
        )

        const entries = yield* fs.readDirectory(storeDirectory).pipe(
          Effect.mapError(toStoreError('list-sessions-failed', 'Failed to list session directory entries')),
        )

        const sessionFiles = entries.filter((entry) => entry.endsWith(SESSION_FILE_EXTENSION))

        const metas = yield* Effect.forEach(
          sessionFiles,
          (fileName) =>
            Effect.gen(function* () {
              const filePath = `${storeDirectory}/${fileName}`
              const lines = yield* readLines(
                filePath,
                'read-session-file-failed',
                `Failed to read session file ${fileName}`,
              )

              if (lines.length === 0) {
                return yield* Effect.fail(
                  new HarnessSessionStoreError({
                    code: 'invalid-session-file',
                    message: `Session file ${fileName} is empty`,
                    cause: Option.none(),
                  }),
                )
              }

              return yield* decodeMeta(
                lines[0],
                'decode-session-header-failed',
                `Failed to decode session metadata in ${fileName}`,
              )
            }),
          { concurrency: 1 },
        )

        return [...metas].sort((a, b) => b.updatedAt - a.updatedAt)
      })

    const updateMeta: HarnessSessionStoreExtendedShape['updateMeta'] = (sessionId, partial) =>
      Effect.gen(function* () {
        const id = normalizeSessionId(sessionId)
        const path = sessionPath(sessionId)
        const exists = yield* fs.exists(path).pipe(
          Effect.mapError(toStoreError('session-exists-check-failed', 'Failed to check session file existence')),
        )

        if (!exists) {
          return yield* Effect.fail(
            new HarnessSessionStoreError({
              code: 'session-not-found',
              message: `Cannot update metadata. Session ${id} does not exist`,
              cause: Option.none(),
            }),
          )
        }

        const lines = yield* readLines(
          path,
          'read-session-file-failed',
          `Failed to read session file for ${id}`,
        )

        if (lines.length === 0) {
          return yield* Effect.fail(
            new HarnessSessionStoreError({
              code: 'invalid-session-file',
              message: `Session file for ${id} does not contain a metadata header`,
              cause: Option.none(),
            }),
          )
        }

        const current = yield* decodeMeta(
          lines[0],
          'decode-session-header-failed',
          `Failed to decode session metadata for ${id}`,
        )

        const nextMeta = applyPatch(current, partial)
        const nextLines = [metaLine(nextMeta), ...lines.slice(1)]

        yield* fs.writeFileString(path, withTrailingNewline(nextLines)).pipe(
          Effect.mapError(
            toStoreError('update-meta-failed', `Failed to update session metadata for ${id}`),
          ),
        )
      })

    yield* fs.makeDirectory(storeDirectory, { recursive: true }).pipe(
      Effect.mapError(
        toStoreError('ensure-session-store-dir-failed', 'Failed to initialize session store directory'),
      ),
    )

    return {
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
  }),
)

export const HarnessSessionStoreJSONLBaseLive = Layer.effect(
  HarnessSessionStore,
  Effect.gen(function* () {
    const store = yield* HarnessSessionStoreExtended

    return {
      upsertSession: store.upsertSession,
      appendEvent: store.appendEvent,
      loadSession: store.loadSession,
      loadEventsAfter: store.loadEventsAfter,
      saveCursor: store.saveCursor,
      loadCursor: store.loadCursor,
      deleteSession: store.deleteSession,
    } satisfies HarnessSessionStoreShape
  }),
)
