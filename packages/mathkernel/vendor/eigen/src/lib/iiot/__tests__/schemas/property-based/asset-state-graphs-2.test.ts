/**
 * Property-Based Tests: Plant, Line, WorkCell State Graphs
 *
 * Validates graph invariants for ISA-95 asset hierarchy state machines
 * using fast-check property-based testing.
 *
 * Properties tested per entity (6 each = 18 total):
 * 1. Valid transitions always pass
 * 2. Invalid transitions always fail
 * 3. No self-transitions
 * 4. Terminal states have no outgoing transitions
 * 5. Non-terminal states have at least one outgoing transition
 * 6. Random walk reachability from initial state
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { FastCheck as fc, Option } from 'effect'

// =============================================================================
// Plant Graph Imports
// =============================================================================
import {
  ALL_STATES as PLANT_ALL_STATES,
  TERMINAL_STATES as PLANT_TERMINAL_STATES,
  isValidStateTransition as plantIsValid,
  getValidNextStates as plantNextStates,
  getTransitionAction as plantGetAction,
  type PlantStateNode,
} from '../../../machines/graphs/plant-graph'

// =============================================================================
// Line Graph Imports
// =============================================================================
import {
  ALL_STATES as LINE_ALL_STATES,
  TERMINAL_STATES as LINE_TERMINAL_STATES,
  isValidStateTransition as lineIsValid,
  getValidNextStates as lineNextStates,
  getTransitionAction as lineGetAction,
  type LineStateNode,
} from '../../../machines/graphs/line-graph'

// =============================================================================
// WorkCell Graph Imports
// =============================================================================
import {
  ALL_STATES as WORKCELL_ALL_STATES,
  TERMINAL_STATES as WORKCELL_TERMINAL_STATES,
  isValidStateTransition as workcellIsValid,
  getValidNextStates as workcellNextStates,
  getTransitionAction as workcellGetAction,
  type WorkcellStateNode,
} from '../../../machines/graphs/workcell-graph'

// =============================================================================
// Helpers
// =============================================================================

/**
 * Perform a random walk from a starting state using a deterministic seed
 * of random choices. Returns the sequence of visited states.
 */
function randomWalk<S>(
  startState: S,
  getNextStates: (s: S) => readonly S[],
  choices: number[],
  maxSteps: number
): S[] {
  const visited: S[] = [startState]
  let current = startState

  for (let i = 0; i < Math.min(choices.length, maxSteps); i++) {
    const next = getNextStates(current)
    if (next.length === 0) break
    const idx = choices[i] % next.length
    current = next[idx]
    visited.push(current)
  }

  return visited
}

// =============================================================================
// Plant State Graph Properties
// =============================================================================

