/**
 * ToolCallRenderer
 *
 * Full-featured tool call display for AI SDK message parts.
 * Uses RVN dark theme components for consistent styling.
 *
 * Features:
 * - Collapsible args/result display
 * - Tool name badge with uppercase formatting
 * - Status indicator (pending, running, complete, error)
 * - Formatted args preview when collapsed
 * - View toggle (RAW/FORMATTED)
 * - APPLY button for design tools
 * - Copy button for results
 *
 * @example
 * ```tsx
 * <ToolCallRenderer
 *   toolCall={{ toolCallId: '123', toolName: 'read_file', args: { path: '/foo' } }}
 *   status="complete"
 *   result={{ result: 'file contents...', isError: false }}
 *   onDesignAction={(action) => console.log(action)}
 * />
 * ```
 */

import * as React from 'react'
import { useState, useCallback, useMemo, memo } from 'react'
import {
  ToolArgsFormatted,
  ToolResultFormatted,
  CopyButton,
  RVN_DARK,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_LETTER_SPACING,
  RVN_SPACING,
  darkContainerStyle,
  darkHeaderStyle,
  darkChevronStyle,
  darkButtonStyle,
  darkApplyButtonStyle,
  darkStatusStyles,
  darkLabelStyle,
} from './rvn'

// =============================================================================
// Types
// =============================================================================

