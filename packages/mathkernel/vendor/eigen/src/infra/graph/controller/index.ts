/**
 * Cosmo Controller Capability
 * Pattern: pepr-excellent-examples/pepr-operator
 */

import { Capability, a, Log } from 'pepr'
import { CosmoRouter, CosmoSubgraph } from '../crd/types'
import { CosmoRouterCRD } from '../crd/source/cosmo-router.crd'
import { CosmoSubgraphCRD } from '../crd/source/cosmo-subgraph.crd'
import { RegisterCRDs } from '../crd/register'
import { reconcileRouter, reconcileSubgraph } from './reconciler'
import Deploy from './generators'

// Import register to trigger self-executing registration
import '../crd/register'

export const CosmoController = new Capability({
  name: 'cosmo-controller',
  description: 'Manages Cosmo GraphQL Federation resources',
  namespaces: [],
})

const { When, Store } = CosmoController

// =============================================================================
// COSMO ROUTER
// =============================================================================

When(CosmoRouter)
  .IsCreatedOrUpdated()
  .Reconcile(async instance => {
    try {
      Store.setItem(instance.metadata!.name!, JSON.stringify(instance))
      await reconcileRouter(instance)
    } catch (error) {
      Log.error(error, 'Error reconciling CosmoRouter')
    }
  })

When(CosmoRouter)
  .IsDeleted()
  .Mutate(async instance => {
    await Store.removeItemAndWait(instance.Raw.metadata!.name!)
  })

// =============================================================================
// COSMO SUBGRAPH
// =============================================================================

When(CosmoSubgraph)
  .IsCreatedOrUpdated()
  .Reconcile(async instance => {
    try {
      Store.setItem(instance.metadata!.name!, JSON.stringify(instance))
      await reconcileSubgraph(instance)
    } catch (error) {
      Log.error(error, 'Error reconciling CosmoSubgraph')
    }
  })

When(CosmoSubgraph)
  .IsDeleted()
  .Mutate(async instance => {
    await Store.removeItemAndWait(instance.Raw.metadata!.name!)
  })

// =============================================================================
// CRD RECOVERY
// =============================================================================

When(a.CustomResourceDefinition)
  .IsDeleted()
  .WithName(CosmoRouterCRD.metadata.name)
  .Watch(() => {
    RegisterCRDs()
  })

When(a.CustomResourceDefinition)
  .IsDeleted()
  .WithName(CosmoSubgraphCRD.metadata.name)
  .Watch(() => {
    RegisterCRDs()
  })

// =============================================================================
// OWNED RESOURCE RECOVERY
// =============================================================================

When(a.Deployment)
  .IsDeleted()
  .WithLabel('app.kubernetes.io/managed-by', 'cosmo-operator')
  .Watch(async deploy => {
    const stored = Store.getItem(deploy.metadata!.labels!['app.kubernetes.io/instance'])
    if (stored) {
      const instance = JSON.parse(stored) as CosmoRouter
      await Deploy(instance)
    }
  })

When(a.Service)
  .IsDeleted()
  .WithLabel('app.kubernetes.io/managed-by', 'cosmo-operator')
  .Watch(async svc => {
    const stored = Store.getItem(svc.metadata!.labels!['app.kubernetes.io/instance'])
    if (stored) {
      const instance = JSON.parse(stored) as CosmoRouter
      await Deploy(instance)
    }
  })

When(a.ConfigMap)
  .IsDeleted()
  .WithLabel('app.kubernetes.io/managed-by', 'cosmo-operator')
  .Watch(async cm => {
    const stored = Store.getItem(cm.metadata!.labels!['app.kubernetes.io/instance'])
    if (stored) {
      const instance = JSON.parse(stored) as CosmoRouter
      await Deploy(instance)
    }
  })
