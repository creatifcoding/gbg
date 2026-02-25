import { Atom } from '@effect-atom/atom'
import { Either, Effect } from 'effect'
import {
  HarnessRuntime,
  HarnessRuntimeError,
  type HarnessRuntimeShape,
  type SessionListItem,
} from '@/lib/harness/HarnessRuntime'
import type { HarnessSessionId } from '@/lib/harness/schemas'
import { morphChatRegistry } from './registry'
import { harnessRuntimeAtom, statusRows$ } from '../hooks/useHarnessAdapter'

export type SessionManagerFilter = 'all' | 'starred' | 'archived'
export type SessionOperationKind = 'idle' | 'fetch' | 'rename' | 'star' | 'archive' | 'delete' | 'fork'

type SessionMutationKind = Exclude<SessionOperationKind, 'idle' | 'fetch'>

interface SessionStatusRow {
  readonly id: string
  readonly tone: 'info' | 'warn' | 'error'
  readonly text: string
  readonly details?: unknown
  readonly source: 'surface'
}

export interface SessionOperationState {
  readonly inFlight: boolean
  readonly op: SessionOperationKind
  readonly sessionId: string | null
  readonly startedAt: number | null
}

export interface SessionManagerQuery {
  readonly search: string
  readonly filter: SessionManagerFilter
}

export const sessionList$ = Atom.family((_instanceId: string) =>
  Atom.make<ReadonlyArray<SessionListItem>>([]),
)

export const sessionQuery$ = Atom.family((_instanceId: string) =>
  Atom.make<SessionManagerQuery>({
    search: '',
    filter: 'all',
  }),
)

export const sessionLoading$ = Atom.family((_instanceId: string) =>
  Atom.make<boolean>(false),
)

export const sessionError$ = Atom.family((_instanceId: string) =>
  Atom.make<string | null>(null),
)

export const sessionOperation$ = Atom.family((_instanceId: string) =>
  Atom.make<SessionOperationState>({
    inFlight: false,
    op: 'idle',
    sessionId: null,
    startedAt: null,
  }),
)

const STATUS_ROW_LIMIT = 8

const OPERATION_LABELS: Record<Exclude<SessionOperationKind, 'idle'>, string> = {
  fetch: 'session.fetch',
  rename: 'session.rename',
  star: 'session.star',
  archive: 'session.archive',
  delete: 'session.delete',
  fork: 'session.fork',
}

const sessionOpTag = (kind: Exclude<SessionOperationKind, 'idle'>) => `[${OPERATION_LABELS[kind]}]`

const formatSessionError = (error: unknown): string => {
  if (error instanceof HarnessRuntimeError) {
    return `[${error.code}] ${error.message}`
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const code = typeof record.code === 'string' ? record.code : undefined
    const message = typeof record.message === 'string'
      ? record.message
      : JSON.stringify(record)

    return code ? `[${code}] ${message}` : message
  }

  return String(error)
}

const setLoading = (instanceId: string, loading: boolean) =>
  Effect.sync(() => {
    morphChatRegistry.set(sessionLoading$(instanceId), loading)
  })

const setError = (instanceId: string, error: string | null) =>
  Effect.sync(() => {
    morphChatRegistry.set(sessionError$(instanceId), error)
  })

const setOperation = (
  instanceId: string,
  operation: SessionOperationState,
) =>
  Effect.sync(() => {
    morphChatRegistry.set(sessionOperation$(instanceId), operation)
  })

const pushSessionStatusRow = (
  instanceId: string,
  row: SessionStatusRow,
) =>
  Effect.sync(() => {
    morphChatRegistry.update(statusRows$(instanceId), (prev) => [row, ...prev].slice(0, STATUS_ROW_LIMIT))
  })

const logSessionStatus = (
  instanceId: string,
  kind: Exclude<SessionOperationKind, 'idle'>,
  tone: SessionStatusRow['tone'],
  text: string,
  details?: unknown,
) =>
  pushSessionStatusRow(instanceId, {
    id: `status-${Date.now()}-${kind}-${Math.random().toString(36).slice(2, 7)}`,
    tone,
    text: `${sessionOpTag(kind)} ${text}`,
    details,
    source: 'surface',
  })

