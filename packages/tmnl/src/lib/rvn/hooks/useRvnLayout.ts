/**
 * useRvnLayout
 *
 * FLIP layout animation hook using anime.js createLayout.
 * Enables smooth transitions when DOM elements change position or size.
 *
 * @example Basic usage
 * ```tsx
 * function SortableList({ items }) {
 *   const { rootRef, update } = useRvnLayout()
 *
 *   const handleSort = () => {
 *     update(() => {
 *       // DOM mutation happens here
 *       items.sort((a, b) => a.name.localeCompare(b.name))
 *     })
 *   }
 *
 *   return (
 *     <div ref={rootRef}>
 *       {items.map(item => <div key={item.id}>{item.name}</div>)}
 *     </div>
 *   )
 * }
 * ```
 *
 * @example Grid/List toggle
 * ```tsx
 * function LayoutToggle() {
 *   const { rootRef, update, isReady } = useRvnLayout({
 *     duration: 400,
 *     ease: 'outCubic',
 *   })
 *   const [isGrid, setIsGrid] = useState(false)
 *
 *   const toggle = () => {
 *     update(() => setIsGrid(!isGrid))
 *   }
 *
 *   return (
 *     <div ref={rootRef} className={isGrid ? 'grid' : 'list'}>
 *       {children}
 *     </div>
 *   )
 * }
 * ```
 */

import { useRef, useLayoutEffect, useState, useCallback } from 'react'
import {
  createLayout,
  type AutoLayout,
  type AutoLayoutParams,
  type LayoutAnimationParams,
  type Timeline,
} from 'animejs'

export interface UseRvnLayoutOptions extends AutoLayoutParams {
  /** Default animation duration in ms */
  duration?: number
  /** Default easing function */
  ease?: string
  /** Callback when layout animation completes */
  onComplete?: () => void
  /** Callback when entering elements animate */
  onEnter?: () => void
  /** Callback when leaving elements animate */
  onLeave?: () => void
}

export interface UseRvnLayoutResult {
  /** Ref to attach to the layout root element */
  rootRef: React.RefObject<HTMLDivElement | null>
  /** Whether the layout instance is initialized */
  isReady: boolean
  /** Record current positions (call before DOM changes) */
  record: () => AutoLayout | undefined
  /** Animate to new positions (call after DOM changes) */
  animate: (params?: LayoutAnimationParams) => Timeline | undefined
  /** Record, mutate, then animate in one call */
  update: (
    callback: (layout: AutoLayout) => void,
    params?: LayoutAnimationParams
  ) => Timeline | undefined
  /** Revert layout to initial state */
  revert: () => void
  /** Access the raw AutoLayout instance */
  layout: AutoLayout | null
}

/**
 * Hook for FLIP-based layout animations.
 *
 * Uses anime.js AutoLayout to animate between layout states.
 * Automatically handles:
 * - Position changes (translateX/Y)
 * - Size changes (width/height)
 * - New elements entering
 * - Elements being removed
 *
 * @param params - Layout configuration options
 * @returns Layout controls and root ref
 */
export function useRvnLayout(params: UseRvnLayoutOptions = {}): UseRvnLayoutResult {
  const {
    duration = 350,
    ease = 'outCubic',
    onComplete,
    onEnter,
    onLeave,
    ...layoutParams
  } = params

  const rootRef = useRef<HTMLDivElement | null>(null)
  const layoutRef = useRef<AutoLayout | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Initialize layout on mount
  useLayoutEffect(() => {
    if (!rootRef.current) return

    const layoutConfig: AutoLayoutParams = {
      duration,
      ease,
      ...layoutParams,
    }

    // Add callbacks
    if (onComplete) {
      layoutConfig.onComplete = onComplete
    }

    layoutRef.current = createLayout(rootRef.current, layoutConfig)
    setIsReady(true)

    // Cleanup on unmount
    return () => {
      if (layoutRef.current) {
        layoutRef.current.revert()
        layoutRef.current = null
      }
      setIsReady(false)
    }
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Record current positions before DOM changes.
   * Call this before making any DOM mutations.
   */
  const record = useCallback(() => {
    return layoutRef.current?.record()
  }, [])

  /**
   * Animate from recorded positions to current positions.
   * Call this after DOM mutations are complete.
   */
  const animate = useCallback((animateParams?: LayoutAnimationParams) => {
    if (!layoutRef.current) return undefined

    const mergedParams: LayoutAnimationParams = {
      duration,
      ease,
      ...animateParams,
    }

    if (onEnter) {
      mergedParams.enterFrom = {
        opacity: 0,
        scale: 0.9,
        duration: duration * 0.5,
        ...mergedParams.enterFrom,
      }
    }

    if (onLeave) {
      mergedParams.leaveTo = {
        opacity: 0,
        scale: 0.9,
        duration: duration * 0.5,
        ...mergedParams.leaveTo,
      }
    }

    return layoutRef.current.animate(mergedParams)
  }, [duration, ease, onEnter, onLeave])

  /**
   * Combined record + callback + animate in one call.
   * This is the most common usage pattern.
   */
  const update = useCallback(
    (
      callback: (layout: AutoLayout) => void,
      updateParams?: LayoutAnimationParams
    ) => {
      if (!layoutRef.current) return undefined

      const mergedParams: LayoutAnimationParams = {
        duration,
        ease,
        ...updateParams,
      }

      return layoutRef.current.update(callback, mergedParams)
    },
    [duration, ease]
  )

  /**
   * Revert the layout to its initial state.
   */
  const revert = useCallback(() => {
    layoutRef.current?.revert()
  }, [])

  return {
    rootRef,
    isReady,
    record,
    animate,
    update,
    revert,
    layout: layoutRef.current,
  }
}
