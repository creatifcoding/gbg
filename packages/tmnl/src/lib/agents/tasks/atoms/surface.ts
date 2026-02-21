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
import {
  Context,
  DateTime,
  Effect,
  HashSet,
  Layer,
  Option,
  Stream,
} from 'effect'

import {
  applyFilters as applyQueryDslFilters,
  emptyQuery,
  isEmpty,
  isValidRegex,
  parseQuery,
  type ParsedQuery,
  type SearchableItem,
} from '../../../search/query'
import { LOG_LEVEL_SEVERITY, logLevelDataAttr, type LogLevel } from '../schemas/log-level'
import {
  AgentTaskLogEntry,
  LogArchiveChunk,
  LogArchiveManifest,
  type AgentTaskLogDurabilityReceipt,
  type HydrationSlice,
  type HydrationWindow,
} from '../schemas'
import type { AssembledLogEntry } from '../services/CodecService'
import { AgentTaskService } from '../services/AgentTaskService'
import { AgentTaskLogOutboxService } from '../services/AgentTaskLogOutboxService'
import { LogArchiveStoreService } from '../services/LogArchiveStoreService'
import { LogHydrationService } from '../services/LogHydrationService'
import {
  AgentTaskServiceMock,
  AgentTaskServiceNatsOutbox,
  AgentTaskServiceNatsOutboxMicro,
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

export interface OutboxMetrics {
  readonly pending: number
  readonly inFlight: number
  readonly retries: number
  readonly dropped: number
  readonly degraded: boolean
}

export interface HydrationCachePolicy {
  readonly cacheTtlMs: number
  readonly maxWindowsPerTask: number
}

export const DEFAULT_HYDRATION_CACHE_POLICY: HydrationCachePolicy = {
  cacheTtlMs: 5 * 60 * 1000,
  maxWindowsPerTask: 16,
}

export interface HydrationCacheEntry {
  readonly key: string
  readonly fromOffset: number
  readonly toOffset: number
  readonly source: 'cache' | 'archive' | 'nats'
  readonly slice: HydrationSlice
  readonly expiresAtEpochMs: number
  readonly touchedAtEpochMs: number
}

export interface HydrationMetrics {
  readonly windowsCached: number
  readonly loading: boolean
  readonly hasError: boolean
  readonly requests: number
  readonly cacheHits: number
  readonly archiveHits: number
  readonly natsFallbackHits: number
  readonly errors: number
}

export interface DurabilityAckLatencyBuckets {
  readonly le10ms: number
  readonly le25ms: number
  readonly le50ms: number
  readonly le100ms: number
  readonly le250ms: number
  readonly le500ms: number
  readonly le1000ms: number
  readonly gt1000ms: number
}

export interface DurabilityAckMetrics {
  readonly samples: number
  readonly minMs: number | null
  readonly maxMs: number | null
  readonly lastMs: number | null
  readonly avgMs: number | null
  readonly buckets: DurabilityAckLatencyBuckets
}

export const hydrationWindowCacheKey = (window: HydrationWindow): string =>
  `${window.anchor}:${window.fromOffset}:${window.toOffset}`

export const pruneHydrationCacheEntries = (
  entries: ReadonlyArray<HydrationCacheEntry>,
  nowEpochMs: number,
): ReadonlyArray<HydrationCacheEntry> =>
  entries.filter((entry) => entry.expiresAtEpochMs > nowEpochMs)

export const upsertHydrationCacheEntry = (
  entries: ReadonlyArray<HydrationCacheEntry>,
  incoming: HydrationCacheEntry,
  policy: HydrationCachePolicy,
): ReadonlyArray<HydrationCacheEntry> => {
  const withoutExisting = entries.filter((entry) => entry.key !== incoming.key)
  const withIncoming = [...withoutExisting, incoming]

  if (withIncoming.length <= policy.maxWindowsPerTask) {
    return withIncoming
  }

  const ordered = [...withIncoming].sort(
    (left, right) => left.touchedAtEpochMs - right.touchedAtEpochMs,
  )

  return ordered.slice(ordered.length - policy.maxWindowsPerTask)
}

const hydrationDedupeKey = (entry: AgentTaskLogEntry): string =>
  `${entry.id}:${DateTime.toEpochMillis(entry.timestamp)}`

const hydrationAssembledKey = (entry: AssembledLogEntry): string =>
  hydrationDedupeKey(entry.entry)

const formatRelativeFromNow = (timestamp: DateTime.Utc): string => {
  const diffMs = Date.now() - DateTime.toEpochMillis(timestamp)
  if (diffMs < 1_000) return 'just now'
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1_000)}s ago`
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`
  return `${Math.floor(diffMs / 86_400_000)}d ago`
}

