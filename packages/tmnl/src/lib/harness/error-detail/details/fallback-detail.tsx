/**
 * FallbackDetail — generic detail for operational/silent categories.
 *
 * Handles: SessionCrudError, CompactionError, TimeoutError,
 *          AdapterDefect, StoreDefect.
 *
 * @module harness/error-detail/details/fallback-detail
 */

import { memo, useMemo } from 'react'
import { useErrorDetail } from '../detail-context'
import { DetailHeader, DetailMessage, MetadataGrid, RawAccordion, ActionFooter, formatTimestamp, type MetadataRow } from '../detail-parts'
import type { ActionDef } from '../types'

const ACTIONS: ReadonlyArray<ActionDef> = [
  { label: 'Dismiss', action: 'dismiss' },
]

const ACTIONS_WITH_RETRY: ReadonlyArray<ActionDef> = [
  { label: 'Retry', action: 'reconnect', primary: true },
  { label: 'Dismiss', action: 'dismiss' },
]

export const FallbackDetail = memo(function FallbackDetail({ withRetry = false }: { withRetry?: boolean }) {
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
      <ActionFooter defs={withRetry ? ACTIONS_WITH_RETRY : ACTIONS} />
    </>
  )
})

export { ACTIONS as FALLBACK_ACTIONS, ACTIONS_WITH_RETRY as FALLBACK_ACTIONS_WITH_RETRY }
