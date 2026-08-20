/**
 * Branded identifiers for the specimen catalog.
 *
 * @module @tmnl/specimendb/schemas/identifiers
 */

import * as Schema from 'effect/Schema';

export const SpecimenId = Schema.String.pipe(
  Schema.brand('SpecimenId'),
);
export type SpecimenId = typeof SpecimenId.Type;

export const trustSpecimenId = (id: string): SpecimenId => id as SpecimenId;
