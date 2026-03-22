/**
 * IIoT Asset Hierarchy Exports
 *
 * Full ISA-95 compliant equipment hierarchy with separate entity classes.
 * Each entity has embedded slug-based IDs (ENT-*, SIT-*, PLT-*, etc.)
 *
 * Hierarchy:
 *   Enterprise (L4) → Site (L3) → Area (L2) → Plant (L3 functional)
 *     → Line (L1) → WorkCell (L1) → Machine (L1)
 *       → Sensor (L0 - reads) / Device (L0 - writes)
 *
 * @module @gbg/tmnl/iiot/schemas/assets
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

// Common types shared by all entities
export * from './common'

// Level 4 - Business/Enterprise
export * from './enterprise'

// Level 3 - Geographic Site
export * from './site'

// Level 2 - Production Area
export * from './area'

// Level 3 - Functional Plant (within Site)
export * from './plant'

// Level 1 - Production Line (Work Center)
export * from './line'

// Level 1 - Work Cell (Work Unit)
export * from './workcell'

// Level 1 - Machine (Equipment Module)
export * from './machine'

// Level 0 - Sensor (Control Module - reads)
export * from './sensor'

// Level 0 - Device (Control Module - writes/actuates)
export * from './device'

// Composite schemas (hierarchy views, RPC responses)
export {
  SensorHierarchy,
  type SensorHierarchy as SensorHierarchyType,
  MachineWithSensors,
  type MachineWithSensors as MachineWithSensorsType,
  LineWithMachines,
  type LineWithMachines as LineWithMachinesType,
  PlantHierarchy,
  type PlantHierarchy as PlantHierarchyType,
} from './composites'
