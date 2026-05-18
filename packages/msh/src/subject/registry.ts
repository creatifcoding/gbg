/**
 * Subject Architecture — SubjectRegistry Service
 *
 * Runtime hot registration with catalog introspection and reactive events.
 *
 * @module @tmnl/msh/subject/registry
 */

import * as Context from 'effect-v4/Context';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Ref from 'effect-v4/Ref';
import * as HashMap from 'effect-v4/HashMap';
import * as Stream from 'effect-v4/Stream';
import * as PubSub from 'effect-v4/PubSub';
import * as Option from 'effect-v4/Option';
import { pipe } from 'effect-v4/Function';

import type {
  SubjectSpecId, SubjectSpec, SubjectQuery,
  CatalogEntry, DomainId, EntityType, RegistryEvent,
} from './schemas';
import { Subject } from './errors';
import { MshSpan } from '../tracing';

const subjectPatternMatches = (pattern: string, subject: string): boolean => {
  const patternParts = pattern.split('.');
  const subjectParts = subject.split('.');

  for (let i = 0; i < patternParts.length; i += 1) {
    const token = patternParts[i];
    const subjectToken = subjectParts[i];

    if (token === '>') return i < subjectParts.length;
    if (subjectToken === undefined) return false;
    if (token === '*') {
      if (subjectToken.length === 0) return false;
      continue;
    }
    if (token !== subjectToken) return false;
  }

  return patternParts.length === subjectParts.length;
};

// =============================================================================
// Service Shape
// =============================================================================

export interface SubjectRegistryShape {
  readonly register: (spec: SubjectSpec) => Effect.Effect<void,
    Subject.AlreadyRegisteredError | Subject.PatternConflictError | Subject.ValidationError>;
  readonly unregister: (specId: SubjectSpecId) => Effect.Effect<void, Subject.NotFoundError>;
  readonly update: (spec: SubjectSpec) => Effect.Effect<void,
    Subject.NotFoundError | Subject.PatternConflictError | Subject.ValidationError>;
  readonly get: (specId: SubjectSpecId) => Effect.Effect<SubjectSpec, Subject.NotFoundError>;
  readonly getOrNull: (specId: SubjectSpecId) => Effect.Effect<SubjectSpec | null>;
  readonly findBySubject: (subject: string) => Effect.Effect<SubjectSpec | null>;
  readonly query: (query: SubjectQuery) => Effect.Effect<ReadonlyArray<SubjectSpec>>;
  readonly catalog: () => Effect.Effect<ReadonlyArray<CatalogEntry>>;
  readonly domains: () => Effect.Effect<ReadonlyArray<DomainId>>;
  readonly entityTypes: (domain: DomainId) => Effect.Effect<ReadonlyArray<EntityType>>;
  readonly specsByDomain: (domain: DomainId) => Effect.Effect<ReadonlyArray<SubjectSpec>>;
  readonly count: () => Effect.Effect<number>;
  readonly resolveStreamName: (spec: SubjectSpec) => Effect.Effect<string>;
  readonly specsByStream: (streamName: string) => Effect.Effect<ReadonlyArray<SubjectSpec>>;
  readonly events: Stream.Stream<RegistryEvent>;
}

// =============================================================================
// Service Definition
// =============================================================================

export class SubjectRegistry extends Context.Service<
  SubjectRegistry, SubjectRegistryShape
