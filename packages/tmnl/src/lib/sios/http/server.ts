/**
 * SIOS HTTP Server Composition
 *
 * Main server composition serving REST API via HttpApiBuilder.
 *
 * @module sios/http/server
 */

import { HttpApiBuilder, HttpApiSwagger, HttpMiddleware } from '@effect/platform'
import { BunHttpServer, BunRuntime } from '@effect/platform-bun'
import { Layer } from 'effect'
import { SiosApi } from './api'
import { ClusterDev } from './cluster'
import { ProxyHandlers } from './proxy-handlers'
import { QueryHandlers } from './query-handlers'
import { AllEntityHandlers } from '../entity/EntityStack'
import { AllStateServicesInMemory } from '../state'
import { SiosFlagsDisabledLayer } from '../infrastructure'

// =============================================================================
// API Implementation Layer
// =============================================================================

const ApiLive = HttpApiBuilder.api(SiosApi).pipe(
  Layer.provide(ProxyHandlers),
  Layer.provide(QueryHandlers),
)

// =============================================================================
// Dev Server (In-Memory Cluster)
// =============================================================================

export const SiosHttpServerDev = HttpApiBuilder.serve(HttpMiddleware.cors()).pipe(
  Layer.provide(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provide(ApiLive),
  Layer.provide(AllEntityHandlers),
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(SiosFlagsDisabledLayer),
  Layer.provide(ClusterDev),
  Layer.provide(BunHttpServer.layer({ port: 3000 })),
)

// =============================================================================
// Boot
// =============================================================================

export const main = Layer.launch(SiosHttpServerDev).pipe(
  BunRuntime.runMain,
)
