/**
 * GenericToolRenderer — JSON fallback for unknown tools.
 *
 * Shows raw input/output as formatted JSON. Used when no specialized
 * renderer is registered for a given toolName.
 *
 * @module chat/msg/tool-block/renderers/generic-renderer
 */

import { memo, type FC } from 'react'
import { cn } from '@/lib/utils'
import type { ToolRendererProps } from './registry'

function unwrapInput(input: unknown): unknown {
  if (input == null) return null
  if (typeof input === 'string') {
    try { return unwrapInput(JSON.parse(input)) } catch { return input }
  }
  const obj = input as Record<string, unknown>
  if (obj.arguments && typeof obj.arguments === 'object' && !Array.isArray(obj.arguments)) {
    return obj.arguments
  }
  return input
}

function unwrapOutput(output: unknown): unknown {
  if (output == null) return null
  if (Array.isArray(output)) {
    const textParts = output.filter((c: any) => c?.type === 'text')
    if (textParts.length > 0) return textParts.map((c: any) => c.text ?? '').join('\n')
  }
  const obj = output as Record<string, unknown>
  if (Array.isArray(obj?.result)) {
    const textParts = obj.result.filter((c: any) => c?.type === 'text')
    if (textParts.length > 0) return textParts.map((c: any) => c.text ?? '').join('\n')
  }
  return output
}

export const GenericToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const isError = state === 'error' || errorText != null
  const unwrappedInput = unwrapInput(input)
  const unwrappedOutput = unwrapOutput(output)

  return (
    <div className="space-y-2 px-3 pb-2" data-slot="tmnl-tool-renderer-generic">
      {unwrappedInput != null && (
        <div className="space-y-1">
          <span
            className="font-mono uppercase tracking-wide text-neutral-600 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Input
          </span>
          <pre
            className="bg-neutral-900/50 rounded p-2 text-neutral-400 font-mono overflow-x-auto max-h-48 overflow-y-auto"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {typeof unwrappedInput === 'string' ? unwrappedInput : JSON.stringify(unwrappedInput, null, 2)}
          </pre>
        </div>
      )}
      {errorText != null && (
        <div className="space-y-1">
          <span
            className="font-mono uppercase tracking-wide text-red-500 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Error
          </span>
          <pre
            className="bg-red-500/5 border border-red-500/20 rounded p-2 text-red-400 font-mono overflow-x-auto"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {errorText}
          </pre>
        </div>
      )}
      {unwrappedOutput != null && !isError && (
        <div className="space-y-1">
          <span
            className="font-mono uppercase tracking-wide text-neutral-600 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Result
          </span>
          <pre
            className="bg-neutral-900/50 rounded p-2 text-neutral-400 font-mono overflow-x-auto max-h-48 overflow-y-auto"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {typeof unwrappedOutput === 'string' ? unwrappedOutput : JSON.stringify(unwrappedOutput, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
})

GenericToolRenderer.displayName = 'GenericToolRenderer'
