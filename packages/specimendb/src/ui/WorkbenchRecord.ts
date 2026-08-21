/**
 * Workbench projection. Component presence is decided here, not in JSX.
 * Missing Status is not raw. Missing Locality is not unknown.
 *
 * @module @tmnl/specimendb/ui
 */

import type { EntityRef } from '../schemas/identifiers.js';
import type { SpecimenId } from '../schemas/identifiers.js';
import type { BytesComponent, SpecimenStatus } from '../schemas/components.js';
import { localityOf, mediaOf, type Specimen } from '../schemas/specimen.js';
import type { LabEntity } from '../schemas/provenance.js';
import { formatLocality } from './catalog-stx.js';
import { localityView } from '../surface.js';

export type WorkbenchRecord =
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'specimen';
      readonly specimen: Specimen;
      readonly preview?: string;
    };

export type WorkbenchProvenance =
  | { readonly kind: 'none' }
  | { readonly kind: 'lab-entity'; readonly entity: LabEntity };

export type EmptyWell = { readonly kind: 'empty' };

export type IdWell =
  | EmptyWell
  | { readonly kind: 'value'; readonly id: SpecimenId };
export type StatusWell =
  | EmptyWell
  | { readonly kind: 'value'; readonly value: SpecimenStatus };
export type LocalityWell =
  | EmptyWell
  | { readonly kind: 'value'; readonly label: string };
export type ClaimWell =
  | EmptyWell
  | { readonly kind: 'value'; readonly text: string };
export type TagWell =
  | EmptyWell
  | { readonly kind: 'value'; readonly value: string };
export type TextWell =
  | EmptyWell
  | { readonly kind: 'value'; readonly text: string };
export type CreatedAtWell =
  | EmptyWell
  | { readonly kind: 'value'; readonly at: string };
export type RefListWell =
  | EmptyWell
  | { readonly kind: 'value'; readonly refs: readonly EntityRef[] };

export type MediaWell =
  | EmptyWell
  | { readonly kind: 'preview'; readonly src: string; readonly caption: string }
  | { readonly kind: 'metadata'; readonly caption: string };

export type TaxonRank = 'phylum' | 'class' | 'order' | 'family';

export type TaxonWells = {
  readonly phylum: TextWell;
  readonly class: TextWell;
  readonly order: TextWell;
  readonly family: TextWell;
};

export type W7Well =
  | { readonly kind: 'empty' }
  | { readonly kind: 'value'; readonly lines: ReadonlyArray<string> };

export type WorkbenchRecordView = {
  readonly id: IdWell;
  readonly status: StatusWell;
  readonly locality: LocalityWell;
  readonly media: MediaWell;
  readonly claim: ClaimWell;
  readonly tags: readonly [TagWell, TagWell, TagWell];
  readonly taxon: TaxonWells;
  readonly observations: readonly [TextWell, TextWell];
  readonly createdAt: CreatedAtWell;
  readonly used: RefListWell;
  readonly generated: RefListWell;
  readonly bytes: TextWell;
  readonly structureNote: TextWell;
  readonly w7: W7Well;
};

const EMPTY_TAG: TagWell = { kind: 'empty' };
const EMPTY_TEXT: TextWell = { kind: 'empty' };
const EMPTY_REFS: RefListWell = { kind: 'empty' };

const EMPTY_TAXON: TaxonWells = {
  phylum: EMPTY_TEXT,
  class: EMPTY_TEXT,
  order: EMPTY_TEXT,
  family: EMPTY_TEXT,
};

export const EMPTY_WORKBENCH_VIEW: WorkbenchRecordView = {
  id: { kind: 'empty' },
  status: { kind: 'empty' },
  locality: { kind: 'empty' },
  media: { kind: 'empty' },
  claim: { kind: 'empty' },
  tags: [EMPTY_TAG, EMPTY_TAG, EMPTY_TAG],
  taxon: EMPTY_TAXON,
  observations: [EMPTY_TEXT, EMPTY_TEXT],
  createdAt: { kind: 'empty' },
  used: EMPTY_REFS,
  generated: EMPTY_REFS,
  bytes: EMPTY_TEXT,
  structureNote: EMPTY_TEXT,
  w7: { kind: 'empty' },
};

const TAXON_RANKS: readonly TaxonRank[] = [
  'phylum',
  'class',
  'order',
  'family',
];

const isTaxonRank = (rank: string): rank is TaxonRank =>
  TAXON_RANKS.some((item) => item === rank);

const present = (value: string | undefined): string | undefined => {
  if (value === undefined || value.length === 0) return undefined;
  return value;
};