const hydrateSessionList = (
  instanceId: string,
  runtime: HarnessRuntimeShape,
) =>
  runtime.listSessions().pipe(
    Effect.tap((sessions) =>
      Effect.sync(() => {
        morphChatRegistry.set(sessionList$(instanceId), sessions)
      }),
    ),
  )

const beginOperation = (
  instanceId: string,
  kind: Exclude<SessionOperationKind, 'idle'>,
  sessionId: string | null,
) =>
  Effect.all([
    setLoading(instanceId, true),
    setError(instanceId, null),
    setOperation(instanceId, {
      inFlight: true,
      op: kind,
      sessionId,
      startedAt: Date.now(),
    }),
  ], { concurrency: 'unbounded' }).pipe(Effect.asVoid)

const endOperation = (instanceId: string) =>
  Effect.all([
    setLoading(instanceId, false),
    setOperation(instanceId, {
      inFlight: false,
      op: 'idle',
      sessionId: null,
      startedAt: null,
    }),
  ], { concurrency: 'unbounded' }).pipe(Effect.asVoid)

const runFetch = (instanceId: string) =>
  Effect.gen(function* () {
    const runtime = yield* HarnessRuntime

    yield* beginOperation(instanceId, 'fetch', null)
    yield* logSessionStatus(instanceId, 'fetch', 'info', 'Fetching latest session index…')

    const hydrated = yield* hydrateSessionList(instanceId, runtime).pipe(Effect.either)

    if (Either.isRight(hydrated)) {
      yield* logSessionStatus(instanceId, 'fetch', 'info', 'Session index synchronized.')
      return
    }

    const message = formatSessionError(hydrated.left)
    yield* setError(instanceId, message)
    yield* logSessionStatus(instanceId, 'fetch', 'error', message, hydrated.left)
  }).pipe(
    Effect.ensuring(endOperation(instanceId)),
    Effect.catchAll(() => Effect.void),
  )

interface SessionMutationConfig<A> {
  readonly instanceId: string
  readonly kind: SessionMutationKind
  readonly sessionId: string
  readonly optimistic: (sessions: ReadonlyArray<SessionListItem>) => ReadonlyArray<SessionListItem>
  readonly execute: (
    runtime: HarnessRuntimeShape,
    baselineSessions: ReadonlyArray<SessionListItem>,
  ) => Effect.Effect<A, HarnessRuntimeError>
  readonly successText?: (result: A) => string
}

const runMutation = <A>({
  instanceId,
  kind,
  sessionId,
  optimistic,
  execute,
  successText,
}: SessionMutationConfig<A>) =>
  Effect.gen(function* () {
    const runtime = yield* HarnessRuntime
    const baselineSessions = morphChatRegistry.get(sessionList$(instanceId))

    yield* beginOperation(instanceId, kind, sessionId)

    yield* Effect.sync(() => {
      morphChatRegistry.set(sessionList$(instanceId), optimistic(baselineSessions))
    })

    yield* logSessionStatus(instanceId, kind, 'info', 'Optimistic update applied.')

    const outcome = yield* Effect.gen(function* () {
      const result = yield* execute(runtime, baselineSessions)
      yield* hydrateSessionList(instanceId, runtime)
      return result
    }).pipe(Effect.either)

    if (Either.isRight(outcome)) {
      const text = successText ? successText(outcome.right) : 'Server state synchronized.'
      yield* logSessionStatus(instanceId, kind, 'info', text)
      return outcome.right
    }

    const rollback = yield* hydrateSessionList(instanceId, runtime).pipe(Effect.either)

    if (Either.isLeft(rollback)) {
      yield* Effect.sync(() => {
        morphChatRegistry.set(sessionList$(instanceId), baselineSessions)
      })
    }

    const message = formatSessionError(outcome.left)
    yield* setError(instanceId, message)
    yield* logSessionStatus(instanceId, kind, 'error', message, outcome.left)

    return undefined as A | undefined
  }).pipe(
    Effect.ensuring(endOperation(instanceId)),
    Effect.catchAll(() => Effect.succeed(undefined as A | undefined)),
  )

