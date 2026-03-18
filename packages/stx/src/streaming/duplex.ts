/**
 * @tmnl/stx — stx.duplex()
 *
 * Bidirectional stream: combine an inbound sink (consuming events)
 * with an outbound source (emitting events), both controlled by
 * a single control plane + shared stats.
 *
 * Architecture:
 *   inbound  → stxReduce (or stxFeed) — writes to state atoms
 *   outbound → stxLatest               — reads from stream
 *   control  → single control plane wraps both fibers
 *
 * Use for:
 *   - WebSocket (receive messages, send messages)
 *   - Harness channel (stdin write + stdout read)
 *   - Agent bidirectional RPC
 *
 * @module
 */

import { Atom, AtomRegistry } from "effect-v4/unstable/reactivity"
import * as Effect from "effect-v4/Effect"
import * as Stream from "effect-v4/Stream"
import * as Fiber from "effect-v4/Fiber"
import * as Scope from "effect-v4/Scope"
import * as Exit from "effect-v4/Exit"
import { makeStatsAtoms, makeControlAtoms } from "./stats.js"
import { watchFiberExit } from "./fiber-exit.js"
import type { DuplexConfig, StxDuplex } from "./types.js"

// ─── stx.duplex ──────────────────────────────────────────────────────────────

/**
 * Create a bidirectional stream binding.
 *
 * @example
 * ```ts
 * const ws = stxDuplex(
 *   { inbound: wsMessages, outbound: wsEcho },
 *   { mode: "window", limit: 100 },
 *   registry
 * )
 * // ws.items — received messages
 * // ws.latest — last sent/echo
 * ws.control.dispose() // closes both streams
 * ```
 */
export function stxDuplex<In, Out, EIn = never, EOut = never>(
  streams: {
    readonly inbound:  Stream.Stream<In,  EIn,  never>
    readonly outbound: Stream.Stream<Out, EOut, never>
  },
  config:   DuplexConfig = {},
  registry: AtomRegistry.AtomRegistry,
): StxDuplex<In, Out, EIn | EOut> {
  const mode  = config.mode  ?? "append"
  const limit = config.limit ?? Infinity

  // ── State atoms ─────────────────────────────────────────────────────────────
  const inboundAtom    = Atom.make<ReadonlyArray<In>>([])
  const outboundAtom   = Atom.make<Out | undefined>(undefined)
  const loadingAtom    = Atom.make<boolean>(true)
  registry.mount(inboundAtom)
  registry.mount(outboundAtom)
  registry.mount(loadingAtom)

  // ── Shared stats + control ──────────────────────────────────────────────────
  const stats   = makeStatsAtoms(registry)
  const control = makeControlAtoms(registry, stats)

  // ── Inbound ingestion ───────────────────────────────────────────────────────
  const inboundScope = Scope.makeUnsafe("sequential")

  const ingestInbound = Stream.runForEachArray(streams.inbound, (chunk) => {
    if (control.mutable.paused) {
      stats.mutable.buffered += chunk.length
      stats.mutable.received += chunk.length
      stats.flush()
      return Effect.void
    }

    const t0 = Date.now()
    stats.mutable.received     += chunk.length
    stats.mutable._windowCount += chunk.length
    stats.mutable.lastChunkSize = chunk.length

    const current = registry.get(inboundAtom)
    let   next: ReadonlyArray<In>

    if (mode === "append") {
      next = [...current, ...chunk as ReadonlyArray<In>]
    } else {
      // window: keep last `limit` items
      const combined = [...current, ...chunk as ReadonlyArray<In>]
      if (combined.length <= limit) {
        next = combined
      } else {
        const dropped = combined.length - limit
        stats.mutable.dropped += dropped
        next = combined.slice(dropped)
      }
    }

    stats.mutable.applied += chunk.length
    stats.mutable.lagMs    = Date.now() - t0
    registry.set(inboundAtom, next)
    stats.flush()
    return Effect.void
  })

  // ── Outbound latest ─────────────────────────────────────────────────────────
  const ingestOutbound = Stream.runForEachArray(streams.outbound, (chunk) => {
    const latest = chunk[chunk.length - 1]
    registry.set(outboundAtom, latest as Out)
    return Effect.void
  })

  // ── Fork both fibers ────────────────────────────────────────────────────────
  const inboundFiber  = Effect.runFork(ingestInbound)
  const outboundFiber = Effect.runFork(ingestOutbound)

  // Watch inbound (primary — determines loading + done)
  watchFiberExit(inboundFiber, control.atoms, registry, () => {
    registry.set(loadingAtom, false)
  })

  // Watch outbound (secondary — only propagates errors)
  watchFiberExit(outboundFiber, {
    running: control.atoms.running,
    done:    control.atoms.done,
    error:   control.atoms.error,
  }, registry)

  // ── Dispose: interrupt both fibers ──────────────────────────────────────────
  control.mutable.fiber = {
    interrupt: () => {
      Effect.runFork(Fiber.interrupt(inboundFiber))
      Effect.runFork(Fiber.interrupt(outboundFiber))
    }
  }
  control.mutable.onDispose.push(() => {
    Effect.runFork(Scope.close(inboundScope, Exit.void))
  })

  return {
    inbound:  inboundAtom,
    outbound: outboundAtom,
    loading:  loadingAtom,
    registry,
    control:  control.control,
  }
}
