/**
 * AIResponse Compound Component
 *
 * Displays AI responses with thinking, text, and tool calls.
 * Derived from Vercel AI Elements (Apache 2.0) adapted for TMNL.
 *
 * Features:
 * - Markdown rendering with syntax highlighting
 * - Copy button with dual-format clipboard (HTML + plain text)
 * - Buffered streaming for flicker-free updates
 * - Collapsible thinking section
 * - Tool call registry integration
 *
 * @example
 * <AIResponse block={block}>
 *   <AIResponse.Thinking />
 *   <AIResponse.Content />
 *   <AIResponse.ToolCalls />
 *   <AIResponse.Meta />
 * </AIResponse>
 */

import { createContext, useContext, memo, useState, useEffect, type ReactNode } from 'react'
import { useControllableState } from '@radix-ui/react-use-controllable-state'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { Brain, ChevronDown, Sparkles, Wrench, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useAIBlockContent, type AIBlockContent } from '../../hooks/useAIBlockContent'
import type { AIResponseBlockV3 } from '../../schemas'
import { ToolCallView } from '../ToolCallView'
import { StreamingRenderer } from './StreamingRenderer'
import { CopyBlockButton } from './CopyBlockButton'
// Import tools to register them
import '../ToolCallView/tools'

// =============================================================================
// Context
// =============================================================================

interface AIResponseContextValue {
  block: AIResponseBlockV3
  content: AIBlockContent
}

const AIResponseContext = createContext<AIResponseContextValue | null>(null)

const useAIResponse = () => {
  const ctx = useContext(AIResponseContext)
  if (!ctx) {
    throw new Error('AIResponse.* components must be used within <AIResponse>')
  }
  return ctx
}

// =============================================================================
// Root Component
// =============================================================================

export interface AIResponseProps {
  block: AIResponseBlockV3
  children: ReactNode
  className?: string
}

function AIResponseRoot({ block, children, className }: AIResponseProps) {
  // Derive content from ai-core (reference-based, no dual-write)
  const content = useAIBlockContent(block)

  return (
    <AIResponseContext.Provider value={{ block, content }}>
      <div
        className={cn(
          'rounded-lg border border-magenta-500/20 bg-magenta-500/5',
          'transition-colors',
          content.isStreaming && 'border-cyan-500/30 bg-cyan-500/5',
          content.hasError && 'border-red-500/30 bg-red-500/5',
          className
        )}
      >
        {children}
      </div>
    </AIResponseContext.Provider>
  )
}

// =============================================================================
// Header Component
// =============================================================================

interface HeaderProps {
  className?: string
  showStatus?: boolean
  showCopy?: boolean
}

