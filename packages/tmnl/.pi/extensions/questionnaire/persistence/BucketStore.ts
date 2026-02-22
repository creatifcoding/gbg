/**
 * BucketStore — generic S3-compatible object storage service.
 *
 * Context.Tag pattern (type-first) for maximum DI flexibility.
 * Two implementations:
 *   - S3BucketStoreLive: @effect-aws/client-s3 backed (typed errors, retries, spans)
 *   - InMemoryBucketStore: Map-backed for tests
 *
 * Designed standalone — can be used outside questionnaire context.
 *
 * @module questionnaire/persistence/BucketStore
 */

import { Effect, Context, Layer, Schema } from 'effect'
import { S3Service } from '@effect-aws/client-s3'
import type { SdkError, NoSuchKeyError } from '@effect-aws/client-s3/Errors'

import {
  type S3Config,
  S3Config as S3ConfigSchema,
  BucketStoreError,
  BucketObjectNotFoundError,
  BucketSerializationError,
  BucketConnectionError,
  BucketTimeoutError,
  BucketObject,
  ListObjectsResult,
  type BucketError,
} from './schemas.ts'

// =============================================================================
// Service Shape — the contract
// =============================================================================

export interface BucketStoreShape {
  readonly put: <A, I>(
    key: string,
    value: A,
    schema: Schema.Schema<A, I>,
  ) => Effect.Effect<void, BucketStoreError | BucketSerializationError>

  readonly putRaw: (
    key: string,
    body: string | Uint8Array,
    contentType?: string,
  ) => Effect.Effect<void, BucketStoreError>

  readonly get: <A, I>(
    key: string,
    schema: Schema.Schema<A, I>,
  ) => Effect.Effect<A | null, BucketStoreError | BucketSerializationError>

  readonly getRaw: (
    key: string,
  ) => Effect.Effect<string | null, BucketStoreError>

  readonly require: <A, I>(
    key: string,
    schema: Schema.Schema<A, I>,
  ) => Effect.Effect<A, BucketObjectNotFoundError | BucketStoreError | BucketSerializationError>

  readonly del: (
    key: string,
  ) => Effect.Effect<void, BucketStoreError>

  readonly exists: (
    key: string,
  ) => Effect.Effect<boolean, BucketStoreError>

  readonly head: (
    key: string,
  ) => Effect.Effect<BucketObject | null, BucketStoreError>

  readonly list: (
    prefix: string,
    options?: { maxKeys?: number; continuationToken?: string },
  ) => Effect.Effect<ListObjectsResult, BucketStoreError>

  readonly listAll: (
    prefix: string,
  ) => Effect.Effect<ReadonlyArray<BucketObject>, BucketStoreError>

  readonly isReady: () => Effect.Effect<boolean, never>
}

// =============================================================================
// Service Tag
// =============================================================================

export class BucketStore extends Context.Tag('questionnaire/BucketStore')<
  BucketStore,
  BucketStoreShape
>() {}

// =============================================================================
// Config Tag — S3 connection configuration
// =============================================================================

export class BucketStoreConfig extends Context.Tag('questionnaire/BucketStoreConfig')<
  BucketStoreConfig,
  S3Config
>() {
  /** MinIO local development defaults */
  static readonly MinIO = Layer.succeed(BucketStoreConfig, new S3ConfigSchema({
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    bucket: 'questionnaires',
    forcePathStyle: true,
    keyPrefix: '',
  }))

  /** Custom config */
  static readonly Custom = (config: S3Config) =>
    Layer.succeed(BucketStoreConfig, config)
}

// =============================================================================
// Error mapping — @effect-aws errors → BucketStore domain errors
// =============================================================================

/**
 * Extract forensic data from @effect-aws / AWS SDK errors.
 *
 * @effect-aws errors are TaggedException<T> where T is the AWS SDK exception.
 * AWS SDK exceptions carry `$metadata` (httpStatusCode, requestId) and `name`.
 */
const extractS3Metadata = (err: unknown): {
  httpStatusCode?: number
  s3ErrorCode?: string
  errorMessage: string
} => {
  const errorMessage = err instanceof Error ? err.message : String(err)

  // @effect-aws TaggedException has _tag and the original SDK exception fields
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>

    // AWS SDK v3 exceptions have $metadata.httpStatusCode
    const meta = e['$metadata'] as Record<string, unknown> | undefined
    const httpStatusCode = meta?.['httpStatusCode'] as number | undefined

    // _tag from @effect-aws (e.g., "NoSuchKey", "NotFound", "S3ServiceError")
    const s3ErrorCode = typeof e['_tag'] === 'string' ? e['_tag']
      // Fallback to Error.name
      : typeof e['name'] === 'string' ? e['name']
        : undefined

    return { httpStatusCode, s3ErrorCode, errorMessage }
  }

  return { errorMessage }
}

