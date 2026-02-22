import type { TopologyLink, TopologyNode } from '../viz/D3TopologyGraph'

export const DEMO_NODES: TopologyNode[] = [
  { id: 'sensor-1', label: 'Sensor 1', kind: 'inlet', status: 'active', throughput: 100 },
  { id: 'sensor-2', label: 'Sensor 2', kind: 'inlet', status: 'active', throughput: 75 },
  { id: 'hub', label: 'Hub', kind: 'channel', status: 'active' },
  { id: 'validate', label: 'Validate', kind: 'junction', status: 'active' },
  { id: 'transform', label: 'Transform', kind: 'junction', status: 'active' },
  { id: 'output-1', label: 'DB Writer', kind: 'outlet', status: 'active', throughput: 150 },
  { id: 'output-2', label: 'Stream', kind: 'outlet', status: 'active', throughput: 25 },
]

export const DEMO_LINKS: TopologyLink[] = [
  { source: 'sensor-1', target: 'hub', throughput: 100 },
  { source: 'sensor-2', target: 'hub', throughput: 75 },
  { source: 'hub', target: 'validate', throughput: 175 },
  { source: 'validate', target: 'transform', throughput: 170 },
  { source: 'transform', target: 'output-1', throughput: 150 },
  { source: 'transform', target: 'output-2', throughput: 25 },
]
