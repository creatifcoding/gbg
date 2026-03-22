/**
 * AVA State Machine Inspector
 *
 * Visualizes the XState machine state from ava-stx.
 * Shows state nodes, current state, and transition history.
 *
 * @pattern stx tri-library composition
 * @module
 */

import { useEffect, useState, useCallback } from 'react'
import { Effect } from 'effect'

import { useStxData, useStxMatches, useStx } from '@/lib/stx'
import { getAvaStx } from '@/lib/ava/atoms/ava-stx'
import { getTestbedStx, type InspectorNode } from './testbed-stx'

// =============================================================================
// Types
// =============================================================================

interface TransitionEntry {
  id: string
  from: string
  to: string
  timestamp: number
  event?: string
}

// =============================================================================
// Component
// =============================================================================

export function StateInspector() {
  const ava = getAvaStx()
  const testbed = getTestbedStx()

  // Machine state matching
  const isDisconnected = useStxMatches(ava, 'disconnected')
  const isConnecting = useStxMatches(ava, 'connecting')
  const isConnected = useStxMatches(ava, 'connected')
  const isError = useStxMatches(ava, 'error')

  // Derive current state string
  const currentState = isConnected
    ? 'connected'
    : isConnecting
      ? 'connecting'
      : isError
        ? 'error'
        : 'disconnected'

  // Inspector nodes from testbed-stx
  const inspectorNodes = useStxData(testbed, d => d.inspectorNodes.get())
  const { runEffect } = useStx(testbed)

  // Local transition history for visualization
  const [transitions, setTransitions] = useState<TransitionEntry[]>([])
  const [previousState, setPreviousState] = useState<string | null>(null)

  // Track state transitions
  useEffect(() => {
    if (previousState && previousState !== currentState) {
      setTransitions(prev => [
        {
          id: `trans-${Date.now()}`,
          from: previousState,
          to: currentState,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 9), // Keep last 10 transitions
      ])
    }
    setPreviousState(currentState)
  }, [currentState, previousState])

  // Sync inspector nodes on state change
  useEffect(() => {
    runEffect('syncInspector').catch(() => {})
  }, [currentState, runEffect])

  // State node definitions
  const stateNodes = [
    { id: 'disconnected', label: 'Disconnected', x: 50, y: 100 },
    { id: 'connecting', label: 'Connecting', x: 200, y: 100 },
    { id: 'connected', label: 'Connected', x: 350, y: 100 },
    { id: 'error', label: 'Error', x: 200, y: 200 },
  ]

  // Edge definitions (transitions)
  const edges = [
    { from: 'disconnected', to: 'connecting', label: 'CONNECT' },
    { from: 'connecting', to: 'connected', label: 'WS_OPEN' },
    { from: 'connecting', to: 'error', label: 'WS_ERROR' },
    { from: 'connected', to: 'disconnected', label: 'DISCONNECT' },
    { from: 'connected', to: 'error', label: 'WS_ERROR' },
    { from: 'error', to: 'disconnected', label: 'RESET' },
  ]

  return (
    <div className="flex flex-col h-full bg-neutral-950 border border-neutral-800 rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900/50">
        <span
          className="font-mono text-neutral-400"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          STATE MACHINE
        </span>
        <span
          className="font-mono text-cyan-400"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {currentState.toUpperCase()}
        </span>
      </div>

      {/* State Diagram */}
      <div className="flex-1 p-3">
        <svg
          viewBox="0 0 450 280"
          className="w-full h-full"
          style={{ maxHeight: '180px' }}
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const fromNode = stateNodes.find(n => n.id === edge.from)
            const toNode = stateNodes.find(n => n.id === edge.to)
            if (!fromNode || !toNode) return null

            const isActive =
              (previousState === edge.from && currentState === edge.to)

            // Calculate edge path
            const dx = toNode.x - fromNode.x
            const dy = toNode.y - fromNode.y
            const midX = fromNode.x + dx / 2
            const midY = fromNode.y + dy / 2

            // Simple straight line for now
            return (
              <g key={`edge-${i}`}>
                <line
                  x1={fromNode.x + 50}
                  y1={fromNode.y}
                  x2={toNode.x - 50}
                  y2={toNode.y}
                  stroke={isActive ? '#22d3ee' : '#525252'}
                  strokeWidth={isActive ? 2 : 1}
                  markerEnd="url(#arrowhead)"
                  className={isActive ? 'animate-pulse' : ''}
                />
                <text
                  x={midX}
                  y={midY - 8}
                  textAnchor="middle"
                  fill={isActive ? '#22d3ee' : '#737373'}
                  style={{ fontSize: '9px', fontFamily: 'monospace' }}
                >
                  {edge.label}
                </text>
              </g>
            )
          })}

          {/* Arrowhead marker */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#525252"
              />
            </marker>
          </defs>

          {/* State Nodes */}
          {stateNodes.map(node => {
            const isCurrent = currentState === node.id
            const wasRecent = transitions.some(
              t => t.to === node.id && Date.now() - t.timestamp < 2000
            )

            return (
              <g key={node.id} transform={`translate(${node.x - 45}, ${node.y - 20})`}>
                {/* Node background */}
                <rect
                  width={90}
                  height={40}
                  rx={6}
                  fill={isCurrent ? '#0a0a0a' : '#171717'}
                  stroke={isCurrent ? '#22d3ee' : '#525252'}
                  strokeWidth={isCurrent ? 2 : 1}
                  className={wasRecent && !isCurrent ? 'animate-pulse' : ''}
                />

                {/* Active indicator */}
                {isCurrent && (
                  <circle
                    cx={10}
                    cy={20}
                    r={4}
                    fill="#22d3ee"
                    className="animate-pulse"
                  />
                )}

                {/* Node label */}
                <text
                  x={45}
                  y={24}
                  textAnchor="middle"
                  fill={isCurrent ? '#22d3ee' : '#a3a3a3'}
                  style={{ fontSize: '11px', fontFamily: 'monospace' }}
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Transition History */}
      <div className="border-t border-neutral-800">
        <div className="px-3 py-1 bg-neutral-900/30">
          <span
            className="font-mono text-neutral-500"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            TRANSITIONS
          </span>
        </div>
        <div
          className="max-h-24 overflow-y-auto p-2 space-y-1"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {transitions.length === 0 ? (
            <div className="text-neutral-600 text-center py-2">
              No transitions yet
            </div>
          ) : (
            transitions.map(t => (
              <div
                key={t.id}
                className="flex items-center gap-2 font-mono text-neutral-400"
              >
                <span className="text-neutral-600">
                  {new Date(t.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-amber-500">{t.from}</span>
                <span className="text-neutral-600">→</span>
                <span className="text-cyan-400">{t.to}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