export const assembleHydratedEntry = (entry: AgentTaskLogEntry): AssembledLogEntry => ({
  entry,
  key: entry.id,
  severityOrd: LOG_LEVEL_SEVERITY[entry.level],
  levelAttr: logLevelDataAttr(entry.level),
  timestampDisplay: DateTime.formatIso(entry.timestamp),
  relativeTime: formatRelativeFromNow(entry.timestamp),
})

export const mergeHotAndHydratedEntries = (
  hotEntries: ReadonlyArray<AssembledLogEntry>,
  hydratedEntries: ReadonlyArray<AgentTaskLogEntry>,
): ReadonlyArray<AssembledLogEntry> => {
  const deduped = new Map<string, AssembledLogEntry>()

  for (const entry of hotEntries) {
    const key = hydrationAssembledKey(entry)
    if (!deduped.has(key)) {
      deduped.set(key, entry)
    }
  }

  for (const entry of hydratedEntries) {
    const key = hydrationDedupeKey(entry)
    if (!deduped.has(key)) {
      deduped.set(key, assembleHydratedEntry(entry))
    }
  }

  return [...deduped.values()].sort((left, right) => {
    const leftTs = DateTime.toEpochMillis(left.entry.timestamp)
    const rightTs = DateTime.toEpochMillis(right.entry.timestamp)

    if (leftTs !== rightTs) {
      return leftTs - rightTs
    }

    return hydrationAssembledKey(left).localeCompare(hydrationAssembledKey(right))
  })
}

export const EMPTY_DURABILITY_ACK_BUCKETS: DurabilityAckLatencyBuckets = {
  le10ms: 0,
  le25ms: 0,
  le50ms: 0,
  le100ms: 0,
  le250ms: 0,
  le500ms: 0,
  le1000ms: 0,
  gt1000ms: 0,
}

export const EMPTY_DURABILITY_ACK_METRICS: DurabilityAckMetrics = {
  samples: 0,
  minMs: null,
  maxMs: null,
  lastMs: null,
  avgMs: null,
  buckets: EMPTY_DURABILITY_ACK_BUCKETS,
}

export const recordDurabilityAckLatency = (
  current: DurabilityAckMetrics,
  latencyMs: number,
): DurabilityAckMetrics => {
  const clampedLatency = Math.max(0, Math.trunc(latencyMs))

  const nextBuckets: DurabilityAckLatencyBuckets =
    clampedLatency <= 10
      ? { ...current.buckets, le10ms: current.buckets.le10ms + 1 }
      : clampedLatency <= 25
        ? { ...current.buckets, le25ms: current.buckets.le25ms + 1 }
        : clampedLatency <= 50
          ? { ...current.buckets, le50ms: current.buckets.le50ms + 1 }
          : clampedLatency <= 100
            ? { ...current.buckets, le100ms: current.buckets.le100ms + 1 }
            : clampedLatency <= 250
              ? { ...current.buckets, le250ms: current.buckets.le250ms + 1 }
              : clampedLatency <= 500
                ? { ...current.buckets, le500ms: current.buckets.le500ms + 1 }
                : clampedLatency <= 1000
                  ? { ...current.buckets, le1000ms: current.buckets.le1000ms + 1 }
                  : { ...current.buckets, gt1000ms: current.buckets.gt1000ms + 1 }

  const samples = current.samples + 1
  const sum = (current.avgMs ?? 0) * current.samples + clampedLatency

  return {
    samples,
    minMs: current.minMs === null ? clampedLatency : Math.min(current.minMs, clampedLatency),
    maxMs: current.maxMs === null ? clampedLatency : Math.max(current.maxMs, clampedLatency),
    lastMs: clampedLatency,
    avgMs: sum / samples,
    buckets: nextBuckets,
  }
}

export interface ArchiveSpillPendingEntry {
  readonly entry: AgentTaskLogEntry
  readonly receipt: AgentTaskLogDurabilityReceipt
}

