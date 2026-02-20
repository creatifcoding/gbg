/**
 * InteractableElement Protocol Tests
 *
 * Validates the bidirectional component state schema and validation logic.
 */

import { describe, it, expect } from 'vitest'
import { Schema } from 'effect'
import {
  InteractableElement,
  StateFieldDecl,
  StateChange,
  hasStateSchema,
} from '../core/interactable.js'

describe('InteractableElement', () => {
  // ─────────────────────────────────────────────────────────
  // Schema decode
  // ─────────────────────────────────────────────────────────

  it('decodes a valid interactable element', () => {
    const raw = {
      key: 'slider-1',
      type: 'Slider',
      props: { label: 'Volume', unit: 'dB' },
      stateSchema: [
        { name: 'value', type: 'number', defaultValue: 0, constraints: { min: -48, max: 12 } },
      ],
      initialState: { value: -6 },
    }

    const result = Schema.decodeUnknownSync(InteractableElement)(raw)
    expect(result.key).toBe('slider-1')
    expect(result.type).toBe('Slider')
    expect(result.isInteractable).toBe(true)
    expect(result.stateSchema).toHaveLength(1)
  })

  it('decodes element without state (not interactable)', () => {
    const raw = {
      key: 'label-1',
      type: 'Text',
      props: { content: 'Hello' },
    }

    const result = Schema.decodeUnknownSync(InteractableElement)(raw)
    expect(result.isInteractable).toBe(false)
    expect(result.stateSchema).toEqual([])
  })

  // ─────────────────────────────────────────────────────────
  // Default state
  // ─────────────────────────────────────────────────────────

  it('computes default state from schema declarations', () => {
    const element = new InteractableElement({
      key: 'toggle-1',
      type: 'Toggle',
      props: {},
      stateSchema: [
        new StateFieldDecl({ name: 'checked', type: 'boolean', defaultValue: false }),
        new StateFieldDecl({ name: 'label', type: 'string', defaultValue: 'Off' }),
      ],
      initialState: { checked: true },
    })

    const state = element.defaultState
    expect(state.checked).toBe(true) // initialState overrides defaultValue
    expect(state.label).toBe('Off') // falls back to defaultValue
  })

  // ─────────────────────────────────────────────────────────
  // Field validation
  // ─────────────────────────────────────────────────────────

  it('validates number constraints', () => {
    const element = new InteractableElement({
      key: 's1',
      type: 'Slider',
      props: {},
      stateSchema: [
        new StateFieldDecl({
          name: 'value',
          type: 'number',
          defaultValue: 0,
          constraints: { min: 0, max: 100 },
        }),
      ],
    })

    expect(element.validateField('value', 50)).toBeNull() // valid
    expect(element.validateField('value', -1)).toContain('>= 0')
    expect(element.validateField('value', 101)).toContain('<= 100')
  })

  it('validates string constraints', () => {
    const element = new InteractableElement({
      key: 'input-1',
      type: 'TextInput',
      props: {},
      stateSchema: [
        new StateFieldDecl({
          name: 'text',
          type: 'string',
          defaultValue: '',
          constraints: { minLength: 1, maxLength: 50 },
        }),
      ],
    })

    expect(element.validateField('text', 'hello')).toBeNull()
    expect(element.validateField('text', '')).toContain('>= 1')
    expect(element.validateField('text', 'x'.repeat(51))).toContain('<= 50')
  })

  it('validates enum constraints', () => {
    const element = new InteractableElement({
      key: 'select-1',
      type: 'Select',
      props: {},
      stateSchema: [
        new StateFieldDecl({
          name: 'selected',
          type: 'string',
          defaultValue: 'a',
          constraints: { enum: ['a', 'b', 'c'] },
        }),
      ],
    })

    expect(element.validateField('selected', 'b')).toBeNull()
    expect(element.validateField('selected', 'z')).toContain('one of')
  })

  it('rejects unknown fields', () => {
    const element = new InteractableElement({
      key: 'x',
      type: 'X',
      props: {},
      stateSchema: [
        new StateFieldDecl({ name: 'value', type: 'number', defaultValue: 0 }),
      ],
    })

    expect(element.validateField('nonexistent', 42)).toContain('Unknown')
  })

  it('rejects type mismatches', () => {
    const element = new InteractableElement({
      key: 'x',
      type: 'X',
      props: {},
      stateSchema: [
        new StateFieldDecl({ name: 'count', type: 'number', defaultValue: 0 }),
      ],
    })

    expect(element.validateField('count', 'not a number')).toContain('Expected number')
  })

  // ─────────────────────────────────────────────────────────
  // StateChange schema
  // ─────────────────────────────────────────────────────────

  it('decodes StateChange', () => {
    const raw = {
      _tag: 'StateChange',
      elementKey: 'slider-1',
      field: 'value',
      previousValue: 0,
      nextValue: 42,
      timestamp: Date.now(),
      source: 'user',
    }

    const result = Schema.decodeUnknownSync(StateChange)(raw)
    expect(result._tag).toBe('StateChange')
    expect(result.field).toBe('value')
    expect(result.nextValue).toBe(42)
  })

  // ─────────────────────────────────────────────────────────
  // Type guard
  // ─────────────────────────────────────────────────────────

  it('hasStateSchema detects interactable elements', () => {
    expect(hasStateSchema({ stateSchema: [{ name: 'x' }] })).toBe(true)
    expect(hasStateSchema({ stateSchema: [] })).toBe(false)
    expect(hasStateSchema({})).toBe(false)
  })
})
