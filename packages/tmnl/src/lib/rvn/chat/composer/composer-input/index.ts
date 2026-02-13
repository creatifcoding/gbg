import type { ReactElement } from 'react'
import { RvnChatComposerInputRoot, type RvnChatComposerInputRootProps } from './composer-input-root'
import { RvnChatComposerPlaceholder, type RvnChatComposerPlaceholderProps } from './composer-placeholder'
import { RvnChatComposerCounter, type RvnChatComposerCounterProps } from './counter'
import { RvnComposerContentEditable, type RvnComposerContentEditableProps } from '../../RvnComposerContentEditable'

interface RvnChatComposerInputComponent {
  (props: RvnChatComposerInputRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatComposerInputRoot
  Placeholder: typeof RvnChatComposerPlaceholder
  Field: typeof RvnComposerContentEditable
  Counter: typeof RvnChatComposerCounter
}

const Input = RvnChatComposerInputRoot as RvnChatComposerInputComponent
Input.Root = RvnChatComposerInputRoot
Input.Placeholder = RvnChatComposerPlaceholder
Input.Field = RvnComposerContentEditable
Input.Counter = RvnChatComposerCounter

export { Input as RvnChatComposerInput }
export type {
  RvnChatComposerInputRootProps,
  RvnChatComposerPlaceholderProps,
  RvnComposerContentEditableProps,
  RvnChatComposerCounterProps,
}
