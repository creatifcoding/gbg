/**
 * Persistence models. Schema is the source of truth; the repo stores these.
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
