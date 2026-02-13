/**
 * TopicRouter Service Tests
 *
 * Tests the UNS topic-to-DeviceId routing service.
 * Covers exact matching, glob matching, batch registration,
 * priority rules, and schema encode/decode roundtrip.
 *
 * @module @gbg/tmnl/iiot/adapters/__tests__/device-routing
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, Schema } from 'effect'
import {
  TopicRoute,
  TopicRouter,
  TopicRouterLive,
} from '../device-routing'

// =============================================================================
// Test 1: Exact matching
// =============================================================================

describe('TopicRouter', () => {
  const TestLayer = TopicRouterLive

  describe('exact matching', () => {
    it.effect('resolves an exact topic to the correct deviceId', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        yield* router.register({
          topicPattern: 'spBv1.0/acme/DDATA/site-a/temp-01',
          deviceId: 'DEV-temp-01',
        })
        const result = yield* router.resolve('spBv1.0/acme/DDATA/site-a/temp-01')
        expect(result).toBe('DEV-temp-01')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('resolves multiple distinct exact topics', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        yield* router.register({
          topicPattern: 'ns=2;s=Motor01.Temperature',
          deviceId: 'DEV-motor-01',
        })
        yield* router.register({
          topicPattern: 'ns=2;s=Motor02.Temperature',
          deviceId: 'DEV-motor-02',
        })
        const r1 = yield* router.resolve('ns=2;s=Motor01.Temperature')
        const r2 = yield* router.resolve('ns=2;s=Motor02.Temperature')
        expect(r1).toBe('DEV-motor-01')
        expect(r2).toBe('DEV-motor-02')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // ===========================================================================
  // Test 2: Glob matching
  // ===========================================================================

  describe('glob matching', () => {
    it.effect('resolves glob pattern with wildcard', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        yield* router.register({
          topicPattern: 'spBv1.0/*/DDATA/*',
          deviceId: 'DEV-catch-all',
        })
        const result = yield* router.resolve('spBv1.0/acme/DDATA/temp-01')
        expect(result).toBe('DEV-catch-all')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('resolves glob with multiple wildcards', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        yield* router.register({
          topicPattern: 'spBv1.0/*/DDATA/*/sensors/*',
          deviceId: 'DEV-sensor-wildcard',
        })
        const result = yield* router.resolve('spBv1.0/acme/DDATA/site-a/sensors/temp-01')
        expect(result).toBe('DEV-sensor-wildcard')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('glob does not match partial segments', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        yield* router.register({
          topicPattern: 'spBv1.0/*/DDATA/*',
          deviceId: 'DEV-catch-all',
        })
        // This has extra segments -- glob '*' matches one segment only (non-separator)
        const result = yield* router.resolve('spBv1.0/acme/DDATA/site-a/extra/segment')
        expect(result).toBeNull()
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // ===========================================================================
  // Test 3: No match
  // ===========================================================================

  describe('no match', () => {
    it.effect('returns null for unregistered topic', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        const result = yield* router.resolve('completely/unknown/topic')
        expect(result).toBeNull()
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('returns null when routes exist but none match', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        yield* router.register({
          topicPattern: 'spBv1.0/acme/DDATA/site-a/temp-01',
          deviceId: 'DEV-temp-01',
        })
        const result = yield* router.resolve('spBv1.0/acme/DDATA/site-b/temp-02')
        expect(result).toBeNull()
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // ===========================================================================
  // Test 4: Register batch
  // ===========================================================================

  describe('registerBatch', () => {
    it.effect('registers multiple routes and resolves all', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        yield* router.registerBatch([
          { topicPattern: 'topic/a', deviceId: 'DEV-a' },
          { topicPattern: 'topic/b', deviceId: 'DEV-b' },
          { topicPattern: 'topic/c', deviceId: 'DEV-c' },
        ])
        const ra = yield* router.resolve('topic/a')
        const rb = yield* router.resolve('topic/b')
        const rc = yield* router.resolve('topic/c')
        expect(ra).toBe('DEV-a')
        expect(rb).toBe('DEV-b')
        expect(rc).toBe('DEV-c')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('registerBatch handles mix of exact and glob routes', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        yield* router.registerBatch([
          { topicPattern: 'exact/topic/here', deviceId: 'DEV-exact' },
          { topicPattern: 'glob/*/match', deviceId: 'DEV-glob' },
        ])
        const r1 = yield* router.resolve('exact/topic/here')
        const r2 = yield* router.resolve('glob/anything/match')
        expect(r1).toBe('DEV-exact')
        expect(r2).toBe('DEV-glob')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // ===========================================================================
  // Test 5: Priority -- exact match wins over glob
  // ===========================================================================

  describe('priority', () => {
    it.effect('exact match takes priority over glob match', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        // Register glob first
        yield* router.register({
          topicPattern: 'spBv1.0/*/DDATA/*',
          deviceId: 'DEV-glob-fallback',
        })
        // Register exact that would also match the glob
        yield* router.register({
          topicPattern: 'spBv1.0/acme/DDATA/temp-01',
          deviceId: 'DEV-exact-match',
        })
        const result = yield* router.resolve('spBv1.0/acme/DDATA/temp-01')
        expect(result).toBe('DEV-exact-match')
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('glob match is used when no exact match exists', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        yield* router.register({
          topicPattern: 'spBv1.0/acme/DDATA/temp-01',
          deviceId: 'DEV-exact-match',
        })
        yield* router.register({
          topicPattern: 'spBv1.0/*/DDATA/*',
          deviceId: 'DEV-glob-fallback',
        })
        // Different topic -- no exact match but glob matches
        const result = yield* router.resolve('spBv1.0/other/DDATA/pressure-01')
        expect(result).toBe('DEV-glob-fallback')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // ===========================================================================
  // Test 6: Multiple globs
  // ===========================================================================

  describe('multiple globs', () => {
    it.effect('first registered glob that matches wins', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter
        yield* router.register({
          topicPattern: 'spBv1.0/acme/DDATA/*',
          deviceId: 'DEV-acme-catch',
        })
        yield* router.register({
          topicPattern: 'spBv1.0/*/DDATA/*',
          deviceId: 'DEV-any-catch',
        })
        // Both globs match, but the first registered (more specific) wins
        const result = yield* router.resolve('spBv1.0/acme/DDATA/temp-01')
        expect(result).toBe('DEV-acme-catch')
      }).pipe(Effect.provide(TestLayer))
    )
  })

  // ===========================================================================
  // Test 7: Tag identity
  // ===========================================================================

  describe('Tag identity', () => {
    it('TopicRouter.key is tmnl/iiot/TopicRouter', () => {
      expect(TopicRouter.key).toBe('tmnl/iiot/TopicRouter')
    })
  })

  // ===========================================================================
  // Test 8: TopicRoute schema roundtrip
  // ===========================================================================

  describe('TopicRoute schema', () => {
    it('encode/decode roundtrip for TopicRoute without transform', () => {
      const route = {
        topicPattern: 'spBv1.0/acme/DDATA/site-a/temp-01',
        deviceId: 'DEV-temp-01',
      }
      const decoded = Schema.decodeUnknownSync(TopicRoute)(route)
      const encoded = Schema.encodeSync(TopicRoute)(decoded)
      expect(encoded).toEqual(route)
    })

    it('encode/decode roundtrip for TopicRoute with transform', () => {
      const route = {
        topicPattern: 'spBv1.0/acme/DDATA/site-a/temp-01',
        deviceId: 'DEV-temp-01',
        transform: { scale: 0.01, offset: -273.15 },
      }
      const decoded = Schema.decodeUnknownSync(TopicRoute)(route)
      const encoded = Schema.encodeSync(TopicRoute)(decoded)
      expect(encoded).toEqual(route)
    })

    it('TopicRoute rejects non-string topicPattern', () => {
      expect(() =>
        Schema.decodeUnknownSync(TopicRoute)({
          topicPattern: 123,
          deviceId: 'DEV-test',
        })
      ).toThrow()
    })
  })
})
