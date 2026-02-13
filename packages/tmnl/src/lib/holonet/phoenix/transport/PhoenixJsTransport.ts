/**
 * Phoenix JS Transport Service
 *
 * @module holonet/phoenix/transport/PhoenixJsTransport
 */

import { Atom, Registry } from '@effect-atom/atom';
import { Context, Effect, Layer } from 'effect';
import { PhoenixErrors } from '../schemas/errors';

export interface PhoenixPushLike {
  receive(
    status: 'ok' | 'error' | 'timeout',
    callback: (payload: unknown) => void,
  ): PhoenixPushLike;
}

export interface PhoenixChannelLike {
  join(timeout?: number): PhoenixPushLike;
  leave(timeout?: number): PhoenixPushLike;
  on(event: string, callback: (payload: unknown) => void): void;
  push(event: string, payload: unknown, timeout?: number): PhoenixPushLike;
}

export interface PhoenixSocketLike {
  connect(): void;
  disconnect(code?: number, reason?: string): void;
  channel(topic: string, params?: Record<string, unknown>): PhoenixChannelLike;
  onClose?(callback: (event: unknown) => void): void;
  onError?(callback: (error: unknown) => void): void;
}

export interface PhoenixJsTransportConnectConfig {
  readonly url: string;
  readonly topic: string;
  readonly authToken: string;
  readonly params?: Record<string, unknown>;
  readonly timeoutMs?: number;
  readonly onClosed?: (event: unknown) => void;
  readonly onErrored?: (error: unknown) => void;
}

interface TransportConnection {
  readonly socket: PhoenixSocketLike;
  readonly channel: PhoenixChannelLike;
  readonly config: PhoenixJsTransportConnectConfig;
}

export type PhoenixSocketFactory = (
  url: string,
  options: { authToken: string },
) => Effect.Effect<PhoenixSocketLike, PhoenixErrors.TransportError>;

export const PhoenixSocketFactoryTag = Context.GenericTag<PhoenixSocketFactory>(
  'holonet/phoenix/PhoenixSocketFactory',
);

export const PhoenixSocketFactoryLive = Layer.succeed(
  PhoenixSocketFactoryTag,
  (url: string, options: { authToken: string }) =>
    Effect.tryPromise({
      try: async () => {
        const phoenixSpecifier = 'phoenix';
        const module = (await import(/* @vite-ignore */ phoenixSpecifier)) as {
          Socket: new (
            socketUrl: string,
            socketOptions: { authToken: string },
          ) => PhoenixSocketLike;
        };

        return new module.Socket(url, options);
      },
      catch: (cause) =>
        new PhoenixErrors.TransportError({
          message: 'Failed to load phoenix Socket module',
          code: 'transport_closed',
          cause,
        }),
    }),
);

const awaitPush = (
  push: PhoenixPushLike,
  operation: string,
  timeoutMs: number,
): Effect.Effect<unknown, PhoenixErrors.TransportError> =>
  Effect.async<unknown, PhoenixErrors.TransportError>((resume) => {
    let settled = false;

    const settleSuccess = (payload: unknown) => {
      if (settled) return;
      settled = true;
      resume(Effect.succeed(payload));
    };

    const settleFailure = (error: PhoenixErrors.TransportError) => {
      if (settled) return;
      settled = true;
      resume(Effect.fail(error));
    };

    push
      .receive('ok', (payload) => {
        settleSuccess(payload);
      })
      .receive('error', (payload) => {
        settleFailure(
          new PhoenixErrors.TransportError({
            message: `phoenix ${operation} error: ${JSON.stringify(payload)}`,
            code: operation === 'join' ? 'join_rejected' : 'transport_closed',
          }),
        );
      })
      .receive('timeout', () => {
        settleFailure(
          new PhoenixErrors.TransportError({
            message: `phoenix ${operation} timeout`,
            code: operation === 'join' ? 'join_timeout' : 'transport_closed',
          }),
        );
      });

    const timeoutId = setTimeout(() => {
      settleFailure(
        new PhoenixErrors.TransportError({
          message: `phoenix ${operation} unresolved`,
          code: operation === 'join' ? 'join_timeout' : 'transport_closed',
        }),
      );
    }, timeoutMs);

    return Effect.sync(() => clearTimeout(timeoutId));
  });

export interface PhoenixJsTransportShape {
  readonly connect: (
    config: PhoenixJsTransportConnectConfig,
  ) => Effect.Effect<void, PhoenixErrors.TransportError, PhoenixSocketFactory>;
  readonly disconnect: (
    code?: number,
    reason?: string,
  ) => Effect.Effect<void, never>;
  readonly join: (timeoutMs?: number) => Effect.Effect<unknown, PhoenixErrors.TransportError>;
  readonly leave: (timeoutMs?: number) => Effect.Effect<void, PhoenixErrors.TransportError>;
  readonly push: (
    event: string,
    payload: unknown,
    timeoutMs?: number,
  ) => Effect.Effect<unknown, PhoenixErrors.TransportError>;
  readonly on: (
    event: string,
    handler: (payload: unknown) => void,
  ) => Effect.Effect<void, PhoenixErrors.NotConnectedError>;
  readonly isConnected: Effect.Effect<boolean>;
}

