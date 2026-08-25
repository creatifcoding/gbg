/**
 * Workbench latent slots as one stx() store per concern.
 * Parent (SpecimenRail) owns the bag. Children useFocus a slice.
 * Sockets start with blank values. Hydration from catalog entities comes later.
 * Status is a phase literal, not stxMachine. Blank catalog has no actor.
 *
 * @module @tmnl/specimendb/ui
 */

import { stx, type StxInstance } from '@tmnl/stx';
import * as Schema from 'effect/Schema';
import { SpecimenStatus } from '../schemas/components.js';
import { SpecimenId } from '../schemas/identifiers.js';
import type {
  CreatedAtWell,
  IdWell,
  LocalityWell,
  MediaWell,
  StatusWell,
  TagWell,
  TextWell,
} from './WorkbenchRecord.js';

export const WORKBENCH_CHROME = {
  header: 'SpecimenDB // Core',
  intake: 'Initiate Intake Sequence // Drop Telemetry Data',
  viewport: 'VIEWPORT_XZ',
  mag: 'MAG',
  activeRender: 'ACTIVE_RENDER',
  exportDb: 'Export DB',
  runSim: 'Run Sim',
  propertiesLog: 'Properties Log',
  classification: 'Classification',
  structuralMetrics: 'Structural Metrics',
  observationLog: 'Observation Log',
  lastUpdated: 'LAST_UPDATED',
  phylum: 'Phylum',
  class: 'Class',
  order: 'Order',
  family: 'Family',
  tensile: 'Tensile_Str',
  density: 'Density',
  hardness: 'Hardness_HV',
  overlap: 'Overlap_Idx',
} as const;

export class TextEmpty extends Schema.TaggedClass<TextEmpty>()('TextEmpty', {}) {}
export class TextValue extends Schema.TaggedClass<TextValue>()('TextValue', {
  text: Schema.String,
}) {}
export const TextSlot = Schema.Union([TextEmpty, TextValue]);
export type TextSlot = typeof TextSlot.Type;

export class IdEmpty extends Schema.TaggedClass<IdEmpty>()('IdEmpty', {}) {}
export class IdValue extends Schema.TaggedClass<IdValue>()('IdValue', {
  id: SpecimenId,
}) {}
export const IdSlot = Schema.Union([IdEmpty, IdValue]);
export type IdSlot = typeof IdSlot.Type;

export class LocalityEmpty extends Schema.TaggedClass<LocalityEmpty>()(
  'LocalityEmpty',
  {}
) {}
export class LocalityValue extends Schema.TaggedClass<LocalityValue>()(
  'LocalityValue',
  {
    label: Schema.String,
  }
) {}
export const LocalitySlot = Schema.Union([LocalityEmpty, LocalityValue]);
export type LocalitySlot = typeof LocalitySlot.Type;

export class TagEmpty extends Schema.TaggedClass<TagEmpty>()('TagEmpty', {}) {}
export class TagValue extends Schema.TaggedClass<TagValue>()('TagValue', {
  value: Schema.String,
}) {}
export const TagSlot = Schema.Union([TagEmpty, TagValue]);
export type TagSlot = typeof TagSlot.Type;

export class MediaEmpty extends Schema.TaggedClass<MediaEmpty>()(
  'MediaEmpty',
  {}
) {}
export class MediaPreview extends Schema.TaggedClass<MediaPreview>()(
  'MediaPreview',
  {
    src: Schema.String,
    caption: Schema.String,
  }
) {}
export class MediaMetadata extends Schema.TaggedClass<MediaMetadata>()(
  'MediaMetadata',
  {
    caption: Schema.String,
  }
) {}
export const MediaSlot = Schema.Union([
  MediaEmpty,
  MediaPreview,
  MediaMetadata,
]);
export type MediaSlot = typeof MediaSlot.Type;

export class InstantEmpty extends Schema.TaggedClass<InstantEmpty>()(
  'InstantEmpty',
  {}
) {}
export class InstantValue extends Schema.TaggedClass<InstantValue>()(
  'InstantValue',
  {
    at: Schema.String,
  }
) {}
export const InstantSlot = Schema.Union([InstantEmpty, InstantValue]);
export type InstantSlot = typeof InstantSlot.Type;

