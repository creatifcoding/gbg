/**
 * Subject Architecture — Barrel Exports
 *
 * Programmatic subject creation with runtime registration, schema binding,
 * and full catalog introspection.
 *
 * @module holonet/subject
 */

// =============================================================================
// Schemas and Types
// =============================================================================

export {
  // Branded types
  DomainId,
  EntityType,
  SubjectSpecId,
  // Stream mapping
  StreamMappingStrategy,
  ConsumerHints,
  // Core types
  SubjectSpec,
  // Query types
  type SubjectQuery,
  type CatalogEntry,
  // Event types
  RegistryEvent,
  // Factory
  createSubjectSpec,
} from './schemas';

// =============================================================================
// Errors
// =============================================================================

export { Subject } from './errors';

// =============================================================================
// Conventions
// =============================================================================

export {
  type DomainConvention,
  DomainConventionRegistry,
  createDefaultConventionRegistry,
  // Default conventions
  GEOINT_CONVENTION,
  SCADA_CONVENTION,
  MES_CONVENTION,
  EVENTS_CONVENTION,
} from './conventions';

// =============================================================================
// Registry Service
// =============================================================================

export {
  SubjectRegistry,
  SubjectRegistryLive,
  type SubjectRegistryShape,
} from './registry';
