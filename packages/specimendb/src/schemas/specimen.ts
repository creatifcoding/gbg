/**
 * Specimen entity and intake payloads.
 *
 * @module @tmnl/specimendb/schemas/specimen
 */

import * as Schema from 'effect/Schema';
import { SpecimenId } from './identifiers.js';
import { Component, LocalityComponent } from './components.js';

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

export const localityOf = (specimen: Specimen): LocalityComponent | undefined =>
  specimen.components.find((c): c is LocalityComponent => c._tag === 'Locality');
