/**
 * REST Query Endpoint Integration Tests
 *
 * Full HTTP round-trip tests for all 16 stateless query endpoints via toWebHandler.
 * Tests verify routing, response status, and stub behavior.
 *
 * Four groups:
 * - Asset queries (8 endpoints): plant/line/machine/sensor hierarchy
 * - Sensor queries (4 endpoints): time-series readings
 * - Alarm queries (3 endpoints): alarm operations
 * - Work order queries (1 endpoint): work order listing
 *
 * Stubs that return data yield 200; stubs using Effect.die yield 500.
 *
 * @module
 */

import { describe, it, expect, afterAll } from 'vitest'
import { makeTestHandler, makeGetRequest } from '../test-helpers'

// =============================================================================
// Shared Handler
// =============================================================================

const { handler, dispose } = makeTestHandler()
afterAll(() => dispose())

// =============================================================================
// Asset Hierarchy Query Endpoints (8)
// =============================================================================

describe('Asset query endpoints', () => {
  it('GET /api/queries/plants should return 200 with empty array', async () => {
    const res = await handler(makeGetRequest('/api/queries/plants'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /api/queries/plants/:plantId should return 500 (Effect.die stub)', async () => {
    const res = await handler(makeGetRequest('/api/queries/plants/PLT-test'))
    expect(res.status).toBe(500)
  })

  it('GET /api/queries/plants/:plantId/hierarchy should return 500 (Effect.die stub)', async () => {
    const res = await handler(makeGetRequest('/api/queries/plants/PLT-test/hierarchy'))
    expect(res.status).toBe(500)
  })

  it('GET /api/queries/plants/:plantId/lines should return 200 with empty array', async () => {
    const res = await handler(makeGetRequest('/api/queries/plants/PLT-test/lines'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /api/queries/lines/:lineId/machines should return 200 with empty array', async () => {
    const res = await handler(makeGetRequest('/api/queries/lines/LIN-test/machines'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /api/queries/machines/:machineId/sensors should return 200 with empty array', async () => {
    const res = await handler(makeGetRequest('/api/queries/machines/MCH-test/sensors'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /api/queries/machines/:machineId/with-sensors should return 500 (Effect.die stub)', async () => {
    const res = await handler(makeGetRequest('/api/queries/machines/MCH-test/with-sensors'))
    expect(res.status).toBe(500)
  })

  it('GET /api/queries/sensors/:deviceId/hierarchy should return 500 (Effect.die stub)', async () => {
    const res = await handler(makeGetRequest('/api/queries/sensors/DEV-test/hierarchy'))
    expect(res.status).toBe(500)
  })
})

// =============================================================================
// Sensor Time-Series Query Endpoints (4)
// =============================================================================

describe('Sensor query endpoints', () => {
  it('GET /api/queries/readings/:deviceId/latest should return 200 with null', async () => {
    const res = await handler(makeGetRequest('/api/queries/readings/DEV-test/latest'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toBeNull()
  })

  it('GET /api/queries/readings/:deviceId should return 200 with empty array', async () => {
    const res = await handler(makeGetRequest('/api/queries/readings/DEV-test'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /api/queries/readings/:deviceId/aggregated should return 200 with empty array', async () => {
    const res = await handler(
      makeGetRequest('/api/queries/readings/DEV-test/aggregated', { bucket: '1h' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /api/queries/readings/:deviceId/subscribe should return 200 with empty array', async () => {
    const res = await handler(makeGetRequest('/api/queries/readings/DEV-test/subscribe'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})

// =============================================================================
// Alarm Query Endpoints (3)
// =============================================================================

describe('Alarm query endpoints', () => {
  it('GET /api/queries/alarms should return 200 with empty array', async () => {
    const res = await handler(makeGetRequest('/api/queries/alarms'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /api/queries/alarms/:alarmId/context should return 200 with empty array', async () => {
    const res = await handler(makeGetRequest('/api/queries/alarms/ALM-test/context'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /api/queries/alarms/stats should return 500 (Effect.die stub)', async () => {
    const res = await handler(makeGetRequest('/api/queries/alarms/stats'))
    expect(res.status).toBe(500)
  })
})

// =============================================================================
// Work Order Query Endpoints (1)
// =============================================================================

describe('Work order query endpoints', () => {
  it('GET /api/queries/workorders should return 200 with empty array initially', async () => {
    const res = await handler(makeGetRequest('/api/queries/workorders'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('GET /api/queries/workorders?status=created filters by status', async () => {
    const res = await handler(makeGetRequest('/api/queries/workorders', { status: 'created' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.every((wo: any) => wo.status === 'created')).toBe(true)
  })
})

// =============================================================================
// Method Enforcement
// =============================================================================

describe('Method enforcement on query endpoints', () => {
  it('POST to GET-only /api/queries/plants should return 400/404/405', async () => {
    const res = await handler(
      new Request('http://localhost/api/queries/plants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect([400, 404, 405]).toContain(res.status)
  })

  it('POST to GET-only /api/queries/alarms should return 400/404/405', async () => {
    const res = await handler(
      new Request('http://localhost/api/queries/alarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect([400, 404, 405]).toContain(res.status)
  })
})
