/**
 * DefectDetail — critical defects (bugs). Raw cause shown inline.
 *
 * 4 codes: stream-defect, assistant-round-defect,
 *          session-prompt-defect, daemon-defect.
 *
 * @module harness/error-detail/details/defect-detail
 */

import { memo, useMemo } from 'react'
import { useErrorDetail } from '../detail-context'
import { DetailHeader, DetailMessage, MetadataGrid, InlineRawCause, CopyDiagnosticButton, formatTimestamp, type MetadataRow } from '../detail-parts'
import type { ActionDef } from '../types'

const ACTIONS: ReadonlyArray<ActionDef> = [
  { label: 'Copy Diagnostic', action: 'copy-diagnostic', primary: true },
  { label: 'Reconnect', action: 'reconnect' },
  { label: 'Dismiss', action: 'dismiss' },
]

/** Extract cause string from details payload */
function extractCause(details: unknown): string {
  if (!details) return ''
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details) as Record<string, unknown>
      if (typeof parsed.cause === 'string') return parsed.cause
      if (parsed.cause && typeof (parsed.cause as any).stack === 'string') return (parsed.cause as any).stack
      return JSON.stringify(parsed, null, 2)
    } catch {
      return details
    }
  }
  if (typeof details === 'object') {
    const d = details as Record<string, unknown>
    if (typeof d.cause === 'string') return d.cause
    if (d.cause && typeof (d.cause as any).stack === 'string') return (d.cause as any).stack
    if (d.cause && typeof (d.cause as any).message === 'string') return (d.cause as any).message
    return JSON.stringify(details, null, 2)
  }
  return String(details)
}

export const DefectDetail = memo(function DefectDetail() {
  const { state, actions, meta: { config } } = useErrorDetail()

  const rows = useMemo<ReadonlyArray<MetadataRow>>(() => [
    { label: 'code', value: state.code },
    { label: 'at', value: formatTimestamp(state.at) },
  ], [state.code, state.at])

  const cause = useMemo(() => extractCause(state.details), [state.details])

  return (
    <>
      <DetailHeader />
      <DetailMessage />
      {cause && <InlineRawCause cause={cause} />}
      <MetadataGrid rows={rows} />
      {/* Custom footer: CopyDiagnostic (special button) + Reconnect + Dismiss */}
      <div
        className="flex items-center gap-1 px-2 py-1"
        style={{ borderTop: `1px solid ${config.borderTint.replace('0.3', '0.06')}` }}
      >
        <CopyDiagnosticButton />
        <button
          type="button"
          onClick={() => actions.onReconnect?.()}
          className="font-mono transition-colors hover:brightness-125"
          style={{
            fontSize: '9px',
            color: '#f87171',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 2,
            padding: '1px 6px',
          }}
        >
          Reconnect
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

export { ACTIONS as DEFECT_ACTIONS }
