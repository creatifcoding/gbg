/**
 * Persistence models. Schema is the source of truth; the repo stores these.
 *
 * LabEntityModel is the provenance row shape. No lab_entities table yet (#61).
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
