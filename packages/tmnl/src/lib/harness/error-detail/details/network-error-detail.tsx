/**
 * NetworkErrorDetail — for network-unavailable.
 *
 * @module harness/error-detail/details/network-error-detail
 */

import { memo, useMemo } from 'react'
import { useErrorDetail } from '../detail-context'
import { DetailHeader, DetailMessage, MetadataGrid, RawAccordion, ActionFooter, formatTimestamp, type MetadataRow } from '../detail-parts'
import type { ActionDef } from '../types'

const ACTIONS: ReadonlyArray<ActionDef> = [
  { label: 'Check Connection', action: 'reconnect', primary: true },
  { label: 'Retry', action: 'reconnect' },
  { label: 'Dismiss', action: 'dismiss' },
]

export const NetworkErrorDetail = memo(function NetworkErrorDetail() {
  const { state } = useErrorDetail()

  const rows = useMemo<ReadonlyArray<MetadataRow>>(() => [
    { label: 'code', value: state.code },
    { label: 'online', value: typeof navigator !== 'undefined' ? (navigator.onLine ? 'true' : 'false') : '—' },
    { label: 'at', value: formatTimestamp(state.at) },
  ], [state.code, state.at])

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

export { ACTIONS as NETWORK_ACTIONS }
