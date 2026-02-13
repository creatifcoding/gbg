/**
 * Plant Entity Schema — ISA-95 Level 2 (Supervisory Control - functional)
 *
 * A functional production unit within an Area. Plants contain production Lines
 * and represent a self-contained manufacturing capability.
 *
 * ISA-95 Hierarchy: Enterprise -> Site -> Area -> **Plant** -> Line -> WorkCell -> Machine -> Device -> Sensor
 *
 * @module @gbg/tmnl/iiot/schemas/assets/plant
 * @see {@link AreaId} for parent area
 * @see {@link LineId} for child production lines
 */

export {
  PlantId,
  type PlantId as PlantIdType,
  makePlantId,
  PlantStatus,
  type PlantStatus as PlantStatusType,
  Plant,
  type PlantEntity,
  CreatePlantParams,
  type CreatePlantParams as CreatePlantParamsType,
  UpdatePlantParams,
  type UpdatePlantParams as UpdatePlantParamsType,
} from './schema'
