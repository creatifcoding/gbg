/**
 * Line Entity Schema — ISA-95 Level 1 (Process Control - line)
 *
 * A production line within a Plant. Lines contain WorkCells and represent
 * a sequential manufacturing process (assembly, packaging, etc.).
 *
 * ISA-95 Hierarchy: Enterprise -> Site -> Area -> Plant -> **Line** -> WorkCell -> Machine -> Device -> Sensor
 *
 * @module @gbg/tmnl/iiot/schemas/assets/line
 * @see {@link PlantId} for parent plant
 * @see {@link WorkCellId} for child work cells
 */

export {
  // Identifier
  LineId,
  makeLineId,
  // Status
  LineStatus,
  type LineStatus as LineStatusType,
  // Entity class
  Line,
  type LineEntity,
  // Command Params
  CreateLineParams,
} from './schema'

// Re-export types
export type { CreateLineParams as CreateLineParamsType } from './schema'
