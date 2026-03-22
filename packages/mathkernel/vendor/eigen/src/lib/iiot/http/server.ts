/**
 * IIoT HTTP Server Composition
 *
 * Main server composition serving dual interfaces:
 * 1. REST API via HttpApiBuilder.serve() at /api/*
 * 2. Raw RPC via RpcServer.layerProtocolHttpRouter() at /rpc
 *
 * Architecture:
 * ```
 * HttpApiBuilder.serve()
 *   -> HttpApiBuilder.middlewareCors() (CORS)
 *   -> HttpApiSwagger.layer() (/docs)
 *   -> ApiLive (EntityProxyServer REST handlers)
 *   -> IIoTRpcServer (raw /rpc endpoint)
 *   -> EntityHandlersLayer (entity behaviors)
 *   -> AllStateServicesInMemory (in-memory state)
 *   -> IIoTFeatureFlagsDisabledLayer (feature flags)
 *   -> IIoTRateLimitDisabledLayer (rate limiting -- disabled for dev)
 *   -> ClusterDev (in-memory cluster from cluster.ts)
 *   -> BunHttpServer.layer (Bun HTTP transport)
 * ```
 *
 * The REST API serves human-friendly endpoints:
 *   POST /api/plants/Create/:entityId
 *   POST /api/alarms/Acknowledge/:entityId
 *
 * The raw /rpc endpoint serves binary clients:
 *   POST /rpc (ndjson wire format)
 *
 * Production upgrade:
 * - Replace ClusterDev with ClusterProd from cluster.ts
 *   and provide SqlClient (e.g. @effect/sql-pg) for SQL storage.
 * - Replace IIoTRateLimitDisabledLayer with:
 *   IIoTRateLimitLayer({ maxRequests: 100, windowMs: 60_000 })
 *   to enforce per-client request throttling (429 with Retry-After).
 *
 * @module @gbg/tmnl/iiot/http/server
 */

import { HttpApiBuilder, HttpApiSwagger, HttpMiddleware } from '@effect/platform'
import { BunHttpServer, BunRuntime } from '@effect/platform-bun'
import { Layer } from 'effect'
import { IIoTApi } from './api'
import { ClusterDev } from './cluster'
import { ProxyHandlers } from './proxy-handlers'
import { QueryHandlers } from './query-handlers'
import { IIoTRpcServer } from './rpc-server'
import { EntityHandlersLayer } from '../entity/EntityStack'
import { AllStateServicesInMemory } from '../state'
import { IIoTFeatureFlagsDisabledLayer } from '../infrastructure/feature-flags'
import { IIoTAuthDisabledLayer } from './middleware/auth'
import { IIoTRateLimitDisabledLayer } from './middleware/rate-limit'
// Note: IIoTRateLimitMiddleware is declared on IIoTApi via .middleware()
// The layer provides the implementation (disabled = passthrough for dev)

// =============================================================================
// API Implementation Layer
// =============================================================================

/**
 * HttpApi implementation layer.
 *
 * Composes all EntityProxyServer.layerHttpApi handlers into
 * a single layer that satisfies the IIoTApi contract.
 *
 * Each ProxyHandler routes HTTP requests through the cluster:
 *   HTTP POST /api/alarms/acknowledge/:entityId
 *     -> EntityProxyServer handler
 *       -> entity.client(entityId).Acknowledge(payload)
 *         -> Sharding -> EntityManager -> Mailbox -> Entity behavior
 */
const ApiLive = HttpApiBuilder.api(IIoTApi).pipe(
  Layer.provide(ProxyHandlers),
  Layer.provide(QueryHandlers)
)

// =============================================================================
// Dev Server (In-Memory Cluster)
// =============================================================================

/**
 * Development HTTP server with in-memory cluster.
 *
 * Uses TestRunner.layer for zero-dependency local development:
 * - No PostgreSQL required
 * - No distributed infrastructure
 * - In-memory MessageStorage and RunnerStorage
 * - Feature flags disabled (CRUD mode)
 *
 * Serves:
 * - REST endpoints at /api/* (auto-generated from entities)
 * - Raw RPC endpoint at /rpc (ndjson wire format)
 * - Swagger UI at /docs
 * - OpenAPI spec at /docs/openapi.json
 */
export const IIoTHttpServerDev = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provide(ApiLive),
  Layer.provide(IIoTRpcServer),
  Layer.provide(EntityHandlersLayer),
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
  Layer.provide(IIoTAuthDisabledLayer),
  Layer.provide(IIoTRateLimitDisabledLayer),
  Layer.provide(ClusterDev),
  Layer.provide(BunHttpServer.layer({ port: 3000 }))
)

// =============================================================================
// Boot
// =============================================================================

/**
 * Boot the development server.
 *
 * ```bash
 * bun run src/lib/iiot/http/server.ts
 * ```
 *
 * Endpoints:
 * - REST API:  http://localhost:3000/api/*
 * - Raw RPC:   http://localhost:3000/rpc
 * - Swagger:   http://localhost:3000/docs
 */
export const main = Layer.launch(IIoTHttpServerDev).pipe(
  BunRuntime.runMain
)