export interface ToolCallRendererProps {
  /** The tool call data */
  toolCall: {
    toolCallId: string
    toolName: string
    args: unknown
  }
  /** Current status of the tool call */
  status?: 'pending' | 'running' | 'complete' | 'error'
  /** Tool result (when complete) */
  result?: {
    isError?: boolean
    errorMessage?: string | null
    result?: unknown
  } | null
  /** Component ID for design actions */
  componentId?: string
  /** Callback when design action should be applied */
  onDesignAction?: (action: {
    type: 'prop' | 'style'
    componentId: string
    payload: Record<string, unknown>
  }) => void
  /** Whether the args section starts expanded (default: false) */
  defaultExpanded?: boolean
  /** Custom className */
  className?: string
  /** Custom style overrides */
  style?: React.CSSProperties
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    ...darkContainerStyle,
    margin: `${RVN_SPACING.s} 0`,
  },
  header: {
    ...darkHeaderStyle,
    justifyContent: 'space-between',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toolName: {
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    fontFamily: RVN_FONTS.mono,
    color: RVN_DARK.textBright,
    textTransform: 'uppercase' as const,
    letterSpacing: RVN_LETTER_SPACING.wide,
  },
  preview: {
    padding: '6px 12px',
    color: RVN_DARK.textMuted,
    fontSize: RVN_FONT_SIZES.label,
    fontFamily: RVN_FONTS.mono,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  section: {
    padding: '8px 12px',
    borderTop: `1px solid ${RVN_DARK.borderLight}`,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  sectionLabel: {
    ...darkLabelStyle,
  },
  viewToggle: {
    ...darkButtonStyle,
    padding: '2px 6px',
    marginLeft: 'auto',
  },
  viewToggleActive: {
    color: RVN_DARK.textBright,
    borderColor: RVN_DARK.textSubtle,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    padding: '8px 12px',
    borderTop: `1px solid ${RVN_DARK.borderLight}`,
    background: RVN_DARK.bg,
  },
  rawContent: {
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_DARK.textMuted,
    fontFamily: RVN_FONTS.mono,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    maxHeight: '200px',
    overflow: 'auto',
    background: RVN_DARK.bgSecondary,
    padding: '8px',
    border: `1px solid ${RVN_DARK.borderSubtle}`,
  },
} as const

// =============================================================================
// Helpers
// =============================================================================

function formatToolName(name: string): string {
  if (name.startsWith('mcp__')) {
    return name.split('__').slice(-1)[0]
  }
  return name
}

function getPreviewText(toolName: string, args: unknown): string {
  if (typeof args !== 'object' || args === null) {
    return String(args).slice(0, 50)
  }

  const argsObj = args as Record<string, unknown>
  const name = formatToolName(toolName).toLowerCase()

  if (name === 'bash' && argsObj['command']) {
    return String(argsObj['command']).slice(0, 60)
  }
  if (['read', 'read_file', 'edit', 'edit_file', 'write', 'write_file'].includes(name)) {
    const path = argsObj['file_path'] ?? argsObj['path']
    if (path) return String(path)
  }
  if (['grep', 'search_files'].includes(name)) {
    const pattern = argsObj['pattern'] ?? argsObj['query']
    if (pattern) return String(pattern)
  }
  if (['glob', 'list_files'].includes(name) && argsObj['pattern']) {
    return String(argsObj['pattern'])
  }

  const firstString = Object.values(argsObj).find((v) => typeof v === 'string')
  if (firstString) return String(firstString).slice(0, 50)

  return JSON.stringify(argsObj).replace(/\n/g, ' ').slice(0, 50) + '...'
}

function getStatusText(status: 'pending' | 'running' | 'complete' | 'error'): string {
  switch (status) {
    case 'complete':
      return '\u2713 DONE'
    case 'error':
      return '\u2717 FAILED'
    case 'running':
      return '\u25CF RUNNING'
    default:
      return '\u25CF PENDING'
  }
}

function getStatusStyle(
  status: 'pending' | 'running' | 'complete' | 'error'
): React.CSSProperties {
  return {
    ...darkStatusStyles.base,
    ...darkStatusStyles[status],
  }
}

// =============================================================================
// Component
// =============================================================================

export const ToolCallRenderer = memo(function ToolCallRenderer({
  toolCall,
  status = 'pending',
  result,
  componentId,
  onDesignAction,
  defaultExpanded = false,
  className,
  style,
}: ToolCallRendererProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted')

  const displayName = useMemo(() => formatToolName(toolCall.toolName), [toolCall.toolName])

  const previewText = useMemo(
    () => getPreviewText(toolCall.toolName, toolCall.args),
    [toolCall.toolName, toolCall.args]
  )

  const isDesignTool = useMemo(() => {
    const name = displayName.toLowerCase()
    return ['apply_style', 'suggest_prop', 'modify_style'].includes(name)
  }, [displayName])

  const argsString = useMemo(() => {
    if (typeof toolCall.args === 'string') return toolCall.args
    return JSON.stringify(toolCall.args, null, 2)
  }, [toolCall.args])

  const resultString = useMemo(() => {
    if (!result) return null
    if (typeof result.result === 'string') return result.result
    return JSON.stringify(result.result, null, 2)
  }, [result])

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        handleToggle()
      }
    },
    [handleToggle]
  )

  const handleViewToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setViewMode((prev) => (prev === 'formatted' ? 'raw' : 'formatted'))
  }, [])

  const handleApply = useCallback(() => {
    if (!onDesignAction || !result || result.isError || !componentId) return
    onDesignAction({
      type: toolCall.toolName === 'suggest_prop' ? 'prop' : 'style',
      componentId,
      payload:
        typeof toolCall.args === 'object' && toolCall.args !== null
          ? (toolCall.args as Record<string, unknown>)
          : {},
    })
  }, [toolCall, result, componentId, onDesignAction])

  return (
    <div className={className} style={{ ...styles.container, ...style }}>
      {/* Header */}
      <div
        style={styles.header}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Toggle ${displayName} tool call details`}
      >
        <div style={styles.headerLeft}>
          <span
            style={{
              ...darkChevronStyle,
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            {'\u25B6'}
          </span>
          <span style={styles.toolName}>{displayName}</span>
        </div>
        <span style={getStatusStyle(status)}>{getStatusText(status)}</span>
      </div>

      {/* Collapsed Preview */}
      {!isExpanded && <div style={styles.preview}>{previewText}</div>}

      {/* Expanded Content */}
      {isExpanded && (
        <>
          {/* Args Section */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionLabel}>ARGS</span>
              <button
                onClick={handleViewToggle}
                style={{
                  ...styles.viewToggle,
                  ...(viewMode === 'raw' ? styles.viewToggleActive : {}),
                }}
              >
                {viewMode === 'formatted' ? 'RAW' : 'FORMATTED'}
              </button>
            </div>
            {viewMode === 'formatted' ? (
              <ToolArgsFormatted toolName={toolCall.toolName} args={toolCall.args} />
            ) : (
              <div style={styles.rawContent}>{argsString}</div>
            )}
          </div>

          {/* Result Section */}
          {result && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>{result.isError ? 'ERROR' : 'RESULT'}</div>
              {viewMode === 'formatted' ? (
                <ToolResultFormatted toolName={toolCall.toolName} result={result} />
              ) : (
                <div
                  style={{
                    ...styles.rawContent,
                    ...(result.isError
                      ? { color: '#f66', background: RVN_DARK.errorBg }
                      : {}),
                  }}
                >
                  {result.isError
                    ? result.errorMessage ?? resultString
                    : resultString?.slice(0, 1000)}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {result && !result.isError && (
            <div style={styles.actions}>
              {isDesignTool && onDesignAction && componentId && (
                <button onClick={handleApply} style={darkApplyButtonStyle}>
                  APPLY
                </button>
              )}
              <CopyButton text={resultString ?? argsString} />
            </div>
          )}
        </>
      )}
    </div>
  )
})

export default ToolCallRenderer
