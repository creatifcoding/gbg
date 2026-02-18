import * as Persistence from '@effect/experimental/Persistence'
import { DateTime, Effect, Layer, Option } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  LogArchiveChunk,
  LogArchiveManifest,
} from '../../schemas'
import { AgentTaskLogEntry } from '../../schemas/log-entry'
import {
  archiveChunkKey,
  archiveManifestKey,
  LogArchiveStoreConfigCustom,
  LogArchiveStoreService,
  LogArchiveStoreServiceLive,
} from '../LogArchiveStoreService'

const runtimeLayer = (storeId: string) =>
  LogArchiveStoreServiceLive.pipe(
    Layer.provide(LogArchiveStoreConfigCustom({ storeId })),
    Layer.provide(Persistence.layerMemory),
  )

const now = () => DateTime.unsafeNow()

const makeEntry = (id: string, taskId = 'task-1') =>
  new AgentTaskLogEntry({
    id,
    timestamp: now(),
    level: 'INFO',
    source: 'archive.test',
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
    firstDurabilitySequence: chunkIndex * 10 + 1,
    lastDurabilitySequence: chunkIndex * 10 + entries.length,
    approxBytes: entries.length * 120,
    persistedAt: now(),
  })
}

describe('LogArchiveStoreService', () => {
  it('writes and reads manifest (init + update)', async () => {
    const storeId = 'archive-store-test-manifest'

    const [initial, updated] = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* LogArchiveStoreService

        const manifestV1 = new LogArchiveManifest({
          taskId: 'task-m',
          version: 1,
          nextChunkIndex: 0,
          latestChunkIndex: 0,
          chunkCount: 0,
          totalEntries: 0,
          evictedChunkCount: 0,
          updatedAt: now(),
        })

        yield* service.writeManifest(manifestV1)
        const loadedV1 = yield* service.readManifest('task-m')

        const manifestV2 = new LogArchiveManifest({
          ...manifestV1,
          nextChunkIndex: 2,
          latestChunkIndex: 1,
          chunkCount: 2,
          totalEntries: 22,
          lastDurabilitySequence: 220,
          updatedAt: now(),
        })

        yield* service.writeManifest(manifestV2)
        const loadedV2 = yield* service.readManifest('task-m')

        return [loadedV1, loadedV2] as const
      }).pipe(Effect.provide(runtimeLayer(storeId))),
    )

    expect(Option.isSome(initial)).toBe(true)
    expect(Option.isSome(updated)).toBe(true)

    if (Option.isSome(initial)) {
      expect(initial.value.chunkCount).toBe(0)
      expect(initial.value.totalEntries).toBe(0)
    }

    if (Option.isSome(updated)) {
      expect(updated.value.chunkCount).toBe(2)
      expect(updated.value.totalEntries).toBe(22)
      expect(updated.value.latestChunkIndex).toBe(1)
    }
  })

  it('writes sequential chunks and reads deterministic inclusive ranges', async () => {
    const storeId = 'archive-store-test-range'

    const chunks = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* LogArchiveStoreService

        yield* service.writeChunk(makeChunk('task-range', 0, ['a0', 'a1']))
        yield* service.writeChunk(makeChunk('task-range', 1, ['b0', 'b1']))
        yield* service.writeChunk(makeChunk('task-range', 2, ['c0']))

        return yield* service.readChunkRange('task-range', 0, 2)
      }).pipe(Effect.provide(runtimeLayer(storeId))),
    )

    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1, 2])
    expect(chunks.flatMap((chunk) => chunk.entries.map((entry) => entry.id))).toEqual([
      'a0',
      'a1',
      'b0',
      'b1',
      'c0',
    ])
  })

  it('evicts the oldest chunk and updates manifest counters', async () => {
    const storeId = 'archive-store-test-evict'

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* LogArchiveStoreService

        const manifest = new LogArchiveManifest({
          taskId: 'task-evict',
          version: 1,
          nextChunkIndex: 3,
          latestChunkIndex: 2,
          chunkCount: 3,
          totalEntries: 5,
          evictedChunkCount: 0,
          oldestTimestamp: now(),
          newestTimestamp: now(),
          lastDurabilitySequence: 35,
          updatedAt: now(),
        })

        yield* service.writeManifest(manifest)
        yield* service.writeChunk(makeChunk('task-evict', 0, ['x0']))
        yield* service.writeChunk(makeChunk('task-evict', 1, ['x1', 'x2']))
        yield* service.writeChunk(makeChunk('task-evict', 2, ['x3', 'x4']))

        const evicted = yield* service.evictOldestChunk('task-evict')
        const chunk0 = yield* service.readChunk('task-evict', 0)
        const chunk1 = yield* service.readChunk('task-evict', 1)
        const manifestAfter = yield* service.readManifest('task-evict')

        return { evicted, chunk0, chunk1, manifestAfter }
      }).pipe(Effect.provide(runtimeLayer(storeId))),
    )

    expect(result.evicted).toBe(true)
    expect(Option.isNone(result.chunk0)).toBe(true)
    expect(Option.isSome(result.chunk1)).toBe(true)

    expect(Option.isSome(result.manifestAfter)).toBe(true)
    if (Option.isSome(result.manifestAfter)) {
      expect(result.manifestAfter.value.chunkCount).toBe(2)
      expect(result.manifestAfter.value.evictedChunkCount).toBe(1)
    }
  })

  it('recovers from decode failure by dropping corrupted payload and returning none', async () => {
    const storeId = 'archive-store-test-corruption'
    const backingMap = new Map<string, unknown>()

    const backingLayer = Layer.succeed(
      Persistence.BackingPersistence,
      Persistence.BackingPersistence.of({
        [Persistence.BackingPersistenceTypeId]:
          Persistence.BackingPersistenceTypeId,
        make: () =>
          Effect.succeed({
            get: (key: string) =>
              Effect.succeed(
                backingMap.has(key)
                  ? Option.some(backingMap.get(key) as unknown)
                  : Option.none(),
              ),
            getMany: (keys: Array<string>) =>
              Effect.succeed(
                keys.map((key) =>
                  backingMap.has(key)
                    ? Option.some(backingMap.get(key) as unknown)
                    : Option.none(),
                ),
              ),
            set: (key: string, value: unknown) =>
              Effect.sync(() => {
                backingMap.set(key, value)
              }),
            setMany: (
              entries: ReadonlyArray<
                readonly [key: string, value: unknown, ttl: Option.Option<unknown>]
              >,
            ) =>
              Effect.sync(() => {
                for (const [key, value] of entries) {
                  backingMap.set(key, value)
                }
              }),
            remove: (key: string) =>
              Effect.sync(() => {
                backingMap.delete(key)
              }),
            clear: Effect.sync(() => {
              backingMap.clear()
            }),
          }),
      }),
    )

    const badChunkKey = archiveChunkKey('task-corrupt', 9)
    const badManifestKey = archiveManifestKey('task-corrupt')
    backingMap.set(badChunkKey, { nope: true })
    backingMap.set(badManifestKey, { invalid: 'shape' })

    const state = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* LogArchiveStoreService

        const chunk = yield* service.readChunk('task-corrupt', 9)
        const manifest = yield* service.readManifest('task-corrupt')

        return {
          chunk,
          manifest,
        }
      }).pipe(
        Effect.provide(
          LogArchiveStoreServiceLive.pipe(
            Layer.provide(LogArchiveStoreConfigCustom({ storeId })),
            Layer.provide(backingLayer),
          ),
        ),
      ),
    )

    expect(Option.isNone(state.chunk)).toBe(true)
    expect(Option.isNone(state.manifest)).toBe(true)
    expect(backingMap.has(badChunkKey)).toBe(false)
    expect(backingMap.has(badManifestKey)).toBe(false)
  })
})
