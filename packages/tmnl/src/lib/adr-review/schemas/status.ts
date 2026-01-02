/**
 * ADR Review Status & Comment Schemas
 *
 * Effect Schema definitions for review state management.
 */
import { Schema } from '@effect/schema'

// -----------------------------------------------------------------------------
// Review Status
// -----------------------------------------------------------------------------

export const ReviewStatus = Schema.Literal('pending', 'accepted', 'rejected', 'discuss')
export type ReviewStatus = Schema.Schema.Type<typeof ReviewStatus>

// -----------------------------------------------------------------------------
// Comment
// -----------------------------------------------------------------------------

export const Comment = Schema.Struct({
  id: Schema.String,
  path: Schema.String, // Unit path this comment is attached to
  author: Schema.String,
  content: Schema.String,
  timestamp: Schema.DateFromString,
  replyTo: Schema.optional(Schema.String), // Parent comment ID for threading
})
export type Comment = Schema.Schema.Type<typeof Comment>

// -----------------------------------------------------------------------------
// ADR Tier
// -----------------------------------------------------------------------------

export const ADRTier = Schema.Literal(
  'isolated',
  'adjacent',
  'synergy',
  'sequential',
  'crosscut'
)
export type ADRTier = Schema.Schema.Type<typeof ADRTier>

// -----------------------------------------------------------------------------
// ADR Status (document-level)
// -----------------------------------------------------------------------------

export const ADRStatus = Schema.Literal('draft', 'review', 'accepted', 'superseded')
export type ADRStatus = Schema.Schema.Type<typeof ADRStatus>

// -----------------------------------------------------------------------------
// Review Summary (per-document aggregation)
// -----------------------------------------------------------------------------

export const ReviewSummary = Schema.Struct({
  adrId: Schema.String,
  total: Schema.Number,
  pending: Schema.Number,
  accepted: Schema.Number,
  rejected: Schema.Number,
  discuss: Schema.Number,
})
export type ReviewSummary = Schema.Schema.Type<typeof ReviewSummary>
