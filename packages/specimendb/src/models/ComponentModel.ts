/**
 * ECS component row. Attached to an entity, not a specimen-only FK.
 *
 * @module @tmnl/specimendb/models/ComponentModel
 */

import { Model } from 'effect/unstable/schema';
import * as Schema from 'effect/Schema';
import { ComponentKind } from '../schemas/components.js';
import { ComponentId, EntityRef } from '../schemas/identifiers.js';

/**
 * Fields match `components` DDL:
 * - id: TEXT PRIMARY KEY (ComponentId)
 * - entity_id: TEXT NOT NULL REFERENCES entities(id)
 * - kind: TEXT NOT NULL (ComponentKind / TaggedClass `_tag`)
 * - payload: JSONB NOT NULL
 * - attached_at: TEXT NOT NULL (ISO-8601)
 */
export class ComponentModel extends Model.Class<ComponentModel>('ComponentModel')({
  id: Model.GeneratedByApp(ComponentId),
  entityId: EntityRef,
  kind: ComponentKind,
  payload: Schema.Unknown,
  attachedAt: Schema.String,
}) {}
