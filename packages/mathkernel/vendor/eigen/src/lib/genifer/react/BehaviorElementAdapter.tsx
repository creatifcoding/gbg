/**
 * BehaviorElementAdapter — Wraps component renderers with sigil resolution.
 *
 * When a UIElement has sigil props (@state:, @action:, bind:, {{}}),
 * this adapter resolves them against the active BehaviorProvider before
 * the component renderer sees them.
 *
 * The component receives plain props + real event handlers.
 * No sigil awareness needed in individual component renderers.
 *
 * Usage: Wrap the renderer's component lookup to return behavior-adapted versions.
 *
 * @module genifer/react/BehaviorElementAdapter
 */

'use client'

import { memo, useMemo, type ReactNode } from 'react'
import type { UIElement, Action } from '../core/schemas'
import { useBehavior } from './BehaviorBridge'
import type { ComponentRenderProps, ComponentRenderer } from './renderer'

/**
 * Detect if any prop value contains a sigil.
 * Fast check — avoids resolution overhead for static elements.
 */
function hasSigils(props: Record<string, unknown>): boolean {
  for (const value of Object.values(props)) {
    if (typeof value !== 'string') continue
    if (
      value.startsWith('@state:') ||
      value.startsWith('@action:') ||
      value.startsWith('bind:') ||
      value.includes('{{@state:')
    ) {
      return true
    }
  }
  return false
}

/**
 * Creates a behavior-aware wrapper around a component renderer.
 *
 * The wrapper:
 *   1. Checks if the element has sigil props (fast path: skip if not)
 *   2. Resolves sigils against the nearest BehaviorProvider
 *   3. Merges resolved props + handlers into the element
 *   4. Passes the enriched element to the original renderer
 *
 * ```tsx
 * // Usage in renderer setup:
 * const registry = adaptRegistryForBehavior(originalRegistry)
 * <Renderer tree={tree} registry={registry} />
 * ```
 */
export function wrapWithBehavior(
  Component: ComponentRenderer<any>,
): ComponentRenderer<any> {
  const Wrapped = memo(function BehaviorWrapped({
    element,
    children,
    onAction,
    loading,
  }: ComponentRenderProps) {
    const { resolveElementProps } = useBehavior()

    // Fast path: no sigils → pass through unchanged
    if (!hasSigils(element.props as Record<string, unknown>)) {
      return <Component element={element} onAction={onAction} loading={loading}>{children}</Component>
    }

    // Resolve sigils
    const { props: resolvedProps, handlers } = resolveElementProps(element)

    // Merge handlers into onAction bridge
    const mergedOnAction = useMemo(() => {
      if (Object.keys(handlers).length === 0) return onAction

      return (action: Action) => {
        // Check if this action maps to a behavior handler
        const handlerKey = `on${action.name.charAt(0).toUpperCase()}${action.name.slice(1)}`
        if (handlers[handlerKey]) {
          handlers[handlerKey](action.params)
          return
        }
        // Fall through to original onAction
        onAction?.(action)
      }
    }, [handlers, onAction])

    // Create enriched element with resolved props
    const enrichedElement = useMemo(() => ({
      ...element,
      props: { ...element.props, ...resolvedProps },
      // Attach handlers as __behaviorHandlers for components that know to look
      __behaviorHandlers: handlers,
    }), [element, resolvedProps, handlers])

    return (
      <Component
        element={enrichedElement as any}
        onAction={mergedOnAction}
        loading={loading}
      >
        {children}
      </Component>
    )
  })

  Wrapped.displayName = `Behavior(${Component.displayName || Component.name || 'Unknown'})`
  return Wrapped as ComponentRenderer<any>
}

/**
 * Wraps an entire component registry with behavior resolution.
 *
 * Every renderer in the registry gets wrapped with sigil resolution.
 * Static elements (no sigils) pass through with zero overhead.
 *
 * ```tsx
 * const behaviorRegistry = adaptRegistryForBehavior(originalRegistry)
 * <Renderer tree={tree} registry={behaviorRegistry} />
 * ```
 */
export function adaptRegistryForBehavior(
  registry: Record<string, ComponentRenderer<any>>,
): Record<string, ComponentRenderer<any>> {
  const adapted: Record<string, ComponentRenderer<any>> = {}
  for (const [type, renderer] of Object.entries(registry)) {
    adapted[type] = wrapWithBehavior(renderer)
  }
  return adapted
}
