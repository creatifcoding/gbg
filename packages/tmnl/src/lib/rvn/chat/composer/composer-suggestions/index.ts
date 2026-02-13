import type { ReactElement } from 'react'
import {
  RvnChatComposerSuggestionsRoot,
  type RvnChatComposerSuggestionsRootProps,
} from './suggestions-root'
import {
  RvnChatComposerSuggestionItem,
  type RvnChatComposerSuggestionItemProps,
} from './suggestion-item'

interface RvnChatComposerSuggestionsComponent {
  (props: RvnChatComposerSuggestionsRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatComposerSuggestionsRoot
  Item: typeof RvnChatComposerSuggestionItem
}

const Suggestions = RvnChatComposerSuggestionsRoot as RvnChatComposerSuggestionsComponent
Suggestions.Root = RvnChatComposerSuggestionsRoot
Suggestions.Item = RvnChatComposerSuggestionItem

export { Suggestions as RvnChatComposerSuggestions }
export type {
  RvnChatComposerSuggestionsRootProps,
  RvnChatComposerSuggestionItemProps,
}
