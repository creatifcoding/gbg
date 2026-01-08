/**
 * AVA Services Module
 *
 * Effect-based services for AVA v2 reactive streaming architecture.
 *
 * @module
 */

// NATS WebSocket Client
export {
  // Config
  NatsConfig,
  NatsConfigTag,
  // Errors
  NatsConnectionError,
  NatsSubscriptionError,
  NatsPublishError,
  NatsDecodeError,
  type NatsError,
  // Types
  type NatsMessage,
  type SubscriptionOptions,
  // Service
  NatsClient,
  // Layers
  NatsClientLive,
  NatsClientDefault,
  makeNatsClientLayer,
} from './NatsClient'

// AVA Client V2 (NATS-based)
export {
  // Config
  AvaClientV2Config,
  AvaClientV2ConfigTag,
  // Errors
  AvaSubscriptionError,
  AvaInvalidationError,
  AvaDecodeError,
  type AvaClientV2Error,
  // Service
  AvaClientV2,
  // Layers
  AvaClientV2Live,
  AvaClientV2WithNats,
  AvaClientV2Default,
  makeAvaClientV2Layer,
} from './AvaClientV2'
