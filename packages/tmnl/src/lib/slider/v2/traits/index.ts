/**
 * Slider V2 Traits
 *
 * Atomic traits for CEW-grade slider composition.
 */

// =============================================================================
// TRAIT DEFINITIONS
// =============================================================================

export { GlowTrait } from './GlowTrait'
export { SnapTrait } from './SnapTrait'
export { CurveTrait, normalizedToValue, valueToNormalized } from './CurveTrait'
export { OvershootTrait, calculateOvershootTarget, isAtBoundary } from './OvershootTrait'
export { PrecisionTrait, calculateSensitivity, applyPrecision, handleAltBehavior } from './PrecisionTrait'

// =============================================================================
// ALL SLIDER TRAITS (for useTraits composition)
// =============================================================================

import { GlowTrait } from './GlowTrait'
import { SnapTrait } from './SnapTrait'
import { CurveTrait } from './CurveTrait'
import { OvershootTrait } from './OvershootTrait'
import { PrecisionTrait } from './PrecisionTrait'

/**
 * All slider traits in composition order
 */
export const SLIDER_TRAITS = [
  GlowTrait,
  SnapTrait,
  CurveTrait,
  OvershootTrait,
  PrecisionTrait,
] as const

/**
 * Trait IDs for lookup
 */
export const SLIDER_TRAIT_IDS = {
  glow: GlowTrait.id,
  snap: SnapTrait.id,
  curve: CurveTrait.id,
  overshoot: OvershootTrait.id,
  precision: PrecisionTrait.id,
} as const
