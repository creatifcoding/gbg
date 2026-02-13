/**
 * Property-Based Tests: Machine Asset, Device, and Sensor State Graphs
 *
 * Tests graph invariants for ISA-95 asset lifecycle state machines using
 * fast-check property-based testing. Validates:
 * 1. Valid transitions always pass
 * 2. Invalid transitions always fail
 * 3. No self-transitions
 * 4. Terminal states have no outgoing transitions
 * 5. Non-terminal states have at least one outgoing transition
 * 6. Random walk reachability from initial state
 *
 * Domain-specific:
 * - Machine: decommission only from idle/faulted path, maintenance is recoverable
 * - Device: firmware_update terminates to online or offline, decommissioned is absorbing
 * - Sensor: calibration cycle (needs_calibration->calibrating->active), decommissioned is absorbing
 *
 * @module @gbg/tmnl/iiot/__tests__/schemas/property-based/asset-state-graphs-3
 */

import { describe, it, expect } from 'vitest'
import { FastCheck as fc, Option } from 'effect'

// =============================================================================
// Machine Asset Graph Imports
// =============================================================================
import {
  ALL_STATES as MACHINE_ALL_STATES,
  TERMINAL_STATES as MACHINE_TERMINAL_STATES,
  isValidStateTransition as machineIsValidTransition,
  getValidNextStates as machineGetValidNextStates,
  getTransitionAction as machineGetTransitionAction,
  isTerminalState as machineIsTerminal,
  type MachineAssetStateNode,
} from '../../../machines/graphs/machine-asset-graph'

// =============================================================================
// Device Graph Imports
// =============================================================================
import {
  ALL_STATES as DEVICE_ALL_STATES,
  TERMINAL_STATES as DEVICE_TERMINAL_STATES,
  isValidStateTransition as deviceIsValidTransition,
  getValidNextStates as deviceGetValidNextStates,
  getTransitionAction as deviceGetTransitionAction,
  isTerminalState as deviceIsTerminal,
  type DeviceStateNode,
} from '../../../machines/graphs/device-graph'

// =============================================================================
// Sensor Graph Imports
// =============================================================================
import {
  ALL_STATES as SENSOR_ALL_STATES,
  TERMINAL_STATES as SENSOR_TERMINAL_STATES,
  isValidStateTransition as sensorIsValidTransition,
  getValidNextStates as sensorGetValidNextStates,
  getTransitionAction as sensorGetTransitionAction,
  isTerminalState as sensorIsTerminal,
  type SensorStateNode,
} from '../../../machines/graphs/sensor-graph'

// =============================================================================
// Machine Asset State Graph Tests
// =============================================================================

