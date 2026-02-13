import { useCallback } from 'react'
import {
  fromReferenceClipboardText,
  fromReferenceClipboardTextList,
  toReferenceClipboardText,
  toReferenceClipboardTextList,
} from '../codec'
import {
  copyTransferToken,
  copyTransferTokens,
  getTransferClipboardToken,
  getTransferClipboardTokens,
} from '../transfer-stx'
import type { TransferReferenceToken } from '../types'

export interface UseTransferClipboardOptions {
  resolveTokenForSelection?: (selectionIds: ReadonlyArray<string>) => TransferReferenceToken | null
  resolveTokensForSelection?: (selectionIds: ReadonlyArray<string>) => ReadonlyArray<TransferReferenceToken>
}

export interface UseTransferClipboardResult {
  copyToken: (token: TransferReferenceToken, sourceSelectionIds?: ReadonlyArray<string>) => Promise<void>
  copyTokens: (tokens: ReadonlyArray<TransferReferenceToken>, sourceSelectionIds?: ReadonlyArray<string>) => Promise<void>
  copySelection: (selectionIds: ReadonlyArray<string>) => Promise<ReadonlyArray<TransferReferenceToken>>
  readClipboardToken: () => Promise<TransferReferenceToken | null>
  readClipboardTokens: () => Promise<ReadonlyArray<TransferReferenceToken>>
}

export function useTransferClipboard({
  resolveTokenForSelection,
  resolveTokensForSelection,
}: UseTransferClipboardOptions = {}): UseTransferClipboardResult {
  const copyToken = useCallback(
    async (token: TransferReferenceToken, sourceSelectionIds: ReadonlyArray<string> = []) => {
      copyTransferToken(token, sourceSelectionIds)

      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        return
      }

      try {
        await navigator.clipboard.writeText(toReferenceClipboardText(token))
      } catch {
        // Non-fatal clipboard permission failure.
      }
    },
    [],
  )

  const copyTokens = useCallback(
    async (tokens: ReadonlyArray<TransferReferenceToken>, sourceSelectionIds: ReadonlyArray<string> = []) => {
      if (tokens.length === 0) {
        return
      }

      copyTransferTokens(tokens, sourceSelectionIds)

      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        return
      }

      try {
        await navigator.clipboard.writeText(toReferenceClipboardTextList(tokens))
      } catch {
        // Non-fatal clipboard permission failure.
      }
    },
    [],
  )

  const copySelection = useCallback(
    async (selectionIds: ReadonlyArray<string>) => {
      if (resolveTokensForSelection) {
        const tokens = resolveTokensForSelection(selectionIds)
        await copyTokens(tokens, selectionIds)
        return tokens
      }

      if (!resolveTokenForSelection) {
        return []
      }

      const token = resolveTokenForSelection(selectionIds)
      if (!token) {
        return []
      }

      await copyToken(token, selectionIds)
      return [token]
    },
    [copyToken, copyTokens, resolveTokenForSelection, resolveTokensForSelection],
  )

  const readClipboardTokens = useCallback(async () => {
    const memoryTokens = getTransferClipboardTokens()
    if (memoryTokens.length > 0) {
      return memoryTokens
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return []
    }

    try {
      const text = await navigator.clipboard.readText()
      const tokens = fromReferenceClipboardTextList(text)
      if (tokens.length > 0) {
        return tokens
      }
      const single = fromReferenceClipboardText(text)
      return single ? [single] : []
    } catch {
      return []
    }
  }, [])

  const readClipboardToken = useCallback(async () => {
    const memoryToken = getTransferClipboardToken()
    if (memoryToken) {
      return memoryToken
    }

    const tokens = await readClipboardTokens()
    return tokens[0] ?? null
  }, [readClipboardTokens])

  return {
    copyToken,
    copyTokens,
    copySelection,
    readClipboardToken,
    readClipboardTokens,
  }
}
