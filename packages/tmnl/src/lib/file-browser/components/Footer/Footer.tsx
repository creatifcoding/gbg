/**
 * Footer Component
 *
 * File browser footer with TMNL branding and status.
 *
 * @module file-browser/components/Footer
 */

import { memo } from 'react'

import { DARK_SIDE } from '../../tokens'
import { useFileBrowser } from '../FileBrowser/context'

// =============================================================================
// Constants
// =============================================================================

const CURRENT_YEAR = new Date().getFullYear()

// =============================================================================
// Types
// =============================================================================

export interface FooterProps {
  /** Show item count */
  showItemCount?: boolean
  /** Show selection info */
  showSelectionInfo?: boolean
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const Footer = memo(function Footer({
  showItemCount = true,
  showSelectionInfo = true,
  className = '',
}: FooterProps) {
  const { entries, selectionInfo, currentPath } = useFileBrowser()

  const itemCount = entries.length
  const selectedCount = selectionInfo.count

  return (
    <footer
      className={`file-browser-footer ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: DARK_SIDE.dimensions.footerHeight,
        padding: `0 ${DARK_SIDE.spacing['4']}`,
        background: DARK_SIDE.colors.surfaceAlt,
        borderTop: `1px solid ${DARK_SIDE.colors.border.default}`,
        flexShrink: 0,
      }}
      data-file-browser-footer
    >
      {/* Left: Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: DARK_SIDE.spacing['4'],
          fontFamily: DARK_SIDE.typography.family.mono,
          fontSize: DARK_SIDE.typography.size.xs,
          color: DARK_SIDE.colors.text.tertiary,
        }}
      >
        {showItemCount && (
          <span>
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </span>
        )}
        {showSelectionInfo && selectedCount > 0 && (
          <span style={{ color: DARK_SIDE.colors.accent.cyan }}>
            {selectedCount} selected
          </span>
        )}
        <span
          style={{
            color: DARK_SIDE.colors.text.muted,
            maxWidth: '300px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentPath}
        </span>
      </div>

      {/* Right: TMNL Branding */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: DARK_SIDE.spacing['2'],
          fontFamily: DARK_SIDE.typography.family.mono,
          fontSize: DARK_SIDE.typography.size.xs,
        }}
      >
        <span style={{ color: DARK_SIDE.colors.text.muted }}>
          {CURRENT_YEAR} TMNL
        </span>
        <span
          style={{
            color: DARK_SIDE.colors.accent.green,
            fontWeight: DARK_SIDE.typography.weight.bold,
            letterSpacing: DARK_SIDE.typography.letterSpacing.wide,
          }}
        >
          FILE_BROWSER
        </span>
      </div>
    </footer>
  )
})
