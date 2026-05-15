/**
 * SubjectRegistry Unit Tests
 *
 * Tests hot registration, lookup, catalog introspection.
 * No NATS server required.
 *
 * @module @tmnl/msh/test/subject-registry
 */

import { describe, it, expect } from 'vitest';
import * as Effect from 'effect-v4/Effect';

import {
  SubjectSpec,
  type SubjectSpecId,
  type DomainId,
  type EntityType,
  SubjectRegistry,
  createSubjectSpec,
} from '../src/subject';

// =============================================================================
// Fixtures
// =============================================================================

const flightSpec = () =>
  new SubjectSpec({
    id: 'geoint.flight.position' as SubjectSpecId,
    domain: 'geoint' as DomainId,
    entityType: 'flight' as EntityType,
    description: 'Real-time flight positions',
    pattern: 'geoint.flight.{icao24}.position',
    schemaId: 'FlightPositionEvent',
    streamMapping: { _tag: 'entityType' as const },
    registeredAt: new Date(),
  });

const vesselSpec = () =>
  new SubjectSpec({
    id: 'geoint.vessel.track' as SubjectSpecId,
    domain: 'geoint' as DomainId,
    entityType: 'vessel' as EntityType,
    description: 'Vessel tracks',
    pattern: 'geoint.vessel.{mmsi}.track',
    schemaId: 'VesselTrackEvent',
    streamMapping: { _tag: 'entityType' as const },
    registeredAt: new Date(),
  });

const weatherSpec = () =>
  new SubjectSpec({
    id: 'geoint.weather.alert' as SubjectSpecId,
    domain: 'geoint' as DomainId,
    entityType: 'weather' as EntityType,
    description: 'Weather alerts',
    pattern: 'geoint.weather.{region}.alert',
    schemaId: 'WeatherAlertEvent',
    streamMapping: { _tag: 'domain' as const },
    registeredAt: new Date(),
  });

// =============================================================================
// Registration
// =============================================================================

