/**
 * Reconciler
 *
 * Core reconciliation logic for CosmoRouter and CosmoSubgraph.
 * Ensures desired state matches actual cluster state.
 */

import { K8s, kind, Log } from 'pepr'
import type { CosmoRouter, CosmoSubgraph, CosmoRouterStatus, CosmoSubgraphStatus } from '../crd'
import { generateDeployment, generateService, generateConfigMap } from './generators'
import { COSMO_GROUP, COSMO_VERSION, ROUTER_KIND, SUBGRAPH_KIND } from '../crd'

// Queue for serializing reconciliation
const reconcileQueue: Map<string, () => Promise<void>> = new Map()
let processing = false

async function processQueue(): Promise<void> {
  if (processing) return
  processing = true

  while (reconcileQueue.size > 0) {
    const [key, fn] = reconcileQueue.entries().next().value
    reconcileQueue.delete(key)
    try {
      await fn()
    } catch (error) {
      Log.error({ key, error }, 'Reconciliation failed')
    }
  }

  processing = false
}

export function queueReconcile(key: string, fn: () => Promise<void>): void {
  reconcileQueue.set(key, fn)
  processQueue()
}

// =============================================================================
// ROUTER RECONCILIATION
// =============================================================================

export async function reconcileRouter(router: CosmoRouter): Promise<void> {
  const name = router.metadata!.name!
  const namespace = router.metadata!.namespace!
  const key = `${namespace}/${name}`

  Log.info({ key }, 'Reconciling CosmoRouter')

  try {
    // Update status to Composing
    await updateRouterStatus(router, { phase: 'Composing' })

    // Generate and apply Deployment
    const deployment = generateDeployment(router)
    await K8s(kind.Deployment).Apply(deployment, { force: true })
    Log.debug({ key }, 'Applied Deployment')

    // Generate and apply Service
    const service = generateService(router)
    await K8s(kind.Service).Apply(service, { force: true })
    Log.debug({ key }, 'Applied Service')

    // Update status to Running
    await updateRouterStatus(router, {
      phase: 'Running',
      observedGeneration: router.metadata!.generation,
      subgraphCount: router.spec.subgraphs?.length ?? 0,
    })

    Log.info({ key }, 'CosmoRouter reconciled successfully')
  } catch (error) {
    Log.error({ key, error }, 'Failed to reconcile CosmoRouter')
    await updateRouterStatus(router, {
      phase: 'Failed',
      conditions: [
        {
          type: 'Ready',
          status: 'False',
          reason: 'ReconcileFailed',
          message: String(error),
        },
      ],
    })
    throw error
  }
}

async function updateRouterStatus(
  router: CosmoRouter,
  status: Partial<CosmoRouterStatus>
): Promise<void> {
  const name = router.metadata!.name!
  const namespace = router.metadata!.namespace!

  try {
    // Pepr's K8s client for custom resources
    const api = K8s({
      group: COSMO_GROUP,
      version: COSMO_VERSION,
      kind: ROUTER_KIND,
      plural: 'cosmorouters',
    } as any)

    await api.PatchStatus({
      metadata: { name, namespace },
      status: { ...router.status, ...status },
    } as any)
  } catch (error) {
    Log.warn({ name, namespace, error }, 'Failed to update router status')
  }
}

// =============================================================================
// SUBGRAPH RECONCILIATION
// =============================================================================

export async function reconcileSubgraph(subgraph: CosmoSubgraph): Promise<void> {
  const name = subgraph.metadata!.name!
  const namespace = subgraph.metadata!.namespace!
  const key = `${namespace}/${name}`

  Log.info({ key }, 'Reconciling CosmoSubgraph')

  try {
    // Update status to Validating
    await updateSubgraphStatus(subgraph, { phase: 'Validating' })

    // Validate schema exists
    const hasSchema =
      subgraph.spec.schema.inline ||
      subgraph.spec.schema.configMapRef ||
      subgraph.spec.schema.introspection

    if (!hasSchema) {
      throw new Error('No schema source specified')
    }

    // TODO: Validate SDL syntax
    // TODO: Trigger router recomposition

    // Update status to Ready
    await updateSubgraphStatus(subgraph, {
      phase: 'Ready',
      observedGeneration: subgraph.metadata!.generation,
    })

    Log.info({ key }, 'CosmoSubgraph reconciled successfully')
  } catch (error) {
    Log.error({ key, error }, 'Failed to reconcile CosmoSubgraph')
    await updateSubgraphStatus(subgraph, {
      phase: 'Failed',
      conditions: [
        {
          type: 'Ready',
          status: 'False',
          reason: 'ValidationFailed',
          message: String(error),
        },
      ],
    })
    throw error
  }
}

async function updateSubgraphStatus(
  subgraph: CosmoSubgraph,
  status: Partial<CosmoSubgraphStatus>
): Promise<void> {
  const name = subgraph.metadata!.name!
  const namespace = subgraph.metadata!.namespace!

  try {
    const api = K8s({
      group: COSMO_GROUP,
      version: COSMO_VERSION,
      kind: SUBGRAPH_KIND,
      plural: 'cosmosubgraphs',
    } as any)

    await api.PatchStatus({
      metadata: { name, namespace },
      status: { ...subgraph.status, ...status },
    } as any)
  } catch (error) {
    Log.warn({ name, namespace, error }, 'Failed to update subgraph status')
  }
}

// =============================================================================
// OWNED RESOURCE RECOVERY
// =============================================================================

export async function recoverOwnedResource(
  resource: kind.Deployment | kind.Service | kind.ConfigMap
): Promise<void> {
  const ownerRef = resource.metadata?.ownerReferences?.find(
    (ref) => ref.kind === 'CosmoRouter' && ref.apiVersion === 'tmnl.gbg.dev/v1alpha1'
  )

  if (!ownerRef) return

  const namespace = resource.metadata!.namespace!
  const routerName = ownerRef.name

  Log.info(
    { namespace, routerName, resourceKind: resource.kind },
    'Owned resource deleted, triggering router reconciliation'
  )

  try {
    const api = K8s({
      group: COSMO_GROUP,
      version: COSMO_VERSION,
      kind: ROUTER_KIND,
      plural: 'cosmorouters',
    } as any)

    const router = (await api.InNamespace(namespace).Get(routerName)) as CosmoRouter

    queueReconcile(`${namespace}/${routerName}`, () => reconcileRouter(router))
  } catch (error) {
    Log.error({ namespace, routerName, error }, 'Failed to recover owned resource')
  }
}
