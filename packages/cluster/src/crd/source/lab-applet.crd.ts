/**
 * LabApplet CRD Definition
 * Pattern: pepr-excellent-examples/pepr-operator
 *
 * TanStack Start specialization of LabWorkload.
 */

import {
  configSourceSchema,
  defineLabCrd,
  imageSpecSchema,
  objectRefSchema,
  persistenceSpecSchema,
  resourcesSpecSchema,
  serviceSpecSchema,
  statusSchema,
} from '../schema'

export const LabAppletCRD = defineLabCrd({
  plural: 'labapplets',
  singular: 'labapplet',
  kind: 'LabApplet',
  shortNames: ['la'],
  spec: {
    type: 'object',
    properties: {
      image: imageSpecSchema,
      imageRef: objectRefSchema,
      replicas: { type: 'integer', minimum: 1 },
      resources: resourcesSpecSchema,
      service: serviceSpecSchema,
      config: configSourceSchema,
      main: { type: 'string' },
      port: { type: 'integer' },
      routes: {
        type: 'array',
        items: { type: 'string' },
      },
      persistence: persistenceSpecSchema,
    },
  },
  status: statusSchema(['Pending', 'Running', 'Failed']),
})
