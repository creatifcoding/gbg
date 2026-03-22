/**
 * useClipboardHandlers — Clipboard copy/paste for transfer tokens.
 *
 * Writes encoded tokens to system clipboard with in-memory fallback.
 * Reads and decodes from clipboard on paste.
 *
 * @since v2
 */
import { useCallback } from 'react'
import { encodeTokensText, decodeTokensTextOrEmpty } from '../codec'
import type { TransferToken, TransferClipboardEntry } from '../schemas'

interface ClipboardHandlersInput {
  readonly tokenMap: Map<string, TransferToken>
  readonly selection: ReadonlySet<string>
  readonly setClipboard: (entry: TransferClipboardEntry | null) => void
}

export function useClipboardHandlers({
  tokenMap,
  selection,
  setClipboard,
}: ClipboardHandlersInput) {
  const copyTokens = useCallback(
    async (tokens: ReadonlyArray<TransferToken>) => {
      if (tokens.length === 0) return
      const encoded = encodeTokensText(tokens)

      try {
        await navigator.clipboard.writeText(encoded)
      } catch {
        // Fallback: store in atom only
      }

      setClipboard({ tokens, copiedAt: Date.now() })
    },
    [setClipboard],
  )

  const copySingle = useCallback(
    (taskId: string) => {
      const token = tokenMap.get(taskId)
      if (token) copyTokens([token])
    },
    [tokenMap, copyTokens],
  )

  const copySelection = useCallback(() => {
    const tokens = Array.from(selection)
      .map((id) => tokenMap.get(id))
      .filter((t): t is TransferToken => t !== undefined)
    copyTokens(tokens)
  }, [selection, tokenMap, copyTokens])

  const copyCluster = useCallback(() => {
    const tokens = Array.from(tokenMap.values())
    copyTokens(tokens)
  }, [tokenMap, copyTokens])

  const readClipboard = useCallback(async (): Promise<ReadonlyArray<TransferToken>> => {
    try {
      const text = await navigator.clipboard.readText()
      return decodeTokensTextOrEmpty(text)
    } catch {
      return []
    }
  }, [])

  return { copySingle, copySelection, copyCluster, readClipboard }
}
