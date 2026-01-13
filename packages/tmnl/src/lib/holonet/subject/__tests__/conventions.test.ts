/**
 * Domain Convention Tests
 *
 * Tests for convention validation, pattern prefix enforcement,
 * allowed entity types, and custom validation functions.
 */

import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';

import {
  SubjectSpec,
  type SubjectSpecId,
  type DomainId,
  type EntityType,
  DomainConventionRegistry,
  createDefaultConventionRegistry,
  GEOINT_CONVENTION,
  SCADA_CONVENTION,
  MES_CONVENTION,
  EVENTS_CONVENTION,
} from '../index';

describe('DomainConventionRegistry', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // TEST FIXTURES
  // ─────────────────────────────────────────────────────────────────────────

  const createGeointFlightSpec = () =>
    new SubjectSpec({
      id: 'geoint.flight.position' as SubjectSpecId,
      domain: 'geoint' as DomainId,
      entityType: 'flight' as EntityType,
      description: 'Flight position',
      pattern: 'geoint.flight.{icao24}.position',
      schemaId: 'FlightPositionEvent',
      streamMapping: { _tag: 'entityType' },
      registeredAt: new Date(),
    });

  const createScadaSensorSpec = () =>
    new SubjectSpec({
      id: 'scada.sensor.reading' as SubjectSpecId,
      domain: 'scada' as DomainId,
      entityType: 'sensor' as EntityType,
      description: 'Sensor reading',
      pattern: 'scada.sensor.{sensorId}.reading',
      schemaId: 'SensorReadingEvent',
      streamMapping: { _tag: 'domain' },
      registeredAt: new Date(),
    });

  // ─────────────────────────────────────────────────────────────────────────
  // REGISTRATION TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('registration', () => {
    it('registers a convention', () => {
      const registry = new DomainConventionRegistry();
      registry.register(GEOINT_CONVENTION);

      expect(registry.has('geoint' as DomainId)).toBe(true);
      expect(registry.get('geoint' as DomainId)).toBe(GEOINT_CONVENTION);
    });

    it('lists all conventions', () => {
      const registry = createDefaultConventionRegistry();
      const all = registry.all();

      expect(all.length).toBe(4);
      expect(all).toContain(GEOINT_CONVENTION);
      expect(all).toContain(SCADA_CONVENTION);
      expect(all).toContain(MES_CONVENTION);
      expect(all).toContain(EVENTS_CONVENTION);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATION TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('passes validation for compliant spec', () =>
      Effect.gen(function* () {
        const registry = createDefaultConventionRegistry();
        const spec = createGeointFlightSpec();

        // Should not throw
        yield* registry.validate(spec);
      }).pipe(Effect.runPromise));

    it('allows unknown domain (no convention)', () =>
      Effect.gen(function* () {
        const registry = createDefaultConventionRegistry();
        const spec = new SubjectSpec({
          id: 'custom.entity.event' as SubjectSpecId,
          domain: 'custom' as DomainId,
          entityType: 'entity' as EntityType,
          description: 'Custom event',
          pattern: 'custom.entity.{id}.event',
          schemaId: 'CustomEvent',
          streamMapping: { _tag: 'domain' },
          registeredAt: new Date(),
        });

        // Should not throw - no convention means no restrictions
        yield* registry.validate(spec);
      }).pipe(Effect.runPromise));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PATTERN PREFIX TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('pattern prefix validation', () => {
    it('rejects wrong prefix', () =>
      Effect.gen(function* () {
        const registry = createDefaultConventionRegistry();
        const spec = new SubjectSpec({
          id: 'geoint.flight.position' as SubjectSpecId,
          domain: 'geoint' as DomainId,
          entityType: 'flight' as EntityType,
          description: 'Flight position',
          pattern: 'wrong.flight.{icao24}.position', // Wrong prefix!
          schemaId: 'FlightPositionEvent',
          streamMapping: { _tag: 'entityType' },
          registeredAt: new Date(),
        });

        const result = yield* Effect.either(registry.validate(spec));
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Subject/Convention');
          if (result.left._tag === 'Subject/Convention') {
            expect(result.left.message).toContain('must start with');
          }
        }
      }).pipe(Effect.runPromise));

    it('accepts correct prefix', () =>
      Effect.gen(function* () {
        const registry = createDefaultConventionRegistry();
        const spec = createGeointFlightSpec();

        // Should pass - correct prefix
        yield* registry.validate(spec);
      }).pipe(Effect.runPromise));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ENTITY TYPE RESTRICTION TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('entity type validation', () => {
    it('rejects disallowed entity type', () =>
      Effect.gen(function* () {
        const registry = createDefaultConventionRegistry();
        const spec = new SubjectSpec({
          id: 'geoint.unknown.event' as SubjectSpecId,
          domain: 'geoint' as DomainId,
          entityType: 'unknown' as EntityType, // Not in allowed list!
          description: 'Unknown event',
          pattern: 'geoint.unknown.{id}.event',
          schemaId: 'UnknownEvent',
          streamMapping: { _tag: 'entityType' },
          registeredAt: new Date(),
        });

        const result = yield* Effect.either(registry.validate(spec));
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Subject/Convention');
          if (result.left._tag === 'Subject/Convention') {
            expect(result.left.message).toContain('not allowed');
          }
        }
      }).pipe(Effect.runPromise));

    it('accepts allowed entity type', () =>
      Effect.gen(function* () {
        const registry = createDefaultConventionRegistry();
        const spec = createGeointFlightSpec();

        // Should pass - 'flight' is allowed for GEOINT
        yield* registry.validate(spec);
      }).pipe(Effect.runPromise));

    it('allows any entity type for unrestricted domain', () =>
      Effect.gen(function* () {
        const registry = createDefaultConventionRegistry();
        const spec = new SubjectSpec({
          id: 'events.arbitrary.event' as SubjectSpecId,
          domain: 'events' as DomainId,
          entityType: 'arbitrary' as EntityType, // Any type allowed
          description: 'Arbitrary event',
          pattern: 'events.arbitrary.{id}.event',
          schemaId: 'ArbitraryEvent',
          streamMapping: { _tag: 'domain' },
          registeredAt: new Date(),
        });

        // Should pass - EVENTS domain has no entity type restrictions
        yield* registry.validate(spec);
      }).pipe(Effect.runPromise));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOM VALIDATION TESTS
  // ─────────────────────────────────────────────────────────────────────────

  describe('custom validation', () => {
    it('applies custom validation rules', () =>
      Effect.gen(function* () {
        const registry = createDefaultConventionRegistry();
        const spec = new SubjectSpec({
          id: 'scada.sensor.reading' as SubjectSpecId,
          domain: 'scada' as DomainId,
          entityType: 'sensor' as EntityType,
          description: 'Sensor reading',
          pattern: 'scada.sensor.reading', // Missing {sensorId}!
          schemaId: 'SensorReadingEvent',
          streamMapping: { _tag: 'domain' },
          registeredAt: new Date(),
        });

        const result = yield* Effect.either(registry.validate(spec));
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Subject/Validation');
          if (result.left._tag === 'Subject/Validation') {
            expect(result.left.message).toContain('{sensorId}');
          }
        }
      }).pipe(Effect.runPromise));

    it('passes custom validation when requirements met', () =>
      Effect.gen(function* () {
        const registry = createDefaultConventionRegistry();
        const spec = createScadaSensorSpec();

        // Should pass - includes {sensorId}
        yield* registry.validate(spec);
      }).pipe(Effect.runPromise));
  });
});

// =============================================================================
// DEFAULT CONVENTION TESTS
// =============================================================================

describe('Default Conventions', () => {
  describe('GEOINT_CONVENTION', () => {
    it('has correct configuration', () => {
      expect(GEOINT_CONVENTION.domain).toBe('geoint');
      expect(GEOINT_CONVENTION.patternPrefix).toBe('geoint.');
      expect(GEOINT_CONVENTION.defaultStreamMapping._tag).toBe('entityType');
      expect(GEOINT_CONVENTION.allowedEntityTypes).toContain('flight');
      expect(GEOINT_CONVENTION.allowedEntityTypes).toContain('vessel');
      expect(GEOINT_CONVENTION.allowedEntityTypes).toContain('weather');
      expect(GEOINT_CONVENTION.allowedEntityTypes).toContain('poi');
      expect(GEOINT_CONVENTION.allowedEntityTypes).toContain('imagery');
    });
  });

  describe('SCADA_CONVENTION', () => {
    it('has correct configuration', () => {
      expect(SCADA_CONVENTION.domain).toBe('scada');
      expect(SCADA_CONVENTION.patternPrefix).toBe('scada.');
      expect(SCADA_CONVENTION.defaultStreamMapping._tag).toBe('domain');
      expect(SCADA_CONVENTION.validate).toBeDefined();
    });
  });

  describe('MES_CONVENTION', () => {
    it('has correct configuration', () => {
      expect(MES_CONVENTION.domain).toBe('mes');
      expect(MES_CONVENTION.patternPrefix).toBe('mes.');
      expect(MES_CONVENTION.defaultStreamMapping._tag).toBe('entityType');
      expect(MES_CONVENTION.allowedEntityTypes).toContain('machine');
      expect(MES_CONVENTION.allowedEntityTypes).toContain('order');
      expect(MES_CONVENTION.allowedEntityTypes).toContain('product');
      expect(MES_CONVENTION.allowedEntityTypes).toContain('batch');
    });
  });

  describe('EVENTS_CONVENTION', () => {
    it('has correct configuration', () => {
      expect(EVENTS_CONVENTION.domain).toBe('events');
      expect(EVENTS_CONVENTION.patternPrefix).toBe('events.');
      expect(EVENTS_CONVENTION.defaultStreamMapping._tag).toBe('domain');
      expect(EVENTS_CONVENTION.allowedEntityTypes).toBeUndefined();
    });
  });
});
