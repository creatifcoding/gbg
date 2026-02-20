/**
 * PanelHeader — title bar compound component
 *
 * Thin shell that composes TitleTab + Controls atoms.
 * Reads drag handle refs from PanelContext. Zero props needed
 * when used inside a FloatingPanel. Accepts children for full override.
 *
 * @module
 */

import { memo, type ReactNode } from 'react'
import { usePanelContext } from '../context/PanelContext'
import { PANEL } from '../tokens'
import { PanelTitleTab } from './atoms/PanelTitleTab'
import { PanelControls } from './atoms/PanelControls'

export interface PanelHeaderProps {
  children?: ReactNode
}

export const PanelHeader = memo(function PanelHeader({ children }: PanelHeaderProps) {
  const { state, actions, meta } = usePanelContext()

  return (
    <div
      ref={meta.setActivatorNodeRef}
      data-slot="panel-header"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: PANEL.headerHeight,
        backgroundColor: PANEL.headerBg,
        borderBottom: `1px solid ${meta.borderColor}`,
        flexShrink: 0,
        cursor: state.isMaximized ? 'default' : 'grab',
        userSelect: 'none' as const,
      }}
      onDoubleClick={actions.maximizeToggle}
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
