/**
 * LogHydrationService
 *
 * Plans and resolves lazy hydration windows for task logs.
 *
 * Source precedence:
 * 1) in-memory hydration cache
 * 2) local archive (manifest + chunks)
 * 3) nats fallback (placeholder slice)
 *
 * @module agent-task/services/LogHydrationService
 */

import {
  Context,
  Data,
  DateTime,
  Effect,
  Layer,
  Option,
  Ref,
} from 'effect'
import {
  HydrationSlice,
  HydrationWindow,
  type AgentTaskLogEntry,
} from '../schemas'
import {
  archiveOldestChunkIndex,
  LogArchiveStoreError,
  LogArchiveStoreService,
} from './LogArchiveStoreService'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface LogHydrationConfigShape {
  readonly beforeCount: number
  readonly afterCount: number
  readonly cacheTtlMs: number
  readonly perTaskWindowCap: number
}

export class LogHydrationConfig extends Context.Tag('AgentTask/LogHydrationConfig')<
  LogHydrationConfig,
  LogHydrationConfigShape
>() {}

export const LogHydrationConfigDefault = Layer.succeed(
  LogHydrationConfig,
  {
    beforeCount: 500,
    afterCount: 500,
    cacheTtlMs: 5 * 60 * 1000,
    perTaskWindowCap: 16,
  } satisfies LogHydrationConfigShape,
)

export const LogHydrationConfigCustom = (config: LogHydrationConfigShape) =>
  Layer.succeed(LogHydrationConfig, config)

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LogHydrationFetchError extends Data.TaggedError(
  'AgentTask/LogHydrationFetchError',
)<{
  readonly message: string
  readonly taskId: string
  readonly fromOffset: number
  readonly toOffset: number
  readonly cause?: unknown
}> {}

export type LogHydrationError = LogHydrationFetchError

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface LogHydrationServiceShape {
  readonly planWindow: (
    taskId: string,
    centerOffset: number,
  ) => Effect.Effect<HydrationWindow>

  readonly hydrateWindow: (
    window: HydrationWindow,
  ) => Effect.Effect<HydrationSlice, LogHydrationError>
}

// ---------------------------------------------------------------------------
// Context.Tag
// ---------------------------------------------------------------------------

export class LogHydrationService extends Context.Tag(
  'AgentTask/LogHydrationService',
)<LogHydrationService, LogHydrationServiceShape>() {}

// ---------------------------------------------------------------------------
// Internal cache model
// ---------------------------------------------------------------------------

type CacheEntry = {
  readonly slice: HydrationSlice
  readonly expiresAtEpochMs: number
  readonly lastAccessEpochMs: number
}

type TaskCache = Map<string, CacheEntry>
type CacheState = Map<string, TaskCache>

const windowKey = (window: HydrationWindow): string =>
  `${window.anchor}:${window.fromOffset}:${window.toOffset}`

const dedupeKey = (entry: AgentTaskLogEntry): string =>
  `${entry.id}:${DateTime.toEpochMillis(entry.timestamp)}`

const normalizeEntries = (
  entries: ReadonlyArray<AgentTaskLogEntry>,
): ReadonlyArray<AgentTaskLogEntry> => {
  const deduped = new Map<string, AgentTaskLogEntry>()

  for (const entry of entries) {
    const key = dedupeKey(entry)
    if (deduped.has(key)) continue
    deduped.set(key, entry)
  }

  return [...deduped.values()].sort((left, right) => {
    const leftTs = DateTime.toEpochMillis(left.timestamp)
    const rightTs = DateTime.toEpochMillis(right.timestamp)

    if (leftTs !== rightTs) {
      return leftTs - rightTs
    }

    return dedupeKey(left).localeCompare(dedupeKey(right))
  })
}

