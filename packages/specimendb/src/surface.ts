/**
 * Read models for Effect v4 atoms / STX surfaces.
 *
 * Surfaces bind these projections. RPC Intake/Get/List stay the write/read
 * path; this module does not invent GPS or taxon.
 *
 * @module @tmnl/specimendb/surface
 */

import {
  exifOf,
  localityOf,
  localityStateOf,
  mediaOf,
  statusOf,
  type ComponentBag,
} from './schemas/specimen.js';

export type LocalityView =
  | { readonly state: 'unknown' }
  | {
      readonly state: 'fixed';
      readonly latitude: number;
      readonly longitude: number;
      readonly altitudeMeters?: number;
      readonly accuracyMeters?: number;
      readonly source: 'exif' | 'capture-page';
    };

export const localityView = (bag: ComponentBag): LocalityView => {
  const locality = localityOf(bag);
  if (
    locality?.state === 'fixed' &&
    typeof locality.latitude === 'number' &&
    typeof locality.longitude === 'number' &&
    (locality.source === 'exif' || locality.source === 'capture-page')
  ) {
    return {
      state: 'fixed',
      latitude: locality.latitude,
      longitude: locality.longitude,
      ...(locality.altitudeMeters !== undefined ? { altitudeMeters: locality.altitudeMeters } : {}),
      ...(locality.accuracyMeters !== undefined ? { accuracyMeters: locality.accuracyMeters } : {}),
      source: locality.source,
    };
  }
  return { state: 'unknown' };
};

export const specimenSurface = (bag: ComponentBag) => ({
  status: statusOf(bag) ?? 'raw',
  locality: localityView(bag),
  exif: (() => {
    const exif = exifOf(bag);
    return {
      tags: exif?.tags ?? {},
      sidecarPath: exif?.sidecarPath,
    };
  })(),
  media: mediaOf(bag),
  localityState: localityStateOf(bag),
});
