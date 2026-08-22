/**
 * ECS components. None are required at specimen birth.
 *
 * Status paint (Vanta Black, copied — this package does not import tmnl):
 * raw/amber, filed/cyan, working/emerald, dead/rose.
 *
 * @module @tmnl/specimendb/schemas/components
 */

import * as Schema from 'effect/Schema';
import { EntityRef } from './identifiers.js';
import { AgentType, EntityKind, EntityType, HonestyClass } from './provenance.js';

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

/** unknown = no GPS arrived. fixed = EXIF or capture-page geo was actually present. */
export const LocalityState = Schema.Literals(['unknown', 'fixed'] as const);
export type LocalityState = typeof LocalityState.Type;

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

/** Kind is a component (and a column on `entities`). Not a privileged type. */
export class KindComponent extends Schema.TaggedClass<KindComponent>()('Kind', {
  value: EntityKind,
}) {}

/** Type is a component (and a column on `entities`). Kind-local discriminator. */
export class TypeComponent extends Schema.TaggedClass<TypeComponent>()('Type', {
  value: EntityType,
}) {}

/** Honesty class from LabEntity.class. Never upgrade on seed. */
export class HonestyComponent extends Schema.TaggedClass<HonestyComponent>()('Honesty', {
  value: HonestyClass,
}) {}

/**
 * Content address. Path is a locator, not an id.
 * Lab seed cites in-tree bytes; it does not copy them into specimen AssetStore.
 */
