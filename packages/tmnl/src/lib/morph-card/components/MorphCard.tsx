/**
 * MorphCard Component
 *
 * Polymorphic card container that morphs between modes.
 * Supports both static renders and AI-generated content.
 *
 * @module morph-card/components/MorphCard
 */

import {
  type ReactNode,
  type ReactElement,
  type CSSProperties,
  type HTMLAttributes,
  type ComponentType,
  type FC,
  useState,
  useMemo,
  useCallback,
  createContext,
  useContext,
  useEffect,
  useRef,
  isValidElement,
  forwardRef,
} from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Effect, Option } from 'effect';
import { RegistryContext, useAtomSet, useAtomValue } from '@effect-atom/atom-react';
import { cn } from '@/lib/utils';
import { useAtomStream } from '@/lib/connection-ports/hooks/useAtomStream';
import type { CardId, CardMode, SizePreset } from '../schemas';
import type {
  TransitionGrammar,
  MorphCardConfig,
  MorphCardStateMachineConfig,
} from '../schemas';
import { grammarToVariants, DEFAULT_TRANSITION } from '../schemas/transition-grammar';
import { DEFAULT_CARD_CONFIG } from '../schemas/animation-config';
import { DEFAULT_SIZES } from '../schemas/card-state';
import { DEFAULT_GENERATIVE_STATE } from '../schemas/generative-state';
import {
  type SizeKey,
  cardStateFamily,
  createCardStateService,
  DEFAULT_BOUNDS,
  DEFAULT_DRAG_STATE,
  DEFAULT_POSITION,
} from '../card-state';
import { morphCardRegistry } from '../atoms/registry';
import { CardContext, useCardContextValue, useCardActions, useCardOptional } from '../context';
import { generativeStateFamily } from '../atoms/generative-atoms';
import { AnimatedItem, ANIMATION_PRESETS } from './AnimatedItem';
import { MetricBlock, MetricGrid } from './MetricBlock';
import { GenerativeLoading, DecodeErrorBoundary } from './LoadingStates';
import { ReticleOverlay } from './ReticleOverlay';
import { useGenerativeMode } from '../hooks/useGenerativeMode';
import { GenerativeDepthProvider } from '@/lib/genifer/react/generative';
import { Renderer, DefaultFallback } from '@/lib/genifer/react/renderer';
import { LegendRenderer } from '@/lib/genifer/react/legend-renderer';
import { UITree } from '@/lib/genifer/core/schemas';
import type { DomainCatalog } from '@/lib/genifer/core/CatalogService';
import { Either, Schema } from 'effect';
import type { TransitionStrategy } from '../machines/islandMachine';
import { getOrCreateIslandActor } from '../machines/island-stx';

// =============================================================================
// Types
// =============================================================================

/**
 * Render function type for mode-specific content
 */
export type ModeRender = () => ReactElement;

/**
 * Render registry mapping modes to render functions
 */
export type RenderRegistry = Partial<Record<CardMode, ModeRender>>;

export interface SizeViewStrategyInput<Keys extends string = string> {
  readonly cardId: CardId;
  readonly sizeKey: Keys;
  readonly previousSizeKey: Keys;
  readonly mode: CardMode;
}

export type SizeViewStrategy<Keys extends string = string> = (
  input: SizeViewStrategyInput<Keys>
) => Effect.Effect<ReactNode | null>;

export type SizeViewRender<Keys extends string = string> = (
  input: SizeViewStrategyInput<Keys>
) => ReactNode;

export type SizeViewEntry<Keys extends string = string> =
  | ReactNode
  | SizeViewRender<Keys>;

export type SizeViewRegistry<Keys extends string = string> = Partial<
  Record<Keys | 'default', SizeViewEntry<Keys>>
>;

export type SizeKeysFromConfig<C extends { sizes: Record<string, unknown> }> =
  keyof C['sizes'] & string;

// =============================================================================
// Headless Skin Types
// =============================================================================

export type MorphCardSlotName =
  | 'container'
  | 'frame'
  | 'content'
  | 'header'
  | 'body'
  | 'footer'
  | 'title'
  | 'badge'
  | 'actions';

export interface MorphCardTheme {
  classNames?: Partial<Record<MorphCardSlotName, string>>;
  styles?: Partial<Record<MorphCardSlotName, CSSProperties>>;
}

export interface MorphCardSlots {
  Content?: ComponentType<any>;
  Header?: ComponentType<any>;
  Body?: ComponentType<any>;
  Footer?: ComponentType<any>;
  Title?: ComponentType<any>;
  Badge?: ComponentType<any>;
  Actions?: ComponentType<any>;
}

