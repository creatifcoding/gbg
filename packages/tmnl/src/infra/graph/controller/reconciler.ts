/**
 * Reconciler
 * Pattern: pepr-excellent-examples/pepr-operator
 */

import { K8s, Log } from 'pepr'
import { CosmoRouter, CosmoSubgraph, CosmoRouterStatus, CosmoSubgraphStatus, COSMO_GROUP, COSMO_VERSION, ROUTER_KIND, SUBGRAPH_KIND } from '../crd/types'
import Deploy from './generators'
import { introspectEndpoint, type IntrospectionResult } from './introspection'

// =============================================================================
// ROUTER RECONCILIATION
// =============================================================================

export async function reconcileRouter(router: CosmoRouter): Promise<void> {
  const name = router.metadata!.name!
  const namespace = router.metadata!.namespace!
  const key = `${namespace}/${name}`
  const generation = router.metadata!.generation

  // Skip if already reconciled this generation
  if (router.status?.observedGeneration === generation) {
    Log.debug({ key, generation }, 'Skipping - already reconciled this generation')
    return
  }

  Log.info({ key, generation }, 'Reconciling CosmoRouter')

  try {
    // Update status to Composing
    await updateRouterStatus(router, { phase: 'Composing' })

    // Deploy resources
    await Deploy(router)

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
    const api = K8s(CosmoRouter)
    await api.PatchStatus({
      metadata: { name, namespace },
      status: { ...router.status, ...status },
    } as CosmoRouter)
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
  const generation = subgraph.metadata!.generation

  // Skip if already reconciled this generation
  if (subgraph.status?.observedGeneration === generation) {
    Log.debug({ key, generation }, 'Skipping - already reconciled this generation')
    return
  }

  Log.info({ key, generation }, 'Reconciling CosmoSubgraph')

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

    // Handle introspection-based schema discovery
    let sdl: string | undefined
    let introspectionResult: IntrospectionResult | undefined

    if (subgraph.spec.schema.introspection?.url) {
      Log.info({ key, url: subgraph.spec.schema.introspection.url }, 'Introspecting subgraph endpoint')
      introspectionResult = await introspectEndpoint(subgraph.spec.schema.introspection.url)

      if (!introspectionResult.success) {
        throw new Error(`Introspection failed: ${introspectionResult.error}`)
      }

      sdl = introspectionResult.sdl
      Log.info(
        { key, typeCount: introspectionResult.types?.length ?? 0 },
        'Introspection successful - SDL extracted'
      )
    } else if (subgraph.spec.schema.inline) {
      sdl = subgraph.spec.schema.inline
    }
    // TODO: Handle configMapRef case

    // TODO: Validate SDL syntax (parse with graphql-js)
    // TODO: Trigger router recomposition (regenerate router.json)

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
    const api = K8s(CosmoSubgraph)
    await api.PatchStatus({
      metadata: { name, namespace },
      status: { ...subgraph.status, ...status },
    } as CosmoSubgraph)
  } catch (error) {
    Log.warn({ name, namespace, error }, 'Failed to update subgraph status')
  }
}
