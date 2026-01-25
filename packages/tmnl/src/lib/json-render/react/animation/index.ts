/**
 * @fileoverview Animation module for json-render
 *
 * Provides entrance animations for JSON-driven UI elements.
 *
 * @module json-render/react/animation
 */

// Hook
export { useEntrance, type UseEntranceOptions, type UseEntranceReturn } from './useEntrance'

// Tokens (for customization/debugging)
export {
  DURATION_MS,
  EASING_ANIMEJS,
  PROPERTY_STATES,
  STAGGER_DELAY,
} from './tokens'
