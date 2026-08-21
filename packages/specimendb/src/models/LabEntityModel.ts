/**
 * Persistence-shaped lab entity. Same fields as the provenance record.
 *
 * Not the catalog SoT table. Catalog rows are EntityModel (`entities`).
 * No `lab_entities` table. Do not call SqlModel.makeRepository here.
 * Pin stays `@effect/sql-pg` / `effect` 4.0.0-beta.93.
 *
 * @module @tmnl/specimendb/models/LabEntityModel
 */

import { Model } from 'effect/unstable/schema';
import * as Schema from 'effect/Schema';
import {
  Agent,
  ContentAddress,
  EntityKind,
  HonestyClass,
  EntityType,
  ProvenanceWhat,
  ProvenanceWhen,
} from '../schemas/provenance.js';
import { EntityRef, SpecimenId } from '../schemas/identifiers.js';

/**
 * App-provided compact ref is the row identity when a fat record is stored.
 * GeneratedByApp: present on select/insert/update/json; omitted from jsonCreate.
 */
export class LabEntityModel extends Model.Class<LabEntityModel>('LabEntityModel')({
  ref: Model.GeneratedByApp(EntityRef),
  kind: EntityKind,
  type: Schema.optional(EntityType),
  label: Schema.String.check(Schema.isMinLength(1)),
  class: HonestyClass,
  bytes: Schema.optional(ContentAddress),
  used: Schema.optional(Schema.Array(EntityRef)),
  generated: Schema.optional(Schema.Array(EntityRef)),
  wasGeneratedBy: Schema.optional(EntityRef),
  wasAssociatedWith: Schema.optional(Schema.Array(Agent)),
  wasDerivedFrom: Schema.optional(Schema.Array(EntityRef)),
  wasInvalidatedBy: Schema.optional(EntityRef),
  who: Schema.optional(Schema.Array(Agent)),
  what: Schema.optional(ProvenanceWhat),
  when: Schema.optional(ProvenanceWhen),
  where: Schema.optional(Schema.String),
  why: Schema.optional(Schema.String),
  how: Schema.optional(Schema.String),
  supersedes: Schema.optional(EntityRef),
  specimenId: Schema.optional(SpecimenId),
  payloadSchemaId: Schema.optional(Schema.String),
  payload: Schema.optional(Schema.Unknown),
}) {}
