export const procurementNamespace = {
  apiVersion: 'v1',
  kind: 'Namespace',
  metadata: { name: 'procurement' },
} as const

export const procurementApplet = {
  apiVersion: 'tmnl.gbg.dev/v1alpha1',
  kind: 'LabApplet',
  metadata: { name: 'procurement', namespace: 'procurement' },
  spec: {},
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
