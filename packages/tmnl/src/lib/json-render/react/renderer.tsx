/**
 * @fileoverview React renderer for JSON-driven UI
 *
 * Provides:
 * - ElementRenderer: Recursive component for rendering tree elements
 * - Renderer: Entry point component for rendering a UITree
 *
 * Uses atoms for visibility and actions via hooks.
 */

"use client"

import { type ComponentType, type ReactNode, useMemo } from "react"
import type { UIElement, UITree, Action } from "../core/schemas"
import { useIsVisible } from "./hooks"

// =============================================================================
// Types
// =============================================================================

/**
 * Props passed to component renderers
 */
export interface ComponentRenderProps<P = Record<string, unknown>> {
  /** The element being rendered */
  element: UIElement & { props: P }
  /** Rendered children */
  children?: ReactNode
  /** Execute an action */
  onAction?: (action: Action) => void
  /** Whether the parent is loading/streaming */
  loading?: boolean
}

/**
 * Component renderer type
 */
export type ComponentRenderer<P = Record<string, unknown>> = ComponentType<
  ComponentRenderProps<P>
>

/**
 * Registry of component renderers by type name
 */
export type ComponentRegistry = Record<string, ComponentRenderer<any>>

/**
 * Props for the Renderer component
 */
export interface RendererProps {
  /** The UI tree to render */
  tree: UITree | null
  /** Component registry */
  registry: ComponentRegistry
  /** Whether the tree is currently loading/streaming */
  loading?: boolean
  /** Fallback component for unknown types */
  fallback?: ComponentRenderer
  /** Action executor */
  onAction?: (action: Action) => void
}

// =============================================================================
// ElementRenderer - Recursive element rendering
// =============================================================================

interface ElementRendererProps {
  element: UIElement
  tree: UITree
  registry: ComponentRegistry
  loading?: boolean
  fallback?: ComponentRenderer
  onAction?: (action: Action) => void
}

/**
 * Element renderer component
 *
 * Recursively renders a UIElement and its children using the component registry.
 * Evaluates visibility conditions via useIsVisible hook.
 */
function ElementRenderer({
  element,
  tree,
  registry,
  loading,
  fallback,
  onAction
}: ElementRendererProps) {
  // Check visibility via atom-based hook
  const isVisible = useIsVisible(element.visible)

  // Don't render if not visible
  if (!isVisible) {
    return null
  }

  // Get the component renderer from registry
  const Component = registry[element.type] ?? fallback

  if (!Component) {
    if (process.env["NODE_ENV"] === "development") {
      console.warn(`No renderer for component type: ${element.type}`)
    }
    return null
  }

  // Recursively render children
  const children = useMemo(() => {
    if (!element.children || element.children.length === 0) {
      return undefined
    }

    return element.children.map((childKey) => {
      const childElement = tree.elements[childKey]
      if (!childElement) {
        return null
      }
      return (
        <ElementRenderer
          key={childKey}
          element={childElement}
          tree={tree}
          registry={registry}
          loading={loading}
          fallback={fallback}
          onAction={onAction}
        />
      )
    })
  }, [element.children, tree, registry, loading, fallback, onAction])

  return (
    <Component
      element={element as any}
      onAction={onAction}
      loading={loading}
    >
      {children}
    </Component>
  )
}

// =============================================================================
// Renderer - Main entry point
// =============================================================================

/**
 * Main renderer component
 *
 * Renders a UITree using the provided component registry.
 * This is the primary entry point for rendering JSON-driven UI.
 *
 * @example
 * ```tsx
 * const registry = {
 *   Container: ({ children }) => <div>{children}</div>,
 *   Text: ({ element }) => <p>{element.props.text}</p>,
 *   Button: ({ element, onAction }) => (
 *     <button onClick={() => onAction?.(element.props.action)}>
 *       {element.props.label}
 *     </button>
 *   )
 * }
 *
 * <Renderer tree={tree} registry={registry} />
 * ```
 */
export function Renderer({
  tree,
  registry,
  loading,
  fallback,
  onAction
}: RendererProps) {
  // Handle empty/null tree
  if (!tree || !tree.root) {
    return null
  }

  // Get root element
  const rootElement = tree.elements[tree.root]
  if (!rootElement) {
    return null
  }

  return (
    <ElementRenderer
      element={rootElement}
      tree={tree}
      registry={registry}
      loading={loading}
      fallback={fallback}
      onAction={onAction}
    />
  )
}

// =============================================================================
// Fallback Components
// =============================================================================

/**
 * Default fallback for unknown component types
 */
export const DefaultFallback: ComponentRenderer = ({ element, children }) => (
  <div
    style={{
      padding: "8px",
      border: "1px dashed #ccc",
      borderRadius: "4px",
      margin: "4px 0"
    }}
  >
    <code style={{ fontSize: "12px", color: "#666" }}>
      Unknown: {element.type}
    </code>
    {children}
  </div>
)

/**
 * Loading skeleton fallback
 */
export const LoadingSkeleton: ComponentRenderer = () => (
  <div
    style={{
      height: "24px",
      backgroundColor: "#e0e0e0",
      borderRadius: "4px",
      animation: "pulse 1.5s infinite"
    }}
  />
)
