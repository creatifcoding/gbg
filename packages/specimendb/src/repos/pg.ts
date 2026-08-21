/**
 * Postgres L1 — `@effect/sql-pg` client + migrator.
 *
 * Provides `SqlClient`. SpecimenRepo and ActivityRepo talk that tag.
 * Same pin as effect: 4.0.0-beta.93. Not PGlite. Not DuckDB.
 *
 * @module @tmnl/specimendb/repos/pg
 */

import { PgClient } from '@effect/sql-pg';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Redacted from 'effect/Redacted';
import * as Migrator from 'effect/unstable/sql/Migrator';
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
  '0002_lab_activities': Effect.gen(function* () {
    const sql = yield* SqlClient;
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS lab_activities (
        ref TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        started_at TEXT NOT NULL,
        git_sha TEXT,
        where_text TEXT NOT NULL,
        why TEXT NOT NULL,
        how TEXT NOT NULL,
        who JSONB NOT NULL,
        supersedes TEXT REFERENCES lab_activities(ref),
        appended_at TEXT NOT NULL,
        appended_seq BIGSERIAL NOT NULL
      )
    `);
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS lab_used (
        activity_ref TEXT NOT NULL REFERENCES lab_activities(ref),
        entity_ref TEXT NOT NULL,
        PRIMARY KEY (activity_ref, entity_ref)
      )
    `);
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS lab_generated (
        activity_ref TEXT NOT NULL REFERENCES lab_activities(ref),
        entity_ref TEXT NOT NULL,
        PRIMARY KEY (activity_ref, entity_ref)
      )
    `);
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_lab_used_entity ON lab_used(entity_ref)`,
    );
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_lab_generated_entity ON lab_generated(entity_ref)`,
    );
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_lab_activities_started_at ON lab_activities(started_at)`,
    );
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_lab_activities_git_sha ON lab_activities(git_sha)`,
    );
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_lab_activities_why ON lab_activities(why)`,
    );
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_lab_activities_supersedes ON lab_activities(supersedes)`,
    );
    yield* sql.unsafe(`
      CREATE OR REPLACE FUNCTION lab_append_only() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
      END;
      $$ LANGUAGE plpgsql
    `);
    yield* sql.unsafe(`
      DROP TRIGGER IF EXISTS lab_activities_no_update ON lab_activities
    `);
    yield* sql.unsafe(`
      CREATE TRIGGER lab_activities_no_update
        BEFORE UPDATE OR DELETE ON lab_activities
        FOR EACH ROW EXECUTE FUNCTION lab_append_only()
    `);
    yield* sql.unsafe(`
      DROP TRIGGER IF EXISTS lab_used_no_update ON lab_used
    `);
    yield* sql.unsafe(`
      CREATE TRIGGER lab_used_no_update
        BEFORE UPDATE OR DELETE ON lab_used
        FOR EACH ROW EXECUTE FUNCTION lab_append_only()
    `);
    yield* sql.unsafe(`
      DROP TRIGGER IF EXISTS lab_generated_no_update ON lab_generated
    `);
    yield* sql.unsafe(`
      CREATE TRIGGER lab_generated_no_update
        BEFORE UPDATE OR DELETE ON lab_generated
        FOR EACH ROW EXECUTE FUNCTION lab_append_only()
    `);
  }),
} as const;

export const PgFromConfig = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* CatalogConfigTag;
    return PgClient.layer({ url: Redacted.make(config.url) });
  }),
);

export const CatalogMigratorLive = Layer.effectDiscard(
  Migrator.make({})({
    loader: Migrator.fromRecord(migrations),
    table: 'specimendb_migrations',
  }),
);

export const CatalogSqlLive = CatalogMigratorLive.pipe(Layer.provideMerge(PgFromConfig));
