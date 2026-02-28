/**
 * Swipe-to-dismiss gesture hook — Sonner-grade pointer capture.
 *
 * Rightward swipe: free tracking.
 * Leftward swipe: rubber-band damping.
 * Dismiss on distance OR velocity threshold.
 *
 * @module morphchat/components/status-banner/hooks/use-swipe
 */

import { useState, useCallback, useRef, type PointerEvent as RPointerEvent } from 'react'
import { SWIPE_THRESHOLD, VELOCITY_THRESHOLD, DRAG_DAMPING } from '../constants'

export interface SwipeState {
  swipeX: number
  swiping: boolean
  swipedOut: boolean
  /** Opacity fades proportionally to swipe distance */
  opacity: number
  /** Blur bridge during exit — masks imperfections */
  blur: number
  handlePointerDown: (e: RPointerEvent) => void
  handlePointerMove: (e: RPointerEvent) => void
  handlePointerUp: (e: RPointerEvent) => void
}

export function useSwipe(onDismiss: () => void): SwipeState {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null)
  const [swipeX, setSwipeX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [swipedOut, setSwipedOut] = useState(false)

  const handlePointerDown = useCallback((e: RPointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId)
    startRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    setSwiping(true)
  }, [])

  const handlePointerMove = useCallback((e: RPointerEvent) => {
    if (!startRef.current || !swiping) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 10) return
    setSwipeX(dx >= 0 ? dx : dx * DRAG_DAMPING)
  }, [swiping])

  const handlePointerUp = useCallback((e: RPointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId)
    if (!startRef.current || !swiping) {
      setSwiping(false)
      return
    }
    const dx = e.clientX - startRef.current.x
    const dt = performance.now() - startRef.current.t
    const velocity = Math.abs(dx) / dt

    if (dx > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      setSwipedOut(true)
      setTimeout(onDismiss, 200)
    } else {
      setSwipeX(0)
    }
    setSwiping(false)
    startRef.current = null
  }, [swiping, onDismiss])

  const opacity = swipedOut ? 0 : swiping ? Math.max(0, 1 - Math.abs(swipeX) / 200) : 1
  const blur = swipedOut ? 2 : swiping ? Math.min(2, Math.abs(swipeX) / 80) : 0

  return { swipeX, swiping, swipedOut, opacity, blur, handlePointerDown, handlePointerMove, handlePointerUp }
}
