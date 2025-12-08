/**
 * HALFLIFE Timeline - Kanban-style visualization of findings
 *
 * Hypothesis Analysis Log For Lifecycle Investigation & Finding Evidence
 *
 * Features:
 * - Kanban lanes grouped by hypothesis (H1, H2, H3, etc.)
 * - Severity badges (info, warning, critical)
 * - Status chips (active, mitigated, fixed, documented)
 * - Human-readable summary (always visible)
 * - Machine context (collapsible, for AI/tooling)
 */

import { useState, useMemo, useEffect } from 'react'
import type {
  Finding,
  HalflifeData,
  HypothesisId,
  FindingsByHypothesis,
  Severity,
  Status,
  EntryType,
  DamageContext,
} from './halflife-types'
import halflifeData from './halflife.json'
import { Modal } from '../base'
import {
  CapabilityProvider,
  useAttach,
  withCapable,
} from '@/lib/capabilities'

// =============================================================================
// CONSTANTS
// =============================================================================

const HYPOTHESIS_ORDER: HypothesisId[] = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'OTHER']

const SEVERITY_STYLES: Record<Severity, { dot: string; bg: string; text: string }> = {
  info: { dot: 'bg-blue-500', bg: 'bg-blue-900/20', text: 'text-blue-400' },
  warning: { dot: 'bg-amber-500', bg: 'bg-amber-900/20', text: 'text-amber-400' },
  critical: { dot: 'bg-red-500', bg: 'bg-red-900/20', text: 'text-red-400' },
}

const STATUS_STYLES: Record<Status, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-red-900/30', text: 'text-red-300', label: 'ACTIVE' },
  mitigated: { bg: 'bg-amber-900/30', text: 'text-amber-300', label: 'MITIGATED' },
  fixed: { bg: 'bg-green-900/30', text: 'text-green-300', label: 'FIXED' },
  documented: { bg: 'bg-cyan-900/30', text: 'text-cyan-300', label: 'DOCUMENTED' },
}

const TYPE_STYLES: Record<EntryType, { icon: string; border: string; badge: string; badgeText: string }> = {
  finding: { icon: '◉', border: 'border-neutral-700', badge: 'bg-violet-900/30', badgeText: 'text-violet-400' },
  damage: { icon: '⚠', border: 'border-orange-800/50', badge: 'bg-orange-900/30', badgeText: 'text-orange-400' },
}

// =============================================================================
// UTILITIES
// =============================================================================