describe('Property-Based: Plant State Graph', () => {
  const INITIAL_STATE: PlantStateNode = 'commissioning'

  it('P1: valid transitions always pass isValidStateTransition', () => {
    // Generate random non-terminal plant state, then pick a valid next state
    const nonTerminal = PLANT_ALL_STATES.filter(
      (s) => !PLANT_TERMINAL_STATES.includes(s)
    )
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminal), (from) => {
        const targets = plantNextStates(from)
        // Non-terminal states must have targets (checked in P5)
        for (const to of targets) {
          expect(plantIsValid(from, to)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('P2: invalid transitions always fail isValidStateTransition', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PLANT_ALL_STATES),
        fc.constantFrom(...PLANT_ALL_STATES),
        (from, to) => {
          const validTargets = plantNextStates(from)
          if (!validTargets.includes(to)) {
            expect(plantIsValid(from, to)).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('P3: no self-transitions exist', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PLANT_ALL_STATES), (state) => {
        expect(plantIsValid(state, state)).toBe(false)
      }),
      { numRuns: 50 }
    )
  })

  it('P4: terminal states have no outgoing transitions', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PLANT_TERMINAL_STATES), (terminal) => {
        const next = plantNextStates(terminal)
        expect(next).toHaveLength(0)
      }),
      { numRuns: 20 }
    )
  })

  it('P5: non-terminal states have at least one outgoing transition', () => {
    const nonTerminal = PLANT_ALL_STATES.filter(
      (s) => !PLANT_TERMINAL_STATES.includes(s)
    )
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminal), (state) => {
        const next = plantNextStates(state)
        expect(next.length).toBeGreaterThanOrEqual(1)
      }),
      { numRuns: 50 }
    )
  })

  it('P6: random walk from commissioning always visits valid states', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 100 }), { minLength: 1, maxLength: 20 }),
        (choices) => {
          const path = randomWalk(INITIAL_STATE, plantNextStates, choices, 20)
          // Every state in the walk must be a valid plant state
          for (const state of path) {
            expect(PLANT_ALL_STATES).toContain(state)
          }
          // Each consecutive pair must be a valid transition
          for (let i = 0; i < path.length - 1; i++) {
            expect(plantIsValid(path[i], path[i + 1])).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Domain-specific: commissioning -> operational is a one-way gate
  it('D1: commissioning -> operational is a one-way gate (no return to commissioning)', () => {
    // No state should transition back to commissioning
    for (const state of PLANT_ALL_STATES) {
      if (state !== 'commissioning') {
        expect(plantIsValid(state, 'commissioning')).toBe(false)
      }
    }
  })

  // Domain-specific: shutdown types are exclusive
  it('D2: shutdown transitions are exclusive (operational -> exactly one shutdown type per transition)', () => {
    const shutdownTargets = plantNextStates('operational')
    // All must be shutdown-type states
    for (const target of shutdownTargets) {
      expect(['scheduled_shutdown', 'emergency_shutdown', 'maintenance_shutdown']).toContain(target)
    }
  })

  // Domain-specific: valid transitions always have an action name
  it('D3: every valid transition has a defined action name', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PLANT_ALL_STATES), (from) => {
        const targets = plantNextStates(from)
        for (const to of targets) {
          const action = plantGetAction(from, to)
          expect(Option.isSome(action)).toBe(true)
        }
      }),
      { numRuns: 50 }
    )
  })
})

// =============================================================================
// Line State Graph Properties
// =============================================================================

