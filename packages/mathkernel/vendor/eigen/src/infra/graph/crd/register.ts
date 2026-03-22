/**
 * CRD Registration
 * Pattern: pepr-excellent-examples/pepr-operator
 */

import { K8s, Log, kind } from 'pepr'
import { CosmoRouterCRD } from './source/cosmo-router.crd'
import { CosmoSubgraphCRD } from './source/cosmo-subgraph.crd'

export const RegisterCRDs = () => {
  Promise.all([
    K8s(kind.CustomResourceDefinition)
      .Apply(CosmoRouterCRD, { force: true })
      .then(() => Log.info('CosmoRouter CRD registered')),
    K8s(kind.CustomResourceDefinition)
      .Apply(CosmoSubgraphCRD, { force: true })
      .then(() => Log.info('CosmoSubgraph CRD registered')),
  ]).catch(err => {
    Log.error(err)
    process.exit(1)
  })
}

// Self-executing registration
;(() => RegisterCRDs())()