function groupByHypothesis(findings: Finding[]): FindingsByHypothesis {
  const groups: FindingsByHypothesis = {
    H1: [], H2: [], H3: [], H4: [], H5: [],
    H6: [], H7: [], H8: [], H9: [], H10: [],
    OTHER: [],
  }

  for (const finding of findings) {
    const key = finding.hypothesis as HypothesisId
    if (groups[key]) {
      groups[key].push(finding)
    } else {
      groups.OTHER.push(finding)
    }
  }

  return groups
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// =============================================================================
// DAMAGE BADGE (withCapable HOC)
// =============================================================================

/**
 * Base DMG badge button - receives entityId from withCapable
 * No hover/focus tracking, no capability rendering — HOC handles it all
 */
const DmgBadgeBase = ({ onClick }: { onClick?: (e: React.MouseEvent) => void }) => (
  <button
    className="px-1.5 py-0.5 font-mono uppercase rounded bg-orange-900/30 text-orange-400 hover:bg-orange-800/50 transition-colors"
    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    onClick={onClick}
  >
    DMG
  </button>
)

/**
 * Capable DMG badge - auto-manages hover/focus state, auto-renders capabilities
 */
const DmgBadge = withCapable<{ onClick?: (e: React.MouseEvent) => void }>()(DmgBadgeBase)

// =============================================================================
// DAMAGE REPORT MODAL
// =============================================================================

interface DamageModalData {
  id: string
  title: string
  damage: DamageContext
}

function DamageReportModal({ data }: { data: DamageModalData }) {
  const entityId = `dmg-${data.id}`

  return (
    <Modal.Root>
      <Modal.Trigger asChild>
        <DmgBadge entityId={entityId} onClick={(e) => e.stopPropagation()} />
      </Modal.Trigger>
      <Modal.Portal>
        <Modal.Overlay />
        <Modal.Content className="max-w-md">
          <Modal.Header className="border-orange-800/30">
            <div>
              <span className="text-orange-400 text-xs font-mono">{data.id}</span>
              <h3 className="text-neutral-200 text-sm font-medium mt-1">{data.title}</h3>
            </div>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            {data.damage.parentFinding && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-neutral-500">PARENT FINDING:</span>
                <span className="text-violet-400 font-mono">{data.damage.parentFinding}</span>
              </div>
            )}

            <div>
              <div className="text-orange-500 uppercase tracking-wider mb-1 font-bold" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Root Cause
              </div>
              <p className="text-sm text-orange-300/90">{data.damage.rootCause}</p>
            </div>

            <div>
              <div className="text-amber-500 uppercase tracking-wider mb-1 font-bold" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                What Was Missed
              </div>
              <p className="text-sm text-amber-200/80">{data.damage.whatWasMissed}</p>
            </div>

            <div>
              <div className="text-green-500 uppercase tracking-wider mb-1 font-bold" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Prevention
              </div>
              <p className="text-sm text-green-400/90">{data.damage.prevention}</p>
            </div>
          </Modal.Body>
          <Modal.Footer className="border-orange-800/30">
            <div className="flex justify-end">
              <Modal.Close asChild>
                <button className="px-3 py-1.5 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 rounded transition-colors">
                  DISMISS
                </button>
              </Modal.Close>
            </div>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Portal>
    </Modal.Root>
  )
}

// =============================================================================
// FINDING CARD
// =============================================================================

