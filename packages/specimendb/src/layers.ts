/**
 * Composed catalog layers.
 *
 * Persistence L1 is `@effect/sql-pg` (`SqlClient`). Capture does not import this.
 * SpecimenRepo.intake / Promote keep the eat-file loop; extra systems talk EntityState.
 *
 * @module @tmnl/specimendb/layers
 */

import * as Layer from 'effect/Layer';
import { CatalogRepositoriesLive, EntityStateSqlLayer } from './adapters/index.js';
import { CatalogRpcsLive } from './handlers/index.js';
import { AssetStore } from './media/store.js';
import { CatalogSqlLive } from './repos/pg.js';
import { SpecimenRepo } from './repos/SpecimenRepo.js';
import { SpecimenRpcsLive } from './rpc/SpecimenRpcs.js';
import { CatalogConfigLayer, type CatalogConfig } from './schemas/config.js';

export const CatalogPersistenceLive = Layer.mergeAll(CatalogSqlLive, AssetStore.layer);

export const CatalogStateLive = EntityStateSqlLayer.pipe(
  Layer.provide(CatalogRepositoriesLive),
);

export const SpecimenCatalogLive = Layer.mergeAll(SpecimenRpcsLive, CatalogRpcsLive).pipe(
  Layer.provide(SpecimenRepo.layer),
  Layer.provide(CatalogStateLive),
  Layer.provide(CatalogPersistenceLive),
);

export const layer = (config: CatalogConfig) =>
  SpecimenCatalogLive.pipe(Layer.provide(CatalogConfigLayer(config)));
