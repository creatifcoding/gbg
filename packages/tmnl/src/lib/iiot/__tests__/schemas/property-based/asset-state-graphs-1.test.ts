/**
 * Property-Based Tests: Enterprise, Site, Area State Graphs
 *
 * Tests graph invariants for ISA-95 asset hierarchy state machines
 * using fast-check property-based testing.
 *
 * Covers:
 * - Enterprise: active, restructuring, merged (terminal), dissolved (terminal)
 * - Site: planned, under_construction, operational, seasonal_shutdown, closed, decommissioned (terminal)
 * - Area: active, restricted, maintenance, inactive, decommissioned (terminal)
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import { FastCheck as fc, Option } from 'effect'

// =============================================================================
// Imports: Enterprise Graph
// =============================================================================
import {
  ALL_STATES as ENTERPRISE_ALL_STATES,
  TERMINAL_STATES as ENTERPRISE_TERMINAL_STATES,
  isValidStateTransition as enterpriseIsValid,
  getValidNextStates as enterpriseNextStates,
  getTransitionAction as enterpriseGetAction,
  isTerminalState as enterpriseIsTerminal,
  type EnterpriseStateNode,
} from '../../../machines/graphs/enterprise-graph'

// =============================================================================
// Imports: Site Graph
// =============================================================================
import {
  ALL_STATES as SITE_ALL_STATES,
  TERMINAL_STATES as SITE_TERMINAL_STATES,
  isValidStateTransition as siteIsValid,
  getValidNextStates as siteNextStates,
  getTransitionAction as siteGetAction,
  isTerminalState as siteIsTerminal,
  type SiteStateNode,
} from '../../../machines/graphs/site-graph'

// =============================================================================
// Imports: Area Graph
// =============================================================================
import {
  ALL_STATES as AREA_ALL_STATES,
  TERMINAL_STATES as AREA_TERMINAL_STATES,
  isValidStateTransition as areaIsValid,
  getValidNextStates as areaNextStates,
  getTransitionAction as areaGetAction,
  isTerminalState as areaIsTerminal,
  type AreaStateNode,
} from '../../../machines/graphs/area-graph'

// =============================================================================
// Enterprise State Graph Properties
// =============================================================================

describe('Property-Based: Enterprise State Graph', () => {
  const allStates = ENTERPRISE_ALL_STATES as readonly EnterpriseStateNode[]
  const terminalStates = ENTERPRISE_TERMINAL_STATES as readonly EnterpriseStateNode[]
  const nonTerminalStates = allStates.filter((s) => !terminalStates.includes(s))

  it('valid transitions always pass isValidStateTransition', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminalStates), (from) => {
        const nextStates = enterpriseNextStates(from)
        for (const to of nextStates) {
          expect(enterpriseIsValid(from, to)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('invalid transitions always fail isValidStateTransition', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates),
        fc.constantFrom(...allStates),
        (from, to) => {
          const nextStates = enterpriseNextStates(from) as readonly string[]
          if (!nextStates.includes(to)) {
            expect(enterpriseIsValid(from, to)).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no self-transitions exist', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allStates), (state) => {
        expect(enterpriseIsValid(state, state)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('terminal states have no outgoing transitions', () => {
    fc.assert(
      fc.property(fc.constantFrom(...terminalStates), (terminal) => {
        const nextStates = enterpriseNextStates(terminal)
        expect(nextStates).toHaveLength(0)
        expect(enterpriseIsTerminal(terminal)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('non-terminal states have at least one outgoing transition', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminalStates), (state) => {
        const nextStates = enterpriseNextStates(state)
        expect(nextStates.length).toBeGreaterThan(0)
        expect(enterpriseIsTerminal(state)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('random walk from initial state always reaches valid states', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (walkLength) => {
          let current: EnterpriseStateNode = 'active'

          for (let i = 0; i < walkLength; i++) {
            const next = enterpriseNextStates(current) as readonly EnterpriseStateNode[]
            if (next.length === 0) break // terminal

            // Pick a random next state deterministically based on step
            current = next[i % next.length]
            expect(allStates).toContain(current)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  // Domain-specific: terminal states are absorbing
  it('merged and dissolved are truly absorbing (no escape)', () => {
    for (const terminal of ['merged', 'dissolved'] as EnterpriseStateNode[]) {
      const next = enterpriseNextStates(terminal)
      expect(next).toHaveLength(0)

      // No state can transition INTO a terminal from another terminal
      for (const otherTerminal of terminalStates) {
        expect(enterpriseIsValid(otherTerminal, terminal)).toBe(false)
      }
    }
  })

  it('valid transitions always have an associated action', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminalStates), (from) => {
        const nextStates = enterpriseNextStates(from) as readonly EnterpriseStateNode[]
        for (const to of nextStates) {
          const action = enterpriseGetAction(from, to)
          expect(Option.isSome(action)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Site State Graph Properties
// =============================================================================

describe('Property-Based: Site State Graph', () => {
  const allStates = SITE_ALL_STATES as readonly SiteStateNode[]
  const terminalStates = SITE_TERMINAL_STATES as readonly SiteStateNode[]
  const nonTerminalStates = allStates.filter((s) => !terminalStates.includes(s))

  it('valid transitions always pass isValidStateTransition', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminalStates), (from) => {
        const nextStates = siteNextStates(from)
        for (const to of nextStates) {
          expect(siteIsValid(from, to)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('invalid transitions always fail isValidStateTransition', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates),
        fc.constantFrom(...allStates),
        (from, to) => {
          const nextStates = siteNextStates(from) as readonly string[]
          if (!nextStates.includes(to)) {
            expect(siteIsValid(from, to)).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no self-transitions exist', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allStates), (state) => {
        expect(siteIsValid(state, state)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('terminal states have no outgoing transitions', () => {
    fc.assert(
      fc.property(fc.constantFrom(...terminalStates), (terminal) => {
        const nextStates = siteNextStates(terminal)
        expect(nextStates).toHaveLength(0)
        expect(siteIsTerminal(terminal)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('non-terminal states have at least one outgoing transition', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminalStates), (state) => {
        const nextStates = siteNextStates(state)
        expect(nextStates.length).toBeGreaterThan(0)
        expect(siteIsTerminal(state)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('random walk from initial state always reaches valid states', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 15 }),
        (walkLength) => {
          let current: SiteStateNode = 'planned'

          for (let i = 0; i < walkLength; i++) {
            const next = siteNextStates(current) as readonly SiteStateNode[]
            if (next.length === 0) break // terminal

            current = next[i % next.length]
            expect(allStates).toContain(current)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  // Domain-specific: planned -> under_construction -> operational lifecycle
  it('planned -> under_construction -> operational lifecycle is valid', () => {
    expect(siteIsValid('planned', 'under_construction')).toBe(true)
    expect(siteIsValid('under_construction', 'operational')).toBe(true)

    // planned cannot skip to operational
    expect(siteIsValid('planned', 'operational')).toBe(false)
  })

  it('valid transitions always have an associated action', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminalStates), (from) => {
        const nextStates = siteNextStates(from) as readonly SiteStateNode[]
        for (const to of nextStates) {
          const action = siteGetAction(from, to)
          expect(Option.isSome(action)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Area State Graph Properties
// =============================================================================

describe('Property-Based: Area State Graph', () => {
  const allStates = AREA_ALL_STATES as readonly AreaStateNode[]
  const terminalStates = AREA_TERMINAL_STATES as readonly AreaStateNode[]
  const nonTerminalStates = allStates.filter((s) => !terminalStates.includes(s))

  it('valid transitions always pass isValidStateTransition', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminalStates), (from) => {
        const nextStates = areaNextStates(from)
        for (const to of nextStates) {
          expect(areaIsValid(from, to)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('invalid transitions always fail isValidStateTransition', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates),
        fc.constantFrom(...allStates),
        (from, to) => {
          const nextStates = areaNextStates(from) as readonly string[]
          if (!nextStates.includes(to)) {
            expect(areaIsValid(from, to)).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('no self-transitions exist', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allStates), (state) => {
        expect(areaIsValid(state, state)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('terminal states have no outgoing transitions', () => {
    fc.assert(
      fc.property(fc.constantFrom(...terminalStates), (terminal) => {
        const nextStates = areaNextStates(terminal)
        expect(nextStates).toHaveLength(0)
        expect(areaIsTerminal(terminal)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('non-terminal states have at least one outgoing transition', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminalStates), (state) => {
        const nextStates = areaNextStates(state)
        expect(nextStates.length).toBeGreaterThan(0)
        expect(areaIsTerminal(state)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it('random walk from initial state always reaches valid states', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 15 }),
        (walkLength) => {
          let current: AreaStateNode = 'active'

          for (let i = 0; i < walkLength; i++) {
            const next = areaNextStates(current) as readonly AreaStateNode[]
            if (next.length === 0) break // terminal

            current = next[i % next.length]
            expect(allStates).toContain(current)
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  // Domain-specific: restricted state blocks maintenance/deactivation
  it('restricted state cannot enter maintenance or deactivate', () => {
    expect(areaIsValid('restricted', 'maintenance')).toBe(false)
    expect(areaIsValid('restricted', 'inactive')).toBe(false)
    // restricted can only go back to active
    const nextFromRestricted = areaNextStates('restricted')
    expect(nextFromRestricted).toHaveLength(1)
    expect(nextFromRestricted[0]).toBe('active')
  })

  it('valid transitions always have an associated action', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nonTerminalStates), (from) => {
        const nextStates = areaNextStates(from) as readonly AreaStateNode[]
        for (const to of nextStates) {
          const action = areaGetAction(from, to)
          expect(Option.isSome(action)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })
})