const bytesLabelOf = (
  bytes: BytesComponent | LabEntity['bytes']
): string | undefined => {
  if (bytes === undefined) return undefined;
  const parts = [
    present(bytes.path),
    present(bytes.digest),
    present(bytes.gitSha),
  ].flatMap((part) => (part === undefined ? [] : [part]));
  if (parts.length === 0) return undefined;
  return parts.join(' ');
};

const projectStatus = (specimen: Specimen): StatusWell => {
  const status = specimen.components.find(
    (component) => component._tag === 'Status'
  );
  if (status === undefined || status._tag !== 'Status')
    return { kind: 'empty' };
  return { kind: 'value', value: status.value };
};

const projectLocality = (specimen: Specimen): LocalityWell => {
  const locality = localityOf(specimen);
  if (locality === undefined) return { kind: 'empty' };
  if (locality.state === 'unknown') return { kind: 'value', label: 'unknown' };
  const view = localityView(specimen);
  if (view.state !== 'fixed') return { kind: 'empty' };
  return { kind: 'value', label: formatLocality(view) };
};

const projectClaim = (specimen: Specimen): ClaimWell => {
  const claim = specimen.components.find(
    (component) => component._tag === 'Claim'
  );
  if (
    claim === undefined ||
    claim._tag !== 'Claim' ||
    claim.text.length === 0
  ) {
    return { kind: 'empty' };
  }
  return { kind: 'value', text: claim.text };
};

const projectTags = (
  specimen: Specimen
): readonly [TagWell, TagWell, TagWell] => {
  const tags = specimen.components.flatMap((component) =>
    component._tag === 'Tag' && component.value.length > 0
      ? [component.value]
      : []
  );
  return [
    tags[0] === undefined ? EMPTY_TAG : { kind: 'value', value: tags[0] },
    tags[1] === undefined ? EMPTY_TAG : { kind: 'value', value: tags[1] },
    tags[2] === undefined ? EMPTY_TAG : { kind: 'value', value: tags[2] },
  ];
};

const projectTaxon = (specimen: Specimen): TaxonWells => {
  const wells: {
    phylum: TextWell;
    class: TextWell;
    order: TextWell;
    family: TextWell;
  } = {
    phylum: EMPTY_TEXT,
    class: EMPTY_TEXT,
    order: EMPTY_TEXT,
    family: EMPTY_TEXT,
  };
  for (const component of specimen.components) {
    if (component._tag !== 'Taxon' || component.rank === undefined) continue;
    const rank = component.rank.toLowerCase();
    if (!isTaxonRank(rank)) continue;
    const name =
      present(component.scientificName) ?? present(component.commonName);
    if (name === undefined) continue;
    wells[rank] = { kind: 'value', text: name };
  }
  return wells;
};

const projectObservations = (
  specimen: Specimen
): readonly [TextWell, TextWell] => {
  const notes = specimen.components.flatMap((component) =>
    component._tag === 'Observation' && component.text.length > 0
      ? [component.text]
      : []
  );
  return [
    notes[0] === undefined ? EMPTY_TEXT : { kind: 'value', text: notes[0] },
    notes[1] === undefined ? EMPTY_TEXT : { kind: 'value', text: notes[1] },
  ];
};

const projectRelation = (
  specimen: Specimen,
  tag: 'Used' | 'Generated'
): RefListWell => {
  const refs = specimen.components.flatMap((component) =>
    component._tag === tag ? [component.target] : []
  );
  if (refs.length === 0) return EMPTY_REFS;
  return { kind: 'value', refs };
};

const projectBytesComponent = (specimen: Specimen): TextWell => {
  const bytes = specimen.components.find(
    (component) => component._tag === 'Bytes'
  );
  if (bytes === undefined || bytes._tag !== 'Bytes') return EMPTY_TEXT;
  const label = bytesLabelOf(bytes);
  if (label === undefined) return EMPTY_TEXT;
  return { kind: 'value', text: label };
};

const projectStructure = (specimen: Specimen): TextWell => {
  const structure = specimen.components.find(
    (component) => component._tag === 'Structure'
  );
  if (
    structure === undefined ||
    structure._tag !== 'Structure' ||
    structure.text.length === 0
  ) {
    return EMPTY_TEXT;
  }
  return { kind: 'value', text: structure.text };
};

