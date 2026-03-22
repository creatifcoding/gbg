/**
 * NATS PubSub Service
 *
 * High-level service for core NATS pub/sub operations with Schema codecs.
 * Uses NatsHubService internally for efficient connection sharing.
 *
 * Features:
 * - Schema-typed publish/subscribe
 * - Request-reply with typed request/response
 * - Stream-based subscription pattern
 * - Local PubSub fan-out (via hub) for efficient multi-consumer patterns
 * - Replay support for late subscribers
 *
 * Architecture:
 * - subscribe() uses NatsHubService for connection sharing
 * - publish() routes through hub for local echo, then to NATS
 * - request() uses direct connection (response needs dedicated path)
 *
 * @module holonet/nats/pubsub
 */

import { Effect, Stream, Schema, Scope, pipe } from 'effect';
import type { Msg } from 'nats.ws';

import { NatsInnerService } from './inner';
import { NatsHubService } from './hub';
import { Inner, Codec, PubSub as PubSubErrors, Hub as HubErrors } from './errors';
import { NatsCodec } from './codec';

// =============================================================================
// Type Definitions
// =============================================================================

/** Typed message from core pub/sub */
export interface TypedMessage<A> {
  /** Original subject */
  readonly subject: string;
  /** Decoded payload */
  readonly data: A;
  /** Reply subject if present */
  readonly reply?: string;
  /** Raw message for advanced use */
  readonly raw: Msg;
}

/** Subscribe options */
export interface SubscribeOptions {
  /** Queue group for load balancing */
  readonly queue?: string;
  /** Max messages before auto-unsubscribe */
  readonly max?: number;
  /** Number of recent messages to replay to late subscribers (hub feature) */
  readonly replay?: number;
}

