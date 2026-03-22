/**
 * GrepToolView - Specialized view for Grep tool calls
 *
 * Shows pattern, path, and match results with context.
 */

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { Search, CheckCircle2, Loader2, XCircle, FileText } from 'lucide-react'
import type { ToolViewProps } from '../registry'

interface GrepArgs {
  pattern: string
  path?: string
  glob?: string
  type?: string
  output_mode?: 'content' | 'files_with_matches' | 'count'
  '-C'?: number
  '-A'?: number
  '-B'?: number
  '-i'?: boolean
}

function GrepToolViewComponent({ call, result, isPending, className }: ToolViewProps) {
  const args = call.args as GrepArgs
  const hasError = result?.isError
  const isComplete = result && !isPending

  // Get output
  const output = result?.result
  const outputString = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
  const matchCount = outputString?.split('\n').filter(Boolean).length ?? 0

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        isPending && 'border-cyan-500/30 bg-cyan-500/5',
        isComplete && !hasError && 'border-cyan-500/20 bg-cyan-500/10',
        hasError && 'border-red-500/20 bg-red-500/5',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-cyan-400" />
          <span className="font-mono text-white/80 text-xs">
            Grep
          </span>
          {args.output_mode && args.output_mode !== 'content' && (
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-xs">
              {args.output_mode}
            </span>
          )}
          {args['-i'] && (
            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">
              case-insensitive
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <Loader2 size={12} className="text-cyan-400 animate-spin" />
          )}
          {isComplete && !hasError && (
            <span className="flex items-center gap-1 text-cyan-400 text-xs">
              <CheckCircle2 size={10} />
              {matchCount} {matchCount === 1 ? 'match' : 'matches'}
            </span>
          )}
          {hasError && <XCircle size={12} className="text-red-400" />}
        </div>
      </div>

      {/* Pattern & Path */}
      <div className="px-3 py-2 border-b border-white/5 bg-black/20 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">pattern:</span>
          <code className="text-magenta-300 font-mono text-xs">
            /{args.pattern}/
          </code>
        </div>
        {args.path && (
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-xs">path:</span>
            <code className="text-cyan-300 font-mono text-xs">
              {args.path}
            </code>
          </div>
        )}
        {args.glob && (
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-xs">glob:</span>
            <code className="text-green-300 font-mono text-xs">
              {args.glob}
            </code>
          </div>
        )}
        {args.type && (
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-xs">type:</span>
            <code className="text-yellow-300 font-mono text-xs">
              {args.type}
            </code>
          </div>
        )}
      </div>

      {/* Results */}
      {isComplete && !hasError && outputString && (
        <div className="max-h-[400px] overflow-y-auto">
          {args.output_mode === 'files_with_matches' ? (
            // File list mode
            <div className="py-2">
              {outputString.split('\n').filter(Boolean).map((file, i) => (
                <div
                  key={i}
                  className="px-3 py-1 flex items-center gap-2 hover:bg-white/5"
                >
                  <FileText size={12} className="text-white/40" />
                  <code className="text-cyan-300 font-mono text-xs">
                    {file}
                  </code>
                </div>
              ))}
            </div>
          ) : (
            // Content mode
            <pre
              className="px-3 py-2 text-white/70 overflow-x-auto font-mono text-xs"
              style={{ lineHeight: '1.5' }}
            >
              {outputString.length > 5000
                ? outputString.slice(0, 5000) + '\n...(truncated)'
                : outputString}
            </pre>
          )}
        </div>
      )}

      {/* No Results */}
      {isComplete && !hasError && !outputString?.trim() && (
        <div className="px-3 py-4 text-center text-white/40 text-xs">
          No matches found
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="px-3 py-2 text-red-300 text-xs">
          {result?.errorMessage ?? 'Search failed'}
        </div>
      )}

      {/* Loading */}
      {isPending && (
        <div className="px-3 py-4 flex items-center text-white/40">
          <Loader2 size={16} className="animate-spin mr-2" />
          <span className="text-xs">Searching...</span>
        </div>
      )}
    </div>
  )
}

export const GrepToolView = memo(GrepToolViewComponent)