export class PhoenixJsTransport extends Effect.Service<PhoenixJsTransport>()(
  'holonet/phoenix/PhoenixJsTransport',
  {
    effect: Effect.gen(function* () {
      const connectionAtom = Atom.make<TransportConnection | null>(null);
      const registry = Registry.make();

      const readConnection = () => registry.get(connectionAtom);
      const writeConnection = (next: TransportConnection | null) => registry.set(connectionAtom, next);

      const requireConnection = (operation: string): Effect.Effect<TransportConnection, PhoenixErrors.NotConnectedError> =>
        Effect.sync(() => readConnection()).pipe(
          Effect.flatMap((value) => {
            if (value === null) {
              return Effect.fail(
                new PhoenixErrors.NotConnectedError({
                  operation,
                }),
              );
            }

            return Effect.succeed(value);
          }),
        );

      const connect: PhoenixJsTransportShape['connect'] = (config) =>
        Effect.gen(function* () {
          const existing = readConnection();
          if (existing !== null) {
            return;
          }

          const socketFactory = yield* PhoenixSocketFactoryTag;
          const socket = yield* socketFactory(config.url, {
            authToken: config.authToken,
          });

          if (socket.onClose && config.onClosed) {
            socket.onClose(config.onClosed);
          }

          if (socket.onError && config.onErrored) {
            socket.onError(config.onErrored);
          }

          socket.connect();
          const channel = socket.channel(config.topic, config.params ?? {});

          writeConnection({
            socket,
            channel,
            config,
          });
        });

      const disconnect: PhoenixJsTransportShape['disconnect'] = (code = 1000, reason = 'normal') =>
        Effect.sync(() => {
          const existing = readConnection();
          if (existing !== null) {
            existing.socket.disconnect(code, reason);
          }
          writeConnection(null);
        });

      const join: PhoenixJsTransportShape['join'] = (timeoutMs) =>
        requireConnection('join').pipe(
          Effect.flatMap((connection) =>
            awaitPush(
              connection.channel.join(timeoutMs ?? connection.config.timeoutMs),
              'join',
              timeoutMs ?? connection.config.timeoutMs ?? 5_000,
            ),
          ),
          Effect.mapError((error) => {
            if (error._tag === 'Holonet/Phoenix/NotConnectedError') {
              return new PhoenixErrors.TransportError({
                message: 'Cannot join channel before connect',
                code: 'not_connected',
                cause: error,
              });
            }
            return error;
          }),
        );

      const leave: PhoenixJsTransportShape['leave'] = (timeoutMs) =>
        requireConnection('leave').pipe(
          Effect.flatMap((connection) =>
            awaitPush(
              connection.channel.leave(timeoutMs ?? connection.config.timeoutMs),
              'leave',
              timeoutMs ?? connection.config.timeoutMs ?? 5_000,
            ),
          ),
          Effect.asVoid,
          Effect.mapError((error) =>
            new PhoenixErrors.TransportError({
              message: error._tag === 'Holonet/Phoenix/NotConnectedError' ? 'Channel not connected' : error.message,
              code: 'transport_closed',
              cause: error,
            }),
          ),
        );

      const push: PhoenixJsTransportShape['push'] = (event, payload, timeoutMs) =>
        requireConnection('push').pipe(
          Effect.flatMap((connection) =>
            awaitPush(
              connection.channel.push(event, payload, timeoutMs ?? connection.config.timeoutMs),
              event,
              timeoutMs ?? connection.config.timeoutMs ?? 5_000,
            ),
          ),
          Effect.mapError((error) =>
            new PhoenixErrors.TransportError({
              message: error._tag === 'Holonet/Phoenix/NotConnectedError' ? 'Channel not connected' : error.message,
              code: error._tag === 'Holonet/Phoenix/NotConnectedError' ? 'not_connected' : 'transport_closed',
              cause: error,
            }),
          ),
        );

      const on: PhoenixJsTransportShape['on'] = (event, handler) =>
        requireConnection('on').pipe(
          Effect.tap((connection) => Effect.sync(() => connection.channel.on(event, handler))),
          Effect.asVoid,
        );

      const isConnected: PhoenixJsTransportShape['isConnected'] = Effect.sync(
        () => readConnection() !== null,
      );

      return {
        connect,
        disconnect,
        join,
        leave,
        push,
        on,
        isConnected,
      } satisfies PhoenixJsTransportShape;
    }),
    dependencies: [PhoenixSocketFactoryLive],
  },
) {}
