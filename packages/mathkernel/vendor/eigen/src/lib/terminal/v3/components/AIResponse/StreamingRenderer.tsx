/**
 * StreamingRenderer - Buffered Streaming Markdown Renderer
 *
 * Renders AI response text as markdown with buffered streaming support.
 * During streaming, parses only complete lines to prevent flicker.
 * Falls back to plain text on parse errors.
 *
 * @module terminal/v3/components/AIResponse/StreamingRenderer
 */

import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useMarkdownContent } from '../../hooks/useMarkdownContent'
import { MarkdownEditorView } from './MarkdownEditorView'

// =============================================================================
// Props
// =============================================================================

export interface StreamingRendererProps {
  /** Raw text content (may be streaming) */
  text: string

  /** Whether content is actively streaming */
  isStreaming: boolean

  /** Additional CSS class */
  className?: string

  /** Force plain text rendering (no markdown) */
  plainText?: boolean

  /** Show parsing indicator during initial parse */
  showParsingIndicator?: boolean
}

// =============================================================================
// Plain Text Fallback
// =============================================================================

interface PlainTextViewProps {
  text: string
  isStreaming: boolean
  className?: string
}

function PlainTextView({ text, isStreaming, className }: PlainTextViewProps) {
  return (
    <div
      className={cn(
        'text-white/90 whitespace-pre-wrap font-mono',
        className
      )}
      style={{ fontSize: '13px', lineHeight: 1.6 }}
    >
      {text}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-0.5 bg-cyan-400 animate-pulse align-middle" />
      )}
    </div>
  )
}

// =============================================================================
// Component
// =============================================================================

function StreamingRendererComponent({
  text,
  isStreaming,
  className,
  plainText = false,
  showParsingIndicator = false,
}: StreamingRendererProps) {
  // Parse markdown with streaming-aware buffering
  const { content, isParsing, error, parsedText } = useMarkdownContent(text, {
    isStreaming,
    debounceMs: 50,
    minChars: 10,
  })

  // Detect if content looks like markdown
  const looksLikeMarkdown = useMemo(() => {
    if (!text || text.length < 10) return false

    // Quick heuristics for markdown
    const patterns = [
      /^#{1,6}\s+/m,          // Headers
      /```[\s\S]*?/,          // Code blocks
      /\*\*[^*]+\*\*/,        // Bold
      /^\s*[-*+]\s+/m,        // Lists
      /^\s*\d+\.\s+/m,        // Numbered lists
      /\[[^\]]+\]\([^)]+\)/,  // Links
    ]
    return patterns.some(p => p.test(text))
  }, [text])

  // Use plain text if:
  // - plainText prop is set
  // - parsing failed with error
  // - content doesn't look like markdown
  const usePlainText = plainText || (error && !content) || (!looksLikeMarkdown && !content)

  // Show parsing indicator
  if (showParsingIndicator && isParsing && !content && !usePlainText) {
    return (
      <div className={cn('text-white/40 flex items-center gap-2', className)} style={{ fontSize: '12px' }}>
        <span className="inline-block w-3 h-3 border border-cyan-400/50 border-t-cyan-400 rounded-full animate-spin" />
        <span>Parsing markdown...</span>
      </div>
    )
  }

  // Plain text rendering
  if (usePlainText) {
    return <PlainTextView text={text} isStreaming={isStreaming} className={className} />
  }

  // Markdown rendering
  if (content) {
    return (
      <MarkdownEditorView
        content={content}
        className={className}
        showCursor={isStreaming}
      />
    )
  }

  // Fallback during initial load
  return <PlainTextView text={text} isStreaming={isStreaming} className={className} />
}

export const StreamingRenderer = memo(StreamingRendererComponent)

// =============================================================================
// Convenience Exports
// =============================================================================

/**
 * Static markdown renderer (non-streaming).
 */
export function StaticMarkdownRenderer({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <StreamingRenderer
      text={text}
      isStreaming={false}
      className={className}
    />
  )
}

/**
 * Plain text renderer (no markdown parsing).
 */
export function PlainTextRenderer({
  text,
  isStreaming = false,
  className,
}: {
  text: string
  isStreaming?: boolean
  className?: string
}) {
  return (
    <StreamingRenderer
      text={text}
      isStreaming={isStreaming}
      className={className}
      plainText
    />
  )
}
