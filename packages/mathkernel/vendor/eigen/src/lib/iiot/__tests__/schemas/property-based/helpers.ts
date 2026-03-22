/**
 * Shared helpers for property-based tests
 *
 * Extracted from property-based-advanced.test.ts
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/property-based/helpers
 */

import { it, expect } from 'vitest'
import { Arbitrary, Schema, FastCheck as fc, JSONSchema, Option } from 'effect'

// =============================================================================
// Imports: Alarms (ISA-18.2)
// =============================================================================
import {
  AlarmState,
  isValidTransition,
} from '../../../schemas/alarms'

// =============================================================================
// Imports: Work Orders (ISA-95)
// =============================================================================
import {
  WorkOrderStatus,
  getValidNextStates,
} from '../../../schemas/work-orders'

// =============================================================================
// Imports: Equipment State (OEE)
// =============================================================================
import { StateType } from '../../../schemas/equipment-state/schema'

// =============================================================================
// Imports: Hierarchy
// =============================================================================
import {
  HierarchyPath,
  PathSegment,
  VALID_PARENTS,
} from '../../../schemas/hierarchy'

// =============================================================================
// Imports: Identifiers
// =============================================================================
import { EquipmentLevel } from '../../../schemas/identifiers'

// =============================================================================
// Helper: Property Test Runner
// =============================================================================

/**
 * Run property test with fast-check using Effect Schema.Arbitrary.
 */
export function property<A, I>(
  name: string,
  schema: Schema.Schema<A, I, never>,
  assertion: (value: A) => void,
  options?: fc.Parameters<[A]>
): void {
  it(name, () => {
    const arb = Arbitrary.make(schema)
    fc.assert(
      fc.property(arb, (value) => {
        assertion(value)
        return true
      }),
      { numRuns: 100, ...options }
    )
  })
}

// =============================================================================
// Constants
// =============================================================================

/** All alarm states */
export const ALARM_STATES: AlarmState[] = [
  'unacknowledged' as AlarmState,
  'acknowledged' as AlarmState,
  'shelved' as AlarmState,
  'suppressed' as AlarmState,
  'cleared' as AlarmState,
  'out_of_service' as AlarmState,
]

/** All work order statuses */
export const WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  'created',
  'submitted',
  'approved',
  'rejected',
  'started',
  'suspended',
  'resumed',
  'completed',
  'failed',
  'cancelled',
  'closed',
]

/** All equipment state types */
export const STATE_TYPES: StateType[] = [
  'running',
  'idle',
  'planned_downtime',
  'unplanned_downtime',
  'setup',
  'blocked',
]

/** All equipment levels */
export const EQUIPMENT_LEVELS: EquipmentLevel[] = [
  'enterprise',
  'site',
  'area',
  'plant',
  'line',
  'workcell',
  'machine',
  'sensor',
  'device',
]

// =============================================================================
// State Machine Generators
// =============================================================================

/**
 * Generate a valid alarm state transition pair.
 */
export function generateValidAlarmTransition(): fc.Arbitrary<{ from: AlarmState; to: AlarmState }> {
  return fc.constantFrom(...ALARM_STATES).chain((from) => {
    // Find valid targets for this state
    const validTargets = ALARM_STATES.filter((to) => isValidTransition(from, to))
    if (validTargets.length === 0) {
      // Some states like 'cleared' can only transition to 'unacknowledged'
      return fc.constant({ from, to: 'unacknowledged' as AlarmState })
    }
    return fc.constantFrom(...validTargets).map((to) => ({ from, to }))
  })
}

/**
 * Generate an invalid alarm state transition pair.
 */
export function generateInvalidAlarmTransition(): fc.Arbitrary<{ from: AlarmState; to: AlarmState }> {
  return fc.constantFrom(...ALARM_STATES).chain((from) => {
    // Find invalid targets for this state
    const invalidTargets = ALARM_STATES.filter((to) => !isValidTransition(from, to))
    if (invalidTargets.length === 0) {
      return fc.constant({ from, to: from }) // Self-transition (invalid)
    }
    return fc.constantFrom(...invalidTargets).map((to) => ({ from, to }))
  })
}

