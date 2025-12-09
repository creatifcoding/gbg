/**
 * Cosmo Controller Capability
 *
 * Pepr capability that watches CosmoRouter and CosmoSubgraph
 * resources and reconciles them with cluster state.
 */

import { Capability, a, Log, K8s, kind } from 'pepr'
import { registerCRDs, COSMO_GROUP, COSMO_VERSION, ROUTER_KIND, SUBGRAPH_KIND } from '../crd'
import type { CosmoRouter, CosmoSubgraph } from '../crd'
import { reconcileRouter, reconcileSubgraph, recoverOwnedResource, queueReconcile } from './reconciler'

export const CosmoController = new Capability({
  name: 'cosmo-controller',
  description: 'Manages Cosmo GraphQL Federation resources',
  namespaces: [], // All namespaces
})

const { When, Store } = CosmoController

// =============================================================================
// CRD REGISTRATION (on startup)
// =============================================================================

// Register CRDs when capability loads
registerCRDs().catch((error) => {
  Log.error({ error }, 'Failed to register CRDs on startup')
})

// =============================================================================
// COSMO ROUTER WATCHES
// =============================================================================

// Watch for CosmoRouter creation/updates
When({
  group: COSMO_GROUP,
  version: COSMO_VERSION,
  kind: ROUTER_KIND,
} as any)
  .IsCreatedOrUpdated()
  .Watch(async (router: CosmoRouter) => {
    const key = `${router.metadata!.namespace}/${router.metadata!.name}`
    Log.info({ key }, 'CosmoRouter created/updated')
    queueReconcile(key, () => reconcileRouter(router))
  })

// Watch for CosmoRouter deletion
When({
  group: COSMO_GROUP,
  version: COSMO_VERSION,
  kind: ROUTER_KIND,
} as any)
  .IsDeleted()
  .Watch(async (router: CosmoRouter) => {
    const key = `${router.metadata!.namespace}/${router.metadata!.name}`
    Log.info({ key }, 'CosmoRouter deleted')
    // Owned resources will be garbage collected via ownerReferences
  })

// =============================================================================
// COSMO SUBGRAPH WATCHES
// =============================================================================

// Watch for CosmoSubgraph creation/updates
When({
  group: COSMO_GROUP,
  version: COSMO_VERSION,
  kind: SUBGRAPH_KIND,
} as any)
  .IsCreatedOrUpdated()
  .Watch(async (subgraph: CosmoSubgraph) => {
    const key = `${subgraph.metadata!.namespace}/${subgraph.metadata!.name}`
    Log.info({ key }, 'CosmoSubgraph created/updated')
    queueReconcile(key, () => reconcileSubgraph(subgraph))
  })

// Watch for CosmoSubgraph deletion
When({
  group: COSMO_GROUP,
  version: COSMO_VERSION,
  kind: SUBGRAPH_KIND,
} as any)
  .IsDeleted()
  .Watch(async (subgraph: CosmoSubgraph) => {
    const key = `${subgraph.metadata!.namespace}/${subgraph.metadata!.name}`
    Log.info({ key }, 'CosmoSubgraph deleted')
    // TODO: Trigger router recomposition to remove subgraph
  })

// =============================================================================
// OWNED RESOURCE RECOVERY
// =============================================================================

// Watch for Deployment deletions (recover if owned by CosmoRouter)
When(a.Deployment)
  .IsDeleted()
  .WithLabel('app.kubernetes.io/managed-by', 'cosmo-operator')
  .Watch(async (deployment) => {
    await recoverOwnedResource(deployment)
  })

// Watch for Service deletions (recover if owned by CosmoRouter)
When(a.Service)
  .IsDeleted()
  .WithLabel('app.kubernetes.io/managed-by', 'cosmo-operator')
  .Watch(async (service) => {
    await recoverOwnedResource(service)
  })

// Watch for ConfigMap deletions (recover if owned by CosmoRouter)
When(a.ConfigMap)
  .IsDeleted()
  .WithLabel('app.kubernetes.io/managed-by', 'cosmo-operator')
  .Watch(async (configMap) => {
    await recoverOwnedResource(configMap)
  })

// =============================================================================
// CRD RECOVERY
// =============================================================================

// Re-register CRDs if they're deleted
When(a.CustomResourceDefinition)
  .IsDeleted()
  .WithName('cosmorouters.tmnl.gbg.dev')
  .Watch(async () => {
    Log.warn('CosmoRouter CRD deleted, re-registering...')
    await registerCRDs()
  })

When(a.CustomResourceDefinition)
  .IsDeleted()
  .WithName('cosmosubgraphs.tmnl.gbg.dev')
  .Watch(async () => {
    Log.warn('CosmoSubgraph CRD deleted, re-registering...')
    await registerCRDs()
  })
