/**
 * MSH NATS Error Architecture
 *
 * Namespace-scoped, method-scoped errors organized by:
 * 1. Service - which service owns the error
 * 2. Method - which method/operation failed
 * 3. Union - grouped for convenient error handling
 *
 * All errors are Schema.TaggedErrorClass — yieldable in Effect.gen,
 * catchable via Effect.catchTags, serializable via Schema encode/decode.
 *
 * @module @tmnl/msh/nats/errors
 */

import * as Schema from 'effect/Schema';

// =============================================================================
// CONNECTION SERVICE ERRORS
// =============================================================================

export namespace Connection {
  /**
   * Failed to establish NATS connection.
   */
  export class ConnectError extends Schema.TaggedErrorClass<ConnectError>(
    '@tmnl/msh/Connection.ConnectError',
  )('Connection/Connect', {
    message: Schema.String,
    servers: Schema.Union([Schema.String, Schema.Array(Schema.String)]),
    cause: Schema.optional(Schema.Unknown),
  }) {}

  /**
   * Connection was closed unexpectedly.
   */
  export class DisconnectError extends Schema.TaggedErrorClass<DisconnectError>(
    '@tmnl/msh/Connection.DisconnectError',
  )('Connection/Disconnect', {
    message: Schema.String,
    wasClean: Schema.Boolean,
    cause: Schema.optional(Schema.Unknown),
  }) {}

  /**
   * Failed to get JetStream manager.
   */
  export class JetStreamManagerError extends Schema.TaggedErrorClass<JetStreamManagerError>(
    '@tmnl/msh/Connection.JetStreamManagerError',
  )('Connection/JetStreamManager', {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }) {}

  /** Union for Connection service errors */
  export type Error = ConnectError | DisconnectError | JetStreamManagerError;
}

// =============================================================================
// INNER SERVICE ERRORS (by namespace)
// =============================================================================

