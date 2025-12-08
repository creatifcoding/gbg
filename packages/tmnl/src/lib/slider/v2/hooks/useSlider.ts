/**
 * useSlider Hook
 *
 * Primary hook for slider v2 - integrates traits, state, and Effect programs.
 */

import {
  useCallback,
  useRef,
  useMemo,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Effect } from 'effect'
import { useAtom } from '@effect-atom/atom-react'
import { useTraits } from '@/lib/traits'

import type { SliderConfig, SliderState, GlowSlot, OvershootSlot, PrecisionSlot, CurveSlot, SnapSlot } from '../types'
import { SLIDER_TRAITS } from '../traits'
import { sliderStateFamily, sliderReducer, extractModifiers } from '../atoms'
import { normalizedToValue, valueToNormalized } from '../traits/CurveTrait'
import { calculateSensitivity, applyPrecision, handleAltBehavior } from '../traits/PrecisionTrait'
import { isAtBoundary, calculateOvershootTarget } from '../traits/OvershootTrait'
import {
  createThumbSettleEffect,
  createOvershootEffect,
  createBoundaryEmanationEffect,
} from '../effects'

// =============================================================================
// TYPES
// =============================================================================

export interface UseSliderOptions {
  /** Initial value (defaults to config.min) */
  initialValue?: number

  /** Callback when value changes */
  onChange?: (value: number) => void

  /** Callback when drag starts */
  onDragStart?: () => void

  /** Callback when drag ends */
  onDragEnd?: (value: number) => void

  /** Disable interaction */
  disabled?: boolean
}

export interface UseSliderReturn {
  // State
  value: number
  normalizedValue: number
  isDragging: boolean
  isAnimating: boolean

  // Refs
  trackRef: RefObject<HTMLDivElement>
  thumbRef: RefObject<HTMLDivElement>
  fillRef: RefObject<HTMLDivElement>

  // Trait outputs
  style: React.CSSProperties
  className: string
  rendered: React.ReactNode

  // Handlers
  handlers: {
    onPointerDown: (e: ReactPointerEvent) => void
  }

  // Direct control
  setValue: (value: number) => void
  reset: () => void
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useSlider(
  sliderId: string,
  config: SliderConfig,
  options: UseSliderOptions = {}
): UseSliderReturn {
  const { onChange, onDragStart, onDragEnd, disabled = false } = options

  // Refs for DOM elements
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)

  // Get slider state atom
  const stateAtom = useMemo(
    () => sliderStateFamily.get(sliderId, config),
    [sliderId, config]
  )
  const [state, setState] = useAtom(stateAtom)

  // Consume all slider traits
  const { traits, style, className, rendered } = useTraits(SLIDER_TRAITS, sliderId)

  // Extract trait slots with defaults
  const glowSlot = (traits['slider-glow']?.slot ?? SLIDER_TRAITS[0].defaultSlot) as GlowSlot
  const snapSlot = (traits['slider-snap']?.slot ?? SLIDER_TRAITS[1].defaultSlot) as SnapSlot
  const curveSlot = (traits['slider-curve']?.slot ?? SLIDER_TRAITS[2].defaultSlot) as CurveSlot
  const overshootSlot = (traits['slider-overshoot']?.slot ?? SLIDER_TRAITS[3].defaultSlot) as OvershootSlot
  const precisionSlot = (traits['slider-precision']?.slot ?? SLIDER_TRAITS[4].defaultSlot) as PrecisionSlot

  // ==========================================================================
  // EFFECT RUNNERS
  // ==========================================================================

  const runEffect = useCallback(<A, E>(effect: Effect.Effect<A, E>) => {
    Effect.runPromise(effect).catch(console.error)
  }, [])

  // ==========================================================================
  // VALUE COMPUTATIONS
  // ==========================================================================

  const computeValueFromPosition = useCallback(
    (position: number, modifiers: { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean }) => {
      // Apply precision modifiers
      const sensitivity = calculateSensitivity(precisionSlot, modifiers)

      // Apply curve transformation
      const value = normalizedToValue(position, config.min, config.max, curveSlot)

      return value
    },
    [config, curveSlot, precisionSlot]
  )

  // ==========================================================================
  // DRAG HANDLERS
  // ==========================================================================

