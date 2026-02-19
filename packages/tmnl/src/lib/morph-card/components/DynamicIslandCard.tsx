/**
 * DynamicIslandCard Component
 *
 * MorphCard extended with tabbed views, server integration, and state caching.
 * Combines MorphCard's polymorphic container with Dynamic Island aesthetics.
 *
 * @module morph-card/components/DynamicIslandCard
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../tmnl-ui/utils/cn';
import { Effect } from 'effect';
import { RegistryContext, useAtomValue } from '@effect-atom/atom-react';
import { MorphCard, type MorphCardSlots, type MorphCardTheme, type MorphCardRenderers } from './MorphCard';
import { TabBar } from './TabBar';
import type {
  TabView,
  TabBarConfig,
  ViewSpecData,
} from '../schemas/tab-schemas';
import type {
  MorphCardConfig,
  MorphCardStateMachineConfig,
} from '../schemas/animation-config';
import type { TransitionGrammar } from '../schemas/transition-grammar';
import { morphCardRegistry } from '../atoms/registry';
import { cardStateFamily } from '../card-state';
import {
  DEFAULT_TRANSITION,
  parseGrammar,
  grammarToVariants,
} from '../schemas/transition-grammar';
import { sendIslandEvent } from '../machines/island-stx';
import type { TransitionStrategy } from '../machines/islandMachine';
import { Renderer, DefaultFallback } from '@/lib/genifer/react/renderer';
import { Schema, Either } from 'effect';
import { ViewRegistrySchema } from '../schemas/tab-schemas';
import type { ReticleVariant } from '../schemas/animation-config';
import {
  tabsAtomFamily,
  cardTabStateFamily,
  setActiveTab,
  viewRegistryAtomFamily,
  setViewRegistry,
  addView as addViewEntry,
  updateView as updateViewEntry,
  removeView as removeViewEntry,
  clearViews as clearViewEntries,
} from '../atoms/tab-atoms';
import type { ViewSpec, ViewRegistry } from '../types/view-registry';

// =============================================================================
// Context
// =============================================================================

interface DynamicIslandContextValue {
  cardId: string;
  activeTab: string;
  useRegistryRendering: boolean;
  setViews: (views: ViewRegistry) => void;
  addView: (view: ViewSpec) => void;
  updateView: (viewId: string, patch: Partial<ViewSpec>) => void;
  removeView: (viewId: string) => void;
  clearViews: () => void;
}

const DynamicIslandContext = createContext<DynamicIslandContextValue | null>(
  null
);

/**
 * Hook to access DynamicIslandCard context
 * @throws Error if used outside DynamicIslandCard
 */
export function useDynamicIslandContext(): DynamicIslandContextValue {
  const ctx = useContext(DynamicIslandContext);
  if (!ctx) {
    throw new Error(
      'useDynamicIslandContext must be used within DynamicIslandCard'
    );
  }
  return ctx;
}

/**
 * Optional version that returns null if not in context
 */
export function useDynamicIslandContextOptional(): DynamicIslandContextValue | null {
  return useContext(DynamicIslandContext);
}

// =============================================================================
// Props
// =============================================================================

