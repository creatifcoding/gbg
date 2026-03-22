/**
 * DefectDetail — critical defects (bugs). Raw cause shown inline.
 *
 * 4 codes: stream-defect, assistant-round-defect,
 *          session-prompt-defect, daemon-defect.
 *
 * Custom footer: CopyDiagnosticButton + remaining config.actions.
 * Actions derived from config.actions.
 *
 * @module harness/error-detail/details/defect-detail
 */

import { memo, useMemo, useCallback } from 'react'
import { useErrorDetail } from '../detail-context'
import { DetailHeader, DetailMessage, MetadataGrid, InlineRawCause, CopyDiagnosticButton, ActionButton, formatTimestamp, type MetadataRow } from '../detail-parts'
import { SEMANTIC, separatorColor } from '../tokens'

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

  // Non-diagnostic, non-dismiss actions from config
  const middleActions = useMemo(
    () => config.actions.filter((a) => a.action !== 'copy-diagnostic' && a.action !== 'dismiss'),
    [config.actions],
  )
  const dismissAction = config.actions.find((a) => a.action === 'dismiss')

  const dispatch = useCallback((action: string) => {
    switch (action) {
      case 'reconnect': return actions.onReconnect?.()
      case 'dismiss': return actions.onDismiss()
    }
  }, [actions])

  return (
    <>
      <DetailHeader />
      <DetailMessage />
      {cause && <InlineRawCause cause={cause} />}
      <MetadataGrid rows={rows} />
      {/* Custom footer: CopyDiagnostic (special) + config-derived actions */}
      <div
        className="flex items-center gap-1 px-2 py-1"
        style={{ borderTop: `1px solid ${separatorColor(config.accent)}` }}
      >
        <CopyDiagnosticButton />
        {middleActions.map((def) => (
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
