/**
 * Append-only catalog edge. src / rel / dst / payload / at.
 *
 * @module @tmnl/specimendb/models/EdgeModel
 */

import { Model } from 'effect/unstable/schema';
import * as Schema from 'effect/Schema';
import { EdgeRel } from '../schemas/edges.js';
import { EdgeId, EntityRef } from '../schemas/identifiers.js';

/**
 * Fields match `edges` DDL:
 * - id: TEXT PRIMARY KEY (EdgeId)
 * - src: TEXT NOT NULL (EntityRef)
 * - rel: TEXT NOT NULL (EdgeRel)
 * - dst: TEXT NOT NULL (EntityRef)
 * - payload: JSONB NOT NULL
 * - at: TEXT NOT NULL (ISO-8601)
 *
 * No UPDATE / DELETE in the repo. Trigger rejects mutates.
 */
export class EdgeModel extends Model.Class<EdgeModel>('EdgeModel')({
  id: Model.GeneratedByApp(EdgeId),
  src: EntityRef,
  rel: EdgeRel,
  dst: EntityRef,
  payload: Schema.Unknown,
  at: Schema.String,
}) {}
