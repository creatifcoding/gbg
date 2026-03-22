/**
 * FallbackDetail — generic detail for operational/silent categories.
 *
 * Handles: SessionCrudError, CompactionError, TimeoutError,
 *          AdapterDefect, StoreDefect.
 *
 * Actions derived from config.actions — no local ACTIONS array.
 *
 * @module harness/error-detail/details/fallback-detail
 */

import { memo, useMemo } from 'react'
import { useErrorDetail } from '../detail-context'
import { DetailHeader, DetailMessage, MetadataGrid, RawAccordion, ActionFooter, formatTimestamp, type MetadataRow } from '../detail-parts'

export const FallbackDetail = memo(function FallbackDetail() {
  const { state } = useErrorDetail()

  const rows = useMemo<ReadonlyArray<MetadataRow>>(() => [
    { label: 'code', value: state.code },
    { label: 'at', value: formatTimestamp(state.at) },
  ], [state.code, state.at])

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
