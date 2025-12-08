/**
 * useSlider Hook
 *
 * The primary hook for slider interaction.
 * Manages state, events, and behavior injection.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useAtom, useAtomValue } from '@effect-atom/atom-react'
import { Atom } from '@effect-atom/atom-react'
import type {
  SliderConfig,
  SliderState,
  SliderEvent,
  SliderDebugInfo,
  SliderBehaviorShape,
  ModifierKeys,
} from '../types'
import { DEFAULT_SLIDER_CONFIG, initialSliderState, DEFAULT_MODIFIERS } from '../types'
import { LinearBehavior } from '../services/SliderBehavior'
import { sliderReducer, createDebugInfoAtom } from '../atoms'

// =============================================================================
// HOOK INTERFACE
// =============================================================================

export interface UseSliderOptions {
  /** Initial value */
  value?: number

  /** Controlled value (external state) */
  controlledValue?: number

  /** Callback when value changes */
  onChange?: (value: number) => void

  /** Callback when drag ends */
  onChangeEnd?: (value: number) => void

  /** Configuration overrides */
  config?: Partial<SliderConfig>

  /** Behavior shape (injectable) */
  behavior?: SliderBehaviorShape

  /** Enable debug mode */
  debug?: boolean
}

export interface UseSliderReturn {
  // State
  state: SliderState
  debugInfo: SliderDebugInfo | null

  // Derived values
  value: number
  normalizedValue: number
  displayValue: string

  // Configuration
  config: SliderConfig
  behavior: SliderBehaviorShape

  // Event handlers
  dispatch: (event: SliderEvent) => void

  // Convenience methods
  setValue: (value: number) => void
  setNormalized: (normalized: number) => void
  increment: (amount?: number) => void
  decrement: (amount?: number) => void
  reset: () => void

  // Interaction handlers (for components)
  handlePointerDown: (e: React.PointerEvent) => void
  handlePointerMove: (e: React.PointerEvent) => void
  handlePointerUp: (e: React.PointerEvent) => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  handleWheel: (e: React.WheelEvent) => void
  handleDoubleClick: () => void
  handleFocus: () => void
  handleBlur: () => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void

  // Edit mode
  startEdit: () => void
  endEdit: (value?: number) => void

