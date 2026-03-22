/**
 * PanelMinimize — minimize chrome button
 * @module
 */

import { memo } from 'react'
import { usePanelContext } from '../../context/PanelContext'
import { ChromeBtn } from '../ChromeBtn'
import { MinimizeIcon } from '../PanelIcons'

export const PanelMinimize = memo(function PanelMinimize() {
  const { state, actions } = usePanelContext()
  if (!state.minimizable) return null

  return (
    <ChromeBtn
      onClick={(e) => { e.stopPropagation(); actions.minimize() }}
      label="Minimize"
    >
      <MinimizeIcon />
    </ChromeBtn>
  )
})
