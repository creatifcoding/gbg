/**
 * In-memory SpecimenRepo over EntityState. Same Intake/Promote loop as SQL,
 * without SqlClient. Used by the vitest testbed.
 *
 * @module @tmnl/specimendb/adapters/specimen-memory
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { buildIntakeComponents } from './intake-bundle.js';
import { SpecimenRepo } from '../repos/SpecimenRepo.js';
import { SpecimenNotFoundError } from '../schemas/errors.js';
import {
  specimenIdFromRef,
  specimenRefFromId,
  trustSpecimenId,
  type SpecimenId,
} from '../schemas/identifiers.js';
import type { CatalogRecord } from '../schemas/entity.js';
import type { Specimen } from '../schemas/specimen.js';
import { EntityState } from '../state/EntityState.js';

const nowIso = () => new Date().toISOString();
const newId = (): string => globalThis.crypto.randomUUID();

const asSpecimen = (record: CatalogRecord, fallback: SpecimenId): Specimen => ({
  id: specimenIdFromRef(record.id) ?? fallback,
  createdAt: record.createdAt,
  components: record.components,
});

export const SpecimenRepoMemory: Layer.Layer<SpecimenRepo, never, EntityState> = Layer.effect(
  SpecimenRepo,
  Effect.gen(function* () {
    const state = yield* EntityState;

    return SpecimenRepo.of({
      intake: (payload) =>
        Effect.gen(function* () {
          const specimenId = trustSpecimenId(newId());
          const entityId = specimenRefFromId(specimenId);
          const createdAt = nowIso();
          const filename = payload.filename.length > 0 ? payload.filename : 'specimen.bin';
          const assetPath = `memory://${specimenId}/${filename}`;
          const components = buildIntakeComponents(payload, {
            filename,
            assetPath,
            sidecarPath: `${assetPath}.json`,
          });
          yield* state.mint({ id: entityId, kind: 'specimen', createdAt }, components);
          return { specimenId, components };
        }),
      get: (specimenId) =>
        state.get(specimenRefFromId(specimenId)).pipe(
          Effect.map((record) => asSpecimen(record, specimenId)),
          Effect.catchTag('EntityNotFoundError', () =>
            Effect.fail(new SpecimenNotFoundError({ specimenId })),
          ),
        ),
      list: () =>
        state.list('specimen').pipe(
          Effect.map((rows) =>
            rows.flatMap((record) => {
              const id = specimenIdFromRef(record.id);
              return id === undefined ? [] : [asSpecimen(record, id)];
            }),
          ),
        ),
      promote: (specimenId) =>
        state.promote(specimenRefFromId(specimenId)).pipe(
          Effect.map((record) => asSpecimen(record, specimenId)),
          Effect.catchTag('EntityNotFoundError', () =>
            Effect.fail(new SpecimenNotFoundError({ specimenId })),
          ),
        ),
    });
  }),
);