describe('Property: Machine Asset State Graph', () => {
  const allStates = MACHINE_ALL_STATES as readonly MachineAssetStateNode[]
  const terminalStates = MACHINE_TERMINAL_STATES as readonly MachineAssetStateNode[]
  const nonTerminalStates = allStates.filter((s) => !terminalStates.includes(s))
  const initialState: MachineAssetStateNode = 'commissioned'

  it('valid transitions always pass (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates).chain((from) => {
          const validTargets = machineGetValidNextStates(from) as MachineAssetStateNode[]
          if (validTargets.length === 0) {
            return fc.constant({ from, to: from, hasValid: false })
          }
          return fc.constantFrom(...validTargets).map((to) => ({ from, to, hasValid: true }))
        }),
        ({ from, to, hasValid }) => {
          if (hasValid) {
            expect(machineIsValidTransition(from, to)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('invalid transitions always fail (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates).chain((from) => {
          const validTargets = machineGetValidNextStates(from) as MachineAssetStateNode[]
          const invalidTargets = allStates.filter(
            (s) => !validTargets.includes(s) && s !== from
          )
          if (invalidTargets.length === 0) {
            return fc.constant({ from, to: from, hasInvalid: false })
          }
          return fc.constantFrom(...invalidTargets).map((to) => ({ from, to, hasInvalid: true }))
        }),
        ({ from, to, hasInvalid }) => {
          if (hasInvalid) {
            expect(machineIsValidTransition(from, to)).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no self-transitions (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allStates), (state) => {
        expect(machineIsValidTransition(state, state)).toBe(false)
      }),
      { numRuns: 50 }
    )
  })

  it('terminal states have no outgoing transitions', () => {
    for (const terminal of terminalStates) {
      const nextStates = machineGetValidNextStates(terminal)
      expect(nextStates).toHaveLength(0)
      expect(machineIsTerminal(terminal)).toBe(true)
    }
  })

  it('non-terminal states have at least one outgoing transition', () => {
    for (const state of nonTerminalStates) {
      const nextStates = machineGetValidNextStates(state)
      expect(nextStates.length).toBeGreaterThan(0)
      expect(machineIsTerminal(state)).toBe(false)
    }
  })

  it('random walk reachability from initial state (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (steps) => {
          let current: MachineAssetStateNode = initialState
          for (let i = 0; i < steps; i++) {
            const nextStates = machineGetValidNextStates(current) as MachineAssetStateNode[]
            if (nextStates.length === 0) break // terminal
            // Deterministic pick based on step index
            current = nextStates[i % nextStates.length]
            expect(allStates).toContain(current)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  // Domain-specific: valid transitions have action labels
  it('every valid transition has a named action', () => {
    for (const from of allStates) {
      const nextStates = machineGetValidNextStates(from) as MachineAssetStateNode[]
      for (const to of nextStates) {
        const action = machineGetTransitionAction(from, to)
        expect(Option.isSome(action)).toBe(true)
      }
    }
  })

  // Domain-specific: decommission only from retired or scheduled_maintenance
  it('decommission only reachable from retired or scheduled_maintenance', () => {
    for (const from of allStates) {
      if (from === 'retired' || from === 'scheduled_maintenance') {
        expect(machineIsValidTransition(from, 'decommissioned')).toBe(true)
      } else {
        expect(machineIsValidTransition(from, 'decommissioned')).toBe(false)
      }
    }
  })

  // Domain-specific: maintenance is recoverable (returns to operational)
  it('maintenance states recover to operational', () => {
    expect(machineIsValidTransition('scheduled_maintenance', 'operational')).toBe(true)
    expect(machineIsValidTransition('unscheduled_maintenance', 'operational')).toBe(true)
  })
})

// =============================================================================
// Device State Graph Tests
// =============================================================================

describe('Property: Device State Graph', () => {
  const allStates = DEVICE_ALL_STATES as readonly DeviceStateNode[]
  const terminalStates = DEVICE_TERMINAL_STATES as readonly DeviceStateNode[]
  const nonTerminalStates = allStates.filter((s) => !terminalStates.includes(s))
  const initialState: DeviceStateNode = 'provisioned'

  it('valid transitions always pass (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates).chain((from) => {
          const validTargets = deviceGetValidNextStates(from) as DeviceStateNode[]
          if (validTargets.length === 0) {
            return fc.constant({ from, to: from, hasValid: false })
          }
          return fc.constantFrom(...validTargets).map((to) => ({ from, to, hasValid: true }))
        }),
        ({ from, to, hasValid }) => {
          if (hasValid) {
            expect(deviceIsValidTransition(from, to)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('invalid transitions always fail (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates).chain((from) => {
          const validTargets = deviceGetValidNextStates(from) as DeviceStateNode[]
          const invalidTargets = allStates.filter(
            (s) => !validTargets.includes(s) && s !== from
          )
          if (invalidTargets.length === 0) {
            return fc.constant({ from, to: from, hasInvalid: false })
          }
          return fc.constantFrom(...invalidTargets).map((to) => ({ from, to, hasInvalid: true }))
        }),
        ({ from, to, hasInvalid }) => {
          if (hasInvalid) {
            expect(deviceIsValidTransition(from, to)).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no self-transitions (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allStates), (state) => {
        expect(deviceIsValidTransition(state, state)).toBe(false)
      }),
      { numRuns: 50 }
    )
  })

  it('terminal states have no outgoing transitions', () => {
    for (const terminal of terminalStates) {
      const nextStates = deviceGetValidNextStates(terminal)
      expect(nextStates).toHaveLength(0)
      expect(deviceIsTerminal(terminal)).toBe(true)
    }
  })

  it('non-terminal states have at least one outgoing transition', () => {
    for (const state of nonTerminalStates) {
      const nextStates = deviceGetValidNextStates(state)
      expect(nextStates.length).toBeGreaterThan(0)
      expect(deviceIsTerminal(state)).toBe(false)
    }
  })

  it('random walk reachability from initial state (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (steps) => {
          let current: DeviceStateNode = initialState
          for (let i = 0; i < steps; i++) {
            const nextStates = deviceGetValidNextStates(current) as DeviceStateNode[]
            if (nextStates.length === 0) break
            current = nextStates[i % nextStates.length]
            expect(allStates).toContain(current)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  // Domain-specific: valid transitions have action labels
  it('every valid transition has a named action', () => {
    for (const from of allStates) {
      const nextStates = deviceGetValidNextStates(from) as DeviceStateNode[]
      for (const to of nextStates) {
        const action = deviceGetTransitionAction(from, to)
        expect(Option.isSome(action)).toBe(true)
      }
    }
  })

  // Domain-specific: firmware_update terminates to online or offline
  it('firmware_update terminates to online or offline only', () => {
    const fwNextStates = deviceGetValidNextStates('firmware_update') as DeviceStateNode[]
    expect(fwNextStates).toContain('online')
    expect(fwNextStates).toContain('offline')
    expect(fwNextStates).toHaveLength(2)
  })

  // Domain-specific: decommissioned is absorbing
  it('decommissioned is absorbing (no outgoing transitions)', () => {
    const nextStates = deviceGetValidNextStates('decommissioned')
    expect(nextStates).toHaveLength(0)
  })

  // Domain-specific: decommission only from offline or faulted
  it('decommission only reachable from offline or faulted', () => {
    for (const from of allStates) {
      if (from === 'offline' || from === 'faulted') {
        expect(deviceIsValidTransition(from, 'decommissioned')).toBe(true)
      } else {
        expect(deviceIsValidTransition(from, 'decommissioned')).toBe(false)
      }
    }
  })
})

// =============================================================================
// Sensor State Graph Tests
// =============================================================================

describe('Property: Sensor State Graph', () => {
  const allStates = SENSOR_ALL_STATES as readonly SensorStateNode[]
  const terminalStates = SENSOR_TERMINAL_STATES as readonly SensorStateNode[]
  const nonTerminalStates = allStates.filter((s) => !terminalStates.includes(s))
  const initialState: SensorStateNode = 'active'

  it('valid transitions always pass (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates).chain((from) => {
          const validTargets = sensorGetValidNextStates(from) as SensorStateNode[]
          if (validTargets.length === 0) {
            return fc.constant({ from, to: from, hasValid: false })
          }
          return fc.constantFrom(...validTargets).map((to) => ({ from, to, hasValid: true }))
        }),
        ({ from, to, hasValid }) => {
          if (hasValid) {
            expect(sensorIsValidTransition(from, to)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('invalid transitions always fail (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates).chain((from) => {
          const validTargets = sensorGetValidNextStates(from) as SensorStateNode[]
          const invalidTargets = allStates.filter(
            (s) => !validTargets.includes(s) && s !== from
          )
          if (invalidTargets.length === 0) {
            return fc.constant({ from, to: from, hasInvalid: false })
          }
          return fc.constantFrom(...invalidTargets).map((to) => ({ from, to, hasInvalid: true }))
        }),
        ({ from, to, hasInvalid }) => {
          if (hasInvalid) {
            expect(sensorIsValidTransition(from, to)).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no self-transitions (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allStates), (state) => {
        expect(sensorIsValidTransition(state, state)).toBe(false)
      }),
      { numRuns: 50 }
    )
  })

  it('terminal states have no outgoing transitions', () => {
    for (const terminal of terminalStates) {
      const nextStates = sensorGetValidNextStates(terminal)
      expect(nextStates).toHaveLength(0)
      expect(sensorIsTerminal(terminal)).toBe(true)
    }
  })

  it('non-terminal states have at least one outgoing transition', () => {
    for (const state of nonTerminalStates) {
      const nextStates = sensorGetValidNextStates(state)
      expect(nextStates.length).toBeGreaterThan(0)
      expect(sensorIsTerminal(state)).toBe(false)
    }
  })

  it('random walk reachability from initial state (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (steps) => {
          let current: SensorStateNode = initialState
          for (let i = 0; i < steps; i++) {
            const nextStates = sensorGetValidNextStates(current) as SensorStateNode[]
            if (nextStates.length === 0) break
            current = nextStates[i % nextStates.length]
            expect(allStates).toContain(current)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  // Domain-specific: valid transitions have action labels
  it('every valid transition has a named action', () => {
    for (const from of allStates) {
      const nextStates = sensorGetValidNextStates(from) as SensorStateNode[]
      for (const to of nextStates) {
        const action = sensorGetTransitionAction(from, to)
        expect(Option.isSome(action)).toBe(true)
      }
    }
  })

  // Domain-specific: calibration cycle
  it('calibration cycle: needs_calibration -> calibrating -> active', () => {
    expect(sensorIsValidTransition('needs_calibration', 'calibrating')).toBe(true)
    expect(sensorIsValidTransition('calibrating', 'active')).toBe(true)
  })

  // Domain-specific: active can flag for calibration
  it('active can flag for calibration', () => {
    expect(sensorIsValidTransition('active', 'needs_calibration')).toBe(true)
  })

  // Domain-specific: decommissioned is absorbing
  it('decommissioned is absorbing (no outgoing transitions)', () => {
    const nextStates = sensorGetValidNextStates('decommissioned')
    expect(nextStates).toHaveLength(0)
  })

  // Domain-specific: decommission only from offline or faulted
  it('decommission only reachable from offline or faulted', () => {
    for (const from of allStates) {
      if (from === 'offline' || from === 'faulted') {
        expect(sensorIsValidTransition(from, 'decommissioned')).toBe(true)
      } else {
        expect(sensorIsValidTransition(from, 'decommissioned')).toBe(false)
      }
    }
  })
})
