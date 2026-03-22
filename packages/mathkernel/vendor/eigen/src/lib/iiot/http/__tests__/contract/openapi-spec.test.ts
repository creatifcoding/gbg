/**
 * OpenAPI Specification Contract Tests
 *
 * Verify the generated OpenAPI spec structure served via /docs.
 * Tests lock down the spec metadata, path structure, HTTP methods,
 * and domain coverage to catch regressions.
 *
 * The IIoTApi produces an OpenAPI 3.x spec with:
 * - 13 entity groups at /api/{domain}/*
 * - 4 query groups with 16 total GET endpoints at /api/queries/*
 * - POST methods for entity operations
 * - GET methods for query operations
 *
 * Note: @effect/platform HttpApiSwagger.layer embeds the OpenAPI JSON
 * inside the Swagger UI HTML at /docs (no separate /docs/openapi.json).
 * We extract it from the <script id="swagger-spec"> tag.
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { makeTestHandler } from '../test-helpers'

const { handler, dispose } = makeTestHandler()
afterAll(() => dispose())

let spec: any

// =============================================================================
// Spec Extraction
// =============================================================================

beforeAll(async () => {
  const res = await handler(new Request('http://localhost/docs'))
  expect(res.status).toBe(200)
  const html = await res.text()
  // Extract JSON from <script id="swagger-spec" type="application/json">...</script>
  const match = html.match(/<script id="swagger-spec"[^>]*>([\s\S]*?)<\/script>/)
  expect(match, 'Should find swagger-spec script tag in /docs HTML').toBeTruthy()
  spec = JSON.parse(match![1].trim())
})

describe('OpenAPI Specification', () => {
  // ===========================================================================
  // Metadata
  // ===========================================================================

  describe('Metadata', () => {
    it('should have correct title', () => {
      expect(spec.info.title).toBe('IIoT Asset Management API')
    })

    it('should have correct version', () => {
      expect(spec.info.version).toBe('3.0.0')
    })

    it('should have a description', () => {
      expect(spec.info.description).toBeDefined()
      expect(typeof spec.info.description).toBe('string')
      expect(spec.info.description.length).toBeGreaterThan(0)
    })

    it('should have an openapi version field starting with 3.', () => {
      expect(spec.openapi).toBeDefined()
      expect(spec.openapi).toMatch(/^3\./)
    })

    it('should have paths defined', () => {
      expect(spec.paths).toBeDefined()
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // Entity Domain Paths
  // ===========================================================================

  describe('Entity domain paths', () => {
    const domains = [
      'enterprises', 'sites', 'areas', 'plants', 'lines',
      'workcells', 'machines', 'devices', 'sensors',
      'alarms', 'workorders', 'equipment', 'assets',
    ] as const

    for (const domain of domains) {
      it(`should have /api/${domain}/* paths`, () => {
        const paths = Object.keys(spec.paths)
        const domainPaths = paths.filter((p: string) => p.startsWith(`/api/${domain}/`))
        expect(
          domainPaths.length,
          `Expected at least one path under /api/${domain}/`
        ).toBeGreaterThan(0)
      })
    }

    it('should have exactly 13 entity domain prefixes', () => {
      const paths = Object.keys(spec.paths)
      const entityPrefixes = new Set<string>()
      const allDomains = [
        'enterprises', 'sites', 'areas', 'plants', 'lines',
        'workcells', 'machines', 'devices', 'sensors',
        'alarms', 'workorders', 'equipment', 'assets',
      ]
      for (const p of paths) {
        for (const d of allDomains) {
          if (p.startsWith(`/api/${d}/`)) {
            entityPrefixes.add(d)
          }
        }
      }
      expect(entityPrefixes.size).toBe(13)
    })
  })

  // ===========================================================================
  // Query Paths
  // ===========================================================================

  describe('Query paths', () => {
    it('should have /api/queries/* paths', () => {
      const paths = Object.keys(spec.paths)
      const queryPaths = paths.filter((p: string) => p.startsWith('/api/queries/'))
      expect(queryPaths.length).toBeGreaterThan(0)
    })

    // Asset hierarchy queries (8 endpoints)
    const assetQueryPaths = [
      '/api/queries/plants',
      '/api/queries/plants/{plantId}',
      '/api/queries/plants/{plantId}/hierarchy',
      '/api/queries/plants/{plantId}/lines',
      '/api/queries/lines/{lineId}/machines',
      '/api/queries/machines/{machineId}/sensors',
      '/api/queries/machines/{machineId}/with-sensors',
      '/api/queries/sensors/{deviceId}/hierarchy',
    ]

    for (const queryPath of assetQueryPaths) {
      it(`should have asset query path: ${queryPath}`, () => {
        expect(spec.paths).toHaveProperty(queryPath)
      })
    }

    // Sensor time-series queries (4 endpoints)
    const sensorQueryPaths = [
      '/api/queries/readings/{deviceId}/latest',
      '/api/queries/readings/{deviceId}',
      '/api/queries/readings/{deviceId}/aggregated',
      '/api/queries/readings/{deviceId}/subscribe',
    ]

    for (const queryPath of sensorQueryPaths) {
      it(`should have sensor query path: ${queryPath}`, () => {
        expect(spec.paths).toHaveProperty(queryPath)
      })
    }

    // Alarm queries (3 endpoints)
    const alarmQueryPaths = [
      '/api/queries/alarms',
      '/api/queries/alarms/{alarmId}/context',
      '/api/queries/alarms/stats',
    ]

    for (const queryPath of alarmQueryPaths) {
      it(`should have alarm query path: ${queryPath}`, () => {
        expect(spec.paths).toHaveProperty(queryPath)
      })
    }

    // Work order queries (1 endpoint)
    const workOrderQueryPaths = [
      '/api/queries/workorders',
    ]

    for (const queryPath of workOrderQueryPaths) {
      it(`should have work-order query path: ${queryPath}`, () => {
        expect(spec.paths).toHaveProperty(queryPath)
      })
    }

    it('should have at least 16 total query endpoints', () => {
      const paths = Object.keys(spec.paths)
      const queryPaths = paths.filter((p: string) => p.startsWith('/api/queries/'))
      expect(queryPaths.length).toBeGreaterThanOrEqual(16)
    })
  })

  // ===========================================================================
  // HTTP Methods
  // ===========================================================================

  describe('HTTP methods', () => {
    it('entity endpoints should use POST method', () => {
      const paths = Object.keys(spec.paths)
      const entityPath = paths.find((p: string) => p.includes('/enterprises/'))
      expect(entityPath).toBeDefined()
      if (entityPath) {
        expect(spec.paths[entityPath]).toHaveProperty('post')
      }
    })

    it('query endpoints should use GET method', () => {
      const paths = Object.keys(spec.paths)
      const queryPath = paths.find((p: string) => p.includes('/queries/'))
      expect(queryPath).toBeDefined()
      if (queryPath) {
        expect(spec.paths[queryPath]).toHaveProperty('get')
      }
    })

    it('all query endpoints should be GET', () => {
      const paths = Object.keys(spec.paths)
      const queryPaths = paths.filter((p: string) => p.startsWith('/api/queries/'))
      for (const qp of queryPaths) {
        expect(
          spec.paths[qp],
          `Query path ${qp} should have GET method`
        ).toHaveProperty('get')
      }
    })

    it('entity domain paths should use POST for mutations', () => {
      const entityDomains = [
        'enterprises', 'sites', 'areas', 'plants', 'lines',
        'workcells', 'machines', 'devices', 'sensors',
        'alarms', 'workorders', 'equipment', 'assets',
      ]
      const paths = Object.keys(spec.paths)
      for (const domain of entityDomains) {
        const domainPaths = paths.filter((p: string) =>
          p.startsWith(`/api/${domain}/`) && !p.startsWith('/api/queries/')
        )
        for (const dp of domainPaths) {
          expect(
            spec.paths[dp],
            `Entity path ${dp} should have POST method`
          ).toHaveProperty('post')
        }
      }
    })
  })

  // ===========================================================================
  // Path Parameters
  // ===========================================================================

  describe('Path parameters', () => {
    it('entity paths should include parameterized segments', () => {
      const paths = Object.keys(spec.paths)
      const entityDomains = [
        'enterprises', 'sites', 'areas', 'plants', 'lines',
        'workcells', 'machines', 'devices', 'sensors',
      ]
      for (const domain of entityDomains) {
        const domainPaths = paths.filter((p: string) => p.startsWith(`/api/${domain}/`))
        const hasParamPath = domainPaths.some((p: string) => p.includes('{'))
        expect(
          hasParamPath,
          `Domain ${domain} should have at least one parameterized path`
        ).toBe(true)
      }
    })

    it('query paths with resource IDs should have path parameters', () => {
      const parameterizedQueries = [
        '/api/queries/plants/{plantId}',
        '/api/queries/plants/{plantId}/hierarchy',
        '/api/queries/plants/{plantId}/lines',
        '/api/queries/lines/{lineId}/machines',
        '/api/queries/machines/{machineId}/sensors',
        '/api/queries/machines/{machineId}/with-sensors',
        '/api/queries/sensors/{deviceId}/hierarchy',
        '/api/queries/readings/{deviceId}/latest',
        '/api/queries/readings/{deviceId}',
        '/api/queries/readings/{deviceId}/aggregated',
        '/api/queries/readings/{deviceId}/subscribe',
        '/api/queries/alarms/{alarmId}/context',
      ]
      for (const qp of parameterizedQueries) {
        expect(
          spec.paths,
          `Should have parameterized query path: ${qp}`
        ).toHaveProperty(qp)
      }
    })
  })

  // ===========================================================================
  // Structural Integrity
  // ===========================================================================

  describe('Structural integrity', () => {
    it('total path count should be stable (snapshot)', () => {
      const pathCount = Object.keys(spec.paths).length
      expect(pathCount).toMatchSnapshot()
    })

    it('all paths should start with /api/', () => {
      const paths = Object.keys(spec.paths)
      for (const p of paths) {
        expect(p, `Path "${p}" should start with /api/`).toMatch(/^\/api\//)
      }
    })

    it('sorted path list should be stable (snapshot)', () => {
      const paths = Object.keys(spec.paths).sort()
      expect(paths).toMatchSnapshot()
    })
  })
})
