/**
 * CosmoSubgraph CRD Definition
 * Pattern: pepr-excellent-examples/pepr-operator
 */

export const CosmoSubgraphCRD = {
  apiVersion: 'apiextensions.k8s.io/v1',
  kind: 'CustomResourceDefinition',
  metadata: {
    name: 'cosmosubgraphs.tmnl.gbg.dev',
  },
  spec: {
    group: 'tmnl.gbg.dev',
    versions: [
      {
        name: 'v1alpha1',
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
              spec: {
                type: 'object',
                required: ['name', 'routingUrl', 'schema'],
                properties: {
                  name: { type: 'string' },
                  routingUrl: { type: 'string' },
                  subscriptionUrl: { type: 'string' },
                  schema: {
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
                      introspection: {
                        type: 'object',
                        properties: {
                          url: { type: 'string' },
                          interval: { type: 'string' },
                        },
                        required: ['url'],
                      },
                    },
                  },
                  connect: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      protocol: { type: 'string', enum: ['grpc', 'grpc-web', 'connect'] },
                    },
                  },
                  federation: {
                    type: 'object',
                    properties: {
                      version: { type: 'string', enum: ['1', '2'] },
                    },
                  },
                  healthCheck: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      path: { type: 'string' },
                      interval: { type: 'string' },
                    },
                  },
                  routerSelector: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                  },
                },
              },
              status: {
                type: 'object',
                properties: {
                  phase: { type: 'string', enum: ['Pending', 'Validating', 'Ready', 'Failed', 'Unhealthy'] },
                  observedGeneration: { type: 'integer' },
                  schemaHash: { type: 'string' },
                  connectedRouters: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  conditions: {
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
                  },
                },
              },
            },
          },
        },
      },
    ],
    scope: 'Namespaced',
    names: {
      plural: 'cosmosubgraphs',
      singular: 'cosmosubgraph',
      kind: 'CosmoSubgraph',
      shortNames: ['csg'],
    },
  },
}
