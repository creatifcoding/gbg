/**
 * Transfer v2 — Traits (wired, not dead)
 *
 * Three traits that produce real visual feedback:
 * - TransferSourceTrait: opacity reduction + data attrs on dragged rows
 * - TransferTargetTrait: accept/reject outline on drop zones
 * - TransferFeedbackTrait: flash/shake/badge on transfer completion
 *
 * See: src/lib/transfer/docs/redesign/04-transfer-trait-wiring.md
 *
 * @since v2
 */
import React from 'react'
import { createTrait } from '@/lib/traits'
import type { TransferToken, TransferFeedbackEvent } from './schemas'

// ── Source Trait ──────────────────────────────────────────────

export interface TransferSourceSlot {
  /** Is this item currently being dragged? */
  readonly isDragging: boolean
  /** How many items in this drag operation? */
  readonly dragCount: number
  /** Surface this drag originates from */
  readonly surfaceId: string
}

export const TransferSourceTrait = createTrait<TransferSourceSlot>({
  id: 'transfer/source',
  render: () => null, // Feedback via style + className, not JSX
  style: (slot) =>
    slot.isDragging
      ? { opacity: 0.4, pointerEvents: 'none' as const, transition: 'opacity 120ms ease-out' }
      : {},
  className: (slot) =>
    slot.isDragging ? 'transfer-source--dragging' : '',
})

// ── Target Trait ─────────────────────────────────────────────

export interface TransferTargetSlot {
  /** Is a drag currently hovering over this target? */
  readonly isOver: boolean
  /** Would the current drag be accepted? */
  readonly canAccept: boolean
  /** The token being offered (for preview rendering) */
  readonly pendingToken: TransferToken | null
}

export const TransferTargetTrait = createTrait<TransferTargetSlot>({
  id: 'transfer/target',
  render: () => null, // Feedback via style + className
  style: (slot) => {
    if (!slot.isOver) return {}
    return slot.canAccept
      ? { outline: '1px solid var(--rvn-accent-cyan, #00e5ff)', outlineOffset: '-1px' }
      : { outline: '1px dashed var(--rvn-status-error, #ff4444)', outlineOffset: '-1px' }
  },
  className: (slot) => {
    if (!slot.isOver) return ''
    return slot.canAccept ? 'transfer-target--accept' : 'transfer-target--reject'
  },
})

// ── Feedback Trait ────────────────────────────────────────────

export interface TransferFeedbackSlot {
  /** Recent transfer event for ephemeral feedback */
  readonly lastEvent: TransferFeedbackEvent | null
}

export const TransferFeedbackTrait = createTrait<TransferFeedbackSlot>({
  id: 'transfer/feedback',
  render: (slot) => {
    if (!slot.lastEvent) return null

    switch (slot.lastEvent._tag) {
      case 'Copied':
        return React.createElement(
          'div',
          { className: 'transfer-copy-badge', 'data-animate': 'fade-up' },
          `Copied ${slot.lastEvent.tokenCount} task${slot.lastEvent.tokenCount > 1 ? 's' : ''}`,
        )
      case 'Accepted':
        return React.createElement('div', {
          className: 'transfer-accept-flash',
          'data-token-count': slot.lastEvent.tokenCount,
        })
      case 'Rejected':
        return React.createElement(
          'div',
          { className: 'transfer-reject-indicator' },
          slot.lastEvent.reason,
        )
    }
  },
  className: (slot) => {
    if (!slot.lastEvent) return ''
    return `transfer-feedback--${slot.lastEvent._tag.toLowerCase()}`
  },
})