export interface MorphCardRenderers {
  container?: (defaultNode: ReactNode) => ReactNode;
  frame?: (defaultNode: ReactNode) => ReactNode;
}

/**
 * MorphCard Props
 */
export interface MorphCardProps<Keys extends string = string> {
  /** Unique card identifier */
  cardId: string;
  /** Initial sizeKey for dynamic island state */
  initialSizeKey?: string;
  /** State machine config (sizes + defaults) */
  stateMachineConfig?: MorphCardStateMachineConfig;
  /** Effect-driven transition strategy */
  transitionStrategy: TransitionStrategy;
  /** Enable scroll when content exceeds size (explicit only) */
  scrollable?: boolean;
  /** Card configuration */
  config?: Partial<MorphCardConfig>;
  /** Transition grammar for mode changes */
  transition?: TransitionGrammar;
  /** Render registry mapping modes to render functions */
  renders?: RenderRegistry;
  /** Optional sizeKey -> view mapping */
  sizeViews?: Partial<Record<string, ReactNode>>;
  /** Typed sizeKey -> render function mapping */
  views?: SizeViewRegistry<Keys>;
  /** Effect-driven sizeKey view resolver */
  sizeViewStrategy?: SizeViewStrategy<Keys>;
  /** Children (alternative to render registry) */
  children?: ReactNode | ((mode: CardMode) => ReactNode);
  /** Additional className */
  className?: string;
  /** Headless slots (inject components) */
  slots?: MorphCardSlots;
  /** Theme classes/styles (inject styling) */
  theme?: MorphCardTheme;
  /** Renderers for container/frame (full override) */
  renderers?: MorphCardRenderers;
  /** Whether card is interactive (hover effects) */
  interactive?: boolean;
  /** Disable layout/content animations */
  disableAnimations?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Mode change handler */
  onModeChange?: (mode: CardMode, previousMode: CardMode) => void;

  // ==========================================================================
  // Generative Props
  // ==========================================================================

  /** Enable generative mode - content generated by AI */
  generative?: boolean;
  /** Prompt template (use {{mode}} for interpolation) */
  prompt?: string;
  /** Additional context for AI generation */
  generativeContext?: Record<string, unknown>;
  /** API endpoint for generation */
  generativeApi?: string;
  /** Component catalog for rendering generated content */
  componentCatalog?: DomainCatalog;
  /** Custom loading text during generation */
  loadingText?: string;

  // ==========================================================================
  // Sizing Props
  // ==========================================================================

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
}

// =============================================================================
// Headless Skin Context
// =============================================================================

interface MorphCardSkinContextValue {
  slots?: MorphCardSlots;
  theme?: MorphCardTheme;
  renderers?: MorphCardRenderers;
}

const MorphCardSkinContext = createContext<MorphCardSkinContextValue>({});

export function useMorphCardSkin(): MorphCardSkinContextValue {
  return useContext(MorphCardSkinContext);
}

// =============================================================================
// Component
// =============================================================================

/**
 * MorphCard - Polymorphic card container
 *
 * Can be used in three ways:
 *
 * 1. **Render Registry** - Map modes to render functions
 * ```tsx
 * <MorphCard
 *   cardId="status-card"
 *   initialSizeKey="compact"
 *   stateMachineConfig={{
 *     sizes: {
 *       compact: { width: 220, height: 80 },
 *       expanded: { width: 420, height: 220 }
 *     }
 *   }}
 *   transitionStrategy={defaultTransitionStrategy}
 *   renders={{
 *     idle: () => <IdleView />,
 *     compact: () => <CompactView />,
 *     expanded: () => <ExpandedView />,
 *   }}
 * />
 * ```
 *
 * 2. **Render Function** - Single function receiving current mode
 * ```tsx
 * <MorphCard cardId="data-card">
 *   {(mode) => mode === 'expanded' ? <FullView /> : <SummaryView />}
 * </MorphCard>
 * ```
 *
 * 3. **Generative Mode** - AI-generated content per mode
 * ```tsx
 * <MorphCard
 *   cardId="gen-card"
 *   generative
 *   prompt="Generate a {{mode}} view of system metrics"
 *   componentCatalog={tmnlCatalog}
 *   transitionStrategy={defaultTransitionStrategy}
 * />
 * ```
 */
