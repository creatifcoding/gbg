/**
 * SourceAdapter Contract — Effect.Service-based adapter interface for Tsingou.
 *
 * Every source adapter is a proper Effect.Service with:
 * - Scoped lifecycle (acquireRelease — connect on construct, cleanup on release)
 * - Push-based signal production via Queue.Enqueue<BaseSignal>
 * - Health monitoring via Atom
 * - Configuration via Context.Tag
 * - Layer composition with Holonet services
 *
 * This is the REAL contract. Adapters are Effect services, not plain objects.
 *
 * Design lineage:
 * - Holonet NatsConnectionService pattern (scoped acquireRelease)
 * - TMNL Feed construct (lifecycle, health monitoring)
 * - effect-atom Atom-as-State (health atoms, signal count)
 *
 * @see TSINGOU_FLOW_ARCHITECTURE.md §4
 * @module tsingou-flow/adapters/types
 */

import { Effect, Queue, Schema, Context, Layer, Scope } from 'effect'
import { Atom } from '@effect-atom/atom'
import type { BaseSignal, SourceId } from '../schemas/base-signal'
import type { AdapterHealth, AdapterStatus } from '../schemas/adapter'

// =============================================================================
// Signal Queue Tag
// =============================================================================

/**
 * The shared signal queue that adapters push into.
 * AdapterManager creates this and provides it to all adapters.
 */
export class SignalQueueTag extends Context.Tag('tsingou/SignalQueue')<
  SignalQueueTag,
  Queue.Queue<BaseSignal>
>() {}

// =============================================================================
// Source Adapter Shape (Service Interface)
// =============================================================================

/**
 * The universal adapter service interface.
 *
 * Every adapter Effect.Service returns this shape from its scoped effect.
 * The lifecycle is managed by Effect.acquireRelease:
 *   - construct: connect to source, start producing signals
 *   - release: disconnect, cleanup resources
 *
 * Signals are pushed to SignalQueueTag automatically.
 */
export interface SourceAdapterShape {
  /** Unique adapter instance ID */
  readonly adapterId: string

  /** Logical source ID */
  readonly sourceId: string

  /** Signal kind this adapter produces */
  readonly kind: string

  /** Health atom — React subscribes directly */
  readonly healthAtom: Atom.Atom<AdapterHealth>

  /** Signal count atom */
  readonly signalCountAtom: Atom.Atom<number>

  /**
   * Pause signal production (adapter stays connected but stops pushing).
   */
  readonly pause: Effect.Effect<void>

  /**
   * Resume signal production after pause.
   */
  readonly resume: Effect.Effect<void>
}

// =============================================================================
// Adapter Factory Helper
// =============================================================================

/**
 * Internal health state for adapter implementations.
 */
export interface AdapterInternals {
  readonly healthAtom: Atom.Atom<AdapterHealth>
  readonly signalCountAtom: Atom.Atom<number>
  readonly push: (signal: BaseSignal) => Effect.Effect<void>
  readonly updateHealth: (update: Partial<AdapterHealth>) => void
}

/**
 * Create adapter internals: health atom, signal count atom, push function.
 *
 * Every adapter calls this in its scoped effect to get the shared primitives.
 * The push function offers to the SignalQueueTag and updates counters.
 */
export const makeAdapterInternals = (
  adapterId: string,
  sourceId: string,
  kind: string,
): Effect.Effect<AdapterInternals, never, SignalQueueTag> =>
  Effect.gen(function* () {
    const queue = yield* SignalQueueTag

    const healthAtom = Atom.make<AdapterHealth>({
      status: 'connecting' as AdapterStatus,
      signalCount: 0,
      errorCount: 0,
    })

    const signalCountAtom = Atom.make(0)

    const updateHealth = (update: Partial<AdapterHealth>) => {
      const current = Atom.unsafeGet(healthAtom)
      Atom.set(healthAtom, { ...current, ...update })
    }

    const push = (signal: BaseSignal): Effect.Effect<void> =>
      Queue.offer(queue, signal).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            const count = Atom.unsafeGet(signalCountAtom) + 1
            Atom.set(signalCountAtom, count)
            updateHealth({
              signalCount: count,
              lastSignalAt: new Date(),
              status: 'connected',
            })
          }),
        ),
        Effect.catchAll((err) =>
          Effect.sync(() => {
            const current = Atom.unsafeGet(healthAtom)
            updateHealth({
              errorCount: current.errorCount + 1,
              status: 'degraded',
            })
          }),
        ),
        Effect.asVoid,
      )

    return { healthAtom, signalCountAtom, push, updateHealth }
  })

// =============================================================================
// Signal ID Generator
// =============================================================================

let _globalSeq = 0

/**
 * Generate a signal ID. Fast, unique enough for in-process use.
 * For distributed uniqueness, combine with sourceId.
 */
export const generateSignalId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${_globalSeq++}` as any
