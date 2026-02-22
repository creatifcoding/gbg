/**
 * Persistence schemas for questionnaire spec library + result archive.
 *
 * All types are Effect Schema-backed per project discipline.
 * These define the wire format for S3 storage and query semantics.
 *
 * Key layout in bucket:
 *   specs/{specId}/v{version}.json        — versioned spec snapshots
 *   specs/{specId}/latest.json            — pointer to current version
 *   results/{specId}/{resultId}.json      — individual result records
 *   index/by-tag/{tag}.json               — tag → resultId[] index
 *   index/by-date/{YYYY-MM-DD}.json       — date → resultId[] index
 *
 * @module questionnaire/persistence/schemas
 */

import { Schema, Data } from 'effect'

// =============================================================================
// Branded IDs — no stringly-typed soup
// =============================================================================

export const SpecId = Schema.String.pipe(
  Schema.brand('SpecId'),
  Schema.minLength(1),
)
export type SpecId = typeof SpecId.Type

export const ResultId = Schema.String.pipe(
  Schema.brand('ResultId'),
  Schema.minLength(1),
)
export type ResultId = typeof ResultId.Type

export const SpecVersion = Schema.Number.pipe(
  Schema.brand('SpecVersion'),
  Schema.int(),
  Schema.greaterThanOrEqualTo(1),
)
export type SpecVersion = typeof SpecVersion.Type

// =============================================================================
// PersistedSpec — a versioned questionnaire spec snapshot
// =============================================================================

export class PersistedSpec extends Schema.Class<PersistedSpec>('PersistedSpec')({
  /** The spec ID (matches Questionnaire.id) */
  specId: SpecId,
  /** Monotonically increasing version */
  version: SpecVersion,
  /** ISO-8601 timestamp of when this version was saved */
  savedAt: Schema.String,
  /** Tags for categorization and query */
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** The raw questionnaire spec as JSON-compatible object */
  spec: Schema.Unknown,
}) {}

// =============================================================================
// RichAnswerEntry — full question prompt + answer metadata for human-readable output
// =============================================================================

export class RichAnswerEntry extends Schema.Class<RichAnswerEntry>('RichAnswerEntry')({
  /** The original question prompt text */
  prompt: Schema.String,
  /** The raw answer value */
  value: Schema.String,
  /** Human-readable answer label */
  label: Schema.String,
  /** Whether the user typed a custom answer */
  wasCustom: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Optional elaboration note from the user */
  note: Schema.optional(Schema.String),
}) {}

// =============================================================================
// PersistedResult — a completed questionnaire result with metadata
// =============================================================================

export class PersistedResult extends Schema.Class<PersistedResult>('PersistedResult')({
  /** Unique result ID (nanoid) */
  resultId: ResultId,
  /** Which spec produced this result */
  specId: SpecId,
  /** Which version of the spec was active */
  specVersion: SpecVersion,
  /** ISO-8601 completion timestamp */
  completedAt: Schema.String,
  /** Was the questionnaire cancelled? */
  cancelled: Schema.Boolean,
  /** Tags inherited from spec + any runtime additions */
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** The full QuestionnaireResult as JSON-compatible object */
  result: Schema.Unknown,
  /** Flattened answer index for query — { questionId: answerValue } */
  answerIndex: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.String }),
    { default: () => ({}) },
  ),
  /** Rich answer index with full question prompts — { questionId: RichAnswerEntry } */
  richAnswerIndex: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: RichAnswerEntry }),
    { default: () => ({}) },
  ),
  /** Vector embedding of answer text (for semantic search) */
  embedding: Schema.optional(Schema.Array(Schema.Number)),
}) {}

// =============================================================================
// SpecPointer — the "latest" marker for a spec
// =============================================================================

export class SpecPointer extends Schema.Class<SpecPointer>('SpecPointer')({
  specId: SpecId,
  currentVersion: SpecVersion,
  updatedAt: Schema.String,
}) {}

// =============================================================================
// Query Filters — all five dimensions
// =============================================================================

export const QueryFilterStatus = Schema.Literal('completed', 'cancelled', 'all')
export type QueryFilterStatus = typeof QueryFilterStatus.Type

export class QueryFilter extends Schema.Class<QueryFilter>('QueryFilter')({
  /** Filter by spec ID */
  specId: Schema.optional(Schema.String),
  /** Filter by date range (ISO-8601) */
  dateFrom: Schema.optional(Schema.String),
  dateTo: Schema.optional(Schema.String),
  /** Filter by tags (AND logic — all tags must match) */
  tags: Schema.optional(Schema.Array(Schema.String)),
  /** Filter by answer content — { questionId: valuePattern } */
  answerMatch: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),
  /** Full-text search across questions and answers */
  fullText: Schema.optional(Schema.String),
  /** Completed, cancelled, or all */
  status: Schema.optionalWith(QueryFilterStatus, { default: () => 'all' as const }),
  /** Pagination */
  limit: Schema.optionalWith(Schema.Number, { default: () => 50 }),
  offset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
}) {}

