/**
 * Focus-driven spring scrolling for ScrollStrip.
 *
 * @module floating/layout/scroll-strip/hooks/useStripFocusScroll
 */

import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'

export interface UseStripFocusScrollOptions {
  containerRef: RefObject<HTMLDivElement | null>
  virtuosoRef: RefObject<VirtuosoHandle | null>
  focusedIndex: number
  getColumnWidth: (index: number) => number
}

export interface UseStripFocusScrollResult {
  springRef: MutableRefObject<number>
}

export function useStripFocusScroll({
  containerRef,
  virtuosoRef,
  focusedIndex,
  getColumnWidth,
}: UseStripFocusScrollOptions): UseStripFocusScrollResult {
  const springRef = useRef(0)

  const scrollToFocused = useCallback(
    (index: number) => {
      if (index < 0) return

      if (springRef.current) cancelAnimationFrame(springRef.current)

      const scroller = containerRef.current?.querySelector(
        '[data-scroll-strip-scroller]',
      ) as HTMLElement | null

      if (!scroller) {
        virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' })
        return
      }

      let targetLeft = 0
      for (let i = 0; i < index; i++) targetLeft += getColumnWidth(i)
      const colWidth = getColumnWidth(index)
      const viewportWidth = scroller.clientWidth
      targetLeft = targetLeft + colWidth / 2 - viewportWidth / 2
      targetLeft = Math.max(0, Math.min(targetLeft, scroller.scrollWidth - viewportWidth))

      const stiffness = 300
      const damping = 28
      let velocity = 0
      let current = scroller.scrollLeft
      const target = targetLeft

      function tick() {
        const displacement = current - target
        const springForce = -stiffness * displacement
        const dampingForce = -damping * velocity
        velocity += (springForce + dampingForce) * (1 / 60)
        current += velocity * (1 / 60)

        scroller.scrollLeft = current

        if (Math.abs(displacement) < 0.5 && Math.abs(velocity) < 0.5) {
          scroller.scrollLeft = target
          return
        }

        springRef.current = requestAnimationFrame(tick)
      }

      springRef.current = requestAnimationFrame(tick)
    },
    [containerRef, getColumnWidth, virtuosoRef],
  )

  useEffect(
    () => () => {
      if (springRef.current) cancelAnimationFrame(springRef.current)
    },
    [],
  )

  useEffect(() => {
    scrollToFocused(focusedIndex)
  }, [focusedIndex, scrollToFocused])

  return { springRef }
}
