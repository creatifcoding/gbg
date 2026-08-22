export const procurementNamespace = {
  apiVersion: 'v1',
  kind: 'Namespace',
  metadata: { name: 'procurement' },
} as const

export const mantisClusterManifests = [
  {
    id: 'ProcurementNamespace',
    manifest: procurementNamespace,
  },
] as const
