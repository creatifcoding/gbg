/**
 * Subject Architecture — SubjectRegistry Service
 *
 * Runtime hot registration with full catalog introspection.
 * Supports reactive events via PubSub for UI/tooling integration.
 *
 * Features:
 * - Hot registration without restarts
 * - Pattern conflict detection
 * - Domain convention validation
 * - Stream mapping resolution
 * - Catalog introspection with stream status
 * - Reactive events stream
 *
 * @module holonet/subject/registry
 */

import { Effect, Ref, HashMap, Stream, PubSub, Option, pipe } from 'effect';

import {
  type SubjectSpecId,
  type SubjectSpec,
  type SubjectQuery,
  type CatalogEntry,
  type DomainId,
  type EntityType,
  type RegistryEvent,
} from './schemas';
import { Subject } from './errors';
import {
  DomainConventionRegistry,
  createDefaultConventionRegistry,
} from './conventions';

// =============================================================================
// SERVICE SHAPE
// =============================================================================

export interface SubjectRegistryShape {
  // ─── Registration ────────────────────────────────────────────────────────

  /**
   * Register a new subject spec. Hot registration - no restart required.
   *
   * @param spec - The subject spec to register
   * @returns void on success, fails with error on conflict
   */
  readonly register: (
    spec: SubjectSpec
  ) => Effect.Effect<
    void,
    Subject.AlreadyRegisteredError | Subject.PatternConflictError | Subject.ConventionError | Subject.ValidationError
  >;

  /**
   * Unregister a subject spec.
   *
   * @param specId - The ID of the spec to unregister
   */
  readonly unregister: (
    specId: SubjectSpecId
  ) => Effect.Effect<void, Subject.NotFoundError>;

  /**
   * Update an existing spec (e.g., change stream mapping).
   *
   * @param spec - The updated spec (must have existing ID)
   */
  readonly update: (
    spec: SubjectSpec
  ) => Effect.Effect<
    void,
    Subject.NotFoundError | Subject.PatternConflictError | Subject.ValidationError | Subject.ConventionError
  >;

  // ─── Lookup ──────────────────────────────────────────────────────────────

  /**
   * Get a spec by ID.
   *
   * @param specId - The spec ID to lookup
   */
  readonly get: (
    specId: SubjectSpecId
  ) => Effect.Effect<SubjectSpec, Subject.NotFoundError>;

  /**
   * Get a spec by ID, returning null if not found.
   *
   * @param specId - The spec ID to lookup
   */
  readonly getOrNull: (specId: SubjectSpecId) => Effect.Effect<SubjectSpec | null>;

  /**
   * Find spec by resolved subject string.
   * Matches the subject against all registered patterns.
   *
   * @param subject - Concrete subject string (e.g., "geoint.flight.ABC123.position")
   */
  readonly findBySubject: (
    subject: string
  ) => Effect.Effect<SubjectSpec | null>;

  /**
   * Query the catalog with filters.
   *
   * @param query - Filter parameters
   */
  readonly query: (
    query: SubjectQuery
  ) => Effect.Effect<ReadonlyArray<SubjectSpec>>;

  // ─── Catalog Introspection ───────────────────────────────────────────────

  /**
   * Get full catalog with stream status.
   * Returns all specs with resolved stream names and status.
   */
  readonly catalog: () => Effect.Effect<ReadonlyArray<CatalogEntry>>;

  /**
   * List all registered domains.
   */
  readonly domains: () => Effect.Effect<ReadonlyArray<DomainId>>;

  /**
   * List entity types for a domain.
   *
   * @param domain - The domain to query
   */
  readonly entityTypes: (
    domain: DomainId
  ) => Effect.Effect<ReadonlyArray<EntityType>>;

  /**
   * Get all specs for a domain.
   *
   * @param domain - The domain to query
   */
  readonly specsByDomain: (
    domain: DomainId
  ) => Effect.Effect<ReadonlyArray<SubjectSpec>>;

  /**
   * Get count of registered specs.
   */
  readonly count: () => Effect.Effect<number>;

  // ─── Stream Resolution ───────────────────────────────────────────────────

  /**
   * Resolve the stream name for a spec based on its mapping strategy.
   *
   * @param spec - The spec to resolve
   */
  readonly resolveStreamName: (spec: SubjectSpec) => Effect.Effect<string>;

