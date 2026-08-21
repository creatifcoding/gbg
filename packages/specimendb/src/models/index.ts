/**
 * Persistence models. Schema is the source of truth; the repo stores these.
 *
 * LabEntityModel is the provenance row shape. The activity log stores JSONB
 * plus used/generated junctions — not a `lab_entities` table.
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
