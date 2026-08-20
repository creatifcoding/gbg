import * as Schema from 'effect/Schema'
import { SpecimenId } from '../schemas/identifiers'
import { SpecimenStatus } from '../schemas/specimen'

export class IntakeError extends Schema.TaggedErrorClass<IntakeError>(
  '@tmnl/specimendb/IntakeError',
)('IntakeError', {
  issues: Schema.Array(Schema.String),
}) {}

export class AssetExistsError extends Schema.TaggedErrorClass<AssetExistsError>(
  '@tmnl/specimendb/AssetExistsError',
)('AssetExistsError', {
  dest: Schema.String,
}) {}

export class SpecimenNotFound extends Schema.TaggedErrorClass<SpecimenNotFound>(
  '@tmnl/specimendb/SpecimenNotFound',
)('SpecimenNotFound', {
  specimenId: SpecimenId,
}) {}

export class DuckDbError extends Schema.TaggedErrorClass<DuckDbError>(
  '@tmnl/specimendb/DuckDbError',
)('DuckDbError', {
  operation: Schema.String,
  message: Schema.String,
}) {}

export class SpecimenTransitionError extends Schema.TaggedErrorClass<SpecimenTransitionError>(
  '@tmnl/specimendb/SpecimenTransitionError',
)('SpecimenTransitionError', {
  specimenId: SpecimenId,
  from: SpecimenStatus,
  to: SpecimenStatus,
}) {}

export const SpecimendbRpcError = Schema.Union([
  IntakeError,
  AssetExistsError,
  SpecimenNotFound,
  DuckDbError,
  SpecimenTransitionError,
])
export type SpecimendbRpcError = typeof SpecimendbRpcError.Type
