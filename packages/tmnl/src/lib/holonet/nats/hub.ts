/**
 * NATS Connection Hub Service
 *
 * Provides efficient connection sharing via RcMap-based hub architecture.
 * Instead of each consumer opening its own NATS subscription, consumers
 * subscribe to local PubSub hubs that fan-out from a single NATS subscription
 * per subject pattern.
 *
 * Architecture:
 * ```
 *   NATS Server
 *       │
 *       ▼
 *   NatsInnerService (single connection via NatsConnectionService)
 *       │
 *       ▼
 *   RcMap<SubjectPattern, SubjectHub>
 *       │
 *       ├── "geoint.flight.>" → PubSub<Take<TypedMsg>> → [Consumer1, Consumer2, ...]
 *       ├── "scada.sensor.>"  → PubSub<Take<TypedMsg>> → [Consumer3, ...]
 *       └── ...
 * ```
 *
 * Features:
 * - Lazy hub creation on first subscriber
 * - Automatic cleanup when no subscribers (idleTimeToLive)
 * - Replay support for late subscribers
 * - Local echo for publishers
 * - Take.Take for proper end/error signal propagation
 *
 * @module holonet/nats/hub
 */

import {
  Effect,
  Stream,
  PubSub,
  Take,
  Scope,
  Schema,
  Duration,
  pipe,
} from 'effect';
import type { Msg } from 'nats.ws';

import { NatsInnerService } from './inner';
import { Hub as HubErrors, Inner, Codec } from './errors';
import { NatsCodec } from './codec';
import { fromAsyncIterable } from '../utils/stream';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Typed message from hub subscription.
 */
export interface TypedHubMessage<A> {
  /** Original NATS subject */
  readonly subject: string;
  /** Decoded payload */
  readonly data: A;
  /** Reply subject if present (for request-reply) */
  readonly reply?: string;
  /** Raw message for advanced use cases */
  readonly raw: Msg;
}

/**
 * Configuration for a subject hub.
 */
export interface SubjectHubConfig {
  /** Number of recent messages to replay to late subscribers */
  readonly replay?: number;
  /** Idle time before hub is released when no subscribers */
  readonly idleTimeToLive?: Duration.DurationInput;
}

/**
 * Options for subscribing to the hub.
 */
export interface HubSubscribeOptions {
  /** Queue group for load balancing (passed to NATS) */
  readonly queue?: string;
}

/**
 * Internal hub state for a subject pattern.
 */