function FindingCard({ finding }: { finding: Finding }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showMachine, setShowMachine] = useState(false)

  const severity = SEVERITY_STYLES[finding.severity]
  const status = STATUS_STYLES[finding.status]
  const entryType = TYPE_STYLES[finding.type ?? 'finding']
  const isDamage = finding.type === 'damage'

  return (
    <div className={`border rounded overflow-hidden ${entryType.border} ${severity.bg}`}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 text-left hover:bg-neutral-800/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {isDamage && <span className="text-orange-400 text-xs">{entryType.icon}</span>}
            <span className={`w-2 h-2 rounded-full ${severity.dot}`} />
            <span className={`text-xs font-mono ${isDamage ? 'text-orange-400' : severity.text}`}>{finding.id}</span>
          </div>
          <div className="flex items-center gap-1">
            {isDamage && finding.damage && (
              <DamageReportModal data={{ id: finding.id, title: finding.title, damage: finding.damage }} />
            )}
            <span className={`px-1.5 py-0.5 font-mono uppercase rounded ${status.bg} ${status.text}`} style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {status.label}
            </span>
          </div>
        </div>
        <h4 className="text-sm text-neutral-200 mt-1.5 font-medium leading-tight">
          {finding.title}
        </h4>
        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
          {finding.summary}
        </p>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-neutral-700 p-3 space-y-3 bg-neutral-950/30">
          {/* Human context */}
          <div>
            <div className="text-neutral-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              What Happened
            </div>
            <p className="text-xs text-neutral-300">
              {finding.human.whatHappened}
            </p>
          </div>

          <div>
            <div className="text-neutral-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Why It Matters
            </div>
            <p className="text-xs text-neutral-400">
              {finding.human.whyItMatters}
            </p>
          </div>

          {finding.human.lesson && (
            <div>
              <div className="text-cyan-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Lesson
              </div>
              <p className="text-xs text-cyan-400/80">
                {finding.human.lesson}
              </p>
            </div>
          )}

          {/* Damage context (for damage entries only) */}
          {finding.damage && (
            <div className="p-2 bg-orange-950/20 border border-orange-800/30 rounded space-y-2">
              <div className="text-orange-500 uppercase tracking-wider font-bold" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                Damage Report
              </div>
              {finding.damage.parentFinding && (
                <div className="flex items-center gap-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  <span className="text-neutral-500">PARENT:</span>
                  <span className="text-violet-400 font-mono">{finding.damage.parentFinding}</span>
                </div>
              )}
              <div>
                <div className="text-neutral-600 mb-0.5" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>ROOT CAUSE</div>
                <p className="text-xs text-orange-300/80">{finding.damage.rootCause}</p>
              </div>
              <div>
                <div className="text-neutral-600 mb-0.5" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>WHAT WAS MISSED</div>
                <p className="text-xs text-orange-200/70">{finding.damage.whatWasMissed}</p>
              </div>
              <div>
                <div className="text-green-600 mb-0.5" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>PREVENTION</div>
                <p className="text-xs text-green-400/80">{finding.damage.prevention}</p>
              </div>
            </div>
          )}

          {/* Tags */}
          {finding.tags && finding.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {finding.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 font-mono bg-neutral-800 text-neutral-500 rounded"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-neutral-600 pt-2 border-t border-neutral-800" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {formatTimestamp(finding.timestamp)}
          </div>

          {/* Machine context toggle */}
          <button
            onClick={() => setShowMachine(!showMachine)}
            className="w-full flex items-center justify-between px-2 py-1.5 bg-neutral-900/50 rounded font-mono text-neutral-500 hover:text-neutral-400 transition-colors"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <span>MACHINE CONTEXT</span>
            <span>{showMachine ? '▲' : '▼'}</span>
          </button>

          {/* Machine context (collapsed by default) */}
          {showMachine && (
            <div className="p-2 bg-neutral-900 rounded border border-neutral-800 space-y-2">
              <div className="flex items-center gap-2 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                <span className="text-neutral-500">FILE:</span>
                <span className="text-violet-400">{finding.machine.file}:{finding.machine.line}</span>
              </div>

              <div>
                <div className="text-neutral-600 mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>PATTERN</div>
                <pre className="p-2 bg-red-950/30 rounded text-red-300/80 overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  {finding.machine.pattern}
                </pre>
              </div>

              <div>
                <div className="text-neutral-600 mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>FIX</div>
                <pre className="p-2 bg-green-950/30 rounded text-green-300/80 overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  {finding.machine.fix}
                </pre>
              </div>

              {finding.machine.snippets && finding.machine.snippets.map((snippet, i) => (
                <div key={i}>
                  <div className="text-neutral-600 mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>{snippet.label.toUpperCase()}</div>
                  <pre className="p-2 bg-neutral-800 rounded text-neutral-300 overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                    {snippet.code}
                  </pre>
                </div>
              ))}

              {finding.machine.commit && (
                <div className="font-mono text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                  COMMIT: {finding.machine.commit}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// KANBAN LANE
// =============================================================================

function KanbanLane({ hypothesis, findings }: { hypothesis: HypothesisId; findings: Finding[] }) {
  if (findings.length === 0) return null

  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const activeCount = findings.filter(f => f.status === 'active').length
  const damageCount = findings.filter(f => f.type === 'damage').length

  return (
    <div className="flex-shrink-0 w-72">
      {/* Lane header */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-800/50 rounded-t border border-neutral-700 border-b-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-bold text-neutral-200">{hypothesis}</span>
          <span className="text-xs text-neutral-500">({findings.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          {damageCount > 0 && (
            <span className="px-1.5 py-0.5 font-mono bg-orange-900/50 text-orange-400 rounded" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {damageCount} dmg
            </span>
          )}
          {criticalCount > 0 && (
            <span className="px-1.5 py-0.5 font-mono bg-red-900/50 text-red-400 rounded" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {criticalCount} crit
            </span>
          )}
          {activeCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
      </div>

      {/* Lane content */}
      <div className="p-2 space-y-2 bg-neutral-900/30 border border-neutral-700 rounded-b min-h-[200px] max-h-[600px] overflow-y-auto">
        {findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// CAPABILITY INJECTOR
// =============================================================================

/**
 * Injects capabilities onto all damage entries
 * Injector doesn't know HOW it renders — just attaches data
 */
function DamageCapabilityInjector({ findings }: { findings: Finding[] }) {
  const { attach, detach } = useAttach()

  useEffect(() => {
    const damageEntries = findings.filter(f => f.type === 'damage' && f.damage)

    for (const entry of damageEntries) {
      const entityId = `dmg-${entry.id}`

      // Attach capabilities — consumer decides how to render
      attach(entityId, 'glowable', {
        color: 'orange',
        intensity: 'md',
        animated: entry.status === 'active',
      })
      attach(entityId, 'tooltippable', {
        text: 'Click to view damage report',
        side: 'top',
      })
      attach(entityId, 'clickable', {
        cursor: 'pointer',
      })
    }

    // Cleanup
    return () => {
      for (const entry of damageEntries) {
        const entityId = `dmg-${entry.id}`
        detach(entityId, 'glowable')
        detach(entityId, 'tooltippable')
        detach(entityId, 'clickable')
      }
    }
  }, [findings, attach, detach])

  return null
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function HalflifeTimelineInner({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const data = halflifeData as HalflifeData

  const grouped = useMemo(() => groupByHypothesis(data.findings), [data.findings])
  const activeHypotheses = HYPOTHESIS_ORDER.filter(h => grouped[h].length > 0)

  const totalEntries = data.findings.length
  const findingCount = data.findings.filter(f => (f.type ?? 'finding') === 'finding').length
  const damageCount = data.findings.filter(f => f.type === 'damage').length
  const criticalCount = data.findings.filter(f => f.severity === 'critical').length
  const activeCount = data.findings.filter(f => f.status === 'active').length
  const fixedCount = data.findings.filter(f => f.status === 'fixed').length

  return (
    <section className="mb-8 border border-neutral-800 bg-neutral-900/50 rounded">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-neutral-800/30 transition-colors"
      >
        <div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-mono font-bold text-violet-400">HALFLIFE</span>
            <span className="text-xs text-neutral-500 font-mono">
              Hypothesis Analysis Log For Lifecycle Investigation & Finding Evidence
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs font-mono">
            <span className="text-neutral-400">{totalEntries} entries</span>
            <span className="text-violet-400">{findingCount} findings</span>
            {damageCount > 0 && <span className="text-orange-400">{damageCount} damage</span>}
            <span className="text-red-400">{criticalCount} critical</span>
            <span className="text-green-400">{fixedCount} fixed</span>
            {activeCount > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {activeCount} active
              </span>
            )}
          </div>
        </div>
        <span className="text-neutral-500 text-xl">{isOpen ? '−' : '+'}</span>
      </button>

      {/* Kanban board */}
      {isOpen && (
        <div className="border-t border-neutral-800 p-4">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {activeHypotheses.map((hypothesis) => (
              <KanbanLane
                key={hypothesis}
                hypothesis={hypothesis}
                findings={grouped[hypothesis]}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-600">
            <span>Last updated: {formatTimestamp(data.lastUpdated)}</span>
            <span>v{data.version}</span>
          </div>
        </div>
      )}
    </section>
  )
}

// =============================================================================
// EXPORTED WRAPPER (with CapabilityProvider)
// =============================================================================

export function HalflifeTimeline({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const data = halflifeData as HalflifeData

  return (
    <CapabilityProvider>
      <DamageCapabilityInjector findings={data.findings} />
      <HalflifeTimelineInner defaultOpen={defaultOpen} />
    </CapabilityProvider>
  )
}

export default HalflifeTimeline
