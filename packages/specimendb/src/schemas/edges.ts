/**
 * Catalog edges. Append-only. Predicates are data, not tables.
 *
 * @module @tmnl/specimendb/schemas/edges
 */

import * as Schema from 'effect/Schema';
import { EdgeId, EntityRef } from './identifiers.js';

export const EDGE_RELS = [
  'used',
  'generated',
  'exhibits',
  'performs',
  'via',
  'inspires',
  'depicts',
  'contained-in',
  'contradicts',
  'derived-from',
] as const;

export const EdgeRel = Schema.Literals(EDGE_RELS);
export type EdgeRel = typeof EdgeRel.Type;

export class CatalogEdge extends Schema.TaggedClass<CatalogEdge>()('Edge', {
  id: EdgeId,
  src: EntityRef,
  rel: EdgeRel,
  dst: EntityRef,
  payload: Schema.Unknown,
  at: Schema.String,
}) {}