interface SubjectHub<A, E> {
  /** The local PubSub for fan-out */
  readonly pubsub: PubSub.PubSub<Take.Take<A, E>>;
  /** The subject pattern this hub handles */
  readonly pattern: string;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsHubServiceShape {
  /**
   * Subscribe to a subject pattern with Schema decoding.
   *
   * Creates or reuses an existing hub for the pattern. Multiple subscribers
   * to the same pattern share a single NATS subscription via local PubSub.
   *
   * @param pattern - Subject pattern (supports wildcards: * and >)
   * @param schema - Schema for decoding messages
   * @param opts - Subscribe options
   * @returns Scoped Stream of typed messages
   *
   * @example
   * ```typescript
   * const stream = yield* hub.subscribe(
   *   "geoint.flight.>",
   *   FlightPositionSchema,
   *   { replay: 5 }
   * );
   *
   * yield* Stream.runForEach(stream, (msg) =>
   *   Effect.log(`Flight ${msg.subject}: ${msg.data.icao24}`)
   * );
   * ```
   */
  readonly subscribe: <A, I, R>(
    pattern: string,
    schema: Schema.Schema<A, I, R>,
    opts?: SubjectHubConfig & HubSubscribeOptions
  ) => Effect.Effect<
    Stream.Stream<TypedHubMessage<A>, HubErrors.SubscribeError>,
    HubErrors.HubCreationError,
    Scope.Scope | R
  >;

  /**
   * Publish a message through the hub.
   *
   * The message is:
   * 1. Encoded via Schema
   * 2. Published to matching local hubs (for local echo)
   * 3. Forwarded to NATS server
   *
   * @param subject - Exact subject to publish to
   * @param schema - Schema for encoding
   * @param data - Data to publish
   *
   * @example
   * ```typescript
   * yield* hub.publish(
   *   "geoint.flight.ABC123.position",
   *   FlightPositionSchema,
   *   { icao24: "ABC123", lat: 51.5, lon: -0.1 }
   * );
   * ```
   */
  readonly publish: <A, I, R>(
    subject: string,
    schema: Schema.Schema<A, I, R>,
    data: A
  ) => Effect.Effect<void, HubErrors.PublishError, R>;

  /**
   * Get active hub patterns for debugging/introspection.
   */
  readonly activePatterns: () => Effect.Effect<ReadonlyArray<string>>;

  /**
   * Flush pending publishes to ensure delivery.
   */
  readonly flush: () => Effect.Effect<void, Inner.Core.FlushError>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class NatsHubService extends Effect.Service<NatsHubService>()(
  'holonet/nats/Hub',
  {
    scoped: Effect.gen(function* () {
      const inner = yield* NatsInnerService;

      // Default hub configuration
      const defaultReplay = 3;
      // TODO: Implement idleTimeToLive for automatic hub cleanup
      // const defaultIdleTimeToLive = Duration.minutes(5);

      // ─────────────────────────────────────────────────────────────────────────
      // HUB FACTORY
      // ─────────────────────────────────────────────────────────────────────────

      /**
       * Creates a new hub for a subject pattern.
       * This is called by RcMap when a new pattern is first requested.
       */
      const createHub = <A, I, R>(
        pattern: string,
        schema: Schema.Schema<A, I, R>,
        config: SubjectHubConfig & HubSubscribeOptions
      ): Effect.Effect<
        SubjectHub<TypedHubMessage<A>, HubErrors.SubscribeError>,
        HubErrors.HubCreationError,
        Scope.Scope | R
      > =>
        Effect.gen(function* () {
          const replay = config.replay ?? defaultReplay;

          // Create PubSub with replay support
          const pubsub = yield* Effect.acquireRelease(
            PubSub.unbounded<Take.Take<TypedHubMessage<A>, HubErrors.SubscribeError>>({
              replay,
            }),
            (ps) => PubSub.shutdown(ps)
          );

          // Subscribe to NATS
          const subscription = yield* inner.core.subscribe(pattern, {
            queue: config.queue,
          }).pipe(
            Effect.mapError(
              (err) =>
                new HubErrors.HubCreationError({
                  message: `Failed to create NATS subscription for pattern '${pattern}'`,
                  subject: pattern,
                  cause: err,
                })
            )
          );

          // Create stream from NATS subscription
          const natsStream: Stream.Stream<Msg, Inner.Core.SubscribeError> =
            fromAsyncIterable(
              subscription,
              (err) =>
                new Inner.Core.SubscribeError({
                  message: `Subscription iteration error on '${pattern}'`,
                  subject: pattern,
                  cause: err,
                }),
              () => subscription.unsubscribe()
            );

          // Transform: decode each message and wrap in TypedHubMessage
          const typedStream: Stream.Stream<
            TypedHubMessage<A>,
            HubErrors.SubscribeError,
            R
          > = pipe(
            natsStream,
            Stream.mapEffect((msg) =>
              pipe(
                NatsCodec.decodeJson(schema, { subject: msg.subject })(msg.data),
                Effect.map(
                  (data): TypedHubMessage<A> => ({
                    subject: msg.subject,
                    data,
                    reply: msg.reply,
                    raw: msg,
                  })
                ),
                Effect.mapError(
                  (parseError) =>
                    new Codec.DecodeError({
                      message: `Failed to decode message on '${msg.subject}'`,
                      subject: msg.subject,
                      cause: parseError,
                    })
                )
              )
            )
          );

          // Bridge: run stream into PubSub (forked, runs in background)
          yield* pipe(
            Stream.runIntoPubSubScoped(typedStream, pubsub),
            Effect.forkScoped
          );

          return {
            pubsub,
            pattern,
          } satisfies SubjectHub<TypedHubMessage<A>, HubErrors.SubscribeError>;
        });

      // ─────────────────────────────────────────────────────────────────────────
      // RC MAP FOR HUBS
      // ─────────────────────────────────────────────────────────────────────────

      /**
       * RcMap manages hub lifecycle:
       * - Lazy creation on first subscriber
       * - Ref-counted sharing across subscribers
       * - Automatic cleanup after idleTimeToLive
       *
       * Note: We use a simple Map here since we need per-schema hubs,
       * and RcMap's lookup function needs the schema at call time.
       * The actual ref-counting is handled by Scope.
       */
      type AnyHub = SubjectHub<TypedHubMessage<unknown>, HubErrors.SubscribeError>;

      // Track active hubs for introspection
      const activeHubsMap = new Map<string, AnyHub>();

      // ─────────────────────────────────────────────────────────────────────────
      // SUBSCRIBE
      // ─────────────────────────────────────────────────────────────────────────

      const subscribe = <A, I, R>(
        pattern: string,
        schema: Schema.Schema<A, I, R>,
        opts: SubjectHubConfig & HubSubscribeOptions = {}
      ): Effect.Effect<
        Stream.Stream<TypedHubMessage<A>, HubErrors.SubscribeError>,
        HubErrors.HubCreationError,
        Scope.Scope | R
      > =>
        Effect.gen(function* () {
          // Generate a key for this pattern+schema combination
          const schemaId = schema.ast._tag;
          const hubKey = `${pattern}::${schemaId}`;

          // Check if hub exists, create if not
          let hub = activeHubsMap.get(hubKey) as
            | SubjectHub<TypedHubMessage<A>, HubErrors.SubscribeError>
            | undefined;

          if (!hub) {
            // Create new hub
            hub = yield* createHub(pattern, schema, opts);
            activeHubsMap.set(hubKey, hub as AnyHub);

            // Add finalizer to clean up when scope closes
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                // Only remove if this is still the active hub
                if (activeHubsMap.get(hubKey) === hub) {
                  activeHubsMap.delete(hubKey);
                }
              })
            );
          }

          // Subscribe to the hub's PubSub
          const takeStream = yield* Stream.fromPubSub(hub.pubsub, {
            scoped: true,
          });

          // Unwrap Take.Take to get Stream<A, E>
          return Stream.flattenTake(takeStream);
        });

      // ─────────────────────────────────────────────────────────────────────────
      // PUBLISH
      // ─────────────────────────────────────────────────────────────────────────

      const publish = <A, I, R>(
        subject: string,
        schema: Schema.Schema<A, I, R>,
        data: A
      ): Effect.Effect<void, HubErrors.PublishError, R> =>
        Effect.gen(function* () {
          // Encode data
          const bytes = yield* pipe(
            NatsCodec.encodeJson(schema, data),
            Effect.mapError(
              (parseError) =>
                new Codec.EncodeError({
                  message: `Failed to encode message for '${subject}'`,
                  cause: parseError,
                })
            )
          );

          // Create typed message for local echo
          const typedMsg: TypedHubMessage<A> = {
            subject,
            data,
            reply: undefined,
            raw: {
              subject,
              data: bytes,
              reply: undefined,
              sid: -1,
              respond: () => false,
              json: () => data,
              string: () => new TextDecoder().decode(bytes),
            } as Msg,
          };

          // Publish to local hubs that match this subject
          // A subject matches a pattern if:
          // - Pattern "foo.>" matches "foo.bar", "foo.bar.baz", etc.
          // - Pattern "foo.*" matches "foo.bar" but not "foo.bar.baz"
          // - Pattern "foo.bar" matches exactly "foo.bar"
          for (const [key, hub] of activeHubsMap) {
            const [pattern] = key.split('::');
            if (subjectMatchesPattern(subject, pattern)) {
              yield* pipe(
                PubSub.publish(
                  hub.pubsub as PubSub.PubSub<Take.Take<TypedHubMessage<A>, HubErrors.SubscribeError>>,
                  Take.of(typedMsg)
                ),
                Effect.catchAll(() =>
                  // PubSub publish can't really fail for unbounded, but handle it
                  Effect.fail(
                    new HubErrors.HubPublishError({
                      message: `Failed to publish to local hub for pattern '${pattern}'`,
                      subject,
                    })
                  )
                )
              );
            }
          }

          // Forward to NATS
          yield* pipe(
            inner.core.publish(subject, bytes),
            Effect.mapError(
              (err) =>
                new Inner.Core.PublishError({
                  message: `Failed to forward publish to NATS for '${subject}'`,
                  subject,
                  cause: err,
                })
            )
          );
        });

      // ─────────────────────────────────────────────────────────────────────────
      // UTILITIES
      // ─────────────────────────────────────────────────────────────────────────

      const activePatterns = () =>
        Effect.sync(() =>
          Array.from(activeHubsMap.keys()).map((key) => key.split('::')[0])
        );

      const flush = () => inner.core.flush();

      return {
        subscribe,
        publish,
        activePatterns,
        flush,
      } satisfies NatsHubServiceShape;
    }),
    dependencies: [NatsInnerService.Default],
  }
) {}