describe('Property-Based: Line State Graph', () => {
  const INITIAL_STATE: LineStateNode = 'idle'

  it('P1: valid transitions always pass isValidStateTransition', () => {
    const nonTerminal = LINE_ALL_STATES.filter(
      (s) => !LINE_TERMINAL_STATES.includes(s)
    )
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminal), (from) => {
        const targets = lineNextStates(from)
        for (const to of targets) {
          expect(lineIsValid(from, to)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('P2: invalid transitions always fail isValidStateTransition', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LINE_ALL_STATES),
        fc.constantFrom(...LINE_ALL_STATES),
        (from, to) => {
          const validTargets = lineNextStates(from)
          if (!validTargets.includes(to)) {
            expect(lineIsValid(from, to)).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('P3: no self-transitions exist', () => {
    fc.assert(
      fc.property(fc.constantFrom(...LINE_ALL_STATES), (state) => {
        expect(lineIsValid(state, state)).toBe(false)
      }),
      { numRuns: 50 }
    )
  })

  it('P4: terminal states have no outgoing transitions', () => {
    fc.assert(
      fc.property(fc.constantFrom(...LINE_TERMINAL_STATES), (terminal) => {
        const next = lineNextStates(terminal)
        expect(next).toHaveLength(0)
      }),
      { numRuns: 20 }
    )
  })

  it('P5: non-terminal states have at least one outgoing transition', () => {
    const nonTerminal = LINE_ALL_STATES.filter(
      (s) => !LINE_TERMINAL_STATES.includes(s)
    )
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminal), (state) => {
        const next = lineNextStates(state)
        expect(next.length).toBeGreaterThanOrEqual(1)
      }),
      { numRuns: 50 }
    )
  })

  it('P6: random walk from idle always visits valid states', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 100 }), { minLength: 1, maxLength: 20 }),
        (choices) => {
          const path = randomWalk(INITIAL_STATE, lineNextStates, choices, 20)
          for (const state of path) {
            expect(LINE_ALL_STATES).toContain(state)
          }
          for (let i = 0; i < path.length - 1; i++) {
            expect(lineIsValid(path[i], path[i + 1])).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Domain-specific: changeover returns to running
  it('D1: changeover always returns to running', () => {
    const changeoverTargets = lineNextStates('changeover')
    expect(changeoverTargets).toHaveLength(1)
    expect(changeoverTargets[0]).toBe('running')
  })

  // Domain-specific: starved and blocked are recoverable
  it('D2: starved and blocked are recoverable (return to running)', () => {
    const starvedTargets = lineNextStates('starved')
    expect(starvedTargets).toContain('running')
    expect(starvedTargets).toHaveLength(1)

    const blockedTargets = lineNextStates('blocked')
    expect(blockedTargets).toContain('running')
    expect(blockedTargets).toHaveLength(1)
  })

  // Domain-specific: valid transitions always have an action name
  it('D3: every valid transition has a defined action name', () => {
    fc.assert(
      fc.property(fc.constantFrom(...LINE_ALL_STATES), (from) => {
        const targets = lineNextStates(from)
        for (const to of targets) {
          const action = lineGetAction(from, to)
          expect(Option.isSome(action)).toBe(true)
        }
      }),
      { numRuns: 50 }
    )
  })
})

// =============================================================================
// WorkCell State Graph Properties
// =============================================================================

describe('Property-Based: WorkCell State Graph', () => {
  const INITIAL_STATE: WorkcellStateNode = 'idle'

  it('P1: valid transitions always pass isValidStateTransition', () => {
    const nonTerminal = WORKCELL_ALL_STATES.filter(
      (s) => !WORKCELL_TERMINAL_STATES.includes(s)
    )
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminal), (from) => {
        const targets = workcellNextStates(from)
        for (const to of targets) {
          expect(workcellIsValid(from, to)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('P2: invalid transitions always fail isValidStateTransition', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...WORKCELL_ALL_STATES),
        fc.constantFrom(...WORKCELL_ALL_STATES),
        (from, to) => {
          const validTargets = workcellNextStates(from)
          if (!validTargets.includes(to)) {
            expect(workcellIsValid(from, to)).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  it('P3: no self-transitions exist', () => {
    fc.assert(
      fc.property(fc.constantFrom(...WORKCELL_ALL_STATES), (state) => {
        expect(workcellIsValid(state, state)).toBe(false)
      }),
      { numRuns: 50 }
    )
  })

  it('P4: terminal states have no outgoing transitions', () => {
    fc.assert(
      fc.property(fc.constantFrom(...WORKCELL_TERMINAL_STATES), (terminal) => {
        const next = workcellNextStates(terminal)
        expect(next).toHaveLength(0)
      }),
      { numRuns: 20 }
    )
  })

  it('P5: non-terminal states have at least one outgoing transition', () => {
    const nonTerminal = WORKCELL_ALL_STATES.filter(
      (s) => !WORKCELL_TERMINAL_STATES.includes(s)
    )
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminal), (state) => {
        const next = workcellNextStates(state)
        expect(next.length).toBeGreaterThanOrEqual(1)
      }),
      { numRuns: 50 }
    )
  })

  it('P6: random walk from idle always visits valid states', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 100 }), { minLength: 1, maxLength: 20 }),
        (choices) => {
          const path = randomWalk(INITIAL_STATE, workcellNextStates, choices, 20)
          for (const state of path) {
            expect(WORKCELL_ALL_STATES).toContain(state)
          }
          for (let i = 0; i < path.length - 1; i++) {
            expect(workcellIsValid(path[i], path[i + 1])).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Domain-specific: setup -> producing cycle (idle -> setup -> running)
  it('D1: setup -> running is the producing cycle entry', () => {
    const setupTargets = workcellNextStates('setup')
    expect(setupTargets).toHaveLength(1)
    expect(setupTargets[0]).toBe('running')
  })

  // Domain-specific: faulted has recovery paths
  it('D2: faulted can recover to idle or enter maintenance', () => {
    const faultedTargets = workcellNextStates('faulted')
    expect(faultedTargets).toContain('idle')
    expect(faultedTargets).toContain('maintenance')
  })

  // Domain-specific: valid transitions always have an action name
  it('D3: every valid transition has a defined action name', () => {
    fc.assert(
      fc.property(fc.constantFrom(...WORKCELL_ALL_STATES), (from) => {
        const targets = workcellNextStates(from)
        for (const to of targets) {
          const action = workcellGetAction(from, to)
          expect(Option.isSome(action)).toBe(true)
        }
      }),
      { numRuns: 50 }
    )
  })
})
