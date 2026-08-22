/**
 * Generated TypeScript types for lab CRDs
 *
 * Pattern derived from pepr-excellent-examples/pepr-operator
 */

import { a, RegisterKind } from 'pepr'
import { LAB_GROUP, LAB_VERSION } from './schema'

export { LAB_GROUP, LAB_VERSION, LAB_REGISTRY_DEFAULT_IMAGE, LAB_REGISTRY_DEFAULT_PORT } from './schema'

export const LAB_IMAGE_KIND = 'LabImage'
export const LAB_REGISTRY_KIND = 'LabRegistry'
export const LAB_WORKLOAD_KIND = 'LabWorkload'
export const LAB_APPLET_KIND = 'LabApplet'

export interface ImageSpec {
  repository?: string
  tag?: string
  pullPolicy?: 'Always' | 'IfNotPresent' | 'Never'
}

export interface ResourcesSpec {
  requests?: { cpu?: string; memory?: string }
  limits?: { cpu?: string; memory?: string }
}

export interface ServiceSpec {
  type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer'
  port?: number
}

export interface ConfigSource {
  configMapRef?: {
    name: string
    key?: string
  }
  inline?: string
}

export interface ObjectRef {
  name: string
  namespace?: string
}

export interface Condition {
  type: string
  status: string
  reason?: string
  message?: string
}

export interface PersistenceSpec {
  size?: string
  storageClassName?: string
}

// =============================================================================
// LAB IMAGE
// =============================================================================

export class LabImage extends a.GenericKind {
  spec!: LabImageSpec
  status?: LabImageStatus
}

export interface LabImageSpec {
  image: ImageSpec
  digest?: string
  registryRef?: ObjectRef
}

export interface LabImageStatus {
  phase?: 'Pending' | 'Ready' | 'Failed'
  observedGeneration?: number
  conditions?: Condition[]
}

RegisterKind(LabImage, {
  group: LAB_GROUP,
  version: LAB_VERSION,
  kind: LAB_IMAGE_KIND,
})

// =============================================================================
// LAB REGISTRY
// =============================================================================

export class LabRegistry extends a.GenericKind {
  spec!: LabRegistrySpec
  status?: LabRegistryStatus
}

export interface LabRegistrySpec {
  image?: ImageSpec
  replicas?: number
  resources?: ResourcesSpec
  service?: ServiceSpec
  persistence?: PersistenceSpec
}

export interface LabRegistryStatus {
  phase?: 'Pending' | 'Running' | 'Failed'
  observedGeneration?: number
  conditions?: Condition[]
  endpoint?: string
}

RegisterKind(LabRegistry, {
  group: LAB_GROUP,
  version: LAB_VERSION,
  kind: LAB_REGISTRY_KIND,
})

// =============================================================================
// LAB WORKLOAD
// =============================================================================

export class LabWorkload extends a.GenericKind {
  spec!: LabWorkloadSpec
  status?: LabWorkloadStatus
}

export interface LabWorkloadSpec {
  image?: ImageSpec
  imageRef?: ObjectRef
  replicas?: number
  resources?: ResourcesSpec
  service?: ServiceSpec
  config?: ConfigSource
}

export interface LabWorkloadStatus {
  phase?: 'Pending' | 'Running' | 'Failed'
  observedGeneration?: number
  conditions?: Condition[]
}

RegisterKind(LabWorkload, {
  group: LAB_GROUP,
  version: LAB_VERSION,
  kind: LAB_WORKLOAD_KIND,
})

// =============================================================================
// LAB APPLET
// =============================================================================

export class LabApplet extends a.GenericKind {
  spec!: LabAppletSpec
  status?: LabAppletStatus
}

export interface LabAppletSpec extends LabWorkloadSpec {
  main?: string
  port?: number
  routes?: string[]
}

export type LabAppletStatus = LabWorkloadStatus

RegisterKind(LabApplet, {
  group: LAB_GROUP,
  version: LAB_VERSION,
  kind: LAB_APPLET_KIND,
})
