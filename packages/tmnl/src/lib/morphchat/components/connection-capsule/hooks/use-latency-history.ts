/**
 * Ring buffer of the last N latency readings.
 * Pushes new readings on change, shifts when full.
 *
 * @module connection-capsule/hooks/use-latency-history
 */

import * as React from 'react'
import { RING_SIZE } from '../constants'

export function useLatencyHistory(latencyMs: number | undefined): readonly number[] {
  const historyRef = React.useRef<number[]>([])

  React.useEffect(() => {
    if (latencyMs != null && latencyMs > 0) {
      const h = historyRef.current
      h.push(latencyMs)
      if (h.length > RING_SIZE) h.shift()
    }
  }, [latencyMs])

  return historyRef.current
}
