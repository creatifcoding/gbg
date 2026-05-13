'use client'

/**
 * WorkOrderPanel — FoldablePanel surface for Work Order management
 *
 * Vertical slice: Fermion-backed live data from IIoT database.
 * - Status distribution cards (RVN badges)
 * - Kanban-style status lanes
 * - Individual work order detail cards
 * - Priority-sorted within each lane
 *
 * @module cop/panels/WorkOrderPanel
 */

import { type FC, useEffect, useMemo, useCallback, useState } from 'react'
import { useAtomValue, useSetAtom } from '@effect-atom/atom-react'
import { Effect, Layer } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { Redacted } from 'effect'

import {
  FoldablePanel,
  FoldablePanelProvider,
  createFoldablePanelAtoms,
} from '@/lib/foldable-panel'
import type { PanelBadge } from '@/lib/foldable-panel/types'
import {
  workOrderListAtom,
  workOrderStatsAtom,
  workOrdersByStatusAtom,
  workOrdersByPriorityAtom,
  fetchAllWorkOrders,
  type WorkOrderStats,
} from '@/lib/iiot/fermion'
import { WorkOrderRepo, WorkOrderRepoLive } from '@/lib/iiot/repos/WorkOrderRepo'
import type { WorkOrderModel } from '@/lib/iiot/models/work-orders/WorkOrderModel'

// =============================================================================
// Constants
// =============================================================================

const PANEL_ID = 'cop-work-orders'

const BADGE: PanelBadge = {
  tag: 'data-grid',
  label: 'Work Orders',
  color: '#c8e4d8', // RVN accent-muted
}

/** Status colors (RVN-aligned, no border-radius) */
const STATUS_COLORS: Record<string, string> = {
  created: '#6b7280',     // gray
  submitted: '#3b82f6',   // blue
  approved: '#8b5cf6',    // purple
  started: '#f59e0b',     // amber
  suspended: '#ef4444',   // red
  resumed: '#f59e0b',     // amber
  completed: '#10b981',   // green
  failed: '#ef4444',      // red
  cancelled: '#6b7280',   // gray
  closed: '#374151',      // dark gray
  rejected: '#ef4444',    // red
}

/** Priority colors */
const PRIORITY_COLORS: Record<string, string> = {
  emergency: '#ef4444',
  urgent: '#f59e0b',
  high: '#f97316',
  normal: '#3b82f6',
  low: '#6b7280',
}

/** Kanban lane order */
const LANE_ORDER = [
  'created', 'submitted', 'approved', 'started',
  'suspended', 'completed', 'failed', 'cancelled',
] as const

// =============================================================================
// Sub-components (RVN-inspired, no border-radius, min 12px)
// =============================================================================

/** Status badge */
const StatusBadge: FC<{ status: string; count: number }> = ({ status, count }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '2px 8px',
      backgroundColor: `${STATUS_COLORS[status] ?? '#6b7280'}22`,
      border: `1px solid ${STATUS_COLORS[status] ?? '#6b7280'}44`,
      fontSize: 'var(--tmnl-text-xs, 12px)',
      fontFamily: 'var(--tmnl-font-mono, monospace)',
      color: STATUS_COLORS[status] ?? '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}
  >
    <span style={{
      width: 6,
      height: 6,
      backgroundColor: STATUS_COLORS[status] ?? '#6b7280',
      display: 'inline-block',
    }} />
    {status} <strong>{count}</strong>
  </div>
)

/** Priority indicator */
const PriorityBadge: FC<{ priority: string }> = ({ priority }) => (
  <span
    style={{
      fontSize: 'var(--tmnl-text-xs, 12px)',
      fontFamily: 'var(--tmnl-font-mono, monospace)',
      color: PRIORITY_COLORS[priority] ?? '#6b7280',
      textTransform: 'uppercase',
      fontWeight: 600,
      letterSpacing: '0.05em',
    }}
  >
    {priority}
  </span>
)

