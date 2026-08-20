/**
 * Browser-safe in-memory Intake/Get/List/Promote client.
 * Same EXIF/locality rules as the catalog. Does not import PGlite or node:fs.
 *
 * @module
 */

import * as Effect from 'effect/Effect';
import {
  ClaimComponent,
  ExifComponent,
  LocalityComponent,
  MediaComponent,
  StatusComponent,
  type Component,
} from '../src/schemas/components.js';
import { AttachError, SpecimenNotFoundError } from '../src/schemas/errors.js';
import { trustSpecimenId, type SpecimenId } from '../src/schemas/identifiers.js';
import {
  nextStatus,
  statusOf,
  type AttachPayload,
  type IntakePayload,
  type IntakeResult,
  type Specimen,
} from '../src/schemas/specimen.js';
import { detectMediaKind, extractExifTags, gpsFromExif } from '../src/media/exif.js';
import type { SpecimenRpcClient } from '../src/ui/catalog-stx.js';

const newId = (): string => globalThis.crypto.randomUUID();

export const makeMemoryRepo = () => {
  const rows = new Map<string, Specimen>();

  const intake = (payload: typeof IntakePayload.Type) =>
    Effect.sync(() => {
      const specimenId = trustSpecimenId(newId());
      const createdAt = new Date().toISOString();
      const kind = detectMediaKind(payload.bytes, payload.filename, payload.mediaType);
      const filename = payload.filename.length > 0 ? payload.filename : 'specimen.bin';
      const assetPath = `memory://${specimenId}/${filename}`;
      const sidecarPath = `${assetPath}.json`;
      const tags = extractExifTags(payload.bytes, kind);
      const gps = gpsFromExif(tags);
      const mediaType =
        payload.mediaType ??
        (kind === 'jpeg' ? 'image/jpeg' : kind === 'heic' ? 'image/heic' : 'application/octet-stream');

      const components: Array<Component> = [
        new StatusComponent({ value: 'raw' }),
        new MediaComponent({
          kind,
          filename,
          assetPath,
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

      components.push(new ExifComponent({ tags, sidecarPath }));

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
            ...(payload.geo.altitudeMeters !== undefined ? { altitudeMeters: payload.geo.altitudeMeters } : {}),
            ...(payload.geo.accuracyMeters !== undefined ? { accuracyMeters: payload.geo.accuracyMeters } : {}),
            source: 'capture-page',
          }),
        );
      } else {
        components.push(new LocalityComponent({ state: 'unknown' }));
      }

      const specimen: Specimen = { id: specimenId, createdAt, components };
      rows.set(specimenId, specimen);
      return { specimenId, components } satisfies typeof IntakeResult.Type;
    });

  const get = (specimenId: SpecimenId) =>
    Effect.gen(function* () {
      const specimen = rows.get(specimenId);
      if (specimen === undefined) {
        return yield* new SpecimenNotFoundError({ specimenId });
      }
      return specimen;
    });

  const list = () =>
    Effect.sync(() => [...rows.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));

  const promote = (specimenId: SpecimenId) =>
    Effect.gen(function* () {
      const specimen = yield* get(specimenId);
      const current = statusOf(specimen) ?? 'raw';
      if (current === 'dead') return specimen;
      const next = nextStatus(current);
      const replacement = new StatusComponent({ value: next });
      const hasStatus = specimen.components.some((component) => component._tag === 'Status');
      const components = hasStatus
        ? specimen.components.map((component) =>
            component._tag === 'Status' ? replacement : component,
          )
        : [replacement, ...specimen.components];
      const updated: Specimen = { ...specimen, components };
      rows.set(specimenId, updated);
      return updated;
    });

  const attach = (payload: typeof AttachPayload.Type) =>
    Effect.gen(function* () {
      const tag: string = payload.component._tag;
      if (tag === 'Locality') {
        return yield* new AttachError({
          specimenId: payload.specimenId,
          reason: 'invented-locality',
          message: 'Attach cannot admit Locality or GPS',
        });
      }
      if (tag === 'Taxon') {
        return yield* new AttachError({
          specimenId: payload.specimenId,
          reason: 'invented-taxon',
          message: 'Attach cannot admit Taxon',
        });
      }
      const specimen = yield* get(payload.specimenId);
      const updated: Specimen = {
        ...specimen,
        components: [...specimen.components, payload.component],
      };
      rows.set(payload.specimenId, updated);
      return updated;
    });

  return { intake, get, list, promote, attach };
};

export const makeMemoryClient = (): SpecimenRpcClient => {
  const repo = makeMemoryRepo();
  return {
    Intake: (payload) => repo.intake(payload),
    Get: (payload) => repo.get(payload.specimenId),
    List: () => repo.list(),
    Promote: (payload) => repo.promote(payload.specimenId),
    Attach: (payload) => repo.attach(payload),
  };
};