const projectMedia = (
  specimen: Specimen | undefined,
  preview: string | undefined,
  bytes: TextWell
): MediaWell => {
  const media = specimen === undefined ? undefined : mediaOf(specimen);
  const filename = present(media?.filename);
  const size = media !== undefined ? `${media.byteLength} B` : undefined;
  const captionParts = [
    filename,
    size,
    bytes.kind === 'value' ? bytes.text : undefined,
  ].flatMap((part) => (part === undefined || part.length === 0 ? [] : [part]));
  const caption = captionParts.join(' ');
  if (preview !== undefined && preview.length > 0) {
    return { kind: 'preview', src: preview, caption };
  }
  if (caption.length === 0) return { kind: 'empty' };
  return { kind: 'metadata', caption };
};

const provenanceRefs = (
  entity: LabEntity,
  field: 'used' | 'generated'
): readonly EntityRef[] => {
  const direct = entity[field];
  if (direct !== undefined && direct.length > 0) return direct;
  const fromWhat = entity.what?.[field];
  if (fromWhat !== undefined && fromWhat.length > 0) return fromWhat;
  return [];
};

const refsWell = (refs: readonly EntityRef[]): RefListWell =>
  refs.length === 0 ? EMPTY_REFS : { kind: 'value', refs };

const textWell = (text: string | undefined): TextWell =>
  text === undefined || text.length === 0
    ? EMPTY_TEXT
    : { kind: 'value', text };

const metadataMedia = (caption: string): MediaWell => ({
  kind: 'metadata',
  caption,
});

const w7LinesOf = (entity: LabEntity): ReadonlyArray<string> => [
  ...(entity.who?.map((agent) => `W7 WHO ${agent.label}`) ?? []),
  ...(entity.where !== undefined ? [`W7 WHERE ${entity.where}`] : []),
  ...(entity.why !== undefined ? [`W7 WHY ${entity.why}`] : []),
  ...(entity.how !== undefined ? [`W7 HOW ${entity.how}`] : []),
];

const overlayProvenance = (
  view: WorkbenchRecordView,
  provenance: WorkbenchProvenance
): WorkbenchRecordView => {
  if (provenance.kind === 'none') return view;
  const entity = provenance.entity;
  const used =
    view.used.kind === 'value'
      ? view.used
      : refsWell(provenanceRefs(entity, 'used'));
  const generated =
    view.generated.kind === 'value'
      ? view.generated
      : refsWell(provenanceRefs(entity, 'generated'));
  const bytes =
    view.bytes.kind === 'value'
      ? view.bytes
      : textWell(bytesLabelOf(entity.bytes));
  const media =
    view.media.kind === 'empty' && bytes.kind === 'value'
      ? metadataMedia(bytes.text)
      : view.media;
  const w7Lines = w7LinesOf(entity);
  return {
    ...view,
    used,
    generated,
    bytes,
    media,
    w7:
      w7Lines.length === 0
        ? { kind: 'empty' }
        : { kind: 'value', lines: w7Lines },
  };
};

export const projectWorkbenchRecord = (
  record: WorkbenchRecord,
  provenance: WorkbenchProvenance = { kind: 'none' }
): WorkbenchRecordView => {
  if (record.kind === 'empty') {
    return overlayProvenance(EMPTY_WORKBENCH_VIEW, provenance);
  }
  const { specimen } = record;
  const bytes = projectBytesComponent(specimen);
  const view: WorkbenchRecordView = {
    id: { kind: 'value', id: specimen.id },
    status: projectStatus(specimen),
    locality: projectLocality(specimen),
    media: projectMedia(specimen, record.preview, bytes),
    claim: projectClaim(specimen),
    tags: projectTags(specimen),
    taxon: projectTaxon(specimen),
    observations: projectObservations(specimen),
    createdAt: { kind: 'value', at: specimen.createdAt },
    used: projectRelation(specimen, 'Used'),
    generated: projectRelation(specimen, 'Generated'),
    bytes,
    structureNote: projectStructure(specimen),
    w7: { kind: 'empty' },
  };
  return overlayProvenance(view, provenance);
};

export const metricsNoteOf = (view: WorkbenchRecordView): string => {
  if (view.used.kind === 'value' || view.generated.kind === 'value') {
    const refs = [
      ...(view.used.kind === 'value' ? view.used.refs : []),
      ...(view.generated.kind === 'value' ? view.generated.refs : []),
    ];
    return refs.join(' ');
  }
  if (view.structureNote.kind === 'value') return view.structureNote.text;
  return '';
};

export const wellText = (
  well: TextWell | ClaimWell | CreatedAtWell | LocalityWell
): string => {
  if (well.kind === 'empty') return '';
  if ('text' in well) return well.text;
  if ('at' in well) return well.at;
  return well.label;
};
