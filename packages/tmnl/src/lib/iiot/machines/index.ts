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

// State transition graphs
export * from './graphs'
