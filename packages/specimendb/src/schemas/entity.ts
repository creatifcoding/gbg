/**
 * Entity is a branded stable ref. Not a fat row. Kind and components attach later.
 *
 * @module @tmnl/specimendb/schemas/entity
 */

import * as Schema from 'effect/Schema';
import { Component } from './components.js';
import { EntityRef } from './identifiers.js';
import { EntityKind, EntityType } from './provenance.js';

export class CatalogEntity extends Schema.TaggedClass<CatalogEntity>()('CatalogEntity', {
  id: EntityRef,
}) {
  get ref(): EntityRef {
    return this.id;
  }
}

export const CatalogRecord = Schema.Struct({
  id: EntityRef,
  kind: EntityKind,
  type: Schema.optional(EntityType),
  createdAt: Schema.String,
  components: Schema.Array(Component),
});
export type CatalogRecord = typeof CatalogRecord.Type;

export const GetEntityPayload = Schema.Struct({
  entityId: EntityRef,
});
export type GetEntityPayload = typeof GetEntityPayload.Type;

export const ListEntitiesPayload = Schema.Struct({
  kind: Schema.optional(EntityKind),
  type: Schema.optional(EntityType),
});
export type ListEntitiesPayload = typeof ListEntitiesPayload.Type;

export const GetComponentsPayload = Schema.Struct({
  entityId: EntityRef,
});
export type GetComponentsPayload = typeof GetComponentsPayload.Type;

export const AttachPayload = Schema.Struct({
  entityId: EntityRef,
  component: Component,
});
export type AttachPayload = typeof AttachPayload.Type;

/** Mint an activity entity. Used / Generated become components the system walks. */
export const MintActivityPayload = Schema.Struct({
  ref: Schema.optional(EntityRef),
  used: Schema.optional(Schema.Array(EntityRef)),
  generated: Schema.optional(Schema.Array(EntityRef)),
});
export type MintActivityPayload = typeof MintActivityPayload.Type;

/** Mint any catalog entity. Seed uses this instead of inserting SQL rows. */
export const MintEntityPayload = Schema.Struct({
  id: EntityRef,
  kind: EntityKind,
  type: Schema.optional(EntityType),
  createdAt: Schema.optional(Schema.String),
  components: Schema.Array(Component),
});
export type MintEntityPayload = typeof MintEntityPayload.Type;

export const ExportPayload = Schema.Struct({
  ref: EntityRef,
  used: Schema.optional(Schema.Array(EntityRef)),
  generated: Schema.optional(Schema.Array(EntityRef)),
});
export type ExportPayload = typeof ExportPayload.Type;

/** HLR / projection: Used(step) Generated(svgs/sheets). Fixture-only in CI. */
export const ProjectPayload = Schema.Struct({
  ref: Schema.optional(EntityRef),
  used: Schema.Array(EntityRef),
  generated: Schema.Array(EntityRef),
});
export type ProjectPayload = typeof ProjectPayload.Type;

export const DoctorPayload = Schema.Struct({
  run: EntityRef,
  ref: Schema.optional(EntityRef),
  used: Schema.optional(Schema.Array(EntityRef)),
  generated: Schema.optional(Schema.Array(EntityRef)),
});
export type DoctorPayload = typeof DoctorPayload.Type;
