/**
 * Catalog configuration.
 *
 * @module @tmnl/specimendb/schemas/config
 */

import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';

export const CatalogConfigSchema = Schema.Struct({
  /** PGlite data directory, or `memory://` for an in-memory catalog. */
  dataDir: Schema.String,
  assetsRoot: Schema.String,
});
export type CatalogConfig = typeof CatalogConfigSchema.Type;

export const CatalogConfigTag = Context.Service<CatalogConfig>(
  '@tmnl/specimendb/Config',
);

export const CatalogConfigLayer = (config: CatalogConfig) =>
  Layer.succeed(CatalogConfigTag)(config);

export const CatalogConfigFromUnknown = (config: unknown) =>
  Layer.effect(
    CatalogConfigTag,
    Schema.decodeUnknownEffect(CatalogConfigSchema)(config),
  );
