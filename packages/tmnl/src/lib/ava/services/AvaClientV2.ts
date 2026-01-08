/**
 * AVA Client V2 Effect Service
 *
 * High-level AVA operations using NATS JetStream transport.
 * Provides view subscription, invalidation, and event streaming.
 *
 * @pattern Effect.Service with Stream composition
 * @see AVA_V2_IMPLEMENTATION_STRATEGY.md Phase 2
 * @module
 */

import {
  Context,
  Data,
  Effect,
  Layer,
  Stream,
  Schema,
  Queue,
  Ref,
  HashMap,
  pipe,
} from 'effect'
import {
  NatsClient,
  NatsClientLive,
  NatsConfigTag,
  type NatsConfig,
  type NatsSubscriptionError,
  type NatsDecodeError,
} from './NatsClient'
import {
  ViewArtifact,
  ViewDelta,
  TaggedArtifact,
  TaggedDelta,
  ReconcilerEvent,
  ViewStatusEvent,
  ViewId,
} from '../schemas/v2'

// ============================================================================
// Configuration
// ============================================================================

/**
 * AvaClientV2 configuration
 */
export const AvaClientV2Config = Schema.Struct({
  /** NATS subject prefix (default: "tmnl.ava") */
  subjectPrefix: Schema.optionalWith(Schema.String, { default: () => 'tmnl.ava' }),
  /** Timeout for subscribe operations (ms) */
  subscribeTimeout: Schema.optionalWith(Schema.Number, { default: () => 30000 }),
  /** Buffer size for event queue */
  bufferSize: Schema.optionalWith(Schema.Number, { default: () => 1000 }),
})

export type AvaClientV2Config = typeof AvaClientV2Config.Type

export const AvaClientV2ConfigTag = Context.GenericTag<AvaClientV2Config>('ava/AvaClientV2Config')

// ============================================================================
// Errors
// ============================================================================

export class AvaSubscriptionError extends Data.TaggedError('AvaSubscriptionError')<{
  readonly viewId: string
  readonly message: string
  readonly cause?: unknown
}> {}

export class AvaInvalidationError extends Data.TaggedError('AvaInvalidationError')<{
  readonly viewId: string
  readonly message: string
  readonly cause?: unknown
}> {}

export class AvaDecodeError extends Data.TaggedError('AvaDecodeError')<{
  readonly subject: string
  readonly raw: string
  readonly message: string
}> {}

export type AvaClientV2Error =
  | AvaSubscriptionError
  | AvaInvalidationError
  | AvaDecodeError

// ============================================================================
// NATS Subject Patterns
// ============================================================================

/**
 * NATS subject patterns for AVA v2
 * Matches Rust NatsConfig subject structure exactly:
 * - artifacts_subject: `{prefix}.artifacts.{view_id}`
 * - deltas_subject: `{prefix}.deltas.{view_id}`
 * - status_subject: `{prefix}.status.{view_id}`
 * - invalidate_subject: `{prefix}.invalidate.{view_id}`
 */
const subjects = {
  /** Artifact updates for a specific view: tmnl.ava.artifacts.<viewId> */
  artifact: (viewId: string) => `artifacts.${viewId}`,
  /** All artifact updates: tmnl.ava.artifacts.* */
  allArtifacts: () => 'artifacts.*',
  /** Delta updates for a specific view: tmnl.ava.deltas.<viewId> */
  delta: (viewId: string) => `deltas.${viewId}`,
  /** All delta updates: tmnl.ava.deltas.* */
  allDeltas: () => 'deltas.*',
  /** Reconciler events: tmnl.ava.status.* (status events from backend) */
  events: () => 'status.*',
  /** View status updates: tmnl.ava.status.<viewId> */
  status: (viewId: string) => `status.${viewId}`,
  /** Invalidation request: tmnl.ava.invalidate.<viewId> */
  invalidate: (viewId: string) => `invalidate.${viewId}`,
  /** Subscribe request: tmnl.ava.subscribe.<viewId> */
  subscribe: (viewId: string) => `subscribe.${viewId}`,
  /** Unsubscribe request: tmnl.ava.unsubscribe.<viewId> */
  unsubscribe: (viewId: string) => `unsubscribe.${viewId}`,
} as const

// ============================================================================
// Service Definition
// ============================================================================

/**
 * AvaClientV2 service interface
 *
 * Provides:
 * - View subscription via NATS JetStream
 * - Artifact and delta streaming
 * - View invalidation
 * - Event log streaming
 */
export interface AvaClientV2 {
  /**
   * Subscribe to a view's artifacts
   * Returns a stream of ViewArtifact updates
   */
  readonly subscribeArtifact: (
    viewId: ViewId
  ) => Stream.Stream<ViewArtifact, AvaSubscriptionError | AvaDecodeError>

