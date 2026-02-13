import { useCallback } from 'react'
import { useSelector } from '@/lib/stx'
import {
  cancelTransferSession,
  clearTransferClipboard,
  finishTransferSession,
  getTransferStx,
} from '../transfer-stx'

export function useTransferRuntime() {
  const stx = getTransferStx()

  const activeSession = useSelector(stx.data.activeSession, (value) => value)
  const hoverDecision = useSelector(stx.data.hoverDecision, (value) => value)
  const clipboard = useSelector(stx.data.clipboard, (value) => value)

  const clearClipboard = useCallback(() => {
    clearTransferClipboard()
  }, [])

  const cancelSession = useCallback(() => {
    cancelTransferSession()
  }, [])

  const finishSession = useCallback(() => {
    finishTransferSession()
  }, [])

  return {
    activeSession,
    hoverDecision,
    clipboard,
    isDragging: activeSession !== null,
    clearClipboard,
    cancelSession,
    finishSession,
  }
}
