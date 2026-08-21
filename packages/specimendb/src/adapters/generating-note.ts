/**
 * #81 generating-system note as an activity. Distinguishment is the relation.
 * Cheap kind+type. Used/Generated attach because this seed system ran.
 *
 * @module @tmnl/specimendb/adapters/generating-note
 */

import * as Effect from 'effect/Effect';
import { CatalogError, EntityNotFoundError, ActivityAppendError } from '../schemas/errors.js';
import { trustEntityRef, type EntityRef } from '../schemas/identifiers.js';
import { decodeLabEntity } from '../schemas/provenance.js';
import type { CatalogRecord } from '../schemas/entity.js';
import { EntityState } from '../state/EntityState.js';
import { appendActivity, declarationComponents } from './activity.js';

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

export const seedGeneratingNote = (
  yields: ReadonlyArray<EntityRef>,
): Effect.Effect<
  {
    readonly quarry: CatalogRecord;
    readonly landing: CatalogRecord;
    readonly worker: CatalogRecord;
    readonly note: CatalogRecord;
  },
  CatalogError | EntityNotFoundError | ActivityAppendError,
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
    const note = yield* appendActivity(
      state,
      decodeLabEntity({
        _tag: 'LabEntity',
        ref: NOTE81_REF,
        kind: 'activity',
        type: 'note',
        label: 'Generating-system note',
        class: 'theoretical',
        who: [{ _tag: 'Agent', agentType: 'software', label: 'bc-ab19094d', ref: 'bc-ab19094d' }],
        what: {
          used: [QUARRY_PR95_REF],
          generated: [LANDING_PR96_REF, ...yields],
        },
        when: { startedAt: NOTE_AT, gitSha: LANDING_REV },
        where: 'unknown',
        why: '#81',
        how: 'extract-and-sum',
        used: [QUARRY_PR95_REF],
        generated: [LANDING_PR96_REF, ...yields],
        wasAssociatedWith: [
          { _tag: 'Agent', agentType: 'software', label: 'bc-ab19094d', ref: 'bc-ab19094d' },
        ],
      }),
    );
    return { quarry, landing, worker, note };
  });
