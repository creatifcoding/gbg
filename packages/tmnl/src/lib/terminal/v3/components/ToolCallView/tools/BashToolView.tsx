/**
 * BashToolView - Specialized view for Bash/shell tool calls
 *
 * Shows command with syntax highlighting, exit status, and output.
 */

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { Terminal, CheckCircle2, Loader2, XCircle, Copy, AlertTriangle } from 'lucide-react'
import type { ToolViewProps } from '../registry'

interface BashArgs {
  command: string
  description?: string
  timeout?: number
  cwd?: string
}

function BashToolViewComponent({ call, result, isPending, className }: ToolViewProps) {
  const args = call.args as BashArgs
  const hasError = result?.isError
  const isComplete = result && !isPending

  // Get output
  const output = result?.result
  const outputString = typeof output === 'string' ? output : JSON.stringify(output, null, 2)

  // Detect if output is too long
  const isTruncated = outputString && outputString.length > 5000

  const handleCopy = () => {
    if (outputString) {
      navigator.clipboard.writeText(outputString)
    }
  }

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(args.command)
  }

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        isPending && 'border-orange-500/30 bg-orange-500/5',
        isComplete && !hasError && 'border-orange-500/20 bg-orange-500/10',
        hasError && 'border-red-500/20 bg-red-500/5',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-orange-400" />
          <span className="font-mono text-white/80 text-xs">
            Bash
          </span>
          {args.description && (
            <span className="text-white/40 truncate max-w-[200px] text-xs">
              {args.description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <span className="flex items-center gap-1 text-orange-400 text-xs">
              <Loader2 size={10} className="animate-spin" />
              running
            </span>
          )}
          {isComplete && !hasError && (
            <CheckCircle2 size={12} className="text-green-400" />
          )}
          {hasError && <XCircle size={12} className="text-red-400" />}
        </div>
      </div>

      {/* Command */}
      <div className="px-3 py-2 border-b border-white/5 bg-black/20">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {args.cwd && (
              <div className="text-white/30 font-mono mb-1 text-xs">
                {args.cwd}
              </div>
            )}
            <code className="text-orange-300 font-mono break-all whitespace-pre-wrap text-xs">
              <span className="text-green-400">$</span> {args.command}
            </code>
          </div>
          <button
            onClick={handleCopyCommand}
            className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
          >
            <Copy size={12} />
          </button>
        </div>
      </div>

      {/* Output */}
      {isComplete && outputString && (
        <div className="relative">
          <div className="absolute top-2 right-2 flex items-center gap-2">
            {isTruncated && (
              <span className="flex items-center gap-1 text-yellow-400 text-xs">
                <AlertTriangle size={10} />
                truncated
              </span>
            )}
            <button
              onClick={handleCopy}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <Copy size={12} />
            </button>
          </div>
          <pre
            className={cn(
              'px-3 py-2 overflow-x-auto font-mono text-xs',
              hasError ? 'text-red-300/80' : 'text-white/70'
            )}
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              lineHeight: '1.4',
            }}
          >
            {isTruncated
              ? outputString.slice(0, 5000) + '\n...(output truncated)'
              : outputString}
          </pre>
        </div>
      )}

      {/* Loading */}
      {isPending && (
        <div className="px-3 py-4 flex items-center text-white/40">
          <Loader2 size={16} className="animate-spin mr-2" />
          <span className="text-xs">Executing command...</span>
          {args.timeout && (
            <span className="ml-auto text-white/30 text-xs">
              timeout: {args.timeout}ms
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export const BashToolView = memo(BashToolViewComponent)
