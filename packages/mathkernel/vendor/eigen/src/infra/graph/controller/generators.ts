/**
 * K8s Resource Generators
 * Pattern: pepr-excellent-examples/pepr-operator
 */

import { kind, K8s, Log, sdk } from 'pepr'
import { CosmoRouter } from '../crd/types'

const { getOwnerRefFrom } = sdk

export default async function Deploy(instance: CosmoRouter) {
  try {
    await Promise.all([
      K8s(kind.Deployment).Apply(deployment(instance), { force: true }),
      K8s(kind.Service).Apply(service(instance), { force: true }),
    ])
  } catch (error) {
    Log.error(error, 'Failed to apply Kubernetes manifests')
  }
}

function deployment(router: CosmoRouter) {
  const { name, namespace } = router.metadata!
  const spec = router.spec

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      ownerReferences: getOwnerRefFrom(router),
      name: `${name}-router`,
      namespace,
      labels: {
        'app.kubernetes.io/name': `${name}-router`,
        'app.kubernetes.io/instance': name,
        'app.kubernetes.io/component': 'router',
        'app.kubernetes.io/managed-by': 'cosmo-operator',
      },
    },
    spec: {
      replicas: spec.replicas ?? 1,
      selector: {
        matchLabels: {
          'app.kubernetes.io/name': `${name}-router`,
          'app.kubernetes.io/instance': name,
        },
      },
      template: {
        metadata: {
          ownerReferences: getOwnerRefFrom(router),
          labels: {
            'app.kubernetes.io/name': `${name}-router`,
            'app.kubernetes.io/instance': name,
          },
        },
        spec: {
          containers: [
            {
              name: 'router',
              image: `${spec.image?.repository ?? 'ghcr.io/wundergraph/cosmo/router'}:${spec.image?.tag ?? 'latest'}`,
              imagePullPolicy: spec.image?.pullPolicy ?? 'IfNotPresent',
              ports: [{ containerPort: 3002, name: 'http' }],
              env: [
                { name: 'DEV_MODE', value: String(spec.config?.devMode ?? false) },
                { name: 'LISTEN_ADDR', value: spec.config?.listenAddr ?? '0.0.0.0:3002' },
                { name: 'GRAPHQL_PATH', value: spec.config?.graphqlPath ?? '/graphql' },
                { name: 'PLAYGROUND_ENABLED', value: String(spec.config?.playgroundEnabled ?? true) },
                { name: 'INTROSPECTION_ENABLED', value: String(spec.config?.introspectionEnabled ?? true) },
                { name: 'EXECUTION_CONFIG_FILE', value: '/config/router.json' },
              ],
              resources: spec.resources ?? {
                requests: { cpu: '100m', memory: '128Mi' },
                limits: { cpu: '500m', memory: '512Mi' },
              },
              volumeMounts: [
                {
                  name: 'execution-config',
                  mountPath: '/config',
                  readOnly: true,
                },
              ],
              livenessProbe: {
                httpGet: { path: '/health/live', port: 3002 },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: { path: '/health/ready', port: 3002 },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
            },
          ],
          volumes: [
            {
              name: 'execution-config',
              configMap: {
                name: spec.executionConfig.configMapRef?.name ?? `${name}-config`,
              },
            },
          ],
        },
      },
    },
  }
}

function service(router: CosmoRouter) {
  const { name, namespace } = router.metadata!
  const spec = router.spec

  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      ownerReferences: getOwnerRefFrom(router),
      name: `${name}-router`,
      namespace,
      labels: {
        'app.kubernetes.io/name': `${name}-router`,
        'app.kubernetes.io/instance': name,
        'app.kubernetes.io/component': 'router',
        'app.kubernetes.io/managed-by': 'cosmo-operator',
      },
    },
    spec: {
      type: spec.service?.type ?? 'ClusterIP',
      ports: [
        {
          port: spec.service?.port ?? 3002,
          targetPort: 3002,
          protocol: 'TCP',
          name: 'http',
        },
      ],
      selector: {
        'app.kubernetes.io/name': `${name}-router`,
        'app.kubernetes.io/instance': name,
      },
    },
  }
}

// Named exports for testing
export { deployment as generateDeployment, service as generateService }