// =============================================================================
// Query Result — paginated response
// =============================================================================

export class QueryResult extends Schema.Class<QueryResult>('QueryResult')({
  results: Schema.Array(PersistedResult),
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number,
  hasMore: Schema.Boolean,
}) {}

// =============================================================================
// Tag Index Entry — for the tag inverted index
// =============================================================================

export class TagIndex extends Schema.Class<TagIndex>('TagIndex')({
  tag: Schema.String,
  resultIds: Schema.Array(Schema.String),
  updatedAt: Schema.String,
}) {}

// =============================================================================
// Date Index Entry — for the date inverted index
// =============================================================================

export class DateIndex extends Schema.Class<DateIndex>('DateIndex')({
  date: Schema.String,
  resultIds: Schema.Array(Schema.String),
  updatedAt: Schema.String,
}) {}

// =============================================================================
// S3 Configuration — endpoint, credentials, bucket, region
// =============================================================================

export class S3Config extends Schema.Class<S3Config>('S3Config')({
  /** S3 endpoint URL (e.g., http://localhost:9000 for MinIO) */
  endpoint: Schema.String,
  /** AWS region (us-east-1 for MinIO) */
  region: Schema.optionalWith(Schema.String, { default: () => 'us-east-1' }),
  /** Access key ID */
  accessKeyId: Schema.String,
  /** Secret access key */
  secretAccessKey: Schema.String,
  /** Bucket name for questionnaire storage */
  bucket: Schema.String,
  /** Force path-style addressing (required for MinIO) */
  forcePathStyle: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Key prefix — namespace within the bucket */
  keyPrefix: Schema.optionalWith(Schema.String, { default: () => 'questionnaires/' }),
  /** Timeout for S3 operations in milliseconds */
  timeoutMs: Schema.optionalWith(Schema.Number, { default: () => 10_000 }),
}) {}

// =============================================================================
// BucketStore Errors — TaggedError per project discipline
// =============================================================================

/**
 * Generic S3 operation failed — captures HTTP status, operation, and key.
 *
 * | Field          | What it captures                                   |
 * |----------------|----------------------------------------------------|
 * | message        | Human-readable description                         |
 * | operation      | PUT, GET, DELETE, LIST, HEAD — which S3 call failed |
 * | key            | The object key (if applicable)                     |
 * | httpStatusCode | HTTP status from AWS SDK ($metadata.httpStatusCode) |
 * | s3ErrorCode    | AWS error name (NoSuchKey, AccessDenied, etc.)     |
 * | cause          | Original upstream error                            |
 */
export class BucketStoreError extends Data.TaggedError('BucketStoreError')<{
  readonly message: string
  readonly operation?: string
  readonly key?: string
  readonly httpStatusCode?: number
  readonly s3ErrorCode?: string
  readonly cause?: unknown
}> {}

/**
 * Object not found (404 / NoSuchKey).
 * Separate from BucketStoreError for catchTag convenience.
 */
export class BucketObjectNotFoundError extends Data.TaggedError('BucketObjectNotFoundError')<{
  readonly key: string
  readonly bucket: string
  readonly operation?: string
}> {}

/**
 * Serialization failed — encode/decode/JSON.parse.
 * Captures the key and the direction (encode vs decode).
 */
export class BucketSerializationError extends Data.TaggedError('BucketSerializationError')<{
  readonly message: string
  readonly key?: string
  readonly direction?: 'encode' | 'decode' | 'parse'
  readonly cause?: unknown
}> {}

/**
 * Connection-level failure — DNS, TCP, TLS, timeout before any HTTP response.
 * Maps to `SdkError` from @effect-aws or network-level JS errors.
 */
export class BucketConnectionError extends Data.TaggedError('BucketConnectionError')<{
  readonly message: string
  readonly endpoint?: string
  readonly cause?: unknown
}> {}

/**
 * S3 operation timed out — either network timeout or configured deadline.
 */
export class BucketTimeoutError extends Data.TaggedError('BucketTimeoutError')<{
  readonly message: string
  readonly operation?: string
  readonly key?: string
  readonly timeoutMs?: number
  readonly cause?: unknown
}> {}

/** Union of all BucketStore errors */
export type BucketError =
  | BucketStoreError
  | BucketObjectNotFoundError
  | BucketSerializationError
  | BucketConnectionError
  | BucketTimeoutError

// =============================================================================
// QuestionnaireStore Errors — domain-specific
// =============================================================================

