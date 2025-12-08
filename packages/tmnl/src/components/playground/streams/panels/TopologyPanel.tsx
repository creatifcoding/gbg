/**
 * Topology Panel
 *
 * Stream topology visualization with interactive graph.
 *
 * @module
 */

import { useState, useMemo } from 'react'
import { D3TopologyGraph, type TopologyNode, type TopologyLink } from '../viz/D3TopologyGraph'
import { PortNode, type PortKind, type PortStatus } from '../viz/PortNode'

// =============================================================================
// TYPES
// =============================================================================

interface TopologyPanelProps {
  /** Chart width */
  width?: number
  /** Chart height */
  height?: number
}

// =============================================================================
// DEMO DATA
// =============================================================================

const DEMO_NODES: TopologyNode[] = [
  { id: 'sensor-1', label: 'Sensor 1', kind: 'inlet', status: 'active', throughput: 100 },
  { id: 'sensor-2', label: 'Sensor 2', kind: 'inlet', status: 'active', throughput: 75 },
  { id: 'hub', label: 'Hub', kind: 'channel', status: 'active' },
  { id: 'validate', label: 'Validate', kind: 'junction', status: 'active' },
  { id: 'transform', label: 'Transform', kind: 'junction', status: 'active' },
  { id: 'output-1', label: 'DB Writer', kind: 'outlet', status: 'active', throughput: 150 },
  { id: 'output-2', label: 'Stream', kind: 'outlet', status: 'active', throughput: 25 },
]

const DEMO_LINKS: TopologyLink[] = [
  { source: 'sensor-1', target: 'hub', throughput: 100 },
  { source: 'sensor-2', target: 'hub', throughput: 75 },
  { source: 'hub', target: 'validate', throughput: 175 },
  { source: 'validate', target: 'transform', throughput: 170 },
  { source: 'transform', target: 'output-1', throughput: 150 },
  { source: 'transform', target: 'output-2', throughput: 25 },
]

// =============================================================================
// TOPOLOGY PANEL
// =============================================================================

/**
 * Interactive topology panel.
 *
 * Shows:
 * - Force-directed graph of stream topology
 * - Selected node details
 * - Port-level information
 */
export function TopologyPanel({ width = 600, height = 350 }: TopologyPanelProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null
    return DEMO_NODES.find((n) => n.id === selectedNode)
  }, [selectedNode])

  return (
    <div className="p-4 bg-neutral-900/30 rounded-lg border border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="font-mono uppercase tracking-wider text-neutral-300"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          Stream Topology
        </h3>
        <div className="flex items-center gap-4">
          <LegendItem kind="inlet" label="Inlet" />
          <LegendItem kind="outlet" label="Outlet" />
          <LegendItem kind="junction" label="Junction" />
          <LegendItem kind="channel" label="Channel" />
        </div>
      </div>

      {/* Graph */}
      <D3TopologyGraph
        nodes={DEMO_NODES}
        links={DEMO_LINKS}
        width={width}
        height={height}
        selectedNode={selectedNode}
        onNodeSelect={setSelectedNode}
      />

      {/* Selected node details */}
      {selectedNodeData && (
        <div className="mt-4 p-3 bg-neutral-800/50 rounded border border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <span
                className="font-mono text-neutral-400 uppercase tracking-wider"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {selectedNodeData.kind}
              </span>
              <h4
                className="font-mono text-neutral-100"
                style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
              >
                {selectedNodeData.label}
              </h4>
            </div>
            <div className="text-right">
              {selectedNodeData.throughput !== undefined && (
                <div
                  className="font-mono text-cyan-400"
                  style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                >
                  {selectedNodeData.throughput}/s
                </div>
              )}
              <div
                className={`font-mono uppercase ${
                  selectedNodeData.status === 'active'
                    ? 'text-green-400'
                    : selectedNodeData.status === 'error'
                      ? 'text-red-400'
                      : 'text-neutral-500'
                }`}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {selectedNodeData.status}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center justify-between mt-3 text-neutral-500 font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <span>{DEMO_NODES.length} nodes • {DEMO_LINKS.length} links</span>
        <span>Click node for details • Drag to reposition</span>
      </div>
    </div>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

interface LegendItemProps {
  kind: 'inlet' | 'outlet' | 'junction' | 'channel'
  label: string
}

function LegendItem({ kind, label }: LegendItemProps) {
  const colors: Record<string, string> = {
    inlet: 'bg-cyan-500',
    outlet: 'bg-emerald-500',
    junction: 'bg-amber-500',
    channel: 'bg-neutral-500',
  }

  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${colors[kind]}`} />
      <span
        className="text-neutral-500"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {label}
      </span>
    </div>
  )
}

export default TopologyPanel