/**
 * Generate a valid work order transition pair.
 */
export function generateValidWorkOrderTransition(): fc.Arbitrary<{
  from: WorkOrderStatus
  to: WorkOrderStatus
}> {
  return fc.constantFrom(...WORK_ORDER_STATUSES).chain((from) => {
    const validTargets = getValidNextStates(from) as WorkOrderStatus[]
    if (validTargets.length === 0) {
      // Terminal states - return a known valid transition
      return fc.constant({ from: 'created' as WorkOrderStatus, to: 'submitted' as WorkOrderStatus })
    }
    return fc.constantFrom(...validTargets).map((to) => ({ from, to }))
  })
}

// =============================================================================
// Hierarchy Generators
// =============================================================================

/**
 * Generate a valid hierarchy path with specified max depth.
 */
export function generateValidHierarchyPath(maxDepth: number = 4): fc.Arbitrary<HierarchyPath> {
  return fc.integer({ min: 1, max: maxDepth }).chain((depth) => {
    // Build path from enterprise down
    const validSequences = getValidLevelSequences(depth)
    if (validSequences.length === 0) {
      return fc.constant(HierarchyPath.empty())
    }

    return fc.constantFrom(...validSequences).chain((levels) => {
      const segments = levels.map(
        (level, i) =>
          new PathSegment({
            level,
            id: `${levelPrefix(level)}-id-${i}`,
            name: Option.none(),
          })
      )
      return fc.constant(HierarchyPath.fromSegments(segments))
    })
  })
}

/**
 * Get valid level sequences of a given depth (starting from enterprise).
 */
export function getValidLevelSequences(depth: number): EquipmentLevel[][] {
  if (depth === 0) return [[]]
  if (depth === 1) return [['enterprise']]

  const sequences: EquipmentLevel[][] = []

  function buildSequence(current: EquipmentLevel[], remaining: number): void {
    if (remaining === 0) {
      sequences.push([...current])
      return
    }

    const lastLevel = current[current.length - 1]
    // Find all levels that can have lastLevel as parent
    for (const level of EQUIPMENT_LEVELS) {
      if (VALID_PARENTS[level]?.includes(lastLevel)) {
        current.push(level)
        buildSequence(current, remaining - 1)
        current.pop()
      }
    }
  }

  buildSequence(['enterprise'], depth - 1)
  return sequences.length > 0 ? sequences : [['enterprise']]
}

/**
 * Get ID prefix for an equipment level.
 */
export function levelPrefix(level: EquipmentLevel): string {
  const prefixes: Record<EquipmentLevel, string> = {
    enterprise: 'ENT',
    site: 'SIT',
    area: 'ARA',
    plant: 'PLT',
    line: 'LIN',
    workcell: 'WCL',
    machine: 'MCH',
    sensor: 'SNS',
    device: 'DEV',
  }
  return prefixes[level]
}

// =============================================================================
// JSONSchema Assertions
// =============================================================================

/**
 * Assert that a schema produces valid JSONSchema.
 */
export function assertValidJsonSchema<A, I>(schema: Schema.Schema<A, I, never>): void {
  const jsonSchema = JSONSchema.make(schema)
  expect(jsonSchema).toBeDefined()
  expect(typeof jsonSchema).toBe('object')
}

/**
 * Assert required fields are correctly marked in JSONSchema.
 */
export function assertRequiredFields(
  jsonSchema: ReturnType<typeof JSONSchema.make>,
  expected: string[]
): void {
  const required = (jsonSchema as { required?: string[] }).required ?? []
  for (const field of expected) {
    expect(required).toContain(field)
  }
}

// =============================================================================
// OEE Helper
// =============================================================================

/**
 * Helper to get OEE category for a state type.
 */
export function categoryForState(
  state: StateType
): 'productive' | 'availability_loss' | 'performance_loss' {
  if (state === 'running') return 'productive'
  if (state === 'planned_downtime' || state === 'unplanned_downtime') return 'availability_loss'
  return 'performance_loss'
}

// Re-export for convenience
export { fc, Arbitrary, Schema, JSONSchema, Option }
