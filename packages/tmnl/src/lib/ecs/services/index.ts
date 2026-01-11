/**
 * ECS Services - Barrel Export
 *
 * All ECS services use Effect.Service pattern with:
 * - `accessors: true` for convenient static method access
 * - `dependencies` for clean layer composition
 * - `Default` layer auto-generated
 *
 * @module ecs/services
 */

// Identity Services
export {
  EntityIdService,
  EntityIdParseError,
} from './EntityIdService'

// Source Registry
export {
  SourceRegistry,
  SourceConfig,
  SourceNotFoundError,
} from './SourceRegistry'

// Confidence Calculation
export {
  ConfidenceService,
  ConfidenceResult,
} from './ConfidenceService'

// Provenance Management
export {
  ProvenanceService,
  CreateProvenanceParams,
  AddContributionParams,
} from './ProvenanceService'

// =============================================================================
// Composite Layers
// =============================================================================

import { Layer } from 'effect'
import { EntityIdService } from './EntityIdService'
import { SourceRegistry } from './SourceRegistry'
import { ConfidenceService } from './ConfidenceService'
import { ProvenanceService } from './ProvenanceService'

/**
 * All ECS core services bundled.
 * Provides: EntityIdService, SourceRegistry, ConfidenceService, ProvenanceService
 */
export const EcsServicesLive = Layer.mergeAll(
  EntityIdService.Default,
  SourceRegistry.Default,
  ConfidenceService.Default,
  ProvenanceService.Default
)

/**
 * Test layer - same as live for now.
 * Add mock implementations as needed.
 */
export const EcsServicesTest = EcsServicesLive
