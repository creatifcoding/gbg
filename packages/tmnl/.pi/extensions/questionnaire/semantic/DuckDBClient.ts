/**
 * DuckDBClient — Effect service wrapping @duckdb/node-api.
 *
 * Thin adapter for analytical SQL queries over S3/MinIO JSON data.
 * Uses DuckDB's httpfs extension to read directly from MinIO buckets.
 *
 * ## Error Hierarchy
 *
 * | Error                | When                                      |
 * |----------------------|-------------------------------------------|
 * | DuckDBInitError      | Instance creation or S3 config failed     |
 * | DuckDBQueryError     | SQL execution failed (syntax, missing)    |
 * | DuckDBS3Error        | S3 read failed (auth, bucket, network)    |
 * | DuckDBConnectionError| Connection closed or lost unexpectedly    |
 * | DuckDBError          | Catch-all / unknown                       |
 *
 * Each error captures:
 * - `sql`: the SQL statement (truncated to 1KB for safety)
 * - `duckdbCode`: native error code when available
 * - `cause`: original upstream error
 *
 * @module
 */

import { Context, Data, Effect, Layer, Schema, Scope } from 'effect'
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api'

// =============================================================================
// Errors — Rich, Tagged, Forensic
// =============================================================================

/** Shared fields across all DuckDB errors */
interface DuckDBErrorFields {
  readonly message: string
  readonly sql?: string
  readonly duckdbCode?: string
  readonly cause?: unknown
}

/** Instance creation or extension install failed */
export class DuckDBInitError extends Data.TaggedError('DuckDBInitError')<
  DuckDBErrorFields & {
    readonly databasePath: string
  }
> {}

/** SQL execution failed — syntax error, missing table, type mismatch */
export class DuckDBQueryError extends Data.TaggedError('DuckDBQueryError')<
  DuckDBErrorFields & {
    readonly operation: 'query' | 'execute'
  }
> {}

/** S3/httpfs read failed — auth, bucket not found, network */
export class DuckDBS3Error extends Data.TaggedError('DuckDBS3Error')<
  DuckDBErrorFields & {
    readonly s3Endpoint: string
    readonly s3Bucket: string
    readonly s3Path?: string
  }
> {}

/** Connection closed or lost unexpectedly */
export class DuckDBConnectionError extends Data.TaggedError('DuckDBConnectionError')<DuckDBErrorFields> {}

/** Catch-all — unknown DuckDB error */
export class DuckDBError extends Data.TaggedError('DuckDBError')<DuckDBErrorFields> {}

/** Union of all DuckDB errors — use for exhaustive matching */
export type DuckDBErrors =
  | DuckDBInitError
  | DuckDBQueryError
  | DuckDBS3Error
  | DuckDBConnectionError
  | DuckDBError

// =============================================================================
// Error Classification
// =============================================================================

/** Truncate SQL for error fields — don't leak huge queries into logs */
const truncateSql = (sql?: string, max = 1024): string | undefined =>
  sql && sql.length > max ? sql.slice(0, max) + '…[truncated]' : sql

/**
 * Classify a DuckDB error based on the error message patterns.
 * DuckDB errors are descriptive strings — we pattern-match to route.
 */
const classifyQueryError = (
  err: unknown,
  sql: string,
  operation: 'query' | 'execute',
  config: DuckDBConfig,
): DuckDBErrors => {
  const msg = err instanceof Error ? err.message : String(err)
  const lcMsg = msg.toLowerCase()
  const sqlSnippet = truncateSql(sql)

  // S3 / httpfs errors
  if (
    lcMsg.includes('httpfs') ||
    lcMsg.includes('s3_') ||
    lcMsg.includes('s3 error') ||
    lcMsg.includes('unable to connect') ||
    lcMsg.includes('connection refused') ||
    lcMsg.includes('no such bucket') ||
    lcMsg.includes('access denied') ||
    lcMsg.includes('forbidden') ||
    (lcMsg.includes('io error') && sql.includes('s3://'))
  ) {
    // Try to extract the S3 path
    const s3Match = sql.match(/s3:\/\/([^/]+)\/(\S+)/)
    return new DuckDBS3Error({
      message: `S3 read failed: ${msg}`,
      sql: sqlSnippet,
      s3Endpoint: config.s3Endpoint,
      s3Bucket: s3Match?.[1] ?? config.s3Bucket,
      s3Path: s3Match?.[2],
      cause: err,
    })
  }

  // Connection errors
  if (
    lcMsg.includes('connection') && (lcMsg.includes('closed') || lcMsg.includes('lost') || lcMsg.includes('terminated'))
  ) {
    return new DuckDBConnectionError({
      message: `Connection error: ${msg}`,
      sql: sqlSnippet,
      cause: err,
    })
  }

  // Generic query error (syntax, missing column, type mismatch, etc.)
  return new DuckDBQueryError({
    message: `${operation === 'query' ? 'Query' : 'Execute'} failed: ${msg}`,
    sql: sqlSnippet,
    operation,
    cause: err,
  })
}

