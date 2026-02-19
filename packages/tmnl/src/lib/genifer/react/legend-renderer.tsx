/**
 * Legend State Renderer for JSON-driven UI
 *
 * Uses Legend State's fine-grained reactivity for optimal streaming performance.
 * Each element only re-renders when its specific data changes.
 *
 * Benefits over standard renderer:
 * - No memo() needed - observer() handles it
 * - No stable callback tricks - selectors are fine-grained
 * - <For> optimizes list diffing
 * - Updates only affected elements
 *
 * @module genifer/react/legend-renderer
 */

'use client'

import { type ReactNode, useMemo, useCallback } from 'react'
import { observer, useSelector } from '@legendapp/state/react'
import { type ObservableObject } from '@legendapp/state'
import { useAtomValue } from '@effect-atom/atom-react'
import * as Result from '@effect-atom/atom/Result'
import type { UIElement, Action } from '../core/schemas'
import type { EntranceAnimation } from '../core/animation-schema'
import { useIsVisible } from './hooks'
import { useEntrance } from './animation'
import { renderersAtom, schemasAtom, type SchemaEntry } from './atoms/catalog'
import type { ComponentRenderer, ComponentRegistry } from './renderer'
import type { ObservableUITree } from './observable-tree'

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the LegendRenderer component
 */
export interface LegendRendererProps {
  /** The observable UI tree (from Legend State) */
  tree$: ObservableObject<ObservableUITree>
  /**
   * Component registry (optional - uses catalog renderers by default)
   * When provided, these renderers are merged with catalog renderers,
   * with these taking precedence over catalog for same-named components.
   */
  registry?: ComponentRegistry
  /** Whether the tree is currently loading/streaming */
  loading?: boolean
  /** Fallback component for unknown types */
  fallback?: ComponentRenderer
  /** Action executor */
  onAction?: (action: Action) => void
  /** Disable entrance animations (e.g., for reduced motion preference) */
  disableAnimations?: boolean
}

// =============================================================================
// Element Renderer (observer-wrapped for fine-grained reactivity)
// =============================================================================

interface ElementRendererProps {
  /** Key to look up in tree$.elements */
  elementKey: string
  /** The observable tree */
  tree$: ObservableObject<ObservableUITree>
  /** Component registry */
  registry: ComponentRegistry
  /** Whether parent is loading/streaming */
  loading?: boolean
  /** Fallback for unknown types */
  fallback?: ComponentRenderer
  /** Action handler */
  onAction?: (action: Action) => void
  /** Sibling index for stagger animations */
  index: number
  /** Get default entrance animation for a type */
  getDefaultEntrance?: (type: string) => EntranceAnimation | undefined
  /** Disable animations */
  disableAnimations?: boolean
}

/**
 * Individual element renderer with observer() HOC
 *
 * Key optimization: Uses useSelector() to subscribe to just this element.
 * When other elements change, this component does NOT re-render.
 */
