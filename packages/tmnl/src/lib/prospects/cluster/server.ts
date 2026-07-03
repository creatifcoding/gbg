/**
 * Prospect Pipeline — Cluster Server Boot
 *
 * Single-process server hosting:
 * - All 5 entity handlers (Company, DM, Signal, Proposal, Outreach)
 * - HarvestWorkflow engine
 * - In-memory cluster via TestRunner (dev)
 * - PG persistence for data + provenance
 *
 * Mirrors IIoT http/server.ts Layer composition.
 *
 * Usage:
 *   bun run src/lib/prospects/cluster/server.ts
 *
 * @module prospects/cluster/server
 */

import { Effect, Layer } from 'effect'
import { BunRuntime } from '@effect/platform-bun'
import { ClusterWorkflowEngine, TestRunner } from '@effect/cluster'
import { ProspectEntityHandlers } from '../entity/handlers/EntityStack'
import { HarvestWorkflowLayer } from '../workflows/harvest-workflow'
import { CompanyRepository, DecisionMakerRepository, SignalRepository, OutreachRepository, ProposalRepository } from '../services/repositories'
import { CIPScoring } from '../services/cip-scoring'
import { ProvenanceService } from '../services/provenance'
import { ProspectPgLayer } from '../models/pg-layer'
import { ClusterDev } from './cluster'

// =============================================================================
// Service Layer — all repositories + scoring + provenance
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
// Dev Server (In-Memory Cluster + PG persistence)
// =============================================================================

/**
 * Entity handlers + workflow engine, fully wired with cluster + PG.
 *
 * Handlers are provided ClusterDev (TestRunner) for Sharding.
 * Services get PG for SQL.
 *
 * NOTE: ClusterDev is ALSO merged at the top level so that
 * user-space effects (e.g. Entity.client) can access Sharding.
 */
const HandlersLayer = Layer.mergeAll(
  ProspectEntityHandlers,
  HarvestWorkflowLayer,
).pipe(
  Layer.provide(ClusterWorkflowEngine.layer),
  Layer.provide(ProspectServicesLayer),
  Layer.provide(ClusterDev),
  Layer.provide(ProspectPgLayer()),
)

/**
 * Full dev server layer.
 *
 * Merges handlers with ClusterDev so Sharding is available to
 * both entity handlers AND user-space entity clients.
 */
export const ProspectServerDev = Layer.merge(HandlersLayer, ClusterDev)

// =============================================================================
// Boot
// =============================================================================

/**
 * Boot the development cluster server.
 *
 * ```bash
 * bun run src/lib/prospects/cluster/server.ts
 * ```
 *
 * Once running, entity RPCs are accessible via Entity.client.
 */
const main = Layer.launch(ProspectServerDev).pipe(
  Effect.tapErrorCause(Effect.logError),
  BunRuntime.runMain,
)
