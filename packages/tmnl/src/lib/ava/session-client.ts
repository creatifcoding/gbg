/**
 * AVA Session Client Service
 *
 * Effect-based WebSocket client for AVA bidirectional sessions.
 * Uses Effect Platform Socket API for cross-platform compatibility.
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
  Scope,
  Fiber,
  Chunk,
} from 'effect';
import { Socket } from '@effect/platform';

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
 * Requires Socket.WebSocketConstructor in context
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

  // Create WebSocket using Effect Platform Socket API
  // This requires Socket.WebSocketConstructor in context
  const socket = yield* Socket.makeWebSocket(sessionUrl, {
    openTimeout: config.timeout,
  });

  // Get the writer for sending commands (scoped, auto-cleanup)
  const write = yield* socket.writer;

  // Message handler - decode and enqueue events
  const handleMessage = (data: string | Uint8Array): Effect.Effect<void> => {
    const raw = typeof data === 'string' ? data : new TextDecoder().decode(data);
    return decodeEvent(raw).pipe(
      Effect.flatMap((evt) => Queue.offer(eventQueue, evt)),
      Effect.catchAll((error) =>
        Effect.logWarning(`Failed to decode event: ${error.message}`)
      )
    );
  };

  // Run the socket handler in a fiber
  // This handles incoming messages and connection lifecycle
  const runSocket = socket.runRaw(handleMessage, {
    onOpen: Effect.gen(function* () {
      yield* Ref.set(connectedRef, true);
      yield* Deferred.succeed(connectionDeferred, undefined);
      yield* Effect.logDebug('AvaSessionClient: WebSocket connected');
    }),
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Ref.set(connectedRef, false);
        const isDone = yield* Deferred.isDone(connectionDeferred);
        if (!isDone) {
          yield* Deferred.fail(
            connectionDeferred,
            new AvaSessionError({
              operation: 'connect',
              message: `WebSocket error: ${error}`,
              cause: error,
            })
          );
        }
        yield* Effect.logWarning(`AvaSessionClient: Socket error - ${error}`);
      })
    )
  );

  // Fork the socket handler to run in background
  const socketFiber = yield* Effect.fork(runSocket);

  // Register cleanup finalizer (per EFFECT_SERVICE_PATTERNS.md)
  yield* Effect.addFinalizer(() =>
    Effect.gen(function* () {
      yield* Fiber.interrupt(socketFiber);
      yield* Effect.logDebug('AvaSessionClient: WebSocket cleaned up');
    })
  );

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
      yield* write(json).pipe(
        Effect.mapError((socketError) =>
          new AvaSessionError({
            operation: 'sendCommand',
            message: `Socket write error: ${socketError}`,
            cause: socketError,
          })
        )
      );
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
// Layers
// ============================================================================

/**
 * Live layer for AvaSessionClient
 * Requires:
 * - AvaApiConfig
 * - Socket.WebSocketConstructor (for platform-specific WebSocket implementation)
 */
export const AvaSessionClientLive = Layer.scoped(AvaSessionClient, make);

/**
 * Browser layer - uses globalThis.WebSocket
 * Use this in browser environments (React apps, etc.)
 */
export const AvaSessionClientBrowser = AvaSessionClientLive.pipe(
  Layer.provide(Socket.layerWebSocketConstructorGlobal)
);

/**
 * Node.js/Bun layer - requires a WebSocket polyfill
 * Use this with the ws package in Node.js or Bun's native WebSocket
 *
 * Example usage with ws package:
 * ```typescript
 * import WebSocket from 'ws'
 * const NodeWebSocketLayer = Layer.succeed(
 *   Socket.WebSocketConstructor,
 *   (url, protocols) => new WebSocket(url, protocols) as unknown as globalThis.WebSocket
 * )
 * const layer = AvaSessionClientLive.pipe(
 *   Layer.provide(NodeWebSocketLayer),
 *   Layer.provide(configLayer)
 * )
 * ```
 */
export const AvaSessionClientNode = (
  WebSocketImpl: new (url: string, protocols?: string | string[]) => globalThis.WebSocket
) =>
  AvaSessionClientLive.pipe(
    Layer.provide(
      Layer.succeed(
        Socket.WebSocketConstructor,
        (url, protocols) => new WebSocketImpl(url, protocols)
      )
    )
  );

/** Full layer with default config (from http-client) - for browser */
export const AvaSessionClientDefault = AvaSessionClientBrowser.pipe(
  Layer.provide(
    Layer.succeed(AvaApiConfig, {
      baseUrl: 'http://localhost:3000',
      timeout: 30000,
    })
  )
);

/** Create layer with custom config - for browser */
export const makeAvaSessionClientLayer = (baseUrl: string) =>
  AvaSessionClientBrowser.pipe(
    Layer.provide(
      Layer.succeed(AvaApiConfig, {
        baseUrl,
        timeout: 30000,
      })
    )
  );

/**
 * Create layer with custom config for Node.js/Bun
 * Requires a WebSocket constructor implementation
 */
export const makeAvaSessionClientNodeLayer = (
  baseUrl: string,
  WebSocketImpl: new (url: string, protocols?: string | string[]) => globalThis.WebSocket
) =>
  AvaSessionClientNode(WebSocketImpl).pipe(
    Layer.provide(
      Layer.succeed(AvaApiConfig, {
        baseUrl,
        timeout: 30000,
      })
    )
  );
