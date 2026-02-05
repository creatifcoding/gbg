/**
 * WorkCell Entity Barrel Export
 *
 * @module @gbg/tmnl/iiot/schemas/assets/workcell
 */

export {
  // Identifier
  WorkCellId,
  makeWorkCellId,
  // Entity class
  WorkCell,
  type WorkCellEntity,
  // Command Params
  CreateWorkCellParams,
} from './schema'

// Re-export types
export type { CreateWorkCellParams as CreateWorkCellParamsType } from './schema'
