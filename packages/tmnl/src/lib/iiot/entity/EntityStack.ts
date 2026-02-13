/**
 * Entity Stack Layer Composition
 *
 * Provides pre-composed Layer stacks for testing and production.
 * Enables hexagonal architecture by composing adapters (state services)
 * with entity handlers.
 *
 * @module
 */

import { Layer } from 'effect'
import { AlarmEntityHandlers } from './AlarmEntity'
import { WorkOrderEntityHandlers } from './WorkOrderEntity'
import { EquipmentStateEntityHandlers } from './EquipmentStateEntity'
import { EnterpriseEntityHandlers } from './EnterpriseEntity'
import { SiteEntityHandlers } from './SiteEntity'
import { AreaEntityHandlers } from './AreaEntity'
import { PlantEntityHandlers } from './PlantEntity'
import { LineEntityHandlers } from './LineEntity'
import { WorkCellEntityHandlers } from './WorkCellEntity'
import { MachineAssetEntityHandlers } from './MachineAssetEntity'
import { DeviceEntityHandlers } from './DeviceEntity'
import { SensorAssetEntityHandlers } from './SensorAssetEntity'
import { AllStateServicesInMemory } from '../state'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlagsEnabledLayer,
} from '../infrastructure/feature-flags'

// =============================================================================
// Handler Layer Composition
// =============================================================================

/**
 * All entity handlers merged into a single layer.
 *
 * Requires:
 * - AlarmState
 * - WorkOrderState
 * - EquipmentStateService
 * - IIoTFeatureFlags
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   // Use entity handlers
 * }).pipe(
 *   Effect.provide(EntityHandlersLayer),
 *   Effect.provide(AllStateServicesInMemory),
 *   Effect.provide(IIoTFeatureFlagsDisabledLayer)
 * )
 * ```
 */
export const EntityHandlersLayer = Layer.mergeAll(
  AlarmEntityHandlers,
  WorkOrderEntityHandlers,
  EquipmentStateEntityHandlers,
  EnterpriseEntityHandlers,
  SiteEntityHandlers,
  AreaEntityHandlers,
  PlantEntityHandlers,
  LineEntityHandlers,
  WorkCellEntityHandlers,
  MachineAssetEntityHandlers,
  DeviceEntityHandlers,
  SensorAssetEntityHandlers,
)

// =============================================================================
// Testing Stack
// =============================================================================

/**
 * Complete testing stack with in-memory adapters and events disabled.
 *
 * Use for unit tests and integration tests that don't need persistence.
 *
 * Provides:
 * - In-memory state services (AlarmState, WorkOrderState, EquipmentStateService)
 * - Feature flags with events disabled
 * - All entity handlers
 *
 * Usage:
 * ```typescript
 * const result = await Effect.runPromise(
 *   program.pipe(Effect.provide(EntityTestingStack))
 * )
 * ```
 */
export const EntityTestingStack = EntityHandlersLayer.pipe(
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
)

// =============================================================================
// Production Stack (Partial)
// =============================================================================

/**
 * Production-ready entity handlers with events enabled.
 *
 * Still requires SQL-backed state services to be provided.
 *
 * Usage:
 * ```typescript
 * const ProdStack = EntityProductionHandlersWithEvents.pipe(
 *   Layer.provide(AlarmStateSqlLive),
 *   Layer.provide(WorkOrderStateSqlLive),
 *   Layer.provide(EquipmentStateSqlLive),
 * )
 * ```
 */
export const EntityProductionHandlersWithEvents = EntityHandlersLayer.pipe(
  Layer.provide(IIoTFeatureFlagsEnabledLayer),
)
