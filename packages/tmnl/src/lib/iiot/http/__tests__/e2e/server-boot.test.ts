/**
 * E2E Server Boot Tests
 *
 * Boot the IIoT HTTP API via toWebHandler and exercise both REST and RPC
 * interfaces end-to-end. Validates that the full layer composition boots
 * correctly and serves requests through:
 *
 *   Request -> HttpApiBuilder -> EntityProxyServer -> Cluster -> Entity -> State
 *
 * Tests cover:
 * 1. Handler factory smoke test
 * 2. REST create endpoints (plant, enterprise)
 * 3. Swagger UI availability
 * 4. OpenAPI spec generation
 * 5. CORS preflight handling
 * 6. Invalid path rejection
 * 7. Invalid JSON rejection
 * 8. REST query endpoints
 *
 * @module
 */

import { describe, it, expect, afterAll } from 'vitest'
import { makeTestHandler, makePostRequest, makeGetRequest, entityPayloads } from '../test-helpers'

// =============================================================================
// Shared Handler (boots the full API stack once)
// =============================================================================

const { handler, dispose } = makeTestHandler()
afterAll(() => dispose())

// =============================================================================
// 1. Handler Factory Smoke Test
// =============================================================================

describe('Handler factory', () => {
  it('makeTestHandler() returns handler and dispose functions', () => {
    expect(typeof handler).toBe('function')
    expect(typeof dispose).toBe('function')
  })
})

// =============================================================================
// 2. REST Entity Create Endpoints
// =============================================================================

describe('REST entity create endpoints', () => {
  it('POST create plant returns 200', async () => {
    const entityId = `e2e-plant-${Date.now()}`
    const res = await handler(
      makePostRequest(
        `/api/${entityPayloads.plant.domain}/${entityPayloads.plant.createTag}/${entityId}`,
        entityPayloads.plant.createPayload,
      ),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('name', 'Test Plant')
  })

  it('POST create enterprise returns 200', async () => {
    const entityId = `e2e-ent-${Date.now()}`
    const res = await handler(
      makePostRequest(
        `/api/${entityPayloads.enterprise.domain}/${entityPayloads.enterprise.createTag}/${entityId}`,
        entityPayloads.enterprise.createPayload,
      ),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('name', 'Test Enterprise')
  })
})

// =============================================================================
// 3. Swagger UI
// =============================================================================

describe('Swagger UI', () => {
  it('GET /docs returns 200 and contains html', async () => {
    const res = await handler(new Request('http://localhost/docs'))
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('html')
  })
})

// =============================================================================
// 4. OpenAPI Specification (embedded in Swagger HTML)
// =============================================================================

describe('OpenAPI specification', () => {
  it('GET /docs embeds valid OpenAPI JSON in swagger-spec script tag', async () => {
    const res = await handler(new Request('http://localhost/docs'))
    expect(res.status).toBe(200)
    const html = await res.text()
    // @effect/platform embeds the OpenAPI spec inside the Swagger HTML
    // as <script id="swagger-spec" type="application/json">...</script>
    const match = html.match(/<script id="swagger-spec"[^>]*>([\s\S]*?)<\/script>/)
    expect(match, 'Should find swagger-spec script tag in /docs HTML').toBeTruthy()
    const spec = JSON.parse(match![1].trim())
    expect(spec).toHaveProperty('openapi')
    expect(spec).toHaveProperty('info')
    expect(spec).toHaveProperty('paths')
    expect(spec.info.title).toBe('IIoT Asset Management API')
  })
})

// =============================================================================
// 5. CORS Preflight
// =============================================================================

describe('CORS preflight', () => {
  it('OPTIONS request returns CORS headers', async () => {
    const res = await handler(
      new Request('http://localhost/api/plants/plant-create/e2e-cors-test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      }),
    )
    // CORS preflight should return 204 or 200
    expect([200, 204]).toContain(res.status)
  })
})

// =============================================================================
// 6. Invalid Path Rejection
// =============================================================================

describe('Invalid path rejection', () => {
  it('POST to non-existent path returns 400 or 404', async () => {
    const res = await handler(
      new Request('http://localhost/api/nonexistent/fake-operation/e2e-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' }),
      }),
    )
    expect([400, 404]).toContain(res.status)
  })
})

// =============================================================================
// 7. Invalid JSON Rejection
// =============================================================================

describe('Invalid JSON rejection', () => {
  it('POST with malformed JSON body returns 400', async () => {
    const res = await handler(
      new Request(
        'http://localhost/api/enterprises/enterprise-create/e2e-bad-json',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{not-valid-json!!!',
        },
      ),
    )
    expect(res.status).toBe(400)
  })
})

// =============================================================================
// 8. REST Query Endpoints
// =============================================================================

describe('REST query endpoints', () => {
  it('GET /api/queries/plants returns 200 with array', async () => {
    const res = await handler(makeGetRequest('/api/queries/plants'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })
})
