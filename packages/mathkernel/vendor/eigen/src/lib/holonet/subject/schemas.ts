/**
 * Subject Architecture — Schema Definitions
 *
 * Programmatic subject creation with runtime registration, schema binding,
 * and full catalog introspection.
 *
 * @module holonet/subject/schemas
 */

import { Schema } from 'effect';

// =============================================================================
// BRANDED TYPES — Type-safe identifiers
// =============================================================================

/** Domain identifier (e.g., "geoint", "scada", "mes") */
export const DomainId = Schema.String.pipe(Schema.brand('DomainId'));
export type DomainId = typeof DomainId.Type;

/** Entity type within a domain (e.g., "flight", "vessel", "sensor") */
export const EntityType = Schema.String.pipe(Schema.brand('EntityType'));
export type EntityType = typeof EntityType.Type;

/** Unique subject spec identifier */
export const SubjectSpecId = Schema.String.pipe(Schema.brand('SubjectSpecId'));
export type SubjectSpecId = typeof SubjectSpecId.Type;

// =============================================================================
// STREAM MAPPING STRATEGY — Pluggable Configuration
// =============================================================================

/**
 * How subjects map to JetStream streams.
 *
 * - `domain`: One stream per domain (e.g., GEOINT stream captures geoint.>)
 * - `entityType`: One stream per entity type (e.g., GEOINT_FLIGHT stream)
 * - `dedicated`: One stream per subject spec (fine-grained control)
 * - `custom`: User-provided stream name with custom subject bindings
 */
export const StreamMappingStrategy = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('domain'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('entityType'),
  }),
  Schema.Struct({
    _tag: Schema.Literal('dedicated'),
    streamName: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('custom'),
    streamName: Schema.String,
    subjects: Schema.Array(Schema.String),
  })
);
export type StreamMappingStrategy = typeof StreamMappingStrategy.Type;

// =============================================================================
// CONSUMER HINTS — Optional configuration for consumers
// =============================================================================

export const ConsumerHints = Schema.Struct({
  ackPolicy: Schema.optional(Schema.Literal('none', 'all', 'explicit')),
  deliverPolicy: Schema.optional(
    Schema.Literal(
      'all',
      'last',
      'new',
      'by_start_sequence',
      'by_start_time',
      'last_per_subject'
    )
  ),
  maxDeliver: Schema.optional(Schema.Number),
});
export type ConsumerHints = typeof ConsumerHints.Type;

// =============================================================================
// SUBJECT SPEC — The Core Definition
// =============================================================================

/**
 * SubjectSpec defines a NATS subject with:
 * - Pattern template with typed placeholders
 * - Domain ownership
 * - Message schema binding
 * - Stream mapping strategy
 *
 * @example
 * ```typescript
 * const FlightPositionSpec = new SubjectSpec({
 *   id: 'geoint.flight.position' as SubjectSpecId,
 *   domain: 'geoint' as DomainId,
 *   entityType: 'flight' as EntityType,
 *   description: 'Real-time flight position updates',
 *   pattern: 'geoint.flight.{icao24}.position',
 *   schemaId: 'FlightPositionEvent',
 *   streamMapping: { _tag: 'entityType' },
 *   registeredAt: new Date(),
 * });
 *
 * // Resolve with concrete values
 * FlightPositionSpec.resolve({ icao24: 'ABC123' })
 * // → "geoint.flight.ABC123.position"
 *
 * // Get wildcard pattern for subscriptions
 * FlightPositionSpec.wildcardPattern()
 * // → "geoint.flight.*.position"
 * ```
 */