const buildSlice = (
  source: 'cache' | 'archive' | 'nats',
  window: HydrationWindow,
  entriesAscending: ReadonlyArray<AgentTaskLogEntry>,
  totalEntries: number,
  hydratedAt: DateTime.DateTime,
): HydrationSlice => {
  if (entriesAscending.length === 0 || totalEntries <= 0) {
    return new HydrationSlice({
      taskId: window.taskId,
      window,
      source,
      mergedEntries: [],
      mergedEntryCount: 0,
      hasOlder: false,
      hasNewer: window.fromOffset > 0,
      hydratedAt,
    })
  }

  const newestFirst = [...entriesAscending].reverse()
  const start = Math.min(window.fromOffset, newestFirst.length)
  const endInclusive = Math.min(window.toOffset, newestFirst.length - 1)
  const selectedNewestFirst =
    start <= endInclusive ? newestFirst.slice(start, endInclusive + 1) : []

  const mergedEntries = [...selectedNewestFirst].reverse()

  return new HydrationSlice({
    taskId: window.taskId,
    window,
    source,
    mergedEntries,
    mergedEntryCount: mergedEntries.length,
    hasOlder: window.toOffset < totalEntries - 1,
    hasNewer: window.fromOffset > 0,
    hydratedAt,
  })
}

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

