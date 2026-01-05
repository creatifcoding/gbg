/**
 * useMarkdownContent - Markdown to TipTap JSONContent hook
 *
 * Parses markdown text into TipTap JSONContent using MarkdownService.
 * Supports buffered streaming mode for flicker-free incremental rendering.
 *
 * @module terminal/v3/hooks/useMarkdownContent
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Effect } from 'effect'
import type { JSONContent } from '@tiptap/core'
import { MarkdownService } from '@/lib/editor/v3/services/MarkdownService'

// =============================================================================
// Types
// =============================================================================

export interface UseMarkdownContentOptions {
  /**
   * Whether the content is actively streaming.
   * When true, applies buffering at line boundaries.
   */
  isStreaming?: boolean

  /**
   * Debounce delay for parsing during streaming (ms).
   * Default: 50ms
   */
  debounceMs?: number

  /**
   * Minimum characters before first parse.
   * Default: 10
   */
  minChars?: number
}

export interface MarkdownContentResult {
  /** Parsed TipTap JSONContent, or null if not yet parsed */
  content: JSONContent | null

  /** The text that was successfully parsed (may lag raw text during streaming) */
  parsedText: string

  /** Whether parsing is in progress */
  isParsing: boolean

  /** Parsing error if any */
  error: Error | null

  /** Force re-parse the current text */
  reparse: () => void
}

// =============================================================================
// Buffer Utilities
// =============================================================================

/**
 * Get safe-to-render text by buffering at line boundaries during streaming.
 * This prevents partial markdown constructs from causing render flicker.
 */
function getBufferedText(text: string, isStreaming: boolean): string {
  if (!isStreaming || !text) return text

  // Find last complete line (ends with newline)
  const lastNewline = text.lastIndexOf('\n')

  // If we have complete lines, return up to the last one
  if (lastNewline > 0) {
    return text.slice(0, lastNewline)
  }

  // No complete lines yet - check for code fence start
  // Don't render partial code blocks
  if (text.includes('```') && !text.match(/```[\s\S]*?```/)) {
    const fenceStart = text.indexOf('```')
    return fenceStart > 0 ? text.slice(0, fenceStart) : ''
  }

  // For short text without newlines, return as-is
  return text
}

/**
 * Check if text has incomplete markdown constructs that should be buffered.
 */
function hasIncompleteConstructs(text: string): boolean {
  // Unclosed code fence
  const fenceMatches = text.match(/```/g)
  if (fenceMatches && fenceMatches.length % 2 !== 0) return true

  // Unclosed inline code
  const inlineCodeMatches = text.match(/(?<!`)`(?!`)/g)
  if (inlineCodeMatches && inlineCodeMatches.length % 2 !== 0) return true

  // Ends mid-link: [text](url incomplete
  if (/\[[^\]]*\]\([^)]*$/.test(text)) return true

  // Ends mid-bold/italic
  if (/\*[^*]*$/.test(text) && !/\*\*[^*]*\*\*$/.test(text)) return true

  return false
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMarkdownContent(
  text: string,
  options: UseMarkdownContentOptions = {}
): MarkdownContentResult {
  const { isStreaming = false, debounceMs = 50, minChars = 10 } = options

  const [content, setContent] = useState<JSONContent | null>(null)
  const [parsedText, setParsedText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track last parsed text to avoid redundant parses
  const lastParsedRef = useRef('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Parse function with Effect integration
  const parseMarkdown = useCallback(async (markdown: string) => {
    if (!markdown || markdown.trim() === '') {
      setContent({ type: 'doc', content: [{ type: 'paragraph' }] })
      setParsedText('')
      setIsParsing(false)
      return
    }

    // Cancel any in-flight parse
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setIsParsing(true)
    setError(null)

    try {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* MarkdownService
          return yield* service.parse(markdown)
        }).pipe(Effect.provide(MarkdownService.Default))
      )

      // Check if aborted
      if (abortRef.current?.signal.aborted) return

      setContent(result)
      setParsedText(markdown)
      lastParsedRef.current = markdown
      setError(null)
    } catch (err) {
      if (abortRef.current?.signal.aborted) return

      setError(err instanceof Error ? err : new Error(String(err)))
      // Keep previous content on error
    } finally {
      setIsParsing(false)
    }
  }, [])

  // Main effect: parse text with streaming-aware buffering
  useEffect(() => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    // Skip if text too short and streaming
    if (isStreaming && text.length < minChars) {
      return
    }

    // Get buffered text for streaming mode
    const textToRender = getBufferedText(text, isStreaming)

    // Skip if unchanged
    if (textToRender === lastParsedRef.current) {
      return
    }

    // Skip if incomplete constructs during streaming
    if (isStreaming && hasIncompleteConstructs(textToRender)) {
      return
    }

    // Debounce during streaming
    if (isStreaming) {
      debounceRef.current = setTimeout(() => {
        parseMarkdown(textToRender)
      }, debounceMs)
    } else {
      // Immediate parse when not streaming
      parseMarkdown(textToRender)
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [text, isStreaming, debounceMs, minChars, parseMarkdown])

  // Final parse when streaming ends
  useEffect(() => {
    if (!isStreaming && text !== lastParsedRef.current && text.length > 0) {
      parseMarkdown(text)
    }
  }, [isStreaming, text, parseMarkdown])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Manual reparse function
  const reparse = useCallback(() => {
    lastParsedRef.current = ''
    parseMarkdown(text)
  }, [text, parseMarkdown])

  return useMemo(
    () => ({
      content,
      parsedText,
      isParsing,
      error,
      reparse,
    }),
    [content, parsedText, isParsing, error, reparse]
  )
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Simple hook for static (non-streaming) markdown content.
 */
export function useStaticMarkdownContent(text: string): JSONContent | null {
  const { content } = useMarkdownContent(text, { isStreaming: false })
  return content
}

/**
 * Hook for streaming markdown with default buffering.
 */
export function useStreamingMarkdownContent(
  text: string,
  isStreaming: boolean
): MarkdownContentResult {
  return useMarkdownContent(text, { isStreaming })
}
