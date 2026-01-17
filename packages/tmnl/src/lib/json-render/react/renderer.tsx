/**
 * @fileoverview React renderer for JSON-driven UI
 *
 * Provides:
 * - ElementRenderer: Recursive component for rendering tree elements
 * - Renderer: Entry point component for rendering a UITree
 *
 * Uses atoms for visibility and actions via hooks.
 */

'use client';

import { type ComponentType, type ReactNode, useMemo } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import * as Result from '@effect-atom/atom/Result';
import type { UIElement, UITree, Action } from '../core/schemas';
import { useIsVisible } from './hooks';
import { renderersAtom } from './atoms/catalog';

// =============================================================================
// Types
// =============================================================================

/**
 * Props passed to component renderers
 */
export interface ComponentRenderProps<P = Record<string, unknown>> {
  /** The element being rendered */
  element: UIElement & { props: P };
  /** Rendered children */
  children?: ReactNode;
  /** Execute an action */
  onAction?: (action: Action) => void;
  /** Whether the parent is loading/streaming */
  loading?: boolean;
}

/**
 * Component renderer type
 */
export type ComponentRenderer<P = Record<string, unknown>> = ComponentType<
  ComponentRenderProps<P>
>;

/**
 * Registry of component renderers by type name
 */
export type ComponentRegistry = Record<string, ComponentRenderer<any>>;

/**
 * Props for the Renderer component
 */
export interface RendererProps {
  /** The UI tree to render */
  tree: UITree | null;
  /**
   * Component registry (optional - uses catalog renderers by default)
   * When provided, these renderers are merged with catalog renderers,
   * with these taking precedence over catalog for same-named components.
   */
  registry?: ComponentRegistry;
  /** Whether the tree is currently loading/streaming */
  loading?: boolean;
  /** Fallback component for unknown types */
  fallback?: ComponentRenderer;
  /** Action executor */
  onAction?: (action: Action) => void;
}

// =============================================================================
// ElementRenderer - Recursive element rendering
// =============================================================================

interface ElementRendererProps {
  element: UIElement;
  tree: UITree;
  registry: ComponentRegistry;
  loading?: boolean;
  fallback?: ComponentRenderer;
  onAction?: (action: Action) => void;
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
  onAction,
}: ElementRendererProps) {
  // Check visibility via atom-based hook
  const isVisible = useIsVisible(element.visible);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Get the component renderer from registry
  const Component = registry[element.type] ?? fallback;

  if (!Component) {
    // Only warn in non-production builds (Vite strips this in prod)
    console.warn(`[json-render] No renderer for component type: ${element.type}`);
    return null;
  }

  // Recursively render children
  const children = useMemo(() => {
    if (!element.children || element.children.length === 0) {
      return undefined;
    }

    return element.children.map((childKey) => {
      const childElement = tree.elements[childKey];
      if (!childElement) {
        return null;
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
      );
    });
  }, [element.children, tree, registry, loading, fallback, onAction]);

  return (
    <Component element={element as any} onAction={onAction} loading={loading}>
      {children}
    </Component>
  );
}

// =============================================================================
// Renderer - Main entry point
// =============================================================================

/**
 * Main renderer component
 *
 * Renders a UITree using component renderers from:
 * 1. CatalogComponents service (registered domain catalogs)
 * 2. Optional registry prop (overrides catalog renderers)
 *
 * @example
 * ```tsx
 * // Using only catalog renderers (layout components auto-registered)
 * <Renderer tree={tree} />
 *
 * // Adding custom components to the registry
 * const customRegistry = {
 *   CustomButton: ({ element }) => <button>{element.props.label}</button>
 * }
 * <Renderer tree={tree} registry={customRegistry} />
 * ```
 */
export function Renderer({
  tree,
  registry: propRegistry,
  loading,
  fallback,
  onAction,
}: RendererProps) {
  // Get renderers from catalog (Result<Record, Error>)
  const catalogResult = useAtomValue(renderersAtom);

  // Extract catalog renderers (empty object if not available)
  const catalogRenderers = useMemo(() => {
    if (Result.isSuccess(catalogResult)) {
      return catalogResult.value;
    }
    return {};
  }, [catalogResult]);

  // Merge: catalog renderers as base, prop registry overrides
  const mergedRegistry: ComponentRegistry = useMemo(() => ({
    ...catalogRenderers,
    ...propRegistry,
  }), [catalogRenderers, propRegistry]);

  // Handle empty/null tree
  if (!tree || !tree.root) {
    return null;
  }

  // Get root element
  const rootElement = tree.elements[tree.root];
  if (!rootElement) {
    return null;
  }

  return (
    <ElementRenderer
      element={rootElement}
      tree={tree}
      registry={mergedRegistry}
      loading={loading}
      fallback={fallback}
      onAction={onAction}
    />
  );
}

// =============================================================================
// Fallback Components
// =============================================================================

/**
 * Default fallback for unknown component types
 * Uses TMNL-compatible Tailwind classes
 */
export const DefaultFallback: ComponentRenderer = ({ element, children }) => (
  <div className="p-2 border border-dashed border-amber-500/50 rounded my-1 bg-amber-500/5">
    <code className="text-xs text-amber-600 dark:text-amber-400">
      Unknown: {element.type}
    </code>
    {children}
  </div>
);

/**
 * Loading skeleton fallback
 * Uses TMNL-compatible Tailwind classes with built-in pulse animation
 */
export const LoadingSkeleton: ComponentRenderer = () => (
  <div className="h-6 bg-muted rounded animate-pulse" />
);
