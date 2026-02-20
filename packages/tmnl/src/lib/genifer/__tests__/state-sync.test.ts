/**
 * StateSyncService Tests
 *
 * Validates bidirectional component state management.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as Registry from '@effect-atom/atom/Registry'
import {
  createStateSyncService,
  elementStatesAtom,
  changeLogAtom,
  dirtyElementsAtom,
  type StateSyncServiceShape,
} from '../react/state-sync.js'
import { InteractableElement, StateFieldDecl } from '../core/interactable.js'

function makeSlider(key = 'slider-1', value = 0) {
  return new InteractableElement({
    key,
    type: 'Slider',
    props: { label: 'Gain' },
    stateSchema: [
      new StateFieldDecl({
        name: 'value',
        type: 'number',
        defaultValue: 0,
        constraints: { min: -48, max: 12 },
      }),
    ],
    initialState: { value },
  })
}

function makeToggle(key = 'toggle-1') {
  return new InteractableElement({
    key,
    type: 'Toggle',
    props: {},
    stateSchema: [
      new StateFieldDecl({ name: 'checked', type: 'boolean', defaultValue: false }),
    ],
  })
}

describe('StateSyncService', () => {
  let service: StateSyncServiceShape
  let r: Registry.Registry

  beforeEach(() => {
    r = Registry.make()
    service = createStateSyncService(r)
    service.reset()
  })

  // ─────────────────────────────────────────────────────────
  // Init + getState
  // ─────────────────────────────────────────────────────────

  it('initializes element state from defaults', () => {
    service.initElement(makeSlider('s1', -6))

    const state = service.getState('s1')
    expect(state).toEqual({ value: -6 })
  })

  it('ignores non-interactable elements', () => {
    const plain = new InteractableElement({
      key: 'label-1',
      type: 'Text',
      props: {},
    })
    service.initElement(plain)

    expect(service.getState('label-1')).toBeUndefined()
  })

  // ─────────────────────────────────────────────────────────
  // setField
  // ─────────────────────────────────────────────────────────

  it('sets a valid field', () => {
    service.initElement(makeSlider())
    const error = service.setField('slider-1', 'value', 5)

    expect(error).toBeNull()
    expect(service.getState('slider-1')?.value).toBe(5)
  })

  it('rejects field that violates constraints', () => {
    service.initElement(makeSlider())
    const error = service.setField('slider-1', 'value', 99)

    expect(error).toContain('<= 12')
    // State should NOT change on validation failure
    expect(service.getState('slider-1')?.value).toBe(0)
  })

  it('returns error for uninitialized element', () => {
    const error = service.setField('nope', 'value', 42)
    expect(error).toContain('not initialized')
  })

  // ─────────────────────────────────────────────────────────
  // setFields (batch)
  // ─────────────────────────────────────────────────────────

  it('sets multiple fields atomically', () => {
    const element = new InteractableElement({
      key: 'form-1',
      type: 'Form',
      props: {},
      stateSchema: [
        new StateFieldDecl({ name: 'name', type: 'string', defaultValue: '' }),
        new StateFieldDecl({ name: 'age', type: 'number', defaultValue: 0 }),
      ],
    })
    service.initElement(element)

    const error = service.setFields('form-1', { name: 'Alice', age: 30 })
    expect(error).toBeNull()

    const state = service.getState('form-1')
    expect(state?.name).toBe('Alice')
    expect(state?.age).toBe(30)
  })

  // ─────────────────────────────────────────────────────────
  // Change log
  // ─────────────────────────────────────────────────────────

  it('records changes in change log', () => {
    service.initElement(makeSlider())
    service.setField('slider-1', 'value', 5)
    service.setField('slider-1', 'value', 10)

    const log = r.get(changeLogAtom)
    expect(log).toHaveLength(2)
    expect(log[0].previousValue).toBe(0)
    expect(log[0].nextValue).toBe(5)
    expect(log[1].previousValue).toBe(5)
    expect(log[1].nextValue).toBe(10)
  })

  // ─────────────────────────────────────────────────────────
  // Dirty tracking
  // ─────────────────────────────────────────────────────────

  it('marks elements as dirty after setField', () => {
    service.initElement(makeSlider())
    service.setField('slider-1', 'value', 5)

    expect(r.get(dirtyElementsAtom).has('slider-1')).toBe(true)
  })

  it('markClean removes from dirty set', () => {
    service.initElement(makeSlider())
    service.setField('slider-1', 'value', 5)
    service.markClean('slider-1')

    expect(r.get(dirtyElementsAtom).has('slider-1')).toBe(false)
  })

  // ─────────────────────────────────────────────────────────
  // Remove + Reset
  // ─────────────────────────────────────────────────────────

  it('removeElement cleans up state', () => {
    service.initElement(makeSlider())
    service.removeElement('slider-1')

    expect(service.getState('slider-1')).toBeUndefined()
  })

  it('reset clears everything', () => {
    service.initElement(makeSlider())
    service.initElement(makeToggle())
    service.setField('slider-1', 'value', 5)

    service.reset()

    expect(r.get(elementStatesAtom).size).toBe(0)
    expect(r.get(changeLogAtom)).toEqual([])
    expect(r.get(dirtyElementsAtom).size).toBe(0)
  })

  // ─────────────────────────────────────────────────────────
  // Multiple elements
  // ─────────────────────────────────────────────────────────

  it('manages state for multiple elements independently', () => {
    service.initElement(makeSlider('s1', 0))
    service.initElement(makeSlider('s2', -12))
    service.initElement(makeToggle('t1'))

    service.setField('s1', 'value', 5)
    service.setField('t1', 'checked', true)

    expect(service.getState('s1')?.value).toBe(5)
    expect(service.getState('s2')?.value).toBe(-12) // untouched
    expect(service.getState('t1')?.checked).toBe(true)
  })
})
