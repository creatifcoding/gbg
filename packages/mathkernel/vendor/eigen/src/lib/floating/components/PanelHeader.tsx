/**
 * PanelHeader — title bar compound component
 *
 * Thin shell that composes TitleTab + Controls atoms.
 * Reads drag handle refs from PanelContext. Zero props needed
 * when used inside a FloatingPanel. Accepts children for full override.
 *
 * @module
 */

import { memo, useCallback, type ReactNode } from 'react'
import { usePanelContext } from '../context/PanelContext'
import { PANEL } from '../tokens'
import { PanelTitleTab } from './atoms/PanelTitleTab'
import { PanelControls } from './atoms/PanelControls'
import { tilePanel } from '../stx/actions'

export interface PanelHeaderProps {
  children?: ReactNode
}

export const PanelHeader = memo(function PanelHeader({ children }: PanelHeaderProps) {
  const { state, actions, meta } = usePanelContext()

  // SM §3.5: double-click floating title bar → dock (tile), not maximize
  const handleDoubleClick = useCallback(() => {
    if (state.mode === 'floating') {
      tilePanel(meta.id)
    }
  }, [state.mode, meta.id])

  return (
    <div
      ref={meta.setActivatorNodeRef}
      data-slot="panel-header"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: PANEL.headerHeight,
        backgroundColor: PANEL.headerBg,
        // Hairline border — alpha-based (MorphChat frame-chrome style)
        borderBottom: `1px solid ${PANEL.border}`,
        flexShrink: 0,
        cursor: state.isMaximized ? 'default' : 'grab',
        userSelect: 'none' as const,
      }}
      onDoubleClick={handleDoubleClick}
      {...meta.listeners}
    >
      {children ?? (
        <>
          <PanelTitleTab />
          <PanelControls />
        </>
      )}
    </div>
  )
})
