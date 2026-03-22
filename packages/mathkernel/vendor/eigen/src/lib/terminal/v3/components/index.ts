/**
 * Terminal v3 Components
 *
 * @module terminal/v3/components
 */

// AIResponse compound component with markdown rendering + copy
export {
  AIResponse,
  AIResponseHeader,
  AIResponsePrompt,
  AIResponseThinking,
  AIResponseContent,
  AIResponseToolCalls,
  AIResponseMeta,
  AIResponseError,
  StreamingRenderer,
  MarkdownEditorView,
  EditableMarkdownEditor,
  MarkdownTextEditor,
  CopyBlockButton,
  CopyBlockButtonWithLabel,
  CodeBlockView,
  StandaloneCodeBlock,
  CodeBlockWithCopy,
  createCodeBlockWithCopy,
  type AIResponseProps,
  type MarkdownEditorViewProps,
  type EditableMarkdownEditorProps,
  type MarkdownTextEditorProps,
} from './AIResponse'

// TerminalInput - multiline TipTap-based input
export {
  TerminalInput,
  type TerminalInputRef,
  type TerminalInputProps,
  type TipTapEditor,
} from './TerminalInput'
