/**
 * Semantic search schemas for questionnaire embeddings + DuckDB analytics.
 * @module
 */

import { Schema } from 'effect'

// =============================================================================
// Vector Embedding
// =============================================================================

/** A vector embedding — array of floats from an embedding model */
export const Embedding = Schema.Array(Schema.Number).annotations({
  identifier: 'Embedding',
  description: 'Vector embedding from an embedding model',
})
export type Embedding = typeof Embedding.Type

// =============================================================================
// Semantic Query / Response
// =============================================================================

/** Filters applicable to semantic search */
export class SemanticFilters extends Schema.Class<SemanticFilters>('SemanticFilters')({
  specId: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  dateFrom: Schema.optional(Schema.String),
  dateTo: Schema.optional(Schema.String),
}) {}

/** Input for a semantic search query */
export class SemanticQuery extends Schema.Class<SemanticQuery>('SemanticQuery')({
  query: Schema.String,
  topK: Schema.optionalWith(Schema.Number, { default: () => 10 }),
  minScore: Schema.optionalWith(Schema.Number, { default: () => 0.5 }),
  filters: Schema.optional(SemanticFilters),
}) {}

/** A single semantic search match */
export class SemanticMatch extends Schema.Class<SemanticMatch>('SemanticMatch')({
  resultId: Schema.String,
  specId: Schema.String,
  score: Schema.Number,
  matchedText: Schema.String,
  completedAt: Schema.String,
  cancelled: Schema.Boolean,
  tags: Schema.Array(Schema.String),
  answerIndex: Schema.Record({ key: Schema.String, value: Schema.String }),
}) {}

/** Full semantic search response */
export class SemanticSearchResult extends Schema.Class<SemanticSearchResult>('SemanticSearchResult')({
  matches: Schema.Array(SemanticMatch),
  query: Schema.String,
  totalScanned: Schema.Number,
  executionMs: Schema.Number,
}) {}
