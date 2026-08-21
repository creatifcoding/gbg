/**
 * Composed catalog layers.
 *
 * @module @tmnl/specimendb/layers
 */

import * as Layer from 'effect/Layer';
import { AssetStore } from './media/store.js';
import { CatalogSqlLive } from './repos/pglite.js';
import { ActivityRepo } from './repos/ActivityRepo.js';
import { SpecimenRepo } from './repos/SpecimenRepo.js';
import { ActivityRpcsLive } from './rpc/ActivityRpcs.js';
import { SpecimenRpcsLive } from './rpc/SpecimenRpcs.js';
import { CatalogConfigLayer, type CatalogConfig } from './schemas/config.js';

export const CatalogPersistenceLive = Layer.mergeAll(CatalogSqlLive, AssetStore.layer);

export const SpecimenCatalogLive = SpecimenRpcsLive.pipe(
  Layer.provide(SpecimenRepo.layer),
  Layer.provide(CatalogPersistenceLive),
);

export const ActivityLogLive = ActivityRpcsLive.pipe(
  Layer.provide(ActivityRepo.layer),
);

/**
 * One PGlite process: specimen RPCs + append-only activity log.
 * CatalogSqlLive is provided once so the log is not a second catalog.
 */
export const layer = (config: CatalogConfig) =>
  Layer.mergeAll(
    SpecimenRpcsLive.pipe(Layer.provide(SpecimenRepo.layer)),
    ActivityRpcsLive.pipe(Layer.provide(ActivityRepo.layer)),
  ).pipe(
    Layer.provideMerge(CatalogPersistenceLive),
    Layer.provide(CatalogConfigLayer(config)),
  );
