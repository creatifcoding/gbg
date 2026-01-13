/**
 * Subject Registry Tests
 *
 * Tests for hot registration, catalog introspection, and reactive events.
 */

import { describe, it, expect } from 'vitest';
import { Effect, Stream, Chunk, Fiber } from 'effect';

import {
  SubjectSpec,
  type SubjectSpecId,
  type DomainId,
  type EntityType,
  SubjectRegistry,
  createSubjectSpec,
} from '../index';

describe('SubjectRegistry', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // TEST FIXTURES
  // ─────────────────────────────────────────────────────────────────────────

  const createFlightPositionSpec = () =>
    new SubjectSpec({
      id: 'geoint.flight.position' as SubjectSpecId,
      domain: 'geoint' as DomainId,
      entityType: 'flight' as EntityType,
      description: 'Real-time flight position updates',
      pattern: 'geoint.flight.{icao24}.position',
      schemaId: 'FlightPositionEvent',
      streamMapping: { _tag: 'entityType' },
      registeredAt: new Date(),
    });

  const createVesselTrackSpec = () =>
    new SubjectSpec({
      id: 'geoint.vessel.track' as SubjectSpecId,
      domain: 'geoint' as DomainId,
      entityType: 'vessel' as EntityType,
      description: 'Vessel track updates',
      pattern: 'geoint.vessel.{mmsi}.track',
      schemaId: 'VesselTrackEvent',
      streamMapping: { _tag: 'entityType' },
      registeredAt: new Date(),
    });

  const createWeatherAlertSpec = () =>
    new SubjectSpec({
      id: 'geoint.weather.alert' as SubjectSpecId,
      domain: 'geoint' as DomainId,
      entityType: 'weather' as EntityType,
      description: 'Weather alerts',
      pattern: 'geoint.weather.{region}.alert',
      schemaId: 'WeatherAlertEvent',
      streamMapping: { _tag: 'domain' },
      registeredAt: new Date(),
    });

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRATION TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('registration', () => {
    it('registers a new subject spec', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec = createFlightPositionSpec();

        yield* registry.register(spec);

        const retrieved = yield* registry.get(spec.id);
        expect(retrieved.id).toBe(spec.id);
        expect(retrieved.pattern).toBe(spec.pattern);
        expect(retrieved.schemaId).toBe(spec.schemaId);
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('rejects duplicate registration', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec = createFlightPositionSpec();

        yield* registry.register(spec);

        const result = yield* Effect.either(registry.register(spec));
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Subject/AlreadyRegistered');
        }
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('rejects pattern conflicts', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec1 = createFlightPositionSpec();

        // Create a different spec with the same pattern
        const spec2 = new SubjectSpec({
          id: 'geoint.flight.position.v2' as SubjectSpecId,
          domain: 'geoint' as DomainId,
          entityType: 'flight' as EntityType,
          description: 'Duplicate pattern',
          pattern: 'geoint.flight.{icao24}.position', // Same pattern!
          schemaId: 'FlightPositionEventV2',
          streamMapping: { _tag: 'entityType' },
          registeredAt: new Date(),
        });

        yield* registry.register(spec1);

        const result = yield* Effect.either(registry.register(spec2));
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Subject/PatternConflict');
        }
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('unregisters a spec', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec = createFlightPositionSpec();

        yield* registry.register(spec);
        yield* registry.unregister(spec.id);

        const result = yield* registry.getOrNull(spec.id);
        expect(result).toBeNull();
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('returns NotFoundError for unregistering non-existent spec', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        const result = yield* Effect.either(
          registry.unregister('non-existent' as SubjectSpecId)
        );
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Subject/NotFound');
        }
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LOOKUP TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('lookup', () => {
    it('gets a spec by ID', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec = createFlightPositionSpec();

        yield* registry.register(spec);

        const retrieved = yield* registry.get(spec.id);
        expect(retrieved.id).toBe(spec.id);
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('returns NotFoundError for missing spec', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        const result = yield* Effect.either(
          registry.get('non-existent' as SubjectSpecId)
        );
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Subject/NotFound');
        }
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('getOrNull returns null for missing spec', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        const result = yield* registry.getOrNull('non-existent' as SubjectSpecId);
        expect(result).toBeNull();
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('finds spec by concrete subject', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec = createFlightPositionSpec();

        yield* registry.register(spec);

        const found = yield* registry.findBySubject(
          'geoint.flight.ABC123.position'
        );
        expect(found).not.toBeNull();
        expect(found?.id).toBe(spec.id);
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('returns null for non-matching subject', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec = createFlightPositionSpec();

        yield* registry.register(spec);

        const found = yield* registry.findBySubject('scada.sensor.001.reading');
        expect(found).toBeNull();
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // QUERY TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('query', () => {
    it('queries by domain', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        yield* registry.register(createFlightPositionSpec());
        yield* registry.register(createVesselTrackSpec());
        yield* registry.register(createWeatherAlertSpec());

        const results = yield* registry.query({
          domain: 'geoint' as DomainId,
        });
        expect(results.length).toBe(3);
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('queries by entity type', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        yield* registry.register(createFlightPositionSpec());
        yield* registry.register(createVesselTrackSpec());
        yield* registry.register(createWeatherAlertSpec());

        const results = yield* registry.query({
          entityType: 'flight' as EntityType,
        });
        expect(results.length).toBe(1);
        expect(results[0].entityType).toBe('flight');
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('queries by schema ID', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        yield* registry.register(createFlightPositionSpec());
        yield* registry.register(createVesselTrackSpec());

        const results = yield* registry.query({
          schemaId: 'VesselTrackEvent',
        });
        expect(results.length).toBe(1);
        expect(results[0].schemaId).toBe('VesselTrackEvent');
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('combines query filters', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        yield* registry.register(createFlightPositionSpec());
        yield* registry.register(createVesselTrackSpec());
        yield* registry.register(createWeatherAlertSpec());

        const results = yield* registry.query({
          domain: 'geoint' as DomainId,
          entityType: 'vessel' as EntityType,
        });
        expect(results.length).toBe(1);
        expect(results[0].entityType).toBe('vessel');
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CATALOG INTROSPECTION TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('catalog introspection', () => {
    it('lists all domains', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        yield* registry.register(createFlightPositionSpec());
        yield* registry.register(createVesselTrackSpec());

        const domains = yield* registry.domains();
        expect(domains.length).toBe(1);
        expect(domains).toContain('geoint');
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('lists entity types for a domain', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        yield* registry.register(createFlightPositionSpec());
        yield* registry.register(createVesselTrackSpec());
        yield* registry.register(createWeatherAlertSpec());

        const types = yield* registry.entityTypes('geoint' as DomainId);
        expect(types.length).toBe(3);
        expect(types).toContain('flight');
        expect(types).toContain('vessel');
        expect(types).toContain('weather');
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('gets specs by domain', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        yield* registry.register(createFlightPositionSpec());
        yield* registry.register(createVesselTrackSpec());

        const specs = yield* registry.specsByDomain('geoint' as DomainId);
        expect(specs.length).toBe(2);
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('returns catalog entries', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        yield* registry.register(createFlightPositionSpec());

        const entries = yield* registry.catalog();
        expect(entries.length).toBe(1);
        expect(entries[0].streamName).toBe('GEOINT_FLIGHT');
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('counts registered specs', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        expect(yield* registry.count()).toBe(0);

        yield* registry.register(createFlightPositionSpec());
        expect(yield* registry.count()).toBe(1);

        yield* registry.register(createVesselTrackSpec());
        expect(yield* registry.count()).toBe(2);
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // STREAM RESOLUTION TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('stream resolution', () => {
    it('resolves stream name for entityType strategy', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec = createFlightPositionSpec();

        const streamName = yield* registry.resolveStreamName(spec);
        expect(streamName).toBe('GEOINT_FLIGHT');
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('resolves stream name for domain strategy', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec = createWeatherAlertSpec();

        const streamName = yield* registry.resolveStreamName(spec);
        expect(streamName).toBe('GEOINT');
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('resolves stream name for dedicated strategy', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec = new SubjectSpec({
          id: 'geoint.poi.events' as SubjectSpecId,
          domain: 'geoint' as DomainId,
          entityType: 'poi' as EntityType,
          description: 'POI events',
          pattern: 'geoint.poi.{poiId}.events',
          schemaId: 'POIEvent',
          streamMapping: { _tag: 'dedicated', streamName: 'GEOINT_POI_EVENTS' },
          registeredAt: new Date(),
        });

        const streamName = yield* registry.resolveStreamName(spec);
        expect(streamName).toBe('GEOINT_POI_EVENTS');
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('gets specs by stream name', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;

        yield* registry.register(createFlightPositionSpec());
        yield* registry.register(createVesselTrackSpec());
        yield* registry.register(createWeatherAlertSpec());

        const flightSpecs = yield* registry.specsByStream('GEOINT_FLIGHT');
        expect(flightSpecs.length).toBe(1);
        expect(flightSpecs[0].entityType).toBe('flight');

        const domainSpecs = yield* registry.specsByStream('GEOINT');
        expect(domainSpecs.length).toBe(1);
        expect(domainSpecs[0].entityType).toBe('weather');
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('events', () => {
    it('emits Registered event on registration', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec = createFlightPositionSpec();

        // Start collecting events
        const fiber = yield* Stream.take(registry.events, 1).pipe(
          Stream.runCollect,
          Effect.fork
        );

        // Yield to let the subscription fiber start listening
        yield* Effect.yieldNow();
        yield* Effect.sleep(10);

        // Register spec
        yield* registry.register(spec);

        // Get collected events with a timeout
        const events = yield* Fiber.join(fiber).pipe(
          Effect.timeout('2 seconds'),
          Effect.orDie
        );
        const eventArray = Chunk.toArray(events);

        expect(eventArray.length).toBe(1);
        expect(eventArray[0]._tag).toBe('Registered');
        if (eventArray[0]._tag === 'Registered') {
          expect(eventArray[0].spec.id).toBe(spec.id);
        }
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));

    it('emits Unregistered event on unregistration', () =>
      Effect.gen(function* () {
        const registry = yield* SubjectRegistry;
        const spec = createFlightPositionSpec();

        yield* registry.register(spec);

        // Start collecting events (skip the Registered event)
        const fiber = yield* Stream.take(registry.events, 1).pipe(
          Stream.runCollect,
          Effect.fork
        );

        // Yield to let the subscription fiber start listening
        yield* Effect.yieldNow();
        yield* Effect.sleep(10);

        // Unregister spec
        yield* registry.unregister(spec.id);

        // Get collected events with a timeout
        const events = yield* Fiber.join(fiber).pipe(
          Effect.timeout('2 seconds'),
          Effect.orDie
        );
        const eventArray = Chunk.toArray(events);

        expect(eventArray.length).toBe(1);
        expect(eventArray[0]._tag).toBe('Unregistered');
        if (eventArray[0]._tag === 'Unregistered') {
          expect(eventArray[0].specId).toBe(spec.id);
        }
      }).pipe(Effect.provide(SubjectRegistry.Default), Effect.runPromise));
  });
});

// =============================================================================
// SUBJECT SPEC UNIT TESTS
// =============================================================================

describe('SubjectSpec', () => {
  const createSpec = () =>
    new SubjectSpec({
      id: 'geoint.flight.position' as SubjectSpecId,
      domain: 'geoint' as DomainId,
      entityType: 'flight' as EntityType,
      description: 'Real-time flight position updates',
      pattern: 'geoint.flight.{icao24}.position',
      schemaId: 'FlightPositionEvent',
      streamMapping: { _tag: 'entityType' },
      registeredAt: new Date(),
    });

  describe('resolve', () => {
    it('resolves pattern with parameters', () => {
      const spec = createSpec();
      const resolved = spec.resolve({ icao24: 'ABC123' });
      expect(resolved).toBe('geoint.flight.ABC123.position');
    });

    it('keeps unresolved placeholders', () => {
      const spec = createSpec();
      const resolved = spec.resolve({});
      expect(resolved).toBe('geoint.flight.{icao24}.position');
    });
  });

  describe('wildcardPattern', () => {
    it('replaces placeholders with wildcards', () => {
      const spec = createSpec();
      expect(spec.wildcardPattern()).toBe('geoint.flight.*.position');
    });
  });

  describe('capturePattern', () => {
    it('replaces from first placeholder with >', () => {
      const spec = createSpec();
      expect(spec.capturePattern()).toBe('geoint.flight.>');
    });

    it('returns pattern unchanged if no placeholders', () => {
      const spec = new SubjectSpec({
        id: 'static.pattern' as SubjectSpecId,
        domain: 'static' as DomainId,
        entityType: 'fixed' as EntityType,
        description: 'Static pattern',
        pattern: 'static.fixed.pattern',
        schemaId: 'StaticEvent',
        streamMapping: { _tag: 'domain' },
        registeredAt: new Date(),
      });
      expect(spec.capturePattern()).toBe('static.fixed.pattern');
    });
  });

  describe('placeholders', () => {
    it('extracts placeholder names', () => {
      const spec = createSpec();
      expect(spec.placeholders()).toEqual(['icao24']);
    });

    it('extracts multiple placeholders', () => {
      const spec = new SubjectSpec({
        id: 'multi.placeholder' as SubjectSpecId,
        domain: 'multi' as DomainId,
        entityType: 'test' as EntityType,
        description: 'Multiple placeholders',
        pattern: 'multi.{region}.{sensorId}.{metric}',
        schemaId: 'MultiEvent',
        streamMapping: { _tag: 'domain' },
        registeredAt: new Date(),
      });
      expect(spec.placeholders()).toEqual(['region', 'sensorId', 'metric']);
    });

    it('returns empty array for no placeholders', () => {
      const spec = new SubjectSpec({
        id: 'static.pattern' as SubjectSpecId,
        domain: 'static' as DomainId,
        entityType: 'fixed' as EntityType,
        description: 'Static pattern',
        pattern: 'static.fixed.pattern',
        schemaId: 'StaticEvent',
        streamMapping: { _tag: 'domain' },
        registeredAt: new Date(),
      });
      expect(spec.placeholders()).toEqual([]);
    });
  });

  describe('matches', () => {
    it('matches concrete subject', () => {
      const spec = createSpec();
      expect(spec.matches('geoint.flight.ABC123.position')).toBe(true);
    });

    it('does not match different prefix', () => {
      const spec = createSpec();
      expect(spec.matches('scada.flight.ABC123.position')).toBe(false);
    });

    it('does not match different suffix', () => {
      const spec = createSpec();
      expect(spec.matches('geoint.flight.ABC123.velocity')).toBe(false);
    });

    it('does not match wrong token count', () => {
      const spec = createSpec();
      expect(spec.matches('geoint.flight.ABC123')).toBe(false);
      expect(spec.matches('geoint.flight.ABC123.position.extra')).toBe(false);
    });
  });

  describe('extractParams', () => {
    it('extracts parameters from matching subject', () => {
      const spec = createSpec();
      const params = spec.extractParams('geoint.flight.ABC123.position');
      expect(params).toEqual({ icao24: 'ABC123' });
    });

    it('returns null for non-matching subject', () => {
      const spec = createSpec();
      const params = spec.extractParams('scada.sensor.001.reading');
      expect(params).toBeNull();
    });

    it('extracts multiple parameters', () => {
      const spec = new SubjectSpec({
        id: 'multi.placeholder' as SubjectSpecId,
        domain: 'multi' as DomainId,
        entityType: 'test' as EntityType,
        description: 'Multiple placeholders',
        pattern: 'multi.{region}.{sensorId}.{metric}',
        schemaId: 'MultiEvent',
        streamMapping: { _tag: 'domain' },
        registeredAt: new Date(),
      });
      const params = spec.extractParams('multi.us-east.sensor-001.temperature');
      expect(params).toEqual({
        region: 'us-east',
        sensorId: 'sensor-001',
        metric: 'temperature',
      });
    });
  });
});

// =============================================================================
// FACTORY TESTS
// =============================================================================

describe('createSubjectSpec', () => {
  it('creates spec with defaults', () => {
    const spec = createSubjectSpec({
      domain: 'geoint',
      entityType: 'flight',
      pattern: 'geoint.flight.{icao24}.position',
      schemaId: 'FlightPositionEvent',
      description: 'Flight positions',
    });

    expect(spec.domain).toBe('geoint');
    expect(spec.entityType).toBe('flight');
    expect(spec.streamMapping._tag).toBe('entityType');
    expect(spec.registeredAt).toBeInstanceOf(Date);
  });

  it('respects custom stream mapping', () => {
    const spec = createSubjectSpec({
      domain: 'geoint',
      entityType: 'flight',
      pattern: 'geoint.flight.{icao24}.position',
      schemaId: 'FlightPositionEvent',
      description: 'Flight positions',
      streamMapping: { _tag: 'domain' },
    });

    expect(spec.streamMapping._tag).toBe('domain');
  });
});
