/**
 * StreamErrorDetail — 8 stream error codes.
 *
 * Telemetry strip: threshold, round, latency parsed from message.
 * Actions derived from config.actions (no local ACTIONS array).
 *
 * @module harness/error-detail/details/stream-error-detail
 */

import { memo, useMemo } from 'react'
import { useErrorDetail } from '../detail-context'
import { DetailHeader, DetailMessage, MetadataGrid, RawAccordion, ActionFooter, formatTimestamp, type MetadataRow } from '../detail-parts'

/** Parse timeout threshold from message: "after 30000ms" */
function parseThreshold(msg: string): string | null {
  const m = msg.match(/after\s+(\d+)ms/i) ?? msg.match(/timeout\s+(\d+)/i)
  return m ? `${m[1]}ms` : null
}

/** Parse round from message: "round 3" */
function parseRound(msg: string): string | null {
  const m = msg.match(/round\s+(\d+)/i)
  return m ? m[1] : null
}

export const StreamErrorDetail = memo(function StreamErrorDetail() {
  const { state } = useErrorDetail()

  const threshold = useMemo(() => parseThreshold(state.message), [state.message])
  const round = useMemo(() => parseRound(state.message), [state.message])

  const rows = useMemo<ReadonlyArray<MetadataRow>>(() => {
    const out: MetadataRow[] = [{ label: 'code', value: state.code }]
    if (threshold) out.push({ label: 'threshold', value: threshold })
    if (round) out.push({ label: 'round', value: round })
    out.push({ label: 'at', value: formatTimestamp(state.at) })
    return out
  }, [state.code, threshold, round, state.at])

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
