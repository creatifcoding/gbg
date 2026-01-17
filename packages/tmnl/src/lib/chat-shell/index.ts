/**
 * Chat Shell - Composable chat input components
 *
 * Provides a compound component pattern for building chat interfaces
 * with mode toggle, thinking levels, and extensible toolbars.
 *
 * @module chat-shell
 */

export {
  ChatInput,
  type ChatInputProps,
  type ChatInputSubmitParams,
  type ChatMode,
  type ThinkingLevel,
  type ContextChip,
} from './ChatInput'

// Text morph animation utilities (anime.js v4 scope-based)
export {
  // React hook (RECOMMENDED)
  useTextMorph,
  type TextMorphHandle,
  // Core utilities
  computeCharMapping,
  initCharSpans,
  // Types
  type CharMapping,
  type MorphOptions,
  // Legacy API (DEPRECATED - use useTextMorph instead)
  morphText,
} from './text-morph'

// Re-export icons commonly used with ChatInput
export { Slash, AtSign, Paperclip } from 'lucide-react'
