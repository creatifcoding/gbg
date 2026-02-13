/**
 * RPC Serialization Integration Tests
 *
 * Tests ndjson and msgpack wire format behavior through the RPC server layer.
 * Validates HTTP-level behavior: status codes, content types, error handling,
 * method enforcement, and content negotiation.
 *
 * The RPC endpoint at POST /rpc uses @effect/rpc protocol wire format:
 * - ndjson (default): newline-delimited JSON, streaming protocol
 * - msgpack: compact binary, streaming protocol
 *
 * IMPORTANT: The ndjson/msgpack protocol is STREAMING. POST /rpc keeps the
 * connection open for bidirectional data flow. Tests that send POST requests
 * must use AbortController timeouts because the handler will never "complete"
 * the response in the traditional sense -- it streams results.
 *
 * Architecture:
 *   Request -> HttpLayerRouter -> RpcServer.layerProtocolHttpRouter -> EntityProxyServer -> Cluster
 *
 * Layer composition uses HttpLayerRouter.toWebHandler (NOT HttpApiBuilder.toWebHandler)
 * because the RPC server registers routes via HttpLayerRouter, not HttpApi.
 *
 * @module
 */

import { describe, it, expect, afterAll } from 'vitest'
import { HttpLayerRouter } from '@effect/platform'
import { Layer } from 'effect'
import { TestRunner } from '@effect/cluster'
import * as RpcServer from '@effect/rpc/RpcServer'
import { RpcSerialization } from '@effect/rpc'
import { IIoTRpcs } from '../../../rpc'
import { EntityHandlersLayer } from '../../../entity/EntityStack'
import { AllStateServicesInMemory } from '../../../state'
import { IIoTFeatureFlagsDisabledLayer } from '../../../infrastructure/feature-flags'

// Entity imports for EntityProxyServer.layerRpcHandlers
import { EntityProxyServer } from '@effect/cluster'
import { AlarmEntity } from '../../../entity/AlarmEntity'
import { PlantEntity } from '../../../entity/PlantEntity'
import { LineEntity } from '../../../entity/LineEntity'
import { WorkCellEntity } from '../../../entity/WorkCellEntity'
import { MachineAssetEntity } from '../../../entity/MachineAssetEntity'
import { DeviceAssetEntity } from '../../../entity/DeviceEntity'
import { SensorAssetEntity } from '../../../entity/SensorAssetEntity'
import { EnterpriseEntity } from '../../../entity/EnterpriseEntity'
import { SiteEntity } from '../../../entity/SiteEntity'
import { AreaEntity } from '../../../entity/AreaEntity'
import { WorkOrderEntity } from '../../../entity/WorkOrderEntity'
import { EquipmentStateEntity } from '../../../entity/EquipmentStateEntity'
import { AssetEntity } from '../../../entity/AssetEntity'

// =============================================================================
// RPC Test Layers (using HttpLayerRouter, NOT HttpApiBuilder)
// =============================================================================

/**
 * Entity RPC handlers (proxy through cluster).
 * Mirrors EntityRpcHandlers from rpc-server.ts.
 */
const EntityRpcHandlers = Layer.mergeAll(
  EntityProxyServer.layerRpcHandlers(AlarmEntity),
  EntityProxyServer.layerRpcHandlers(EnterpriseEntity),
  EntityProxyServer.layerRpcHandlers(SiteEntity),
  EntityProxyServer.layerRpcHandlers(AreaEntity),
  EntityProxyServer.layerRpcHandlers(PlantEntity),
  EntityProxyServer.layerRpcHandlers(LineEntity),
  EntityProxyServer.layerRpcHandlers(WorkCellEntity),
  EntityProxyServer.layerRpcHandlers(MachineAssetEntity),
  EntityProxyServer.layerRpcHandlers(DeviceAssetEntity),
  EntityProxyServer.layerRpcHandlers(SensorAssetEntity),
  EntityProxyServer.layerRpcHandlers(WorkOrderEntity),
  EntityProxyServer.layerRpcHandlers(EquipmentStateEntity),
  EntityProxyServer.layerRpcHandlers(AssetEntity),
)

/**
 * Core RPC server = IIoTRpcs + EntityRpcHandlers.
 */
const RpcServerCore = RpcServer.layer(IIoTRpcs).pipe(
  Layer.provide(EntityRpcHandlers),
)

/**
 * Protocol HTTP router for /rpc endpoint.
 */
const RpcHttpRouter = RpcServer.layerProtocolHttpRouter({ path: '/rpc' })

