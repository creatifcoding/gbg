/**
 * Persistence models. Schema is the source of truth; the repo stores these.
 *
 * Entity / Component / Edge are the ECS tables. LabEntityModel is the provenance
 * document shape — not a `lab_entities` / `lab_activities` table.
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
export { EdgeModel } from './EdgeModel.js';
export { catalogMigrationLoader, catalogMigrations } from './_migrations.js';
