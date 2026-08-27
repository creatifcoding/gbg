/**
 * CRD Type Tests
 *
 * Validates TypeScript types match expected CRD structures.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LabAppletCRD } from './source/lab-applet.crd'
import { LabImageCRD } from './source/lab-image.crd'
import { LabRegistryCRD } from './source/lab-registry.crd'
import { LabWorkloadCRD } from './source/lab-workload.crd'
import type {
  LabApplet,
  LabAppletSpec,
  LabImage,
  LabImageSpec,
  LabRegistry,
  LabRegistrySpec,
  LabWorkload,
  LabWorkloadSpec,
} from './types'
import {
  LAB_APPLET_KIND,
  LAB_GROUP,
  LAB_IMAGE_KIND,
  LAB_REGISTRY_DEFAULT_IMAGE,
  LAB_REGISTRY_KIND,
  LAB_VERSION,
  LAB_WORKLOAD_KIND,
} from './types'

const typesSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'types.ts'), 'utf8')

const crds = [
  { crd: LabImageCRD, kind: LAB_IMAGE_KIND, plural: 'labimages' },
  { crd: LabRegistryCRD, kind: LAB_REGISTRY_KIND, plural: 'labregistries' },
  { crd: LabWorkloadCRD, kind: LAB_WORKLOAD_KIND, plural: 'labworkloads' },
  { crd: LabAppletCRD, kind: LAB_APPLET_KIND, plural: 'labapplets' },
] as const

describe('RegisterKind and CRD names', () => {
  it('registers each kind on tmnl.gbg.dev/v1alpha1', () => {
    expect(typesSrc).toContain('group: LAB_GROUP')
    expect(typesSrc).toContain('version: LAB_VERSION')
    expect(typesSrc).toContain('kind: LAB_IMAGE_KIND')
    expect(typesSrc).toContain('kind: LAB_REGISTRY_KIND')
    expect(typesSrc).toContain('kind: LAB_WORKLOAD_KIND')
    expect(typesSrc).toContain('kind: LAB_APPLET_KIND')
    expect(LAB_GROUP).toBe('tmnl.gbg.dev')
    expect(LAB_VERSION).toBe('v1alpha1')
  })

  it('keeps CRD metadata.names aligned with RegisterKind', () => {
    for (const { crd, kind, plural } of crds) {
      expect(crd.metadata.name).toBe(`${plural}.${LAB_GROUP}`)
      expect(crd.spec.group).toBe(LAB_GROUP)
      expect(crd.spec.versions[0]?.name).toBe(LAB_VERSION)
      expect(crd.spec.names.kind).toBe(kind)
      expect(crd.spec.names.plural).toBe(plural)
      expect(crd.spec.scope).toBe('Namespaced')
      expect(crd.spec.versions[0]?.subresources).toEqual({ status: {} })
    }
  })

  it('does not introduce a second API group', () => {
    expect(typesSrc).not.toContain('lab.gbg.dev')
    expect(LabImageCRD.spec.group).toBe('tmnl.gbg.dev')
  })
})

describe('LabImage Types', () => {
  it('accepts a minimal spec', () => {
    const spec: LabImageSpec = {
      image: { repository: 'ghcr.io/example/app' },
    }
    expect(spec.image.repository).toBe('ghcr.io/example/app')
  })

  it('accepts a full resource', () => {
    const image: LabImage = {
      apiVersion: 'tmnl.gbg.dev/v1alpha1',
      kind: 'LabImage',
      metadata: { name: 'start-app', namespace: 'procurement' },
      spec: {
        image: { repository: 'ghcr.io/example/app', tag: 'dev', pullPolicy: 'IfNotPresent' },
        digest: 'sha256:abc',
        registryRef: { name: 'lab-registry', namespace: 'procurement' },
      },
      status: { phase: 'Ready', observedGeneration: 1 },
    }
    expect(image.spec.registryRef?.name).toBe('lab-registry')
    expect(image.status?.phase).toBe('Ready')
  })
})

describe('LabRegistry Types', () => {
  it('accepts an empty spec and documents the Zot default', () => {
    const spec: LabRegistrySpec = {}
    expect(spec.image).toBeUndefined()
    expect(LAB_REGISTRY_DEFAULT_IMAGE).toBe('ghcr.io/project-zot/zot-linux-amd64')
    expect(JSON.stringify(LabRegistryCRD)).toContain(LAB_REGISTRY_DEFAULT_IMAGE)
    expect(JSON.stringify(LabRegistryCRD)).not.toMatch(/dkr\.ecr|gcr\.io|azurecr\.io/i)
  })

  it('accepts a full resource', () => {
    const registry: LabRegistry = {
      apiVersion: 'tmnl.gbg.dev/v1alpha1',
      kind: 'LabRegistry',
      metadata: { name: 'lab-registry', namespace: 'procurement' },
      spec: {
        image: { repository: LAB_REGISTRY_DEFAULT_IMAGE, pullPolicy: 'IfNotPresent' },
        replicas: 1,
        service: { type: 'ClusterIP', port: 5000 },
        persistence: { size: '10Gi' },
      },
      status: { phase: 'Running', endpoint: 'lab-registry.procurement.svc:5000' },
    }
    expect(registry.status?.endpoint).toContain('5000')
  })
})

describe('LabWorkload Types', () => {
  it('accepts imageRef without inline image', () => {
    const spec: LabWorkloadSpec = {
      imageRef: { name: 'start-app' },
      replicas: 1,
    }
    expect(spec.imageRef?.name).toBe('start-app')
  })

  it('accepts a full resource', () => {
    const workload: LabWorkload = {
      apiVersion: 'tmnl.gbg.dev/v1alpha1',
      kind: 'LabWorkload',
      metadata: { name: 'worker', namespace: 'procurement' },
      spec: {
        image: { repository: 'ghcr.io/example/worker', tag: 'dev' },
        replicas: 2,
        resources: { requests: { cpu: '100m', memory: '128Mi' } },
        service: { type: 'ClusterIP', port: 8080 },
        config: { configMapRef: { name: 'worker-config', key: 'app.json' } },
      },
      status: { phase: 'Running', observedGeneration: 1 },
    }
    expect(workload.spec.replicas).toBe(2)
  })
})

describe('LabApplet Types', () => {
  it('accepts Start-app fields on top of LabWorkload', () => {
    const spec: LabAppletSpec = {
      imageRef: { name: 'start-app' },
      main: 'src/server.ts',
      port: 3000,
      routes: ['/register', '/buy', '/receive', '/need', '/vendors'],
      persistence: { size: '1Gi', mountPath: '/data/pglite' },
    }
    expect(spec.main).toBe('src/server.ts')
    expect(spec.routes?.length).toBe(5)
    expect(spec.persistence?.mountPath).toBe('/data/pglite')
  })

  it('accepts a full resource', () => {
    const applet: LabApplet = {
      apiVersion: 'tmnl.gbg.dev/v1alpha1',
      kind: 'LabApplet',
      metadata: { name: 'start', namespace: 'procurement' },
      spec: {
        image: { repository: 'ghcr.io/example/start', pullPolicy: 'Never' },
        main: 'src/server.ts',
        port: 3000,
        routes: ['/'],
      },
      status: { phase: 'Pending' },
    }
    expect(applet.kind).toBe('LabApplet')
  })
})

describe('Type Constraints', () => {
  it('image pullPolicy is restricted', () => {
    const validPolicies: Array<LabWorkloadSpec['image']> = [
      { pullPolicy: 'Always' },
      { pullPolicy: 'IfNotPresent' },
      { pullPolicy: 'Never' },
    ]
    expect(validPolicies.length).toBe(3)
  })

  it('service type is restricted', () => {
    const validTypes: Array<LabWorkloadSpec['service']> = [
      { type: 'ClusterIP' },
      { type: 'NodePort' },
      { type: 'LoadBalancer' },
    ]
    expect(validTypes.length).toBe(3)
  })

  it('image status phase is restricted', () => {
    const validPhases: Array<LabImage['status']> = [
      { phase: 'Pending' },
      { phase: 'Ready' },
      { phase: 'Failed' },
    ]
    expect(validPhases.length).toBe(3)
  })

  it('registry status phase is restricted', () => {
    const validPhases: Array<LabRegistry['status']> = [
      { phase: 'Pending' },
      { phase: 'Running' },
      { phase: 'Failed' },
    ]
    expect(validPhases.length).toBe(3)
  })
})