/**
 * Classify an S3 error into the appropriate BucketError variant.
 * Reads HTTP status, error codes, and message patterns to route precisely.
 */
const classifyS3Error = (key: string, op: string) => (err: unknown): BucketError => {
  const { httpStatusCode, s3ErrorCode, errorMessage } = extractS3Metadata(err)

  // SdkError from @effect-aws = low-level transport failure
  if (s3ErrorCode === 'SdkError') {
    const lcMsg = errorMessage.toLowerCase()
    if (lcMsg.includes('timeout') || lcMsg.includes('timed out') || lcMsg.includes('aborted')) {
      return new BucketTimeoutError({
        message: `${op} timeout for key '${key}': ${errorMessage}`,
        operation: op,
        key,
        cause: err,
      })
    }
    return new BucketConnectionError({
      message: `${op} connection failed for key '${key}': ${errorMessage}`,
      cause: err,
    })
  }

  // 404-family
  if (isNotFound(err)) {
    return new BucketStoreError({
      message: `${op}: object not found for key '${key}'`,
      operation: op,
      key,
      httpStatusCode: httpStatusCode ?? 404,
      s3ErrorCode,
      cause: err,
    })
  }

  // Timeout from HTTP layer (408, 504)
  if (httpStatusCode === 408 || httpStatusCode === 504) {
    return new BucketTimeoutError({
      message: `${op} timed out for key '${key}' (HTTP ${httpStatusCode})`,
      operation: op,
      key,
      cause: err,
    })
  }

  // Generic — preserve all forensic fields
  return new BucketStoreError({
    message: `${op} failed for key '${key}': ${errorMessage}`,
    operation: op,
    key,
    httpStatusCode,
    s3ErrorCode,
    cause: err,
  })
}

/** Check if an error is a NoSuchKey / 404 */
const isNotFound = (err: unknown): boolean => {
  if (typeof err === 'object' && err !== null && '_tag' in err) {
    const tag = (err as { _tag: string })._tag
    return tag === 'NoSuchKey' || tag === 'NotFound'
  }
  return false
}

// =============================================================================
// S3 Live Implementation — powered by @effect-aws/client-s3
// =============================================================================

