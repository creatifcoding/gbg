/**
 * Catalog configuration.
 *
 * @module @tmnl/specimendb/schemas/config
 */

import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { CatalogConfigTagName } from '../tags.js';

export const CatalogPgSchema = Schema.Struct({
  host: Schema.String,
  port: Schema.Number,
  database: Schema.String,
  username: Schema.String,
  /** Redacted at `@effect/sql-pg` PgClient.layer. */
  password: Schema.String,
  maxConnections: Schema.optional(Schema.Number),
});
export type CatalogPg = typeof CatalogPgSchema.Type;

export const CatalogConfigSchema = Schema.Struct({
  /** Postgres connection for `@effect/sql-pg`. Default host port 5434. */
  pg: CatalogPgSchema,
  assetsRoot: Schema.String,
});
export type CatalogConfig = typeof CatalogConfigSchema.Type;

export const CatalogConfigTag = Context.Service<CatalogConfig>(CatalogConfigTagName);

export const CatalogConfigLayer = (config: CatalogConfig) =>
  Layer.succeed(CatalogConfigTag)(config);

export const CatalogConfigFromUnknown = (config: unknown) =>
  Layer.effect(
    CatalogConfigTag,
    Schema.decodeUnknownEffect(CatalogConfigSchema)(config),
  );
