/**
 * WebSocket Smoke Test
 *
 * Minimal test to debug Effect Socket connection issues.
 * Uses proper Effect patterns with Bun's native WebSocket.
 *
 * Run with: bun test src/lib/ava/__tests__/ws-smoke.bun.test.ts
 */

import { describe, it, expect } from 'bun:test';
import { Effect, Layer, Duration, Ref, Deferred, Cause, Scope } from 'effect';
import { Socket } from '@effect/platform';
import { BunSocket } from '@effect/platform-bun';

import {
  AvaSessionClient,
  AvaSessionClientLive,
  AvaApiConfig,
} from '../index';

const AVA_BASE_URL = process.env.AVA_BASE_URL ?? 'http://localhost:3000';
const WS_URL = AVA_BASE_URL.replace(/^http:/, 'ws:') + '/api/v1/session';

// =============================================================================
// Test 1: Raw Socket via BunSocket.layerWebSocket (canonical pattern)
// =============================================================================

describe('WebSocket Smoke Test', () => {
  it('connects via BunSocket.layerWebSocket', async () => {
    const program = Effect.gen(function* () {
      yield* Effect.log(`Connecting to ${WS_URL}...`);

      // Get socket from context (provided by layer)
      const socket = yield* Socket.Socket;
      yield* Effect.log('Socket acquired from context');

      // Get writer
      const write = yield* socket.writer;
      yield* Effect.log('Writer acquired');

      // Track connection state
      const connectedRef = yield* Ref.make(false);
      const deferred = yield* Deferred.make<void, Socket.SocketError>();

      // Run socket with proper error handling
      yield* socket
        .runRaw(
          (data) =>
            Effect.gen(function* () {
              yield* Effect.log(
                `Received: ${typeof data === 'string' ? data.slice(0, 100) : '<binary>'}`
              );
            }),
          {
            onOpen: Effect.gen(function* () {
              yield* Effect.log('>>> onOpen callback fired! <<<');
              yield* Ref.set(connectedRef, true);
              yield* Deferred.succeed(deferred, undefined);
            }),
          }
        )
        .pipe(
          // Race with our deferred - once connected, we can proceed
          Effect.raceFirst(
            Deferred.await(deferred).pipe(
              Effect.timeout(Duration.seconds(5)),
              Effect.catchTag('TimeoutException', () =>
                Effect.fail(
                  new Socket.SocketGenericError({
                    reason: 'OpenTimeout',
                    cause: 'Smoke test timeout waiting for connection',
                  })
                )
              )
            )
          ),
          // Log any errors with full cause
          Effect.tapErrorCause((cause) =>
            Effect.log(`Socket error cause: ${Cause.pretty(cause)}`)
          )
        );

      const isConn = yield* Ref.get(connectedRef);
      yield* Effect.log(`Connection established: ${isConn}`);
      return isConn;
    }).pipe(
      Effect.scoped,
      Effect.provide(BunSocket.layerWebSocket(WS_URL, { openTimeout: 10000 }))
    );

    const result = await Effect.runPromise(program);
    expect(result).toBe(true);
  });

  // =============================================================================
  // Test 2: Send ping, receive pong
  // =============================================================================

  it('sends ping and receives pong', async () => {
    const program = Effect.gen(function* () {
      yield* Effect.log('Starting ping test...');

      const socket = yield* Socket.Socket;
      const write = yield* socket.writer;

      const pongReceived = yield* Deferred.make<string, Socket.SocketError>();

      yield* socket
        .runRaw(
          (data) =>
            Effect.gen(function* () {
              const msg =
                typeof data === 'string' ? data : new TextDecoder().decode(data);
              yield* Effect.log(`Received: ${msg}`);

              // Check if it's a pong
              if (msg.includes('pong')) {
                yield* Deferred.succeed(pongReceived, msg);
              }
            }),
          {
            onOpen: Effect.gen(function* () {
              yield* Effect.log('Connected, sending ping...');
              const pingCmd = JSON.stringify({ type: 'ping', payload: 'smoke-test' });
              yield* write(pingCmd);
              yield* Effect.log('Ping sent');
            }),
          }
        )
        .pipe(
          Effect.raceFirst(
            Deferred.await(pongReceived).pipe(
              Effect.timeout(Duration.seconds(5)),
              Effect.catchTag('TimeoutException', () =>
                Effect.fail(
                  new Socket.SocketGenericError({
                    reason: 'Read',
                    cause: 'Timeout waiting for pong',
                  })
                )
              )
            )
          ),
          Effect.tapErrorCause((cause) => Effect.log(`Error: ${Cause.pretty(cause)}`))
        );

      const pong = yield* Deferred.await(pongReceived);
      yield* Effect.log(`Pong received: ${pong}`);
      return pong;
    }).pipe(
      Effect.scoped,
      Effect.provide(BunSocket.layerWebSocket(WS_URL, { openTimeout: 10000 }))
    );

    const result = await Effect.runPromise(program);
    expect(result).toContain('pong');
  });

  // =============================================================================
  // Test 3: Our AvaSessionClient service
  // =============================================================================

  const sessionLayer = AvaSessionClientLive.pipe(
    Layer.provide(BunSocket.layerWebSocketConstructor),
    Layer.provide(
      Layer.succeed(AvaApiConfig, {
        baseUrl: AVA_BASE_URL,
        timeout: 10000,
      })
    )
  );

  it('AvaSessionClient connects', async () => {
    const program = Effect.gen(function* () {
      yield* Effect.log(`Testing AvaSessionClient against ${AVA_BASE_URL}...`);

      const client = yield* AvaSessionClient;
      yield* Effect.log('Client acquired, waiting for connection...');

      yield* client.waitForConnection.pipe(
        Effect.timeout(Duration.seconds(10)),
        Effect.tapErrorCause((cause) =>
          Effect.log(`Connection error: ${Cause.pretty(cause)}`)
        )
      );

      const isConn = yield* client.isConnected;
      yield* Effect.log(`AvaSessionClient connected: ${isConn}`);
      return isConn;
    }).pipe(Effect.scoped, Effect.provide(sessionLayer));

    const result = await Effect.runPromise(program);
    expect(result).toBe(true);
  });
});
