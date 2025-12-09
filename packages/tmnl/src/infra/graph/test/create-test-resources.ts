/**
 * Creates test CosmoRouter and CosmoSubgraph instances
 * Run with: bunx tsx test/create-test-resources.ts
 */

import { K8s, Log } from 'pepr'
import { CosmoRouter, CosmoSubgraph } from '../crd/types'

const testRouter: InstanceType<typeof CosmoRouter> = {
  apiVersion: 'tmnl.gbg.dev/v1alpha1',
  kind: 'CosmoRouter',
  metadata: {
    name: 'demo-router',
    namespace: 'default',
  },
  spec: {
    executionConfig: {
      inline: JSON.stringify({
        version: '1',
        subgraphs: [
          {
            name: 'sensors',
            routing_url: 'http://sensor-service:4011/graphql',
          },
        ],
      }),
    },
    config: {
      listenAddr: ':4000',
      playgroundEnabled: true,
      introspectionEnabled: true,
    },
    image: {
      repository: 'ghcr.io/wundergraph/cosmo/router',
      tag: 'latest',
      pullPolicy: 'IfNotPresent',
    },
    replicas: 1,
  },
}

const testSubgraph: InstanceType<typeof CosmoSubgraph> = {
  apiVersion: 'tmnl.gbg.dev/v1alpha1',
  kind: 'CosmoSubgraph',
  metadata: {
    name: 'demo-sensors',
    namespace: 'default',
  },
  spec: {
    name: 'sensors',
    routingUrl: 'http://sensor-service:4011/graphql',
    schema: {
      inline: `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

        type Query {
          sensors: [Sensor!]!
        }

        type Sensor @key(fields: "id") {
          id: ID!
          name: String!
        }
      `,
    },
    federation: { version: '2' },
  },
}

/**
 * Test subgraph using introspection URL
 * This demonstrates the E2E flow: live endpoint → introspect → extract SDL
 *
 * Requires spike-5-server running:
 *   bunx tsx src/lib/schema-system/spikes/spike-5-server.ts 4011
 */
const testSubgraphIntrospection: InstanceType<typeof CosmoSubgraph> = {
  apiVersion: 'tmnl.gbg.dev/v1alpha1',
  kind: 'CosmoSubgraph',
  metadata: {
    name: 'demo-sensors-introspected',
    namespace: 'default',
  },
  spec: {
    name: 'sensors-introspected',
    routingUrl: 'http://localhost:4011/graphql',
    schema: {
      introspection: {
        url: 'http://localhost:4011/graphql',
        interval: '30s',
      },
    },
    federation: { version: '2' },
  },
}

async function main() {
  const action = process.argv[2] || 'create'
  const withIntrospection = process.argv.includes('--introspection')

  if (action === 'create') {
    Log.info('Creating test CosmoRouter...')
    await K8s(CosmoRouter).Apply(testRouter, { force: true })
    Log.info('Created: demo-router')

    Log.info('Creating test CosmoSubgraph (inline SDL)...')
    await K8s(CosmoSubgraph).Apply(testSubgraph, { force: true })
    Log.info('Created: demo-sensors')

    if (withIntrospection) {
      Log.info('Creating test CosmoSubgraph (introspection URL)...')
      Log.info('  Requires spike-5-server running at localhost:4011')
      await K8s(CosmoSubgraph).Apply(testSubgraphIntrospection, { force: true })
      Log.info('Created: demo-sensors-introspected')
    }

    Log.info('Done. Check with: kubectl get cosmorouters,cosmosubgraphs')
  } else if (action === 'delete') {
    Log.info('Deleting test resources...')
    await K8s(CosmoRouter).InNamespace('default').Delete('demo-router').catch(() => {})
    await K8s(CosmoSubgraph).InNamespace('default').Delete('demo-sensors').catch(() => {})
    await K8s(CosmoSubgraph).InNamespace('default').Delete('demo-sensors-introspected').catch(() => {})
    Log.info('Deleted.')
  } else {
    console.log('Usage: bunx tsx test/create-test-resources.ts [create|delete] [--introspection]')
  }
}

main().catch((err) => {
  Log.error(err)
  process.exit(1)
})