  // Ref for the slider container (for pointer capture)
  containerRef: React.RefObject<HTMLDivElement>
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useSlider(options: UseSliderOptions = {}): UseSliderReturn {
  const {
    value: initialValue,
    controlledValue,
    onChange,
    onChangeEnd,
    config: configOverrides = {},
    behavior = LinearBehavior.shape,
    debug = false,
  } = options

  // Merge config with defaults
  const config = useMemo<SliderConfig>(
    () => ({ ...DEFAULT_SLIDER_CONFIG, ...configOverrides }),
    [configOverrides]
  )

  // Container ref for pointer capture
  const containerRef = useRef<HTMLDivElement>(null)

  // Create stable state atom
  const stateAtomRef = useRef<Atom.Writable<SliderState, SliderState>>()
  if (!stateAtomRef.current) {
    const startValue = controlledValue ?? initialValue ?? config.defaultValue
    stateAtomRef.current = Atom.make(initialSliderState(startValue, config.min, config.max)).pipe(
      Atom.keepAlive
    )
  }
  const stateAtom = stateAtomRef.current

  // State management
  const [state, setState] = useAtom(stateAtom)

  // Debug info atom (only created if debug mode)
  const debugInfoAtom = useMemo(() => {
    if (!debug) return null
    return createDebugInfoAtom(stateAtom, config, behavior)
  }, [debug, stateAtom, config, behavior])

  const debugInfo = debugInfoAtom ? useAtomValue(debugInfoAtom) : null

  // Sync controlled value
  useEffect(() => {
    if (controlledValue !== undefined && controlledValue !== state.value) {
      const snapped = behavior.snap(controlledValue, config.step, config.min, config.max)
      setState((prev) => ({
        ...prev,
        value: snapped,
        normalizedValue: behavior.normalize(snapped, config.min, config.max),
      }))
    }
  }, [controlledValue, behavior, config, setState])

  // Dispatch function
  const dispatch = useCallback(
    (event: SliderEvent) => {
      setState((prev) => {
        const next = sliderReducer(prev, event, config, behavior)

        // Call onChange if value changed
        if (next.value !== prev.value && onChange) {
          onChange(next.value)
        }

        // Call onChangeEnd for specific events
        if (
          event.type === 'DRAG_END' ||
          event.type === 'EDIT_END' ||
          event.type === 'RESET'
        ) {
          if (onChangeEnd) {
            onChangeEnd(next.value)
          }
        }

        return next
      })
    },
    [setState, config, behavior, onChange, onChangeEnd]
  )

  // Convenience methods
  const setValue = useCallback(
    (value: number) => dispatch({ type: 'SET_VALUE', value }),
    [dispatch]
  )

  const setNormalized = useCallback(
    (normalized: number) => dispatch({ type: 'SET_NORMALIZED', normalized }),
    [dispatch]
  )

  const increment = useCallback(
    (amount?: number) => dispatch({ type: 'INCREMENT', amount }),
    [dispatch]
  )

  const decrement = useCallback(
    (amount?: number) => dispatch({ type: 'DECREMENT', amount }),
    [dispatch]
  )

  const reset = useCallback(() => dispatch({ type: 'RESET' }), [dispatch])

  // Modifier key tracking
  const updateModifiers = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent | React.PointerEvent | React.WheelEvent) => {
      const modifiers: Partial<ModifierKeys> = {
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey,
      }
      dispatch({ type: 'MODIFIER_CHANGE', modifiers })
    },
    [dispatch]
  )

  // Global modifier tracking during drag
  useEffect(() => {
    if (!state.isDragging) return

    const handleKeyDown = (e: KeyboardEvent) => updateModifiers(e)
    const handleKeyUp = (e: KeyboardEvent) => updateModifiers(e)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [state.isDragging, updateModifiers])

  // Pointer handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      updateModifiers(e)
      dispatch({ type: 'DRAG_START', x: e.clientX, y: e.clientY })

      // Capture pointer for drag
      if (containerRef.current) {
        containerRef.current.setPointerCapture(e.pointerId)
      }
    },
    [dispatch, updateModifiers]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!state.isDragging) return
      updateModifiers(e)
      dispatch({ type: 'DRAG_MOVE', x: e.clientX, y: e.clientY })
    },
    [state.isDragging, dispatch, updateModifiers]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!state.isDragging) return

      dispatch({ type: 'DRAG_END' })

      // Release pointer capture
      if (containerRef.current) {
        containerRef.current.releasePointerCapture(e.pointerId)
      }
    },
    [state.isDragging, dispatch]
  )

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!config.keyboardEnabled) return

      updateModifiers(e)

      const step = config.step ?? (config.max - config.min) / 100

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          e.preventDefault()
          increment(step)
          break
        case 'ArrowDown':
        case 'ArrowLeft':
          e.preventDefault()
          decrement(step)
          break
        case 'Home':
          e.preventDefault()
          setValue(config.min)
          break
        case 'End':
          e.preventDefault()
          setValue(config.max)
          break
        case 'Enter':
        case ' ':
          if (state.isEditing) {
            e.preventDefault()
            // Edit end handled by input
          }
          break
        case 'Escape':
          if (state.isEditing) {
            e.preventDefault()
            dispatch({ type: 'EDIT_END' })
          }
          break
      }
    },
    [config, updateModifiers, increment, decrement, setValue, state.isEditing, dispatch]
  )

  // Wheel handler
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!config.wheelEnabled) return
      e.preventDefault()

      updateModifiers(e)

      const step = config.step ?? (config.max - config.min) / 100
      if (e.deltaY < 0) {
        increment(step)
      } else {
        decrement(step)
      }
    },
    [config, updateModifiers, increment, decrement]
  )

  // Double click to reset
  const handleDoubleClick = useCallback(() => {
    if (config.doubleClickReset) {
      reset()
    }
  }, [config.doubleClickReset, reset])

  // Focus/blur handlers
  const handleFocus = useCallback(() => dispatch({ type: 'FOCUS' }), [dispatch])
  const handleBlur = useCallback(() => dispatch({ type: 'BLUR' }), [dispatch])

  // Hover handlers
  const handleMouseEnter = useCallback(() => dispatch({ type: 'HOVER_START' }), [dispatch])
  const handleMouseLeave = useCallback(() => dispatch({ type: 'HOVER_END' }), [dispatch])

  // Edit mode
  const startEdit = useCallback(() => dispatch({ type: 'EDIT_START' }), [dispatch])
  const endEdit = useCallback(
    (value?: number) => dispatch({ type: 'EDIT_END', value }),
    [dispatch]
  )

  // Derived values
  const displayValue = useMemo(
    () => behavior.format(state.value, config.precision, config.unit),
    [behavior, state.value, config.precision, config.unit]
  )

  return {
    state,
    debugInfo,
    value: state.value,
    normalizedValue: state.normalizedValue,
    displayValue,
    config,
    behavior,
    dispatch,
    setValue,
    setNormalized,
    increment,
    decrement,
    reset,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
    handleWheel,
    handleDoubleClick,
    handleFocus,
    handleBlur,
    handleMouseEnter,
    handleMouseLeave,
    startEdit,
    endEdit,
    containerRef,
  }
}
