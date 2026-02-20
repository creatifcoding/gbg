/**
 * StreamingRenderer
 *
 * Renders genifer components progressively as the streaming parser identifies them.
 * Each identified component is looked up in the catalog registry and rendered
 * with available props. Props that haven't arrived yet show as skeleton placeholders.
 *
 * This is the "early render" path — components appear before the full JSON is parsed.
 *
 * @module genifer/streaming/StreamingRenderer
 */

'use client'

import { type ReactNode, memo, useMemo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import * as Result from '@effect-atom/atom/Result'
import { renderersAtom } from '../react/atoms/catalog.js'
import type { ComponentIdentification } from './graph.js'
import type { ComponentRenderer, ComponentRenderProps } from '../react/renderer.js'
import type { UIElement, Action } from '../core/schemas.js'

// =============================================================================
// Types
// =============================================================================

export interface StreamingRendererProps {
  /** Components identified by the streaming parser */
  identifiedComponents: readonly ComponentIdentification[]
  /** Partial fields at each depth (for prop population) */
  partialFields: ReadonlyMap<number, Record<string, unknown>>
  /** Whether the stream is still in progress */
  isParsing: boolean
  /** Optional action handler */
  onAction?: (action: Action) => void
  /** Fallback for unresolved component types */
  fallback?: ComponentRenderer
  /** Skeleton shown for components whose props are still streaming */
  skeleton?: ReactNode
}

// =============================================================================
// Default Skeleton
// =============================================================================

function DefaultStreamingSkeleton({ componentType }: { componentType: string }) {
  return (
    <div
      className="animate-pulse rounded bg-stone-800/50 border border-stone-700/30 p-3"
      style={{ minHeight: 48 }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-500/40 animate-ping" />
        <span
          className="font-mono text-stone-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {componentType}
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Streaming Element
// =============================================================================

const StreamingElement = memo(function StreamingElement({
  identification,
  partialFields,
  registry,
  onAction,
  fallback,
  skeleton,
}: {
  identification: ComponentIdentification
  partialFields: ReadonlyMap<number, Record<string, unknown>>
  registry: Record<string, ComponentRenderer<any>>
  onAction?: (action: Action) => void
  fallback?: ComponentRenderer
  skeleton?: ReactNode
}) {
  const Renderer = registry[identification.componentType] ?? fallback

  if (!Renderer) {
    return skeleton ?? <DefaultStreamingSkeleton componentType={identification.componentType} />
  }

  // Collect any partial props that have been streamed for this component.
  // The identification tells us the component type; partial fields at the
  // same depth contain the props being accumulated.
  const partialProps = useMemo(() => {
    // Walk all depth entries looking for fields that might belong to this component.
    // In practice, the depth of the identified component corresponds to the object
    // whose fields we want.
    const props: Record<string, unknown> = {}
    for (const [, fields] of partialFields) {
      // Merge all available fields (the graph tracks depth properly)
      Object.assign(props, fields)
    }
    return props
  }, [partialFields])

  // Synthesize a minimal UIElement for the renderer
  const element: UIElement = {
    type: identification.componentType,
    key: identification.elementKey,
    props: partialProps,
  }

  const renderProps: ComponentRenderProps = {
    element,
    children: null,
    onAction,
    loading: true, // Always loading — we're in streaming mode
  }

  return <Renderer {...renderProps} />
})

// =============================================================================
// StreamingRenderer
// =============================================================================

/**
 * Renders components progressively as the streaming parser identifies them.
 *
 * Usage:
 * ```tsx
 * const { identifiedComponents, isParsing, partialFields, feedChunk } = useStreamingJson()
 *
 * return (
 *   <StreamingRenderer
 *     identifiedComponents={identifiedComponents}
 *     partialFields={partialFields}
 *     isParsing={isParsing}
 *   />
 * )
 * ```
 */
export const StreamingRenderer = memo(function StreamingRenderer({
  identifiedComponents,
  partialFields,
  isParsing,
  onAction,
  fallback,
  skeleton,
}: StreamingRendererProps) {
  // Get catalog renderers
  const renderersResult = useAtomValue(renderersAtom)
  const registry = Result.isSuccess(renderersResult)
    ? (renderersResult.value as Record<string, ComponentRenderer<any>>)
    : {}

  if (identifiedComponents.length === 0 && isParsing) {
    return (
      <div className="flex items-center gap-3 p-4">
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
        <span
          className="font-mono text-stone-400"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          Parsing stream…
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {identifiedComponents.map((id, i) => (
        <StreamingElement
          key={`${id.componentType}-${id.discoveredAtOffset}-${i}`}
          identification={id}
          partialFields={partialFields}
          registry={registry}
          onAction={onAction}
          fallback={fallback}
          skeleton={skeleton}
        />
      ))}
      {isParsing && (
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 animate-pulse" />
          <span
            className="font-mono text-stone-600"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            streaming…
          </span>
        </div>
      )}
    </div>
  )
})
