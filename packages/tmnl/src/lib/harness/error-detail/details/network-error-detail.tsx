/**
 * NetworkErrorDetail — network-unavailable.
 *
 * Shows navigator.onLine status and network metadata.
 * Actions derived from config.actions.
 *
 * @module harness/error-detail/details/network-error-detail
 */

import { memo, useMemo } from 'react'
import { useErrorDetail } from '../detail-context'
import { DetailHeader, DetailMessage, MetadataGrid, RawAccordion, ActionFooter, formatTimestamp, type MetadataRow } from '../detail-parts'

export const NetworkErrorDetail = memo(function NetworkErrorDetail() {
  const { state } = useErrorDetail()

  const online = typeof navigator !== 'undefined' ? navigator.onLine : true

  const rows = useMemo<ReadonlyArray<MetadataRow>>(() => [
    { label: 'code', value: state.code },
    { label: 'online', value: online ? 'yes' : 'no', accent: !online },
    { label: 'at', value: formatTimestamp(state.at) },
  ], [state.code, online, state.at])

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
