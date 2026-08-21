/**
 * #81 generating-system note as a cheap entity. Kind + type only.
 * Used / Generated are not attached. Distinguishment is a later system's job.
 *
 * @module @tmnl/specimendb/adapters/generating-note
 */

import * as Effect from 'effect/Effect';
import { CatalogError, EntityNotFoundError } from '../schemas/errors.js';
import { trustEntityRef } from '../schemas/identifiers.js';
import type { CatalogRecord } from '../schemas/entity.js';
import { EntityState } from '../state/EntityState.js';
import { declarationComponents } from './activity.js';

/** Driver-cut commit on the quarry branch. Cited, not merged. */
export const QUARRY_REV = '61f37832' as const;
/** Extract-and-sum commit on this landing. */
export const LANDING_REV = 'c8f3ec83' as const;
const NOTE_AT = '2026-08-21T03:42:55Z';

export const QUARRY_PR95_REF = trustEntityRef(`gbg:pr:95@${QUARRY_REV}`);
export const LANDING_PR96_REF = trustEntityRef(`gbg:pr:96@${LANDING_REV}`);
export const NOTE81_REF = trustEntityRef('gbg:activity:note-81@5364921570');
export const WORKER_REF = trustEntityRef('gbg:activity:bc-ab19094d@pr96');

const QUARRY_PATH = 'packages/specimendb/src/repos/pg.ts';
const LANDING_PATH = 'packages/specimendb/src/models/_migrations.ts';

export const seedGeneratingNote = (): Effect.Effect<
  {
    readonly quarry: CatalogRecord;
    readonly landing: CatalogRecord;
    readonly worker: CatalogRecord;
    readonly note: CatalogRecord;
  },
  CatalogError | EntityNotFoundError,
  EntityState
> =>
  Effect.gen(function* () {
    const state = yield* EntityState;
    const quarry = yield* state.ensure(
      {
        id: QUARRY_PR95_REF,
        kind: 'pr',
        type: 'quarry',
        createdAt: NOTE_AT,
      },
      declarationComponents({
        kind: 'pr',
        type: 'quarry',
        bytes: { gitSha: QUARRY_REV, path: QUARRY_PATH },
      }),
    );
    const landing = yield* state.ensure(
      {
        id: LANDING_PR96_REF,
        kind: 'pr',
        type: 'landing',
        createdAt: NOTE_AT,
      },
      declarationComponents({
        kind: 'pr',
        type: 'landing',
        bytes: { gitSha: LANDING_REV, path: LANDING_PATH },
      }),
    );
    const worker = yield* state.ensure(
      {
        id: WORKER_REF,
        kind: 'activity',
        type: 'worker',
        createdAt: NOTE_AT,
      },
      declarationComponents({ kind: 'activity', type: 'worker' }),
    );
    const note = yield* state.ensure(
      {
        id: NOTE81_REF,
        kind: 'activity',
        type: 'note',
        createdAt: NOTE_AT,
      },
      declarationComponents({ kind: 'activity', type: 'note' }),
    );
    return { quarry, landing, worker, note };
  });
