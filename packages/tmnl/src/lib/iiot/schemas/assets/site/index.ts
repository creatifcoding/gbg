/**
 * Site Entity Schema — ISA-95 Level 3 (MES/MOM scope - geographic)
 *
 * A physical location containing one or more Areas/Plants.
 * Sites are geographic containers representing factories, campuses, or facilities.
 *
 * ISA-95 Hierarchy: Enterprise -> **Site** -> Area -> Plant -> Line -> WorkCell -> Machine -> Device -> Sensor
 *
 * @module @gbg/tmnl/iiot/schemas/assets/site
 * @see {@link AreaId} for child areas
 * @see {@link EnterpriseId} for parent enterprise
 */

export {
  SiteId,
  type SiteId as SiteIdType,
  makeSiteId,
  SiteStatus,
  type SiteStatus as SiteStatusType,
  Site,
  CreateSiteParams,
  type CreateSiteParams as CreateSiteParamsType,
  UpdateSiteParams,
  type UpdateSiteParams as UpdateSiteParamsType,
} from './schema'