const ElementRenderer = observer(function ElementRenderer({
  elementKey,
  tree$,
  registry,
  loading,
  fallback,
  onAction,
  index,
  getDefaultEntrance,
  disableAnimations = false,
}: ElementRendererProps) {
  // FINE-GRAINED: Subscribe to just this element's data
  // When other elements change, this selector doesn't re-run
  const element = useSelector(() => {
    const el = tree$.elements[elementKey]
    return el?.get?.() ?? null
  })

  // LOGGING: Track element resolution (only log root and first few children to avoid spam)
  if (index === 0) {
    console.log('[ElementRenderer] Element resolved', {
      elementKey,
      hasElement: !!element,
      elementType: element?.type ?? 'no element',
      childCount: element?.children?.length ?? 0,
    });
  }

  // Check visibility via atom-based hook
  const isVisible = useIsVisible(element?.visible)

  // Resolve animation: element.entrance OR catalog default
  const animation: EntranceAnimation | undefined = useMemo(
    () => element?.entrance ?? getDefaultEntrance?.(element?.type ?? ''),
    [element?.entrance, element?.type, getDefaultEntrance]
  )

  // Entrance animation hook
  const { ref: entranceRef, initialStyle } = useEntrance({
    animation,
    index,
    disabled: disableAnimations || !animation,
  })

  // Bail early if no element or not visible
  if (!element || !isVisible) {
    return null
  }

  // Get the component renderer from registry
  const Component = registry[element.type] ?? fallback

  if (!Component) {
    // Warn in development only
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[legend-render] No renderer for component type: ${element.type}`)
    }
    return null
  }

  // Recursively render children
  // OPTIMIZATION: Use <For> when we have stable keys from Legend State
  let children: ReactNode = undefined

  if (element.children && element.children.length > 0) {
    children = element.children.map((childKey, childIndex) => (
      <ElementRenderer
        key={childKey}
        elementKey={childKey}
        tree$={tree$}
        registry={registry}
        loading={loading}
        fallback={fallback}
        onAction={onAction}
        index={childIndex}
        getDefaultEntrance={getDefaultEntrance}
        disableAnimations={disableAnimations}
      />
    ))
  }

  // Render component
  const content = (
    <Component element={element as any} onAction={onAction} loading={loading}>
      {children}
    </Component>
  )

  // Wrap with animation container if needed
  if (animation && !disableAnimations) {
    return (
      <div ref={entranceRef} style={initialStyle}>
        {content}
      </div>
    )
  }

  return content
})

// =============================================================================
// Main Renderer
// =============================================================================

/**
 * Legend State powered renderer
 *
 * Renders a UITree using Legend State's fine-grained reactivity.
 * Each element only updates when its specific data changes.
 *
 * @example
 * ```tsx
 * const tree$ = createTreeObservable()
 *
 * // Streaming updates
 * tree$.elements['card-1'].set({ type: 'Card', props: { title: 'Hello' } })
 *
 * // Render with automatic fine-grained updates
 * <LegendRenderer tree$={tree$} loading={isStreaming} />
 * ```
 */
export const LegendRenderer = observer(function LegendRenderer({
  tree$,
  registry: propRegistry,
  loading,
  fallback,
  onAction,
  disableAnimations = false,
}: LegendRendererProps) {
  // LOGGING: Track LegendRenderer mount and tree$ state
  console.log('[LegendRenderer] Render', {
    hasTree$: !!tree$,
    tree$Root: tree$?.root?.get?.() ?? 'no tree$',
    tree$ElementCount: Object.keys(tree$?.elements?.get?.() ?? {}).length,
    loading,
    hasPropRegistry: !!propRegistry,
  });

  // Get renderers from catalog (Result<Record, Error>)
  const catalogResult = useAtomValue(renderersAtom)

  // Get schemas from catalog for default entrance lookup
  const schemasResult = useAtomValue(schemasAtom)

  // Extract catalog renderers (empty object if not available)
  const catalogRenderers = useMemo(() => {
    if (Result.isSuccess(catalogResult)) {
      return catalogResult.value
    }
    return {}
  }, [catalogResult])

  // Extract schemas (empty object if not available)
  const schemas = useMemo(() => {
    if (Result.isSuccess(schemasResult)) {
      return schemasResult.value
    }
    return {} as Record<string, SchemaEntry>
  }, [schemasResult])

  // Create getDefaultEntrance callback
  const getDefaultEntrance = useCallback(
    (type: string): EntranceAnimation | undefined => {
      return schemas[type]?.defaultEntrance
    },
    [schemas]
  )

  // Merge: catalog renderers as base, prop registry overrides
  const mergedRegistry: ComponentRegistry = useMemo(
    () => ({
      ...catalogRenderers,
      ...propRegistry,
    }),
    [catalogRenderers, propRegistry]
  )

  // FINE-GRAINED: Subscribe to just the root key
  const root = useSelector(() => tree$.root.get())

  // LOGGING: Track root resolution
  console.log('[LegendRenderer] Root resolved', {
    root,
    registryTypes: Object.keys(mergedRegistry).slice(0, 10), // First 10 types
  });

  // Handle empty/null tree
  if (!root) {
    console.log('[LegendRenderer] → null (no root)');
    return null
  }

  return (
    <ElementRenderer
      elementKey={root}
      tree$={tree$}
      registry={mergedRegistry}
      loading={loading}
      fallback={fallback}
      onAction={onAction}
      index={0}
      getDefaultEntrance={getDefaultEntrance}
      disableAnimations={disableAnimations}
    />
  )
})

// =============================================================================
// Exports
// =============================================================================

export default LegendRenderer
