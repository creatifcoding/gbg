/**
 * IIoT Feature Flags
 *
 * Feature flags for EventLog migration phases. Allows gradual rollout
 * with rollback capability.
 *
 * @module @gbg/tmnl/iiot/infrastructure/feature-flags
 * @see WBS EL-2.1 for alarm migration feature flag
 */

import { Config, Context, Effect, Layer } from 'effect'

// =============================================================================
// Feature Flag Interface
// =============================================================================

/**
 * IIoT EventLog feature flags shape.
 *
 * Each flag controls whether a domain writes to EventLog (event sourced)
 * or uses legacy CRUD patterns.
 */
export interface FeatureFlagsShape {
  /**
   * Enable EventLog for Alarms (ISA-18.2).
   * When true, alarm operations emit events to EventLog.
   * When false, alarm operations use legacy CRUD.
   *
   * @default false (CRUD mode until migration complete)
   */
  readonly alarmEventSourcingEnabled: boolean

  /**
   * Enable EventLog for Equipment State.
   * When true, state changes emit events to EventLog.
   *
   * @default false
   */
  readonly equipmentStateEventSourcingEnabled: boolean

  /**
   * Enable EventLog for Work Orders.
   * When true, work order lifecycle emits events.
   *
   * @default false
   */
  readonly workOrderEventSourcingEnabled: boolean

  /**
   * Enable EventLog for Batch Records.
   * When true, batch operations emit events.
   *
   * @default false
   */
  readonly batchRecordEventSourcingEnabled: boolean

  /**
   * Enable pg_lake Iceberg analytics tables.
   * When false, uses regular PostgreSQL tables for analytics.
   *
   * NOTE: Requires full Docker image (Dockerfile, not Dockerfile.lite)
   * and pg_extension_base in shared_preload_libraries.
   *
   * @default false
   */
  readonly pgLakeEnabled: boolean

  /** Enable opt-in WorkOrder depends_on Reactor lane. */
  readonly reactorDependsOnLaneEnabled: boolean

  /** Enable opt-in Alarm safety-hold Reactor lane. */
  readonly reactorAlarmSafetyLaneEnabled: boolean

  /** Enable opt-in Structural decommission Reactor lane. */
  readonly reactorStructuralDecommissionLaneEnabled: boolean

  /** Enable opt-in External/device availability Reactor lane. */
  readonly reactorExternalDeviceAvailabilityLaneEnabled: boolean
}

// =============================================================================
// Context Tag
// =============================================================================

/**
 * IIoTFeatureFlags service tag.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const flags = yield* IIoTFeatureFlags
 *   if (flags.alarmEventSourcingEnabled) {
 *     yield* eventLog.write('AlarmTriggered', payload)
 *   } else {
 *     yield* alarmRepo.insert(alarm) // Legacy CRUD
 *   }
 * })
 * ```
 */
export class IIoTFeatureFlags extends Context.Tag('IIoTFeatureFlags')<
  IIoTFeatureFlags,
  FeatureFlagsShape
>() {}

// =============================================================================
// Default Configuration (All Disabled)
// =============================================================================

/**
 * Default feature flags — all EventLog features disabled.
 * Safe for production until migration is complete and tested.
 */
export const IIoTFeatureFlagsDefault: FeatureFlagsShape = {
  alarmEventSourcingEnabled: false,
  equipmentStateEventSourcingEnabled: false,
  workOrderEventSourcingEnabled: false,
  batchRecordEventSourcingEnabled: false,
  pgLakeEnabled: false,
  reactorDependsOnLaneEnabled: false,
  reactorAlarmSafetyLaneEnabled: false,
  reactorStructuralDecommissionLaneEnabled: false,
  reactorExternalDeviceAvailabilityLaneEnabled: false,
}

// =============================================================================
// Environment-Based Configuration
// =============================================================================

/**
 * Feature flags from environment variables.
 *
 * Environment variables:
 * - ES_ALARM_ENABLED: Enable alarm EventLog (default: false)
 * - ES_EQUIPMENT_STATE_ENABLED: Enable equipment state EventLog (default: false)
 * - ES_WORK_ORDER_ENABLED: Enable work order EventLog (default: false)
 * - ES_BATCH_RECORD_ENABLED: Enable batch record EventLog (default: false)
 */
const featureFlagsConfig = Effect.all({
  alarmEventSourcingEnabled: Config.boolean('ES_ALARM_ENABLED').pipe(
    Config.withDefault(false)
  ),
  equipmentStateEventSourcingEnabled: Config.boolean('ES_EQUIPMENT_STATE_ENABLED').pipe(
    Config.withDefault(false)
  ),
  workOrderEventSourcingEnabled: Config.boolean('ES_WORK_ORDER_ENABLED').pipe(
    Config.withDefault(false)
  ),
  batchRecordEventSourcingEnabled: Config.boolean('ES_BATCH_RECORD_ENABLED').pipe(
    Config.withDefault(false)
  ),
  pgLakeEnabled: Config.boolean('PG_LAKE_ENABLED').pipe(
    Config.withDefault(false)
  ),
  reactorDependsOnLaneEnabled: Config.boolean('REACTOR_LANE_DEPENDS_ON_ENABLED').pipe(
    Config.withDefault(false)
  ),
  reactorAlarmSafetyLaneEnabled: Config.boolean('REACTOR_LANE_ALARM_SAFETY_ENABLED').pipe(
    Config.withDefault(false)
  ),
  reactorStructuralDecommissionLaneEnabled: Config.boolean('REACTOR_LANE_STRUCTURAL_DECOMMISSION_ENABLED').pipe(
    Config.withDefault(false)
  ),
  reactorExternalDeviceAvailabilityLaneEnabled: Config.boolean('REACTOR_LANE_EXTERNAL_DEVICE_AVAILABILITY_ENABLED').pipe(
    Config.withDefault(false)
  ),
})