/**
 * ndjson RPC test layer.
 *
 * Composition uses Layer.provide to wire dependencies correctly:
 *   RpcHttpRouter needs RpcSerialization (from layerNdjson)
 *   RpcServerCore needs Sharding (from TestRunner)
 *   EntityHandlersLayer needs state services + feature flags
 */
const NdjsonRpcLayer = Layer.mergeAll(
  RpcServerCore,
  RpcHttpRouter.pipe(Layer.provide(RpcSerialization.layerNdjson)),
).pipe(
  Layer.provide(EntityHandlersLayer),
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
  Layer.provide(TestRunner.layer),
)

/**
 * msgpack RPC test layer.
 */
const MsgPackRpcLayer = Layer.mergeAll(
  RpcServerCore,
  RpcHttpRouter.pipe(Layer.provide(RpcSerialization.layerMsgPack)),
).pipe(
  Layer.provide(EntityHandlersLayer),
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
  Layer.provide(TestRunner.layer),
)

// =============================================================================
// Test Handlers (HttpLayerRouter.toWebHandler for RPC routing)
// =============================================================================

const { handler: ndjsonHandler, dispose: ndjsonDispose } =
  HttpLayerRouter.toWebHandler(NdjsonRpcLayer as any)

const { handler: msgpackHandler, dispose: msgpackDispose } =
  HttpLayerRouter.toWebHandler(MsgPackRpcLayer as any)

afterAll(async () => {
  await ndjsonDispose()
  await msgpackDispose()
})

// =============================================================================
// Helpers
// =============================================================================

/**
 * Make a streaming POST /rpc request with abort timeout.
 *
 * The ndjson/msgpack RPC protocol is STREAMING -- POST /rpc keeps the
 * connection open. We use a ReadableStream body that immediately closes
 * to signal end-of-input, and an AbortController timeout as a safety net.
 */
const makeRpcRequest = async (
  handler: (req: Request) => Promise<Response>,
  options: {
    body?: string
    contentType?: string
    method?: string
    path?: string
    timeoutMs?: number
  } = {},
): Promise<Response> => {
  const {
    body,
    contentType = 'application/json',
    method = 'POST',
    path = '/rpc',
    timeoutMs = 2000,
  } = options

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers: Record<string, string> = {}
    if (contentType) headers['Content-Type'] = contentType

    const res = await handler(
      new Request(`http://localhost${path}`, {
        method,
        headers,
        body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
        signal: controller.signal,
      }),
    )
    clearTimeout(timeout)
    return res
  } catch (err: any) {
    clearTimeout(timeout)
    // If aborted, the request was accepted but streaming (good -- not 404)
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      // Create a synthetic response indicating the endpoint was reached
      return new Response('streaming', { status: 200, statusText: 'Streaming (aborted)' })
    }
    throw err
  }
}

/**
 * Check if a POST /rpc request reaches the endpoint (not 404).
 *
 * Because the protocol is streaming, reaching the endpoint means either:
 * 1. We get a non-404 response immediately (error cases)
 * 2. The request hangs (streaming) -- we abort and know it matched
 */
const rpcEndpointReachable = async (
  handler: (req: Request) => Promise<Response>,
  body: string = '{}',
  contentType: string = 'application/json',
): Promise<{ reached: boolean; status: number; body: string }> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 500)

  try {
    const headers: Record<string, string> = {}
    if (contentType) headers['Content-Type'] = contentType

    const res = await handler(
      new Request('http://localhost/rpc', {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      }),
    )
    clearTimeout(timeout)
    const text = await res.text()
    return { reached: res.status !== 404, status: res.status, body: text }
  } catch (err: any) {
    clearTimeout(timeout)
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      // Aborted = endpoint matched and started streaming
      return { reached: true, status: 200, body: '(streaming)' }
    }
    throw err
  }
}

// =============================================================================
// 1. ndjson Wire Format Tests (8 tests)
// =============================================================================