export interface DynamicIslandCardProps<Keys extends string = string> {
  /** Unique card identifier */
  cardId: string;
  /** Initial sizeKey (passed to MorphCard) */
  initialSizeKey?: string;
  /** State machine config (sizes + defaults) */
  stateMachineConfig?: MorphCardStateMachineConfig;
  /** Effect-driven transition strategy */
  transitionStrategy: TransitionStrategy;
  /** Tab bar configuration */
  tabConfig?: TabBarConfig;
  /** MorphCard config (passed through) */
  config?: Partial<MorphCardConfig>;
  /** Enable dynamic sizing - card grows/shrinks with content */
  dynamicSize?: boolean;
  /** Minimum width when dynamicSize is enabled */
  minWidth?: number;
  /** Maximum width when dynamicSize is enabled */
  maxWidth?: number;
  /** Minimum height when dynamicSize is enabled */
  minHeight?: number;
  /** Maximum height when dynamicSize is enabled */
  maxHeight?: number;
  /** Enable scroll when content exceeds size (explicit only) */
  scrollable?: boolean;
  /** Whether card is interactive */
  interactive?: boolean;
  /** Additional className */
  className?: string;
  /** Headless slots (inject components) */
  slots?: MorphCardSlots;
  /** Theme classes/styles (inject styling) */
  theme?: MorphCardTheme;
  /** Renderers for container/frame (full override) */
  renderers?: MorphCardRenderers;
  /** Unified view registry (tabs + content) */
  views?: ViewRegistry<Keys>;
  /** Allow registry CRUD from context */
  allowRegistryUpdates?: boolean;
  /** Disable content animations */
  disableAnimations?: boolean;
  /** Child elements (View components) */
  children: ReactNode;
  /** Click handler */
  onClick?: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * DynamicIslandCard - MorphCard extended with tabbed views
 *
 * Composition pattern: Wraps MorphCard with TabBar and view management.
 *
 * @example
 * ```tsx
 * <DynamicIslandCard cardId="status-card">
 *   <DynamicIslandCard.View id="data" label="Data">
 *     <DataView />
 *   </DynamicIslandCard.View>
 *   <DynamicIslandCard.View id="config" label="Config">
 *     <ConfigView />
 *   </DynamicIslandCard.View>
 * </DynamicIslandCard>
 * ```
 */
function DynamicIslandCardInner<Keys extends string = string>({
  cardId,
  initialSizeKey = 'default',
  stateMachineConfig,
  transitionStrategy,
  tabConfig,
  config,
  dynamicSize,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
  scrollable,
  interactive = true,
  className,
  slots,
  theme,
  renderers,
  views,
  allowRegistryUpdates,
  disableAnimations = false,
  children,
  onClick,
}: DynamicIslandCardProps<Keys>) {
  const registry = useContext(RegistryContext);

  // Atom subscriptions
  const tabsAtom = useMemo(() => tabsAtomFamily(cardId), [cardId]);
  const stateAtom = useMemo(() => cardTabStateFamily(cardId), [cardId]);
  const viewsAtom = useMemo(() => viewRegistryAtomFamily(cardId), [cardId]);

  const tabs = useAtomValue(tabsAtom);
  const cardState = useAtomValue(stateAtom);
  const registryViews = useAtomValue(viewsAtom);
  const activeTab = cardState.activeTab;
  const currentSizeKey = useAtomValue(cardStateFamily.sizeKey(cardId as any));
  const activeTransition = useAtomValue(
    cardStateFamily.transition(cardId as any)
  );
  const canUpdateRegistry = allowRegistryUpdates ?? true;
  const viewList = useMemo(() => {
    const viewEntries = Object.entries(registryViews) as Array<
      [string, ViewSpec<Keys>]
    >;
    if (viewEntries.length === 0) return [];
    const validation = Effect.gen(function* () {
      const dataOnly = Object.fromEntries(
        viewEntries.map(([key, view]) => {
          const { render, ...rest } = view;
          return [key, rest];
        })
      );
      const decoded = Schema.decodeUnknownEither(ViewRegistrySchema)(dataOnly);
      if (Either.isLeft(decoded)) {
        yield* Effect.fail(
          new Error(
            '[DynamicIslandCard] Invalid views registry (schema validation failed).'
          )
        );
      }
      const validated = decoded.right as Record<string, ViewSpecData>;
      for (const [key, value] of Object.entries(validated)) {
        if (value.id !== key) {
          yield* Effect.fail(
            new Error(
              `[DynamicIslandCard] View id mismatch: key "${key}" must match view.id "${value.id}".`
            )
          );
        }
      }
      for (const [key, value] of viewEntries) {
        if (!value.render && !value.content) {
          yield* Effect.fail(
            new Error(
              `[DynamicIslandCard] View "${key}" must provide render or content.`
            )
          );
        }
      }
      return Object.values(registryViews).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
    });
    const result = Effect.runSync(Effect.either(validation));
    if (Either.isLeft(result)) {
      Effect.runSync(Effect.logError(result.left));
      return [];
    }
    return result.right;
  }, [registryViews]);
  const useRegistryRendering = viewList.length > 0;
  const viewsFromProps = useMemo(() => {
    if (!views) return [];
    return Object.values(views).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    ) as ViewSpec<Keys>[];
  }, [views]);
  const ViewRenderProxy = useCallback(
    ({
      render,
      sizeKey,
    }: {
      render: ViewSpec<Keys>['render'];
      sizeKey: Keys;
    }) => (render ? <>{render({ active: true, sizeKey })}</> : null),
    []
  );
  const registrationChildren = useMemo(() => {
    if (!views || viewsFromProps.length === 0) return children;
    return viewsFromProps.map((view) => (
      <DynamicIslandView
        key={view.id}
        id={view.id}
        label={view.label}
        icon={view.icon}
        disabled={view.disabled}
        sizeKey={view.sizeKey as string | undefined}
        transition={view.transition}
        reticle={view.reticle}
        complex={view.complex}
        keepMounted={view.keepMounted}
      >
        {view.render ? (
          <ViewRenderProxy
            render={view.render}
            sizeKey={(view.sizeKey ?? currentSizeKey) as Keys}
          />
        ) : view.content ? (
          <Renderer
            tree={view.content}
            loading={false}
            fallback={DefaultFallback}
          />
        ) : null}
      </DynamicIslandView>
    ));
  }, [views, viewsFromProps, currentSizeKey, children, ViewRenderProxy]);

