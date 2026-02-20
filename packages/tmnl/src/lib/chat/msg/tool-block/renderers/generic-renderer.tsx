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

export const GenericToolRenderer: FC<ToolRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
}) => {
  const isError = state === 'error' || errorText != null

  return (
    <div className="space-y-2 px-3 pb-2" data-slot="tmnl-tool-renderer-generic">
      {input != null && (
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
            {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
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
      {output != null && !isError && (
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
            {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
})

GenericToolRenderer.displayName = 'GenericToolRenderer'
