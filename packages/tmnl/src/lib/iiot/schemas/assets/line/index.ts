/**
 * Line Entity Barrel Export
 *
 * @module @gbg/tmnl/iiot/schemas/assets/line
 */

export {
  // Identifier
  LineId,
  makeLineId,
  // Entity class
  Line,
  type LineEntity,
  // Command Params
  CreateLineParams,
} from './schema'

// Re-export types
export type { CreateLineParams as CreateLineParamsType } from './schema'
