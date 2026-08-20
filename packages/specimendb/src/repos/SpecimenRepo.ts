/**
 * SpecimenRepo — ECS persistence: entity row + attached components.
 *
 * @module @tmnl/specimendb/repos/SpecimenRepo
 */

import { randomUUID } from 'node:crypto';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { DuckDbClient } from './duckdb.js';
import { AssetStore } from '../media/store.js';
import {
  detectMediaKind,
  extractExifTags,
  gpsFromExif,
  toExiftoolSidecar,
} from '../media/exif.js';
import {
  CatalogError,
  IntakeError,
  SpecimenNotFoundError,
} from '../schemas/errors.js';
import { trustSpecimenId, type SpecimenId } from '../schemas/identifiers.js';
import {
  ClaimComponent,
  Component,
  ExifComponent,
  LocalityComponent,
  MediaComponent,
  StatusComponent,
  type ComponentKind,
} from '../schemas/components.js';
import {
  IntakePayload,
  IntakeResult,
  Specimen,
} from '../schemas/specimen.js';

export interface SpecimenRepoShape {
  readonly intake: (
    payload: typeof IntakePayload.Type,
  ) => Effect.Effect<typeof IntakeResult.Type, CatalogError | IntakeError>;
  readonly get: (
    specimenId: SpecimenId,
  ) => Effect.Effect<typeof Specimen.Type, CatalogError | SpecimenNotFoundError>;
  readonly list: () => Effect.Effect<ReadonlyArray<typeof Specimen.Type>, CatalogError>;
}

const nowIso = () => new Date().toISOString();

const decodeComponent = Schema.decodeUnknownEffect(Component);

const parsePayload = (raw: unknown): unknown => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
};

const rowsToComponents = (
  rows: ReadonlyArray<Record<string, unknown>>,
): Effect.Effect<ReadonlyArray<typeof Component.Type>, CatalogError> =>
  Effect.gen(function* () {
    const out: Array<typeof Component.Type> = [];
    for (const row of rows) {
      const decoded = yield* decodeComponent(parsePayload(row['payload'])).pipe(
        Effect.mapError(
          (cause) =>
            new CatalogError({
              operation: 'decodeComponent',
              message: 'Failed to decode stored component',
              cause,
            }),
        ),
      );
      out.push(decoded);
    }
    return out;
  });

export class SpecimenRepo extends Context.Service<SpecimenRepo, SpecimenRepoShape>()(
  '@tmnl/specimendb/SpecimenRepo',
) {
  static readonly layer = Layer.effect(
    SpecimenRepo,
    Effect.gen(function* () {
      const db = yield* DuckDbClient;
      const assets = yield* AssetStore;

      const insertComponent = (
        specimenId: SpecimenId,
        kind: ComponentKind,
        component: typeof Component.Type,
        attachedAt: string,
      ) =>
        db.runValues(
          `INSERT INTO components (id, specimen_id, kind, payload, attached_at)
           VALUES ($1, $2, $3, $4::JSON, $5)`,
          [randomUUID(), specimenId, kind, JSON.stringify(component), attachedAt],
        );

      const loadSpecimen = (id: SpecimenId, createdAt: string) =>
        Effect.gen(function* () {
          const componentRows = yield* db.query(
            `SELECT payload FROM components WHERE specimen_id = $1 ORDER BY attached_at ASC`,
            [id],
          );
          const components = yield* rowsToComponents(componentRows);
          return { id, createdAt, components } satisfies typeof Specimen.Type;
        });

      const intake = Effect.fn('@tmnl/specimendb/SpecimenRepo.intake')(function* (
        payload: typeof IntakePayload.Type,
      ) {
          const specimenId = trustSpecimenId(randomUUID());
          const createdAt = nowIso();
          const kind = detectMediaKind(payload.bytes, payload.filename, payload.mediaType);
          const stored = yield* assets.storeOriginal(specimenId, payload.filename, payload.bytes);
          const tags = extractExifTags(payload.bytes, kind);
          const gps = gpsFromExif(tags);

          const components: Array<typeof Component.Type> = [
            new StatusComponent({ value: 'raw' }),
            new MediaComponent({
              kind,
              filename: stored.filename,
              assetPath: stored.assetPath,
              mediaType: payload.mediaType ?? (kind === 'jpeg' ? 'image/jpeg' : kind === 'heic' ? 'image/heic' : 'application/octet-stream'),
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

          if (Object.keys(tags).length > 0) {
            yield* assets.writeSidecar(stored.sidecarPath, toExiftoolSidecar(stored.filename, tags));
            components.push(
              new ExifComponent({
                tags,
                sidecarPath: stored.sidecarPath,
              }),
            );
          }

          if (gps !== undefined) {
            components.push(
              new LocalityComponent({
                latitude: gps.latitude,
                longitude: gps.longitude,
                ...(gps.altitudeMeters !== undefined ? { altitudeMeters: gps.altitudeMeters } : {}),
                source: 'exif',
              }),
            );
          } else if (payload.geo !== undefined) {
            components.push(
              new LocalityComponent({
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
          }

          yield* db.runValues(`INSERT INTO specimens (id, created_at) VALUES ($1, $2)`, [
            specimenId,
            createdAt,
          ]);

          for (const component of components) {
            yield* insertComponent(specimenId, component._tag, component, createdAt);
          }

          return { specimenId, components } satisfies typeof IntakeResult.Type;
        });

      const get = Effect.fn('@tmnl/specimendb/SpecimenRepo.get')(function* (
        specimenId: SpecimenId,
      ) {
          const rows = yield* db.query(`SELECT id, created_at FROM specimens WHERE id = $1`, [
            specimenId,
          ]);
          const row = rows[0];
          if (row === undefined) {
            return yield* new SpecimenNotFoundError({ specimenId });
          }
          return yield* loadSpecimen(specimenId, String(row['created_at']));
        });

      const list = Effect.fn('@tmnl/specimendb/SpecimenRepo.list')(function* () {
          const rows = yield* db.query(`SELECT id, created_at FROM specimens ORDER BY created_at ASC`);
          const specimens: Array<typeof Specimen.Type> = [];
          for (const row of rows) {
            specimens.push(
              yield* loadSpecimen(trustSpecimenId(String(row['id'])), String(row['created_at'])),
            );
          }
          return specimens;
        });

      return SpecimenRepo.of({ intake, get, list });
    }),
  );
}