  /**
   * Get all specs that map to a given stream.
   *
   * @param streamName - The stream name to query
   */
  readonly specsByStream: (
    streamName: string
  ) => Effect.Effect<ReadonlyArray<SubjectSpec>>;

  // ─── Reactive Events ─────────────────────────────────────────────────────

  /**
   * Subscribe to registry events.
   * Events are emitted on register, unregister, and update.
   */
  readonly events: Stream.Stream<RegistryEvent>;

  // ─── Convention Management ───────────────────────────────────────────────

  /**
   * Get the convention registry for runtime convention management.
   */
  readonly conventions: DomainConventionRegistry;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class SubjectRegistry extends Effect.Service<SubjectRegistry>()(
  'holonet/subject/Registry',
  {
    effect: Effect.gen(function* () {
      // ─────────────────────────────────────────────────────────────────────
      // INTERNAL STATE
      // ─────────────────────────────────────────────────────────────────────

      const specsRef = yield* Ref.make(
        HashMap.empty<SubjectSpecId, SubjectSpec>()
      );
      const patternIndexRef = yield* Ref.make(
        HashMap.empty<string, SubjectSpecId>()
      );
      const eventsPubSub = yield* PubSub.unbounded<RegistryEvent>();
      const conventions = createDefaultConventionRegistry();

      // ─────────────────────────────────────────────────────────────────────
      // HELPERS
      // ─────────────────────────────────────────────────────────────────────

      const publishEvent = (event: RegistryEvent) =>
        PubSub.publish(eventsPubSub, event).pipe(Effect.asVoid);

      const checkPatternConflict = (
        pattern: string,
        excludeId?: SubjectSpecId
      ) =>
        Effect.gen(function* () {
          const patternIndex = yield* Ref.get(patternIndexRef);
          const existing = HashMap.get(patternIndex, pattern);

          if (Option.isSome(existing) && existing.value !== excludeId) {
            return yield* Effect.fail(
              new Subject.PatternConflictError({
                pattern,
                conflictsWith: existing.value,
              })
            );
          }
        });

      const resolveStreamNameInternal = (spec: SubjectSpec): string => {
        switch (spec.streamMapping._tag) {
          case 'domain':
            return spec.domain.toUpperCase();
          case 'entityType':
            return `${spec.domain}_${spec.entityType}`.toUpperCase();
          case 'dedicated':
          case 'custom':
            return spec.streamMapping.streamName;
        }
      };

      // ─────────────────────────────────────────────────────────────────────
      // REGISTRATION
      // ─────────────────────────────────────────────────────────────────────

      const register = (spec: SubjectSpec) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);

          // Check for existing
          if (HashMap.has(specs, spec.id)) {
            return yield* Effect.fail(
              new Subject.AlreadyRegisteredError({
                specId: spec.id,
                existingSpec: pipe(
                  HashMap.get(specs, spec.id),
                  Option.getOrThrow
                ),
              })
            );
          }

          // Check pattern conflict
          yield* checkPatternConflict(spec.wildcardPattern());

          // Validate against domain conventions
          yield* conventions.validate(spec);

          // Register
          yield* Ref.update(specsRef, HashMap.set(spec.id, spec));
          yield* Ref.update(
            patternIndexRef,
            HashMap.set(spec.wildcardPattern(), spec.id)
          );
          yield* publishEvent({
            _tag: 'Registered',
            spec,
            timestamp: new Date(),
          });
        });

      const unregister = (specId: SubjectSpecId) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const specOpt = HashMap.get(specs, specId);

          if (Option.isNone(specOpt)) {
            return yield* Effect.fail(new Subject.NotFoundError({ specId }));
          }

          const spec = specOpt.value;

          yield* Ref.update(specsRef, HashMap.remove(specId));
          yield* Ref.update(
            patternIndexRef,
            HashMap.remove(spec.wildcardPattern())
          );
          yield* publishEvent({
            _tag: 'Unregistered',
            specId,
            timestamp: new Date(),
          });
        });

      const update = (spec: SubjectSpec) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const existingOpt = HashMap.get(specs, spec.id);

          if (Option.isNone(existingOpt)) {
            return yield* Effect.fail(
              new Subject.NotFoundError({ specId: spec.id })
            );
          }

          const existing = existingOpt.value;

          // If pattern changed, check for conflicts
          if (spec.wildcardPattern() !== existing.wildcardPattern()) {
            yield* checkPatternConflict(spec.wildcardPattern(), spec.id);

            // Update pattern index
            yield* Ref.update(patternIndexRef, (patternIndex) =>
              pipe(
                patternIndex,
                HashMap.remove(existing.wildcardPattern()),
                HashMap.set(spec.wildcardPattern(), spec.id)
              )
            );
          }

          // Validate against domain conventions
          yield* conventions.validate(spec);

          // Update spec
          yield* Ref.update(specsRef, HashMap.set(spec.id, spec));
          yield* publishEvent({
            _tag: 'Updated',
            spec,
            timestamp: new Date(),
          });
        });

      // ─────────────────────────────────────────────────────────────────────
      // LOOKUP
      // ─────────────────────────────────────────────────────────────────────

      const get = (specId: SubjectSpecId) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const specOpt = HashMap.get(specs, specId);

          if (Option.isNone(specOpt)) {
            return yield* Effect.fail(new Subject.NotFoundError({ specId }));
          }

          return specOpt.value;
        });

      const getOrNull = (specId: SubjectSpecId) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const specOpt = HashMap.get(specs, specId);
          return Option.isNone(specOpt) ? null : specOpt.value;
        });

      const findBySubject = (subject: string) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);

          // Iterate through all specs and find one that matches
          for (const spec of HashMap.values(specs)) {
            if (spec.matches(subject)) {
              return spec;
            }
          }

          return null;
        });

      const query = (q: SubjectQuery) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const results: SubjectSpec[] = [];

          for (const spec of HashMap.values(specs)) {
            // Apply filters
            if (q.domain && spec.domain !== q.domain) continue;
            if (q.entityType && spec.entityType !== q.entityType) continue;
            if (q.schemaId && spec.schemaId !== q.schemaId) continue;

            if (q.patternMatch) {
              // Simple wildcard matching
              const regex = new RegExp(
                '^' +
                  q.patternMatch
                    .replace(/\*/g, '[^.]+')
                    .replace(/>/g, '.+') +
                  '$'
              );
              if (!regex.test(spec.wildcardPattern())) continue;
            }

            results.push(spec);
          }

          return results;
        });

      // ─────────────────────────────────────────────────────────────────────
      // CATALOG INTROSPECTION
      // ─────────────────────────────────────────────────────────────────────

      const catalog = () =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const entries: CatalogEntry[] = [];

          for (const spec of HashMap.values(specs)) {
            entries.push({
              spec,
              streamName: resolveStreamNameInternal(spec),
              // Note: These would be populated by checking actual NATS state
              // For now, return placeholder values
              streamExists: false,
              consumerCount: 0,
            });
          }

          return entries;
        });

      const domains = () =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const domainSet = new Set<DomainId>();

          for (const spec of HashMap.values(specs)) {
            domainSet.add(spec.domain);
          }

          return Array.from(domainSet);
        });

      const entityTypes = (domain: DomainId) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const typeSet = new Set<EntityType>();

          for (const spec of HashMap.values(specs)) {
            if (spec.domain === domain) {
              typeSet.add(spec.entityType);
            }
          }

          return Array.from(typeSet);
        });

      const specsByDomain = (domain: DomainId) => query({ domain });

      const count = () =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          return HashMap.size(specs);
        });

      // ─────────────────────────────────────────────────────────────────────
      // STREAM RESOLUTION
      // ─────────────────────────────────────────────────────────────────────

      const resolveStreamName = (spec: SubjectSpec) =>
        Effect.sync(() => resolveStreamNameInternal(spec));

      const specsByStream = (streamName: string) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const results: SubjectSpec[] = [];

          for (const spec of HashMap.values(specs)) {
            if (resolveStreamNameInternal(spec) === streamName) {
              results.push(spec);
            }
          }

          return results;
        });

      // ─────────────────────────────────────────────────────────────────────
      // REACTIVE EVENTS
      // ─────────────────────────────────────────────────────────────────────

      const events = Stream.fromPubSub(eventsPubSub);

      return {
        register,
        unregister,
        update,
        get,
        getOrNull,
        findBySubject,
        query,
        catalog,
        domains,
        entityTypes,
        specsByDomain,
        count,
        resolveStreamName,
        specsByStream,
        events,
        conventions,
      } satisfies SubjectRegistryShape;
    }),
  }
) {}

// =============================================================================
// LAYER EXPORTS
// =============================================================================

export const SubjectRegistryLive = SubjectRegistry.Default;