function Header({ className, showStatus = true, showCopy = true }: HeaderProps) {
  const { block, content } = useAIResponse()

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 border-b border-white/5',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-magenta-400" />
        <span className="font-mono text-magenta-400" style={{ fontSize: '12px' }}>
          AI Response
        </span>
        {showStatus && content.isStreaming && (
          <span
            className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 animate-pulse flex items-center gap-1"
            style={{ fontSize: '10px' }}
          >
            <Loader2 size={10} className="animate-spin" />
            streaming
          </span>
        )}
        {showStatus && content.isComplete && (
          <span
            className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 flex items-center gap-1"
            style={{ fontSize: '10px' }}
          >
            <CheckCircle2 size={10} />
            complete
          </span>
        )}
        {showStatus && content.hasError && (
          <span
            className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex items-center gap-1"
            style={{ fontSize: '10px' }}
          >
            <XCircle size={10} />
            error
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showCopy && content.text && !content.isStreaming && (
          <CopyBlockButton
            text={content.text}
            size="sm"
            tooltipText="Copy response"
          />
        )}
        <span className="font-mono text-white/30" style={{ fontSize: '10px' }}>
          {block.id.slice(0, 8)}
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Prompt Component
// =============================================================================

interface PromptProps {
  className?: string
}

function Prompt({ className }: PromptProps) {
  const { block } = useAIResponse()

  return (
    <div
      className={cn(
        'px-4 py-2 text-white/50 italic border-b border-white/5',
        className
      )}
      style={{ fontSize: '12px' }}
    >
      "{block.prompt}"
    </div>
  )
}

// =============================================================================
// Thinking Component (Collapsible)
// =============================================================================

const AUTO_CLOSE_DELAY = 1500

interface ThinkingProps {
  className?: string
  defaultOpen?: boolean
  title?: string
}

function Thinking({ className, defaultOpen = false, title = 'Thinking' }: ThinkingProps) {
  const { content } = useAIResponse()
  const [startTime, setStartTime] = useState<number | null>(null)
  const [duration, setDuration] = useState(0)
  const [hasAutoClosedRef, setHasAutoClosedRef] = useState(false)

  // Use controllable state for open/close
  const [isOpen, setIsOpen] = useControllableState({
    defaultProp: defaultOpen,
  })

  // Track duration when streaming
  useEffect(() => {
    if (content.isStreaming && content.thinking) {
      if (startTime === null) {
        setStartTime(Date.now())
      }
    } else if (startTime !== null) {
      setDuration(Math.round((Date.now() - startTime) / 1000))
      setStartTime(null)
    }
  }, [content.isStreaming, content.thinking, startTime])

  // Auto-open when thinking starts, auto-close when done
  useEffect(() => {
    if (content.thinking && content.isStreaming && !isOpen) {
      setIsOpen(true)
    } else if (!content.isStreaming && isOpen && !defaultOpen && !hasAutoClosedRef && content.thinking) {
      const timer = setTimeout(() => {
        setIsOpen(false)
        setHasAutoClosedRef(true)
      }, AUTO_CLOSE_DELAY)
      return () => clearTimeout(timer)
    }
  }, [content.isStreaming, content.thinking, isOpen, defaultOpen, setIsOpen, hasAutoClosedRef])

  // Don't render if no thinking content
  if (!content.thinking && !content.isStreaming) {
    return null
  }

  return (
    <Collapsible
      className={cn('border-b border-white/5', className)}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <CollapsibleTrigger
        className="flex items-center gap-2 w-full px-4 py-2 text-yellow-400/80 hover:text-yellow-400 transition-colors"
        style={{ fontSize: '12px' }}
      >
        <Brain size={14} className="text-yellow-500" />
        {content.isStreaming && content.thinking ? (
          <span className="flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" />
            {title}...
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Clock size={12} />
            Thought for {duration}s
          </span>
        )}
        <ChevronDown
          size={14}
          className={cn(
            'ml-auto transition-transform',
            isOpen ? 'rotate-180' : 'rotate-0'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          'px-4 pb-3',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2',
          'data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2'
        )}
      >
        <div
          className="pl-3 border-l-2 border-yellow-500/30 text-yellow-300/70 whitespace-pre-wrap max-h-64 overflow-y-auto"
          style={{ fontSize: '12px' }}
        >
          {content.thinking}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// =============================================================================
// Content Component (Main Response Text)
// =============================================================================

interface ContentProps {
  className?: string
  /** Render custom content instead of default text */
  children?: (text: string, isStreaming: boolean) => ReactNode
  /** Force plain text rendering (no markdown) */
  plainText?: boolean
}

function Content({ className, children, plainText = false }: ContentProps) {
  const { content } = useAIResponse()

  const text = content.text || (content.isStreaming ? '' : '(no response)')

  return (
    <div className={cn('px-4 py-3', className)}>
      {children ? (
        children(text, content.isStreaming)
      ) : (
        <StreamingRenderer
          text={text}
          isStreaming={content.isStreaming}
          plainText={plainText}
        />
      )}
    </div>
  )
}

// =============================================================================
// ToolCalls Component
// =============================================================================

interface ToolCallsProps {
  className?: string
  defaultOpen?: boolean
}

function ToolCalls({ className, defaultOpen = true }: ToolCallsProps) {
  const { content } = useAIResponse()

  const pendingCount = content.pendingToolCalls.length
  const completedCount = content.completedToolCalls.length
  const totalCount = pendingCount + completedCount

  console.log('[AIResponse.ToolCalls] Rendering:', {
    pendingCount,
    completedCount,
    totalCount,
    completedToolCalls: content.completedToolCalls.map(tc => ({
      toolName: tc.call.toolName,
      toolCallId: tc.call.toolCallId,
      hasResult: !!tc.result,
      resultType: tc.result ? typeof tc.result.result : 'no result',
    })),
  })

  if (totalCount === 0) {
    return null
  }

  return (
    <Collapsible
      className={cn('border-t border-white/5', className)}
      defaultOpen={defaultOpen}
    >
      <CollapsibleTrigger
        className="flex items-center gap-2 w-full px-4 py-2 text-blue-400/80 hover:text-blue-400 transition-colors"
        style={{ fontSize: '12px' }}
      >
        <Wrench size={14} />
        <span>
          {pendingCount > 0 ? (
            <>
              <Loader2 size={12} className="inline animate-spin mr-1" />
              {pendingCount} tool{pendingCount !== 1 ? 's' : ''} running
            </>
          ) : (
            <>
              {completedCount} tool call{completedCount !== 1 ? 's' : ''}
            </>
          )}
        </span>
        <ChevronDown
          size={14}
          className="ml-auto transition-transform data-[state=open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-3 space-y-2">
        {/* Pending tool calls - render with ToolCallView */}
        {content.pendingToolCalls.map((tc: any) => (
          <ToolCallView
            key={tc.toolCallId}
            call={{
              _tag: 'ToolCallComplete',
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: {},
              serverId: tc.serverId ?? null,
            }}
            result={null}
            isPending={true}
          >
            <ToolCallView.Header showCategory={false} />
          </ToolCallView>
        ))}
        {/* Completed tool calls - render with ToolCallView */}
        {content.completedToolCalls.map(({ call, result }) => (
          <ToolCallView
            key={call.toolCallId}
            call={call}
            result={result}
            isPending={false}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

// =============================================================================
// Meta Component (StreamRef info, usage, etc.)
// =============================================================================

interface MetaProps {
  className?: string
  showStreamRef?: boolean
  showUsage?: boolean
  showModel?: boolean
}

function Meta({
  className,
  showStreamRef = true,
  showUsage = true,
  showModel = true,
}: MetaProps) {
  const { block, content } = useAIResponse()

  return (
    <div
      className={cn(
        'px-4 py-2 border-t border-white/5 flex flex-wrap items-center gap-x-4 gap-y-1',
        className
      )}
      style={{ fontSize: '10px' }}
    >
      {showStreamRef && (
        <span className="text-white/30 font-mono">
          ref: {block.streamRef.requestId.slice(0, 12)}...
        </span>
      )}
      {showModel && (
        <span className="text-white/30 font-mono">
          model: {block.streamRef.modelId}
        </span>
      )}
      {showUsage && content.usage && (
        <span className="text-white/30 font-mono">
          tokens: {content.usage.totalTokens ?? 'n/a'}
        </span>
      )}
      <span
        className={cn(
          'font-mono',
          content.isComplete ? 'text-green-400/70' :
          content.hasError ? 'text-red-400/70' :
          content.isStreaming ? 'text-cyan-400/70' :
          'text-white/30'
        )}
      >
        {content.status}
      </span>
    </div>
  )
}

// =============================================================================
// Error Component
// =============================================================================

interface ErrorProps {
  className?: string
}

function ErrorDisplay({ className }: ErrorProps) {
  const { content } = useAIResponse()

  if (!content.hasError || !content.error) {
    return null
  }

  return (
    <div
      className={cn(
        'px-4 py-3 bg-red-500/10 border-t border-red-500/20 text-red-300',
        className
      )}
      style={{ fontSize: '12px' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <XCircle size={14} className="text-red-400" />
        <span className="font-medium">Error</span>
      </div>
      <p className="text-red-300/80">{content.error}</p>
    </div>
  )
}

// =============================================================================
// Compound Component Export
// =============================================================================

export const AIResponse = Object.assign(memo(AIResponseRoot), {
  Header: memo(Header),
  Prompt: memo(Prompt),
  Thinking: memo(Thinking),
  Content: memo(Content),
  ToolCalls: memo(ToolCalls),
  Meta: memo(Meta),
  Error: memo(ErrorDisplay),
})

// Named exports for tree-shaking
export { Header as AIResponseHeader }
export { Prompt as AIResponsePrompt }
export { Thinking as AIResponseThinking }
export { Content as AIResponseContent }
export { ToolCalls as AIResponseToolCalls }
export { Meta as AIResponseMeta }
export { ErrorDisplay as AIResponseError }

// Re-export new components for direct use
export { StreamingRenderer } from './StreamingRenderer'
export {
  MarkdownEditorView,
  EditableMarkdownEditor,
  MarkdownTextEditor,
  type MarkdownEditorViewProps,
  type EditableMarkdownEditorProps,
  type MarkdownTextEditorProps,
} from './MarkdownEditorView'
export { CopyBlockButton, CopyBlockButtonWithLabel } from './CopyBlockButton'
export { CodeBlockView, StandaloneCodeBlock } from './CodeBlockView'
export { CodeBlockWithCopy, createCodeBlockWithCopy } from './CodeBlockExtension'
