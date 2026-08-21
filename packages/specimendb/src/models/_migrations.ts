/**
 * Catalog migrations — Migrator.fromRecord, co-located model DDL.
 *
 * 0001_specimens is the retired leftover (specimens + components.specimen_id).
 * Already-applied DBs skip it; 0002_ecs drops that shape and creates ECS tables.
 *
 * @module @tmnl/specimendb/models/_migrations
 */

import * as Effect from 'effect/Effect';
import * as Migrator from 'effect/unstable/sql/Migrator';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { createComponentsTable } from './ComponentModel.ddl.js';
import { createEdgesTable } from './EdgeModel.ddl.js';
import { createEntitiesTable } from './EntityModel.ddl.js';

const dropLeftoverSpecimenTables = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`DROP TABLE IF EXISTS specimens CASCADE`;
  yield* sql`DROP TABLE IF EXISTS components CASCADE`;
});

export const catalogMigrations = {
  '0001_specimens': Effect.void,
  '0002_ecs': Effect.gen(function* () {
    yield* dropLeftoverSpecimenTables;
    yield* createEntitiesTable;
    yield* createComponentsTable;
    yield* createEdgesTable;
  }),
} as const;

export const catalogMigrationLoader = Migrator.fromRecord(catalogMigrations);
