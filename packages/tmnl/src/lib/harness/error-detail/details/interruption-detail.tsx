/**
 * InterruptionDetail — minimal card for user-initiated abort.
 *
 * 1 code: aborted.
 * No metadata grid, no raw payload. Just header + resume.
 *
 * @module harness/error-detail/details/interruption-detail
 */

import { memo } from 'react'
import { useErrorDetail } from '../detail-context'
import { formatTimestamp } from '../detail-parts'
import type { ActionDef } from '../types'

const ACTIONS: ReadonlyArray<ActionDef> = [
  { label: 'Resume', action: 'resume', primary: true },
  { label: 'Dismiss', action: 'dismiss' },
]

export const InterruptionDetail = memo(function InterruptionDetail() {
  const { state, actions, meta: { config } } = useErrorDetail()
  const IconComponent = config.Icon

  return (
    <>
      {/* Header — icon + label + timestamp + dismiss */}
      <div
        className="flex items-center gap-1.5 px-2 py-0"
        style={{ height: 22, borderBottom: `1px solid ${config.borderTint}` }}
      >
        <IconComponent size={11} strokeWidth={1.5} style={{ color: config.accent, flexShrink: 0 }} />
        <span
          className="font-mono font-medium"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)', color: config.accent }}
        >
          Cancelled
        </span>
        <span className="ml-auto font-mono" style={{ fontSize: '9px', color: config.accent }}>
          {formatTimestamp(state.at)}
        </span>
        <button
          type="button"
          onClick={actions.onDismiss}
          className="shrink-0 text-neutral-600 hover:text-neutral-400 transition-colors"
          aria-label="Dismiss"
        >
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      {/* Actions — Resume + Dismiss */}
      <div
        className="flex items-center gap-1 px-2 py-1"
        style={{ borderTop: `1px solid ${config.borderTint.replace('0.2', '0.06')}` }}
      >
        <button
          type="button"
          className="font-mono transition-colors hover:brightness-125"
          style={{
            fontSize: '9px',
            color: config.accent,
            border: `1px solid ${config.borderTint}`,
            borderRadius: 2,
            padding: '1px 6px',
          }}
        >
          Resume
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={actions.onDismiss}
          className="font-mono transition-colors hover:brightness-125"
          style={{
            fontSize: '9px',
            color: '#404040',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 2,
            padding: '1px 6px',
          }}
        >
          Dismiss
        </button>
      </div>
    </>
  )
})

export { ACTIONS as INTERRUPTION_ACTIONS }