  const handleDragStart = useCallback(
    (e: ReactPointerEvent) => {
      if (disabled || !trackRef.current) return

      e.preventDefault()
      e.stopPropagation()

      const track = trackRef.current
      const rect = track.getBoundingClientRect()
      const position = (e.clientX - rect.left) / rect.width
      const modifiers = extractModifiers(e.nativeEvent)

      // Update state
      setState((prev) => sliderReducer(prev, { type: 'DRAG_START', position, modifiers }, config))
      setState((prev) => sliderReducer(prev, { type: 'DRAG_MOVE', position, modifiers }, config))

      onDragStart?.()

      // Capture pointer for drag
      track.setPointerCapture(e.pointerId)

      const handleMove = (moveEvent: PointerEvent) => {
        const moveRect = track.getBoundingClientRect()
        const movePosition = Math.max(0, Math.min(1, (moveEvent.clientX - moveRect.left) / moveRect.width))
        const moveModifiers = extractModifiers(moveEvent)

        setState((prev) => {
          const next = sliderReducer(prev, { type: 'DRAG_MOVE', position: movePosition, modifiers: moveModifiers }, config)
          if (next.value !== prev.value) {
            onChange?.(next.value)
          }
          return next
        })
      }

      const handleEnd = () => {
        track.removeEventListener('pointermove', handleMove)
        track.removeEventListener('pointerup', handleEnd)
        track.removeEventListener('pointercancel', handleEnd)

        setState((prev) => {
          const next = sliderReducer(prev, { type: 'DRAG_END' }, config)

          // Check for boundary hit
          const boundary = isAtBoundary(next.normalizedValue)

          if (boundary && overshootSlot.enabled && thumbRef.current) {
            // Trigger overshoot animation
            const trackWidth = trackRef.current?.getBoundingClientRect().width ?? 200
            const boundaryPos = boundary === 'min' ? 0 : trackWidth
            const overshootTarget = calculateOvershootTarget(
              next.normalizedValue,
              boundary === 'min' ? 0 : 1,
              overshootSlot.extent
            ) * trackWidth

            runEffect(
              Effect.all([
                createOvershootEffect(
                  thumbRef.current,
                  boundaryPos,
                  overshootTarget,
                  overshootSlot.settleMs
                ),
                glowSlot.emanateOnBoundary && trackRef.current
                  ? createBoundaryEmanationEffect(trackRef.current, boundary, glowSlot.color)
                  : Effect.void,
              ], { concurrency: 'unbounded' })
            )
          } else if (thumbRef.current) {
            // Normal settle animation
            const trackWidth = trackRef.current?.getBoundingClientRect().width ?? 200
            const targetX = next.normalizedValue * trackWidth

            runEffect(createThumbSettleEffect(thumbRef.current, targetX, overshootSlot.settleMs))
          }

          onDragEnd?.(next.value)
          return next
        })
      }

      track.addEventListener('pointermove', handleMove)
      track.addEventListener('pointerup', handleEnd)
      track.addEventListener('pointercancel', handleEnd)
    },
    [disabled, config, setState, onChange, onDragStart, onDragEnd, overshootSlot, glowSlot, runEffect]
  )

  // ==========================================================================
  // DIRECT CONTROL
  // ==========================================================================

  const setValue = useCallback(
    (value: number) => {
      setState((prev) => {
        const next = sliderReducer(prev, { type: 'SET_VALUE', value }, config)
        if (next.value !== prev.value) {
          onChange?.(next.value)
        }
        return next
      })
    },
    [setState, config, onChange]
  )

  const reset = useCallback(() => {
    setState((prev) => sliderReducer(prev, { type: 'RESET' }, config))
  }, [setState, config])

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // State
    value: state.value,
    normalizedValue: state.normalizedValue,
    isDragging: state.isDragging,
    isAnimating: state.isAnimating,

    // Refs
    trackRef: trackRef as RefObject<HTMLDivElement>,
    thumbRef: thumbRef as RefObject<HTMLDivElement>,
    fillRef: fillRef as RefObject<HTMLDivElement>,

    // Trait outputs
    style,
    className,
    rendered,

    // Handlers
    handlers: {
      onPointerDown: handleDragStart,
    },

    // Direct control
    setValue,
    reset,
  }
}
