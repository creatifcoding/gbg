/**
 * Shared OpenAPI v3 fragments for lab CRDs.
 * Pattern: pepr-excellent-examples/pepr-operator
 */

export const LAB_GROUP = 'tmnl.gbg.dev'
export const LAB_VERSION = 'v1alpha1'

export const LAB_REGISTRY_DEFAULT_IMAGE = 'ghcr.io/project-zot/zot-linux-amd64'
export const LAB_REGISTRY_DEFAULT_PORT = 5000

export const imageSpecSchema = {
  type: 'object',
  properties: {
    repository: { type: 'string' },
    tag: { type: 'string' },
    pullPolicy: { type: 'string', enum: ['Always', 'IfNotPresent', 'Never'] },
  },
}

export const resourcesSpecSchema = {
  type: 'object',
  properties: {
    requests: {
      type: 'object',
      properties: {
        cpu: { type: 'string' },
        memory: { type: 'string' },
      },
    },
    limits: {
      type: 'object',
      properties: {
        cpu: { type: 'string' },
        memory: { type: 'string' },
      },
    },
  },
}

export const serviceSpecSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['ClusterIP', 'NodePort', 'LoadBalancer'] },
    port: { type: 'integer' },
  },
}

export const configSourceSchema = {
  type: 'object',
  properties: {
    configMapRef: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        key: { type: 'string' },
      },
      required: ['name'],
    },
    inline: { type: 'string' },
  },
}

export const objectRefSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    namespace: { type: 'string' },
  },
  required: ['name'],
}

export const conditionsSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      status: { type: 'string' },
      reason: { type: 'string' },
      message: { type: 'string' },
    },
  },
}

export function statusSchema(phases: readonly string[], extra: Record<string, unknown> = {}) {
  return {
    type: 'object',
    properties: {
      phase: { type: 'string', enum: [...phases] },
      observedGeneration: { type: 'integer' },
      conditions: conditionsSchema,
      ...extra,
    },
  }
}

export function defineLabCrd({
  plural,
  singular,
  kind,
  shortNames,
  spec,
  status,
}: {
  plural: string
  singular: string
  kind: string
  shortNames: readonly string[]
  spec: Record<string, unknown>
  status: Record<string, unknown>
}) {
  return {
    apiVersion: 'apiextensions.k8s.io/v1',
    kind: 'CustomResourceDefinition',
    metadata: {
      name: `${plural}.${LAB_GROUP}`,
    },
    spec: {
      group: LAB_GROUP,
      versions: [
        {
          name: LAB_VERSION,
          served: true,
          storage: true,
          subresources: {
            status: {},
          },
          schema: {
            openAPIV3Schema: {
              type: 'object',
              properties: {
                apiVersion: { type: 'string' },
                kind: { type: 'string' },
                metadata: { type: 'object' },
                spec,
                status,
              },
            },
          },
        },
      ],
      scope: 'Namespaced',
      names: {
        plural,
        singular,
        kind,
        shortNames: [...shortNames],
      },
    },
  }
}
