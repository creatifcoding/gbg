/**
 * Alt/middle-button panning for ScrollStrip.
 *
 * @module floating/layout/scroll-strip/hooks/useStripPanDrag
 */

import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react'

export function useStripPanDrag(
  containerRef: RefObject<HTMLDivElement | null>,
  springRef: MutableRefObject<number>,
): void {
  const panRef = useRef<{ active: boolean; startX: number; startScroll: number }>({
    active: false,
    startX: 0,
    startScroll: 0,
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const scroller = el.querySelector('[data-scroll-strip-scroller]') as HTMLElement | null
    if (!scroller) return

    const onDown = (e: PointerEvent) => {
      if ((e.altKey && e.button === 0) || e.button === 1) {
        e.preventDefault()
        if (springRef.current) cancelAnimationFrame(springRef.current)
        panRef.current = {
          active: true,
          startX: e.clientX,
          startScroll: scroller.scrollLeft,
        }
        scroller.setPointerCapture(e.pointerId)
        scroller.style.cursor = 'grabbing'
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!panRef.current.active) return
      const dx = e.clientX - panRef.current.startX
      scroller.scrollLeft = panRef.current.startScroll - dx
    }

    const onUp = (e: PointerEvent) => {
      if (!panRef.current.active) return
      panRef.current.active = false
      scroller.releasePointerCapture(e.pointerId)
      scroller.style.cursor = ''
    }

    scroller.addEventListener('pointerdown', onDown)
    scroller.addEventListener('pointermove', onMove)
    scroller.addEventListener('pointerup', onUp)
    scroller.addEventListener('pointercancel', onUp)

    return () => {
      scroller.removeEventListener('pointerdown', onDown)
      scroller.removeEventListener('pointermove', onMove)
      scroller.removeEventListener('pointerup', onUp)
      scroller.removeEventListener('pointercancel', onUp)
    }
  }, [containerRef, springRef])
}
