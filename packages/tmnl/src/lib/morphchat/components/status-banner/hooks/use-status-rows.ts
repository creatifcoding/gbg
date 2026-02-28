/**
 * Row assembly hook — builds visible status rows from adapter state.
 *
 * @module morphchat/components/status-banner/hooks/use-status-rows
 */

import { useMemo } from 'react'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import type { StatusRowLike } from '../types'
import { toneForCode } from '../tone-styles'
import { parseErrorPayload } from '../parse-error'
import type { MorphChatAdapter } from '../../adapters/types'

const EMPTY_ROWS = Atom.make<ReadonlyArray<StatusRowLike>>([])
const EMPTY_LAST_ERROR = Atom.make<{ code: string; message: string; at: number } | null>(null)
const EMPTY_CANCELLED_AT = Atom.make<number | null>(null)

export interface StatusRowsResult {
  rows: ReadonlyArray<StatusRowLike>
  toastRows: ReadonlyArray<StatusRowLike>
  cancelledToastId: string | null
  showRecoveryActions: boolean
}

export function useStatusRows(adapter: MorphChatAdapter): StatusRowsResult {
  const connection = useAtomValue(adapter.connection$)
  const statusRowsAtom = (adapter.statusRows$ as typeof EMPTY_ROWS | undefined) ?? EMPTY_ROWS
  const adapterRows = useAtomValue(statusRowsAtom)
  const lastErrorAtom = ((adapter as any).lastError$ as typeof EMPTY_LAST_ERROR | undefined) ?? EMPTY_LAST_ERROR
  const lastError = useAtomValue(lastErrorAtom)
  const cancelledAtAtom = ((adapter as any).cancelledAt$ as typeof EMPTY_CANCELLED_AT | undefined) ?? EMPTY_CANCELLED_AT
  const cancelledAt = useAtomValue(cancelledAtAtom)

  const rows = useMemo<ReadonlyArray<StatusRowLike>>(() => {
    if (adapterRows.length > 0) return adapterRows
    const out: StatusRowLike[] = []
    if (lastError) {
      out.push({
        id: `last-error-${lastError.code}-${lastError.at}`,
        tone: toneForCode(lastError.code),
        text: `[${lastError.code}] ${lastError.message}`,
        code: lastError.code, details: lastError, source: 'harness',
      })
    }
    if (connection.phase === 'error') {
      const parsed = parseErrorPayload((connection as any).error ?? 'stream error')
      out.push({
        id: `conn-error-${parsed.code ?? 'unknown'}-${parsed.summary}`,
        tone: 'error', text: `HARNESS ${parsed.summary}`,
        code: parsed.code, details: parsed.details, source: 'harness',
      })
    }
    if (connection.phase === 'reconnecting') {
      out.push({
        id: `conn-reconnecting-${connection.reconnectAttempt ?? 0}`,
        tone: 'warn',
        text: `HARNESS reconnecting${connection.reconnectAttempt ? ` (attempt ${connection.reconnectAttempt})` : ''}`,
        source: 'harness',
      })
    }
    return out
  }, [adapterRows, connection.phase, connection.reconnectAttempt, (connection as any).error, lastError])

  const toastRows = useMemo(
    () => rows.filter(r => !r.text.startsWith('[sid]')),
    [rows],
  )

  const cancelledToastId = cancelledAt != null ? `cancelled-${cancelledAt}` : null
  const showRecoveryActions = connection.phase === 'error' || connection.phase === 'reconnecting'

  return { rows, toastRows, cancelledToastId, showRecoveryActions }
}
