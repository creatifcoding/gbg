/**
 * @fileoverview React renderer for JSON-driven UI
 *
 * Provides:
 * - ElementRenderer: Recursive component for rendering tree elements
 * - Renderer: Entry point component for rendering a UITree
 *
 * Uses atoms for visibility, actions, and entrance animations via hooks.
 */

'use client';

import { type ComponentType, type ReactNode, useMemo, useCallback, memo, useRef } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import * as Result from '@effect-atom/atom/Result';
import type { UIElement, UITree, Action } from '../core/schemas';
import type { EntranceAnimation } from '../core/animation-schema';
import { useIsVisible } from './hooks';
import { useEntrance } from './animation';
import { renderersAtom, schemasAtom, type SchemaEntry } from './atoms/catalog';

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
  /** Disable entrance animations (e.g., for reduced motion preference) */
  disableAnimations?: boolean;
}

// =============================================================================
// ElementRenderer - Recursive element rendering
// =============================================================================

interface ElementRendererProps {
  element: UIElement;
  /** Element lookup function (stable across renders) */
  getElement: (key: string) => UIElement | undefined;
  /** Element map version to invalidate cached children */
  elementsVersion: number;
  registry: ComponentRegistry;
  loading?: boolean;
  fallback?: ComponentRenderer;
  onAction?: (action: Action) => void;
  /** Sibling index for stagger animation */
  index?: number;
  /** Get default entrance animation for a component type */
  getDefaultEntrance?: (type: string) => EntranceAnimation | undefined;
  /** Disable entrance animations */
  disableAnimations?: boolean;
}

/**
 * Element renderer component
 *
 * Recursively renders a UIElement and its children using the component registry.
 * Evaluates visibility conditions via useIsVisible hook.
 * Applies entrance animations via useEntrance hook.
 *
 * OPTIMIZATION: Uses getElement callback instead of tree prop to allow
 * stable function reference across streaming updates.
 */