export const ARCHIVE_SPILL_CHECKPOINT_SIZE = 100

export const shouldSpillArchiveCheckpoint = (
  pendingCount: number,
  checkpointSize = ARCHIVE_SPILL_CHECKPOINT_SIZE,
): boolean => pendingCount >= Math.max(1, checkpointSize)

export const ARCHIVE_REDACTED_VALUE = '[REDACTED]'

const ARCHIVE_SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /authorization/i,
  /api.?key/i,
  /secret/i,
  /password/i,
  /cookie/i,
  /set-cookie/i,
  /session/i,
]

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const isSensitiveArchiveKey = (key: string): boolean =>
  ARCHIVE_SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))

export const redactArchiveValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => redactArchiveValue(item))
  }

  if (!isPlainObject(value)) {
    return value
  }

  const out: Record<string, unknown> = {}

  for (const [key, nested] of Object.entries(value)) {
    out[key] = isSensitiveArchiveKey(key)
      ? ARCHIVE_REDACTED_VALUE
      : redactArchiveValue(nested)
  }

  return out
}

export const redactArchiveEntry = (entry: AgentTaskLogEntry): AgentTaskLogEntry =>
  new AgentTaskLogEntry({
    ...entry,
    metadata: entry.metadata
      ? (redactArchiveValue(entry.metadata) as Record<string, unknown>)
      : undefined,
    payload: entry.payload ? redactArchiveValue(entry.payload) : undefined,
  })

const computeEntryApproxBytes = (entry: AgentTaskLogEntry): number => {
  try {
    return JSON.stringify(entry).length
  } catch {
    return 0
  }
}

const minTimestamp = (
  entries: ReadonlyArray<AgentTaskLogEntry>,
): DateTime.Utc | undefined => {
  let min: DateTime.Utc | undefined
  for (const entry of entries) {
    if (!min) {
      min = entry.timestamp
      continue
    }

    if (DateTime.toEpochMillis(entry.timestamp) < DateTime.toEpochMillis(min)) {
      min = entry.timestamp
    }
  }
  return min
}

const maxTimestamp = (
  entries: ReadonlyArray<AgentTaskLogEntry>,
): DateTime.Utc | undefined => {
  let max: DateTime.Utc | undefined
  for (const entry of entries) {
    if (!max) {
      max = entry.timestamp
      continue
    }

    if (DateTime.toEpochMillis(entry.timestamp) > DateTime.toEpochMillis(max)) {
      max = entry.timestamp
    }
  }
  return max
}

export const buildArchiveChunkFromAckedBatch = (
  taskId: string,
  chunkIndex: number,
  batch: ReadonlyArray<ArchiveSpillPendingEntry>,
  persistedAt: DateTime.Utc,
): LogArchiveChunk => {
  const entries = batch.map((item) => redactArchiveEntry(item.entry))
  const firstReceipt = batch[0]?.receipt
  const lastReceipt = batch[batch.length - 1]?.receipt

  return new LogArchiveChunk({
    taskId,
    chunkIndex,
    entryCount: entries.length,
    entries,
    oldestTimestamp: minTimestamp(entries),
    newestTimestamp: maxTimestamp(entries),
    firstDurabilitySequence: firstReceipt?.sequence,
    lastDurabilitySequence: lastReceipt?.sequence,
    approxBytes: entries.reduce((sum, entry) => sum + computeEntryApproxBytes(entry), 0),
    persistedAt,
  })
}

export const advanceArchiveManifestAfterChunk = (
  taskId: string,
  current: Option.Option<LogArchiveManifest>,
  chunk: LogArchiveChunk,
  updatedAt: DateTime.Utc,
): LogArchiveManifest => {
  if (Option.isNone(current)) {
    return new LogArchiveManifest({
      taskId,
      version: 1,
      nextChunkIndex: chunk.chunkIndex + 1,
      latestChunkIndex: chunk.chunkIndex,
      chunkCount: 1,
      totalEntries: chunk.entryCount,
      evictedChunkCount: 0,
      oldestTimestamp: chunk.oldestTimestamp,
      newestTimestamp: chunk.newestTimestamp,
      lastDurabilitySequence: chunk.lastDurabilitySequence,
      updatedAt,
    })
  }

  const manifest = current.value

  return new LogArchiveManifest({
    ...manifest,
    nextChunkIndex: chunk.chunkIndex + 1,
    latestChunkIndex: chunk.chunkIndex,
    chunkCount: manifest.chunkCount + 1,
    totalEntries: manifest.totalEntries + chunk.entryCount,
    oldestTimestamp: manifest.oldestTimestamp ?? chunk.oldestTimestamp,
    newestTimestamp: chunk.newestTimestamp ?? manifest.newestTimestamp,
    lastDurabilitySequence: chunk.lastDurabilitySequence ?? manifest.lastDurabilitySequence,
    updatedAt,
  })
}

