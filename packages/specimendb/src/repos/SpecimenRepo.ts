/**
 * SpecimenRepo — ECS persistence: entity row + attached components.
 *
 * Talks `SqlClient`. L1 is PGlite (`@effect/sql-pglite`).
 *
 * @module @tmnl/specimendb/repos/SpecimenRepo
 */

import { randomUUID } from 'node:crypto';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import type { SqlError } from 'effect/unstable/sql/SqlError';
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
  nextStatus,
  statusOf,
} from '../schemas/specimen.js';

export interface SpecimenRepoShape {
  readonly intake: (
    payload: typeof IntakePayload.Type,
  ) => Effect.Effect<typeof IntakeResult.Type, CatalogError | IntakeError>;
  readonly get: (
    specimenId: SpecimenId,
  ) => Effect.Effect<typeof Specimen.Type, CatalogError | SpecimenNotFoundError>;
  readonly list: () => Effect.Effect<ReadonlyArray<typeof Specimen.Type>, CatalogError>;
  readonly promote: (
    specimenId: SpecimenId,
  ) => Effect.Effect<typeof Specimen.Type, CatalogError | SpecimenNotFoundError>;
}

const nowIso = () => new Date().toISOString();

const decodeComponent = Schema.decodeUnknownEffect(Component);

const catalogError = (operation: string) => (cause: SqlError) =>
  new CatalogError({
    operation,
    message: cause.message,
    cause,
  });

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
      const sql = yield* SqlClient;
      const assets = yield* AssetStore;

      const insertComponent = (
        specimenId: SpecimenId,
        kind: ComponentKind,
        component: typeof Component.Type,
        attachedAt: string,
      ) =>
        sql`
          INSERT INTO components (id, specimen_id, kind, payload, attached_at)
          VALUES (
            ${randomUUID()},
            ${specimenId},
            ${kind},
            ${JSON.stringify(component)}::jsonb,
            ${attachedAt}
          )
        `.pipe(Effect.asVoid, Effect.mapError(catalogError('insertComponent')));

      const loadSpecimen = (id: SpecimenId, createdAt: string) =>
        Effect.gen(function* () {
          const componentRows = yield* sql<Record<string, unknown>>`
            SELECT payload FROM components WHERE specimen_id = ${id} ORDER BY attached_at ASC
          `.pipe(Effect.mapError(catalogError('loadComponents')));
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

          yield* assets.writeSidecar(stored.sidecarPath, toExiftoolSidecar(stored.filename, tags));
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

          yield* sql`
            INSERT INTO specimens (id, created_at) VALUES (${specimenId}, ${createdAt})
          `.pipe(Effect.asVoid, Effect.mapError(catalogError('insertSpecimen')));

          for (const component of components) {
            yield* insertComponent(specimenId, component._tag, component, createdAt);
          }

          return { specimenId, components } satisfies typeof IntakeResult.Type;
        });

      const get = Effect.fn('@tmnl/specimendb/SpecimenRepo.get')(function* (
        specimenId: SpecimenId,
      ) {
          const rows = yield* sql<{ id: string; created_at: string }>`
            SELECT id, created_at FROM specimens WHERE id = ${specimenId}
          `.pipe(Effect.mapError(catalogError('get')));
          const row = rows[0];
          if (row === undefined) {
            return yield* new SpecimenNotFoundError({ specimenId });
          }
          return yield* loadSpecimen(specimenId, row.created_at);
        });

      const list = Effect.fn('@tmnl/specimendb/SpecimenRepo.list')(function* () {
          const rows = yield* sql<{ id: string; created_at: string }>`
            SELECT id, created_at FROM specimens ORDER BY created_at ASC
          `.pipe(Effect.mapError(catalogError('list')));
          const specimens: Array<typeof Specimen.Type> = [];
          for (const row of rows) {
            specimens.push(yield* loadSpecimen(trustSpecimenId(row.id), row.created_at));
          }
          return specimens;
        });

      const promote = Effect.fn('@tmnl/specimendb/SpecimenRepo.promote')(function* (
        specimenId: SpecimenId,
      ) {
          const specimen = yield* get(specimenId);
          const current = statusOf(specimen) ?? 'raw';
          if (current === 'dead') return specimen;
          const next = nextStatus(current);
          const updated = new StatusComponent({ value: next });
          const attachedAt = nowIso();
          const existing = yield* sql<{ id: string }>`
            SELECT id FROM components
            WHERE specimen_id = ${specimenId} AND kind = ${'Status'}
            LIMIT 1
          `.pipe(Effect.mapError(catalogError('promote')));
          const row = existing[0];
          if (row === undefined) {
            yield* insertComponent(specimenId, 'Status', updated, attachedAt);
          } else {
            yield* sql`
              UPDATE components
              SET payload = ${JSON.stringify(updated)}::jsonb, attached_at = ${attachedAt}
              WHERE id = ${row.id}
            `.pipe(Effect.asVoid, Effect.mapError(catalogError('promote')));
          }
          return yield* get(specimenId);
        });

      return SpecimenRepo.of({ intake, get, list, promote });
    }),
  );
}
