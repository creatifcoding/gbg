export { RvnChatComposer } from './composer-root'
export type { RvnChatComposerRootProps } from './composer-root'

export { RvnChatComposerInput } from './composer-input'
export type {
  RvnChatComposerInputRootProps,
  RvnChatComposerPlaceholderProps,
  RvnComposerContentEditableProps,
  RvnChatComposerCounterProps,
} from './composer-input'

export { RvnChatComposerSuggestions } from './composer-suggestions'
export type {
  RvnChatComposerSuggestionsRootProps,
  RvnChatComposerSuggestionItemProps,
} from './composer-suggestions'

export { RvnChatComposerToolbar } from './composer-toolbar'
export type {
  RvnChatComposerToolbarRootProps,
  RvnChatComposerModeGroupProps,
  RvnChatComposerInsertGroupProps,
  RvnChatComposerVoiceGroupProps,
  RvnChatComposerTransportGroupProps,
  RvnChatComposerToolBtnProps,
} from './composer-toolbar'

export { RvnChatComposerTransport } from './transport'
export type {
  RvnChatComposerTransportRootProps,
  RvnChatComposerTransportPrimaryProps,
  RvnChatComposerTransportReconnectProps,
} from './transport'

export { RvnChatComposerRecordingBanner } from './recording-banner'
export type { RvnChatComposerRecordingBannerProps } from './recording-banner'

// Backward compatibility during migration
export { RvnComposerContentEditable } from '../RvnComposerContentEditable'
export type { RvnComposerContentEditableProps as RvnComposerContentEditableLegacyProps } from '../RvnComposerContentEditable'
