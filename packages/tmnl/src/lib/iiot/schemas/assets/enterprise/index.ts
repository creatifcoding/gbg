/**
 * Enterprise Entity Schema — ISA-95 Level 4 (Business Planning)
 *
 * The top-level organizational entity in the ISA-95 hierarchy.
 * An Enterprise owns one or more Sites and represents the
 * corporate/business entity managing industrial operations.
 *
 * ISA-95 Hierarchy: **Enterprise** -> Site -> Area -> Plant -> Line -> WorkCell -> Machine -> Device -> Sensor
 *
 * @module @gbg/tmnl/iiot/schemas/assets/enterprise
 * @see {@link SiteId} for child sites
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

export {
  EnterpriseId,
  type EnterpriseId as EnterpriseIdType,
  makeEnterpriseId,
  EnterpriseStatus,
  type EnterpriseStatus as EnterpriseStatusType,
  Enterprise,
  type EnterpriseEntity,
  CreateEnterpriseParams,
  type CreateEnterpriseParams as CreateEnterpriseParamsType,
  UpdateEnterpriseParams,
  type UpdateEnterpriseParams as UpdateEnterpriseParamsType,
} from './schema'