export const fetchSessionsOp$ = harnessRuntimeAtom.fn<{
  readonly instanceId: string
}>()(({ instanceId }, _ctx) =>
  runFetch(instanceId),
)

export const renameSessionOp$ = harnessRuntimeAtom.fn<{
  readonly instanceId: string
  readonly sessionId: string
  readonly name: string
}>()(({ instanceId, sessionId, name }, _ctx) =>
  runMutation<void>({
    instanceId,
    kind: 'rename',
    sessionId,
    optimistic: (sessions) =>
      sessions.map((session) =>
        session.sessionId === sessionId
          ? {
              ...session,
              name,
              updatedAt: Date.now(),
            }
          : session,
      ),
    execute: (runtime, _baselineSessions) =>
      runtime.updateSessionMeta(sessionId as HarnessSessionId, {
        name,
      }),
  }).pipe(Effect.asVoid),
)

export const starSessionOp$ = harnessRuntimeAtom.fn<{
  readonly instanceId: string
  readonly sessionId: string
}>()(({ instanceId, sessionId }, _ctx) =>
  runMutation<void>({
    instanceId,
    kind: 'star',
    sessionId,
    optimistic: (sessions) =>
      sessions.map((session) => {
        if (session.sessionId !== sessionId) return session

        const starred = !session.starred
        const status = session.status === 'archived'
          ? 'archived'
          : starred
            ? 'starred'
            : 'active'

        return {
          ...session,
          starred,
          status,
          updatedAt: Date.now(),
        }
      }),
    execute: (runtime, baselineSessions) => {
      const current = baselineSessions.find((entry) => entry.sessionId === sessionId)
      const starred = current ? !current.starred : true
      const status = current?.status === 'archived'
        ? 'archived'
        : starred
          ? 'starred'
          : 'active'

      return runtime.updateSessionMeta(sessionId as HarnessSessionId, {
        starred,
        status,
      })
    },
  }).pipe(Effect.asVoid),
)

export const archiveSessionOp$ = harnessRuntimeAtom.fn<{
  readonly instanceId: string
  readonly sessionId: string
}>()(({ instanceId, sessionId }, _ctx) =>
  runMutation<void>({
    instanceId,
    kind: 'archive',
    sessionId,
    optimistic: (sessions) =>
      sessions.map((session) => {
        if (session.sessionId !== sessionId) return session

        const archived = session.status !== 'archived'
        const status = archived
          ? 'archived'
          : session.starred
            ? 'starred'
            : 'active'

        return {
          ...session,
          status,
          updatedAt: Date.now(),
        }
      }),
    execute: (runtime, baselineSessions) => {
      const current = baselineSessions.find((entry) => entry.sessionId === sessionId)
      const archived = current?.status !== 'archived'
      const status = archived
        ? 'archived'
        : current?.starred
          ? 'starred'
          : 'active'

      return runtime.updateSessionMeta(sessionId as HarnessSessionId, {
        status,
      })
    },
  }).pipe(Effect.asVoid),
)

export const deleteSessionOp$ = harnessRuntimeAtom.fn<{
  readonly instanceId: string
  readonly sessionId: string
}>()(({ instanceId, sessionId }, _ctx) =>
  runMutation<void>({
    instanceId,
    kind: 'delete',
    sessionId,
    optimistic: (sessions) => sessions.filter((session) => session.sessionId !== sessionId),
    execute: (runtime, _baselineSessions) => runtime.deleteSession(sessionId as HarnessSessionId),
  }).pipe(Effect.asVoid),
)

export const forkSessionOp$ = harnessRuntimeAtom.fn<{
  readonly instanceId: string
  readonly sessionId: string
  readonly atSeq?: number
}>()(({ instanceId, sessionId, atSeq }, _ctx) =>
  runMutation<{ readonly sessionId: string }>({
    instanceId,
    kind: 'fork',
    sessionId,
    optimistic: (sessions) => sessions,
    execute: (runtime, _baselineSessions) => runtime.forkSession(sessionId as HarnessSessionId, atSeq),
    successText: (forked) => `Fork created as ${forked.sessionId}.`,
  }),
)
