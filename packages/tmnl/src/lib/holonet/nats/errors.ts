/**
 * Holonet NATS Error Architecture
 *
 * Namespace-scoped, method-scoped errors organized by:
 * 1. Service - which service owns the error
 * 2. Method - which method/operation failed
 * 3. Union - grouped for convenient error handling
 *
 * @module holonet/nats/errors
 */

import { Data } from 'effect';

// =============================================================================
// CONNECTION SERVICE ERRORS
// =============================================================================

export namespace Connection {
  /**
   * Failed to establish NATS connection.
   */
  export class ConnectError extends Data.TaggedError('Connection/Connect')<{
    readonly message: string;
    readonly servers: string | readonly string[];
    readonly cause?: unknown;
  }> {}

  /**
   * Connection was closed unexpectedly.
   */
  export class DisconnectError extends Data.TaggedError('Connection/Disconnect')<{
    readonly message: string;
    readonly wasClean: boolean;
    readonly cause?: unknown;
  }> {}

  /**
   * Failed to get JetStream manager.
   */
  export class JetStreamManagerError extends Data.TaggedError('Connection/JetStreamManager')<{
    readonly message: string;
    readonly cause?: unknown;
  }> {}

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
    export class PublishError extends Data.TaggedError('Inner/Core/Publish')<{
      readonly message: string;
      readonly subject: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Failed to subscribe to subject.
     */
    export class SubscribeError extends Data.TaggedError('Inner/Core/Subscribe')<{
      readonly message: string;
      readonly subject: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Request-reply operation failed.
     */
    export class RequestError extends Data.TaggedError('Inner/Core/Request')<{
      readonly message: string;
      readonly subject: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Request-reply timed out.
     */
    export class TimeoutError extends Data.TaggedError('Inner/Core/Timeout')<{
      readonly subject: string;
      readonly timeoutMs: number;
    }> {}

    /**
     * Failed to flush pending publishes.
     */
    export class FlushError extends Data.TaggedError('Inner/Core/Flush')<{
      readonly message: string;
      readonly cause?: unknown;
    }> {}

    /** Union for core operations */
    export type Error = PublishError | SubscribeError | RequestError | TimeoutError | FlushError;
  }

  // ─── KV Operations (js.views.kv) ────────────────────────────────────────────
  export namespace KV {
    /**
     * Failed to access KV bucket.
     */
    export class BucketError extends Data.TaggedError('Inner/KV/Bucket')<{
      readonly message: string;
      readonly bucketName: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Failed to get value from KV.
     */
    export class GetError extends Data.TaggedError('Inner/KV/Get')<{
      readonly message: string;
      readonly bucketName: string;
      readonly key: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Failed to put value to KV.
     */
    export class PutError extends Data.TaggedError('Inner/KV/Put')<{
      readonly message: string;
      readonly bucketName: string;
      readonly key: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Failed to delete key from KV.
     */
    export class DeleteError extends Data.TaggedError('Inner/KV/Delete')<{
      readonly message: string;
      readonly bucketName: string;
      readonly key: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Failed to watch KV for changes.
     */
    export class WatchError extends Data.TaggedError('Inner/KV/Watch')<{
      readonly message: string;
      readonly bucketName: string;
      readonly key?: string;
      readonly cause?: unknown;
    }> {}

    /** Union for KV operations */
    export type Error = BucketError | GetError | PutError | DeleteError | WatchError;
  }

  // ─── Stream Management (jsm.streams) ────────────────────────────────────────
  export namespace Streams {
    /**
     * Failed to get stream info.
     */
    export class InfoError extends Data.TaggedError('Inner/Streams/Info')<{
      readonly message: string;
      readonly streamName: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Failed to create stream.
     */
    export class AddError extends Data.TaggedError('Inner/Streams/Add')<{
      readonly message: string;
      readonly streamName: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Failed to update stream.
     */
    export class UpdateError extends Data.TaggedError('Inner/Streams/Update')<{
      readonly message: string;
      readonly streamName: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Failed to delete stream.
     */
    export class DeleteError extends Data.TaggedError('Inner/Streams/Delete')<{
      readonly message: string;
      readonly streamName: string;
      readonly cause?: unknown;
    }> {}

    /** Union for stream management */
    export type Error = InfoError | AddError | UpdateError | DeleteError;
  }

  // ─── JetStream Publish (js.publish) ─────────────────────────────────────────
  export namespace Publish {
    /**
     * Failed to publish to JetStream.
     */
    export class PublishError extends Data.TaggedError('Inner/Publish/Publish')<{
      readonly message: string;
      readonly subject: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Message detected as duplicate within stream's duplicate_window.
     */
    export class DuplicateError extends Data.TaggedError('Inner/Publish/Duplicate')<{
      readonly subject: string;
      readonly msgId?: string;
      readonly seq: number;
    }> {}

