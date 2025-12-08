/**
 * Hypothesis Validation Components
 *
 * Components for EDIN-style hypothesis testing and validation display.
 * Used across testbeds to track experiment outcomes.
 *
 * @provenance
 * ────────────────────────────────────────────────────────────────────────────
 * COMPONENT              │ EXTRACTED FROM                     │ DATE
 * ────────────────────────────────────────────────────────────────────────────
 * HypothesisBadge        │ EffectAtomTestbed.tsx              │ 2025-12-02
 *                        │ (Static version without render     │
 *                        │ tracking - see render-tracking.tsx │
 *                        │ for the instrumented version)      │
 * ────────────────────────────────────────────────────────────────────────────
 * ValidationCard         │ EffectAtomTestbed.tsx:348-365      │ 2025-12-02
 * ────────────────────────────────────────────────────────────────────────────
 * HypothesisSection      │ EffectAtomTestbed.tsx:444-472      │ 2025-12-02
 *                        │ (Base version - render-tracked     │
 *                        │ variant lives in render-tracking)  │
 * ────────────────────────────────────────────────────────────────────────────
 * SubHypothesisCard      │ EffectAtomTestbed.tsx:478-541      │ 2025-12-02
 *                        │ (Base version - render-tracked     │
 *                        │ variant lives in render-tracking)  │
 * ────────────────────────────────────────────────────────────────────────────
 * DamageReport           │ EffectAtomTestbed.tsx:778-880+     │ 2025-12-02
 *                        │ (Simplified - the original has     │
 *                        │ antipattern entries and code       │
 *                        │ examples specific to effect-atom)  │
 * ────────────────────────────────────────────────────────────────────────────
 * HypothesisSummary      │ New - pattern from DataManager     │ 2025-12-02
 * ────────────────────────────────────────────────────────────────────────────
 *
 * RATIONALE:
 * The EDIN experiment methodology (Experiment, Design, Implement, Negotiate)
 * requires structured hypothesis tracking. These components provide:
 *
 * 1. Visual status indicators for validation state
 * 2. Collapsible sections for hypothesis organization
 * 3. Damage reports for documenting antipatterns discovered
 * 4. Summary views for experiment dashboards
 *
 * The EffectAtomTestbed contained the canonical "damage report" pattern with
 * detailed antipattern documentation. That specific implementation with its
 * H3_2_ANTIPATTERNS array remains in-situ as reference. This extraction
 * provides the reusable shell.
 *
 * RELATIONSHIP TO RENDER-TRACKING:
 * The EffectAtomTestbed's HypothesisBadge/Section/Card components have
 * integrated render counting via useTrackRender(). Those instrumented
 * versions are extracted to render-tracking.tsx. This file contains the
 * "pure" validation-status versions without render instrumentation.
 *
 * @see render-tracking.tsx for instrumented versions with leak detection
 * @see EffectAtomTestbed.tsx for H3_2_ANTIPATTERNS reference data
 */

import { useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Clock, Info } from 'lucide-react'

// =============================================================================
// TYPES
// =============================================================================

export type ValidationStatus = 'validated' | 'failed' | 'pending' | 'partial' | 'unknown'

export interface HypothesisResult {
  id: string
  status: ValidationStatus
  message?: string
  timestamp?: number
}

// =============================================================================
// HYPOTHESIS BADGE
// =============================================================================

export interface HypothesisBadgeProps {
  id: string
  status: ValidationStatus
  compact?: boolean
  className?: string
}

/**
 * Badge showing hypothesis ID and validation status.
 */