const make = Effect.gen(function* () {
  const config = yield* LogHydrationConfig
  const archiveStore = yield* LogArchiveStoreService
  const cacheRef = yield* Ref.make<CacheState>(new Map())

  const cacheGet = (
    window: HydrationWindow,
    nowEpochMs: number,
  ): Effect.Effect<Option.Option<HydrationSlice>> =>
    Ref.modify(cacheRef, (state) => {
      const key = windowKey(window)
      const taskCache = state.get(window.taskId)
      if (!taskCache) {
        return [Option.none<HydrationSlice>(), state] as const
      }

      const pruned = new Map<string, CacheEntry>()
      for (const [k, entry] of taskCache.entries()) {
        if (entry.expiresAtEpochMs > nowEpochMs) {
          pruned.set(k, entry)
        }
      }

      const hit = pruned.get(key)
      const nextState = new Map(state)

      if (!hit) {
        nextState.set(window.taskId, pruned)
        return [Option.none<HydrationSlice>(), nextState] as const
      }

      const touched: CacheEntry = {
        ...hit,
        lastAccessEpochMs: nowEpochMs,
      }

      pruned.set(key, touched)
      nextState.set(window.taskId, pruned)

      return [
        Option.some(
          new HydrationSlice({
            ...hit.slice,
            source: 'cache',
            window,
            hydratedAt: DateTime.unsafeNow(),
          }),
        ),
        nextState,
      ] as const
    })

  const cachePut = (
    window: HydrationWindow,
    slice: HydrationSlice,
    nowEpochMs: number,
  ): Effect.Effect<void> =>
    Ref.update(cacheRef, (state) => {
      const key = windowKey(window)
      const existing = state.get(window.taskId)

      const taskCache = new Map<string, CacheEntry>()
      if (existing) {
        for (const [k, entry] of existing.entries()) {
          if (entry.expiresAtEpochMs > nowEpochMs) {
            taskCache.set(k, entry)
          }
        }
      }

      taskCache.set(key, {
        slice,
        expiresAtEpochMs: nowEpochMs + config.cacheTtlMs,
        lastAccessEpochMs: nowEpochMs,
      })

      if (taskCache.size > config.perTaskWindowCap) {
        const oldest = [...taskCache.entries()].reduce<
          readonly [string, CacheEntry] | undefined
        >((acc, candidate) => {
          if (!acc) return candidate
          return candidate[1].lastAccessEpochMs < acc[1].lastAccessEpochMs
            ? candidate
            : acc
        }, undefined)

        if (oldest) {
          taskCache.delete(oldest[0])
        }
      }

      const next = new Map(state)
      next.set(window.taskId, taskCache)
      return next
    })

  const planWindow: LogHydrationServiceShape['planWindow'] = (
    taskId,
    centerOffset,
  ) =>
    Effect.gen(function* () {
      const normalizedCenter = Math.max(0, Math.trunc(centerOffset))
      const fromOffset = Math.max(0, normalizedCenter - config.afterCount)
      const toOffset = normalizedCenter + config.beforeCount
      const requestedAt = yield* DateTime.now

      return new HydrationWindow({
        taskId,
        anchor: 'newest-first',
        centerOffset: normalizedCenter,
        beforeCount: config.beforeCount,
        afterCount: config.afterCount,
        fromOffset,
        toOffset,
        cacheTtlMs: config.cacheTtlMs,
        requestedAt,
      })
    }).pipe(
      Effect.withSpan('AgentTask.LogHydration.plan', {
        attributes: {
          taskId,
          centerOffset,
          beforeCount: config.beforeCount,
          afterCount: config.afterCount,
        },
      }),
    )

  const hydrateWindow: LogHydrationServiceShape['hydrateWindow'] = (window) =>
    Effect.gen(function* () {
      const nowEpochMs = Date.now()

      const cached = yield* cacheGet(window, nowEpochMs)
      if (Option.isSome(cached)) {
        return cached.value
      }

      const manifestOption = yield* archiveStore.readManifest(window.taskId).pipe(
        Effect.mapError(
          (cause) =>
            new LogHydrationFetchError({
              message: 'Failed to read archive manifest while hydrating window',
              taskId: window.taskId,
              fromOffset: window.fromOffset,
              toOffset: window.toOffset,
              cause,
            }),
        ),
      )

      if (Option.isNone(manifestOption) || manifestOption.value.chunkCount <= 0) {
        const fallbackSlice = new HydrationSlice({
          taskId: window.taskId,
          window,
          source: 'nats',
          mergedEntries: [],
          mergedEntryCount: 0,
          hasOlder: false,
          hasNewer: window.fromOffset > 0,
          hydratedAt: DateTime.unsafeNow(),
        })

        yield* cachePut(window, fallbackSlice, nowEpochMs)
        return fallbackSlice
      }

      const manifest = manifestOption.value
      const oldestChunkIndex = archiveOldestChunkIndex(manifest)
      const latestChunkIndex = manifest.latestChunkIndex

      const chunks = yield* archiveStore
        .readChunkRange(window.taskId, oldestChunkIndex, latestChunkIndex)
        .pipe(
          Effect.mapError(
            (cause) =>
              new LogHydrationFetchError({
                message: 'Failed to read archive chunk range while hydrating window',
                taskId: window.taskId,
                fromOffset: window.fromOffset,
                toOffset: window.toOffset,
                cause,
              }),
          ),
        )

      const expectedChunkCount = Math.max(0, latestChunkIndex - oldestChunkIndex + 1)

      // Missing chunks indicate local archive gap (eviction/corruption race) -> fallback.
      if (chunks.length < expectedChunkCount) {
        const fallbackSlice = new HydrationSlice({
          taskId: window.taskId,
          window,
          source: 'nats',
          mergedEntries: [],
          mergedEntryCount: 0,
          hasOlder: false,
          hasNewer: window.fromOffset > 0,
          hydratedAt: DateTime.unsafeNow(),
        })

        yield* cachePut(window, fallbackSlice, nowEpochMs)
        return fallbackSlice
      }

      const normalizedEntries = yield* Effect.sync(() =>
        normalizeEntries(chunks.flatMap((chunk) => chunk.entries)),
      ).pipe(
        Effect.withSpan('AgentTask.LogHydration.merge', {
          attributes: {
            taskId: window.taskId,
            chunkCount: chunks.length,
          },
        }),
      )

      const archiveSlice = buildSlice(
        'archive',
        window,
        normalizedEntries,
        manifest.totalEntries,
        DateTime.unsafeNow(),
      )

      yield* cachePut(window, archiveSlice, nowEpochMs)
      return archiveSlice
    }).pipe(
      Effect.withSpan('AgentTask.LogHydration.fetch', {
        attributes: {
          taskId: window.taskId,
          fromOffset: window.fromOffset,
          toOffset: window.toOffset,
          anchor: window.anchor,
        },
      }),
    )

  return {
    planWindow,
    hydrateWindow,
  } satisfies LogHydrationServiceShape
})

export const LogHydrationServiceLive = Layer.effect(
  LogHydrationService,
  make,
)

export const LogHydrationServiceDefault = LogHydrationServiceLive.pipe(
  Layer.provide(LogHydrationConfigDefault),
)
