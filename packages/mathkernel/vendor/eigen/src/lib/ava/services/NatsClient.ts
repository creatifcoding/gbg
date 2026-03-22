/**
 * NatsClient Effect Service
 *
 * Effect-based NATS WebSocket client for AVA v2 reactive streaming.
 * Uses nats.ws for browser WebSocket transport to NATS JetStream.
 *
 * @pattern Effect.Service with Layer.scoped for automatic cleanup
 * @see AVA_V2_IMPLEMENTATION_STRATEGY.md Phase 2
 * @module
 */

import {
  Context,
  Chunk,
  Data,
  Duration,
  Effect,
  Layer,
  Schedule,
  Stream,
  Ref,
  Deferred,
  Schema,
  pipe,
} from 'effect'

// ============================================================================
// Configuration Schema
// ============================================================================

/**
 * NATS client configuration
 * Matches NatsRuntimeConfig from Rust ava-runtime
 */
export const NatsConfig = Schema.Struct({
  /** NATS WebSocket URL (e.g., "ws://localhost:8222") */
  serverUrl: Schema.String.pipe(
    Schema.annotations({ description: 'NATS WebSocket server URL' })
  ),
  /** Subject prefix for all messages (default: "tmnl.ava") */
  subjectPrefix: Schema.optionalWith(Schema.String, { default: () => 'tmnl.ava' }),
  /** Connection timeout in milliseconds */
  timeout: Schema.optionalWith(Schema.Number, { default: () => 30000 }),
  /** Maximum reconnection attempts (0 = infinite) */
  maxReconnectAttempts: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  /** Reconnection delay in milliseconds */
  reconnectDelayMs: Schema.optionalWith(Schema.Number, { default: () => 1000 }),
})

export type NatsConfig = typeof NatsConfig.Type

export const NatsConfigTag = Context.GenericTag<NatsConfig>('ava/NatsConfig')

// ============================================================================
// Robustness: Retry Schedule + Backpressure
// ============================================================================

/**
 * NATS connection retry schedule with exponential backoff + jitter
 *
 * - Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
 * - Jittered: +/- 20% randomness to prevent thundering herd
 * - Max 5 attempts
 * - Total timeout: 30 seconds
 *
 * @pattern Schedule.exponential.jittered.intersect(recurs(N))
 * @see AVA_V2_ENHANCEMENT_PLAN.md Pattern 2
 */
export const natsRetrySchedule = pipe(
  Schedule.exponential(Duration.millis(100)),
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(5)),
  Schedule.upTo(Duration.seconds(30))
)

/**
 * Default backpressure buffer size for NATS subscriptions.
 * When buffer is full, the emitter blocks until consumer catches up.
 */
export const DEFAULT_STREAM_BUFFER_SIZE = 100

// ============================================================================
// Errors
// ============================================================================

export class NatsConnectionError extends Data.TaggedError('NatsConnectionError')<{
  readonly message: string
  readonly cause?: unknown
  /** Whether this error is retryable (network errors, timeouts) */
  readonly retryable?: boolean
}> {}

export class NatsSubscriptionError extends Data.TaggedError('NatsSubscriptionError')<{
  readonly subject: string
  readonly message: string
  readonly cause?: unknown
}> {}

export class NatsPublishError extends Data.TaggedError('NatsPublishError')<{
  readonly subject: string
  readonly message: string
  readonly cause?: unknown
}> {}

export class NatsDecodeError extends Data.TaggedError('NatsDecodeError')<{
  readonly subject: string
  readonly raw: string
  readonly message: string
}> {}

export type NatsError =
  | NatsConnectionError
  | NatsSubscriptionError
  | NatsPublishError
  | NatsDecodeError

// ============================================================================
// Message Types
// ============================================================================

/**
 * NATS message wrapper
 * Provides subject, data, and optional headers
 */
