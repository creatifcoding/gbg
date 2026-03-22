/**
 * OperationOverlay Component
 *
 * Level 3: Progress overlay for file operations (copy, move, delete).
 *
 * @module file-browser/components/Actions
 */

import { memo } from 'react'
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

import { DARK_SIDE } from '../../tokens'

// =============================================================================
// Types
// =============================================================================

export type OperationStatus = 'pending' | 'in_progress' | 'completed' | 'error'

export interface OperationProgress {
  /** Operation ID */
  id: string
  /** Operation type */
  type: 'copy' | 'move' | 'delete' | 'create'
  /** Current status */
  status: OperationStatus
  /** Current item being processed */
  currentItem?: string
  /** Total items */
  totalItems: number
  /** Completed items */
  completedItems: number
  /** Error message if any */
  error?: string
}

export interface OperationOverlayProps {
  /** Active operations */
  operations: OperationProgress[]
  /** Called when cancel requested */
  onCancel?: (operationId: string) => void
  /** Called when dismissed */
  onDismiss?: (operationId: string) => void
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const OperationOverlay = memo(function OperationOverlay({
  operations,
  onCancel,
  onDismiss,
  className = '',
}: OperationOverlayProps) {
  if (operations.length === 0) return null

  return (
    <div
      className={`operation-overlay ${className}`}
      style={{
        position: 'absolute',
        bottom: DARK_SIDE.spacing['4'],
        right: DARK_SIDE.spacing['4'],
        zIndex: DARK_SIDE.zIndex.overlay,
        display: 'flex',
        flexDirection: 'column',
        gap: DARK_SIDE.spacing['2'],
        maxWidth: '320px',
      }}
    >
      {operations.map((op) => (
        <div
          key={op.id}
          style={{
            background: DARK_SIDE.colors.surface,
            border: `1px solid ${
              op.status === 'error'
                ? DARK_SIDE.colors.accent.red
                : op.status === 'completed'
                  ? DARK_SIDE.colors.accent.green
                  : DARK_SIDE.colors.border.default
            }`,
            padding: DARK_SIDE.spacing['3'],
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: DARK_SIDE.spacing['2'],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: DARK_SIDE.spacing['2'] }}>
              {op.status === 'in_progress' && (
                <Loader2
                  size={14}
                  color={DARK_SIDE.colors.accent.green}
                  style={{ animation: 'spin 1s linear infinite' }}
                />
              )}
              {op.status === 'completed' && (
                <CheckCircle size={14} color={DARK_SIDE.colors.accent.green} />
              )}
              {op.status === 'error' && (
                <AlertCircle size={14} color={DARK_SIDE.colors.accent.red} />
              )}
              <span
                style={{
                  fontSize: DARK_SIDE.typography.size.xs,
                  fontFamily: DARK_SIDE.typography.family.mono,
                  fontWeight: DARK_SIDE.typography.weight.bold,
                  color: DARK_SIDE.colors.text.primary,
                  textTransform: 'uppercase',
                }}
              >
                {op.type}
              </span>
            </div>
            <button
              onClick={() =>
                op.status === 'in_progress' ? onCancel?.(op.id) : onDismiss?.(op.id)
              }
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: DARK_SIDE.spacing['1'],
                color: DARK_SIDE.colors.text.tertiary,
              }}
              title={op.status === 'in_progress' ? 'Cancel' : 'Dismiss'}
            >
              <X size={14} />
            </button>
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: '4px',
              background: DARK_SIDE.colors.surfaceAlt,
              marginBottom: DARK_SIDE.spacing['2'],
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(op.completedItems / op.totalItems) * 100}%`,
                background:
                  op.status === 'error'
                    ? DARK_SIDE.colors.accent.red
                    : DARK_SIDE.colors.accent.green,
                transition: 'width 0.3s ease-out',
                boxShadow:
                  op.status === 'in_progress' ? DARK_SIDE.shadows.glow.green : 'none',
              }}
            />
          </div>

          {/* Status text */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              fontFamily: DARK_SIDE.typography.family.mono,
              color: DARK_SIDE.colors.text.tertiary,
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '200px',
              }}
            >
              {op.error || op.currentItem || '—'}
            </span>
            <span>
              {op.completedItems}/{op.totalItems}
            </span>
          </div>
        </div>
      ))}

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
})
