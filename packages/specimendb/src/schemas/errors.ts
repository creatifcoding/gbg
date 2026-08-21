/**
 * Catalog errors — Schema.TaggedErrorClass, yieldable, Rpc-serializable.
 *
 * @module @tmnl/specimendb/schemas/errors
 */

import * as Schema from 'effect/Schema';
import { EntityRef, SpecimenId } from './identifiers.js';

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

export class EntityNotFoundError extends Schema.TaggedErrorClass<EntityNotFoundError>(
  '@tmnl/specimendb/EntityNotFoundError',
)('EntityNotFoundError', {
  entityId: EntityRef,
}) {}

export class IntakeError extends Schema.TaggedErrorClass<IntakeError>(
  '@tmnl/specimendb/IntakeError',
)('IntakeError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export type SpecimenRpcError =
  | CatalogError
  | SpecimenNotFoundError
  | EntityNotFoundError
  | IntakeError;
