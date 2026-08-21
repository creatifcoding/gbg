/**
 * ComponentModel — ECS component row keyed by `entity_id` (not specimen_id).
 *
 * @module @tmnl/specimendb/models/ComponentModel
 */

import { Model } from 'effect/unstable/schema';
import * as Schema from 'effect/Schema';
import { ComponentKind } from '../schemas/components.js';
import { EntityRef } from '../schemas/identifiers.js';

export class ComponentModel extends Model.Class<ComponentModel>('ComponentModel')({
  id: Model.GeneratedByApp(Schema.String),
  entityId: EntityRef,
  kind: ComponentKind,
  payload: Schema.Unknown,
  attachedAt: Schema.String,
}) {}
