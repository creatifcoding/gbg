/**
 * StreamErrorDetail — telemetry strip for stream lifecycle failures.
 *
 * 8 codes: pi-ai-stream-init-failed, pi-ai-stream-failed,
 * pi-ai-stream-result-failed, stream-timeout, stream-result-timeout,
 * stream-wallclock-timeout, stream-fetch-timeout, stream-error.
 *
 * @module harness/error-detail/details/stream-error-detail
 */

import { memo, useMemo } from 'react'
import { useErrorDetail } from '../detail-context'
import { DetailHeader, DetailMessage, MetadataGrid, RawAccordion, ActionFooter, formatTimestamp, type MetadataRow } from '../detail-parts'
import type { ActionDef } from '../types'

const ACTIONS: ReadonlyArray<ActionDef> = [
  { label: 'Retry Stream', action: 'reconnect', primary: true },
  { label: 'Dismiss', action: 'dismiss' },
]

/** Parse timeout threshold from message: "after 30000ms" */
function parseThreshold(msg: string): string | null {
  const m = msg.match(/(?:after|timed out after)\s+(\d+)ms/i)
  return m ? `${m[1]}ms` : null
}

/** Parse round info from message: "(round 2)" or "rounds (5)" */
function parseRound(msg: string): string | null {
  const m = msg.match(/\(round\s+(\d+)\)/i) ?? msg.match(/rounds?\s*\((\d+)\)/i)
  return m ? m[1] : null
}

export const StreamErrorDetail = memo(function StreamErrorDetail() {
  const { state } = useErrorDetail()

  const rows = useMemo<ReadonlyArray<MetadataRow>>(() => {
    const out: MetadataRow[] = [
      { label: 'code', value: state.code },
    ]
    const threshold = parseThreshold(state.message)
    if (threshold) out.push({ label: 'threshold', value: threshold })
    const round = parseRound(state.message)
    if (round) out.push({ label: 'round', value: round })
    out.push({ label: 'at', value: formatTimestamp(state.at) })
    return out
  }, [state.code, state.message, state.at])

  return (
    <>
      <DetailHeader />
      <DetailMessage />
      <MetadataGrid rows={rows} />
      <RawAccordion />
      <ActionFooter defs={ACTIONS} />
    </>
  )
})

export { ACTIONS as STREAM_ACTIONS }
