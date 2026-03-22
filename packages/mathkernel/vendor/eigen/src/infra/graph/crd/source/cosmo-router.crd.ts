/**
 * CosmoRouter CRD Definition
 * Pattern: pepr-excellent-examples/pepr-operator
 */

export const CosmoRouterCRD = {
  apiVersion: 'apiextensions.k8s.io/v1',
  kind: 'CustomResourceDefinition',
  metadata: {
    name: 'cosmorouters.tmnl.gbg.dev',
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
                required: ['executionConfig'],
                properties: {
                  executionConfig: {
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
                  },
                  config: {
                    type: 'object',
                    properties: {
                      devMode: { type: 'boolean' },
                      listenAddr: { type: 'string' },
                      graphqlPath: { type: 'string' },
                      playgroundEnabled: { type: 'boolean' },
                      introspectionEnabled: { type: 'boolean' },
                    },
                  },
                  replicas: { type: 'integer', minimum: 1 },
                  image: {
                    type: 'object',
                    properties: {
                      repository: { type: 'string' },
                      tag: { type: 'string' },
                      pullPolicy: { type: 'string', enum: ['Always', 'IfNotPresent', 'Never'] },
                    },
                  },
                  resources: {
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
                  },
                  service: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['ClusterIP', 'NodePort', 'LoadBalancer'] },
                      port: { type: 'integer' },
                    },
                  },
                  subgraphs: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        name: { type: 'string' },
                        ref: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            namespace: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
              status: {
                type: 'object',
                properties: {
                  phase: { type: 'string', enum: ['Pending', 'Composing', 'Running', 'Failed'] },
                  observedGeneration: { type: 'integer' },
                  subgraphCount: { type: 'integer' },
                  compositionHash: { type: 'string' },
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
      plural: 'cosmorouters',
      singular: 'cosmorouter',
      kind: 'CosmoRouter',
      shortNames: ['cr'],
    },
  },
}
