/**
 * Shared test infrastructure for IIoT HTTP tests
 *
 * Provides reusable test layer, handler factory, and request helpers
 * for the entire HTTP test suite. Layer composition mirrors api.test.ts
 * (verified working) without BunHttpServer.
 *
 * @module
 */

import { HttpApiBuilder, HttpApiSwagger, HttpServer } from '@effect/platform'
import { Layer } from 'effect'
import { TestRunner } from '@effect/cluster'
import { IIoTApi } from '../api'
import { ProxyHandlers } from '../proxy-handlers'
import { QueryHandlers } from '../query-handlers'
import { EntityHandlersLayer } from '../../entity/EntityStack'
import { AllStateServicesInMemory } from '../../state'
import { IIoTFeatureFlagsDisabledLayer } from '../../infrastructure/feature-flags'
import { IIoTAuthDisabledLayer } from '../middleware/auth'
import { IIoTRateLimitDisabledLayer } from '../middleware/rate-limit'

// =============================================================================
// Reusable Test Layer
// =============================================================================

/**
 * API implementation layer for testing (mirrors server.ts without BunHttpServer)
 *
 * Layer composition:
 *   HttpApiBuilder.api(IIoTApi) provides HttpApi.Api
 *     <- ProxyHandlers (13 entity proxy handler layers)
 *     <- QueryHandlers (3 query handler layers)
 *     <- EntityHandlersLayer (all entity behaviors)
 *     <- AllStateServicesInMemory (in-memory state services)
 *     <- IIoTFeatureFlagsDisabledLayer (CRUD mode)
 *     <- TestRunner.layer (in-memory cluster)
 */
export const ApiLive = HttpApiBuilder.api(IIoTApi).pipe(
  Layer.provide(ProxyHandlers),
  Layer.provide(QueryHandlers),
  Layer.provide(EntityHandlersLayer),
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
  Layer.provide(IIoTAuthDisabledLayer),
  Layer.provide(IIoTRateLimitDisabledLayer),
  Layer.provide(TestRunner.layer),
)

/**
 * Full test layer for toWebHandler:
 *
 * Layer.empty
 *   <- middlewareCors() (self-sufficient)
 *   <- HttpApiSwagger.layer (consumes HttpApi.Api)
 *   <- ApiLive (provides HttpApi.Api)
 *   <- HttpServer.layerContext (provides DefaultServices)
 */
export const TestApiLayer = Layer.empty.pipe(
  Layer.provideMerge(HttpApiBuilder.middlewareCors()),
  Layer.provideMerge(HttpApiSwagger.layer({ path: '/docs' })),
  Layer.provideMerge(ApiLive),
  Layer.provideMerge(HttpServer.layerContext),
)

// =============================================================================
// Test Handler Factory
// =============================================================================

/**
 * Create a test handler for HTTP integration tests.
 * Returns { handler, dispose } -- call dispose() in afterAll.
 *
 * Usage:
 * ```typescript
 * const { handler, dispose } = makeTestHandler()
 * afterAll(() => dispose())
 *
 * it('should respond', async () => {
 *   const res = await handler(new Request('http://localhost/docs'))
 *   expect(res.status).toBe(200)
 * })
 * ```
 */
export const makeTestHandler = () => HttpApiBuilder.toWebHandler(TestApiLayer as any)

// =============================================================================
// Request Helpers
// =============================================================================

/**
 * Create a POST request for entity endpoints.
 *
 * Entity endpoint URL pattern:
 *   POST /api/{domain}/{rpc-tag-kebab}/:entityId
 *
 * EntityProxy.toHttpApiGroup generates URLs by:
 *   1. Taking the RPC _tag (e.g., "Enterprise.Create")
 *   2. Converting to kebab-case (e.g., "enterprise-create")
 *   3. Prefixing with /api/{domain}/ (from .prefix() call)
 */
export const makePostRequest = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/**
 * Create a GET request for query endpoints
 */
