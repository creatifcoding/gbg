/**
 * Seed catalog rows from existing LabEntity fixtures. Do not invent a specimen.
 *
 * @module @tmnl/specimendb/adapters/seed
 */

import * as Effect from 'effect/Effect';
import { CatalogError, EntityNotFoundError } from '../schemas/errors.js';
import type { LabEntity } from '../schemas/provenance.js';
import type { CatalogRecord } from '../schemas/entity.js';
import { EntityState } from '../state/EntityState.js';
import {
  labEntityComponents,
  mintFromLabEntity,
  relationsFromLabEntity,
  runActivitySystem,
  w7FromLabEntity,
} from './activity.js';

export const seedLabEntity = (
  entity: LabEntity,
): Effect.Effect<CatalogRecord, CatalogError | EntityNotFoundError, EntityState> =>
  Effect.gen(function* () {
    const state = yield* EntityState;
    if (entity.kind === 'activity') {
      const relations = relationsFromLabEntity(entity);
      const w7 = w7FromLabEntity(entity);
      return yield* runActivitySystem(state, {
        id: entity.ref,
        type: entity.type,
        used: relations.used,
        generated: relations.generated,
        createdAt: mintFromLabEntity(entity).createdAt,
        requireTargets: false,
        ...(w7.who !== undefined ? { who: w7.who } : {}),
        ...(w7.when !== undefined ? { when: w7.when } : {}),
        ...(w7.where !== undefined ? { where: w7.where } : {}),
        ...(w7.why !== undefined ? { why: w7.why } : {}),
        ...(w7.how !== undefined ? { how: w7.how } : {}),
      });
    }
    return yield* state.ensure(mintFromLabEntity(entity), labEntityComponents(entity));
  });

/** Non-activities first so Used / Generated targets exist. */
export const seedLabEntities = (
  entities: ReadonlyArray<LabEntity>,
): Effect.Effect<ReadonlyArray<CatalogRecord>, CatalogError | EntityNotFoundError, EntityState> =>
  Effect.gen(function* () {
    const rows: Array<CatalogRecord> = [];
    for (const entity of entities.filter((item) => item.kind !== 'activity')) {
      rows.push(yield* seedLabEntity(entity));
    }
    for (const entity of entities.filter((item) => item.kind === 'activity')) {
      rows.push(yield* seedLabEntity(entity));
    }
    return rows;
  });