>()('@tmnl/msh/subject/Registry') {
  static readonly layer = Layer.effect(
    SubjectRegistry,
    Effect.gen(function* () {
      const specsRef = yield* Ref.make(HashMap.empty<SubjectSpecId, SubjectSpec>());
      const patternIndexRef = yield* Ref.make(HashMap.empty<string, SubjectSpecId>());
      const eventsPubSub = yield* PubSub.unbounded<RegistryEvent>();

      const publishEvent = (event: RegistryEvent) =>
        PubSub.publish(eventsPubSub, event).pipe(Effect.asVoid);

      const checkPatternConflict = (pattern: string, excludeId?: SubjectSpecId) =>
        Effect.gen(function* () {
          const patternIndex = yield* Ref.get(patternIndexRef);
          const existing = HashMap.get(patternIndex, pattern);
          if (Option.isSome(existing) && existing.value !== excludeId) {
            return yield* Effect.fail(
              new Subject.PatternConflictError({ pattern, conflictsWith: existing.value }),
            );
          }
        });

      const resolveStreamNameInternal = (spec: SubjectSpec): string => {
        switch (spec.streamMapping._tag) {
          case 'domain': return spec.domain.toUpperCase();
          case 'entityType': return `${spec.domain}_${spec.entityType}`.toUpperCase();
          case 'dedicated':
          case 'custom': return spec.streamMapping.streamName;
        }
      };

      // ─── Registration ──────────────────────────────────────────────────

      const register: SubjectRegistryShape['register'] = (spec) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          if (HashMap.has(specs, spec.id)) {
            return yield* Effect.fail(
              new Subject.AlreadyRegisteredError({
                specId: spec.id,
                existingSpec: pipe(HashMap.get(specs, spec.id), Option.getOrThrow),
              }),
            );
          }
          yield* checkPatternConflict(spec.wildcardPattern());
          yield* Ref.update(specsRef, HashMap.set(spec.id, spec));
          yield* Ref.update(patternIndexRef, HashMap.set(spec.wildcardPattern(), spec.id));
          yield* publishEvent({ _tag: 'Registered' as const, spec, timestamp: new Date() });
        });

      const unregister: SubjectRegistryShape['unregister'] = (specId) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const specOpt = HashMap.get(specs, specId);
          if (Option.isNone(specOpt))
            return yield* Effect.fail(new Subject.NotFoundError({ specId }));
          const spec = specOpt.value;
          yield* Ref.update(specsRef, HashMap.remove(specId));
          yield* Ref.update(patternIndexRef, HashMap.remove(spec.wildcardPattern()));
          yield* publishEvent({ _tag: 'Unregistered' as const, specId, timestamp: new Date() });
        });

      const update: SubjectRegistryShape['update'] = (spec) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const existingOpt = HashMap.get(specs, spec.id);
          if (Option.isNone(existingOpt))
            return yield* Effect.fail(new Subject.NotFoundError({ specId: spec.id }));
          const existing = existingOpt.value;
          if (spec.wildcardPattern() !== existing.wildcardPattern()) {
            yield* checkPatternConflict(spec.wildcardPattern(), spec.id);
            yield* Ref.update(patternIndexRef, (pi) =>
              pipe(pi, HashMap.remove(existing.wildcardPattern()), HashMap.set(spec.wildcardPattern(), spec.id)),
            );
          }
          yield* Ref.update(specsRef, HashMap.set(spec.id, spec));
          yield* publishEvent({ _tag: 'Updated' as const, spec, timestamp: new Date() });
        });

      // ─── Lookup ────────────────────────────────────────────────────────

      const get: SubjectRegistryShape['get'] = (specId) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const specOpt = HashMap.get(specs, specId);
          if (Option.isNone(specOpt))
            return yield* Effect.fail(new Subject.NotFoundError({ specId }));
          return specOpt.value;
        });

      const getOrNull: SubjectRegistryShape['getOrNull'] = (specId) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const specOpt = HashMap.get(specs, specId);
          return Option.isNone(specOpt) ? null : specOpt.value;
        });

      const findBySubject: SubjectRegistryShape['findBySubject'] = (subject) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          for (const spec of HashMap.values(specs)) {
            if (spec.matches(subject)) return spec;
          }
          return null;
        });

      const query: SubjectRegistryShape['query'] = (q) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const results: SubjectSpec[] = [];
          for (const spec of HashMap.values(specs)) {
            if (q.domain && spec.domain !== q.domain) continue;
            if (q.entityType && spec.entityType !== q.entityType) continue;
            if (q.schemaId && spec.schemaId !== q.schemaId) continue;
            if (q.patternMatch && !subjectPatternMatches(q.patternMatch, spec.wildcardPattern())) continue;
            results.push(spec);
          }
          return results;
        });

      // ─── Catalog ───────────────────────────────────────────────────────

      const catalog: SubjectRegistryShape['catalog'] = () =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const entries: CatalogEntry[] = [];
          for (const spec of HashMap.values(specs)) {
            entries.push({ spec, streamName: resolveStreamNameInternal(spec), streamExists: false, consumerCount: 0 });
          }
          return entries;
        });

      const domains: SubjectRegistryShape['domains'] = () =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const s = new Set<DomainId>();
          for (const spec of HashMap.values(specs)) s.add(spec.domain);
          return Array.from(s);
        });

      const entityTypes: SubjectRegistryShape['entityTypes'] = (domain) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const s = new Set<EntityType>();
          for (const spec of HashMap.values(specs)) { if (spec.domain === domain) s.add(spec.entityType); }
          return Array.from(s);
        });

      const specsByDomain: SubjectRegistryShape['specsByDomain'] = (domain) => query({ domain });
      const count: SubjectRegistryShape['count'] = () =>
        Effect.gen(function* () { return HashMap.size(yield* Ref.get(specsRef)); });
      const resolveStreamName: SubjectRegistryShape['resolveStreamName'] = (spec) =>
        Effect.sync(() => resolveStreamNameInternal(spec));
      const specsByStream: SubjectRegistryShape['specsByStream'] = (streamName) =>
        Effect.gen(function* () {
          const specs = yield* Ref.get(specsRef);
          const r: SubjectSpec[] = [];
          for (const spec of HashMap.values(specs)) { if (resolveStreamNameInternal(spec) === streamName) r.push(spec); }
          return r;
        });

      const events = Stream.fromPubSub(eventsPubSub);

      return SubjectRegistry.of({
        register: (s) => register(s).pipe(Effect.withSpan(MshSpan.Registry.register)),
        unregister: (id) => unregister(id).pipe(Effect.withSpan(MshSpan.Registry.unregister)),
        update: (s) => update(s).pipe(Effect.withSpan(MshSpan.Registry.update)),
        get: (id) => get(id).pipe(Effect.withSpan(MshSpan.Registry.get)),
        getOrNull,
        findBySubject: (s) => findBySubject(s).pipe(Effect.withSpan(MshSpan.Registry.findBySubject)),
        query: (q) => query(q).pipe(Effect.withSpan(MshSpan.Registry.query)),
        catalog: () => catalog().pipe(Effect.withSpan(MshSpan.Registry.catalog)),
        domains, entityTypes, specsByDomain, count,
        resolveStreamName, specsByStream, events,
      });
    }),
  );
}

export const SubjectRegistryLive = SubjectRegistry.layer;
