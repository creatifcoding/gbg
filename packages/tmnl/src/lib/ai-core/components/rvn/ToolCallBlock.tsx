/**
 * ToolCallBlock
 *
 * Full-featured tool call display with:
 * - Collapsible header with status
 * - Args display (formatted or raw)
 * - Result display (formatted or raw)
 * - View toggle button
 * - APPLY button for design tools
 * - Copy button
 *
 * Dark-themed for contrast island effect.
 */

import * as React from 'react'
import { useState, useCallback, useMemo, memo, useLayoutEffect, useRef } from 'react'
import { animate } from 'animejs'
import { ToolArgsFormatted } from './ToolArgsFormatted'
import { ToolResultFormatted } from './ToolResultFormatted'
import { CopyButton } from './CopyButton'
import {
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
} from './rvn-tokens'

// =============================================================================
// Types
// =============================================================================

export interface ToolCallBlockProps {
  /** Tool call data */
  call: {
    toolCallId: string
    toolName: string
    args: unknown
  }
  /** Tool result (when complete) */
  result?: {
    isError?: boolean
    errorMessage?: string | null
    result?: unknown
  } | null
  /** Current status */
  status?: 'pending' | 'running' | 'complete' | 'error'
  /** Component ID for design actions */
  componentId?: string
  /** Callback when design action should be applied */
  onDesignAction?: (action: {
    type: 'prop' | 'style'
    componentId: string
    payload: Record<string, unknown>
  }) => void
  /** Whether to start expanded */
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

function getPrimaryField(toolName: string, args: unknown): string {
  const argsObj =
    typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {}
  const name = formatToolName(toolName).toLowerCase()

  if (name === 'bash' && argsObj['command']) {
    return String(argsObj['command']).slice(0, 60)
  }
  if (
    ['read', 'read_file', 'edit', 'edit_file', 'write', 'write_file'].includes(name) &&
    (argsObj['file_path'] || argsObj['path'])
  ) {
    return String(argsObj['file_path'] ?? argsObj['path'])
  }
  if (
    ['grep', 'search_files'].includes(name) &&
    (argsObj['pattern'] || argsObj['query'])
  ) {
    return String(argsObj['pattern'] ?? argsObj['query'])
  }
  if (['glob', 'list_files'].includes(name) && argsObj['pattern']) {
    return String(argsObj['pattern'])
  }

  // Fallback
  const firstString = Object.values(argsObj).find((v) => typeof v === 'string')
  if (firstString) return String(firstString).slice(0, 50)

  return JSON.stringify(argsObj).replace(/\n/g, ' ').slice(0, 50) + '...'
}

// =============================================================================
// Animation Hook
// =============================================================================

function useEntranceAnimation() {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!ref.current) return

    const el = ref.current
    el.style.opacity = '0'
    el.style.filter = 'blur(12px)'
    el.style.transform = 'translateY(-12px) scale(0.98)'

    const anim = animate(el, {
      opacity: 1,
      filter: 'blur(0px)',
      translateY: 0,
      scale: 1,
      duration: 450,
      easing: 'outBack',
    })

    return () => {
      anim.pause()
    }
  }, [])

  return ref
}

// =============================================================================
// Component
// =============================================================================

export const ToolCallBlock = memo(function ToolCallBlock({
  call,
  result,
  status = 'pending',
  componentId,
  onDesignAction,
  defaultExpanded = false,
  className,
  style,
}: ToolCallBlockProps) {
  const animationRef = useEntranceAnimation()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted')

  const displayName = useMemo(() => formatToolName(call.toolName), [call.toolName])
  const previewText = useMemo(
    () => getPrimaryField(call.toolName, call.args),
    [call.toolName, call.args]
  )

  const isDesignTool = useMemo(() => {
    const name = displayName.toLowerCase()
    return ['apply_style', 'suggest_prop', 'modify_style'].includes(name)
  }, [displayName])

  const argsString = useMemo(() => {
    if (typeof call.args === 'string') return call.args
    return JSON.stringify(call.args, null, 2)
  }, [call.args])

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
      type: call.toolName === 'suggest_prop' ? 'prop' : 'style',
      componentId,
      payload:
        typeof call.args === 'object' && call.args !== null
          ? (call.args as Record<string, unknown>)
          : {},
    })
  }, [call, result, componentId, onDesignAction])

  return (
    <div ref={animationRef} className={className} style={{ ...styles.container, ...style }}>
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
              <ToolArgsFormatted toolName={call.toolName} args={call.args} />
            ) : (
              <div style={styles.rawContent}>{argsString}</div>
            )}
          </div>

          {/* Result Section */}
          {result && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>{result.isError ? 'ERROR' : 'RESULT'}</div>
              {viewMode === 'formatted' ? (
                <ToolResultFormatted toolName={call.toolName} result={result} />
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

export default ToolCallBlock
