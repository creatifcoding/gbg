/**
 * PanelControls — right-aligned button group in header
 *
 * Compound component. Renders children (defaults to ModeToggle + MaxToggle + Minimize).
 * @module
 */

import { memo, type ReactNode } from 'react'
import { PanelModeToggle } from './PanelModeToggle'
import { PanelMaxToggle } from './PanelMaxToggle'
import { PanelMinimize } from './PanelMinimize'

export interface PanelControlsProps {
  children?: ReactNode
}

export const PanelControls = memo(function PanelControls({ children }: PanelControlsProps) {
  return (
    <div
      data-slot="panel-controls"
      style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto', paddingRight: 6 }}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? (
        <>
          <PanelModeToggle />
          <PanelMaxToggle />
          <PanelMinimize />
        </>
      )}
    </div>
  )
})