export interface AgentTaskLogAtomSurfaceAtoms {
  readonly logRuntimeAtom: ReturnType<typeof Atom.runtime>
  readonly logBufferFamily: ReturnType<typeof Atom.family<string, Atom.Writable<ReadonlyArray<AssembledLogEntry>>>>
  readonly logStreamTrigger: ReturnType<ReturnType<typeof Atom.runtime>['fn<string>']>
  readonly logFilterAtom: Atom.Writable<LogFilterState>
  readonly tailModeFamily: ReturnType<typeof Atom.family<string, Atom.Writable<TailMode>>>
  readonly unreadCountFamily: ReturnType<typeof Atom.family<string, Atom.Writable<number>>>
  readonly outboxPendingFamily: ReturnType<typeof Atom.family<string, Atom.Writable<number>>>
  readonly outboxInFlightFamily: ReturnType<typeof Atom.family<string, Atom.Writable<number>>>
  readonly outboxRetryCountFamily: ReturnType<typeof Atom.family<string, Atom.Writable<number>>>
  readonly outboxDroppedCountFamily: ReturnType<typeof Atom.family<string, Atom.Writable<number>>>
  readonly outboxDegradedFamily: ReturnType<typeof Atom.family<string, Atom.Writable<boolean>>>
  readonly outboxMetricsFamily: ReturnType<typeof Atom.family<string, Atom.Atom<OutboxMetrics>>>
  readonly durabilityAckMetricsFamily: ReturnType<typeof Atom.family<string, Atom.Writable<DurabilityAckMetrics>>>
  readonly archivePendingCountFamily: ReturnType<typeof Atom.family<string, Atom.Atom<number>>>
  readonly archiveDegradedFamily: ReturnType<typeof Atom.family<string, Atom.Writable<boolean>>>
  readonly hydrationCacheFamily: ReturnType<typeof Atom.family<string, Atom.Writable<ReadonlyArray<HydrationCacheEntry>>>>
  readonly hydrationLoadingFamily: ReturnType<typeof Atom.family<string, Atom.Writable<boolean>>>
  readonly hydrationErrorFamily: ReturnType<typeof Atom.family<string, Atom.Writable<string | null>>>
  readonly hydrationMetricsFamily: ReturnType<typeof Atom.family<string, Atom.Atom<HydrationMetrics>>>
  readonly hydrateWindowTrigger: ReturnType<ReturnType<typeof Atom.runtime>['fn<{ readonly taskId: string; readonly centerOffset: number }>']>
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
  const outboxDrainStartedAtom = Atom.make<boolean>(false)

  const retentionPolicy = DEFAULT_LOG_RETENTION_POLICY
  const hydrationCachePolicy = DEFAULT_HYDRATION_CACHE_POLICY