  useEffect(() => {
    if (!views) return;
    if (viewsFromProps.length === 0) return;
    setViewRegistry(cardId, views, registry);
  }, [cardId, views, viewsFromProps.length, registry]);

  useEffect(() => {
    const tabSource = viewList.length > 0 ? viewList : viewsFromProps;
    const nextTabs: TabView[] = tabSource.map((view) => ({
      _tag: 'TabView',
      id: view.id,
      label: view.label,
      icon: view.icon,
      disabled: view.disabled,
      sizeKey: view.sizeKey as string | undefined,
      transition: view.transition,
      reticle: view.reticle,
      complex: view.complex,
    }));
    registry.set(tabsAtom, nextTabs);
  }, [viewList, viewsFromProps, registry, tabsAtom]);

  // Auto-select first tab if none active
  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(cardId, tabs[0].id, registry);
      return;
    }
    if (
      activeTab &&
      tabs.length > 0 &&
      !tabs.find((tab) => tab.id === activeTab)
    ) {
      setActiveTab(cardId, tabs[0].id, registry);
    }
  }, [cardId, activeTab, tabs, registry]);

  const setViews = useCallback(
    (nextViews: ViewRegistry) => {
      if (!canUpdateRegistry) return;
      setViewRegistry(cardId, nextViews, registry);
    },
    [cardId, canUpdateRegistry, registry]
  );

  const addView = useCallback(
    (view: ViewSpec) => {
      if (!canUpdateRegistry) return;
      addViewEntry(cardId, view, registry);
    },
    [cardId, canUpdateRegistry, registry]
  );

  const updateView = useCallback(
    (viewId: string, patch: Partial<ViewSpec>) => {
      if (!canUpdateRegistry) return;
      updateViewEntry(cardId, viewId, patch, registry);
    },
    [cardId, canUpdateRegistry, registry]
  );

  const removeView = useCallback(
    (viewId: string) => {
      if (!canUpdateRegistry) return;
      removeViewEntry(cardId, viewId, registry);
    },
    [cardId, canUpdateRegistry, registry]
  );

  const clearViews = useCallback(() => {
    if (!canUpdateRegistry) return;
    clearViewEntries(cardId, registry);
  }, [cardId, canUpdateRegistry, registry]);

  const contextValue: DynamicIslandContextValue = useMemo(
    () => ({
      cardId,
      activeTab,
      useRegistryRendering,
      setViews,
      addView,
      updateView,
      removeView,
      clearViews,
    }),
    [
      cardId,
      activeTab,
      useRegistryRendering,
      setViews,
      addView,
      updateView,
      removeView,
      clearViews,
    ]
  );

  // Apply per-tab overrides via island machine
  useEffect(() => {
    const view = tabs.find((tab) => tab.id === activeTab);
    if (!view) return;

    const currentSizeKey = registry.get(cardStateFamily.sizeKey(cardId as any));
    const nextSizeKey = view.sizeKey ?? currentSizeKey;
    const grammar =
      view.transition === undefined
        ? DEFAULT_TRANSITION
        : typeof view.transition === 'string'
        ? parseGrammar(view.transition)
        : view.transition;
    const complexity =
      view.complex !== undefined
        ? view.complex
          ? 'complex'
          : 'simple'
        : registry.get(cardStateFamily.complexity(cardId as any));
    const currentTransition = registry.get(
      cardStateFamily.transition(cardId as any)
    );

    const sendTransition = (transition?: TransitionGrammar) => {
      sendIslandEvent(cardId as any, {
        type: 'TRANSITION',
        sizeKey: nextSizeKey,
        grammar: transition,
        reticle: view.reticle,
        complexity,
      });
    };

    if (grammar) {
      sendTransition(grammar);
      return;
    }

    let cancelled = false;
    Effect.runPromise(
      transitionStrategy({
        from: currentSizeKey,
        to: nextSizeKey,
        current: currentTransition,
        complexity,
        sizes: stateMachineConfig?.sizes as
          | Record<string, { width: number; height: number }>
          | undefined,
      })
    )
      .then((grammars) => {
        if (cancelled) return;
        const transitions =
          grammars.length > 0 ? grammars : [currentTransition];
        transitions.slice(0, -1).forEach((item) => {
          sendIslandEvent(cardId as any, {
            type: 'INTERMEDIATE_TRANSITION',
            grammar: item,
          });
        });
        sendTransition(transitions[transitions.length - 1]);
      })
      .catch(() => {
        if (cancelled) return;
        sendTransition();
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, tabs, cardId, registry, transitionStrategy]);

  const activeView = useMemo(() => {
    if (!activeTab || viewList.length === 0) return undefined;
    return viewList.find((view) => view.id === activeTab);
  }, [activeTab, viewList]);
  const lastActiveViewRef = useRef<ViewSpec<Keys> | undefined>(undefined);
  useEffect(() => {
    if (activeView) {
      lastActiveViewRef.current = activeView;
    }
  }, [activeView]);
  const resolvedView = activeView ?? lastActiveViewRef.current;
  const layout = resolvedView?.layout;
  const effectiveDynamicSize =
    layout?.fitContent ?? resolvedView?.dynamicSize ?? dynamicSize;
  const effectiveMinWidth =
    layout?.minWidth ?? resolvedView?.minWidth ?? minWidth;
  const effectiveMaxWidth =
    layout?.maxWidth ?? resolvedView?.maxWidth ?? maxWidth;
  const effectiveMinHeight =
    layout?.minHeight ?? resolvedView?.minHeight ?? minHeight;
  const effectiveMaxHeight =
    layout?.maxHeight ?? resolvedView?.maxHeight ?? maxHeight;
  const activeSizeKey = (resolvedView?.sizeKey ?? currentSizeKey) as Keys;
  const contentVariants = useMemo(
    () => grammarToVariants(activeTransition ?? DEFAULT_TRANSITION),
    [activeTransition]
  );

  return (
    <DynamicIslandContext.Provider value={contextValue}>
      <MorphCard
        cardId={cardId}
        initialSizeKey={initialSizeKey}
        stateMachineConfig={stateMachineConfig}
        transitionStrategy={transitionStrategy}
        config={config}
        disableAnimations={disableAnimations}
        dynamicSize={effectiveDynamicSize}
        minWidth={effectiveMinWidth}
        maxWidth={effectiveMaxWidth}
        minHeight={effectiveMinHeight}
        maxHeight={effectiveMaxHeight}
        scrollable={scrollable}
        interactive={interactive}
        className={className}
        slots={slots}
        theme={theme}
        renderers={renderers}
        onClick={onClick}
      >
        {/* TabBar at top */}
        <TabBar cardId={cardId} config={tabConfig} />

        {viewList.length > 0 ? (
          <div style={{ display: 'none' }}>{registrationChildren}</div>
        ) : null}

        {/* Content area - keep views mounted, animate active view */}
        <MorphCard.Content padding="md">
          {useRegistryRendering ? (
            <div className="relative">
              {(viewList.length > 0 ? viewList : viewsFromProps).map((view) => {
                const isActive = activeTab === view.id;
                const shouldMount = view.keepMounted ?? true;
                if (!shouldMount && !isActive) return null;
                const sizeKeyForView = (view.sizeKey ?? currentSizeKey) as Keys;
                const wrapperClass = cn(
                  isActive
                    ? 'relative pointer-events-auto'
                    : 'absolute inset-0 pointer-events-none'
                );

                return (
                  <motion.div
                    key={view.id}
                    data-active={isActive}
                    className={wrapperClass}
                    initial={false}
                    variants={contentVariants}
                    animate={
                      disableAnimations
                        ? undefined
                        : isActive
                        ? 'animate'
                        : 'exit'
                    }
                  >
                    {view.render ? (
                      view.render({
                        active: isActive,
                        sizeKey: sizeKeyForView,
                      })
                    ) : view.content ? (
                      <Renderer
                        tree={view.content}
                        loading={false}
                        fallback={DefaultFallback}
                      />
                    ) : null}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            registrationChildren
          )}
        </MorphCard.Content>
      </MorphCard>
    </DynamicIslandContext.Provider>
  );
}

export function DynamicIslandCard(props: DynamicIslandCardProps) {
  return (
    <RegistryContext.Provider value={morphCardRegistry}>
      <DynamicIslandCardInner {...props} />
    </RegistryContext.Provider>
  );
}

// =============================================================================
// View Compound Component
// =============================================================================

export interface DynamicIslandViewProps {
  /** Unique view identifier */
  id: string;
  /** Tab label */
  label: string;
  /** Optional icon name */
  icon?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Optional sizeKey override for this view */
  sizeKey?: string;
  /** Optional transition override for this view */
  transition?: string | TransitionGrammar;
  /** Optional reticle override for this view */
  reticle?: ReticleVariant;
  /** Whether this view should be treated as a complex transition */
  complex?: boolean;
  /** Keep this view mounted when inactive (default: true) */
  keepMounted?: boolean;
  /** View content */
  children: ReactNode;
}

/**
 * DynamicIslandCard.View - Defines a tabbed view within the card
 *
 * Registers itself with parent context and only renders when active.
 */
function DynamicIslandView({
  id,
  label,
  icon,
  disabled,
  sizeKey,
  transition,
  reticle,
  complex,
  keepMounted,
  children,
}: DynamicIslandViewProps) {
  const { activeTab, addView, removeView, useRegistryRendering } =
    useDynamicIslandContext();
  const renderView = useCallback(
    (_ctx: { active: boolean; sizeKey: string }) => children,
    [children]
  );

  // Register tab on mount, unregister on unmount
  useEffect(() => {
    addView({
      id,
      label,
      icon,
      disabled,
      sizeKey: sizeKey as string | undefined,
      transition,
      reticle,
      complex,
      keepMounted,
      render: renderView,
    });
    return () => removeView(id);
  }, [
    id,
    label,
    icon,
    disabled,
    sizeKey,
    transition,
    reticle,
    complex,
    keepMounted,
    addView,
    removeView,
    renderView,
  ]);

  if (useRegistryRendering) {
    return null;
  }

  const shouldMount = keepMounted ?? true;
  if (!shouldMount && activeTab !== id) {
    return null;
  }

  return (
    <div
      data-active={activeTab === id}
      style={{ display: activeTab === id ? 'block' : 'none' }}
    >
      {children}
    </div>
  );
}

// Attach compound component
DynamicIslandCard.View = DynamicIslandView;

export default DynamicIslandCard;
