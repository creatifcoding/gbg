import { Atom } from '@effect-atom/atom'
import { Either, Effect } from 'effect'
import {
  HarnessRuntime,
  HarnessRuntimeError,
  type HarnessRuntimeShape,
  type SessionListItem,
} from '@/lib/harness/HarnessRuntime'
import type { HarnessSessionId } from '@/lib/harness/schemas'
import {
  sessionRegistry,
  sessionList$ as localV2SessionList$,
} from '@/lib/harness/session/v2/atoms'
import {
  multiSessionAnnotations$,
  upsertSessionAnnotation,
} from '@/lib/harness/session/v2/multi-session-ledger'
import {
  getV2Diagnostics,
  sessionMetadataToListItem,
} from '@/lib/harness/session/v2/session-drawer-bridge'
import type {
  PiSessionListItem,
  PiSessionListOptions,
  SessionAnnotation,
  SessionRef,
} from '@/lib/harness/session/v2/pi-session-schemas'
import { sessionRefKey } from '@/lib/harness/session/v2/pi-session-schemas'
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

export interface SessionFetchDiagnostics {
  readonly lastFetchAt: number | null
  readonly serverCount: number
  readonly piCount: number
  readonly sampleSessionIds: ReadonlyArray<string>
  readonly samplePiSessionIds: ReadonlyArray<string>
  readonly source: 'remote:list_sessions' | 'remote:list_session_sources'
}

export type SessionSourceKind = 'harness' | 'pi-cli' | 'local'

export interface DrawerSessionListItem extends SessionListItem {
  readonly sourceKind: SessionSourceKind
  readonly sourceRef: SessionRef
  readonly piPath?: string
  readonly annotationDescription?: string
  readonly annotationUpdatedAt?: number
}

export type SessionV2Diagnostics = ReturnType<typeof getV2Diagnostics>

export const sessionList$ = Atom.family((_instanceId: string) =>
  Atom.make<ReadonlyArray<SessionListItem>>([]),
)

