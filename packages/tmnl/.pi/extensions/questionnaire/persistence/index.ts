/**
 * Questionnaire Persistence — public exports.
 *
 * @module questionnaire/persistence
 */

// Schemas
export {
  // Branded IDs
  SpecId,
  ResultId,
  SpecVersion,
  // Persisted entities
  PersistedSpec,
  PersistedResult,
  RichAnswerEntry,
  SpecPointer,
  // Query
  QueryFilter,
  QueryResult,
  QueryFilterStatus,
  // Indexes
  TagIndex,
  DateIndex,
  // S3 Config
  S3Config,
  // BucketStore primitives
  BucketObject,
  ListObjectsResult,
  // Summaries
  SpecSummary,
  SpecCatalog,
  ResultSummary,
  // Errors
  BucketStoreError,
  BucketObjectNotFoundError,
  BucketSerializationError,
  BucketConnectionError,
  BucketTimeoutError,
  QuestionnaireStoreError,
  SpecNotFoundError,
  ResultNotFoundError,
  // Key generators
  specVersionKey,
  specLatestKey,
  resultKey,
  tagIndexKey,
  dateIndexKey,
  resultListPrefix,
  specListPrefix,
  allResultsPrefix,
  isoToDate,
} from './schemas.ts'

export type {
  BucketError,
  QuestionnaireStoreErrors,
} from './schemas.ts'

// BucketStore service
export {
  BucketStore,
  BucketStoreConfig,
  S3BucketStoreLive,
  InMemoryBucketStoreLive,
  BucketStoreMinIO,
  BucketStoreTest,
} from './BucketStore.ts'

export type { BucketStoreShape } from './BucketStore.ts'

// QuestionnaireStore service
export {
  QuestionnaireStore,
  QuestionnaireStoreLive,
  QuestionnaireStoreMinIO,
} from './QuestionnaireStore.ts'

export type { QuestionnaireStoreShape } from './QuestionnaireStore.ts'
