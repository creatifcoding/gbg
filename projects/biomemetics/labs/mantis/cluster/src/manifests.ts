export const procurementNamespace = {
  apiVersion: 'v1',
  kind: 'Namespace',
  metadata: { name: 'procurement' },
} as const

export const PROCUREMENT_APPLET_ROUTES = [
  '/register',
  '/buy',
  '/receive',
  '/need',
  '/vendors',
] as const

export const PROCUREMENT_PGLITE_MOUNT = '/data/pglite'

export const procurementApplet = {
  apiVersion: 'tmnl.gbg.dev/v1alpha1',
  kind: 'LabApplet',
  metadata: { name: 'procurement', namespace: 'procurement' },
  spec: {
    routes: PROCUREMENT_APPLET_ROUTES,
    persistence: {
      size: '1Gi',
      mountPath: PROCUREMENT_PGLITE_MOUNT,
    },
  },
} as const

export const mantisClusterManifests = [
  {
    id: 'ProcurementNamespace',
    manifest: procurementNamespace,
  },
  {
    id: 'ProcurementApplet',
    manifest: procurementApplet,
  },
] as const