export const makeGetRequest = (path: string, params?: Record<string, string>) => {
  const url = new URL(`http://localhost${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new Request(url.toString(), { method: 'GET' })
}

// =============================================================================
// Entity Payload Factories
// =============================================================================

/**
 * Payload factories for all 13 entity domains.
 *
 * Each entry contains:
 * - domain: The URL prefix segment (matches IIoTApi .prefix('/api/{domain}'))
 * - createTag: Kebab-case RPC tag for create/primary operation
 * - getTag: Kebab-case RPC tag for get operation
 * - createPayload: Minimal valid JSON body for the Create RPC
 * - getPayload: Minimal valid JSON body for the Get RPC
 *
 * URL construction:
 *   POST /api/{domain}/{createTag}/:entityId
 *
 * RPC tag -> kebab conversion:
 *   "Enterprise.Create" -> "enterprise-create"
 *   "MachineAsset.Create" -> "machine-asset-create"
 *   "SensorAsset.Create" -> "sensor-asset-create"
 *   "WorkOrder.Create" -> "work-order-create"
 *   "EquipmentState.GetCurrent" -> "equipment-state-get-current"
 *   "WorkCell.Create" -> "work-cell-create"
 */
export const entityPayloads = {
  enterprise: {
    domain: 'enterprises',
    createTag: 'enterprise-create',
    getTag: 'enterprise-get',
    createPayload: { slug: 'test-ent', name: 'Test Enterprise' },
    getPayload: { enterpriseId: 'ENT-test-ent' },
  },
  site: {
    domain: 'sites',
    createTag: 'site-create',
    getTag: 'site-get',
    createPayload: {
      slug: 'test-site',
      name: 'Test Site',
      enterpriseId: 'ENT-test-ent',
      timezone: 'America/Chicago',
    },
    getPayload: { siteId: 'SIT-test-site' },
  },
  area: {
    domain: 'areas',
    createTag: 'area-create',
    getTag: 'area-get',
    createPayload: {
      slug: 'test-area',
      name: 'Test Area',
      siteId: 'SIT-test-site',
    },
    getPayload: { areaId: 'ARA-test-area' },
  },
  plant: {
    domain: 'plants',
    createTag: 'plant-create',
    getTag: 'plant-get',
    createPayload: {
      slug: 'test-plant',
      name: 'Test Plant',
      timezone: 'America/Chicago',
    },
    getPayload: { plantId: 'PLT-test-plant' },
  },
  line: {
    domain: 'lines',
    createTag: 'line-create',
    getTag: 'line-get',
    createPayload: {
      slug: 'test-line',
      name: 'Test Line',
      plantId: 'PLT-test-plant',
    },
    getPayload: { lineId: 'LIN-test-line' },
  },
  workcell: {
    domain: 'workcells',
    createTag: 'work-cell-create',
    getTag: 'work-cell-get',
    createPayload: {
      slug: 'test-wc',
      name: 'Test WorkCell',
      lineId: 'LIN-test-line',
    },
    getPayload: { workCellId: 'WCL-test-wc' },
  },
  machine: {
    domain: 'machines',
    createTag: 'machine-asset-create',
    getTag: 'machine-asset-get',
    createPayload: {
      slug: 'test-mch',
      name: 'Test Machine',
      enterpriseId: 'ENT-test-ent',
      siteId: 'SIT-test-site',
      plantId: 'PLT-test-plant',
      lineId: 'LIN-test-line',
      machineType: 'CNC Lathe',
    },
    getPayload: { machineId: 'MCH-test-mch' },
  },
  device: {
    domain: 'devices',
    createTag: 'device-create',
    getTag: 'device-get',
    createPayload: {
      slug: 'test-dev',
      name: 'Test Device',
      machineId: 'MCH-test-mch',
      deviceType: 'motor',
    },
    getPayload: { deviceId: 'DEV-test-dev' },
  },
  sensor: {
    domain: 'sensors',
    createTag: 'sensor-asset-create',
    getTag: 'sensor-asset-get',
    createPayload: {
      slug: 'test-sns',
      name: 'Test Sensor',
      machineId: 'MCH-test-mch',
      sensorType: 'temperature',
      unit: 'celsius',
    },
    getPayload: { sensorId: 'SNS-test-sns' },
  },
  alarm: {
    domain: 'alarms',
    createTag: 'alarm-create',
    getTag: 'alarm-get',
    createPayload: {
      deviceId: 'DEV-test-001',
      alarmType: 'high_temperature',
      severity: 'critical',
      message: 'Test alarm',
    },
    getPayload: { alarmId: 'ALM-test-001' },
  },
  workorder: {
    domain: 'workorders',
    createTag: 'work-order-create',
    getTag: 'work-order-get',
    createPayload: {
      title: 'Test Work Order',
      description: 'Test description',
      type: 'preventive_maintenance',
      priority: 'normal',
      createdBy: 'test-user',
      workflowDefinitionId: 'WF-test-v1',
      workflowVersion: '1.0.0',
    },
    getPayload: { workOrderId: 'WO-test-001' },
  },
  equipment: {
    domain: 'equipment',
    createTag: 'equipment-state-get-current',
    getTag: 'equipment-state-get-current',
    createPayload: { machineId: 'MCH-test-mch' },
    getPayload: { machineId: 'MCH-test-mch' },
  },
  asset: {
    domain: 'assets',
    createTag: 'asset-get',
    getTag: 'asset-get',
    createPayload: { assetId: 'TEST-asset-001' },
    getPayload: { assetId: 'TEST-asset-001' },
  },
} as const

/**
 * All 13 entity domain names (matches IIoTApi .prefix('/api/{domain}') calls)
 */
export const ENTITY_DOMAINS = [
  'enterprises', 'sites', 'areas', 'plants', 'lines',
  'workcells', 'machines', 'devices', 'sensors',
  'alarms', 'workorders', 'equipment', 'assets',
] as const
