/**
 * Line Entity Barrel Export
 *
 * @module @gbg/tmnl/iiot/schemas/assets/line
 */

export {
  // Identifier
  LineId,
  makeLineId,
  // Schema
  LineSchema,
  // Namespace
  Line,
  // Command Params
  CreateLineParams,
} from './schema'

// Re-export types
export type { CreateLineParams as CreateLineParamsType } from './schema'