/** Request options */
export interface RequestOptions {
  /** Timeout in milliseconds */
  readonly timeout?: number;
  /** Disable request multiplexing */
  readonly noMux?: boolean;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsPubSubServiceShape {
  /**
   * Fire-and-forget publish with Schema encoding.
   *
   * Routes through local hub for echo to local subscribers,
   * then forwards to NATS server.
   *
   * @param subject - Subject to publish to
   * @param schema - Schema for encoding
   * @param data - Data to publish
   * @returns Effect that completes on publish
   */
  readonly publish: <A, I, R>(
    subject: string,
    schema: Schema.Schema<A, I, R>,
    data: A
  ) => Effect.Effect<void, PubSubErrors.PublishError, R>;

  /**
   * Subscribe to subject with Schema decoding.
   *
   * Uses hub-based connection sharing - multiple subscribers to the same
   * pattern share a single NATS subscription via local PubSub fan-out.
   *
   * @param subject - Subject or wildcard pattern
   * @param schema - Schema for decoding
   * @param opts - Subscribe options
   * @returns Scoped effect that provides a Stream of typed messages
   */
  readonly subscribe: <A, I, R>(
    subject: string,
    schema: Schema.Schema<A, I, R>,
    opts?: SubscribeOptions
  ) => Effect.Effect<
    Stream.Stream<TypedMessage<A>, PubSubErrors.SubscribeError>,
    HubErrors.HubCreationError,
    Scope.Scope | R
  >;

  /**
   * Request-reply with Schema encoding/decoding.
   *
   * Uses direct connection (not hub) since response needs dedicated path.
   *
   * @param subject - Subject to send request to
   * @param requestSchema - Schema for request encoding
   * @param responseSchema - Schema for response decoding
   * @param data - Request data
   * @param opts - Request options
   * @returns Effect with typed response
   */
  readonly request: <ReqA, ReqI, ReqR, ResA, ResI, ResR>(
    subject: string,
    requestSchema: Schema.Schema<ReqA, ReqI, ReqR>,
    responseSchema: Schema.Schema<ResA, ResI, ResR>,
    data: ReqA,
    opts?: RequestOptions
  ) => Effect.Effect<ResA, PubSubErrors.RequestError, ReqR | ResR>;

  /**
   * Flush pending publishes to server.
   * Useful to ensure messages are sent before proceeding.
   */
  readonly flush: () => Effect.Effect<void, Inner.Core.FlushError>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class NatsPubSubService extends Effect.Service<NatsPubSubService>()(
  'holonet/nats/PubSub',
  {
    scoped: Effect.gen(function* () {
      const inner = yield* NatsInnerService;
      const hub = yield* NatsHubService;

      // ─────────────────────────────────────────────────────────────────────────
      // PUBLISH
      // ─────────────────────────────────────────────────────────────────────────

      const publish = <A, I, R>(
        subject: string,
        schema: Schema.Schema<A, I, R>,
        data: A
      ): Effect.Effect<void, PubSubErrors.PublishError, R> =>
        pipe(
          hub.publish(subject, schema, data),
          // Map hub errors to pubsub errors for API consistency
          Effect.mapError((err): PubSubErrors.PublishError => {
            if (err._tag === 'Codec/Encode') {
              return err;
            }
            if (err._tag === 'Inner/Core/Publish') {
              return err;
            }
            // Hub-specific errors get wrapped
            return new Inner.Core.PublishError({
              message: err.message,
              subject,
              cause: err,
            });
          })
        );

      // ─────────────────────────────────────────────────────────────────────────
      // SUBSCRIBE
      // ─────────────────────────────────────────────────────────────────────────

      const subscribe = <A, I, R>(
        subject: string,
        schema: Schema.Schema<A, I, R>,
        opts?: SubscribeOptions
      ): Effect.Effect<
        Stream.Stream<TypedMessage<A>, PubSubErrors.SubscribeError>,
        HubErrors.HubCreationError,
        Scope.Scope | R
      > =>
        Effect.gen(function* () {
          // Use hub for subscription with connection sharing
          const hubStream = yield* hub.subscribe(subject, schema, {
            queue: opts?.queue,
            replay: opts?.replay,
          });

          // Transform TypedHubMessage to TypedMessage for API consistency
          return pipe(
            hubStream,
            Stream.map(
              (msg): TypedMessage<A> => ({
                subject: msg.subject,
                data: msg.data,
                reply: msg.reply,
                raw: msg.raw,
              })
            ),
            // Map hub subscribe errors to pubsub subscribe errors
            Stream.mapError((err): PubSubErrors.SubscribeError => {
              if (err._tag === 'Codec/Decode') {
                return err;
              }
              if (err._tag === 'Inner/Core/Subscribe') {
                return err;
              }
              // Hub-specific errors get wrapped as subscribe errors
              return new Inner.Core.SubscribeError({
                message: err.message,
                subject,
                cause: err,
              });
            })
          );
        });

      // ─────────────────────────────────────────────────────────────────────────
      // REQUEST
      // ─────────────────────────────────────────────────────────────────────────

      // Request-reply uses direct connection since response needs dedicated path
      const request = <ReqA, ReqI, ReqR, ResA, ResI, ResR>(
        subject: string,
        requestSchema: Schema.Schema<ReqA, ReqI, ReqR>,
        responseSchema: Schema.Schema<ResA, ResI, ResR>,
        data: ReqA,
        opts?: RequestOptions
      ): Effect.Effect<ResA, PubSubErrors.RequestError, ReqR | ResR> =>
        Effect.gen(function* () {
          // Encode request
          const requestBytes = yield* NatsCodec.encodeJson(requestSchema, data).pipe(
            Effect.mapError(
              (parseError) =>
                new Codec.EncodeError({
                  message: `Failed to encode request for '${subject}'`,
                  cause: parseError,
                })
            )
          );

          // Send request via direct connection
          const response = yield* inner.core.request(subject, requestBytes, opts);

          // Decode response
          return yield* NatsCodec.decodeJson(responseSchema, { subject })(response.data).pipe(
            Effect.mapError(
              (decodeError) =>
                new Codec.DecodeError({
                  message: `Failed to decode response from '${subject}'`,
                  subject,
                  cause: decodeError,
                })
            )
          );
        });

      // ─────────────────────────────────────────────────────────────────────────
      // FLUSH
      // ─────────────────────────────────────────────────────────────────────────

      const flush = () => hub.flush();

      return {
        publish,
        subscribe,
        request,
        flush,
      } satisfies NatsPubSubServiceShape;
    }),
    dependencies: [NatsInnerService.Default, NatsHubService.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const NatsPubSubServiceLive = NatsPubSubService.Default;
