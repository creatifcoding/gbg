/**
 * HeaderActions Component
 *
 * Level 3: Navigation buttons and view controls.
 *
 * @module file-browser/components/Header
 */

import { memo, useCallback, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  RefreshCw,
  Grid,
  List,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react'

import { useFileBrowserContext } from '../FileBrowser/context'
import { DARK_SIDE } from '../../tokens'
import type { ViewMode } from '../../atoms'

// =============================================================================
// Types
// =============================================================================

export interface HeaderActionsProps {
  /** Show navigation buttons */
  showNavigation?: boolean
  /** Show view mode toggle */
  showViewMode?: boolean
  /** Show hidden toggle */
  showHiddenToggle?: boolean
  /** Show filter input */
  showFilter?: boolean
  /** Additional CSS class */
  className?: string
}

interface ActionButtonProps {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  title?: string
}

// =============================================================================
// Action Button
// =============================================================================

const ActionButton = memo(function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
  title,
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="action-button"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        padding: 0,
        background: active ? DARK_SIDE.colors.surfaceSelected : 'transparent',
        border: `1px solid ${active ? DARK_SIDE.colors.accent.green : 'transparent'}`,
        borderRadius: DARK_SIDE.borders.radius.none,
        color: disabled
          ? DARK_SIDE.colors.text.disabled
          : active
            ? DARK_SIDE.colors.accent.green
            : DARK_SIDE.colors.text.secondary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `all ${DARK_SIDE.animation.duration.fast}`,
      }}
      title={title ?? label}
      aria-label={label}
      aria-pressed={active}
    >
      {icon}
    </button>
  )
})

// =============================================================================
// Separator
// =============================================================================

const Separator = memo(function Separator() {
  return (
    <div
      style={{
        width: '1px',
        height: '20px',
        background: DARK_SIDE.colors.border.subtle,
        margin: `0 ${DARK_SIDE.spacing['1']}`,
      }}
      aria-hidden
    />
  )
})

// =============================================================================
// Component
// =============================================================================

export const HeaderActions = memo(function HeaderActions({
  showNavigation = true,
  showViewMode = true,
  showHiddenToggle = true,
  showFilter = true,
  className = '',
}: HeaderActionsProps) {
  const {
    canGoBack,
    canGoForward,
    canGoUp,
    goBack,
    goForward,
    goUp,
    refresh,
    viewMode,
    setViewMode,
    showHidden,
    setShowHidden,
    filterPattern,
    setFilterPattern,
  } = useFileBrowserContext()

  const handleViewModeToggle = useCallback(() => {
    setViewMode(viewMode === 'list' ? 'icons' : 'list')
  }, [viewMode, setViewMode])

  const handleHiddenToggle = useCallback(() => {
    setShowHidden(!showHidden)
  }, [showHidden, setShowHidden])

  return (
    <div
      className={`header-actions ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: DARK_SIDE.spacing['1'],
      }}
    >
      {/* Navigation */}
      {showNavigation && (
        <>
          <ActionButton
            icon={<ChevronLeft size={16} />}
            label="Go back"
            onClick={() => goBack()}
            disabled={!canGoBack}
            title="Go back (Alt+←)"
          />
          <ActionButton
            icon={<ChevronRight size={16} />}
            label="Go forward"
            onClick={() => goForward()}
            disabled={!canGoForward}
            title="Go forward (Alt+→)"
          />
          <ActionButton
            icon={<ArrowUp size={16} />}
            label="Go up"
            onClick={() => goUp()}
            disabled={!canGoUp}
            title="Go up (Alt+↑)"
          />
          <ActionButton
            icon={<RefreshCw size={16} />}
            label="Refresh"
            onClick={() => refresh()}
            title="Refresh (F5)"
          />
          <Separator />
        </>
      )}

      {/* View Mode */}
      {showViewMode && (
        <>
          <ActionButton
            icon={viewMode === 'list' ? <List size={16} /> : <Grid size={16} />}
            label={`Switch to ${viewMode === 'list' ? 'icon' : 'list'} view`}
            onClick={handleViewModeToggle}
            active={false}
            title={`View: ${viewMode} (Ctrl+1/2)`}
          />
        </>
      )}

      {/* Hidden Files Toggle */}
      {showHiddenToggle && (
        <ActionButton
          icon={showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
          label={showHidden ? 'Hide hidden files' : 'Show hidden files'}
          onClick={handleHiddenToggle}
          active={showHidden}
          title={`${showHidden ? 'Hide' : 'Show'} hidden files (Ctrl+H)`}
        />
      )}

      {/* Filter Input */}
      {showFilter && (
        <>
          <Separator />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: DARK_SIDE.spacing['1'],
              padding: `0 ${DARK_SIDE.spacing['2']}`,
              height: '28px',
              background: DARK_SIDE.colors.surface,
              border: `1px solid ${DARK_SIDE.colors.border.subtle}`,
            }}
          >
            <Search size={12} style={{ color: DARK_SIDE.colors.text.muted }} />
            <input
              type="text"
              value={filterPattern}
              onChange={(e) => setFilterPattern(e.target.value)}
              placeholder="Filter..."
              style={{
                width: '100px',
                padding: 0,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: DARK_SIDE.colors.text.primary,
                fontFamily: DARK_SIDE.typography.family.mono,
                fontSize: DARK_SIDE.typography.size.xs,
              }}
            />
          </div>
        </>
      )}

      {/* Hover styles */}
      <style>{`
        .action-button:not(:disabled):hover {
          background: ${DARK_SIDE.colors.surfaceHover} !important;
          color: ${DARK_SIDE.colors.accent.cyan} !important;
        }
      `}</style>
    </div>
  )
})
