/**
 * Machine Entity Schema — ISA-95 Level 1 (Process Control - work unit)
 *
 * A production machine within a WorkCell. Machines contain Devices
 * and represent the actual equipment performing manufacturing operations.
 *
 * ISA-95 Hierarchy: Enterprise -> Site -> Area -> Plant -> Line -> WorkCell -> **Machine** -> Device -> Sensor
 *
 * @module @gbg/tmnl/iiot/schemas/assets/machine
 * @see {@link WorkCellId} for parent work cell
 * @see {@link DeviceId} for child devices
 */

export {
  // Identifier
  MachineId,
  makeMachineId,
  // Status
  MachineStatus,
  type MachineStatus as MachineStatusType,
  // Entity class
  Machine,
  type MachineEntity,
  // Command params
  CreateMachineParams,
  type CreateMachineParams as CreateMachineParamsType,
} from './schema'