export class BytesComponent extends Schema.TaggedClass<BytesComponent>()('Bytes', {
  gitSha: Schema.optional(Schema.String),
  digest: Schema.optional(Schema.String),
  path: Schema.optional(Schema.String),
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
 * Always attached at intake. `unknown` means no GPS arrived — say unknown,
 * do not omit, do not invent coordinates. `fixed` is EXIF GPS or capture-page geo.
 */
export class LocalityComponent extends Schema.TaggedClass<LocalityComponent>()('Locality', {
  state: LocalityState,
  latitude: Schema.optional(Schema.Number),
  longitude: Schema.optional(Schema.Number),
  altitudeMeters: Schema.optional(Schema.Number),
  accuracyMeters: Schema.optional(Schema.Number),
  source: Schema.optional(LocalitySource),
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

export class WhoComponent extends Schema.TaggedClass<WhoComponent>()('Who', {
  agentType: AgentType,
  label: Schema.String.check(Schema.isMinLength(1)),
  ref: Schema.optional(Schema.String),
}) {}

export class WhenComponent extends Schema.TaggedClass<WhenComponent>()('When', {
  startedAt: Schema.String.check(Schema.isMinLength(1)),
  completedAt: Schema.optional(Schema.String),
  gitSha: Schema.optional(Schema.String),
}) {}

/** The string `unknown` is a value. Do not omit. Do not invent GPS. */
export class WhereComponent extends Schema.TaggedClass<WhereComponent>()('Where', {
  value: Schema.String.check(Schema.isMinLength(1)),
}) {}

export class WhyComponent extends Schema.TaggedClass<WhyComponent>()('Why', {
  value: Schema.String.check(Schema.isMinLength(1)),
}) {}

export class HowComponent extends Schema.TaggedClass<HowComponent>()('How', {
  value: Schema.String.check(Schema.isMinLength(1)),
}) {}

/**
 * Relationships are components a system walks (`Used` / `Generated` / …).
 * Each holds a target EntityRef. There is no third table.
 */
const relationFields = { target: EntityRef };

export class UsedComponent extends Schema.TaggedClass<UsedComponent>()('Used', relationFields) {}
export class GeneratedComponent extends Schema.TaggedClass<GeneratedComponent>()('Generated', relationFields) {}
export class ExhibitsComponent extends Schema.TaggedClass<ExhibitsComponent>()('Exhibits', relationFields) {}
export class PerformsComponent extends Schema.TaggedClass<PerformsComponent>()('Performs', relationFields) {}
export class ViaComponent extends Schema.TaggedClass<ViaComponent>()('Via', relationFields) {}
export class InspiresComponent extends Schema.TaggedClass<InspiresComponent>()('Inspires', relationFields) {}
export class DepictsComponent extends Schema.TaggedClass<DepictsComponent>()('Depicts', relationFields) {}
export class ContainedInComponent extends Schema.TaggedClass<ContainedInComponent>()('ContainedIn', relationFields) {}
export class ContradictsComponent extends Schema.TaggedClass<ContradictsComponent>()('Contradicts', relationFields) {}
export class DerivedFromComponent extends Schema.TaggedClass<DerivedFromComponent>()('DerivedFrom', relationFields) {}
export class SupersedesComponent extends Schema.TaggedClass<SupersedesComponent>()('Supersedes', relationFields) {}

export const RelationComponent = Schema.Union([
  UsedComponent,
  GeneratedComponent,
  ExhibitsComponent,
  PerformsComponent,
  ViaComponent,
  InspiresComponent,
  DepictsComponent,
  ContainedInComponent,
  ContradictsComponent,
  DerivedFromComponent,
  SupersedesComponent,
]);
export type RelationComponent = typeof RelationComponent.Type;

export const RELATION_KIND_VALUES = [
  'Used',
  'Generated',
  'Exhibits',
  'Performs',
  'Via',
  'Inspires',
  'Depicts',
  'ContainedIn',
  'Contradicts',
  'DerivedFrom',
  'Supersedes',
] as const;
export type RelationKind = (typeof RELATION_KIND_VALUES)[number];

export const Component = Schema.Union([
  StatusComponent,
  KindComponent,
  TypeComponent,
  HonestyComponent,
  BytesComponent,
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
  WhoComponent,
  WhenComponent,
  WhereComponent,
  WhyComponent,
  HowComponent,
  UsedComponent,
  GeneratedComponent,
  ExhibitsComponent,
  PerformsComponent,
  ViaComponent,
  InspiresComponent,
  DepictsComponent,
  ContainedInComponent,
  ContradictsComponent,
  DerivedFromComponent,
  SupersedesComponent,
]);
export type Component = typeof Component.Type;

export const COMPONENT_KIND_VALUES = [
  'Status',
  'Kind',
  'Type',
  'Honesty',
  'Bytes',
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
  'Who',
  'When',
  'Where',
  'Why',
  'How',
  'Used',
  'Generated',
  'Exhibits',
  'Performs',
  'Via',
  'Inspires',
  'Depicts',
  'ContainedIn',
  'Contradicts',
  'DerivedFrom',
  'Supersedes',
] as const;

export const relationTargets = (
  components: ReadonlyArray<Component>,
  kind: RelationKind,
): ReadonlyArray<EntityRef> =>
  components.flatMap((component) =>
    component._tag === kind ? [component.target] : [],
  );

export const sameComponent = (left: Component, right: Component): boolean => {
  if (left._tag !== right._tag) return false;
  if ('target' in left && 'target' in right) {
    return left.target === right.target;
  }
  if (left._tag === 'Kind' && right._tag === 'Kind') {
    return left.value === right.value;
  }
  if (left._tag === 'Type' && right._tag === 'Type') {
    return left.value === right.value;
  }
  if (left._tag === 'Honesty' && right._tag === 'Honesty') {
    return left.value === right.value;
  }
  if (left._tag === 'Bytes' && right._tag === 'Bytes') {
    return left.gitSha === right.gitSha && left.digest === right.digest && left.path === right.path;
  }
  if (left._tag === 'Who' && right._tag === 'Who') {
    return left.agentType === right.agentType && left.label === right.label && left.ref === right.ref;
  }
  if (left._tag === 'When' && right._tag === 'When') {
    return (
      left.startedAt === right.startedAt &&
      left.completedAt === right.completedAt &&
      left.gitSha === right.gitSha
    );
  }
  if (left._tag === 'Where' && right._tag === 'Where') {
    return left.value === right.value;
  }
  if (left._tag === 'Why' && right._tag === 'Why') {
    return left.value === right.value;
  }
  if (left._tag === 'How' && right._tag === 'How') {
    return left.value === right.value;
  }
  return true;
};

export const hasComponent = (
  components: ReadonlyArray<Component>,
  component: Component,
): boolean => components.some((existing) => sameComponent(existing, component));

export const makeRelationComponent = (kind: RelationKind, target: EntityRef): RelationComponent => {
  switch (kind) {
    case 'Used':
      return new UsedComponent({ target });
    case 'Generated':
      return new GeneratedComponent({ target });
    case 'Exhibits':
      return new ExhibitsComponent({ target });
    case 'Performs':
      return new PerformsComponent({ target });
    case 'Via':
      return new ViaComponent({ target });
    case 'Inspires':
      return new InspiresComponent({ target });
    case 'Depicts':
      return new DepictsComponent({ target });
    case 'ContainedIn':
      return new ContainedInComponent({ target });
    case 'Contradicts':
      return new ContradictsComponent({ target });
    case 'DerivedFrom':
      return new DerivedFromComponent({ target });
    case 'Supersedes':
      return new SupersedesComponent({ target });
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
};

export const ComponentKind = Schema.Literals(COMPONENT_KIND_VALUES);
export type ComponentKind = typeof ComponentKind.Type;
