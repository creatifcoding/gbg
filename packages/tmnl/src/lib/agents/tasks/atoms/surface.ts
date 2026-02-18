/**
 * AgentTask Log Atom Surface (DI-able)
 *
 * Provides a Context.Tag service whose shape exposes all log-view atoms.
 * This allows callers to inject different runtime layers (mock, NATS, NATS+micro)
 * without hard-coding atom/runtime wiring at import sites.
 *
 * @module agent-task/atoms/surface
 */

import { Atom } from '@effect-atom/atom'
import { Context, DateTime, Effect, HashSet, Layer, Stream } from 'effect'

import {
  applyFilters as applyQueryDslFilters,
  emptyQuery,
  isEmpty,
  isValidRegex,
  parseQuery,
  type ParsedQuery,
  type SearchableItem,
} from '../../../search/query'
import type { LogLevel } from '../schemas/log-level'
import type { AssembledLogEntry } from '../services/CodecService'
import { AgentTaskService } from '../services/AgentTaskService'
import {
  AgentTaskServiceMock,
  AgentTaskServiceNats,
  AgentTaskServiceNatsMicro,
} from '../services/layers'

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

/** Log view filter configuration. */
export interface LogFilterState {
  /** Minimum severity threshold */
  readonly minLevel: LogLevel
  /** Parsed QueryDSL object (source of truth for query state) */
  readonly query: ParsedQuery
  /** Substring match on source field */
  readonly source: string
  /** Optional time range bounds (epoch ms) */
  readonly timeRange: {
    readonly start: number | null
    readonly end: number | null
  }
  /** Optional regex pattern for message matching */
  readonly regex: string
}

/** Log view scroll mode. */
export type TailMode = 'tail' | 'inspect'

/** Default filter state — show everything. */
export const DEFAULT_FILTER: LogFilterState = {
  minLevel: 'DEBUG',
  query: emptyQuery(),
  source: '',
  timeRange: { start: null, end: null },
  regex: '',
}

// ---------------------------------------------------------------------------
// Atom surface shape
// ---------------------------------------------------------------------------

export interface AgentTaskLogAtomSurfaceAtoms {
  readonly logRuntimeAtom: ReturnType<typeof Atom.runtime>
  readonly logBufferFamily: ReturnType<typeof Atom.family<string, Atom.Writable<ReadonlyArray<AssembledLogEntry>>>>
  readonly logStreamTrigger: ReturnType<ReturnType<typeof Atom.runtime>['fn<string>']>
  readonly logFilterAtom: Atom.Writable<LogFilterState>
  readonly tailModeFamily: ReturnType<typeof Atom.family<string, Atom.Writable<TailMode>>>
  readonly unreadCountFamily: ReturnType<typeof Atom.family<string, Atom.Writable<number>>>
  readonly filteredLogBufferFamily: ReturnType<typeof Atom.family<string, Atom.Atom<ReadonlyArray<AssembledLogEntry>>>>
  readonly logCountFamily: ReturnType<typeof Atom.family<string, Atom.Atom<number>>>
  readonly logTotalCountFamily: ReturnType<typeof Atom.family<string, Atom.Atom<number>>>
}

// ---------------------------------------------------------------------------
// Retention policy (bounded state)
// ---------------------------------------------------------------------------

export interface LogRetentionPolicy {
  readonly maxEntriesPerTask: number
  readonly maxTaskBuffers: number
  readonly idleTtlMs: number
}

export const DEFAULT_LOG_RETENTION_POLICY: LogRetentionPolicy = {
  maxEntriesPerTask: 1000,
  maxTaskBuffers: 64,
  idleTtlMs: 15 * 60 * 1000,
}

export const applyPerTaskEntryCap = (
  entries: ReadonlyArray<AssembledLogEntry>,
  maxEntriesPerTask: number,
): ReadonlyArray<AssembledLogEntry> => {
  if (maxEntriesPerTask <= 0) return []
  if (entries.length <= maxEntriesPerTask) return entries
  return entries.slice(entries.length - maxEntriesPerTask)
}

export const touchLruOrder = (
  currentOrder: ReadonlyArray<string>,
  taskId: string,
): ReadonlyArray<string> => {
  const withoutTask = currentOrder.filter((id) => id !== taskId)
  return [...withoutTask, taskId]
}

export type TaskLastSeenEntries = ReadonlyArray<
  readonly [taskId: string, lastSeenEpochMs: number]
>

