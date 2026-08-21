/**
 * Catalog migrations — Migrator.fromRecord, co-located model DDL.
 *
 * 0001_specimens is the retired leftover (specimens + components.specimen_id).
 * Already-applied DBs skip it; 0002_ecs drops that shape and creates ECS tables.
 * 0003 drops the edges leftover (S is systems — Used/Generated are components).
 *
 * @module @tmnl/specimendb/models/_migrations
 */

import * as Effect from 'effect/Effect';
import * as Migrator from 'effect/unstable/sql/Migrator';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { createComponentsTable, ensureComponentKindCheck } from './ComponentModel.ddl.js';
import { createEntitiesTable } from './EntityModel.ddl.js';

const dropLeftoverSpecimenTables = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`DROP TABLE IF EXISTS specimens CASCADE`;
  yield* sql`DROP TABLE IF EXISTS components CASCADE`;
});

const dropLeftoverEdges = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`DROP TABLE IF EXISTS edges CASCADE`;
  yield* sql`DROP FUNCTION IF EXISTS catalog_edges_append_only()`;
});

export const catalogMigrations = {
  '0001_specimens': Effect.void,
  '0002_ecs': Effect.gen(function* () {
    yield* dropLeftoverSpecimenTables;
    yield* createEntitiesTable;
    yield* createComponentsTable;
  }),
  '0003_no_edges': Effect.gen(function* () {
    yield* dropLeftoverEdges;
    yield* ensureComponentKindCheck;
  }),
} as const;

export const catalogMigrationLoader = Migrator.fromRecord(catalogMigrations);
