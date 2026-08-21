/**
 * Pure intake bundle. Eat whatever arrived. Do not invent GPS/taxon.
 * Safe for the memory testbed (no node:fs, no SQL).
 *
 * @module @tmnl/specimendb/adapters/intake-bundle
 */

import {
  ClaimComponent,
  ExifComponent,
  KindComponent,
  LocalityComponent,
  MediaComponent,
  StatusComponent,
  type Component,
} from '../schemas/components.js';
import { detectMediaKind, extractExifTags, gpsFromExif } from '../media/exif.js';
import type { IntakePayload } from '../schemas/specimen.js';

export interface StoredIntakeAsset {
  readonly filename: string;
  readonly assetPath: string;
  readonly sidecarPath: string;
}

export const buildIntakeComponents = (
  payload: typeof IntakePayload.Type,
  stored: StoredIntakeAsset,
): ReadonlyArray<Component> => {
  const kind = detectMediaKind(payload.bytes, payload.filename, payload.mediaType);
  const tags = extractExifTags(payload.bytes, kind);
  const gps = gpsFromExif(tags);
  const mediaType =
    payload.mediaType ??
    (kind === 'jpeg' ? 'image/jpeg' : kind === 'heic' ? 'image/heic' : 'application/octet-stream');

  const components: Array<Component> = [
    new KindComponent({ value: 'specimen' }),
    new StatusComponent({ value: 'raw' }),
    new MediaComponent({
      kind,
      filename: stored.filename,
      assetPath: stored.assetPath,
      mediaType,
      byteLength: payload.bytes.byteLength,
    }),
  ];

  if (payload.claim !== undefined || payload.title !== undefined) {
    components.push(
      new ClaimComponent({
        text: payload.claim ?? payload.title ?? '',
        ...(payload.title !== undefined ? { title: payload.title } : {}),
      }),
    );
  }

  components.push(
    new ExifComponent({
      tags,
      sidecarPath: stored.sidecarPath,
    }),
  );

  if (gps !== undefined) {
    components.push(
      new LocalityComponent({
        state: 'fixed',
        latitude: gps.latitude,
        longitude: gps.longitude,
        ...(gps.altitudeMeters !== undefined ? { altitudeMeters: gps.altitudeMeters } : {}),
        source: 'exif',
      }),
    );
  } else if (payload.geo !== undefined) {
    components.push(
      new LocalityComponent({
        state: 'fixed',
        latitude: payload.geo.latitude,
        longitude: payload.geo.longitude,
        ...(payload.geo.altitudeMeters !== undefined
          ? { altitudeMeters: payload.geo.altitudeMeters }
          : {}),
        ...(payload.geo.accuracyMeters !== undefined
          ? { accuracyMeters: payload.geo.accuracyMeters }
          : {}),
        source: 'capture-page',
      }),
    );
  } else {
    components.push(new LocalityComponent({ state: 'unknown' }));
  }

  return components;
};
