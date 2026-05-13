/**
 * Session uptime counter.
 *
 * Tracks timestamp when connection enters 'connected' phase.
 * Updates every 30s. Clears on disconnect.
 * Format: <60s → "Xs", <60m → "Xm", else "Xh Xm".
 *
 * @module connection-capsule/hooks/use-uptime
 */

import * as React from 'react'
import type { ConnectionPhase } from '../../../schemas/message-types'

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function useUptime(phase: ConnectionPhase): string | null {
  const connectedAtRef = React.useRef<number | null>(null)
  const [uptime, setUptime] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (phase === 'connected') {
      if (connectedAtRef.current == null) connectedAtRef.current = Date.now()
      const tick = () => setUptime(formatUptime(Date.now() - connectedAtRef.current!))
      tick()
      const id = setInterval(tick, 30_000)
      return () => clearInterval(id)
    } else {
      connectedAtRef.current = null
      setUptime(null)
    }
  }, [phase])

  return uptime
}
