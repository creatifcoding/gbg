import { Atom } from '@effect-atom/atom'
import type { ExtensionUIRequest } from '@/lib/ai-core'

export type CopChatConnectionState = 'idle' | 'connecting' | 'ready' | 'error'

export interface CopChatMessageRow {
  readonly id: string
  readonly role: 'user' | 'assistant' | 'system' | 'unknown'
  readonly text: string
  readonly thinking: string | null
  readonly isStreaming: boolean
  readonly createdAt: number
}

export const copChatConnectionStateAtom = Atom.make<CopChatConnectionState>('idle')
export const copChatMessagesAtom = Atom.make<readonly CopChatMessageRow[]>([])
export const copChatInputAtom = Atom.make('')
export const copChatIsStreamingAtom = Atom.make(false)
export const copChatErrorAtom = Atom.make<string | null>(null)
export const copChatPendingExtensionUIAtom = Atom.make<readonly ExtensionUIRequest[]>([])
export const copChatBreakoutRequestIdAtom = Atom.make<string | null>(null)
export const copChatExtensionDraftsAtom = Atom.make<Record<string, string>>({})
export const copChatResolvingIdsAtom = Atom.make<readonly string[]>([])

export const copChatPendingCountAtom = Atom.make((get) => get(copChatPendingExtensionUIAtom).length)

export const copChatActiveBreakoutAtom = Atom.make((get) => {
  const requestId = get(copChatBreakoutRequestIdAtom)
  if (!requestId) return null
  const pending = get(copChatPendingExtensionUIAtom)
  return pending.find((entry) => entry.requestId === requestId) ?? null
})
