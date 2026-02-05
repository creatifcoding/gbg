/**
 * ReasoningRenderer
 *
 * Collapsible thinking/reasoning section with dark theme contrast.
 * Used to display AI reasoning/thinking blocks in a brutalist style.
 *
 * Dark background (#0d0d0d) provides visual contrast against light theme,
 * signaling "internal" AI processing distinct from user-facing content.
 *
 * @example
 * ```tsx
 * <ReasoningRenderer reasoning="Let me analyze this step by step..." />
 * ```
 */

import * as React from 'react'
import { useState, useCallback, memo } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_LETTER_SPACING,
  RVN_SPACING,
} from '@/lib/rvn/tokens'

// =============================================================================
// Types
// =============================================================================

export interface ReasoningRendererProps {
  /** The reasoning/thinking text content */
  reasoning: string
  /** Whether the section starts expanded (default: false) */
  defaultExpanded?: boolean
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
    marginBottom: RVN_SPACING.s,
    border: '1px solid #333',
    background: '#0d0d0d',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    background: '#111',
    borderBottom: '1px solid #222',
    userSelect: 'none' as const,
  },
  headerLabel: {
    color: '#888',
    fontSize: RVN_FONT_SIZES.label, // 12px floor
    fontFamily: RVN_FONTS.mono,
    fontWeight: RVN_FONT_WEIGHTS.semibold,
    textTransform: 'uppercase' as const,
    letterSpacing: RVN_LETTER_SPACING.wide,
  },
  chevron: {
    color: '#555',
    fontSize: RVN_FONT_SIZES.label,
    transition: 'transform 0.15s ease',
  },
  content: {
    padding: '8px 10px',
    fontSize: RVN_FONT_SIZES.label, // 12px floor
    color: '#888',
    fontFamily: RVN_FONTS.mono,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    maxHeight: '150px',
    overflow: 'auto',
    lineHeight: 1.5,
  },
} as const

// =============================================================================
// Component
// =============================================================================

export const ReasoningRenderer = memo(function ReasoningRenderer({
  reasoning,
  defaultExpanded = false,
  className,
  style,
}: ReasoningRendererProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

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

  if (!reasoning) {
    return null
  }

  return (
    <div className={className} style={{ ...styles.container, ...style }}>
      <div
        style={styles.header}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label="Toggle reasoning section"
      >
        <span
          style={{
            ...styles.chevron,
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          {'\u25B6'}
        </span>
        <span style={styles.headerLabel}>THINKING</span>
      </div>
      {isExpanded && <div style={styles.content}>{reasoning}</div>}
    </div>
  )
})

export default ReasoningRenderer
