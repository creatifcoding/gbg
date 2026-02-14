/**
 * TransportService — Effect.Service interface for log entry transport.
 *
 * Defines the contract for subscribing to and publishing raw JSONL log
 * lines. Implementations swap via Layer:
 *   - MockTransportService: timed Effect.Stream emission for dev/test
 *   - NatsTransportService: holonet/nats wiring for production
 *
 * The transport layer deals in raw strings (JSONL lines). The CodecService
 * handles parsing/assembly. This separation allows transport to be
 * protocol-agnostic.
 *
 * @module agent-task/services/TransportService
 */

import { Context, Effect, Stream, Scope } from 'effect'

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Transport-level subscription error. */
export class TransportSubscribeError {
  readonly _tag = 'TransportSubscribeError' as const
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

/** Transport-level publish error. */
export class TransportPublishError {
  readonly _tag = 'TransportPublishError' as const
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface TransportServiceShape {
  /**
   * Subscribe to log lines for a given task.
   *
   * Returns a scoped Stream of raw JSONL strings. The stream stays open
   * until the scope is closed (component unmount / fiber interruption).
   *
   * @param taskId - The agent task to subscribe logs for
   * @returns Scoped stream of raw JSONL lines
   */
  readonly subscribe: (
    taskId: string,
  ) => Effect.Effect<
    Stream.Stream<string, TransportSubscribeError>,
    TransportSubscribeError,
    Scope.Scope
  >

  /**
   * Publish a raw JSONL line (e.g., for agent-side log emission).
   *
   * @param taskId - The task to publish a log for
   * @param line - Serialized JSONL string
   */
  readonly publish: (
    taskId: string,
    line: string,
  ) => Effect.Effect<void, TransportPublishError>
}

// ---------------------------------------------------------------------------
// Context.Tag
// ---------------------------------------------------------------------------

export class TransportService extends Context.Tag('AgentTask/TransportService')<
  TransportService,
  TransportServiceShape
>() {}
