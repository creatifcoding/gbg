/**
 * Content Component
 *
 * Level 2: Main content area with list/icon views.
 *
 * @module file-browser/components/Content
 */

import { memo, type ReactNode } from 'react'

import { useFileBrowserContext } from '../FileBrowser/context'
import { DARK_SIDE } from '../../tokens'
import { ListView } from './ListView'
import { IconView } from './IconView'

// =============================================================================
// Types
// =============================================================================

export interface ContentProps {
  /** Override view mode */
  viewMode?: 'list' | 'icons'
  /** Additional children */
  children?: ReactNode
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

const ContentRoot = memo(function Content({
  viewMode: viewModeOverride,
  children,
  className = '',
}: ContentProps) {
  const { viewMode: contextViewMode } = useFileBrowserContext()
  const viewMode = viewModeOverride ?? contextViewMode

  return (
    <main
      className={`file-browser-content ${className}`}
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        background: DARK_SIDE.colors.background,
      }}
      data-view-mode={viewMode}
    >
      {children ?? (
        <>
          {viewMode === 'list' && <ListView />}
          {viewMode === 'icons' && <IconView />}
        </>
      )}
    </main>
  )
})

// =============================================================================
// Compound Export
// =============================================================================

export const Content = Object.assign(ContentRoot, {
  ListView,
  IconView,
})
