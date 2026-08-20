/**
 * Catalog errors — Schema.TaggedErrorClass, yieldable, Rpc-serializable.
 *
 * @module @tmnl/specimendb/schemas/errors
 */

import * as Schema from 'effect/Schema';
import { SpecimenId } from './identifiers.js';

export class CatalogError extends Schema.TaggedErrorClass<CatalogError>(
  '@tmnl/specimendb/CatalogError',
)('CatalogError', {
  operation: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SpecimenNotFoundError extends Schema.TaggedErrorClass<SpecimenNotFoundError>(
  '@tmnl/specimendb/SpecimenNotFoundError',
)('SpecimenNotFoundError', {
  specimenId: SpecimenId,
}) {}

export class IntakeError extends Schema.TaggedErrorClass<IntakeError>(
  '@tmnl/specimendb/IntakeError',
)('IntakeError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class AttachError extends Schema.TaggedErrorClass<AttachError>(
  '@tmnl/specimendb/AttachError',
)('AttachError', {
  specimenId: SpecimenId,
  reason: Schema.Literals(['invented-locality', 'invented-taxon', 'component-not-attachable'] as const),
  message: Schema.String,
}) {}

export type SpecimenRpcError =
  | CatalogError
  | SpecimenNotFoundError
  | IntakeError
  | AttachError;