  /**
   * Subscribe to a view's deltas
   * Returns a stream of ViewDelta updates
   */
  readonly subscribeDelta: (
    viewId: ViewId
  ) => Stream.Stream<ViewDelta, AvaSubscriptionError | AvaDecodeError>

  /**
   * Subscribe to all artifacts (multi-view)
   * Returns a stream of TaggedArtifact for routing
   */
  readonly subscribeAllArtifacts: () => Stream.Stream<
    TaggedArtifact,
    AvaSubscriptionError | AvaDecodeError
  >

  /**
   * Subscribe to all deltas (multi-view)
   * Returns a stream of TaggedDelta for routing
   */
  readonly subscribeAllDeltas: () => Stream.Stream<
    TaggedDelta,
    AvaSubscriptionError | AvaDecodeError
  >

  /**
   * Subscribe to reconciler events
   * Returns a stream of ReconcilerEvent
   */
  readonly subscribeEvents: () => Stream.Stream<
    ReconcilerEvent,
    AvaSubscriptionError | AvaDecodeError
  >

  /**
   * Subscribe to a view's status updates
   * Returns a stream of ViewStatusEvent (lifecycle status, progress)
   */
  readonly subscribeStatus: (
    viewId: ViewId
  ) => Stream.Stream<ViewStatusEvent, AvaSubscriptionError | AvaDecodeError>

  /**
   * Invalidate a view
   * Publishes invalidation command to NATS
   */
  readonly invalidate: (
    viewId: ViewId,
    reason?: string
  ) => Effect.Effect<void, AvaInvalidationError>

  /**
   * Request a view subscription
   * Publishes subscribe command to NATS
   */
  readonly requestSubscribe: (
    viewId: ViewId
  ) => Effect.Effect<void, AvaInvalidationError>

  /**
   * Request to unsubscribe from a view
   * Publishes unsubscribe command to NATS
   */
  readonly requestUnsubscribe: (
    viewId: ViewId
  ) => Effect.Effect<void, AvaInvalidationError>

  /**
   * Get active subscriptions count
   */
  readonly activeSubscriptions: Effect.Effect<number>
}

export const AvaClientV2 = Context.GenericTag<AvaClientV2>('ava/AvaClientV2')

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create AvaClientV2 service
 * Composes NatsClient for NATS transport
 */
