/**
 * CRD Type Tests
 *
 * Validates TypeScript types match expected CRD structures.
 */

import { describe, it, expect } from 'vitest'
import type {
  CosmoRouter,
  CosmoRouterSpec,
  CosmoSubgraph,
  CosmoSubgraphSpec,
} from './types'

describe('CosmoRouter Types', () => {
  describe('CosmoRouterSpec', () => {
    it('accepts minimal spec', () => {
      const spec: CosmoRouterSpec = {
        executionConfig: {
          configMapRef: { name: 'my-config' },
        },
      }
      expect(spec.executionConfig.configMapRef?.name).toBe('my-config')
    })

    it('accepts full spec', () => {
      const spec: CosmoRouterSpec = {
        executionConfig: {
          configMapRef: { name: 'config', key: 'router.json' },
        },
        config: {
          devMode: true,
          listenAddr: '0.0.0.0:3002',
          graphqlPath: '/graphql',
          playgroundEnabled: true,
          introspectionEnabled: true,
        },
        replicas: 3,
        image: {
          repository: 'ghcr.io/wundergraph/cosmo/router',
          tag: 'v1.0.0',
          pullPolicy: 'IfNotPresent',
        },
        resources: {
          requests: { cpu: '100m', memory: '128Mi' },
          limits: { cpu: '500m', memory: '512Mi' },
        },
        service: {
          type: 'LoadBalancer',
          port: 8080,
        },
        subgraphs: [
          { name: 'users', ref: { name: 'users-sg', namespace: 'default' } },
          { name: 'products' },
        ],
      }

      expect(spec.replicas).toBe(3)
      expect(spec.config?.devMode).toBe(true)
      expect(spec.image?.pullPolicy).toBe('IfNotPresent')
      expect(spec.subgraphs?.length).toBe(2)
    })

    it('accepts inline execution config', () => {
      const spec: CosmoRouterSpec = {
        executionConfig: {
          inline: '{"engineConfig":{}}',
        },
      }
      expect(spec.executionConfig.inline).toBeDefined()
    })
  })

  describe('CosmoRouter', () => {
    it('accepts full resource structure', () => {
      const router: CosmoRouter = {
        apiVersion: 'tmnl.gbg.dev/v1alpha1',
        kind: 'CosmoRouter',
        metadata: {
          name: 'test-router',
          namespace: 'default',
          uid: 'abc-123',
        },
        spec: {
          executionConfig: { configMapRef: { name: 'config' } },
          replicas: 2,
        },
        status: {
          phase: 'Running',
          observedGeneration: 1,
          subgraphCount: 3,
        },
      }

      expect(router.metadata?.name).toBe('test-router')
      expect(router.spec.replicas).toBe(2)
      expect(router.status?.phase).toBe('Running')
    })
  })
})

describe('CosmoSubgraph Types', () => {
  describe('CosmoSubgraphSpec', () => {
    it('accepts minimal spec', () => {
      const spec: CosmoSubgraphSpec = {
        name: 'sensors',
        routingUrl: 'http://localhost:4011/graphql',
        schema: {
          inline: 'type Query { hello: String }',
        },
      }

      expect(spec.name).toBe('sensors')
      expect(spec.routingUrl).toContain('http')
    })

    it('accepts full spec', () => {
      const spec: CosmoSubgraphSpec = {
        name: 'users',
        routingUrl: 'https://users.example.com/graphql',
        subscriptionUrl: 'wss://users.example.com/graphql',
        schema: {
          configMapRef: { name: 'users-schema', key: 'schema.graphql' },
        },
        connect: {
          enabled: true,
          protocol: 'connect',
        },
        federation: {
          version: '2',
        },
        healthCheck: {
          enabled: true,
          path: '/health',
          interval: '30s',
        },
        routerSelector: {
          'app.kubernetes.io/instance': 'main-router',
        },
      }

      expect(spec.connect?.protocol).toBe('connect')
      expect(spec.federation?.version).toBe('2')
      expect(spec.healthCheck?.interval).toBe('30s')
    })

    it('accepts introspection schema source', () => {
      const spec: CosmoSubgraphSpec = {
        name: 'dynamic',
        routingUrl: 'http://dynamic-service/graphql',
        schema: {
          introspection: {
            url: 'http://dynamic-service/graphql',
            interval: '5m',
          },
        },
      }

      expect(spec.schema.introspection?.url).toBeDefined()
    })
  })

  describe('CosmoSubgraph', () => {
    it('accepts full resource structure', () => {
      const subgraph: CosmoSubgraph = {
        apiVersion: 'tmnl.gbg.dev/v1alpha1',
        kind: 'CosmoSubgraph',
        metadata: {
          name: 'sensors',
          namespace: 'tmnl',
          uid: 'xyz-789',
        },
        spec: {
          name: 'sensors',
          routingUrl: 'http://sensor-service:4011/graphql',
          schema: { inline: 'type Query { listSensors: [Sensor] }' },
          federation: { version: '2' },
        },
        status: {
          phase: 'Ready',
          observedGeneration: 1,
          connectedRouters: ['main-router'],
        },
      }

      expect(subgraph.spec.name).toBe('sensors')
      expect(subgraph.status?.phase).toBe('Ready')
      expect(subgraph.status?.connectedRouters).toContain('main-router')
    })
  })
})

describe('Type Constraints', () => {
  it('image pullPolicy is restricted', () => {
    // TypeScript should only allow these values
    const validPolicies: Array<CosmoRouterSpec['image']> = [
      { pullPolicy: 'Always' },
      { pullPolicy: 'IfNotPresent' },
      { pullPolicy: 'Never' },
    ]

    expect(validPolicies.length).toBe(3)
  })

  it('service type is restricted', () => {
    const validTypes: Array<CosmoRouterSpec['service']> = [
      { type: 'ClusterIP' },
      { type: 'NodePort' },
      { type: 'LoadBalancer' },
    ]

    expect(validTypes.length).toBe(3)
  })

  it('connect protocol is restricted', () => {
    const validProtocols: Array<CosmoSubgraphSpec['connect']> = [
      { protocol: 'grpc' },
      { protocol: 'grpc-web' },
      { protocol: 'connect' },
    ]

    expect(validProtocols.length).toBe(3)
  })

  it('federation version is restricted', () => {
    const validVersions: Array<CosmoSubgraphSpec['federation']> = [
      { version: '1' },
      { version: '2' },
    ]

    expect(validVersions.length).toBe(2)
  })

  it('router status phase is restricted', () => {
    const validPhases: Array<CosmoRouter['status']> = [
      { phase: 'Pending' },
      { phase: 'Composing' },
      { phase: 'Running' },
      { phase: 'Failed' },
    ]

    expect(validPhases.length).toBe(4)
  })

  it('subgraph status phase is restricted', () => {
    const validPhases: Array<CosmoSubgraph['status']> = [
      { phase: 'Pending' },
      { phase: 'Validating' },
      { phase: 'Ready' },
      { phase: 'Failed' },
      { phase: 'Unhealthy' },
    ]

    expect(validPhases.length).toBe(5)
  })
})
