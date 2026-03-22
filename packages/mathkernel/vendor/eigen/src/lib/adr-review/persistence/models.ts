/**
 * ADR Review Persistence Models
 *
 * Effect SQL models for persisting review state.
 * Follows the editor v3 persistence pattern.
 */
import { Model } from '@effect/sql'
import { Schema } from 'effect'
import { ReviewStatus } from '../schemas/status'

// -----------------------------------------------------------------------------
// Branded Types
// -----------------------------------------------------------------------------

export const AdrId = Schema.String.pipe(Schema.brand('AdrId'))
export type AdrId = typeof AdrId.Type

export const UnitPath = Schema.String.pipe(Schema.brand('UnitPath'))
export type UnitPath = typeof UnitPath.Type

export const CommentId = Schema.String.pipe(Schema.brand('CommentId'))
export type CommentId = typeof CommentId.Type

// Re-export for convenience
export { ReviewStatus }

// -----------------------------------------------------------------------------
// Unit Review Model
// -----------------------------------------------------------------------------

/**
 * Persisted unit review state.
 * Composite PK: (adrId, unitPath)
 */
export class UnitReviewModel extends Model.Class<UnitReviewModel>('UnitReviewModel')({
  adrId: Schema.String,
  unitPath: Schema.String,
  status: ReviewStatus,
  reviewedAt: Schema.NullOr(Schema.String),
  reviewedBy: Schema.NullOr(Schema.String),
}) {}

// -----------------------------------------------------------------------------
// Review Comment Model
// -----------------------------------------------------------------------------

/**
 * Persisted review comment.
 * Supports threading via replyTo.
 */
export class ReviewCommentModel extends Model.Class<ReviewCommentModel>('ReviewCommentModel')({
  id: Model.GeneratedByApp(CommentId),
  adrId: Schema.String,
  unitPath: Schema.String,
  author: Schema.String,
  content: Schema.String,
  createdAt: Model.DateTimeInsert,
  replyTo: Schema.NullOr(Schema.String),
}) {}

// -----------------------------------------------------------------------------
// Insert/Update Schemas (for type inference)
// -----------------------------------------------------------------------------

export const UnitReviewInsert = UnitReviewModel.insert
export type UnitReviewInsert = typeof UnitReviewInsert.Type

export const ReviewCommentInsert = ReviewCommentModel.insert
export type ReviewCommentInsert = typeof ReviewCommentInsert.Type
