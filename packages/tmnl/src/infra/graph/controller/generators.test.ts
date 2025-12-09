/**
 * Generator Tests
 *
 * Validates K8s resource generation from CosmoRouter specs.
 */

import { describe, it, expect } from 'vitest'
import { generateDeployment, generateService, generateConfigMap } from './generators'
import type { CosmoRouter } from '../crd'

const mockRouter: CosmoRouter = {
  apiVersion: 'tmnl.gbg.dev/v1alpha1',
  kind: 'CosmoRouter',
  metadata: {
    name: 'test-router',
    namespace: 'test-ns',
    uid: 'abc-123-xyz',
    generation: 1,
  },
  spec: {
    executionConfig: {
      configMapRef: { name: 'test-config', key: 'router.json' },
    },
    config: {
      devMode: true,
      listenAddr: '0.0.0.0:8080',
      graphqlPath: '/gql',
      playgroundEnabled: false,
      introspectionEnabled: false,
    },
    replicas: 3,
    image: {
      repository: 'custom/router',
      tag: 'v1.2.3',
      pullPolicy: 'Always',
    },
    resources: {
      requests: { cpu: '200m', memory: '256Mi' },
      limits: { cpu: '1', memory: '1Gi' },
    },
    service: {
      type: 'LoadBalancer',
      port: 8080,
    },
    subgraphs: [
      { name: 'users' },
      { name: 'products', ref: { name: 'products-sg', namespace: 'prod' } },
    ],
  },
}

describe('generateDeployment', () => {
  it('creates deployment with correct metadata', () => {
    const deployment = generateDeployment(mockRouter)

    expect(deployment.apiVersion).toBe('apps/v1')
    expect(deployment.kind).toBe('Deployment')
    expect(deployment.metadata?.name).toBe('test-router-router')
    expect(deployment.metadata?.namespace).toBe('test-ns')
  })

  it('includes standard labels', () => {
    const deployment = generateDeployment(mockRouter)
    const labels = deployment.metadata?.labels

    expect(labels?.['app.kubernetes.io/name']).toBe('test-router-router')
    expect(labels?.['app.kubernetes.io/instance']).toBe('test-router')
    expect(labels?.['app.kubernetes.io/component']).toBe('router')
    expect(labels?.['app.kubernetes.io/managed-by']).toBe('cosmo-operator')
  })

  it('includes ownerReference for cascading deletion', () => {
    const deployment = generateDeployment(mockRouter)
    const ownerRef = deployment.metadata?.ownerReferences?.[0]

    expect(ownerRef).toBeDefined()
    expect(ownerRef?.apiVersion).toBe('tmnl.gbg.dev/v1alpha1')
    expect(ownerRef?.kind).toBe('CosmoRouter')
    expect(ownerRef?.name).toBe('test-router')
    expect(ownerRef?.uid).toBe('abc-123-xyz')
    expect(ownerRef?.controller).toBe(true)
    expect(ownerRef?.blockOwnerDeletion).toBe(true)
  })

  it('respects replica count', () => {
    const deployment = generateDeployment(mockRouter)
    expect(deployment.spec?.replicas).toBe(3)
  })

  it('uses custom image configuration', () => {
    const deployment = generateDeployment(mockRouter)
    const container = deployment.spec?.template?.spec?.containers?.[0]

    expect(container?.image).toBe('custom/router:v1.2.3')
    expect(container?.imagePullPolicy).toBe('Always')
  })

  it('sets environment variables from config', () => {
    const deployment = generateDeployment(mockRouter)
    const container = deployment.spec?.template?.spec?.containers?.[0]
    const env = container?.env

    expect(env).toContainEqual({ name: 'DEV_MODE', value: 'true' })
    expect(env).toContainEqual({ name: 'LISTEN_ADDR', value: '0.0.0.0:8080' })
    expect(env).toContainEqual({ name: 'GRAPHQL_PATH', value: '/gql' })
    expect(env).toContainEqual({ name: 'PLAYGROUND_ENABLED', value: 'false' })
    expect(env).toContainEqual({ name: 'INTROSPECTION_ENABLED', value: 'false' })
  })

  it('mounts execution config volume', () => {
    const deployment = generateDeployment(mockRouter)
    const container = deployment.spec?.template?.spec?.containers?.[0]
    const volumeMount = container?.volumeMounts?.[0]
    const volume = deployment.spec?.template?.spec?.volumes?.[0]

    expect(volumeMount?.name).toBe('execution-config')
    expect(volumeMount?.mountPath).toBe('/config')
    expect(volumeMount?.readOnly).toBe(true)

    expect(volume?.name).toBe('execution-config')
    expect(volume?.configMap?.name).toBe('test-config')
  })

  it('includes health probes', () => {
    const deployment = generateDeployment(mockRouter)
    const container = deployment.spec?.template?.spec?.containers?.[0]

    expect(container?.livenessProbe?.httpGet?.path).toBe('/health/live')
    expect(container?.readinessProbe?.httpGet?.path).toBe('/health/ready')
  })

  it('applies resource requests and limits', () => {
    const deployment = generateDeployment(mockRouter)
    const container = deployment.spec?.template?.spec?.containers?.[0]

    expect(container?.resources?.requests?.cpu).toBe('200m')
    expect(container?.resources?.requests?.memory).toBe('256Mi')
    expect(container?.resources?.limits?.cpu).toBe('1')
    expect(container?.resources?.limits?.memory).toBe('1Gi')
  })

  it('uses defaults when config not specified', () => {
    const minimalRouter: CosmoRouter = {
      ...mockRouter,
      spec: {
        executionConfig: { configMapRef: { name: 'config' } },
      },
    }

    const deployment = generateDeployment(minimalRouter)
    const container = deployment.spec?.template?.spec?.containers?.[0]
    const env = container?.env

    expect(deployment.spec?.replicas).toBe(1)
    expect(container?.image).toBe('ghcr.io/wundergraph/cosmo/router:latest')
    expect(container?.imagePullPolicy).toBe('IfNotPresent')
    expect(env).toContainEqual({ name: 'DEV_MODE', value: 'false' })
  })
})

