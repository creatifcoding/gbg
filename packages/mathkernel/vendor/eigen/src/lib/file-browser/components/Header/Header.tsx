/**
 * Header Component
 *
 * Level 2: File browser header with navigation and actions.
 *
 * @module file-browser/components/Header
 */

import { memo, type ReactNode } from 'react'

import { DARK_SIDE } from '../../tokens'
import { Breadcrumb } from './Breadcrumb'
import { PathInput } from './PathInput'
import { HeaderActions } from './HeaderActions'

// =============================================================================
// Types
// =============================================================================

export interface HeaderProps {
  /** Show breadcrumb navigation */
  showBreadcrumb?: boolean
  /** Show path input */
  showPathInput?: boolean
  /** Header variant */
  variant?: 'default' | 'compact' | 'minimal'
  /** Additional children */
  children?: ReactNode
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

const HeaderRoot = memo(function Header({
  showBreadcrumb = true,
  showPathInput = false,
  variant = 'default',
  children,
  className = '',
}: HeaderProps) {
  const height =
    variant === 'compact'
      ? DARK_SIDE.dimensions.headerHeight.small
      : variant === 'minimal'
        ? '32px'
        : DARK_SIDE.dimensions.headerHeight.default

  return (
    <header
      className={`file-browser-header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DARK_SIDE.spacing['4'],
        height,
        padding: `0 ${DARK_SIDE.spacing['4']}`,
        background: DARK_SIDE.colors.surfaceAlt,
        borderBottom: `1px solid ${DARK_SIDE.colors.border.default}`,
        flexShrink: 0,
      }}
      data-file-browser-header
      data-variant={variant}
    >
      {/* Left: Navigation + Path */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: DARK_SIDE.spacing['3'],
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* Actions (navigation buttons) */}
        <HeaderActions
          showNavigation
          showViewMode={false}
          showHiddenToggle={false}
          showFilter={false}
        />

        {/* Path display */}
        {showBreadcrumb && !showPathInput && <Breadcrumb />}
        {showPathInput && <PathInput />}
      </div>

      {/* Right: View controls */}
      <HeaderActions
        showNavigation={false}
        showViewMode
        showHiddenToggle
        showFilter
      />

      {/* Custom children */}
      {children}
    </header>
  )
})

// =============================================================================
// Compound Export
// =============================================================================

export const Header = Object.assign(HeaderRoot, {
  Breadcrumb,
  PathInput,
  Actions: HeaderActions,
})
