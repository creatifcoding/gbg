/**
 * Connection Capsule Atoms
 *
 * Derived atoms from adapter.connection$ — all Tuftian data
 * lives here, not in local hooks. Atom.family keyed by SurfaceId
 * so state survives remounts and is subscribable by other consumers.
 *
 * Pattern: Atom-as-State — Atom.make() is primary, React subscribes directly.
 *
 * @module connection-capsule/atoms
 */

import { Atom } from '@effect-atom/atom'
import { morphChatRegistry } from '../../atoms/registry'
import type { SurfaceId } from '../../atoms/surface-atoms'
import type { ConnectionState } from '../../schemas/message-types'
import type { ViewMode } from './view-modes'
import { RING_SIZE } from './constants'
import { latencyColor, latencyGlow } from './latency-color'

// ─── Latency History (ring buffer) ───────────────────────────────────────────

/**
 * Ring buffer of last N latency readings, keyed by surface.
 * Written by the subscription effect, read by sparkline.
 */
export const latencyHistoryFamily = Atom.family((_surfId: SurfaceId) => {
  const atom = Atom.make<readonly number[]>([])
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * Push a latency reading into the ring buffer.
 * Call from the adapter subscription, not from React render.
 */
export function pushLatencyReading(surfId: SurfaceId, ms: number): void {
  if (ms <= 0) return
  morphChatRegistry.update(latencyHistoryFamily(surfId), prev => {
    const next = [...prev, ms]
    return next.length > RING_SIZE ? next.slice(next.length - RING_SIZE) : next
  })
}

// ─── Smart Dot Color (derived) ───────────────────────────────────────────────

/**
 * Smart dot color — derived from connection$.latencyMs.
 * Returns { color, glow } or null if not connected.
 */
export const smartDotFamily = Atom.family((surfId: SurfaceId) => {
  const atom = Atom.make<{ color: string; glow: string } | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

/**
 * Recompute smart dot from a ConnectionState snapshot.
 * Called by the sync effect whenever connection$ changes.
 */
export function syncSmartDot(surfId: SurfaceId, conn: ConnectionState): void {
  if (conn.phase === 'connected') {
    morphChatRegistry.set(smartDotFamily(surfId), {
      color: latencyColor(conn.latencyMs),
      glow: latencyGlow(conn.latencyMs),
    })
  } else {
    morphChatRegistry.set(smartDotFamily(surfId), null)
  }
}

// ─── Endpoint Shortname (derived) ────────────────────────────────────────────

export const endpointFamily = Atom.family((_surfId: SurfaceId) => {
  const atom = Atom.make<string | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

export function syncEndpoint(surfId: SurfaceId, conn: ConnectionState): void {
  const ep = conn.endpoint
  if (!ep) {
    morphChatRegistry.set(endpointFamily(surfId), null)
    return
  }
  let short: string
  if (ep.startsWith('harness:')) short = 'harness'
  else {
    try { short = new URL(ep).hostname.replace('localhost', 'local') } catch { short = ep.slice(0, 12) }
  }
  morphChatRegistry.set(endpointFamily(surfId), short)
}

// ─── Error Message (derived) ─────────────────────────────────────────────────

export const errorMessageFamily = Atom.family((_surfId: SurfaceId) => {
  const atom = Atom.make<string | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

export function syncErrorMessage(surfId: SurfaceId, conn: ConnectionState): void {
  if (conn.phase !== 'error') {
    morphChatRegistry.set(errorMessageFamily(surfId), null)
    return
  }
  const err = conn.error
  if (typeof err === 'string') {
    const bracket = err.match(/^\s*\[([^\]]+)\]\s*(.*)$/)
    morphChatRegistry.set(errorMessageFamily(surfId), bracket ? `[${bracket[1]}]` : err.slice(0, 30))
    return
  }
  morphChatRegistry.set(errorMessageFamily(surfId), '[error]')
}

// ─── Uptime (connected duration) ─────────────────────────────────────────────

const connectedSinceMap = new Map<SurfaceId, number>()
const uptimeIntervalMap = new Map<SurfaceId, ReturnType<typeof setInterval>>()

export const uptimeFamily = Atom.family((_surfId: SurfaceId) => {
  const atom = Atom.make<string | null>(null)
  morphChatRegistry.mount(atom)
  return atom
})

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function syncUptime(surfId: SurfaceId, conn: ConnectionState): void {
  if (conn.phase === 'connected') {
    if (!connectedSinceMap.has(surfId)) {
      connectedSinceMap.set(surfId, Date.now())
      const tick = () => {
        const since = connectedSinceMap.get(surfId)
        if (since != null) morphChatRegistry.set(uptimeFamily(surfId), formatUptime(Date.now() - since))
      }
      tick()
      uptimeIntervalMap.set(surfId, setInterval(tick, 30_000))
    }
  } else {
    connectedSinceMap.delete(surfId)
    const id = uptimeIntervalMap.get(surfId)
    if (id != null) { clearInterval(id); uptimeIntervalMap.delete(surfId) }
    morphChatRegistry.set(uptimeFamily(surfId), null)
  }
}

// ─── View Mode (per-surface UI preference) ───────────────────────────────────

export const viewModeFamily = Atom.family((_surfId: SurfaceId) => {
  const atom = Atom.make<ViewMode>('dot')
  morphChatRegistry.mount(atom)
  return atom
})

export const blurringFamily = Atom.family((_surfId: SurfaceId) => {
  const atom = Atom.make(false)
  morphChatRegistry.mount(atom)
  return atom
})

// ─── Sync All (single call from subscription effect) ─────────────────────────

/**
 * Sync all derived capsule atoms from a ConnectionState snapshot.
 * Call this once per connection$ update.
 */
export function syncCapsuleAtoms(surfId: SurfaceId, conn: ConnectionState): void {
  syncSmartDot(surfId, conn)
  syncEndpoint(surfId, conn)
  syncErrorMessage(surfId, conn)
  syncUptime(surfId, conn)
  if (conn.latencyMs != null && conn.latencyMs > 0) {
    pushLatencyReading(surfId, conn.latencyMs)
  }
}
