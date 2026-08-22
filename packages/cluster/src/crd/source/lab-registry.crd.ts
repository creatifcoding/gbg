/**
 * LabRegistry CRD Definition
 * Pattern: pepr-excellent-examples/pepr-operator
 *
 * In-cluster OCI only. Default image is Zot (ghcr.io/project-zot/zot-linux-amd64).
 * Never ECR, GCR, or ACR.
 */

import {
  defineLabCrd,
  imageSpecSchema,
  LAB_REGISTRY_DEFAULT_IMAGE,
  LAB_REGISTRY_DEFAULT_PORT,
  resourcesSpecSchema,
  serviceSpecSchema,
  statusSchema,
} from '../schema'

export const LabRegistryCRD = defineLabCrd({
  plural: 'labregistries',
  singular: 'labregistry',
  kind: 'LabRegistry',
  shortNames: ['lreg'],
  spec: {
    type: 'object',
    properties: {
      image: {
        ...imageSpecSchema,
        properties: {
          ...imageSpecSchema.properties,
          repository: {
            type: 'string',
            default: LAB_REGISTRY_DEFAULT_IMAGE,
          },
        },
      },
      replicas: { type: 'integer', minimum: 1, default: 1 },
      resources: resourcesSpecSchema,
      service: {
        ...serviceSpecSchema,
        properties: {
          ...serviceSpecSchema.properties,
          type: {
            type: 'string',
            enum: ['ClusterIP', 'NodePort', 'LoadBalancer'],
            default: 'ClusterIP',
          },
          port: { type: 'integer', default: LAB_REGISTRY_DEFAULT_PORT },
        },
      },
      persistence: {
        type: 'object',
        properties: {
          size: { type: 'string' },
          storageClassName: { type: 'string' },
        },
      },
    },
  },
  status: statusSchema(['Pending', 'Running', 'Failed'], {
    endpoint: { type: 'string' },
  }),
})
