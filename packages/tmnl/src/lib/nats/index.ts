/**
 * NATS Library
 *
 * General-purpose NATS integration with Effect.
 * Provides NatsKVService for JetStream KV operations.
 *
 * ## Usage
 *
 * ```typescript
 * // Namespace import (preferred)
 * import { Nats } from '@/lib/nats'
 *
 * const svc = yield* Nats.KV
 * const bucket = yield* svc.getOrCreateBucket('documents')
 *
 * // Or direct imports
 * import { NatsKVService, NatsConfig } from '@/lib/nats'
 * ```
 *
 * @module nats
 */

import {
  // Service
  NatsKVService,
  NatsKVServiceLive,
  NatsKVServiceCustom,
  // Config
  NatsConfigTag,
  // Errors
  NatsConnectionError,
  NatsKVError,
  NatsKVNotFoundError,
} from './NatsKVService';

// Re-export types
export type {
  NatsKVServiceShape,
  NatsConfig,
  TypedKvEntry,
  KvWatchEvent,
} from './NatsKVService';

// Re-export KV types from nats.ws package (browser-compatible)
export type { KV, KvWatchOptions } from 'nats.ws';

// =============================================================================
// Direct Exports (for granular imports)
// =============================================================================

export {
  NatsKVService,
  NatsKVServiceLive,
  NatsKVServiceCustom,
  NatsConfigTag,
  NatsConnectionError,
  NatsKVError,
  NatsKVNotFoundError,
};

// =============================================================================
// Namespace Alias
// =============================================================================

/**
 * NATS namespace for clean imports.
 *
 * @example
 * ```typescript
 * import { Nats } from '@/lib/nats'
 *
 * // Service access
 * const svc = yield* Nats.KV
 *
 * // Layer composition
 * Layer.provide(Nats.KV.Default)
 *
 * // Config customization
 * Nats.Config.Custom({ servers: 'ws://custom:9222' })
 *
 * // Error handling
 * Effect.catchTag('NatsKVNotFoundError', (e: Nats.Errors.NotFound) => ...)
 * ```
 */
export const Nats = {
  /** NatsKVService — main service for KV operations */
  KV: NatsKVService,

  /** Live layer for NatsKVService */
  KVLive: NatsKVServiceLive,

  /** Custom layer factory for NatsKVService */
  KVCustom: NatsKVServiceCustom,

  /** Configuration tag and layer factories */
  Config: NatsConfigTag,

  /** Error types */
  Errors: {
    Connection: NatsConnectionError,
    KV: NatsKVError,
    NotFound: NatsKVNotFoundError,
  },
} as const;

// Type exports for the namespace
export type NatsNamespace = typeof Nats;
