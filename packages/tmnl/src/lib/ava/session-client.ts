/**
 * AVA Session Client Service
 *
 * Effect-based WebSocket client for AVA bidirectional sessions.
 * Uses Layer.scoped for automatic cleanup per EFFECT_SERVICE_PATTERNS.md.
 *
 * @module
 */

import {
  Context,
  Data,
  Effect,
  Layer,
  Schema,
  Stream,
  Queue,
  Ref,
  Deferred,
} from 'effect';

import {
  SessionCommand,
  SessionEvent,
  type ViewArtifact,
} from './schemas';
import { AvaApiConfig } from './http-client';

// ============================================================================
// Errors
// ============================================================================

/** WebSocket session errors */
export class AvaSessionError extends Data.TaggedError('AvaSessionError')<{
  readonly operation: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class AvaSessionClosedError extends Data.TaggedError(
  'AvaSessionClosedError'
)<{
  readonly code: number;
  readonly reason: string;
}> {}

export class AvaSessionParseError extends Data.TaggedError(
  'AvaSessionParseError'
)<{
  readonly raw: string;
  readonly message: string;
}> {}

// ============================================================================
// Service Definition
// ============================================================================

/** AVA Session Client service interface */
export interface AvaSessionClient {
  /**
   * Subscribe to a view's updates
   * Sends: { "type": "subscribe", "view_id": "..." }
   */
  readonly subscribe: (viewId: string) => Effect.Effect<void, AvaSessionError>;

  /**
   * Unsubscribe from a view
   * Sends: { "type": "unsubscribe", "view_id": "..." }
   */
  readonly unsubscribe: (viewId: string) => Effect.Effect<void, AvaSessionError>;

  /**
   * Invalidate a view via WebSocket
   * Sends: { "type": "invalidate", "view_id": "...", "reason": "..." }
   */
  readonly invalidate: (
    viewId: string,
    reason?: string
  ) => Effect.Effect<void, AvaSessionError>;

  /**
   * Send a ping to keep the connection alive
   * Sends: { "type": "ping", "payload": "..." }
   */
  readonly ping: (payload?: string) => Effect.Effect<void, AvaSessionError>;

  /**
   * Stream of incoming session events
   * Automatically decodes and validates against SessionEvent schema
   */
  readonly events: Stream.Stream<SessionEvent, AvaSessionError>;

  /**
   * Stream of artifact events only (filtered from events)
   */
  readonly artifacts: Stream.Stream<ViewArtifact, AvaSessionError>;

  /**
   * Check if the session is connected
   */
  readonly isConnected: Effect.Effect<boolean>;

