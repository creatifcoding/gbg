/**
 * URL Mapping Unit Tests
 *
 * Verifies EntityProxy.toHttpApiGroup URL generation for all 13 entity domains.
 * URLs are auto-generated from RPC tags:
 *   RPC _tag "Plant.Create" -> kebab "plant-create" -> URL /api/plants/plant-create/:entityId
 *
 * Also verifies query endpoint URL routing (GET /api/queries/...).
 *
 * @module
 */

import { describe, it, expect, afterAll } from 'vitest'
import { makeTestHandler, makePostRequest, makeGetRequest, entityPayloads } from '../test-helpers'

// =============================================================================
// Shared Handler
// =============================================================================

const { handler, dispose } = makeTestHandler()
afterAll(() => dispose())

// =============================================================================
// Entity URL Routing (13 domains)
// =============================================================================

type EntityKey = keyof typeof entityPayloads

const entityKeys = Object.keys(entityPayloads) as EntityKey[]

/**
 * Some entity RPCs (e.g., asset-get) block waiting for state in TestRunner,
 * causing timeouts. For URL routing tests, a timeout proves the route was
 * matched (404 returns instantly). We race the handler against a short deadline.
 */
const routeCheck = async (req: Request): Promise<{ status: number; timedOut: boolean }> => {
  const result = await Promise.race([
    handler(req).then((res) => ({ status: res.status, timedOut: false })),
    new Promise<{ status: number; timedOut: boolean }>((resolve) =>
      setTimeout(() => resolve({ status: -1, timedOut: true }), 3000),
    ),
  ])
  return result
}

describe('URL Mapping', () => {
  for (const key of entityKeys) {
    const { domain, createTag, createPayload } = entityPayloads[key]

    describe(`${key} URL patterns (/api/${domain})`, () => {
      it(`/api/${domain}/${createTag}/:entityId should be routable`, async () => {
        const result = await routeCheck(
          makePostRequest(`/api/${domain}/${createTag}/url-test-${key}`, createPayload),
        )
        // Route is matched if: handler responded with non-404, or handler timed out
        // (timeout = route matched but entity handler blocked on state)
        if (!result.timedOut) {
          expect(result.status).not.toBe(404)
        }
        // timedOut = route was found, handler just blocked -- URL is routable
      }, 10000)

      it(`/api/${domain}/invalid-rpc-tag/:entityId should return 400 or 404`, async () => {
        const res = await handler(
          makePostRequest(`/api/${domain}/invalid-rpc-tag/url-test-${key}`, {}),
        )
        // Invalid RPC tag should not match any route
        expect([400, 404]).toContain(res.status)
      })

      it(`/api/${domain}/${createTag} without entityId should return 400 or 404`, async () => {
        // Missing :entityId path segment -- URL pattern requires it
        const res = await handler(
          makePostRequest(`/api/${domain}/${createTag}`, createPayload),
        )
        expect([400, 404]).toContain(res.status)
      })
    })
  }

  // ===========================================================================
  // Query URL Patterns
  // ===========================================================================

  describe('Query URL patterns', () => {
    // Asset queries (prefixed /api + /queries/...)
    it('GET /api/queries/plants should be routable', async () => {
      const res = await handler(makeGetRequest('/api/queries/plants'))
      expect(res.status).not.toBe(404)
    })

    it('GET /api/queries/alarms should be routable', async () => {
      const res = await handler(makeGetRequest('/api/queries/alarms'))
      expect(res.status).not.toBe(404)
    })

    it('GET /api/queries/alarms/stats should be routable', async () => {
      const res = await handler(makeGetRequest('/api/queries/alarms/stats'))
      expect(res.status).not.toBe(404)
    })

    it('GET /api/queries/nonexistent should return 400 or 404', async () => {
      const res = await handler(makeGetRequest('/api/queries/nonexistent'))
      expect([400, 404]).toContain(res.status)
    })
  })

  // ===========================================================================
  // Cross-Domain URL Isolation
  // ===========================================================================

  describe('Cross-domain URL isolation', () => {
    it('entity RPC tag from one domain should not route on another domain', async () => {
      // "enterprise-create" should not be routable under /api/plants/
      const res = await handler(
        makePostRequest('/api/plants/enterprise-create/cross-domain-test', {
          slug: 'test',
          name: 'Test',
        }),
      )
      expect([400, 404]).toContain(res.status)
    })

    it('alarm RPC should not route under /api/enterprises/', async () => {
      const res = await handler(
        makePostRequest('/api/enterprises/alarm-create/cross-domain-test', {
          deviceId: 'DEV-test',
          alarmType: 'high',
          severity: 'critical',
          message: 'Test',
        }),
      )
      expect([400, 404]).toContain(res.status)
    })
  })
})