const make = Effect.gen(function* () {
  const nats = yield* NatsClient
  const config = yield* AvaClientV2ConfigTag

  // Track active subscriptions
  const subscriptionsRef = yield* Ref.make(HashMap.empty<string, number>())

  // Helper: Map NATS errors to AVA errors
  const mapNatsError = (
    viewId: string
  ): ((
    error: NatsSubscriptionError | NatsDecodeError
  ) => AvaSubscriptionError | AvaDecodeError) => {
    return (error) => {
      if (error._tag === 'NatsDecodeError') {
        return new AvaDecodeError({
          subject: error.subject,
          raw: error.raw,
          message: error.message,
        })
      }
      return new AvaSubscriptionError({
        viewId,
        message: error.message,
        cause: error.cause,
      })
    }
  }

  // Helper: Decode JSON to schema type
  const decodeJson = <A, I>(
    schema: Schema.Schema<A, I, never>,
    subject: string
  ): ((raw: unknown) => Effect.Effect<A, AvaDecodeError>) => {
    const decode = Schema.decodeUnknown(schema)
    return (raw) =>
      decode(raw).pipe(
        Effect.mapError(
          (parseError) =>
            new AvaDecodeError({
              subject,
              raw: JSON.stringify(raw),
              message: String(parseError),
            })
        )
      )
  }

  // Helper: Increment subscription count
  const incrementSub = (viewId: string) =>
    Ref.update(subscriptionsRef, (map) => {
      const current = HashMap.get(map, viewId)
      if (current._tag === 'Some') {
        return HashMap.set(map, viewId, current.value + 1)
      }
      return HashMap.set(map, viewId, 1)
    })

  // Helper: Decrement subscription count
  const decrementSub = (viewId: string) =>
    Ref.update(subscriptionsRef, (map) => {
      const current = HashMap.get(map, viewId)
      if (current._tag === 'Some' && current.value > 1) {
        return HashMap.set(map, viewId, current.value - 1)
      }
      return HashMap.remove(map, viewId)
    })

  const service: AvaClientV2 = {
    subscribeArtifact: (viewId) => {
      const subject = subjects.artifact(viewId)
      return nats.subscribeJson<unknown>(subject).pipe(
        Stream.mapError(mapNatsError(viewId)),
        Stream.mapEffect((msg) =>
          decodeJson(ViewArtifact, msg.subject)(msg.data)
        ),
        Stream.tap(() => incrementSub(viewId)),
        Stream.ensuring(decrementSub(viewId))
      )
    },

    subscribeDelta: (viewId) => {
      const subject = subjects.delta(viewId)
      return nats.subscribeJson<unknown>(subject).pipe(
        Stream.mapError(mapNatsError(viewId)),
        Stream.mapEffect((msg) =>
          decodeJson(ViewDelta, msg.subject)(msg.data)
        )
      )
    },

    subscribeAllArtifacts: () => {
      const subject = subjects.allArtifacts()
      return nats.subscribeJson<unknown>(subject).pipe(
        Stream.mapError(mapNatsError('*')),
        Stream.mapEffect((msg) =>
          decodeJson(TaggedArtifact, msg.subject)(msg.data)
        )
      )
    },

    subscribeAllDeltas: () => {
      const subject = subjects.allDeltas()
      return nats.subscribeJson<unknown>(subject).pipe(
        Stream.mapError(mapNatsError('*')),
        Stream.mapEffect((msg) =>
          decodeJson(TaggedDelta, msg.subject)(msg.data)
        )
      )
    },

    subscribeEvents: () => {
      const subject = subjects.events()
      return nats.subscribeJson<unknown>(subject).pipe(
        Stream.mapError(mapNatsError('events')),
        Stream.mapEffect((msg) =>
          decodeJson(ReconcilerEvent, msg.subject)(msg.data)
        )
      )
    },

    subscribeStatus: (viewId) => {
      const subject = subjects.status(viewId)
      return nats.subscribeJson<unknown>(subject).pipe(
        Stream.mapError(mapNatsError(viewId)),
        Stream.mapEffect((msg) =>
          decodeJson(ViewStatusEvent, msg.subject)(msg.data)
        )
      )
    },

    invalidate: (viewId, reason) =>
      nats
        .publishJson(subjects.invalidate(viewId), {
          view_id: viewId,
          reason,
          force: false,
        })
        .pipe(
          Effect.mapError(
            (e) =>
              new AvaInvalidationError({
                viewId,
                message: e.message,
                cause: e,
              })
          ),
          Effect.tap(() =>
            Effect.logDebug(`Invalidated view: ${viewId}`, { reason })
          )
        ),

    requestSubscribe: (viewId) =>
      nats
        .publishJson(subjects.subscribe(viewId), {
          view_id: viewId,
        })
        .pipe(
          Effect.mapError(
            (e) =>
              new AvaInvalidationError({
                viewId,
                message: e.message,
                cause: e,
              })
          ),
          Effect.tap(() =>
            Effect.logDebug(`Requested subscription: ${viewId}`)
          )
        ),

    requestUnsubscribe: (viewId) =>
      nats
        .publishJson(subjects.unsubscribe(viewId), {
          view_id: viewId,
        })
        .pipe(
          Effect.mapError(
            (e) =>
              new AvaInvalidationError({
                viewId,
                message: e.message,
                cause: e,
              })
          ),
          Effect.tap(() =>
            Effect.logDebug(`Requested unsubscription: ${viewId}`)
          )
        ),

    activeSubscriptions: Ref.get(subscriptionsRef).pipe(
      Effect.map(HashMap.size)
    ),
  }

  return service
})

// ============================================================================
// Layers
// ============================================================================

/**
 * Live layer for AvaClientV2
 * Requires NatsClient and AvaClientV2Config in context
 */
export const AvaClientV2Live = Layer.effect(AvaClientV2, make)

/**
 * Full layer with NatsClient
 * Requires NatsConfig and AvaClientV2Config
 */
export const AvaClientV2WithNats = pipe(
  AvaClientV2Live,
  Layer.provide(NatsClientLive)
)

/**
 * Default layer with localhost configuration
 */
export const AvaClientV2Default = pipe(
  AvaClientV2WithNats,
  Layer.provide(
    Layer.succeed(NatsConfigTag, {
      serverUrl: 'ws://localhost:8222',
      subjectPrefix: 'tmnl.ava',
      timeout: 30000,
      maxReconnectAttempts: 0,
      reconnectDelayMs: 1000,
    })
  ),
  Layer.provide(
    Layer.succeed(AvaClientV2ConfigTag, {
      subjectPrefix: 'tmnl.ava',
      subscribeTimeout: 30000,
      bufferSize: 1000,
    })
  )
)

/**
 * Create layer with custom NATS configuration
 */
export const makeAvaClientV2Layer = (
  natsConfig: NatsConfig,
  clientConfig?: Partial<AvaClientV2Config>
) =>
  pipe(
    AvaClientV2WithNats,
    Layer.provide(Layer.succeed(NatsConfigTag, natsConfig)),
    Layer.provide(
      Layer.succeed(AvaClientV2ConfigTag, {
        subjectPrefix: clientConfig?.subjectPrefix ?? 'tmnl.ava',
        subscribeTimeout: clientConfig?.subscribeTimeout ?? 30000,
        bufferSize: clientConfig?.bufferSize ?? 1000,
      })
    )
  )
