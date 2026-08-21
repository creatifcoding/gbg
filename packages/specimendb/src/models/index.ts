/**
 * Persistence models. Schema is the source of truth; repos store these.
 *
 * EntityModel / ComponentModel are the catalog tables.
 * LabEntityModel remains the fat provenance record — not a table.
 *
 * @module @tmnl/specimendb/models
 */

export {
  Specimen as SpecimenModel,
  IntakePayload as IntakeModel,
  IntakeResult as IntakeResultModel,
  type Specimen,
  type IntakePayload,
  type IntakeResult,
} from '../schemas/specimen.js';

export { LabEntityModel } from './LabEntityModel.js';
export { EntityModel } from './EntityModel.js';
export { ComponentModel } from './ComponentModel.js';
export { catalogMigrations, type CatalogMigrationKey } from './_migrations.js';
export { createEntitiesTable, syncEntityKindCheck, addEntityTypeColumn } from './EntityModel.ddl.js';
export { createComponentsTable, syncComponentKindCheck } from './ComponentModel.ddl.js';
