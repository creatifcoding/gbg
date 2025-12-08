/**
 * Slider V2 Component
 *
 * Minimal slider with trait-based composition.
 * Matches V1 visual style but keeps trait injection capability.
 */

import { useEffect } from 'react'
import { TraitProvider, useInject } from '@/lib/traits'
import { cn } from '@/lib/utils'
import { useSlider, type UseSliderOptions } from '../hooks/useSlider'
import type { SliderConfig, GlowSlot, SnapSlot, CurveSlot, OvershootSlot, PrecisionSlot } from '../types'
import { GlowTrait, SnapTrait, CurveTrait, OvershootTrait, PrecisionTrait } from '../traits'

// =============================================================================
// TYPES
// =============================================================================

export interface SliderProps extends UseSliderOptions {
  /** Unique identifier for this slider instance */
  id: string

  /** Slider configuration */
  config: SliderConfig

  /** Optional class name */
  className?: string

  // Trait injections (optional - can also be injected externally)
  glow?: Partial<GlowSlot>
  snap?: Partial<SnapSlot>
  curve?: Partial<CurveSlot>
  overshoot?: Partial<OvershootSlot>
  precision?: Partial<PrecisionSlot>
}

// =============================================================================
// SLIDER DEFAULTS
// =============================================================================

const SLIDER_DEFAULTS = {
  glow: GlowTrait.defaultSlot!,
  snap: SnapTrait.defaultSlot!,
  curve: CurveTrait.defaultSlot!,
  overshoot: OvershootTrait.defaultSlot!,
  precision: PrecisionTrait.defaultSlot!,
}

// =============================================================================
// INNER SLIDER (inside TraitProvider)
// =============================================================================

function SliderInner({
  id,
  config,
  className,
  glow,
  snap,
  curve,
  overshoot,
  precision,
  ...options
}: SliderProps) {
  const { inject } = useInject()

  // Inject trait slots on mount
  useEffect(() => {
    inject(GlowTrait, id, { ...SLIDER_DEFAULTS.glow, ...glow })
    inject(SnapTrait, id, { ...SLIDER_DEFAULTS.snap, ...snap })
    inject(CurveTrait, id, { ...SLIDER_DEFAULTS.curve, ...curve })
    inject(OvershootTrait, id, { ...SLIDER_DEFAULTS.overshoot, ...overshoot })
    inject(PrecisionTrait, id, { ...SLIDER_DEFAULTS.precision, ...precision })
  }, [inject, id, glow, snap, curve, overshoot, precision])

  // Use slider hook
  const slider = useSlider(id, config, options)

  return (
    <div
      data-slider-id={id}
      className={cn(
        'relative select-none touch-none',
        slider.className,
        className
      )}
      style={slider.style}
    >
      {/* Track */}
      <div
        ref={slider.trackRef}
        className={cn(
          'relative h-2 bg-neutral-700 rounded-full cursor-pointer',
          slider.isDragging && 'cursor-grabbing'
        )}
        {...slider.handlers}
      >
        {/* Fill */}
        <div
          ref={slider.fillRef}
          className="absolute inset-y-0 left-0 bg-cyan-500 rounded-full pointer-events-none"
          style={{
            width: `${slider.normalizedValue * 100}%`,
            transition: slider.isDragging ? 'none' : 'width 75ms ease-out',
          }}
        />

        {/* Thumb */}
        <div
          ref={slider.thumbRef}
          className={cn(
            'absolute top-1/2 w-4 h-4 -translate-y-1/2 -translate-x-1/2',
            'bg-white rounded-full shadow-lg pointer-events-none',
            'transition-transform duration-75',
            slider.isDragging && 'scale-125',
            !slider.isDragging && 'scale-100'
          )}
          style={{
            left: `${slider.normalizedValue * 100}%`,
          }}
        />
      </div>
    </div>
  )
}

// =============================================================================
// SLIDER (with TraitProvider wrapper)
// =============================================================================

export function Slider(props: SliderProps) {
  return (
    <TraitProvider>
      <SliderInner {...props} />
    </TraitProvider>
  )
}

export default Slider