export const S3BucketStoreLive = Layer.effect(
  BucketStore,
  Effect.gen(function* () {
    const config = yield* BucketStoreConfig
    const s3 = yield* S3Service

    const prefix = config.keyPrefix
    const bucket = config.bucket

    /** Resolve full key with prefix */
    const fullKey = (key: string): string => `${prefix}${key}`

    /** Wrap an S3 effect with error mapping */
    const withResilience = <A>(
      effect: Effect.Effect<A, any, never>,
      key: string,
      op: string,
    ): Effect.Effect<A, BucketStoreError, never> =>
      effect.pipe(
        Effect.catchAll((err) => Effect.fail(classifyS3Error(key, op)(err))),
      )

    // ── Operations ─────────────────────────────────────────────────────

    const put: BucketStoreShape['put'] = Effect.fn('BucketStore.put')(
      function* <A, I>(key: string, value: A, schema: Schema.Schema<A, I>) {
        const encoded = yield* Schema.encode(schema)(value).pipe(
          Effect.mapError((cause) => new BucketSerializationError({
            message: `Failed to encode value for key '${key}'`,
            cause,
          })),
        )
        const body = JSON.stringify(encoded)
        yield* withResilience(
          s3.putObject({
            Bucket: bucket,
            Key: fullKey(key),
            Body: body,
            ContentType: 'application/json',
          }),
          key,
          'PUT',
        )
      },
    )

    const putRaw: BucketStoreShape['putRaw'] = Effect.fn('BucketStore.putRaw')(
      function* (key: string, body: string | Uint8Array, contentType?: string) {
        yield* withResilience(
          s3.putObject({
            Bucket: bucket,
            Key: fullKey(key),
            Body: typeof body === 'string' ? body : body,
            ContentType: contentType ?? 'application/octet-stream',
          }),
          key,
          'PUT_RAW',
        )
      },
    )

    const getRaw: BucketStoreShape['getRaw'] = Effect.fn('BucketStore.getRaw')(
      function* (key: string) {
        const resp = yield* s3.getObject({
          Bucket: bucket,
          Key: fullKey(key),
        }).pipe(
          Effect.map((r) => r as { Body?: { transformToString(): Promise<string> } }),
          Effect.catchAll((err) =>
            isNotFound(err)
              ? Effect.succeed(null)
              : Effect.fail(classifyS3Error(key, 'GET')(err)),
          ),
        )
        if (resp === null) return null
        const bodyStr = yield* Effect.tryPromise({
          try: () => resp.Body?.transformToString() ?? Promise.resolve(null),
          catch: (err) => new BucketStoreError({
            message: `Failed to read body for key '${key}'`,
            cause: err,
          }),
        })
        return bodyStr ?? null
      },
    )

    const get: BucketStoreShape['get'] = Effect.fn('BucketStore.get')(
      function* <A, I>(key: string, schema: Schema.Schema<A, I>) {
        const raw = yield* getRaw(key)
        if (raw === null) return null
        const parsed = yield* Effect.try({
          try: () => JSON.parse(raw),
          catch: (err) => new BucketSerializationError({
            message: `JSON parse failed for key '${key}'`,
            cause: err,
          }),
        })
        return yield* Schema.decodeUnknown(schema)(parsed).pipe(
          Effect.mapError((cause) => new BucketSerializationError({
            message: `Schema decode failed for key '${key}'`,
            cause,
          }),
          ),
        )
      },
    )

    const require_: BucketStoreShape['require'] = Effect.fn('BucketStore.require')(
      function* <A, I>(key: string, schema: Schema.Schema<A, I>) {
        const value = yield* get(key, schema)
        if (value === null) {
          return yield* Effect.fail(new BucketObjectNotFoundError({
            key,
            bucket,
          }))
        }
        return value
      },
    )

    const del: BucketStoreShape['del'] = Effect.fn('BucketStore.del')(
      function* (key: string) {
        yield* withResilience(
          s3.deleteObject({
            Bucket: bucket,
            Key: fullKey(key),
          }),
          key,
          'DELETE',
        )
      },
    )

    const exists: BucketStoreShape['exists'] = Effect.fn('BucketStore.exists')(
      function* (key: string) {
        return yield* s3.headObject({
          Bucket: bucket,
          Key: fullKey(key),
        }).pipe(
          Effect.map(() => true),
          Effect.catchAll(() => Effect.succeed(false)),
        )
      },
    )

    const head: BucketStoreShape['head'] = Effect.fn('BucketStore.head')(
      function* (key: string) {
        return yield* s3.headObject({
          Bucket: bucket,
          Key: fullKey(key),
        }).pipe(
          Effect.map((resp) => new BucketObject({
            key,
            size: resp.ContentLength ?? 0,
            lastModified: resp.LastModified?.toISOString(),
            etag: resp.ETag,
            contentType: resp.ContentType ?? 'application/json',
          })),
          Effect.catchAll(() => Effect.succeed(null)),
        )
      },
    )

    const list: BucketStoreShape['list'] = Effect.fn('BucketStore.list')(
      function* (listPrefix: string, options?: { maxKeys?: number; continuationToken?: string }) {
        const resp = yield* withResilience(
          s3.listObjectsV2({
            Bucket: bucket,
            Prefix: fullKey(listPrefix),
            MaxKeys: options?.maxKeys ?? 1000,
            ContinuationToken: options?.continuationToken,
          }),
          listPrefix,
          'LIST',
        )
        const objects = (resp.Contents ?? []).map((obj) =>
          new BucketObject({
            key: (obj.Key ?? '').slice(prefix.length),
            size: obj.Size ?? 0,
            lastModified: obj.LastModified?.toISOString(),
            etag: obj.ETag,
          }),
        )
        return new ListObjectsResult({
          objects,
          continuationToken: resp.NextContinuationToken,
          isTruncated: resp.IsTruncated ?? false,
          prefix: listPrefix,
        })
      },
    )

    const listAll: BucketStoreShape['listAll'] = Effect.fn('BucketStore.listAll')(
      function* (listPrefix: string) {
        const all: BucketObject[] = []
        let token: string | undefined
        do {
          const page = yield* list(listPrefix, {
            maxKeys: 1000,
            continuationToken: token,
          })
          all.push(...page.objects)
          token = page.continuationToken
        } while (token)
        return all
      },
    )

    const isReady: BucketStoreShape['isReady'] = () =>
      list('', { maxKeys: 1 }).pipe(
        Effect.map(() => true),
        Effect.catchAll(() => Effect.succeed(false)),
      )

    return {
      put,
      putRaw,
      get,
      getRaw,
      require: require_,
      del,
      exists,
      head,
      list,
      listAll,
      isReady,
    } satisfies BucketStoreShape
  }),
)

// =============================================================================
// In-Memory Implementation — for tests (unchanged)
// =============================================================================

