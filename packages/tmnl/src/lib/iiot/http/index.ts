/**
 * IIoT HTTP Module — REST API, RPC Server, and Middleware
 *
 * Provides the HTTP layer for the IIoT system:
 * - REST API at /api/* via HttpApiBuilder (auto-generated from entities)
 * - Raw RPC at /rpc via RpcServer (ndjson or msgpack wire format)
 * - Swagger/OpenAPI at /docs
 * - Auth and rate-limiting middleware
 *
 * @module @gbg/tmnl/iiot/http
 * @see {@link IIoTApi} for the combined HttpApi definition
 * @see {@link IIoTHttpServerDev} for the dev server composition
 */

// =============================================================================
// API Definition & Server
// =============================================================================

/** Combined HttpApi with all 13 entity domains + query groups */
export { IIoTApi } from './api'

/** Dev server composition (in-memory cluster, no external deps) */
export { IIoTHttpServerDev } from './server'

// =============================================================================
// Cluster Layers
// =============================================================================

/** In-memory cluster for development, distributed cluster for production */
export { ClusterDev, ClusterProd } from './cluster'

// =============================================================================
// RPC Server
// =============================================================================

/** Raw /rpc endpoint layers (ndjson for dev, msgpack for prod) */
export { IIoTRpcServer, IIoTRpcNdjson, IIoTRpcMsgPack } from './rpc-server'

// =============================================================================
// Handlers
// =============================================================================

/** EntityProxy REST handlers for all entity domains */
export { ProxyHandlers } from './proxy-handlers'

/** Stateless query handlers (sensor readings, asset hierarchy, alarms, work orders) */
export { QueryHandlers } from './query-handlers'

/** Stateless query HttpApiGroups (not entity-derived) */
export { AssetQueryGroup, SensorQueryGroup, AlarmQueryGroup, WorkOrderQueryGroup } from './query-api'

// =============================================================================
// Health
// =============================================================================

/** Health check endpoint */
export { healthCheck } from './health'

// =============================================================================
// Auth Middleware
// =============================================================================

/** Bearer token auth middleware with enabled/disabled layers */
export {
  IIoTAuthMiddleware,
  IIoTAuthBearerLayer,
  IIoTAuthDisabledLayer,
  IIoTUnauthorized,
  IIoTAuthConfig,
} from './middleware/auth'

// =============================================================================
// Rate Limiting Middleware
// =============================================================================

/** Per-client request throttling with 429 Retry-After responses */
export {
  IIoTRateLimitMiddleware,
  IIoTRateLimitEnabledLayer,
  IIoTRateLimitDisabledLayer,
  IIoTRateLimitExceeded,
} from './middleware/rate-limit'