// =============================================================================
// Config
// =============================================================================

export class DuckDBConfig extends Schema.Class<DuckDBConfig>('DuckDBConfig')({
  s3Endpoint: Schema.optionalWith(Schema.String, { default: () => 'localhost:9000' }),
  s3AccessKeyId: Schema.optionalWith(Schema.String, { default: () => 'minioadmin' }),
  s3SecretAccessKey: Schema.optionalWith(Schema.String, { default: () => 'minioadmin' }),
  s3Region: Schema.optionalWith(Schema.String, { default: () => 'us-east-1' }),
  s3Bucket: Schema.optionalWith(Schema.String, { default: () => 'questionnaires' }),
  s3UrlStyle: Schema.optionalWith(Schema.Literal('path', 'vhost'), { default: () => 'path' as const }),
  s3UseSsl: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  databasePath: Schema.optionalWith(Schema.String, { default: () => ':memory:' }),
}) {}

// =============================================================================
// Service Interface
// =============================================================================

export interface DuckDBClientShape {
  /** Execute a SQL query and return row objects */
  readonly query: <T extends Record<string, unknown>>(
    sql: string,
  ) => Effect.Effect<ReadonlyArray<T>, DuckDBErrors>

  /** Execute SQL that doesn't return results */
  readonly execute: (sql: string) => Effect.Effect<void, DuckDBErrors>

  /** Get the configured S3 bucket for constructing s3:// URLs */
  readonly bucket: string
}

export class DuckDBClient extends Context.Tag('questionnaire/DuckDBClient')<
  DuckDBClient,
  DuckDBClientShape
>() {}

// =============================================================================
// S3 Setup SQL
// =============================================================================

const makeS3SetupSql = (config: DuckDBConfig): string => `
  INSTALL httpfs;
  LOAD httpfs;
  SET s3_url_style = '${config.s3UrlStyle}';
  SET s3_endpoint = '${config.s3Endpoint}';
  SET s3_region = '${config.s3Region}';
  SET s3_access_key_id = '${config.s3AccessKeyId}';
  SET s3_secret_access_key = '${config.s3SecretAccessKey}';
  SET s3_use_ssl = ${config.s3UseSsl};
`

// =============================================================================
// Live Implementation
// =============================================================================

const makeDuckDBClient = (config: DuckDBConfig) =>
  Effect.gen(function* () {
    const setupSql = makeS3SetupSql(config)

    // Acquire DuckDB instance + connection
    const connection = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const instance = await DuckDBInstance.create(config.databasePath)
          const conn = await instance.connect()
          // Configure S3 access
          await conn.run(setupSql)
          return conn
        },
        catch: (e) =>
          new DuckDBInitError({
            message: `DuckDB init failed: ${e instanceof Error ? e.message : String(e)}`,
            databasePath: config.databasePath,
            sql: truncateSql(setupSql),
            cause: e,
          }),
      }),
      (conn) =>
        Effect.sync(() => {
          try {
            conn.closeSync()
          } catch {
            /* ignore cleanup errors */
          }
        }),
    )

    const query = Effect.fn('DuckDBClient.query')(
      <T extends Record<string, unknown>>(sql: string) =>
        Effect.tryPromise({
          try: async () => {
            const reader = await connection.runAndReadAll(sql)
            return reader.getRowObjectsJson() as unknown as ReadonlyArray<T>
          },
          catch: (e) => classifyQueryError(e, sql, 'query', config),
        }),
    )

    const execute = Effect.fn('DuckDBClient.execute')(
      (sql: string) =>
        Effect.tryPromise({
          try: async () => {
            await connection.run(sql)
          },
          catch: (e) => classifyQueryError(e, sql, 'execute', config),
        }),
    )

    return DuckDBClient.of({
      query,
      execute,
      bucket: config.s3Bucket,
    })
  })

/**
 * DuckDB client layer with custom config.
 * Scoped — connection cleaned up when scope closes.
 */
export const DuckDBClientLive = (
  config: DuckDBConfig,
): Layer.Layer<DuckDBClient, DuckDBInitError> =>
  Layer.scoped(DuckDBClient, makeDuckDBClient(config))

/**
 * Convenience: MinIO defaults (localhost:9000, minioadmin/minioadmin)
 */
export const DuckDBClientMinIO = DuckDBClientLive(
  new DuckDBConfig({
    s3Endpoint: process.env.QUESTIONNAIRE_S3_ENDPOINT?.replace(/^https?:\/\//, '') ?? 'localhost:9000',
    s3AccessKeyId: process.env.QUESTIONNAIRE_S3_ACCESS_KEY ?? 'minioadmin',
    s3SecretAccessKey: process.env.QUESTIONNAIRE_S3_SECRET_KEY ?? 'minioadmin',
    s3Region: process.env.QUESTIONNAIRE_S3_REGION ?? 'us-east-1',
    s3Bucket: process.env.QUESTIONNAIRE_S3_BUCKET ?? 'questionnaires',
    s3UrlStyle: 'path',
    s3UseSsl: false,
  }),
)