/** Stats row — summary cards */
const StatsRow: FC<{ stats: WorkOrderStats }> = ({ stats }) => (
  <div style={{
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(200,228,216,0.1)',
  }}>
    <StatCard label="Total" value={stats.total} color="#c8e4d8" />
    <StatCard label="Active" value={stats.started + stats.suspended} color="#f59e0b" />
    <StatCard label="Pending" value={stats.created + stats.submitted + stats.approved} color="#3b82f6" />
    <StatCard label="Done" value={stats.completed + stats.closed} color="#10b981" />
    <StatCard label="Failed" value={stats.failed} color="#ef4444" />
    {stats.overdue > 0 && (
      <StatCard label="Overdue" value={stats.overdue} color="#ef4444" />
    )}
  </div>
)

const StatCard: FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '4px 12px',
    minWidth: 60,
    backgroundColor: `${color}11`,
    border: `1px solid ${color}33`,
  }}>
    <span style={{
      fontSize: 'var(--tmnl-text-lg, 18px)',
      fontFamily: 'var(--tmnl-font-mono, monospace)',
      fontWeight: 700,
      color,
      lineHeight: 1.2,
    }}>
      {value}
    </span>
    <span style={{
      fontSize: 'var(--tmnl-text-xs, 12px)',
      fontFamily: 'var(--tmnl-font-mono, monospace)',
      color: 'rgba(200,228,216,0.5)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {label}
    </span>
  </div>
)

/** Work order card */
const WorkOrderCard: FC<{ wo: WorkOrderModel }> = ({ wo }) => (
  <div
    style={{
      padding: '8px 10px',
      backgroundColor: 'rgba(200,228,216,0.03)',
      border: '1px solid rgba(200,228,216,0.08)',
      marginBottom: 4,
      cursor: 'pointer',
      transition: 'border-color 150ms',
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(200,228,216,0.2)')}
    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(200,228,216,0.08)')}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        fontFamily: 'var(--tmnl-font-mono, monospace)',
        color: 'rgba(200,228,216,0.4)',
      }}>
        {wo.id}
      </span>
      <PriorityBadge priority={wo.priority} />
    </div>
    <div style={{
      fontSize: 'var(--tmnl-text-sm, 14px)',
      fontFamily: 'var(--tmnl-font-mono, monospace)',
      color: 'rgba(200,228,216,0.85)',
      marginBottom: 4,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      {wo.title}
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        fontFamily: 'var(--tmnl-font-mono, monospace)',
        color: 'rgba(200,228,216,0.35)',
      }}>
        {wo.type.replace(/_/g, ' ')}
      </span>
      {wo.assignedTo && wo.assignedTo._tag === 'Some' && (
        <span style={{
          fontSize: 'var(--tmnl-text-xs, 12px)',
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          color: 'rgba(200,228,216,0.5)',
        }}>
          → {wo.assignedTo.value}
        </span>
      )}
    </div>
  </div>
)

/** Kanban lane */
const KanbanLane: FC<{ status: string; orders: readonly WorkOrderModel[] }> = ({ status, orders }) => (
  <div style={{
    flex: '1 1 180px',
    minWidth: 180,
    maxWidth: 280,
    display: 'flex',
    flexDirection: 'column',
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 8px',
      borderBottom: `2px solid ${STATUS_COLORS[status] ?? '#6b7280'}`,
      marginBottom: 4,
    }}>
      <span style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        fontFamily: 'var(--tmnl-font-mono, monospace)',
        color: STATUS_COLORS[status] ?? '#6b7280',
        textTransform: 'uppercase',
        fontWeight: 600,
        letterSpacing: '0.05em',
      }}>
        {status}
      </span>
      <span style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        fontFamily: 'var(--tmnl-font-mono, monospace)',
        color: 'rgba(200,228,216,0.4)',
      }}>
        {orders.length}
      </span>
    </div>
    <div style={{
      flex: 1,
      overflowY: 'auto',
      maxHeight: 400,
    }}>
      {orders.length === 0 ? (
        <div style={{
          padding: 12,
          fontSize: 'var(--tmnl-text-xs, 12px)',
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          color: 'rgba(200,228,216,0.2)',
          textAlign: 'center',
        }}>
          —
        </div>
      ) : (
        orders.map(wo => <WorkOrderCard key={wo.id} wo={wo} />)
      )}
    </div>
  </div>
)

