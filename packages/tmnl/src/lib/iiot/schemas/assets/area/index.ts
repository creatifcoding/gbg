/**
 * Area Entity Schema — ISA-95 Level 2 (Supervisory Control)
 *
 * A logical production area within a Site. Areas group Plants or Lines
 * for SCADA/supervisory control scope (building, floor, zone).
 *
 * ISA-95 Hierarchy: Enterprise -> Site -> **Area** -> Plant -> Line -> WorkCell -> Machine -> Device -> Sensor
 *
 * @module @gbg/tmnl/iiot/schemas/assets/area
 * @see {@link SiteId} for parent site
 * @see {@link PlantId} for child plants
 */

export {
  AreaId,
  type AreaId as AreaIdType,
  makeAreaId,
  AreaStatus,
  type AreaStatus as AreaStatusType,
  AreaType,
  type AreaType as AreaTypeValue,
  Area,
  CreateAreaParams,
  type CreateAreaParams as CreateAreaParamsType,
  UpdateAreaParams,
  type UpdateAreaParams as UpdateAreaParamsType,
} from './schema'