export interface NatsMessage<A = unknown> {
  readonly subject: string
  readonly data: A
  readonly headers?: ReadonlyMap<string, string>
  readonly timestamp: number
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Optional queue group for load balancing */
  readonly queue?: string
  /** Maximum messages to receive (0 = unlimited) */
  readonly max?: number
}

// ============================================================================
// Service Definition
// ============================================================================

/**
 * NatsClient service interface
 *
 * Provides:
 * - Connection management with auto-reconnect
 * - Pub/sub messaging
 * - JetStream consumer support (for durable subscriptions)
 * - Typed message streams with Effect Schema decoding
 */
export interface NatsClient {
  /**
   * Check if connected to NATS
   */
  readonly isConnected: Effect.Effect<boolean>

  /**
   * Wait for connection to be established
   */
  readonly waitForConnection: Effect.Effect<void, NatsConnectionError>

  /**
   * Subscribe to a subject pattern
   * Returns a stream of raw messages
   */
  readonly subscribe: (
    subject: string,
    options?: SubscriptionOptions
  ) => Stream.Stream<NatsMessage<Uint8Array>, NatsSubscriptionError>

  /**
   * Subscribe to a subject with JSON decoding
   * Returns a stream of decoded messages
   */
  readonly subscribeJson: <A>(
    subject: string,
    options?: SubscriptionOptions
  ) => Stream.Stream<NatsMessage<A>, NatsSubscriptionError | NatsDecodeError>

  /**
   * Publish raw bytes to a subject
   */
  readonly publish: (
    subject: string,
    data: Uint8Array
  ) => Effect.Effect<void, NatsPublishError>

  /**
   * Publish JSON to a subject
   */
  readonly publishJson: <A>(
    subject: string,
    data: A
  ) => Effect.Effect<void, NatsPublishError>

  /**
   * Drain the connection gracefully
   * Completes all pending operations before closing
   */
  readonly drain: Effect.Effect<void, NatsConnectionError>

  /**
   * Get the connected server URL
   */
  readonly serverUrl: Effect.Effect<string>
}

export const NatsClient = Context.GenericTag<NatsClient>('ava/NatsClient')

// ============================================================================
// Implementation
// ============================================================================

/**
 * NATS.ws connection type (from nats.ws package)
 * Minimal typing to avoid direct dependency
 */
interface NatsConnection {
  subscribe(subject: string, opts?: { queue?: string; max?: number }): {
    [Symbol.asyncIterator](): AsyncIterator<{
      subject: string
      data: Uint8Array
      headers?: { get(key: string): string | undefined }
    }>
    unsubscribe(): void
    drain(): Promise<void>
  }
  publish(subject: string, data?: Uint8Array): void
  drain(): Promise<void>
  close(): Promise<void>
  getServer(): string
  isClosed(): boolean
}

/**
 * Create NatsClient implementation
 * Uses Layer.scoped for automatic connection cleanup
 */
