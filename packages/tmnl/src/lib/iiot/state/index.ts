/**
 * IIoT State Services Barrel Export
 *
 * Swappable state services for IIoT domain aggregates.
 * Each service provides in-memory (testing) and SQL (production) implementations.
 *
 * @module
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
export { WorkCellStateInMemory } from './WorkCellState'
export { LineStateInMemory } from './LineState'
export { DeviceStateInMemory } from './DeviceState'

// =============================================================================
// SQL Factories
// =============================================================================

export { makeAlarmStateSql } from './AlarmState'
export { makeWorkOrderStateSql } from './WorkOrderState'
export { makeEquipmentStateSql } from './EquipmentStateService'
export { makeMachineStateSql, MachineFilter, MachineStateShape } from './MachineState'
export { makeAreaStateSql, AreaFilter, AreaStateShape, AreaStateNotFoundError } from './AreaState'
export { makeSensorAssetStateSql, SensorAssetFilter, SensorAssetStateShape, SensorAssetStateNotFoundError } from './SensorAssetState'
export { makePlantStateSql, PlantFilter, PlantStateShape, PlantStateNotFoundError } from './PlantState'
export { makeEnterpriseStateSql, EnterpriseFilter, EnterpriseStateShape, EnterpriseStateNotFoundError } from './EnterpriseState'
export { makeWorkCellStateSql, WorkCellFilter, WorkCellStateShape, WorkCellStateNotFoundError } from './WorkCellState'
export { makeLineStateSql, LineFilter, LineStateShape, LineStateNotFoundError } from './LineState'
export { makeDeviceStateSql, DeviceFilter, DeviceStateShape, DeviceStateNotFoundError } from './DeviceState'

// =============================================================================
// Shape Interfaces
// =============================================================================

export {
  AlarmStateShape,
  AlarmFilter,
  AlarmStateNotFoundError,
  WorkOrderStateShape,
  WorkOrderFilter,
  WorkOrderStateNotFoundError,
  EquipmentStateShapeInterface,
  EquipmentStateFilter,
  EquipmentStateNotFoundError,
  MachineStateNotFoundError,
  PaginationOptions,
  TimeRangeFilter,
  WorkCellStateShape as WorkCellStateShapeFromStateShape,
  WorkCellFilter as WorkCellFilterFromStateShape,
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
  AlarmState | WorkOrderState | EquipmentStateService | MachineState | AreaState | SensorAssetState | PlantState | EnterpriseState | WorkCellState | LineState | DeviceState
> = Layer.mergeAll(
  AlarmStateInMemory,
  WorkOrderStateInMemory,
  EquipmentStateInMemory,
  MachineStateInMemory,
  AreaStateInMemory,
  SensorAssetStateInMemory,
  PlantStateInMemory,
  EnterpriseStateInMemory,
  WorkCellStateInMemory,
  LineStateInMemory,
  DeviceStateInMemory
)
