/**
 * LogArchiveStoreService
 *
 * Local archive persistence for task logs (manifest + chunk storage).
 *
 * Backed by Effect experimental BackingPersistence (KeyValueStore-backed), with
 * schema encode/decode at the boundary and quota-recovery eviction semantics.
 *
 * @module agent-task/services/LogArchiveStoreService
 */

import * as Persistence from '@effect/experimental/Persistence'
import * as BrowserKeyValueStore from '@effect/platform-browser/BrowserKeyValueStore'
import {
  Context,
  Data,
  DateTime,
  Effect,
  Layer,
  Option,
  Schema,
} from 'effect'
import {
  LogArchiveChunk,
  LogArchiveChunkSchema,
  LogArchiveManifest,
  LogArchiveManifestSchema,
} from '../schemas'

// ---------------------------------------------------------------------------
// Keying conventions
// ---------------------------------------------------------------------------

export const archiveManifestKey = (taskId: string): string =>
  `task:${taskId}:manifest`

export const archiveChunkKey = (taskId: string, chunkIndex: number): string =>
  `task:${taskId}:chunk:${chunkIndex}`

export const archiveOldestChunkIndex = (
  manifest: Pick<LogArchiveManifest, 'nextChunkIndex' | 'chunkCount'>,
): number => Math.max(0, manifest.nextChunkIndex - manifest.chunkCount)

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface LogArchiveStoreConfigShape {
  readonly storeId: string
}

export class LogArchiveStoreConfig extends Context.Tag('AgentTask/LogArchiveStoreConfig')<
  LogArchiveStoreConfig,
  LogArchiveStoreConfigShape
>() {}

export const LogArchiveStoreConfigDefault = Layer.succeed(
  LogArchiveStoreConfig,
  {
    storeId: 'agent-task-logs',
  } satisfies LogArchiveStoreConfigShape,
)

export const LogArchiveStoreConfigCustom = (config: LogArchiveStoreConfigShape) =>
  Layer.succeed(LogArchiveStoreConfig, config)

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LogArchiveStoreReadError extends Data.TaggedError(
  'AgentTask/LogArchiveStoreReadError',
)<{
  readonly message: string
  readonly key: string
  readonly cause?: unknown
}> {}

export class LogArchiveStoreWriteError extends Data.TaggedError(
  'AgentTask/LogArchiveStoreWriteError',
)<{
  readonly message: string
  readonly key: string
  readonly cause?: unknown
}> {}

export class LogArchiveStoreArchiveDegradedError extends Data.TaggedError(
  'AgentTask/LogArchiveStoreArchiveDegradedError',
)<{
  readonly message: string
  readonly taskId: string
  readonly key: string
  readonly cause?: unknown
}> {}

export type LogArchiveStoreError =
  | LogArchiveStoreReadError
  | LogArchiveStoreWriteError
  | LogArchiveStoreArchiveDegradedError

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface LogArchiveStoreServiceShape {
  readonly readManifest: (
    taskId: string,
  ) => Effect.Effect<Option.Option<LogArchiveManifest>, LogArchiveStoreError>

  readonly writeManifest: (
    manifest: LogArchiveManifest,
  ) => Effect.Effect<void, LogArchiveStoreError>

  readonly readChunk: (
    taskId: string,
    chunkIndex: number,
  ) => Effect.Effect<Option.Option<LogArchiveChunk>, LogArchiveStoreError>

  readonly writeChunk: (
    chunk: LogArchiveChunk,
  ) => Effect.Effect<void, LogArchiveStoreError>

  readonly readChunkRange: (
    taskId: string,
    fromChunkIndex: number,
    toChunkIndex: number,
  ) => Effect.Effect<ReadonlyArray<LogArchiveChunk>, LogArchiveStoreError>

  readonly evictOldestChunk: (
    taskId: string,
  ) => Effect.Effect<boolean, LogArchiveStoreError>
}

// ---------------------------------------------------------------------------
// Context.Tag
// ---------------------------------------------------------------------------

export class LogArchiveStoreService extends Context.Tag(
  'AgentTask/LogArchiveStoreService',
)<LogArchiveStoreService, LogArchiveStoreServiceShape>() {}

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

