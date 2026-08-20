/**
 * PGlite L1 — official `@effect/sql-pglite` client + migrator.
 *
 * Provides `SqlClient`. SpecimenRepo talks that tag.
 *
 * @module @tmnl/specimendb/repos/pglite
 */

import { PgliteClient, PgliteMigrator } from '@effect/sql-pglite';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { CatalogConfigTag } from '../schemas/config.js';

const migrations = {
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

export const PgliteFromConfig = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* CatalogConfigTag;
    return PgliteClient.layer({ dataDir: config.dataDir });
  }),
);

export const CatalogMigratorLive = PgliteMigrator.layer({
  loader: PgliteMigrator.fromRecord(migrations),
  table: 'specimendb_migrations',
});

export const CatalogSqlLive = CatalogMigratorLive.pipe(Layer.provideMerge(PgliteFromConfig));
