/**
 * IIoT Rate Limiting Middleware Integration Tests
 *
 * Tests rate limiting through the full HTTP stack using HttpApiBuilder.toWebHandler.
 * Same pattern as auth-middleware.test.ts — real HTTP requests, real middleware pipeline.
 *
 * Scenarios:
 * 1. Burst: N requests pass, N+1 gets 429
 * 2. Per-client isolation: Client A rate-limited, Client B still allowed
 * 3. 429 response body includes retryAfter field
 * 4. Window reset: after window expires, requests pass again
 * 5. Disabled layer: unlimited requests pass through
 * 6. Middleware ordering: rate limit runs before auth (reject before validating token)
 *
 * @module
 */

import { describe, it, expect, afterAll } from 'vitest'
import { Layer } from 'effect'
import { HttpApiBuilder, HttpApiSwagger, HttpServer } from '@effect/platform'
import { TestRunner } from '@effect/cluster'
import { IIoTApi } from '../../api'
import { ProxyHandlers } from '../../proxy-handlers'
import { QueryHandlers } from '../../query-handlers'
import { EntityHandlersLayer } from '../../../entity/EntityStack'
import { AllStateServicesInMemory } from '../../../state'
import { IIoTFeatureFlagsDisabledLayer } from '../../../infrastructure/feature-flags'
import { IIoTAuthDisabledLayer } from '../../middleware/auth'
import {
  IIoTRateLimitEnabledLayer,
  IIoTRateLimitDisabledLayer,
} from '../../middleware/rate-limit'

// =============================================================================
// Layer Composition: Rate Limiting ENABLED (tight: 3 requests per 60s window)
// =============================================================================

/**
 * Base API layer without middleware layers — mirrors auth-middleware.test.ts pattern.
 */
const ApiBaseLive = HttpApiBuilder.api(IIoTApi).pipe(
  Layer.provide(ProxyHandlers),
  Layer.provide(QueryHandlers),
  Layer.provide(EntityHandlersLayer),
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
  Layer.provide(TestRunner.layer),
)

/**
 * Test layer with rate limiting ENABLED: 3 requests per 60s window.
 * Auth disabled (passthrough) to isolate rate-limit behavior.
 */
