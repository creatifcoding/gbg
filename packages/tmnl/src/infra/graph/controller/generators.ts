/**
 * K8s Resource Generators
 *
 * Produces Deployment, Service, ConfigMap manifests
 * with ownerReferences for cascading deletion.
 */

import { kind } from 'pepr'
import type { CosmoRouter, CosmoSubgraph } from '../crd'

type OwnerReference = {
  apiVersion: string
  kind: string
  name: string
  uid: string
  controller?: boolean
  blockOwnerDeletion?: boolean
}

function ownerRef(router: CosmoRouter): OwnerReference {
  return {
    apiVersion: 'tmnl.gbg.dev/v1alpha1',
    kind: 'CosmoRouter',
    name: router.metadata!.name!,
    uid: router.metadata!.uid!,
    controller: true,
    blockOwnerDeletion: true,
  }
}

export function generateDeployment(router: CosmoRouter): kind.Deployment {
  const name = `${router.metadata!.name}-router`
  const namespace = router.metadata!.namespace!
  const spec = router.spec

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      namespace,
      labels: {
        'app.kubernetes.io/name': name,
        'app.kubernetes.io/instance': router.metadata!.name!,
        'app.kubernetes.io/component': 'router',
        'app.kubernetes.io/managed-by': 'cosmo-operator',
      },
      ownerReferences: [ownerRef(router)],
    },
    spec: {
      replicas: spec.replicas ?? 1,
      selector: {
        matchLabels: {
          'app.kubernetes.io/name': name,
          'app.kubernetes.io/instance': router.metadata!.name!,
        },
      },
      template: {
        metadata: {
          labels: {
            'app.kubernetes.io/name': name,
            'app.kubernetes.io/instance': router.metadata!.name!,
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
                httpGet: { path: '/health/live', port: 'http' as any },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: { path: '/health/ready', port: 'http' as any },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
            },
          ],
          volumes: [
            {
              name: 'execution-config',
              configMap: {
                name: spec.executionConfig.configMapRef?.name ?? `${router.metadata!.name}-config`,
              },
            },
          ],
        },
      },
    },
  } as kind.Deployment
}

export function generateService(router: CosmoRouter): kind.Service {
  const name = `${router.metadata!.name}-router`
  const namespace = router.metadata!.namespace!
  const spec = router.spec

  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name,
      namespace,
      labels: {
        'app.kubernetes.io/name': name,
        'app.kubernetes.io/instance': router.metadata!.name!,
        'app.kubernetes.io/component': 'router',
        'app.kubernetes.io/managed-by': 'cosmo-operator',
      },
      ownerReferences: [ownerRef(router)],
    },
    spec: {
      type: spec.service?.type ?? 'ClusterIP',
      ports: [
        {
          port: spec.service?.port ?? 3002,
          targetPort: 'http' as any,
          protocol: 'TCP',
          name: 'http',
        },
      ],
      selector: {
        'app.kubernetes.io/name': name,
        'app.kubernetes.io/instance': router.metadata!.name!,
      },
    },
  } as kind.Service
}

export function generateConfigMap(
  router: CosmoRouter,
  routerJson: string
): kind.ConfigMap {
  const name = `${router.metadata!.name}-config`
  const namespace = router.metadata!.namespace!

  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name,
      namespace,
      labels: {
        'app.kubernetes.io/name': name,
        'app.kubernetes.io/instance': router.metadata!.name!,
        'app.kubernetes.io/component': 'config',
        'app.kubernetes.io/managed-by': 'cosmo-operator',
      },
      ownerReferences: [ownerRef(router)],
    },
    data: {
      'router.json': routerJson,
    },
  } as kind.ConfigMap
}
