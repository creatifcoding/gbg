/**
 * RAG Schemas
 *
 * Effect Schema definitions for RAG operations.
 * Typed payloads and responses for RPC procedures.
 */

import { Schema } from 'effect';

// ============================================================================
// Search
// ============================================================================

export class SearchPayload extends Schema.Class<SearchPayload>('SearchPayload')({
  query: Schema.NonEmptyString,
  topK: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), {
    default: () => 3,
  }),
  index: Schema.optionalWith(Schema.String, {
    default: () => 'tmnl-codebase',
  }),
}) {}

export class SearchResult extends Schema.Class<SearchResult>('SearchResult')({
  content: Schema.String,
  source: Schema.String,
  score: Schema.Number,
  lineStart: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  lineEnd: Schema.optionalWith(Schema.Number, { default: () => 0 }),
}) {}

export class SearchResponse extends Schema.Class<SearchResponse>('SearchResponse')({
  query: Schema.String,
  results: Schema.Array(SearchResult),
  durationMs: Schema.Number,
}) {}

// ============================================================================
// List Indexes
// ============================================================================

export class IndexInfo extends Schema.Class<IndexInfo>('IndexInfo')({
  name: Schema.String,
  documentCount: Schema.Number,
  chunkCount: Schema.Number,
  createdAt: Schema.optionalWith(Schema.DateFromString, { default: () => new Date() }),
}) {}

export class ListIndexesResponse extends Schema.Class<ListIndexesResponse>('ListIndexesResponse')({
  indexes: Schema.Array(IndexInfo),
}) {}

// ============================================================================
// Build Index
// ============================================================================

export class BuildPayload extends Schema.Class<BuildPayload>('BuildPayload')({
  name: Schema.NonEmptyString,
  paths: Schema.NonEmptyArray(Schema.String),
  fileTypes: Schema.optionalWith(Schema.Array(Schema.String), {
    default: () => ['.ts', '.tsx'],
  }),
}) {}

export class BuildResponse extends Schema.Class<BuildResponse>('BuildResponse')({
  name: Schema.String,
  documentCount: Schema.Number,
  chunkCount: Schema.Number,
  durationMs: Schema.Number,
}) {}

// ============================================================================
// Ask (RAG Query)
// ============================================================================

export class AskPayload extends Schema.Class<AskPayload>('AskPayload')({
  question: Schema.NonEmptyString,
  index: Schema.optionalWith(Schema.String, {
    default: () => 'tmnl-codebase',
  }),
  topK: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), {
    default: () => 5,
  }),
}) {}

export class AskResponse extends Schema.Class<AskResponse>('AskResponse')({
  answer: Schema.String,
  sources: Schema.Array(SearchResult),
  durationMs: Schema.Number,
}) {}

// ============================================================================
// Errors
// ============================================================================

export class RagError extends Schema.TaggedError<RagError>()('RagError', {
  message: Schema.String,
  code: Schema.optionalWith(Schema.Literal('NOT_FOUND', 'INDEX_ERROR', 'SEARCH_ERROR', 'BUILD_ERROR'), {
    default: () => 'SEARCH_ERROR' as const,
  }),
}) {}
