/**
 * LabWorkload CRD Definition
 * Pattern: pepr-excellent-examples/pepr-operator
 */

import {
  configSourceSchema,
  defineLabCrd,
  imageSpecSchema,
  objectRefSchema,
  resourcesSpecSchema,
  serviceSpecSchema,
  statusSchema,
} from '../schema'

export const LabWorkloadCRD = defineLabCrd({
  plural: 'labworkloads',
  singular: 'labworkload',
  kind: 'LabWorkload',
  shortNames: ['lw'],
  spec: {
    type: 'object',
    properties: {
      image: imageSpecSchema,
      imageRef: objectRefSchema,
      replicas: { type: 'integer', minimum: 1 },
      resources: resourcesSpecSchema,
      service: serviceSpecSchema,
      config: configSourceSchema,
    },
  },
  status: statusSchema(['Pending', 'Running', 'Failed']),
})
