/**
 * SideBySideDiff
 *
 * Git-style side-by-side diff view for edit tool display.
 * Shows OLD | NEW columns with line-level highlighting.
 */

import * as React from 'react'
import { memo, useMemo } from 'react'
import { diffLines } from 'diff'
import {
  RVN_DARK,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_LETTER_SPACING,
} from './rvn-tokens'

// =============================================================================
// Types
// =============================================================================

export interface SideBySideDiffProps {
  /** Original text content */
  oldText: string
  /** New text content */
  newText: string
  /** Custom className */
  className?: string
  /** Custom style overrides */
  style?: React.CSSProperties
}

type DiffLineType = 'removed' | 'added' | 'context' | 'empty'

interface DiffLine {
  text: string
  type: DiffLineType
}

// =============================================================================
// Styles
// =============================================================================

const styles = {
  container: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    background: '#1a1a1a',
    border: `1px solid ${RVN_DARK.border}`,
    fontSize: '14px',
    fontFamily: RVN_FONTS.mono,
    padding: '8px',
  },
  pane: {
    background: RVN_DARK.bg,
    overflow: 'auto',
    maxHeight: '600px',
    border: `1px solid ${RVN_DARK.borderLight}`,
  },
  paneHeader: {
    padding: '8px 14px',
    background: RVN_DARK.bgHeader,
    color: RVN_DARK.textBright,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: RVN_LETTER_SPACING.wide,
    borderBottom: `2px solid ${RVN_DARK.border}`,
    position: 'sticky' as const,
    top: 0,
    zIndex: 1,
    fontSize: RVN_FONT_SIZES.label,
  },
  lineRemoved: {
    background: RVN_DARK.diffRemovedBg,
    color: RVN_DARK.errorBright,
    padding: '6px 14px',
    whiteSpace: 'pre' as const,
    minHeight: '28px',
    lineHeight: '28px',
  },
  lineAdded: {
    background: RVN_DARK.diffAddedBg,
    color: RVN_DARK.successBright,
    padding: '6px 14px',
    whiteSpace: 'pre' as const,
    minHeight: '28px',
    lineHeight: '28px',
  },
  lineContext: {
    color: RVN_DARK.text,
    padding: '6px 14px',
    whiteSpace: 'pre' as const,
    minHeight: '28px',
    lineHeight: '28px',
  },
  lineEmpty: {
    background: RVN_DARK.bgSecondary,
    padding: '6px 14px',
    minHeight: '28px',
    lineHeight: '28px',
  },
} as const

// =============================================================================
// Helpers
// =============================================================================

function getLineStyle(type: DiffLineType): React.CSSProperties {
  switch (type) {
    case 'removed':
      return styles.lineRemoved
    case 'added':
      return styles.lineAdded
    case 'empty':
      return styles.lineEmpty
    default:
      return styles.lineContext
  }
}

// =============================================================================
// Component
// =============================================================================

export const SideBySideDiff = memo(function SideBySideDiff({
  oldText,
  newText,
  className,
  style,
}: SideBySideDiffProps) {
  const { leftLines, rightLines } = useMemo(() => {
    const changes = diffLines(oldText, newText)
    const left: DiffLine[] = []
    const right: DiffLine[] = []

    for (const change of changes) {
      const lines = change.value.split('\n')
      // Remove trailing empty string from split if value ends with newline
      if (lines[lines.length - 1] === '') {
        lines.pop()
      }

      if (change.removed) {
        // Removed lines go to left pane only
        for (const line of lines) {
          left.push({ text: line, type: 'removed' })
        }
      } else if (change.added) {
        // Added lines go to right pane only
        for (const line of lines) {
          right.push({ text: line, type: 'added' })
        }
      } else {
        // Context lines: sync up both panes first, then add to both
        while (left.length < right.length) {
          left.push({ text: '', type: 'empty' })
        }
        while (right.length < left.length) {
          right.push({ text: '', type: 'empty' })
        }
        for (const line of lines) {
          left.push({ text: line, type: 'context' })
          right.push({ text: line, type: 'context' })
        }
      }
    }

    // Final padding to equal length
    const maxLen = Math.max(left.length, right.length)
    while (left.length < maxLen) left.push({ text: '', type: 'empty' })
    while (right.length < maxLen) right.push({ text: '', type: 'empty' })

    return { leftLines: left, rightLines: right }
  }, [oldText, newText])

  return (
    <div className={className} style={{ ...styles.container, ...style }}>
      <div style={styles.pane}>
        <div style={styles.paneHeader}>OLD</div>
        {leftLines.map((line, i) => (
          <div key={i} style={getLineStyle(line.type)}>
            {line.text || '\u00A0'}
          </div>
        ))}
      </div>
      <div style={styles.pane}>
        <div style={styles.paneHeader}>NEW</div>
        {rightLines.map((line, i) => (
          <div key={i} style={getLineStyle(line.type)}>
            {line.text || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  )
})

export default SideBySideDiff
