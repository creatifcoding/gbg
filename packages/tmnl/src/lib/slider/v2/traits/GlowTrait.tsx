/**
 * GlowTrait
 *
 * Minimal accent color provider via CSS custom properties.
 * No visual glow effects - just sets --slider-accent-color for subtle thumb tinting.
 */

import type { CSSProperties } from 'react'
import { createTrait } from '@/lib/traits'
import type { GlowSlot } from '../types'
import { GLOW_COLORS } from '../types'

// =============================================================================
// TRAIT DEFINITION
// =============================================================================

export const GlowTrait = createTrait<GlowSlot>({
  id: 'slider-glow',

  // No visual rendering - just CSS properties
  render: () => null,

  style: (slot): CSSProperties => {
    const accentColor = GLOW_COLORS[slot.color]

    return {
      '--slider-accent-color': accentColor,
    } as CSSProperties
  },

  className: () => '',

  defaultSlot: {
    color: 'cyan',
    intensity: 'normal',
    emanateOnSnap: false,
    emanateOnBoundary: true,
  },
})

export default GlowTrait
