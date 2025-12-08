/**
 * Hypothesis Panel
 *
 * EDIN-style hypothesis tracking for stream playground experiments.
 *
 * @module
 */

import { useState, memo } from 'react'

// =============================================================================
// TYPES
// =============================================================================

export type HypothesisStatus = 'untested' | 'testing' | 'validated' | 'invalidated' | 'partial'

export interface Hypothesis {
  /** Unique identifier */
  id: string
  /** Short hypothesis code (e.g., "H1", "H2a") */
  code: string
  /** Hypothesis statement */
  statement: string
  /** Current status */
  status: HypothesisStatus
  /** Associated scenario IDs */
  scenarios: string[]
  /** Validation notes */
  notes?: string
  /** Evidence collected */
  evidence?: string[]
}

export interface HypothesisPanelProps {
  /** Hypotheses to display */
  hypotheses?: Hypothesis[]
  /** Currently active hypothesis */
  activeHypothesisId?: string
  /** Callback when hypothesis is selected */
  onSelect?: (id: string) => void
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_STYLES: Record<HypothesisStatus, { bg: string; border: string; text: string; icon: string }> = {
  untested: {
    bg: 'bg-neutral-800/50',
    border: 'border-neutral-700',
    text: 'text-neutral-400',
    icon: '○',
  },
  testing: {
    bg: 'bg-cyan-900/30',
    border: 'border-cyan-700',
    text: 'text-cyan-400',
    icon: '◐',
  },
  validated: {
    bg: 'bg-green-900/30',
    border: 'border-green-700',
    text: 'text-green-400',
    icon: '●',
  },
  invalidated: {
    bg: 'bg-red-900/30',
    border: 'border-red-700',
    text: 'text-red-400',
    icon: '✗',
  },
  partial: {
    bg: 'bg-amber-900/30',
    border: 'border-amber-700',
    text: 'text-amber-400',
    icon: '◑',
  },
}

// =============================================================================
// DEFAULT HYPOTHESES
// =============================================================================

const DEFAULT_HYPOTHESES: Hypothesis[] = [
  {
    id: 'h1',
    code: 'H1',
    statement: 'streamToAtom provides real-time reactive updates to AG-Grid rowData without polling',
    status: 'validated',
    scenarios: ['01-basic-throughput', '02-sustained-load'],
    evidence: [
      'AG-Grid updates within 16ms of stream emission',
      'No setTimeout/setInterval detected in data flow',
    ],
  },
  {
    id: 'h2',
    code: 'H2',
    statement: 'Backpressure strategies (block vs drop) produce measurably different latency profiles',
    status: 'testing',
    scenarios: ['04-backpressure-block', '05-backpressure-drop'],
    notes: 'Need to complete both backpressure scenarios',
  },
  {
    id: 'h3',
    code: 'H3',
    statement: 'Circuit breaker trips at exactly N failures and recovers predictably',
    status: 'untested',
    scenarios: ['06-circuit-trip', '07-circuit-recovery'],
  },
  {
    id: 'h4',
    code: 'H4',
    statement: 'Topology fanout latency scales linearly with outlet count',
    status: 'untested',
    scenarios: ['08-topology-fanout'],
  },
  {
    id: 'h5',
    code: 'H5',
    statement: 'EventLog captures all stream events with sub-millisecond timestamps',
    status: 'validated',
    scenarios: ['01-basic-throughput'],
    evidence: [
      'performance.now() timestamps with 0.1ms precision',
      '100% event capture verified via count comparison',
    ],
  },
]

// =============================================================================
// HYPOTHESIS CARD
// =============================================================================

interface HypothesisCardProps {
  hypothesis: Hypothesis
  isActive: boolean
  onClick: () => void
}

const HypothesisCard = memo(function HypothesisCard({
  hypothesis,
  isActive,
  onClick,
}: HypothesisCardProps) {
  const style = STATUS_STYLES[hypothesis.status]
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`
        p-3 rounded-lg border cursor-pointer transition-all
        ${style.bg} ${style.border}
        ${isActive ? 'ring-2 ring-cyan-500 ring-offset-1 ring-offset-neutral-950' : ''}
        hover:brightness-110
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`font-mono font-bold ${style.text}`}
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {style.icon} {hypothesis.code}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded uppercase tracking-wider ${style.bg} ${style.text}`}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {hypothesis.status}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
          className="text-neutral-500 hover:text-neutral-300 transition-colors"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Statement */}
      <p
        className="text-neutral-300 leading-tight"
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {hypothesis.statement}
      </p>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-neutral-700/50 space-y-2">
          {/* Scenarios */}
          <div>
            <span
              className="text-neutral-500 uppercase tracking-wider"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Scenarios:
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {hypothesis.scenarios.map((s) => (
                <span
                  key={s}
                  className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-400 font-mono"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Notes */}
          {hypothesis.notes && (
            <div>
              <span
                className="text-neutral-500 uppercase tracking-wider"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Notes:
              </span>
              <p
                className="text-neutral-400 mt-1"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {hypothesis.notes}
              </p>
            </div>
          )}

          {/* Evidence */}
          {hypothesis.evidence && hypothesis.evidence.length > 0 && (
            <div>
              <span
                className="text-neutral-500 uppercase tracking-wider"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Evidence:
              </span>
              <ul className="mt-1 space-y-1">
                {hypothesis.evidence.map((e, i) => (
                  <li
                    key={i}
                    className="text-green-400/80 flex items-start gap-1"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    <span>✓</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// HYPOTHESIS PANEL
// =============================================================================

/**
 * EDIN-style hypothesis tracking panel.
 *
 * Displays hypotheses being tested, their status, and evidence.
 * Follows the Experiment phase of EDIN methodology.
 */
export function HypothesisPanel({
  hypotheses = DEFAULT_HYPOTHESES,
  activeHypothesisId,
  onSelect,
}: HypothesisPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(activeHypothesisId ?? null)

  const handleSelect = (id: string) => {
    setSelectedId(id)
    onSelect?.(id)
  }

  // Stats
  const stats = {
    total: hypotheses.length,
    validated: hypotheses.filter((h) => h.status === 'validated').length,
    invalidated: hypotheses.filter((h) => h.status === 'invalidated').length,
    testing: hypotheses.filter((h) => h.status === 'testing').length,
    untested: hypotheses.filter((h) => h.status === 'untested').length,
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="font-mono uppercase tracking-wider text-neutral-300"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          Hypotheses
        </h3>
        <div
          className="flex items-center gap-3 text-neutral-500 font-mono"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          <span className="text-green-400">✓{stats.validated}</span>
          <span className="text-cyan-400">◐{stats.testing}</span>
          <span className="text-neutral-400">○{stats.untested}</span>
          {stats.invalidated > 0 && (
            <span className="text-red-400">✗{stats.invalidated}</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-neutral-800 rounded-full mb-4 overflow-hidden">
        <div className="h-full flex">
          <div
            className="bg-green-500"
            style={{ width: `${(stats.validated / stats.total) * 100}%` }}
          />
          <div
            className="bg-cyan-500"
            style={{ width: `${(stats.testing / stats.total) * 100}%` }}
          />
          <div
            className="bg-red-500"
            style={{ width: `${(stats.invalidated / stats.total) * 100}%` }}
          />
        </div>
      </div>

      {/* Hypothesis list */}
      <div className="flex-1 overflow-auto space-y-2">
        {hypotheses.map((h) => (
          <HypothesisCard
            key={h.id}
            hypothesis={h}
            isActive={selectedId === h.id}
            onClick={() => handleSelect(h.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        className="mt-4 pt-3 border-t border-neutral-800 text-neutral-500 font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <span className="text-cyan-400">EDIN</span> Experiment Phase — {stats.total} hypotheses tracked
      </div>
    </div>
  )
}

export default HypothesisPanel
