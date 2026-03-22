import * as Persistence from '@effect/experimental/Persistence'
import { DateTime, Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  AgentTaskLogEntry,
  LogArchiveChunk,
  LogArchiveManifest,
} from '../../schemas'
import {
  LogArchiveStoreConfigCustom,
  LogArchiveStoreService,
  LogArchiveStoreServiceLive,
} from '../LogArchiveStoreService'
import {
  LogHydrationConfigCustom,
  LogHydrationService,
  LogHydrationServiceLive,
} from '../LogHydrationService'

const now = () => DateTime.unsafeNow()

const makeEntry = (id: string, taskId: string) =>
  new AgentTaskLogEntry({
    id,
    timestamp: now(),
    level: 'INFO',
    source: 'hydration.test',
    message: `entry:${id}`,
    parentTaskId: taskId,
  })

const makeChunk = (taskId: string, chunkIndex: number, ids: ReadonlyArray<string>) => {
  const entries = ids.map((id) => makeEntry(id, taskId))
  return new LogArchiveChunk({
    taskId,
    chunkIndex,
    entryCount: entries.length,
    entries,
    oldestTimestamp: entries[0]?.timestamp,
    newestTimestamp: entries[entries.length - 1]?.timestamp,
    persistedAt: now(),
  })
}

const archiveLayer = (storeId: string) =>
  LogArchiveStoreServiceLive.pipe(
    Layer.provide(LogArchiveStoreConfigCustom({ storeId })),
    Layer.provide(Persistence.layerMemory),
  )

const runtimeLayer = (storeId: string) => {
  const store = archiveLayer(storeId)

  return Layer.mergeAll(
    store,
    LogHydrationServiceLive.pipe(
      Layer.provide(
        LogHydrationConfigCustom({
          beforeCount: 2,
          afterCount: 2,
          cacheTtlMs: 60_000,
          perTaskWindowCap: 4,
        }),
      ),
      Layer.provide(store),
    ),
  )
}

describe('LogHydrationService', () => {
  it('plans newest-first windows with bounded offsets', async () => {
    const window = await Effect.runPromise(
      Effect.gen(function* () {
        const hydration = yield* LogHydrationService
        return yield* hydration.planWindow('task-plan', -5)
      }).pipe(Effect.provide(runtimeLayer('hydration-plan-store'))),
    )

    expect(window.anchor).toBe('newest-first')
    expect(window.centerOffset).toBe(0)
    expect(window.beforeCount).toBe(2)
    expect(window.afterCount).toBe(2)
    expect(window.fromOffset).toBe(0)
    expect(window.toOffset).toBe(2)
  })

  it('hydrates from archive and reuses in-memory cache for repeat window', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const archive = yield* LogArchiveStoreService
        const hydration = yield* LogHydrationService

        yield* archive.writeManifest(
          new LogArchiveManifest({
            taskId: 'task-archive',
            version: 1,
            nextChunkIndex: 2,
            latestChunkIndex: 1,
            chunkCount: 2,
            totalEntries: 4,
            evictedChunkCount: 0,
            updatedAt: now(),
          }),
        )

        yield* archive.writeChunk(makeChunk('task-archive', 0, ['a', 'b']))
        yield* archive.writeChunk(makeChunk('task-archive', 1, ['c', 'd']))

        const window = yield* hydration.planWindow('task-archive', 0)
        const first = yield* hydration.hydrateWindow(window)
        const second = yield* hydration.hydrateWindow(window)

        return { first, second }
      }).pipe(Effect.provide(runtimeLayer('hydration-archive-store'))),
    )

    expect(result.first.source).toBe('archive')
    expect(result.first.mergedEntries.map((entry) => entry.id)).toEqual(['b', 'c', 'd'])
    expect(result.first.hasOlder).toBe(true)
    expect(result.first.hasNewer).toBe(false)

    expect(result.second.source).toBe('cache')
    expect(result.second.mergedEntries.map((entry) => entry.id)).toEqual(['b', 'c', 'd'])
  })

  it('falls back to nats source when archive is missing or chunk range has gaps', async () => {
    const [missingArchive, gapFallback] = await Effect.runPromise(
      Effect.gen(function* () {
        const archive = yield* LogArchiveStoreService
        const hydration = yield* LogHydrationService

        const missingWindow = yield* hydration.planWindow('task-missing', 3)
        const missingSlice = yield* hydration.hydrateWindow(missingWindow)

        yield* archive.writeManifest(
          new LogArchiveManifest({
            taskId: 'task-gap',
            version: 1,
            nextChunkIndex: 2,
            latestChunkIndex: 1,
            chunkCount: 2,
            totalEntries: 4,
            evictedChunkCount: 0,
            updatedAt: now(),
          }),
        )
        // Intentionally write only chunk 1 to force a range gap.
        yield* archive.writeChunk(makeChunk('task-gap', 1, ['x', 'y']))

        const gapWindow = yield* hydration.planWindow('task-gap', 0)
        const gapSlice = yield* hydration.hydrateWindow(gapWindow)

        return [missingSlice, gapSlice] as const
      }).pipe(Effect.provide(runtimeLayer('hydration-gap-store'))),
    )

    expect(missingArchive.source).toBe('nats')
    expect(missingArchive.mergedEntryCount).toBe(0)

    expect(gapFallback.source).toBe('nats')
    expect(gapFallback.mergedEntryCount).toBe(0)
  })
})
