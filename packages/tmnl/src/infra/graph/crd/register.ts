/**
 * CRD Registration
 *
 * Ensures CRDs are deployed when the operator starts.
 * Uses Pepr's K8s client for server-side apply.
 */

import { K8s, kind } from 'pepr'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'yaml'

const CRD_DIR = join(import.meta.dir, '.')

export async function registerCRDs(): Promise<void> {
  const crdFiles = ['cosmo-router.yaml', 'cosmo-subgraph.yaml']

  for (const file of crdFiles) {
    const content = readFileSync(join(CRD_DIR, file), 'utf-8')
    const crd = parse(content)

    try {
      await K8s(kind.CustomResourceDefinition).Apply(crd, { force: true })
      console.log(`[cosmo-operator] Registered CRD: ${crd.metadata.name}`)
    } catch (error) {
      console.error(`[cosmo-operator] Failed to register CRD ${file}:`, error)
      throw error
    }
  }
}
