/**
 * Specimen entity and intake payloads.
 *
 * @module @tmnl/specimendb/schemas/specimen
 */

import * as Schema from 'effect/Schema';
import { SpecimenId } from './identifiers.js';
import {
  AnalogLinkComponent,
  Component,
  FunctionComponent,
  LocalityComponent,
  MechanismComponent,
  ObservationComponent,
  StructureComponent,
  type SpecimenStatus,
} from './components.js';

export const CaptureGeo = Schema.Struct({
  latitude: Schema.Number,
  longitude: Schema.Number,
  altitudeMeters: Schema.optional(Schema.Number),
  accuracyMeters: Schema.optional(Schema.Number),
});
export type CaptureGeo = typeof CaptureGeo.Type;

export const IntakePayload = Schema.Struct({
  bytes: Schema.Uint8Array,
  filename: Schema.String,
  mediaType: Schema.optional(Schema.String),
  claim: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  geo: Schema.optional(CaptureGeo),
});
export type IntakePayload = typeof IntakePayload.Type;

export const Specimen = Schema.Struct({
  id: SpecimenId,
  createdAt: Schema.String,
  components: Schema.Array(Component),
});
export type Specimen = typeof Specimen.Type;

export const IntakeResult = Schema.Struct({
  specimenId: SpecimenId,
  components: Schema.Array(Component),
});
export type IntakeResult = typeof IntakeResult.Type;

export const GetPayload = Schema.Struct({
  specimenId: SpecimenId,
});
export type GetPayload = typeof GetPayload.Type;

/** Evidence/catalog attachables only. Locality, Taxon, Media, Exif, Status are not admitted. */
export const AttachableComponent = Schema.Union([
  ObservationComponent,
  StructureComponent,
  MechanismComponent,
  FunctionComponent,
  AnalogLinkComponent,
]);
export type AttachableComponent = typeof AttachableComponent.Type;

export const AttachPayload = Schema.Struct({
  specimenId: SpecimenId,
  component: AttachableComponent,
});
export type AttachPayload = typeof AttachPayload.Type;

export type ComponentBag = { readonly components: ReadonlyArray<Component> };

export const localityOf = (specimen: ComponentBag): LocalityComponent | undefined =>
  specimen.components.find((c): c is LocalityComponent => c._tag === 'Locality');

export const localityStateOf = (specimen: ComponentBag): LocalityComponent['state'] => {
  const locality = localityOf(specimen);
  return locality?.state === 'fixed' ? 'fixed' : 'unknown';
};

export const statusOf = (specimen: ComponentBag): SpecimenStatus | undefined => {
  const status = specimen.components.find((c) => c._tag === 'Status');
  return status?._tag === 'Status' ? status.value : undefined;
};

/** raw → filed → working → dead. Dead stays dead. */
export const nextStatus = (status: SpecimenStatus): SpecimenStatus => {
  switch (status) {
    case 'raw':
      return 'filed';
    case 'filed':
      return 'working';
    case 'working':
      return 'dead';
    case 'dead':
      return 'dead';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
};

export const exifOf = (specimen: ComponentBag) => {
  const exif = specimen.components.find((c) => c._tag === 'Exif');
  return exif?._tag === 'Exif' ? exif : undefined;
};

export const mediaOf = (specimen: ComponentBag) => {
  const media = specimen.components.find((c) => c._tag === 'Media');
  return media?._tag === 'Media' ? media : undefined;
};
