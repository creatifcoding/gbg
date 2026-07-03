/**
 * @tmnl/stx — Streaming Stats Builder
 *
 * Creates the stats/control plane atoms shared by all materializers.
 * Internal — not exported from the public API.
 *
 * @module
 * @internal
 */

import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import type { StxStreamStats, StxStreamControl } from "./types.js"

// ─── Stats Factory ────────────────────────────────────────────────────────────

export interface MutableStats {
  received: number
  applied: number
  dropped: number
  buffered: number
  lagMs: number
  lastChunkSize: number
  throughputPerSec: number
  // Internal throughput window
  _windowStart: number
  _windowCount: number
}

export interface StxStatsAtoms {
  atoms: StxStreamStats
  mutable: MutableStats
  flush: () => void // write mutable → atoms
}

export function makeStatsAtoms(registry: AtomRegistry.AtomRegistry): StxStatsAtoms {
  const mutable: MutableStats = {
    received: 0, applied: 0, dropped: 0, buffered: 0,
    lagMs: 0, lastChunkSize: 0, throughputPerSec: 0,
    _windowStart: Date.now(), _windowCount: 0,
  }

  const received       = Atom.make<number>(0)
  const applied        = Atom.make<number>(0)
  const dropped        = Atom.make<number>(0)
  const buffered       = Atom.make<number>(0)
  const lagMs          = Atom.make<number>(0)
  const lastChunkSize  = Atom.make<number>(0)
  const throughputPerSec = Atom.make<number>(0)

  registry.mount(received)
  registry.mount(applied)
  registry.mount(dropped)
  registry.mount(buffered)
  registry.mount(lagMs)
  registry.mount(lastChunkSize)
  registry.mount(throughputPerSec)

  const flush = () => {
    // Throughput: items applied in last 1s window
    const now = Date.now()
    const elapsed = now - mutable._windowStart
    if (elapsed >= 1000) {
      mutable.throughputPerSec = Math.round(mutable._windowCount / (elapsed / 1000))
      mutable._windowStart = now
      mutable._windowCount = 0
    }

    registry.set(received,       mutable.received)
    registry.set(applied,        mutable.applied)
    registry.set(dropped,        mutable.dropped)
    registry.set(buffered,       mutable.buffered)
    registry.set(lagMs,          mutable.lagMs)
    registry.set(lastChunkSize,  mutable.lastChunkSize)
    registry.set(throughputPerSec, mutable.throughputPerSec)
  }

  return {
    atoms: { received, applied, dropped, buffered, lagMs, lastChunkSize, throughputPerSec },
    mutable,
    flush,
  }
}

// ─── Control Plane Factory ────────────────────────────────────────────────────

export interface MutableControl {
  paused: boolean
  fiber: { interrupt: () => void } | null
  onDispose: Array<() => void>
}

export interface StxControlAtoms {
  atoms: Pick<StxStreamControl, "running" | "done" | "error">
  mutable: MutableControl
  control: StxStreamControl
}

export function makeControlAtoms(
  registry: AtomRegistry.AtomRegistry,
  stats: StxStatsAtoms,
): StxControlAtoms {
  const mutable: MutableControl = { paused: false, fiber: null, onDispose: [] }

  const running = Atom.make<boolean>(true)
  const done    = Atom.make<boolean>(false)
  const error   = Atom.make<unknown>(undefined)

  registry.mount(running)
  registry.mount(done)
  registry.mount(error)

  const pause   = () => { mutable.paused = true }
  const resume  = () => { mutable.paused = false }
  const dispose = () => {
    mutable.fiber?.interrupt()
    mutable.fiber = null
    for (const fn of mutable.onDispose) fn()
    mutable.onDispose = []
    registry.set(running, false)
  }

  const control: StxStreamControl = {
    running,
    done,
    error,
    stats: stats.atoms,
    pause,
    resume,
    dispose,
  }

  return { atoms: { running, done, error }, mutable, control }
}
