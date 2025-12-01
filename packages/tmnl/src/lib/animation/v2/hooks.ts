/**
 * Animation Library v2 - React Hooks
 *
 * Clean React integration with proper cleanup.
 */

import { useEffect, useCallback, useMemo } from 'react'
import { useAtomValue, Registry } from '@effect-atom/atom-react'
import type { AnimationValue, AnimationState, AnimateToOptions, UseAnimationResult } from './types'
import type { AnimationAtom } from './atom'

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * React hook for using an animation atom.
 *
 * Provides the current value, state, progress, and action functions.
 * Properly handles cleanup on unmount.
 *
 * @example
 * ```tsx
 * const opacityAnimation = createAnimation(1)
 *
 * function MyComponent() {
 *   const { value, state, to, snap, pause, resume, cancel } = useAnimation(opacityAnimation)
 *
 *   return (
 *     <div style={{ opacity: value }}>
 *       <button onClick={() => to(0)}>Fade Out</button>
 *       <button onClick={() => to(1)}>Fade In</button>
 *       <button onClick={() => snap(0.5)}>Snap to 50%</button>
 *       {state === 'running' && <button onClick={pause}>Pause</button>}
 *       {state === 'paused' && <button onClick={resume}>Resume</button>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAnimation<T extends AnimationValue>(
  atom: AnimationAtom<T>
): UseAnimationResult<T> {
  // Subscribe to the atoms
  const value = useAtomValue(atom.value$)
  const state = useAtomValue(atom.state$) as AnimationState
  const progress = useAtomValue(atom.progress$)

  // Memoize action callbacks
  const to = useCallback(
    (target: T, options?: AnimateToOptions) => atom.to(target, options),
    [atom]
  )

  const snap = useCallback((newValue: T) => atom.snap(newValue), [atom])

  const pause = useCallback(() => atom.pause(), [atom])

  const resume = useCallback(() => atom.resume(), [atom])

  const cancel = useCallback(() => atom.cancel(), [atom])

  // Cleanup on unmount - cancel any running animation
  useEffect(() => {
    return () => {
      atom.cancel()
    }
  }, [atom])

  return useMemo(
    () => ({
      value,
      state,
      progress,
      to,
      snap,
      pause,
      resume,
      cancel,
    }),
    [value, state, progress, to, snap, pause, resume, cancel]
  )
}

// =============================================================================
// VALUE-ONLY HOOK
// =============================================================================

/**
 * Hook that only subscribes to the value, not state/progress.
 *
 * Use this when you only need the animated value for rendering.
 * Slightly more efficient than the full useAnimation hook.
 */
export function useAnimationValue<T extends AnimationValue>(
  atom: AnimationAtom<T>
): T {
  return useAtomValue(atom.value$)
}

// =============================================================================
// STATE-ONLY HOOK
// =============================================================================

/**
 * Hook that only subscribes to the animation state.
 *
 * Use this when you need to show loading indicators or
 * conditionally render based on animation state.
 */
export function useAnimationState<T extends AnimationValue>(
  atom: AnimationAtom<T>
): AnimationState {
  return useAtomValue(atom.state$) as AnimationState
}

// =============================================================================
// PROGRESS-ONLY HOOK
// =============================================================================

/**
 * Hook that only subscribes to the animation progress.
 *
 * Use this for progress bars or other progress indicators.
 */
export function useAnimationProgress<T extends AnimationValue>(
  atom: AnimationAtom<T>
): number {
  return useAtomValue(atom.progress$)
}

// =============================================================================
// IMPERATIVE HANDLE HOOK
// =============================================================================

/**
 * Hook that returns only the action functions, no value subscription.
 *
 * Use this when you need to trigger animations from a component
 * that doesn't need to read the animated value.
 *
 * @example
 * ```tsx
 * function ControlPanel() {
 *   const controls = useAnimationControls(someAnimation)
 *
 *   return (
 *     <>
 *       <button onClick={() => controls.to(100)}>Animate to 100</button>
 *       <button onClick={controls.cancel}>Cancel</button>
 *     </>
 *   )
 * }
 * ```
 */
export function useAnimationControls<T extends AnimationValue>(
  atom: AnimationAtom<T>
): {
  to: (target: T, options?: AnimateToOptions) => void
  snap: (value: T) => void
  pause: () => void
  resume: () => void
  cancel: () => void
} {
  const to = useCallback(
    (target: T, options?: AnimateToOptions) => atom.to(target, options),
    [atom]
  )

  const snap = useCallback((value: T) => atom.snap(value), [atom])

  const pause = useCallback(() => atom.pause(), [atom])

  const resume = useCallback(() => atom.resume(), [atom])

  const cancel = useCallback(() => atom.cancel(), [atom])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      atom.cancel()
    }
  }, [atom])

  return useMemo(
    () => ({ to, snap, pause, resume, cancel }),
    [to, snap, pause, resume, cancel]
  )
}
