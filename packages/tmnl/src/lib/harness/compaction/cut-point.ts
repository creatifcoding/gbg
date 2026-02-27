import type { Message } from '@mariozechner/pi-ai'

export interface CutPointResult {
  /** Index of first message to KEEP (everything before this gets summarized) */
  readonly cutIndex: number
  /** Messages to summarize (indices 0..cutIndex-1) */
  readonly messagesToSummarize: readonly Message[]
  /** Messages to keep verbatim (indices cutIndex..end) */
  readonly messagesToKeep: readonly Message[]
  /** Whether the cut splits a turn (assistant + tool results) */
  readonly isSplitTurn: boolean
  /** Estimated tokens in messages to keep */
  readonly keptTokenEstimate: number
}

/**
 * Estimate tokens for a message (chars / 4 heuristic).
 */
export function estimateMessageTokens(message: Message): number {
  let chars = 0

  if (message.role === 'user') {
    if (typeof message.content === 'string') {
      chars = message.content.length
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'text') chars += part.text.length
      }
    }
  } else if (message.role === 'assistant') {
    for (const part of message.content) {
      if (part.type === 'text') {
        chars += part.text.length
      } else if (part.type === 'toolCall') {
        chars += JSON.stringify(part.arguments).length + part.name.length
      }
    }
  } else if (message.role === 'toolResult') {
    for (const part of message.content) {
      if (part.type === 'text') chars += part.text.length
    }
  }

  return Math.ceil(chars / 4)
}

/**
 * Find the optimal cut point in a message array.
 *
 * Algorithm:
 * 1. Walk backward from the end, accumulating token estimates
 * 2. When accumulated >= keepRecentTokens, mark potential cut point
 * 3. Adjust cut point to never split tool call/result pairs:
 *    - If cut lands on a toolResult, move cut backward to include the
 *      preceding assistant message that contains the tool call
 *    - If cut lands on an assistant with tool calls, include all
 *      subsequent tool results
 * 4. Return the cut point and partitioned messages
 */
export function findCutPoint(
  messages: readonly Message[],
  keepRecentTokens: number,
): CutPointResult | null {
  if (messages.length <= 2) return null

  let accumulated = 0
  let rawCutIndex = -1

  for (let i = messages.length - 1; i >= 0; i--) {
    accumulated += estimateMessageTokens(messages[i])
    if (accumulated >= keepRecentTokens) {
      rawCutIndex = i
      break
    }
  }

  if (rawCutIndex <= 0) return null

  let cutIndex = rawCutIndex

  while (cutIndex > 0 && messages[cutIndex].role === 'toolResult') {
    cutIndex--
  }

  if (cutIndex < messages.length && messages[cutIndex].role === 'assistant') {
    const assistant = messages[cutIndex]
    const hasToolCalls = assistant.content.some((contentPart) => contentPart.type === 'toolCall')

    if (hasToolCalls) {
      let j = cutIndex + 1
      while (j < messages.length && messages[j].role === 'toolResult') {
        j++
      }
      cutIndex = j
    }
  }

  if (cutIndex >= messages.length - 1) return null
  if (cutIndex <= 0) return null

  const messagesToSummarize = messages.slice(0, cutIndex)
  const messagesToKeep = messages.slice(cutIndex)

  let keptTokenEstimate = 0
  for (const message of messagesToKeep) {
    keptTokenEstimate += estimateMessageTokens(message)
  }

  return {
    cutIndex,
    messagesToSummarize,
    messagesToKeep,
    isSplitTurn: rawCutIndex !== cutIndex,
    keptTokenEstimate,
  }
}
