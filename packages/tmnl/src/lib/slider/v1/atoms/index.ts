/**
 * Slider Atoms
 *
 * Effect-atom based state management for the slider system.
 * Each slider instance gets its own runtime with swappable behavior.
 */

import { Atom } from '@effect-atom/atom-react'
import { Effect, Layer } from 'effect'
import {
  SliderBehavior,
  LinearBehavior,
  LogarithmicBehavior,
  DecibelBehavior,
  ExponentialBehavior,
} from '../services/SliderBehavior'
import type {
  SliderState,
  SliderConfig,
  SliderEvent,
  SliderDebugInfo,
  ModifierKeys,
  SliderBehaviorShape,
} from '../types'
import { DEFAULT_SLIDER_CONFIG, DEFAULT_MODIFIERS, initialSliderState } from '../types'

// =============================================================================
// SLIDER RUNTIME FACTORY
// =============================================================================

/**
 * Creates a slider runtime with the specified behavior layer.
 * This runtime provides the SliderBehavior service to all slider atoms.
 */
export const createSliderRuntime = (behaviorLayer: Layer.Layer<SliderBehavior>) =>
  Atom.runtime(behaviorLayer)

// Pre-configured runtimes for common use cases
export const linearSliderRuntime = createSliderRuntime(LinearBehavior.Default)
export const logSliderRuntime = createSliderRuntime(LogarithmicBehavior.Default)
export const decibelSliderRuntime = createSliderRuntime(DecibelBehavior.Default)
export const exponentialSliderRuntime = createSliderRuntime(ExponentialBehavior.Default)

// =============================================================================
// SLIDER STATE ATOM FACTORY
// =============================================================================

/**
 * Creates a family of slider state atoms keyed by slider ID.
 * Each slider maintains its own independent state.
 */
export const createSliderStateFamily = (defaultConfig: SliderConfig = DEFAULT_SLIDER_CONFIG) =>
  Atom.family((id: string) =>
    Atom.make(initialSliderState(defaultConfig.defaultValue, defaultConfig.min, defaultConfig.max)).pipe(
      Atom.keepAlive
    )
  )

// Global slider state family (for simple use cases)
export const sliderStateFamily = createSliderStateFamily()

// =============================================================================
// BEHAVIOR SWITCHER ATOM
// =============================================================================

export type BehaviorPreset = 'linear' | 'logarithmic' | 'decibel' | 'exponential'

/**
 * Atom that tracks which behavior preset is active.
 * Can be used to dynamically switch behaviors at runtime.
 */
export const createBehaviorSwitcher = (initialPreset: BehaviorPreset = 'linear') => {
  const presetAtom = Atom.make(initialPreset).pipe(Atom.keepAlive)

  const behaviorLayerAtom = Atom.readable((get) => {
    const preset = get(presetAtom)
    switch (preset) {
      case 'linear':
        return LinearBehavior.Default
      case 'logarithmic':
        return LogarithmicBehavior.Default
      case 'decibel':
        return DecibelBehavior.Default
      case 'exponential':
        return ExponentialBehavior.Default
      default:
        return LinearBehavior.Default
    }
  })

  return { presetAtom, behaviorLayerAtom }
}

// =============================================================================
// SLIDER EVENT REDUCER
// =============================================================================

/**
 * Pure reducer for slider state transitions.
 * Used by the useSlider hook to process events.
 */