// =============================================================================
// View Mode Toggle
// =============================================================================

type ViewMode = 'kanban' | 'list'

// =============================================================================
// Main Panel Component
// =============================================================================

export const WorkOrderPanel: FC<{
  onFetchWorkOrders?: () => Promise<void>
}> = ({ onFetchWorkOrders }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const orders = useAtomValue(workOrderListAtom)
  const stats = useAtomValue(workOrderStatsAtom)
  const byStatus = useAtomValue(workOrdersByStatusAtom)

  const panelAtoms = useMemo(() => createFoldablePanelAtoms(PANEL_ID), [])

  const handleFetch = useCallback(async () => {
    if (onFetchWorkOrders) {
      setLoading(true)
      setError(null)
      try {
        await onFetchWorkOrders()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
  }, [onFetchWorkOrders])

  // Auto-fetch on mount
  useEffect(() => {
    handleFetch()
  }, [handleFetch])

  return (
    <FoldablePanelProvider panelId={PANEL_ID} atoms={panelAtoms} badge={BADGE}>
      <FoldablePanel
        panelId={PANEL_ID}
        badge={BADGE}
        expandedHeight={500}
        customName="Work Orders — FDA 21 CFR Part 11"
      >
        {/* Stats Row */}
        <StatsRow stats={stats} />

        {/* Toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          borderBottom: '1px solid rgba(200,228,216,0.08)',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['kanban', 'list'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '2px 10px',
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: viewMode === mode ? '#c8e4d8' : 'rgba(200,228,216,0.4)',
                  backgroundColor: viewMode === mode ? 'rgba(200,228,216,0.1)' : 'transparent',
                  border: `1px solid ${viewMode === mode ? 'rgba(200,228,216,0.2)' : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {loading && (
              <span style={{
                fontSize: 'var(--tmnl-text-xs, 12px)',
                fontFamily: 'var(--tmnl-font-mono, monospace)',
                color: '#f59e0b',
              }}>
                fetching...
              </span>
            )}
            <button
              onClick={handleFetch}
              disabled={loading}
              style={{
                padding: '2px 10px',
                fontSize: 'var(--tmnl-text-xs, 12px)',
                fontFamily: 'var(--tmnl-font-mono, monospace)',
                textTransform: 'uppercase',
                color: '#c8e4d8',
                backgroundColor: 'rgba(200,228,216,0.08)',
                border: '1px solid rgba(200,228,216,0.15)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              refresh
            </button>
            <span style={{
              fontSize: 'var(--tmnl-text-xs, 12px)',
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              color: 'rgba(200,228,216,0.3)',
            }}>
              {orders.length} records
            </span>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            fontFamily: 'var(--tmnl-font-mono, monospace)',
            color: '#ef4444',
          }}>
            ERROR: {error}
          </div>
        )}

        {/* Status distribution badges */}
        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          padding: '6px 12px',
          borderBottom: '1px solid rgba(200,228,216,0.06)',
        }}>
          {LANE_ORDER.map(status => {
            const count = byStatus.get(status)?.length ?? 0
            return count > 0 ? <StatusBadge key={status} status={status} count={count} /> : null
          })}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {viewMode === 'kanban' ? (
            <div style={{
              display: 'flex',
              gap: 8,
              padding: '8px 12px',
              overflowX: 'auto',
              height: '100%',
            }}>
              {LANE_ORDER.map(status => (
                <KanbanLane
                  key={status}
                  status={status}
                  orders={byStatus.get(status) ?? []}
                />
              ))}
            </div>
          ) : (
            <div style={{ padding: '8px 12px', overflowY: 'auto', height: '100%' }}>
              {orders.map(wo => <WorkOrderCard key={wo.id} wo={wo} />)}
            </div>
          )}
        </div>
      </FoldablePanel>
    </FoldablePanelProvider>
  )
}
