/**
 * AIResponseBlock Component
 *
 * Renders an AI response block with streaming text, thinking,
 * tool calls, and token usage.
 * Follows TMNL design tokens and typography discipline.
 */

import { memo, useMemo, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { AIResponseBlock as AIResponseBlockType, ToolCall } from '../schemas'

export interface AIResponseBlockProps {
  /**
   * The AI response block data
   */
  block: AIResponseBlockType

  /**
   * Optional click handler for the block
   */
  onClick?: () => void

  /**
   * Optional class name
   */
  className?: string

  /**
   * Whether to show thinking section (extended thinking)
   */
  showThinking?: boolean

  /**
   * Whether to show token usage
   */
  showTokens?: boolean

  /**
   * Custom markdown renderer (defaults to basic rendering)
   */
  renderMarkdown?: (content: string) => React.ReactNode
}

/**
 * Format duration in human-readable form
 */
function formatDuration(startTime: Date, endTime: Date | null): string {
  if (!endTime) return 'streaming...'
  const ms = endTime.getTime() - startTime.getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

/**
 * Format token count
 */
function formatTokens(count: number | undefined): string {
  if (count === undefined) return '-'
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return count.toString()
}

/**
 * Format cost
 */
function formatCost(cost: number | undefined): string {
  if (cost === undefined) return '-'
  if (cost < 0.01) return `$${(cost * 1000).toFixed(2)}m`
  return `$${cost.toFixed(4)}`
}

/**
 * Get tool call status color
 */
function getToolStatusColor(status: ToolCall['status']): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-500'
    case 'running':
      return 'text-cyan-500'
    case 'completed':
      return 'text-emerald-500'
    case 'error':
      return 'text-red-500'
    default:
      return 'text-muted-foreground'
  }
}

/**
 * ToolCallItem - renders a single tool call
 */