export class SubjectSpec extends Schema.Class<SubjectSpec>('SubjectSpec')({
  /** Unique identifier (derived from domain + entityType + action) */
  id: SubjectSpecId,

  /** Domain ownership */
  domain: DomainId,

  /** Entity type within the domain */
  entityType: EntityType,

  /** Human-readable description */
  description: Schema.String,

  /**
   * Pattern template with placeholders.
   * Example: "geoint.flight.{icao24}.position"
   * Placeholders are {name} and map to pattern parameters.
   */
  pattern: Schema.String,

  /**
   * Schema identifier for message payload.
   * References a registered schema in the SchemaRegistry.
   */
  schemaId: Schema.String,

  /** How this subject maps to JetStream streams */
  streamMapping: StreamMappingStrategy,

  /** Optional: Consumer configuration hints */
  consumerHints: Schema.optional(ConsumerHints),

  /** Registration metadata */
  registeredAt: Schema.DateFromSelf,
  registeredBy: Schema.optional(Schema.String),
}) {
  /**
   * Resolve the pattern with concrete values.
   *
   * @param params - Key-value pairs to substitute into placeholders
   * @returns Resolved subject string
   *
   * @example
   * spec.resolve({ icao24: 'ABC123' }) → "geoint.flight.ABC123.position"
   */
  resolve(params: Record<string, string>): string {
    return this.pattern.replace(
      /\{(\w+)\}/g,
      (_, key) => params[key] ?? `{${key}}`
    );
  }

  /**
   * Get the wildcard subscription pattern.
   * Replaces all placeholders with `*` for single-token matching.
   *
   * @returns Wildcard pattern for subscriptions
   *
   * @example
   * spec.wildcardPattern() → "geoint.flight.*.position"
   */
  wildcardPattern(): string {
    return this.pattern.replace(/\{(\w+)\}/g, '*');
  }

  /**
   * Get the full-capture pattern (for stream binding).
   * Replaces everything from first placeholder onward with `>`.
   *
   * @returns Capture pattern for stream subjects
   *
   * @example
   * spec.capturePattern() → "geoint.flight.>"
   */
  capturePattern(): string {
    const parts = this.pattern.split('.');
    // Find first placeholder and replace everything after with >
    const firstPlaceholder = parts.findIndex((p) => p.includes('{'));
    if (firstPlaceholder === -1) return this.pattern;
    return [...parts.slice(0, firstPlaceholder), '>'].join('.');
  }

  /**
   * Extract placeholder names from the pattern.
   *
   * @returns Array of placeholder names
   *
   * @example
   * spec.placeholders() → ["icao24"]
   */
  placeholders(): string[] {
    const matches = this.pattern.match(/\{(\w+)\}/g);
    if (!matches) return [];
    return matches.map((m) => m.slice(1, -1));
  }

  /**
   * Check if a concrete subject matches this spec's pattern.
   *
   * @param subject - Concrete subject string to test
   * @returns true if the subject matches the pattern
   *
   * @example
   * spec.matches("geoint.flight.ABC123.position") → true
   * spec.matches("geoint.vessel.ABC123.position") → false
   */
  matches(subject: string): boolean {
    const regex = new RegExp(
      '^' + this.pattern.replace(/\{(\w+)\}/g, '[^.]+') + '$'
    );
    return regex.test(subject);
  }

  /**
   * Extract parameter values from a concrete subject.
   *
   * @param subject - Concrete subject string
   * @returns Record of placeholder names to extracted values, or null if no match
   *
   * @example
   * spec.extractParams("geoint.flight.ABC123.position")
   * → { icao24: "ABC123" }
   */
  extractParams(subject: string): Record<string, string> | null {
    if (!this.matches(subject)) return null;

    const placeholders = this.placeholders();
    const patternParts = this.pattern.split('.');
    const subjectParts = subject.split('.');

    const params: Record<string, string> = {};
    let placeholderIdx = 0;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].includes('{')) {
        params[placeholders[placeholderIdx]] = subjectParts[i];
        placeholderIdx++;
      }
    }

    return params;
  }
}

// =============================================================================
// QUERY TYPES — For catalog introspection
// =============================================================================

/**
 * Query parameters for searching the subject registry.
 */
export interface SubjectQuery {
  /** Filter by domain */
  domain?: DomainId;
  /** Filter by entity type */
  entityType?: EntityType;
  /** Pattern matching (supports wildcards) */
  patternMatch?: string;
  /** Filter by schema ID */
  schemaId?: string;
}

/**
 * Catalog entry with runtime stream status.
 */
export interface CatalogEntry {
  /** The subject spec */
  spec: SubjectSpec;
  /** Resolved stream name based on mapping strategy */
  streamName: string;
  /** Whether the stream exists in NATS */
  streamExists: boolean;
  /** Active consumer count on this stream */
  consumerCount: number;
}

// =============================================================================
// REGISTRY EVENTS — For reactive consumers
// =============================================================================

/**
 * Events emitted by the SubjectRegistry for hot registration.
 */
export const RegistryEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('Registered'),
    spec: SubjectSpec,
    timestamp: Schema.DateFromSelf,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Unregistered'),
    specId: SubjectSpecId,
    timestamp: Schema.DateFromSelf,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Updated'),
    spec: SubjectSpec,
    timestamp: Schema.DateFromSelf,
  })
);
export type RegistryEvent = typeof RegistryEvent.Type;

// =============================================================================
// HELPER FACTORIES — Convenient constructors
// =============================================================================

/**
 * Create a SubjectSpec with sensible defaults.
 *
 * @example
 * ```typescript
 * const spec = createSubjectSpec({
 *   domain: 'geoint',
 *   entityType: 'flight',
 *   pattern: 'geoint.flight.{icao24}.position',
 *   schemaId: 'FlightPositionEvent',
 *   description: 'Real-time flight positions',
 * });
 * ```
 */
export const createSubjectSpec = (params: {
  domain: string;
  entityType: string;
  pattern: string;
  schemaId: string;
  description: string;
  streamMapping?: StreamMappingStrategy;
  consumerHints?: ConsumerHints;
  registeredBy?: string;
}): SubjectSpec => {
  const id = `${params.domain}.${params.entityType}.${params.pattern.split('.').pop()?.replace(/\{.*\}/, '') || 'default'}` as SubjectSpecId;

  return new SubjectSpec({
    id,
    domain: params.domain as DomainId,
    entityType: params.entityType as EntityType,
    pattern: params.pattern,
    schemaId: params.schemaId,
    description: params.description,
    streamMapping: params.streamMapping ?? { _tag: 'entityType' },
    consumerHints: params.consumerHints,
    registeredAt: new Date(),
    registeredBy: params.registeredBy,
  });
};