describe('SubjectRegistry', () => {
  describe('registration', () => {
    it('registers a new spec', () =>
      Effect.gen(function* () {
        const reg = yield* SubjectRegistry;
        const spec = flightSpec();
        yield* reg.register(spec);
        const retrieved = yield* reg.get(spec.id);
        expect(retrieved.id).toBe(spec.id);
        expect(retrieved.pattern).toBe(spec.pattern);
      }).pipe(Effect.provide(SubjectRegistry.layer), Effect.runPromise));

    it('rejects duplicate registration', () =>
      Effect.gen(function* () {
        const reg = yield* SubjectRegistry;
        const spec = flightSpec();
        yield* reg.register(spec);
        const result = yield* Effect.result(reg.register(spec));
        expect(result._tag).toBe('Failure');
      }).pipe(Effect.provide(SubjectRegistry.layer), Effect.runPromise));

    it('unregisters a spec', () =>
      Effect.gen(function* () {
        const reg = yield* SubjectRegistry;
        const spec = flightSpec();
        yield* reg.register(spec);
        yield* reg.unregister(spec.id);
        const result = yield* reg.getOrNull(spec.id);
        expect(result).toBeNull();
      }).pipe(Effect.provide(SubjectRegistry.layer), Effect.runPromise));

    it('rejects unregister of non-existent spec', () =>
      Effect.gen(function* () {
        const reg = yield* SubjectRegistry;
        const result = yield* Effect.result(
          reg.unregister('nonexistent' as SubjectSpecId),
        );
        expect(result._tag).toBe('Failure');
      }).pipe(Effect.provide(SubjectRegistry.layer), Effect.runPromise));
  });

  // =============================================================================
  // Lookup
  // =============================================================================

  describe('lookup', () => {
    it('finds spec by subject match', () =>
      Effect.gen(function* () {
        const reg = yield* SubjectRegistry;
        yield* reg.register(flightSpec());
        const found = yield* reg.findBySubject('geoint.flight.ABC123.position');
        expect(found).not.toBeNull();
        expect(found!.id).toBe('geoint.flight.position');
      }).pipe(Effect.provide(SubjectRegistry.layer), Effect.runPromise));

    it('returns null for non-matching subject', () =>
      Effect.gen(function* () {
        const reg = yield* SubjectRegistry;
        yield* reg.register(flightSpec());
        const found = yield* reg.findBySubject('scada.sensor.123.reading');
        expect(found).toBeNull();
      }).pipe(Effect.provide(SubjectRegistry.layer), Effect.runPromise));

    it('queries by domain', () =>
      Effect.gen(function* () {
        const reg = yield* SubjectRegistry;
        yield* reg.register(flightSpec());
        yield* reg.register(vesselSpec());
        const results = yield* reg.query({ domain: 'geoint' as DomainId });
        expect(results.length).toBe(2);
      }).pipe(Effect.provide(SubjectRegistry.layer), Effect.runPromise));
  });

  // =============================================================================
  // Catalog
  // =============================================================================

  describe('catalog', () => {
    it('returns all specs with stream names', () =>
      Effect.gen(function* () {
        const reg = yield* SubjectRegistry;
        yield* reg.register(flightSpec());
        yield* reg.register(weatherSpec());
        const entries = yield* reg.catalog();
        expect(entries.length).toBe(2);

        const flightEntry = entries.find((e) => e.spec.id === 'geoint.flight.position');
        expect(flightEntry?.streamName).toBe('GEOINT_FLIGHT');

        const weatherEntry = entries.find((e) => e.spec.id === 'geoint.weather.alert');
        expect(weatherEntry?.streamName).toBe('GEOINT');
      }).pipe(Effect.provide(SubjectRegistry.layer), Effect.runPromise));

    it('lists domains', () =>
      Effect.gen(function* () {
        const reg = yield* SubjectRegistry;
        yield* reg.register(flightSpec());
        const domains = yield* reg.domains();
        expect(domains).toContain('geoint');
      }).pipe(Effect.provide(SubjectRegistry.layer), Effect.runPromise));

    it('counts specs', () =>
      Effect.gen(function* () {
        const reg = yield* SubjectRegistry;
        yield* reg.register(flightSpec());
        yield* reg.register(vesselSpec());
        const c = yield* reg.count();
        expect(c).toBe(2);
      }).pipe(Effect.provide(SubjectRegistry.layer), Effect.runPromise));
  });

  // =============================================================================
  // SubjectSpec methods
  // =============================================================================

  describe('SubjectSpec', () => {
    it('resolves pattern with params', () => {
      const spec = flightSpec();
      expect(spec.resolve({ icao24: 'ABC123' })).toBe('geoint.flight.ABC123.position');
    });

    it('wildcardPattern replaces placeholders', () => {
      const spec = flightSpec();
      expect(spec.wildcardPattern()).toBe('geoint.flight.*.position');
    });

    it('capturePattern truncates at first placeholder', () => {
      const spec = flightSpec();
      expect(spec.capturePattern()).toBe('geoint.flight.>');
    });

    it('matches concrete subjects', () => {
      const spec = flightSpec();
      expect(spec.matches('geoint.flight.ABC123.position')).toBe(true);
      expect(spec.matches('geoint.vessel.ABC123.position')).toBe(false);
    });

    it('extracts params from subject', () => {
      const spec = flightSpec();
      const params = spec.extractParams('geoint.flight.ABC123.position');
      expect(params).toEqual({ icao24: 'ABC123' });
    });

    it('returns null for non-matching extractParams', () => {
      const spec = flightSpec();
      expect(spec.extractParams('scada.sensor.123')).toBeNull();
    });
  });

  // =============================================================================
  // createSubjectSpec factory
  // =============================================================================

  describe('createSubjectSpec', () => {
    it('creates with defaults', () => {
      const spec = createSubjectSpec({
        domain: 'mes',
        entityType: 'machine',
        pattern: 'mes.machine.{machineId}.status',
        schemaId: 'MachineStatusEvent',
        description: 'Machine status updates',
      });

      expect(spec.domain).toBe('mes');
      expect(spec.entityType).toBe('machine');
      expect(spec.streamMapping._tag).toBe('entityType');
      expect(spec.registeredAt).toBeInstanceOf(Date);
    });
  });
});
