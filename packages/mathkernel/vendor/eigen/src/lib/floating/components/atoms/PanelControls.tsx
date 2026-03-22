/**
 * PanelControls — right-aligned button group in header
 *
 * Mode-aware compound component.
 *   - Floating: Dock-to-side only (SM §3.4). Close/Max/Min via context menu.
 *   - Tiled: Collapse + Float as window (rendered by TiledPanelHeader, not here).
 *   - Custom: Override with children prop.
 *
 * @module
 */

import { memo, type ReactNode } from 'react'
import { usePanelContext } from '../../context/PanelContext'
import { PanelModeToggle } from './PanelModeToggle'

export interface PanelControlsProps {
  children?: ReactNode
}

export const PanelControls = memo(function PanelControls({ children }: PanelControlsProps) {
  const { state } = usePanelContext()

  return (
    <div
      data-slot="panel-controls"
      style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto', paddingRight: 6 }}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? (
        state.mode === 'floating'
          ? <PanelModeToggle />     /* SM §3.4: floating → only Dock button */
          : <PanelModeToggle />     /* Tiled uses TiledPanelHeader chrome */
      )}
    </div>
  )
})