  let _streamTriggerCount = 0
  const logStreamTrigger = logRuntimeAtom.fn<string>()(
    (taskId, ctx) =>
      Effect.gen(function* () {
        _streamTriggerCount++
        const ts = new Date().toISOString().slice(11, 23)
        console.log(`[logStreamTrigger] ENTERED #${_streamTriggerCount} for taskId=${taskId} at ${ts}`)
        if (_streamTriggerCount > 5) {
          console.error(`[logStreamTrigger] RUNAWAY DETECTED — aborting after ${_streamTriggerCount} entries`)
          yield* Effect.fail(new Error('runaway guard'))
        }
        const svc = yield* AgentTaskService
        const outboxOption = yield* Effect.serviceOption(AgentTaskLogOutboxService)
        const archiveStoreOption = yield* Effect.serviceOption(LogArchiveStoreService)
        const bufferAtom = logBufferFamily(taskId)

        const updatePendingByEntry = (
          targetTaskId: string,
          entryId: string,
          direction: 'add' | 'remove',
        ) => {
          const idsAtom = outboxPendingEntryIdsFamily(targetTaskId)
          const pendingAtom = outboxPendingFamily(targetTaskId)
          const existing = ctx.get(idsAtom)

          if (direction === 'add') {
            if (existing.has(entryId)) return
            const next = new Set(existing)
            next.add(entryId)
            ctx.set(idsAtom, next)
            ctx.set(pendingAtom, ctx.get(pendingAtom) + 1)
            return
          }

          if (!existing.has(entryId)) return
          const next = new Set(existing)
          next.delete(entryId)
          ctx.set(idsAtom, next)
          ctx.set(pendingAtom, Math.max(0, ctx.get(pendingAtom) - 1))
        }

        const incrementCounter = (
          family: ReturnType<typeof Atom.family<string, Atom.Writable<number>>>,
          targetTaskId: string,
          by = 1,
        ) => {
          const atom = family(targetTaskId)
          ctx.set(atom, Math.max(0, ctx.get(atom) + by))
        }

        const decrementCounter = (
          family: ReturnType<typeof Atom.family<string, Atom.Writable<number>>>,
          targetTaskId: string,
          by = 1,
        ) => {
          const atom = family(targetTaskId)
          ctx.set(atom, Math.max(0, ctx.get(atom) - by))
        }

        const setDegraded = (targetTaskId: string) => {
          ctx.set(outboxDegradedFamily(targetTaskId), true)
        }

        const setArchiveDegraded = (targetTaskId: string) => {
          ctx.set(archiveDegradedFamily(targetTaskId), true)
          ctx.set(archiveSpillPendingFamily(targetTaskId), [])
        }

        const flushArchiveCheckpoint = (targetTaskId: string): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            if (Option.isNone(archiveStoreOption)) {
              return
            }

            if (ctx.get(archiveDegradedFamily(targetTaskId))) {
              return
            }

            const pendingAtom = archiveSpillPendingFamily(targetTaskId)
            const pending = ctx.get(pendingAtom)

            if (!shouldSpillArchiveCheckpoint(pending.length)) {
              return
            }

            const batch = pending.slice(0, ARCHIVE_SPILL_CHECKPOINT_SIZE)

            const persistedAt = yield* DateTime.now

            const manifestOption = yield* archiveStoreOption.value.readManifest(targetTaskId).pipe(
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  yield* Effect.logWarning('[AgentTaskLogSurface] archive manifest read failed').pipe(
                    Effect.annotateLogs({
                      taskId: targetTaskId,
                      tag: error._tag,
                    }),
                  )
                  yield* Effect.sync(() => {
                    setArchiveDegraded(targetTaskId)
                  })
                  return Option.none<LogArchiveManifest>()
                }),
              ),
            )

            const chunkIndex = Option.isSome(manifestOption)
              ? manifestOption.value.nextChunkIndex
              : 0
            const chunk = buildArchiveChunkFromAckedBatch(
              targetTaskId,
              chunkIndex,
              batch,
              persistedAt,
            )

            const writeChunkResult = yield* Effect.either(
              archiveStoreOption.value.writeChunk(chunk),
            )

            if (writeChunkResult._tag === 'Left') {
              yield* Effect.logWarning('[AgentTaskLogSurface] archive spill write failed').pipe(
                Effect.annotateLogs({
                  taskId: targetTaskId,
                  tag: writeChunkResult.left._tag,
                  chunkIndex,
                }),
              )
              yield* Effect.sync(() => {
                setArchiveDegraded(targetTaskId)
              })
              return
            }

            const nextManifest = advanceArchiveManifestAfterChunk(
              targetTaskId,
              manifestOption,
              chunk,
              persistedAt,
            )

            const writeManifestResult = yield* Effect.either(
              archiveStoreOption.value.writeManifest(nextManifest),
            )

            if (writeManifestResult._tag === 'Left') {
              yield* Effect.logWarning('[AgentTaskLogSurface] archive manifest write failed').pipe(
                Effect.annotateLogs({
                  taskId: targetTaskId,
                  tag: writeManifestResult.left._tag,
                  chunkIndex,
                }),
              )
              yield* Effect.sync(() => {
                setArchiveDegraded(targetTaskId)
              })
              return
            }

