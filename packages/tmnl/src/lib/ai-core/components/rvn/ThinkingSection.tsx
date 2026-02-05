/**
 * ThinkingSection
 *
 * Collapsible AI thinking/reasoning section with dark theme contrast.
 * Displays AI reasoning in a visually distinct "internal" style.
 */

import * as React from 'react'
import { useState, useCallback, memo } from 'react'
import {
  RVN_DARK,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_SPACING,
  darkContainerStyle,
  darkHeaderStyle,
  darkLabelStyle,
  darkChevronStyle,
} from './rvn-tokens'

// =============================================================================
// Types
// =============================================================================

export interface ThinkingSectionProps {
  /** The thinking/reasoning text content */
  thinking: string
  /** Whether the section starts expanded (default: false) */
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
    marginBottom: RVN_SPACING.s,
  },
  header: {
    ...darkHeaderStyle,
    padding: '6px 10px',
  },
  label: {
    ...darkLabelStyle,
  },
  content: {
    padding: '8px 10px',
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_DARK.textMuted,
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

export const ThinkingSection = memo(function ThinkingSection({
  thinking,
  defaultExpanded = false,
  className,
  style,
}: ThinkingSectionProps) {
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

  if (!thinking) {
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
        aria-label="Toggle thinking section"
      >
        <span
          style={{
            ...darkChevronStyle,
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          {'\u25B6'}
        </span>
        <span style={styles.label}>THINKING</span>
      </div>
      {isExpanded && <div style={styles.content}>{thinking}</div>}
    </div>
  )
})

export default ThinkingSection
