/**
 * MessagePartRenderer
 *
 * Main router for UIMessagePart from AI SDK 'ai' package.
 * Routes each part type to its specialized renderer component.
 *
 * Part Types (AI SDK v6):
 * - text: Text content with markdown support
 * - reasoning: AI thinking/reasoning blocks (collapsible)
 * - tool-*: Tool invocation (type is 'tool-${toolName}')
 * - step-start: Visual step boundary indicator
 *
 * @example
 * ```tsx
 * import { UIMessage } from 'ai'
 *
 * function MessageRenderer({ message }: { message: UIMessage }) {
 *   return (
 *     <div>
 *       {message.parts.map((part, i) => (
 *         <MessagePartRenderer
 *           key={i}
 *           part={part}
 *           isStreaming={i === message.parts.length - 1 && isStreaming}
 *         />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */

import { memo } from 'react'
import type { UIMessage, ToolUIPart } from 'ai'
import { TextRenderer } from './TextRenderer'
import { ReasoningRenderer } from './ReasoningRenderer'
import { ToolCallRenderer, type ToolCallRendererProps } from './ToolCallRenderer'
import { StepStartIndicator } from './StepStartIndicator'
// Note: ToolResultRenderer exists but results are currently shown in ToolCallRenderer
// when state is 'output-available'. Import if needed for separate result display.

// =============================================================================
// Types
// =============================================================================

/**
 * Extract the part type from UIMessage
 */
export type UIMessagePart = UIMessage['parts'][number]

/**
 * Extract tool name from ToolUIPart type field
 * Type is 'tool-{toolName}' so we strip the 'tool-' prefix
 */
function extractToolName(part: ToolUIPart): string {
  // type is 'tool-{toolName}', extract the tool name
  return part.type.replace(/^tool-/, '')
}

/**
 * Get tool status from ToolUIPart state
 */
function getToolStatus(part: ToolUIPart): 'pending' | 'complete' | 'error' {
  switch (part.state) {
    case 'output-available':
      return 'complete'
    case 'output-error':
    case 'output-denied':
      return 'error'
    default:
      return 'pending'
  }
}

export interface MessagePartRendererProps {
  /** The message part to render */
  part: UIMessagePart
  /** Whether this part is currently streaming */
  isStreaming?: boolean
  /** Callback when a design action should be applied (for tool results) */
  onDesignAction?: (action: unknown) => void
  /** Custom className */
  className?: string
  /** Custom style overrides */
  style?: React.CSSProperties
}

// =============================================================================
// Component
// =============================================================================

export const MessagePartRenderer = memo(function MessagePartRenderer({
  part,
  isStreaming = false,
  onDesignAction,
  className,
  style,
}: MessagePartRendererProps) {
  // Text parts
  if (part.type === 'text') {
    return (
      <TextRenderer
        text={part.text}
        isStreaming={isStreaming}
        className={className}
        style={style}
      />
    )
  }

  // Reasoning parts - AI SDK v6 uses 'text' property
  if (part.type === 'reasoning') {
    // ReasoningUIPart has text property, not reasoning
    const reasoningText = (part as unknown as { text: string }).text
    return (
      <ReasoningRenderer
        reasoning={reasoningText}
        className={className}
        style={style}
      />
    )
  }

  // Tool parts - type is 'tool-${toolName}'
  if (part.type.startsWith('tool-')) {
    const toolPart = part as ToolUIPart
    const status = getToolStatus(toolPart)
    const hasOutput = toolPart.state === 'output-available'
    const hasError = toolPart.state === 'output-error'

    return (
      <ToolCallRenderer
        toolCall={{
          toolCallId: toolPart.toolCallId,
          toolName: extractToolName(toolPart),
          args: toolPart.input,
        }}
        status={status}
        result={
          hasOutput || hasError
            ? {
                isError: hasError,
                errorMessage: hasError ? (toolPart as { errorText?: string }).errorText : null,
                result: hasOutput ? toolPart.output : undefined,
              }
            : undefined
        }
        onDesignAction={onDesignAction as ToolCallRendererProps['onDesignAction']}
        className={className}
        style={style}
      />
    )
  }

  // Step start indicator
  if (part.type === 'step-start') {
    return <StepStartIndicator className={className} style={style} />
  }

  // Unknown part type - log warning and return null
  if (process.env.NODE_ENV === 'development') {
    console.warn('[MessagePartRenderer] Unknown part type:', part.type)
  }
  return null
})

export default MessagePartRenderer