export const StatusPhase = Schema.Union([
  Schema.Literals(['empty'] as const),
  SpecimenStatus,
]);
export type StatusPhase = typeof StatusPhase.Type;

export class IntakeSocket extends Schema.TaggedClass<IntakeSocket>()(
  'IntakeSocket',
  {
    mode: Schema.Literals(['chrome'] as const),
  }
) {}

export class SelectedSocket extends Schema.TaggedClass<SelectedSocket>()(
  'SelectedSocket',
  {
    well: IdSlot,
  }
) {}

export class RailQuerySocket extends Schema.TaggedClass<RailQuerySocket>()(
  'RailQuerySocket',
  {
    query: Schema.String,
  }
) {}

export class TitleSocket extends Schema.TaggedClass<TitleSocket>()(
  'TitleSocket',
  {
    well: IdSlot,
  }
) {}

export class StatusSocket extends Schema.TaggedClass<StatusSocket>()(
  'StatusSocket',
  {
    phase: StatusPhase,
  }
) {}

export class LocalitySocket extends Schema.TaggedClass<LocalitySocket>()(
  'LocalitySocket',
  {
    well: LocalitySlot,
  }
) {}

export class ClaimSocket extends Schema.TaggedClass<ClaimSocket>()(
  'ClaimSocket',
  {
    well: TextSlot,
  }
) {}

export class TagsSocket extends Schema.TaggedClass<TagsSocket>()('TagsSocket', {
  first: TagSlot,
  second: TagSlot,
  third: TagSlot,
}) {}

export class MediaSocket extends Schema.TaggedClass<MediaSocket>()(
  'MediaSocket',
  {
    well: MediaSlot,
    caption: TextSlot,
  }
) {}

export class TaxonSocket extends Schema.TaggedClass<TaxonSocket>()(
  'TaxonSocket',
  {
    phylum: TextSlot,
    class: TextSlot,
    order: TextSlot,
    family: TextSlot,
  }
) {}

export class MetricsSocket extends Schema.TaggedClass<MetricsSocket>()(
  'MetricsSocket',
  {
    tensile: TextSlot,
    density: TextSlot,
    hardness: TextSlot,
    overlap: TextSlot,
    note: TextSlot,
  }
) {}

export class ObservationSocket extends Schema.TaggedClass<ObservationSocket>()(
  'ObservationSocket',
  {
    first: TextSlot,
    second: TextSlot,
  }
) {}

export class LastUpdatedSocket extends Schema.TaggedClass<LastUpdatedSocket>()(
  'LastUpdatedSocket',
  {
    well: InstantSlot,
  }
) {}

export class ViewportSocket extends Schema.TaggedClass<ViewportSocket>()(
  'ViewportSocket',
  {
    mag: TextSlot,
    readout: TextSlot,
  }
) {}

export type WorkbenchSockets = {
  readonly intake: StxInstance<IntakeSocket>;
  readonly selectedId: StxInstance<SelectedSocket>;
  readonly railQuery: StxInstance<RailQuerySocket>;
  readonly title: StxInstance<TitleSocket>;
  readonly status: StxInstance<StatusSocket>;
  readonly locality: StxInstance<LocalitySocket>;
  readonly claim: StxInstance<ClaimSocket>;
  readonly tags: StxInstance<TagsSocket>;
  readonly media: StxInstance<MediaSocket>;
  readonly taxon: StxInstance<TaxonSocket>;
  readonly metrics: StxInstance<MetricsSocket>;
  readonly observation: StxInstance<ObservationSocket>;
  readonly lastUpdated: StxInstance<LastUpdatedSocket>;
  readonly viewport: StxInstance<ViewportSocket>;
};

export const socketAt = <S, A>(
  lens: unknown
): { get: (s: S) => A; _optic: object } =>
  lens as { get: (s: S) => A; _optic: object };

const emptyText = (): TextEmpty => new TextEmpty({});
const emptyId = (): IdEmpty => new IdEmpty({});
const emptyTag = (): TagEmpty => new TagEmpty({});