/**
 * Domain-level questionnaire store failure.
 * Wraps BucketError with domain context (which operation, which entity).
 */
export class QuestionnaireStoreError extends Data.TaggedError('QuestionnaireStoreError')<{
  readonly message: string
  readonly operation?: 'saveSpec' | 'getSpec' | 'deleteSpec' | 'listSpecs' | 'saveResult' | 'getResult' | 'listResults' | 'deleteResult' | 'query'
  readonly specId?: string
  readonly resultId?: string
  readonly cause?: unknown
}> {}

/**
 * Spec not found — specId/version combination doesn't exist.
 */
export class SpecNotFoundError extends Data.TaggedError('SpecNotFoundError')<{
  readonly specId: string
  readonly version?: number
  readonly message?: string
}> {}

/**
 * Result not found — resultId doesn't exist.
 */
export class ResultNotFoundError extends Data.TaggedError('ResultNotFoundError')<{
  readonly resultId: string
  readonly specId?: string
  readonly message?: string
}> {}

/** Union of all QuestionnaireStore errors */
export type QuestionnaireStoreErrors =
  | QuestionnaireStoreError
  | SpecNotFoundError
  | ResultNotFoundError
  | BucketError

// =============================================================================
// BucketObject — metadata about a stored object (S3 HEAD response shape)
// =============================================================================

export class BucketObject extends Schema.Class<BucketObject>('BucketObject')({
  /** Object key (full path within bucket) */
  key: Schema.String,
  /** Size in bytes */
  size: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  /** Last modified ISO-8601 */
  lastModified: Schema.optional(Schema.String),
  /** ETag (content hash) */
  etag: Schema.optional(Schema.String),
  /** Content type */
  contentType: Schema.optionalWith(Schema.String, { default: () => 'application/json' }),
}) {}

// =============================================================================
// ListObjectsResult — paginated S3 list response
// =============================================================================

export class ListObjectsResult extends Schema.Class<ListObjectsResult>('ListObjectsResult')({
  objects: Schema.Array(BucketObject),
  /** S3 continuation token for pagination */
  continuationToken: Schema.optional(Schema.String),
  /** Whether more results are available */
  isTruncated: Schema.Boolean,
  /** The prefix used for this listing */
  prefix: Schema.optionalWith(Schema.String, { default: () => '' }),
}) {}

// =============================================================================
// SpecSummary — lightweight spec listing (no full spec body)
// =============================================================================

export class SpecSummary extends Schema.Class<SpecSummary>('SpecSummary')({
  specId: SpecId,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  currentVersion: SpecVersion,
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** Total number of results associated with this spec */
  resultCount: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  /** ISO-8601 of when spec was first saved */
  createdAt: Schema.String,
  /** ISO-8601 of when spec was last updated */
  updatedAt: Schema.String,
}) {}

// =============================================================================
// SpecCatalog — the full spec library listing
// =============================================================================

export class SpecCatalog extends Schema.Class<SpecCatalog>('SpecCatalog')({
  specs: Schema.Array(SpecSummary),
  total: Schema.Number,
}) {}

// =============================================================================
// ResultSummary — lightweight result listing (no full answer body)
// =============================================================================

export class ResultSummary extends Schema.Class<ResultSummary>('ResultSummary')({
  resultId: ResultId,
  specId: SpecId,
  specVersion: SpecVersion,
  completedAt: Schema.String,
  cancelled: Schema.Boolean,
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** Number of questions answered */
  answerCount: Schema.Number,
}) {}

// =============================================================================
// Key Generators — deterministic S3 key paths
// =============================================================================

/** Generate the key for a versioned spec snapshot */
export const specVersionKey = (specId: string, version: number): string =>
  `specs/${specId}/v${version}.json`

/** Generate the key for a spec's latest pointer */
export const specLatestKey = (specId: string): string =>
  `specs/${specId}/latest.json`

/** Generate the key for a result record */
export const resultKey = (specId: string, resultId: string): string =>
  `results/${specId}/${resultId}.json`

/** Generate the key for a tag index entry */
export const tagIndexKey = (tag: string): string =>
  `index/by-tag/${encodeURIComponent(tag)}.json`

/** Generate the key for a date index entry */
export const dateIndexKey = (date: string): string =>
  `index/by-date/${date}.json`

/** List prefix for all results of a spec */
export const resultListPrefix = (specId: string): string =>
  `results/${specId}/`

/** List prefix for all specs */
export const specListPrefix = (): string =>
  `specs/`

/** List prefix for all results (across all specs) */
export const allResultsPrefix = (): string =>
  `results/`

/** Extract YYYY-MM-DD from an ISO-8601 timestamp */
export const isoToDate = (iso: string): string =>
  iso.slice(0, 10)
