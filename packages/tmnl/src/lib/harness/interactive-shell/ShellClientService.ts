/**
 * ShellClientService — Browser-side Effect service for interactive shell IO.
 *
 * Connects to the harness WS transport to:
 *   - Receive shell events (data, started, exited, error) via events stream
 *   - Send shell commands (input, resize, kill) via transport.request()
 *
 * This replaces the postMessage hack in interactive-shell-renderer.tsx with
 * a proper Effect-based client that hooks into HarnessBrowserTransport.
 *
 * Usage from React:
 *   const shellClient = useShellClient() // hook wrapping this service
 *   shellClient.sendInput(sessionId, data)
 *   shellClient.subscribe(sessionId) → Stream<ShellEvent>
 *
 * @module harness/interactive-shell/ShellClientService
 */

import {
  Context,
  Effect,
  Layer,
  Stream,
  PubSub,
  SubscriptionRef,
} from 'effect'
import {
  HarnessBrowserTransport,
  type HarnessBrowserTransportShape,
} from '../HarnessBrowserTransport'
import type { ShellEvent } from './schemas'
import type { HarnessRemoteEventEnvelope } from '../HarnessBrowserRemoteSchemas'

// ─────────────────────────────────────────────────────────────────────────────
// Service Shape
// ─────────────────────────────────────────────────────────────────────────────

export interface ShellClientServiceShape {
  /** All shell events from server (all sessions). Filter by sessionId as needed. */
  readonly events: Stream.Stream<ShellEvent>

  /** Shell events for a specific session. */
  readonly subscribe: (sessionId: string) => Stream.Stream<ShellEvent>

  /** Send raw input to a PTY session. */
  readonly sendInput: (sessionId: string, data: string) => Effect.Effect<void>

  /** Resize a PTY session. */
  readonly sendResize: (sessionId: string, cols: number, rows: number) => Effect.Effect<void>

  /** Kill a PTY session. */
  readonly sendKill: (sessionId: string) => Effect.Effect<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

export class ShellClientService extends Context.Tag(
  'tmnl/harness/ShellClientService',
)<ShellClientService, ShellClientServiceShape>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

const isShellEventEnvelope = (
  event: unknown,
): event is { readonly _tag: 'remote:shell_event'; readonly event: ShellEvent } =>
  typeof event === 'object' &&
  event !== null &&
  '_tag' in event &&
  (event as { _tag: string })._tag === 'remote:shell_event'

const makeShellClientService = Effect.gen(function* () {
  const transport = yield* HarnessBrowserTransport

  // Fan-out PubSub for shell events (multiple subscribers per session)
  const shellPubSub = yield* PubSub.unbounded<ShellEvent>()

  // Background fiber: filter transport events → shell PubSub
  yield* Effect.forkScoped(
    Stream.runForEach(transport.events, (rawEvent) =>
      Effect.gen(function* () {
        if (isShellEventEnvelope(rawEvent)) {
          yield* PubSub.publish(shellPubSub, rawEvent.event)
        }
      }),
    ).pipe(
      Effect.catchAll(() => Effect.void), // Transport closed — stop silently
    ),
  )

  // All shell events stream
  const events = Stream.fromPubSub(shellPubSub)

  // Session-filtered stream
  const subscribe = (sessionId: string): Stream.Stream<ShellEvent> =>
    events.pipe(
      Stream.filter((evt) => {
        // All ShellEvent variants have a sessionId field
        return 'sessionId' in evt && (evt as { sessionId: string }).sessionId === sessionId
      }),
    )

  // ── Commands (fire-and-forget via transport.request) ───────────────

  const sendInput = (sessionId: string, data: string) =>
    transport
      .request({ _tag: 'remote:shell_input', sessionId, data } as any)
      .pipe(Effect.catchAll(() => Effect.void)) // Don't fail on transport error

  const sendResize = (sessionId: string, cols: number, rows: number) =>
    transport
      .request({ _tag: 'remote:shell_resize', sessionId, cols, rows } as any)
      .pipe(Effect.catchAll(() => Effect.void))

  const sendKill = (sessionId: string) =>
    transport
      .request({ _tag: 'remote:shell_kill', sessionId } as any)
      .pipe(Effect.catchAll(() => Effect.void))

  return ShellClientService.of({
    events,
    subscribe,
    sendInput,
    sendResize,
    sendKill,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Live layer for ShellClientService.
 *
 * Requires: HarnessBrowserTransport (WS connection to harness server)
 */
export const ShellClientServiceLive = Layer.scoped(
  ShellClientService,
  makeShellClientService,
)