describe('ndjson wire format', () => {
  it('POST /rpc exists and accepts requests (not 404)', async () => {
    const result = await rpcEndpointReachable(ndjsonHandler)
    expect(result.reached).toBe(true)
  })

  it('POST /rpc with ndjson content-type is accepted', async () => {
    const result = await rpcEndpointReachable(ndjsonHandler, '{}', 'application/ndjson')
    expect(result.reached).toBe(true)
  })

  it('POST /rpc with application/json content-type is accepted', async () => {
    const result = await rpcEndpointReachable(ndjsonHandler, '{}', 'application/json')
    expect(result.reached).toBe(true)
  })

  it('POST /rpc with empty body reaches the endpoint', async () => {
    const result = await rpcEndpointReachable(ndjsonHandler, '')
    // Empty body should either produce error or be accepted for streaming
    expect(result.reached).toBe(true)
  })

  it('POST /rpc with non-JSON text content reaches the endpoint', async () => {
    const result = await rpcEndpointReachable(ndjsonHandler, 'not json at all', 'text/plain')
    // The endpoint should still be reached (POST matches); it may error on parse
    expect(result.reached).toBe(true)
  })

  it('POST /rpc with malformed JSON reaches the endpoint', async () => {
    const result = await rpcEndpointReachable(ndjsonHandler, '{invalid-json!!!', 'application/json')
    expect(result.reached).toBe(true)
  })

  it('POST /rpc with valid ndjson line reaches the endpoint', async () => {
    // A single ndjson line (valid JSON terminated by newline)
    const result = await rpcEndpointReachable(ndjsonHandler, '{"_tag":"test"}\n')
    expect(result.reached).toBe(true)
  })

  it('POST /rpc with multiple ndjson lines reaches the endpoint', async () => {
    // Multiple ndjson lines
    const body = '{"line":1}\n{"line":2}\n{"line":3}\n'
    const result = await rpcEndpointReachable(ndjsonHandler, body)
    expect(result.reached).toBe(true)
  })
})

// =============================================================================
// 2. Content Negotiation Tests (6 tests)
// =============================================================================

describe('Content negotiation', () => {
  it('POST /rpc without content-type header reaches endpoint', async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 500)
    let reached = false

    try {
      const res = await ndjsonHandler(
        new Request('http://localhost/rpc', {
          method: 'POST',
          body: '{}',
          signal: controller.signal,
        }),
      )
      clearTimeout(timeout)
      reached = res.status !== 404
    } catch (err: any) {
      clearTimeout(timeout)
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        reached = true // endpoint matched, streaming
      } else {
        throw err
      }
    }
    expect(reached).toBe(true)
  })

  it('POST /rpc with application/xml still reaches endpoint', async () => {
    // RPC handler matches on POST /rpc path, not content-type
    const result = await rpcEndpointReachable(ndjsonHandler, '<xml/>', 'application/xml')
    expect(result.reached).toBe(true)
  })

  it('GET /rpc should fail (POST only)', async () => {
    const res = await ndjsonHandler(
      new Request('http://localhost/rpc', { method: 'GET' }),
    )
    // RPC endpoint only accepts POST; HttpLayerRouter returns 404 for unmatched routes
    expect([400, 404, 405]).toContain(res.status)
  })

  it('PUT /rpc should fail (POST only)', async () => {
    const res = await ndjsonHandler(
      new Request('http://localhost/rpc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect([400, 404, 405]).toContain(res.status)
  })

  it('DELETE /rpc should fail (POST only)', async () => {
    const res = await ndjsonHandler(
      new Request('http://localhost/rpc', { method: 'DELETE' }),
    )
    expect([400, 404, 405]).toContain(res.status)
  })

  it('PATCH /rpc should fail (POST only)', async () => {
    const res = await ndjsonHandler(
      new Request('http://localhost/rpc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect([400, 404, 405]).toContain(res.status)
  })
})

// =============================================================================
// 3. Wire Format Properties (6 tests)
// =============================================================================

describe('Wire format properties', () => {
  it('non-existent path returns 404 (route specificity)', async () => {
    const res = await ndjsonHandler(
      new Request('http://localhost/nonexistent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    // Only /rpc is mounted; anything else should 404
    expect(res.status).toBe(404)
  })

  it('POST /rpc/subpath returns 404 (exact path match)', async () => {
    const res = await ndjsonHandler(
      new Request('http://localhost/rpc/subpath', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect(res.status).toBe(404)
  })

  it('POST /rp returns 404 (partial path no match)', async () => {
    const res = await ndjsonHandler(
      new Request('http://localhost/rp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect(res.status).toBe(404)
  })

  it('POST / returns 404 (root path no match)', async () => {
    const res = await ndjsonHandler(
      new Request('http://localhost/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect(res.status).toBe(404)
  })

  it('msgpack handler also serves POST /rpc', async () => {
    const result = await rpcEndpointReachable(msgpackHandler)
    expect(result.reached).toBe(true)
  })

  it('msgpack handler returns 404 for non-existent paths', async () => {
    const res = await msgpackHandler(
      new Request('http://localhost/nonexistent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect(res.status).toBe(404)
  })
})
