/**
 * SQL state adapter — repos to EntityState. Handlers (systems) do not talk SQL.
 * Shape mined from iiot `layers/` AllStateServicesSql.
 *
 * @module @tmnl/specimendb/adapters/sql
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { ComponentRepo } from '../repos/ComponentRepo.js';
import { EntityRepo } from '../repos/EntityRepo.js';
import { EntityState, makeEntityStateSql } from '../state/EntityState.js';

export const EntityStateSqlLayer: Layer.Layer<
  EntityState,
  never,
  EntityRepo | ComponentRepo
> = Layer.effect(
  EntityState,
  Effect.gen(function* () {
    const entities = yield* EntityRepo;
    const components = yield* ComponentRepo;
    return EntityState.of(makeEntityStateSql({ entities, components }));
  }),
);

export const CatalogRepositoriesLive = Layer.mergeAll(EntityRepo.layer, ComponentRepo.layer);
