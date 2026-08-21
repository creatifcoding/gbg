/**
 * Catalog migrations — Migrator.fromRecord over co-located ddl.ts.
 * Shape mined from tmnl iiot `models/_migrations.ts`. Table: specimendb_migrations.
 * Two tables: entities + components. No edges table (S in ECS is systems).
 *
 * @module @tmnl/specimendb/models/_migrations
 */

import { createComponentsTable, syncComponentKindCheck } from './ComponentModel.ddl.js';
import { addEntityTypeColumn, createEntitiesTable, syncEntityKindCheck } from './EntityModel.ddl.js';

export const catalogMigrations = {
  '0001_entities': createEntitiesTable,
  '0002_components': createComponentsTable,
  '0003_component_kinds': syncComponentKindCheck,
  '0004_component_kinds': syncComponentKindCheck,
  '0005_entity_kinds': syncEntityKindCheck,
  '0006_entity_type': addEntityTypeColumn,
  '0007_component_kinds': syncComponentKindCheck,
} as const;

export type CatalogMigrationKey = keyof typeof catalogMigrations;

export const catalogMigrationRecord = catalogMigrations;
