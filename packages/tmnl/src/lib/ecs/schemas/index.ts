/**
 * ECS Schemas - Barrel Export
 *
 * Platform-level primitives for the Canonical Entity System.
 * Concrete entities live in their domain modules (e.g., geoint/entities).
 *
 * @module ecs/schemas
 */

// Core primitives
export {
  EntityId,
  IntelSource,
  EntityType,
  Position2D,
  Position3D,
  BBox,
  Classification,
  ObjectType,
  Confidence,
  DataQuality,
} from './core'

// Provenance
export {
  RawAuditRef,
  SourceContribution,
  EntityProvenance,
  createInitialProvenance,
} from './provenance'

// Base entity
export {
  BaseEntity,
  generateEntityId,
  parseEntityId,
} from './base'