    /** Union for JetStream publish */
    export type Error = PublishError | DuplicateError;
  }

  // ─── Consumer Operations (js.consumers, jsm.consumers) ──────────────────────
  export namespace Consumers {
    /**
     * Failed to get consumer.
     */
    export class GetError extends Data.TaggedError('Inner/Consumers/Get')<{
      readonly message: string;
      readonly streamName: string;
      readonly consumerName?: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Failed to add consumer.
     */
    export class AddError extends Data.TaggedError('Inner/Consumers/Add')<{
      readonly message: string;
      readonly streamName: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Failed to delete consumer.
     */
    export class DeleteError extends Data.TaggedError('Inner/Consumers/Delete')<{
      readonly message: string;
      readonly streamName: string;
      readonly consumerName: string;
      readonly cause?: unknown;
    }> {}

    /**
     * Failed to start consuming messages.
     */
    export class ConsumeError extends Data.TaggedError('Inner/Consumers/Consume')<{
      readonly message: string;
      readonly streamName: string;
      readonly cause?: unknown;
    }> {}

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
  export class EncodeError extends Data.TaggedError('Codec/Encode')<{
    readonly message: string;
    readonly schemaId?: string;
    readonly cause?: unknown;
  }> {}

  /**
   * Failed to decode message payload.
   */
  export class DecodeError extends Data.TaggedError('Codec/Decode')<{
    readonly message: string;
    readonly subject?: string;
    readonly schemaId?: string;
    readonly cause?: unknown;
  }> {}

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
  export class NotFoundError extends Data.TaggedError('KV/NotFound')<{
    readonly bucketName: string;
    readonly key: string;
  }> {}

  export type GetError = Inner.KV.BucketError | Inner.KV.GetError | NotFoundError | Codec.DecodeError;
  export type PutError = Inner.KV.BucketError | Inner.KV.PutError | Codec.EncodeError;
  export type DeleteError = Inner.KV.BucketError | Inner.KV.DeleteError;
  export type WatchError = Inner.KV.BucketError | Inner.KV.WatchError | Codec.DecodeError;

  export type Error = Inner.KV.Error | NotFoundError | Codec.Error;
}

/**
 * Errors for NatsStreamService (JetStream streams with Schema codecs).
 */
export namespace Stream {
  export type EnsureStreamError = Inner.Streams.InfoError | Inner.Streams.AddError;
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
  export class AddServiceError extends Data.TaggedError('Micro/AddService')<{
    readonly message: string;
    readonly serviceName: string;
    readonly cause?: unknown;
  }> {}

  /**
   * Failed to create a discovery client via nc.services.client().
   */
  export class ClientCreationError extends Data.TaggedError('Micro/ClientCreation')<{
    readonly message: string;
    readonly cause?: unknown;
  }> {}

  /**
   * Failed while querying micro discovery APIs (PING/INFO/STATS).
   */
  export class DiscoveryQueryError extends Data.TaggedError('Micro/DiscoveryQuery')<{
    readonly message: string;
    readonly operation: 'ping' | 'info' | 'stats';
    readonly serviceName?: string;
    readonly serviceId?: string;
    readonly cause?: unknown;
  }> {}

  /**
   * Failed to drain/stop a micro service instance.
   */
  export class StopServiceError extends Data.TaggedError('Micro/StopService')<{
    readonly message: string;
    readonly serviceName: string;
    readonly serviceId?: string;
    readonly cause?: unknown;
  }> {}

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
  export class HubCreationError extends Data.TaggedError('Hub/Creation')<{
    readonly message: string;
    readonly subject: string;
    readonly cause?: unknown;
  }> {}

  /**
   * Failed to publish through the hub.
   */
  export class HubPublishError extends Data.TaggedError('Hub/Publish')<{
    readonly message: string;
    readonly subject: string;
    readonly cause?: unknown;
  }> {}

  /**
   * Hub capacity exceeded (if using bounded PubSub).
   */
  export class HubCapacityError extends Data.TaggedError('Hub/Capacity')<{
    readonly message: string;
    readonly subject: string;
  }> {}

  /**
   * No matching hub found for subject when publishing.
   */
  export class NoMatchingHubError extends Data.TaggedError('Hub/NoMatch')<{
    readonly message: string;
    readonly subject: string;
    readonly availablePatterns: readonly string[];
  }> {}

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
