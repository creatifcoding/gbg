/**
 * ReadToolView - Specialized view for Read tool calls
 *
 * Shows file path, line range, and syntax-highlighted content preview.
 */

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { FileText, CheckCircle2, Loader2, XCircle, Copy } from 'lucide-react'
import type { ToolViewProps } from '../registry'

interface ReadArgs {
  file_path: string
  offset?: number
  limit?: number
}

function ReadToolViewComponent({ call, result, isPending, className }: ToolViewProps) {
  const rawArgs = call.args as Partial<ReadArgs> | undefined
  const args: ReadArgs = {
    file_path: rawArgs?.file_path ?? '',
    offset: rawArgs?.offset,
    limit: rawArgs?.limit,
  }
  const hasError = result?.isError
  const isComplete = result && !isPending

  // Extract file extension for syntax hint
  const extension = args.file_path ? args.file_path.split('.').pop() ?? '' : ''

  // Get content preview
  const content = result?.result
  const contentString = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  const lineCount = contentString?.split('\n').length ?? 0

  const handleCopy = () => {
    if (contentString) {
      navigator.clipboard.writeText(contentString)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        isPending && 'border-green-500/30 bg-green-500/5',
        isComplete && !hasError && 'border-green-500/20 bg-green-500/10',
        hasError && 'border-red-500/20 bg-red-500/5',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-green-400" />
          <span className="font-mono text-white/80 text-xs">
            Read
          </span>
          <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-xs">
            .{extension}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <Loader2 size={12} className="text-green-400 animate-spin" />
          )}
          {isComplete && !hasError && (
            <CheckCircle2 size={12} className="text-green-400" />
          )}
          {hasError && <XCircle size={12} className="text-red-400" />}
        </div>
      </div>

      {/* File Path */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="flex items-center justify-between">
          <code className="text-cyan-300 font-mono break-all text-xs">
            {args.file_path}
          </code>
          {args.offset !== undefined && args.limit !== undefined && (
            <span className="text-white/40 ml-2 whitespace-nowrap text-xs">
              lines {args.offset + 1}-{args.offset + args.limit}
            </span>
          )}
        </div>
      </div>

      {/* Content Preview */}
      {isComplete && !hasError && contentString && (
        <div className="relative">
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <span className="text-white/30 text-xs">
              {lineCount} lines
            </span>
            <button
              onClick={handleCopy}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <Copy size={12} />
            </button>
          </div>
          <pre
            className="px-3 py-2 text-white/70 overflow-x-auto font-mono text-xs"
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              lineHeight: '1.5',
            }}
          >
            {contentString.length > 3000
              ? contentString.slice(0, 3000) + '\n...(truncated)'
              : contentString}
          </pre>
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="px-3 py-2 text-red-300 text-xs">
          {result?.errorMessage ?? 'Failed to read file'}
        </div>
      )}

      {/* Loading */}
      {isPending && (
        <div className="px-3 py-4 flex items-center justify-center text-white/40">
          <Loader2 size={16} className="animate-spin mr-2" />
          <span className="text-xs">Reading file...</span>
        </div>
      )}
    </div>
  )
}

export const ReadToolView = memo(ReadToolViewComponent)
