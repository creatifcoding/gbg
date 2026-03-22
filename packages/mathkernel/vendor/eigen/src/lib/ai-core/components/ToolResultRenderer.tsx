/**
 * ToolResultRenderer
 *
 * Displays tool result with error handling and optional action buttons.
 * Dark-themed to match tool call blocks, with special styling for errors.
 *
 * Features:
 * - Success/error state visualization
 * - Optional "Apply" button for design tool results
 * - Copy button for result content
 * - Truncated display with full content on expand
 *
 * @example
 * ```tsx
 * <ToolResultRenderer
 *   result={{ toolCallId: '123', result: { status: 'ok' } }}
 *   onDesignAction={(action) => console.log(action)}
 * />
 * ```
 */

import * as React from 'react'
import { useState, useCallback, useMemo, memo } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_LETTER_SPACING,
  RVN_BORDERS,
} from '@/lib/rvn/tokens'

// =============================================================================
// Types
// =============================================================================

export interface ToolResultRendererProps {
  /** The tool result data */
  result: {
    toolCallId: string
    toolName?: string
    result: unknown
    isError?: boolean
  }
  /** Callback when a design action should be applied */
  onDesignAction?: (action: unknown) => void
  /** Custom className */
  className?: string
  /** Custom style overrides */
  style?: React.CSSProperties
}

// =============================================================================
// Styles (Dark Theme - Contrast Island)
// =============================================================================

const styles = {
  container: {
    padding: '8px 12px',
  },
  label: {
    fontSize: RVN_FONT_SIZES.label, // 12px floor
    color: '#666',
    marginBottom: '4px',
    fontFamily: RVN_FONTS.mono,
    textTransform: 'uppercase' as const,
    letterSpacing: RVN_LETTER_SPACING.wide,
  },
  labelError: {
    color: '#f44',
  },
  content: {
    fontSize: RVN_FONT_SIZES.label, // 12px floor
    color: '#bbb',
    fontFamily: RVN_FONTS.mono,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    maxHeight: '150px',
    overflow: 'auto',
    background: '#0a0a0a',
    padding: '8px',
    border: '1px solid #1a1a1a',
  },
  contentError: {
    color: '#f66',
    background: '#1a0a0a',
    border: '1px solid #300',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  applyButton: {
    background: '#111',
    color: '#4a4',
    border: '1px solid #4a4',
    padding: '4px 10px',
    fontSize: RVN_FONT_SIZES.label, // 12px floor
    fontWeight: RVN_FONT_WEIGHTS.semibold,
    fontFamily: RVN_FONTS.mono,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    borderRadius: RVN_BORDERS.radius, // 0px
    transition: 'all 0.15s',
  },
  applyButtonHover: {
    background: '#1a2a1a',
  },
  copyButton: {
    background: 'transparent',
    color: '#888',
    border: '1px solid #444',
    padding: '4px 10px',
    fontSize: RVN_FONT_SIZES.label, // 12px floor
    fontWeight: RVN_FONT_WEIGHTS.semibold,
    fontFamily: RVN_FONTS.mono,
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    borderRadius: RVN_BORDERS.radius, // 0px
    transition: 'all 0.15s',
  },
  copyButtonSuccess: {
    color: '#4a4',
    borderColor: '#4a4',
  },
  successMessage: {
    color: '#4a4',
    fontSize: RVN_FONT_SIZES.label,
    fontFamily: RVN_FONTS.mono,
    padding: '4px 0',
  },
} as const

// =============================================================================
// Helpers
// =============================================================================

const MAX_DISPLAY_LENGTH = 1000

/**
 * Format result content for display
 */
function formatResult(result: unknown): string {
  if (typeof result === 'string') {
    return result
  }
  return JSON.stringify(result, null, 2)
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '...'
}

/**
 * Check if result indicates a successful file operation
 */
function isFileOperationSuccess(result: unknown): boolean {
  if (typeof result !== 'object' || result === null) return false
  const obj = result as Record<string, unknown>
  return obj['success'] === true || obj['status'] === 'ok'
}

// =============================================================================
// Copy Button Component
// =============================================================================

interface CopyButtonProps {
  text: string
}

const CopyButton = memo(function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error('Failed to copy to clipboard')
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      style={{
        ...styles.copyButton,
        ...(copied ? styles.copyButtonSuccess : {}),
      }}
    >
      {copied ? '\u2713 COPIED' : 'COPY'}
    </button>
  )
})

// =============================================================================
// Component
// =============================================================================

export const ToolResultRenderer = memo(function ToolResultRenderer({
  result,
  onDesignAction,
  className,
  style,
}: ToolResultRendererProps) {
  const [applyHover, setApplyHover] = useState(false)

  const isError = result.isError ?? false
  const resultString = useMemo(() => formatResult(result.result), [result.result])
  const displayContent = useMemo(() => truncate(resultString, MAX_DISPLAY_LENGTH), [resultString])

  // Check if this is a design tool that can be applied
  const isDesignTool = useMemo(() => {
    const toolName = result.toolName ?? ''
    return ['apply_style', 'suggest_prop', 'modify_style'].includes(toolName)
  }, [result.toolName])

  // Check for file operation success (show simplified message)
  const isFileSuccess = useMemo(() => {
    const toolName = result.toolName ?? ''
    const isFileOp = ['edit', 'edit_file', 'write', 'write_file'].includes(
      toolName.toLowerCase().replace('mcp__', '')
    )
    return isFileOp && isFileOperationSuccess(result.result)
  }, [result.toolName, result.result])

  const handleApply = useCallback(() => {
    if (!onDesignAction || isError) return
    onDesignAction({
      toolCallId: result.toolCallId,
      toolName: result.toolName,
      result: result.result,
    })
  }, [onDesignAction, isError, result])

  // Don't render if no result
  if (result.result === undefined && !isError) {
    return null
  }

  return (
    <div className={className} style={{ ...styles.container, ...style }}>
      <div style={{ ...styles.label, ...(isError ? styles.labelError : {}) }}>
        {isError ? 'ERROR' : 'RESULT'}
      </div>

      {/* File operation success - simplified message */}
      {isFileSuccess && !isError ? (
        <div style={styles.successMessage}>{'\u2713'} FILE UPDATED</div>
      ) : (
        <div style={{ ...styles.content, ...(isError ? styles.contentError : {}) }}>
          {displayContent}
        </div>
      )}

      {/* Actions */}
      {!isError && (
        <div style={styles.actions}>
          {isDesignTool && onDesignAction && (
            <button
              onClick={handleApply}
              onMouseEnter={() => setApplyHover(true)}
              onMouseLeave={() => setApplyHover(false)}
              style={{
                ...styles.applyButton,
                ...(applyHover ? styles.applyButtonHover : {}),
              }}
            >
              APPLY
            </button>
          )}
          <CopyButton text={resultString} />
        </div>
      )}
    </div>
  )
})

export default ToolResultRenderer
