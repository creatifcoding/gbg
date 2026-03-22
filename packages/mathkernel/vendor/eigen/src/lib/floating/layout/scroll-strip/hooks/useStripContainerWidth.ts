/**
 * Container width measurement hook for ScrollStrip.
 *
 * @module floating/layout/scroll-strip/hooks/useStripContainerWidth
 */

import { useEffect, useState, type RefObject } from 'react'

export function useStripContainerWidth(
  containerRef: RefObject<HTMLDivElement | null>,
  initialWidth = 1200,
): number {
  const [containerWidth, setContainerWidth] = useState(initialWidth)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  return containerWidth
}