            ctx.set(pendingAtom, pending.slice(ARCHIVE_SPILL_CHECKPOINT_SIZE))
            ctx.set(archiveManifestFamily(targetTaskId), Option.some(nextManifest))
          }).pipe(
            Effect.withSpan('AgentTask.LogSurface.archiveSpillCheckpoint', {
              attributes: {
                taskId: targetTaskId,
                checkpointSize: ARCHIVE_SPILL_CHECKPOINT_SIZE,
              },
            }),
          )

        if (Option.isSome(outboxOption) && !ctx.get(outboxDrainStartedAtom)) {
          ctx.set(outboxDrainStartedAtom, true)

          yield* Effect.forkScoped(
            outboxOption.value
              .drainOne({
                onAttemptStart: (attempt) =>
                  Effect.sync(() => {
                    incrementCounter(outboxInFlightFamily, attempt.taskId)
                  }),
                onAttemptSuccess: (attempt, receipt) =>
                  Effect.gen(function* () {
                    yield* Effect.sync(() => {
                      decrementCounter(outboxInFlightFamily, attempt.taskId)
                      updatePendingByEntry(attempt.taskId, attempt.entryId, 'remove')

                      const ackMetricsAtom = durabilityAckMetricsFamily(attempt.taskId)
                      ctx.set(
                        ackMetricsAtom,
                        recordDurabilityAckLatency(
                          ctx.get(ackMetricsAtom),
                          receipt.publishLatencyMs,
                        ),
                      )

                      if (
                        Option.isSome(archiveStoreOption) &&
                        !ctx.get(archiveDegradedFamily(attempt.taskId))
                      ) {
                        const pendingAtom = archiveSpillPendingFamily(attempt.taskId)
                        const pending = ctx.get(pendingAtom)
                        ctx.set(pendingAtom, [
                          ...pending,
                          {
                            entry: attempt.entry,
                            receipt,
                          },
                        ])
                      }
                    })

                    if (Option.isSome(archiveStoreOption)) {
                      yield* flushArchiveCheckpoint(attempt.taskId)
                    }
                  }),
                onAttemptFailure: (failure) =>
                  Effect.sync(() => {
                    decrementCounter(outboxInFlightFamily, failure.taskId)
                    setDegraded(failure.taskId)

                    if (failure.dropped) {
                      incrementCounter(outboxDroppedCountFamily, failure.taskId)
                      updatePendingByEntry(failure.taskId, failure.entryId, 'remove')
                      return
                    }

                    incrementCounter(outboxRetryCountFamily, failure.taskId)
                  }),
              })
              .pipe(
                Effect.catchAll((error) =>
                  Effect.sync(() => {
                    if ('_tag' in error && error._tag === 'AgentTask/LogOutboxDrainError') {
                      setDegraded(taskId)
                    }
                  }),
                ),
                Effect.forever,
                Effect.ensuring(
                  Effect.sync(() => {
                    ctx.set(outboxDrainStartedAtom, false)
                  }),
                ),
                Effect.withSpan('AgentTask.LogSurface.outboxDrain'),
              ),
          )
        }

        const stream = yield* svc.subscribeLogs(taskId)
        console.log(`[logStreamTrigger] #${_streamTriggerCount} stream created, entering runForEach`)

        yield* stream.pipe(
          Stream.runForEach((entry) =>
            Effect.gen(function* () {
              console.log(`[logStreamTrigger] #${_streamTriggerCount} GOT ENTRY id=${entry.entry.id}`)
              if (Option.isSome(outboxOption)) {
                yield* outboxOption.value.enqueue(taskId, entry.entry).pipe(
                  Effect.tap(() =>
                    Effect.sync(() => {
                      updatePendingByEntry(taskId, entry.entry.id, 'add')
                    }),
                  ),
                  Effect.catchAll((error) =>
                    Effect.logWarning('[AgentTaskLogSurface] outbox enqueue failed').pipe(
                      Effect.annotateLogs({
                        taskId,
                        entryId: entry.entry.id,
                        tag: error._tag,
                      }),
                      Effect.zipRight(
                        Effect.sync(() => {
                          setDegraded(taskId)
                        }),
                      ),
                    ),
                  ),
                )
              }

              yield* Effect.sync(() => {
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
              })
            }),
          ),
        )

        console.log(`[logStreamTrigger] #${_streamTriggerCount} runForEach completed (stream ended)`)
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

  const outboxPendingFamily = Atom.family(
    (_taskId: string) => Atom.make<number>(0),
  )

  const outboxInFlightFamily = Atom.family(
    (_taskId: string) => Atom.make<number>(0),
  )

  const outboxRetryCountFamily = Atom.family(
    (_taskId: string) => Atom.make<number>(0),
  )

  const outboxDroppedCountFamily = Atom.family(
    (_taskId: string) => Atom.make<number>(0),
  )

  const outboxDegradedFamily = Atom.family(
    (_taskId: string) => Atom.make<boolean>(false),
  )

  const outboxPendingEntryIdsFamily = Atom.family(
    (_taskId: string) => Atom.make<ReadonlySet<string>>(new Set<string>()),
  )

  const outboxMetricsFamily = Atom.family(
    (taskId: string) =>
      Atom.readable((get): OutboxMetrics => ({
        pending: get(outboxPendingFamily(taskId)),
        inFlight: get(outboxInFlightFamily(taskId)),
        retries: get(outboxRetryCountFamily(taskId)),
        dropped: get(outboxDroppedCountFamily(taskId)),
        degraded: get(outboxDegradedFamily(taskId)),
      })),
  )

  const archiveManifestFamily = Atom.family(
    (_taskId: string) => Atom.make<Option.Option<LogArchiveManifest>>(Option.none()),
  )

  const archiveSpillPendingFamily = Atom.family(
    (_taskId: string) => Atom.make<ReadonlyArray<ArchiveSpillPendingEntry>>([]),
  )

  const archivePendingCountFamily = Atom.family(
    (taskId: string) =>
      Atom.readable((get) => get(archiveSpillPendingFamily(taskId)).length),
  )

  const archiveDegradedFamily = Atom.family(
    (_taskId: string) => Atom.make<boolean>(false),
  )

  const durabilityAckMetricsFamily = Atom.family(
    (_taskId: string) => Atom.make<DurabilityAckMetrics>(EMPTY_DURABILITY_ACK_METRICS),
  )

  const hydrationCacheFamily = Atom.family(
    (_taskId: string) => Atom.make<ReadonlyArray<HydrationCacheEntry>>([]),
  )

  const hydrationLoadingFamily = Atom.family(
    (_taskId: string) => Atom.make<boolean>(false),
  )

  const hydrationErrorFamily = Atom.family(
    (_taskId: string) => Atom.make<string | null>(null),
  )

  const hydrationRequestCountFamily = Atom.family(
    (_taskId: string) => Atom.make<number>(0),
  )

  const hydrationCacheHitCountFamily = Atom.family(
    (_taskId: string) => Atom.make<number>(0),
  )

  const hydrationArchiveHitCountFamily = Atom.family(
    (_taskId: string) => Atom.make<number>(0),
  )

  const hydrationNatsFallbackHitCountFamily = Atom.family(
    (_taskId: string) => Atom.make<number>(0),
  )

  const hydrationErrorCountFamily = Atom.family(
    (_taskId: string) => Atom.make<number>(0),
  )

  const hydrationMetricsFamily = Atom.family(
    (taskId: string) =>
      Atom.readable((get): HydrationMetrics => ({
        windowsCached: get(hydrationCacheFamily(taskId)).length,
        loading: get(hydrationLoadingFamily(taskId)),
        hasError: get(hydrationErrorFamily(taskId)) !== null,
        requests: get(hydrationRequestCountFamily(taskId)),
        cacheHits: get(hydrationCacheHitCountFamily(taskId)),
        archiveHits: get(hydrationArchiveHitCountFamily(taskId)),
        natsFallbackHits: get(hydrationNatsFallbackHitCountFamily(taskId)),
        errors: get(hydrationErrorCountFamily(taskId)),
      })),
  )

  const hydrateWindowTrigger = logRuntimeAtom.fn<{
    readonly taskId: string
    readonly centerOffset: number
  }>()(
    ({ taskId, centerOffset }, ctx) =>
      Effect.gen(function* () {
        const hydrationOption = yield* Effect.serviceOption(LogHydrationService)
        if (Option.isNone(hydrationOption)) {
          return Option.none<HydrationSlice>()
        }

        const loadingAtom = hydrationLoadingFamily(taskId)
        const errorAtom = hydrationErrorFamily(taskId)
        const cacheAtom = hydrationCacheFamily(taskId)

        ctx.set(loadingAtom, true)
        ctx.set(errorAtom, null)
        ctx.set(
          hydrationRequestCountFamily(taskId),
          ctx.get(hydrationRequestCountFamily(taskId)) + 1,
        )

        const nowEpochMs = Date.now()
        const prunedBefore = pruneHydrationCacheEntries(ctx.get(cacheAtom), nowEpochMs)
        if (prunedBefore.length !== ctx.get(cacheAtom).length) {
          ctx.set(cacheAtom, prunedBefore)
        }

        return yield* Effect.gen(function* () {
          const window = yield* hydrationOption.value.planWindow(taskId, centerOffset)
          const slice = yield* hydrationOption.value.hydrateWindow(window)

          const expiresAtEpochMs = Date.now() + hydrationCachePolicy.cacheTtlMs
          const cacheEntry: HydrationCacheEntry = {
            key: hydrationWindowCacheKey(window),
            fromOffset: window.fromOffset,
            toOffset: window.toOffset,
            source: slice.source,
            slice,
            expiresAtEpochMs,
            touchedAtEpochMs: Date.now(),
          }

          const nextCache = upsertHydrationCacheEntry(
            pruneHydrationCacheEntries(ctx.get(cacheAtom), Date.now()),
            cacheEntry,
            hydrationCachePolicy,
          )

          ctx.set(cacheAtom, nextCache)

          if (slice.source === 'cache') {
            ctx.set(
              hydrationCacheHitCountFamily(taskId),
              ctx.get(hydrationCacheHitCountFamily(taskId)) + 1,
            )
          } else if (slice.source === 'archive') {
            ctx.set(
              hydrationArchiveHitCountFamily(taskId),
              ctx.get(hydrationArchiveHitCountFamily(taskId)) + 1,
            )
          } else {
            ctx.set(
              hydrationNatsFallbackHitCountFamily(taskId),
              ctx.get(hydrationNatsFallbackHitCountFamily(taskId)) + 1,
            )
          }

          return Option.some(slice)
        }).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              ctx.set(errorAtom, error.message)
              ctx.set(
                hydrationErrorCountFamily(taskId),
                ctx.get(hydrationErrorCountFamily(taskId)) + 1,
              )
            }),
          ),
          Effect.catchAll(() => Effect.succeed(Option.none<HydrationSlice>())),
          Effect.ensuring(
            Effect.sync(() => {
              ctx.set(loadingAtom, false)
            }),
          ),
        )
      }).pipe(
        Effect.withSpan('AgentTask.LogSurface.hydrateWindow', {
          attributes: {
            taskId,
            centerOffset,
          },
        }),
      ),
  )

  const filteredLogBufferFamily = Atom.family(
    (taskId: string) =>
      Atom.readable((get) => {
        const hotBuffer = get(logBufferFamily(taskId))
        const filter = get(logFilterAtom)
        const hydrationCache = get(hydrationCacheFamily(taskId))

        const nowEpochMs = Date.now()
        const hydratedEntries = hydrationCache
          .filter((entry) => entry.expiresAtEpochMs > nowEpochMs)
          .flatMap((entry) => entry.slice.mergedEntries)

        const mergedBuffer = mergeHotAndHydratedEntries(hotBuffer, hydratedEntries)
        return applyLogFilters(mergedBuffer, filter, taskId)
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
    outboxPendingFamily,
    outboxInFlightFamily,
    outboxRetryCountFamily,
    outboxDroppedCountFamily,
    outboxDegradedFamily,
    outboxMetricsFamily,
    durabilityAckMetricsFamily,
    archivePendingCountFamily,
    archiveDegradedFamily,
    hydrationCacheFamily,
    hydrationLoadingFamily,
    hydrationErrorFamily,
    hydrationMetricsFamily,
    hydrateWindowTrigger,
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

/** Production surface using NATS transport + transactional outbox drain. */
export const AgentTaskLogAtomSurfaceNats = AgentTaskLogAtomSurfaceCustom(
  AgentTaskServiceNatsOutbox,
)

/** Production+control plane surface (NATS + outbox + micro host composition). */
export const AgentTaskLogAtomSurfaceNatsMicro = AgentTaskLogAtomSurfaceCustom(
  AgentTaskServiceNatsOutboxMicro,
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