export const preferLiveWell = <T extends { readonly kind: string }>(
  live: T,
  socket: T
): T => (live.kind === 'empty' ? socket : live);

export const idWellOf = (well: IdSlot): IdWell => {
  switch (well._tag) {
    case 'IdEmpty':
      return { kind: 'empty' };
    case 'IdValue':
      return { kind: 'value', id: well.id };
    default: {
      const _exhaustive: never = well;
      return _exhaustive;
    }
  }
};

export const textWellOf = (well: TextSlot): TextWell => {
  switch (well._tag) {
    case 'TextEmpty':
      return { kind: 'empty' };
    case 'TextValue':
      return { kind: 'value', text: well.text };
    default: {
      const _exhaustive: never = well;
      return _exhaustive;
    }
  }
};

export const localityWellOf = (well: LocalitySlot): LocalityWell => {
  switch (well._tag) {
    case 'LocalityEmpty':
      return { kind: 'empty' };
    case 'LocalityValue':
      return { kind: 'value', label: well.label };
    default: {
      const _exhaustive: never = well;
      return _exhaustive;
    }
  }
};

export const tagWellOf = (well: TagSlot): TagWell => {
  switch (well._tag) {
    case 'TagEmpty':
      return { kind: 'empty' };
    case 'TagValue':
      return { kind: 'value', value: well.value };
    default: {
      const _exhaustive: never = well;
      return _exhaustive;
    }
  }
};

export const mediaWellOf = (well: MediaSlot): MediaWell => {
  switch (well._tag) {
    case 'MediaEmpty':
      return { kind: 'empty' };
    case 'MediaPreview':
      return { kind: 'preview', src: well.src, caption: well.caption };
    case 'MediaMetadata':
      return { kind: 'metadata', caption: well.caption };
    default: {
      const _exhaustive: never = well;
      return _exhaustive;
    }
  }
};

export const createdAtWellOf = (well: InstantSlot): CreatedAtWell => {
  switch (well._tag) {
    case 'InstantEmpty':
      return { kind: 'empty' };
    case 'InstantValue':
      return { kind: 'value', at: well.at };
    default: {
      const _exhaustive: never = well;
      return _exhaustive;
    }
  }
};

export const statusWellOf = (phase: StatusPhase): StatusWell => {
  switch (phase) {
    case 'empty':
      return { kind: 'empty' };
    case 'raw':
    case 'filed':
    case 'working':
    case 'dead':
      return { kind: 'value', value: phase };
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
};

export const createWorkbenchSockets = (): WorkbenchSockets => ({
  intake: stx(new IntakeSocket({ mode: 'chrome' })),
  selectedId: stx(new SelectedSocket({ well: emptyId() })),
  railQuery: stx(new RailQuerySocket({ query: '' })),
  title: stx(new TitleSocket({ well: emptyId() })),
  status: stx(new StatusSocket({ phase: 'empty' })),
  locality: stx(new LocalitySocket({ well: new LocalityEmpty({}) })),
  claim: stx(new ClaimSocket({ well: emptyText() })),
  tags: stx(
    new TagsSocket({
      first: emptyTag(),
      second: emptyTag(),
      third: emptyTag(),
    })
  ),
  media: stx(
    new MediaSocket({ well: new MediaEmpty({}), caption: emptyText() })
  ),
  taxon: stx(
    new TaxonSocket({
      phylum: emptyText(),
      class: emptyText(),
      order: emptyText(),
      family: emptyText(),
    })
  ),
  metrics: stx(
    new MetricsSocket({
      tensile: emptyText(),
      density: emptyText(),
      hardness: emptyText(),
      overlap: emptyText(),
      note: emptyText(),
    })
  ),
  observation: stx(
    new ObservationSocket({
      first: emptyText(),
      second: emptyText(),
    })
  ),
  lastUpdated: stx(new LastUpdatedSocket({ well: new InstantEmpty({}) })),
  viewport: stx(
    new ViewportSocket({
      mag: emptyText(),
      readout: emptyText(),
    })
  ),
});