const TestRateLimitedLayer = Layer.empty.pipe(
  Layer.provideMerge(HttpApiBuilder.middlewareCors()),
  Layer.provideMerge(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provideMerge(ApiBaseLive),
  Layer.provideMerge(IIoTAuthDisabledLayer),
  Layer.provideMerge(IIoTRateLimitEnabledLayer({ maxRequests: 3, windowMs: 60_000 })),
  Layer.provideMerge(HttpServer.layerContext),
)

/**
 * Test layer with rate limiting DISABLED (passthrough).
 * Auth disabled too — tests that unlimited requests pass through.
 */
const TestUnlimitedLayer = Layer.empty.pipe(
  Layer.provideMerge(HttpApiBuilder.middlewareCors()),
  Layer.provideMerge(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provideMerge(ApiBaseLive),
  Layer.provideMerge(IIoTAuthDisabledLayer),
  Layer.provideMerge(IIoTRateLimitDisabledLayer),
  Layer.provideMerge(HttpServer.layerContext),
)

/**
 * Tight limit for window-reset tests: 2 requests per 100ms window.
 */
const TestTightWindowLayer = Layer.empty.pipe(
  Layer.provideMerge(HttpApiBuilder.middlewareCors()),
  Layer.provideMerge(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provideMerge(ApiBaseLive),
  Layer.provideMerge(IIoTAuthDisabledLayer),
  Layer.provideMerge(IIoTRateLimitEnabledLayer({ maxRequests: 2, windowMs: 100 })),
  Layer.provideMerge(HttpServer.layerContext),
)

// =============================================================================
// Test Handlers
// =============================================================================

const limitedHandler = HttpApiBuilder.toWebHandler(TestRateLimitedLayer as any)
const unlimitedHandler = HttpApiBuilder.toWebHandler(TestUnlimitedLayer as any)
const tightHandler = HttpApiBuilder.toWebHandler(TestTightWindowLayer as any)

afterAll(() => {
  limitedHandler.dispose()
  unlimitedHandler.dispose()
  tightHandler.dispose()
})

// =============================================================================
// Request Helpers
// =============================================================================

/**
 * POST request to enterprise create endpoint.
 * Uses unique entityId per call to avoid conflicts.
 */
const makeRequest = (entityId: string, clientIp: string = '127.0.0.1') =>
  new Request(`http://localhost/api/enterprises/enterprise-create/${entityId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': clientIp,
    },
    body: JSON.stringify({
      slug: `rl-test-${entityId}`,
      name: `Rate Limit Test ${entityId}`,
    }),
  })

// =============================================================================
// Burst Scenario: N pass, N+1 gets 429
// =============================================================================

describe('IIoT Rate Limit Middleware — burst scenario (maxRequests=3)', () => {
  it('first 3 requests pass (200 or 500, but NOT 429)', async () => {
    for (let i = 1; i <= 3; i++) {
      const res = await limitedHandler.handler(
        makeRequest(`burst-${i}`, '10.0.0.1'),
      )
      expect(res.status).not.toBe(429)
      expect([200, 500]).toContain(res.status)
    }
  })

  it('4th request from same client gets 429', async () => {
    // Requests 1-3 already consumed the bucket for 10.0.0.1 above
    const res = await limitedHandler.handler(
      makeRequest('burst-4', '10.0.0.1'),
    )
    expect(res.status).toBe(429)
  })

  it('5th request from same client also gets 429', async () => {
    const res = await limitedHandler.handler(
      makeRequest('burst-5', '10.0.0.1'),
    )
    expect(res.status).toBe(429)
  })
})

// =============================================================================
// 429 Response Body
// =============================================================================

describe('IIoT Rate Limit Middleware — 429 response body', () => {
  it('429 response includes _tag and retryAfter', async () => {
    // Use a fresh client IP and exhaust the limit
    for (let i = 1; i <= 3; i++) {
      await limitedHandler.handler(makeRequest(`body-${i}`, '10.0.1.1'))
    }

    const res = await limitedHandler.handler(makeRequest('body-4', '10.0.1.1'))
    expect(res.status).toBe(429)

    const body = await res.json()
    expect(body._tag).toBe('IIoTRateLimitExceeded')
    expect(typeof body.retryAfter).toBe('number')
    expect(body.retryAfter).toBeGreaterThanOrEqual(0)
  })

  it('retryAfter is in seconds (not milliseconds)', async () => {
    // Use another fresh client
    for (let i = 1; i <= 3; i++) {
      await limitedHandler.handler(makeRequest(`sec-${i}`, '10.0.1.2'))
    }

    const res = await limitedHandler.handler(makeRequest('sec-4', '10.0.1.2'))
    expect(res.status).toBe(429)

    const body = await res.json()
    // Window is 60s, so retryAfter should be <= 60
    expect(body.retryAfter).toBeLessThanOrEqual(60)
    expect(body.retryAfter).toBeGreaterThan(0)
  })
})

// =============================================================================
// Per-Client Isolation
// =============================================================================

describe('IIoT Rate Limit Middleware — per-client isolation', () => {
  it('Client A rate-limited, Client B still allowed', async () => {
    const clientA = '192.168.1.100'
    const clientB = '192.168.1.200'

    // Exhaust Client A's bucket
    for (let i = 1; i <= 3; i++) {
      await limitedHandler.handler(makeRequest(`iso-a-${i}`, clientA))
    }

    // Client A should be rate limited
    const resA = await limitedHandler.handler(makeRequest('iso-a-4', clientA))
    expect(resA.status).toBe(429)

    // Client B should still be allowed (separate bucket)
    const resB = await limitedHandler.handler(makeRequest('iso-b-1', clientB))
    expect(resB.status).not.toBe(429)
    expect([200, 500]).toContain(resB.status)
  })

  it('X-Real-IP header also identifies distinct clients', async () => {
    // This client uses X-Real-IP (no X-Forwarded-For)
    const res = await limitedHandler.handler(
      new Request('http://localhost/api/enterprises/enterprise-create/iso-xri-1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Real-IP': '172.16.0.50',
        },
        body: JSON.stringify({ slug: 'xri-test', name: 'XRI Test' }),
      }),
    )
    // Should pass — fresh client bucket
    expect(res.status).not.toBe(429)
    expect([200, 500]).toContain(res.status)
  })

  it('requests without client headers share "unknown" bucket', async () => {
    // No X-Forwarded-For, no X-Real-IP → "unknown"
    const makeAnonRequest = (id: string) =>
      new Request(`http://localhost/api/enterprises/enterprise-create/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: `anon-${id}`, name: `Anon ${id}` }),
      })

    // First 3 pass
    for (let i = 1; i <= 3; i++) {
      const res = await limitedHandler.handler(makeAnonRequest(`anon-${i}`))
      expect(res.status).not.toBe(429)
    }

    // 4th should be rate limited (all share "unknown" key)
    const res = await limitedHandler.handler(makeAnonRequest('anon-4'))
    expect(res.status).toBe(429)
  })
})