export const piSessionList$ = Atom.family((_instanceId: string) =>
  Atom.make<ReadonlyArray<PiSessionListItem>>([]),
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

export const sessionFetchDiagnostics$ = Atom.family((_instanceId: string) =>
  Atom.make<SessionFetchDiagnostics>({
    lastFetchAt: null,
    serverCount: 0,
    piCount: 0,
    sampleSessionIds: [],
    samplePiSessionIds: [],
    source: 'remote:list_sessions',
  }),
)

export const localSessionList$ = Atom.make<ReadonlyArray<SessionListItem>>([])
export const sessionAnnotations$ = Atom.make<ReadonlyArray<SessionAnnotation>>([])
export const v2SessionDiagnostics$ = Atom.make<SessionV2Diagnostics>({
  localSessionCount: 0,
  wiredInstanceCount: 0,
  wiredInstances: [],
})

const harnessSessionRef = (sessionId: string): SessionRef => ({
  _tag: 'HarnessStoredSessionRef',
  id: sessionId,
})

const piSessionToListItem = (item: PiSessionListItem): DrawerSessionListItem => ({
  sessionId: `pi-cli:${item.ref.path}`,
  name: item.name ?? '',
  autoTitle: item.title || item.ref.id,
  tags: [item.localProject ? 'current-project' : 'pi-cli', 'pi-cli'],
  status: 'active',
  starred: false,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  messageCount: item.messageCount,
  modelId: 'jsonl',
  provider: 'pi-cli',
  previewSnippet: item.preview || item.allMessagesText?.slice(0, 240) || '',
  nodeId: item.ref.cwd,
  role: 'code-assistant',
  sourceKind: 'pi-cli',
  sourceRef: item.ref,
  piPath: item.ref.path,
})

const harnessSessionToDrawerItem = (item: SessionListItem): DrawerSessionListItem => ({
  ...item,
  sourceKind: item.provider === 'local' ? 'local' : 'harness',
  sourceRef: harnessSessionRef(item.sessionId),
})

const uniqueTags = (tags: ReadonlyArray<string>): ReadonlyArray<string> => [...new Set(tags.filter(Boolean))]

const applyAnnotation = (
  session: DrawerSessionListItem,
  annotations: ReadonlyMap<string, SessionAnnotation>,
): DrawerSessionListItem => {
  const annotation = annotations.get(sessionRefKey(session.sourceRef))
  if (!annotation) return session

  const starred = session.starred || annotation.blessed
  return {
    ...session,
    name: annotation.name ?? session.name,
    tags: uniqueTags([...annotation.tags, ...session.tags]),
    starred,
    status: starred && session.status === 'active' ? 'starred' : session.status,
    previewSnippet: session.previewSnippet || annotation.description || '',
    annotationDescription: annotation.description,
    annotationUpdatedAt: annotation.updatedAt,
  }
}

const mergeHarnessAndLocalSessions = (
  serverSessions: ReadonlyArray<SessionListItem>,
  localSessions: ReadonlyArray<SessionListItem>,
): ReadonlyArray<SessionListItem> => {
  if (localSessions.length === 0) return serverSessions

  const localById = new Map<string, SessionListItem>()
  for (const item of localSessions) {
    localById.set(item.sessionId, item)
  }

  const enriched = serverSessions.map((server) => {
    const local = localById.get(server.sessionId)
    if (!local) return server
    localById.delete(server.sessionId)
    return {
      ...server,
      messageCount: Math.max(server.messageCount, local.messageCount),
      previewSnippet: server.previewSnippet.trim() || local.previewSnippet,
    }
  })

  return [...enriched, ...localById.values()]
}

/**
 * Atom-native drawer projection.
 *
 * Candidate pattern selected after checking @effect-atom/atom 0.4.x docs/source:
 * command atoms (`runtime.fn`) mutate source atoms; this derived atom performs
 * source-neutral projection. Future streaming deltas should update source
 * atoms, not the drawer hook.
 */
export const drawerSessionList$ = Atom.family((instanceId: string) =>
  Atom.make<ReadonlyArray<DrawerSessionListItem>>((get) => {
    const harnessAndLocal = mergeHarnessAndLocalSessions(
      get(sessionList$(instanceId)),
      get(localSessionList$),
    )
    const annotations = new Map(
      get(sessionAnnotations$).map((annotation) => [sessionRefKey(annotation.ref), annotation] as const),
    )

    return [
      ...harnessAndLocal.map(harnessSessionToDrawerItem),
      ...get(piSessionList$(instanceId)).map(piSessionToListItem),
    ]
      .map((session) => applyAnnotation(session, annotations))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }),
)

export const filteredDrawerSessionList$ = Atom.family((instanceId: string) =>
  Atom.make<ReadonlyArray<DrawerSessionListItem>>((get) => {
    const query = get(sessionQuery$(instanceId))
    const normalizedSearch = query.search.trim().toLowerCase()

    return get(drawerSessionList$(instanceId)).filter((session) => {
      if (query.filter === 'starred' && !session.starred) return false
      if (query.filter === 'archived' && session.status !== 'archived') return false
      if (!normalizedSearch) return true

      const haystack = [
        session.name,
        session.autoTitle,
        session.previewSnippet,
        session.annotationDescription,
        session.provider,
        session.modelId,
        session.sourceKind,
        session.piPath,
        ...session.tags,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }),
)

let cancelSessionV2Bridge: (() => void) | null = null

const syncSessionV2Bridge = () => {
  morphChatRegistry.set(
    localSessionList$,
    sessionRegistry.get(localV2SessionList$).map(sessionMetadataToListItem),
  )
  morphChatRegistry.set(sessionAnnotations$, sessionRegistry.get(multiSessionAnnotations$))
  morphChatRegistry.set(v2SessionDiagnostics$, getV2Diagnostics())
}

export function ensureSessionV2AtomBridge(): () => void {
  if (!cancelSessionV2Bridge) {
    syncSessionV2Bridge()
    const cancelLocal = sessionRegistry.subscribe(localV2SessionList$, syncSessionV2Bridge, { immediate: false })
    const cancelAnnotations = sessionRegistry.subscribe(multiSessionAnnotations$, syncSessionV2Bridge, { immediate: false })
    cancelSessionV2Bridge = () => {
      cancelLocal()
      cancelAnnotations()
      cancelSessionV2Bridge = null
    }
  }

  return () => {}
}

export function upsertDrawerSessionAnnotation(args: {
  readonly ref: SessionRef
  readonly name?: string
  readonly description?: string
  readonly summary?: SessionAnnotation['summary']
  readonly blessed?: boolean
  readonly tags?: ReadonlyArray<string>
}): SessionAnnotation {
  const annotation = upsertSessionAnnotation(args)
  syncSessionV2Bridge()
  return annotation
}

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

const setFetchDiagnostics = (
  instanceId: string,
  diagnostics: SessionFetchDiagnostics,
) =>
  Effect.sync(() => {
    morphChatRegistry.set(sessionFetchDiagnostics$(instanceId), diagnostics)
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
      Effect.all([
        Effect.sync(() => {
          morphChatRegistry.set(sessionList$(instanceId), sessions)
        }),
        setFetchDiagnostics(instanceId, {
          lastFetchAt: Date.now(),
          serverCount: sessions.length,
          piCount: morphChatRegistry.get(piSessionList$(instanceId)).length,
          sampleSessionIds: sessions.slice(0, 5).map((session) => session.sessionId),
          samplePiSessionIds: morphChatRegistry.get(piSessionList$(instanceId)).slice(0, 5).map((session) => session.ref.id),
          source: 'remote:list_sessions',
        }),
      ], { concurrency: 'unbounded' }).pipe(Effect.asVoid),
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
    yield* beginOperation(instanceId, 'fetch', null)
    yield* logSessionStatus(instanceId, 'fetch', 'info', 'Fetching latest session index…')

    const runtime = yield* HarnessRuntime
    const hydrated = yield* hydrateSessionList(instanceId, runtime).pipe(Effect.either)

    if (Either.isRight(hydrated)) {
      const sessions = hydrated.right
      yield* logSessionStatus(
        instanceId,
        'fetch',
        'info',
        `Session index synchronized (${sessions.length} sessions).`,
        {
          serverCount: sessions.length,
          sampleSessionIds: sessions.slice(0, 5).map((session) => session.sessionId),
        },
      )
      return
    }

    const message = formatSessionError(hydrated.left)
    yield* setError(instanceId, message)
    yield* logSessionStatus(instanceId, 'fetch', 'error', message, hydrated.left)
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        const message = formatSessionError(error)
        yield* setError(instanceId, message)
        yield* logSessionStatus(instanceId, 'fetch', 'error', message, error)
      }),
    ),
    Effect.ensuring(endOperation(instanceId)),
  )

const runRefreshSessionSources = (
  instanceId: string,
  options?: PiSessionListOptions,
) =>
  Effect.gen(function* () {
    yield* beginOperation(instanceId, 'fetch', null)
    yield* logSessionStatus(instanceId, 'fetch', 'info', 'Refreshing harness + pi CLI session sources…')

    const runtime = yield* HarnessRuntime
    const [serverResult, piResult] = yield* Effect.all([
      runtime.listSessions().pipe(Effect.either),
      runtime.listPiSessions(options).pipe(Effect.either),
    ], { concurrency: 'unbounded' })

    const serverSessions = Either.isRight(serverResult)
      ? serverResult.right
      : morphChatRegistry.get(sessionList$(instanceId))
    const piSessions = Either.isRight(piResult)
      ? piResult.right.sessions
      : morphChatRegistry.get(piSessionList$(instanceId))

    if (Either.isRight(serverResult)) {
      morphChatRegistry.set(sessionList$(instanceId), serverResult.right)
    }
    if (Either.isRight(piResult)) {
      morphChatRegistry.set(piSessionList$(instanceId), piResult.right.sessions)
    }

    yield* setFetchDiagnostics(instanceId, {
      lastFetchAt: Date.now(),
      serverCount: serverSessions.length,
      piCount: piSessions.length,
      sampleSessionIds: serverSessions.slice(0, 5).map((session) => session.sessionId),
      samplePiSessionIds: piSessions.slice(0, 5).map((session) => session.ref.id),
      source: 'remote:list_session_sources',
    })

    if (Either.isRight(serverResult)) {
      yield* logSessionStatus(
        instanceId,
        'fetch',
        'info',
        `Harness session index synchronized (${serverResult.right.length} sessions).`,
        { serverCount: serverResult.right.length },
      )
    } else {
      yield* logSessionStatus(instanceId, 'fetch', 'warn', formatSessionError(serverResult.left), serverResult.left)
    }

    if (Either.isRight(piResult)) {
      yield* logSessionStatus(
        instanceId,
        'fetch',
        'info',
        `Pi CLI session index synchronized (${piResult.right.sessions.length} sessions, ${piResult.right.elapsedMs}ms).`,
        { scope: piResult.right.scope, elapsedMs: piResult.right.elapsedMs },
      )
    } else {
      yield* logSessionStatus(instanceId, 'fetch', 'warn', formatSessionError(piResult.left), piResult.left)
    }

    if (Either.isLeft(serverResult) && Either.isLeft(piResult)) {
      const message = `${formatSessionError(serverResult.left)}; ${formatSessionError(piResult.left)}`
      yield* setError(instanceId, message)
    }
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        const message = formatSessionError(error)
        yield* setError(instanceId, message)
        yield* logSessionStatus(instanceId, 'fetch', 'error', message, error)
      }),
    ),
    Effect.ensuring(endOperation(instanceId)),
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

export const refreshSessionSourcesOp$ = harnessRuntimeAtom.fn<{
  readonly instanceId: string
  readonly piOptions?: PiSessionListOptions
}>()(({ instanceId, piOptions }, _ctx) =>
  runRefreshSessionSources(instanceId, piOptions),
)

export const fetchSessionsOp$ = harnessRuntimeAtom.fn<{
  readonly instanceId: string
}>()(({ instanceId }, _ctx) =>
  runFetch(instanceId),
)

export const fetchPiSessionsOp$ = harnessRuntimeAtom.fn<{
  readonly instanceId: string
  readonly options?: PiSessionListOptions
}>()(({ instanceId, options }, _ctx) =>
  Effect.gen(function* () {
    yield* beginOperation(instanceId, 'fetch', null)
    yield* logSessionStatus(instanceId, 'fetch', 'info', 'Fetching pi CLI session index…')

    const runtime = yield* HarnessRuntime
    const result = yield* runtime.listPiSessions(options).pipe(Effect.either)

    if (Either.isRight(result)) {
      morphChatRegistry.set(piSessionList$(instanceId), result.right.sessions)
      yield* setFetchDiagnostics(instanceId, {
        lastFetchAt: Date.now(),
        serverCount: morphChatRegistry.get(sessionList$(instanceId)).length,
        piCount: result.right.sessions.length,
        sampleSessionIds: morphChatRegistry.get(sessionList$(instanceId)).slice(0, 5).map((session) => session.sessionId),
        samplePiSessionIds: result.right.sessions.slice(0, 5).map((session) => session.ref.id),
        source: 'remote:list_session_sources',
      })
      yield* logSessionStatus(
        instanceId,
        'fetch',
        'info',
        `Pi session index synchronized (${result.right.sessions.length} sessions, ${result.right.elapsedMs}ms).`,
        { scope: result.right.scope, elapsedMs: result.right.elapsedMs },
      )
      return
    }

    const message = formatSessionError(result.left)
    yield* setError(instanceId, message)
    yield* logSessionStatus(instanceId, 'fetch', 'error', message, result.left)
  }).pipe(
    Effect.ensuring(endOperation(instanceId)),
    Effect.catchAll(() => Effect.void),
  ),
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
