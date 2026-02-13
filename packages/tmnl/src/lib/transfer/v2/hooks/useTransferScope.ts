/**
 * useTransferScope — React bridge for transfer scope atoms.
 *
 * Binds a TransferScopeConfig to family-keyed atoms.
 * useAtom gives [value, setter] tuple.
 *
 * @since v2
 */
import { useMemo } from 'react'
import { useAtom, useAtomValue } from '@effect-atom/atom-react'
import {
  createScopeHandle,
  type TransferScopeConfig,
  type TransferScopeHandle,
} from '../TransferScope'
import type { TransferSession, TransferClipboardEntry } from '../schemas'

export function useTransferScope(config: TransferScopeConfig) {
  const handle = useMemo(() => createScopeHandle(config), [config.surfaceId])

  const [session, setSession] = useAtom(handle.session)
  const [selection, setSelection] = useAtom(handle.selection)
  const [clipboard, setClipboard] = useAtom(handle.clipboard)

  return { handle, session, selection, clipboard, setSession, setSelection, setClipboard }
}