const lookupLastSeen = (
  lastSeenEntries: TaskLastSeenEntries,
  taskId: string,
): number | undefined =>
  lastSeenEntries.find(([id]) => id === taskId)?.[1]

const upsertLastSeen = (
  lastSeenEntries: TaskLastSeenEntries,
  taskId: string,
  nowEpochMs: number,
): TaskLastSeenEntries => {
  const next = lastSeenEntries.filter(([id]) => id !== taskId)
  return [...next, [taskId, nowEpochMs] as const]
}

const removeLastSeenEntries = (
  lastSeenEntries: TaskLastSeenEntries,
  taskIds: ReadonlyArray<string>,
): TaskLastSeenEntries => {
  if (taskIds.length === 0) return lastSeenEntries
  const removedSet = HashSet.fromIterable(taskIds)
  return lastSeenEntries.filter(([taskId]) => !HashSet.has(removedSet, taskId))
}

export const selectEvictedTaskIds = (
  lruOrder: ReadonlyArray<string>,
  lastSeenEpochMs: TaskLastSeenEntries,
  nowEpochMs: number,
  activeTaskId: string,
  policy: LogRetentionPolicy,
): ReadonlyArray<string> => {
  const ttlEvictions = lruOrder.filter((taskId) => {
    if (taskId === activeTaskId) return false
    const lastSeen = lookupLastSeen(lastSeenEpochMs, taskId)
    if (lastSeen === undefined) return false
    return nowEpochMs - lastSeen > policy.idleTtlMs
  })

  const ttlEvictionSet = HashSet.fromIterable(ttlEvictions)
  const afterTtl = lruOrder.filter((taskId) => !HashSet.has(ttlEvictionSet, taskId))

  const overflow = Math.max(afterTtl.length - policy.maxTaskBuffers, 0)
  if (overflow === 0) return ttlEvictions

  const lruCandidates = afterTtl.filter((taskId) => taskId !== activeTaskId)
  const lruEvictions = lruCandidates.slice(0, overflow)

  const deduped: string[] = []
  let seen = HashSet.empty<string>()
  for (const taskId of [...ttlEvictions, ...lruEvictions]) {
    if (HashSet.has(seen, taskId)) continue
    seen = HashSet.add(seen, taskId)
    deduped.push(taskId)
  }

  return deduped
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a complete log atom surface bound to a specific AgentTask layer.
 */
export const createAgentTaskLogAtomSurfaceAtoms = (
  runtimeLayer: Layer.Layer<AgentTaskService, unknown, never>,
): AgentTaskLogAtomSurfaceAtoms => {
  const logRuntimeAtom = Atom.runtime(runtimeLayer)

  const logBufferFamily = Atom.family(
    (_taskId: string) => Atom.make<ReadonlyArray<AssembledLogEntry>>([]),
  )
  const taskBufferLruAtom = Atom.make<ReadonlyArray<string>>([])
  const taskLastSeenAtom = Atom.make<TaskLastSeenEntries>([])

  const retentionPolicy = DEFAULT_LOG_RETENTION_POLICY

  const logStreamTrigger = logRuntimeAtom.fn<string>()(
    (taskId, ctx) =>
      Effect.gen(function* () {
        const svc = yield* AgentTaskService
        const bufferAtom = logBufferFamily(taskId)

        const stream = yield* svc.subscribeLogs(taskId)

        yield* stream.pipe(
          Stream.runForEach((entry) =>
            Effect.sync(() => {
              const now = Date.now()

              const current = ctx.get(bufferAtom)
              const merged = svc.mergeIntoBuffer(current, [entry])
              const bounded = applyPerTaskEntryCap(
                merged,
                retentionPolicy.maxEntriesPerTask,
              )
              ctx.set(bufferAtom, bounded)

              const currentLru = ctx.get(taskBufferLruAtom)
              const currentLastSeen = ctx.get(taskLastSeenAtom)
              const touchedLru = touchLruOrder(currentLru, taskId)
              const nextLastSeen = upsertLastSeen(currentLastSeen, taskId, now)

              const evictedTaskIds = selectEvictedTaskIds(
                touchedLru,
                nextLastSeen,
                now,
                taskId,
                retentionPolicy,
              )

              if (evictedTaskIds.length === 0) {
                ctx.set(taskBufferLruAtom, touchedLru)
                ctx.set(taskLastSeenAtom, nextLastSeen)
                return
              }

              const evictedSet = HashSet.fromIterable(evictedTaskIds)
              for (const evictedTaskId of evictedTaskIds) {
                ctx.set(logBufferFamily(evictedTaskId), [])
                ctx.set(unreadCountFamily(evictedTaskId), 0)
                ctx.set(tailModeFamily(evictedTaskId), 'tail')
              }

              ctx.set(
                taskBufferLruAtom,
                touchedLru.filter((id) => !HashSet.has(evictedSet, id)),
              )
              ctx.set(taskLastSeenAtom, removeLastSeenEntries(nextLastSeen, evictedTaskIds))
            }),
          ),
        )

        return true as const
      }),
  )

  const logFilterAtom = Atom.make<LogFilterState>(DEFAULT_FILTER)

  const tailModeFamily = Atom.family(
    (_taskId: string) => Atom.make<TailMode>('tail'),
  )

  const unreadCountFamily = Atom.family(
    (_taskId: string) => Atom.make<number>(0),
  )

  const filteredLogBufferFamily = Atom.family(
    (taskId: string) =>
      Atom.readable((get) => {
        const buffer = get(logBufferFamily(taskId))
        const filter = get(logFilterAtom)

        return applyLogFilters(buffer, filter, taskId)
      }),
  )

  const logCountFamily = Atom.family(
    (taskId: string) =>
      Atom.readable((get) => get(filteredLogBufferFamily(taskId)).length),
  )

  const logTotalCountFamily = Atom.family(
    (taskId: string) =>
      Atom.readable((get) => get(logBufferFamily(taskId)).length),
  )

  return {
    logRuntimeAtom,
    logBufferFamily,
    logStreamTrigger,
    logFilterAtom,
    tailModeFamily,
    unreadCountFamily,
    filteredLogBufferFamily,
    logCountFamily,
    logTotalCountFamily,
  }
}

// ---------------------------------------------------------------------------
// Filter implementation
// ---------------------------------------------------------------------------

export interface LogSearchableItem extends SearchableItem {
  readonly original: AssembledLogEntry
}

const renderUnknown = (value: unknown, seen = new WeakSet<object>()): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderUnknown(item, seen)).join(' ')
  }
  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]'
    seen.add(value as object)
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}:${renderUnknown(v, seen)}`)
      .join(' ')
  }
  return ''
}

export const mapAssembledLogEntryToSearchableItem = (
  entry: AssembledLogEntry,
  taskId: string,
): LogSearchableItem => {
  const metadata = renderUnknown(entry.entry.metadata)
  const payload = renderUnknown(entry.entry.payload)
  const keys = [
    entry.entry.id,
    entry.entry.source,
    entry.entry.level,
    entry.entry.traceId,
    entry.entry.spanId,
    entry.entry.toolCallId,
    entry.entry.parentTaskId,
    taskId,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')

  return {
    id: entry.key,
    name: entry.entry.message,
    description: [entry.entry.source, metadata, payload]
      .filter((part) => part.length > 0)
      .join(' '),
    category: entry.entry.level.toLowerCase(),
    scope: taskId,
    keys,
    original: entry,
  }
}

const applyLogFilters = (
  buffer: ReadonlyArray<AssembledLogEntry>,
  filter: LogFilterState,
  taskId: string,
): ReadonlyArray<AssembledLogEntry> => {
  let result = buffer

  if (filter.minLevel !== 'DEBUG') {
    const severity: Record<string, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      FATAL: 4,
    }
    const threshold = severity[filter.minLevel] ?? 0
    result = result.filter((a) => a.severityOrd >= threshold)
  }

  if (filter.source.length > 0) {
    const lower = filter.source.toLowerCase()
    result = result.filter((a) => a.entry.source.toLowerCase().includes(lower))
  }

  if (filter.timeRange.start !== null || filter.timeRange.end !== null) {
    result = result.filter((a) => {
      const ts = DateTime.toEpochMillis(a.entry.timestamp)
      if (filter.timeRange.start !== null && ts < filter.timeRange.start) return false
      if (filter.timeRange.end !== null && ts > filter.timeRange.end) return false
      return true
    })
  }

  if (filter.regex.length > 0 && isValidRegex(filter.regex)) {
    const re = new RegExp(filter.regex, 'i')
    result = result.filter((a) => re.test(a.entry.message))
  }

  if (isEmpty(filter.query)) {
    return result
  }

  return applyParsedLogSearchQuery(result, filter.query, taskId)
}

const matchesParsedText = (item: LogSearchableItem, queryText: string, caseSensitive: boolean): boolean => {
  if (queryText.length === 0) return true

  const haystack = [item.name, item.description ?? '', item.keys ?? ''].join(' ')

  if (caseSensitive) {
    return haystack.includes(queryText)
  }

  return haystack.toLowerCase().includes(queryText.toLowerCase())
}

export const applyParsedLogSearchQuery = (
  entries: ReadonlyArray<AssembledLogEntry>,
  parsed: ParsedQuery,
  taskId: string,
): ReadonlyArray<AssembledLogEntry> => {
  if (parsed.regexOperators.some((op) => !isValidRegex(op.pattern))) {
    return entries
  }

  const searchable = entries.map((entry) => mapAssembledLogEntryToSearchableItem(entry, taskId))

  const textFiltered = searchable.filter((item) =>
    matchesParsedText(item, parsed.text.trim(), parsed.caseSensitive === true),
  )

  const filtered = applyQueryDslFilters(textFiltered, parsed)
  return filtered.map((r) => r.item.original)
}

export const applyLogSearchQuery = (
  entries: ReadonlyArray<AssembledLogEntry>,
  rawQuery: string,
  taskId: string,
): ReadonlyArray<AssembledLogEntry> => {
  const normalized = rawQuery.trim()
  if (normalized.length === 0) return entries

  const parsed = Effect.runSync(parseQuery(normalized))
  return applyParsedLogSearchQuery(entries, parsed, taskId)
}

// ---------------------------------------------------------------------------
// Context.Tag service
// ---------------------------------------------------------------------------

export interface AgentTaskLogAtomSurfaceShape {
  readonly atoms: AgentTaskLogAtomSurfaceAtoms
}

export class AgentTaskLogAtomSurface extends Context.Tag(
  'AgentTask/LogAtomSurface',
)<AgentTaskLogAtomSurface, AgentTaskLogAtomSurfaceShape>() {}

export const AgentTaskLogAtomSurfaceCustom = (
  runtimeLayer: Layer.Layer<AgentTaskService, unknown, never>,
) =>
  Layer.succeed(AgentTaskLogAtomSurface, {
    atoms: createAgentTaskLogAtomSurfaceAtoms(runtimeLayer),
  } satisfies AgentTaskLogAtomSurfaceShape)

/** Default DI surface for testbed/dev usage. */
export const AgentTaskLogAtomSurfaceMock = AgentTaskLogAtomSurfaceCustom(
  AgentTaskServiceMock,
)

/** Production surface using NATS transport. */
export const AgentTaskLogAtomSurfaceNats = AgentTaskLogAtomSurfaceCustom(
  AgentTaskServiceNats,
)

/** Production+control plane surface (NATS + micro host composition). */
export const AgentTaskLogAtomSurfaceNatsMicro = AgentTaskLogAtomSurfaceCustom(
  AgentTaskServiceNatsMicro,
)

// ---------------------------------------------------------------------------
// Runtime helpers (resolve Context.Tag -> atoms for React consumers)
// ---------------------------------------------------------------------------

export interface AgentTaskLogAtomSurfaceRuntime {
  readonly runtimeAtom: ReturnType<typeof Atom.runtime>
  readonly atomSurfaceAtom: Atom.Atom<AgentTaskLogAtomSurfaceAtoms>
}

export const createAgentTaskLogAtomSurfaceRuntime = (
  surfaceLayer: Layer.Layer<AgentTaskLogAtomSurface, never, never>,
): AgentTaskLogAtomSurfaceRuntime => {
  const runtimeAtom = Atom.runtime(surfaceLayer)
  const atomSurfaceAtom = runtimeAtom.atom(
    Effect.gen(function* () {
      const surface = yield* AgentTaskLogAtomSurface
      return surface.atoms
    }),
  )

  return {
    runtimeAtom,
    atomSurfaceAtom,
  }
}

export const agentTaskLogSurfaceMockRuntime = createAgentTaskLogAtomSurfaceRuntime(
  AgentTaskLogAtomSurfaceMock,
)

export const agentTaskLogSurfaceNatsRuntime = createAgentTaskLogAtomSurfaceRuntime(
  AgentTaskLogAtomSurfaceNats,
)

export const agentTaskLogSurfaceNatsMicroRuntime = createAgentTaskLogAtomSurfaceRuntime(
  AgentTaskLogAtomSurfaceNatsMicro,
)