function MorphCardInner<Keys extends string = string>({
  cardId,
  initialSizeKey = 'default',
  stateMachineConfig,
  transitionStrategy: _transitionStrategy,
  scrollable = false,
  config: configProp,
  transition: transitionProp,
  renders,
  sizeViews,
  views,
  sizeViewStrategy,
  children,
  className,
  slots,
  theme,
  renderers,
  interactive = true,
  disableAnimations = false,
  onClick,
  onModeChange: _onModeChange,
  // Generative props
  generative = false,
  prompt,
  generativeContext,
  generativeApi,
  componentCatalog: _componentCatalog,
  loadingText,
  // Sizing props
  dynamicSize = false,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
}: MorphCardProps<Keys>) {
  const normalizedId = cardId as CardId;
  const registry = useContext(RegistryContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentRootNode, setContentRootNode] = useState<HTMLElement | null>(null);
  const transitionStrategy = _transitionStrategy;
  void transitionStrategy;
  const cardStateService = useMemo(
    () => createCardStateService(registry),
    [registry]
  );

  // Build context value
  const baseContextValue = useCardContextValue(normalizedId);
  const actions = useCardActions(normalizedId);
  const registerContentNode = useCallback((node: HTMLElement | null) => {
    setContentRootNode(node);
  }, []);
  const contextValue = useMemo(
    () => ({ ...baseContextValue, registerContentNode }),
    [baseContextValue, registerContentNode]
  );

  const skinContextValue = useMemo(
    () => ({ slots, theme, renderers }),
    [slots, theme, renderers]
  );

  const renderContainer = renderers?.container ?? ((node: ReactNode) => node);
  const renderFrame = renderers?.frame ?? ((node: ReactNode) => node);

  const setBehavior = useAtomSet(cardStateFamily.behavior(normalizedId));
  const setMeasuredSize = useAtomSet(cardStateFamily.measuredSize(normalizedId));
  useEffect(() => {
    if (registry !== morphCardRegistry) {
      throw new Error(
        '[MorphCard] Invalid registry: MorphCard must use morphCardRegistry via MorphCardRoot.'
      );
    }
  }, [registry]);

  const sizeKey = useAtomValue(cardStateFamily.sizeKey(normalizedId));
  const sizeMap = useMemo(
    () => (stateMachineConfig?.sizes ?? (DEFAULT_SIZES as Record<string, SizePreset>)),
    [stateMachineConfig]
  );
  const hasStandardSizeKey = !!sizeKey && !!sizeMap[sizeKey];
  const effectiveDynamicSize = dynamicSize || !hasStandardSizeKey;

  useEffect(() => {
    setBehavior({
      dynamicSize: effectiveDynamicSize,
      scrollable,
    });
  }, [effectiveDynamicSize, scrollable, setBehavior]);

  const behavior = useAtomValue(cardStateFamily.behavior(normalizedId));
  const isDynamicSize = behavior.dynamicSize;
  const isScrollable = behavior.scrollable;

  // Initialize generative state if enabled
  useEffect(() => {
    if (generative && prompt) {
      const currentState = registry.get(generativeStateFamily(normalizedId));
      // Only update if not already enabled or prompt changed
      if (!currentState.enabled || currentState.prompt !== prompt) {
        registry.set(generativeStateFamily(normalizedId), {
          ...DEFAULT_GENERATIVE_STATE,
          enabled: true,
          prompt,
          context: generativeContext,
          api: generativeApi,
          modes: { ...DEFAULT_GENERATIVE_STATE.modes },
        });
      }
    }
  }, [generative, prompt, generativeContext, generativeApi, normalizedId, registry]);

  // Generative mode hook
  const genMode = useGenerativeMode(normalizedId);

  // Merge config (machine defaults -> explicit config)
  const machineDefaults = useMemo(() => {
    const defaults: Partial<MorphCardConfig> = {};
    if (stateMachineConfig?.reticle) defaults.reticle = stateMachineConfig.reticle;
    if (stateMachineConfig?.reticleColor) {
      defaults.reticleColor = stateMachineConfig.reticleColor;
    }
    if (typeof stateMachineConfig?.motionBlur === 'boolean') {
      defaults.motionBlur = stateMachineConfig.motionBlur;
    }
    if (stateMachineConfig?.spring) defaults.spring = stateMachineConfig.spring;
    return defaults;
  }, [stateMachineConfig]);

  const config = useMemo(
    () => ({ ...DEFAULT_CARD_CONFIG, ...machineDefaults, ...configProp }),
    [configProp, machineDefaults]
  );

  // Active transition
  const machineTransition = useAtomValue(cardStateFamily.transition(normalizedId));
  const transition =
    transitionProp ?? machineTransition ?? contextValue.transition ?? DEFAULT_TRANSITION;
  const variants = useMemo(() => grammarToVariants(transition), [transition]);

  useEffect(() => {
    // TODO: remove debug logging after transition tracing.
    console.log('[MorphCard transition]', normalizedId, transition);
    console.log('[MorphCard variants]', normalizedId, variants);
  }, [normalizedId, transition, variants]);

  // Current mode and dimensions
  const { mode, isHovered } = contextValue.state;
  const previousSizeKey = useAtomValue(cardStateFamily.previousSizeKey(normalizedId));
  const measuredSizeRaw = useAtomValue(cardStateFamily.measuredSize(normalizedId));
  const measuredSizeStream = useAtomStream(
    cardStateFamily.measuredSizeDebounced(normalizedId)
  );
  const currentSize =
    sizeMap[sizeKey] ?? sizeMap.default ?? DEFAULT_SIZES.default;
  const measuredSize = measuredSizeStream.value ?? measuredSizeRaw ?? null;
  const overlaySize = measuredSize ?? currentSize;

  // Dynamic island state for reticle overlay
  const reticle = useAtomValue(cardStateFamily.reticle(normalizedId));
  const complexity = useAtomValue(cardStateFamily.complexity(normalizedId));
  const [resolvedSizeView, setResolvedSizeView] = useState<ReactNode | null>(null);
  const lastMeasuredRef = useRef<{ width: number; height: number } | null>(null);
  const measureRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sizeViewStrategy) {
      setResolvedSizeView(null);
      return;
    }
    let active = true;
    Effect.runPromise(
      sizeViewStrategy({
        cardId: normalizedId,
        sizeKey: sizeKey as Keys,
        previousSizeKey: previousSizeKey as Keys,
        mode,
      })
    )
      .then((view) => {
        if (active) setResolvedSizeView(view ?? null);
      })
      .catch(() => {
        if (active) setResolvedSizeView(null);
      });
    return () => {
      active = false;
    };
  }, [sizeViewStrategy, normalizedId, sizeKey, previousSizeKey, mode]);

  useEffect(() => {
    if (!isDynamicSize) return;
    const node = contentRootNode ?? contentRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      const target = entry.target as HTMLElement;
      const width = Math.max(rect.width, target.scrollWidth || rect.width);
      const height = Math.max(rect.height, target.scrollHeight || rect.height);

      if (measureRafRef.current) {
        cancelAnimationFrame(measureRafRef.current);
      }

      measureRafRef.current = requestAnimationFrame(() => {
        const prev = lastMeasuredRef.current;
        const next = { width, height };
        if (
          prev &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5
        ) {
          return;
        }
        lastMeasuredRef.current = next;
        setMeasuredSize(next);
      });
    });
    observer.observe(node);
    return () => {
      if (measureRafRef.current) {
        cancelAnimationFrame(measureRafRef.current);
        measureRafRef.current = null;
      }
      observer.disconnect();
    };
  }, [contentRootNode, isDynamicSize, setMeasuredSize]);


  // Initialize sizeKey snapshot (position/drag disabled)
  useEffect(() => {
    let isActive = true;
    Effect.runPromise(
      cardStateService.get(normalizedId).pipe(
        Effect.flatMap((snapshot) => {
          const next = {
            ...snapshot,
            sizeKey: (snapshot.sizeKey ?? (initialSizeKey as SizeKey)) as SizeKey,
            previousSizeKey: (snapshot.previousSizeKey ??
              (initialSizeKey as SizeKey)) as SizeKey,
            basePosition: DEFAULT_POSITION,
            position: DEFAULT_POSITION,
            bounds: DEFAULT_BOUNDS,
            drag: DEFAULT_DRAG_STATE,
          };
          return cardStateService
            .set(normalizedId, next, { recordHistory: false, persist: true })
            .pipe(Effect.map(() => next));
        })
      )
    )
      .then((snapshot) => {
        if (!isActive) return;
        getOrCreateIslandActor(normalizedId, {
          sizeKey: snapshot.sizeKey,
          previousSizeKey: snapshot.previousSizeKey,
          reticle: snapshot.reticle,
          activeTransition: snapshot.transition,
          complexity: snapshot.complexity,
        });
      })
      .catch(() => {
        // noop - state initialization is best effort
      });
    return () => {
      isActive = false;
    };
  }, [
    cardStateService,
    initialSizeKey,
    normalizedId,
  ]);

  // Handle hover
  const handleMouseEnter = useCallback(() => {
    if (interactive) actions.setHovered(true);
  }, [interactive, actions]);

  const handleMouseLeave = useCallback(() => {
    if (interactive) actions.setHovered(false);
  }, [interactive, actions]);

  // Resolve content (static vs generative)
  const staticContent = useMemo(() => {
    // Render registry takes precedence
    if (renders && renders[mode]) {
      return renders[mode]!();
    }
    // Effect-driven size view resolver
    if (resolvedSizeView) {
      return resolvedSizeView;
    }
    // Typed size view provider
    if (views) {
      const entry = views[sizeKey as Keys] ?? views.default;
      if (typeof entry === 'function') {
        return entry({
          cardId: normalizedId,
          sizeKey: sizeKey as Keys,
          previousSizeKey: previousSizeKey as Keys,
          mode,
        });
      }
      if (entry) return entry;
    }
    // Explicit sizeViews map (legacy)
    if (sizeViews) {
      const mapped = sizeViews[sizeKey] ?? sizeViews.default;
      if (mapped) return mapped;
    }
    // Render function
    if (typeof children === 'function') {
      return children(mode);
    }
    // SizeKey-scoped views
    const childArray = Array.isArray(children) ? children : [children];
    const sizeViewElements = childArray.filter(
      (child) => isValidElement(child) && child.type === SizeView
    ) as Array<ReactElement<SizeViewProps>>;
    if (sizeViewElements.length > 0) {
      const matched = sizeViewElements.find((view) => view.props.sizeKey === sizeKey);
      if (matched) return matched;
      const fallback = sizeViewElements.find((view) => view.props.sizeKey === 'default');
      if (fallback) return fallback;
      const nonViews = childArray.filter(
        (child) => !(isValidElement(child) && child.type === SizeView)
      );
      if (nonViews.length > 0) return <>{nonViews}</>;
      return sizeViewElements[0] ?? null;
    }
    // Static children
    return children;
  }, [
    renders,
    resolvedSizeView,
    sizeViews,
    views,
    children,
    mode,
    sizeKey,
    previousSizeKey,
    normalizedId,
  ]);

  // Generative content rendering with proper error boundary
  // OPTIMIZATION: Use Legend State LegendRenderer for fine-grained reactivity during streaming
  // Only fall back to standard Renderer for completion validation
  const generativeContent = useMemo(() => {
    // LOGGING: Track render decision path
    console.log('[MorphCard] generativeContent decision', {
      cardId,
      generative,
      isEnabled: genMode.isEnabled,
      status: genMode.status,
      hasTree$: !!genMode.tree$,
      hasContent: Option.isSome(genMode.content),
      contentRoot: Option.isSome(genMode.content) ? genMode.content.value.root : null,
      contentElementCount: Option.isSome(genMode.content) ? Object.keys(genMode.content.value.elements).length : 0,
    });

    if (!generative || !genMode.isEnabled) {
      console.log('[MorphCard] generativeContent → null (not generative or not enabled)');
      return null;
    }

    const isStreaming = genMode.status === 'streaming';

    // LEGEND STATE OPTIMIZATION: Use LegendRenderer during streaming
    // This provides fine-grained reactivity - only changed elements re-render
    if (isStreaming && genMode.tree$) {
      console.log('[MorphCard] generativeContent → LegendRenderer (streaming path)', {
        tree$Root: genMode.tree$?.root?.get?.() ?? 'no root getter',
        tree$ElementCount: Object.keys(genMode.tree$?.elements?.get?.() ?? {}).length,
      });
      return (
        <GenerativeDepthProvider prompt={prompt}>
          <LegendRenderer
            tree$={genMode.tree$}
            loading={true}
            fallback={DefaultFallback}
          />
        </GenerativeDepthProvider>
      );
    }

    // LOGGING: Streaming but no tree$
    if (isStreaming && !genMode.tree$) {
      console.log('[MorphCard] generativeContent → STREAMING BUT NO tree$ (falling through)');
    }

    // If we have content, render it using the genifer Renderer
    if (Option.isSome(genMode.content)) {
      const { root, elements } = genMode.content.value;

      console.log('[MorphCard] generativeContent → Renderer (content path)', {
        root,
        elementCount: Object.keys(elements).length,
        elementTypes: [...new Set(Object.values(elements).map((e: any) => e?.type))],
      });

      // On completion, validate the final tree
      const decodeResult = Schema.decodeUnknownEither(UITree)({
        root: root ?? '',
        elements: elements as Record<string, unknown>,
      });

      if (Either.isLeft(decodeResult)) {
        // Decode failed - this is a real error
        console.error('[MorphCard] generativeContent → DecodeErrorBoundary (schema validation failed)', {
          error: decodeResult.left,
          root,
          elementCount: Object.keys(elements).length,
        });
        return (
          <DecodeErrorBoundary
            error={decodeResult.left}
            onRetry={genMode.retry}
          />
        );
      }

      console.log('[MorphCard] generativeContent → Renderer (decode success)', {
        tree: decodeResult.right,
        rootElement: decodeResult.right.elements[decodeResult.right.root],
      });

      // Successful decode - use standard Renderer
      return (
        <GenerativeDepthProvider prompt={prompt}>
          <Renderer
            tree={decodeResult.right}
            loading={false}
            fallback={DefaultFallback}
          />
        </GenerativeDepthProvider>
      );
    }

    console.log('[MorphCard] generativeContent → null (fallback - no content)');
    return null;
  }, [generative, genMode.isEnabled, genMode.content, genMode.status, genMode.tree$, genMode.retry, prompt, cardId]);

  // Final content (wrapped in loading state if generative)
  const finalContent = useMemo(() => {
    console.log('[MorphCard] finalContent decision', {
      cardId,
      generative,
      isEnabled: genMode.isEnabled,
      status: genMode.status,
      hasGenerativeContent: !!generativeContent,
      hasStaticContent: !!staticContent,
      willUseGenerativeLoading: generative && genMode.isEnabled,
    });

    if (generative && genMode.isEnabled) {
      const childContent = generativeContent || staticContent;
      console.log('[MorphCard] finalContent → GenerativeLoading wrapper', {
        childType: childContent ? (childContent as any)?.type?.name ?? typeof childContent : 'null',
        usingGenerativeContent: !!generativeContent,
        usingStaticContent: !generativeContent && !!staticContent,
      });
      return (
        <GenerativeLoading
          status={genMode.status}
          progress={genMode.progress}
          error={genMode.error}
          onRetry={genMode.retry}
          loadingText={loadingText}
        >
          {childContent}
        </GenerativeLoading>
      );
    }
    console.log('[MorphCard] finalContent → staticContent (non-generative)');
    return staticContent;
  }, [
    cardId,
    generative,
    genMode.isEnabled,
    genMode.status,
    genMode.progress,
    genMode.error,
    genMode.retry,
    generativeContent,
    staticContent,
    loadingText,
  ]);

  const sizeSpring = useMemo(
    () => ({
      stiffness: config.spring?.stiffness ?? 400,
      damping: config.spring?.damping ?? 30,
      mass: config.spring?.mass ?? 0.8,
    }),
    [config.spring?.damping, config.spring?.mass, config.spring?.stiffness]
  );
  const widthMv = useMotionValue(currentSize.width);
  const heightMv = useMotionValue(currentSize.height);
  const widthSpring = useSpring(widthMv, sizeSpring);
  const heightSpring = useSpring(heightMv, sizeSpring);
  const targetWidth = measuredSize?.width ?? currentSize.width;
  const targetHeight = measuredSize?.height ?? currentSize.height;

  useEffect(() => {
    if (!isDynamicSize) return;
    widthMv.set(targetWidth);
    heightMv.set(targetHeight);
  }, [heightMv, isDynamicSize, targetHeight, targetWidth, widthMv]);

  // Dynamic sizing style
  const dynamicSizeStyle = useMemo(() => {
    if (!isDynamicSize) return {};
    return {
      minWidth: minWidth ?? currentSize.width * 0.5,
      maxWidth: maxWidth ?? currentSize.width * 2,
      minHeight: minHeight ?? 100,
      maxHeight: maxHeight,
      width: disableAnimations ? targetWidth : widthSpring,
      height: disableAnimations ? targetHeight : heightSpring,
    };
  }, [
    disableAnimations,
    heightSpring,
    isDynamicSize,
    maxHeight,
    maxWidth,
    minHeight,
    minWidth,
    targetHeight,
    targetWidth,
    widthSpring,
    currentSize.height,
    currentSize.width,
  ]);
  const transitionKey = `${transition.verb}:${transition.modifier ?? ''}:${transition.direction ?? ''}`;
  const contentKey = `${mode}-${generative ? 'gen' : 'static'}-${sizeKey}-${transitionKey}`;

  useEffect(() => {
    // TODO: remove debug logging after transition tracing.
    console.log('[MorphCard contentKey]', normalizedId, contentKey);
  }, [normalizedId, contentKey]);

  const shouldAnimateContent =
    !!renders ||
    !!views ||
    !!sizeViews ||
    !!sizeViewStrategy ||
    generative;

  const containerTransition = disableAnimations
    ? { duration: 0 }
    : {
        type: 'spring',
        stiffness: sizeSpring.stiffness,
        damping: sizeSpring.damping,
        mass: sizeSpring.mass,
      };

  return (
    <MorphCardSkinContext.Provider value={skinContextValue}>
      <CardContext.Provider value={contextValue}>
        {renderContainer(
          <motion.div
            ref={containerRef}
            className={cn(
              'relative will-change-transform',
              interactive && 'cursor-pointer',
              theme?.classNames?.container,
              className
            )}
            data-card-id={cardId}
            data-mode={mode}
            data-generative={generative}
            data-dynamic-size={isDynamicSize}
            onClick={onClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              ...dynamicSizeStyle,
              ...theme?.styles?.container,
              ...(isDynamicSize
                ? {
                    width: disableAnimations ? targetWidth : widthSpring,
                    height: disableAnimations ? targetHeight : heightSpring,
                  }
                : {}),
            }}
            animate={{
              ...(isDynamicSize
                ? {}
                : {
                    width: currentSize.width,
                    height: currentSize.height,
                  }),
            }}
            transition={containerTransition}
          >
            {/* Main container */}
            {renderFrame(
              <motion.div
                className={cn(
                  'relative overflow-hidden',
                  isDynamicSize ? 'inline-block w-fit min-h-0' : 'w-full h-full',
                  theme?.classNames?.frame
                )}
                style={{
                  ...theme?.styles?.frame,
                }}
              >
                <ReticleOverlay
                  variant={reticle}
                  isActive={complexity === 'complex'}
                  color={config.reticleColor ?? 'rgba(255,255,255,0.3)'}
                  width={overlaySize.width}
                  height={overlaySize.height}
                />
                {/* Content with transition animation */}
                {disableAnimations || !shouldAnimateContent ? (
                  <div
                    ref={contentRef}
                    className={cn(
                      isDynamicSize ? 'inline-block w-fit' : 'h-full',
                      isScrollable && 'overflow-auto'
                    )}
                  >
                    {finalContent}
                  </div>
                ) : (
                  <div
                    ref={contentRef}
                    className={cn(
                      isDynamicSize ? 'inline-block w-fit' : 'h-full',
                      isScrollable && 'overflow-auto'
                    )}
                  >
                    <AnimatePresence mode="popLayout">
                      <motion.div
                        key={contentKey}
                        initial={variants.initial as any}
                        animate={variants.animate as any}
                        exit={variants.exit as any}
                      >
                        {finalContent}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </CardContext.Provider>
    </MorphCardSkinContext.Provider>
  );
}

function MorphCardRoot(props: MorphCardProps) {
  return (
    <RegistryContext.Provider value={morphCardRegistry}>
      <MorphCardInner {...props} />
    </RegistryContext.Provider>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * MorphCard.Content - Headless content wrapper
 */
interface ContentProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING_VALUES = {
  none: '0px',
  sm: 'var(--morph-card-padding-sm, 0px)',
  md: 'var(--morph-card-padding-md, 0px)',
  lg: 'var(--morph-card-padding-lg, 0px)',
};

const Content: FC<ContentProps> = ({ children, className, style, padding = 'md', ...props }) => {
  const { slots, theme } = useMorphCardSkin();
  const Slot = slots?.Content ?? 'div';

  return (
    <Slot
      className={cn(theme?.classNames?.content, className)}
      style={{ padding: PADDING_VALUES[padding], ...theme?.styles?.content, ...style }}
      data-slot="content"
      {...props}
    >
      {children}
    </Slot>
  );
};

/**
 * MorphCard.SizeView - SizeKey-scoped view wrapper
 */
interface SizeViewProps {
  sizeKey: string;
  children: ReactNode;
}

const SizeView: FC<SizeViewProps> = ({ children }) => <>{children}</>;

/**
 * MorphCard.Header - Headless header slot
 */
interface HeaderProps extends HTMLAttributes<HTMLDivElement> {}

const Header: FC<HeaderProps> = ({ children, className, style, ...props }) => {
  const { slots, theme } = useMorphCardSkin();
  const Slot = slots?.Header ?? 'div';

  return (
    <Slot
      className={cn(theme?.classNames?.header, className)}
      style={{ ...theme?.styles?.header, ...style }}
      data-slot="header"
      {...props}
    >
      {children}
    </Slot>
  );
};

/**
 * MorphCard.Div - Layout-aware wrapper
 */
interface DivProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Register this node as the content measurement root */
  measure?: boolean;
  /** Display mode */
  layout?: 'block' | 'inline' | 'inline-block';
  /** Fill available space */
  fill?: boolean;
}

const Div = forwardRef<HTMLDivElement, DivProps>(
  ({ children, className, style, measure = false, layout = 'block', fill = false }, ref) => {
    const ctx = useCardOptional();
    const assignRef = useCallback(
      (node: HTMLDivElement | null) => {
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as { current: HTMLDivElement | null }).current = node;
        }
        if (measure) ctx?.registerContentNode?.(node);
      },
      [ctx, measure, ref]
    );

    const display =
      layout === 'inline' ? 'inline' : layout === 'inline-block' ? 'inline-block' : 'block';

    return (
      <motion.div
        ref={assignRef}
        className={cn('min-w-0', className)}
        style={{
          display,
          ...(fill ? { flex: 1, minWidth: 0 } : null),
          ...style,
        }}
      >
        {children}
      </motion.div>
    );
  }
);

Div.displayName = 'MorphCard.Div';

/**
 * MorphCard.Stack - Layout-aware flex wrapper
 */
interface StackProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  direction?: 'row' | 'column';
  gap?: number | string;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  wrap?: boolean;
  fill?: boolean;
}

const Stack = forwardRef<HTMLDivElement, StackProps>(
  (
    {
      children,
      className,
      style,
      direction = 'row',
      gap = 12,
      align = 'stretch',
      justify,
      wrap = false,
      fill = false,
    },
    ref
  ) => {
    const gapValue = typeof gap === 'number' ? `${gap}px` : gap;
    return (
      <motion.div
        ref={ref}
        className={cn(className)}
        style={{
          display: 'flex',
          flexDirection: direction,
          gap: gapValue,
          alignItems: align,
          ...(justify ? { justifyContent: justify } : null),
          ...(wrap ? { flexWrap: 'wrap' } : null),
          ...(fill ? { flex: 1, minWidth: 0 } : null),
          ...style,
        }}
      >
        {children}
      </motion.div>
    );
  }
);

Stack.displayName = 'MorphCard.Stack';

/**
 * MorphCard.Title - Headless title slot
 */
interface TitleProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
}

const Title: FC<TitleProps> = ({ children, className, style, size = 'md', ...props }) => {
  const { slots, theme } = useMorphCardSkin();
  const Slot = slots?.Title ?? 'span';

  return (
    <Slot
      className={cn(theme?.classNames?.title, className)}
      style={{ ...theme?.styles?.title, ...style }}
      data-slot="title"
      data-size={size}
      {...props}
    >
      {children}
    </Slot>
  );
};

/**
 * MorphCard.Badge - Headless badge slot
 */
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const Badge: FC<BadgeProps> = ({ children, variant = 'default', className, style, ...props }) => {
  const { slots, theme } = useMorphCardSkin();
  const Slot = slots?.Badge ?? 'span';

  return (
    <Slot
      className={cn(theme?.classNames?.badge, className)}
      style={{ ...theme?.styles?.badge, ...style }}
      data-slot="badge"
      data-variant={variant}
      {...props}
    >
      {children}
    </Slot>
  );
};

/**
 * MorphCard.Body - Headless body slot
 */
interface BodyProps extends HTMLAttributes<HTMLDivElement> {}

const Body: FC<BodyProps> = ({ children, className, style, ...props }) => {
  const { slots, theme } = useMorphCardSkin();
  const Slot = slots?.Body ?? 'div';

  return (
    <Slot
      className={cn(theme?.classNames?.body, className)}
      style={{ ...theme?.styles?.body, ...style }}
      data-slot="body"
      {...props}
    >
      {children}
    </Slot>
  );
};

/**
 * MorphCard.Footer - Headless footer slot
 */
interface FooterProps extends HTMLAttributes<HTMLDivElement> {}

const Footer: FC<FooterProps> = ({ children, className, style, ...props }) => {
  const { slots, theme } = useMorphCardSkin();
  const Slot = slots?.Footer ?? 'div';

  return (
    <Slot
      className={cn(theme?.classNames?.footer, className)}
      style={{ ...theme?.styles?.footer, ...style }}
      data-slot="footer"
      {...props}
    >
      {children}
    </Slot>
  );
};

/**
 * MorphCard.Actions - Headless actions slot
 */
interface ActionsProps extends HTMLAttributes<HTMLDivElement> {}

const Actions: FC<ActionsProps> = ({ children, className, style, ...props }) => {
  const { slots, theme } = useMorphCardSkin();
  const Slot = slots?.Actions ?? 'div';

  return (
    <Slot
      className={cn(theme?.classNames?.actions, className)}
      style={{ ...theme?.styles?.actions, ...style }}
      data-slot="actions"
      {...props}
    >
      {children}
    </Slot>
  );
};

// =============================================================================
// Compound Component Export
// =============================================================================

/**
 * MorphCard compound component with all sub-components
 */
export const MorphCard = Object.assign(MorphCardRoot, {
  Content,
  Div,
  Stack,
  SizeView,
  Header,
  Title,
  Badge,
  Body,
  Footer,
  Actions,
  // Re-export related components
  AnimatedItem,
  MetricBlock,
  MetricGrid,
  // Re-export presets
  ANIMATION_PRESETS,
});

export default MorphCard;
