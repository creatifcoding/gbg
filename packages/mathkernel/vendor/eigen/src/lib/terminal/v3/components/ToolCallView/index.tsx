/**
 * ToolCallView Compound Component
 *
 * Base component for rendering tool calls with extensible sub-components.
 * Uses registry pattern to dispatch to specialized tool views.
 *
 * @example
 * <ToolCallView call={call} result={result} isPending={isPending}>
 *   <ToolCallView.Header />
 *   <ToolCallView.Args />
 *   <ToolCallView.Result />
 * </ToolCallView>
 */

import { createContext, useContext, memo, type ReactNode } from 'react'
import { Option } from 'effect'
import { cn } from '@/lib/utils'
import {
  FileText,
  Terminal,
  Search,
  Edit3,
  Globe,
  Wrench,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Copy,
  FolderSearch,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { ToolCallComplete, ToolResult } from '@/lib/ai-core/schemas'
import {
  type ToolViewProps,
  getToolComponent,
  getToolCategory,
  getCategoryInfo,
} from './registry'
import { detectMapData } from './detection'
import { MapToolView } from './tools/MapToolView'

// =============================================================================
// Context
// =============================================================================

interface ToolCallContextValue {
  call: ToolCallComplete
  result: ToolResult | null
  isPending: boolean
}

const ToolCallContext = createContext<ToolCallContextValue | null>(null)

const useToolCall = () => {
  const ctx = useContext(ToolCallContext)
  if (!ctx) {
    throw new Error('ToolCallView.* components must be used within <ToolCallView>')
  }
  return ctx
}

// =============================================================================
// Icon Mapping
// =============================================================================

const toolIcons: Record<string, typeof FileText> = {
  Read: FileText,
  Write: Edit3,
  Edit: Edit3,
  Glob: FolderSearch,
  Grep: Search,
  Bash: Terminal,
  WebFetch: Globe,
  WebSearch: Globe,
  Task: Wrench,
}

function getToolIcon(toolName: string) {
  // Handle MCP tools
  if (toolName.startsWith('mcp__')) {
    return Globe
  }
  return toolIcons[toolName] ?? Wrench
}

// =============================================================================
// Root Component
// =============================================================================

interface ToolCallViewProps {
  call: ToolCallComplete
  result: ToolResult | null
  isPending: boolean
  className?: string
  children?: ReactNode
}

function ToolCallViewRoot({ call, result, isPending, className, children }: ToolCallViewProps) {
  // 1. Detection-based dispatch (GeoJSON/MapOutput auto-detect)
  // Only try detection when we have a result
  if (result) {
    console.log('[ToolCallView] Checking detection for:', call.toolName, 'result:', result.result)
    const detectedMap = detectMapData({
      toolName: call.toolName,
      toolCallId: call.toolCallId,
      result: result.result,
    })
    console.log('[ToolCallView] Detection result:', Option.isSome(detectedMap) ? 'DETECTED' : 'NOT_DETECTED')
    if (Option.isSome(detectedMap)) {
      console.log('[ToolCallView] Rendering MapToolView for:', call.toolName)
      return <MapToolView call={call} result={result} isPending={isPending} className={className} />
    }
  }

  // 2. Check for specialized component (explicit registry)
  const specialized = getToolComponent(call.toolName)
  if (specialized) {
    const Specialized = specialized.component
    return <Specialized call={call} result={result} isPending={isPending} className={className} />
  }

  // 3. Default compound component rendering
  const hasError = result?.isError
  const isComplete = result && !isPending

  return (
    <ToolCallContext.Provider value={{ call, result, isPending }}>
      <div
        className={cn(
          'rounded-lg border transition-colors',
          isPending && 'border-blue-500/30 bg-blue-500/5',
          isComplete && !hasError && 'border-green-500/20 bg-green-500/5',
          hasError && 'border-red-500/20 bg-red-500/5',
          className
        )}
      >
        {children}
      </div>
    </ToolCallContext.Provider>
  )
}

// =============================================================================
// Header Component
// =============================================================================

interface HeaderProps {
  className?: string
  showCategory?: boolean
  showStatus?: boolean
}

function Header({ className, showCategory = true, showStatus = true }: HeaderProps) {
  const { call, result, isPending } = useToolCall()
  const Icon = getToolIcon(call.toolName)
  const category = getToolCategory(call.toolName)
  const categoryInfo = getCategoryInfo(category)
  const hasError = result?.isError

  // Extract display name (handle MCP tools)
  const displayName = call.toolName.startsWith('mcp__')
    ? call.toolName.split('__').slice(-1)[0]
    : call.toolName

  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2 border-b border-white/5',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className={categoryInfo.color} />
        <span className="font-mono text-white/80" style={{ fontSize: '12px' }}>
          {displayName}
        </span>
        {showCategory && (
          <span
            className={cn('px-1.5 py-0.5 rounded text-xs', categoryInfo.color, 'bg-white/5')}
            style={{ fontSize: '10px' }}
          >
            {categoryInfo.label}
          </span>
        )}
      </div>
      {showStatus && (
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="flex items-center gap-1 text-blue-400" style={{ fontSize: '10px' }}>
              <Loader2 size={10} className="animate-spin" />
              running
            </span>
          )}
          {!isPending && !hasError && result && (
            <span className="flex items-center gap-1 text-green-400" style={{ fontSize: '10px' }}>
              <CheckCircle2 size={10} />
              complete
            </span>
          )}
          {hasError && (
            <span className="flex items-center gap-1 text-red-400" style={{ fontSize: '10px' }}>
              <XCircle size={10} />
              failed
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Args Component (Collapsible)
// =============================================================================

interface ArgsProps {
  className?: string
  defaultOpen?: boolean
  maxHeight?: number
}

function Args({ className, defaultOpen = false, maxHeight = 200 }: ArgsProps) {
  const { call } = useToolCall()

  const argsString =
    typeof call.args === 'string' ? call.args : JSON.stringify(call.args, null, 2)

  return (
    <Collapsible className={cn('border-b border-white/5', className)} defaultOpen={defaultOpen}>
      <CollapsibleTrigger
        className="flex items-center gap-2 w-full px-3 py-1.5 text-white/50 hover:text-white/70 transition-colors"
        style={{ fontSize: '11px' }}
      >
        <span>Arguments</span>
        <ChevronDown
          size={12}
          className="ml-auto transition-transform data-[state=open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-2">
        <pre
          className="text-white/60 overflow-x-auto font-mono bg-black/20 rounded p-2"
          style={{ fontSize: '11px', maxHeight: `${maxHeight}px`, overflowY: 'auto' }}
        >
          {argsString}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}

// =============================================================================
// Result Component
// =============================================================================

interface ResultProps {
  className?: string
  maxHeight?: number
  showCopy?: boolean
}

function Result({ className, maxHeight = 300, showCopy = true }: ResultProps) {
  const { result, isPending } = useToolCall()

  if (isPending || !result) {
    return null
  }

  const resultString =
    typeof result.result === 'string'
      ? result.result
      : JSON.stringify(result.result, null, 2)

  const handleCopy = () => {
    navigator.clipboard.writeText(resultString)
  }

  return (
    <div className={cn('px-3 py-2', className)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-white/40" style={{ fontSize: '10px' }}>
          Result
        </span>
        {showCopy && (
          <button
            onClick={handleCopy}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <Copy size={12} />
          </button>
        )}
      </div>
      {result.isError ? (
        <div
          className="text-red-300/80 bg-red-500/10 rounded p-2"
          style={{ fontSize: '11px' }}
        >
          {result.errorMessage ?? resultString}
        </div>
      ) : (
        <pre
          className="text-white/70 overflow-x-auto font-mono bg-black/20 rounded p-2"
          style={{ fontSize: '11px', maxHeight: `${maxHeight}px`, overflowY: 'auto' }}
        >
          {resultString.length > 2000 ? resultString.slice(0, 2000) + '\n...(truncated)' : resultString}
        </pre>
      )}
    </div>
  )
}

// =============================================================================
// Error Component
// =============================================================================

interface ErrorProps {
  className?: string
}

function Error({ className }: ErrorProps) {
  const { result } = useToolCall()

  if (!result?.isError) {
    return null
  }

  return (
    <div
      className={cn(
        'px-3 py-2 bg-red-500/10 text-red-300 border-t border-red-500/20',
        className
      )}
      style={{ fontSize: '11px' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <XCircle size={12} />
        <span className="font-medium">Error</span>
      </div>
      <p className="text-red-300/80">{result.errorMessage ?? 'Unknown error'}</p>
    </div>
  )
}

// =============================================================================
// Meta Component (timing, etc.)
// =============================================================================

interface MetaProps {
  className?: string
}

function Meta({ className }: MetaProps) {
  const { call } = useToolCall()

  return (
    <div
      className={cn('px-3 py-1.5 border-t border-white/5 text-white/30', className)}
      style={{ fontSize: '10px' }}
    >
      <span className="font-mono">id: {call.toolCallId.slice(0, 12)}...</span>
      {call.serverId && (
        <span className="ml-4 font-mono">server: {call.serverId}</span>
      )}
    </div>
  )
}

// =============================================================================
// Compound Component Export
// =============================================================================

export const ToolCallView = Object.assign(memo(ToolCallViewRoot), {
  Header: memo(Header),
  Args: memo(Args),
  Result: memo(Result),
  Error: memo(Error),
  Meta: memo(Meta),
})

// Named exports
export type { ToolViewProps }
export { Header as ToolCallHeader }
export { Args as ToolCallArgs }
export { Result as ToolCallResult }
export { Error as ToolCallError }
export { Meta as ToolCallMeta }
