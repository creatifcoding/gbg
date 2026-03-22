/**
 * SessionErrorDetail — session-missing, not-found, load-failed, events-load-failed.
 *
 * Shows truncated session ID + recovery actions.
 * Actions derived from config.actions.
 *
 * @module harness/error-detail/details/session-error-detail
 */

import { memo, useMemo } from 'react'
import { useErrorDetail } from '../detail-context'
import { DetailHeader, DetailMessage, MetadataGrid, RawAccordion, ActionFooter, formatTimestamp, type MetadataRow } from '../detail-parts'

/** Truncate session ID for display */
function truncateSid(sid: string | null | undefined): string {
  if (!sid) return '—'
  return sid.length > 16 ? `${sid.slice(0, 16)}…` : sid
}

export const SessionErrorDetail = memo(function SessionErrorDetail() {
  const { state, meta } = useErrorDetail()

  const rows = useMemo<ReadonlyArray<MetadataRow>>(() => [
    { label: 'code', value: state.code },
    { label: 'session', value: truncateSid(meta.sessionId) },
    { label: 'at', value: formatTimestamp(state.at) },
  ], [state.code, meta.sessionId, state.at])

  return (
    <>
      <DetailHeader />
      <DetailMessage />
      <MetadataGrid rows={rows} />
      <RawAccordion />
      <ActionFooter />
    </>
  )
})