export const InMemoryBucketStoreLive = Layer.effect(
  BucketStore,
  Effect.sync(() => {
    const store = new Map<string, { body: string; contentType: string; lastModified: string }>()

    const put: BucketStoreShape['put'] = (key, value, schema) =>
      Effect.gen(function* () {
        const encoded = yield* Schema.encode(schema)(value).pipe(
          Effect.mapError((cause) => new BucketSerializationError({
            message: `Failed to encode value for key '${key}'`,
            cause,
          })),
        )
        store.set(key, {
          body: JSON.stringify(encoded),
          contentType: 'application/json',
          lastModified: new Date().toISOString(),
        })
      })

    const putRaw: BucketStoreShape['putRaw'] = (key, body, contentType) =>
      Effect.sync(() => {
        store.set(key, {
          body: typeof body === 'string' ? body : new TextDecoder().decode(body),
          contentType: contentType ?? 'application/octet-stream',
          lastModified: new Date().toISOString(),
        })
      })

    const getRaw: BucketStoreShape['getRaw'] = (key) =>
      Effect.sync(() => {
        const entry = store.get(key)
        return entry?.body ?? null
      })

    const get: BucketStoreShape['get'] = (key, schema) =>
      Effect.gen(function* () {
        const raw = yield* getRaw(key)
        if (raw === null) return null
        const parsed = yield* Effect.try({
          try: () => JSON.parse(raw),
          catch: (err) => new BucketSerializationError({
            message: `JSON parse failed for key '${key}'`,
            cause: err,
          }),
        })
        return yield* Schema.decodeUnknown(schema)(parsed).pipe(
          Effect.mapError((cause) => new BucketSerializationError({
            message: `Schema decode failed for key '${key}'`,
            cause,
          })),
        )
      })

    const require_: BucketStoreShape['require'] = (key, schema) =>
      Effect.gen(function* () {
        const value = yield* get(key, schema)
        if (value === null) {
          return yield* Effect.fail(new BucketObjectNotFoundError({
            key,
            bucket: 'in-memory',
          }))
        }
        return value
      })

    const del: BucketStoreShape['del'] = (key) =>
      Effect.sync(() => { store.delete(key) })

    const exists: BucketStoreShape['exists'] = (key) =>
      Effect.sync(() => store.has(key))

    const head: BucketStoreShape['head'] = (key) =>
      Effect.sync(() => {
        const entry = store.get(key)
        if (!entry) return null
        return new BucketObject({
          key,
          size: new TextEncoder().encode(entry.body).length,
          lastModified: entry.lastModified,
          contentType: entry.contentType,
        })
      })

    const list: BucketStoreShape['list'] = (prefix, options) =>
      Effect.sync(() => {
        const maxKeys = options?.maxKeys ?? 1000
        const allKeys = Array.from(store.keys())
          .filter((k) => k.startsWith(prefix))
          .sort()

        const objects = allKeys.slice(0, maxKeys).map((k) => {
          const entry = store.get(k)!
          return new BucketObject({
            key: k,
            size: new TextEncoder().encode(entry.body).length,
            lastModified: entry.lastModified,
            contentType: entry.contentType,
          })
        })

        return new ListObjectsResult({
          objects,
          isTruncated: allKeys.length > maxKeys,
          prefix,
          continuationToken: allKeys.length > maxKeys ? allKeys[maxKeys] : undefined,
        })
      })

    const listAll: BucketStoreShape['listAll'] = (prefix) =>
      Effect.sync(() => {
        return Array.from(store.keys())
          .filter((k) => k.startsWith(prefix))
          .sort()
          .map((k) => {
            const entry = store.get(k)!
            return new BucketObject({
              key: k,
              size: new TextEncoder().encode(entry.body).length,
              lastModified: entry.lastModified,
              contentType: entry.contentType,
            })
          })
      })

    const isReady: BucketStoreShape['isReady'] = () => Effect.succeed(true)

    return {
      put,
      putRaw,
      get,
      getRaw,
      require: require_,
      del,
      exists,
      head,
      list,
      listAll,
      isReady,
    } satisfies BucketStoreShape
  }),
)

// =============================================================================
// Convenience Layer Combos
// =============================================================================

/** S3 live store with MinIO defaults — provides S3Service layer internally */
export const BucketStoreMinIO = S3BucketStoreLive.pipe(
  Layer.provide(BucketStoreConfig.MinIO),
  Layer.provide(S3Service.layer({
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    },
    forcePathStyle: true,
  })),
)

/** In-memory store (no config needed) */
export const BucketStoreTest = InMemoryBucketStoreLive