const ElementRenderer = memo(function ElementRenderer({
  element,
  getElement,
  elementsVersion,
  registry,
  loading,
  fallback,
  onAction,
  index = 0,
  getDefaultEntrance,
  disableAnimations = false,
}: ElementRendererProps) {
  // Check visibility via atom-based hook
  const isVisible = useIsVisible(element.visible);

  // Resolve animation: element.entrance OR catalog default
  const animation: EntranceAnimation | undefined = useMemo(
    () => element.entrance ?? getDefaultEntrance?.(element.type),
    [element.entrance, element.type, getDefaultEntrance]
  );

  // Entrance animation hook
  const { ref: entranceRef, initialStyle } = useEntrance({
    animation,
    index,
    disabled: disableAnimations || !animation,
  });

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Get the component renderer from registry
  const Component = registry[element.type] ?? fallback;

  if (!Component) {
    // Only warn in non-production builds (Vite strips this in prod)
    console.warn(`[genifer] No renderer for component type: ${element.type}`);
    return null;
  }

  // Recursively render children with index tracking for stagger
  // OPTIMIZATION: Dependencies don't include getElement (stable function)
  const children = useMemo(() => {
    if (!element.children || element.children.length === 0) {
      return undefined;
    }

    return element.children.map((childKey, childIndex) => {
      const childElement = getElement(childKey);
      if (!childElement) {
        return null;
      }
      return (
        <ElementRenderer
          key={childKey}
          element={childElement}
          getElement={getElement}
          elementsVersion={elementsVersion}
          registry={registry}
          loading={loading}
          fallback={fallback}
          onAction={onAction}
          index={childIndex}
          getDefaultEntrance={getDefaultEntrance}
          disableAnimations={disableAnimations}
        />
      );
    });
  }, [element.children, elementsVersion, getElement, registry, loading, fallback, onAction, getDefaultEntrance, disableAnimations]);

  // Render component - animation wrapper applies if animation is enabled
  const content = (
    <Component element={element as any} onAction={onAction} loading={loading}>
      {children}
    </Component>
  );

  // Wrap in entrance animation container if animation is enabled
  // Note: Cannot use display:contents as it removes element from box tree,
  // preventing opacity/transform animations from rendering
  // Use display:contents-like behavior where possible, but we need a real element for animation
  if (animation && !disableAnimations) {
    return (
      <div
        ref={entranceRef}
        style={initialStyle}
      >
        {content}
      </div>
    );
  }

  // No animation - render directly
  return content;
});

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
 * Supports entrance animations via the `entrance` field on elements,
 * with fallback to catalog default animations.
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
 *
 * // Disable animations (e.g., for reduced motion)
 * <Renderer tree={tree} disableAnimations />
 * ```
 */
export function Renderer({
  tree,
  registry: propRegistry,
  loading,
  fallback,
  onAction,
  disableAnimations = false,
}: RendererProps) {
  // LOGGING: Track Renderer mount and tree state
  console.log('[Renderer] Render', {
    hasTree: !!tree,
    treeRoot: tree?.root ?? 'no tree',
    treeElementCount: Object.keys(tree?.elements ?? {}).length,
    loading,
    hasPropRegistry: !!propRegistry,
  });

  // Get renderers from catalog (Result<Record, Error>)
  const catalogResult = useAtomValue(renderersAtom);

  // Get schemas from catalog for default entrance lookup
  const schemasResult = useAtomValue(schemasAtom);

  // Extract catalog renderers (empty object if not available)
  const catalogRenderers = useMemo(() => {
    if (Result.isSuccess(catalogResult)) {
      return catalogResult.value;
    }
    return {};
  }, [catalogResult]);

  // Extract schemas (empty object if not available)
  const schemas = useMemo(() => {
    if (Result.isSuccess(schemasResult)) {
      return schemasResult.value;
    }
    return {} as Record<string, SchemaEntry>;
  }, [schemasResult]);

  // Create getDefaultEntrance callback
  const getDefaultEntrance = useCallback(
    (type: string): EntranceAnimation | undefined => {
      return schemas[type]?.defaultEntrance;
    },
    [schemas]
  );

  // Merge: catalog renderers as base, prop registry overrides
  const mergedRegistry: ComponentRegistry = useMemo(() => ({
    ...catalogRenderers,
    ...propRegistry,
  }), [catalogRenderers, propRegistry]);

  // OPTIMIZATION: Use ref to keep elements reference stable across renders
  // This allows ElementRenderer's memo to work effectively
  const elementsRef = useRef(tree?.elements ?? {});
  elementsRef.current = tree?.elements ?? {};

  // Create stable getElement callback that reads from ref
  const getElement = useCallback((key: string): UIElement | undefined => {
    return elementsRef.current[key];
  }, []); // Empty deps = stable reference

  // Handle empty/null tree
  if (!tree || !tree.root) {
    console.log('[Renderer] → null (no tree or no root)', { tree, root: tree?.root });
    return null;
  }

  // Get root element
  const rootElement = tree.elements[tree.root];
  if (!rootElement) {
    console.log('[Renderer] → null (root element not found)', {
      root: tree.root,
      availableKeys: Object.keys(tree.elements).slice(0, 5)
    });
    return null;
  }

  console.log('[Renderer] Rendering root element', {
    root: tree.root,
    rootElementType: rootElement.type,
    rootElementChildren: rootElement.children?.length ?? 0,
    registryTypes: Object.keys(mergedRegistry).slice(0, 10),
  });

  return (
    <ElementRenderer
      element={rootElement}
      getElement={getElement}
      elementsVersion={Object.keys(tree.elements).length}
      registry={mergedRegistry}
      loading={loading}
      fallback={fallback}
      onAction={onAction}
      index={0}
      getDefaultEntrance={getDefaultEntrance}
      disableAnimations={disableAnimations}
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
