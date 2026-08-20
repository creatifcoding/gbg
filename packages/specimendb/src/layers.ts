/**
 * Composed catalog layers.
 *
 * @module @tmnl/specimendb/layers
 */

import * as Layer from 'effect/Layer';
import { AssetStore } from './media/store.js';
import { CatalogSqlLive } from './repos/pglite.js';
import { SpecimenRepo } from './repos/SpecimenRepo.js';
import { SpecimenRpcsLive } from './rpc/SpecimenRpcs.js';
import { CatalogConfigLayer, type CatalogConfig } from './schemas/config.js';

export const CatalogPersistenceLive = Layer.mergeAll(CatalogSqlLive, AssetStore.layer);

export const SpecimenCatalogLive = SpecimenRpcsLive.pipe(
  Layer.provide(SpecimenRepo.layer),
  Layer.provide(CatalogPersistenceLive),
);

export const layer = (config: CatalogConfig) =>
  SpecimenCatalogLive.pipe(Layer.provide(CatalogConfigLayer(config)));
