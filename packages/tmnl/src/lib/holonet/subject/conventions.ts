/**
 * Subject Architecture — Domain Conventions
 *
 * Each domain can define conventions that new subject specs must follow.
 * Conventions enforce pattern prefixes, allowed entity types, default
 * stream mappings, and custom validation rules.
 *
 * @module holonet/subject/conventions
 */

import { Effect } from 'effect';
import type {
  DomainId,
  EntityType,
  SubjectSpec,
  StreamMappingStrategy,
} from './schemas';
import { Subject } from './errors';

// =============================================================================
// DOMAIN CONVENTION TYPE
// =============================================================================

/**
 * Convention rules for a domain.
 *
 * Conventions are applied during subject registration to ensure
 * consistency and enforce domain-specific requirements.
 */
export interface DomainConvention {
  /** Domain this convention applies to */
  readonly domain: DomainId;

  /**
   * Pattern prefix that all subjects in this domain must follow.
   * Example: "geoint." forces all GEOINT subjects to start with geoint.
   */
  readonly patternPrefix: string;

  /** Allowed entity types (if restricted) */
  readonly allowedEntityTypes?: ReadonlyArray<EntityType>;

  /** Default stream mapping strategy for this domain */
  readonly defaultStreamMapping: StreamMappingStrategy;

  /** Human-readable description of this convention */
  readonly description?: string;

  /**
   * Custom validation function for domain-specific rules.
   * Return Effect.void for success, Effect.fail with ValidationError for failure.
   */
  readonly validate?: (
    spec: SubjectSpec
  ) => Effect.Effect<void, Subject.ValidationError>;
}

// =============================================================================
// CONVENTION REGISTRY
// =============================================================================

/**
 * Registry of domain conventions.
 * Allows runtime registration and lookup of conventions.
 */
export class DomainConventionRegistry {
  private conventions = new Map<DomainId, DomainConvention>();

  /**
   * Register a domain convention.
   */
  register(convention: DomainConvention): void {
    this.conventions.set(convention.domain, convention);
  }

  /**
   * Get the convention for a domain.
   */
  get(domain: DomainId): DomainConvention | undefined {
    return this.conventions.get(domain);
  }

  /**
   * Check if a domain has a registered convention.
   */
  has(domain: DomainId): boolean {
    return this.conventions.has(domain);
  }

  /**
   * Get all registered conventions.
   */
  all(): ReadonlyArray<DomainConvention> {
    return Array.from(this.conventions.values());
  }

  /**
   * Validate a spec against its domain's convention.
   * Returns Effect.void if valid, or fails with appropriate error.
   */
  validate(
    spec: SubjectSpec
  ): Effect.Effect<void, Subject.ConventionError | Subject.ValidationError> {
    const convention = this.get(spec.domain);

    // No convention = no restrictions
    if (!convention) {
      return Effect.void;
    }

    return Effect.gen(this, function* () {
      // Check pattern prefix
      if (!spec.pattern.startsWith(convention.patternPrefix)) {
        return yield* Effect.fail(
          new Subject.ConventionError({
            domain: spec.domain,
            message: `Pattern must start with '${convention.patternPrefix}', got '${spec.pattern}'`,
            specId: spec.id,
          })
        );
      }

      // Check allowed entity types
      if (convention.allowedEntityTypes) {
        const allowed = convention.allowedEntityTypes as ReadonlyArray<string>;
        if (!allowed.includes(spec.entityType)) {
          return yield* Effect.fail(
            new Subject.ConventionError({
              domain: spec.domain,
              message: `Entity type '${spec.entityType}' not allowed. Allowed: ${allowed.join(', ')}`,
              specId: spec.id,
            })
          );
        }
      }

      // Run custom validation if defined
      if (convention.validate) {
        yield* convention.validate(spec);
      }
    });
  }
}

// =============================================================================
// DEFAULT CONVENTIONS
// =============================================================================

/**
 * GEOINT domain convention.
 *
 * - Pattern prefix: "geoint."
 * - Allowed entity types: flight, vessel, weather, poi, imagery
 * - Default stream mapping: entityType (one stream per entity type)
 */
export const GEOINT_CONVENTION: DomainConvention = {
  domain: 'geoint' as DomainId,
  patternPrefix: 'geoint.',
  allowedEntityTypes: [
    'flight',
    'vessel',
    'weather',
    'poi',
    'imagery',
  ] as EntityType[],
  defaultStreamMapping: { _tag: 'entityType' },
  description: 'GEOINT domain for geospatial intelligence data',
};

/**
 * SCADA domain convention.
 *
 * - Pattern prefix: "scada."
 * - Default stream mapping: domain (single stream for all SCADA)
 * - Custom validation: patterns must include {sensorId} placeholder
 */
export const SCADA_CONVENTION: DomainConvention = {
  domain: 'scada' as DomainId,
  patternPrefix: 'scada.',
  defaultStreamMapping: { _tag: 'domain' },
  description: 'SCADA domain for industrial sensor data',
  validate: (spec) =>
    spec.pattern.includes('{sensorId}')
      ? Effect.void
      : Effect.fail(
          new Subject.ValidationError({
            message: 'SCADA subjects must include {sensorId} placeholder',
            specId: spec.id,
          })
        ),
};

/**
 * MES (Manufacturing Execution System) domain convention.
 *
 * - Pattern prefix: "mes."
 * - Allowed entity types: machine, order, product, batch
 * - Default stream mapping: entityType
 */
export const MES_CONVENTION: DomainConvention = {
  domain: 'mes' as DomainId,
  patternPrefix: 'mes.',
  allowedEntityTypes: ['machine', 'order', 'product', 'batch'] as EntityType[],
  defaultStreamMapping: { _tag: 'entityType' },
  description: 'MES domain for manufacturing execution data',
};

/**
 * EVENTS domain convention (general-purpose events).
 *
 * - Pattern prefix: "events."
 * - No entity type restrictions
 * - Default stream mapping: domain (single EVENTS stream)
 */
export const EVENTS_CONVENTION: DomainConvention = {
  domain: 'events' as DomainId,
  patternPrefix: 'events.',
  defaultStreamMapping: { _tag: 'domain' },
  description: 'General-purpose event domain',
};

// =============================================================================
// DEFAULT REGISTRY FACTORY
// =============================================================================

/**
 * Create a convention registry with default domain conventions.
 */
export const createDefaultConventionRegistry = (): DomainConventionRegistry => {
  const registry = new DomainConventionRegistry();
  registry.register(GEOINT_CONVENTION);
  registry.register(SCADA_CONVENTION);
  registry.register(MES_CONVENTION);
  registry.register(EVENTS_CONVENTION);
  return registry;
};
