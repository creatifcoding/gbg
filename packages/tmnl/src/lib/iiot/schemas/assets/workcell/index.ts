/**
 * WorkCell Entity Barrel Export
 *
 * @module @gbg/tmnl/iiot/schemas/assets/workcell
 */

export {
  // Identifier
  WorkCellId,
  makeWorkCellId,
  // Entity Schema
  WorkCellSchema,
  // Entity Namespace
  WorkCell,
  // Command Params
  CreateWorkCellParams,
} from './schema'

// Re-export types
export type { CreateWorkCellParams as CreateWorkCellParamsType } from './schema'