export function HypothesisBadge({
  id,
  status,
  compact = false,
  className = '',
}: HypothesisBadgeProps) {
  const statusConfig = {
    validated: {
      bg: 'bg-green-900/30',
      border: 'border-green-800',
      text: 'text-green-400',
      icon: CheckCircle,
    },
    failed: {
      bg: 'bg-red-900/30',
      border: 'border-red-800',
      text: 'text-red-400',
      icon: XCircle,
    },
    pending: {
      bg: 'bg-amber-900/30',
      border: 'border-amber-800',
      text: 'text-amber-400',
      icon: Clock,
    },
    partial: {
      bg: 'bg-cyan-900/30',
      border: 'border-cyan-800',
      text: 'text-cyan-400',
      icon: AlertTriangle,
    },
    unknown: {
      bg: 'bg-neutral-800/50',
      border: 'border-neutral-700',
      text: 'text-neutral-400',
      icon: Info,
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono ${config.bg} ${config.border} ${config.text} ${className}`}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <Icon size={10} />
        {id}
      </span>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded border font-mono ${config.bg} ${config.border} ${className}`}
    >
      <Icon size={14} className={config.text} />
      <span className={config.text} style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
        {id}
      </span>
    </div>
  )
}

// =============================================================================
// VALIDATION CARD
// =============================================================================

export interface ValidationCardProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'error' | 'warning'
  className?: string
}

/**
 * Card container for validation status display.
 */
export function ValidationCard({
  children,
  variant = 'default',
  className = '',
}: ValidationCardProps) {
  const variantClasses = {
    default: 'border-neutral-800 bg-neutral-900/50',
    success: 'border-green-800/50 bg-green-900/20',
    error: 'border-red-800/50 bg-red-900/20',
    warning: 'border-amber-800/50 bg-amber-900/20',
  }

  return (
    <div
      className={`mt-4 p-4 border rounded ${variantClasses[variant]} ${className}`}
    >
      {children}
    </div>
  )
}

// =============================================================================
// HYPOTHESIS SECTION
// =============================================================================

export interface HypothesisSectionProps {
  id: string
  title: string
  description?: string
  status: ValidationStatus
  children: ReactNode
  defaultExpanded?: boolean
  className?: string
}

/**
 * Collapsible section for a single hypothesis test.
 */
export function HypothesisSection({
  id,
  title,
  description,
  status,
  children,
  defaultExpanded = true,
  className = '',
}: HypothesisSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <section className={`border border-neutral-800 rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 bg-neutral-900/50 flex items-center justify-between hover:bg-neutral-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <HypothesisBadge id={id} status={status} compact />
          <div className="text-left">
            <h3
              className="font-mono text-neutral-200"
              style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
            >
              {title}
            </h3>
            {description && (
              <p className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                {description}
              </p>
            )}
          </div>
        </div>
        <span
          className="text-neutral-500 font-mono"
          style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
        >
          {isExpanded ? '−' : '+'}
        </span>
      </button>
      {isExpanded && (
        <div className="p-4 border-t border-neutral-800">{children}</div>
      )}
    </section>
  )
}

// =============================================================================
// SUB-HYPOTHESIS CARD
// =============================================================================

export interface SubHypothesisCardProps {
  id: string
  title: string
  description: string
  validated: boolean
  children: ReactNode
  className?: string
}

/**
 * Card for sub-hypothesis within a hypothesis section.
 */
export function SubHypothesisCard({
  id,
  title,
  description,
  validated,
  children,
  className = '',
}: SubHypothesisCardProps) {
  const borderColor = validated ? 'border-green-800/30' : 'border-neutral-800'
  const bgColor = validated ? 'bg-green-900/10' : 'bg-neutral-900/30'

  return (
    <div className={`p-4 border rounded ${borderColor} ${bgColor} ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-cyan-400 font-semibold"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {id}
            </span>
            <span
              className="font-mono text-neutral-200"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {title}
            </span>
          </div>
          <p className="text-neutral-500 mt-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {description}
          </p>
        </div>
        {validated ? (
          <CheckCircle size={16} className="text-green-400 shrink-0" />
        ) : (
          <Clock size={16} className="text-neutral-500 shrink-0" />
        )}
      </div>
      {children}
    </div>
  )
}

// =============================================================================
// DAMAGE REPORT
// =============================================================================