export namespace Inner {
  // ─── Core Pub/Sub (nc.*) ────────────────────────────────────────────────────
  export namespace Core {
    /**
     * Failed to publish message via core NATS.
     */
    export class PublishError extends Schema.TaggedErrorClass<PublishError>(
      '@tmnl/msh/Inner.Core.PublishError',
    )('Inner/Core/Publish', {
      message: Schema.String,
      subject: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Failed to subscribe to subject.
     */
    export class SubscribeError extends Schema.TaggedErrorClass<SubscribeError>(
      '@tmnl/msh/Inner.Core.SubscribeError',
    )('Inner/Core/Subscribe', {
      message: Schema.String,
      subject: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Request-reply operation failed.
     */
    export class RequestError extends Schema.TaggedErrorClass<RequestError>(
      '@tmnl/msh/Inner.Core.RequestError',
    )('Inner/Core/Request', {
      message: Schema.String,
      subject: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Request-reply timed out.
     */
    export class TimeoutError extends Schema.TaggedErrorClass<TimeoutError>(
      '@tmnl/msh/Inner.Core.TimeoutError',
    )('Inner/Core/Timeout', {
      subject: Schema.String,
      timeoutMs: Schema.Number,
    }) {}

    /**
     * Failed to flush pending publishes.
     */
    export class FlushError extends Schema.TaggedErrorClass<FlushError>(
      '@tmnl/msh/Inner.Core.FlushError',
    )('Inner/Core/Flush', {
      message: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /** Union for core operations */
    export type Error = PublishError | SubscribeError | RequestError | TimeoutError | FlushError;
  }

  // ─── KV Operations (js.views.kv) ────────────────────────────────────────────
  export namespace KV {
    /**
     * Failed to access KV bucket.
     */
    export class BucketError extends Schema.TaggedErrorClass<BucketError>(
      '@tmnl/msh/Inner.KV.BucketError',
    )('Inner/KV/Bucket', {
      message: Schema.String,
      bucketName: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Failed to get value from KV.
     */
    export class GetError extends Schema.TaggedErrorClass<GetError>(
      '@tmnl/msh/Inner.KV.GetError',
    )('Inner/KV/Get', {
      message: Schema.String,
      bucketName: Schema.String,
      key: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Failed to put value to KV.
     */
    export class PutError extends Schema.TaggedErrorClass<PutError>(
      '@tmnl/msh/Inner.KV.PutError',
    )('Inner/KV/Put', {
      message: Schema.String,
      bucketName: Schema.String,
      key: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * KV optimistic-concurrency revision mismatch.
     */
    export class RevisionConflictError extends Schema.TaggedErrorClass<RevisionConflictError>(
      '@tmnl/msh/Inner.KV.RevisionConflictError',
    )('Inner/KV/RevisionConflict', {
      message: Schema.String,
      bucketName: Schema.String,
      key: Schema.String,
      expectedRevision: Schema.Number,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Failed to delete key from KV.
     */
    export class DeleteError extends Schema.TaggedErrorClass<DeleteError>(
      '@tmnl/msh/Inner.KV.DeleteError',
    )('Inner/KV/Delete', {
      message: Schema.String,
      bucketName: Schema.String,
      key: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Failed to watch KV for changes.
     */
    export class WatchError extends Schema.TaggedErrorClass<WatchError>(
      '@tmnl/msh/Inner.KV.WatchError',
    )('Inner/KV/Watch', {
      message: Schema.String,
      bucketName: Schema.String,
      key: Schema.optional(Schema.String),
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /** Union for KV operations */
    export type Error = BucketError | GetError | PutError | RevisionConflictError | DeleteError | WatchError;
  }

  // ─── Stream Management (jsm.streams) ────────────────────────────────────────
  export namespace Streams {
    /**
     * Failed to get stream info.
     */
    export class InfoError extends Schema.TaggedErrorClass<InfoError>(
      '@tmnl/msh/Inner.Streams.InfoError',
    )('Inner/Streams/Info', {
      message: Schema.String,
      streamName: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Failed to create stream.
     */
    export class AddError extends Schema.TaggedErrorClass<AddError>(
      '@tmnl/msh/Inner.Streams.AddError',
    )('Inner/Streams/Add', {
      message: Schema.String,
      streamName: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Failed to update stream.
     */
    export class UpdateError extends Schema.TaggedErrorClass<UpdateError>(
      '@tmnl/msh/Inner.Streams.UpdateError',
    )('Inner/Streams/Update', {
      message: Schema.String,
      streamName: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Failed to delete stream.
     */
    export class DeleteError extends Schema.TaggedErrorClass<DeleteError>(
      '@tmnl/msh/Inner.Streams.DeleteError',
    )('Inner/Streams/Delete', {
      message: Schema.String,
      streamName: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /** Union for stream management */
    export type Error = InfoError | AddError | UpdateError | DeleteError;
  }

  // ─── JetStream Publish (js.publish) ─────────────────────────────────────────
  export namespace Publish {
    /**
     * Failed to publish to JetStream.
     */
    export class PublishError extends Schema.TaggedErrorClass<PublishError>(
      '@tmnl/msh/Inner.Publish.PublishError',
    )('Inner/Publish/Publish', {
      message: Schema.String,
      subject: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Message detected as duplicate within stream's duplicate_window.
     */
    export class DuplicateError extends Schema.TaggedErrorClass<DuplicateError>(
      '@tmnl/msh/Inner.Publish.DuplicateError',
    )('Inner/Publish/Duplicate', {
      subject: Schema.String,
      msgId: Schema.optional(Schema.String),
      seq: Schema.Number,
    }) {}

    /** Union for JetStream publish */
    export type Error = PublishError | DuplicateError;
  }

  // ─── Consumer Operations (js.consumers, jsm.consumers) ──────────────────────
  export namespace Consumers {
    /**
     * Failed to get consumer.
     */
    export class GetError extends Schema.TaggedErrorClass<GetError>(
      '@tmnl/msh/Inner.Consumers.GetError',
    )('Inner/Consumers/Get', {
      message: Schema.String,
      streamName: Schema.String,
      consumerName: Schema.optional(Schema.String),
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Failed to add consumer.
     */
    export class AddError extends Schema.TaggedErrorClass<AddError>(
      '@tmnl/msh/Inner.Consumers.AddError',
    )('Inner/Consumers/Add', {
      message: Schema.String,
      streamName: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Failed to delete consumer.
     */
    export class DeleteError extends Schema.TaggedErrorClass<DeleteError>(
      '@tmnl/msh/Inner.Consumers.DeleteError',
    )('Inner/Consumers/Delete', {
      message: Schema.String,
      streamName: Schema.String,
      consumerName: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /**
     * Failed to start consuming messages.
     */
    export class ConsumeError extends Schema.TaggedErrorClass<ConsumeError>(
      '@tmnl/msh/Inner.Consumers.ConsumeError',
    )('Inner/Consumers/Consume', {
      message: Schema.String,
      streamName: Schema.String,
      cause: Schema.optional(Schema.Unknown),
    }) {}

    /** Union for consumer operations */
    export type Error = GetError | AddError | DeleteError | ConsumeError;
  }

  // ─── Full Inner Service Error Union ─────────────────────────────────────────
  export type Error =
    | Core.Error
    | KV.Error
    | Streams.Error
    | Publish.Error
    | Consumers.Error;
}

// =============================================================================
// CODEC ERRORS (shared across high-level services)
// =============================================================================

export namespace Codec {
  /**
   * Failed to encode message payload.
   */
  export class EncodeError extends Schema.TaggedErrorClass<EncodeError>(
    '@tmnl/msh/Codec.EncodeError',
  )('Codec/Encode', {
    message: Schema.String,
    schemaId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  }) {}

  /**
   * Failed to decode message payload.
   */
  export class DecodeError extends Schema.TaggedErrorClass<DecodeError>(
    '@tmnl/msh/Codec.DecodeError',
  )('Codec/Decode', {
    message: Schema.String,
    subject: Schema.optional(Schema.String),
    schemaId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  }) {}

  export type Error = EncodeError | DecodeError;
}

// =============================================================================
// HIGH-LEVEL SERVICE ERRORS (combine Inner + Codec)
// =============================================================================

/**
 * Errors for NatsPubSubService (Core pub/sub with Schema codecs).
 */
export namespace PubSub {
  /** publish can fail with Inner.Core.PublishError or Codec.EncodeError */
  export type PublishError = Inner.Core.PublishError | Codec.EncodeError;

  /** subscribe can fail with Inner.Core.SubscribeError or Codec.DecodeError */
  export type SubscribeError = Inner.Core.SubscribeError | Codec.DecodeError;

  /** request can fail with multiple error types */
  export type RequestError =
    | Inner.Core.RequestError
    | Inner.Core.TimeoutError
    | Codec.EncodeError
    | Codec.DecodeError;

  export type Error = PublishError | SubscribeError | RequestError;
}

/**
 * Errors for NatsKVService (KV with Schema codecs).
 */
export namespace KV {
  /**
   * Key not found in KV bucket.
   */
  export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>(
    '@tmnl/msh/KV.NotFoundError',
  )('KV/NotFound', {
    bucketName: Schema.String,
    key: Schema.String,
  }) {}

  export type GetError = Inner.KV.BucketError | Inner.KV.GetError | NotFoundError | Codec.DecodeError;
  export type PutError = Inner.KV.BucketError | Inner.KV.PutError | Inner.KV.RevisionConflictError | Codec.EncodeError;
  export type DeleteError = Inner.KV.BucketError | Inner.KV.DeleteError | Inner.KV.RevisionConflictError;
  export type WatchError = Inner.KV.BucketError | Inner.KV.WatchError | Codec.DecodeError;

  export type Error = Inner.KV.Error | NotFoundError | Codec.Error;
}

/**
 * Errors for NatsStreamService (JetStream streams with Schema codecs).
 */
export namespace Stream {
  export class ConfigMismatchError extends Schema.TaggedErrorClass<ConfigMismatchError>(
    '@tmnl/msh/Stream.ConfigMismatchError',
  )('Stream/ConfigMismatch', {
    message: Schema.String,
    streamName: Schema.String,
    mismatches: Schema.Array(Schema.String),
  }) {}

  export type EnsureStreamError = Inner.Streams.InfoError | Inner.Streams.AddError | ConfigMismatchError;
  export type PublishError = Inner.Publish.Error | Codec.EncodeError;
  export type SubscribeError = Inner.Consumers.Error | Codec.DecodeError;

  export type Error = Inner.Streams.Error | Inner.Publish.Error | Inner.Consumers.Error | Codec.Error;
}

// =============================================================================
// MICRO SERVICE ERRORS
// =============================================================================

/**
 * Errors for NatsMicroService and discovery wrappers.
 */
export namespace Micro {
  /**
   * Failed to register/start a micro service via nc.services.add().
   */
  export class AddServiceError extends Schema.TaggedErrorClass<AddServiceError>(
    '@tmnl/msh/Micro.AddServiceError',
  )('Micro/AddService', {
    message: Schema.String,
    serviceName: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }) {}

  /**
   * Failed to create a discovery client via nc.services.client().
   */
  export class ClientCreationError extends Schema.TaggedErrorClass<ClientCreationError>(
    '@tmnl/msh/Micro.ClientCreationError',
  )('Micro/ClientCreation', {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }) {}

  /**
   * Failed while querying micro discovery APIs (PING/INFO/STATS).
   */
  export class DiscoveryQueryError extends Schema.TaggedErrorClass<DiscoveryQueryError>(
    '@tmnl/msh/Micro.DiscoveryQueryError',
  )('Micro/DiscoveryQuery', {
    message: Schema.String,
    operation: Schema.Literals(['ping', 'info', 'stats'] as const),
    serviceName: Schema.optional(Schema.String),
    serviceId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  }) {}

  /**
   * Failed to drain/stop a micro service instance.
   */
  export class StopServiceError extends Schema.TaggedErrorClass<StopServiceError>(
    '@tmnl/msh/Micro.StopServiceError',
  )('Micro/StopService', {
    message: Schema.String,
    serviceName: Schema.String,
    serviceId: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  }) {}

  export type Error =
    | AddServiceError
    | ClientCreationError
    | DiscoveryQueryError
    | StopServiceError;
}

// =============================================================================
// HUB SERVICE ERRORS
// =============================================================================

/**
 * Errors for NatsHub service (connection hub with local PubSub fan-out).
 */
export namespace Hub {
  /**
   * Failed to create or access a subject hub.
   */
  export class HubCreationError extends Schema.TaggedErrorClass<HubCreationError>(
    '@tmnl/msh/Hub.HubCreationError',
  )('Hub/Creation', {
    message: Schema.String,
    subject: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }) {}

  /**
   * Failed to publish through the hub.
   */
  export class HubPublishError extends Schema.TaggedErrorClass<HubPublishError>(
    '@tmnl/msh/Hub.HubPublishError',
  )('Hub/Publish', {
    message: Schema.String,
    subject: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }) {}

  /**
   * Hub capacity exceeded (if using bounded PubSub).
   */
  export class HubCapacityError extends Schema.TaggedErrorClass<HubCapacityError>(
    '@tmnl/msh/Hub.HubCapacityError',
  )('Hub/Capacity', {
    message: Schema.String,
    subject: Schema.String,
  }) {}

  /**
   * No matching hub found for subject when publishing.
   */
  export class NoMatchingHubError extends Schema.TaggedErrorClass<NoMatchingHubError>(
    '@tmnl/msh/Hub.NoMatchingHubError',
  )('Hub/NoMatch', {
    message: Schema.String,
    subject: Schema.String,
    availablePatterns: Schema.Array(Schema.String),
  }) {}

  /** Subscribe errors include hub creation and codec decode */
  export type SubscribeError =
    | HubCreationError
    | Inner.Core.SubscribeError
    | Codec.DecodeError;

  /** Publish errors include hub publish, codec encode, and inner publish */
  export type PublishError =
    | HubPublishError
    | HubCapacityError
    | Inner.Core.PublishError
    | Codec.EncodeError;

  /** Union of all hub errors */
  export type Error =
    | HubCreationError
    | HubPublishError
    | HubCapacityError
    | NoMatchingHubError;
}

// =============================================================================
// TOP-LEVEL UNION (for catch-all handling)
// =============================================================================

/**
 * Union of all NATS-related errors.
 * Use for catch-all error handling when you want to handle any NATS error.
 */
export type NatsError =
  | Connection.Error
  | Inner.Error
  | Codec.Error
  | KV.NotFoundError
  | Hub.Error
  | Micro.Error;
