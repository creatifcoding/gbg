/**
 * Postgres L1 — `@effect/sql-pg` client + Effect SQL Migrator.
 *
 * Provides `SqlClient`. SpecimenRepo talks that tag.
 * Shape copied from tmnl iiot (PgClient.layer + Migrator.fromRecord).
 * Do not import `@tmnl/tmnl` or iiot runtime.
 *
 * @module @tmnl/specimendb/repos/pg
 */

import { PgClient, PgMigrator } from '@effect/sql-pg';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Redacted from 'effect/Redacted';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { CatalogConfigTag, type CatalogPg } from '../schemas/config.js';

const migrations = {
  // Leftover specimens / specimen_id. Sibling Goal replaces this migrator.
  '0001_specimens': Effect.gen(function* () {
    const sql = yield* SqlClient;
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS specimens (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      )
    `);
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS components (
        id TEXT PRIMARY KEY,
        specimen_id TEXT NOT NULL REFERENCES specimens(id),
        kind TEXT NOT NULL,
        payload JSONB NOT NULL,
        attached_at TEXT NOT NULL
      )
    `);
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_components_specimen ON components(specimen_id)`,
    );
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_components_specimen_kind ON components(specimen_id, kind)`,
    );
  }),
} as const;

/** Default: postgres://specimendb:specimendb_dev@127.0.0.1:5434/specimendb */
export const DEFAULT_CATALOG_PG: CatalogPg = {
  host: '127.0.0.1',
  port: 5434,
  database: 'specimendb',
  username: 'specimendb',
  password: 'specimendb_dev',
};

export const catalogPgFromEnv = (): CatalogPg => ({
  host: process.env['SPECIMENDB_PG_HOST'] ?? DEFAULT_CATALOG_PG.host,
  port: Number(process.env['SPECIMENDB_PG_PORT'] ?? String(DEFAULT_CATALOG_PG.port)),
  database: process.env['SPECIMENDB_PG_DATABASE'] ?? DEFAULT_CATALOG_PG.database,
  username: process.env['SPECIMENDB_PG_USER'] ?? DEFAULT_CATALOG_PG.username,
  password: process.env['SPECIMENDB_PG_PASSWORD'] ?? DEFAULT_CATALOG_PG.password,
  ...(process.env['SPECIMENDB_PG_POOL_SIZE'] !== undefined
    ? { maxConnections: Number(process.env['SPECIMENDB_PG_POOL_SIZE']) }
    : {}),
});

export const pgClientLayer = (pg: CatalogPg) =>
  PgClient.layer({
    host: pg.host,
    port: pg.port,
    database: pg.database,
    username: pg.username,
    password: Redacted.make(pg.password),
    maxConnections: pg.maxConnections ?? 5,
    applicationName: '@tmnl/specimendb',
  });

export const PgFromConfig = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* CatalogConfigTag;
    return pgClientLayer(config.pg);
  }),
);

/**
 * Migrator table stays `specimendb_migrations`.
 *
 * v4 `PgMigrator.layer` types FileSystem/Path/ChildProcessSpawner for optional
 * `pg_dump`. Catalog does not dump schema. `Migrator.make({})` is the same
 * fromRecord runner iiot uses, over `SqlClient`.
 */
export const CatalogMigratorLive = Layer.effectDiscard(
  PgMigrator.make({})({
    loader: PgMigrator.fromRecord(migrations),
    table: 'specimendb_migrations',
  }),
);

export const CatalogSqlLive = CatalogMigratorLive.pipe(Layer.provideMerge(PgFromConfig));
