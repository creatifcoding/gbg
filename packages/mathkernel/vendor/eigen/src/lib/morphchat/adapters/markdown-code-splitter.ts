/**
 * splitTextToCodeParts — Hybrid markdown→CodePart splitting.
 *
 * Runs on assistant_final to split TextParts containing markdown code fences
 * (```language\ncode\n```) into interleaved TextPart + CodePart sequences.
 *
 * During streaming, text renders as-is. On completion, code blocks get
 * structured rendering with syntax highlighting, copy, truncation.
 *
 * @module morphchat/adapters/markdown-code-splitter
 */

import type { ChatMessagePart } from '../schemas/message-types'

// =============================================================================
// Regex: matches ```lang\ncode\n``` including optional language + filename
// =============================================================================

/**
 * Matches fenced code blocks:
 * - ```language\ncode\n```
 * - ```\ncode\n```
 * - ``` language:filename\ncode\n```
 *
 * Group 1: language (optional, e.g. "typescript", "python")
 * Group 2: filename (optional, after colon e.g. ":path/to/file.ts")
 * Group 3: code body
 */
const CODE_FENCE_RE = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g

// =============================================================================
// Public API
// =============================================================================

/**
 * Split a single text string into interleaved TextPart + CodePart array.
 *
 * Returns the original text as a single TextPart if no code fences found.
 */
export function splitTextToCodeParts(text: string): ChatMessagePart[] {
  const parts: ChatMessagePart[] = []
  let lastIndex = 0

  // Reset regex state
  CODE_FENCE_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = CODE_FENCE_RE.exec(text)) !== null) {
    const [, language, filename, code] = match
    const matchStart = match.index
    const matchEnd = CODE_FENCE_RE.lastIndex

    // Text before this code fence
    const textBefore = text.slice(lastIndex, matchStart).trim()
    if (textBefore.length > 0) {
      parts.push({
        _tag: 'text',
        content: textBefore,
      })
    }

    // The code block itself
    parts.push({
      _tag: 'code',
      code: code.trimEnd(), // trim trailing whitespace but preserve leading
      language: language || undefined,
      filename: filename || undefined,
    })

    lastIndex = matchEnd
  }

  // Remaining text after last code fence
  const textAfter = text.slice(lastIndex).trim()
  if (textAfter.length > 0) {
    parts.push({
      _tag: 'text',
      content: textAfter,
    })
  }

  // If no code fences found, return original as single TextPart
  if (parts.length === 0) {
    parts.push({
      _tag: 'text',
      content: text,
    })
  }

  return parts
}

/**
 * Process an array of ChatMessageParts, splitting any TextParts that contain
 * code fences. Non-text parts pass through unchanged.
 *
 * Call this on assistant_final to convert streaming text into structured parts.
 */
export function splitPartsCodeFences(parts: ReadonlyArray<ChatMessagePart>): ChatMessagePart[] {
  const result: ChatMessagePart[] = []

  for (const part of parts) {
    if (part._tag === 'text') {
      // Check if this text part contains any code fences
      CODE_FENCE_RE.lastIndex = 0
      if (CODE_FENCE_RE.test(part.content)) {
        result.push(...splitTextToCodeParts(part.content))
      } else {
        result.push(part)
      }
    } else {
      // Non-text parts pass through unchanged
      result.push(part)
    }
  }

  return result
}
