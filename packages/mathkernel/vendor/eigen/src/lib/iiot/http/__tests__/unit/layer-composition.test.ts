/**
 * Layer Composition Unit Tests
 *
 * Verifies that all IIoT HTTP server layers compose correctly
 * without actually making HTTP calls or booting a server.
 *
 * These tests catch layer DAG wiring issues early by asserting
 * that layer composition doesn't throw and produces valid layers.
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
import { IIoTRpcServer, IIoTRpcNdjson, IIoTRpcMsgPack } from '../../rpc-server'
import { ClusterDev } from '../../cluster'
import {
  EntityHandlersLayer,
  EntityTestingStack,
  EntityProductionHandlersWithEvents,
} from '../../../entity/EntityStack'
import { AllStateServicesInMemory } from '../../../state'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlagsEnabledLayer,
} from '../../../infrastructure/feature-flags'

// =============================================================================
// Individual Layer Identity Tests
// =============================================================================

describe('Layer Composition', () => {
  describe('Handler layers', () => {
    it('ProxyHandlers should be a Layer', () => {
      expect(Layer.isLayer(ProxyHandlers)).toBe(true)
    })

    it('QueryHandlers should be a Layer', () => {
      expect(Layer.isLayer(QueryHandlers)).toBe(true)
    })
  })

  describe('Entity layers', () => {
    it('EntityHandlersLayer should be a Layer', () => {
      expect(Layer.isLayer(EntityHandlersLayer)).toBe(true)
    })

    it('EntityTestingStack should be a Layer', () => {
      expect(Layer.isLayer(EntityTestingStack)).toBe(true)
    })

    it('EntityProductionHandlersWithEvents should be a Layer', () => {
      expect(Layer.isLayer(EntityProductionHandlersWithEvents)).toBe(true)
    })
  })

  describe('State and feature flag layers', () => {
    it('AllStateServicesInMemory should be a Layer', () => {
      expect(Layer.isLayer(AllStateServicesInMemory)).toBe(true)
    })

    it('IIoTFeatureFlagsDisabledLayer should be a Layer', () => {
      expect(Layer.isLayer(IIoTFeatureFlagsDisabledLayer)).toBe(true)
    })

    it('IIoTFeatureFlagsEnabledLayer should be a Layer', () => {
      expect(Layer.isLayer(IIoTFeatureFlagsEnabledLayer)).toBe(true)
    })
  })

  describe('RPC Server layers', () => {
    it('IIoTRpcNdjson should be a Layer', () => {
      expect(Layer.isLayer(IIoTRpcNdjson)).toBe(true)
    })

    it('IIoTRpcMsgPack should be a Layer', () => {
      expect(Layer.isLayer(IIoTRpcMsgPack)).toBe(true)
    })

    it('IIoTRpcServer should equal IIoTRpcNdjson (default)', () => {
      expect(IIoTRpcServer).toBe(IIoTRpcNdjson)
    })
  })

  describe('Cluster layers', () => {
    it('ClusterDev should be TestRunner.layer', () => {
      expect(ClusterDev).toBe(TestRunner.layer)
    })

    it('ClusterDev should be a Layer', () => {
      expect(Layer.isLayer(ClusterDev)).toBe(true)
    })
  })

  // =============================================================================
  // Composition Tests
  // =============================================================================

  describe('ApiLive composition', () => {
    it('should compose HttpApiBuilder.api with handler layers without error', () => {
      const ApiLive = HttpApiBuilder.api(IIoTApi).pipe(
        Layer.provide(ProxyHandlers),
        Layer.provide(QueryHandlers),
      )
      expect(ApiLive).toBeDefined()
      expect(Layer.isLayer(ApiLive)).toBe(true)
    })

    it('should compose full ApiLive with all dependencies', () => {
      const ApiLive = HttpApiBuilder.api(IIoTApi).pipe(
        Layer.provide(ProxyHandlers),
        Layer.provide(QueryHandlers),
        Layer.provide(EntityHandlersLayer),
        Layer.provide(AllStateServicesInMemory),
        Layer.provide(IIoTFeatureFlagsDisabledLayer),
        Layer.provide(TestRunner.layer),
      )
      expect(ApiLive).toBeDefined()
      expect(Layer.isLayer(ApiLive)).toBe(true)
    })
  })

  describe('TestApiLayer composition', () => {
    it('should compose full test layer with middleware', () => {
      const ApiLive = HttpApiBuilder.api(IIoTApi).pipe(
        Layer.provide(ProxyHandlers),
        Layer.provide(QueryHandlers),
        Layer.provide(EntityHandlersLayer),
        Layer.provide(AllStateServicesInMemory),
        Layer.provide(IIoTFeatureFlagsDisabledLayer),
        Layer.provide(TestRunner.layer),
      )
      const TestApiLayer = Layer.empty.pipe(
        Layer.provideMerge(HttpApiBuilder.middlewareCors()),
        Layer.provideMerge(HttpApiSwagger.layer({ path: '/docs' })),
        Layer.provideMerge(ApiLive),
        Layer.provideMerge(HttpServer.layerContext),
      )
      expect(Layer.isLayer(TestApiLayer)).toBe(true)
    })

    it('should produce a valid toWebHandler', () => {
      const ApiLive = HttpApiBuilder.api(IIoTApi).pipe(
        Layer.provide(ProxyHandlers),
        Layer.provide(QueryHandlers),
        Layer.provide(EntityHandlersLayer),
        Layer.provide(AllStateServicesInMemory),
        Layer.provide(IIoTFeatureFlagsDisabledLayer),
        Layer.provide(TestRunner.layer),
      )
      const TestApiLayer = Layer.empty.pipe(
        Layer.provideMerge(HttpApiBuilder.middlewareCors()),
        Layer.provideMerge(HttpApiSwagger.layer({ path: '/docs' })),
        Layer.provideMerge(ApiLive),
        Layer.provideMerge(HttpServer.layerContext),
      )
      const { handler, dispose } = HttpApiBuilder.toWebHandler(TestApiLayer)
      expect(handler).toBeTypeOf('function')
      expect(dispose).toBeTypeOf('function')
      dispose()
    })
  })

  describe('Server-mirrored composition', () => {
    it('should compose IIoTHttpServerDev-equivalent layer without BunHttpServer', () => {
      // Mirrors server.ts IIoTHttpServerDev composition, minus transport
      const ApiLive = HttpApiBuilder.api(IIoTApi).pipe(
        Layer.provide(ProxyHandlers),
        Layer.provide(QueryHandlers),
      )
      const ServerLayer = Layer.empty.pipe(
        Layer.provideMerge(HttpApiBuilder.middlewareCors()),
        Layer.provideMerge(HttpApiSwagger.layer({ path: '/docs' })),
        Layer.provideMerge(ApiLive),
        Layer.provideMerge(IIoTRpcServer),
        Layer.provideMerge(EntityHandlersLayer),
        Layer.provideMerge(AllStateServicesInMemory),
        Layer.provideMerge(IIoTFeatureFlagsDisabledLayer),
        Layer.provideMerge(ClusterDev),
        Layer.provideMerge(HttpServer.layerContext),
      )
      expect(Layer.isLayer(ServerLayer)).toBe(true)
    })
  })
})
