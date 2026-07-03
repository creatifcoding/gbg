/**
 * Prospect Pipeline — HTTP API Server
 *
 * Full Layer composition: HttpApi + EntityProxyServer + Queries + Swagger + Cluster + PG
 *
 * Serves:
 *   - Entity endpoints at /api/{companies|dms|signals|proposals|outreach}/*
 *   - Query endpoints at /api/queries/*
 *   - Swagger UI at /docs
 *   - OpenAPI spec at /docs/openapi.json
 *
 * Usage:
 *   bun run src/lib/prospects/api/server.ts
 *
 * @module prospects/api/server
 */

import { Effect, Layer } from 'effect'
import { HttpApiBuilder, HttpApiSwagger, HttpMiddleware } from '@effect/platform'
import { BunHttpServer, BunRuntime } from '@effect/platform-bun'
import { ClusterWorkflowEngine, TestRunner } from '@effect/cluster'
import { ProspectApi } from './contract'
import { ProxyHandlers } from './proxy-handlers'
import { QueryHandlers } from './query-handlers'
import { ProspectEntityHandlers } from '../entity/handlers/EntityStack'
import { HarvestWorkflowLayer } from '../workflows/harvest-workflow'
import {
  CompanyRepository,
  DecisionMakerRepository,
  SignalRepository,
  OutreachRepository,
  ProposalRepository,
} from '../services/repositories'
import { CIPScoring } from '../services/cip-scoring'
import { ProvenanceService } from '../services/provenance'
import { ProspectPgLayer } from '../models/pg-layer'

// =============================================================================
// Service Layer
// =============================================================================

const ProspectServicesLayer = Layer.mergeAll(
  CompanyRepository.Default,
  DecisionMakerRepository.Default,
  SignalRepository.Default,
  OutreachRepository.Default,
  ProposalRepository.Default,
  CIPScoring.Default,
  ProvenanceService.Default,
)

// =============================================================================
// API Implementation Layer
// =============================================================================

const ApiLive = HttpApiBuilder.api(ProspectApi).pipe(
  Layer.provide(ProxyHandlers),
  Layer.provide(QueryHandlers),
)

// =============================================================================
// Dev Server (In-Memory Cluster + PG)
// =============================================================================

const PORT = Number(process.env['PROSPECT_API_PORT'] ?? 3100)

/**
 * Development HTTP server.
 *
 * - TestRunner.layer for in-memory cluster
 * - PG for data persistence
 * - Swagger UI at /docs
 * - CORS enabled
 *
 * Entity endpoints:
 *   POST /api/companies/Company.Create/:entityId
 *   POST /api/dms/DecisionMaker.RecalculateCIP/:entityId
 *   etc.
 *
 * Query endpoints:
 *   GET /api/queries/companies/search?q=conveyor
 *   GET /api/queries/dms/top-cip?limit=10
 *   GET /api/queries/pipeline/summary
 *   etc.
 */
export const ProspectHttpServerDev = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provide(ApiLive),
  Layer.provide(ProspectEntityHandlers),
  Layer.provide(HarvestWorkflowLayer),
  Layer.provide(ClusterWorkflowEngine.layer),
  Layer.provide(ProspectServicesLayer),
  Layer.provide(TestRunner.layer),
  Layer.provide(ProspectPgLayer()),
  Layer.provide(BunHttpServer.layer({ port: PORT })),
)

// =============================================================================
// Boot
// =============================================================================

/**
 * Boot the development API server.
 *
 * ```bash
 * bun run src/lib/prospects/api/server.ts
 * ```
 *
 * Then visit:
 *   http://localhost:3100/docs          — Swagger UI
 *   http://localhost:3100/api/queries/pipeline/summary — Pipeline overview
 */
Layer.launch(ProspectHttpServerDev).pipe(
  Effect.tap(() => Effect.logInfo(`🚀 Prospect API server running on http://localhost:${PORT}`)),
  Effect.tap(() => Effect.logInfo(`📖 Swagger UI: http://localhost:${PORT}/docs`)),
  Effect.tapErrorCause(Effect.logError),
  BunRuntime.runMain,
)
