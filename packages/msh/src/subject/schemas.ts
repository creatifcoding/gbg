/**
 * Subject Architecture — Schema Definitions
 *
 * Programmatic subject creation with runtime registration, schema binding,
 * and full catalog introspection.
 *
 * @module @tmnl/msh/subject/schemas
 */

import * as Schema from 'effect-v4/Schema';

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
export const StreamMappingStrategy = Schema.Union([
  Schema.Struct({
    _tag: Schema.tag('domain'),
  }),
  Schema.Struct({
    _tag: Schema.tag('entityType'),
  }),
  Schema.Struct({
    _tag: Schema.tag('dedicated'),
    streamName: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.tag('custom'),
    streamName: Schema.String,
    subjects: Schema.Array(Schema.String),
  }),
]);
export type StreamMappingStrategy = typeof StreamMappingStrategy.Type;

// =============================================================================
// CONSUMER HINTS — Optional configuration for consumers
// =============================================================================

export const ConsumerHints = Schema.Struct({
  ackPolicy: Schema.optionalKey(Schema.Literals(['none', 'all', 'explicit'] as const)),
  deliverPolicy: Schema.optionalKey(
    Schema.Literals([
      'all',
      'last',
      'new',
      'by_start_sequence',
      'by_start_time',
      'last_per_subject',
    ] as const),
  ),
  maxDeliver: Schema.optionalKey(Schema.Number),
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

  /** Pattern template with placeholders. Example: "geoint.flight.{icao24}.position" */
  pattern: Schema.String,

  /** Schema identifier for message payload. */
  schemaId: Schema.String,

  /** How this subject maps to JetStream streams */
  streamMapping: StreamMappingStrategy,

  /** Optional: Consumer configuration hints */
  consumerHints: Schema.optionalKey(ConsumerHints),

  /** Registration metadata */
  registeredAt: Schema.Date,
  registeredBy: Schema.optionalKey(Schema.String),
}) {
  /**
   * Resolve the pattern with concrete values.
   */
  resolve(params: Record<string, string>): string {
    return this.pattern.replace(
      /\{(\w+)\}/g,
      (_: string, key: string) => params[key] ?? `{${key}}`,
    );
  }

  /**
   * Get the wildcard subscription pattern.
   */
  wildcardPattern(): string {
    return this.pattern.replace(/\{(\w+)\}/g, '*');
  }

  /**
   * Get the full-capture pattern (for stream binding).
   */
  capturePattern(): string {
    const parts = this.pattern.split('.');
    const firstPlaceholder = parts.findIndex((p) => p.includes('{'));
    if (firstPlaceholder === -1) return this.pattern;
    return [...parts.slice(0, firstPlaceholder), '>'].join('.');
  }

  /**
   * Extract placeholder names from the pattern.
   */
  placeholders(): string[] {
    const matches = this.pattern.match(/\{(\w+)\}/g);
    if (!matches) return [];
    return matches.map((m) => m.slice(1, -1));
  }

  /**
   * Check if a concrete subject matches this spec's pattern.
   */
  matches(subject: string): boolean {
    const regex = new RegExp(
      '^' + this.pattern.replace(/\{(\w+)\}/g, '[^.]+') + '$',
    );
    return regex.test(subject);
  }

  /**
   * Extract parameter values from a concrete subject.
   */
  extractParams(subject: string): Record<string, string> | null {
    if (!this.matches(subject)) return null;

    const phs = this.placeholders();
    const patternParts = this.pattern.split('.');
    const subjectParts = subject.split('.');

    const params: Record<string, string> = {};
    let phIdx = 0;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].includes('{')) {
        params[phs[phIdx]] = subjectParts[i];
        phIdx++;
      }
    }

    return params;
  }
}

// =============================================================================
// QUERY TYPES — For catalog introspection
// =============================================================================

export interface SubjectQuery {
  domain?: DomainId;
  entityType?: EntityType;
  patternMatch?: string;
  schemaId?: string;
}

export interface CatalogEntry {
  spec: SubjectSpec;
  streamName: string;
  streamExists: boolean;
  consumerCount: number;
}

// =============================================================================
// REGISTRY EVENTS — For reactive consumers
// =============================================================================

export const RegistryEvent = Schema.Union([
  Schema.Struct({
    _tag: Schema.tag('Registered'),
    spec: SubjectSpec,
    timestamp: Schema.Date,
  }),
  Schema.Struct({
    _tag: Schema.tag('Unregistered'),
    specId: SubjectSpecId,
    timestamp: Schema.Date,
  }),
  Schema.Struct({
    _tag: Schema.tag('Updated'),
    spec: SubjectSpec,
    timestamp: Schema.Date,
  }),
]);
export type RegistryEvent = typeof RegistryEvent.Type;

// =============================================================================
// HELPER FACTORIES — Convenient constructors
// =============================================================================

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

  const fields: Record<string, unknown> = {
    id,
    domain: params.domain as DomainId,
    entityType: params.entityType as EntityType,
    pattern: params.pattern,
    schemaId: params.schemaId,
    description: params.description,
    streamMapping: params.streamMapping ?? { _tag: 'entityType' as const },
    registeredAt: new Date(),
  };
  if (params.consumerHints) fields.consumerHints = params.consumerHints;
  if (params.registeredBy) fields.registeredBy = params.registeredBy;

  return new SubjectSpec(fields as any);
};