export const sliderReducer = (
  state: SliderState,
  event: SliderEvent,
  config: SliderConfig,
  behavior: SliderBehaviorShape
): SliderState => {
  switch (event.type) {
    case 'SET_VALUE': {
      const snapped = behavior.snap(event.value, config.step, config.min, config.max)
      return {
        ...state,
        value: snapped,
        normalizedValue: behavior.normalize(snapped, config.min, config.max),
      }
    }

    case 'SET_NORMALIZED': {
      const raw = behavior.denormalize(event.normalized, config.min, config.max)
      const snapped = behavior.snap(raw, config.step, config.min, config.max)
      return {
        ...state,
        value: snapped,
        normalizedValue: behavior.normalize(snapped, config.min, config.max),
      }
    }

    case 'INCREMENT': {
      const amount = event.amount ?? config.step ?? (config.max - config.min) / 100
      const newValue = state.value + amount * state.activeSensitivity
      const snapped = behavior.snap(newValue, config.step, config.min, config.max)
      return {
        ...state,
        value: snapped,
        normalizedValue: behavior.normalize(snapped, config.min, config.max),
      }
    }

    case 'DECREMENT': {
      const amount = event.amount ?? config.step ?? (config.max - config.min) / 100
      const newValue = state.value - amount * state.activeSensitivity
      const snapped = behavior.snap(newValue, config.step, config.min, config.max)
      return {
        ...state,
        value: snapped,
        normalizedValue: behavior.normalize(snapped, config.min, config.max),
      }
    }

    case 'RESET':
      return {
        ...state,
        value: config.defaultValue,
        normalizedValue: behavior.normalize(config.defaultValue, config.min, config.max),
      }

    case 'DRAG_START':
      return {
        ...state,
        isDragging: true,
        dragStartValue: state.value,
        dragStartX: event.x,
        dragStartY: event.y,
      }

    case 'DRAG_MOVE': {
      if (!state.isDragging || state.dragStartValue === null) return state

      // Calculate delta based on orientation
      const isVertical = config.orientation === 'vertical'
      const delta = isVertical
        ? (state.dragStartY! - event.y) // Invert Y for vertical (up = increase)
        : event.x - state.dragStartX!

      // Apply sensitivity
      const sensitivity = state.activeSensitivity
      const range = config.max - config.min
      const pixelsPerUnit = 200 // Pixels to drag for full range
      const valueDelta = (delta / pixelsPerUnit) * range * sensitivity

      const newValue = state.dragStartValue + valueDelta
      const snapped = state.modifiers.alt
        ? behavior.snap(newValue, config.step ?? (range / 10), config.min, config.max)
        : behavior.snap(newValue, config.step, config.min, config.max)

      return {
        ...state,
        value: snapped,
        normalizedValue: behavior.normalize(snapped, config.min, config.max),
      }
    }

    case 'DRAG_END':
      return {
        ...state,
        isDragging: false,
        dragStartValue: null,
        dragStartX: null,
        dragStartY: null,
      }

    case 'FOCUS':
      return { ...state, isFocused: true }

    case 'BLUR':
      return { ...state, isFocused: false, isEditing: false }

    case 'HOVER_START':
      return { ...state, isHovered: true }

    case 'HOVER_END':
      return { ...state, isHovered: false }

    case 'EDIT_START':
      return { ...state, isEditing: true }

    case 'EDIT_END': {
      if (event.value !== undefined) {
        const snapped = behavior.snap(event.value, config.step, config.min, config.max)
        return {
          ...state,
          isEditing: false,
          value: snapped,
          normalizedValue: behavior.normalize(snapped, config.min, config.max),
        }
      }
      return { ...state, isEditing: false }
    }

    case 'MODIFIER_CHANGE': {
      const newModifiers: ModifierKeys = {
        ...state.modifiers,
        ...event.modifiers,
      }
      const newSensitivity = behavior.getSensitivity(newModifiers, config)
      return {
        ...state,
        modifiers: newModifiers,
        activeSensitivity: newSensitivity,
      }
    }

    default:
      return state
  }
}

// =============================================================================
// DEBUG INFO ATOM
// =============================================================================

/**
 * Creates an atom that derives debug info from slider state.
 */
export const createDebugInfoAtom = (
  stateAtom: Atom.Atom<SliderState>,
  config: SliderConfig,
  behavior: SliderBehaviorShape
) =>
  Atom.readable((get): SliderDebugInfo => {
    const state = get(stateAtom)

    const activeModifiers: string[] = []
    if (state.modifiers.shift) activeModifiers.push('Shift')
    if (state.modifiers.ctrl) activeModifiers.push('Ctrl')
    if (state.modifiers.alt) activeModifiers.push('Alt')
    if (state.modifiers.meta) activeModifiers.push('Meta')

    return {
      behaviorId: behavior.id,
      behaviorName: behavior.name,
      rawValue: state.value,
      normalizedValue: state.normalizedValue,
      displayValue: behavior.format(state.value, config.precision, config.unit),
      min: config.min,
      max: config.max,
      step: config.step,
      isDragging: state.isDragging,
      isFocused: state.isFocused,
      isEditing: state.isEditing,
      baseSensitivity: config.baseSensitivity,
      activeSensitivity: state.activeSensitivity,
      activeModifiers,
      lastUpdateMs: Date.now(),
    }
  })
