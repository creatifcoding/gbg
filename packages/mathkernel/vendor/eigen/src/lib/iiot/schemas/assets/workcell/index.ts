/**
 * WorkCell Entity Schema — ISA-95 Level 1 (Process Control - cell)
 *
 * A discrete production station within a Line. WorkCells contain Machines
 * and represent a single manufacturing step (welding, inspection, etc.).
 *
 * ISA-95 Hierarchy: Enterprise -> Site -> Area -> Plant -> Line -> **WorkCell** -> Machine -> Device -> Sensor
 *
 * @module @gbg/tmnl/iiot/schemas/assets/workcell
 * @see {@link LineId} for parent line
 * @see {@link MachineId} for child machines
 */

export {
  // Identifier
  WorkCellId,
  makeWorkCellId,
  // Status
  WorkCellStatus,
  type WorkCellStatus as WorkCellStatusType,
  // Entity class
  WorkCell,
  type WorkCellEntity,
  // Command Params
  CreateWorkCellParams,
} from './schema'

// Re-export types
export type { CreateWorkCellParams as CreateWorkCellParamsType } from './schema'
