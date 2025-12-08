/**
 * SnapTrait
 *
 * Magnetism toward discrete values with optional grid visualization.
 * Pure behavioral trait with optional visual output.
 */

import { createTrait } from '@/lib/traits'
import type { SnapSlot } from '../types'

// =============================================================================
// SNAP GRID COMPONENT
// =============================================================================

function SnapGrid({
  steps,
  targetId,
}: {
  steps: SnapSlot['steps']
  targetId: string
}) {
  // Calculate step positions
  const positions = typeof steps === 'string'
    ? generatePresetSteps(steps)
    : steps

  return (
    <div
      data-slider-snap-grid={targetId}
      className="absolute inset-0 pointer-events-none"
    >
      {positions.map((pos, i) => (
        <div
          key={`${targetId}-snap-${i}`}
          className="absolute w-px h-full bg-neutral-600/40"
          style={{
            left: `${pos * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          {/* Tick mark */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-neutral-500 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * Generate normalized positions (0-1) for preset step curves
 */
function generatePresetSteps(preset: 'linear' | 'logarithmic'): number[] {
  if (preset === 'linear') {
    return [0, 0.25, 0.5, 0.75, 1.0]
  }

  if (preset === 'logarithmic') {
    // Log scale markers
    return [0, 0.1, 0.2, 0.4, 0.7, 1.0]
  }

  return [0, 0.5, 1.0]
}

// =============================================================================
// TRAIT DEFINITION
// =============================================================================

export const SnapTrait = createTrait<SnapSlot>({
  id: 'slider-snap',

  render: (slot, targetId) =>
    slot.showGrid ? <SnapGrid steps={slot.steps} targetId={targetId} /> : null,

  // No style - purely behavioral with optional visual

  defaultSlot: {
    steps: 'linear',
    magnetism: 0.3,
    showGrid: false,
    hapticFeedback: false,
  },
})

export default SnapTrait