const make = Effect.gen(function* () {
  const backing = yield* Persistence.BackingPersistence
  const config = yield* LogArchiveStoreConfig
  const store = yield* backing.make(config.storeId)

  const readUnknown = (key: string) =>
    store.get(key).pipe(
      Effect.mapError(
        (cause) =>
          new LogArchiveStoreReadError({
            message: `Failed to read archive key '${key}'`,
            key,
            cause,
          }),
      ),
    )

  const removeKey = (key: string) =>
    store.remove(key).pipe(
      Effect.mapError(
        (cause) =>
          new LogArchiveStoreWriteError({
            message: `Failed to remove archive key '${key}'`,
            key,
            cause,
          }),
      ),
    )

  const setUnknown = (
    key: string,
    value: unknown,
    taskIdForRecovery: string,
    message: string,
    allowRecovery: boolean,
  ): Effect.Effect<void, LogArchiveStoreError> =>
    store
      .set(key, value, Option.none())
      .pipe(
        Effect.mapError(
          (cause) =>
            new LogArchiveStoreWriteError({
              message,
              key,
              cause,
            }),
        ),
        Effect.catchAll((writeError) => {
          if (!allowRecovery) {
            return Effect.fail(writeError)
          }

          return Effect.gen(function* () {
            const evicted = yield* evictOldestChunkInternal(taskIdForRecovery, false).pipe(
              Effect.catchAll(() => Effect.succeed(false)),
            )

            if (!evicted) {
              return yield* Effect.fail(
                new LogArchiveStoreArchiveDegradedError({
                  message:
                    'Archive storage appears degraded (quota recovery unavailable)',
                  taskId: taskIdForRecovery,
                  key,
                  cause: writeError,
                }),
              )
            }

            return yield* store
              .set(key, value, Option.none())
              .pipe(
                Effect.mapError(
                  (retryCause) =>
                    new LogArchiveStoreArchiveDegradedError({
                      message: 'Archive storage degraded after quota recovery retry',
                      taskId: taskIdForRecovery,
                      key,
                      cause: retryCause,
                    }),
                ),
              )
          })
        }),
      )

  const decodeOrRecover = <A>(
    key: string,
    schema: Schema.Schema<A>,
    value: unknown,
  ): Effect.Effect<Option.Option<A>, LogArchiveStoreError> =>
    Schema.decodeUnknown(schema)(value).pipe(
      Effect.map(Option.some),
      Effect.catchAll(() =>
        Effect.as(
          Effect.ignore(removeKey(key)),
          Option.none<A>(),
        ),
      ),
    )

  const encode = <A>(
    key: string,
    schema: Schema.Schema<A>,
    value: A,
    message: string,
  ): Effect.Effect<unknown, LogArchiveStoreError> =>
    Schema.encode(schema)(value).pipe(
      Effect.mapError(
        (cause) =>
          new LogArchiveStoreWriteError({
            message,
            key,
            cause,
          }),
      ),
    )

  const readManifest: LogArchiveStoreServiceShape['readManifest'] = (taskId) =>
    Effect.gen(function* () {
      const key = archiveManifestKey(taskId)
      const stored = yield* readUnknown(key)

      if (Option.isNone(stored)) {
        return Option.none<LogArchiveManifest>()
      }

      return yield* decodeOrRecover(key, LogArchiveManifestSchema, stored.value)
    }).pipe(
      Effect.withSpan('AgentTask.LogArchive.readManifest', {
        attributes: { taskId },
      }),
    )

  const writeManifestInternal = (
    manifest: LogArchiveManifest,
    allowRecovery: boolean,
  ): Effect.Effect<void, LogArchiveStoreError> =>
    Effect.gen(function* () {
      const key = archiveManifestKey(manifest.taskId)
      const encoded = yield* encode(
        key,
        LogArchiveManifestSchema,
        manifest,
        'Failed to encode archive manifest',
      )

      yield* setUnknown(
        key,
        encoded,
        manifest.taskId,
        'Failed to write archive manifest',
        allowRecovery,
      )
    })

  const writeManifest: LogArchiveStoreServiceShape['writeManifest'] = (manifest) =>
    writeManifestInternal(manifest, true).pipe(
      Effect.withSpan('AgentTask.LogArchive.writeManifest', {
        attributes: {
          taskId: manifest.taskId,
          chunkCount: manifest.chunkCount,
        },
      }),
    )

  const readChunk: LogArchiveStoreServiceShape['readChunk'] = (taskId, chunkIndex) =>
    Effect.gen(function* () {
      const key = archiveChunkKey(taskId, chunkIndex)
      const stored = yield* readUnknown(key)

      if (Option.isNone(stored)) {
        return Option.none<LogArchiveChunk>()
      }

      return yield* decodeOrRecover(key, LogArchiveChunkSchema, stored.value)
    }).pipe(
      Effect.withSpan('AgentTask.LogArchive.readChunk', {
        attributes: { taskId, chunkIndex },
      }),
    )

  const writeChunkInternal = (
    chunk: LogArchiveChunk,
    allowRecovery: boolean,
  ): Effect.Effect<void, LogArchiveStoreError> =>
    Effect.gen(function* () {
      const key = archiveChunkKey(chunk.taskId, chunk.chunkIndex)
      const encoded = yield* encode(
        key,
        LogArchiveChunkSchema,
        chunk,
        'Failed to encode archive chunk',
      )

      yield* setUnknown(
        key,
        encoded,
        chunk.taskId,
        'Failed to write archive chunk',
        allowRecovery,
      )
    })

  const writeChunk: LogArchiveStoreServiceShape['writeChunk'] = (chunk) =>
    writeChunkInternal(chunk, true).pipe(
      Effect.withSpan('AgentTask.LogArchive.writeChunk', {
        attributes: {
          taskId: chunk.taskId,
          chunkIndex: chunk.chunkIndex,
          entryCount: chunk.entryCount,
        },
      }),
    )

  const readChunkRange: LogArchiveStoreServiceShape['readChunkRange'] = (
    taskId,
    fromChunkIndex,
    toChunkIndex,
  ) =>
    Effect.gen(function* () {
      if (fromChunkIndex > toChunkIndex) {
        return [] as ReadonlyArray<LogArchiveChunk>
      }

      const indexes = Array.from(
        { length: toChunkIndex - fromChunkIndex + 1 },
        (_, idx) => fromChunkIndex + idx,
      )

      const maybeChunks = yield* Effect.forEach(indexes, (index) =>
        readChunk(taskId, index),
      )

      return maybeChunks.flatMap((entry) =>
        Option.isSome(entry) ? [entry.value] : [],
      )
    }).pipe(
      Effect.withSpan('AgentTask.LogArchive.readChunkRange', {
        attributes: {
          taskId,
          fromChunkIndex,
          toChunkIndex,
        },
      }),
    )

  const evictOldestChunkInternal = (
    taskId: string,
    allowManifestRecovery: boolean,
  ): Effect.Effect<boolean, LogArchiveStoreError> =>
    Effect.gen(function* () {
      const manifestOption = yield* readManifest(taskId)
      if (Option.isNone(manifestOption)) {
        return false
      }

      const manifest = manifestOption.value
      if (manifest.chunkCount <= 0) {
        return false
      }

      const oldestIndex = archiveOldestChunkIndex(manifest)
      yield* removeKey(archiveChunkKey(taskId, oldestIndex))

      const remainingChunkCount = manifest.chunkCount - 1
      const now = yield* DateTime.now

      const nextOldestTimestamp =
        remainingChunkCount > 0
          ? yield* readChunk(taskId, oldestIndex + 1).pipe(
              Effect.map((nextChunk) =>
                Option.isSome(nextChunk)
                  ? (nextChunk.value.oldestTimestamp ??
                    nextChunk.value.newestTimestamp)
                  : undefined,
              ),
            )
          : undefined

      const nextManifest = new LogArchiveManifest({
        ...manifest,
        chunkCount: remainingChunkCount,
        evictedChunkCount: manifest.evictedChunkCount + 1,
        oldestTimestamp: nextOldestTimestamp,
        newestTimestamp:
          remainingChunkCount > 0 ? manifest.newestTimestamp : undefined,
        updatedAt: now,
      })

      yield* writeManifestInternal(nextManifest, allowManifestRecovery)
      return true
    })

  const evictOldestChunk: LogArchiveStoreServiceShape['evictOldestChunk'] = (taskId) =>
    evictOldestChunkInternal(taskId, true).pipe(
      Effect.withSpan('AgentTask.LogArchive.evictOldestChunk', {
        attributes: { taskId },
      }),
    )

  return {
    readManifest,
    writeManifest,
    readChunk,
    writeChunk,
    readChunkRange,
    evictOldestChunk,
  } satisfies LogArchiveStoreServiceShape
})

export const LogArchiveStoreServiceLive = Layer.scoped(
  LogArchiveStoreService,
  make,
)

export const LogArchiveStoreServiceDefault = LogArchiveStoreServiceLive.pipe(
  Layer.provide(LogArchiveStoreConfigDefault),
)

/**
 * Browser local archive binding:
 * BackingPersistence via KeyValueStore(LocalStorage).
 */
export const LogArchiveStoreBackingBrowser = Persistence.layerKeyValueStore.pipe(
  Layer.provide(BrowserKeyValueStore.layerLocalStorage),
)

/**
 * Full browser-ready archive store layer.
 */
export const LogArchiveStoreServiceBrowser = LogArchiveStoreServiceDefault.pipe(
  Layer.provide(LogArchiveStoreBackingBrowser),
)
