/**
 * Prospect Pipeline — API Error Schemas
 *
 * Typed errors for the HTTP API. Each extends Schema.TaggedError
 * with HttpApiSchema.annotations for proper HTTP status codes.
 *
 * @module prospects/api/errors
 */

import { Schema } from 'effect'
import { HttpApiSchema } from '@effect/platform'

export class CompanyNotFound extends Schema.TaggedError<CompanyNotFound>()(
  'CompanyNotFound',
  { slug: Schema.String },
  HttpApiSchema.annotations({ status: 404 })
) {}

export class DecisionMakerNotFound extends Schema.TaggedError<DecisionMakerNotFound>()(
  'DecisionMakerNotFound',
  { id: Schema.String },
  HttpApiSchema.annotations({ status: 404 })
) {}

export class HarvestBatchFailed extends Schema.TaggedError<HarvestBatchFailed>()(
  'HarvestBatchFailed',
  {
    message: Schema.String,
    source: Schema.String,
  },
  HttpApiSchema.annotations({ status: 422 })
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  'ValidationError',
  {
    message: Schema.String,
    field: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({ status: 400 })
) {}
