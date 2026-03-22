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
import { HashMap, Option } from 'effect';
import type { UIElement, UITree, Action } from '../core/schemas';
import type { EntranceAnimation } from '../core/animation-schema';
import { useIsVisible } from './hooks';
import { useEntrance } from './animation';
import { getDynamicComponents } from '../code-mode/sandbox';
import { renderersAtom, schemasAtom, getCatalogRenderers, type SchemaEntry } from './atoms/catalog';
import { ComponentErrorBoundary } from './ErrorBoundary';
import { useBehavior } from './BehaviorBridge';

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

  // Resolve behavior sigils (@state, @action, bind) into concrete props/handlers
  const { resolveElementProps } = useBehavior();
  const { props: resolvedBehaviorProps, handlers: resolvedBehaviorHandlers } = useMemo(
    () => resolveElementProps(element),
    [resolveElementProps, element],
  );

  const effectiveElement = useMemo(() => {
    const mergedProps: Record<string, unknown> = {
      ...(element.props as Record<string, unknown>),
      ...resolvedBehaviorProps,
      ...resolvedBehaviorHandlers,
    };

    if (mergedProps.action === undefined && typeof mergedProps.onClick === 'function') {
      mergedProps.action = { name: 'click' };
    }

    return {
      ...element,
      props: mergedProps,
    } as UIElement;
  }, [element, resolvedBehaviorProps, resolvedBehaviorHandlers]);

  // Resolve animation: element.entrance OR catalog default
  const animation: EntranceAnimation | undefined = useMemo(
    () => effectiveElement.entrance ?? getDefaultEntrance?.(effectiveElement.type),
    [effectiveElement.entrance, effectiveElement.type, getDefaultEntrance]
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
  const Component = registry[effectiveElement.type] ?? fallback;

  if (!Component) {
    // Only warn in non-production builds (Vite strips this in prod)
    console.warn(`[genifer] No renderer for component type: ${effectiveElement.type}`);
    return null;
  }

  // Recursively render children with index tracking for stagger
  // OPTIMIZATION: Dependencies don't include getElement (stable function)
  const children = useMemo(() => {
    if (!effectiveElement.children || effectiveElement.children.length === 0) {
      return undefined;
    }

    return effectiveElement.children.map((childKey, childIndex) => {
      const childElement = getElement(childKey);
      if (!childElement) {
        return null;
      }
      return (
        <ElementRenderer
          key={childKey}
          element={childElement}
          getElement={getElement}
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
  }, [effectiveElement.children, getElement, registry, loading, fallback, onAction, getDefaultEntrance, disableAnimations]);

  // Render component - wrapped in error boundary for isolation
  const content = (
    <ComponentErrorBoundary componentType={effectiveElement.type} elementKey={effectiveElement.key}>
      <Component element={effectiveElement as any} onAction={onAction} loading={loading}>
        {children}
      </Component>
    </ComponentErrorBoundary>
  );

  // Build ARIA props from UIElement fields
  const ariaProps: Record<string, unknown> = {};
  if (effectiveElement.role) ariaProps.role = effectiveElement.role;
  if (effectiveElement.ariaLabel) ariaProps['aria-label'] = effectiveElement.ariaLabel;
  if (effectiveElement.ariaDescribedBy) ariaProps['aria-describedby'] = effectiveElement.ariaDescribedBy;
  if (effectiveElement.ariaLive) ariaProps['aria-live'] = effectiveElement.ariaLive;
  if (effectiveElement.tabIndex !== undefined) ariaProps.tabIndex = effectiveElement.tabIndex;

  // Resolve className from element (Tailwind utility classes for layout)
  const elementClassName = effectiveElement.className || undefined;

  // Wrap in entrance animation container if animation is enabled
  // Animation wrapper is decorative — invisible to assistive tech
  if (animation && !disableAnimations) {
    return (
      <div
        ref={entranceRef}
        style={initialStyle}
        className={elementClassName}
        role="presentation"
        aria-hidden="true"
      >
        <div {...ariaProps}>
          {content}
        </div>
      </div>
    );
  }

  // No animation — render with className and/or ARIA props
  if (elementClassName || Object.keys(ariaProps).length > 0) {
    return <div className={elementClassName} {...ariaProps}>{content}</div>;
  }

  return content;
}, (prev, next) => (
  prev.element === next.element
  && prev.getElement === next.getElement
  && prev.registry === next.registry
  && prev.loading === next.loading
  && prev.fallback === next.fallback
  && prev.onAction === next.onAction
  && prev.index === next.index
  && prev.getDefaultEntrance === next.getDefaultEntrance
  && prev.disableAnimations === next.disableAnimations
));

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
  // Get renderers from catalog (Result<Record, Error>)
  const catalogResult = useAtomValue(renderersAtom);

  // Get schemas from catalog for default entrance lookup
  const schemasResult = useAtomValue(schemasAtom);

  // Extract catalog renderers (falls back to getCatalogRenderers() if atom context unavailable)
  const catalogRenderers = useMemo(() => {
    if (Result.isSuccess(catalogResult) && Object.keys(catalogResult.value).length > 0) {
      return catalogResult.value;
    }
    // Fallback: direct registry access bypasses atom context scope issues
    // (e.g., when rendered inside MorphChat's registry instead of genifer's)
    const direct = getCatalogRenderers();
    if (direct && Object.keys(direct).length > 0) return direct;
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

  // Get dynamically registered components (from code mode)
  const dynamicComponents = useMemo(() => {
    const components = getDynamicComponents();
    const registry: ComponentRegistry = {};
    for (const [name, factory] of components) {
      // Wrap factory as a React component renderer
      registry[name] = ({ element, children }) => {
        const result = factory({ ...element.props, children });
        // If factory returns a React element, render it directly
        if (result && typeof result === 'object' && 'type' in result) return result;
        // Otherwise render as string
        return <>{String(result ?? '')}</>;
      };
    }
    return registry;
  }, [/* re-evaluated on each render to pick up new registrations */]);

  // Merge: catalog renderers as base, dynamic components, prop registry overrides
  const mergedRegistry: ComponentRegistry = useMemo(() => ({
    ...catalogRenderers,
    ...dynamicComponents,
    ...propRegistry,
  }), [catalogRenderers, dynamicComponents, propRegistry]);

  // OPTIMIZATION: Use ref to keep elements reference stable across renders
  // This allows ElementRenderer's memo to work effectively
  const elementsRef = useRef(tree?.elements ?? HashMap.empty<string, UIElement>());
  elementsRef.current = tree?.elements ?? HashMap.empty<string, UIElement>();

  // Create stable getElement callback that reads from ref
  const getElement = useCallback((key: string): UIElement | undefined => {
    return Option.getOrUndefined(HashMap.get(elementsRef.current, key));
  }, []); // Empty deps = stable reference

  // Handle empty/null tree
  if (!tree || !tree.root) {
    return null;
  }

  // Get root element
  const rootElement = tree.getElementUnsafe(tree.root);
  if (!rootElement) {
    return null;
  }

  return (
    <ElementRenderer
      element={rootElement}
      getElement={getElement}
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
