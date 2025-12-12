/**
 * Generated TypeScript types for Cosmo CRDs
 *
 * Pattern derived from pepr-excellent-examples/pepr-operator
 */

import { a, RegisterKind } from 'pepr'

// =============================================================================
// COSMO ROUTER
// =============================================================================

export class CosmoRouter extends a.GenericKind {
  spec!: CosmoRouterSpec
  status?: CosmoRouterStatus
}

export interface CosmoRouterSpec {
  executionConfig: {
    configMapRef?: {
      name: string
      key?: string
    }
    inline?: string
  }
  config?: {
    devMode?: boolean
    listenAddr?: string
    graphqlPath?: string
    playgroundEnabled?: boolean
    introspectionEnabled?: boolean
  }
  replicas?: number
  image?: {
    repository?: string
    tag?: string
    pullPolicy?: 'Always' | 'IfNotPresent' | 'Never'
  }
  resources?: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
  service?: {
    type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer'
    port?: number
  }
  subgraphs?: Array<{
    name: string
    ref?: { name: string; namespace?: string }
  }>
}

export interface CosmoRouterStatus {
  phase?: 'Pending' | 'Composing' | 'Running' | 'Failed'
  observedGeneration?: number
  subgraphCount?: number
  compositionHash?: string
  conditions?: Array<{
    type: string
    status: string
    reason?: string
    message?: string
  }>
}

// Register CosmoRouter kind
RegisterKind(CosmoRouter, {
  group: 'tmnl.gbg.dev',
  version: 'v1alpha1',
  kind: 'CosmoRouter',
})

// =============================================================================
// COSMO SUBGRAPH
// =============================================================================

export class CosmoSubgraph extends a.GenericKind {
  spec!: CosmoSubgraphSpec
  status?: CosmoSubgraphStatus
}

export interface CosmoSubgraphSpec {
  name: string
  routingUrl: string
  subscriptionUrl?: string
  schema: {
    configMapRef?: {
      name: string
      key?: string
    }
    inline?: string
    introspection?: {
      url: string
      interval?: string
    }
  }
  connect?: {
    enabled?: boolean
    protocol?: 'grpc' | 'grpc-web' | 'connect'
  }
  federation?: {
    version?: '1' | '2'
  }
  healthCheck?: {
    enabled?: boolean
    path?: string
    interval?: string
  }
  routerSelector?: Record<string, string>
}

export interface CosmoSubgraphStatus {
  phase?: 'Pending' | 'Validating' | 'Ready' | 'Failed' | 'Unhealthy'
  observedGeneration?: number
  schemaHash?: string
  connectedRouters?: string[]
  conditions?: Array<{
    type: string
    status: string
    reason?: string
    message?: string
  }>
}

// Register CosmoSubgraph kind
RegisterKind(CosmoSubgraph, {
  group: 'tmnl.gbg.dev',
  version: 'v1alpha1',
  kind: 'CosmoSubgraph',
})

// =============================================================================
// CONSTANTS
// =============================================================================

export const COSMO_GROUP = 'tmnl.gbg.dev'
export const COSMO_VERSION = 'v1alpha1'
export const ROUTER_KIND = 'CosmoRouter'
export const SUBGRAPH_KIND = 'CosmoSubgraph'
