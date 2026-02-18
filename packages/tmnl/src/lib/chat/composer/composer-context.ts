/**
 * Composer Context
 *
 * React context for the compound Composer component.
 * All sub-components consume this for shared state.
 */

import { createContext, useContext, type RefObject } from 'react'
import type {
  ChatMode,
  ThinkingLevel,
  ContextChip,
  ThinkingLevelOption,
} from './types'

export interface ComposerContextValue {
  // State
  value: string
  mode: ChatMode
  thinkingLevel: ThinkingLevel
  isSubmitting: boolean
  contextChips: ContextChip[]
  thinkingLevels: ThinkingLevelOption[]

  // Actions
  setValue: (value: string) => void
  setMode: (mode: ChatMode) => void
  setThinkingLevel: (level: ThinkingLevel) => void
  submit: () => void
  addContextChip: (chip: Omit<ContextChip, 'id'>) => void
  removeContextChip: (id: string) => void
  toggleContextChip: (id: string) => void

  // Refs
  inputRef: RefObject<HTMLTextAreaElement | null>
}

export const ComposerContext = createContext<ComposerContextValue | null>(null)

export function useComposer(): ComposerContextValue {
  const ctx = useContext(ComposerContext)
  if (!ctx) {
    throw new Error(
      'Composer sub-components must be used within <Composer>. ' +
        'Wrap your composition with the Composer root.'
    )
  }
  return ctx
}
