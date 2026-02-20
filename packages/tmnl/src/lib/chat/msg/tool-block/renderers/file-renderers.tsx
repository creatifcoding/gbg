/**
 * File Operation Renderers — read, write, edit tools.
 *
 * ReadTool: file path + content preview (syntax highlighted via code block)
 * WriteTool: file path + content summary (line count, byte estimate)
 * EditTool: old/new text diff view
 *
 * @module chat/msg/tool-block/renderers/file-renderers
 */

import { memo, useState, useCallback, type FC } from 'react'
import { cn } from '@/lib/utils'
import { FileIcon, FileEditIcon, FilePlusIcon, ChevronDown, ChevronRight } from 'lucide-react'
import type { ToolRendererProps } from './registry'

// =============================================================================
// Helpers
// =============================================================================

function parseInput(input: unknown): Record<string, unknown> {
  if (typeof input === 'string') {
    try { return JSON.parse(input) } catch { return { raw: input } }
  }
  return (input as Record<string, unknown>) ?? {}
}

function parseOutput(output: unknown): { text: string; truncated?: boolean } {
  if (output == null) return { text: '' }
  if (typeof output === 'string') return { text: output }
  const obj = output as Record<string, unknown>
  // SDK tools return { content: [{ type: 'text', text: '...' }] }
  if (Array.isArray(obj.content)) {
    const textParts = obj.content.filter((c: any) => c.type === 'text')
    return { text: textParts.map((c: any) => c.text).join('\n'), truncated: obj.truncated === true }
  }
  if (typeof obj.text === 'string') return { text: obj.text }
  return { text: JSON.stringify(output, null, 2) }
}

function countLines(text: string): number {
  return text.split('\n').length
}

function estimateBytes(text: string): string {
  const bytes = new Blob([text]).size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// =============================================================================
// ReadTool Renderer
// =============================================================================

export const ReadToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const params = parseInput(input)
  const filePath = (params.path as string) ?? (params.file_path as string) ?? '(unknown)'
  const { text: content, truncated } = parseOutput(output)
  const [expanded, setExpanded] = useState(false)
  const toggle = useCallback(() => setExpanded((p) => !p), [])

  const lines = countLines(content)
  const previewLines = 12
  const needsTruncation = lines > previewLines && !expanded

  return (
    <div className="px-3 pb-2 space-y-1.5" data-slot="tmnl-tool-renderer-read">
      {/* File path header */}
      <div className="flex items-center gap-1.5">
        <FileIcon size={14} className="text-cyan-500 shrink-0" />
        <span className="font-mono text-cyan-400 truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {filePath}
        </span>
        {state === 'completed' && (
          <span className="text-neutral-600 font-mono ml-auto shrink-0" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {lines} lines · {estimateBytes(content)}
          </span>
        )}
      </div>

      {/* Error */}
      {errorText && (
        <pre className="bg-red-500/5 border border-red-500/20 rounded p-2 text-red-400 font-mono overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {errorText}
        </pre>
      )}

      {/* Content preview */}
      {content && state === 'completed' && (
        <>
          <pre
            className="bg-neutral-900/50 rounded p-2 text-neutral-400 font-mono overflow-x-auto"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)', maxHeight: expanded ? 'none' : '240px' }}
          >
            {needsTruncation ? content.split('\n').slice(0, previewLines).join('\n') : content}
          </pre>
          {lines > previewLines && (
            <button
              type="button"
              onClick={toggle}
              className="text-cyan-500 hover:text-cyan-400 font-mono transition-colors"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {expanded ? `Collapse` : `Show ${lines - previewLines} more lines`}
            </button>
          )}
          {truncated && (
            <span className="text-amber-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              (output truncated)
            </span>
          )}
        </>
      )}
    </div>
  )
})
ReadToolRenderer.displayName = 'ReadToolRenderer'

// =============================================================================
// WriteTool Renderer
// =============================================================================

export const WriteToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const params = parseInput(input)
  const filePath = (params.path as string) ?? (params.file_path as string) ?? '(unknown)'
  const content = (params.content as string) ?? ''
  const lines = countLines(content)

  return (
    <div className="px-3 pb-2 space-y-1.5" data-slot="tmnl-tool-renderer-write">
      <div className="flex items-center gap-1.5">
        <FilePlusIcon size={14} className="text-emerald-500 shrink-0" />
        <span className="font-mono text-emerald-400 truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {filePath}
        </span>
        <span className="text-neutral-600 font-mono ml-auto shrink-0" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {lines} lines · {estimateBytes(content)}
        </span>
      </div>
      {errorText && (
        <pre className="bg-red-500/5 border border-red-500/20 rounded p-2 text-red-400 font-mono overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {errorText}
        </pre>
      )}
      {state === 'completed' && !errorText && (
        <span className="text-emerald-500/70 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          ✓ Written
        </span>
      )}
    </div>
  )
})
WriteToolRenderer.displayName = 'WriteToolRenderer'

// =============================================================================
// EditTool Renderer
// =============================================================================

export const EditToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const params = parseInput(input)
  const filePath = (params.path as string) ?? (params.file_path as string) ?? '(unknown)'
  const oldText = (params.oldText as string) ?? (params.old_text as string) ?? ''
  const newText = (params.newText as string) ?? (params.new_text as string) ?? ''
  const [showDiff, setShowDiff] = useState(false)
  const toggleDiff = useCallback(() => setShowDiff((p) => !p), [])

  return (
    <div className="px-3 pb-2 space-y-1.5" data-slot="tmnl-tool-renderer-edit">
      <div className="flex items-center gap-1.5">
        <FileEditIcon size={14} className="text-amber-500 shrink-0" />
        <span className="font-mono text-amber-400 truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {filePath}
        </span>
        {(oldText || newText) && (
          <button
            type="button"
            onClick={toggleDiff}
            className="text-neutral-500 hover:text-neutral-400 font-mono flex items-center gap-0.5 ml-auto transition-colors"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {showDiff ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            diff
          </button>
        )}
      </div>

      {errorText && (
        <pre className="bg-red-500/5 border border-red-500/20 rounded p-2 text-red-400 font-mono overflow-x-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {errorText}
        </pre>
      )}

      {showDiff && (
        <div className="space-y-1.5">
          {oldText && (
            <div>
              <span className="text-red-500/60 font-mono block" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>— old</span>
              <pre className="bg-red-500/5 border border-red-500/10 rounded p-2 text-red-400/80 font-mono overflow-x-auto max-h-32 overflow-y-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                {oldText}
              </pre>
            </div>
          )}
          {newText && (
            <div>
              <span className="text-emerald-500/60 font-mono block" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>+ new</span>
              <pre className="bg-emerald-500/5 border border-emerald-500/10 rounded p-2 text-emerald-400/80 font-mono overflow-x-auto max-h-32 overflow-y-auto" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                {newText}
              </pre>
            </div>
          )}
        </div>
      )}

      {state === 'completed' && !errorText && !showDiff && (
        <span className="text-amber-500/70 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          ✓ Applied
        </span>
      )}
    </div>
  )
})
EditToolRenderer.displayName = 'EditToolRenderer'
