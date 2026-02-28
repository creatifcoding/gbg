/**
 * InterruptionDetail — minimal card for user-initiated abort.
 *
 * 1 code: aborted.
 * No metadata grid, no raw payload. Just header + actions.
 * Actions derived from config.actions.
 *
 * @module harness/error-detail/details/interruption-detail
 */

import { memo, useCallback } from 'react'
import { useErrorDetail } from '../detail-context'
import { ActionButton, formatTimestamp } from '../detail-parts'
import { SEMANTIC, separatorColor } from '../tokens'

export const InterruptionDetail = memo(function InterruptionDetail() {
  const { state, actions, meta: { config } } = useErrorDetail()
  const IconComponent = config.Icon

  const primaryActions = config.actions.filter((a) => a.action !== 'dismiss')
  const dismissAction = config.actions.find((a) => a.action === 'dismiss')

  const dispatch = useCallback((action: string) => {
    if (action === 'dismiss') actions.onDismiss()
    // 'resume' — future
  }, [actions])

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
          {config.label}
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
      {/* Actions — from config */}
      <div
        className="flex items-center gap-1 px-2 py-1"
        style={{ borderTop: `1px solid ${separatorColor(config.accent)}` }}
      >
        {primaryActions.map((def) => (
          <ActionButton
            key={def.action}
            def={def}
            accent={def.accent ?? config.accent}
            onClick={() => dispatch(def.action)}
          />
        ))}
        <span className="flex-1" />
        {dismissAction && (
          <ActionButton
            def={dismissAction}
            accent={SEMANTIC.muted}
            onClick={actions.onDismiss}
          />
        )}
      </div>
    </>
  )
})