  /**
   * Wait for connection to be established
   */
  readonly waitForConnection: Effect.Effect<void, AvaSessionError>;
}

export const AvaSessionClient = Context.GenericTag<AvaSessionClient>(
  'ava/SessionClient'
);

// ============================================================================
// Helpers
// ============================================================================

/** Encode a SessionCommand to JSON string */
const encodeCommand = (command: SessionCommand): string => {
  // Map _tag to type for wire format
  const wireFormat = {
    type: command._tag,
    ...Object.fromEntries(
      Object.entries(command).filter(([k]) => k !== '_tag')
    ),
  };
  return JSON.stringify(wireFormat);
};

/** Decode a JSON string to SessionEvent */
const decodeEvent = (
  raw: string
): Effect.Effect<SessionEvent, AvaSessionParseError> =>
  Effect.try({
    try: () => {
      const parsed = JSON.parse(raw);
      // Map type to _tag for Effect Schema
      const effectFormat = {
        _tag: parsed.type,
        ...Object.fromEntries(
          Object.entries(parsed).filter(([k]) => k !== 'type')
        ),
      };
      const decoder = Schema.decodeSync(SessionEvent);
      return decoder(effectFormat);
    },
    catch: (error) =>
      new AvaSessionParseError({
        raw,
        message: String(error),
      }),
  });

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Create AvaSessionClient service
 * Uses Layer.scoped for automatic WebSocket cleanup
 */
const make = Effect.gen(function* () {
  const config = yield* AvaApiConfig;

  // Derive WebSocket URL from base URL
  const wsUrl = config.baseUrl
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:');
  const sessionUrl = `${wsUrl}/api/v1/session`;

  // State
  const connectedRef = yield* Ref.make(false);
  const connectionDeferred = yield* Deferred.make<void, AvaSessionError>();
  const eventQueue = yield* Queue.unbounded<SessionEvent>();

  // Create WebSocket
  const ws = yield* Effect.sync(() => new WebSocket(sessionUrl));

  // Register cleanup finalizer (per EFFECT_SERVICE_PATTERNS.md)
  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Client cleanup');
      }
    }).pipe(Effect.tap(() => Effect.logDebug('AvaSessionClient: WebSocket cleaned up')))
  );

  // Setup WebSocket event handlers
  yield* Effect.sync(() => {
    ws.onopen = () => {
      Effect.runSync(Ref.set(connectedRef, true));
      Effect.runSync(Deferred.succeed(connectionDeferred, undefined));
    };

    ws.onclose = (event) => {
      Effect.runSync(Ref.set(connectedRef, false));
      if (!Effect.runSync(Deferred.isDone(connectionDeferred))) {
        Effect.runSync(
          Deferred.fail(
            connectionDeferred,
            new AvaSessionError({
              operation: 'connect',
              message: `WebSocket closed: ${event.code} ${event.reason}`,
            })
          )
        );
      }
    };

    ws.onerror = (event) => {
      Effect.runSync(Ref.set(connectedRef, false));
      if (!Effect.runSync(Deferred.isDone(connectionDeferred))) {
        Effect.runSync(
          Deferred.fail(
            connectionDeferred,
            new AvaSessionError({
              operation: 'connect',
              message: 'WebSocket connection error',
              cause: event,
            })
          )
        );
      }
    };

    ws.onmessage = (event) => {
      const data = String(event.data);
      Effect.runPromise(
        decodeEvent(data).pipe(
          Effect.flatMap((evt) => Queue.offer(eventQueue, evt)),
          Effect.catchAll((error) =>
            Effect.logWarning(`Failed to decode event: ${error.message}`)
          )
        )
      );
    };
  });

  // Send command helper
  const sendCommand = (
    command: SessionCommand
  ): Effect.Effect<void, AvaSessionError> =>
    Effect.gen(function* () {
      const connected = yield* Ref.get(connectedRef);
      if (!connected) {
        return yield* Effect.fail(
          new AvaSessionError({
            operation: 'sendCommand',
            message: 'Session is not connected',
          })
        );
      }

      const json = encodeCommand(command);
      yield* Effect.try({
        try: () => ws.send(json),
        catch: (error) =>
          new AvaSessionError({
            operation: 'sendCommand',
            message: String(error),
            cause: error,
          }),
      });
    }).pipe(Effect.withSpan('AvaSessionClient.sendCommand'));

  // Create event stream from queue
  const eventStream: Stream.Stream<SessionEvent, AvaSessionError> =
    Stream.fromQueue(eventQueue);

  // Filter to artifact events only
  const artifactStream: Stream.Stream<ViewArtifact, AvaSessionError> =
    eventStream.pipe(
      Stream.filter((event): event is typeof event & { _tag: 'artifact' } =>
        event._tag === 'artifact'
      ),
      Stream.map((event) => event.artifact)
    );

  return {
    subscribe: (viewId: string) =>
      sendCommand({ _tag: 'subscribe', view_id: viewId }).pipe(
        Effect.withSpan('AvaSessionClient.subscribe', {
          attributes: { viewId },
        })
      ),

    unsubscribe: (viewId: string) =>
      sendCommand({ _tag: 'unsubscribe', view_id: viewId }).pipe(
        Effect.withSpan('AvaSessionClient.unsubscribe', {
          attributes: { viewId },
        })
      ),

    invalidate: (viewId: string, reason?: string) =>
      sendCommand({
        _tag: 'invalidate',
        view_id: viewId,
        reason,
      }).pipe(
        Effect.withSpan('AvaSessionClient.invalidate', {
          attributes: { viewId, reason },
        })
      ),

    ping: (payload?: string) =>
      sendCommand({
        _tag: 'ping',
        payload,
      }).pipe(Effect.withSpan('AvaSessionClient.ping')),

    events: eventStream,

    artifacts: artifactStream,

    isConnected: Ref.get(connectedRef),

    waitForConnection: Deferred.await(connectionDeferred),
  } satisfies AvaSessionClient;
});

// ============================================================================
// Layer
// ============================================================================

/**
 * Live layer for AvaSessionClient
 * Uses Layer.scoped for automatic WebSocket cleanup
 */
export const AvaSessionClientLive = Layer.scoped(AvaSessionClient, make);

/** Full layer with default config (from http-client) */
export const AvaSessionClientDefault = AvaSessionClientLive.pipe(
  Layer.provide(
    Layer.succeed(AvaApiConfig, {
      baseUrl: 'http://localhost:3000',
      timeout: 30000,
    })
  )
);

/** Create layer with custom config */
export const makeAvaSessionClientLayer = (baseUrl: string) =>
  AvaSessionClientLive.pipe(
    Layer.provide(
      Layer.succeed(AvaApiConfig, {
        baseUrl,
        timeout: 30000,
      })
    )
  );