describe('generateService', () => {
  it('creates service with correct metadata', () => {
    const service = generateService(mockRouter)

    expect(service.apiVersion).toBe('v1')
    expect(service.kind).toBe('Service')
    expect(service.metadata?.name).toBe('test-router-router')
    expect(service.metadata?.namespace).toBe('test-ns')
  })

  it('includes standard labels', () => {
    const service = generateService(mockRouter)
    const labels = service.metadata?.labels

    expect(labels?.['app.kubernetes.io/managed-by']).toBe('cosmo-operator')
  })

  it('includes ownerReference', () => {
    const service = generateService(mockRouter)
    expect(service.metadata?.ownerReferences?.length).toBe(1)
  })

  it('respects service type and port', () => {
    const service = generateService(mockRouter)

    expect(service.spec?.type).toBe('LoadBalancer')
    expect(service.spec?.ports?.[0]?.port).toBe(8080)
  })

  it('uses selector labels matching deployment', () => {
    const service = generateService(mockRouter)

    expect(service.spec?.selector?.['app.kubernetes.io/name']).toBe('test-router-router')
    expect(service.spec?.selector?.['app.kubernetes.io/instance']).toBe('test-router')
  })

  it('uses defaults when config not specified', () => {
    const minimalRouter: CosmoRouter = {
      ...mockRouter,
      spec: {
        executionConfig: { configMapRef: { name: 'config' } },
      },
    }

    const service = generateService(minimalRouter)

    expect(service.spec?.type).toBe('ClusterIP')
    expect(service.spec?.ports?.[0]?.port).toBe(3002)
  })
})

describe('generateConfigMap', () => {
  const routerJson = JSON.stringify({ engineConfig: { test: true } })

  it('creates configmap with router.json', () => {
    const configMap = generateConfigMap(mockRouter, routerJson)

    expect(configMap.apiVersion).toBe('v1')
    expect(configMap.kind).toBe('ConfigMap')
    expect(configMap.metadata?.name).toBe('test-router-config')
    expect(configMap.data?.['router.json']).toBe(routerJson)
  })

  it('includes ownerReference', () => {
    const configMap = generateConfigMap(mockRouter, routerJson)
    expect(configMap.metadata?.ownerReferences?.length).toBe(1)
  })

  it('includes managed-by label', () => {
    const configMap = generateConfigMap(mockRouter, routerJson)
    expect(configMap.metadata?.labels?.['app.kubernetes.io/managed-by']).toBe('cosmo-operator')
  })
})