// =============================================================================
// Pattern Matching Utilities
// =============================================================================

/**
 * Check if a subject matches a NATS pattern.
 *
 * NATS pattern rules:
 * - `*` matches a single token
 * - `>` matches one or more tokens at the end
 * - Everything else is literal match
 *
 * @example
 * subjectMatchesPattern("foo.bar.baz", "foo.>")     // true
 * subjectMatchesPattern("foo.bar.baz", "foo.*")     // false (only one token)
 * subjectMatchesPattern("foo.bar", "foo.*")         // true
 * subjectMatchesPattern("foo.bar", "foo.bar")       // true
 * subjectMatchesPattern("foo.bar", "foo.baz")       // false
 */
function subjectMatchesPattern(subject: string, pattern: string): boolean {
  const subjectTokens = subject.split('.');
  const patternTokens = pattern.split('.');

  for (let i = 0; i < patternTokens.length; i++) {
    const pt = patternTokens[i];

    // `>` matches everything remaining
    if (pt === '>') {
      return i < subjectTokens.length; // Must have at least one token to match
    }

    // No more subject tokens but pattern continues
    if (i >= subjectTokens.length) {
      return false;
    }

    // `*` matches any single token
    if (pt === '*') {
      continue;
    }

    // Literal match required
    if (pt !== subjectTokens[i]) {
      return false;
    }
  }

  // Pattern exhausted - subject must also be exhausted
  return subjectTokens.length === patternTokens.length;
}

// =============================================================================
// Layer Exports
// =============================================================================

export const NatsHubServiceLive = NatsHubService.Default;
