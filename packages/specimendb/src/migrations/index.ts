/**
 * IIoT-shaped migration runner. PgMigrator.fromRecord applies ddl.ts.
 *
 * @module @tmnl/specimendb/migrations
 */

export {
  CatalogMigratorLive,
  CatalogSqlLive,
  DEFAULT_CATALOG_PG,
  PgFromConfig,
  catalogPgFromEnv,
  pgClientLayer,
} from '../repos/pg.js';
export { catalogMigrations, type CatalogMigrationKey } from '../models/_migrations.js';
