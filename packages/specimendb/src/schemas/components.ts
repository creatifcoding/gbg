/**
 * ECS components. None are required at specimen birth.
 *
 * Status paint (Vanta Black, copied — this package does not import tmnl):
 * raw/amber, filed/cyan, working/emerald, dead/rose.
 *
 * @module @tmnl/specimendb/schemas/components
 */

import * as Schema from 'effect/Schema';

export const SpecimenStatus = Schema.Literals(['raw', 'filed', 'working', 'dead'] as const);
export type SpecimenStatus = typeof SpecimenStatus.Type;

/** Status paint tokens aligned with packages/tmnl/src/components/portal/tokens.ts. */
export const STATUS_PAINT = {
  raw: { token: 'amber', hex: '#fbbf24' },
  filed: { token: 'cyan', hex: '#22d3ee' },
  working: { token: 'emerald', hex: '#34d399' },
  dead: { token: 'rose', hex: '#fb7185' },
} as const;

export const MediaKind = Schema.Literals(['jpeg', 'heic', 'other'] as const);
export type MediaKind = typeof MediaKind.Type;

export const LocalitySource = Schema.Literals(['exif', 'capture-page'] as const);
export type LocalitySource = typeof LocalitySource.Type;

export const ExifTagValue = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(Schema.Unknown),
  Schema.Record(Schema.String, Schema.Unknown),
]);
export type ExifTagValue = typeof ExifTagValue.Type;

/** exiftool-style sidecar: a flat tag bag of whatever arrived. Never fabricated. */
export const ExifTags = Schema.Record(Schema.String, Schema.Unknown);
export type ExifTags = typeof ExifTags.Type;

export class StatusComponent extends Schema.TaggedClass<StatusComponent>()('Status', {
  value: SpecimenStatus,
}) {}

/** 10-second one-liner. Optional. */
export class ClaimComponent extends Schema.TaggedClass<ClaimComponent>()('Claim', {
  text: Schema.String,
  title: Schema.optional(Schema.String),
}) {}

export class MediaComponent extends Schema.TaggedClass<MediaComponent>()('Media', {
  kind: MediaKind,
  filename: Schema.String,
  assetPath: Schema.String,
  mediaType: Schema.String,
  byteLength: Schema.Number,
}) {}

export class ExifComponent extends Schema.TaggedClass<ExifComponent>()('Exif', {
  tags: ExifTags,
  sidecarPath: Schema.optional(Schema.String),
}) {}

/**
 * GPS only. Attached when EXIF GPS exists or capture-page geo is supplied.
 * Absent when neither exists — never invent a place.
 */
export class LocalityComponent extends Schema.TaggedClass<LocalityComponent>()('Locality', {
  latitude: Schema.Number,
  longitude: Schema.Number,
  altitudeMeters: Schema.optional(Schema.Number),
  accuracyMeters: Schema.optional(Schema.Number),
  source: LocalitySource,
}) {}

/** Never invent. Unknown is fine; omit the component. */
export class TaxonComponent extends Schema.TaggedClass<TaxonComponent>()('Taxon', {
  scientificName: Schema.optional(Schema.String),
  commonName: Schema.optional(Schema.String),
  rank: Schema.optional(Schema.String),
}) {}

export class StructureComponent extends Schema.TaggedClass<StructureComponent>()('Structure', {
  text: Schema.String,
}) {}

export class MechanismComponent extends Schema.TaggedClass<MechanismComponent>()('Mechanism', {
  text: Schema.String,
}) {}

export class FunctionComponent extends Schema.TaggedClass<FunctionComponent>()('Function', {
  text: Schema.String,
}) {}

export class AnalogLinkComponent extends Schema.TaggedClass<AnalogLinkComponent>()('AnalogLink', {
  target: Schema.String,
  note: Schema.optional(Schema.String),
}) {}

export class TagComponent extends Schema.TaggedClass<TagComponent>()('Tag', {
  value: Schema.String,
}) {}

export class QuestionComponent extends Schema.TaggedClass<QuestionComponent>()('Question', {
  text: Schema.String,
}) {}

export class ObservationComponent extends Schema.TaggedClass<ObservationComponent>()('Observation', {
  text: Schema.String,
}) {}

export const Component = Schema.Union([
  StatusComponent,
  ClaimComponent,
  MediaComponent,
  ExifComponent,
  LocalityComponent,
  TaxonComponent,
  StructureComponent,
  MechanismComponent,
  FunctionComponent,
  AnalogLinkComponent,
  TagComponent,
  QuestionComponent,
  ObservationComponent,
]);
export type Component = typeof Component.Type;

export const ComponentKind = Schema.Literals([
  'Status',
  'Claim',
  'Media',
  'Exif',
  'Locality',
  'Taxon',
  'Structure',
  'Mechanism',
  'Function',
  'AnalogLink',
  'Tag',
  'Question',
  'Observation',
] as const);
export type ComponentKind = typeof ComponentKind.Type;