// =============================================================================
// Layers
// =============================================================================

/**
 * IIoTFeatureFlags layer with all features disabled.
 * Use for production until migration is complete.
 */
export const IIoTFeatureFlagsDisabledLayer: Layer.Layer<IIoTFeatureFlags> =
  Layer.succeed(IIoTFeatureFlags, IIoTFeatureFlagsDefault)

/**
 * IIoTFeatureFlags layer with all features enabled.
 * Use for testing EventLog integration.
 */
export const IIoTFeatureFlagsEnabledLayer: Layer.Layer<IIoTFeatureFlags> =
  Layer.succeed(IIoTFeatureFlags, {
    alarmEventSourcingEnabled: true,
    equipmentStateEventSourcingEnabled: true,
    workOrderEventSourcingEnabled: true,
    batchRecordEventSourcingEnabled: true,
    pgLakeEnabled: false, // Still disabled by default - requires full Docker image
    reactorDependsOnLaneEnabled: true,
    reactorAlarmSafetyLaneEnabled: true,
    reactorStructuralDecommissionLaneEnabled: true,
    reactorExternalDeviceAvailabilityLaneEnabled: true,
  })

/**
 * IIoTFeatureFlags layer from environment variables.
 * Reads ES_* environment variables to determine feature enablement.
 *
 * Note: Falls back to defaults if Config errors (e.g., missing env vars).
 *
 * @example
 * ```bash
 * # Enable alarm EventLog in environment
 * export ES_ALARM_ENABLED=true
 * ```
 */
export const IIoTFeatureFlagsEnvLayer: Layer.Layer<IIoTFeatureFlags> =
  Layer.effect(
    IIoTFeatureFlags,
    featureFlagsConfig.pipe(
      Effect.map((config): FeatureFlagsShape => config),
      // Fall back to defaults if Config fails (env not set, parse error, etc.)
      Effect.orElseSucceed(() => IIoTFeatureFlagsDefault)
    )
  )

/**
 * Create a custom feature flags layer.
 *
 * @example
 * ```typescript
 * const TestFlagsLayer = makeFeatureFlagsLayer({
 *   alarmEventSourcingEnabled: true,
 *   // ... others default to false
 * })
 * ```
 */
export const makeFeatureFlagsLayer = (
  overrides: Partial<FeatureFlagsShape>
): Layer.Layer<IIoTFeatureFlags> =>
  Layer.succeed(IIoTFeatureFlags, {
    ...IIoTFeatureFlagsDefault,
    ...overrides,
  })

// =============================================================================
// Type Guards (for conditional logic)
// =============================================================================

/**
 * Check if alarm EventLog is enabled.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   if (yield* isAlarmEventSourcingEnabled) {
 *     // EventLog path
 *   } else {
 *     // Legacy CRUD path
 *   }
 * })
 * ```
 */
export const isAlarmEventSourcingEnabled = Effect.gen(function* () {
  const flags = yield* IIoTFeatureFlags
  return flags.alarmEventSourcingEnabled
})

export const isEquipmentStateEventSourcingEnabled = Effect.gen(function* () {
  const flags = yield* IIoTFeatureFlags
  return flags.equipmentStateEventSourcingEnabled
})

export const isWorkOrderEventSourcingEnabled = Effect.gen(function* () {
  const flags = yield* IIoTFeatureFlags
  return flags.workOrderEventSourcingEnabled
})

export const isBatchRecordEventSourcingEnabled = Effect.gen(function* () {
  const flags = yield* IIoTFeatureFlags
  return flags.batchRecordEventSourcingEnabled
})

export const isPgLakeEnabled = Effect.gen(function* () {
  const flags = yield* IIoTFeatureFlags
  return flags.pgLakeEnabled
})

export const isReactorDependsOnLaneEnabled = Effect.gen(function* () {
  const flags = yield* IIoTFeatureFlags
  return flags.reactorDependsOnLaneEnabled
})

export const isReactorAlarmSafetyLaneEnabled = Effect.gen(function* () {
  const flags = yield* IIoTFeatureFlags
  return flags.reactorAlarmSafetyLaneEnabled
})

export const isReactorStructuralDecommissionLaneEnabled = Effect.gen(function* () {
  const flags = yield* IIoTFeatureFlags
  return flags.reactorStructuralDecommissionLaneEnabled
})

export const isReactorExternalDeviceAvailabilityLaneEnabled = Effect.gen(function* () {
  const flags = yield* IIoTFeatureFlags
  return flags.reactorExternalDeviceAvailabilityLaneEnabled
})