const ToolCallItem = memo(function ToolCallItem({ tool }: { tool: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="rounded border border-surface-3 bg-surface-0">
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-surface-1 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Status indicator */}
        <span className="relative flex h-2 w-2 shrink-0">
          {tool.status === 'running' ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </>
          ) : (
            <span
              className={cn(
                'inline-flex rounded-full h-2 w-2',
                tool.status === 'completed' && 'bg-emerald-500',
                tool.status === 'error' && 'bg-red-500',
                tool.status === 'pending' && 'bg-yellow-500'
              )}
            />
          )}
        </span>

        {/* Tool name */}
        <code
          className={cn('font-mono flex-1', getToolStatusColor(tool.status))}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {tool.name}
        </code>

        {/* Expand indicator */}
        <svg
          className={cn(
            'w-3 h-3 text-muted-foreground transition-transform',
            isExpanded && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-2 pb-2 space-y-2">
          {/* Input */}
          {tool.input && (
            <div>
              <span
                className="font-mono text-muted-foreground"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Input:
              </span>
              <pre
                className="mt-1 p-2 rounded bg-surface-1 font-mono text-foreground/80 overflow-x-auto"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {JSON.stringify(tool.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Output */}
          {tool.output && (
            <div>
              <span
                className="font-mono text-muted-foreground"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                Output:
              </span>
              <pre
                className="mt-1 p-2 rounded bg-surface-1 font-mono text-foreground/80 overflow-x-auto max-h-32 overflow-y-auto"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {tool.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

/**
 * Default markdown renderer (basic, no dependencies)
 */
function defaultRenderMarkdown(content: string): React.ReactNode {
  // Very basic markdown-like rendering
  // For production, use a proper markdown library
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      {content.split('\n\n').map((paragraph, i) => {
        // Code blocks
        if (paragraph.startsWith('```')) {
          const lines = paragraph.split('\n')
          const lang = lines[0].slice(3)
          const code = lines.slice(1, -1).join('\n')
          return (
            <pre
              key={i}
              className="rounded bg-surface-0 p-3 overflow-x-auto"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <code className={`language-${lang}`}>{code}</code>
            </pre>
          )
        }

        // Inline code
        const withInlineCode = paragraph.split(/`([^`]+)`/).map((part, j) =>
          j % 2 === 1 ? (
            <code
              key={j}
              className="rounded bg-surface-0 px-1 py-0.5 font-mono"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {part}
            </code>
          ) : (
            part
          )
        )

        return (
          <p
            key={i}
            className="leading-relaxed"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {withInlineCode}
          </p>
        )
      })}
    </div>
  )
}

/**
 * AIResponseBlock - renders an AI response with streaming support
 */
export const AIResponseBlock = memo(function AIResponseBlock({
  block,
  onClick,
  className,
  showThinking = true,
  showTokens = true,
  renderMarkdown = defaultRenderMarkdown,
}: AIResponseBlockProps) {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false)

  const duration = useMemo(
    () => formatDuration(block.startTime, block.endTime),
    [block.startTime, block.endTime]
  )

  const hasThinking = Boolean(block.thinking)
  const hasToolCalls = Boolean(block.toolCalls?.length)

  return (
    <div
      className={cn(
        'group relative rounded-lg border transition-colors',
        'bg-surface-1 border-surface-3 hover:border-surface-4',
        block.isStreaming && 'border-violet-500/30',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {/* Header: Prompt */}
      <div className="flex items-start gap-2 px-3 py-2 border-b border-surface-2">
        {/* User indicator */}
        <span
          className="font-mono text-emerald-500 shrink-0"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          &gt;
        </span>

        {/* Prompt */}
        <span
          className="text-foreground break-all flex-1"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          {block.prompt}
        </span>

        {/* Model badge */}
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 font-mono',
            'bg-violet-500/10 text-violet-400'
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {block.model.split('-')[0]}
        </span>
      </div>

      {/* Thinking section (collapsible) */}
      {showThinking && hasThinking && (
        <div className="border-b border-surface-2">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-0 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setIsThinkingExpanded(!isThinkingExpanded)
            }}
          >
            <svg
              className="w-4 h-4 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <span
              className="font-mono text-amber-500"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              Thinking
            </span>
            <svg
              className={cn(
                'w-3 h-3 text-muted-foreground transition-transform ml-auto',
                isThinkingExpanded && 'rotate-180'
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isThinkingExpanded && (
            <div
              className="px-3 pb-2 text-muted-foreground italic max-h-48 overflow-y-auto"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {block.thinking}
            </div>
          )}
        </div>
      )}

      {/* Tool calls section */}
      {hasToolCalls && (
        <div className="px-3 py-2 border-b border-surface-2 space-y-2">
          <span
            className="font-mono text-muted-foreground"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Tool Calls ({block.toolCalls!.length})
          </span>
          <div className="space-y-1">
            {block.toolCalls!.map((tool) => (
              <ToolCallItem key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      )}

      {/* Response content */}
      <div className="px-3 py-2">
        {block.response ? (
          renderMarkdown(block.response)
        ) : block.isStreaming ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
            <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Generating response...
            </span>
          </div>
        ) : (
          <span
            className="text-muted-foreground italic"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            No response
          </span>
        )}

        {/* Streaming cursor */}
        {block.isStreaming && block.response && (
          <span className="inline-block w-2 h-4 bg-violet-500 animate-pulse ml-0.5" />
        )}
      </div>

      {/* Footer: Tokens + Duration */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-surface-2 bg-surface-0">
        {/* Token usage */}
        {showTokens && block.tokens && (
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-muted-foreground"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <span className="text-cyan-400">{formatTokens(block.tokens.input)}</span>
              <span className="mx-1">→</span>
              <span className="text-emerald-400">{formatTokens(block.tokens.output)}</span>
              {block.tokens.reasoning && (
                <>
                  <span className="mx-1">+</span>
                  <span className="text-amber-400">{formatTokens(block.tokens.reasoning)}</span>
                </>
              )}
            </span>
            {block.cost !== undefined && (
              <span
                className="font-mono text-muted-foreground"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {formatCost(block.cost)}
              </span>
            )}
          </div>
        )}

        {/* Status + Duration */}
        <div className="flex items-center gap-2 ml-auto">
          {block.isStreaming ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
              </span>
              <span
                className="font-mono text-violet-400"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                streaming
              </span>
            </>
          ) : (
            <span
              className="font-mono text-muted-foreground"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {duration}
            </span>
          )}
        </div>
      </div>
    </div>
  )
})

export default AIResponseBlock