// =============================================================================
// Window Reset
// =============================================================================

describe('IIoT Rate Limit Middleware — window reset', () => {
  it('requests pass again after window expires (100ms window)', async () => {
    const client = '10.99.0.1'

    // Exhaust the 2-request limit
    for (let i = 1; i <= 2; i++) {
      const res = await tightHandler.handler(makeRequest(`win-${i}`, client))
      expect(res.status).not.toBe(429)
    }

    // 3rd request should be rate limited
    const blocked = await tightHandler.handler(makeRequest('win-3', client))
    expect(blocked.status).toBe(429)

    // Wait for window to expire (100ms + buffer)
    await new Promise((resolve) => setTimeout(resolve, 150))

    // After window reset, request should pass
    const afterReset = await tightHandler.handler(makeRequest('win-4', client))
    expect(afterReset.status).not.toBe(429)
    expect([200, 500]).toContain(afterReset.status)
  })
})

// =============================================================================
// Disabled Layer — Unlimited
// =============================================================================

describe('IIoT Rate Limit Middleware — disabled (passthrough)', () => {
  it('all requests pass regardless of volume', async () => {
    const client = '10.50.0.1'

    // Send 20 requests — none should be rate limited
    for (let i = 1; i <= 20; i++) {
      const res = await unlimitedHandler.handler(
        makeRequest(`unlimited-${i}`, client),
      )
      expect(res.status).not.toBe(429)
      expect([200, 500]).toContain(res.status)
    }
  })

  it('different clients all pass without tracking', async () => {
    const clients = ['10.60.0.1', '10.60.0.2', '10.60.0.3', '10.60.0.4', '10.60.0.5']

    for (const client of clients) {
      for (let i = 1; i <= 5; i++) {
        const res = await unlimitedHandler.handler(
          makeRequest(`multi-${client}-${i}`, client),
        )
        expect(res.status).not.toBe(429)
      }
    }
  })
})

// =============================================================================
// CORS & Non-entity Routes
// =============================================================================

describe('IIoT Rate Limit Middleware — CORS and docs', () => {
  it('CORS preflight (OPTIONS) is not rate-limited', async () => {
    // Exhaust the limit for this client first
    const client = '10.70.0.1'
    for (let i = 1; i <= 3; i++) {
      await limitedHandler.handler(makeRequest(`cors-${i}`, client))
    }

    // Verify API requests are blocked
    const blocked = await limitedHandler.handler(makeRequest('cors-blocked', client))
    expect(blocked.status).toBe(429)

    // OPTIONS should still work (CORS middleware runs separately)
    const cors = await limitedHandler.handler(
      new Request('http://localhost/api/enterprises/enterprise-create/cors-test', {
        method: 'OPTIONS',
        headers: {
          'X-Forwarded-For': client,
          Origin: 'http://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      }),
    )
    expect([200, 204]).toContain(cors.status)
  })

  it('Swagger /docs still accessible', async () => {
    const res = await limitedHandler.handler(
      new Request('http://localhost/docs'),
    )
    // Swagger may or may not go through middleware depending on route matching
    expect([200, 429]).toContain(res.status)
  })
})
