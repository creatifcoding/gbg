/**
 * Event Log Panel
 *
 * Real-time event log viewer with filtering and pause controls.
 * Displays events from the playground EventLog.
 *
 * @module
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'

// =============================================================================
// TYPES
// =============================================================================

interface EventEntry {
  id: string
  timestamp: number
  tag: string
  payload: unknown
}

interface EventLogPanelProps {
  /** Array of events to display */
  events?: EventEntry[]
  /** Maximum events to retain in view */
  maxEvents?: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

const EVENT_COLORS: Record<string, string> = {
  // Scenario
  ScenarioStarted: 'text-cyan-400',
  ScenarioPaused: 'text-amber-400',
  ScenarioResumed: 'text-green-400',
  ScenarioCompleted: 'text-emerald-400',
  ScenarioErrored: 'text-red-400',
  ScenarioReset: 'text-neutral-400',
  // Data flow
  DataEmitted: 'text-cyan-300',
  StreamCompleted: 'text-emerald-300',
  StreamErrored: 'text-red-300',
  // Backpressure
  BackpressureEngaged: 'text-amber-300',
  BackpressureReleased: 'text-green-300',
  ItemsDropped: 'text-rose-400',
  // Circuit breaker
  CircuitStateChanged: 'text-purple-400',
  FailureRecorded: 'text-red-300',
  SuccessRecorded: 'text-green-300',
  // Metrics
  ThroughputSampled: 'text-sky-300',
  LatencySampled: 'text-indigo-300',
}

const EVENT_ICONS: Record<string, string> = {
  ScenarioStarted: '▶',
  ScenarioPaused: '⏸',
  ScenarioResumed: '▶',
  ScenarioCompleted: '✓',
  ScenarioErrored: '✗',
  ScenarioReset: '↺',
  DataEmitted: '→',
  StreamCompleted: '■',
  StreamErrored: '✗',
  BackpressureEngaged: '⚠',
  BackpressureReleased: '✓',
  ItemsDropped: '✗',
  CircuitStateChanged: '◉',
  FailureRecorded: '✗',
  SuccessRecorded: '✓',
  ThroughputSampled: '◆',
  LatencySampled: '◇',
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTimestamp(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

function formatPayload(payload: unknown): string {
  if (!payload) return ''
  if (typeof payload === 'object') {
    const p = payload as Record<string, unknown>
    // Extract key fields for display
    const parts: string[] = []
    if ('latencyMs' in p) parts.push(`${(p.latencyMs as number).toFixed(1)}ms`)
    if ('eventsPerSecond' in p) parts.push(`${p.eventsPerSecond}/s`)
    if ('strategy' in p) parts.push(p.strategy as string)
    if ('toState' in p) parts.push(`→ ${p.toState}`)
    if ('count' in p) parts.push(`×${p.count}`)
    return parts.join(' | ')
  }
  return String(payload)
}

// =============================================================================
// EVENT ROW
// =============================================================================

interface EventRowProps {
  event: EventEntry
}

function EventRow({ event }: EventRowProps) {
  const color = EVENT_COLORS[event.tag] ?? 'text-neutral-400'
  const icon = EVENT_ICONS[event.tag] ?? '•'

  return (
    <div
      className="flex items-start gap-2 py-1 px-2 hover:bg-neutral-800/30 border-b border-neutral-800/50 last:border-b-0"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      <span className="text-neutral-600 font-mono shrink-0">
        {formatTimestamp(event.timestamp)}
      </span>
      <span className={`${color} shrink-0`}>{icon}</span>
      <span className={`${color} font-mono uppercase shrink-0`}>
        {event.tag}
      </span>
      <span className="text-neutral-500 truncate flex-1">
        {formatPayload(event.payload)}
      </span>
    </div>
  )
}

// =============================================================================
// EVENT LOG PANEL
// =============================================================================

/**
 * Real-time event log viewer.
 *
 * Features:
 * - Tag-based filtering
 * - Pause/resume
 * - Clear
 * - Auto-scroll to latest
 */
export function EventLogPanel({
  events = [],
  maxEvents = 100,
}: EventLogPanelProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [filter, setFilter] = useState<string>('')
  const logRef = useRef<HTMLDivElement>(null)

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = events.slice(-maxEvents)
    if (filter) {
      const lowerFilter = filter.toLowerCase()
      result = result.filter((e) =>
        e.tag.toLowerCase().includes(lowerFilter)
      )
    }
    return result
  }, [events, maxEvents, filter])

  // Auto-scroll when not paused
  useEffect(() => {
    if (!isPaused && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [filteredEvents, isPaused])

  const handleClear = useCallback(() => {
    // Would dispatch reset event here
  }, [])

  return (
    <div className="flex flex-col h-64">
      {/* Controls */}
      <div className="flex items-center gap-2 p-2 border-b border-neutral-800 bg-neutral-900/50">
        <input
          type="text"
          placeholder="Filter by tag..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 font-mono placeholder:text-neutral-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        />
        <button
          onClick={() => setIsPaused(!isPaused)}
          className={`px-2 py-1 font-mono uppercase tracking-wider rounded border ${
            isPaused
              ? 'bg-amber-900/50 text-amber-400 border-amber-700'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
          }`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
      </div>

      {/* Event List */}
      <div
        ref={logRef}
        className="flex-1 overflow-y-auto bg-neutral-950/50"
      >
        {filteredEvents.length === 0 ? (
          <div
            className="p-4 text-center text-neutral-600 font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            No events yet...
          </div>
        ) : (
          filteredEvents.map((event) => (
            <EventRow key={event.id} event={event} />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-2 py-1 border-t border-neutral-800 bg-neutral-900/50 text-neutral-500 font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <span>{filteredEvents.length} events</span>
        {isPaused && <span className="text-amber-400">PAUSED</span>}
      </div>
    </div>
  )
}

export default EventLogPanel
