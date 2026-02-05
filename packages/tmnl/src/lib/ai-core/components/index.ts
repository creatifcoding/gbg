/**
 * AI Core Components
 *
 * Message part rendering components for the AI SDK useChat integration.
 * These components render the various parts of AI messages (text, reasoning,
 * tool calls, tool results) with brutalist RVN styling.
 *
 * @example
 * ```tsx
 * import { MessagePartRenderer, TextRenderer } from '@/lib/ai-core/components'
 * import type { UIMessage } from '@ai-sdk/react'
 *
 * function MessageRenderer({ message }: { message: UIMessage }) {
 *   return (
 *     <div>
 *       {message.parts.map((part, i) => (
 *         <MessagePartRenderer key={i} part={part} />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */

// =============================================================================
// Main Renderer
// =============================================================================

export { MessagePartRenderer, type MessagePartRendererProps, type UIMessagePart } from './MessagePartRenderer'

// =============================================================================
// Part Renderers
// =============================================================================

export { TextRenderer, type TextRendererProps } from './TextRenderer'
export { ReasoningRenderer, type ReasoningRendererProps } from './ReasoningRenderer'
export { ToolCallRenderer, type ToolCallRendererProps } from './ToolCallRenderer'
export { ToolResultRenderer, type ToolResultRendererProps } from './ToolResultRenderer'
export { StepStartIndicator, type StepStartIndicatorProps } from './StepStartIndicator'

// =============================================================================
// RVN Components (Dark Theme Contrast Islands)
// =============================================================================

export {
  // Tokens
  RVN_DARK,
  darkContainerStyle,
  darkHeaderStyle,
  darkLabelStyle,
  darkCodeBlockStyle,
  darkChevronStyle,
  darkButtonStyle,
  darkApplyButtonStyle,
  darkStatusStyles,
  // Components
  CopyButton,
  type CopyButtonProps,
  ThinkingSection,
  type ThinkingSectionProps,
  SideBySideDiff,
  type SideBySideDiffProps,
  ToolArgsFormatted,
  type ToolArgsFormattedProps,
  ToolResultFormatted,
  type ToolResultFormattedProps,
  ToolCallBlock,
  type ToolCallBlockProps,
} from './rvn'

// =============================================================================
// Session Components
// =============================================================================

export {
  // Provider
  SessionProvider,
  useSessionContext,
  type SessionProviderProps,
  type SessionContextValue,
  // Sidebar
  SessionSidebar,
  type SessionSidebarProps,
  // Header
  SessionHeader,
  type SessionHeaderProps,
  // Combined Switcher
  SessionSwitcher,
  type SessionSwitcherProps,
  type SessionSwitcherRootProps,
  type SessionSwitcherContentProps,
  type SessionSwitcherMainProps,
  // Session-Aware Chat Bridge
  SessionAwareChat,
  type SessionAwareChatProps,
  type SessionChatRenderProps,
} from './session'