export interface DamageReportFinding {
  id: string
  severity: 'critical' | 'warning' | 'info' | 'resolved'
  title: string
  description?: string
  hypothesis?: string
}

export interface DamageReportProps {
  findings: DamageReportFinding[]
  title?: string
  showEmpty?: boolean
  className?: string
}

/**
 * Damage report showing hypothesis validation findings.
 */
export function DamageReport({
  findings,
  title = 'DAMAGE REPORT',
  showEmpty = true,
  className = '',
}: DamageReportProps) {
  const severityConfig = {
    critical: { bg: 'bg-red-900/30', border: 'border-red-800', text: 'text-red-400', icon: XCircle },
    warning: { bg: 'bg-amber-900/30', border: 'border-amber-800', text: 'text-amber-400', icon: AlertTriangle },
    info: { bg: 'bg-cyan-900/30', border: 'border-cyan-800', text: 'text-cyan-400', icon: Info },
    resolved: { bg: 'bg-green-900/30', border: 'border-green-800', text: 'text-green-400', icon: CheckCircle },
  }

  const activeFindingsCount = findings.filter((f) => f.severity !== 'resolved').length

  if (!showEmpty && findings.length === 0) return null

  return (
    <div className={`border border-neutral-800 rounded-lg overflow-hidden ${className}`}>
      <div className="px-4 py-3 bg-neutral-900/50 border-b border-neutral-800 flex items-center justify-between">
        <span
          className="font-mono text-neutral-400 uppercase tracking-wider"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {title}
        </span>
        <span
          className={`font-mono ${activeFindingsCount > 0 ? 'text-amber-400' : 'text-green-400'}`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {activeFindingsCount > 0 ? `${activeFindingsCount} ACTIVE` : 'ALL CLEAR'}
        </span>
      </div>

      <div className="divide-y divide-neutral-800">
        {findings.length === 0 ? (
          <div className="p-4 text-neutral-500 text-center font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            No findings recorded
          </div>
        ) : (
          findings.map((finding) => {
            const config = severityConfig[finding.severity]
            const Icon = config.icon

            return (
              <div key={finding.id} className={`p-3 ${config.bg}`}>
                <div className="flex items-start gap-3">
                  <Icon size={14} className={`${config.text} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono ${config.text}`} style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                        {finding.title}
                      </span>
                      {finding.hypothesis && (
                        <span
                          className="font-mono text-neutral-500"
                          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                        >
                          [{finding.hypothesis}]
                        </span>
                      )}
                    </div>
                    {finding.description && (
                      <p className="text-neutral-400 mt-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                        {finding.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// =============================================================================
// HYPOTHESIS SUMMARY
// =============================================================================

export interface HypothesisSummaryProps {
  hypotheses: Array<{
    id: string
    title: string
    status: ValidationStatus
  }>
  className?: string
}

/**
 * Summary grid of all hypotheses and their status.
 */
export function HypothesisSummary({ hypotheses, className = '' }: HypothesisSummaryProps) {
  const statusCounts = hypotheses.reduce(
    (acc, h) => {
      acc[h.status] = (acc[h.status] || 0) + 1
      return acc
    },
    {} as Record<ValidationStatus, number>
  )

  return (
    <div className={`p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <span
          className="font-mono text-neutral-400 uppercase tracking-wider"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Hypothesis Summary
        </span>
        <div className="flex items-center gap-3">
          {statusCounts.validated && (
            <span className="text-green-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              ✓ {statusCounts.validated}
            </span>
          )}
          {statusCounts.failed && (
            <span className="text-red-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              ✗ {statusCounts.failed}
            </span>
          )}
          {statusCounts.pending && (
            <span className="text-amber-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              ○ {statusCounts.pending}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {hypotheses.map((h) => (
          <div
            key={h.id}
            className="flex items-center gap-2 p-2 bg-neutral-800/30 rounded"
          >
            <HypothesisBadge id={h.id} status={h.status} compact />
            <span
              className="text-neutral-300 truncate"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {h.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
