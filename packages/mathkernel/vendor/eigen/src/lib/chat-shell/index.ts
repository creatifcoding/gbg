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

// Re-export icons commonly used with ChatInput
export { Slash, AtSign, Paperclip } from 'lucide-react'
