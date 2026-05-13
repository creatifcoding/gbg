/**
 * Unit tests for the 3-state view mode FSM.
 *
 * States: collapsed | output | eval
 *
 * Transitions:
 *   Ctrl+O (pi toggles expanded):
 *     collapsed(e=F) → output(e=T) → collapsed(e=F)
 *   Ctrl+Shift+O (our toggleShowEval):
 *     collapsed → eval → collapsed (same key toggles off)
 *     output → eval → output (switches, then toggles off)
 *
 * resolveViewMode(piExpanded) combines pi's expanded with our showEval.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  resolveViewMode,
  getShowEval,
  toggleShowEval,
  resetViewState,
} from '../../../../.pi/extensions/metaskill/view-state.ts'

beforeEach(() => {
  resetViewState()
})

describe('resolveViewMode', () => {
  it('defaults to collapsed', () => {
    expect(resolveViewMode(false)).toBe('collapsed')
    expect(getShowEval()).toBe(false)
  })

  it('Ctrl+O (expanded=true) → output', () => {
    expect(resolveViewMode(true)).toBe('output')
  })

  it('Ctrl+O again (expanded=false) → collapsed', () => {
    expect(resolveViewMode(true)).toBe('output')
    expect(resolveViewMode(false)).toBe('collapsed')
  })

  it('Ctrl+Shift+O from collapsed → eval', () => {
    toggleShowEval()
    expect(getShowEval()).toBe(true)
    expect(resolveViewMode(false)).toBe('eval')
  })

  it('Ctrl+Shift+O again → collapsed (same key toggles off)', () => {
    toggleShowEval()  // on
    toggleShowEval()  // off
    expect(getShowEval()).toBe(false)
    expect(resolveViewMode(false)).toBe('collapsed')
  })

  it('Ctrl+O then Ctrl+Shift+O → eval', () => {
    // User presses Ctrl+O (pi sets expanded=true) → output
    expect(resolveViewMode(true)).toBe('output')
    // User presses Ctrl+Shift+O → switches to eval
    toggleShowEval()
    expect(resolveViewMode(true)).toBe('eval')
  })

  it('eval mode: Ctrl+Shift+O → back to output', () => {
    toggleShowEval()
    expect(resolveViewMode(true)).toBe('eval')
    toggleShowEval()  // toggle off
    expect(resolveViewMode(true)).toBe('output')
  })

  it('eval mode: Ctrl+O (expanded=false) → eval persists on showEval', () => {
    toggleShowEval()
    // Even with expanded=false, showEval=true → eval
    expect(resolveViewMode(false)).toBe('eval')
  })

  it('resetViewState clears showEval', () => {
    toggleShowEval()
    expect(getShowEval()).toBe(true)
    resetViewState()
    expect(getShowEval()).toBe(false)
    expect(resolveViewMode(false)).toBe('collapsed')
  })
})

describe('toggleShowEval return value', () => {
  it('returns new state', () => {
    expect(toggleShowEval()).toBe(true)
    expect(toggleShowEval()).toBe(false)
    expect(toggleShowEval()).toBe(true)
  })
})

describe('full transition matrix', () => {
  // Enumerate all 4 combinations of (piExpanded, showEval)
  const cases: Array<[boolean, boolean, string]> = [
    [false, false, 'collapsed'],
    [true,  false, 'output'],
    [false, true,  'eval'],
    [true,  true,  'eval'],
  ]

  it.each(cases)('expanded=%s showEval=%s → %s', (piExpanded, showEval, expected) => {
    resetViewState()
    if (showEval) toggleShowEval()
    expect(resolveViewMode(piExpanded)).toBe(expected)
  })
})

describe('irreducible switching sequences', () => {
  it('collapsed → Ctrl+Shift+O → eval → Ctrl+Shift+O → collapsed', () => {
    expect(resolveViewMode(false)).toBe('collapsed')
    toggleShowEval()
    expect(resolveViewMode(false)).toBe('eval')
    toggleShowEval()
    expect(resolveViewMode(false)).toBe('collapsed')
  })

  it('collapsed → Ctrl+O → output → Ctrl+Shift+O → eval → Ctrl+O → eval (showEval persists)', () => {
    expect(resolveViewMode(false)).toBe('collapsed')
    // Ctrl+O: expanded becomes true
    expect(resolveViewMode(true)).toBe('output')
    // Ctrl+Shift+O: toggle eval on
    toggleShowEval()
    expect(resolveViewMode(true)).toBe('eval')
    // Ctrl+O: expanded becomes false, but showEval still true → eval
    expect(resolveViewMode(false)).toBe('eval')
  })

  it('eval → Ctrl+Shift+O → output (when expanded) / collapsed (when not)', () => {
    toggleShowEval()
    expect(resolveViewMode(true)).toBe('eval')
    toggleShowEval()
    expect(resolveViewMode(true)).toBe('output')
    expect(resolveViewMode(false)).toBe('collapsed')
  })
})
