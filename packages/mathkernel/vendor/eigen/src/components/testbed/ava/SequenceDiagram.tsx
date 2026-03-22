/**
 * AVA Sequence Diagram
 *
 * Visualizes the message flow between client and server.
 * UML-style sequence diagram with swimlanes.
 *
 * @pattern stx tri-library composition
 * @module
 */

import { useEffect, useRef } from 'react'

import { useStxData, useStx } from '@/lib/stx'
import { getAvaStx, type MessageLogEntry } from '@/lib/ava/atoms/ava-stx'
import { getTestbedStx, type SequenceEvent } from './testbed-stx'

// =============================================================================
// Constants
// =============================================================================

const LANE_WIDTH = 120
const LANE_GAP = 200
const EVENT_HEIGHT = 40
const HEADER_HEIGHT = 50
const PADDING = 20

// =============================================================================
// Component
// =============================================================================

export function SequenceDiagram() {
  const ava = getAvaStx()
  const testbed = getTestbedStx()
  const containerRef = useRef<HTMLDivElement>(null)

  // Message log from ava-stx
  const messageLog = useStxData(ava, d => d.messageLog.get())
  const sequenceEvents = useStxData(testbed, d => d.sequenceEvents.get())
  const autoScroll = useStxData(testbed, d => d.sequenceAutoScroll.get())
  const { runEffect } = useStx(testbed)

  // Convert message log entries to sequence events format
  const events: SequenceEvent[] = messageLog.map((entry: MessageLogEntry, idx: number) => ({
    id: entry.id,
    timestamp: entry.timestamp,
    source: entry.direction === 'out' ? 'client' as const : 'server' as const,
    target: entry.direction === 'out' ? 'server' as const : 'client' as const,
    type: entry.type,
    label: entry.type,
    duration: undefined,
  }))

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [events.length, autoScroll])

  // Calculate SVG dimensions
  const svgHeight = Math.max(300, HEADER_HEIGHT + events.length * EVENT_HEIGHT + PADDING * 2)
  const svgWidth = LANE_WIDTH * 2 + LANE_GAP + PADDING * 2

  // Lane centers
  const clientX = PADDING + LANE_WIDTH / 2
  const serverX = PADDING + LANE_WIDTH + LANE_GAP + LANE_WIDTH / 2

  // Color mapping for event types
  const getEventColor = (type: string): string => {
    const colors: Record<string, string> = {
      artifact: '#22c55e',    // green
      delta: '#22d3ee',       // cyan
      subscribe: '#3b82f6',   // blue
      unsubscribe: '#737373', // gray
      ping: '#f59e0b',        // amber
      pong: '#f59e0b',        // amber
      session: '#a855f7',     // purple
      error: '#ef4444',       // red
      status: '#eab308',      // yellow
    }
    return colors[type] ?? '#a3a3a3'
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950 border border-neutral-800 rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900/50">
        <span
          className="font-mono text-neutral-400"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          SEQUENCE DIAGRAM
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => testbed.data.sequenceAutoScroll.set(e.target.checked)}
              className="w-3 h-3"
            />
            <span
              className="font-mono text-neutral-500"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Auto-scroll
            </span>
          </label>
          <button
            onClick={() => runEffect('clearSequence')}
            className="px-2 py-1 text-neutral-500 hover:text-neutral-300 font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Diagram */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
      >
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-600">
            <span
              className="font-mono"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              No messages yet
            </span>
          </div>
        ) : (
          <svg
            width={svgWidth}
            height={svgHeight}
            className="min-w-full"
          >
            {/* Swimlane Headers */}
            <g>
              {/* Client Lane */}
              <rect
                x={PADDING}
                y={10}
                width={LANE_WIDTH}
                height={30}
                rx={4}
                fill="#171717"
                stroke="#525252"
              />
              <text
                x={clientX}
                y={30}
                textAnchor="middle"
                fill="#a3a3a3"
                style={{ fontSize: '12px', fontFamily: 'monospace' }}
              >
                CLIENT
              </text>

              {/* Server Lane */}
              <rect
                x={PADDING + LANE_WIDTH + LANE_GAP}
                y={10}
                width={LANE_WIDTH}
                height={30}
                rx={4}
                fill="#171717"
                stroke="#525252"
              />
              <text
                x={serverX}
                y={30}
                textAnchor="middle"
                fill="#a3a3a3"
                style={{ fontSize: '12px', fontFamily: 'monospace' }}
              >
                SERVER
              </text>
            </g>

            {/* Lifelines */}
            <line
              x1={clientX}
              y1={HEADER_HEIGHT}
              x2={clientX}
              y2={svgHeight - PADDING}
              stroke="#404040"
              strokeDasharray="4 4"
            />
            <line
              x1={serverX}
              y1={HEADER_HEIGHT}
              x2={serverX}
              y2={svgHeight - PADDING}
              stroke="#404040"
              strokeDasharray="4 4"
            />

            {/* Events */}
            {events.map((event, idx) => {
              const y = HEADER_HEIGHT + idx * EVENT_HEIGHT + 20
              const isOutbound = event.source === 'client'
              const fromX = isOutbound ? clientX : serverX
              const toX = isOutbound ? serverX : clientX
              const color = getEventColor(event.type)
              const midX = (fromX + toX) / 2

              return (
                <g key={event.id}>
                  {/* Arrow line */}
                  <line
                    x1={fromX}
                    y1={y}
                    x2={toX}
                    y2={y}
                    stroke={color}
                    strokeWidth={1.5}
                    markerEnd={`url(#arrow-${event.type})`}
                  />

                  {/* Arrow head */}
                  <polygon
                    points={
                      isOutbound
                        ? `${toX - 8},${y - 4} ${toX},${y} ${toX - 8},${y + 4}`
                        : `${toX + 8},${y - 4} ${toX},${y} ${toX + 8},${y + 4}`
                    }
                    fill={color}
                  />

                  {/* Event label */}
                  <text
                    x={midX}
                    y={y - 6}
                    textAnchor="middle"
                    fill={color}
                    style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}
                  >
                    {event.type.toUpperCase()}
                  </text>

                  {/* Timestamp */}
                  <text
                    x={isOutbound ? fromX - 5 : fromX + 5}
                    y={y + 4}
                    textAnchor={isOutbound ? 'end' : 'start'}
                    fill="#525252"
                    style={{ fontSize: '8px', fontFamily: 'monospace' }}
                  >
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 border-t border-neutral-800 bg-neutral-900/30">
        <span
          className="font-mono text-neutral-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {events.length} event(s)
        </span>
      </div>
    </div>
  )
}
