/**
 * IIoT Machines Barrel Export
 *
 * Effect Machine definitions for IIoT entities with state transition graph validation.
 * Each Machine wraps a StateService and validates transitions before persistence.
 *
 * Architecture:
 * - Entity.toLayer() boots Machine internally
 * - Handlers delegate to actor.send(InternalRequest)
 * - Machine procedures validate transitions via Graph.directed()
 * - StateService provides persistence (in-memory or SQL)
 *
 * @module
 */

// Alarm Machine - ISA-18.2 state transitions
export * from './AlarmMachine'

// WorkOrder Machine - FDA 21 CFR Part 11 state transitions
export * from './WorkOrderMachine'

// EquipmentState Machine - ISA-95 / OEE state transitions
export * from './EquipmentStateMachine'

// ─────────────────────────────────────────────────────────────────────────────
// ISA-95 Asset Machines
//
// NOT barrel-exported via `export *` because machine files share error/request
// class names (MachineCreateError, InternalDecommission, etc.).
// Import directly from the specific machine file:
//   import { makeEnterpriseMachine, ... } from '../machines/EnterpriseMachine'
// ─────────────────────────────────────────────────────────────────────────────

// Enterprise Machine - ISA-95 Level 4
// import from './EnterpriseMachine'

// Site Machine - ISA-95 Level 3
// import from './SiteMachine'

// Area Machine - ISA-95 Level 2
// import from './AreaMachine'

// Plant Machine - ISA-95 Level 3 Functional
// import from './PlantMachine'

// Line Machine - ISA-95 Level 1 / OEE
// import from './LineMachine'

// WorkCell Machine - ISA-95 Level 1
// import from './WorkCellMachine'

// Machine Asset Machine - ISA-95 Equipment Module
// import from './MachineAssetMachine'

// Device Machine - ISA-95 Control Module (actuation)
// import from './DeviceMachine'

// Sensor Asset Machine - ISA-95 Control Module (sensing)
// import from './SensorAssetMachine'

// State transition graphs
export * from './graphs'
