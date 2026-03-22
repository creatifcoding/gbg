/**
 * EditToolView - Specialized view for Edit tool calls
 *
 * Shows file path, old/new string diff-style preview.
 */

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { Edit3, CheckCircle2, Loader2, XCircle, Minus, Plus } from 'lucide-react'
import type { ToolViewProps } from '../registry'

interface EditArgs {
  file_path: string
  old_string: string
  new_string: string
  replace_all?: boolean
}

function EditToolViewComponent({ call, result, isPending, className }: ToolViewProps) {
  const rawArgs = call.args as Partial<EditArgs> | undefined
  const args: EditArgs = {
    file_path: rawArgs?.file_path ?? '',
    old_string: rawArgs?.old_string ?? '',
    new_string: rawArgs?.new_string ?? '',
    replace_all: rawArgs?.replace_all,
  }
  const hasError = result?.isError
  const isComplete = result && !isPending

  // Extract file extension
  const extension = args.file_path ? args.file_path.split('.').pop() ?? '' : ''

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        isPending && 'border-yellow-500/30 bg-yellow-500/5',
        isComplete && !hasError && 'border-yellow-500/20 bg-yellow-500/10',
        hasError && 'border-red-500/20 bg-red-500/5',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Edit3 size={14} className="text-yellow-400" />
          <span className="font-mono text-white/80 text-xs">
            Edit
          </span>
          <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs">
            .{extension}
          </span>
          {args.replace_all && (
            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">
              replace all
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <Loader2 size={12} className="text-yellow-400 animate-spin" />
          )}
          {isComplete && !hasError && (
            <CheckCircle2 size={12} className="text-green-400" />
          )}
          {hasError && <XCircle size={12} className="text-red-400" />}
        </div>
      </div>

      {/* File Path */}
      <div className="px-3 py-2 border-b border-white/5">
        <code className="text-cyan-300 font-mono break-all text-xs">
          {args.file_path}
        </code>
      </div>

      {/* Diff Preview */}
      <div className="divide-y divide-white/5">
        {/* Old String (removed) */}
        <div className="px-3 py-2 bg-red-500/5">
          <div className="flex items-center gap-2 mb-1">
            <Minus size={12} className="text-red-400" />
            <span className="text-red-400 text-xs">old</span>
          </div>
          <pre
            className="text-red-300/80 font-mono overflow-x-auto text-xs"
            style={{ maxHeight: '150px', overflowY: 'auto' }}
          >
            {args.old_string.length > 500
              ? args.old_string.slice(0, 500) + '\n...(truncated)'
              : args.old_string}
          </pre>
        </div>

        {/* New String (added) */}
        <div className="px-3 py-2 bg-green-500/5">
          <div className="flex items-center gap-2 mb-1">
            <Plus size={12} className="text-green-400" />
            <span className="text-green-400 text-xs">new</span>
          </div>
          <pre
            className="text-green-300/80 font-mono overflow-x-auto text-xs"
            style={{ maxHeight: '150px', overflowY: 'auto' }}
          >
            {args.new_string.length > 500
              ? args.new_string.slice(0, 500) + '\n...(truncated)'
              : args.new_string}
          </pre>
        </div>
      </div>

      {/* Result */}
      {isComplete && !hasError && (
        <div className="px-3 py-2 text-green-400 border-t border-white/5 text-xs">
          Edit applied successfully
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="px-3 py-2 text-red-300 border-t border-white/5 text-xs">
          {result?.errorMessage ?? 'Edit failed'}
        </div>
      )}

      {/* Loading */}
      {isPending && (
        <div className="px-3 py-3 flex items-center text-white/40">
          <Loader2 size={16} className="animate-spin mr-2" />
          <span className="text-xs">Applying edit...</span>
        </div>
      )}
    </div>
  )
}

export const EditToolView = memo(EditToolViewComponent)
