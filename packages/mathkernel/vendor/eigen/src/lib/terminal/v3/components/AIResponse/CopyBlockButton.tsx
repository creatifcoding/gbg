/**
 * CopyBlockButton - Multi-format Clipboard Copy
 *
 * Copies AI response content to clipboard in both HTML and plain text formats.
 * Provides visual feedback on successful copy.
 *
 * Features:
 * - Dual-format clipboard (HTML + plain text)
 * - Success feedback animation (checkmark + color change)
 * - Auto-revert after 2.5 seconds
 * - Tooltip support
 *
 * @module terminal/v3/components/AIResponse/CopyBlockButton
 */

import { memo, useState, useCallback } from 'react'
import { Copy, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// Constants
// =============================================================================

const FEEDBACK_DURATION_MS = 2500

// =============================================================================
// Types
// =============================================================================

export interface CopyBlockButtonProps {
  /** Plain text/markdown content to copy */
  text: string

  /** Optional HTML content for rich paste */
  html?: string

  /** Button size */
  size?: 'sm' | 'md' | 'lg'

  /** Additional CSS class */
  className?: string

  /** Callback when copy succeeds */
  onCopied?: () => void

  /** Callback when copy fails */
  onCopyFailed?: (error: Error) => void

  /** Show tooltip on hover */
  showTooltip?: boolean

  /** Tooltip text */
  tooltipText?: string
}

// =============================================================================
// Clipboard Utilities
// =============================================================================

/**
 * Copy content to clipboard with dual HTML + plain text format.
 * Uses ClipboardItem API for multi-format support.
 */
async function copyToClipboard(text: string, html?: string): Promise<void> {
  // Try modern ClipboardItem API first
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
    const items: Record<string, Blob> = {
      'text/plain': new Blob([text], { type: 'text/plain' }),
    }

    if (html) {
      items['text/html'] = new Blob([html], { type: 'text/html' })
    }

    const clipboardItem = new ClipboardItem(items)
    await navigator.clipboard.write([clipboardItem])
    return
  }

  // Fallback to simple text copy
  await navigator.clipboard.writeText(text)
}

/**
 * Generate simple HTML from markdown text.
 * Used when no HTML is provided but we want rich paste support.
 */
function markdownToSimpleHtml(text: string): string {
  // Very basic markdown-to-HTML conversion for paste
  // Full conversion should use the actual rendered content
  let html = text
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Line breaks
    .replace(/\n/g, '<br>')

  return `<div style="font-family: system-ui, sans-serif;">${html}</div>`
}

// =============================================================================
// Size Configurations
// =============================================================================

const SIZE_CONFIG = {
  sm: { iconSize: 12, padding: 'p-1', gap: 'gap-1' },
  md: { iconSize: 14, padding: 'p-1.5', gap: 'gap-1.5' },
  lg: { iconSize: 16, padding: 'p-2', gap: 'gap-2' },
} as const

// =============================================================================
// Component
// =============================================================================

function CopyBlockButtonComponent({
  text,
  html,
  size = 'md',
  className,
  onCopied,
  onCopyFailed,
  showTooltip = true,
  tooltipText = 'Copy to clipboard',
}: CopyBlockButtonProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const { iconSize, padding } = SIZE_CONFIG[size]

  const handleCopy = useCallback(async () => {
    if (!text) return

    try {
      // Use provided HTML or generate from markdown
      const htmlContent = html || markdownToSimpleHtml(text)
      await copyToClipboard(text, htmlContent)

      setCopyState('copied')
      onCopied?.()

      // Revert to idle after delay
      setTimeout(() => {
        setCopyState('idle')
      }, FEEDBACK_DURATION_MS)
    } catch (error) {
      console.error('[CopyBlockButton] Copy failed:', error)
      setCopyState('error')
      onCopyFailed?.(error instanceof Error ? error : new Error(String(error)))

      // Revert to idle after delay
      setTimeout(() => {
        setCopyState('idle')
      }, FEEDBACK_DURATION_MS)
    }
  }, [text, html, onCopied, onCopyFailed])

  // Determine icon and colors based on state
  const Icon = copyState === 'copied' ? Check : copyState === 'error' ? AlertCircle : Copy
  const colorClass =
    copyState === 'copied'
      ? 'text-green-400 bg-green-400/10'
      : copyState === 'error'
        ? 'text-red-400 bg-red-400/10'
        : 'text-white/40 hover:text-white/70 hover:bg-white/5'

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text || copyState !== 'idle'}
      className={cn(
        'rounded transition-all duration-200',
        padding,
        colorClass,
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      title={showTooltip ? (copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : tooltipText) : undefined}
      aria-label={copyState === 'copied' ? 'Copied to clipboard' : 'Copy to clipboard'}
    >
      <Icon
        size={iconSize}
        className={cn(
          'transition-transform duration-200',
          copyState === 'copied' && 'scale-110'
        )}
      />
    </button>
  )
}

export const CopyBlockButton = memo(CopyBlockButtonComponent)

// =============================================================================
// Compound Components
// =============================================================================

/**
 * Copy button with text label.
 */
export function CopyBlockButtonWithLabel({
  text,
  html,
  size = 'md',
  className,
  onCopied,
  onCopyFailed,
  label = 'Copy',
  copiedLabel = 'Copied!',
}: CopyBlockButtonProps & {
  label?: string
  copiedLabel?: string
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const { iconSize, padding, gap } = SIZE_CONFIG[size]

  const handleCopy = useCallback(async () => {
    if (!text) return

    try {
      const htmlContent = html || markdownToSimpleHtml(text)
      await copyToClipboard(text, htmlContent)

      setCopyState('copied')
      onCopied?.()

      setTimeout(() => {
        setCopyState('idle')
      }, FEEDBACK_DURATION_MS)
    } catch (error) {
      console.error('[CopyBlockButton] Copy failed:', error)
      setCopyState('error')
      onCopyFailed?.(error instanceof Error ? error : new Error(String(error)))

      setTimeout(() => {
        setCopyState('idle')
      }, FEEDBACK_DURATION_MS)
    }
  }, [text, html, onCopied, onCopyFailed])

  const Icon = copyState === 'copied' ? Check : copyState === 'error' ? AlertCircle : Copy
  const colorClass =
    copyState === 'copied'
      ? 'text-green-400 bg-green-400/10 border-green-400/30'
      : copyState === 'error'
        ? 'text-red-400 bg-red-400/10 border-red-400/30'
        : 'text-white/50 hover:text-white/80 hover:bg-white/5 border-white/10 hover:border-white/20'

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text || copyState !== 'idle'}
      className={cn(
        'rounded border transition-all duration-200 flex items-center',
        padding,
        gap,
        colorClass,
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      <Icon size={iconSize} />
      <span style={{ fontSize: size === 'sm' ? '11px' : size === 'md' ? '12px' : '13px' }}>
        {copyState === 'copied' ? copiedLabel : copyState === 'error' ? 'Failed' : label}
      </span>
    </button>
  )
}
