/**
 * Slider V2 Atoms
 *
 * Effect-atom based state management for slider instances.
 */

import { Atom } from '@effect-atom/atom'
import type { SliderState, SliderConfig, SliderEvent, ModifierKeys } from '../types'
import { DEFAULT_MODIFIERS, initialSliderState } from '../types'

// =============================================================================
// SLIDER STATE REDUCER
// =============================================================================

/**
 * Pure reducer for slider state transitions
 */
export function sliderReducer(
  state: SliderState,
  event: SliderEvent,
  config: SliderConfig
): SliderState {
  switch (event.type) {
    case 'DRAG_START':
      return {
        ...state,
        isDragging: true,
        modifiers: event.modifiers,
      }

    case 'DRAG_MOVE': {
      // Clamp value to bounds
      const range = config.max - config.min
      const normalizedPosition = Math.max(0, Math.min(1, event.position))
      const rawValue = config.min + normalizedPosition * range

      // Apply step if configured
      let value = rawValue
      if (config.step && config.step > 0) {
        value = Math.round(rawValue / config.step) * config.step
      }

      // Clamp to bounds
      value = Math.max(config.min, Math.min(config.max, value))
      const normalizedValue = (value - config.min) / range

      return {
        ...state,
        value,
        normalizedValue,
        visualPosition: normalizedPosition, // Visual can extend during overshoot
        modifiers: event.modifiers,
      }
    }

    case 'DRAG_END':
      return {
        ...state,
        isDragging: false,
        modifiers: DEFAULT_MODIFIERS,
      }

    case 'SET_VALUE': {
      const range = config.max - config.min
      const value = Math.max(config.min, Math.min(config.max, event.value))
      const normalizedValue = (value - config.min) / range

      return {
        ...state,
        value,
        normalizedValue,
        visualPosition: normalizedValue,
      }
    }

    case 'ANIMATE_START':
      return {
        ...state,
        isAnimating: true,
      }

    case 'ANIMATE_END':
      return {
        ...state,
        isAnimating: false,
      }

    case 'RESET':
      return initialSliderState(config)

    default:
      return state
  }
}

// =============================================================================
// SLIDER STATE FAMILY
// =============================================================================

/**
 * Create a slider state atom family for multiple slider instances
 */
export function createSliderStateFamily() {
  const family = new Map<string, Atom.Atom<SliderState>>()

  return {
    /**
     * Get or create a slider state atom for the given ID
     */
    get: (sliderId: string, config: SliderConfig): Atom.Atom<SliderState> => {
      let atom = family.get(sliderId)
      if (!atom) {
        atom = Atom.make(initialSliderState(config))
        family.set(sliderId, atom)
      }
      return atom
    },

    /**
     * Clear a slider state from the family
     */
    clear: (sliderId: string): void => {
      family.delete(sliderId)
    },

    /**
     * Clear all slider states
     */
    clearAll: (): void => {
      family.clear()
    },

    /**
     * Get all slider IDs
     */
    ids: (): string[] => Array.from(family.keys()),
  }
}

/**
 * Global slider state family instance
 */
export const sliderStateFamily = createSliderStateFamily()

// =============================================================================
// MODIFIER KEYS HELPERS
// =============================================================================

/**
 * Extract modifier keys from a pointer/keyboard event
 */
export function extractModifiers(
  event: PointerEvent | KeyboardEvent | MouseEvent
): ModifierKeys {
  return {
    shift: event.shiftKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    meta: event.metaKey,
  }
}

/**
 * Check if any modifier is active
 */
export function hasActiveModifier(modifiers: ModifierKeys): boolean {
  return modifiers.shift || modifiers.ctrl || modifiers.alt || modifiers.meta
}
