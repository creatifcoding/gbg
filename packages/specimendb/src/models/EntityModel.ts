/**
 * EntityModel — thin persistence row. The stable ref is the primary key.
 * Kind is a column (and a Kind component). Not a fat LabEntity / ISA-95 Asset.
 *
 * @module @tmnl/specimendb/models/EntityModel
 */

import { Model } from 'effect/unstable/schema';
import * as Schema from 'effect/Schema';
import { EntityRef } from '../schemas/identifiers.js';
import { EntityKind, EntityType } from '../schemas/provenance.js';

export class EntityModel extends Model.Class<EntityModel>('EntityModel')({
  id: Model.GeneratedByApp(EntityRef),
  kind: EntityKind,
  type: Schema.optional(EntityType),
  createdAt: Schema.String,
}) {}
