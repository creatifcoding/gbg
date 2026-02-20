/**
 * PanelModeToggle — collapse/expand chrome button
 * @module
 */

import { memo } from 'react'
import { usePanelContext } from '../../context/PanelContext'
import { ChromeBtn } from '../ChromeBtn'
import { CollapseIcon, ExpandIcon } from '../PanelIcons'

export const PanelModeToggle = memo(function PanelModeToggle() {
  const { state, actions } = usePanelContext()
  return (
    <ChromeBtn
      onClick={(e) => { e.stopPropagation(); actions.toggleMode() }}
      label={state.mode === 'floating' ? 'Collapse' : 'Expand'}
    >
      {state.mode === 'floating' ? <CollapseIcon /> : <ExpandIcon />}
    </ChromeBtn>
  )
})
