/**
 * PanelMaxToggle — maximize/restore chrome button
 * @module
 */

import { memo } from 'react'
import { usePanelContext } from '../../context/PanelContext'
import { ChromeBtn } from '../ChromeBtn'
import { MaximizeIcon, RestoreIcon } from '../PanelIcons'

export const PanelMaxToggle = memo(function PanelMaxToggle() {
  const { state, actions } = usePanelContext()
  return (
    <ChromeBtn
      onClick={(e) => { e.stopPropagation(); actions.maximizeToggle() }}
      label={state.isMaximized ? 'Restore' : 'Maximize'}
    >
      {state.isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
    </ChromeBtn>
  )
})
