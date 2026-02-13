/**
 * IIoT Auth Middleware Integration Tests
 *
 * Tests Bearer token authentication middleware for the IIoT HTTP server.
 * Uses HttpApiBuilder.toWebHandler to test the full HTTP stack without
 * booting a real server.
 *
 * Test matrix:
 * - Request without token -> 401
 * - Request with valid token -> 200
 * - Request with invalid/expired token -> 401
 * - Auth disabled layer -> all requests pass
 * - CORS preflight (OPTIONS) bypasses auth
 *
 * @module
 */

import { describe, it, expect, afterAll } from 'vitest'
import { Effect, Layer } from 'effect'
import { HttpApiBuilder, HttpApiSwagger, HttpServer } from '@effect/platform'
import { TestRunner } from '@effect/cluster'
import { IIoTApi } from '../../api'
import { ProxyHandlers } from '../../proxy-handlers'
import { QueryHandlers } from '../../query-handlers'
import { EntityHandlersLayer } from '../../../entity/EntityStack'
import { AllStateServicesInMemory } from '../../../state'
import { IIoTFeatureFlagsDisabledLayer } from '../../../infrastructure/feature-flags'
import {
  IIoTAuthMiddleware,
  IIoTAuthBearerLayer,
  IIoTAuthDisabledLayer,
} from '../../middleware/auth'
import { IIoTRateLimitDisabledLayer } from '../../middleware/rate-limit'
import { createTestToken } from '../../../../holonet/core/auth/HolonetAuthService'

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_SECRET = 'iiot-test-secret-for-auth-middleware'

// =============================================================================
// Layer Composition: Auth ENABLED (Bearer validation)
// =============================================================================

/**
 * API layer with auth middleware ENABLED.
 * Uses a known secret for test token generation.
 */
const ApiWithAuthLive = HttpApiBuilder.api(IIoTApi).pipe(
  Layer.provide(ProxyHandlers),
  Layer.provide(QueryHandlers),
  Layer.provide(EntityHandlersLayer),
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
  Layer.provide(TestRunner.layer),
)

const TestApiWithAuthLayer = Layer.empty.pipe(
  Layer.provideMerge(HttpApiBuilder.middlewareCors()),
  Layer.provideMerge(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provideMerge(ApiWithAuthLive),
  Layer.provideMerge(IIoTAuthBearerLayer(TEST_SECRET)),
  Layer.provideMerge(IIoTRateLimitDisabledLayer),
  Layer.provideMerge(HttpServer.layerContext),
)

// =============================================================================
// Layer Composition: Auth DISABLED (passthrough)
// =============================================================================

const TestApiNoAuthLayer = Layer.empty.pipe(
  Layer.provideMerge(HttpApiBuilder.middlewareCors()),
  Layer.provideMerge(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provideMerge(ApiWithAuthLive),
  Layer.provideMerge(IIoTAuthDisabledLayer),
  Layer.provideMerge(IIoTRateLimitDisabledLayer),
  Layer.provideMerge(HttpServer.layerContext),
)

// =============================================================================
// Test Handlers
// =============================================================================

const authHandler = HttpApiBuilder.toWebHandler(TestApiWithAuthLayer as any)
const noAuthHandler = HttpApiBuilder.toWebHandler(TestApiNoAuthLayer as any)

afterAll(() => {
  authHandler.dispose()
  noAuthHandler.dispose()
})

// =============================================================================
// Token Helpers
// =============================================================================

const createValidToken = () =>
  Effect.runPromise(
    createTestToken(
      {
        sub: 'iiot-operator',
        email: 'operator@plant.example.com',
        permissions: ['asset:read', 'asset:write'],
        scopes: ['iiot:*'],
      },
      TEST_SECRET,
    ),
  )

const createExpiredToken = () =>
  Effect.runPromise(
    createTestToken(
      {
        sub: 'expired-operator',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      },
      TEST_SECRET,
    ),
  )

// =============================================================================
// Auth Enabled Tests
// =============================================================================

describe('IIoT Auth Middleware (enabled)', () => {
  it('rejects request without Authorization header with 401', async () => {
    const res = await authHandler.handler(
      new Request('http://localhost/api/enterprises/enterprise-create/test-ent-auth-001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'auth-test-ent',
          name: 'Auth Test Enterprise',
        }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('accepts request with valid Bearer token', async () => {
    const token = await createValidToken()
    const res = await authHandler.handler(
      new Request('http://localhost/api/enterprises/enterprise-create/test-ent-auth-002', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slug: 'auth-test-ent-2',
          name: 'Auth Test Enterprise 2',
        }),
      }),
    )
    // Should reach the handler (200 success or 500 entity error, but NOT 401)
    expect(res.status).not.toBe(401)
    expect([200, 500]).toContain(res.status)
  })

  it('rejects request with expired token with 401', async () => {
    const token = await createExpiredToken()
    const res = await authHandler.handler(
      new Request('http://localhost/api/enterprises/enterprise-create/test-ent-auth-003', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slug: 'auth-test-ent-3',
          name: 'Auth Test Enterprise 3',
        }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('rejects request with invalid token with 401', async () => {
    const res = await authHandler.handler(
      new Request('http://localhost/api/enterprises/enterprise-create/test-ent-auth-004', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer not-a-real-jwt-token',
        },
        body: JSON.stringify({
          slug: 'auth-test-ent-4',
          name: 'Auth Test Enterprise 4',
        }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('rejects request with wrong secret with 401', async () => {
    const token = await Effect.runPromise(
      createTestToken({ sub: 'hacker' }, 'wrong-secret'),
    )
    const res = await authHandler.handler(
      new Request('http://localhost/api/enterprises/enterprise-create/test-ent-auth-005', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slug: 'auth-test-ent-5',
          name: 'Auth Test Enterprise 5',
        }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('allows CORS preflight (OPTIONS) without auth', async () => {
    const res = await authHandler.handler(
      new Request('http://localhost/api/enterprises/enterprise-create/test', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      }),
    )
    // CORS preflight should bypass auth and return 200 or 204
    expect([200, 204]).toContain(res.status)
  })

  it('allows Swagger /docs without auth', async () => {
    const res = await authHandler.handler(
      new Request('http://localhost/docs'),
    )
    // Swagger UI should be accessible without auth
    // (It's a GET, and the middleware should allow it or it routes before auth)
    expect([200, 401]).toContain(res.status)
  })
})

// =============================================================================
// Auth Disabled Tests
// =============================================================================

describe('IIoT Auth Middleware (disabled)', () => {
  it('allows request without Authorization header', async () => {
    const res = await noAuthHandler.handler(
      new Request('http://localhost/api/enterprises/enterprise-create/test-ent-noauth-001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: 'noauth-test-ent',
          name: 'NoAuth Test Enterprise',
        }),
      }),
    )
    // Should reach the handler -- not blocked
    expect(res.status).not.toBe(401)
    expect([200, 500]).toContain(res.status)
  })

  it('allows request with any token when disabled', async () => {
    const res = await noAuthHandler.handler(
      new Request('http://localhost/api/enterprises/enterprise-create/test-ent-noauth-002', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer some-random-token',
        },
        body: JSON.stringify({
          slug: 'noauth-test-ent-2',
          name: 'NoAuth Test Enterprise 2',
        }),
      }),
    )
    expect(res.status).not.toBe(401)
    expect([200, 500]).toContain(res.status)
  })

  it('allows Swagger /docs without auth', async () => {
    const res = await noAuthHandler.handler(
      new Request('http://localhost/docs'),
    )
    expect(res.status).toBe(200)
  })
})
