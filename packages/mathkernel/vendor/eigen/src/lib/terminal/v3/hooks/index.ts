/**
 * Terminal v3 Hooks
 */

export {
  useBlockTerminal,
  type UseBlockTerminalResult,
} from './useBlockTerminal'

export {
  useTerminalInput,
  terminalInputValueAtom,
  type UseTerminalInputOptions,
  type UseTerminalInputResult,
} from './useTerminalInput'

export {
  useAIBlockContent,
  useAIBlockText,
  useAIBlockIsStreaming,
  useAIBlockThinking,
  useAIBlockToolCalls,
  type AIBlockContent,
} from './useAIBlockContent'

export {
  useMarkdownContent,
  useStaticMarkdownContent,
  useStreamingMarkdownContent,
  type UseMarkdownContentOptions,
  type MarkdownContentResult,
} from './useMarkdownContent'
