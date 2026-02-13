import type { ReactElement } from 'react'
import {
  RvnChatComposerToolbarRoot,
  type RvnChatComposerToolbarRootProps,
} from './toolbar-root'
import {
  RvnChatComposerModeGroup,
  type RvnChatComposerModeGroupProps,
} from './mode-group'
import {
  RvnChatComposerInsertGroup,
  type RvnChatComposerInsertGroupProps,
} from './insert-group'
import {
  RvnChatComposerTransportGroup,
  type RvnChatComposerTransportGroupProps,
} from './transport-group'
import {
  RvnChatComposerToolBtn,
  type RvnChatComposerToolBtnProps,
} from './tool-btn'
import {
  RvnChatComposerVoiceGroup,
  type RvnChatComposerVoiceGroupProps,
} from './voice-group'

interface RvnChatComposerToolbarComponent {
  (props: RvnChatComposerToolbarRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatComposerToolbarRoot
  ModeGroup: typeof RvnChatComposerModeGroup
  InsertGroup: typeof RvnChatComposerInsertGroup
  VoiceGroup: typeof RvnChatComposerVoiceGroup
  TransportGroup: typeof RvnChatComposerTransportGroup
  ToolBtn: typeof RvnChatComposerToolBtn
}

const Toolbar = RvnChatComposerToolbarRoot as RvnChatComposerToolbarComponent
Toolbar.Root = RvnChatComposerToolbarRoot
Toolbar.ModeGroup = RvnChatComposerModeGroup
Toolbar.InsertGroup = RvnChatComposerInsertGroup
Toolbar.VoiceGroup = RvnChatComposerVoiceGroup
Toolbar.TransportGroup = RvnChatComposerTransportGroup
Toolbar.ToolBtn = RvnChatComposerToolBtn

export { Toolbar as RvnChatComposerToolbar }
export type {
  RvnChatComposerToolbarRootProps,
  RvnChatComposerModeGroupProps,
  RvnChatComposerInsertGroupProps,
  RvnChatComposerVoiceGroupProps,
  RvnChatComposerTransportGroupProps,
  RvnChatComposerToolBtnProps,
}