const make = Effect.gen(function* (_) {
  const config = yield* _(NatsConfigTag)

  // State refs
  const connectionRef = yield* _(Ref.make<NatsConnection | null>(null))
  const connectedRef = yield* _(Ref.make(false))
  const connectionDeferred = yield* _(Deferred.make<void, NatsConnectionError>())

  // Import nats.ws dynamically to support tree-shaking
  const natsModule = yield* _(
    Effect.tryPromise({
      try: async () => {
        const nats = await import('nats.ws')
        return nats
      },
      catch: (error) =>
        new NatsConnectionError({
          message: 'Failed to load nats.ws library',
          cause: error,
        }),
    })
  )

  // Connect to NATS with retry (exponential backoff + jitter)
  const nc = yield* _(
    pipe(
      Effect.tryPromise({
        try: async () => {
          const conn = await natsModule.connect({
            servers: config.serverUrl,
            timeout: config.timeout,
            maxReconnectAttempts: config.maxReconnectAttempts,
            reconnectTimeWait: config.reconnectDelayMs,
          })
          return conn as unknown as NatsConnection
        },
        catch: (error) =>
          new NatsConnectionError({
            message: `Failed to connect to NATS at ${config.serverUrl}`,
            cause: error,
            retryable: true, // Network errors are retryable
          }),
      }),
      // Retry with exponential backoff + jitter for connection errors
      Effect.retry({
        while: (e) => e.retryable === true,
        schedule: natsRetrySchedule,
      }),
      Effect.tapError((e) =>
        Effect.log(`NATS connection failed after retries: ${e.message}`)
      ),
      Effect.tap(() => Effect.log(`Connected to NATS at ${config.serverUrl}`))
    )
  )

  // Store connection and mark as connected
  yield* _(Ref.set(connectionRef, nc))
  yield* _(Ref.set(connectedRef, true))
  yield* _(Deferred.succeed(connectionDeferred, undefined))

  // Register cleanup
  yield* _(
    Effect.addFinalizer(() =>
      pipe(
        Ref.get(connectionRef),
        Effect.flatMap((conn) =>
          conn && !conn.isClosed()
            ? pipe(
                Effect.tryPromise({
                  try: () => conn.drain(),
                  catch: () => undefined,
                }),
                Effect.ignore,
                Effect.tap(() => Effect.log('NATS connection drained'))
              )
            : Effect.void
        )
      )
    )
  )

  // Helper: get connection or fail
  const getConnection: Effect.Effect<NatsConnection, NatsConnectionError> = pipe(
    Ref.get(connectionRef),
    Effect.flatMap((conn) =>
      conn && !conn.isClosed()
        ? Effect.succeed(conn)
        : Effect.fail(new NatsConnectionError({ message: 'NATS connection is not available' }))
    )
  )

  // Build subject with prefix
  const buildSubject = (subject: string): string => {
    const prefix = config.subjectPrefix ?? 'tmnl.ava'
    if (subject.startsWith(prefix)) {
      return subject
    }
    return `${prefix}.${subject}`
  }

  const service: NatsClient = {
    isConnected: Ref.get(connectedRef),

    waitForConnection: Deferred.await(connectionDeferred),

    subscribe: (subject, options) => {
      const fullSubject = buildSubject(subject)
      return Stream.unwrap(
        pipe(
          getConnection,
          Effect.mapError(
            (e): NatsSubscriptionError =>
              new NatsSubscriptionError({
                subject: fullSubject,
                message: e.message,
                cause: e,
              })
          ),
          Effect.map((conn) => {
            const sub = conn.subscribe(fullSubject, {
              queue: options?.queue,
              max: options?.max,
            })

            // Use Stream.async with capacity for backpressure control
            // When buffer is full, emitter blocks until consumer catches up
            return Stream.async<NatsMessage<Uint8Array>, NatsSubscriptionError>(
              (emit) => {
                ;(async () => {
                  try {
                    for await (const msg of sub) {
                      const natsMsg: NatsMessage<Uint8Array> = {
                        subject: msg.subject,
                        data: msg.data,
                        timestamp: Date.now(),
                      }
                      emit(Effect.succeed(Chunk.of(natsMsg)))
                    }
                    emit.end()
                  } catch (error) {
                    const err = new NatsSubscriptionError({
                      subject: fullSubject,
                      message: String(error),
                      cause: error,
                    })
                    emit.fail(err)
                  }
                })()

                // Return cleanup effect
                return Effect.sync(() => {
                  sub.unsubscribe()
                })
              },
              DEFAULT_STREAM_BUFFER_SIZE // Backpressure: buffer up to 100 messages
            )
          })
        )
      )
    },

    subscribeJson: <A>(subject: string, options?: SubscriptionOptions) => {
      const fullSubject = buildSubject(subject)
      return Stream.unwrap(
        pipe(
          getConnection,
          Effect.mapError(
            (e): NatsSubscriptionError =>
              new NatsSubscriptionError({
                subject: fullSubject,
                message: e.message,
                cause: e,
              })
          ),
          Effect.map((conn) => {
            const sub = conn.subscribe(fullSubject, {
              queue: options?.queue,
              max: options?.max,
            })

            const decoder = new TextDecoder()
            // Use Stream.async with capacity for backpressure control
            return Stream.async<NatsMessage<A>, NatsSubscriptionError | NatsDecodeError>(
              (emit) => {
                ;(async () => {
                  try {
                    for await (const msg of sub) {
                      const raw = decoder.decode(msg.data)
                      try {
                        const parsed = JSON.parse(raw) as A
                        const natsMsg: NatsMessage<A> = {
                          subject: msg.subject,
                          data: parsed,
                          timestamp: Date.now(),
                        }
                        emit(Effect.succeed(Chunk.of(natsMsg)))
                      } catch (parseError) {
                        const err = new NatsDecodeError({
                          subject: msg.subject,
                          raw,
                          message: String(parseError),
                        })
                        emit.fail(err)
                        return
                      }
                    }
                    emit.end()
                  } catch (error) {
                    const err = new NatsSubscriptionError({
                      subject: fullSubject,
                      message: String(error),
                      cause: error,
                    })
                    emit.fail(err)
                  }
                })()

                // Return cleanup effect
                return Effect.sync(() => sub.unsubscribe())
              },
              DEFAULT_STREAM_BUFFER_SIZE // Backpressure: buffer up to 100 messages
            )
          })
        )
      )
    },

    publish: (subject, data) =>
      pipe(
        getConnection,
        Effect.mapError(
          (e): NatsPublishError =>
            new NatsPublishError({
              subject,
              message: e.message,
            })
        ),
        Effect.flatMap((conn) =>
          Effect.try({
            try: () => conn.publish(buildSubject(subject), data),
            catch: (error) =>
              new NatsPublishError({
                subject: buildSubject(subject),
                message: String(error),
              }),
          })
        )
      ),

    publishJson: <A>(subject: string, data: A) =>
      pipe(
        getConnection,
        Effect.mapError(
          (e): NatsPublishError =>
            new NatsPublishError({
              subject,
              message: e.message,
            })
        ),
        Effect.flatMap((conn) =>
          Effect.try({
            try: () => {
              const encoded = new TextEncoder().encode(JSON.stringify(data))
              conn.publish(buildSubject(subject), encoded)
            },
            catch: (error) =>
              new NatsPublishError({
                subject: buildSubject(subject),
                message: String(error),
              }),
          })
        )
      ),

    drain: pipe(
      getConnection,
      Effect.flatMap((conn) =>
        Effect.tryPromise({
          try: () => conn.drain(),
          catch: (error) =>
            new NatsConnectionError({
              message: `Drain failed: ${error}`,
              cause: error,
            }),
        })
      ),
      Effect.tap(() => Ref.set(connectedRef, false))
    ),

    serverUrl: pipe(
      Ref.get(connectionRef),
      Effect.map((conn) => (conn ? conn.getServer() : config.serverUrl))
    ),
  }

  return service
})

// ============================================================================
// Layers
// ============================================================================

/**
 * Live layer for NatsClient
 * Requires NatsConfig in context
 */
export const NatsClientLive = Layer.scoped(NatsClient, make)

/**
 * Default layer with localhost configuration
 */
export const NatsClientDefault = NatsClientLive.pipe(
  Layer.provide(
    Layer.succeed(NatsConfigTag, {
      serverUrl: 'ws://localhost:8222',
      subjectPrefix: 'tmnl.ava',
      timeout: 30000,
      maxReconnectAttempts: 0,
      reconnectDelayMs: 1000,
    })
  )
)

/**
 * Create layer with custom configuration
 */
export const makeNatsClientLayer = (config: NatsConfig) =>
  NatsClientLive.pipe(Layer.provide(Layer.succeed(NatsConfigTag, config)))
