/**
 * IIoT State Services — Swappable Persistence Layer
 *
 * Each domain aggregate has a state service with two implementations:
 * - **In-memory** (`*InMemory`) — Map-backed, for unit/integration tests
 * - **SQL** (`make*Sql()`) — Repository-backed factory for production
 *
 * Use {@link AllStateServicesInMemory} for testing stacks.
 * Use individual `make*Sql()` factories with a repository pattern for production.
 *
 * @module @gbg/tmnl/iiot/state
 */

import { Layer } from 'effect'
import { AlarmState, AlarmStateInMemory } from './AlarmState'
import { WorkOrderState, WorkOrderStateInMemory } from './WorkOrderState'
import { EquipmentStateService, EquipmentStateInMemory } from './EquipmentStateService'
import { MachineState, MachineStateInMemory } from './MachineState'
import { AreaState, AreaStateInMemory } from './AreaState'
import { SensorAssetState, SensorAssetStateInMemory } from './SensorAssetState'
import { PlantState, PlantStateInMemory } from './PlantState'
import { EnterpriseState, EnterpriseStateInMemory } from './EnterpriseState'
import { SiteState, SiteStateInMemory } from './SiteState'
import { WorkCellState, WorkCellStateInMemory } from './WorkCellState'
import { LineState, LineStateInMemory } from './LineState'
import { DeviceState, DeviceStateInMemory } from './DeviceState'

// =============================================================================
// Service Tags
// =============================================================================

export { AlarmState } from './AlarmState'
export { WorkOrderState } from './WorkOrderState'
export { EquipmentStateService } from './EquipmentStateService'
export { MachineState } from './MachineState'
export { AreaState } from './AreaState'
export { SensorAssetState } from './SensorAssetState'
export { PlantState } from './PlantState'
export { EnterpriseState } from './EnterpriseState'
export { SiteState } from './SiteState'
export { WorkCellState } from './WorkCellState'
export { LineState } from './LineState'
export { DeviceState } from './DeviceState'

// =============================================================================
// In-Memory Layers (Testing)
// =============================================================================

export { AlarmStateInMemory } from './AlarmState'
export { WorkOrderStateInMemory } from './WorkOrderState'
export { EquipmentStateInMemory } from './EquipmentStateService'
export { MachineStateInMemory } from './MachineState'
export { AreaStateInMemory } from './AreaState'
export { SensorAssetStateInMemory } from './SensorAssetState'
export { PlantStateInMemory } from './PlantState'
export { EnterpriseStateInMemory } from './EnterpriseState'
export { SiteStateInMemory } from './SiteState'
export { WorkCellStateInMemory } from './WorkCellState'
export { LineStateInMemory } from './LineState'
export { DeviceStateInMemory } from './DeviceState'

// =============================================================================
// SQL Factories
// =============================================================================

export { makeAlarmStateSql } from './AlarmState'
export { makeWorkOrderStateSql } from './WorkOrderState'
export { makeEquipmentStateSql } from './EquipmentStateService'
export { makeMachineStateSql } from './MachineState'
export type { MachineFilter, MachineStateShape } from './MachineState'
export { makeAreaStateSql, AreaStateNotFoundError } from './AreaState'
export type { AreaFilter, AreaStateShape } from './AreaState'
export { makeSensorAssetStateSql, SensorAssetStateNotFoundError } from './SensorAssetState'
export type { SensorAssetFilter, SensorAssetStateShape } from './SensorAssetState'
export { makePlantStateSql, PlantStateNotFoundError } from './PlantState'
export type { PlantFilter, PlantStateShape } from './PlantState'
export { makeEnterpriseStateSql, EnterpriseStateNotFoundError } from './EnterpriseState'
export type { EnterpriseFilter, EnterpriseStateShape } from './EnterpriseState'
export { makeSiteStateSql, SiteStateNotFoundError } from './SiteState'
export type { SiteFilter, SiteStateShape } from './SiteState'
export { makeWorkCellStateSql, WorkCellStateNotFoundError } from './WorkCellState'
export type { WorkCellFilter, WorkCellStateShape } from './WorkCellState'
export { makeLineStateSql, LineStateNotFoundError } from './LineState'
export type { LineFilter, LineStateShape } from './LineState'
export { makeDeviceStateSql, DeviceStateNotFoundError } from './DeviceState'
export type { DeviceFilter, DeviceStateShape } from './DeviceState'

// =============================================================================
// Shape Interfaces
// =============================================================================

export type {
  AlarmStateShape,
  AlarmFilter,
  WorkOrderStateShape,
  WorkOrderFilter,
  EquipmentStateShapeInterface,
  EquipmentStateFilter,
  PaginationOptions,
  TimeRangeFilter,
  WorkCellStateShape as WorkCellStateShapeFromStateShape,
  WorkCellFilter as WorkCellFilterFromStateShape,
} from './StateShape'
export {
  AlarmStateNotFoundError,
  WorkOrderStateNotFoundError,
  EquipmentStateNotFoundError,
  MachineStateNotFoundError,
  WorkCellStateNotFoundError as WorkCellStateNotFoundErrorFromStateShape,
} from './StateShape'

// =============================================================================
// Combined Layers
// =============================================================================

/**
 * All in-memory state services for testing.
 *
 * Usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   const alarmState = yield* AlarmState
 *   const workOrderState = yield* WorkOrderState
 *   const equipmentState = yield* EquipmentStateService
 *   const areaState = yield* AreaState
 *   const sensorAssetState = yield* SensorAssetState
 *   const workCellState = yield* WorkCellState
 *   // ...
 * }).pipe(Effect.provide(AllStateServicesInMemory))
 * ```
 */
export const AllStateServicesInMemory: Layer.Layer<
  AlarmState | WorkOrderState | EquipmentStateService | MachineState | AreaState | SensorAssetState | PlantState | EnterpriseState | SiteState | WorkCellState | LineState | DeviceState
> = Layer.mergeAll(
  AlarmStateInMemory,
  WorkOrderStateInMemory,
  EquipmentStateInMemory,
  MachineStateInMemory,
  AreaStateInMemory,
  SensorAssetStateInMemory,
  PlantStateInMemory,
  EnterpriseStateInMemory,
  SiteStateInMemory,
  WorkCellStateInMemory,
  LineStateInMemory,
  DeviceStateInMemory
)
