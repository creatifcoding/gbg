/**
 * ToolErrorDetail — tool execution, not-found, timeout, round-limit.
 *
 * Parses tool name and round limit from message text.
 * Actions derived from config.actions.
 *
 * @module harness/error-detail/details/tool-error-detail
 */

import { memo, useMemo } from 'react'
import { useErrorDetail } from '../detail-context'
import { DetailHeader, DetailMessage, MetadataGrid, RawAccordion, ActionFooter, formatTimestamp, type MetadataRow } from '../detail-parts'

/** Parse tool name from message: "Tool 'execute_code' failed" */
function parseToolName(msg: string): string | null {
  const m = msg.match(/Tool '([^']+)'/)
  return m ? m[1] : null
}

/** Parse round limit from message: "rounds (5)" or "max tool rounds (10)" */
function parseRoundLimit(msg: string): string | null {
  const m = msg.match(/rounds?\s*\((\d+)\)/i) ?? msg.match(/max tool rounds \((\d+)\)/i)
  return m ? m[1] : null
}

export const ToolErrorDetail = memo(function ToolErrorDetail() {
  const { state } = useErrorDetail()

  const toolName = useMemo(() => parseToolName(state.message), [state.message])
  const roundLimit = useMemo(() => parseRoundLimit(state.message), [state.message])

  const rows = useMemo<ReadonlyArray<MetadataRow>>(() => {
    const out: MetadataRow[] = []
    if (toolName) out.push({ label: 'tool', value: toolName, accent: true })
    out.push({ label: 'code', value: state.code })
    if (roundLimit) out.push({ label: 'round limit', value: roundLimit })
    out.push({ label: 'at', value: formatTimestamp(state.at) })
    return out
  }, [toolName, state.code, roundLimit, state.at])

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
