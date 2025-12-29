/**
 * CursorMessage Component
 *
 * Renders a single message with support for all AI SDK part types:
 * - text → MessageResponse (streaming markdown via streamdown)
 * - reasoning → Reasoning (collapsible thinking)
 * - tool-invocation → Tool display
 * - source → Sources citation
 * - file → MessageAttachment
 *
 * Uses AI Elements components with TMNL styling.
 */

import type { UIMessage, ToolUIPart, FileUIPart, SourceUIPart } from 'ai'
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
  MessageAttachments,
  MessageAttachment,
} from '@/components/ai-elements/message'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning'
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool'
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block'
import { CopyIcon, RefreshCwIcon, ThumbsUpIcon, ThumbsDownIcon } from 'lucide-react'

interface CursorMessageProps {
  message: UIMessage
  isStreaming?: boolean
  onRetry?: () => void
  onLike?: () => void
  onDislike?: () => void
}

export function CursorMessage({
  message,
  isStreaming = false,
  onRetry,
  onLike,
  onDislike,
}: CursorMessageProps) {
  const isAssistant = message.role === 'assistant'

  // Extract different part types
  const textParts = message.parts?.filter(
    (part): part is { type: 'text'; text: string } => part.type === 'text'
  ) ?? []

  const reasoningParts = message.parts?.filter(
    (part): part is { type: 'reasoning'; reasoning: string } => part.type === 'reasoning'
  ) ?? []

  const toolParts = message.parts?.filter(
    (part): part is ToolUIPart => part.type === 'tool-invocation'
  ) ?? []

  const fileParts = message.parts?.filter(
    (part): part is FileUIPart & { id?: string } => part.type === 'file'
  ) ?? []

  const sourceParts = message.parts?.filter(
    (part): part is SourceUIPart => part.type === 'source'
  ) ?? []

  // Combine text content
  const textContent = textParts.map((part) => part.text).join('')

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (textContent) {
      await navigator.clipboard.writeText(textContent)
    }
  }

  return (
    <Message from={message.role}>
      <MessageContent
        style={{
          background:
            message.role === 'user'
              ? 'linear-gradient(135deg, rgba(60, 60, 60, 0.8), rgba(50, 50, 50, 0.6))'
              : 'rgba(40, 40, 40, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* File attachments (user messages) */}
        {fileParts.length > 0 && (
          <MessageAttachments className="mb-3">
            {fileParts.map((file, index) => (
              <MessageAttachment
                key={file.url || index}
                data={file}
                className="border-white/10"
              />
            ))}
          </MessageAttachments>
        )}

        {/* Reasoning/Thinking (assistant only) */}
        {reasoningParts.length > 0 && isAssistant && (
          <div className="mb-4">
            {reasoningParts.map((part, index) => (
              <Reasoning
                key={index}
                isStreaming={isStreaming}
                defaultOpen={isStreaming}
                className="border-white/10"
              >
                <ReasoningTrigger className="text-white/50 hover:text-white/70" />
                <ReasoningContent className="text-white/60">
                  {part.reasoning}
                </ReasoningContent>
              </Reasoning>
            ))}
          </div>
        )}

        {/* Tool invocations (assistant only) */}
        {toolParts.length > 0 && isAssistant && (
          <div className="mb-4 space-y-2">
            {toolParts.map((tool, index) => (
              <Tool
                key={tool.toolCallId || index}
                defaultOpen={tool.state === 'output-available'}
                className="border-white/10 bg-white/5"
              >
                <ToolHeader
                  title={tool.toolName}
                  type={tool.type}
                  state={tool.state}
                  className="text-white/80"
                />
                <ToolContent>
                  <ToolInput input={tool.input} className="text-white/70" />
                  {(tool.output || tool.errorText) && (
                    <ToolOutput
                      output={tool.output}
                      errorText={tool.errorText}
                      className="text-white/70"
                    />
                  )}
                </ToolContent>
              </Tool>
            ))}
          </div>
        )}

        {/* Main text content */}
        {textContent && (
          <MessageResponse
            className="prose prose-invert prose-sm max-w-none"
            style={{
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: 1.5,
            }}
          >
            {textContent}
          </MessageResponse>
        )}

        {/* Source citations */}
        {sourceParts.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="text-white/40 text-xs mb-2 font-mono">Sources</div>
            <div className="flex flex-wrap gap-2">
              {sourceParts.map((source, index) => (
                <a
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded bg-white/5 text-white/60 hover:text-white/80 hover:bg-white/10 transition-colors"
                >
                  {source.title || source.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </MessageContent>

      {/* Action buttons (assistant messages only, not during streaming) */}
      {isAssistant && !isStreaming && textContent && (
        <MessageActions className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <MessageAction
            tooltip="Copy"
            onClick={handleCopy}
            className="text-white/40 hover:text-white/70"
          >
            <CopyIcon className="h-3.5 w-3.5" />
          </MessageAction>

          {onRetry && (
            <MessageAction
              tooltip="Retry"
              onClick={onRetry}
              className="text-white/40 hover:text-white/70"
            >
              <RefreshCwIcon className="h-3.5 w-3.5" />
            </MessageAction>
          )}

          {onLike && (
            <MessageAction
              tooltip="Good response"
              onClick={onLike}
              className="text-white/40 hover:text-white/70"
            >
              <ThumbsUpIcon className="h-3.5 w-3.5" />
            </MessageAction>
          )}

          {onDislike && (
            <MessageAction
              tooltip="Bad response"
              onClick={onDislike}
              className="text-white/40 hover:text-white/70"
            >
              <ThumbsDownIcon className="h-3.5 w-3.5" />
            </MessageAction>
          )}
        </MessageActions>
      )}
    </Message>
  )
}

export default CursorMessage
