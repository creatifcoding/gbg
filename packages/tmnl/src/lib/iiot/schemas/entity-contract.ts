/**
 * Entity Contract — Abstract Contract for ISA-95 Equipment Entities
 *
 * All equipment hierarchy entities must satisfy this contract for:
 * - Operational status queries
 * - Automation level mapping (ISA-95 L0-L4)
 * - Hierarchy path materialization
 * - Lifecycle hooks with Effect integration
 *
 * @module @gbg/tmnl/iiot/schemas/entity-contract
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 * @see thoughts/shared/specs/entity-system/01-entity-base-naming.md
 */

import { Effect, Schema } from 'effect'
import type { EquipmentLevel } from './identifiers'

// =============================================================================
// Automation Level
// =============================================================================

/**
 * ISA-95 Automation Pyramid Level
 *
 * | Level | Name               | Examples                |
 * |-------|--------------------|-------------------------|
 * | 4     | Business Planning  | Enterprise (ERP)        |
 * | 3     | Manufacturing Ops  | Site, Area (MES/MOM)    |
 * | 2     | Supervisory Control| Plant, Line (SCADA)     |
 * | 1     | Automation Control | WorkCell, Machine (PLC) |
 * | 0     | Physical Process   | Sensor, Device          |
 */
export type AutomationLevel = 0 | 1 | 2 | 3 | 4

/**
 * Map equipment level to automation level.
 */
export const getAutomationLevelForEquipment = (level: EquipmentLevel): AutomationLevel => {
  switch (level) {
    case 'enterprise':
      return 4 // L4: Business Planning
    case 'site':
      return 3 // L3: Manufacturing Ops (MES)
    case 'area':
      return 3 // L3: Manufacturing Ops (MES)
    case 'plant':
      return 2 // L2: Supervisory Control (SCADA)
    case 'line':
      return 2 // L2: Supervisory Control (SCADA)
    case 'workcell':
      return 1 // L1: Automation Control (PLC)
    case 'machine':
      return 1 // L1: Automation Control (PLC)
    case 'sensor':
      return 0 // L0: Physical Process
    case 'device':
      return 0 // L0: Physical Process
  }
}

/**
 * Automation level metadata
 */
export const AUTOMATION_LEVELS: Record<
  AutomationLevel,
  {
    name: string
    systems: readonly string[]
    tmnlScope: string
  }
> = {
  4: { name: 'Business Planning', systems: ['ERP', 'BI'], tmnlScope: 'Future integration' },
  3: { name: 'Manufacturing Ops', systems: ['MES', 'MOM'], tmnlScope: 'AMS v3' },
  2: { name: 'Supervisory Control', systems: ['SCADA', 'HMI'], tmnlScope: 'IIoT Services' },
  1: { name: 'Automation Control', systems: ['PLC', 'DCS'], tmnlScope: 'Control Module schemas' },
  0: { name: 'Physical Process', systems: ['Sensors', 'Actuators'], tmnlScope: 'sensor_readings hypertable' },
}

// =============================================================================
// Entity Errors
// =============================================================================

/**
 * Error during entity lifecycle operation.
 */
export interface EntityError {
  readonly _tag: 'EntityError'
  readonly message: string
  readonly entityType: string
  readonly entityId: string
  readonly operation: 'create' | 'update' | 'delete' | 'validate'
  readonly cause?: unknown
}

/**
 * Create an EntityError
 */
export const entityError = (params: Omit<EntityError, '_tag'>): EntityError => ({
  _tag: 'EntityError',
  ...params,
})

/**
 * Validation error for entity business rules.
 */
export interface ValidationError {
  readonly _tag: 'ValidationError'
  readonly message: string
  readonly field?: string
  readonly value?: unknown
}

/**
 * Create a ValidationError
 */
export const validationError = (params: Omit<ValidationError, '_tag'>): ValidationError => ({
  _tag: 'ValidationError',
  ...params,
})

// =============================================================================
// Entity Contract Interface
// =============================================================================

