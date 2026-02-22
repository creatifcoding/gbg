/**
 * PanelModeToggle — mode transition chrome button
 *
 * SM behavior:
 *   - Floating panel → "Dock to side" (⊟) → tiles the panel
 *   - Tiled panel → "Float as window" (⊞) → floats the panel
 *   - Docked panel → legacy expand behavior
 *
 * @module
 */

import { memo, useCallback } from 'react'
import { usePanelContext } from '../../context/PanelContext'
import { ChromeBtn } from '../ChromeBtn'
import { CollapseIcon, ExpandIcon, FloatIcon, DockIcon } from '../PanelIcons'
import { floatPanel, tilePanel } from '../../stx/actions'

export const PanelModeToggle = memo(function PanelModeToggle() {
  const { state, actions, meta } = usePanelContext()

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    switch (state.mode) {
      case 'floating':
        // SM: "Dock to side" → tile the panel
        tilePanel(meta.id)
        break
      case 'tiled':
        // SM: "Float as window" → float the panel
        floatPanel(meta.id)
        break
      default:
        // Legacy: toggle between floating/docked
        actions.toggleMode()
    }
  }, [state.mode, meta.id, actions])

  // Icon and label based on current mode
  const icon = (() => {
    switch (state.mode) {
      case 'floating': return <DockIcon />
      case 'tiled': return <FloatIcon />
      default: return state.mode === 'docked' ? <ExpandIcon /> : <CollapseIcon />
    }
  })()

  const label = (() => {
    switch (state.mode) {
      case 'floating': return 'Dock to side'
      case 'tiled': return 'Float as window'
      default: return state.mode === 'docked' ? 'Expand' : 'Collapse'
    }
  })()

  return (
    <ChromeBtn onClick={handleClick} label={label}>
      {icon}
    </ChromeBtn>
  )
})
