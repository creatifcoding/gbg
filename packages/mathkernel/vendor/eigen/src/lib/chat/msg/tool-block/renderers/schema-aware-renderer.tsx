/**
 * SchemaAwareRenderer — enhanced generic renderer that uses tool schema
 * metadata (description, parameter names) for better presentation.
 *
 * Unlike GenericToolRenderer (raw JSON dump), this renderer:
 * - Shows tool description in the header meta
 * - Labels input fields by their schema property names
 * - Uses the parameter schema to determine display format
 *
 * @module chat/msg/tool-block/renderers/schema-aware-renderer
 */

import { memo, type FC, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ToolRendererProps } from './registry'

// =============================================================================
// Extended props — tool schema metadata injected by bridge factory
// =============================================================================

export interface SchemaAwareRendererProps extends ToolRendererProps {
  toolName: string
  toolDescription?: string
  /** JSON Schema object from Tool.parameters */
  toolParameters?: unknown
}

// =============================================================================
// Helpers
// =============================================================================

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

/** Extract property names from a JSON Schema parameters object */
function extractParamNames(schema: unknown): string[] {
  if (schema == null || typeof schema !== 'object') return []
  const s = schema as Record<string, unknown>
  // TypeBox / JSON Schema: { type: 'object', properties: { ... } }
  if (s.properties && typeof s.properties === 'object') {
    return Object.keys(s.properties as Record<string, unknown>)
  }
  return []
}

/** Format input by labeling known parameter names */
function formatLabeledInput(
  input: unknown,
  paramNames: string[],
): Array<{ key: string; value: unknown }> | null {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return null
  const obj = input as Record<string, unknown>
  const entries: Array<{ key: string; value: unknown }> = []

  // Show known params first, then any extras
  const knownSet = new Set(paramNames)
  for (const name of paramNames) {
    if (name in obj) {
      entries.push({ key: name, value: obj[name] })
    }
  }
  for (const [key, value] of Object.entries(obj)) {
    if (!knownSet.has(key)) {
      entries.push({ key, value })
    }
  }
  return entries.length > 0 ? entries : null
}

// =============================================================================
// SchemaAwareRenderer — expanded detail view
// =============================================================================

export const SchemaAwareRenderer: FC<SchemaAwareRendererProps> = memo(({
  input,
  output,
  errorText,
  state,
  toolName,
  toolDescription,
  toolParameters,
}) => {
  const isError = state === 'error' || errorText != null
  const unwrappedInput = unwrapInput(input)
  const unwrappedOutput = unwrapOutput(output)
  const paramNames = useMemo(() => extractParamNames(toolParameters), [toolParameters])
  const labeledInput = useMemo(
    () => formatLabeledInput(unwrappedInput, paramNames),
    [unwrappedInput, paramNames],
  )

  return (
    <div className="space-y-2 px-3 pb-2" data-slot="tmnl-tool-renderer-schema-aware">
      {/* Tool description */}
      {toolDescription && (
        <p
          className="text-neutral-500 font-mono italic"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {toolDescription}
        </p>
      )}

      {/* Input — labeled fields if schema available, else raw JSON */}
      {unwrappedInput != null && (
        <div className="space-y-1">
          <span
            className="font-mono uppercase tracking-wide text-neutral-600 block"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Input
          </span>
          {labeledInput ? (
            <div className="space-y-1">
              {labeledInput.map(({ key, value }) => (
                <div key={key} className="flex items-start gap-2">
                  <span
                    className="font-mono text-cyan-600/80 shrink-0"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    {key}:
                  </span>
                  <pre
                    className="bg-neutral-900/50 rounded px-1.5 py-0.5 text-neutral-400 font-mono overflow-x-auto flex-1"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <pre
              className="bg-neutral-900/50 rounded p-2 text-neutral-400 font-mono overflow-x-auto max-h-48 overflow-y-auto"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {typeof unwrappedInput === 'string' ? unwrappedInput : JSON.stringify(unwrappedInput, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Error */}
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

      {/* Output */}
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

SchemaAwareRenderer.displayName = 'SchemaAwareRenderer'

// =============================================================================
// SchemaAwareHeaderMeta — collapsed header badge
// =============================================================================

export const SchemaAwareHeaderMeta: FC<SchemaAwareRendererProps> = memo(({
  toolName,
  toolDescription,
  state,
}) => {
  const stateColor = state === 'error'
    ? 'text-red-400'
    : state === 'running'
      ? 'text-amber-400'
      : 'text-neutral-500'

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {/* Tool name as pill */}
      <span
        className="font-mono text-neutral-300 truncate"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {toolName}
      </span>

      {/* Brief description if available */}
      {toolDescription && (
        <span
          className="font-mono text-neutral-600 truncate"
          style={{ fontSize: '10px' }}
        >
          — {toolDescription.slice(0, 60)}{toolDescription.length > 60 ? '…' : ''}
        </span>
      )}

      {/* State indicator */}
      <span
        className={cn('font-mono uppercase tracking-wider', stateColor)}
        style={{ fontSize: '9px' }}
      >
        {state === 'running' ? '●' : state === 'error' ? '✕' : '✓'}
      </span>
    </div>
  )
})

SchemaAwareHeaderMeta.displayName = 'SchemaAwareHeaderMeta'