/**
 * Abstract contract for all ISA-95 equipment entities.
 *
 * Concrete entities (EnterpriseSchema, PlantSchema, etc.) must implement
 * all abstract methods. The contract enforces:
 *
 * 1. Schema introspection (Schema, Model, DDL)
 * 2. Operational queries (isOperational, getAutomationLevel)
 * 3. Hierarchy navigation (materializePath)
 * 4. Lifecycle hooks (onCreate, onUpdate, validate)
 *
 * @typeParam TSchema - The Effect Schema definition
 * @typeParam TModel - The persistence Model class
 * @typeParam TDeps - Service dependencies for lifecycle hooks
 */
export interface EntityContract<
  TSchema extends Schema.Schema.Any,
  TModel,
  TDeps = never,
> {
  // ─────────────────────────────────────────────────────────────────────────
  // Schema Introspection (Static)
  // ─────────────────────────────────────────────────────────────────────────

  /** The Effect Schema definition */
  readonly Schema: TSchema

  /** The persistence Model class */
  readonly Model: TModel

  /** DDL for table creation */
  readonly DDL: string

  // ─────────────────────────────────────────────────────────────────────────
  // Operational Methods (Instance)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if entity is operational (not in maintenance or decommissioned).
   * Used for filtering active equipment in queries.
   */
  isOperational(): boolean

  /**
   * Get ISA-95 automation level.
   *
   * | Level | Name | Examples |
   * |-------|------|----------|
   * | 4 | Business Planning | Enterprise (ERP) |
   * | 3 | Manufacturing Ops | Site, Area (MES/MOM) |
   * | 2 | Supervisory Control | Plant, Line (SCADA) |
   * | 1 | Automation Control | WorkCell, Machine (PLC) |
   * | 0 | Physical Process | Sensor, Device |
   */
  getAutomationLevel(): AutomationLevel

  /**
   * Materialize the full hierarchy path from root to this entity.
   *
   * @example
   * // For a machine: "/ENT-acme/SIT-chicago/ARA-assembly/LIN-line-1/MCH-001"
   * machine.materializePath()
   */
  materializePath(): string

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle Hooks (Effect-Native)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Called after entity creation.
   * Use for: audit logging, event emission, graph edge creation.
   */
  onCreate(): Effect.Effect<void, EntityError, TDeps>

  /**
   * Called after entity update.
   * Use for: audit logging, event emission, cache invalidation.
   */
  onUpdate(): Effect.Effect<void, EntityError, TDeps>

  /**
   * Validate entity state beyond schema constraints.
   * Use for: business rules, cross-field validation, referential integrity.
   *
   * @note This is called automatically by Schema.decode filters.
   */
  validate(): Effect.Effect<void, ValidationError, never>
}

// =============================================================================
// Type Helpers
// =============================================================================

/**
 * Extract the type from an EntityContract-implementing class.
 */
export type EntityType<T extends EntityContract<Schema.Schema.Any, unknown>> =
  Schema.Schema.Type<T['Schema']>

/**
 * Extract the encoded type from an EntityContract-implementing class.
 */
export type EntityEncoded<T extends EntityContract<Schema.Schema.Any, unknown>> =
  Schema.Schema.Encoded<T['Schema']>

// =============================================================================
// Default Implementations
// =============================================================================

/**
 * Default implementation of isOperational() based on AssetStatus.
 * Returns true if status is 'active'.
 */
export const defaultIsOperational = (status: string): boolean =>
  status === 'active'

/**
 * Default implementation of validate() — always succeeds.
 * Override in concrete entities for custom validation.
 */
export const defaultValidate = (): Effect.Effect<void, ValidationError, never> =>
  Effect.void

/**
 * Default implementation of onCreate() — logs creation.
 * Override in concrete entities for custom behavior.
 */
export const defaultOnCreate = (
  entityType: string,
  entityId: string
): Effect.Effect<void, EntityError, never> =>
  Effect.log(`Entity created: ${entityType}/${entityId}`)

/**
 * Default implementation of onUpdate() — logs update.
 * Override in concrete entities for custom behavior.
 */
export const defaultOnUpdate = (
  entityType: string,
  entityId: string
): Effect.Effect<void, EntityError, never> =>
  Effect.log(`Entity updated: ${entityType}/${entityId}`)
