/**
 * ECS entity row. Stable ref is the primary key.
 *
 * Specimen is a common bundle (`kind=specimen`), not the only type.
 * Activity (`kind=activity`) lives here too — no `lab_activities` table.
 *
 * @module @tmnl/specimendb/models/EntityModel
 */

import { Model } from 'effect/unstable/schema';
import * as Schema from 'effect/Schema';
import { EntityRef } from '../schemas/identifiers.js';
import { EntityKind } from '../schemas/provenance.js';

/**
 * Fields match `entities` DDL:
 * - id: TEXT PRIMARY KEY (EntityRef, e.g. `gbg:specimen:<uuid>`)
 * - kind: TEXT NOT NULL (EntityKind)
 * - created_at: TEXT NOT NULL (ISO-8601)
 */
export class EntityModel extends Model.Class<EntityModel>('EntityModel')({
  id: Model.GeneratedByApp(EntityRef),
  kind: EntityKind,
  createdAt: Schema.String,
}) {}
