/**
 * SpecimenRepo — ECS catalog facade: mint `kind=specimen`, attach what arrived.
 *
 * Talks EntityRepo + ComponentRepo. L1 is Postgres (`@effect/sql-pg`).
 *
 * @module @tmnl/specimendb/repos/SpecimenRepo
 */

import { randomUUID } from 'node:crypto';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { AssetStore } from '../media/store.js';
import {
  detectMediaKind,
  extractExifTags,
  gpsFromExif,
  toExiftoolSidecar,
} from '../media/exif.js';
import { CatalogError, IntakeError, SpecimenNotFoundError } from '../schemas/errors.js';
import {
  specimenIdFromRef,
  specimenRefFromId,
  trustComponentId,
  trustSpecimenId,
  type SpecimenId,
} from '../schemas/identifiers.js';
import {
  ClaimComponent,
  Component,
  ExifComponent,
  LocalityComponent,
  MediaComponent,
  StatusComponent,
} from '../schemas/components.js';
import {
  IntakePayload,
  IntakeResult,
  Specimen,
  nextStatus,
  statusOf,
} from '../schemas/specimen.js';
import { ComponentRepo } from './ComponentRepo.js';
import { EntityRepo } from './EntityRepo.js';

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
  rows: ReadonlyArray<{ readonly payload: unknown }>,
): Effect.Effect<ReadonlyArray<typeof Component.Type>, CatalogError> =>
  Effect.gen(function* () {
    const out: Array<typeof Component.Type> = [];
    for (const row of rows) {
      const decoded = yield* decodeComponent(parsePayload(row.payload)).pipe(
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
      const entities = yield* EntityRepo;
      const components = yield* ComponentRepo;
      const assets = yield* AssetStore;

      const insertComponent = (
        entityId: ReturnType<typeof specimenRefFromId>,
        component: typeof Component.Type,
        attachedAt: string,
      ) =>
        components.insert({
          id: trustComponentId(randomUUID()),
          entityId,
          kind: component._tag,
          payload: component,
          attachedAt,
        });

      const loadSpecimen = (specimenId: SpecimenId, createdAt: string) =>
        Effect.gen(function* () {
          const entityId = specimenRefFromId(specimenId);
          const componentRows = yield* components.findByEntity(entityId);
          const bag = yield* rowsToComponents(componentRows);
          return { id: specimenId, createdAt, components: bag } satisfies typeof Specimen.Type;
        });

      const intake = Effect.fn('@tmnl/specimendb/SpecimenRepo.intake')(function* (
        payload: typeof IntakePayload.Type,
      ) {
        const specimenId = trustSpecimenId(randomUUID());
        const entityId = specimenRefFromId(specimenId);
        const createdAt = nowIso();
        const kind = detectMediaKind(payload.bytes, payload.filename, payload.mediaType);
        const stored = yield* assets.storeOriginal(specimenId, payload.filename, payload.bytes);
        const tags = extractExifTags(payload.bytes, kind);
        const gps = gpsFromExif(tags);

        const attached: Array<typeof Component.Type> = [
          new StatusComponent({ value: 'raw' }),
          new MediaComponent({
            kind,
            filename: stored.filename,
            assetPath: stored.assetPath,
            mediaType:
              payload.mediaType ??
              (kind === 'jpeg' ? 'image/jpeg' : kind === 'heic' ? 'image/heic' : 'application/octet-stream'),
            byteLength: payload.bytes.byteLength,
          }),
        ];

        if (payload.claim !== undefined || payload.title !== undefined) {
          attached.push(
            new ClaimComponent({
              text: payload.claim ?? payload.title ?? '',
              ...(payload.title !== undefined ? { title: payload.title } : {}),
            }),
          );
        }

        yield* assets.writeSidecar(stored.sidecarPath, toExiftoolSidecar(stored.filename, tags));
        attached.push(
          new ExifComponent({
            tags,
            sidecarPath: stored.sidecarPath,
          }),
        );

        if (gps !== undefined) {
          attached.push(
            new LocalityComponent({
              state: 'fixed',
              latitude: gps.latitude,
              longitude: gps.longitude,
              ...(gps.altitudeMeters !== undefined ? { altitudeMeters: gps.altitudeMeters } : {}),
              source: 'exif',
            }),
          );
        } else if (payload.geo !== undefined) {
          attached.push(
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
          attached.push(new LocalityComponent({ state: 'unknown' }));
        }

        yield* entities.insert({
          id: entityId,
          kind: 'specimen',
          createdAt,
        });

        for (const component of attached) {
          yield* insertComponent(entityId, component, createdAt);
        }

        return { specimenId, components: attached } satisfies typeof IntakeResult.Type;
      });

      const get = Effect.fn('@tmnl/specimendb/SpecimenRepo.get')(function* (
        specimenId: SpecimenId,
      ) {
        const entityId = specimenRefFromId(specimenId);
        const row = yield* entities.findById(entityId);
        if (Option.isNone(row) || row.value.kind !== 'specimen') {
          return yield* new SpecimenNotFoundError({ specimenId });
        }
        return yield* loadSpecimen(specimenId, row.value.createdAt);
      });

      const list = Effect.fn('@tmnl/specimendb/SpecimenRepo.list')(function* () {
        const rows = yield* entities.findByKind('specimen');
        const specimens: Array<typeof Specimen.Type> = [];
        for (const row of rows) {
          const specimenId = specimenIdFromRef(row.id);
          if (specimenId === undefined) continue;
          specimens.push(yield* loadSpecimen(specimenId, row.createdAt));
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
        const entityId = specimenRefFromId(specimenId);
        const existing = yield* components.findIdByEntityKind(entityId, 'Status');
        if (Option.isNone(existing)) {
          yield* insertComponent(entityId, updated, attachedAt);
        } else {
          yield* components.updatePayload(existing.value, updated, attachedAt);
        }
        return yield* get(specimenId);
      });

      return SpecimenRepo.of({ intake, get, list, promote });
    }),
  );
}
