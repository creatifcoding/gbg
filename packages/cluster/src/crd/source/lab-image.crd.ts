/**
 * LabImage CRD Definition
 * Pattern: pepr-excellent-examples/pepr-operator
 */

import {
  defineLabCrd,
  imageSpecSchema,
  objectRefSchema,
  statusSchema,
} from '../schema'

export const LabImageCRD = defineLabCrd({
  plural: 'labimages',
  singular: 'labimage',
  kind: 'LabImage',
  shortNames: ['li'],
  spec: {
    type: 'object',
    required: ['image'],
    properties: {
      image: imageSpecSchema,
      digest: { type: 'string' },
      registryRef: objectRefSchema,
    },
  },
  status: statusSchema(['Pending', 'Ready', 'Failed']),
})
